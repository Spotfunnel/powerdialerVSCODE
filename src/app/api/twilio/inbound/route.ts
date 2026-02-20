import { NextResponse } from 'next/server';
import Twilio from 'twilio';
import { validateTwilioRequest, normalizeToE164 } from '@/lib/twilio';
import { prismaDirect, withPrismaRetry } from '@/lib/prisma';
import { findLeadByPhone } from '@/lib/leads';
import { sendPushNotification } from '@/lib/push';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const params = Object.fromEntries(formData.entries());
        const url = req.url;

        // Security Audit: Validate Twilio Signature
        if (process.env.NODE_ENV === "production") {
            const isValid = await validateTwilioRequest(req, url, params);
            if (!isValid) {
                console.error("[Security] INVALID TWILIO SIGNATURE on inbound voice route.");
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }

        const rawFrom = formData.get('Caller') as string || 'Unknown';
        const rawTo = formData.get('To') as string || 'Unknown';

        const fromNumber = rawFrom !== 'Unknown' ? normalizeToE164(rawFrom) : 'Unknown';
        const toNumber = rawTo !== 'Unknown' ? normalizeToE164(rawTo) : 'Unknown';
        const callSid = formData.get('CallSid') as string || 'Unknown';

        console.log(`[Inbound] WEBHOOK HIT. Sid: ${callSid}, Path: /api/twilio/inbound, Caller: ${fromNumber} (raw: ${rawFrom}), To: ${toNumber}`);

        // All database operations wrapped in retry logic
        return await withPrismaRetry(async () => {
            // INITIAL LOG ENTRY
            const log = await prismaDirect.twilioLog.create({
                data: {
                    fromNumber,
                    toNumber,
                    direction: 'INBOUND',
                    twimlContent: `[INITIAL] Processing Sid: ${callSid}...`,
                    errorCode: callSid,
                }
            });

            // 1. LOOKUP OR CREATE LEAD
            let lead = await findLeadByPhone(fromNumber);
            if (!lead) {
                console.log(`[Inbound] Unknown caller ${fromNumber}. Creating new Lead.`);
                lead = await prismaDirect.lead.create({
                    data: {
                        phoneNumber: fromNumber,
                        firstName: "Inbound",
                        lastName: "Caller",
                        companyName: "Unknown Caller",
                        status: "NEW",
                        source: "INBOUND_CALL"
                    }
                });
            }

            // 2. LOOKUP NUMBER OWNERSHIP (Target)
            const numberPoolItem = await prismaDirect.numberPool.findUnique({
                where: { phoneNumber: toNumber },
                include: { owner: true }
            });

            let targetIdentity: string | undefined;
            let targetUserId: string | undefined;
            let routingReason = "UNKNOWN";

            // 3. CHECK OWNER PRESENCE
            if (numberPoolItem?.owner) {
                const owner = numberPoolItem.owner;
                const isOnline = owner.lastSeenAt && (new Date().getTime() - new Date(owner.lastSeenAt).getTime() < 60000);

                if (isOnline) {
                    targetIdentity = owner.id;
                    targetUserId = owner.id;
                    routingReason = `OWNER_ONLINE (${owner.email})`;
                } else {
                    console.log(`[Inbound] Owner ${owner.email} is OFFLINE. Acting backup.`);
                    routingReason = "OWNER_OFFLINE_FALLBACK";
                }
            }

            // 4. FALLBACK: FIND ANY ONLINE AGENT
            if (!targetIdentity) {
                const oneMinuteAgo = new Date(Date.now() - 60000);
                const onlineAgent = await prismaDirect.user.findFirst({
                    where: { lastSeenAt: { gte: oneMinuteAgo } },
                    orderBy: { lastSeenAt: 'desc' },
                    select: { id: true, email: true }
                });

                if (onlineAgent) {
                    targetIdentity = onlineAgent.id;
                    targetUserId = onlineAgent.id;
                    routingReason += ` -> ANY_ONLINE (${onlineAgent.email})`;
                }
            }

            // 5. LAST RESORT: OWNER (even if offline), ADMIN, or LAST INTERACTION
            if (!targetIdentity) {
                const lastInteraction = await prismaDirect.call.findFirst({
                    where: { OR: [{ toNumber: fromNumber }, { fromNumber: fromNumber }] },
                    orderBy: { createdAt: 'desc' },
                    select: { userId: true }
                });

                if (lastInteraction?.userId) {
                    targetIdentity = lastInteraction.userId;
                    targetUserId = lastInteraction.userId;
                    routingReason += " -> LAST_INTERACTION";
                } else if (numberPoolItem?.ownerUserId) {
                    targetIdentity = numberPoolItem.ownerUserId;
                    targetUserId = numberPoolItem.ownerUserId;
                    routingReason += " -> OWNER_FALLBACK";
                } else {
                    const admin = await prismaDirect.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
                    targetIdentity = admin?.id;
                    targetUserId = admin?.id;
                    routingReason += " -> ADMIN_FALLBACK";
                }
            }

            // [NEW] CREATE CALL RECORD EARLY to ensure visibility in History
            const finalUserId = targetUserId || numberPoolItem?.ownerUserId || (await prismaDirect.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }))?.id;

            if (!finalUserId) {
                console.error("[Inbound] CRITICAL: No user found for call logging fallback.");
                return new NextResponse("Configuration Error", { status: 500 });
            }

            const callRecord = await prismaDirect.call.create({
                data: {
                    twilioSid: callSid,
                    fromNumber: fromNumber,
                    toNumber: toNumber,
                    direction: "INBOUND",
                    status: "ringing",
                    leadId: lead.id,
                    userId: finalUserId
                }
            });

            // 6. PSTN FALLBACK (If identity found but potentially offline, OR if NO identity found)
            if (!targetIdentity || !targetUserId) {
                if (numberPoolItem?.owner?.repPhoneNumber) {
                    const repPhone = numberPoolItem.owner.repPhoneNumber;
                    const r = new Twilio.twiml.VoiceResponse();

                    // Add whisper so the user knows it's from PowerDialer (not spam)
                    const callerLabel = (lead.firstName + " " + lead.lastName).trim() || fromNumber;
                    const companyLabel = lead.companyName || "";
                    const whisperUrl = `/api/twilio/whisper?callerName=${encodeURIComponent(callerLabel)}&callerCompany=${encodeURIComponent(companyLabel)}`;

                    const pstnDial = r.dial({
                        action: '/api/twilio/inbound-status',
                        method: 'POST',
                        record: 'record-from-answer',
                        recordingStatusCallback: '/api/twilio/recording',
                        recordingStatusCallbackEvent: ['completed']
                    });
                    pstnDial.number({ url: whisperUrl }, repPhone);

                    const xml = r.toString();

                    await prismaDirect.twilioLog.update({
                        where: { id: log.id },
                        data: { twimlContent: `[PSTN_FALLBACK] [Target: ${repPhone}] ${xml}` }
                    });

                    // Update call status to redirected
                    await prismaDirect.call.update({
                        where: { id: callRecord.id },
                        data: { status: "redirected" }
                    });

                    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
                }

                console.error("[Inbound] NO TARGET IDENTITY OR PSTN FALLBACK FOUND. Hanging up.");
                const r = new Twilio.twiml.VoiceResponse();
                r.say("Sorry, no agents are available at this time.");
                return new NextResponse(r.toString(), { headers: { "Content-Type": "text/xml" } });
            }

            // 7. TRIGGER PUSH NOTIFICATION (Background Alert for iOS PWA) - ALWAYS TRY WAKING
            if (targetUserId) {
                const subscriptions = await (prismaDirect as any).pushSubscription.findMany({
                    where: { userId: targetUserId }
                });

                if (subscriptions.length > 0) {
                    const callerName = (lead.firstName + " " + lead.lastName).trim() || fromNumber;
                    const payload = {
                        title: "Incoming Call",
                        body: `Inbound call from ${callerName}`,
                        url: "/dialer",
                        tag: "incoming-call" // Use a tag to replace existing notifications
                    };

                    // Send push regardless of "online" status to wake backgrounded PWA
                    Promise.all(subscriptions.map((sub: any) =>
                        sendPushNotification({
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        }, payload).then(async (res: any) => {
                            if (res.expired) {
                                await (prismaDirect as any).pushSubscription.delete({ where: { id: sub.id } }).catch(() => { });
                            }
                        })
                    )).catch(err => console.error("[Push] Error in fire-and-forget relay:", err));
                }
            }

            // 8. RESOLVE TARGET USER'S PSTN NUMBER FOR SIMULTANEOUS RING
            let repPhoneNumber: string | null = null;
            if (numberPoolItem?.owner?.repPhoneNumber) {
                repPhoneNumber = numberPoolItem.owner.repPhoneNumber;
            } else if (targetUserId) {
                const targetUser = await prismaDirect.user.findUnique({
                    where: { id: targetUserId },
                    select: { repPhoneNumber: true }
                });
                repPhoneNumber = targetUser?.repPhoneNumber || null;
            }

            const callerLabel = (lead.firstName + " " + lead.lastName).trim() || "Unknown Lead";
            const companyLabel = lead.companyName || "Unknown Company";

            console.log(`[Inbound] DECISION: ${targetIdentity} | Reason: ${routingReason} | PSTN Sim-Ring: ${repPhoneNumber || 'NONE'}`);

            const response = new Twilio.twiml.VoiceResponse();
            const dial = response.dial({
                action: `/api/twilio/inbound-status`,
                method: 'POST',
                record: 'record-from-answer',
                recordingStatusCallback: '/api/twilio/recording',
                recordingStatusCallbackEvent: ['completed']
            });

            // Ring browser via Twilio Device SDK
            const client = dial.client(targetIdentity);
            client.parameter({ name: 'callerName', value: callerLabel });
            client.parameter({ name: 'callerCompany', value: companyLabel });

            // Simultaneously ring the user's phone with whisper screening
            // When they answer their phone, they hear:
            //   "PowerDialer call from [Name], [Company]. Press 1 to accept."
            // This lets them distinguish PowerDialer calls from spam/other businesses.
            // Whichever leg (browser or phone) picks up first wins.
            if (repPhoneNumber) {
                const whisperUrl = `/api/twilio/whisper?callerName=${encodeURIComponent(callerLabel)}&callerCompany=${encodeURIComponent(companyLabel)}`;
                dial.number({ url: whisperUrl }, repPhoneNumber);
                routingReason += ` + SIMRING(${repPhoneNumber})`;
            }

            const xml = response.toString();

            // FINAL LOG UPDATE
            const finalTwiml = `[Reason: ${routingReason}] [Target: ${targetIdentity}] ${xml}`;
            await prismaDirect.twilioLog.update({
                where: { id: log.id },
                data: { twimlContent: finalTwiml }
            });

            return new NextResponse(xml, {
                headers: { "Content-Type": "text/xml" }
            });
        });
    } catch (error) {
        console.error("[Inbound] ERROR:", error);
        const r = new Twilio.twiml.VoiceResponse();
        r.say("Application error.");
        return new NextResponse(r.toString(), { headers: { "Content-Type": "text/xml" } });
    }
}

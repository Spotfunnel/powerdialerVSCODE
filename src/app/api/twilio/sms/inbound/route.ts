import { NextResponse } from 'next/server';
import { validateTwilioRequest } from '@/lib/twilio';
import { prismaDirect, withPrismaRetry } from "@/lib/prisma";
import { findLeadByPhone } from "@/lib/leads";
import { sendPushNotification } from "@/lib/push";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const params = Object.fromEntries(formData.entries());
        const url = req.url;

        // Security Audit: Validate Twilio Signature
        if (process.env.NODE_ENV === "production") {
            const isValid = await validateTwilioRequest(req, url, params);
            if (!isValid) {
                console.error("[Security] INVALID TWILIO SIGNATURE on inbound SMS route.");
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }

        const fromNumber = formData.get('From') as string;
        const toNumber = formData.get('To') as string;
        const body = formData.get('Body') as string;
        const messageSid = formData.get('MessageSid') as string;
        const numMedia = formData.get('NumMedia') ? parseInt(formData.get('NumMedia') as string) : 0;

        // Optionally handle media (MMS) - append to body or separate field if we had one
        let fullBody = body;
        if (numMedia > 0) {
            fullBody += ` [Attached ${numMedia} media file(s) - View in Twilio Console]`;
        }

        console.log(`[SMS Inbound] From: ${fromNumber}, To: ${toNumber}, Body: ${fullBody}`);

        if (!fromNumber || !toNumber) {
            return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
        }

        // All database operations wrapped in retry logic for extreme concurrency resilience
        return await withPrismaRetry(async () => {
            // 1. Get Number Pool configuration
            const numberPool = await prismaDirect.numberPool.findUnique({
                where: { phoneNumber: toNumber }
            });

            // 2. Find Contact (Lead) with flexible phone matching
            const contact = await findLeadByPhone(fromNumber);
            console.log(`[SMS Inbound] Contact Lookup: ${fromNumber} => ${contact?.id || 'NOT_FOUND'} (${contact?.firstName || 'No Name'})`);

            // 3. Determine Conversation Owner
            let assignedUserId = contact?.assignedToId;

            // If no assigned user, check LastInteractionMap
            if (!assignedUserId) {
                const lastInteraction = await prismaDirect.lastInteractionMap.findUnique({
                    where: { customerPhone: fromNumber }
                });
                if (lastInteraction?.lastUserId) {
                    assignedUserId = lastInteraction.lastUserId;
                }
            }

            // Fallback to owner of the Twilio Number
            if (!assignedUserId && numberPool?.ownerUserId) {
                assignedUserId = numberPool.ownerUserId;
            }

            // Final Fallback: Admin
            if (!assignedUserId) {
                const admin = await prismaDirect.user.findFirst({ where: { role: 'ADMIN' } });
                assignedUserId = admin?.id;
            }

            // 4. Create/Update Conversation
            let conversation;
            const conversationWhere = {
                contactPhone: fromNumber
            };

            try {
                conversation = await prismaDirect.conversation.findFirst({ where: conversationWhere });
                if (conversation) {
                    conversation = await prismaDirect.conversation.update({
                        where: { id: conversation.id },
                        data: {
                            lastMessageAt: new Date(),
                            unreadCount: { increment: 1 },
                            status: "OPEN"
                        }
                    });
                } else {
                    conversation = await prismaDirect.conversation.create({
                        data: {
                            contactPhone: fromNumber,
                            contactId: contact?.id,
                            assignedUserId: assignedUserId,
                            twilioNumberId: numberPool?.id || null,
                            lastMessageAt: new Date(),
                            unreadCount: 1,
                            status: "OPEN"
                        }
                    });
                }
            } catch (e) {
                conversation = await prismaDirect.conversation.findFirst({ where: conversationWhere });
                if (conversation) {
                    conversation = await prismaDirect.conversation.update({
                        where: { id: conversation.id },
                        data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } }
                    });
                }
            }

            if (!conversation) {
                throw new Error("Could not find or create conversation");
            }

            // 5. Create Message Record
            await prismaDirect.message.create({
                data: {
                    conversationId: conversation.id,
                    direction: "INBOUND",
                    fromNumber: fromNumber,
                    toNumber: toNumber,
                    body: fullBody,
                    status: "RECEIVED",
                    twilioMessageSid: messageSid,
                    leadId: contact?.id,
                    userId: assignedUserId
                }
            });

            // 6. Update LastInteractionMap
            await prismaDirect.lastInteractionMap.upsert({
                where: { customerPhone: fromNumber },
                create: {
                    customerPhone: fromNumber,
                    lastUserId: assignedUserId,
                    lastChannel: "SMS",
                    lastTwilioNumberId: numberPool?.id
                },
                update: {
                    lastUserId: assignedUserId,
                    lastChannel: "SMS",
                    lastInteractionAt: new Date(),
                    lastTwilioNumberId: numberPool?.id
                }
            });

            // 7. Log as LeadActivity
            if (contact?.id) {
                console.log(`[SMS Inbound] CREATE ACTIVITY for lead ${contact.id}`);
                await (prismaDirect as any).leadActivity.create({
                    data: {
                        leadId: contact.id,
                        type: "SMS_INBOUND",
                        content: body,
                        userId: assignedUserId
                    }
                });
            }

            // 8. TRIGGER PUSH NOTIFICATION (SMS Alert for iOS PWA)
            if (assignedUserId) {
                const subscriptions = await (prismaDirect as any).pushSubscription.findMany({
                    where: { userId: assignedUserId }
                });

                if (subscriptions.length > 0) {
                    const senderName = (contact?.firstName + " " + contact?.lastName).trim() || fromNumber;
                    const payload = {
                        title: `New SMS from ${senderName}`,
                        body: fullBody.length > 100 ? fullBody.substring(0, 97) + "..." : fullBody,
                        url: "/messaging"
                    };

                    // Fire and forget push relay
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
                    )).catch(err => console.error("[SMS Push] Error in fire-and-forget relay:", err));
                }
            }

            return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
        });
    } catch (error: any) {
        console.error("[SMS Inbound] Critical Failure - activating Edge Buffer:", error);

        try {
            const fs = require('fs');
            const path = require('path');
            const tmpDir = path.join(process.cwd(), '.tmp');

            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const deadLetterPath = path.join(tmpDir, 'dead_letter_sms.json');
            const payload = {
                timestamp: new Date().toISOString(),
                error: error?.message || String(error),
                params: Object.fromEntries(await req.clone().formData())
            };

            fs.appendFileSync(deadLetterPath, JSON.stringify(payload) + "\n");
            console.log("[SMS Inbound] Message safely buffered to dead_letter_sms.json");
        } catch (bufferErr) {
            console.error("[SMS Inbound] FAILED TO BUFFER MESSAGE:", bufferErr);
        }

        // Return 503 Service Unavailable to trigger Twilio's automatic retry mechanism
        return new NextResponse("Service Unavailable", { status: 503 });
    }
}

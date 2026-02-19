import { prisma } from "./prisma";
import { normalizeToE164 } from "./phone-utils";
import { LeadStatus, LeadStatusType } from "./types";

// Helper to strictly format time based on offset number (Nuclear Option against Server Timezone)
const formatTimeStrict = (date: Date, offsetStr: string | undefined) => {
    const offset = parseFloat(offsetStr || '11');
    const targetTime = new Date(date.getTime() + (offset * 3600000));
    const h = targetTime.getUTCHours();
    const m = targetTime.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formH = h % 12 || 12;
    const formM = m.toString().padStart(2, '0');

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[targetTime.getUTCDay()];
    const monthName = months[targetTime.getUTCMonth()];
    const dayNum = targetTime.getUTCDate();
    const year = targetTime.getUTCFullYear();

    return `${dayName}, ${monthName} ${dayNum}, ${year} at ${formH}:${formM} ${ampm}`;
};

export async function getNextLead(userId: string, forcedLeadId?: string, campaignId?: string | null) {
    if (forcedLeadId) {
        // Atomic acquisition of forced lead
        const leads = await prisma.$queryRaw<any[]>`
            UPDATE "Lead"
            SET 
                status = 'LOCKED', 
                "lockedById" = ${userId}, 
                "lockedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = ${forcedLeadId}
            AND (
                "lockedById" IS NULL 
                OR "lockedById" = ${userId}
                OR "lockedAt" < NOW() - INTERVAL '30 minutes'
            )
            RETURNING *;
        `;
        return leads && leads.length > 0 ? leads[0] : null;
    }

    // 1. RECOVERY: Check if user already has a valid lock
    const existingLock = await prisma.lead.findFirst({
        where: {
            lockedById: userId,
            status: LeadStatus.LOCKED,
            lockedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } // 30m expiry
        }
    });
    if (existingLock) return existingLock;

    // 2. ATOMIC ACQUISITION: Find and lock next available lead
    try {
        const acquiredLeads = await prisma.$queryRaw<any[]>`
            UPDATE "Lead"
            SET 
                status = 'LOCKED', 
                "lockedById" = ${userId}, 
                "lockedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = (
                SELECT id 
                FROM "Lead" 
                WHERE 
                    (status = 'READY' OR (status = 'CALLBACK' AND "nextCallAt" <= NOW()))
                    AND "lockedById" IS NULL
                    AND (${campaignId}::text IS NULL OR "campaignId" = ${campaignId})
                ORDER BY 
                    CASE WHEN status = 'CALLBACK' THEN 0 ELSE 1 END ASC,
                    priority ASC,
                    "nextCallAt" ASC NULLS LAST,
                    "attempts" ASC,
                    "createdAt" ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
        `;

        if (acquiredLeads && acquiredLeads.length > 0) {
            console.log(`[DL] Atomic lock success: lead ${acquiredLeads[0].id} for user ${userId}`);
            return acquiredLeads[0];
        }
    } catch (err) {
        console.error("[DL] Atomic acquisition failed:", err);
    }

    return null;
}

export async function getRotatingNumber(userId?: string) {
    // 1. Try to find a number OWNED by this user
    if (userId) {
        const ownedNumber = await prisma.numberPool.findFirst({
            where: {
                isActive: true,
                ownerUserId: userId,
                OR: [
                    { cooldownUntil: null },
                    { cooldownUntil: { lte: new Date() } }
                ]
            },
            orderBy: [
                { lastUsedAt: "asc" }, // Rotate among own numbers
                { dailyCount: "asc" }
            ]
        });

        if (ownedNumber) {
            // Update usage
            await prisma.numberPool.update({
                where: { id: ownedNumber.id },
                data: { lastUsedAt: new Date(), dailyCount: { increment: 1 } }
            });
            return ownedNumber.phoneNumber;
        }
    }

    // 2. Fallback: Find any UNASSIGNED number (Shared Pool)
    const sharedNumber = await prisma.numberPool.findFirst({
        where: {
            isActive: true,
            ownerUserId: null, // Only unassigned
            OR: [
                { cooldownUntil: null },
                { cooldownUntil: { lte: new Date() } }
            ]
        },
        orderBy: [
            { lastUsedAt: "asc" },
            { dailyCount: "asc" }
        ]
    });

    if (sharedNumber) {
        await prisma.numberPool.update({
            where: { id: sharedNumber.id },
            data: { lastUsedAt: new Date(), dailyCount: { increment: 1 } }
        });
        return sharedNumber.phoneNumber;
    }

    // 3. Last Resort: Settings Main Number
    const settings = await prisma.settings.findFirst();
    return settings?.twilioFromNumbers || null;
}

export async function releaseLead(leadId: string, status: LeadStatusType = LeadStatus.READY) {
    return await prisma.lead.update({
        where: { id: leadId },
        data: {
            status,
            lockedAt: null,
            lockedById: null
        }
    });
}

export interface DispositionParams {
    status: string;
    nextCallAt?: string;
    notes?: string;
    contactData?: any;
    customMessage?: string;
    timezone?: string;
    includeMeetLink?: boolean;
    includeCalendarLink?: boolean;
    meetingTitle?: string;
}

export interface DispositionDeps {
    sendSMS?: (args: any) => Promise<any>;
    createGoogleMeeting?: (args: any, tokens?: any) => Promise<any>;
    sendGmailConfirmation?: (args: any, tokens?: any) => Promise<any>;
}

export async function updateLeadDisposition(
    leadId: string,
    userId: string,
    params: DispositionParams,
    deps: DispositionDeps = {}
) {
    const { status, nextCallAt, notes, contactData, customMessage, timezone, includeMeetLink, includeCalendarLink, meetingTitle } = params;

    // Fetch current lead to check attempts
    const currentLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { attempts: true, firstName: true, lastName: true, companyName: true, email: true, phoneNumber: true }
    });

    if (!currentLead) {
        throw new Error("Lead not found");
    }

    // 3-ATTEMPT RULE: Auto-archive if 3rd No Answer
    let finalStatus = status;
    const newAttempts = currentLead.attempts + 1;

    if (status === "NO_ANSWER" && newAttempts >= 3) {
        finalStatus = "ARCHIVED";
    }

    // Avoid Unique Constraint Violation & Ensure Normalization
    let finalContactData = { ...contactData };
    if (finalContactData.phoneNumber) {
        finalContactData.phoneNumber = normalizeToE164(String(finalContactData.phoneNumber));
    }

    // Update lead and release lock
    const lead = await prisma.lead.update({
        where: { id: leadId },
        data: {
            status: finalStatus,
            lockedById: null,
            lockedAt: null,
            nextCallAt: nextCallAt ? new Date(nextCallAt) : undefined,
            attempts: { increment: 1 },
            lastCalledAt: new Date(),
            ...(finalContactData && {
                firstName: finalContactData.firstName || undefined,
                lastName: finalContactData.lastName || undefined,
                email: finalContactData.email || undefined,
                phoneNumber: finalContactData.phoneNumber || undefined,
            })
        },
    });

    // Log the call/outcome
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { repPhoneNumber: true, id: true, name: true, email: true } });

    await prisma.call.create({
        data: {
            leadId: lead.id,
            userId: userId,
            direction: "OUTBOUND",
            fromNumber: user?.repPhoneNumber || "UNKNOWN",
            toNumber: lead.phoneNumber,
            status: "completed",
            outcome: status,
            notes: customMessage ? `${notes}\n\n[Dispatched Message]: ${customMessage}` : notes,
        }
    });

    // IF CALLBACK -> Create Callback entry
    if (status === 'CALLBACK' && nextCallAt) {
        await prisma.callback.create({
            data: {
                leadId: lead.id,
                userId: userId,
                callbackAt: new Date(nextCallAt),
                notes: notes,
                status: 'PENDING'
            }
        });
    }

    // IF BOOKED -> Create Meeting + Google Sync + SMS Dispatch
    if (status === 'BOOKED' && nextCallAt) {
        const tzMapping: Record<string, { iana: string, region: string }> = {
            '11': { iana: 'Australia/Sydney', region: 'Sydney, Australia' },
            '10': { iana: 'Australia/Brisbane', region: 'Brisbane, Australia' },
            '8': { iana: 'Australia/Perth', region: 'Perth, Australia' },
            '9.5': { iana: 'Australia/Adelaide', region: 'Adelaide, Australia' },
            '10.5': { iana: 'Australia/Adelaide', region: 'Adelaide, Australia' }, // Summer 10.5
            '13': { iana: 'Pacific/Auckland', region: 'Auckland, New Zealand' },
            '12': { iana: 'Pacific/Auckland', region: 'Auckland, New Zealand' }, // Winter 12
        };

        const tzData = tzMapping[timezone || '11'] || tzMapping['11'];
        const ianaTimeZone = tzData.iana;
        const regionLabel = tzData.region;

        // 1. Create Meeting in DB
        const meeting = await prisma.meeting.create({
            data: {
                leadId: lead.id,
                userId: userId,
                startAt: new Date(nextCallAt),
                endAt: new Date(new Date(nextCallAt).getTime() + 30 * 60 * 1000),
                title: meetingTitle || `Demo: ${lead.companyName || lead.firstName}`,
                provider: 'PENDING'
            }
        });

        // 2. Trigger Google Sync (Non-blocking)
        let finalMessage = customMessage;
        if (deps.createGoogleMeeting) {
            const createMeeting = deps.createGoogleMeeting;
            const sendSms = deps.sendSMS;
            const clientName = lead.companyName || (lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : 'New Client');
            const eventTitle = meetingTitle || `Spotfunnel x ${clientName}`;

            (async () => {
                let googleEvent: any = null;

                // Fetch User Tokens (Scope: Function-level, available for Calendar AND Gmail)
                const calendarConnection = await prisma.calendarConnection.findUnique({
                    where: { userId }
                });

                const tokens = calendarConnection ? {
                    accessToken: calendarConnection.accessToken,
                    refreshToken: calendarConnection.refreshToken
                } : undefined;

                if (calendarConnection) {
                    console.log(`[DL] Using personal calendar connection for user ${userId}`);
                } else {
                    console.log(`[DL] No personal connection found for user ${userId}, falling back to system.`);
                }

                try {
                    // Log Dispatch Start
                    await prisma.leadActivity.create({
                        data: {
                            leadId: lead.id,
                            userId: userId,
                            type: "SYSTEM",
                            content: `Starting automated booking protocol dispatch for ${lead.companyName}...`
                        }
                    }).catch(e => console.error("[DL] Activity log fail:", e));

                    googleEvent = await createMeeting({
                        title: eventTitle,
                        description: `${customMessage ? customMessage + '\n\n' : ''}---
SpotFunnel Demo`,
                        start: meeting.startAt,
                        end: meeting.endAt,
                        attendees: Array.from(new Set([
                            ...(lead.email ? [lead.email.toLowerCase()] : []),
                            ...(user?.email ? [user.email.toLowerCase()] : []),
                            'leo@getspotfunnel.com'
                        ])).map(email => ({ email })),
                        repName: user?.name || 'SpotFunnel Specialist',
                        timeZone: ianaTimeZone,
                        location: regionLabel
                    }, tokens);

                    if (googleEvent) {
                        try {
                            await prisma.meeting.update({
                                where: { id: meeting.id },
                                data: {
                                    externalEventId: googleEvent.id,
                                    meetingUrl: googleEvent.meetingUrl,
                                    calendarUrl: googleEvent.calendarUrl,
                                    provider: googleEvent.provider
                                }
                            });
                        } catch (dbError) {
                            console.error("[DL] Failed to update meeting in DB (schema mismatch?):", dbError);
                        }
                    }
                } catch (syncError) {
                    console.error("[DL] Background Google Sync Failed", syncError);
                    await prisma.leadActivity.create({
                        data: {
                            leadId: lead.id,
                            userId: userId,
                            type: "SYSTEM",
                            content: `Google Calendar Sync Failed: ${syncError instanceof Error ? syncError.message : String(syncError)}`
                        }
                    }).catch(e => console.error("[DL] Activity log fail:", e));
                }

                try {
                    if (sendSms && lead.phoneNumber) {
                        let smsBody = finalMessage || `Hi ${lead.firstName}, confirming our demo!`;

                        if (includeMeetLink && googleEvent?.meetingUrl) {
                            if (smsBody.includes('[LINK]')) {
                                smsBody = smsBody.replace('[LINK]', googleEvent.meetingUrl);
                            } else {
                                smsBody = `${smsBody} ${googleEvent.meetingUrl}`;
                            }
                        }

                        if (includeCalendarLink && googleEvent?.calendarUrl) {
                            if (smsBody.includes('[CAL_LINK]')) {
                                smsBody = smsBody.replace('[CAL_LINK]', googleEvent.calendarUrl);
                            } else {
                                smsBody = `${smsBody} ${googleEvent.calendarUrl}`;
                            }
                        }

                        const recentCall = await prisma.call.findFirst({
                            where: { leadId: lead.id, userId: userId },
                            orderBy: { createdAt: 'desc' },
                            select: { fromNumber: true }
                        });

                        const actualFrom = recentCall?.fromNumber && recentCall.fromNumber !== 'UNKNOWN' ? recentCall.fromNumber : undefined;

                        await sendSms({
                            to: lead.phoneNumber,
                            body: smsBody,
                            leadId: lead.id,
                            userId: userId,
                            from: actualFrom
                        });

                        await prisma.leadActivity.create({
                            data: {
                                leadId: lead.id,
                                userId: userId,
                                type: "SYSTEM",
                                content: `Automated booking SMS dispatched from ${actualFrom || 'smart-rotation'}.`
                            }
                        }).catch(e => console.error("[DL] Activity log fail:", e));
                    }
                } catch (smsError) {
                    console.error("[DL] Background SMS Failed", smsError);
                    await prisma.leadActivity.create({
                        data: {
                            leadId: lead.id,
                            userId: userId,
                            type: "SYSTEM",
                            content: `Automated booking SMS dispatch failed: ${smsError instanceof Error ? smsError.message : String(smsError)}`
                        }
                    }).catch(e => console.error("[DL] Activity log fail:", e));
                }

            })();
        } else if (deps.sendSMS && lead.phoneNumber) {
            // Fallback: Just SMS if no meeting logic
            const sendSms = deps.sendSMS;
            (async () => {
                try {
                    const smsBody = finalMessage || `Hi ${lead.firstName}, confirming our demo!`;
                    const recentCall = await prisma.call.findFirst({
                        where: { leadId: lead.id, userId: userId },
                        orderBy: { createdAt: 'desc' },
                        select: { fromNumber: true }
                    });
                    const actualFrom = recentCall?.fromNumber && recentCall.fromNumber !== 'UNKNOWN' ? recentCall.fromNumber : undefined;

                    await sendSms({
                        to: lead.phoneNumber,
                        body: smsBody,
                        leadId: lead.id,
                        userId: userId,
                        from: actualFrom
                    });
                } catch (smsError) {
                    console.error("[DL] Background SMS Failed", smsError);
                }
            })();
        }
    }

    return { lead, success: true };
}

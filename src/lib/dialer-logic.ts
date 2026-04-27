import { prisma } from "./prisma";
import { normalizeToE164, isAustralianLandline } from "./phone-utils";
import { LeadStatus, LeadStatusType } from "./types";
import { selectOutboundNumber } from "./number-rotation";

// Map a timezone offset string (e.g. "11", "-5", "9.5") to an IANA timezone.
// Uses IANA zones so DST is handled correctly by Intl.DateTimeFormat.
const OFFSET_TO_IANA: Record<string, string> = {
    '11': 'Australia/Sydney',
    '10': 'Australia/Brisbane',
    '8': 'Australia/Perth',
    '9.5': 'Australia/Adelaide',
    '10.5': 'Australia/Adelaide',
    '13': 'Pacific/Auckland',
    '12': 'Pacific/Auckland',
    '-5': 'America/New_York',
    '-4': 'America/New_York',
    '-6': 'America/Chicago',
    '-7': 'America/Denver',
    '-8': 'America/Los_Angeles',
    '-9': 'America/Anchorage',
    '-10': 'Pacific/Honolulu',
};

// Formats a UTC date in a target IANA zone (or offset fallback). DST-safe via Intl.
const formatTimeStrict = (date: Date, offsetStr: string | undefined) => {
    const timeZone = OFFSET_TO_IANA[offsetStr || '11'] || 'Australia/Sydney';
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});
    return `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
};

export async function getNextLead(userId: string, forcedLeadId?: string, campaignId?: string | null, states?: string[] | null, skipId?: string) {
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
        // Expand abbreviations to also match full state names
        const STATE_FULL_NAMES: Record<string, string> = {
            'NSW': 'New South Wales',
            'VIC': 'Victoria',
            'QLD': 'Queensland',
            'SA': 'South Australia',
            'WA': 'Western Australia',
            'TAS': 'Tasmania',
            'NT': 'Northern Territory',
            'ACT': 'Australian Capital Territory',
        };
        const expandedStates = states && states.length > 0
            ? [...states, ...states.map(s => STATE_FULL_NAMES[s]).filter(Boolean)]
            : null;
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
                    AND (${expandedStates}::text[] IS NULL OR "state" = ANY(${expandedStates}::text[]))
                    AND (${skipId || null}::text IS NULL OR id != ${skipId || null})
                ORDER BY
                    CASE WHEN status = 'CALLBACK' THEN 0 ELSE 1 END ASC,
                    priority ASC,
                    "nextCallAt" ASC NULLS LAST,
                    "attempts" ASC,
                    "updatedAt" ASC
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
    const result = await selectOutboundNumber({ userId, channel: "CALL" });
    return result?.phoneNumber || null;
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
    deps: DispositionDeps = {},
    actualFromNumber?: string
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

    // Log the call/outcome — update existing initiated Call if one exists (avoids duplicates)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { repPhoneNumber: true, id: true, name: true, email: true } });

    const existingCall = await prisma.call.findFirst({
        where: {
            leadId: lead.id,
            userId: userId,
            status: "initiated",
        },
        orderBy: { createdAt: "desc" }
    });

    if (existingCall) {
        await prisma.call.update({
            where: { id: existingCall.id },
            data: {
                status: "completed",
                outcome: status,
                notes: customMessage ? `${notes}\n\n[Dispatched Message]: ${customMessage}` : notes,
                // Preserve fromNumber from the initiated record (set correctly by TwiML routes)
                ...(actualFromNumber && existingCall.fromNumber === "UNKNOWN" ? { fromNumber: actualFromNumber } : {})
            }
        });
    } else {
        // No pre-existing record — resolve fromNumber via pool
        const resolvedFrom = actualFromNumber || (await getRotatingNumber(userId)) || user?.repPhoneNumber || "UNKNOWN";
        await prisma.call.create({
            data: {
                leadId: lead.id,
                userId: userId,
                direction: "OUTBOUND",
                fromNumber: resolvedFrom,
                toNumber: lead.phoneNumber,
                status: "completed",
                outcome: status,
                notes: customMessage ? `${notes}\n\n[Dispatched Message]: ${customMessage}` : notes,
            }
        });
    }

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
    let dispatchResult: { calendar?: string; sms?: string; smsError?: string; calendarError?: string } = {};

    if (status === 'BOOKED' && nextCallAt) {
        const tzMapping: Record<string, { iana: string, region: string }> = {
            // Australia
            '11': { iana: 'Australia/Sydney', region: 'Sydney, Australia' },
            '10': { iana: 'Australia/Brisbane', region: 'Brisbane, Australia' },
            '8': { iana: 'Australia/Perth', region: 'Perth, Australia' },
            '9.5': { iana: 'Australia/Adelaide', region: 'Adelaide, Australia' },
            '10.5': { iana: 'Australia/Adelaide', region: 'Adelaide, Australia' },
            // New Zealand
            '13': { iana: 'Pacific/Auckland', region: 'Auckland, New Zealand' },
            '12': { iana: 'Pacific/Auckland', region: 'Auckland, New Zealand' },
            // United States
            '-5': { iana: 'America/New_York', region: 'Eastern Time (US)' },
            '-4': { iana: 'America/New_York', region: 'Eastern Time (US, DST)' },
            '-6': { iana: 'America/Chicago', region: 'Central Time (US)' },
            '-5cdt': { iana: 'America/Chicago', region: 'Central Time (US, DST)' },
            '-7': { iana: 'America/Denver', region: 'Mountain Time (US)' },
            '-6mdt': { iana: 'America/Denver', region: 'Mountain Time (US, DST)' },
            '-8': { iana: 'America/Los_Angeles', region: 'Pacific Time (US)' },
            '-7pdt': { iana: 'America/Los_Angeles', region: 'Pacific Time (US, DST)' },
            '-9': { iana: 'America/Anchorage', region: 'Alaska Time' },
            '-10': { iana: 'Pacific/Honolulu', region: 'Hawaii Time' },
        };

        const tzData = tzMapping[timezone || '11'] || tzMapping['11'];
        const ianaTimeZone = tzData.iana;
        const regionLabel = tzData.region;

        // Build a safe display name (never "undefined")
        const displayName =
            lead.companyName?.trim() ||
            [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
            'Client';

        // 1. Create Meeting in DB
        const meeting = await prisma.meeting.create({
            data: {
                leadId: lead.id,
                userId: userId,
                startAt: new Date(nextCallAt),
                endAt: new Date(new Date(nextCallAt).getTime() + 30 * 60 * 1000),
                title: meetingTitle || `Demo: ${displayName}`,
                provider: 'PENDING'
            }
        });

        // 2. Google Sync + SMS Dispatch (awaited so errors surface to caller)
        let finalMessage = customMessage;

        // Helper: resolve a valid "from" number for SMS
        const resolveFromNumber = async (): Promise<string | undefined> => {
            // Try recent call history first
            const recentCall = await prisma.call.findFirst({
                where: { leadId: lead.id, userId: userId },
                orderBy: { createdAt: 'desc' },
                select: { fromNumber: true }
            });
            if (recentCall?.fromNumber && recentCall.fromNumber !== 'UNKNOWN') {
                return recentCall.fromNumber;
            }
            // Fallback: use the rotating number pool (same logic as outbound calls)
            const rotatingNumber = await getRotatingNumber(userId);
            if (rotatingNumber) {
                console.log(`[DL] SMS from-number resolved via getRotatingNumber: ${rotatingNumber}`);
                return rotatingNumber;
            }
            return undefined;
        };

        if (deps.createGoogleMeeting) {
            const createMeeting = deps.createGoogleMeeting;
            const sendSms = deps.sendSMS;
            const clientName = displayName;
            const eventTitle = meetingTitle || `Spotfunnel x ${clientName}`;

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

            // --- Google Calendar Sync ---
            try {
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
                        ...(process.env.ADMIN_ATTENDEE_EMAIL ? [process.env.ADMIN_ATTENDEE_EMAIL.toLowerCase()] : []),
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
                dispatchResult.calendar = 'sent';
            } catch (syncError) {
                console.error("[DL] Google Sync Failed", syncError);
                dispatchResult.calendar = 'failed';
                dispatchResult.calendarError = syncError instanceof Error ? syncError.message : String(syncError);
                await prisma.leadActivity.create({
                    data: {
                        leadId: lead.id,
                        userId: userId,
                        type: "SYSTEM",
                        content: `Google Calendar Sync Failed: ${dispatchResult.calendarError}`
                    }
                }).catch(e => console.error("[DL] Activity log fail:", e));
            }

            // --- SMS Dispatch ---
            try {
                if (sendSms && lead.phoneNumber && !isAustralianLandline(normalizeToE164(lead.phoneNumber))) {
                    // Null-safe greeting — prefer firstName, fall back to displayName, never "undefined"
                    const greetingName = lead.firstName?.trim() || displayName;
                    let smsBody = finalMessage || `Hi ${greetingName}, confirming our demo!`;

                    // Only include meet/calendar links if Google sync actually succeeded
                    const calendarSynced = dispatchResult.calendar === 'sent';

                    if (includeMeetLink) {
                        if (calendarSynced && googleEvent?.meetingUrl) {
                            if (smsBody.includes('[LINK]')) smsBody = smsBody.replace('[LINK]', googleEvent.meetingUrl);
                            else smsBody = `${smsBody} ${googleEvent.meetingUrl}`;
                        } else {
                            // Strip unresolved placeholder rather than send "[LINK]" literally
                            smsBody = smsBody.replace(/\s*\[LINK\]/g, '').trim();
                        }
                    }

                    if (includeCalendarLink) {
                        if (calendarSynced && googleEvent?.calendarUrl) {
                            if (smsBody.includes('[CAL_LINK]')) smsBody = smsBody.replace('[CAL_LINK]', googleEvent.calendarUrl);
                            else smsBody = `${smsBody} ${googleEvent.calendarUrl}`;
                        } else {
                            smsBody = smsBody.replace(/\s*\[CAL_LINK\]/g, '').trim();
                        }
                    }

                    const actualFrom = await resolveFromNumber();

                    await sendSms({
                        to: lead.phoneNumber,
                        body: smsBody,
                        leadId: lead.id,
                        userId: userId,
                        from: actualFrom
                    });

                    dispatchResult.sms = 'sent';
                    await prisma.leadActivity.create({
                        data: {
                            leadId: lead.id,
                            userId: userId,
                            type: "SYSTEM",
                            content: `Automated booking SMS dispatched from ${actualFrom || 'smart-rotation'}.`
                        }
                    }).catch(e => console.error("[DL] Activity log fail:", e));
                } else if (sendSms && lead.phoneNumber && isAustralianLandline(normalizeToE164(lead.phoneNumber))) {
                    dispatchResult.sms = 'blocked-landline';
                    await prisma.leadActivity.create({
                        data: {
                            leadId: lead.id,
                            userId: userId,
                            type: "SYSTEM",
                            content: `Booking SMS skipped: ${lead.phoneNumber} is an Australian landline (cannot receive SMS). Calendar invite sent via email.`
                        }
                    }).catch(e => console.error("[DL] Activity log fail:", e));
                }
            } catch (smsError) {
                console.error("[DL] SMS Failed", smsError);
                dispatchResult.sms = 'failed';
                dispatchResult.smsError = smsError instanceof Error ? smsError.message : String(smsError);
                await prisma.leadActivity.create({
                    data: {
                        leadId: lead.id,
                        userId: userId,
                        type: "SYSTEM",
                        content: `Automated booking SMS dispatch failed: ${dispatchResult.smsError}`
                    }
                }).catch(e => console.error("[DL] Activity log fail:", e));
            }

        } else if (deps.sendSMS && lead.phoneNumber && !isAustralianLandline(normalizeToE164(lead.phoneNumber))) {
            // Fallback: Just SMS if no meeting logic
            const sendSms = deps.sendSMS;
            try {
                const greetingName = lead.firstName?.trim() || displayName;
                const smsBody = finalMessage || `Hi ${greetingName}, confirming our demo!`;
                const actualFrom = await resolveFromNumber();

                await sendSms({
                    to: lead.phoneNumber,
                    body: smsBody,
                    leadId: lead.id,
                    userId: userId,
                    from: actualFrom
                });
                dispatchResult.sms = 'sent';
            } catch (smsError) {
                console.error("[DL] SMS Failed", smsError);
                dispatchResult.sms = 'failed';
                dispatchResult.smsError = smsError instanceof Error ? smsError.message : String(smsError);
            }
        } else if (deps.sendSMS && lead.phoneNumber && isAustralianLandline(normalizeToE164(lead.phoneNumber))) {
            dispatchResult.sms = 'blocked-landline';
        }
    }

    return { lead, success: true, dispatch: dispatchResult };
}

import twilio from "twilio";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";
import { normalizeToE164 } from "./phone-utils";

export async function getCredentials() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        throw new Error("Twilio credentials not configured");
    }

    let defaultFrom = settings.twilioFromNumbers?.split(',')[0].trim();

    // Global Fallback: If no from numbers are defined in settings, try to get the first one from NumberPool
    if (!defaultFrom) {
        console.log("[Twilio] No default from number. Fetching ALL active numbers from NumberPool...");
        const allPoolNumbers = await prisma.numberPool.findMany();
        console.log(`[Twilio] Found ${allPoolNumbers.length} total numbers in pool.`);

        const poolNumber = allPoolNumbers.find(n => n.isActive);
        defaultFrom = poolNumber?.phoneNumber;

        if (defaultFrom) {
            console.log(`[Twilio] Selected global fallback: ${defaultFrom} (from ${allPoolNumbers.length} entries)`);
        } else {
            console.warn(`[Twilio] Fallback FAILED. Pool count: ${allPoolNumbers.length}. First item isActive status: ${allPoolNumbers[0]?.isActive}`);
        }
    }

    return {
        sid: settings.twilioAccountSid,
        token: decrypt(settings.twilioAuthToken),
        from: defaultFrom,
        appSid: settings.twilioAppSid
    };
}

export async function verifyTwilio() {
    const { sid, token } = await getCredentials();
    const client = twilio(sid, token);
    await client.api.v2010.accounts(sid).fetch();
    return true;
}

export async function createCallBridge(toLead: string, leadId: string, customCallerId?: string) {
    const { sid, token, from } = await getCredentials();
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const client = twilio(sid, token);

    // Verify we have a FROM number
    if (!from) {
        // Fallback to searching NumberPool if settings is empty? 
        // Likely we prefer to fail fast if config is missing.
        console.warn("[Twilio] No default 'From' number in settings.");
    }

    // Twilio requires E.164 format (no spaces/dashes)
    const callerId = (customCallerId || from || "").replace(/[\s\-\(\)]/g, "");

    // Attempt to find the first user with a phone number (Admin?)
    const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN', repPhoneNumber: { not: null } }
    });

    // Fallback: If no admin has a number, try ANY user with a number
    const fallbackUser = !adminUser ? await prisma.user.findFirst({ where: { repPhoneNumber: { not: null } } }) : null;

    const destinationRep = (adminUser?.repPhoneNumber || fallbackUser?.repPhoneNumber || "").replace(/[\s\-\(\)]/g, "");

    if (!destinationRep) {
        throw new Error("No Rep Phone Number found. Please ensure an Admin or User has a 'repPhoneNumber' set in profile.");
    }
    const cleanToLead = toLead.replace(/[\s\-\(\)]/g, "");

    // Use the base URL from settings (entered in wizard) or fallback to env
    const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();

    if (!baseUrl || baseUrl.includes("localhost")) {
        throw new Error(`Invalid Webhook URL: "${baseUrl}". Twilio cannot reach localhost. Please use your ngrok/public URL in Step 2.`);
    }

    try {
        console.log(`[PowerDialer] Telephony Bridge: Using Base [${baseUrl}] | From [${callerId}] | To Rep [${destinationRep}] | To Lead [${cleanToLead}]`);

        const call = await client.calls.create({
            url: `${baseUrl}/api/twilio/bridge?leadId=${leadId}&toLead=${encodeURIComponent(cleanToLead)}&callerId=${encodeURIComponent(callerId)}`,
            to: destinationRep,
            from: callerId,
            statusCallback: `${baseUrl}/api/twilio/status`,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        });
        return call.sid;
    } catch (err: any) {
        console.error("Twilio SDK Error:", err);
        throw new Error(`Twilio Error: ${err.message}. Check your From number and Public URL.`);
    }
}

// HELPERS
export { normalizeToE164 };

export async function sendSMS(
    { to, body, leadId, userId, from }: { to: string; body: string; leadId?: string; userId?: string; from?: string }
) {
    let fromNumber: string | undefined = from;
    let cleanFrom: string | undefined = "";
    try {
        const { sid, token, from: defaultFrom } = await getCredentials();
        const client = twilio(sid, token);

        // 1. Determine "From" Number
        let twilioNumberId: string | null = null;

        const cleanTo = normalizeToE164(to);
        const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId }, include: { assignedTo: { include: { phones: true } } } }) : null;

        // User preference: Always use the number last called FROM for this lead
        if (!fromNumber && leadId) {
            const lastCall = await prisma.call.findFirst({
                where: { leadId: leadId, direction: "OUTBOUND" },
                orderBy: { createdAt: 'desc' },
                select: { fromNumber: true }
            });
            if (lastCall) {
                fromNumber = lastCall.fromNumber;
                console.log(`[SMS] Using last called number: ${fromNumber}`);
            }
        }

        // Fallback to conversation history if no recent call
        if (!fromNumber) {
            const existingConv = await prisma.conversation.findFirst({
                where: { contactPhone: cleanTo },
                orderBy: { updatedAt: 'desc' },
                include: { twilioNumber: true }
            });
            if (existingConv && existingConv.twilioNumber) {
                fromNumber = existingConv.twilioNumber.phoneNumber;
                twilioNumberId = existingConv.twilioNumber.id;
            }
        }

        // Final fallbacks
        if (!fromNumber) {
            if (userId) {
                const sender = await prisma.user.findUnique({
                    where: { id: userId },
                    include: { phones: { where: { isActive: true } } }
                });
                if (sender?.phones && sender.phones.length > 0) {
                    fromNumber = sender.phones[0].phoneNumber;
                    twilioNumberId = sender.phones[0].id;
                }
            }

            if (!fromNumber && lead?.assignedTo?.phones && lead.assignedTo.phones.length > 0) {
                const activePhone = lead.assignedTo.phones.find(p => p.isActive);
                if (activePhone) {
                    fromNumber = activePhone.phoneNumber;
                    twilioNumberId = activePhone.id;
                }
            }

            if (!fromNumber) {
                fromNumber = defaultFrom;
            }
        }

        // Final desperation fallback: query the pool one last time if still empty
        if (!fromNumber) {
            console.log("[SMS] Still no fromNumber. Trying emergency pool lookup...");
            const emergencyPool = await prisma.numberPool.findMany();
            console.log(`[SMS] Emergency check found ${emergencyPool.length} entries.`);

            const emergencyFallback = emergencyPool.find(n => n.isActive);
            fromNumber = emergencyFallback?.phoneNumber;

            if (fromNumber) {
                console.log(`[SMS] Emergency fallback successful: ${fromNumber}`);
            } else {
                console.error(`[SMS] Emergency fallback FAILED. Pool size: ${emergencyPool.length}.`);
            }
        }

        if (!fromNumber) {
            throw new Error("No sender number found in Settings or NumberPool");
        }

        cleanFrom = normalizeToE164(fromNumber);

        if (!cleanFrom || cleanFrom === "+") {
            throw new Error(`Invalid sender number resolved: "${fromNumber}" (normalized: "${cleanFrom}")`);
        }

        console.log(`[SMS] Sending to ${cleanTo} from ${cleanFrom} | Lead: ${leadId}`);

        // 2. Twilio API Call
        const response = await client.messages.create({
            body,
            to: cleanTo,
            from: cleanFrom,
            statusCallback: `${await getBaseUrl()}/api/twilio/sms/status`
        });

        const messageSid = response.sid;
        const status = response.status || "queued";
        const errorMsg = response.errorMessage || null;

        // 3. Find or Create Conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                contactPhone: cleanTo,
                twilioNumberId: twilioNumberId || undefined
            }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    contactPhone: cleanTo,
                    contactId: leadId,
                    assignedUserId: userId || null,
                    lastMessageAt: new Date(),
                    status: "OPEN",
                    twilioNumberId: twilioNumberId
                }
            });
        } else {
            // Update lastMessageAt and ensure the conversation is OPEN
            conversation = await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    status: "OPEN",
                    // If no one is assigned yet, assign the sender
                    ...(!conversation.assignedUserId && userId ? { assignedUserId: userId } : {})
                }
            });
        }

        // 4. Create Message Record
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                direction: "OUTBOUND",
                fromNumber: cleanFrom,
                toNumber: cleanTo,
                body: body,
                status: status.toUpperCase(),
                twilioMessageSid: messageSid,
                errorMessage: errorMsg,
                leadId: leadId,
                userId: userId
            }
        });

        // 5. Record Activity
        try {
            await (prisma as any).leadActivity.create({
                data: {
                    leadId: leadId || (await prisma.lead.findUnique({ where: { phoneNumber: cleanTo } }))?.id || 'unknown',
                    type: "SMS",
                    content: `Outbound SMS sent: ${body}`,
                    userId: userId
                }
            });
        } catch (activityError) {
            console.error("[SMS] Failed to log activity:", activityError);
        }

        if ((status as string) === "FAILED") {
            throw new Error(errorMsg || "Twilio failed to send message");
        }

        return message;

    } catch (criticalError: any) {
        // Emergency Logging to AuditLog
        console.error("[SMS CRITICAL FAIL]", criticalError);
        try {
            await prisma.auditLog.create({
                data: {
                    eventType: "SMS_CRITICAL_FAILURE",
                    payload: JSON.stringify({
                        error: criticalError.message,
                        stack: criticalError.stack,
                        to: to,
                        cleanTo: normalizeToE164(to),
                        from: from,
                        fromNumberResolved: fromNumber,
                        cleanFrom: cleanFrom,
                        leadId: leadId,
                        userId: userId
                    })
                }
            });
        } catch (e) {
            console.error("Failed to write audit log", e);
        }
        throw criticalError;
    }
}

export async function validateTwilioRequest(req: Request, url: string, params: Record<string, any>) {
    try {
        const { token } = await getCredentials();
        const signature = req.headers.get("x-twilio-signature");
        if (!signature || !token) return false;

        return twilio.validateRequest(token, signature, url, params);
    } catch (e) {
        console.error("[Security] Twilio validation error", e);
        return false;
    }
}

export async function getBaseUrl() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();
    if (!baseUrl) return "";
    // Normalize: remove trailing slash so path concatenation with '/...' is safe
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

import twilio from "twilio";
import { PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";
import { selectOutboundNumber } from "./number-rotation";

export async function initiateBridgeCall(leadId: string, userId: string) {
    // 1. Fetch settings and user
    const [settings, user, lead] = await Promise.all([
        prisma.settings.findUnique({ where: { id: "singleton" } }),
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.lead.findUnique({ where: { id: leadId } }),
    ]);

    if (!settings || !settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumbers) {
        throw new Error("Twilio not fully configured (missing numbers)");
    }

    // ...

    // Default to global from number
    let fromNumber = settings.twilioFromNumbers.split(",")[0];

    // If pool or custom from number logic is needed, we could add it here.
    // However, for the BRIDGE call (ringing the rep), we usually want the system number.
    // For the CALLER ID (what the lead sees), we use the user's rep number if available.

    // We will use user.repPhoneNumber for the LEAD's caller ID later.

    if (!user || !user.repPhoneNumber) {
        throw new Error("Rep phone number not set");
    }

    if (!lead) {
        throw new Error("Lead not found");
    }

    const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);

    // 2. Create the Call record in DB first (Pre-init)
    const dbCall = await prisma.call.create({
        data: {
            leadId: lead.id,
            userId: userId,
            direction: "OUTBOUND",
            fromNumber: fromNumber,
            toNumber: lead.phoneNumber,
            status: "initiated",
        }
    });

    // 3. Initiate Call to Rep
    try {
        const call = await client.calls.create({
            to: user.repPhoneNumber,
            from: fromNumber,
            url: `${settings.webhookBaseUrl}/api/twilio/twiml/bridge?leadId=${lead.id}&userId=${userId}`,
            statusCallback: `${settings.webhookBaseUrl}/api/twilio/status`,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        });

        // 4. Update the Call record with Twilio SID
        await prisma.call.update({
            where: { id: dbCall.id },
            data: { twilioSid: call.sid }
        });

        return call.sid;
    } catch (error) {
        console.error("Twilio Call Initiation Failed:", error);
        await prisma.call.update({
            where: { id: dbCall.id },
            data: { status: 'failed', outcome: 'SYSTEM_ERROR' }
        });
        throw error;
    }
}

export function generateBridgeTwiML(leadPhoneNumber: string, callerId?: string) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: "Polly.Amy", language: "en-GB" }, "Connecting you to the lead now.");
    if (callerId) {
        twiml.dial({ callerId }, leadPhoneNumber);
    } else {
        twiml.dial(leadPhoneNumber);
    }
    return twiml.toString();
}

export async function sendSMS(to: string, body: string) {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

    if (!settings) return "ERROR_SETTINGS_NULL";
    if (!settings.twilioAccountSid) return "ERROR_MISSING_SID";
    if (!settings.twilioAuthToken) return "ERROR_MISSING_TOKEN";
    if (!settings.twilioFromNumbers) return "ERROR_MISSING_FROM";

    try {
        const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);

        // Ensure E.164 if possible (AU)
        let cleanTo = to.replace(/\s+/g, '');
        if (cleanTo.startsWith('04')) {
            cleanTo = '+61' + cleanTo.substring(1);
        }

        // Smart rotation for sender number
        let from = settings.twilioFromNumbers.split(",")[0];
        const rotationResult = await selectOutboundNumber({
            targetNumber: cleanTo,
            channel: "SMS"
        });
        if (rotationResult) {
            from = rotationResult.phoneNumber;
        }

        const message = await client.messages.create({
            body,
            from,
            to: cleanTo
        });

        // Record Activity
        try {
            await (prisma as any).leadActivity.create({
                data: {
                    leadId: (await prisma.lead.findUnique({ where: { phoneNumber: to } }))?.id || 'unknown',
                    type: "SMS",
                    content: `Outbound SMS sent: ${body}`,
                }
            });
        } catch (e) {
            console.error("Failed to log SMS activity", e);
        }

        return true;
    } catch (error: any) {
        console.error("Failed to send SMS:", error);
        return "ERROR_TWILIO_EXCEPTION: " + error.message;
    }
}

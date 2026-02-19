'use server';

import { getCredentials } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";
import { revalidatePath } from "next/cache";

export async function configureTwilioUrls() {
    try {
        const creds = await getCredentials();
        const client = twilio(creds.sid, creds.token);

        // Base URL from env or settings (must be public)
        const baseUrl = process.env.WEBHOOK_BASE_URL;
        if (!baseUrl || baseUrl.includes('localhost')) {
            return { success: false, error: "Invalid Base URL. Cannot configure localhost." };
        }

        // 1. Update Inbound Phone Number URL
        // Parse all numbers from settings
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const allNumbers = settings?.twilioFromNumbers?.split(',').map(n => n.trim()) || [];

        // Also fetch ALL incoming numbers from Twilio to match against
        const incomingNumbers = await client.incomingPhoneNumbers.list();

        let phoneResult = "";
        let updatedCount = 0;

        for (const twilioNum of incomingNumbers) {
            // Update if it matches our settings OR if we have no settings yet (init mode)
            // OR if it's the specific number the user mentioned (+61489088403) - strict matching is safer though.
            // We'll match against our DB list.
            if (allNumbers.includes(twilioNum.phoneNumber)) {
                await client.incomingPhoneNumbers(twilioNum.sid).update({
                    voiceUrl: `${baseUrl}/api/twilio/inbound`,
                    voiceMethod: 'POST'
                });
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            phoneResult = `Updated ${updatedCount} Inbound Number(s).`;
        } else {
            // Fallback: If no numbers matched, try to update the first one found? 
            // Or maybe the user hasn't put it in settings yet.
            phoneResult = "No matching numbers found in Settings to update.";
        }

        // 2. Update Outbound TwiML App URL
        // We typically store this SID in settings, but let's try to find it or use the one from settings
        let appResult = "TwiML App SID not configured.";
        if (creds.appSid) {
            await client.applications(creds.appSid).update({
                voiceUrl: `${baseUrl}/api/voice/twiml`,
                voiceMethod: 'POST'
            });
            appResult = `Updated Outbound URL for TwiML App ${creds.appSid}`;
        }

        revalidatePath('/admin/twilio');
        return { success: true, message: `${phoneResult} | ${appResult}` };

    } catch (error: any) {
        console.error("Auto-Configure Failed:", error);
        return { success: false, error: error.message || "Unknown error" };
    }
}

export async function fixNumberRouting(numberSid: string) {
    try {
        const creds = await getCredentials();
        const client = twilio(creds.sid, creds.token);
        const baseUrl = process.env.WEBHOOK_BASE_URL;

        if (!baseUrl || baseUrl.includes('localhost')) {
            throw new Error("Invalid Base URL. Set WEBHOOK_BASE_URL to your public domain.");
        }

        await client.incomingPhoneNumbers(numberSid).update({
            voiceUrl: `${baseUrl}/api/twilio/inbound`,
            voiceMethod: 'POST'
        });

        revalidatePath('/admin/numbers');
        return { success: true, message: `Number updated successfully.` };
    } catch (error: any) {
        console.error("Fix Routing Failed:", error);
        return { success: false, error: error.message };
    }
}

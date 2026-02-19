import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getCredentials } from '@/lib/twilio';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        const creds = await getCredentials();
        const client = twilio(creds.sid, creds.token);

        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();

        if (!baseUrl) {
            return NextResponse.json({ error: "Missing WEBHOOK_BASE_URL. Please set in Settings." }, { status: 400 });
        }

        const targetUrl = `${baseUrl}/api/twilio/inbound`;
        const incomingNumbers = await client.incomingPhoneNumbers.list();

        let updated = 0;
        for (const num of incomingNumbers) {
            if (num.voiceUrl !== targetUrl || num.voiceMethod !== 'POST') {
                await client.incomingPhoneNumbers(num.sid).update({
                    voiceUrl: targetUrl,
                    voiceMethod: 'POST'
                });
                updated++;
            }
        }

        return NextResponse.json({ success: true, message: `Updated ${updated} numbers.` });
    } catch (error: any) {
        console.error("Fix All Failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

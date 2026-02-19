import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getCredentials } from '@/lib/twilio';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { phoneNumber } = await req.json();
        if (!phoneNumber) return NextResponse.json({ error: "Missing phoneNumber" }, { status: 400 });

        const creds = await getCredentials();
        const client = twilio(creds.sid, creds.token);

        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();

        if (!baseUrl) {
            return NextResponse.json({ error: "Missing WEBHOOK_BASE_URL. Please set in Settings." }, { status: 400 });
        }

        // 1. Fetch from Twilio
        const incomingNumbers = await client.incomingPhoneNumbers.list({ phoneNumber });
        if (incomingNumbers.length === 0) {
            return NextResponse.json({ error: `Number ${phoneNumber} not found in your Twilio account.` }, { status: 404 });
        }

        const tn = incomingNumbers[0];
        const expectedUrl = `${baseUrl}/api/twilio/inbound`;

        // 2. Perform Update
        await client.incomingPhoneNumbers(tn.sid).update({
            voiceUrl: expectedUrl,
            voiceMethod: 'POST',
            voiceFallbackUrl: '', // Clear any failovers (Zoiper/SIP often use these)
            voiceFallbackMethod: 'POST'
        });

        return NextResponse.json({
            success: true,
            number: tn.phoneNumber,
            sid: tn.sid,
            previousUrl: tn.voiceUrl,
            newUrl: expectedUrl
        });

    } catch (error: any) {
        console.error("[Fix Number] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

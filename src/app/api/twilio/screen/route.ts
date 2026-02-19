
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: Request) {
    const twiml = new twilio.twiml.VoiceResponse();

    const gather = twiml.gather({
        input: ['dtmf'],
        numDigits: 1,
        action: `${process.env.WEBHOOK_BASE_URL}/api/twilio/screen/connect`,
        timeout: 10
    });

    gather.say("This endpoint is deactivated. Please check Twilio configuration.");
    twiml.hangup();

    return new Response(twiml.toString(), {
        headers: { "Content-Type": "application/xml" },
    });
}

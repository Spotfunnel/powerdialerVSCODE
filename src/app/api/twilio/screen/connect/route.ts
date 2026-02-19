
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: Request) {
    // Empty response tells Twilio to proceed with connecting the call
    const twiml = new twilio.twiml.VoiceResponse();
    return new Response(twiml.toString(), {
        headers: { "Content-Type": "application/xml" },
    });
}

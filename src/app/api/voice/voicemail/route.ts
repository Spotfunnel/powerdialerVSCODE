import { NextResponse } from 'next/server';
import Twilio from 'twilio';

// This is called if the Dial action completes (e.g. no answer, busy, failed)
export async function POST(req: Request) {
    try {
        const response = new Twilio.twiml.VoiceResponse();

        response.say("You have reached the voicemail of Leo Gewert. Please leave a message after the beep.");
        response.record({
            action: '/api/voice/recording-handler', // Optional: where to handle the recording result
            maxLength: 30,
            playBeep: true,
        });
        response.hangup();

        return new NextResponse(response.toString(), {
            headers: { "Content-Type": "text/xml" }
        });
    } catch (error) {
        console.error("Voicemail TwiML Error:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

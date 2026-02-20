import { NextResponse } from "next/server";
import Twilio from "twilio";

export async function POST(req: Request) {
    const response = new Twilio.twiml.VoiceResponse();

    response.say("Please leave a message after the beep.");
    response.record({
        maxLength: 120,
        playBeep: true,
        recordingStatusCallback: '/api/twilio/recording',
        recordingStatusCallbackEvent: ['completed'],
    });
    response.hangup();

    return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" }
    });
}

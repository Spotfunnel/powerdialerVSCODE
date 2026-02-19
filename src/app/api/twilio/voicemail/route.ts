import { NextResponse } from "next/server";
import Twilio from "twilio";

export async function POST(req: Request) {
    const response = new Twilio.twiml.VoiceResponse();

    response.say("Please leave a message after the beep.");
    response.record({
        action: "/api/twilio/recording", // Webhook to handle the completed recording
        maxLength: 120,
        playBeep: true,
        transcribe: true // Optional: if you want transcription
    });
    response.hangup();

    return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" }
    });
}

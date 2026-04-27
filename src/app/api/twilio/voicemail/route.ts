import { NextResponse } from "next/server";
import Twilio from "twilio";
import { validateTwilioRequest } from "@/lib/twilio";

export async function POST(req: Request) {
    const formData = await req.formData();
    const params = Object.fromEntries(formData.entries());
    const isValid = await validateTwilioRequest(req, req.url, params);
    if (!isValid) {
        console.error("[Security] INVALID TWILIO SIGNATURE on voicemail route.");
        return new NextResponse("Unauthorized", { status: 401 });
    }

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

import { NextResponse } from "next/server";
import Twilio from "twilio";
import { getBaseUrl } from "@/lib/twilio";

export async function POST(req: Request) {
    const formData = await req.formData();
    // DialCallStatus can be 'completed', 'answered', 'busy', 'no-answer', 'failed', 'canceled'
    const dialCallStatus = formData.get('DialCallStatus');
    const response = new Twilio.twiml.VoiceResponse();
    const baseUrl = await getBaseUrl();

    // If the call was not answered, redirect to voicemail
    if (dialCallStatus !== 'completed' && dialCallStatus !== 'answered') {
        response.redirect(`${baseUrl}/api/twilio/voicemail`);
    } else {
        response.hangup();
    }

    return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" }
    });
}

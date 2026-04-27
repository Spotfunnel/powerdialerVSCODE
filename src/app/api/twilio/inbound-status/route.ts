import { NextResponse } from "next/server";
import Twilio from "twilio";
import { getBaseUrl, validateTwilioRequest } from "@/lib/twilio";

export async function POST(req: Request) {
    const formData = await req.formData();
    const params = Object.fromEntries(formData.entries());
    const isValid = await validateTwilioRequest(req, req.url, params);
    if (!isValid) {
        console.error("[Security] INVALID TWILIO SIGNATURE on inbound-status route.");
        return new NextResponse("Unauthorized", { status: 401 });
    }

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

import { NextResponse } from "next/server";
import Twilio from "twilio";

/**
 * Whisper/Screening endpoint for inbound PSTN forwarding.
 *
 * When an inbound call is simultaneously dialed to the user's phone,
 * this TwiML plays BEFORE bridging. It announces the caller and
 * requires press-1 to accept — so the user knows it's from PowerDialer
 * (not spam) and who's calling.
 *
 * Flow:
 * 1. Phone answers → Twilio calls this URL (initial screening)
 * 2. Plays: "PowerDialer call from [Name], [Company]. Press 1 to accept."
 * 3. Press 1 → call bridges (user talks to caller)
 * 4. No input / wrong key → leg hangs up (browser still ringing)
 */
export async function POST(req: Request) {
    const formData = await req.formData();
    const digits = formData.get('Digits') as string | null;
    const response = new Twilio.twiml.VoiceResponse();

    if (digits) {
        if (digits === "1") {
            // Accept — return empty TwiML to bridge the call
            return new NextResponse(response.toString(), {
                headers: { "Content-Type": "text/xml" }
            });
        }
        // Wrong key — drop this leg
        response.hangup();
        return new NextResponse(response.toString(), {
            headers: { "Content-Type": "text/xml" }
        });
    }

    // Initial screening — announce caller and wait for press-1
    const { searchParams } = new URL(req.url);
    const callerName = searchParams.get('callerName') || 'Unknown caller';
    const callerCompany = searchParams.get('callerCompany') || '';

    const announcement = callerCompany
        ? `PowerDialer call from ${callerName}, ${callerCompany}. Press 1 to accept.`
        : `PowerDialer call from ${callerName}. Press 1 to accept.`;

    const gather = response.gather({
        numDigits: 1,
        action: '/api/twilio/whisper',
        timeout: 8
    });
    gather.say({ voice: 'Polly.Amy' }, announcement);

    // No input after timeout → hang up this leg (browser/other legs keep ringing)
    response.hangup();

    return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" }
    });
}

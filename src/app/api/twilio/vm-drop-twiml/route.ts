import { NextResponse } from "next/server";

export async function POST() {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- We skip immediate Play to avoid overlap with voicemail 'beep' detection logic if any -->
    <Pause length="1"/>
    <Say voice="Polly.Joey">Hi, this is a message from the team. We tried to reach you but missed you. Please call us back at your convenience.</Say>
    <Play>https://demo.twilio.com/docs/classic.mp3</Play> 
    <!-- Note: User should replace the Play URL with their own /recordings/vm_drop.mp3 later -->
    <Hangup/>
</Response>`;

    return new Response(twiml, {
        headers: { "Content-Type": "text/xml" }
    });
}

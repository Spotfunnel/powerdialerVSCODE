import { NextResponse } from "next/server";
import { validateTwilioRequest } from "@/lib/twilio";

function escapeXml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    const isValid = await validateTwilioRequest(req, req.url, params);
    if (!isValid) {
        console.error("[Security] INVALID TWILIO SIGNATURE on spam-test-twiml route.");
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const from = escapeXml(url.searchParams.get("from") || "unknown number");

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Test call from ${from}. This is a spam check.</Say>
    <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" }
    });
}

import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "unknown number";

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Test call from ${from}. This is a spam check.</Say>
    <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" }
    });
}

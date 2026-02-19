import { NextResponse } from "next/server";
import twilio from "twilio";
import { getCredentials, getBaseUrl } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { callSid } = await req.json();
        if (!callSid) return NextResponse.json({ error: "Call SID required" }, { status: 400 });

        const { sid, token } = await getCredentials();
        const client = twilio(sid, token);

        const baseUrl = await getBaseUrl();
        if (!baseUrl) throw new Error("Webhook base URL not configured");

        // Redirect the call to our VM Drop TwiML
        await client.calls(callSid).update({
            url: `${baseUrl}/api/twilio/vm-drop-twiml`,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("VM Drop Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

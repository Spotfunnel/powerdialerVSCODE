import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCredentials } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { fromNumber, toNumber } = await req.json();
        if (!fromNumber || !toNumber) {
            return NextResponse.json({ error: "fromNumber and toNumber are required" }, { status: 400 });
        }

        const { sid, token } = await getCredentials();
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const baseUrl = (settings?.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || "").trim();

        if (!baseUrl) {
            return NextResponse.json({ error: "Webhook base URL not configured" }, { status: 500 });
        }

        const client = twilio(sid, token);
        const call = await client.calls.create({
            to: toNumber,
            from: fromNumber,
            url: `${baseUrl}/api/admin/twilio/spam-test-twiml?from=${encodeURIComponent(fromNumber)}`
        });

        return NextResponse.json({ success: true, callSid: call.sid });
    } catch (error: any) {
        console.error("Spam test call failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const callSid = searchParams.get("callSid");
        if (!callSid) {
            return NextResponse.json({ error: "callSid is required" }, { status: 400 });
        }

        const { sid, token } = await getCredentials();
        const client = twilio(sid, token);
        const call = await client.calls(callSid).fetch();

        return NextResponse.json({ status: call.status });
    } catch (error: any) {
        console.error("Spam test status check failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

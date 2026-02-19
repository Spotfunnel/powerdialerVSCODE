import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendSMS } from "@/lib/twilio";
import { prisma } from "@/lib/prisma"; // Added prisma for rate limit check

export async function POST(req: Request) {
    let bodyText = "";
    let parsedBody: any = {};

    try {
        bodyText = await req.text();
        if (bodyText) parsedBody = JSON.parse(bodyText);
    } catch (e) { }

    // LOG REQUEST ATTEMPT (Before Auth)
    try {
        await prisma.auditLog.create({
            data: {
                eventType: "SMS_API_HIT",
                payload: JSON.stringify({
                    url: req.url,
                    hasBody: !!bodyText,
                    leadId: parsedBody.leadId
                })
            }
        });
    } catch (e) {
        console.error("Audit log fail", e);
    }

    const session = await getServerSession(authOptions);
    if (!session) {
        // Log Auth Failure
        try {
            await prisma.auditLog.create({
                data: { eventType: "SMS_API_UNAUTHORIZED", payload: "No Session" }
            });
        } catch (e) { }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { to, body, leadId } = parsedBody;

        // LOG REQUEST ATTEMPT (Authenticated)
        try {
            await prisma.auditLog.create({
                data: {
                    eventType: "SMS_API_ATTEMPT",
                    payload: JSON.stringify({ userId: (session.user as any).id, to, leadId, bodySnippet: body?.substring(0, 10) })
                }
            });
        } catch (e) { }

        if (!body) {
            return NextResponse.json({ error: "Missing 'body'" }, { status: 400 });
        }

        let recipientsNumber = to;

        if (!recipientsNumber && leadId) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (lead) {
                recipientsNumber = lead.phoneNumber;
            }
        }

        if (!recipientsNumber) {
            return NextResponse.json({ error: "Missing 'to' number and could not resolve from Lead ID" }, { status: 400 });
        }

        const userId = (session.user as any).id;

        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentCount = await prisma.message.count({
            where: { userId, createdAt: { gte: oneMinuteAgo }, direction: "OUTBOUND" }
        });

        if (recentCount >= 20) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
        }

        const message = await sendSMS({
            to: recipientsNumber,
            body,
            leadId,
            userId
        });

        return NextResponse.json({ success: true, message });

    } catch (error: any) {
        console.error("Failed to send message", error);
        // LOG FAILURE
        try {
            await prisma.auditLog.create({
                data: {
                    eventType: "SMS_API_FAILURE",
                    payload: JSON.stringify({ error: error.message, stack: error.stack })
                }
            });
        } catch (e) { }

        return NextResponse.json({ error: error.message || "Failed to send" }, { status: 500 });
    }
}

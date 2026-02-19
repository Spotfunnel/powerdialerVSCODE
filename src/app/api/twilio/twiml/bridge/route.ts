import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBridgeTwiML } from "@/lib/twilio-service";
import { getBaseUrl } from "@/lib/twilio";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    const userId = searchParams.get("userId");
    // We need to resolve base URL dynamically or from env
    // Since this is a GET route, we might not want to await getBaseUrl() if it's slow, 
    // but we need it for the absolute URL in recordingStatusCallback if Twilio requires it. 
    // Twilio handles relative URLs for callbacks relative to the current TwiML request URL? 
    // It's safer to use absolute, but let's try relative first or fetch base url.

    // NOTE: getBaseUrl is getting it from DB settings, which is async. 
    // We can't easily use async in the TwiML generation string interpolation efficiently without refactoring.
    // However, existing `inbound` route used relative path `/api/twilio/...`. 
    // Using relative path is standard for TwiML apps on same domain.

    if (!leadId) {
        return new Response("Missing leadId", { status: 400 });
    }

    try {
        const [lead, settings] = await Promise.all([
            prisma.lead.findUnique({ where: { id: leadId } }),
            prisma.settings.findUnique({ where: { id: "singleton" } })
        ]);

        if (!lead) {
            return new Response("Lead not found", { status: 404 });
        }

        // 1. Determine targeting
        // Priority: 
        // A. The userId passed in searchParams (explicit operator)
        // B. The user assigned to the lead
        const targetUserId = userId || lead.assignedToId;

        const [targetUser, pool] = await Promise.all([
            targetUserId ? prisma.user.findUnique({
                where: { id: targetUserId },
                include: { phones: { where: { isActive: true } } }
            }) : Promise.resolve(null),
            prisma.numberPool.findMany({ where: { isActive: true } })
        ]);

        let callerId = settings?.twilioFromNumbers?.split(",")[0] || "";

        // Selection Logic:
        // 1. If user has a specific pool number assigned, use it.
        // 2. Otherwise try area code match in pool
        // 3. Fallback to settings

        if (targetUser?.phones && targetUser.phones.length > 0) {
            callerId = targetUser.phones[0].phoneNumber;
        } else if (pool.length > 0) {
            const toClean = lead.phoneNumber.replace(/\D/g, '');
            const targetAreaCode = toClean.substring(2, 3);
            const match = pool.find(n => n.phoneNumber.replace(/\D/g, '').substring(2, 3) === targetAreaCode);
            if (match) {
                callerId = match.phoneNumber;
            } else {
                callerId = pool[0].phoneNumber;
            }
        }

        // UPDATED: Added record="record-from-answer" and recordingStatusCallback
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial 
        callerId="${callerId}" 
        timeout="20" 
        action="/api/twilio/status"
        record="record-from-answer"
        recordingStatusCallback="/api/twilio/recording"
        recordingStatusCallbackEvent="completed"
    >
        <Number>${lead.phoneNumber}</Number>
    </Dial>
</Response>`;

        return new Response(twiml, {
            headers: { "Content-Type": "application/xml" },
        });
    } catch (error) {
        console.error("TwiML bridge generation failed", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

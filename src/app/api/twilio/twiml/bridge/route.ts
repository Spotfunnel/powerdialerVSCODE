import { prisma } from "@/lib/prisma";
import { selectOutboundNumber } from "@/lib/number-rotation";
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
        console.error("[Security] INVALID TWILIO SIGNATURE on twiml/bridge route.");
        return new Response("Unauthorized", { status: 401 });
    }

    const leadId = url.searchParams.get("leadId");
    const userId = url.searchParams.get("userId");

    if (!leadId) {
        return new Response("Missing leadId", { status: 400 });
    }

    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { campaign: { select: { region: true } } }
        });

        if (!lead) {
            return new Response("Lead not found", { status: 404 });
        }

        const targetUserId = userId || lead.assignedToId;
        // Region priority: campaign.region > phone country code > undefined
        const leadCampaignRegion = (lead as { campaign?: { region?: string } | null }).campaign?.region;
        let region: string | undefined = leadCampaignRegion;
        if (!region) {
            if (lead.phoneNumber.startsWith('+1')) region = 'US';
            else if (lead.phoneNumber.startsWith('+61')) region = 'AU';
        }

        // Smart rotation: select number with cooldown awareness and region filtering
        const result = await selectOutboundNumber({
            userId: targetUserId || undefined,
            targetNumber: lead.phoneNumber,
            channel: "CALL",
            region
        });

        let callerId = result?.phoneNumber || "";

        // Final fallback
        if (!callerId) {
            const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
            callerId = settings?.twilioFromNumbers?.split(",")[0] || "";
        }

        // Update existing Call record with the actual callerId used for the lead
        // (initiateBridgeCall creates the record with a placeholder fromNumber)
        if (leadId) {
            prisma.call.updateMany({
                where: {
                    leadId,
                    status: "initiated",
                    fromNumber: { not: callerId }
                },
                data: { fromNumber: callerId }
            }).catch(e => console.error("[Bridge] Failed to update Call fromNumber:", e));
        }

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial
        callerId="${escapeXml(callerId)}"
        timeout="20"
        action="/api/twilio/status"
        record="record-from-answer"
        recordingStatusCallback="/api/twilio/recording"
        recordingStatusCallbackEvent="completed"
    >
        <Number>${escapeXml(lead.phoneNumber)}</Number>
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

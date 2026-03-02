import { prisma } from "@/lib/prisma";
import { selectOutboundNumber } from "@/lib/number-rotation";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    const userId = searchParams.get("userId");

    if (!leadId) {
        return new Response("Missing leadId", { status: 400 });
    }

    try {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        if (!lead) {
            return new Response("Lead not found", { status: 404 });
        }

        const targetUserId = userId || lead.assignedToId;

        // Smart rotation: select number with cooldown awareness
        const result = await selectOutboundNumber({
            userId: targetUserId || undefined,
            targetNumber: lead.phoneNumber,
            channel: "CALL"
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

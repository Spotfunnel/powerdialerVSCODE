import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { LeadStatus } from "@/lib/types";

export async function POST(req: Request) {
    try {
        const { leadId, outcome, notes } = await req.json();

        // 1. Update Lead Status
        let finalStatus = "DONE";
        if (outcome === "BAD_NUMBER") finalStatus = "BAD_NUMBER";
        if (outcome === "CALLBACK") finalStatus = "READY"; // Ready for retry/callback

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: finalStatus,
                attempts: { increment: 1 },
                lastCalledAt: new Date(),
                nextCallAt: outcome === "CALLBACK" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
                lockedAt: null,
                lockedById: null
            }
        });

        // 2. Update Call Record
        await prisma.call.updateMany({
            where: { leadId, outcome: null },
            data: { outcome, notes }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Outcome Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

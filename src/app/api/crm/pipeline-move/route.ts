import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { leadId, stage, notes } = body;

        if (!leadId || !stage) {
            return NextResponse.json({ error: "Missing leadId or stage" }, { status: 400 });
        }

        // Update local status directly
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: stage,
                notes: notes ? `[PIPELINE MOVE: ${stage}] ${notes}` : undefined
            }
        });

        // LEADERBOARD INTEGRATION
        // If stage is BOOKED or SOLD, we need to create a "Call" record 
        // with that outcome so it counts on the leaderboard.
        // We mark it as direction="SYSTEM" or just "OUTBOUND" with 0 duration 
        // so it doesn't mess up call time metrics too much, but counts for outcome.

        const upperStage = stage.toUpperCase();
        if (upperStage === 'BOOKED' || upperStage === 'SOLD' || upperStage === 'DEMO BOOKED' || upperStage === 'CLOSED WON') {

            // Map stage to standard Outcome
            let outcome = 'BOOKED';
            if (upperStage === 'SOLD' || upperStage === 'CLOSED WON') {
                outcome = 'SOLD';
            }

            // Check if we already have a recent 'similar' call to avoid dupes? 
            // For now, assume every manual move is a valid new credit.

            await prisma.call.create({
                data: {
                    userId: (session.user as any).id,
                    leadId: leadId,
                    direction: 'SYSTEM', // Distinct from actual calls
                    fromNumber: 'SYSTEM',
                    toNumber: 'PIPELINE',
                    status: 'completed',
                    outcome: outcome,
                    duration: 0,
                    notes: `Pipeline move to ${stage}: ${notes || ''}`
                }
            });
            console.log(`[Pipeline] Created SYSTEM call for Leaderboard: ${outcome} for user ${(session.user as any).id}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Pipeline Move Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to move lead",
        }, { status: 500 });
    }
}

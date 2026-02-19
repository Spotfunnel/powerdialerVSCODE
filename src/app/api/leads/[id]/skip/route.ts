import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const leadId = params.id;
        const userId = (session.user as any).id;

        // Verify it's locked by this user
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { lockedById: true }
        });

        if (!lead || lead.lockedById !== userId) {
            // Just return success if it's already released or not ours
            return NextResponse.json({ success: true });
        }

        // Release the lock and put back to READY
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: "READY",
                lockedById: null,
                lockedAt: null
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Skip lead failed", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

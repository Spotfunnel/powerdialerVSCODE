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
        const { leadId, status } = await req.json();

        if (!leadId || !status) {
            return NextResponse.json({ error: "Missing leadId or status" }, { status: 400 });
        }

        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { status },
            select: {
                id: true,
                status: true,
                updatedAt: true
            }
        });

        // For now, just update local DB for the pipeline state

        return NextResponse.json({ lead: updatedLead });
    } catch (error: any) {
        console.error("Pipeline Status Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

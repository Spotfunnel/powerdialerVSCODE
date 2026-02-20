import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { leadIds, campaignId } = await req.json();
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ error: "No leads selected" }, { status: 400 });
        }

        const updated = await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { campaignId: campaignId || null }
        });

        return NextResponse.json({ success: true, count: updated.count });
    } catch (error: any) {
        console.error("Failed to bulk assign campaign", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

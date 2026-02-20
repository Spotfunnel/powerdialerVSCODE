import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PIPELINE_STAGES } from "@/lib/types";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const campaignId = searchParams.get("campaignId");

        const activeStatuses = PIPELINE_STAGES.map(s => s.status);

        const where: any = {
            status: { in: activeStatuses as string[] }
        };
        if (campaignId) {
            where.campaignId = campaignId;
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 1000,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                phoneNumber: true,
                status: true,
                attempts: true,
                priority: true,
                updatedAt: true,
                assignedToId: true,
                campaignId: true
            }
        });

        return NextResponse.json({ leads });
    } catch (error: any) {
        console.error("Pipeline Fetch Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

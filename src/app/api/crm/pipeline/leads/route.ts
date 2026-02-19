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
        // Extract active statuses from the config
        const activeStatuses = PIPELINE_STAGES.map(s => s.status);

        // Fetch leads only in these statuses
        // We might want to limit 'READY' leads if there are too many, 
        // effectively treating it as a "Backlog" view.
        // For now, let's execute a single efficient query.

        const leads = await prisma.lead.findMany({
            where: {
                status: {
                    in: activeStatuses as string[]
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 1000, // Safety cap to prevent browser crash if there are 10k leads
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
                assignedToId: true // Minimal fields for card display
            }
        });

        return NextResponse.json({ leads });
    } catch (error: any) {
        console.error("Pipeline Fetch Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

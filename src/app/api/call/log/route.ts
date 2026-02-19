import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { leadId, notes } = await req.json();
        const userId = (session.user as any).id;

        if (!leadId) {
            return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
        }

        await withPrismaRetry(() =>
            prisma.leadActivity.create({
                data: {
                    leadId,
                    userId,
                    type: 'CALL',
                    content: notes || 'Outbound Call init',
                    createdAt: new Date()
                }
            })
            , 3, 1000, true);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to log call:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

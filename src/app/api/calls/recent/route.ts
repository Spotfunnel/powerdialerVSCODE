import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const userId = (session.user as any).id;
        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get('leadId');

        const recentCalls = await prisma.call.findMany({
            where: {
                userId: userId,
                ...(leadId ? { leadId } : {})
            },
            take: leadId ? 5 : 10,
            orderBy: { createdAt: 'desc' },
            include: {
                lead: {
                    select: {
                        firstName: true,
                        lastName: true,
                        companyName: true
                    }
                }
            }
        });

        const formatted = recentCalls.map(call => ({
            id: call.id,
            leadId: call.leadId,
            leadName: call.lead ? `${call.lead.firstName || ''} ${call.lead.lastName || ''}`.trim() || call.lead.companyName : 'Unknown',
            companyName: call.lead?.companyName,
            status: call.status,
            duration: call.duration,
            createdAt: call.createdAt,
            fromNumber: call.fromNumber,
            toNumber: call.toNumber
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error("Failed to fetch recent calls", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { getNextLead } from "@/lib/dialer-logic";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const forcedId = searchParams.get("id") || undefined;
    const campaignId = searchParams.get("campaignId") || null;

    try {
        const lead = await withPrismaRetry(() => getNextLead(userId, forcedId, campaignId), 3, 1000, true);
        if (!lead) {
            return NextResponse.json({ message: "No leads ready" }, { status: 404 });
        }
        return NextResponse.json(lead);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

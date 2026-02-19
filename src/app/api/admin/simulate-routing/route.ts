import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { phoneNumber } = await req.json();

        // SIMULATE LOGIC from inbound route
        const numberPoolItem = await prisma.numberPool.findUnique({
            where: { phoneNumber },
            include: { owner: true }
        });

        let targetId = null;
        let reason = "UNKNOWN";
        let ownerInfo = null;

        if (numberPoolItem?.owner) {
            const owner = numberPoolItem.owner;
            ownerInfo = { name: owner.name, email: owner.email, lastSeenAt: owner.lastSeenAt };

            const isOnline = owner.lastSeenAt && (new Date().getTime() - new Date(owner.lastSeenAt).getTime() < 60000);

            if (isOnline) {
                targetId = owner.id;
                reason = "OWNER_ONLINE";
            } else {
                reason = "OWNER_OFFLINE_FALLBACK";
            }
        } else {
            reason = "UNASSIGNED_POOL";
        }

        if (!targetId) {
            // Check fallback
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const onlineAgent = await prisma.user.findFirst({
                where: { lastSeenAt: { gte: oneMinuteAgo } },
                orderBy: { lastSeenAt: 'desc' },
                select: { id: true, name: true, email: true }
            });

            if (onlineAgent) {
                targetId = onlineAgent.id;
                reason += ` -> AVAILABLE_AGENT (${onlineAgent.email})`;
            } else {
                reason += " -> NO_AGENTS_ONLINE -> LAST_INTERACTION_CHECK";
            }
        }

        return NextResponse.json({
            phoneNumber,
            owner: ownerInfo,
            decision: {
                targetUserId: targetId,
                reason
            }
        });

    } catch (error) {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

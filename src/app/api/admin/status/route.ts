import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const logs = await prisma.twilioLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 10
        });

        const activeUsers = await prisma.user.findMany({
            where: {
                lastSeenAt: {
                    gte: new Date(Date.now() - 60000) // Online in last 60s
                }
            },
            select: { id: true, name: true, email: true, lastSeenAt: true, repPhoneNumber: true }
        });

        return NextResponse.json({
            logs,
            users: activeUsers,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }
}

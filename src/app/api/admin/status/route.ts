import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) { // TODO: Check for ADMIN role
            // For now allow any user to see debug status if they have access to /admin
        }

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

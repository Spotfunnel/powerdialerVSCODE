import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // Throttle updates: Only update if last seen was > 55s ago
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lastSeenAt: true }
        });

        if (!user?.lastSeenAt || (new Date().getTime() - new Date(user.lastSeenAt).getTime() > 55000)) {
            await prisma.$executeRaw`UPDATE "User" SET "lastSeenAt" = NOW() WHERE id = ${userId}`;
        }

        return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Presence update failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

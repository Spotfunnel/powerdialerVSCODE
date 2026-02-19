
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const { searchParams } = new URL(req.url);
        const since = searchParams.get('since') || new Date(Date.now() - 30000).toISOString();

        // 1. Fetch new SMS messages assigned to this user
        const newMessages = await prisma.message.findMany({
            where: {
                userId: userId,
                direction: "INBOUND",
                createdAt: { gt: new Date(since) }
            },
            include: {
                lead: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // 2. Fetch new LeadActivities (in case any other system events happened)
        const recentActivities = await prisma.leadActivity.findMany({
            where: {
                userId: userId,
                createdAt: { gt: new Date(since) },
                type: { not: "SYSTEM" } // Don't notify for internal system background tasks
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Combine into a unified notification format
        const notifications = [
            ...newMessages.map(msg => ({
                id: msg.id,
                type: 'sms',
                title: `New Message from ${msg.lead?.firstName || msg.fromNumber}`,
                message: msg.body,
                createdAt: msg.createdAt,
                leadId: msg.leadId
            })),
            ...recentActivities
                .filter(act => !newMessages.some(m => m.id === act.id)) // Avoid duplicates if same event
                .filter(act => act.type !== 'CALL') // FILTER OUT: Don't notify for outbound calls user initiates
                .map(act => ({
                    id: act.id,
                    type: 'info',
                    title: `Activity: ${act.type}`,
                    message: act.content,
                    createdAt: act.createdAt,
                    leadId: act.leadId
                }))
        ];

        // Sort by time
        notifications.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({
            notifications,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error("Events fetch failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

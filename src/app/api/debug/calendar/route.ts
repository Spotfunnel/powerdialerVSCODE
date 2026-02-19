
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Recent Failures
        const errors = await prisma.leadActivity.findMany({
            where: {
                content: { contains: "Google Calendar Sync Failed" }
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { lead: { select: { firstName: true, lastName: true, companyName: true } } }
        });

        // 2. Connections
        const connections = await prisma.calendarConnection.findMany({
            include: { user: { select: { email: true, name: true } } }
        });

        const connectionStatus = connections.map(c => ({
            user: c.user.email,
            expiry: c.expiry,
            hasAccess: !!c.accessToken,
            hasRefresh: !!c.refreshToken,
            isExpired: c.expiry ? new Date(c.expiry) < new Date() : 'unknown'
        }));

        // 3. Recent Meetings
        const meetings = await prisma.meeting.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { lead: { select: { companyName: true } } }
        });

        return NextResponse.json({
            errors,
            connectionStatus,
            meetings
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}

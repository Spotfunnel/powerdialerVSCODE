import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const counts = {
            users: await prisma.user.count(),
            numbers: await prisma.numberPool.count(),
            logs: await prisma.twilioLog.count(),
            settings: await prisma.settings.count(),
        };

        const lastLog = await prisma.twilioLog.findFirst({
            orderBy: { timestamp: 'desc' }
        });

        return NextResponse.json({
            status: "ok",
            counts,
            lastLog: lastLog ? {
                id: lastLog.id,
                time: lastLog.timestamp,
                from: lastLog.fromNumber,
                to: lastLog.toNumber
            } : "None"
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

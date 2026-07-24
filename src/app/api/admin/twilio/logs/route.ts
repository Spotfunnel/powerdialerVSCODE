import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const logs = await prisma.twilioLog.findMany({
            take: 20,
            orderBy: { timestamp: 'desc' },
        });

        return NextResponse.json({ logs });
    } catch (error: any) {
        console.error("[Twilio Logs API] Error:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}

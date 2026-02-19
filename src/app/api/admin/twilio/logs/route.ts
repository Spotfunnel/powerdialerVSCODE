import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

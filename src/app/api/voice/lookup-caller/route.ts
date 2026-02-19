import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const to = searchParams.get('to');
        const userId = searchParams.get('userId');

        if (!to) {
            return NextResponse.json({ error: 'Missing to number' }, { status: 400 });
        }

        const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        const pool = await prisma.numberPool.findMany({ where: { isActive: true } });

        // Default to fallback
        let rawFrom = settings?.twilioFromNumbers || "Unknown";
        let callerId = rawFrom.split(',')[0].trim();
        let method = "Fallback";

        // Logic: Always use verified pool or system numbers for outbound
        // We do NOT use User Personal numbers because they fail instantly in Twilio.

        if (pool.length > 0) {
            const toClean = to.replace(/\D/g, '');
            const targetAreaCode = toClean.length >= 3 ? toClean.substring(2, 3) : '';

            const match = pool.find(n => n.phoneNumber.replace(/\D/g, '').substring(2, 3) === targetAreaCode);
            if (match) {
                callerId = match.phoneNumber;
                method = "Local Match";
            } else {
                // Random fallback from pool for rotation
                const randomIndex = Math.floor(Math.random() * pool.length);
                callerId = pool[randomIndex].phoneNumber;
                method = "Pool Rotation";
            }
        }

        return NextResponse.json({ callerId, method });

    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

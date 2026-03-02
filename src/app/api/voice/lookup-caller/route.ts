import { NextResponse } from 'next/server';
import { selectOutboundNumber } from '@/lib/number-rotation';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const to = searchParams.get('to');
        const userId = searchParams.get('userId');

        if (!to) {
            return NextResponse.json({ error: 'Missing to number' }, { status: 400 });
        }

        const result = await selectOutboundNumber({
            userId: userId || undefined,
            targetNumber: to,
            channel: "CALL"
        });

        const callerId = result?.phoneNumber || "Unknown";
        const method = result?.method || "Fallback";

        return NextResponse.json({ callerId, method });

    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

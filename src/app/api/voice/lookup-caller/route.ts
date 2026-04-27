import { NextResponse } from 'next/server';
import { selectOutboundNumber } from '@/lib/number-rotation';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const to = searchParams.get('to');
        const userId = searchParams.get('userId');

        if (!to) {
            return NextResponse.json({ error: 'Missing to number' }, { status: 400 });
        }

        // Resolve region from lead's campaign first, then phone country code.
        let region: string | undefined = undefined;
        if (to) {
            const lead = await prisma.lead.findFirst({
                where: { phoneNumber: to },
                select: { campaign: { select: { region: true } } }
            });
            const campaignRegion = (lead?.campaign as { region?: string } | null | undefined)?.region;
            if (campaignRegion) region = campaignRegion;
            else if (to.startsWith('+1')) region = 'US';
            else if (to.startsWith('+61')) region = 'AU';
        }

        const result = await selectOutboundNumber({
            userId: userId || undefined,
            targetNumber: to,
            channel: "CALL",
            region
        });

        const callerId = result?.phoneNumber || "Unknown";
        const method = result?.method || "Fallback";

        return NextResponse.json({ callerId, method });

    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

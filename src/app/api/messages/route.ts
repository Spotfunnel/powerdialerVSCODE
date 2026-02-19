import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get('leadId');

        if (!leadId) {
            return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
        }

        const messages = await prisma.message.findMany({
            where: {
                leadId: leadId
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        return NextResponse.json(messages);
    } catch (error: any) {
        console.error("Error fetching messages:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch messages" }, { status: 500 });
    }
}

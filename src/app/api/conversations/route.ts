import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch conversations - filtered by user ownership
        const conversations = await prisma.conversation.findMany({
            where: {
                OR: [
                    { assignedUserId: session.user.id },
                    { assignedUserId: null }
                ]
            },
            orderBy: { lastMessageAt: 'desc' },
            include: {
                contact: true,
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { body: true, createdAt: true }
                }
            }
        });

        return NextResponse.json(conversations);
    } catch (error: any) {
        console.error("Error fetching conversations:", error);
        // Fallback for types not matching due to missing generation
        return NextResponse.json([], { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/twilio';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const { body } = await req.json();

        // Get conversation to find phone number
        const conversation = await prisma.conversation.findUnique({
            where: { id: id }
        });

        if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

        await sendSMS({
            to: conversation.contactPhone,
            body: body,
            leadId: conversation.contactId || undefined,
            userId: session.user.id
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

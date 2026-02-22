
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeToE164 } from "@/lib/twilio";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const leadId = searchParams.get('leadId');

    if (!conversationId && !leadId) {
        return NextResponse.json({ error: "Missing conversationId or leadId" }, { status: 400 });
    }

    try {
        let targetConversationId = conversationId;

        // If queried by leadId, find the conversation first
        if (!conversationId && leadId) {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead?.phoneNumber) return NextResponse.json([]); // No phone = no convo

            console.log(`[Messages] Looking up conversation for normalized lead phone: ${normalizeToE164(lead.phoneNumber)}`);

            const conv = await prisma.conversation.findFirst({
                where: { contactPhone: normalizeToE164(lead.phoneNumber) },
                orderBy: { lastMessageAt: 'desc' }
            });

            if (!conv) return NextResponse.json([]); // No conversation yet
            targetConversationId = conv.id;
        }

        // OWNERSHIP CHECK (admins can view all conversations)
        const isAdmin = (session.user as any).role === 'ADMIN';
        if (!isAdmin) {
            const conversationSnippet = await prisma.conversation.findUnique({
                where: { id: targetConversationId! },
                select: { assignedUserId: true }
            });

            if (conversationSnippet && conversationSnippet.assignedUserId && conversationSnippet.assignedUserId !== session.user.id) {
                return NextResponse.json({ error: "Access Denied" }, { status: 403 });
            }
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: targetConversationId! },
            orderBy: { createdAt: 'asc' }, // Oldest first for chat timeline
            include: {
                user: { select: { name: true } }
            }
        });

        return NextResponse.json(messages);

    } catch (error) {
        console.error("Failed to fetch messages", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

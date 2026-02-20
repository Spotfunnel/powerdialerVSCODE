import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'OPEN'; // 'OPEN' | 'CLOSED' | 'ALL'

    try {
        const whereClause: any = {
            OR: [
                { assignedUserId: userId },
                { assignedUserId: null }
            ]
        };

        if (status !== 'ALL') {
            whereClause.status = status;
        }

        // Fetch conversations with contact details
        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        companyName: true,
                        email: true
                    }
                },
                assignedUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        body: true,
                        createdAt: true,
                        direction: true
                    }
                }
            },
            orderBy: {
                lastMessageAt: 'desc'
            }
        });

        // Avatar color palette — hash by conversation ID for stable colors
        const avatarColors = [
            "bg-teal-100 text-teal-700",
            "bg-blue-100 text-blue-700",
            "bg-purple-100 text-purple-700",
            "bg-amber-100 text-amber-700",
            "bg-rose-100 text-rose-700",
            "bg-emerald-100 text-emerald-700",
            "bg-indigo-100 text-indigo-700",
            "bg-orange-100 text-orange-700",
        ];

        const hashId = (id: string) => {
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = ((hash << 5) - hash) + id.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash);
        };

        // Format for UI
        const formatted = conversations.map((c) => ({
            id: c.id,
            contactName: c.contact ? `${c.contact.firstName || ''} ${c.contact.lastName || ''}`.trim() || c.contact.companyName : 'Unknown Contact',
            contactPhone: c.contactPhone,
            companyName: c.contact?.companyName,
            unreadCount: c.unreadCount,
            lastMessage: c.messages[0]?.body || "",
            lastMessageAt: c.lastMessageAt,
            status: c.status,
            assignedTo: c.assignedUser?.name || 'Unassigned',
            contactId: c.contactId,
            avatarColor: avatarColors[hashId(c.id) % avatarColors.length]
        }));

        return NextResponse.json(formatted);

    } catch (error) {
        console.error("Failed to fetch conversations", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

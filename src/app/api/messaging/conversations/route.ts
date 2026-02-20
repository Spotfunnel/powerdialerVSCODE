import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'OPEN'; // 'OPEN' | 'CLOSED' | 'ALL'

    try {
        const whereClause: any = {
            OR: [
                { assignedUserId: (session.user as any).id },
                { assignedUserId: null }
            ]
        };

        if (status !== 'ALL') {
            whereClause.status = status;
        }

        // Recovery: Reopen conversations that were aggressively archived by old 7-day rule
        // Any CLOSED conversation with activity in the last 30 days should be OPEN
        if (status === 'OPEN') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            await prisma.conversation.updateMany({
                where: {
                    status: 'CLOSED',
                    lastMessageAt: {
                        gte: thirtyDaysAgo
                    }
                },
                data: {
                    status: 'OPEN'
                }
            });
        }

        // Auto-archive: Move OPEN conversations with no activity for 30+ days to CLOSED
        if (status === 'OPEN' || status === 'ALL') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            await prisma.conversation.updateMany({
                where: {
                    status: 'OPEN',
                    lastMessageAt: {
                        lt: thirtyDaysAgo
                    }
                },
                data: {
                    status: 'CLOSED'
                }
            });
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

        // Avatar color palette for consistent per-conversation coloring
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

        // Format for UI
        const formatted = conversations.map((c, i) => ({
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
            avatarColor: avatarColors[i % avatarColors.length]
        }));

        return NextResponse.json(formatted);

    } catch (error) {
        console.error("Failed to fetch conversations", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

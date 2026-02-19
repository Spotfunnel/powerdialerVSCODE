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
                { assignedUserId: session.user.id },
                { assignedUserId: null } // Allow seeing unassigned? Or strictly assigned? 
                // User said "Should be user specific", so maybe only assigned to ME.
            ]
        };

        // If strict isolation is requested:
        whereClause.assignedUserId = session.user.id;

        if (status !== 'ALL') {
            whereClause.status = status;
        }

        // Auto-archive logic: Move OPEN conversations with last message > 7 days ago to CLOSED
        // This ensures the "Active" tab stays clean
        if (status === 'OPEN' || status === 'ALL') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            await prisma.conversation.updateMany({
                where: {
                    status: 'OPEN',
                    lastMessageAt: {
                        lt: sevenDaysAgo
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

        // Format for UI
        const formatted = conversations.map(c => ({
            id: c.id,
            contactName: c.contact ? `${c.contact.firstName || ''} ${c.contact.lastName || ''}`.trim() || c.contact.companyName : 'Unknown Contact',
            contactPhone: c.contactPhone,
            companyName: c.contact?.companyName,
            unreadCount: c.unreadCount,
            lastMessage: c.messages[0]?.body || "",
            lastMessageAt: c.lastMessageAt,
            status: c.status,
            assignedTo: c.assignedUser?.name || 'Unassigned',
            contactId: c.contactId
        }));

        return NextResponse.json(formatted);

    } catch (error) {
        console.error("Failed to fetch conversations", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

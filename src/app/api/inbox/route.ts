import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

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

function hashId(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface InboxItem {
    id: string;
    type: 'sms' | 'call' | 'voicemail';
    contactName: string;
    contactPhone: string;
    companyName?: string;
    preview: string;
    timestamp: Date;
    direction: string;
    duration?: number;
    recordingUrl?: string;
    conversationId?: string;
    leadId?: string;
    unreadCount?: number;
    avatarColor: string;
    outcome?: string;
    agentName?: string;
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Parallel queries — no filtering, no side effects, just reads
        const [conversations, calls] = await Promise.all([
            prisma.conversation.findMany({
                include: {
                    contact: {
                        select: { id: true, firstName: true, lastName: true, companyName: true, phoneNumber: true }
                    },
                    messages: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        select: { body: true, createdAt: true, direction: true }
                    }
                },
                orderBy: { lastMessageAt: 'desc' }
            }),
            prisma.call.findMany({
                include: {
                    lead: {
                        select: { id: true, firstName: true, lastName: true, companyName: true, phoneNumber: true }
                    },
                    user: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Map conversations to inbox items
        const smsItems: InboxItem[] = conversations.map(c => {
            const name = c.contact
                ? `${c.contact.firstName || ''} ${c.contact.lastName || ''}`.trim() || c.contact.companyName || c.contactPhone
                : c.contactPhone;

            return {
                id: `sms-${c.id}`,
                type: 'sms',
                contactName: name,
                contactPhone: c.contactPhone,
                companyName: c.contact?.companyName || undefined,
                preview: c.messages[0]?.body || '',
                timestamp: c.lastMessageAt,
                direction: c.messages[0]?.direction || 'OUTBOUND',
                conversationId: c.id,
                leadId: c.contactId || undefined,
                // If last message is outbound (user sent it), suppress unread badge
                unreadCount: c.messages[0]?.direction === 'OUTBOUND' ? 0 : c.unreadCount,
                avatarColor: avatarColors[hashId(c.id) % avatarColors.length],
            };
        });

        // Map calls to inbox items
        const callItems: InboxItem[] = calls.map(c => {
            const isVoicemail = c.status === 'voicemail' || c.outcome === 'Left Voicemail';
            const name = c.lead
                ? `${c.lead.firstName || ''} ${c.lead.lastName || ''}`.trim() || c.lead.companyName || c.lead.phoneNumber
                : c.toNumber || c.fromNumber;

            let preview: string;
            if (isVoicemail) {
                preview = `Voicemail (${formatDuration(c.duration)})`;
            } else if (c.outcome) {
                preview = `${c.outcome} · ${formatDuration(c.duration)}`;
            } else {
                preview = `${c.status} · ${formatDuration(c.duration)}`;
            }

            return {
                id: `call-${c.id}`,
                type: isVoicemail ? 'voicemail' as const : 'call' as const,
                contactName: name,
                contactPhone: c.direction === 'INBOUND' ? c.fromNumber : c.toNumber,
                companyName: c.lead?.companyName || undefined,
                preview,
                timestamp: c.createdAt,
                direction: c.direction,
                duration: c.duration,
                recordingUrl: c.recordingUrl ? `/api/recordings/${c.id}` : undefined,
                leadId: c.leadId,
                unreadCount: undefined,
                avatarColor: avatarColors[hashId(c.id) % avatarColors.length],
                outcome: c.outcome || c.status,
                agentName: c.user?.name || undefined,
            };
        });

        // Merge and sort by timestamp descending
        const items = [...smsItems, ...callItems].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return NextResponse.json(items);

    } catch (error) {
        console.error("[Inbox] Failed to fetch", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getOccupiedSlots } from '@/lib/google-calendar';
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'Missing specific date range' }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // 1. Fetch Google Events
        const googleEvents = await getOccupiedSlots(start, end);

        // 2. Fetch DB Meetings (Reliability Fallback)
        // We fetch ALL meetings in range to ensure we don't miss anything, 
        // especially those that failed to sync (provider = PENDING/FAILED)
        const dbMeetings = await prisma.meeting.findMany({
            where: {
                startAt: { gte: start },
                endAt: { lte: end },
            },
            include: { user: true } // Need user name for frontend filtering
        });

        // 3. Merge Strategies
        // If a DB meeting works, it might duplicate the Google Event if we aren't careful.
        // Google Events usually have an ID. DB meetings have 'externalEventId'.
        const googleEventIds = new Set(googleEvents.map((e: any) => e.id));

        const wrappedDbEvents = dbMeetings
            .filter(m => !m.externalEventId || !googleEventIds.has(m.externalEventId))
            .map(m => ({
                id: m.externalEventId || `db-${m.id}`,
                summary: m.title, // "Demo: Company"
                description: `Assigned Specialist: ${m.user.name || 'Unknown'}\n\n(Synced from DB)`,
                start: { dateTime: m.startAt.toISOString() },
                end: { dateTime: m.endAt.toISOString() },
                status: 'confirmed'
            }));

        const events = [...googleEvents, ...wrappedDbEvents];

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Error fetching calendar availability:', error);
        return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
    }
}

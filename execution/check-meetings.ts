import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkMeetings() {
    const meetings = await prisma.meeting.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            lead: true,
            user: true
        }
    });

    console.log("Last 5 Meetings:");
    console.table(meetings.map(m => ({
        id: m.id,
        lead: m.lead.firstName + ' ' + m.lead.lastName,
        user: m.user.name,
        startAt: m.startAt,
        provider: m.provider,
        externalId: m.externalEventId
    })));
}

checkMeetings()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

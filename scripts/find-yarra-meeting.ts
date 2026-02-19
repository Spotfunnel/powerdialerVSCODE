
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Looking for 'Yarra Solar'...");

    const lead = await prisma.lead.findFirst({
        where: {
            companyName: { contains: "Yarra", mode: "insensitive" }
        },
        include: { meetings: true }
    });

    if (!lead) {
        console.log("Lead 'Yarra Solar' not found.");
        return;
    }

    console.log(`Found Lead: ${lead.companyName} (${lead.id})`);

    if (lead.meetings.length === 0) {
        console.log("No meetings found for this lead.");
    } else {
        lead.meetings.forEach(m => {
            console.log(`\nMeeting: ${m.title}`);
            console.log(`Start: ${m.startAt}`);
            console.log(`Meeting URL: ${m.meetingUrl || 'N/A'}`);
            console.log(`Calendar URL: ${m.calendarUrl || 'N/A'}`);
            console.log(`Provider: ${m.provider}`);
            console.log(`External ID: ${m.externalEventId || 'NOT SYNCED'}`);
        });
    }

    // Also check for any activity logs related to this lead for errors
    const logs = await prisma.leadActivity.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log("\nRecent Activity:");
    logs.forEach(l => console.log(`[${l.type}] ${l.content}`));
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());

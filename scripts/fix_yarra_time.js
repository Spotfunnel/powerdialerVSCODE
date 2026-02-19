
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Fixing Yarra Solar Time ---");

    // 1. Find the Yarra Solar Lead
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

    if (lead.meetings.length === 0) {
        console.log("No meetings found for Yarra Solar.");
        return;
    }

    const meeting = lead.meetings[0];
    console.log(`Current Meeting Start (UTC): ${meeting.startAt.toISOString()}`);

    // Target: Feb 13 2026, 2:00 PM GMT+11
    // 14:00 - 11 hours = 03:00 UTC
    const correctStart = new Date("2026-02-13T03:00:00.000Z");
    const correctEnd = new Date(correctStart.getTime() + 30 * 60000); // 30 min duration

    console.log(`Updating to Target (UTC): ${correctStart.toISOString()} (Should be 2:00 PM GMT+11)`);

    const updatedMeeting = await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
            startAt: correctStart,
            endAt: correctEnd
        }
    });

    // Also update the lead's nextCallAt to be consistent
    await prisma.lead.update({
        where: { id: lead.id },
        data: {
            nextCallAt: correctStart
        }
    });

    console.log(`Updated Meeting Start (UTC): ${updatedMeeting.startAt.toISOString()}`);
    console.log("SUCCESS");
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());

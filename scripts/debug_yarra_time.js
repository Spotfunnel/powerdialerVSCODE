
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Debugging Yarra Solar Time ---");

    const lead = await prisma.lead.findFirst({
        where: {
            companyName: { contains: "Yarra", mode: "insensitive" }
        },
        include: { meetings: true }
    });

    if (!lead) {
        console.log("Lead not found.");
        return;
    }

    console.log(`Lead ID: ${lead.id}`);
    console.log(`Lead nextCallAt (UTC): ${lead.nextCallAt ? lead.nextCallAt.toISOString() : 'NULL'}`);
    console.log(`Lead nextCallAt (Local String): ${lead.nextCallAt ? lead.nextCallAt.toString() : 'NULL'}`);

    if (lead.meetings.length > 0) {
        const meeting = lead.meetings[0];
        console.log(`Meeting Title: ${meeting.title}`);
        console.log(`Meeting Start (UTC): ${meeting.startAt.toISOString()}`);
        console.log(`Meeting Start (Local String): ${meeting.startAt.toString()}`);
        console.log(`Meeting End (UTC): ${meeting.endAt.toISOString()}`);
    } else {
        console.log("No meetings found.");
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());

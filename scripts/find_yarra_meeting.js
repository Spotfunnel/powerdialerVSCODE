
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Searching for Yarra Solar ---");

    // Find the lead first
    const leads = await prisma.lead.findMany({
        where: {
            companyName: { contains: "Yarra", mode: "insensitive" }
        },
        include: { meetings: true }
    });

    if (leads.length === 0) {
        console.log("No lead found matching 'Yarra'.");
        return;
    }

    for (const lead of leads) {
        console.log(`\nLead: ${lead.companyName} (ID: ${lead.id})`);

        if (lead.meetings.length === 0) {
            console.log("  No meetings found.");
        } else {
            lead.meetings.forEach(m => {
                console.log(`  Meeting ID: ${m.id}`);
                console.log(`  Title: ${m.title}`);
                console.log(`  Start: ${m.startAt}`);
                console.log(`  Join URL: ${m.meetingUrl || 'MISSING'}`);
                console.log(`  Cal URL: ${m.calendarUrl || 'MISSING'}`);
                console.log(`  Provider: ${m.provider}`);
                console.log(`  Google Event ID: ${m.externalEventId || 'NOT SYNCED'}`);
            });
        }

        // Check recent logs for this lead
        const logs = await prisma.leadActivity.findMany({
            where: { leadId: lead.id },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log("  Recent Logs:");
        logs.forEach(l => console.log(`    [${l.type}] ${l.content.substring(0, 150)}`));
    }
}

main()
    .catch(e => {
        console.error("Script error:", e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

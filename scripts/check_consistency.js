const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking Phone Number Consistency...");

        const leads = await prisma.lead.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        console.log("\nRecent Leads:");
        leads.forEach(l => {
            console.log(`Lead: ${l.firstName} ${l.lastName} | Phone: [${l.phoneNumber}] | ID: ${l.id}`);
        });

        const convs = await prisma.conversation.findMany({
            take: 20,
            orderBy: { updatedAt: 'desc' }
        });

        console.log("\nRecent Conversations:");
        convs.forEach(c => {
            console.log(`Conv Contact Phone: [${c.contactPhone}] | Lead ID Ref: ${c.contactId} | ID: ${c.id}`);
        });

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

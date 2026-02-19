const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking Recent Outbound Messages...");
        const messages = await prisma.message.findMany({
            where: { direction: "OUTBOUND" },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                conversation: true
            }
        });

        console.log(`Found ${messages.length} outbound messages.`);
        messages.forEach((m, i) => {
            console.log(`\n--- Outbound Message ${i + 1} (${m.createdAt}) ---`);
            console.log(`To: ${m.toNumber} | From: ${m.fromNumber}`);
            console.log(`Status: ${m.status}`);
            console.log(`Body: ${m.body.substring(0, 50)}...`);
            console.log(`Conv ID: ${m.conversationId} | Lead ID: ${m.leadId}`);
            if (m.errorMessage) console.log(`Error: ${m.errorMessage}`);
        });

        console.log("\nChecking Recent Conversations...");
        const convs = await prisma.conversation.findMany({
            take: 10,
            orderBy: { updatedAt: 'desc' }
        });
        convs.forEach((c, i) => {
            console.log(`\n--- Conversation ${i + 1} (${c.updatedAt}) ---`);
            console.log(`Contact: ${c.contactPhone} | ID: ${c.id}`);
            console.log(`Lead ID: ${c.contactId}`);
        });

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

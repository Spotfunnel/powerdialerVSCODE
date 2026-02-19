const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking Message Delivery Status...");
        // Get the current user session ID would be better, but I'll search for recent OUTBOUND messages in general first
        const messages = await prisma.message.findMany({
            where: { direction: "OUTBOUND" },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                conversation: true
            }
        });

        if (messages.length === 0) {
            console.log("No outbound messages found in the last 5 records.");
        } else {
            messages.forEach((m, i) => {
                console.log(`\n--- Message ${i + 1} ---`);
                console.log(`Created: ${m.createdAt}`);
                console.log(`To: ${m.toNumber}`);
                console.log(`Status: ${m.status}`);
                console.log(`Body: ${m.body.substring(0, 30)}...`);
                console.log(`Error: ${m.errorMessage || 'None'}`);
                console.log(`Conversation ID: ${m.conversationId}`);
                console.log(`Conv Contact Phone: ${m.conversation?.contactPhone || 'MISMATCH/MISSING'}`);
            });
        }

        // Check for any messages that are "RECEIVED" or "SENT" by Twilio in the logs but maybe "FAILED" in our DB
        const failedAudit = await prisma.auditLog.findMany({
            where: { eventType: "SMS_API_FAILURE" },
            take: 3,
            orderBy: { createdAt: 'desc' }
        });
        console.log("\nRecent API Failures:");
        failedAudit.forEach(a => console.log(`[${a.createdAt}] ${a.payload.substring(0, 100)}`));

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

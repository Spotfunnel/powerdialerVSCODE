const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking for recent SMS failures in AuditLog...");
        const failures = await prisma.auditLog.findMany({
            where: {
                eventType: { in: ["SMS_API_FAILURE", "SMS_API_ATTEMPT"] }
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        failures.forEach(f => {
            console.log(`\n[${f.createdAt}] Event: ${f.eventType}`);
            console.log(`Payload: ${f.payload}`);
        });

        // Also check the most recent Message object status
        const lastMsg = await prisma.message.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        if (lastMsg) {
            console.log(`\n--- Last Message Record ---`);
            console.log(`To: ${lastMsg.toNumber}`);
            console.log(`Status: ${lastMsg.status}`);
            console.log(`Error: ${lastMsg.errorMessage}`);
        }

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

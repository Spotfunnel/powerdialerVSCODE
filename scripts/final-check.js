
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- FINAL PRODUCTION LOG VERIFICATION ---");
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                createdAt: { gte: oneMinuteAgo },
                eventType: { in: ['SMS_CRITICAL_FAILURE', 'SMS_API_FAILURE'] }
            }
        });
        console.log(`Found ${logs.length} new failures in the last 60 seconds.`);
        logs.forEach(l => console.log(l.payload));

        const hits = await prisma.auditLog.findMany({
            where: {
                createdAt: { gte: oneMinuteAgo },
                eventType: 'SMS_API_HIT'
            }
        });
        console.log(`Found ${hits.length} new hits in the last 60 seconds.`);

    } finally {
        await prisma.$disconnect();
    }
}
main();

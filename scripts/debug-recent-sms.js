
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- DEBUG RECENT SMS ACTIVITY ---");
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                createdAt: { gte: fifteenMinutesAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${logs.length} logs in the last 15 minutes.`);

        logs.forEach(l => {
            console.log(`\n[${l.createdAt.toISOString()}] ${l.eventType}`);
            try {
                const payload = JSON.parse(l.payload);
                console.log(JSON.stringify(payload, null, 2));
            } catch (e) {
                console.log(l.payload);
            }
        });

    } catch (e) {
        console.error("Error fetching logs:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

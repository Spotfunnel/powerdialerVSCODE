const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Checking WebhookPing for Today (Feb 9, 2026) ---");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pings = await prisma.webhookPing.findMany({
        where: {
            receivedAt: { gte: today }
        },
        orderBy: { receivedAt: 'desc' }
    });

    console.log(`Pings found for today: ${pings.length}`);
    pings.forEach(p => {
        console.log(`[${p.receivedAt.toISOString()}] Source: ${p.source}\nData: ${p.data.substring(0, 200)}...\n`);
    });

    console.log("\n--- Checking TwilioLog for Today (Feb 9, 2026) ---");
    const tLogs = await prisma.twilioLog.findMany({
        where: {
            timestamp: { gte: today }
        },
        orderBy: { timestamp: 'desc' }
    });
    console.log(`TwilioLogs found for today: ${tLogs.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

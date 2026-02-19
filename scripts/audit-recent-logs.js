const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Last 20 TwilioLogs ---");
    const logs = await prisma.twilioLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 20
    });
    logs.forEach(l => {
        console.log(`[${l.timestamp.toISOString()}] From: ${l.fromNumber}, To: ${l.toNumber}, Dir: ${l.direction}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());

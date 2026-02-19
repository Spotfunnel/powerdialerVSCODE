const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPings() {
    try {
        const pings = await prisma.webhookPing.findMany({
            where: { source: 'TWIML_OUTBOUND_DEBUG' },
            orderBy: { receivedAt: 'desc' },
            take: 20
        });

        console.log('--- Recent TWIML_OUTBOUND_DEBUG Pings ---');
        pings.forEach(p => {
            console.log(`[${p.receivedAt.toISOString()}] ${p.data}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkPings();

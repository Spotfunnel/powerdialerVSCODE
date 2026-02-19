require('dotenv').config({ path: '.env.production' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllPings() {
    try {
        const pings = await prisma.webhookPing.findMany({
            orderBy: { receivedAt: 'desc' },
            take: 50
        });

        console.log('--- Last 50 WebhookPings ---');
        pings.forEach(p => {
            console.log(`[${p.receivedAt.toISOString()}] Source: ${p.source} | Data: ${p.data}`);
        });

        // Group by source
        const counts = await prisma.webhookPing.groupBy({
            by: ['source'],
            _count: { id: true }
        });
        console.log('\n--- Totals by Source ---');
        console.table(counts);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkAllPings();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const stats = await prisma.lead.groupBy({
            by: ['status'],
            _count: { id: true }
        });

        const available = await prisma.lead.count({
            where: {
                status: 'READY',
                OR: [
                    { nextCallAt: null },
                    { nextCallAt: { lte: new Date() } }
                ],
                lockedById: null
            }
        });

        await prisma.webhookPing.create({
            data: {
                source: 'LEAD_AUDIT_DIAGNOSTIC',
                data: JSON.stringify({
                    stats,
                    availableCount: available,
                    timestamp: new Date().toISOString()
                })
            }
        });
        console.log('Diagnostic logged to WebhookPing.');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

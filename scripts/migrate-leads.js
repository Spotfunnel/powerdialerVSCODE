
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateLeads() {
    try {
        const counts = await prisma.lead.groupBy({
            by: ['status'],
            _count: { id: true }
        });
        console.log('Current Statuses:', counts);

        // Update NEW to READY
        const updateNew = await prisma.lead.updateMany({
            where: { status: 'NEW' },
            data: { status: 'READY' }
        });
        console.log(`Updated ${updateNew.count} leads from NEW to READY`);

        // Also update any others that should be in the start of the pipeline if needed
        // For now, just NEW -> READY seems to be the main bulk.

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

migrateLeads();


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixLeads() {
    try {
        console.log("Attempting to migrate 'NEW' leads to 'READY'...");
        const update1 = await prisma.lead.updateMany({
            where: { status: 'NEW' },
            data: { status: 'READY' }
        });
        console.log(`Updated ${update1.count} leads from NEW to READY`);

        console.log("Attempting to migrate 'NEW_LEAD' leads to 'READY'...");
        const update2 = await prisma.lead.updateMany({
            where: { status: 'NEW_LEAD' },
            data: { status: 'READY' }
        });
        console.log(`Updated ${update2.count} leads from NEW_LEAD to READY`);

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

fixLeads();

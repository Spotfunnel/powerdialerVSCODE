
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeads() {
    try {
        const counts = await prisma.lead.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });
        console.log('Lead Status Counts:', JSON.stringify(counts, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkLeads();

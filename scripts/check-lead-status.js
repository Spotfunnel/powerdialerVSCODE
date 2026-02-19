
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
        console.log('Lead Status Counts:', counts);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkLeads();

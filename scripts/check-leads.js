const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeads() {
    try {
        const statuses = await prisma.lead.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });
        console.log('--- Lead Status Distribution ---');
        console.log(JSON.stringify(statuses, null, 2));

        const lockedLeads = await prisma.lead.findMany({
            where: { status: 'LOCKED' },
            select: { id: true, lockedAt: true, lockedById: true },
            take: 10
        });
        console.log('--- Sample Locked Leads ---');
        console.log(JSON.stringify(lockedLeads, null, 2));

        const readyLeads = await prisma.lead.count({
            where: {
                OR: [
                    { status: 'READY' },
                    {
                        AND: [
                            { status: 'CALLBACK' },
                            { nextCallAt: { lte: new Date() } }
                        ]
                    }
                ],
                lockedById: null
            }
        });
        console.log(`Ready/Callback Leads (unlocked): ${readyLeads}`);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkLeads();

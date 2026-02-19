const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const s = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        console.log('HubSpot Access Token present:', !!s?.hubspotAccessToken);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();

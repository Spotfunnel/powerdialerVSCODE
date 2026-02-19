const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const s = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        console.log('HOOK_URL:', s.webhookBaseUrl);
        console.log('SID:', s.twilioAccountSid);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

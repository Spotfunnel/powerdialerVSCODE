const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- PRODUCTION SETTINGS AUDIT ---');
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 'singleton' }
        });

        if (!settings) {
            console.log('No settings found!');
            return;
        }

        console.log('Webhook Base URL:', settings.webhookBaseUrl);
        console.log('Twilio From Number:', settings.twilioFromNumbers);
        console.log('Twilio SID:', settings.twilioAccountSid ? 'SET' : 'MISSING');
        console.log('Twilio API Key:', settings.twilioApiKey ? 'SET' : 'MISSING');

        const pool = await prisma.numberPool.findMany({ where: { isActive: true } });
        console.log('Verified Number Pool Size:', pool.length);
        pool.forEach(n => console.log(' - ' + n.phoneNumber));

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

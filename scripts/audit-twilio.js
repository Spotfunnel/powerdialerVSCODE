require('dotenv').config({ path: '.env.production' });

if (process.env.DATABASE_URL) {
    process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- TWILIO CONFIG AUDIT ---');
    try {
        const s = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        if (!s) {
            console.log('Error: Settings not found (id: singleton)');
        } else {
            console.log('Settings Found:');
            console.log(`- hasSid: ${!!s.twilioAccountSid}`);
            console.log(`- hasAppSid: ${!!s.twilioAppSid}`);
            console.log(`- hasApiKey: ${!!s.twilioApiKey}`);
            console.log(`- hasApiSecret: ${!!s.twilioApiSecret}`);
            console.log(`- twilioFromNumbers: "${s.twilioFromNumbers}"`);
            console.log(`- type of twilioFromNumbers: ${typeof s.twilioFromNumbers}`);
        }

        const pool = await prisma.numberPool.findMany();
        console.log(`\nNumber Pool Size: ${pool.length}`);
        pool.forEach(n => {
            console.log(`- ${n.phoneNumber} (Active: ${n.isActive}, DailyCount: ${n.dailyCount})`);
        });

        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true }
        });
        console.log('\nUsers List:');
        users.forEach(u => {
            console.log(`- ${u.name} (${u.email}) ID: ${u.id} Role: ${u.role}`);
        });

    } catch (err) {
        console.error('Audit failed:', err);
    }
}

main().finally(() => prisma.$disconnect());

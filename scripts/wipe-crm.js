require('dotenv').config({ path: '.env.production' });

if (process.env.DATABASE_URL) {
    process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeWipe(operation, label) {
    let retries = 0;
    while (retries < 3) {
        try {
            const result = await operation();
            console.log(`- Deleted ${result.count || 'all'} ${label}`);
            return true;
        } catch (e) {
            console.log(`Retry ${retries + 1} for ${label} failed: ${e.message}`);
            retries++;
            await sleep(2000);
        }
    }
    return false;
}

async function main() {
    console.log('--- RESILIENT CRM WIPE INITIATED ---');
    try {
        await prisma.$connect();
        console.log('Connected.');

        await safeWipe(() => prisma.call.deleteMany({}), 'Calls');
        await safeWipe(() => prisma.callback.deleteMany({}), 'Callbacks');
        await safeWipe(() => prisma.meeting.deleteMany({}), 'Meetings');
        await safeWipe(() => prisma.auditLog.deleteMany({}), 'Audit Logs');
        await safeWipe(() => prisma.syncJob.deleteMany({}), 'Sync Jobs');
        await safeWipe(() => prisma.webhookPing.deleteMany({}), 'Webhook Pings');
        await safeWipe(() => prisma.lead.deleteMany({}), 'Leads (CRM Data)');

        console.log('--- LIVE MODE PURGE COMPLETE ---');
    } catch (e) {
        console.error('Fatal initialization error:', e.message);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

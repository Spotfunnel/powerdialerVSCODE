require('dotenv').config({ path: '.env.production' });

if (process.env.DATABASE_URL) {
    process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
    process.env.POSTGRES_URL_NON_POOLING = process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- LIVE DATA AUDIT ---');
    const leads = await prisma.lead.count();
    const calls = await prisma.call.count();
    const meetings = await prisma.meeting.count();
    const callbacks = await prisma.callback.count();

    console.log(`Leads: ${leads}`);
    console.log(`Calls: ${calls}`);
    console.log(`Meetings: ${meetings}`);
    console.log(`Callbacks: ${callbacks}`);

    const sample = await prisma.lead.findFirst({
        where: { website: { not: '' } }
    });

    if (sample) {
        console.log('Sample Lead with Website Found:');
        console.log(`- Company: ${sample.companyName}`);
        console.log(`- Website: ${sample.website}`);
    } else {
        console.log('Warning: No leads with websites found in the first batch.');
    }
}

main().finally(() => prisma.$disconnect());

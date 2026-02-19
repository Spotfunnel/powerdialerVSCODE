const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- CRM Diagnostics ---');
    try {
        const count = await prisma.lead.count();
        console.log(`Total Leads in DB: ${count}`);

        if (count > 0) {
            const sample = await prisma.lead.findFirst();
            console.log('Sample Lead:', sample);
        } else {
            console.log('WARNING: The Lead table is empty.');
        }

        const userCount = await prisma.user.count();
        console.log(`Total Users: ${userCount}`);

    } catch (e) {
        console.error('Diagnostic failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();

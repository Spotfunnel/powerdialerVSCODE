const { PrismaClient } = require('@prisma/client');

async function testPassword(pwd) {
    const url = `postgresql://postgres.lxsxwrunbmoiayhtexiz:${pwd}@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`;
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });
    try {
        await prisma.$connect();
        await prisma.user.findFirst();
        console.log(`✅ Password "${pwd}" WORKS!`);
        return true;
    } catch (e) {
        console.log(`❌ Password "${pwd}" FAILED: ${e.message}`);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function run() {
    await testPassword('Walkergewert01');
    await testPassword('Walkergewert0!');
}

run();

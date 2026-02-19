require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
        }
    }
});

async function verify() {
    try {
        const msgcount = await prisma.message.count();
        console.log("Total Messages in DB:", msgcount);

        const raceMsgs = await prisma.message.findMany({
            where: { body: { contains: 'Race condition test' } },
            select: { id: true, body: true, createdAt: true }
        });
        console.log(`Found ${raceMsgs.length} race test messages.`);
        if (raceMsgs.length > 0) {
            console.log("Sample:", raceMsgs[0]);
        }

    } catch (err) {
        console.error("Verification Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();

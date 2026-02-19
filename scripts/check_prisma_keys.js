require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
        }
    }
});

async function check() {
    console.log("Prisma keys:", Object.keys(prisma).filter(k => !k.startsWith('_')));
    await prisma.$disconnect();
}

check();

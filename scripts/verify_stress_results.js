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
        const leads = await prisma.lead.findMany({
            select: { id: true, firstName: true, phoneNumber: true },
            take: 20
        });
        console.log("LEADS_IN_DB:", leads.map(l => `${l.firstName}: ${l.phoneNumber}`));

    } catch (err) {
        console.error("Verification Error:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const lead = await prisma.lead.findFirst({
        select: { id: true, phoneNumber: true, firstName: true }
    });
    console.log("TARGET_LEAD:", JSON.stringify(lead));

    const ourNumber = await prisma.numberPool.findFirst({
        where: { isActive: true },
        select: { id: true, phoneNumber: true }
    });
    console.log("OUR_NUMBER:", JSON.stringify(ourNumber));
}

main().catch(console.error).finally(() => prisma.$disconnect());

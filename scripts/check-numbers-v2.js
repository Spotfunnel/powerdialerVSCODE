
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- PRODUCTION NUMBER POOL CHECK ---");
    try {
        const numbers = await prisma.numberPool.findMany({
            take: 10
        });
        console.log(`Found ${numbers.length} numbers in NumberPool table.`);
        numbers.forEach(n => {
            console.log(`- ${n.phoneNumber} (ID: ${n.id}, Active: ${n.isActive}, Owner: ${n.ownerUserId || 'Global'})`);
        });
    } catch (e) {
        console.error("Query failed", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

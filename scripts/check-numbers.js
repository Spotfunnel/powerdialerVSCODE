
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- PRODUCTION TWILIO NUMBERS CHECK ---");
    try {
        const numbers = await prisma.twilioNumber.findMany({
            take: 10
        });
        console.log(`Found ${numbers.length} numbers in TwilioNumber table.`);
        numbers.forEach(n => {
            console.log(`- ${n.phoneNumber} (ID: ${n.id}, Active: ${n.isActive})`);
        });
    } catch (e) {
        console.error("Query failed", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

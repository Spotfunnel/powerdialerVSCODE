const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Auditing NumberPool...");
        const pool = await prisma.numberPool.findMany();
        pool.forEach(n => {
            console.log(`- ${n.phoneNumber} | Active: ${n.isActive} | Type: ${n.type}`);
        });

        console.log("\nAuditing Settings (sanitized)...");
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (settings) {
            console.log(`SID: ${settings.twilioAccountSid?.substring(0, 10)}...`);
            console.log(`FromNumbers: ${settings.twilioFromNumbers}`);
            console.log(`AppSid: ${settings.twilioAppSid}`);
        } else {
            console.log("No settings found!");
        }

    } catch (e) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
check();

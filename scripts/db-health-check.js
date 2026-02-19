const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- DB HEALTH CHECK ---");
    try {
        console.log("Checking User count...");
        const count = await prisma.user.count();
        console.log("User count: " + count);

        console.log("Checking Settings...");
        const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        console.log("Settings found: " + (settings ? "YES" : "NO"));

        console.log("✅ DB Connection successful");
    } catch (err) {
        console.error("❌ DB Connection FAILED");
        console.error(err);
        process.exit(1);
    }
}

main().finally(() => prisma.$disconnect());

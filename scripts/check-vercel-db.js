
const { PrismaClient } = require('@prisma/client');

async function main() {
    // Manually paste the Vercel URL to be 100% sure what happens when it's used
    const vercelUrl = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres".trim();

    console.log("Connecting to:", vercelUrl);
    const prisma = new PrismaClient({
        datasources: {
            db: { url: vercelUrl }
        }
    });

    try {
        const count = await prisma.numberPool.count();
        console.log("NumberPool Count with Vercel URL:", count);

        const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        console.log("Settings found:", !!settings);
        console.log("Twilio SID:", settings?.twilioAccountSid ? "SET" : "MISSING");

    } catch (e) {
        console.error("Connection failed", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

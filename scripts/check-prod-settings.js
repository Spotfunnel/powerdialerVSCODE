
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- PRODUCTION SETTINGS CHECK ---");
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) {
            console.log("No settings record found with ID 'singleton'");
        } else {
            console.log("Settings found:");
            console.log("Twilio SID:", settings.twilioAccountSid ? "SET" : "MISSING");
            console.log("Twilio From Numbers:", settings.twilioFromNumbers || "EMPTY");
            console.log("Webhook Base URL:", settings.webhookBaseUrl || "EMPTY");
        }
    } catch (e) {
        console.error("Query failed", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

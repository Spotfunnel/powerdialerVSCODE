const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- START DEBUG ---");
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) {
            console.log("Settings record 'singleton' NOT FOUND.");
        } else {
            console.log("Twilio Account SID: " + (settings.twilioAccountSid ? "YES" : "NO"));
            console.log("Twilio API Key: " + (settings.twilioApiKey ? "YES" : "NO"));
            console.log("Twilio API Secret: " + (settings.twilioApiSecret ? "YES" : "NO"));
            console.log("Twilio App SID: " + (settings.twilioAppSid ? "YES" : "NO"));
            console.log("Twilio From Number: " + (settings.twilioFromNumbers ? "YES" : "NO"));
        }
        console.log("GOOGLE_CLIENT_ID: " + (process.env.GOOGLE_CLIENT_ID ? "YES" : "NO"));
        console.log("GOOGLE_REFRESH_TOKEN: " + (process.env.GOOGLE_REFRESH_TOKEN ? "YES" : "NO"));
    } catch (err) {
        console.error("Prisma Error: ", err);
    }
    console.log("--- END DEBUG ---");
}

main().finally(() => prisma.$disconnect());

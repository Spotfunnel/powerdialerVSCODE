const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Debugging Configuration ---");

    // 1. Check Twilio Settings in DB
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
        console.error("❌ [DB] Settings record 'singleton' NOT FOUND.");
    } else {
        console.log("✅ [DB] Settings record found.");
        console.log(`   - Twilio Account SID: ${settings.twilioAccountSid ? "✅ Present" : "❌ MISSING"}`);
        console.log(`   - Twilio Auth Token: ${settings.twilioAuthToken ? "✅ Present" : "❌ MISSING"}`);
        console.log(`   - Twilio API Key: ${(settings).twilioApiKey ? "✅ Present" : "❌ MISSING"}`);
        console.log(`   - Twilio API Secret: ${(settings).twilioApiSecret ? "✅ Present" : "❌ MISSING"}`);
        console.log(`   - Twilio App SID: ${settings.twilioAppSid ? "✅ Present" : "❌ MISSING"}`);
        console.log(`   - Twilio From Number: ${settings.twilioFromNumbers ? "✅ Present (" + settings.twilioFromNumbers + ")" : "❌ MISSING"}`);
    }

    // 2. Check Google Credentials in Env
    console.log("\n--- Environment Variables ---");
    console.log(`   - GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? "✅ Present" : "❌ MISSING"}`);
    console.log(`   - GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? "✅ Present" : "❌ MISSING"}`);
    console.log(`   - GOOGLE_REFRESH_TOKEN: ${process.env.GOOGLE_REFRESH_TOKEN ? "✅ Present" : "❌ MISSING"}`);

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
        console.warn("\n⚠️ Google Calendar integration will FAIL if these are missing.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

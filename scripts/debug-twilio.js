const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Checking Twilio Settings ---");
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

    if (!settings) {
        console.error("❌ CRTICAL: No 'singleton' settings record found in DB.");
        return;
    }

    console.log("✅ Settings Record Found.");
    console.log(`SID: ${settings.twilioAccountSid ? "Set (Starts with " + settings.twilioAccountSid.substring(0, 4) + ")" : "❌ MISSING"}`);
    console.log(`Token: ${settings.twilioAuthToken ? "Set (Length: " + settings.twilioAuthToken.length + ")" : "❌ MISSING"}`);
    console.log(`From Number: ${settings.twilioFromNumbers ? "Set (" + settings.twilioFromNumbers + ")" : "❌ MISSING"}`);

    if (settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumbers) {
        console.log("Basic configuration looks correct.");
    } else {
        console.error("❌ Configuration incomplete.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

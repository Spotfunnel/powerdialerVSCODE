const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

        if (settings) {
            console.log("Settings found.");
            console.log("Last Updated At:", settings.updatedAt);
            console.log("Twilio Account SID:", settings.twilioAccountSid ? "Present" : "Missing");
            console.log("Twilio Auth Token:", settings.twilioAuthToken ? "Present" : "Missing");
        } else {
            console.log("No settings found.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

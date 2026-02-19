const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- START ENCRYPTION DEBUG ---");
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) {
            console.log("Settings record 'singleton' NOT FOUND.");
        } else {
            const key = settings.twilioApiKey || "";
            const secret = settings.twilioApiSecret || "";
            console.log("API Key Length: " + key.length);
            console.log("API Key Starts with (first 5): " + key.substring(0, 5));
            console.log("API Secret Length: " + secret.length);
            console.log("ENCRYPTION_KEY Present: " + (process.env.ENCRYPTION_KEY ? "YES" : "NO"));

            // Note: The logic in route.ts is: if (apiKey && apiKey.length > 50) apiKey = decrypt(apiKey);
            // Twilio API keys are usually like 'SK...' and about 34 chars if NOT encrypted.
            // If encrypted (AES-256-CBC with IV), they are longer.
        }
    } catch (err) {
        console.error("Prisma Error: ", err);
    }
    console.log("--- END ENCRYPTION DEBUG ---");
}

main().finally(() => prisma.$disconnect());

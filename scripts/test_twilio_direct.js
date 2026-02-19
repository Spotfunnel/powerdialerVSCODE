const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const twilio = require('twilio');
const { decrypt } = require('./src/lib/encryption'); // This might not work in CJS if it's TS, I'll hardcode or try-catch

async function testSMS() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) return console.log("No settings");

        const sid = settings.twilioAccountSid;
        const token = settings.twilioAuthToken; // assuming encrypted
        // I need to decrypt it. I'll just try to get the decrypted one from settings if possible or use env

        console.log(`SID: ${sid}`);
        const from = "+61485037510"; // The one from the screenshot
        const to = "+61478737917"; // The test lead number

        console.log(`Testing from ${from} to ${to}`);
        // We might need to manually set the token if decryption fails in this script environment
        // I'll try to find the decrypted token in the DB or env
        const decryptedToken = process.env.TWILIO_AUTH_TOKEN; // Check if it's in env

        if (!decryptedToken) {
            console.log("No decrypted token in env. Trying to use hardcoded or decryption lib if possible.");
        }

        const client = twilio(sid, decryptedToken || token); // Try both

        const msg = await client.messages.create({
            to: to,
            from: from,
            body: "Test from debugger script"
        });
        console.log("SUCCESS SID:", msg.sid);
    } catch (e) {
        console.error("TWILIO ERROR:", e.code, e.message, e.status);
    } finally {
        await prisma.$disconnect();
    }
}
testSMS();

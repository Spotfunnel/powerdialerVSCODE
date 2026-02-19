require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require("crypto");
const twilio = require("twilio");

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// Decrypt helper (copied again for standalone persistence)
function getEncryptionKey() { return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest(); }
function decrypt(encryptedData) {
    try {
        const buffer = Buffer.from(encryptedData, "base64");
        const hex = buffer.toString("hex");
        const iv = Buffer.from(hex.slice(0, IV_LENGTH * 2), "hex");
        const tag = Buffer.from(hex.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), "hex");
        const encrypted = hex.slice((IV_LENGTH + TAG_LENGTH) * 2);
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) { return null; }
}

async function main() {
    try {
        console.log("Reading settings...");
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

        if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
            console.error("Credentials missing.");
            return;
        }

        const sid = settings.twilioAccountSid;
        const token = decrypt(settings.twilioAuthToken);
        const fromNumber = settings.twilioFromNumbers?.split(',')[0].trim();

        if (!fromNumber) {
            console.error("No From number configured.");
            return;
        }

        console.log(`Attempting to send FROM: ${fromNumber} using Account: ${sid}`);

        const client = twilio(sid, token);

        // Sending to a safe test number. 
        // ideally, send to the from number itself (SMS loopback) is often allowed.
        // Or "0499111222" which worked previously.
        const toNumber = "+61499111222";

        const message = await client.messages.create({
            body: "Test from Debug Script " + new Date().toISOString(),
            from: fromNumber,
            to: toNumber
        });

        console.log("SUCCESS: Message sent!");
        console.log("SID:", message.sid);
        console.log("Status:", message.status);

    } catch (e) {
        console.error("FAILED to send:", e.message);
        console.error("Code:", e.code);
        console.error("More Info:", e.moreInfo);
    } finally {
        await prisma.$disconnect();
    }
}

main();

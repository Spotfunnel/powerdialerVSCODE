require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require("crypto");
const twilio = require("twilio");

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    return crypto.createHash('sha256').update(key).digest();
}

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
    } catch (e) {
        console.error("Decryption failed:", e.message);
        return null;
    }
}

async function main() {
    try {
        console.log("Checking Settings...");
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

        if (!settings) {
            console.error("No settings found in DB!");
            return;
        }

        if (!settings.twilioAccountSid || !settings.twilioAuthToken) {
            console.error("Twilio credentials missing in DB.");
            return;
        }

        console.log("SID:", settings.twilioAccountSid);
        const token = decrypt(settings.twilioAuthToken);

        if (!token) {
            console.error("Failed to decrypt auth token. The ENCRYPTION_KEY might have changed.");
            return;
        }

        console.log("Token decrypted successfully (length " + token.length + "). Verifying with Twilio...");

        const client = twilio(settings.twilioAccountSid, token);
        try {
            const account = await client.api.v2010.accounts(settings.twilioAccountSid).fetch();
            console.log("SUCCESS! Authenticated as:", account.friendlyName);
            console.log("Status:", account.status);
            console.log("Type:", account.type);
        } catch (authError) {
            console.error("Twilio Authentication FAILED:", authError.message);
            console.error("Code:", authError.code);
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

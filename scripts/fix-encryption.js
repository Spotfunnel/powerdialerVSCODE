const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCRYPTION_KEY = "my-super-secret-dialer-key-2024-secure"; // MATCHING .env.production

function getEncryptionKey() {
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return Buffer.from(iv.toString("hex") + tag + encrypted, "hex").toString("base64");
}

async function fix() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) {
            console.log("No settings found.");
            return;
        }

        console.log("Current Settings Found. AccountSid:", settings.twilioAccountSid);

        // If token doesn't look like base64-encrypted-gcm (typically starts with IV hex -> base64)
        // Or we just force encrypt it as long as it's not already encrypted.
        // Actually, safer to just check if it's a 32-char hex string (common Twilio token format).
        const token = settings.twilioAuthToken;

        if (token && token.length === 32) {
            console.log("Token looks like plain text. Encrypting...");
            const encrypted = encrypt(token);
            await prisma.settings.update({
                where: { id: "singleton" },
                data: { twilioAuthToken: encrypted }
            });
            console.log("SUCCESS: Token encrypted and saved.");
        } else {
            console.log("Token already encrypted or invalid length:", token ? token.length : 'null');
        }

    } catch (e) {
        console.error("FIX ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}
fix();

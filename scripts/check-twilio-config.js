const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');
const crypto = require('crypto');

async function decrypt(encryptedData, encryptionKey) {
    const buffer = Buffer.from(encryptedData, "base64");
    const hex = buffer.toString("hex");
    const IV_LENGTH = 12;
    const TAG_LENGTH = 16;
    const iv = Buffer.from(hex.slice(0, IV_LENGTH * 2), "hex");
    const tag = Buffer.from(hex.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), "hex");
    const encrypted = hex.slice((IV_LENGTH + TAG_LENGTH) * 2);
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const encKey = process.env.ENCRYPTION_KEY || "my-super-secret-dialer-key-2024-secure";
    const authToken = await decrypt(settings.twilioAuthToken, encKey);
    const client = twilio(settings.twilioAccountSid, authToken);

    const numbers = await client.incomingPhoneNumbers.list();
    console.log(`--- TWILIO NUMBERS CONFIG ---`);
    for (const n of numbers) {
        console.log(`Number: ${n.phoneNumber}`);
        console.log(`- Voice URL: ${n.voiceUrl}`);
        console.log(`- SMS URL:   ${n.smsUrl}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

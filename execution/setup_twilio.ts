import { PrismaClient } from "@next-auth/prisma-adapter/node_modules/@prisma/client";
import { PrismaClient as PC2 } from "@prisma/client";
import twilio from "twilio";
import crypto from "crypto";

// Mock encryption for bitwise copy-paste from encryption.ts (since I can't import easily in a standalone ts-node script without config)
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decrypt(encryptedData: string, encryptionKey: string): string {
    const buffer = Buffer.from(encryptedData, "base64");
    const hex = buffer.toString("hex");
    const iv = Buffer.from(hex.slice(0, IV_LENGTH * 2), "hex");
    const tag = Buffer.from(hex.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), "hex");
    const encrypted = hex.slice((IV_LENGTH + TAG_LENGTH) * 2);
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

const prisma = new PC2();
const webhookUrl = "https://powerdialer-two.vercel.app/api/voice/twiml";

async function run() {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        console.error("Twilio credentials missing in DB");
        return;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        console.error("ENCRYPTION_KEY env var missing");
        return;
    }

    const token = decrypt(settings.twilioAuthToken, encryptionKey);
    const client = twilio(settings.twilioAccountSid, token);

    console.log("Fetching incoming phone numbers...");
    const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });

    console.log("\nFound these numbers in your Twilio account:");
    numbers.forEach((n, i) => {
        console.log(`${i + 1}. ${n.phoneNumber} (SID: ${n.sid}, VoiceUrl: ${n.voiceUrl})`);
    });

    console.log("\nTo configure them, please run this script with --configure and the indexes of the numbers you want to set up.");
}

run().catch(console.error);

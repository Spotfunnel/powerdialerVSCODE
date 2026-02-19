import { PrismaClient } from "@prisma/client";
import twilio from "twilio";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function decrypt(encryptedData: string, encryptionKey: string): Promise<string> {
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

async function main() {
    console.log("--- Twilio Webhook Setup ---");

    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        throw new Error("Twilio credentials not found in settings");
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || "my-super-secret-dialer-key-2024-secure";
    const authToken = await decrypt(settings.twilioAuthToken, encryptionKey);
    const accountSid = settings.twilioAccountSid;
    const baseUrl = (settings.webhookBaseUrl || "").trim();

    if (!baseUrl) {
        throw new Error("Webhook Base URL not set in settings");
    }

    console.log(`Using Base URL: ${baseUrl}`);
    console.log(`Connecting to Twilio: ${accountSid}`);

    const client = twilio(accountSid, authToken);

    const numbers = await client.incomingPhoneNumbers.list();
    console.log(`Found ${numbers.length} numbers.`);

    for (const num of numbers) {
        console.log(`Updating ${num.phoneNumber} (${num.sid})...`);
        await client.incomingPhoneNumbers(num.sid).update({
            smsUrl: `${baseUrl}/api/twilio/sms/inbound`,
            smsMethod: 'POST',
            statusCallback: `${baseUrl}/api/twilio/sms/status`,
            statusCallbackMethod: 'POST'
        });
        console.log(`✅ ${num.phoneNumber} updated.`);
    }

    console.log("--- Setup Complete ---");
}

main()
    .catch((e) => {
        console.error("❌ Setup Failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

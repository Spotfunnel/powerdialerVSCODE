
import { prisma } from "../src/lib/prisma";
import Twilio from "twilio";

async function syncWebhooks() {
    console.log("Syncing Twilio Webhooks...");

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } }) as any;
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
        console.error("Missing Twilio Credentials in DB");
        return;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || "my-super-secret-dialer-key-2024-secure";
    const authToken = await decrypt(settings.twilioAuthToken, encryptionKey);
    const client = Twilio(settings.twilioAccountSid, authToken);
    const baseUrl = (settings.webhookBaseUrl || "https://www.getspotfunnel.com").trim();

    try {
        const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
        console.log(`Found ${numbers.length} numbers.`);

        const results = await Promise.allSettled(numbers.map(async (num) => {
            console.log(`Updating ${num.phoneNumber}...`);
            await client.incomingPhoneNumbers(num.sid).update({
                voiceUrl: `${baseUrl}/api/twilio/inbound`,
                voiceMethod: 'POST',
                smsUrl: `${baseUrl}/api/twilio/sms/inbound`,
                smsMethod: 'POST',
                statusCallback: `${baseUrl}/api/twilio/status`,
                statusCallbackMethod: 'POST'
            });
            return `Updated ${num.phoneNumber}`;
        }));

        const updated = results.filter(r => r.status === 'fulfilled').length;
        console.log(`\nSync Complete. Updated: ${updated}, Total: ${numbers.length}`);

    } catch (error) {
        console.error("Twilio API Error:", error);
    }
}

async function decrypt(encryptedData: string, encryptionKey: string): Promise<string> {
    const crypto = await import("crypto");
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

syncWebhooks();

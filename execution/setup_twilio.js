const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');
const crypto = require('crypto');

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decrypt(encryptedData, encryptionKey) {
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

const prisma = new PrismaClient();

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

    const webhookUrl = "https://www.getspotfunnel.com/api/voice/twiml";

    const token = decrypt(settings.twilioAuthToken, encryptionKey);
    const client = twilio(settings.twilioAccountSid, token);

    console.log("Fetching Australian incoming phone numbers (+61)...");
    const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });

    const auNumbers = numbers.filter(n => n.phoneNumber.startsWith('+61'));

    console.log(`\nFound ${auNumbers.length} Australian numbers:`);
    auNumbers.forEach((n, i) => {
        console.log(`${i + 1}. ${n.phoneNumber} (SID: ${n.sid}, VoiceUrl: ${n.voiceUrl})`);
    });

    // If --configure flag is present, update the Voice URL and add to NumberPool
    if (process.argv.includes('--configure')) {
        console.log("\nConfiguring numbers with URL:", webhookUrl);
        for (const n of auNumbers) {
            console.log(`Updating Twilio Voice URL for ${n.phoneNumber}...`);
            await client.incomingPhoneNumbers(n.sid).update({
                voiceUrl: webhookUrl,
                voiceMethod: 'POST',
                statusCallback: "https://www.getspotfunnel.com/api/voice/status",
                statusCallbackMethod: 'POST'
            });

            console.log(`Adding ${n.phoneNumber} to database NumberPool...`);
            await prisma.numberPool.upsert({
                where: { phoneNumber: n.phoneNumber },
                update: {},
                create: {
                    phoneNumber: n.phoneNumber,
                }
            });
        }
        console.log("Configuration and DB sync complete.");
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());

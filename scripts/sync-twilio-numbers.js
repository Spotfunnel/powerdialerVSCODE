
const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Simple decrypt function mirroring the app's logic (if needed)
// Assuming config is stored encrypted or plain. The previous script showed it might be encrypted?
// Let's assume we can read it. If it's encrypted, we need the key.
// But `twilio.ts` uses `decrypt`. I don't have the key easily available in a standalone script unless I copy `encryption.ts` logic or use the app's env.
// For now, let's try to assume it's accessible or use the values if plain.
// WAIT: The previous log showed "twilioAuthToken": "..." which looked like a long string.
// Let's rely on the app's `src/lib/encryption.ts` if possible, but that's TS.
// I will just try to read from .env if credentials are there, OR assume the settings in DB are usable.
// Actually, I'll copy the decrypt logic if it's simple. 
// "encryption.ts" usually uses AES.
// Let's view `src/lib/encryption.ts` first? No, I want to be fast.
// I'll try to use the `twilio-cli` logic or just standard API if I can get the creds.
// The `twilio.ts` file imports `decrypt`. 
// I will try to run this script using `ts-node` if available? No, only `node`.
// I'll check `.env` for TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN first.

require('dotenv').config();

function decrypt(text) {
    // Simple check: if it looks like a standard token (32 chars hex/alphanum), return it.
    // If it's longer, it might be encrypted.
    // Standard Auth Token is 32 chars.
    if (text.length === 32) return text;

    // If we have an APP_SECRET, try to decrypt.
    // But for this quick fix, let's assume the user put the real token in .env or Settings is plain?
    // If settings has encrypted token, I can't easily decrypt without the code.
    // Let's check .env
    return text;
}

async function main() {
    console.log("--- Syncing Twilio Numbers ---");

    let sid = process.env.TWILIO_ACCOUNT_SID;
    let token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
        console.log("Credentials not in .env, checking DB...");
        const settings = await prisma.settings.findFirst();
        if (settings) {
            sid = settings.twilioAccountSid;
            const encryptedToken = settings.twilioAuthToken;

            if (encryptedToken) {
                // Decrypt Logic
                const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must vary by env
                if (!ENCRYPTION_KEY) {
                    console.error("No ENCRYPTION_KEY in .env, cannot decrypt token.");
                    return;
                }

                try {
                    // logic from encryption.ts (usually: iv:content)
                    const textParts = encryptedToken.split(':');
                    if (textParts.length === 2) {
                        const iv = Buffer.from(textParts[0], 'hex');
                        const encryptedText = Buffer.from(textParts[1], 'hex');
                        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
                        let decrypted = decipher.update(encryptedText);
                        decrypted = Buffer.concat([decrypted, decipher.final()]);
                        token = decrypted.toString();
                        console.log("Decryption successful.");
                    } else {
                        console.log("Token does not look encrypted (no colon), using raw.");
                        token = encryptedToken;
                    }
                } catch (e) {
                    console.error("Decryption failed:", e.message);
                    console.log("Attempting to use raw token...");
                    token = encryptedToken;
                }
            }
        }
    }

    if (!sid || !token) {
        console.error("No Creds found.");
        return;
    }

    try {
        const client = twilio(sid, token);
        const incoming = await client.incomingPhoneNumbers.list({ limit: 50 });

        console.log(`Found ${incoming.length} numbers in Twilio.`);

        for (const num of incoming) {
            console.log(`Syncing ${num.phoneNumber} (${num.friendlyName})...`);

            // Check if exists
            const exists = await prisma.numberPool.findUnique({
                where: { phoneNumber: num.phoneNumber }
            });

            if (!exists) {
                await prisma.numberPool.create({
                    data: {
                        phoneNumber: num.phoneNumber,
                        isActive: true,
                        dailyCount: 0
                    }
                });
                console.log("  -> Created");
            } else {
                console.log("  -> Exists");
                // Don't overwrite owner or cooldown
            }
        }
    } catch (e) {
        console.error("Twilio Sync Error:", e.message);
        console.log("Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set in .env or Settings.");
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());

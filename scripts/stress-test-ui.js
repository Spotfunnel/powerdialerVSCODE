const Twilio = require('twilio');
const { Client } = require('pg');
const crypto = require("crypto");
require('dotenv').config();

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

// Decryption Logic
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error("ENCRYPTION_KEY environment variable is required");
    return crypto.createHash('sha256').update(key).digest();
}

function decrypt(encryptedData) {
    if (!encryptedData || encryptedData.length < 32) return encryptedData;
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
        console.warn("Decryption failed:", e.message);
        return encryptedData;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const dbClient = new Client({ connectionString });
    try {
        await dbClient.connect();

        // 1. Fetch Credentials & User ID
        const settingsRes = await dbClient.query('SELECT "twilioAccountSid", "twilioAuthToken" FROM "Settings" LIMIT 1');
        const settings = settingsRes.rows[0];

        const userRes = await dbClient.query(`SELECT id FROM "User" WHERE email = 'leo@getspotfunnel.com'`);
        if (userRes.rows.length === 0) throw new Error("User not found");
        const userId = userRes.rows[0].id;

        let accountSid = settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
        let authToken = settings?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;

        if (settings?.twilioAuthToken) {
            authToken = decrypt(settings.twilioAuthToken);
        }

        const client = new Twilio(accountSid, authToken);
        const from = '+61485028377';
        const to = `client:${userId}`;

        console.log(`Starting UI Stress Test on Identity: ${userId}`);
        console.log("I will send 3 calls. Answer each one.");

        for (let i = 1; i <= 3; i++) {
            console.log(`\n--- CALL ${i}/3 ---`);
            const call = await client.calls.create({
                from: from,
                to: to,
                url: 'https://demo.twilio.com/docs/voice.xml',
            });
            console.log(`Ringing... (SID: ${call.sid})`);

            // Allow 10 seconds to answer and talk
            await sleep(10000);

            console.log("Hanging up...");
            await client.calls(call.sid).update({ status: 'completed' });

            // Brief pause before next call
            await sleep(3000);
        }

        console.log("\nStress Test Complete.");

    } catch (e) {
        console.error(e);
    } finally {
        await dbClient.end();
    }
}

main();

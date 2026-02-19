const Twilio = require('twilio');
const { Client } = require('pg');
const crypto = require("crypto");
require('dotenv').config();

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
const TARGET_NUMBER = '+61485037510';

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
        console.warn("Decryption failed or not needed:", e.message);
        return encryptedData;
    }
}

async function main() {
    const dbClient = new Client({ connectionString });
    try {
        await dbClient.connect();

        // 1. Fetch Credentials from DB Settings via PG
        const res = await dbClient.query('SELECT "twilioAccountSid", "twilioAuthToken" FROM "Settings" LIMIT 1');
        const settings = res.rows[0];

        let accountSid = settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
        let authToken = settings?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;

        // Decrypt
        if (settings?.twilioAuthToken) {
            authToken = decrypt(settings.twilioAuthToken);
        }

        if (!accountSid || !authToken) {
            console.error("Missing Twilio Credentials.");
            return;
        }

        const client = new Twilio(accountSid, authToken);

        console.log(`Searching for SID of ${TARGET_NUMBER}...`);
        const incomingNumbers = await client.incomingPhoneNumbers.list({
            phoneNumber: TARGET_NUMBER
        });

        if (incomingNumbers.length === 0) {
            console.error("Number not found in Twilio account.");
            return;
        }

        const sid = incomingNumbers[0].sid;
        console.log(`Found SID: ${sid}`);
        console.log(`Current VoiceURL: ${incomingNumbers[0].voiceUrl}`);

        console.log("Removing VoiceURL (Making it 'Dumb')...");

        await client.incomingPhoneNumbers(sid).update({
            voiceUrl: 'http://demo.twilio.com/docs/voice.xml',
            voiceMethod: 'GET'
        });

        console.log("SUCCESS: Number is now 'External' (points to demo XML).");

    } catch (e) {
        console.error(e);
    } finally {
        await dbClient.end();
    }
}

main();

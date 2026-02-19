const { Client } = require('pg');
const crypto = require('crypto');
const twilio = require('twilio');

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = "my-super-secret-dialer-key-2024-secure";

function getEncryptionKey() {
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

function decrypt(text) {
    if (!text) return text;
    try {
        const data = Buffer.from(text, "base64");
        const iv = data.slice(0, 12);
        const tag = data.slice(12, 28);
        const encrypted = data.slice(28);
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (e) {
        return null;
    }
}

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const sRes = await client.query('SELECT * FROM "Settings" WHERE id = \'singleton\'');
        const sid = sRes.rows[0].twilioAccountSid;
        const token = decrypt(sRes.rows[0].twilioAuthToken);
        const tw = twilio(sid, token);

        const target = '+61489088403';
        console.log(`Checking if ${target} exists in Twilio...`);

        const numbers = await tw.incomingPhoneNumbers.list({ phoneNumber: target });

        if (numbers.length > 0) {
            const num = numbers[0];
            console.log('--- FOUND ---');
            console.log('Sid:', num.sid);
            console.log('Friendly:', num.friendlyName);
            console.log('VoiceUrl:', num.voiceUrl);
            console.log('VoiceMethod:', num.voiceMethod);
        } else {
            console.log('--- NOT FOUND ---');
            console.log('This number is NOT a Twilio Incoming Number!');
            console.log('It cannot receive API calls via webhook.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

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

        // 1. Get Settings
        const sRes = await client.query('SELECT * FROM "Settings" WHERE id = \'singleton\'');
        const settings = sRes.rows[0];
        const sid = settings.twilioAccountSid;
        const token = decrypt(settings.twilioAuthToken);
        const baseUrl = settings.webhookBaseUrl || "";
        const expectedUrl = `${baseUrl}/api/twilio/inbound`.replace(/\/+$/, "");

        console.log('--- AUDIT DEBUG ---');
        console.log('Base URL (DB):', baseUrl);
        console.log('Expected URL:', expectedUrl);

        // 2. Fetch from Twilio
        const tw = twilio(sid, token);
        const incoming = await tw.incomingPhoneNumbers.list();

        console.log('--- TWILIO ACTUAL CONFIG ---');
        incoming.forEach(n => {
            const actualUrl = (n.voiceUrl || "").replace(/\/+$/, "");
            const match = actualUrl === expectedUrl;
            console.log(`${n.phoneNumber}: ${actualUrl} | MATCH: ${match}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

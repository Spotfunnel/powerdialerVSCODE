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
        return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
    } catch (e) { return null; }
}

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sRes = await client.query('SELECT * FROM "Settings" WHERE id = \'singleton\'');
        const sid = sRes.rows[0].twilioAccountSid;
        const token = decrypt(sRes.rows[0].twilioAuthToken);
        const tw = twilio(sid, token);

        console.log('Fetching last 10 calls...');
        const calls = await tw.calls.list({ limit: 10 });

        for (const c of calls) {
            console.log(`\nSID: ${c.sid}`);
            console.log(`From: ${c.from} -> To: ${c.to}`);
            console.log(`Status: ${c.status}`);
            console.log(`Duration: ${c.duration}s`);
            console.log(`Date: ${c.dateCreated}`);
            if (c.errorMessage) console.log(`Error: ${c.errorMessage} (${c.errorCode})`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

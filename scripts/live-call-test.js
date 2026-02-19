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

        // 1. Get Credentials
        const res = await client.query('SELECT "twilioAccountSid", "twilioAuthToken" FROM "Settings" WHERE id = \'singleton\'');
        const row = res.rows[0];
        const sid = row.twilioAccountSid;
        const token = decrypt(row.twilioAuthToken);

        if (!sid || !token) {
            console.log("CRITICAL: Missing Sid or Token");
            return;
        }

        const tw = twilio(sid, token);

        // 2. Target Numbers
        const from = '+61485028377'; // Non-Leo pool number
        const to = '+61489088403';   // Leo's number

        console.log(`Initiating call from ${from} to ${to}...`);
        const call = await tw.calls.create({
            from: from,
            to: to,
            url: 'http://demo.twilio.com/docs/voice.xml'
        });

        console.log('Call SID initiated:', call.sid);

        // 3. Wait for Webhook Hit
        console.log('Waiting 10 seconds for webhook hit and log persistence...');
        await new Promise(r => setTimeout(r, 10000));

        // 4. Verify TwilioLog
        const logRes = await client.query('SELECT * FROM "TwilioLog" WHERE "toNumber" = $1 ORDER BY timestamp DESC LIMIT 1', [to]);

        if (logRes.rows.length > 0) {
            const lastLog = logRes.rows[0];
            console.log('--- TEST SUCCESS: LOG FOUND ---');
            console.log('Timestamp:', lastLog.timestamp);
            console.log('TwiML Response snippet:', lastLog.twimlContent?.slice(0, 300));
        } else {
            console.log('FAILED: No log entry found in TwilioLog table.');
        }

    } catch (err) {
        console.error('SCRIPT ERROR:', err);
    } finally {
        await client.end();
    }
}
main();

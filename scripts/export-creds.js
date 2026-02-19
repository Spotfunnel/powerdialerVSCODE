const { Client } = require('pg');
const crypto = require('crypto');

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
        const res = await client.query('SELECT "twilioAccountSid", "twilioAuthToken" FROM "Settings" WHERE id = \'singleton\'');
        const row = res.rows[0];
        const sid = row.twilioAccountSid;
        const token = decrypt(row.twilioAuthToken);

        console.log('--- CREDENTIAL EXPORT ---');
        console.log('SID:', sid);
        console.log('TOKEN:', token);

        const nums = await client.query('SELECT "phoneNumber" FROM "NumberPool" WHERE "isActive" = true LIMIT 2');
        console.log('NUMS:', nums.rows.map(r => r.phoneNumber));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
main();

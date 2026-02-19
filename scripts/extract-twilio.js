const { Client } = require('pg');
const crypto = require('crypto');

async function main() {
    const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
    const encryptionKey = "my-super-secret-dialer-key-2024-secure";

    const client = new Client({ connectionString });

    try {
        await client.connect();
        const res = await client.query('SELECT "twilioAccountSid", "twilioAuthToken", "webhookBaseUrl" FROM "Settings" WHERE id = \'singleton\'');
        const settings = res.rows[0];

        if (settings) {
            console.log('ACCOUNT_SID=' + settings.twilioAccountSid);
            console.log('WEBHOOK_BASE_URL=' + settings.webhookBaseUrl);

            // Decrypt token
            const encryptedData = settings.twilioAuthToken;
            const key = crypto.createHash('sha256').update(encryptionKey).digest();
            const buffer = Buffer.from(encryptedData, 'base64');
            const hex = buffer.toString('hex');
            const iv = Buffer.from(hex.slice(0, 24), 'hex');
            const tag = Buffer.from(hex.slice(24, 56), 'hex');
            const encrypted = hex.slice(56);

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            console.log('AUTH_TOKEN=' + decrypted);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();

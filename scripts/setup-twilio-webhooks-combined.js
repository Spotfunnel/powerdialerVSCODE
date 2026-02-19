const { Client } = require('pg');
const crypto = require('crypto');
const twilio = require('twilio');

async function main() {
    console.log("--- Combining Extraction and Twilio Setup ---");
    const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
    const encryptionKey = "my-super-secret-dialer-key-2024-secure";

    const clientDB = new Client({ connectionString });

    try {
        await clientDB.connect();
        const res = await clientDB.query('SELECT "twilioAccountSid", "twilioAuthToken", "webhookBaseUrl" FROM "Settings" WHERE id = \'singleton\'');
        const settings = res.rows[0];

        if (!settings) throw new Error("Settings not found");

        const accountSid = settings.twilioAccountSid;
        const webhookBaseUrl = (settings.webhookBaseUrl || "").trim();

        if (!webhookBaseUrl) throw new Error("Webhook Base URL not set");

        console.log(`Using Base URL: ${webhookBaseUrl}`);

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
        let authToken = decipher.update(encrypted, 'hex', 'utf8');
        authToken += decipher.final('utf8');

        console.log(`Connecting to Twilio: ${accountSid}`);
        const twilioClient = twilio(accountSid, authToken);

        const numbers = await twilioClient.incomingPhoneNumbers.list();
        console.log(`Found ${numbers.length} numbers.`);

        for (const num of numbers) {
            console.log(`Updating ${num.phoneNumber} (${num.sid})...`);
            await twilioClient.incomingPhoneNumbers(num.sid).update({
                smsUrl: `${webhookBaseUrl}/api/twilio/sms/inbound`,
                smsMethod: 'POST',
                statusCallback: `${webhookBaseUrl}/api/twilio/sms/status`,
                statusCallbackMethod: 'POST'
            });
            console.log(`✅ ${num.phoneNumber} updated.`);
        }

        console.log("--- Setup Complete ---");

    } catch (err) {
        console.error("❌ Error during combined setup:", err);
    } finally {
        await clientDB.end();
    }
}

main();

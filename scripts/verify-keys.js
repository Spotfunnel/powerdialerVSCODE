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
    if (!key) throw new Error("ENCRYPTION_KEY required");
    return crypto.createHash('sha256').update(key).digest();
}

function decrypt(encryptedData) {
    try {
        const buffer = Buffer.from(encryptedData, "base64");
        const hex = buffer.toString("hex");

        if (hex.length < (IV_LENGTH + TAG_LENGTH) * 2) return null; // Too short to be encrypted

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
        return null;
    }
}

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const res = await client.query('SELECT * FROM "Settings" WHERE id = \'singleton\'');
        if (res.rows.length === 0) {
            console.error("No Settings.");
            return;
        }
        const s = res.rows[0];

        const apiKey = s.twilioApiKey;
        const apiSecret = s.twilioApiSecret;

        console.log("Raw ApiKey:", apiKey);
        console.log("Raw ApiSecret:", apiSecret);

        const decKey = decrypt(apiKey);
        const decSecret = decrypt(apiSecret);

        console.log("Decrypted ApiKey:", decKey || "Failed/Not Encrypted");
        console.log("Decrypted ApiSecret:", decSecret || "Failed/Not Encrypted");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

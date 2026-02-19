const Twilio = require('twilio');
const { Client } = require('pg');
const crypto = require("crypto");
require('dotenv').config();

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

// Decryption Logic (Standardized)
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

        // 1. Get Credentials & User
        const settingsRes = await dbClient.query('SELECT "twilioAccountSid", "twilioAuthToken" FROM "Settings" LIMIT 1');
        const userRes = await dbClient.query(`SELECT id FROM "User" WHERE email = 'leo@getspotfunnel.com'`);

        if (userRes.rows.length === 0) throw new Error("User not found");
        const userId = userRes.rows[0].id;
        const settings = settingsRes.rows[0];

        let accountSid = settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
        let authToken = settings?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
        if (settings?.twilioAuthToken) authToken = decrypt(settings.twilioAuthToken);

        const client = new Twilio(accountSid, authToken);
        const to = `client:${userId}`; // Direct to browser

        console.log(`\n=== FINAL DEEP STRESS TEST ===`);
        console.log(`Target: ${userId}`);
        console.log(`Mode: Direct Client Injection (Bypassing Loop Protection)\n`);

        // TEST 1: KNOWN CALLER (Simulated)
        // Note: Direct client calls don't natively hit the Inbound Webhook logic unless routed via TwiML.
        // But for this UI test, we can only verify connection stability and UI reaction.
        // We will simulate the "Params" by passing them (if Twilio API supports it) or just test connection.
        // Actually, for pure client dialing, we can't inject custom params easily without TwiML.
        // So this test primarily validates:
        // 1. CONNECTION STABILITY (Can we hammer it?)
        // 2. UI HANDLING (Does it crash?)

        console.log("--> SCENARIO 1: The 'Long Ring' (Stability)");
        const call1 = await client.calls.create({
            from: '+61489088403', // Use Real Number as Caller ID
            to: to,
            url: 'https://demo.twilio.com/docs/voice.xml',
            timeout: 20
        });
        console.log(`   Ringing... (SID: ${call1.sid})`);
        console.log("   ACTION: Please ANSWER this call and speak for 5 seconds.");
        await sleep(15000);

        // TEST 2: GHOST CALL (State Management)
        console.log("\n--> SCENARIO 2: The 'Ghost Call' (UI Cleanup)");
        console.log("   I will ring you, then hang up immediately.");
        console.log("   ACTION: Don't touch anything. Watch the UI disappear.");

        const call2 = await client.calls.create({
            from: '+61412345678', // Random number
            to: to,
            url: 'https://demo.twilio.com/docs/voice.xml',
        });
        console.log(`   Ringing... (SID: ${call2.sid})`);
        await sleep(4000); // Ring for 4s
        console.log("   Hanging up remotely...");
        await client.calls(call2.sid).update({ status: 'completed' });

        // TEST 3: BACK-TO-BACK HAMMER (Race Conditions)
        console.log("\n--> SCENARIO 3: The 'Hammer' (Race Conditions)");
        console.log("   Sending 2 calls almost instantly.");
        console.log("   ACTION: Try to answer the first one.");

        const call3 = await client.calls.create({ from: '+61111111111', to: to, url: 'https://demo.twilio.com/docs/voice.xml' });
        console.log(`   Call A Sent (${call3.sid})`);
        await sleep(1000);
        const call4 = await client.calls.create({ from: '+61222222222', to: to, url: 'https://demo.twilio.com/docs/voice.xml' });
        console.log(`   Call B Sent (${call4.sid})`);

        await sleep(5000);
        console.log("\n--- TEST COMPLETE ---");
        console.log("Clearing active calls...");
        try { await client.calls(call3.sid).update({ status: 'completed' }); } catch (e) { }
        try { await client.calls(call4.sid).update({ status: 'completed' }); } catch (e) { }

    } catch (e) {
        console.error(e);
    } finally {
        await dbClient.end();
    }
}

main();

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const twilio = require('twilio');
const prisma = new PrismaClient();

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
        console.error("Decryption failed:", e.message);
        return text;
    }
}

async function testCall() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        const sid = settings.twilioAccountSid;
        const token = decrypt(settings.twilioAuthToken);
        const client = twilio(sid, token);

        const from = '+61468073873'; // Number A
        const to = '+61489088403';   // Number B (Leo's number)

        console.log(`Starting test call from ${from} to ${to}...`);

        const call = await client.calls.create({
            from: from,
            to: to,
            url: 'http://demo.twilio.com/docs/voice.xml', // Just a dummy URL for the "caller" side
            // The magic happens when +61489088403 receives the call.
        });

        console.log('Call SID:', call.sid);
        console.log('Test call initiated. Checking logs in 5 seconds...');

        await new Promise(r => setTimeout(r, 5000));

        const logs = await prisma.twilioLog.findMany({
            where: { toNumber: to },
            orderBy: { timestamp: 'desc' },
            take: 1
        });

        console.log('--- LATEST INBOUND EVIDENCE ---');
        console.log(JSON.stringify(logs, null, 2));

    } catch (e) {
        console.error('TEST FAILED:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testCall();

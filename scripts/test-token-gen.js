const { PrismaClient } = require('@prisma/client');
const Twilio = require('twilio');
const crypto = require('crypto');

// Copy decrypt logic since we can't easily import it here in a raw script
function decrypt(encryptedData, encryptionKey) {
    try {
        const buffer = Buffer.from(encryptedData, "base64");
        const hex = buffer.toString("hex");

        const iv = Buffer.from(hex.slice(0, 12 * 2), "hex");
        const tag = Buffer.from(hex.slice(12 * 2, (12 + 16) * 2), "hex");
        const encrypted = hex.slice((12 + 16) * 2);

        const key = crypto.createHash('sha256').update(encryptionKey).digest();
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (e) {
        return "DECRYPT_FAILED: " + e.message;
    }
}

const prisma = new PrismaClient();

async function main() {
    console.log("--- START TOKEN TEST ---");
    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (!settings) {
            console.log("Settings not found");
            return;
        }

        const accountSid = settings.twilioAccountSid;
        let apiKey = settings.twilioApiKey;
        let apiSecret = settings.twilioApiSecret;
        const appSid = settings.twilioAppSid;

        console.log("Account SID:", accountSid);
        console.log("App SID:", appSid);

        const encKey = process.env.ENCRYPTION_KEY;
        if (apiKey && apiKey.length > 50) apiKey = decrypt(apiKey, encKey);
        if (apiSecret && apiSecret.length > 50) apiSecret = decrypt(apiSecret, encKey);

        console.log("API Key Start:", apiKey?.substring(0, 5));

        const AccessToken = Twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        const token = new AccessToken(
            accountSid,
            apiKey,
            apiSecret,
            { identity: 'test-user' }
        );

        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: appSid,
            incomingAllow: true,
        });

        token.addGrant(voiceGrant);
        const jwt = token.toJwt();
        console.log("JWT Generated Successfully (Length: " + jwt.length + ")");

    } catch (err) {
        console.error("Token Generation Failed:", err);
    }
    console.log("--- END TOKEN TEST ---");
}

main().finally(() => prisma.$disconnect());

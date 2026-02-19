const { Client } = require('pg');
const Twilio = require('twilio');
require('dotenv').config();

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const res = await client.query('SELECT * FROM "Settings" WHERE id = \'singleton\'');
        const s = res.rows[0];

        const accountSid = s.twilioAccountSid;
        const apiKey = s.twilioApiKey;
        const apiSecret = s.twilioApiSecret;
        const appSid = s.twilioAppSid;
        const identity = 'leo_test_1';

        console.log("Generating Token with:");
        console.log("AccountSid:", accountSid);
        console.log("ApiKey:", apiKey);
        console.log("ApiSecret:", apiSecret);
        console.log("AppSid:", appSid);

        try {
            const AccessToken = Twilio.jwt.AccessToken;
            const VoiceGrant = AccessToken.VoiceGrant;

            const token = new AccessToken(
                accountSid,
                apiKey,
                apiSecret,
                { identity: identity }
            );

            const voiceGrant = new VoiceGrant({
                outgoingApplicationSid: appSid,
                incomingAllow: true,
            });

            token.addGrant(voiceGrant);

            console.log("SUCCESS! Token Generated:");
            console.log(token.toJwt());

        } catch (err) {
            console.error("GENERATION FAILED:", err);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

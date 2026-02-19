const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');

const prisma = new PrismaClient();

async function main() {
    console.log("--- LIVE Twilio Verification ---");
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

    if (!settings) {
        console.error("❌ DB Settings: Not Found");
        return;
    }

    const sid = settings.twilioAccountSid;
    const token = settings.twilioAuthToken;
    const from = settings.twilioFromNumbers;

    console.log(`\n1. Credential Inspection:`);
    console.log(`   SID:   '${sid}' (Length: ${sid.length})`);
    console.log(`   Token: '${token ? token.substring(0, 5) + "..." + token.substring(token.length - 5) : 'MISSING'}' (Length: ${token ? token.length : 0})`);
    console.log(`   From:  '${from}'`);

    // Check for whitespace
    if (sid.trim() !== sid) console.warn("   ⚠️ WARNING: SID has leading/trailing whitespace!");
    if (token.trim() !== token) console.warn("   ⚠️ WARNING: Token has leading/trailing whitespace!");

    // Explicitly trim just in case logic needs it (but we want to debug the DB value)
    const client = twilio(sid.trim(), token.trim());

    console.log(`\n2. Testing Authentication (Fetching Account Details)...`);
    try {
        const account = await client.api.v2010.accounts(sid.trim()).fetch();
        console.log(`   ✅ Authentication Successful!`);
        console.log(`   - Account Status: ${account.status}`);
        console.log(`   - Friendly Name: ${account.friendlyName}`);
        console.log(`   - Type: ${account.type}`);
    } catch (e) {
        console.error(`   ❌ Authentication FAILED:`);
        console.error(`      Code: ${e.code}`);
        console.error(`      Status: ${e.status}`);
        console.error(`      Message: ${e.message}`);
        console.error(`      More Info: ${e.moreInfo}`);
        return;
    }

    console.log(`\n3. Testing SMS to 0478737917 (Normalizing to +61478737917)...`);
    try {
        const msg = await client.messages.create({
            to: '+61478737917',
            from: from.split(',')[0].trim(),
            body: 'SpotFunnel Live Auth Test'
        });
        console.log(`   ✅ SMS Sent! SID: ${msg.sid}`);
    } catch (e) {
        console.error(`   ❌ SMS Failed:`);
        console.error(`      Code: ${e.code}`);
        console.error(`      Message: ${e.message}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

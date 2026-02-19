const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');
const fs = require('fs');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
        }
    }
});

async function main() {
    const result = {
        credentials_in_db: false,
        sid: { value: null, length: 0, has_whitespace: false, valid_prefix: false },
        token: { value: null, length: 0, has_whitespace: false },
        api_test: { success: false, error_code: null, error_msg: null }
    };

    try {
        const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
        if (settings) {
            result.credentials_in_db = true;

            const sid = settings.twilioAccountSid || "";
            const token = settings.twilioAuthToken || "";

            result.sid.value = sid;
            result.sid.length = sid.length;
            result.sid.has_whitespace = sid.trim() !== sid;
            result.sid.valid_prefix = sid.startsWith("AC");

            result.token.value = token ? (token.substring(0, 4) + "..." + token.substring(token.length - 4)) : null;
            result.token.length = token ? token.length : 0;
            result.token.has_whitespace = token.trim() !== token;

            // TEST 1: RAW AUTH
            if (sid && token) {
                try {
                    const client = twilio(sid.trim(), token.trim());
                    await client.api.v2010.accounts(sid.trim()).fetch();
                    result.api_test.success = true;
                } catch (e) {
                    result.api_test.success = false;
                    result.api_test.error_code = e.code;
                    result.api_test.status = e.status;
                    result.api_test.error_msg = e.message;
                }
            }
        }
    } catch (err) {
        result.system_error = err.message;
    } finally {
        await prisma.$disconnect();
        fs.writeFileSync('verification_result.json', JSON.stringify(result, null, 2));
    }
}

main();

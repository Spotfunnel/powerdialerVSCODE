const { Client } = require('pg');
const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        await client.query('UPDATE "Settings" SET "webhookBaseUrl" = \'https://www.getspotfunnel.com\' WHERE id = \'singleton\'');
        console.log('SUCCESS: Updated webhookBaseUrl to https://www.getspotfunnel.com');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

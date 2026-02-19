const { Client } = require('pg');
const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query('SELECT count(*) FROM "TwilioLog"');
        console.log('Total Logs:', res.rows[0].count);

        const latest = await client.query('SELECT * FROM "TwilioLog" ORDER BY timestamp DESC LIMIT 5');
        console.log('Latest 5 Logs:', JSON.stringify(latest.rows, null, 2));

        const calls = await client.query('SELECT * FROM "Call" ORDER BY "createdAt" DESC LIMIT 5');
        console.log('Latest 5 Calls:', JSON.stringify(calls.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

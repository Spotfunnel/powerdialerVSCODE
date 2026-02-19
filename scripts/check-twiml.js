const { Client } = require('pg');

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Checking recent TWILIO LOGS (TwiML Debug)...');
        const res = await client.query(`
            SELECT id, "twimlContent", "fromNumber", "toNumber", "timestamp"
            FROM "TwilioLog"
            ORDER BY "timestamp" DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No logs found.');
        } else {
            const row = res.rows[0];
            console.log("---------------------------------------------------");
            console.log(`Call to: ${row.toNumber} | From: ${row.fromNumber}`);
            console.log("TWIML CONTENT:");
            console.log(row.twimlContent);
            console.log("---------------------------------------------------");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

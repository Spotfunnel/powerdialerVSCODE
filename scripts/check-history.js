const { Client } = require('pg');

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Checking recent CALL records (History)...');
        // Get last 5 calls
        const res = await client.query(`
            SELECT id, "fromNumber", "toNumber", status, "userId", "leadId", "createdAt" 
            FROM "Call" 
            ORDER BY "createdAt" DESC 
            LIMIT 5
        `);

        if (res.rows.length === 0) {
            console.log('No calls found in History.');
        } else {
            console.table(res.rows);
        }

        console.log('\nChecking recent LEADS...');
        const lRes = await client.query(`
            SELECT id, "firstName", "lastName", "phoneNumber", "createdAt"
            FROM "Lead"
            ORDER BY "createdAt" DESC
            LIMIT 3
        `);
        console.table(lRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

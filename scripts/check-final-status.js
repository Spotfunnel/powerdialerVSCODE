
const { Client } = require('pg');

async function checkFinal() {
    const client = new Client({
        connectionString: "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
    });

    try {
        await client.connect();
        const res = await client.query('SELECT status, COUNT(*) FROM "Lead" GROUP BY status');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkFinal();

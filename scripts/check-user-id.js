const { Client } = require('pg');
require('dotenv').config();

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log('Fetching User ID for leo@getspotfunnel.com...');
        const res = await client.query(`
            SELECT id, email, "lastSeenAt"
            FROM "User"
            WHERE email = 'leo@getspotfunnel.com'
        `);

        if (res.rows.length === 0) {
            console.error('No user found.');
        } else {
            console.error("\n=== USER ID START ===");
            console.error(res.rows[0].id);
            console.error("=== USER ID END ===\n");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

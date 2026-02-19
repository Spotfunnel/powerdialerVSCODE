const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
    });

    try {
        await client.connect();
        console.log('--- EXECUTING EMERGENCY MIGRATION ---');

        await client.query(`
            ALTER TABLE "CalendarConnection" 
            ADD COLUMN IF NOT EXISTS "senderName" TEXT,
            ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;
        `);

        console.log('SUCCESS: Columns added (if not existed).');

        const res = await client.query('SELECT * FROM "CalendarConnection" LIMIT 1');
        console.log('Verification (First Row):', res.rows[0]);
    } finally {
        await client.end();
    }
}

main();

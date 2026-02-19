const { Client } = require('pg');

const connectionString = "postgresql://postgres:Walkergewert01@lxsxwrunbmoiayhtexiz.supabase.co:5432/postgres";

async function test() {
    console.log("Testing direct connection to lxsxwrunbmoiayhtexiz.supabase.co:5432...");
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("✅ SUCCESS: Direct connection established!");
        const res = await client.query('SELECT count(*) from "User"');
        console.log("User count:", res.rows[0].count);
        await client.end();
    } catch (err) {
        console.error("❌ FAILED: Could not connect directly.");
        console.error(err.message);
        process.exit(1);
    }
}

test();

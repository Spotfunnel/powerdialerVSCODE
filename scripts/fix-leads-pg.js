
const { Client } = require('pg');

async function fixLeads() {
    // Using the connection string from audit_db.js
    const client = new Client({
        connectionString: "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
    });

    try {
        await client.connect();
        console.log("Connected to DB via pg...");

        // Check counts
        console.log("Checking status distribution...");
        const res = await client.query('SELECT status, COUNT(*) FROM "Lead" GROUP BY status');
        console.table(res.rows);

        // Update NEW
        const updateNew = await client.query("UPDATE \"Lead\" SET status = 'READY' WHERE status = 'NEW'");
        console.log(`Updated ${updateNew.rowCount} leads from NEW to READY`);

        // Update NEW_LEAD
        const updateNewLead = await client.query("UPDATE \"Lead\" SET status = 'READY' WHERE status = 'NEW_LEAD'");
        console.log(`Updated ${updateNewLead.rowCount} leads from NEW_LEAD to READY`);

        // Check final counts
        const resFinal = await client.query('SELECT status, COUNT(*) FROM "Lead" GROUP BY status');
        console.table(resFinal.rows);

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

fixLeads();

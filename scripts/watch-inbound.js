const { Client } = require('pg');

const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("👀 Watching for NEW inbound calls... (Ctrl+C to stop)");

        let lastId = null;

        while (true) {
            const res = await client.query(`
                SELECT id, "fromNumber",  "status", "createdAt" 
                FROM "Call" 
                WHERE "direction" = 'INBOUND'
                ORDER BY "createdAt" DESC 
                LIMIT 1
            `);

            if (res.rows.length > 0) {
                const call = res.rows[0];
                if (lastId && call.id !== lastId) {
                    console.log(`\n🔔 NEW CALL DETECTED! [${new Date().toLocaleTimeString()}]`);
                    console.log(`   From: ${call.fromNumber}`);
                    console.log(`   Status: ${call.status}`);
                }
                lastId = call.id;
            }

            // Wait 2s
            await new Promise(r => setTimeout(r, 2000));
            process.stdout.write("."); // heartbeat
        }

    } catch (e) {
        console.error(e);
        await client.end();
    }
}
main();

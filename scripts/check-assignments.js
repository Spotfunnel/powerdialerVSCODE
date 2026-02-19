const { Client } = require('pg');
const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        console.log("--- LEO'S IDENTITY ---");
        const leoResult = await client.query('SELECT id, email, "lastSeenAt" FROM "User" WHERE email = \'leo@getspotfunnel.com\'');
        const leo = leoResult.rows[0];
        if (leo) {
            const isOnline = leo.lastSeenAt && (new Date().getTime() - new Date(leo.lastSeenAt).getTime() < 120000);
            console.log(`[${leo.id}] ${leo.email} - ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

            console.log("\n--- LEO'S NUMBERS ---");
            const leoNums = await client.query('SELECT "phoneNumber" FROM "NumberPool" WHERE "ownerUserId" = $1', [leo.id]);
            leoNums.rows.forEach(n => console.log(n.phoneNumber));
        } else {
            console.log("Leo not found.");
        }

        console.log("\n--- OTHER POOL NUMBERS (FOR CALLER) ---");
        const otherNums = await client.query('SELECT "phoneNumber" FROM "NumberPool" WHERE "ownerUserId" IS NULL OR "ownerUserId" != $1 LIMIT 3', [leo?.id || 'none']);
        otherNums.rows.forEach(n => console.log(n.phoneNumber));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

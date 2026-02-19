const { Client } = require('pg');
const connectionString = "postgresql://postgres.lxsxwrunbmoiayhtexiz:Walkergewert01@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const res = await client.query('SELECT np."phoneNumber", u.email as owner, u."lastSeenAt" FROM "NumberPool" np LEFT JOIN "User" u ON np."ownerUserId" = u.id');
        const fs = require('fs');
        fs.writeFileSync('scripts/list-all.json', JSON.stringify(res.rows, null, 2), 'utf8');
        console.log('Done writing to scripts/list-all.json');

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();

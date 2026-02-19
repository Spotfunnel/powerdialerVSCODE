
const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
    console.log('Testing connection to:', process.env.POSTGRES_URL_NON_POOLING);
    const client = new Client({
        connectionString: process.env.POSTGRES_URL_NON_POOLING,
    });

    try {
        await client.connect();
        console.log('Connected successfully');
        const res = await client.query('SELECT count(*) FROM "LeadActivity"');
        console.log('Count:', res.rows[0].count);
        await client.end();
    } catch (err) {
        console.error('Connection error:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

testConnection();

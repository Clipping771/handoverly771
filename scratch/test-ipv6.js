const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: '2406:da14:311:1501:7634:d3f9:9515:a661',
    port: 5432,
    user: 'postgres',
    password: 'Bcsbcsmba279',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully via direct IPv6!');
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
  } catch (err) {
    console.error('Failed to connect via direct IPv6:', err.message);
  } finally {
    await client.end();
  }
}

run();

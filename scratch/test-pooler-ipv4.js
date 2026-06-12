const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543, // session pooler
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully via Supabase Pooler IPv4!');
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
  } catch (err) {
    console.error('Failed to connect via Supabase Pooler IPv4:', err.message);
  } finally {
    await client.end();
  }
}

run();

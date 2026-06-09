const { Client } = require('pg');

async function clearDb() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query("UPDATE facilities SET ai_config = '{}'::jsonb");
  console.log('Cleared');
  await client.end();
}

clearDb().catch(console.error);

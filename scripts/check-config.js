const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const res = await client.query("SELECT ai_config FROM facilities LIMIT 1");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

checkDb().catch(console.error);

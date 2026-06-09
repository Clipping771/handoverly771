const { Client } = require('pg');

async function checkRoles() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const res = await client.query("SELECT * FROM roles LIMIT 10");
  console.table(res.rows);
  await client.end();
}

checkRoles().catch(console.error);

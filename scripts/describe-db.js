const { Client } = require('pg');

async function describeDb() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  
  const res1 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks'");
  console.log('--- TASKS ---');
  console.table(res1.rows);
  
  const res2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'residents'");
  console.log('\n--- RESIDENTS ---');
  console.table(res2.rows);

  await client.end();
}

describeDb().catch(console.error);

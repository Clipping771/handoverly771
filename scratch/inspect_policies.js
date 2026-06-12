const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres:Bcsbcsmba279@db.rqbkoryrlkglgsnqonvf.supabase.co:5432/postgres"
});

async function run() {
  await client.connect();
  const res = await client.query("select * from pg_policies where tablename = 'tasks';");
  console.log('Tasks Table Policies:');
  console.log(res.rows);
  
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public';");
  console.log('\nAll public tables:');
  console.log(tables.rows.map(r => r.tablename));

  await client.end();
}

run().catch(console.error);

const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres:Bcsbcsmba279@db.rqbkoryrlkglgsnqonvf.supabase.co:5432/postgres"
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks';");
  console.log(res.rows);
  await client.end();
}

run().catch(console.error);

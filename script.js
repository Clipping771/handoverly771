const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.match(/DATABASE_URL=(.*)/)[1].trim();
const { Client } = require('pg');
const client = new Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  try {
    await client.query('CREATE POLICY "Enable delete for authenticated users" ON public.handovers FOR DELETE TO authenticated USING (true);');
    console.log('Policy added');
  } catch (err) {
    console.log(err.message);
  }
  await client.end();
}
run();

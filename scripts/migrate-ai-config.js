const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  
  try {
    await client.query("ALTER TABLE facilities ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}'::jsonb;");
    console.log("Successfully added ai_config to facilities.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

migrate();

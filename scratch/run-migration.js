const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Altering table to add status_reason to residents...');
    await client.query(`
      ALTER TABLE public.residents 
      ADD COLUMN IF NOT EXISTS status_reason text;
    `);
    console.log('Migration complete! status_reason column added to public.residents.');
  } catch (err) {
    console.error('Migration execution failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();

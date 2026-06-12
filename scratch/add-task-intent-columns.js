const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.rqbkoryrlkglgsnqonvf',
  password: 'Bcsbcsmba279@',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    console.log('Altering tasks table to add clinical_purpose and outcome columns...');
    await client.query(`
      ALTER TABLE public.tasks 
      ADD COLUMN IF NOT EXISTS clinical_purpose TEXT,
      ADD COLUMN IF NOT EXISTS outcome TEXT;
    `);
    console.log('Success! Columns added.');
  } catch (err) {
    console.error('Failed to alter table:', err);
  } finally {
    await client.end();
  }
}

run();

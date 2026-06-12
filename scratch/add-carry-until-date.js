const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

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
    console.log('Altering tasks table to add carry_until_date column...');
    await client.query(`
      ALTER TABLE public.tasks 
      ADD COLUMN IF NOT EXISTS carry_until_date DATE;
    `);
    console.log('Success! Column carry_until_date added.');
  } catch (err) {
    console.error('Failed to alter table:', err);
  } finally {
    await client.end();
  }
}

run();

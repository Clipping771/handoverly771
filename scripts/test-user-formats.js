const { Client } = require('pg');

const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
const password = 'Bcsbcsmba279@';

const tests = [
  { user: 'postgres.rqbkoryrlkglgsnqonvf', db: 'postgres', port: 5432 },
  { user: 'postgres.rqbkoryrlkglgsnqonvf', db: 'postgres', port: 6543 },
  { user: 'postgres', db: 'postgres', port: 5432 },
  { user: 'postgres', db: 'postgres', port: 6543 },
  { user: 'postgres', db: 'rqbkoryrlkglgsnqonvf', port: 5432 },
  { user: 'postgres', db: 'rqbkoryrlkglgsnqonvf', port: 6543 },
  { user: 'postgres.rqbkoryrlkglgsnqonvf', db: 'rqbkoryrlkglgsnqonvf', port: 5432 }
];

async function runTests() {
  for (const t of tests) {
    console.log(`Testing: user=${t.user}, db=${t.db}, port=${t.port}`);
    const client = new Client({
      host,
      port: t.port,
      user: t.user,
      password,
      database: t.db,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      console.log(`>>> SUCCESS! Connection worked with user=${t.user}, db=${t.db}, port=${t.port}`);
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
}

runTests();

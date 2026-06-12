const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').replace(/^"|"$/g, '');
  }
});

async function testConnection(connectionString, name) {
  console.log(`\nTesting connection for: ${name}...`);
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Success connecting with ${name}!`);
    const res = await client.query('SELECT current_user, current_database();');
    console.log('Result:', res.rows[0]);
    return true;
  } catch (err) {
    console.error(`Failed connecting with ${name}:`, err.message);
    return false;
  } finally {
    await client.end();
  }
}

async function run() {
  // Try 1: Original connection string from .env.local
  await testConnection(env.DATABASE_URL, 'Original DATABASE_URL');

  // Try 2: Connection string with user postgres.rqbkoryrlkglgsnqonvf
  const poolerDbUrl = env.DATABASE_URL.replace('//postgres:', '//postgres.rqbkoryrlkglgsnqonvf:');
  await testConnection(poolerDbUrl, 'Username with tenant ID (postgres.rqbkoryrlkglgsnqonvf)');

  // Try 3: Pooler connection string using port 6543 (session pooler)
  const poolerPortUrl = env.DATABASE_URL.replace(':5432/', ':6543/');
  await testConnection(poolerPortUrl, 'Session pooler port 6543');

  // Try 4: Pooler connection string using port 6543 with tenant ID
  const poolerPortAndUserUrl = poolerDbUrl.replace(':5432/', ':6543/');
  await testConnection(poolerPortAndUserUrl, 'Session pooler port 6543 with tenant ID');
}

run();

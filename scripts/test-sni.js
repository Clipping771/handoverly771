const { Client } = require('pg');

const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
const password = 'Bcsbcsmba279@';

async function run() {
  console.log("Testing connection with SSL SNI hostname...");
  const client = new Client({
    host,
    port: 6543, // Transaction pooler
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false,
      servername: 'db.rqbkoryrlkglgsnqonvf.supabase.co'
    }
  });

  try {
    await client.connect();
    console.log(">>> SUCCESS! SNI connection worked on port 6543.");
    await client.end();
    return;
  } catch (err) {
    console.log(`Port 6543 failed: ${err.message}`);
  }

  console.log("Trying port 5432 with SNI...");
  const client2 = new Client({
    host,
    port: 5432, // Session pooler
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false,
      servername: 'db.rqbkoryrlkglgsnqonvf.supabase.co'
    }
  });

  try {
    await client2.connect();
    console.log(">>> SUCCESS! SNI connection worked on port 5432.");
    await client2.end();
  } catch (err) {
    console.log(`Port 5432 failed: ${err.message}`);
  }
}

run();

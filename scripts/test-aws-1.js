const { Client } = require('pg');

const host = "aws-1-ap-northeast-1.pooler.supabase.com";
const passwords = ["Bcsbcsmba279", "Bcsbcsmba279@", "Bcsbcsmba279%40"];

async function run() {
  for (const pw of passwords) {
    const connectionString = `postgresql://postgres.rqbkoryrlkglgsnqonvf:${encodeURIComponent(pw)}@${host}:6543/postgres`;
    console.log(`Trying password: ${pw}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected successfully with password: ${pw}`);
      await client.end();
      return;
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }
}

run();

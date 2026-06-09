const { Client } = require('pg');

const clusters = ['aws-0', 'aws-1', 'aws-2', 'aws-3'];
const region = 'ap-northeast-1';

async function probe() {
  for (const cluster of clusters) {
    const host = `${cluster}-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.rqbkoryrlkglgsnqonvf:Bcsbcsmba279@${host}:6543/postgres`;
    console.log(`Probing pooler host ${host}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });

    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected successfully to host: ${host}`);
      await client.end();
      return;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('tenant/user') && msg.includes('not found')) {
        console.log(`❌ Host ${host}: Tenant not found`);
      } else {
        console.log(`ℹ️ Host ${host}: Tenant EXISTS, but failed: ${msg}`);
        await client.end().catch(() => {});
        return;
      }
    }
  }
  console.log("Finished probing all clusters.");
}

probe();

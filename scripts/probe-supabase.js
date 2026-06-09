const { Client } = require('pg');

const regions = [
  'ap-southeast-2', // Sydney
  'ap-southeast-1', // Singapore
  'ap-northeast-1', // Tokyo
  'ap-northeast-2', // Seoul
  'ap-south-1',     // Mumbai
  'us-east-1',      // N. Virginia
  'us-east-2',      // Ohio
  'us-west-1',      // N. California
  'us-west-2',      // Oregon
  'eu-west-1',      // Ireland
  'eu-central-1',   // Frankfurt
];

async function probe() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.rqbkoryrlkglgsnqonvf:Bcsbcsmba279@${host}:5432/postgres`;
    console.log(`Probing pooler in region ${region} (${host}) on port 5432...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });

    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected successfully to region: ${region}`);
      await client.end();
      return;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('tenant/user') && msg.includes('not found')) {
        console.log(`❌ Region ${region}: Tenant not found`);
      } else {
        console.log(`ℹ️ Region ${region}: Tenant EXISTS, but failed: ${msg}`);
        await client.end().catch(() => {});
        return;
      }
    }
  }
  console.log("Finished probing all regions on port 5432.");
}

probe();

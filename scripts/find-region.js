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
  'eu-central-1',   // Frankfurt
  'eu-west-1',      // Ireland
  'eu-west-2',      // London
  'eu-west-3',      // Paris
  'ca-central-1',   // Canada
  'sa-east-1'       // Sao Paulo
];

async function checkRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    user: 'postgres.rqbkoryrlkglgsnqonvf',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`\n>>> SUCCESS! Connected to pooler in region: ${region}`);
    await client.end();
    return true;
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('password authentication failed')) {
      console.log(`\n>>> FOUND IT! Project is in region: ${region} (but password failed/needs encoding)`);
      return true;
    } else if (msg.includes('not found') || msg.includes('ENOTFOUND')) {
      // Tenant not found in this region
      process.stdout.write(`.`);
    } else {
      console.log(`\nRegion ${region} failed with: ${msg}`);
    }
    return false;
  }
}

async function run() {
  console.log("Probing regions for tenant rqbkoryrlkglgsnqonvf...");
  for (const r of regions) {
    const found = await checkRegion(r);
    if (found) {
      break;
    }
  }
  console.log("\nProbe finished.");
}

run();

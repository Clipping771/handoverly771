const { Client } = require('pg');

async function migrate() {
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
    
    await client.query(`
      DELETE FROM public.roles;
    `);

    console.log("All previous roles deleted successfully.");
  } catch (err) {
    console.error("Deletion error:", err);
  } finally {
    await client.end();
  }
}

migrate();

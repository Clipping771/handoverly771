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
      INSERT INTO public.roles (name) VALUES ('manager') ON CONFLICT DO NOTHING;
    `);

    console.log("Restored manager role.");
  } catch (err) {
    console.error("error:", err);
  } finally {
    await client.end();
  }
}

migrate();

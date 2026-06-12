const { Client } = require('pg');

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
    const res = await client.query(`
      SELECT id, title, description, is_completed, carry_until_date, created_at, resident_id
      FROM public.tasks
      ORDER BY created_at DESC
      LIMIT 30;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Failed to query tasks:', err);
  } finally {
    await client.end();
  }
}

run();

const { Client } = require('pg');

async function run() {
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
    
    // 1. Drop check constraint staff_role_check on staff table
    await client.query("ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;");
    console.log("Successfully dropped staff_role_check constraint!");
    
    // Let's also check if there are other check constraints on staff table
    const res = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'public.staff'::regclass AND contype = 'c';
    `);
    console.log("Remaining constraints:", res.rows);
    
    await client.end();
  } catch (err) {
    console.error("Error executing query:", err);
    try { client.end(); } catch (e) {}
  }
}

run();

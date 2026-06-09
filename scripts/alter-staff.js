const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function run() {
  const client = new Client({
    host: '2406:da14:311:1501:7634:d3f9:9515:a661',
    port: 5432,
    user: 'postgres',
    password: 'Bcsbcsmba279@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected. Modifying 'staff' table...");

    // Add columns if they do not exist
    await client.query(`
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employee_id text;
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password_hash text;
    `);
    console.log("Columns added successfully.");

    // Update existing staff to have default emails and passwords based on their names
    const staffRes = await client.query("SELECT id, name, pin_hash FROM public.staff");
    for (const row of staffRes.rows) {
      const email = row.name.toLowerCase().replace(/\s+/g, '.') + '@handoverly.com.au';
      const employeeId = 'EMP' + String(Math.floor(1000 + Math.random() * 9000));
      // Use existing pin_hash or fallback to hashed 'password123'
      const passHash = row.pin_hash || await bcrypt.hash('password123', 10);
      
      await client.query(
        "UPDATE public.staff SET email = $1, employee_id = $2, password_hash = $3 WHERE id = $4 AND email IS NULL",
        [email, employeeId, passHash, row.id]
      );
    }
    console.log("Populated credentials for existing staff.");

    // Apply unique constraint to email
    try {
      await client.query(`
        ALTER TABLE public.staff ADD CONSTRAINT staff_email_unique UNIQUE (email);
      `);
      console.log("Unique constraint applied to email.");
    } catch (e) {
      console.log("Constraint already exists or failed to apply:", e.message);
    }

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();

import { NextResponse } from 'next/server';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export async function GET() {
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
    
    // 1. Add columns
    await client.query(`
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employee_id text;
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password_hash text;
    `);

    // 2. Populate default data for existing staff so they remain functional
    const staffRes = await client.query("SELECT id, name, pin_hash FROM public.staff");
    for (const row of staffRes.rows) {
      const email = row.name.toLowerCase().replace(/\s+/g, '.') + '@handoverly.com.au';
      const employeeId = 'EMP' + String(Math.floor(1000 + Math.random() * 9000));
      // Hash a default password 'password123' or use existing pin_hash
      const passHash = row.pin_hash || await bcrypt.hash('password123', 10);
      
      await client.query(
        "UPDATE public.staff SET email = $1, employee_id = $2, password_hash = $3 WHERE id = $4 AND email IS NULL",
        [email, employeeId, passHash, row.id]
      );
    }

    // 3. Add unique constraint to email
    try {
      await client.query(`
        ALTER TABLE public.staff ADD CONSTRAINT staff_email_unique UNIQUE (email);
      `);
    } catch (e: any) {
      // Ignore if constraint already exists
    }

    await client.end();
    return NextResponse.json({ success: true, message: "Database staff schema migrated successfully" });
  } catch (err: any) {
    const logPath = path.join(process.cwd(), 'migration_error.txt');
    fs.writeFileSync(logPath, `Error: ${err.message}\nStack: ${err.stack}\nDetails: ${JSON.stringify(err)}`);
    console.error("Migration error details:", err);
    try { await client.end(); } catch (e) {}
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

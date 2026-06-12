const { Client } = require('pg');

async function fix() {
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
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff' AND policyname = 'Allow public delete staff'
        ) THEN
            CREATE POLICY "Allow public delete staff" ON public.staff FOR DELETE USING (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff' AND policyname = 'Allow public update staff'
        ) THEN
            CREATE POLICY "Allow public update staff" ON public.staff FOR UPDATE USING (true);
        END IF;
      END
      $$;
    `);

    console.log("Staff RLS policies updated successfully");
  } catch (err) {
    console.error("Error updating policies:", err);
  } finally {
    await client.end();
  }
}

fix();

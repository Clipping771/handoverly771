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

    // 1. Delete duplicates on handovers if any exist
    console.log("Cleaning duplicate handovers...");
    await client.query(`
      DELETE FROM public.handovers a USING public.handovers b
      WHERE a.id < b.id
        AND a.resident_id = b.resident_id
        AND a.shift_date = b.shift_date
        AND a.shift_type = b.shift_type;
    `);

    // 2. Add unique constraint on handovers
    console.log("Adding unique constraint on handovers (resident_id, shift_date, shift_type)...");
    await client.query(`
      ALTER TABLE public.handovers 
      ADD CONSTRAINT unique_resident_shift_date 
      UNIQUE (resident_id, shift_date, shift_type);
    `);

    // 3. Create scheduler_execution_logs table
    console.log("Creating scheduler_execution_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.scheduler_execution_logs (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        executed_at timestamptz DEFAULT now() NOT NULL,
        alert_scanned_count integer NOT NULL,
        status text NOT NULL,
        details jsonb DEFAULT '{}'::jsonb NOT NULL
      );

      ALTER TABLE public.scheduler_execution_logs ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scheduler_execution_logs' AND policyname = 'Allow public read scheduler_execution_logs'
        ) THEN
            CREATE POLICY "Allow public read scheduler_execution_logs" ON public.scheduler_execution_logs FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scheduler_execution_logs' AND policyname = 'Allow public insert scheduler_execution_logs'
        ) THEN
            CREATE POLICY "Allow public insert scheduler_execution_logs" ON public.scheduler_execution_logs FOR INSERT WITH CHECK (true);
        END IF;
      END
      $$;
    `);

    console.log("Migration completed successfully");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();

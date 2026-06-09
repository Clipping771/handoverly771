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
      CREATE TABLE IF NOT EXISTS public.tasks (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        handover_id uuid REFERENCES public.handovers(id) ON DELETE CASCADE,
        facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
        resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text NOT NULL,
        tags text[] DEFAULT '{}'::text[],
        is_completed boolean DEFAULT false,
        created_at timestamptz DEFAULT now() NOT NULL
      );

      ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
      
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'tasks'
            AND policyname = 'Allow public read tasks'
        ) THEN
            CREATE POLICY "Allow public read tasks" ON public.tasks FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'tasks'
            AND policyname = 'Allow public insert tasks'
        ) THEN
            CREATE POLICY "Allow public insert tasks" ON public.tasks FOR INSERT WITH CHECK (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'tasks'
            AND policyname = 'Allow public update tasks'
        ) THEN
            CREATE POLICY "Allow public update tasks" ON public.tasks FOR UPDATE USING (true);
        END IF;
      END
      $$;
    `);

    console.log("Tasks table created successfully");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

migrate();

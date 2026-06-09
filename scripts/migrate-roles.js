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
      CREATE TABLE IF NOT EXISTS public.roles (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL UNIQUE,
        created_at timestamptz DEFAULT now() NOT NULL
      );

      ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
      
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'roles'
            AND policyname = 'Allow public read roles'
        ) THEN
            CREATE POLICY "Allow public read roles" ON public.roles FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'roles'
            AND policyname = 'Allow public insert roles'
        ) THEN
            CREATE POLICY "Allow public insert roles" ON public.roles FOR INSERT WITH CHECK (true);
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'roles'
            AND policyname = 'Allow public delete roles'
        ) THEN
            CREATE POLICY "Allow public delete roles" ON public.roles FOR DELETE USING (true);
        END IF;
      END
      $$;

      INSERT INTO public.roles (name) VALUES ('carer'), ('rn'), ('admin') ON CONFLICT DO NOTHING;
    `);

    console.log("Roles table created successfully");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

migrate();

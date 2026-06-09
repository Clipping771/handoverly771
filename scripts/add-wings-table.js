const { Client } = require('pg');

const dbUrl = "postgresql://postgres.rqbkoryrlkglgsnqonvf:Bcsbcsmba279%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";

const migrationSql = `
-- Create wings table if it does not exist
CREATE TABLE IF NOT EXISTS public.wings (
  id uuid default uuid_generate_v4() primary key,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
ALTER TABLE public.wings ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies safely
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read wings') THEN
    CREATE POLICY "Allow public read wings" on public.wings for select using (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert wings') THEN
    CREATE POLICY "Allow public insert wings" on public.wings for insert with check (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete wings') THEN
    CREATE POLICY "Allow public delete wings" on public.wings for delete using (true);
  END IF;
END $$;

-- Add wing_id column to residents table if not exists
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS wing_id uuid references public.wings(id) on delete set null;
`;

async function run() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to Supabase PostgreSQL database via aws-1 pooler on port 5432...");
    await client.connect();

    console.log("Running Wings table migration queries...");
    await client.query(migrationSql);
    console.log("Wings migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();

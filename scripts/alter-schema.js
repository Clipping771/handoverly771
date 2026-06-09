const { Client } = require('pg');

const alterSql = `
-- 1. Add columns to handovers
ALTER TABLE public.handovers 
ADD COLUMN IF NOT EXISTS device_id text,
ADD COLUMN IF NOT EXISTS version_number text;

-- 2. Create activity_timeline
create table if not exists public.activity_timeline (
  id uuid default uuid_generate_v4() primary key,
  resident_id uuid references public.residents(id) on delete cascade not null,
  staff_id uuid references public.staff(id) on delete set null,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  action_type text not null,
  description text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

alter table public.activity_timeline enable row level security;
create policy "Allow public read activity_timeline" on public.activity_timeline for select using (true);
create policy "Allow public insert activity_timeline" on public.activity_timeline for insert with check (true);
`;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Bcsbcsmba279@db.rqbkoryrlkglgsnqonvf.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to Supabase PostgreSQL database...");
    await client.connect();

    console.log("Executing alter SQL...");
    await client.query(alterSql);
    console.log("Schema altered successfully.");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();

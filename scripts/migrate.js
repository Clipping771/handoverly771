const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const dbUrl = "postgresql://postgres.rqbkoryrlkglgsnqonvf:Bcsbcsmba279%40@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

const schemaSql = `
-- Drop existing tables if they exist
drop table if exists public.handovers cascade;
drop table if exists public.residents cascade;
drop table if exists public.staff cascade;
drop table if exists public.wings cascade;
drop table if exists public.facilities cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Facilities
create table public.facilities (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  code text not null unique,
  created_at timestamptz default now() not null
);

-- 1b. Wings
create table public.wings (
  id uuid default uuid_generate_v4() primary key,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null
);

-- 2. Staff
create table public.staff (
  id uuid default uuid_generate_v4() primary key,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  name text not null,
  role text check (role in ('rn', 'carer', 'admin')) not null,
  pin_hash text not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 3. Residents
create table public.residents (
  id uuid default uuid_generate_v4() primary key,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  wing_id uuid references public.wings(id) on delete set null,
  name text not null,
  room_number text not null,
  dob date not null,
  care_level text not null, -- 'High', 'Low', 'Dementia'
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

-- 4. Handovers
create table public.handovers (
  id uuid default uuid_generate_v4() primary key,
  facility_id uuid references public.facilities(id) on delete cascade not null,
  resident_id uuid references public.residents(id) on delete cascade not null,
  submitted_by uuid references public.staff(id) on delete set null,
  raw_input text not null,
  rn_summary jsonb not null,
  rn_summary_original jsonb not null,
  carer_tasks jsonb not null,
  urgency text check (urgency in ('critical', 'attention', 'routine')) not null,
  risk_flags text[] default '{}'::text[] not null,
  flags_status text check (flags_status in ('all_present', 'some_missing', 'none_detected')) not null,
  is_approved boolean default false not null,
  approved_at timestamptz,
  shift_date date not null,
  shift_type text check (shift_type in ('morning', 'afternoon', 'night')) not null,
  input_method text check (input_method in ('voice', 'text')) not null,
  created_at timestamptz default now() not null
);

-- Enable Row-Level Security (RLS)
alter table public.facilities enable row level security;
alter table public.staff enable row level security;
alter table public.residents enable row level security;
alter table public.handovers enable row level security;
alter table public.wings enable row level security;

-- Setup RLS Policies
create policy "Allow public read facilities" on public.facilities for select using (true);
create policy "Allow public read staff" on public.staff for select using (true);
create policy "Allow public read residents" on public.residents for select using (true);
create policy "Allow public read handovers" on public.handovers for select using (true);
create policy "Allow public read wings" on public.wings for select using (true);

create policy "Allow public insert staff" on public.staff for insert with check (true);
create policy "Allow public insert residents" on public.residents for insert with check (true);
create policy "Allow public insert handovers" on public.handovers for insert with check (true);
create policy "Allow public update handovers" on public.handovers for update using (true);
create policy "Allow public insert wings" on public.wings for insert with check (true);
create policy "Allow public delete wings" on public.wings for delete using (true);

`;

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
    console.log("Connecting to Supabase PostgreSQL database via direct IPv6...");
    await client.connect();

    console.log("Executing schema SQL...");
    await client.query(schemaSql);
    console.log("Schema tables created successfully.");

    // Seed Facility 1 (ADL001)
    console.log("Seeding facility ADL001...");
    const facilityRes1 = await client.query(
      "insert into public.facilities (name, code) values ($1, $2) returning id",
      ["Adelaide Care Center", "ADL001"]
    );
    const facilityId1 = facilityRes1.rows[0].id;
    console.log(`Facility ADL001 created with ID: ${facilityId1}`);

    // Seed Facility 2 (MD771)
    console.log("Seeding facility MD771...");
    const facilityRes2 = await client.query(
      "insert into public.facilities (name, code) values ($1, $2) returning id",
      ["Melbourne Care Center", "MD771"]
    );
    const facilityId2 = facilityRes2.rows[0].id;
    console.log(`Facility MD771 created with ID: ${facilityId2}`);

    // Seed Staff for ADL001
    console.log("Hashing PINs for ADL001...");
    const adminPinHash = await bcrypt.hash("1111", 10);
    const rnPinHash = await bcrypt.hash("2222", 10);
    const carerPinHash = await bcrypt.hash("3333", 10);

    console.log("Seeding staff for ADL001...");
    await client.query(
      `insert into public.staff (facility_id, name, role, pin_hash) values 
       ($1, 'Admin User', 'admin', $2),
       ($1, 'Jane Doe', 'rn', $3),
       ($1, 'John Smith', 'carer', $4)`,
      [facilityId1, adminPinHash, rnPinHash, carerPinHash]
    );

    // Seed Staff for MD771 (All PINs = '123456')
    console.log("Hashing PINs for MD771...");
    const pin123456Hash = await bcrypt.hash("123456", 10);

    console.log("Seeding staff for MD771...");
    await client.query(
      `insert into public.staff (facility_id, name, role, pin_hash) values 
       ($1, 'Admin MD771', 'admin', $2),
       ($1, 'Jane RN', 'rn', $2),
       ($1, 'John Carer', 'carer', $2)`,
      [facilityId2, pin123456Hash]
    );
    console.log("Staff accounts seeded successfully.");

    // Seed Residents for ADL001
    console.log("Seeding residents for ADL001...");
    await client.query(
      `insert into public.residents (facility_id, name, room_number, dob, care_level) values 
       ($1, 'Alice Brown', '101', '1935-05-15', 'High'),
       ($1, 'Bob Miller', '102', '1940-08-22', 'Dementia'),
       ($1, 'Charlie Davis', '103', '1938-12-01', 'Low')`,
      [facilityId1]
    );

    // Seed Residents for MD771
    console.log("Seeding residents for MD771...");
    await client.query(
      `insert into public.residents (facility_id, name, room_number, dob, care_level) values 
       ($1, 'Sarah Jenkins', '201', '1945-10-10', 'High'),
       ($1, 'Donald Evans', '202', '1948-03-12', 'Low'),
       ($1, 'Elizabeth Taylor', '203', '1939-06-25', 'Dementia')`,
      [facilityId2]
    );
    console.log("Residents seeded successfully.");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

run();

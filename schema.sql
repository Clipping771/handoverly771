-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist
drop table if exists public.handovers cascade;
drop table if exists public.residents cascade;
drop table if exists public.staff cascade;
drop table if exists public.wings cascade;
drop table if exists public.facilities cascade;

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
  care_level text not null, -- e.g., 'High', 'Low', 'Dementia'
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
  device_id text,
  version_number text,
  created_at timestamptz default now() not null
);

-- Enable Row-Level Security (RLS)
alter table public.facilities enable row level security;
alter table public.staff enable row level security;
alter table public.residents enable row level security;
alter table public.handovers enable row level security;
alter table public.wings enable row level security;

-- 5. Activity Timeline
create table public.activity_timeline (
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

-- Setup RLS Policies (Allow authenticated read/write access or bypass for client-side demo ease, or simple facility-based checks)
-- For the MVP, we will allow read/write access to anyone with the anon key to simplify local/pilot testing, but filter by facility_id in client-side queries.
create policy "Allow public read facilities" on public.facilities for select using (true);
create policy "Allow public read staff" on public.staff for select using (true);
create policy "Allow public read residents" on public.residents for select using (true);
create policy "Allow public read handovers" on public.handovers for select using (true);
create policy "Allow public read wings" on public.wings for select using (true);
create policy "Allow public read activity_timeline" on public.activity_timeline for select using (true);

create policy "Allow public insert staff" on public.staff for insert with check (true);
create policy "Allow public insert residents" on public.residents for insert with check (true);
create policy "Allow public insert handovers" on public.handovers for insert with check (true);
create policy "Allow public update handovers" on public.handovers for update using (true);
create policy "Allow public insert wings" on public.wings for insert with check (true);
create policy "Allow public delete wings" on public.wings for delete using (true);
create policy "Allow public insert activity_timeline" on public.activity_timeline for insert with check (true);

-- Seed Initial Facility
insert into public.facilities (name, code) values 
('Adelaide Care Center', 'ADL001');

-- Seed Initial Staff (PINs: Admin = '1111', Jane Doe (RN) = '2222', John Smith (Carer) = '3333')
-- Pre-hashed using bcryptjs (rounds: 10)
insert into public.staff (facility_id, name, role, pin_hash) values 
(
  (select id from public.facilities where code = 'ADL001'), 
  'Admin User', 
  'admin', 
  '$2b$10$3e3NnXbnqllu.nFZkMgtGeb4YeTzvJJbVSQZ7Wk0.okT3f8woBDZO'
),
(
  (select id from public.facilities where code = 'ADL001'), 
  'Jane Doe', 
  'rn', 
  '$2b$10$QDy7.CvJ2Ez5KgTxL4O8dePRbRRpzgvgyqgKS4zOagajh90pJrC2q'
),
(
  (select id from public.facilities where code = 'ADL001'), 
  'John Smith', 
  'carer', 
  '$2b$10$q3HWFZkDkvwAEUcTdvJ0iucFLDzQ69FXTmmiFFxpFsiqpMYoX8Kj2'
);

-- Seed Initial Residents
insert into public.residents (facility_id, name, room_number, dob, care_level) values 
(
  (select id from public.facilities where code = 'ADL001'), 
  'Alice Brown', 
  '101', 
  '1935-05-15', 
  'High'
),
(
  (select id from public.facilities where code = 'ADL001'), 
  'Bob Miller', 
  '102', 
  '1940-08-22', 
  'Dementia'
),
(
  (select id from public.facilities where code = 'ADL001'), 
  'Charlie Davis', 
  '103', 
  '1938-12-01', 
  'Low'
);

-- 1. External Comms Table
create table if not exists public.external_comms (
  id uuid default gen_random_uuid() primary key,
  resident_id uuid references public.residents(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete cascade,
  staff_id uuid references public.users(id) on delete set null,
  comm_type text not null check (comm_type in ('fax', 'phone', 'email', 'portal')),
  recipient_type text not null check (recipient_type in ('gp', 'pharmacy', 'hospital', 'specialist', 'family')),
  recipient_name text,
  topic text not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies for external_comms
alter table public.external_comms enable row level security;

create policy "Users can view comms in their facility"
  on public.external_comms for select
  using (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

create policy "Users can insert comms in their facility"
  on public.external_comms for insert
  with check (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

create policy "Users can update comms in their facility"
  on public.external_comms for update
  using (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

-- 2. Medication Profiles Table
create table if not exists public.medication_profiles (
  id uuid default gen_random_uuid() primary key,
  resident_id uuid references public.residents(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete cascade,
  medication_name text not null,
  dosage text not null,
  frequency text not null,
  route text not null,
  status text not null check (status in ('active', 'discontinued', 'on_hold')),
  start_date date,
  end_date date,
  prescribed_by text,
  last_reconciled_at timestamp with time zone,
  last_reconciled_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies for medication_profiles
alter table public.medication_profiles enable row level security;

create policy "Users can view medications in their facility"
  on public.medication_profiles for select
  using (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

create policy "Users can insert medications in their facility"
  on public.medication_profiles for insert
  with check (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

create policy "Users can update medications in their facility"
  on public.medication_profiles for update
  using (facility_id in (
    select facility_id from public.users where id = auth.uid()
  ));

-- Enable real-time for both tables
alter publication supabase_realtime add table public.external_comms;
alter publication supabase_realtime add table public.medication_profiles;

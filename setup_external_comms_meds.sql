-- 1. External Comms Table
create table if not exists public.external_comms (
  id uuid default gen_random_uuid() primary key,
  resident_id uuid references public.residents(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  comm_type text not null check (comm_type in ('fax', 'phone', 'email', 'portal')),
  recipient_type text not null check (recipient_type in ('gp', 'pharmacy', 'hospital', 'specialist', 'family')),
  recipient_name text,
  topic text not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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
  last_reconciled_by uuid references public.staff(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable real-time for both tables
alter publication supabase_realtime add table public.external_comms;
alter publication supabase_realtime add table public.medication_profiles;

-- Fix RLS for external_comms table
-- Run this in the Supabase SQL editor

alter table public.external_comms enable row level security;

create policy "Users can view external_comms"
  on public.external_comms for select
  using (true);

create policy "Users can insert external_comms"
  on public.external_comms for insert
  with check (true);

create policy "Users can update external_comms"
  on public.external_comms for update
  using (true);

create policy "Users can delete external_comms"
  on public.external_comms for delete
  using (true);

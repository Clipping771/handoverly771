-- Recreate RLS policies for medication_profiles
alter table public.medication_profiles enable row level security;

drop policy if exists "Users can view medication_profiles" on public.medication_profiles;
create policy "Users can view medication_profiles"
  on public.medication_profiles for select to authenticated using (true);

drop policy if exists "Users can insert medication_profiles" on public.medication_profiles;
create policy "Users can insert medication_profiles"
  on public.medication_profiles for insert to authenticated with check (true);

drop policy if exists "Users can update medication_profiles" on public.medication_profiles;
create policy "Users can update medication_profiles"
  on public.medication_profiles for update to authenticated using (true);

drop policy if exists "Users can delete medication_profiles" on public.medication_profiles;
create policy "Users can delete medication_profiles"
  on public.medication_profiles for delete to authenticated using (true);

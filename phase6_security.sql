-- Phase 6: Enterprise Security Enforcement
-- Run this in your Supabase SQL Editor

-- 1. Allow facility_id to be null for platform admins
ALTER TABLE public.staff ALTER COLUMN facility_id DROP NOT NULL;

-- 2. Create a broader audit_logs table for administrative actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid default uuid_generate_v4() primary key,
    actor_id uuid references public.staff(id) on delete set null,
    actor_role text,
    action_type text not null, 
    target_entity jsonb,
    ip_address text,
    created_at timestamptz default now() not null
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform Admins can view audit logs" ON public.audit_logs
FOR SELECT USING ( auth.jwt() -> 'app_metadata' ->> 'role' = 'platform_admin' );

-- 2. Update RLS Policies to allow Platform Admin Bypass
-- (Re-run for every major table)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['facilities', 'staff', 'residents', 'handovers', 'wings', 'activity_timeline', 'tasks', 'medication_profiles', 'sirs_reports'];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Strict Tenant Isolation - %I" ON public.%I;', t, t);
        
        -- Special rule for facilities (since they are isolated by id, not facility_id)
        IF t = 'facilities' THEN
            EXECUTE format('
                CREATE POLICY "Strict Tenant Isolation - %I" ON public.%I
                FOR ALL USING ( 
                    (auth.jwt() -> ''app_metadata'' ->> ''role'' = ''platform_admin'') OR 
                    (id = (auth.jwt() -> ''app_metadata'' ->> ''facility_id'')::uuid) 
                );
            ', t, t);
        ELSE
            EXECUTE format('
                CREATE POLICY "Strict Tenant Isolation - %I" ON public.%I
                FOR ALL USING ( 
                    (auth.jwt() -> ''app_metadata'' ->> ''role'' = ''platform_admin'') OR 
                    (facility_id = (auth.jwt() -> ''app_metadata'' ->> ''facility_id'')::uuid) 
                );
            ', t, t);
        END IF;
    END LOOP;
END $$;

-- Migration script to enforce strict RLS without dropping existing data

-- Add user_id to staff to link with auth.users
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);

-- Drop all open policies
DROP POLICY IF EXISTS "Allow public read facilities" ON public.facilities;
DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public read residents" ON public.residents;
DROP POLICY IF EXISTS "Allow public read handovers" ON public.handovers;
DROP POLICY IF EXISTS "Allow public read wings" ON public.wings;
DROP POLICY IF EXISTS "Allow public read activity_timeline" ON public.activity_timeline;
DROP POLICY IF EXISTS "Allow public insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public insert residents" ON public.residents;
DROP POLICY IF EXISTS "Allow public insert handovers" ON public.handovers;
DROP POLICY IF EXISTS "Allow public update handovers" ON public.handovers;
DROP POLICY IF EXISTS "Allow public insert wings" ON public.wings;
DROP POLICY IF EXISTS "Allow public delete wings" ON public.wings;
DROP POLICY IF EXISTS "Allow public insert activity_timeline" ON public.activity_timeline;

-- Enable RLS everywhere
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_timeline ENABLE ROW LEVEL SECURITY;

-- Handle dynamic advanced features tables safely
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Strict Tenant Isolation - Tasks" ON public.tasks;
        CREATE POLICY "Strict Tenant Isolation - Tasks" ON public.tasks
        FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medication_profiles') THEN
        ALTER TABLE public.medication_profiles ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Strict Tenant Isolation - Medication Profiles" ON public.medication_profiles;
        CREATE POLICY "Strict Tenant Isolation - Medication Profiles" ON public.medication_profiles
        FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sirs_reports') THEN
        ALTER TABLE public.sirs_reports ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Strict Tenant Isolation - SIRS Reports" ON public.sirs_reports;
        CREATE POLICY "Strict Tenant Isolation - SIRS Reports" ON public.sirs_reports
        FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'handover_feedback') THEN
        ALTER TABLE public.handover_feedback ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Strict Tenant Isolation - Handover Feedback" ON public.handover_feedback;
        CREATE POLICY "Strict Tenant Isolation - Handover Feedback" ON public.handover_feedback
        FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medication_reconciliation_logs') THEN
        ALTER TABLE public.medication_reconciliation_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Strict Tenant Isolation - Medication Recon Logs" ON public.medication_reconciliation_logs;
        CREATE POLICY "Strict Tenant Isolation - Medication Recon Logs" ON public.medication_reconciliation_logs
        FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
    END IF;
END $$;

-- NEW STRICT RLS POLICIES for Base Tables

-- 1. Facilities
DROP POLICY IF EXISTS "Strict Tenant Isolation - Facilities" ON public.facilities;
CREATE POLICY "Strict Tenant Isolation - Facilities" ON public.facilities
FOR SELECT USING ( id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- 2. Staff
DROP POLICY IF EXISTS "Strict Tenant Isolation - Staff" ON public.staff;
CREATE POLICY "Strict Tenant Isolation - Staff" ON public.staff
FOR SELECT USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- 3. Residents
DROP POLICY IF EXISTS "Strict Tenant Isolation - Residents" ON public.residents;
CREATE POLICY "Strict Tenant Isolation - Residents" ON public.residents
FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- 4. Handovers
DROP POLICY IF EXISTS "Strict Tenant Isolation - Handovers" ON public.handovers;
CREATE POLICY "Strict Tenant Isolation - Handovers" ON public.handovers
FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- 5. Wings
DROP POLICY IF EXISTS "Strict Tenant Isolation - Wings" ON public.wings;
CREATE POLICY "Strict Tenant Isolation - Wings" ON public.wings
FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- 6. Activity Timeline
DROP POLICY IF EXISTS "Strict Tenant Isolation - Activity Timeline" ON public.activity_timeline;
CREATE POLICY "Strict Tenant Isolation - Activity Timeline" ON public.activity_timeline
FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );
-- Phase 1 Trust Core Migration

-- 1. Modify handovers table
ALTER TABLE public.handovers ADD COLUMN IF NOT EXISTS status text check (status in ('published', 'needs_review', 'rejected')) default 'needs_review' not null;
ALTER TABLE public.handovers ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3);
ALTER TABLE public.handovers ADD COLUMN IF NOT EXISTS uncertainty_reason text;

-- If they have existing approved rows, we can map is_approved to status
UPDATE public.handovers SET status = 'published' WHERE is_approved = true;

-- We can drop is_approved now
ALTER TABLE public.handovers DROP COLUMN IF EXISTS is_approved;

-- 2. Create handover_versions table
CREATE TABLE IF NOT EXISTS public.handover_versions (
    id uuid default uuid_generate_v4() primary key,
    handover_id uuid references public.handovers(id) on delete cascade not null,
    facility_id uuid references public.facilities(id) on delete cascade not null,
    edited_by uuid references public.staff(id) on delete set null,
    previous_summary jsonb not null,
    new_summary jsonb not null,
    created_at timestamptz default now() not null
);

-- 3. Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid default uuid_generate_v4() primary key,
    facility_id uuid references public.facilities(id) on delete cascade not null,
    actor_id uuid references public.staff(id) on delete set null,
    target_id uuid not null, -- can be a resident, handover, or task ID
    action_type text not null, -- e.g., 'EDIT_HANDOVER', 'APPROVE_HANDOVER', 'REJECT_HANDOVER'
    before_state jsonb,
    after_state jsonb,
    created_at timestamptz default now() not null
);

-- 4. Enable RLS and setup policies
ALTER TABLE public.handover_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- handover_versions RLS
CREATE POLICY "Strict Tenant Isolation - Handover Versions" ON public.handover_versions
FOR ALL USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

-- audit_log RLS
CREATE POLICY "Strict Tenant Isolation - Audit Log SELECT" ON public.audit_log
FOR SELECT USING ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

CREATE POLICY "Strict Tenant Isolation - Audit Log INSERT" ON public.audit_log
FOR INSERT WITH CHECK ( facility_id = (auth.jwt() -> 'app_metadata' ->> 'facility_id')::uuid );

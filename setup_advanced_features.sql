-- Setup script for advanced Handoverly features (SIRS, Feedback, Meds Reconciliation)

-- 1. SIRS Reports Table
CREATE TABLE IF NOT EXISTS public.sirs_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending',
  priority text DEFAULT 'high',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for SIRS
ALTER TABLE public.sirs_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SIRS visible to all" ON public.sirs_reports FOR SELECT USING (true);
CREATE POLICY "SIRS insertable by all" ON public.sirs_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "SIRS updatable by all" ON public.sirs_reports FOR UPDATE USING (true);

-- 2. Handover Feedback Table
CREATE TABLE IF NOT EXISTS public.handover_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  incoming_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  shift_type text NOT NULL,
  rating text NOT NULL, -- 'excellent', 'adequate', 'incomplete'
  comments text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Handover Feedback
ALTER TABLE public.handover_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feedback visible to all" ON public.handover_feedback FOR SELECT USING (true);
CREATE POLICY "Feedback insertable by all" ON public.handover_feedback FOR INSERT WITH CHECK (true);

-- 3. Detailed Medication Reconciliation Logs
CREATE TABLE IF NOT EXISTS public.medication_reconciliation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resident_id uuid REFERENCES public.residents(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  medication_id uuid REFERENCES public.medication_profiles(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'verified', 'flagged'
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Med Logs
ALTER TABLE public.medication_reconciliation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Med logs visible to all" ON public.medication_reconciliation_logs FOR SELECT USING (true);
CREATE POLICY "Med logs insertable by all" ON public.medication_reconciliation_logs FOR INSERT WITH CHECK (true);

-- Enable Realtime for these tables
alter publication supabase_realtime add table sirs_reports;
alter publication supabase_realtime add table handover_feedback;

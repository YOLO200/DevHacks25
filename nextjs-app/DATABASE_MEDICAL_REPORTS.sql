-- Medical Reports Table Schema

-- Table for storing medical reports
CREATE TABLE IF NOT EXISTS public.medical_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['appointment'::text, 'lab_result'::text, 'prescription'::text, 'diagnosis'::text])),
  content text NOT NULL,
  date date NOT NULL,
  doctor_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT medical_reports_pkey PRIMARY KEY (id),
  CONSTRAINT medical_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medical_reports_user_id ON public.medical_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_date ON public.medical_reports(date);
CREATE INDEX IF NOT EXISTS idx_medical_reports_type ON public.medical_reports(type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_reports
-- Users can only see their own medical reports
DROP POLICY IF EXISTS "Users can view their own medical reports" ON public.medical_reports;
CREATE POLICY "Users can view their own medical reports" ON public.medical_reports
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own medical reports
DROP POLICY IF EXISTS "Users can create their own medical reports" ON public.medical_reports;
CREATE POLICY "Users can create their own medical reports" ON public.medical_reports
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own medical reports
DROP POLICY IF EXISTS "Users can update their own medical reports" ON public.medical_reports;
CREATE POLICY "Users can update their own medical reports" ON public.medical_reports
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own medical reports
DROP POLICY IF EXISTS "Users can delete their own medical reports" ON public.medical_reports;
CREATE POLICY "Users can delete their own medical reports" ON public.medical_reports
FOR DELETE
USING (user_id = auth.uid());

-- Caregivers can view medical reports of their patients
DROP POLICY IF EXISTS "Caregivers can view patient medical reports" ON public.medical_reports;
CREATE POLICY "Caregivers can view patient medical reports" ON public.medical_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM caregiver_relationships cr
    WHERE cr.patient_id = medical_reports.user_id
    AND cr.caregiver_email = (
      SELECT email FROM user_profiles
      WHERE id = auth.uid()
    )
    AND cr.status = 'accepted'
    AND 'view_reports' = ANY(cr.permissions)
  )
);

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_medical_reports_updated_at
    BEFORE UPDATE ON public.medical_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create caregiver_relationships table
CREATE TABLE IF NOT EXISTS public.caregiver_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  caregiver_email text NOT NULL,
  caregiver_name text NOT NULL,
  relationship text NOT NULL,
  permissions text[] NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT caregiver_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT caregiver_relationships_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT caregiver_relationships_status_check CHECK (
    (
      status = ANY (
        ARRAY[
          'pending'::text,
          'accepted'::text,
          'declined'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_caregiver_relationships_patient_id ON public.caregiver_relationships USING btree (patient_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_caregiver_relationships_caregiver_email ON public.caregiver_relationships USING btree (caregiver_email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_caregiver_relationships_status ON public.caregiver_relationships USING btree (status) TABLESPACE pg_default;

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_caregiver_relationships_updated_at
    BEFORE UPDATE ON caregiver_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE caregiver_relationships ENABLE ROW LEVEL SECURITY;

-- Policy for patients to see their own caregiver relationships
CREATE POLICY "Patients can view their own caregiver relationships" ON caregiver_relationships
    FOR SELECT USING (auth.uid() = patient_id);

-- Policy for patients to insert their own caregiver relationships
CREATE POLICY "Patients can insert their own caregiver relationships" ON caregiver_relationships
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Policy for patients to update their own caregiver relationships
CREATE POLICY "Patients can update their own caregiver relationships" ON caregiver_relationships
    FOR UPDATE USING (auth.uid() = patient_id);

-- Policy for patients to delete their own caregiver relationships
CREATE POLICY "Patients can delete their own caregiver relationships" ON caregiver_relationships
    FOR DELETE USING (auth.uid() = patient_id);

-- Insert some sample data for testing (optional)
-- You can uncomment these lines to add sample caregivers for testing
/*
INSERT INTO public.caregiver_relationships (patient_id, caregiver_email, caregiver_name, relationship, status) VALUES 
(auth.uid(), 'dr.johnson@hospital.com', 'Dr. Sarah Johnson', 'Primary Care Physician', 'accepted'),
(auth.uid(), 'john.smith@family.com', 'John Smith', 'Family Member', 'accepted'),
(auth.uid(), 'emily.davis@cardio.com', 'Dr. Emily Davis', 'Cardiologist', 'accepted'),
(auth.uid(), 'michael.brown@care.com', 'Michael Brown', 'Home Health Aide', 'pending'),
(auth.uid(), 'lisa.wilson@neuro.com', 'Dr. Lisa Wilson', 'Neurologist', 'accepted'),
(auth.uid(), 'david.martinez@family.com', 'David Martinez', 'Family Member', 'declined');
*/
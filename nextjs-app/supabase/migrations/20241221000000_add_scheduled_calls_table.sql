-- Create scheduled_calls table for tracking demo calls and scheduled reminder calls
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_id UUID REFERENCES care_reminders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'no_answer', 'missed', 'cancelled')),
  call_attempts INTEGER DEFAULT 0,
  vapi_call_id TEXT,
  error_message TEXT,
  call_duration INTEGER, -- in seconds
  call_summary TEXT,
  notes TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS scheduled_calls_patient_id_idx ON scheduled_calls(patient_id);
CREATE INDEX IF NOT EXISTS scheduled_calls_caregiver_id_idx ON scheduled_calls(caregiver_id);
CREATE INDEX IF NOT EXISTS scheduled_calls_reminder_id_idx ON scheduled_calls(reminder_id);
CREATE INDEX IF NOT EXISTS scheduled_calls_scheduled_time_idx ON scheduled_calls(scheduled_time);
CREATE INDEX IF NOT EXISTS scheduled_calls_status_idx ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS scheduled_calls_is_demo_idx ON scheduled_calls(is_demo);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_calls_updated_at_trigger
    BEFORE UPDATE ON scheduled_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_calls_updated_at();

-- Enable RLS
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Caregivers can see calls they initiated
CREATE POLICY "Caregivers can view their own scheduled calls" ON scheduled_calls
  FOR SELECT
  USING (caregiver_id = auth.uid());

-- Caregivers can insert their own scheduled calls
CREATE POLICY "Caregivers can insert their own scheduled calls" ON scheduled_calls
  FOR INSERT
  WITH CHECK (caregiver_id = auth.uid());

-- Caregivers can update their own scheduled calls
CREATE POLICY "Caregivers can update their own scheduled calls" ON scheduled_calls
  FOR UPDATE
  USING (caregiver_id = auth.uid());

-- Patients can view calls scheduled for them
CREATE POLICY "Patients can view their scheduled calls" ON scheduled_calls
  FOR SELECT
  USING (patient_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage all scheduled calls" ON scheduled_calls
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add delivery_method column to care_reminders if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'care_reminders' 
        AND column_name = 'delivery_method'
    ) THEN
        ALTER TABLE care_reminders 
        ADD COLUMN delivery_method TEXT DEFAULT 'call' CHECK (delivery_method IN ('call', 'notification', 'email'));
    END IF;
END $$;
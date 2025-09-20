-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own todos
CREATE POLICY "Users can view own todos" ON todos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own todos
CREATE POLICY "Users can insert own todos" ON todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own todos
CREATE POLICY "Users can update own todos" ON todos
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own todos
CREATE POLICY "Users can delete own todos" ON todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create an index for better query performance
CREATE INDEX idx_todos_user_id ON todos(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

<<<<<<< Updated upstream
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE
  ON todos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
=======
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_user_profiles_user_type ON user_profiles(user_type);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Recordings Table
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  transcription TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recordings
CREATE POLICY "Users can view own recordings" ON recordings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" ON recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings" ON recordings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" ON recordings
  FOR DELETE USING (auth.uid() = user_id);

-- Updated at trigger for recordings
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);

-- Storage bucket for recordings (run this in Supabase Dashboard → Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

-- Storage policies (run this in Supabase Dashboard → Storage → recordings bucket → Policies)
-- CREATE POLICY "Users can upload own recordings" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own recordings" ON storage.objects
--   FOR SELECT USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete own recordings" ON storage.objects
--   FOR DELETE USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Caregiver Relationships Table
CREATE TABLE caregiver_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_email TEXT NOT NULL,
  caregiver_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE caregiver_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for caregiver relationships
CREATE POLICY "Patients can view own caregiver relationships" ON caregiver_relationships
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert own caregiver relationships" ON caregiver_relationships
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own caregiver relationships" ON caregiver_relationships
  FOR UPDATE USING (auth.uid() = patient_id);

CREATE POLICY "Patients can delete own caregiver relationships" ON caregiver_relationships
  FOR DELETE USING (auth.uid() = patient_id);

-- Updated at trigger for caregiver relationships
CREATE TRIGGER update_caregiver_relationships_updated_at
  BEFORE UPDATE ON caregiver_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_caregiver_relationships_patient_id ON caregiver_relationships(patient_id);
CREATE INDEX idx_caregiver_relationships_status ON caregiver_relationships(status);

-- Medical Reports Table
CREATE TABLE medical_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('appointment', 'lab_result', 'prescription', 'diagnosis')),
  content TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  doctor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical reports
CREATE POLICY "Users can view own medical reports" ON medical_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical reports" ON medical_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical reports" ON medical_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medical reports" ON medical_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Updated at trigger for medical reports
CREATE TRIGGER update_medical_reports_updated_at
  BEFORE UPDATE ON medical_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_medical_reports_user_id ON medical_reports(user_id);
CREATE INDEX idx_medical_reports_date ON medical_reports(date);
CREATE INDEX idx_medical_reports_type ON medical_reports(type);
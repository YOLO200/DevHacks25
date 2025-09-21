-- Simple Recordings Table
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'converting', 'ready', 'failed')),
  transcription TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

-- Row Level Security
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recordings" ON recordings
  FOR ALL USING (auth.uid() = user_id);
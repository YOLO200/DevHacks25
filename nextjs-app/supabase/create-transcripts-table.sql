-- Transcripts Table for tracking transcription jobs
CREATE TABLE transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transcription_text TEXT,
  summary TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transcripts_recording_id ON transcripts(recording_id);
CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);
CREATE INDEX idx_transcripts_created_at ON transcripts(created_at DESC);

-- Full-text search index for transcription content
CREATE INDEX idx_transcripts_text_search ON transcripts USING gin(to_tsvector('english', transcription_text));

-- Row Level Security
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;



-- Unique constraint to prevent duplicate transcripts for same recording
CREATE UNIQUE INDEX idx_transcripts_recording_unique ON transcripts(recording_id);
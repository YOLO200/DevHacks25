-- Add transcription and summary columns to recordings table
-- This migration adds the missing columns that are needed for transcription features

-- Add transcription column to store the text transcription of audio recordings
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Add summary column to store AI-generated summaries of recordings
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS summary TEXT;

-- Create index on transcription column for searching
CREATE INDEX IF NOT EXISTS idx_recordings_transcription ON recordings USING gin(to_tsvector('english', transcription));
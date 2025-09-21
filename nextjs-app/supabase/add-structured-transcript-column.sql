-- Add structured_transcript column to transcripts table
-- This column will store the AI-structured version with speaker labels

ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS structured_transcript TEXT;
-- Remove transcription and summary columns from recordings table
-- These will now be handled by the separate transcripts table

-- Drop the transcription column if it exists
ALTER TABLE recordings DROP COLUMN IF EXISTS transcription;

-- Drop the summary column if it exists  
ALTER TABLE recordings DROP COLUMN IF EXISTS summary;

-- Drop the speaker_segments column if it exists
ALTER TABLE recordings DROP COLUMN IF EXISTS speaker_segments;

-- Drop any indexes related to transcription
DROP INDEX IF EXISTS idx_recordings_transcription;
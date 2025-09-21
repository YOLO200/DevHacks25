-- Add shared_caregivers column to transcripts table
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS shared_caregivers UUID[] DEFAULT ARRAY[]::UUID[];

-- Update RLS policies for transcripts to include shared access
DROP POLICY IF EXISTS "Users can view their own transcripts or shared ones" ON transcripts;

CREATE POLICY "Users can view their own transcripts or shared ones" ON transcripts
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() = ANY(shared_caregivers)
    );

-- Policy for users to update their own transcripts (including sharing)
DROP POLICY IF EXISTS "Users can update their own transcripts" ON transcripts;

CREATE POLICY "Users can update their own transcripts" ON transcripts
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to insert their own transcripts
DROP POLICY IF EXISTS "Users can insert their own transcripts" ON transcripts;

CREATE POLICY "Users can insert their own transcripts" ON transcripts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own transcripts
DROP POLICY IF EXISTS "Users can delete their own transcripts" ON transcripts;

CREATE POLICY "Users can delete their own transcripts" ON transcripts
    FOR DELETE USING (auth.uid() = user_id);

-- Policy for server operations (allow server to create/update regardless of auth.uid())
DROP POLICY IF EXISTS "Server operations on transcripts" ON transcripts;

CREATE POLICY "Server operations on transcripts" ON transcripts
    FOR ALL USING (auth.uid() IS NULL);

-- Create index for shared_caregivers for better query performance
CREATE INDEX IF NOT EXISTS idx_transcripts_shared_caregivers ON transcripts USING gin(shared_caregivers);
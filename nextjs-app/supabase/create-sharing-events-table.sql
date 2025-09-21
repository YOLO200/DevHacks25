-- Create sharing_events table to track when reports/transcripts are shared
CREATE TABLE IF NOT EXISTS sharing_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- What was shared
    medical_report_id UUID REFERENCES medical_reports(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,

    -- Who shared it and with whom
    shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    shared_with_email TEXT NOT NULL,

    -- Sharing details
    sharing_type VARCHAR(20) NOT NULL CHECK (sharing_type IN ('medical_report', 'transcript', 'both')),
    included_in_email BOOLEAN DEFAULT FALSE,
    custom_message TEXT,

    -- Timestamps
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sharing_events_medical_report_id ON sharing_events(medical_report_id);
CREATE INDEX IF NOT EXISTS idx_sharing_events_transcript_id ON sharing_events(transcript_id);
CREATE INDEX IF NOT EXISTS idx_sharing_events_shared_by_user_id ON sharing_events(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_events_shared_with_email ON sharing_events(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_sharing_events_shared_at ON sharing_events(shared_at DESC);

-- Row Level Security
ALTER TABLE sharing_events ENABLE ROW LEVEL SECURITY;

-- Policy for users to see sharing events where they are the sharer or recipient
CREATE POLICY "Users can view sharing events they're involved in" ON sharing_events
    FOR SELECT USING (
        auth.uid() = shared_by_user_id OR
        auth.uid() IN (
            SELECT id FROM auth.users WHERE email = shared_with_email
        )
    );

-- Policy for users to insert sharing events they create
CREATE POLICY "Users can insert their own sharing events" ON sharing_events
    FOR INSERT WITH CHECK (auth.uid() = shared_by_user_id);

-- Policy for server operations
CREATE POLICY "Server operations on sharing events" ON sharing_events
    FOR ALL USING (auth.uid() IS NULL);
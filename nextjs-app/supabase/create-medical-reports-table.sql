-- Create medical_reports table
CREATE TABLE IF NOT EXISTS medical_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Report content
    patient_demographics JSONB DEFAULT '{}'::jsonb,
    chief_complaint TEXT,
    hpi_details JSONB DEFAULT '{}'::jsonb,
    medical_history JSONB DEFAULT '{}'::jsonb,
    soap_note TEXT,
    red_flags TEXT[],
    patient_summary TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Sharing
    shared_caregivers UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_medical_reports_transcript_id ON medical_reports(transcript_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_recording_id ON medical_reports(recording_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_user_id ON medical_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_status ON medical_reports(status);
CREATE INDEX IF NOT EXISTS idx_medical_reports_created_at ON medical_reports(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own medical reports
CREATE POLICY "Users can view their own medical reports" ON medical_reports
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() = ANY(shared_caregivers)
    );

-- Policy for users to insert their own medical reports
CREATE POLICY "Users can insert their own medical reports" ON medical_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own medical reports
CREATE POLICY "Users can update their own medical reports" ON medical_reports
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own medical reports
CREATE POLICY "Users can delete their own medical reports" ON medical_reports
    FOR DELETE USING (auth.uid() = user_id);

-- Policy for server operations (allow server to create/update regardless of auth.uid())
CREATE POLICY "Server operations on medical reports" ON medical_reports
    FOR ALL USING (auth.uid() IS NULL);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_medical_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_medical_reports_updated_at
    BEFORE UPDATE ON medical_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_medical_reports_updated_at();
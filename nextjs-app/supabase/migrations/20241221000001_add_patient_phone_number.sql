-- Add patient_phone_number column to user_profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'patient_phone_number'
    ) THEN
        ALTER TABLE user_profiles 
        ADD COLUMN patient_phone_number TEXT;
    END IF;
END $$;

-- Add an index for phone number lookups
CREATE INDEX IF NOT EXISTS user_profiles_patient_phone_number_idx ON user_profiles(patient_phone_number);
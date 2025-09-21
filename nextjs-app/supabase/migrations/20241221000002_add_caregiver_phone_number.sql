-- Add caregiver_phone_number column to user_profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'caregiver_phone_number'
    ) THEN
        ALTER TABLE user_profiles 
        ADD COLUMN caregiver_phone_number TEXT;
    END IF;
END $$;

-- Add an index for caregiver phone number lookups
CREATE INDEX IF NOT EXISTS user_profiles_caregiver_phone_number_idx ON user_profiles(caregiver_phone_number);
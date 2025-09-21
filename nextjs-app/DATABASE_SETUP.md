# Database Setup Guide

## 🚨 **IMPORTANT: Run This First**

The application is currently showing 404 errors because the database tables don't exist yet. Follow these steps to set up your database:

## Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/project/ojspmpczbuxlntxxcpde)
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **"New Query"**

## Step 2: Create Tables

Copy and paste the following SQL in the editor and click **"Run"**:

```sql
-- User Profiles Table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('patient', 'caregiver')),
  patient_phone_number TEXT,
  caregiver_phone_number TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Additional policy for caregivers to view patient profiles they have relationships with
CREATE POLICY "Caregivers can view patient profiles they have relationships with" ON user_profiles
  FOR SELECT USING (
    user_type = 'patient' AND
    EXISTS (
      SELECT 1 FROM caregiver_relationships
      WHERE caregiver_relationships.patient_id = user_profiles.id
      AND caregiver_relationships.status = 'accepted'
      AND caregiver_relationships.caregiver_email = (
        SELECT email FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_type = 'caregiver'
      )
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_user_profiles_user_type ON user_profiles(user_type);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Recordings Table
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  transcription TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recordings
CREATE POLICY "Users can view own recordings" ON recordings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings" ON recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings" ON recordings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings" ON recordings
  FOR DELETE USING (auth.uid() = user_id);

-- Additional policy for caregivers to view recordings of their patients
CREATE POLICY "Caregivers can view recordings of their patients" ON recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM caregiver_relationships
      WHERE caregiver_relationships.patient_id = recordings.user_id
      AND caregiver_relationships.status = 'accepted'
      AND 'view_recordings' = ANY(caregiver_relationships.permissions)
      AND caregiver_relationships.caregiver_email = (
        SELECT email FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_type = 'caregiver'
      )
    )
  );

-- Updated at trigger for recordings
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);

-- Caregiver Relationships Table
CREATE TABLE caregiver_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_email TEXT NOT NULL,
  caregiver_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE caregiver_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for caregiver relationships
CREATE POLICY "Patients can view own caregiver relationships" ON caregiver_relationships
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert own caregiver relationships" ON caregiver_relationships
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own caregiver relationships" ON caregiver_relationships
  FOR UPDATE USING (auth.uid() = patient_id);

CREATE POLICY "Patients can delete own caregiver relationships" ON caregiver_relationships
  FOR DELETE USING (auth.uid() = patient_id);

-- Additional policies for caregivers to view relationships where they are the caregiver
CREATE POLICY "Caregivers can view relationships where they are the caregiver" ON caregiver_relationships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'caregiver'
      AND user_profiles.email = caregiver_relationships.caregiver_email
    )
  );

CREATE POLICY "Caregivers can update relationships where they are the caregiver" ON caregiver_relationships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'caregiver'
      AND user_profiles.email = caregiver_relationships.caregiver_email
    )
  );

CREATE POLICY "Caregivers can delete relationships where they are the caregiver" ON caregiver_relationships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'caregiver'
      AND user_profiles.email = caregiver_relationships.caregiver_email
    )
  );

-- Updated at trigger for caregiver relationships
CREATE TRIGGER update_caregiver_relationships_updated_at
  BEFORE UPDATE ON caregiver_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_caregiver_relationships_patient_id ON caregiver_relationships(patient_id);
CREATE INDEX idx_caregiver_relationships_status ON caregiver_relationships(status);

-- Medical Reports Table
CREATE TABLE medical_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('appointment', 'lab_result', 'prescription', 'diagnosis')),
  content TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  doctor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical reports
CREATE POLICY "Users can view own medical reports" ON medical_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical reports" ON medical_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical reports" ON medical_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medical reports" ON medical_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Additional policy for caregivers to view medical reports of their patients
CREATE POLICY "Caregivers can view medical reports of their patients" ON medical_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM caregiver_relationships
      WHERE caregiver_relationships.patient_id = medical_reports.user_id
      AND caregiver_relationships.status = 'accepted'
      AND 'view_reports' = ANY(caregiver_relationships.permissions)
      AND caregiver_relationships.caregiver_email = (
        SELECT email FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_type = 'caregiver'
      )
    )
  );

-- Updated at trigger for medical reports
CREATE TRIGGER update_medical_reports_updated_at
  BEFORE UPDATE ON medical_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX idx_medical_reports_user_id ON medical_reports(user_id);
CREATE INDEX idx_medical_reports_date ON medical_reports(date);
CREATE INDEX idx_medical_reports_type ON medical_reports(type);

```

## Step 3: Create Storage Bucket for Recordings

1. Navigate to **Storage** in the Supabase dashboard
2. Click **"New Bucket"**
3. Name it `recordings`
4. Set it to **Private** (not public)
5. Click **"Create bucket"**

## Step 4: Set Storage Policies

Go to the `recordings` bucket → **Policies** and add these policies:

```sql
-- Policy 1: Users can upload own recordings
CREATE POLICY "Users can upload own recordings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy 2: Users can view own recordings
CREATE POLICY "Users can view own recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy 3: Users can delete own recordings
CREATE POLICY "Users can delete own recordings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Step 5: Verify Setup

After running the SQL:

1. Check **Database** → **Tables** - you should see:

   - `user_profiles`
   - `recordings`
   - `caregiver_relationships`
   - `medical_reports`

2. Check **Storage** → you should see:
   - `recordings` bucket

## Step 6: Test the Application

1. Refresh your application at http://localhost:3000
2. The 404 errors should be gone
3. Try creating a new account and using the features

## ✅ **Expected Results After Setup:**

- ✅ No more 404 errors in console
- ✅ User registration creates profile automatically
- ✅ Dashboard loads without errors
- ✅ Voice recording works (after microphone permission)
- ✅ Caregivers page loads
- ✅ Reports page loads

## 🚨 **If You Still Get Errors:**

1. **Check RLS is enabled** on all tables
2. **Verify policies exist** for each table
3. **Make sure storage bucket exists** and is named `recordings`
4. **Check your environment variables** are correct
5. **Try logging out and back in** to refresh auth state

## 📞 **Need Help?**

If you encounter issues:

1. Check the Supabase dashboard logs
2. Verify your project URL and API keys
3. Make sure you're on the correct Supabase project

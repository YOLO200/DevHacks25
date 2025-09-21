-- Storage bucket policies for "doctor's note" bucket
-- Run this in your Supabase SQL editor to fix upload permissions

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor''s note', 'doctor''s note', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to their own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'doctor''s note' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'doctor''s note' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'doctor''s note' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'doctor''s note' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure the bucket allows audio file types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'audio/mpeg', 
  'audio/mp3', 
  'audio/wav', 
  'audio/x-wav', 
  'audio/mp4', 
  'audio/m4a',
  'audio/webm'
] 
WHERE id = 'doctor''s note';
-- CREATE AUDIT-IMAGES STORAGE BUCKET
-- Run this in Supabase SQL Editor to create the storage bucket for audit images

-- 1. Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audit-images',
    'audit-images',
    true,  -- Make bucket public so images can be accessed
    5242880,  -- 5MB file size limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS policies for the bucket
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to audit-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audit-images');

-- Allow public read access
CREATE POLICY "Allow public read access to audit-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'audit-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated updates to audit-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audit-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes from audit-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audit-images');

-- 3. Grant permissions
GRANT ALL ON storage.buckets TO postgres;
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.buckets TO service_role;

GRANT ALL ON storage.objects TO postgres;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO service_role;

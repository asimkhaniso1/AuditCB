-- Create Audit Images Storage Bucket
-- Run this in Supabase SQL Editor

-- Create the storage bucket for audit images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audit-images',
    'audit-images',
    false,  -- Private bucket (only authenticated users can access)
    10485760,  -- 10MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[];

-- Create the storage bucket for audit reports (PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audit-reports',
    'audit-reports',
    false,  -- Private bucket
    52428800,  -- 50MB max file size for reports
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[];

-- Storage Policies for audit-images bucket

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload audit images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audit-images');

-- Allow authenticated users to read their own uploads
CREATE POLICY "Authenticated users can view audit images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audit-images');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update audit images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audit-images');

-- Allow managers and admins to delete files
CREATE POLICY "Managers can delete audit images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'audit-images'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Storage Policies for audit-reports bucket

CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audit-reports');

CREATE POLICY "Authenticated users can view reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audit-reports');

CREATE POLICY "Authenticated users can update reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audit-reports');

CREATE POLICY "Managers can delete reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'audit-reports'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('Admin', 'Certification Manager')
    )
);

-- Verify buckets were created
SELECT * FROM storage.buckets WHERE id IN ('audit-images', 'audit-reports');

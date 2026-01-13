-- CREATE STORAGE BUCKETS FOR DOCUMENTS AND CHECKLISTS
-- Run this in Supabase SQL Editor

-- 1. Create 'documents' bucket for ISO Standards, SOPs, and Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    true,  -- Public bucket for easy access
    10485760,  -- 10MB file size limit
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];

-- 2. Create 'checklists' bucket for imported checklist CSV files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'checklists',
    'checklists',
    true,  -- Public bucket
    5242880,  -- 5MB file size limit
    ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

-- 3. Set up RLS policies for documents bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Allow public read access to documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Allow authenticated updates to documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY IF NOT EXISTS "Allow authenticated deletes from documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- 4. Set up RLS policies for checklists bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to checklists"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklists');

CREATE POLICY IF NOT EXISTS "Allow public read access to checklists"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'checklists');

CREATE POLICY IF NOT EXISTS "Allow authenticated updates to checklists"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'checklists');

CREATE POLICY IF NOT EXISTS "Allow authenticated deletes from checklists"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'checklists');

-- 5. Grant permissions
GRANT ALL ON storage.buckets TO postgres, anon, authenticated, service_role;
GRANT ALL ON storage.objects TO postgres, anon, authenticated, service_role;

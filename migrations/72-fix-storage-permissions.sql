-- Ensure audit-files bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-files', 'audit-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove potentially conflicting or restrictive policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own files" ON storage.objects;

-- Policy 1: Allow Public Read (Anyone can view logos)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'audit-files' );

-- Policy 2: Allow Authenticated Insert
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'audit-files' AND auth.role() = 'authenticated' );

-- Policy 3: Allow Authenticated Update (Overwrite/Replace)
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'audit-files' AND auth.role() = 'authenticated' );

-- Policy 4: Allow Authenticated Delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'audit-files' AND auth.role() = 'authenticated' );

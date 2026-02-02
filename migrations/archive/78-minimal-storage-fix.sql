-- ==========================================
-- 78. STORAGE PERMISSIONS FIX (UI FALLBACK)
-- ==========================================

-- This script ONLY targets the 'audit-logos' bucket policies.
-- If this fails, please use the Supabase Dashboard UI steps provided.

-- 1. Create a policy for public read
DROP POLICY IF EXISTS "Public Access Select" ON storage.objects;
CREATE POLICY "Public Access Select" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'audit-logos' );

-- 2. Create a policy for public insert (allowing anyone to upload for now)
DROP POLICY IF EXISTS "Public Access Insert" ON storage.objects;
CREATE POLICY "Public Access Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'audit-logos' );

-- 3. Create a policy for public update
DROP POLICY IF EXISTS "Public Access Update" ON storage.objects;
CREATE POLICY "Public Access Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'audit-logos' );

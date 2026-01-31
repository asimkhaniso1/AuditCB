-- ==========================================
-- 77. STORAGE PERMISSIONS FIX (SIMPLIFIED)
-- ==========================================

-- 1. Ensure 'audit-logos' bucket exists and is public
-- We use standard commands that should work in most Supabase environments
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-logos', 'audit-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Grant schema-level permissions
-- These are usually safe if run as the 'postgres' role in Supabase
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO postgres, anon, authenticated, service_role;

-- 3. Set permissive policies for 'audit-logos'
-- Note: 'ALTER TABLE' might fail if you aren't the owner, but policies can often be managed
-- We drop old policies by name instead of touching system catalogs

DROP POLICY IF EXISTS "Global Permissive Select" ON storage.objects;
CREATE POLICY "Global Permissive Select" ON storage.objects FOR SELECT USING (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "Global Permissive Insert" ON storage.objects;
CREATE POLICY "Global Permissive Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "Global Permissive Update" ON storage.objects;
CREATE POLICY "Global Permissive Update" ON storage.objects FOR UPDATE USING (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "Global Permissive Delete" ON storage.objects;
CREATE POLICY "Global Permissive Delete" ON storage.objects FOR DELETE USING (bucket_id = 'audit-logos');

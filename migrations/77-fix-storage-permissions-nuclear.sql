-- ==========================================
-- 77. NUCLEAR STORAGE PERMISSIONS FIX (V2)
-- ==========================================

-- 1. Ensure ALL relevant buckets exist and are public
DO $$
DECLARE
    bucket_name TEXT;
    buckets TEXT[] := ARRAY['audit-files', 'audit-logos', 'audit-reports', 'documents', 'checklists'];
BEGIN
    FOREACH bucket_name IN ARRAY buckets LOOP
        INSERT INTO storage.buckets (id, name, public)
        VALUES (bucket_name, bucket_name, true)
        ON CONFLICT (id) DO UPDATE SET public = true;
    END LOOP;
END $$;

-- 2. Grant schema-level permissions to ensure storage functions work
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO postgres, anon, authenticated, service_role;

-- 3. Enable RLS and set permissive policies for ALL buckets
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Delete existing policies to avoid conflicts
DELETE FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%Permissive%';
DROP POLICY IF EXISTS "Emergency Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read Audit Files" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Audit Files Auth" ON storage.objects;

-- Create broad policies for ALL buckets (Anyone can do anything for now to debug)
-- We use a single policy set that covers all buckets for simplicity in debugging
DROP POLICY IF EXISTS "Global Permissive Select" ON storage.objects;
CREATE POLICY "Global Permissive Select" ON storage.objects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Global Permissive Insert" ON storage.objects;
CREATE POLICY "Global Permissive Insert" ON storage.objects FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Global Permissive Update" ON storage.objects;
CREATE POLICY "Global Permissive Update" ON storage.objects FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Global Permissive Delete" ON storage.objects;
CREATE POLICY "Global Permissive Delete" ON storage.objects FOR DELETE USING (true);

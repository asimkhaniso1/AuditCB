-- ==========================================
-- 74. FIX RLS PERMISSIONS (DEBUGGING)
-- ==========================================

-- 1. CERTIFICATION DECISIONS
ALTER TABLE public.certification_decisions ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations for authenticated users (Debugging)
DROP POLICY IF EXISTS "Allow All Cert Decisions Auth" ON public.certification_decisions;
CREATE POLICY "Allow All Cert Decisions Auth"
ON public.certification_decisions
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Also allow Anon read if needed
DROP POLICY IF EXISTS "Allow Public Read Cert Decisions" ON public.certification_decisions;
CREATE POLICY "Allow Public Read Cert Decisions"
ON public.certification_decisions
FOR SELECT
USING (true);


-- 2. STORAGE (Audit Files)
-- Ensure the bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'audit-files';

-- Allow ALL operations for authenticated users on 'audit-files'
DROP POLICY IF EXISTS "Allow All Audit Files Auth" ON storage.objects;
CREATE POLICY "Allow All Audit Files Auth"
ON storage.objects
FOR ALL
USING (bucket_id = 'audit-files' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'audit-files' AND auth.role() = 'authenticated');

-- Start fresh for 'audit-files' public read
DROP POLICY IF EXISTS "Allow Public Read Audit Files" ON storage.objects;
CREATE POLICY "Allow Public Read Audit Files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audit-files');

-- 3. CLIENTS TABLE
-- Ensure clients table is writable
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Clients Auth" ON public.clients;
CREATE POLICY "Allow All Clients Auth"
ON public.clients
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');


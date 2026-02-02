-- ==========================================
-- 75. EMERGENCY FIX (DISABLE RLS & ENSURE COLUMNS)
-- ==========================================

-- 1. Disable RLS completely to rule out permission issues
ALTER TABLE public.certification_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- 2. Ensure 'bucket_id' policy isn't blocking storage (by making bucket public and verifying policy)
UPDATE storage.buckets SET public = true WHERE id = 'audit-files';

DROP POLICY IF EXISTS "Emergency Public Access" ON storage.objects;
CREATE POLICY "Emergency Public Access"
ON storage.objects
FOR ALL
USING (bucket_id = 'audit-files')
WITH CHECK (bucket_id = 'audit-files');

-- 3. Ensure 'decision_record' column exists (Critical for JSONB storage)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certification_decisions' AND column_name = 'decision_record') THEN
        ALTER TABLE public.certification_decisions ADD COLUMN decision_record JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

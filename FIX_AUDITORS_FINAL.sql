-- ============================================
-- FINAL AUDITOR SCHEMA AND RLS SECURITY FIX
-- ============================================
-- This script ensures the auditors and auditor_assignments tables
-- are correctly structured and secured with RLS.

-- 1. FIX AUDITORS TABLE SCHEMA
-- Convert ID to TEXT to match JS Date.now() generation
ALTER TABLE public.auditors ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Add missing columns for ISO competence tracking
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS standards TEXT[] DEFAULT '{}';
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}';
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}';
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS man_day_rate NUMERIC DEFAULT 0;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. FIX AUDITOR_ASSIGNMENTS TABLE SCHEMA
-- Create table if missing (should exist but let's be safe)
CREATE TABLE IF NOT EXISTS public.auditor_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auditor_id, client_id)
);

-- Ensure types match
ALTER TABLE public.auditor_assignments ALTER COLUMN auditor_id TYPE TEXT USING auditor_id::TEXT;
ALTER TABLE public.auditor_assignments ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditor_assignments ENABLE ROW LEVEL SECURITY;

-- 4. APPLY RLS POLICIES (Authenticated Only)

-- Auditors Table Policies
DROP POLICY IF EXISTS "Allow all operations on auditors" ON public.auditors;
DROP POLICY IF EXISTS "Authenticated users can view auditors" ON public.auditors;
DROP POLICY IF EXISTS "Authenticated users can insert auditors" ON public.auditors;
DROP POLICY IF EXISTS "Authenticated users can update auditors" ON public.auditors;
DROP POLICY IF EXISTS "Authenticated users can delete auditors" ON public.auditors;

CREATE POLICY "Authenticated users can view auditors" ON public.auditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auditors" ON public.auditors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auditors" ON public.auditors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete auditors" ON public.auditors FOR DELETE TO authenticated USING (true);

-- Auditor Assignments Table Policies
DROP POLICY IF EXISTS "Allow all operations on auditor_assignments" ON public.auditor_assignments;
DROP POLICY IF EXISTS "Authenticated users can view auditor_assignments" ON public.auditor_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert auditor_assignments" ON public.auditor_assignments;
DROP POLICY IF EXISTS "Authenticated users can update auditor_assignments" ON public.auditor_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete auditor_assignments" ON public.auditor_assignments;

CREATE POLICY "Authenticated users can view auditor_assignments" ON public.auditor_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auditor_assignments" ON public.auditor_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auditor_assignments" ON public.auditor_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete auditor_assignments" ON public.auditor_assignments FOR DELETE TO authenticated USING (true);

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- Verification
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename IN ('auditors', 'auditor_assignments');

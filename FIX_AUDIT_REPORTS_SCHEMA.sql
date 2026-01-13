-- FIX MISSING COLUMNS FOR audit_reports
-- Run this in Supabase SQL Editor to fix "Could not find 'audit_date' column" error

-- 1. Add missing columns used in execution-module.js
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS audit_date DATE;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS findings_count INTEGER DEFAULT 0;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS checklist_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Enable RLS and Grant Access (Ensures RLS doesn't block unsigned users if policy exists)
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_reports TO postgres;
GRANT ALL ON public.audit_reports TO anon;
GRANT ALL ON public.audit_reports TO authenticated;
GRANT ALL ON public.audit_reports TO service_role;

-- 3. Reload cache to apply changes immediately
NOTIFY pgrst, 'reload schema';

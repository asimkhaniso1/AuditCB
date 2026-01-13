-- Comprehensive Fix for audit_plans table
-- Run this in Supabase SQL Editor

-- 1. Add 'data' column (JSONB storage for full plan)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Add 'plan_date' column (Required for filtering/sorting)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS plan_date DATE;

-- 3. Add 'client_id' column (ForeignKey link)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 4. Add 'client_name' column (Denormalized for easy access)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS client_name TEXT;

-- 5. Add 'type' column (Audit Type: Stage 1, Stage 2, etc.)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS type TEXT;

-- 6. Add 'lead_auditor' column
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS lead_auditor TEXT;

-- 7. Add 'status' column
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS status TEXT;

-- 8. Force Schema Cache Reload (Crucial for "Could not find column" errors)
NOTIFY pgrst, 'reload schema';

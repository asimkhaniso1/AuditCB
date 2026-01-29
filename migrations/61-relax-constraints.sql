-- RELAX CONSTRAINTS: Allow NULL for tracking fields
-- This fixes "violates not-null constraint" and "invalid input syntax" errors
-- when the frontend doesn't have a valid User ID ready.

-- 1. CLIENTS Table
ALTER TABLE public.clients ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN updated_by DROP NOT NULL;

-- 2. SETTINGS Table
ALTER TABLE public.settings ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.settings ALTER COLUMN updated_by DROP NOT NULL;

-- 3. AUDIT PLANS Table
ALTER TABLE public.audit_plans ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.audit_plans ALTER COLUMN updated_by DROP NOT NULL;

-- 4. AUDIT REPORTS Table
ALTER TABLE public.audit_reports ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.audit_reports ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.audit_reports ALTER COLUMN auditor_id DROP NOT NULL; -- Often causes issues if auditor deleted

-- 5. CHECKLISTS Table
ALTER TABLE public.checklists ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.checklists ALTER COLUMN updated_by DROP NOT NULL;

-- 6. AUDITORS Table (If exists)
ALTER TABLE public.auditors ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.auditors ALTER COLUMN updated_by DROP NOT NULL;

-- Verification
SELECT 'Constraints Relaxed Successfully' as status;

-- ============================================
-- CLEAN SLATE: REMOVE DEMO DATA
-- Run this to remove mock clients and assignments
-- ============================================

-- 1. Remove all records from clients and their assignments
-- CASCADE will also clear related records if foreign keys are set
TRUNCATE TABLE public.clients CASCADE;
TRUNCATE TABLE public.auditor_assignments CASCADE;

-- 2. Optional: Clear other demo-heavy tables if you want a totally fresh start
-- TRUNCATE TABLE public.audit_plans CASCADE;
-- TRUNCATE TABLE public.audit_reports CASCADE;
-- TRUNCATE TABLE public.certification_decisions CASCADE;

-- 3. Verification
SELECT 'Total clients remaining:' as info, COUNT(*) FROM public.clients;
SELECT 'Total assignments remaining:' as info, COUNT(*) FROM public.auditor_assignments;

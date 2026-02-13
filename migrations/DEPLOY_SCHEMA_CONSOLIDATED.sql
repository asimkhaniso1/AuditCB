-- ============================================
-- CONSOLIDATED SAFE SCHEMA DEPLOYMENT
-- ============================================
-- Version: 1.0
-- Date: 2026-01-16
-- Purpose: Safely add missing columns and standardize schema
-- 
-- IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING!
-- Recommended: Test in development environment first
--
-- This script uses SAFE operations:
-- - ADD COLUMN IF NOT EXISTS (never drops data)
-- - Nullable columns (no data migration needed)
-- - TEXT type for all IDs (matches application code)
-- ============================================

-- ============================================
-- PART 1: AUDITORS TABLE
-- ============================================

-- Add JSONB data column for full auditor profile
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Add email for notifications and user linking
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add role column
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS role TEXT;

-- Add standards (stored as TEXT, app handles parsing)
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS standards TEXT;

-- Add tenancy tracking
ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.auditors 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 2: CLIENTS TABLE
-- ============================================

-- Ensure standard columns exist
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Add tenancy tracking
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 3: AUDIT_PLANS TABLE
-- ============================================

-- Core required columns (using TEXT for IDs)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS standard TEXT;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS lead_auditor TEXT;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Planned';

-- Link to report (TEXT to match app)
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS report_id TEXT;

-- JSONB columns for complex data
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS audit_team JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS selected_checklists JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Tenancy tracking
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 4: AUDIT_REPORTS TABLE
-- ============================================

-- Core required columns (using TEXT for IDs)
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS plan_id TEXT;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';

-- Findings tracking
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS findings INTEGER DEFAULT 0;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS conformities INTEGER DEFAULT 0;

-- JSONB columns for execution data
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS ncrs JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Meeting records (ISO 17021-1 compliance)
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;

-- Report content
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS conclusion TEXT;

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- Tenancy tracking
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for audit_reports
CREATE INDEX IF NOT EXISTS idx_audit_reports_client_id 
ON public.audit_reports(client_id);

CREATE INDEX IF NOT EXISTS idx_audit_reports_plan_id 
ON public.audit_reports(plan_id);

CREATE INDEX IF NOT EXISTS idx_audit_reports_date 
ON public.audit_reports(date);

CREATE INDEX IF NOT EXISTS idx_audit_reports_status 
ON public.audit_reports(status);

CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by 
ON public.audit_reports(created_by);

-- Indexes for audit_plans
CREATE INDEX IF NOT EXISTS idx_audit_plans_client_id 
ON public.audit_plans(client_id);

CREATE INDEX IF NOT EXISTS idx_audit_plans_date 
ON public.audit_plans(date);

CREATE INDEX IF NOT EXISTS idx_audit_plans_status 
ON public.audit_plans(status);

CREATE INDEX IF NOT EXISTS idx_audit_plans_created_by 
ON public.audit_plans(created_by);

-- Indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_created_by 
ON public.clients(created_by);

-- Indexes for auditors
CREATE INDEX IF NOT EXISTS idx_auditors_email 
ON public.auditors(email);

CREATE INDEX IF NOT EXISTS idx_auditors_created_by 
ON public.auditors(created_by);

-- ============================================
-- PART 6: ENABLE RLS (OPTIONAL)
-- ============================================
-- Uncomment these lines if you want Row Level Security
-- WARNING: This will restrict access! Make sure you have policies defined.

-- ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 7: RELOAD SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================
-- PART 8: VERIFICATION QUERIES
-- ============================================

-- Check auditors columns
SELECT 'auditors columns:' as table_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'auditors'
ORDER BY ordinal_position;

-- Check clients columns
SELECT 'clients columns:' as table_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY ordinal_position;

-- Check audit_plans columns
SELECT 'audit_plans columns:' as table_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'audit_plans'
ORDER BY ordinal_position;

-- Check audit_reports columns
SELECT 'audit_reports columns:' as table_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'audit_reports'
ORDER BY ordinal_position;

-- Check indexes
SELECT 'Indexes created:' as info;
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('auditors', 'clients', 'audit_plans', 'audit_reports')
ORDER BY tablename, indexname;

-- ============================================
-- DEPLOYMENT COMPLETE
-- ============================================
-- All schema updates applied safely.
-- Review the verification output above.
-- If using RLS, deploy REFINE_RLS_POLICIES.sql next.
-- ============================================

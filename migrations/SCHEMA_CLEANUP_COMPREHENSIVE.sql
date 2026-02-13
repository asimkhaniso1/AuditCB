-- ============================================
-- COMPREHENSIVE SCHEMA CLEANUP & STANDARDIZATION
-- ============================================
-- This script fixes duplicate columns, adds tenancy, and standardizes the schema
-- BACKUP YOUR DATA BEFORE RUNNING THIS SCRIPT!

-- ============================================
-- PART 1: STANDARDIZE audit_reports TABLE
-- ============================================

-- Step 1: Drop duplicate/redundant columns (keep the standardized ones)
ALTER TABLE audit_reports DROP COLUMN IF EXISTS client CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_date CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_plan_id CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS findings_count CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS checklist_data CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS auditType CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS leadAuditor CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_type CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS lead_auditor CASCADE;

-- Step 2: Ensure required columns exist with correct names
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS findings INTEGER DEFAULT 0;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS opening_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS closing_meeting JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS ncrs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS conformities INTEGER DEFAULT 0;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS conclusion TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- Step 3: Add tenancy/audit columns
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 2: STANDARDIZE audit_plans TABLE
-- ============================================

-- Drop duplicates
ALTER TABLE audit_plans DROP COLUMN IF EXISTS client CASCADE;
ALTER TABLE audit_plans DROP COLUMN IF EXISTS plan_date CASCADE;
ALTER TABLE audit_plans DROP COLUMN IF EXISTS auditor_ids CASCADE;

-- Ensure standard columns
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS standard TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS lead_auditor TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS audit_team JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Planned';
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS checklist_config JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS selected_checklists JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS man_days NUMERIC DEFAULT 0;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add tenancy
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 3: STANDARDIZE clients TABLE
-- ============================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 4: STANDARDIZE auditors TABLE
-- ============================================

ALTER TABLE auditors ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 5: CREATE MISSING TABLES
-- ============================================

-- Profiles table (for user role management)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'Auditor',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditor assignments (for multi-tenancy)
CREATE TABLE IF NOT EXISTS auditor_assignments (
    id BIGSERIAL PRIMARY KEY,
    auditor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(auditor_id, client_id)
);

-- ============================================
-- PART 6: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- audit_reports indexes
CREATE INDEX IF NOT EXISTS idx_audit_reports_client_id ON audit_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_plan_id ON audit_reports(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by ON audit_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON audit_reports(date);

-- audit_plans indexes
CREATE INDEX IF NOT EXISTS idx_audit_plans_client_id ON audit_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_created_by ON audit_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_plans_date ON audit_plans(date);

-- auditor_assignments indexes
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_auditor ON auditor_assignments(auditor_id);
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_client ON auditor_assignments(client_id);

-- ============================================
-- PART 7: ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 8: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_or_cert_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get auditor ID for current user
CREATE OR REPLACE FUNCTION public.get_my_auditor_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT id::TEXT FROM public.auditors WHERE email = auth.email() LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- PART 9: CREATE RLS POLICIES
-- ============================================

-- CLIENTS POLICIES
DROP POLICY IF EXISTS "Clients access" ON public.clients;
CREATE POLICY "Clients access" ON public.clients
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id = get_my_auditor_id()
    AND client_id = public.clients.id::TEXT
  )
)
WITH CHECK (is_admin_or_cert_manager());

-- AUDIT PLANS POLICIES
DROP POLICY IF EXISTS "Audit plans access" ON public.audit_plans;
CREATE POLICY "Audit plans access" ON public.audit_plans
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id = get_my_auditor_id()
    AND client_id = public.audit_plans.client_id
  )
)
WITH CHECK (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id = get_my_auditor_id()
    AND client_id = public.audit_plans.client_id
  )
);

-- AUDIT REPORTS POLICIES
DROP POLICY IF EXISTS "Audit reports access" ON public.audit_reports;
CREATE POLICY "Audit reports access" ON public.audit_reports
FOR ALL TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id = get_my_auditor_id()
    AND client_id = public.audit_reports.client_id
  )
)
WITH CHECK (
  is_admin_or_cert_manager() OR 
  EXISTS (
    SELECT 1 FROM public.auditor_assignments 
    WHERE auditor_id = get_my_auditor_id()
    AND client_id = public.audit_reports.client_id
  )
);

-- AUDITORS POLICIES (all can see, only admins can modify)
DROP POLICY IF EXISTS "Auditors access" ON public.auditors;
CREATE POLICY "Auditors access" ON public.auditors
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Auditors manage" ON public.auditors;
CREATE POLICY "Auditors manage" ON public.auditors
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
CREATE POLICY "Profiles visibility" ON public.profiles
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Profiles self-update" ON public.profiles;
CREATE POLICY "Profiles self-update" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- AUDITOR ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "Auditor assignments view" ON public.auditor_assignments;
CREATE POLICY "Auditor assignments view" ON public.auditor_assignments
FOR SELECT TO authenticated
USING (
  is_admin_or_cert_manager() OR 
  auditor_id = get_my_auditor_id()
);

DROP POLICY IF EXISTS "Auditor assignments manage" ON public.auditor_assignments;
CREATE POLICY "Auditor assignments manage" ON public.auditor_assignments
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- CHECKLISTS POLICIES (readable by all, manageable by admins)
DROP POLICY IF EXISTS "Checklists access" ON public.checklists;
CREATE POLICY "Checklists access" ON public.checklists
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Checklists manage" ON public.checklists;
CREATE POLICY "Checklists manage" ON public.checklists
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Documents access" ON public.documents;
CREATE POLICY "Documents access" ON public.documents
FOR ALL TO authenticated
USING (true);

-- SETTINGS POLICIES
DROP POLICY IF EXISTS "Settings view" ON public.settings;
CREATE POLICY "Settings view" ON public.settings
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Settings manage" ON public.settings;
CREATE POLICY "Settings manage" ON public.settings
FOR ALL TO authenticated
USING (is_admin_or_cert_manager())
WITH CHECK (is_admin_or_cert_manager());

-- ============================================
-- PART 10: RELOAD SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check audit_reports columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_reports'
ORDER BY ordinal_position;

-- Check audit_plans columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_plans'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'audit_plans', 'audit_reports', 'auditors');

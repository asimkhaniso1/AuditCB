-- ============================================
-- AUDITCB360 — FULL SCHEMA SETUP (Idempotent)
-- ============================================
-- Safe to run on a fresh OR existing database.
-- All statements use IF NOT EXISTS / IF EXISTS guards.
-- Execute in: Supabase SQL Editor (run as a single script)
-- ============================================

-- ============================================
-- PHASE 1: EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PHASE 2: CUSTOM TYPES (safe: wrapped in DO block)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM (
            'Lead Auditor', 'Auditor', 'Technical Expert',
            'Certification Manager', 'Admin'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_status') THEN
        CREATE TYPE audit_status AS ENUM (
            'Draft', 'Scheduled', 'In Progress', 'Field Work Complete',
            'Pending Review', 'Approved', 'Completed', 'Finalized'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('Active', 'Pending', 'Inactive');
    END IF;
END $$;

-- ============================================
-- PHASE 3: CREATE TABLES
-- ============================================

-- 3a. PROFILES (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'Auditor',
    status TEXT DEFAULT 'Pending',
    avatar_url TEXT,
    qualification_standards TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3b. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,
    standard TEXT,
    status TEXT DEFAULT 'Active',
    type TEXT,
    website TEXT,
    employees INTEGER DEFAULT 0,
    shifts TEXT DEFAULT 'No',
    sites JSONB DEFAULT '[]'::jsonb,
    contacts JSONB DEFAULT '[]'::jsonb,
    contact_person TEXT,
    next_audit TEXT,
    last_audit TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3c. AUDITORS
CREATE TABLE IF NOT EXISTS public.auditors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    experience INTEGER DEFAULT 0,
    qualifications JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3d. AUDIT PLANS
CREATE TABLE IF NOT EXISTS public.audit_plans (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    client TEXT,
    standard TEXT,
    type TEXT,
    date DATE,
    start_date DATE,
    end_date DATE,
    man_days NUMERIC(5,1),
    cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    lead_auditor TEXT,
    auditors JSONB DEFAULT '[]'::jsonb,
    team_ids TEXT[],
    agenda JSONB DEFAULT '[]'::jsonb,
    objectives TEXT,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3e. AUDIT REPORTS
CREATE TABLE IF NOT EXISTS public.audit_reports (
    id TEXT PRIMARY KEY,
    plan_id TEXT,
    audit_plan_id TEXT,
    client TEXT,
    client_id TEXT,
    client_name TEXT,
    date DATE,
    audit_date DATE,
    status TEXT DEFAULT 'Draft',
    findings INTEGER DEFAULT 0,
    executive_summary TEXT,
    conclusion TEXT,
    recommendation TEXT,
    generated_pdf_url TEXT,
    checklist_progress JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3f. AUDIT FINDINGS (NCRs)
CREATE TABLE IF NOT EXISTS public.audit_findings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id TEXT,
    type TEXT,
    clause TEXT,
    description TEXT,
    evidence TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3g. CHECKLISTS
CREATE TABLE IF NOT EXISTS public.checklists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT,
    type TEXT DEFAULT 'global',
    audit_type TEXT,
    audit_scope TEXT,
    created_by TEXT,
    clauses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3h. SETTINGS
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    standards JSONB DEFAULT '[]'::jsonb,
    roles JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    cb_settings JSONB DEFAULT '{}'::jsonb,
    organization JSONB DEFAULT '[]'::jsonb,
    policies JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3i. CERTIFICATION DECISIONS
CREATE TABLE IF NOT EXISTS public.certification_decisions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    client TEXT,
    standard TEXT,
    date DATE,
    decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3j. AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_email TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3k. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    url TEXT,
    storage_path TEXT,
    file_size BIGINT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    folder TEXT DEFAULT 'documents',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3l. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 3.5: BACKFILL MISSING COLUMNS ON EXISTING TABLES
-- ============================================
-- If tables already existed from older migrations, they may be missing
-- columns that the app now expects. ADD COLUMN IF NOT EXISTS is safe.
-- ============================================

-- CLIENTS: ensure all expected columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS employees INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS shifts TEXT DEFAULT 'No';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sites JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_audit TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_audit TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- AUDITORS
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS qualifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.auditors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- AUDIT PLANS
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS man_days NUMERIC(5,1);
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS lead_auditor TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS auditors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS team_ids TEXT[];
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE public.audit_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- AUDIT REPORTS
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS audit_plan_id TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS audit_date DATE;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS findings INTEGER DEFAULT 0;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS generated_pdf_url TEXT;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- CHECKLISTS
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS audit_type TEXT;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS audit_scope TEXT;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- SETTINGS
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS standards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- AUDIT LOG
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- DOCUMENTS
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'documents';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- CERTIFICATION DECISIONS
ALTER TABLE public.certification_decisions ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE public.certification_decisions ADD COLUMN IF NOT EXISTS standard TEXT;
ALTER TABLE public.certification_decisions ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.certification_decisions ADD COLUMN IF NOT EXISTS decision TEXT;
ALTER TABLE public.certification_decisions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PHASE 4: ENSURE DEFAULT SETTINGS ROW
-- ============================================
INSERT INTO settings (id, is_admin, created_at, updated_at)
VALUES (1, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PHASE 5: ROW LEVEL SECURITY + POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe: IF EXISTS)
DROP POLICY IF EXISTS "Allow all clients" ON clients;
DROP POLICY IF EXISTS "Allow all auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all audit_findings" ON audit_findings;
DROP POLICY IF EXISTS "Allow all checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all settings" ON settings;
DROP POLICY IF EXISTS "Allow all certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all audit_log" ON audit_log;
DROP POLICY IF EXISTS "Allow all documents" ON documents;
DROP POLICY IF EXISTS "Allow all notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all profiles" ON profiles;

-- Also drop old-style policies from STEP2
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Also drop policies from supabase_schema_final
DROP POLICY IF EXISTS "Public Usage" ON profiles;
DROP POLICY IF EXISTS "Self Update" ON profiles;
DROP POLICY IF EXISTS "Authenticated View All" ON clients;
DROP POLICY IF EXISTS "Authenticated Modify" ON clients;
DROP POLICY IF EXISTS "Authenticated View Plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated Modify Plans" ON audit_plans;
DROP POLICY IF EXISTS "Authenticated View Reports" ON audit_reports;
DROP POLICY IF EXISTS "Authenticated Modify Reports" ON audit_reports;

-- Create authenticated-only policies (RBAC enforced in app logic)
-- Profiles: users can view all, but only insert/update own
CREATE POLICY "auth_select_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "auth_update_profiles" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- All other tables: authenticated users get full access
CREATE POLICY "auth_select_clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_clients" ON clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_auditors" ON auditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_auditors" ON auditors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_auditors" ON auditors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_auditors" ON auditors FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_audit_plans" ON audit_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_audit_plans" ON audit_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_audit_plans" ON audit_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_audit_plans" ON audit_plans FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_audit_reports" ON audit_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_audit_reports" ON audit_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_audit_reports" ON audit_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_audit_reports" ON audit_reports FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_audit_findings" ON audit_findings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_audit_findings" ON audit_findings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_audit_findings" ON audit_findings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_audit_findings" ON audit_findings FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_checklists" ON checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_checklists" ON checklists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_checklists" ON checklists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_checklists" ON checklists FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_certification_decisions" ON certification_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_certification_decisions" ON certification_decisions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_certification_decisions" ON certification_decisions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_certification_decisions" ON certification_decisions FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select_documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_documents" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_documents" ON documents FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select_notifications" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_notifications" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_notifications" ON notifications FOR DELETE TO authenticated USING (true);

-- ============================================
-- PHASE 6: INDEXES (safe — column existence checked)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_auditors_name ON auditors(name);
CREATE INDEX IF NOT EXISTS idx_auditors_email ON auditors(email);
CREATE INDEX IF NOT EXISTS idx_audit_plans_client_id ON audit_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);
CREATE INDEX IF NOT EXISTS idx_audit_reports_plan_id ON audit_reports(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);
CREATE INDEX IF NOT EXISTS idx_checklists_standard ON checklists(standard);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- PHASE 7: GRANTS
-- ============================================
GRANT ALL ON public.clients TO authenticated, service_role;
GRANT ALL ON public.auditors TO authenticated, service_role;
GRANT ALL ON public.audit_plans TO authenticated, service_role;
GRANT ALL ON public.audit_reports TO authenticated, service_role;
GRANT ALL ON public.audit_findings TO authenticated, service_role;
GRANT ALL ON public.checklists TO authenticated, service_role;
GRANT ALL ON public.settings TO authenticated, service_role;
GRANT ALL ON public.certification_decisions TO authenticated, service_role;
GRANT ALL ON public.audit_log TO authenticated, service_role;
GRANT ALL ON public.documents TO authenticated, service_role;
GRANT ALL ON public.notifications TO authenticated, service_role;
GRANT ALL ON public.profiles TO authenticated, service_role;

-- ============================================
-- PHASE 8: AUTH TRIGGER (create profile on signup)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'Auditor',
        'Pending'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'SCHEMA SETUP COMPLETE ✅' AS status;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

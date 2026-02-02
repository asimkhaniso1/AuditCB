-- ============================================
-- AUDITCB SCHEMA V2 (CONSOLIDATED)
-- ============================================
-- Date: 2026-02-02
-- Status: WORKING (RLS Disabled / Public Access Enabled)
-- Contains:
-- 1. All Tables (clients, profiles, plans, reports, etc.)
-- 2. "Text ID" conversion for legacy tables.
-- 3. "UUID" ID for system tables (profiles, settings).
-- 4. Infinite Recursion Fix (admin_profiles_lookup View).
-- 5. Emergency Permissions (GRANT ALL TO PUBLIC).
-- ============================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TYPES
-- (None explicitly defined in consolidation, using TEXT for enums)

-- 3. TABLES

-- 3.1 PROFILES (Linked to Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'Auditor',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 AUDITOR PROFILES (Detailed info)
CREATE TABLE IF NOT EXISTS public.auditor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    auditor_number TEXT UNIQUE,
    experience INTEGER DEFAULT 0,
    certifications JSONB DEFAULT '[]'::jsonb,
    industries JSONB DEFAULT '[]'::jsonb,
    standards JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    qualifications JSONB DEFAULT '[]'::jsonb,
    training_records JSONB DEFAULT '[]'::jsonb,
    audits_completed INTEGER DEFAULT 0,
    customer_rating DECIMAL(3,2),
    performance_score DECIMAL(5,2),
    availability_status TEXT DEFAULT 'Available',
    max_audits_per_month INTEGER DEFAULT 10,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_id UNIQUE(user_id)
);

-- 3.3 SETTINGS (Global Config)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB DEFAULT '{}'::jsonb,
    organization_id UUID, -- Optional link
    company_name TEXT,    -- Legacy/Helpers
    logo_url TEXT,
    theme TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY, -- Text ID (Legacy support)
    name TEXT NOT NULL,
    standard TEXT,
    status TEXT,
    type TEXT,
    website TEXT,
    employees INTEGER DEFAULT 0,
    shifts TEXT DEFAULT 'No',
    industry TEXT,
    contacts JSONB DEFAULT '[]'::jsonb,
    sites JSONB DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 AUDITORS (Legacy/Simple List - possibly redundant with profiles but keeping for schema references)
CREATE TABLE IF NOT EXISTS public.auditors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    experience INTEGER DEFAULT 0,
    standards TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6 AUDIT PLANS
CREATE TABLE IF NOT EXISTS public.audit_plans (
    id TEXT PRIMARY KEY,
    client_id TEXT, -- References clients.id
    client_name TEXT,
    standard TEXT,
    date DATE,
    type TEXT,
    status TEXT DEFAULT 'Planned',
    lead_auditor TEXT,
    audit_team JSONB DEFAULT '[]'::jsonb,
    objectives TEXT,
    scope TEXT,
    cost NUMERIC DEFAULT 0,
    report_id TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7 AUDIT REPORTS
CREATE TABLE IF NOT EXISTS public.audit_reports (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    plan_id TEXT,
    date DATE,
    status TEXT DEFAULT 'Draft',
    findings INTEGER DEFAULT 0,
    conformities INTEGER DEFAULT 0,
    conclusion TEXT,
    recommendation TEXT,
    checklist_progress JSONB DEFAULT '[]'::jsonb,
    ncrs JSONB DEFAULT '[]'::jsonb,
    custom_items JSONB DEFAULT '[]'::jsonb,
    opening_meeting JSONB DEFAULT '{}'::jsonb,
    closing_meeting JSONB DEFAULT '{}'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.8 AUDITOR ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.auditor_assignments (
    id BIGSERIAL PRIMARY KEY,
    client_id TEXT,
    user_id UUID, -- References auth.users(id) or profiles(id)
    auditor_id TEXT, -- Legacy
    role TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 CHECKLISTS
CREATE TABLE IF NOT EXISTS public.checklists (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT,
    type TEXT DEFAULT 'global',
    audit_type TEXT,
    created_by TEXT,
    clauses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.10 CERTIFICATION DECISIONS
CREATE TABLE IF NOT EXISTS public.certification_decisions (
    client TEXT NOT NULL,
    standard TEXT NOT NULL,
    date DATE NOT NULL,
    decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (client, standard, date)
);

-- 3.11 AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.12 DOCUMENTS (File metadata)
CREATE TABLE IF NOT EXISTS public.documents (
    id BIGINT PRIMARY KEY,
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

-- 4. VIEWS (SECURITY & RECURSION FIX)

-- Secure lookup view that bypasses RLS (by owner matching)
CREATE OR REPLACE VIEW public.admin_profiles_lookup AS
SELECT id, role FROM public.profiles;

REVOKE ALL ON public.admin_profiles_lookup FROM public;
GRANT SELECT ON public.admin_profiles_lookup TO authenticated;

-- 5. FUNCTIONS

-- Helper: Update Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper: Check Admin (Non-recursive)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_profiles_lookup
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.is_admin() SET search_path = public;

-- 6. TRIGGERS
-- Apply updated_at trigger to main tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clients_modtime') THEN
        CREATE TRIGGER update_clients_modtime BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    -- (Repeat for others as needed, omitted for brevity in consolidation unless critical)
END $$;

-- 7. SECURITY & PERMISSIONS (EMERGENCY STATE: OPEN)

-- 7.1 Disable RLS everywhere (Prevention of Recursion)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditor_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;

-- 7.2 Grant Public Access (Prevention of Permission Denied)
GRANT ALL ON ALL TABLES IN SCHEMA public TO public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO public;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO public;

-- 7.3 Storage Schema Access
GRANT ALL ON SCHEMA storage TO public;
GRANT ALL ON storage.buckets TO public;
GRANT ALL ON storage.objects TO public;

-- 8. DATA SEEDING (DEFAULTS)

-- Default Settings Row
INSERT INTO public.settings (key, value)
VALUES (
    'cb_details', 
    '{"name": "AuditCB", "logo": "https://placehold.co/150x50?text=AuditCB"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- DONE
SELECT 'Schema V2 (Consolidated) ready.' as result;

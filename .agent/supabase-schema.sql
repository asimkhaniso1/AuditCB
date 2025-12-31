-- ============================================
-- AuditCB360 - Supabase Database Schema
-- ============================================
-- Run this in Supabase SQL Editor
-- Project: dfzisgfpstrsyncfsxyb

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Certification Manager', 'Lead Auditor', 'Auditor')),
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT NOT NULL,
    status TEXT NOT NULL,
    type TEXT NOT NULL,
    website TEXT,
    contacts JSONB DEFAULT '[]'::JSONB,
    sites JSONB DEFAULT '[]'::JSONB,
    employees INTEGER,
    shifts TEXT,
    industry TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditors
CREATE TABLE IF NOT EXISTS public.auditors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    standards TEXT[] DEFAULT ARRAY[]::TEXT[],
    experience INTEGER,
    domain_expertise TEXT[] DEFAULT ARRAY[]::TEXT[],
    industries TEXT[] DEFAULT ARRAY[]::TEXT[],
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    location TEXT,
    man_day_rate DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Plans
CREATE TABLE IF NOT EXISTS public.audit_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    standard TEXT NOT NULL,
    date DATE NOT NULL,
    cost DECIMAL(10,2),
    auditor_ids UUID[] DEFAULT ARRAY[]::UUID[],
    man_days DECIMAL(5,2),
    status TEXT NOT NULL,
    objectives TEXT,
    scope TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Reports
CREATE TABLE IF NOT EXISTS public.audit_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    audit_plan_id UUID REFERENCES public.audit_plans(id),
    date DATE NOT NULL,
    status TEXT NOT NULL,
    findings INTEGER DEFAULT 0,
    ncrs JSONB DEFAULT '[]'::JSONB,
    checklist_progress JSONB DEFAULT '[]'::JSONB,
    conclusion TEXT,
    recommendation TEXT,
    conformities INTEGER DEFAULT 0,
    finalized_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log (for compliance)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    user_role TEXT,
    changes JSONB,
    metadata JSONB
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_plans_client ON public.audit_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_date ON public.audit_plans(date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_client ON public.audit_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON public.audit_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- User Profiles
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Clients
CREATE POLICY "Authenticated users can view clients"
    ON public.clients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers can insert clients"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

CREATE POLICY "Managers can update clients"
    ON public.clients FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

CREATE POLICY "Admins can delete clients"
    ON public.clients FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'Admin'
        )
    );

-- Auditors
CREATE POLICY "Authenticated users can view auditors"
    ON public.auditors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers can manage auditors"
    ON public.auditors FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

-- Audit Plans
CREATE POLICY "Authenticated users can view audit plans"
    ON public.audit_plans FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Auditors can create audit plans"
    ON public.audit_plans FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor')
        )
    );

CREATE POLICY "Auditors can update audit plans"
    ON public.audit_plans FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor')
        )
    );

-- Audit Reports
CREATE POLICY "Authenticated users can view reports"
    ON public.audit_reports FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Auditors can create reports"
    ON public.audit_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor', 'Auditor')
        )
    );

CREATE POLICY "Auditors can update reports"
    ON public.audit_reports FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor', 'Auditor')
        )
    );

-- Audit Log
CREATE POLICY "Users can insert audit logs"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can view all audit logs"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'Admin'
        )
    );

CREATE POLICY "Users can view own audit logs"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auditors_updated_at ON public.auditors;
CREATE TRIGGER update_auditors_updated_at 
    BEFORE UPDATE ON public.auditors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_plans_updated_at ON public.audit_plans;
CREATE TRIGGER update_audit_plans_updated_at 
    BEFORE UPDATE ON public.audit_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_reports_updated_at ON public.audit_reports;
CREATE TRIGGER update_audit_reports_updated_at 
    BEFORE UPDATE ON public.audit_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================

-- Verify tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

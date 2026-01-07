-- ============================================
-- COMPREHENSIVE FIX - All Tables
-- ============================================

-- 1. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    standards JSONB DEFAULT '[]',
    roles JSONB DEFAULT '[]',
    is_admin BOOLEAN DEFAULT false,
    cb_settings JSONB DEFAULT '{}',
    organization JSONB DEFAULT '[]',
    policies JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. ENSURE PRIMARY KEYS EXIST (for upsert to work)
-- Drop and recreate with TEXT ID and PRIMARY KEY

-- Clients
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_pkey CASCADE;
ALTER TABLE clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

-- Auditors
ALTER TABLE auditors DROP CONSTRAINT IF EXISTS auditors_pkey CASCADE;
ALTER TABLE auditors ADD CONSTRAINT auditors_pkey PRIMARY KEY (id);

-- Audit Plans
ALTER TABLE audit_plans DROP CONSTRAINT IF EXISTS audit_plans_pkey CASCADE;
ALTER TABLE audit_plans ADD CONSTRAINT audit_plans_pkey PRIMARY KEY (id);

-- Audit Reports
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_pkey CASCADE;
ALTER TABLE audit_reports ADD CONSTRAINT audit_reports_pkey PRIMARY KEY (id);

-- Audit Log
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey CASCADE;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

-- 3. DISABLE RLS ON ALL
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditors DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 4. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

SELECT 'All tables fixed with PRIMARY KEYS' as status;

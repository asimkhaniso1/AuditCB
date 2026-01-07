-- ============================================
-- NUCLEAR OPTION: FIX ALL SCHEMA AND PERMISSIONS
-- ============================================
-- Run this script to resolve 400 Errors and Permission Issues

-- 1. DISABLE RLS GLOBALLY (Temporarily, to fix sync)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditors DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE certification_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- 2. ADD ALL POTENTIALLY MISSING COLUMNS
-- Audit Plans
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "manDays" NUMERIC;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "selectedChecklists" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "client_name" TEXT; -- Backwards compat
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "start_date" DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "end_date" DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "lead_auditor" TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS "audit_team" JSONB;

-- Audit Reports
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS "ncrs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS "auditType" TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS "leadAuditor" TEXT;

-- Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "nextAudit" DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "lastAudit" DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "contactPerson" TEXT; -- JS camelCase vs snake_case

-- Auditors
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "availability" JSONB;
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "qualifications" JSONB;

-- Settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;

-- Audit Log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;

-- 3. ENSURE SETTINGS ROW EXISTS
INSERT INTO settings (id, is_admin) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- 4. GRANT PERMISSIONS (Maximize Access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

SELECT 'NUCLEAR FIX APPLIED: Schema updated and RLS disabled.' as status;

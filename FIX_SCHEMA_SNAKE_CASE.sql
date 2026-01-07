-- ============================================
-- FIX SCHEMA TO SNAKE_CASE (Standard PostgREST)
-- ============================================
-- Switching to snake_case to avoid quoting issues

-- 1. Audit Plans
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS man_days NUMERIC;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS selected_checklists JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS lead_auditor TEXT;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS audit_team JSONB DEFAULT '[]'::jsonb;

-- 2. Audit Reports
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS ncrs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS audit_type TEXT;
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS lead_auditor TEXT;

-- 3. Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_audit DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_audit DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- 4. Audit Log (ensure snake_case)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;

-- 5. Settings (already snake_case mostly)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;

-- 6. Disable RLS again just in case
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

SELECT 'Schema updated to snake_case columns' as status;

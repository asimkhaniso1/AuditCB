-- ============================================
-- FOCUSED SCHEMA CLEANUP - 3 TABLES ONLY
-- ============================================
-- Only fixes: audit_reports, audit_plans, clients
-- BACKUP THESE 3 TABLES BEFORE RUNNING!

-- ============================================
-- PART 1: STANDARDIZE audit_reports
-- ============================================

-- Drop duplicate columns
ALTER TABLE audit_reports DROP COLUMN IF EXISTS client CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_date CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_plan_id CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS findings_count CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS checklist_data CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS auditType CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS leadAuditor CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS audit_type CASCADE;
ALTER TABLE audit_reports DROP COLUMN IF EXISTS lead_auditor CASCADE;

-- Ensure standard columns exist
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

-- Add tenancy
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 2: STANDARDIZE audit_plans
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
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS selected_checklists JSONB DEFAULT '[]'::jsonb;
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Add tenancy
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 3: STANDARDIZE clients
-- ============================================

-- Add tenancy columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- PART 4: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_reports_client_id ON audit_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_plan_id ON audit_reports(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON audit_reports(date);

CREATE INDEX IF NOT EXISTS idx_audit_plans_client_id ON audit_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_date ON audit_plans(date);

-- ============================================
-- PART 5: RELOAD SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check audit_reports columns
SELECT 'audit_reports columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_reports'
ORDER BY ordinal_position;

-- Check audit_plans columns
SELECT 'audit_plans columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_plans'
ORDER BY ordinal_position;

-- Check clients columns
SELECT 'clients columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY ordinal_position;

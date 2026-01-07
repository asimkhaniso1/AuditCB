-- ============================================
-- FIX ID TYPE & DROP CONSTRAINTS (COMPREHENSIVE)
-- ============================================

-- 1. DROP FOREIGN KEY CONSTRAINTS (Found via errors)
ALTER TABLE audit_plans DROP CONSTRAINT IF EXISTS audit_plans_client_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_audit_plan_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_plan_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_client_id_fkey;

-- 2. CONVERT PRIMARY REYS TO TEXT
ALTER TABLE clients ALTER COLUMN id TYPE TEXT;
ALTER TABLE audit_plans ALTER COLUMN id TYPE TEXT;
ALTER TABLE audit_reports ALTER COLUMN id TYPE TEXT;
ALTER TABLE auditors ALTER COLUMN id TYPE TEXT;
ALTER TABLE audit_log ALTER COLUMN id TYPE TEXT;

-- 3. CONVERT FOREIGN KEY COLUMNS TO TEXT
ALTER TABLE audit_plans ALTER COLUMN client_id TYPE TEXT;
ALTER TABLE audit_reports ALTER COLUMN audit_plan_id TYPE TEXT;
ALTER TABLE audit_reports ALTER COLUMN plan_id TYPE TEXT;
ALTER TABLE audit_reports ALTER COLUMN client_id TYPE TEXT;

-- 4. VERIFY
SELECT 'Constraints dropped and Columns converted to TEXT' as status;

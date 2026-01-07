-- ============================================
-- FORCE ALTERS (FINAL)
-- ============================================
-- Removed non-existent columns to ensure success.

-- 1. Clients (Crucial Fix)
ALTER TABLE clients ALTER COLUMN standard DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN industry DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN status DROP NOT NULL;

-- 2. Audit Plans
ALTER TABLE audit_plans ALTER COLUMN status DROP NOT NULL;
ALTER TABLE audit_plans ALTER COLUMN date DROP NOT NULL;
-- Note: 'client' column skipped as it doesn't exist (using client_id instead)

-- 3. Audit Reports
ALTER TABLE audit_reports ALTER COLUMN status DROP NOT NULL;

-- 4. Audit Log
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN user_email DROP NOT NULL;

-- 5. Reload Cache
NOTIFY pgrst, 'reload schema';

SELECT 'Constraints Successfully Relaxed' as status;

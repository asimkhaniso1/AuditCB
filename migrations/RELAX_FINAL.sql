-- ============================================
-- RELAX EVERYTHING (FINAL)
-- ============================================
-- Validated against errors: "standard", "type", etc.

-- 1. Clients
ALTER TABLE clients ALTER COLUMN type DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN website DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN industry DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN standard DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN status DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN contact_person DROP NOT NULL;

-- 2. Auditors
ALTER TABLE auditors ALTER COLUMN role DROP NOT NULL;
ALTER TABLE auditors ALTER COLUMN location DROP NOT NULL;
ALTER TABLE auditors ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE auditors ALTER COLUMN email DROP NOT NULL;

-- 3. Audit Plans
ALTER TABLE audit_plans ALTER COLUMN status DROP NOT NULL;
ALTER TABLE audit_plans ALTER COLUMN date DROP NOT NULL;

-- 4. Audit Reports
ALTER TABLE audit_reports ALTER COLUMN status DROP NOT NULL;

-- 5. Audit Log
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN user_email DROP NOT NULL;

-- 6. Reload Cache
NOTIFY pgrst, 'reload schema';

SELECT 'All Constraints Relaxed' as status;

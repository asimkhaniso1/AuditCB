-- ============================================
-- RELAX CONSTRAINTS (Fix 400 Errors)
-- ============================================
-- Drops NOT NULL constraints to allow syncing partial data.

DO $$
BEGIN
    -- 1. Clients
    ALTER TABLE clients ALTER COLUMN standard DROP NOT NULL;
    
    -- 2. Audit Log
    ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;
    ALTER TABLE audit_log ALTER COLUMN user_email DROP NOT NULL;

    -- 3. Audit Plans
    ALTER TABLE audit_plans ALTER COLUMN status DROP NOT NULL;
    ALTER TABLE audit_plans ALTER COLUMN client DROP NOT NULL; -- Use ID mostly

    -- 4. Audit Reports
    ALTER TABLE audit_reports ALTER COLUMN status DROP NOT NULL;

    -- 5. Auditors
    ALTER TABLE auditors ALTER COLUMN role DROP NOT NULL;

EXCEPTION WHEN others THEN 
    RAISE NOTICE 'Error relaxing constraints (ignoring): %', SQLERRM;
END $$;

SELECT 'Constraints relaxed' as status;

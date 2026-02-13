-- ============================================
-- FIX ID TYPE & DROP CONSTRAINTS (ROBUST)
-- ============================================
-- This script uses PL/PGSQL to handle missing columns gracefully.

DO $$
BEGIN
    -- 1. DROP FOREIGN KEY CONSTRAINTS
    -- We drop these to allow changing ID types to TEXT.
    EXECUTE 'ALTER TABLE audit_plans DROP CONSTRAINT IF EXISTS audit_plans_client_id_fkey';
    EXECUTE 'ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_audit_plan_id_fkey';
    EXECUTE 'ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_plan_id_fkey';
    EXECUTE 'ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_client_id_fkey';

    -- 2. CONVERT PRIMARY KEYS TO TEXT
    -- These tables are core and must exist.
    ALTER TABLE clients ALTER COLUMN id TYPE TEXT;
    ALTER TABLE audit_plans ALTER COLUMN id TYPE TEXT;
    ALTER TABLE audit_reports ALTER COLUMN id TYPE TEXT;
    ALTER TABLE auditors ALTER COLUMN id TYPE TEXT;
    ALTER TABLE audit_log ALTER COLUMN id TYPE TEXT;
    
    -- Handle settings if needed (usually ID 1, but safer as TEXT)
    BEGIN
        ALTER TABLE settings ALTER COLUMN id TYPE TEXT;
    EXCEPTION WHEN others THEN NULL; END;

    -- 3. CONVERT FOREIGN KEY COLUMNS TO TEXT
    -- Wrapped in blocks to ignore "SAFE" errors if column doesn't exist

    BEGIN
        ALTER TABLE audit_plans ALTER COLUMN client_id TYPE TEXT;
    EXCEPTION WHEN undefined_column THEN 
        RAISE NOTICE 'Column client_id not found in audit_plans (Skipping)';
    END;

    BEGIN
        ALTER TABLE audit_reports ALTER COLUMN audit_plan_id TYPE TEXT;
    EXCEPTION WHEN undefined_column THEN 
        RAISE NOTICE 'Column audit_plan_id not found in audit_reports (Skipping)';
    END;

    BEGIN
        ALTER TABLE audit_reports ALTER COLUMN plan_id TYPE TEXT;
    EXCEPTION WHEN undefined_column THEN 
        RAISE NOTICE 'Column plan_id not found in audit_reports (Skipping)';
    END;

    BEGIN
        ALTER TABLE audit_reports ALTER COLUMN client_id TYPE TEXT;
    EXCEPTION WHEN undefined_column THEN 
        RAISE NOTICE 'Column client_id not found in audit_reports (Skipping)';
    END;

END $$;

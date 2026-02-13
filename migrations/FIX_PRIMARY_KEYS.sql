-- ============================================
-- FIX PRIMARY KEYS (For Upsert to Work)
-- ============================================
-- The upsert operation requires a UNIQUE or PRIMARY KEY constraint.

-- Check and fix each table

-- 1. AUDIT_PLANS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'audit_plans' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE audit_plans ADD PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'audit_plans PK: %', SQLERRM;
END $$;

-- 2. AUDIT_REPORTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'audit_reports' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE audit_reports ADD PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'audit_reports PK: %', SQLERRM;
END $$;

-- 3. AUDIT_LOG
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'audit_log' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE audit_log ADD PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'audit_log PK: %', SQLERRM;
END $$;

-- 4. CLIENTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'clients' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE clients ADD PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'clients PK: %', SQLERRM;
END $$;

-- 5. AUDITORS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'auditors' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE auditors ADD PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'auditors PK: %', SQLERRM;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT table_name, constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name IN ('audit_plans', 'audit_reports', 'audit_log', 'clients', 'auditors', 'settings')
AND constraint_type = 'PRIMARY KEY';

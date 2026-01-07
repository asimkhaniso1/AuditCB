-- ============================================
-- NUCLEAR FIX v2 - Safe Column Handling
-- ============================================

-- 1. DISABLE ALL RLS
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS checklists DISABLE ROW LEVEL SECURITY;

-- 2. DROP ALL FOREIGN KEY CONSTRAINTS
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, conrelid::regclass AS table_name
        FROM pg_constraint
        WHERE contype = 'f'
        AND conrelid::regclass::text IN ('clients', 'auditors', 'audit_plans', 'audit_reports', 'audit_log', 'settings', 'checklists')
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.conname || ' CASCADE';
    END LOOP;
END $$;

-- 3. MAKE COLUMNS NULLABLE (only if they exist)
DO $$
DECLARE
    col_rec RECORD;
BEGIN
    FOR col_rec IN 
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_name IN ('clients', 'auditors', 'audit_plans', 'audit_reports', 'audit_log', 'settings', 'checklists')
        AND column_name != 'id'
        AND is_nullable = 'NO'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', col_rec.table_name, col_rec.column_name);
            RAISE NOTICE 'Made %.% nullable', col_rec.table_name, col_rec.column_name;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not modify %.%: %', col_rec.table_name, col_rec.column_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'NUCLEAR FIX v2 APPLIED' as status;

-- ============================================
-- ADD updated_at TRIGGERS TO ALL TABLES
-- ============================================
-- Ensures updated_at is automatically set on every UPDATE,
-- even if the client doesn't explicitly set it.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).

-- 1. Create the trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to all data tables
-- Each trigger fires BEFORE UPDATE and sets updated_at = NOW()

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'clients',
            'auditors',
            'audit_plans',
            'audit_reports',
            'checklists',
            'settings',
            'documents',
            'certification_decisions',
            'profiles'
        ])
    LOOP
        -- Drop existing trigger if any (to avoid duplicates)
        EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%I ON %I', tbl, tbl);
        -- Create new trigger
        EXECUTE format(
            'CREATE TRIGGER trg_updated_at_%I
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION update_updated_at_column()',
            tbl, tbl
        );
        RAISE NOTICE 'Trigger created for table: %', tbl;
    END LOOP;
END;
$$;

-- 3. Add index on updated_at for incremental sync performance
CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at);
CREATE INDEX IF NOT EXISTS idx_auditors_updated_at ON auditors(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_plans_updated_at ON audit_plans(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_reports_updated_at ON audit_reports(updated_at);
CREATE INDEX IF NOT EXISTS idx_checklists_updated_at ON checklists(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_certification_decisions_updated_at ON certification_decisions(updated_at);

-- Verify
SELECT
    tgname AS trigger_name,
    relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname LIKE 'trg_updated_at_%'
ORDER BY relname;

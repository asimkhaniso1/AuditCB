-- ============================================
-- MASTER DATABASE SCHEMA FIX MIGRATION
-- ============================================
-- Rollback Point: v1.0-stable-before-schema-fixes
-- Execute in: Supabase SQL Editor
-- Risk: Medium (ID type changes, schema modifications)
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire script
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and click "Run"
-- 4. Review output messages
-- 5. Run VERIFICATION queries at bottom
-- ============================================

-- ============================================
-- PHASE 1: DIAGNOSTICS (Read-Only Check)
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== PHASE 1: Current Table Structure ===';
END $$;

SELECT 'PRE-MIGRATION: Current clients columns' as check_point;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY column_name;

-- ============================================
-- PHASE 2: FIX ID TYPES & DROP CONSTRAINTS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== PHASE 2: Fixing ID Types & Dropping Constraints ===';
END $$;

-- 1. DROP FOREIGN KEY CONSTRAINTS
ALTER TABLE audit_plans DROP CONSTRAINT IF EXISTS audit_plans_client_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_audit_plan_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_plan_id_fkey;
ALTER TABLE audit_reports DROP CONSTRAINT IF EXISTS audit_reports_client_id_fkey;

-- 2. CONVERT PRIMARY KEYS TO TEXT
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

SELECT 'PHASE 2 COMPLETE: ID columns converted to TEXT' as status;

-- ============================================
-- PHASE 3: CLEAN DUPLICATE COLUMNS (Clients)
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== PHASE 3: Cleaning Duplicate Columns ===';
    
    -- Merge nextAudit -> next_audit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='nextAudit') THEN
        RAISE NOTICE 'Found "nextAudit" column. Merging data...';
        EXECUTE 'UPDATE clients SET next_audit = COALESCE(next_audit, "nextAudit") WHERE "nextAudit" IS NOT NULL';
    ELSE
        RAISE NOTICE '"nextAudit" column not found. Skipping merge.';
    END IF;

    -- Merge lastAudit -> last_audit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lastAudit') THEN
        RAISE NOTICE 'Found "lastAudit" column. Merging data...';
        EXECUTE 'UPDATE clients SET last_audit = COALESCE(last_audit, "lastAudit") WHERE "lastAudit" IS NOT NULL';
    ELSE
        RAISE NOTICE '"lastAudit" column not found. Skipping merge.';
    END IF;

    -- Merge contactPerson -> contact_person
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='contactPerson') THEN
        RAISE NOTICE 'Found "contactPerson" column. Merging data...';
        EXECUTE 'UPDATE clients SET contact_person = COALESCE(contact_person, "contactPerson") WHERE "contactPerson" IS NOT NULL';
    ELSE
        RAISE NOTICE '"contactPerson" column not found. Skipping merge.';
    END IF;
END $$;

-- Drop duplicate columns (safe now that data is merged)
ALTER TABLE clients DROP COLUMN IF EXISTS "nextAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "lastAudit";
ALTER TABLE clients DROP COLUMN IF EXISTS "contactPerson";

SELECT 'PHASE 3 COMPLETE: Duplicate columns cleaned' as status;

-- ============================================
-- PHASE 4: FIX SETTINGS & AUDIT_LOG SCHEMA
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== PHASE 4: Updating Settings & Audit Log Schema ===';
END $$;

-- Update settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS cb_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;

-- Update audit_log table
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Make columns nullable
ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN details DROP NOT NULL;

-- Disable RLS for smooth sync
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

SELECT 'PHASE 4 COMPLETE: Settings & audit_log schema updated' as status;

-- ============================================
-- PHASE 5: ENSURE SETTINGS ROW EXISTS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== PHASE 5: Ensuring Default Settings Row ===';
END $$;

-- Insert default settings row
INSERT INTO settings (id, is_admin, created_at, updated_at)
VALUES (1, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL ON settings TO public;
GRANT ALL ON settings TO anon;
GRANT ALL ON settings TO authenticated;
GRANT ALL ON settings TO service_role;

SELECT 'PHASE 5 COMPLETE: Default settings row ensured' as status;

-- ============================================
-- MIGRATION COMPLETE MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '╔════════════════════════════════════════════╗';
    RAISE NOTICE '║  MIGRATION COMPLETE - ALL PHASES DONE!    ║';
    RAISE NOTICE '╚════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Run VERIFICATION queries below';
    RAISE NOTICE '2. Test local app sync';
    RAISE NOTICE '3. Check browser console for errors';
END $$;

-- ============================================
-- VERIFICATION QUERIES (Run After Migration)
-- ============================================

-- Check 1: Verify clients columns cleaned
SELECT 'VERIFICATION 1: Clients columns (should be snake_case only)' as check_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
ORDER BY column_name;

-- Check 2: Verify ID columns are TEXT
SELECT 'VERIFICATION 2: ID column types (should all be TEXT)' as check_name;
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('clients', 'auditors', 'audit_plans', 'audit_reports', 'audit_log')
  AND column_name LIKE '%id%'
ORDER BY table_name, column_name;

-- Check 3: Verify settings schema
SELECT 'VERIFICATION 3: Settings columns' as check_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'settings'
ORDER BY column_name;

-- Check 4: Verify settings row exists
SELECT 'VERIFICATION 4: Settings row count' as check_name;
SELECT COUNT(*) as settings_rows FROM settings;

-- Check 5: Verify audit_log schema
SELECT 'VERIFICATION 5: Audit log columns' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_log'
ORDER BY column_name;

SELECT 'ALL VERIFICATIONS COMPLETE ✅' as final_status;

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS) - PRODUCTION READY
-- ============================================
-- This script enables RLS and creates policies for authenticated users
-- IMPORTANT: Run this ONLY when you're ready to require authentication
-- 
-- Pre-requisites:
-- 1. Users table exists and is populated
-- 2. Authentication is working in the app
-- 3. Test users can sign in successfully
-- ============================================

-- ============================================
-- STEP 1: Enable RLS on All Tables
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 1: Enabling RLS on Tables ===';
END $$;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Settings table: Keep RLS DISABLED for now (used before auth)
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

SELECT 'RLS enabled on all main tables' as status;

-- ============================================
-- STEP 2: Drop Existing Public Policies
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 2: Removing Old Public Policies ===';
END $$;

-- Drop old public policies
DROP POLICY IF EXISTS "Allow all on clients" ON clients;
DROP POLICY IF EXISTS "Allow all on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;
DROP POLICY IF EXISTS "Allow all on documents" ON documents;
DROP POLICY IF EXISTS "Allow all on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all on audit_log" ON audit_log;

-- Drop other variations
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Drop auth policies if they exist
DROP POLICY IF EXISTS "Auth users access clients" ON clients;
DROP POLICY IF EXISTS "Auth users access auditors" ON auditors;
DROP POLICY IF EXISTS "Auth users access audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Auth users access audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Auth users access checklists" ON checklists;
DROP POLICY IF EXISTS "Auth users access settings" ON settings;
DROP POLICY IF EXISTS "Auth users access documents" ON documents;
DROP POLICY IF EXISTS "Auth users access certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Auth users access audit_log" ON audit_log;

SELECT 'Old policies dropped' as status;

-- ============================================
-- STEP 3: Create Authenticated-Only Policies
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 3: Creating Authenticated User Policies ===';
END $$;

-- Clients table: Authenticated users can do everything
CREATE POLICY "authenticated_access_clients" 
    ON clients 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Auditors table: Authenticated users can do everything
CREATE POLICY "authenticated_access_auditors" 
    ON auditors 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Audit Plans: Authenticated users can do everything
CREATE POLICY "authenticated_access_audit_plans" 
    ON audit_plans 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Audit Reports: Authenticated users can do everything
CREATE POLICY "authenticated_access_audit_reports" 
    ON audit_reports 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Checklists: Authenticated users can do everything
CREATE POLICY "authenticated_access_checklists" 
    ON checklists 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Documents: Authenticated users can do everything
CREATE POLICY "authenticated_access_documents" 
    ON documents 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Certification Decisions: Authenticated users can do everything
CREATE POLICY "authenticated_access_certification_decisions" 
    ON certification_decisions 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Audit Log: Authenticated users can read and write
CREATE POLICY "authenticated_access_audit_log" 
    ON audit_log 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

SELECT 'Authenticated policies created' as status;

-- ============================================
-- STEP 4: Verification
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== STEP 4: Verification ===';
END $$;

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('clients', 'auditors', 'audit_plans', 'audit_reports', 'checklists', 'documents', 'certification_decisions', 'audit_log', 'settings')
ORDER BY tablename;

-- Check policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '╔════════════════════════════════════════════╗';
    RAISE NOTICE '║    RLS ENABLED - AUTH NOW REQUIRED!       ║';
    RAISE NOTICE '╚════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Important Notes:';
    RAISE NOTICE '1. Users must be authenticated to access data';
    RAISE NOTICE '2. Anonymous/public access is now blocked';
    RAISE NOTICE '3. Test login immediately after running this';
    RAISE NOTICE '4. Settings table RLS is DISABLED (accessed pre-auth)';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback, run: DISABLE_RLS_ROLLBACK.sql';
END $$;

SELECT '✅ RLS MIGRATION COMPLETE - Authentication Required!' as final_status;

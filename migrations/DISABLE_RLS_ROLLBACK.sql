-- ============================================
-- ROLLBACK RLS POLICIES (Emergency Use Only)
-- ============================================
-- Use this to disable RLS if something goes wrong
-- This will restore public access to all tables
-- ============================================

-- Disable RLS on all tables
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditors DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE certification_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Drop authenticated policies
DROP POLICY IF EXISTS "authenticated_access_clients" ON clients;
DROP POLICY IF EXISTS "authenticated_access_auditors" ON auditors;
DROP POLICY IF EXISTS "authenticated_access_audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "authenticated_access_audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "authenticated_access_checklists" ON checklists;
DROP POLICY IF EXISTS "authenticated_access_documents" ON documents;
DROP POLICY IF EXISTS "authenticated_access_certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "authenticated_access_audit_log" ON audit_log;

-- Restore public access
CREATE POLICY "public_access_clients" ON clients FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_auditors" ON auditors FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_audit_plans" ON audit_plans FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_audit_reports" ON audit_reports FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_checklists" ON checklists FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_documents" ON documents FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_certification_decisions" ON certification_decisions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access_audit_log" ON audit_log FOR ALL TO public USING (true) WITH CHECK (true);

SELECT '⚠️ RLS DISABLED - Public Access Restored!' as status;

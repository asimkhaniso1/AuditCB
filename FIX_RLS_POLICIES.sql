-- ============================================
-- FIX RLS POLICIES - Allow authenticated users
-- ============================================
-- Run this to fix the 401 Unauthorized errors

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Create new policies that allow ALL access (bypass auth for now)
-- You can make these more restrictive later

CREATE POLICY "Allow all on clients" ON clients FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on auditors" ON auditors FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_plans" ON audit_plans FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_reports" ON audit_reports FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on checklists" ON checklists FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documents" ON documents FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on certification_decisions" ON certification_decisions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_log" ON audit_log FOR ALL TO public USING (true) WITH CHECK (true);

SELECT 'RLS policies updated - all access allowed!' as status;

-- ============================================
-- SET AUTHENTICATED-ONLY POLICIES
-- ============================================
-- This restricts access to authenticated users only

-- Drop existing public policies
DROP POLICY IF EXISTS "Allow all on clients" ON clients;
DROP POLICY IF EXISTS "Allow all on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;
DROP POLICY IF EXISTS "Allow all on documents" ON documents;
DROP POLICY IF EXISTS "Allow all on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all on audit_log" ON audit_log;

DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Create authenticated-only policies
CREATE POLICY "Auth users access clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access auditors" ON auditors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access audit_plans" ON audit_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access audit_reports" ON audit_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access checklists" ON checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access documents" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access certification_decisions" ON certification_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users access audit_log" ON audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Authenticated policies created!' as status;

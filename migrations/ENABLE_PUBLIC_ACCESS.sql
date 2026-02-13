-- DROP ALL POLICIES FIRST
DROP POLICY IF EXISTS "Auth users access clients" ON clients;
DROP POLICY IF EXISTS "Auth users access auditors" ON auditors;
DROP POLICY IF EXISTS "Auth users access audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Auth users access audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Auth users access checklists" ON checklists;
DROP POLICY IF EXISTS "Auth users access settings" ON settings;
DROP POLICY IF EXISTS "Auth users access documents" ON documents;
DROP POLICY IF EXISTS "Auth users access certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Auth users access audit_log" ON audit_log;

DROP POLICY IF EXISTS "Public access clients" ON clients;
DROP POLICY IF EXISTS "Public access auditors" ON auditors;
DROP POLICY IF EXISTS "Public access audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Public access audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Public access checklists" ON checklists;
DROP POLICY IF EXISTS "Public access settings" ON settings;
DROP POLICY IF EXISTS "Public access documents" ON documents;
DROP POLICY IF EXISTS "Public access certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Public access audit_log" ON audit_log;

-- NOW CREATE NEW POLICIES
CREATE POLICY "Public access clients" ON clients FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access auditors" ON auditors FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access audit_plans" ON audit_plans FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access audit_reports" ON audit_reports FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access checklists" ON checklists FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access settings" ON settings FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access documents" ON documents FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access certification_decisions" ON certification_decisions FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public access audit_log" ON audit_log FOR ALL TO public USING (true) WITH CHECK (true);

SELECT 'Public access enabled!' as status;

-- ============================================
-- STEP 2: ADD RLS POLICIES
-- ============================================
-- Run this AFTER STEP 1 completes successfully

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Allow all operations on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on auditors" ON auditors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on audit_plans" ON audit_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on audit_reports" ON audit_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on certification_decisions" ON certification_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_auditors_name ON auditors(name);
CREATE INDEX IF NOT EXISTS idx_auditors_email ON auditors(email);
CREATE INDEX IF NOT EXISTS idx_audit_plans_client ON audit_plans(client);
CREATE INDEX IF NOT EXISTS idx_audit_plans_date ON audit_plans(date);
CREATE INDEX IF NOT EXISTS idx_audit_reports_client ON audit_reports(client);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON audit_reports(date);
CREATE INDEX IF NOT EXISTS idx_checklists_standard ON checklists(standard);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_cert_decisions_client ON certification_decisions(client);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

SELECT 'Policies and indexes created successfully!' as status;

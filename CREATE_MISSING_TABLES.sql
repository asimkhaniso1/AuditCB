-- ============================================
-- AUDITCB360 - CREATE MISSING TABLES ONLY
-- ============================================
-- This skips profiles table (already exists)

-- 2. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT,
    status TEXT,
    type TEXT,
    website TEXT,
    employees INTEGER DEFAULT 0,
    shifts TEXT DEFAULT 'No',
    industry TEXT,
    contacts JSONB DEFAULT '[]'::jsonb,
    sites JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
CREATE POLICY "Allow all operations on clients"
ON clients FOR ALL
USING (true)
WITH CHECK (true);

-- 3. AUDITORS TABLE
CREATE TABLE IF NOT EXISTS auditors (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    experience INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on auditors" ON auditors;
CREATE POLICY "Allow all operations on auditors"
ON auditors FOR ALL
USING (true)
WITH CHECK (true);

-- 4. AUDIT PLANS TABLE
CREATE TABLE IF NOT EXISTS audit_plans (
    id BIGINT PRIMARY KEY,
    client TEXT NOT NULL,
    standard TEXT,
    date DATE,
    cost NUMERIC DEFAULT 0,
    auditors JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Planned',
    objectives TEXT,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on audit_plans" ON audit_plans;
CREATE POLICY "Allow all operations on audit_plans"
ON audit_plans FOR ALL
USING (true)
WITH CHECK (true);

-- 5. AUDIT REPORTS TABLE
CREATE TABLE IF NOT EXISTS audit_reports (
    id BIGINT PRIMARY KEY,
    client TEXT NOT NULL,
    date DATE,
    status TEXT DEFAULT 'Draft',
    findings INTEGER DEFAULT 0,
    conclusion TEXT,
    recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on audit_reports" ON audit_reports;
CREATE POLICY "Allow all operations on audit_reports"
ON audit_reports FOR ALL
USING (true)
WITH CHECK (true);

-- 6. CHECKLISTS TABLE
CREATE TABLE IF NOT EXISTS checklists (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT,
    type TEXT DEFAULT 'global',
    audit_type TEXT,
    audit_scope TEXT,
    created_by TEXT,
    clauses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
CREATE POLICY "Allow all operations on checklists"
ON checklists FOR ALL
USING (true)
WITH CHECK (true);

-- 7. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    standards JSONB DEFAULT '[]'::jsonb,
    roles JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;
CREATE POLICY "Allow all operations on settings"
ON settings FOR ALL
USING (true)
WITH CHECK (true);

-- 8. DOCUMENTS TABLE (update existing to add storage columns)
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    url TEXT,
    storage_path TEXT,
    file_size BIGINT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    folder TEXT DEFAULT 'documents',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
CREATE POLICY "Allow all operations on documents"
ON documents FOR ALL
USING (true)
WITH CHECK (true);

-- Add storage columns if they don't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'documents';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;

-- 9. CERTIFICATION DECISIONS TABLE
CREATE TABLE IF NOT EXISTS certification_decisions (
    client TEXT NOT NULL,
    standard TEXT NOT NULL,
    date DATE NOT NULL,
    decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (client, standard, date)
);

ALTER TABLE certification_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on certification_decisions" ON certification_decisions;
CREATE POLICY "Allow all operations on certification_decisions"
ON certification_decisions FOR ALL
USING (true)
WITH CHECK (true);

-- 10. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on audit_log" ON audit_log;
CREATE POLICY "Allow all operations on audit_log"
ON audit_log FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

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

-- ============================================
-- VERIFY TABLES
-- ============================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'profiles', 'clients', 'auditors', 'audit_plans', 
    'audit_reports', 'checklists', 'settings', 
    'documents', 'certification_decisions', 'audit_log'
)
ORDER BY table_name;

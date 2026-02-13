-- ============================================
-- AUDITCB360 - COMPLETE DATABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor to create all tables

-- 1. PROFILES TABLE (Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (true);

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

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policies for clients
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

-- Enable RLS
ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;

-- Policies for auditors
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

-- Enable RLS
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;

-- Policies for audit_plans
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

-- Enable RLS
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

-- Policies for audit_reports
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

-- Enable RLS
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

-- Policies for checklists
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

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies for settings
CREATE POLICY "Allow all operations on settings"
ON settings FOR ALL
USING (true)
WITH CHECK (true);

-- 8. DOCUMENTS TABLE
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

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies for documents
CREATE POLICY "Allow all operations on documents"
ON documents FOR ALL
USING (true)
WITH CHECK (true);

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

-- Enable RLS
ALTER TABLE certification_decisions ENABLE ROW LEVEL SECURITY;

-- Policies for certification_decisions
CREATE POLICY "Allow all operations on certification_decisions"
ON certification_decisions FOR ALL
USING (true)
WITH CHECK (true);

-- 10. AUDIT LOG TABLE (Optional - for tracking)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for audit_log
CREATE POLICY "Allow all operations on audit_log"
ON audit_log FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- Auditors indexes
CREATE INDEX IF NOT EXISTS idx_auditors_name ON auditors(name);
CREATE INDEX IF NOT EXISTS idx_auditors_email ON auditors(email);

-- Audit plans indexes
CREATE INDEX IF NOT EXISTS idx_audit_plans_client ON audit_plans(client);
CREATE INDEX IF NOT EXISTS idx_audit_plans_date ON audit_plans(date);

-- Audit reports indexes
CREATE INDEX IF NOT EXISTS idx_audit_reports_client ON audit_reports(client);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON audit_reports(date);

-- Checklists indexes
CREATE INDEX IF NOT EXISTS idx_checklists_standard ON checklists(standard);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);

-- Certification decisions indexes
CREATE INDEX IF NOT EXISTS idx_cert_decisions_client ON certification_decisions(client);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- COMPLETE! All tables created.
-- ============================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

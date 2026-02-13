-- ============================================
-- STEP 1: CREATE TABLES ONLY (NO INDEXES YET)
-- ============================================
-- Run this first, then run STEP 2

-- CLIENTS TABLE
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

-- AUDITORS TABLE
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

-- AUDIT PLANS TABLE
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

-- AUDIT REPORTS TABLE
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

-- CHECKLISTS TABLE
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

-- SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    standards JSONB DEFAULT '[]'::jsonb,
    roles JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CERTIFICATION DECISIONS TABLE
CREATE TABLE IF NOT EXISTS certification_decisions (
    client TEXT NOT NULL,
    standard TEXT NOT NULL,
    date DATE NOT NULL,
    decision TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (client, standard, date)
);

-- AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTS TABLE
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

-- Verify tables created
SELECT 'Tables created successfully!' as status;

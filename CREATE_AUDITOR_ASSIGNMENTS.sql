-- ============================================
-- CREATE AUDITOR ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS auditor_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auditor_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    assigned_by TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auditor_id, client_id)
);

-- Enable RLS
ALTER TABLE auditor_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all operations on auditor_assignments"
ON auditor_assignments FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_auditor ON auditor_assignments(auditor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client ON auditor_assignments(client_id);

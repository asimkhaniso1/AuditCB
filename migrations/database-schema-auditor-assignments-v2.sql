-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS auditor_assignments CASCADE;

-- Create auditor_assignments table with proper schema
CREATE TABLE auditor_assignments (
    id BIGINT PRIMARY KEY,
    auditor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    role TEXT DEFAULT 'Auditor',
    assigned_by TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on auditor_id and client_id combination
CREATE UNIQUE INDEX idx_auditor_client_unique ON auditor_assignments(auditor_id, client_id);

-- Create indexes for faster lookups
CREATE INDEX idx_auditor_assignments_auditor ON auditor_assignments(auditor_id);
CREATE INDEX idx_auditor_assignments_client ON auditor_assignments(client_id);

-- Enable Row Level Security (RLS)
ALTER TABLE auditor_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read assignments" ON auditor_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to manage assignments" ON auditor_assignments;

-- Create policy to allow authenticated users to read all assignments
CREATE POLICY "Allow authenticated users to read assignments"
ON auditor_assignments FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to insert/update/delete assignments
CREATE POLICY "Allow authenticated users to manage assignments"
ON auditor_assignments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify table was created
SELECT 'Table created successfully' as status;

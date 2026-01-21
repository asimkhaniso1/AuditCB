-- Auditor Assignments Table Schema
-- Run this SQL in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS auditor_assignments (
    id BIGINT PRIMARY KEY,
    auditor_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    role TEXT DEFAULT 'Auditor',
    assigned_by TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auditor_id, client_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_auditor ON auditor_assignments(auditor_id);
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_client ON auditor_assignments(client_id);

-- Enable Row Level Security (RLS)
ALTER TABLE auditor_assignments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all assignments
CREATE POLICY "Allow authenticated users to read assignments"
ON auditor_assignments FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to insert/update assignments
CREATE POLICY "Allow authenticated users to manage assignments"
ON auditor_assignments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Note: Adjust policies based on your security requirements
-- For production, you may want to restrict based on user roles

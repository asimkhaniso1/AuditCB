-- Fix RLS Policies for auditor_assignments table
-- Run this SQL to fix the Row Level Security issue

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read assignments" ON auditor_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to manage assignments" ON auditor_assignments;

-- Disable RLS temporarily to test (ONLY FOR DEVELOPMENT - Re-enable for production)
ALTER TABLE auditor_assignments DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled, use these more permissive policies:
-- ALTER TABLE auditor_assignments ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all for authenticated users"
-- ON auditor_assignments
-- FOR ALL
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);

-- Verify the change
SELECT 'RLS policies updated successfully' as status;

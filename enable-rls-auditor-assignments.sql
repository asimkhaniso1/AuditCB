-- ==============================================================================
-- ENABLE RLS ON AUDITOR_ASSIGNMENTS TABLE
-- ==============================================================================
-- This script enables Row Level Security on the auditor_assignments table
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- Enable RLS on the auditor_assignments table
ALTER TABLE public.auditor_assignments ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'auditor_assignments';

-- Show existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'auditor_assignments';

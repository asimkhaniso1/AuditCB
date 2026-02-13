-- ==============================================================================
-- ENABLE RLS ON ALL TABLES WITH POLICIES
-- ==============================================================================
-- This script enables Row Level Security on tables that have RLS policies
-- but RLS is not enabled
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- Enable RLS on auditor_assignments table
ALTER TABLE public.auditor_assignments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled on both tables
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✓ Enabled'
        ELSE '✗ Disabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('auditor_assignments', 'settings')
ORDER BY tablename;

-- Show all policies for verification
SELECT 
    tablename,
    policyname,
    cmd as operation,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN 'Allow'
        ELSE 'Restrict'
    END as type
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('auditor_assignments', 'settings')
ORDER BY tablename, policyname;

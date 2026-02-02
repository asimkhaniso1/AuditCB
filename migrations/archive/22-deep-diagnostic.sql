-- ============================================
-- DEEP DIAGNOSTIC: WHY IS CLIENT LIST 0?
-- Run this to see if data exists or if RLS is blocking
-- ============================================

-- 1. Check total rows in all tables (bypass RLS by using count)
SELECT 'Total rows in clients table:' as info, COUNT(*) FROM public.clients;
SELECT 'Total rows in profiles table:' as info, COUNT(*) FROM public.profiles;
SELECT 'Total rows in assignments table:' as info, COUNT(*) FROM public.auditor_assignments;

-- 2. Check if you are truly logged in
SELECT 'My auth.uid():' as info, auth.uid();
SELECT 'My email:' as info, email FROM auth.users WHERE id = auth.uid();

-- 3. Check your profile match
SELECT 'My profile role:' as info, role FROM public.profiles WHERE id = auth.uid();

-- 4. Check if any RESTRICTIVE policies exist
-- These MUST be satisfied for any access to occur
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    cmd
FROM pg_policies 
WHERE tablename = 'clients' 
  AND permissive = 'RESTRICTIVE';

-- 5. Preview first 5 rows of clients (if any)
-- This will confirm if data exists but is hidden, or if it's truly empty
SELECT id, name, status FROM public.clients LIMIT 5;

-- 6. Check if clients table has RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'clients';

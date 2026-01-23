-- ============================================
-- COMPREHENSIVE DIAGNOSTIC FOR DATA LOADING ISSUES
-- Run this to identify why data isn't loading
-- ============================================

-- 1. Check if is_admin() function exists and works
SELECT 'Testing is_admin() function...' as step;
SELECT public.is_admin() as am_i_admin;

-- 2. Check current user's profile
SELECT 'Checking current user profile...' as step;
SELECT 
    id,
    email,
    role,
    created_at
FROM public.profiles 
WHERE id = auth.uid();

-- 3. Check if there are any clients in the database
SELECT 'Checking clients table...' as step;
SELECT COUNT(*) as total_clients FROM public.clients;

-- 4. Check if there are any settings
SELECT 'Checking settings table...' as step;
SELECT COUNT(*) as total_settings FROM public.settings;

-- 5. List all RLS policies on clients table
SELECT 'Checking RLS policies on clients...' as step;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'clients';

-- 6. List all RLS policies on settings table
SELECT 'Checking RLS policies on settings...' as step;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'settings';

-- 7. Try to select clients (will show if RLS is blocking)
SELECT 'Attempting to select clients...' as step;
SELECT id, name, status FROM public.clients LIMIT 5;

-- 8. Try to select settings (will show if RLS is blocking)
SELECT 'Attempting to select settings...' as step;
SELECT key, value FROM public.settings LIMIT 5;

-- 9. Check auth.uid()
SELECT 'Checking auth.uid()...' as step;
SELECT auth.uid() as my_user_id;

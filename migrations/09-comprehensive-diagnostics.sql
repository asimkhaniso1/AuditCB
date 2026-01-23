-- ============================================
-- COMPREHENSIVE DIAGNOSTICS
-- ============================================

-- 1. Check your current user profile
SELECT 
    id,
    email,
    role,
    created_at
FROM public.profiles 
WHERE id = auth.uid();

-- 2. Test if is_admin() returns true for you
SELECT public.is_admin() as am_i_admin;

-- 3. Check all active policies on clients table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'clients';

-- 4. Check if there are any RESTRICTIVE policies blocking you
SELECT 
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'clients' 
  AND permissive = 'RESTRICTIVE';

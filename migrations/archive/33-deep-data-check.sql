-- ============================================
-- DEEP DIAGNOSTIC: DATA EXISTENCE & RLS CHECK
-- Run this in Supabase SQL Editor to see what's really happening
-- ============================================

-- 1. Check RAW count (bypasses RLS in SQL Editor)
SELECT 'Total Clients (Raw)' as check_name, COUNT(*) as count FROM public.clients;

-- 2. Check Visible count (respects RLS for current user)
SELECT 'Visible Clients (You)' as check_name, COUNT(*) as count FROM public.clients;

-- 3. Check your Profile Role again
SELECT * FROM public.profiles WHERE email = 'info@companycertification.com';

-- 4. Check RLS Policies on Clients table
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'clients';

-- 5. List first 5 clients (if any exist) to prove data is there
SELECT id, name, status FROM public.clients LIMIT 5;

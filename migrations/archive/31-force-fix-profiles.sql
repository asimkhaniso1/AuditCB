-- ============================================
-- FINAL FIX: FORCE SYNC ALL USERS TO PROFILES WITH ADMIN ROLE
-- Run this in Supabase SQL Editor to restore access
-- ============================================

-- 1. Insert missing profiles for ALL auth users
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT 
    au.id, 
    au.email, 
    'Admin', -- FORCE ADMIN ROLE
    NOW(), 
    NOW()
FROM auth.users au
ON CONFLICT (id) DO UPDATE 
SET role = 'Admin'; -- FORCE UPDATE EXISTING TO ADMIN

-- 2. Verify the fix
SELECT * FROM public.profiles;

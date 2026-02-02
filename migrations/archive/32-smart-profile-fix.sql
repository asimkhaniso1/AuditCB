-- ============================================
-- FINAL FIX V2: FORCE SYNC WITH DUPLICATE HANDLING
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Update existing profiles first (safest way)
UPDATE public.profiles
SET role = 'Admin'
WHERE email IN (SELECT email FROM auth.users);

-- 2. Insert only truly missing profiles
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT 
    au.id, 
    au.email, 
    'Admin', 
    NOW(), 
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id OR p.email = au.email
);

-- 3. Verify specifically for your email
SELECT * FROM public.profiles WHERE email = 'info@companycertification.com';

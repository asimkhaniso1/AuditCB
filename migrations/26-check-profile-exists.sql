-- ============================================
-- FINAL DIAGNOSTIC: CHECK PROFILES TABLE FOR LOGGED-IN USER
-- Run this in Supabase SQL Editor to verify user mapping
-- ============================================

-- 1. Check your auth user
SELECT 'My auth.uid():' as info, auth.uid();

-- 2. Check if you exist in profiles table
SELECT 'My profile:' as info, id, email, role 
FROM public.profiles 
WHERE id = auth.uid();

-- 3. If no profile found, check all profiles
SELECT 'All profiles in table:' as info, id, email, role 
FROM public.profiles;

-- 4. Check all auth users (meta)
SELECT 'Auth users:' as info, id, email 
FROM auth.users 
LIMIT 5;

-- 5. CRITICAL: If you see your auth.uid() in step 1 but NOT in step 2,
-- then you need to create a profile record for yourself:

-- UNCOMMENT AND RUN THIS IF YOUR PROFILE IS MISSING:
-- INSERT INTO public.profiles (id, email, role)
-- VALUES (auth.uid(), 'YOUR_EMAIL@example.com', 'Admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'Admin';

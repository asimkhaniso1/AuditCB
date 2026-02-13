-- Check if user exists in Supabase Auth
-- Run this in Supabase SQL Editor to verify auth user was created

-- Check auth.users table (this is where Supabase stores authentication users)
SELECT 
    id,
    email,
    created_at,
    confirmed_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Check profiles table
SELECT 
    id,
    email,
    full_name,
    role
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- Compare: users in profiles but NOT in auth.users
SELECT 
    p.email,
    p.full_name,
    p.role,
    CASE 
        WHEN a.id IS NULL THEN '❌ No Auth User'
        ELSE '✅ Has Auth User'
    END as auth_status
FROM public.profiles p
LEFT JOIN auth.users a ON p.email = a.email
ORDER BY p.created_at DESC;

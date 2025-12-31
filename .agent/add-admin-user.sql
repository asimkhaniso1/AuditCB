-- Add Admin Role to asimkhaniso@gmail.com
-- Run this in Supabase SQL Editor

-- First, check if the user exists in auth.users
SELECT id, email FROM auth.users WHERE email = 'asimkhaniso@gmail.com';

-- If user exists, insert/update their profile with Admin role
INSERT INTO public.user_profiles (id, name, role, permissions)
SELECT 
    id,
    'Asim Khan',
    'Admin',
    ARRAY['all']::TEXT[]
FROM auth.users 
WHERE email = 'asimkhaniso@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'Admin',
    permissions = ARRAY['all']::TEXT[],
    updated_at = NOW();

-- Verify the update
SELECT up.*, au.email 
FROM public.user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE au.email = 'asimkhaniso@gmail.com';

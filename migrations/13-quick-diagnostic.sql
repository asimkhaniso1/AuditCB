-- Quick diagnostic to check user role and data access
-- Run this to see what's blocking the data

-- 1. What is my role?
SELECT 
    'My Role:' as info,
    id,
    email,
    role::text as role_value
FROM public.profiles 
WHERE id = auth.uid();

-- 2. Does is_admin() work?
SELECT 'is_admin() result:' as info, public.is_admin() as result;

-- 3. How many clients exist?
SELECT 'Total clients:' as info, COUNT(*) as count FROM public.clients;

-- 4. Can I see any clients with this query?
SELECT 
    'Trying to select clients:' as info,
    id, 
    name, 
    status 
FROM public.clients 
LIMIT 5;

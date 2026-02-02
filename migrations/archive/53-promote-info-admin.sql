-- PROMOTE "INFO" USER TO ADMIN
-- Purpose: The application hides clients from non-Admins if they aren't explicitly assigned.
-- Action: Promote 'info@companycertification.com' to 'Admin' so they can see EVERYTHING.

-- 1. Check current role
SELECT email, role FROM auth.users WHERE email = 'info@companycertification.com';
SELECT email, role FROM public.profiles WHERE email = 'info@companycertification.com';

-- 2. Force Update Auth User Metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"Admin"'
)
WHERE email = 'info@companycertification.com';

-- 3. Force Update Public Profile
INSERT INTO public.profiles (id, email, role, full_name)
SELECT id, email, 'Admin', 'Info SuperUser'
FROM auth.users
WHERE email = 'info@companycertification.com'
ON CONFLICT (id) DO UPDATE
SET role = 'Admin';

-- 4. Verify
SELECT '✅ USER PROMOTED. Refresh Dashboard.' as status, email, role 
FROM public.profiles 
WHERE email = 'info@companycertification.com';

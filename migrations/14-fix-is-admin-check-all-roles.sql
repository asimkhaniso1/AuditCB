-- ============================================
-- FIX: Update is_admin() to include ALL valid role values
-- First, let's check what roles exist in the database
-- ============================================

-- Step 1: See all unique role values in profiles table
SELECT DISTINCT role::text as role_value, COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY user_count DESC;

-- Step 2: See all defined values in the app_role enum
SELECT enumlabel as enum_value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumsortorder;

-- Step 3: Update is_admin() to include ALL admin-like roles from the enum
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get the user's role
    SELECT role::text INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Return true if role is any admin-like role
    RETURN user_role IN (
        'Admin',
        'Certification Manager',
        'admin',
        'certification_manager',
        'Super Admin',
        'super_admin'
    );
END;
$$ LANGUAGE plpgsql;

-- Step 4: Test the updated function
SELECT 'Testing updated is_admin()...' as step;
SELECT 
    auth.uid() as my_id,
    (SELECT role::text FROM public.profiles WHERE id = auth.uid()) as my_role,
    public.is_admin() as am_i_admin;

-- Step 5: Try to select clients
SELECT 'Trying to select clients...' as step;
SELECT id, name, status FROM public.clients LIMIT 5;

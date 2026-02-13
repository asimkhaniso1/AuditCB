-- ============================================
-- REMOVE TRIGGER - SIMPLE FIX
-- ============================================
-- This removes all triggers that might cause issues

-- Remove the trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Check for any other triggers on auth.users
SELECT 'Triggers removed. Try creating user now.' as status;

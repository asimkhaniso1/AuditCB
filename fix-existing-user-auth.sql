-- Manually create Supabase Auth user for existing profile
-- Replace the email and password with the actual user's details
-- Run this in Supabase SQL Editor

-- NOTE: This is a workaround. The proper way is to use the application's "Add User" feature
-- after refreshing the page to load the updated code.

-- You cannot directly insert into auth.users table via SQL
-- Instead, you need to use Supabase Dashboard:
-- 1. Go to Authentication → Users
-- 2. Click "Invite User" or "Add User"
-- 3. Enter the email address
-- 4. Set a password
-- 5. The user will be created in auth.users

-- OR use the Supabase Admin API (requires service role key)
-- This is not recommended for manual execution

-- RECOMMENDED APPROACH:
-- 1. Delete the user from profiles table:
DELETE FROM public.profiles WHERE email = 'user@example.com';

-- 2. Refresh your application page
-- 3. Use the "Add User" button in the application
-- 4. The new code will create both profile and auth user correctly

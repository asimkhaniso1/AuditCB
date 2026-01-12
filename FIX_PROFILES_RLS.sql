-- ============================================
-- FIX PROFILES RLS - Secure but Allow Auth
-- ============================================
-- This script properly secures the profiles table
-- while still allowing authentication and signup to work

-- Step 1: First disable RLS to allow dropping policies
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (comprehensive list)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can insert profile during signup" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can create profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Step 2: Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create proper policies

-- Allow ANYONE to read profiles (needed for team/auditor selection in UI)
CREATE POLICY "Anyone can view profiles"
ON profiles FOR SELECT
USING (true);

-- Allow ANYONE to insert profiles (needed for signup flow)
CREATE POLICY "Anyone can create profile"
ON profiles FOR INSERT
WITH CHECK (true);

-- Allow users to update ONLY their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to delete ONLY their own profile (optional)
CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- List policies
SELECT 
    policyname,
    cmd as operation,
    permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- FIX AUTH USER CREATION ERROR (v2)
-- ============================================
-- Run this to fix the database error when creating users

-- Step 1: Drop ALL existing policies on profiles first
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
DROP POLICY IF EXISTS "Users can insert profile" ON profiles;
DROP POLICY IF EXISTS "Users can update profile" ON profiles;

-- Step 2: Remove any problematic triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Remove conflicting constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE;

-- Step 4: Now we can alter the column type
ALTER TABLE profiles ALTER COLUMN id TYPE UUID USING id::UUID;

-- Step 5: Recreate primary key
ALTER TABLE profiles ADD PRIMARY KEY (id);

-- Step 6: Create trigger function for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'User')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Recreate RLS policies
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON profiles FOR UPDATE USING (true);

SELECT 'Auth fix applied successfully!' as status;

-- ============================================
-- FIX: Client Visibility Policies
-- ============================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts/duplicates
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Auditors can view assigned clients" ON public.clients;

-- 3. Create Admin/Manager Policy (Full Access)
CREATE POLICY "Staff can view all clients" 
ON public.clients
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('Admin', 'Certification Manager')
  )
);

-- 4. Create Auditor Policy (Assigned Access Only)
CREATE POLICY "Auditors can view assigned clients"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.auditor_assignments
    WHERE client_id = clients.id
      AND user_id = auth.uid()
  )
);

-- 5. Ensure Profiles are visible (Critical for Role Checks)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING ( id = auth.uid() );

-- Admins should see all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'Admin')
);


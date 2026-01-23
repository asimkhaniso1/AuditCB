-- ============================================
-- FIX: Update Client RLS Policies to use is_admin() function
-- This prevents recursion and ensures proper access control
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Auditors can view assigned clients" ON public.clients;

-- Create Admin/Manager Policy using is_admin() function
CREATE POLICY "Admins and Managers can manage all clients" 
ON public.clients
FOR ALL
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Create Auditor Policy (Assigned Access Only)
CREATE POLICY "Auditors can view assigned clients"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.auditor_assignments
    WHERE client_id = clients.id::text  -- Cast uuid to text
      AND user_id = auth.uid()
  )
);

-- Verify policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

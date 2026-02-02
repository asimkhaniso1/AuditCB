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

-- NOTE: Auditor policy temporarily removed due to schema issues
-- The auditor_assignments table needs user_id column to be UUID type
-- For now, admins will have full access and we'll add auditor filtering later

-- Verify policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

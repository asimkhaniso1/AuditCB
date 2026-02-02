-- ============================================
-- FIX: Enable Client Creation and Editing
-- Ensure Admins have full INSERT/UPDATE/DELETE rights
-- ============================================

-- 1. Review existing policies (optional, just ensuring we overwrite correct ones)
-- We will use explicitly named policies to avoid confusion

-- 2. Allow Admins/Cert Managers to INSERT new clients
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
CREATE POLICY "Admins can insert clients"
ON public.clients FOR INSERT
WITH CHECK (
    public.is_admin()
);

-- 3. Allow Admins/Cert Managers to UPDATE existing clients
DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
CREATE POLICY "Admins can update clients"
ON public.clients FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Allow Admins/Cert Managers to DELETE clients
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
CREATE POLICY "Admins can delete clients"
ON public.clients FOR DELETE
USING (public.is_admin());

-- 5. Ensure "Select" policy is correct (we already did this, but good to double check)
-- This was "Admins and Managers can manage all clients" in previous migration, 
-- but splitting it is cleaner. We'll leave the previous SELECT policy alone if it works, 
-- or we can reinforce it here. 
-- For now, let's trust the SELECT policy from migration 10 and focus on WRITE permissions.

-- 6. Verify `is_admin()` works for the current user
SELECT public.is_admin() as am_i_admin_now;

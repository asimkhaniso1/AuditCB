-- ============================================
-- FIX: Grants, permissions, and Duplicates
-- ============================================

-- 1. RE-DEFINE Function with proper search_path (Security Best Practice)
-- We need to ensure search_path is trusted for SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('Admin', 'Certification Manager')
  );
END;
$$ LANGUAGE plpgsql;

-- 2. CRITICAL: Grant Execute Permission on the Security Definer Function
-- Without this, the RLS policy throws an error, blocking access.
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon; -- Just in case, though anon usually can't satisfy the check

-- 3. Fix RLS Warning on Backup Table
-- It's a backup table, but Supabase warns if RLS is disabled in public schema
ALTER TABLE IF EXISTS public.auditor_assignments_backup ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on clients (Verification)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. Diagnostic Queries (Select to view output)

-- CHECK 1: Duplicate Clients by exact Name
SELECT 
    name, 
    COUNT(*) as count,
    array_agg(id) as ids
FROM public.clients 
GROUP BY name 
HAVING COUNT(*) > 1;

-- CHECK 2: Duplicate Auditor Profiles
SELECT 
    user_id, 
    COUNT(*) 
FROM public.auditor_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

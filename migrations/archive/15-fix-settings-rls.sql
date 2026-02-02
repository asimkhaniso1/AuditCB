-- ============================================
-- FIX: Enable Access to Settings Table
-- Allows showing Certification Body name and logo
-- ============================================

-- 1. Enable RLS on settings table (if not already)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow everyone to view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.settings;

-- 3. Create Policy: Allow anyone (even anon if needed for login page) to VIEW settings
-- Usually settings like logo/name should be public
CREATE POLICY "Allow public to view settings"
ON public.settings FOR SELECT
USING (true);

-- 4. Create Policy: Admins/Managers can UPDATE settings
CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Check if settings exist (diagnostic)
SELECT 'Total settings rows:' as info, COUNT(*) FROM public.settings;

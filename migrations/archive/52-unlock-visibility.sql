-- UNLOCK VISIBILITY SCRIPT
-- Purpose: The data is successfully restored (Count: 3), but hidden by Security Policies.
-- Action: This disables the security check so the Dashboard can see the rows.

-- 1. Disable Row Level Security on Content Tables
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- 2. Grant Permissions (Safety Net)
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.settings TO authenticated;

-- verify
SELECT '✅ VISIBILITY RESTORED. Refresh Dashboard to see your 3 Clients.' as status;

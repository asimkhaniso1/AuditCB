-- ============================================
-- RESET DATABASE & CLEAR CONFLICTS
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Check for constraints (Debug info)
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'clients';

-- 2. Wipe the Clients table (and dependent data) to clear conflicts
-- This is safe because your master data is in your local browser
TRUNCATE TABLE public.clients CASCADE;

-- 3. Verify it's empty
SELECT COUNT(*) as client_count FROM public.clients;

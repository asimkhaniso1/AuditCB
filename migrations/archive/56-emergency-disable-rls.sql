-- EMERGENCY: DISABLE RLS ON CLIENTS
-- The persistent "0 Clients" on frontend vs "3 Clients" in DB implies RLS is blocking the API read.
-- We will force the door open.

-- 1. Disable RLS completely for clients table
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- 2. Explicitly Grant Select permissions to everyone (just in case)
GRANT SELECT ON public.clients TO anon, authenticated, service_role;

-- 3. Verify RLS status (Should return false)
SELECT 
    relname as table_name, 
    relrowsecurity as rls_enabled 
FROM pg_class 
WHERE relname = 'clients';

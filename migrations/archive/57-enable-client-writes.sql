-- FIX: Enable Write Access for Clients
-- Previously we disabled RLS but only granted SELECT.
-- Now we must explicitly grant INSERT, UPDATE, DELETE to authenticated users (the app users).

GRANT INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clients TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.clients TO anon; -- Fallback for dev mode if needed

-- Also verification query
SELECT 
    grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'clients';

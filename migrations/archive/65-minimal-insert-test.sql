-- MINIMAL INSERT TEST
-- Run this in Supabase SQL Editor to test if inserts work at all

INSERT INTO public.clients (id, name, standard, status)
VALUES ('test-' || extract(epoch from now())::text, 'SQL Test Client', 'ISO 9001', 'Active');

-- If this succeeds, the problem is in the JavaScript code
-- If this fails, the database itself is blocking inserts

SELECT 'Test client inserted successfully!' as result;

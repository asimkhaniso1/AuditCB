-- DIAGNOSE RLS POLICIES
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('clients', 'auditor_assignments') 
ORDER BY tablename, policyname;

-- ============================================
-- DIAGNOSTIC: Check Clients Table Schema & Policies
-- ============================================

-- 1. Check Columns & Types
SELECT column_name, data_type, udt_name
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- 2. Check RLS Policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'clients';

-- 3. Check for any triggers that might block updates
SELECT event_object_table, trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'clients';

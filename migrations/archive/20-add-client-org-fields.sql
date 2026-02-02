-- ============================================
-- FIX: Add Missing Client Organizational Fields
-- The frontend expects these columns to store arrays of data
-- ============================================

-- 1. Add columns if they don't exist
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS designations text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS goods_services text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_processes text[] DEFAULT '{}';

-- 2. Comment on columns for clarity
COMMENT ON COLUMN public.clients.departments IS 'List of departments (e.g. HR, Sales)';
COMMENT ON COLUMN public.clients.designations IS 'List of job titles (e.g. Manager, Operator)';
COMMENT ON COLUMN public.clients.goods_services IS 'List of products/services provided';
COMMENT ON COLUMN public.clients.key_processes IS 'List of key business processes';

-- 3. Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('departments', 'designations', 'goods_services', 'key_processes');

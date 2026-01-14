-- Add role column to auditor_assignments if it doesn't exist
ALTER TABLE public.auditor_assignments ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Auditor';

-- Reload schema
NOTIFY pgrst, 'reload schema';

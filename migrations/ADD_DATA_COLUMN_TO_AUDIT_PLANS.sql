-- Add 'data' column to audit_plans if it doesn't exist
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Also verify other required columns exist based on the code usage
ALTER TABLE public.audit_plans 
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS plan_date DATE,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS lead_auditor TEXT,
ADD COLUMN IF NOT EXISTS status TEXT;

-- Verify RLS is enabled
ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;

-- Grant access (in case it wasn't done)
GRANT ALL ON public.audit_plans TO authenticated;
GRANT ALL ON public.audit_plans TO service_role;

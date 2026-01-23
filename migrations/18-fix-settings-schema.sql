-- ============================================
-- FIX: Update Settings Table Schema
-- The table exists but is missing the 'key' column required for the new structure
-- ============================================

-- 1. Add 'key' column if it doesn't exist
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS key TEXT UNIQUE;

-- 2. Add 'value' column if it doesn't exist
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'::jsonb;

-- 3. Now we can safely insert the defaults
INSERT INTO public.settings (key, value)
VALUES (
    'cb_details', 
    '{
        "name": "AuditCB Demo Body",
        "logo": "https://placehold.co/150x50?text=AuditCB", 
        "address": "123 Certification Way",
        "email": "admin@auditcb.com",
        "phone": "+1 (555) 123-4567"
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. Enable RLS (just in case)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 5. Re-apply policies (safely)
DROP POLICY IF EXISTS "Allow public to view settings" ON public.settings;
CREATE POLICY "Allow public to view settings"
ON public.settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'settings';

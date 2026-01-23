-- ============================================
-- FIX: FORCE Update Settings Data
-- Previous migration only inserted if missing. 
-- This one OVERWRITES existing empty/broken data.
-- ============================================

-- 1. Update the EXISTING row(s) with valid defaults
UPDATE public.settings
SET 
    cb_settings = '{
        "cbName": "AuditCB Demo Body",
        "cbAddress": "123 Certification Way, ISO City",
        "cbPhone": "+1 (555) 123-4567",
        "cbEmail": "admin@auditcb.com",
        "logoUrl": "https://placehold.co/150x50?text=AuditCB",
        "brandColors": {"primary": "#0f766e", "secondary": "#f59e0b"},
        "cbSites": [{
            "name": "Head Office",
            "address": "123 Certification Way",
            "city": "ISO City",
            "country": "USA",
            "phone": "+1 (555) 123-4567"
        }]
    }'::jsonb,
    organization = '[]'::jsonb,
    policies = '{}'::jsonb,
    knowledge_base = '{}'::jsonb
WHERE cb_settings IS NULL OR cb_settings = '{}'::jsonb;

-- 2. Ensure RLS is definitely correct
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to view settings" ON public.settings;
CREATE POLICY "Allow public to view settings"
ON public.settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. Verify what we have now
SELECT id, cb_settings FROM public.settings;

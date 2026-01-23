-- ============================================
-- FIX: Populate Settings with Defaults (Schema Compliant)
-- The table 'settings' exists with 'cb_settings' (jsonb) and 'id' (uuid)
-- The App code needs to be patched to handle UUID, but first we ensure data exists.
-- ============================================

-- 1. Insert default row if table is empty
INSERT INTO public.settings (cb_settings, organization, policies, knowledge_base)
SELECT 
    '{
        "cbName": "AuditCB Demo Body",
        "cbAddress": "123 Certification Way, ISO City",
        "cbPhone": "+1 (555) 123-4567",
        "cbEmail": "admin@auditcb.com",
        "logoUrl": "https://placehold.co/150x50?text=AuditCB",
        "brandColors": {"primary": "#0f766e", "secondary": "#f59e0b"}
    }'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- 2. Ensure RLS allows access (Re-assert permissive policies)
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

-- 3. Verify
SELECT * FROM public.settings;

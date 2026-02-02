-- ============================================
-- FIX: Create missing settings table
-- This table is required for storing CB details (Logo, Name) and global config
-- ============================================

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL, -- e.g. 'cb_details', 'app_config'
    value JSONB DEFAULT '{}'::jsonb,
    organization_id UUID REFERENCES public.organizations(id), -- Optional link to organization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Legacy columns (migrating from other potential schemas)
    cb_settings JSONB DEFAULT '{}'::jsonb,
    organization JSONB DEFAULT '[]'::jsonb,
    policies JSONB DEFAULT '{}'::jsonb,
    knowledge_base JSONB DEFAULT '{}'::jsonb
);

-- 2. Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies (Comprehensive)

-- Allow everyone to READ settings (needed for login page logo, etc.)
DROP POLICY IF EXISTS "Allow public to view settings" ON public.settings;
CREATE POLICY "Allow public to view settings"
ON public.settings FOR SELECT
USING (true);

-- Allow Admins to MANAGE settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
ON public.settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Insert Default 'cb_details' if missing
-- This is the row used by settings-module.js and the header
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

-- 5. Insert single row for legacy compatibility (if app queries without key)
-- Some parts of the app might look for the first row of 'settings'
INSERT INTO public.settings (key, value)
VALUES (
    'global_config',
    '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 6. Verify Creation
SELECT * FROM public.settings;

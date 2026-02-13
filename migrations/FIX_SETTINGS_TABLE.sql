-- ============================================
-- FIX SETTINGS TABLE
-- ============================================

-- 1. Ensure settings table exists with correct structure
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    standards JSONB DEFAULT '[]',
    roles JSONB DEFAULT '[]',
    is_admin BOOLEAN DEFAULT false,
    cb_settings JSONB DEFAULT '{}',
    organization JSONB DEFAULT '[]',
    policies JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Disable RLS on settings
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 3. Ensure required columns exist (add if missing)
DO $$
BEGIN
    -- Add cb_settings if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'cb_settings') THEN
        ALTER TABLE settings ADD COLUMN cb_settings JSONB DEFAULT '{}';
    END IF;
    
    -- Add organization if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'organization') THEN
        ALTER TABLE settings ADD COLUMN organization JSONB DEFAULT '[]';
    END IF;
    
    -- Add policies if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'policies') THEN
        ALTER TABLE settings ADD COLUMN policies JSONB DEFAULT '{}';
    END IF;
END $$;

-- 4. Insert default row if empty
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'Settings table fixed' as status;

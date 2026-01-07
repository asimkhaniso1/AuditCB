-- FORCE SETTINGS ROW
-- Ensure the settings row with ID 1 exists so upsert works
INSERT INTO settings (id, is_admin, created_at, updated_at)
VALUES (1, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Grant permissions explicitly
GRANT ALL ON settings TO public;
GRANT ALL ON settings TO anon;
GRANT ALL ON settings TO authenticated;
GRANT ALL ON settings TO service_role;

-- Disable RLS explicitly again
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

SELECT 'Settings row ensured and access granted' as status;

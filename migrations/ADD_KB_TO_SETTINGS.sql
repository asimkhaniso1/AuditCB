-- ============================================
-- ADD KNOWLEDGE BASE TO SETTINGS (FIXED TYPE)
-- ============================================

-- Add knowledge_base column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'knowledge_base') THEN
        ALTER TABLE settings ADD COLUMN knowledge_base JSONB DEFAULT '{}';
    END IF;
END $$;

-- Update updated_at using string ID '1' to match schema
UPDATE settings SET updated_at = NOW() WHERE id = '1';

SELECT 'Knowledge base column added to settings' as status;

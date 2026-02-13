-- ============================================
-- FIX STORAGE BUCKETS
-- ============================================

-- 1. Create 'checklists' bucket (User Request)
INSERT INTO storage.buckets (id, name, public) VALUES ('checklists', 'checklists', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Policy for 'checklists'
DROP POLICY IF EXISTS "Allow all on checklists" ON storage.objects;
CREATE POLICY "Allow all on checklists" ON storage.objects FOR ALL USING (bucket_id = 'checklists') WITH CHECK (bucket_id = 'checklists');

-- 3. Address Duplicate Documents Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure policy for 'documents'
DROP POLICY IF EXISTS "Allow all on documents" ON storage.objects;
CREATE POLICY "Allow all on documents" ON storage.objects FOR ALL USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');

SELECT 'Buckets fixed: checklists created. Please manually migrate/delete "Documents" if empty.' as status;

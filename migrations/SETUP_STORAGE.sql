-- ============================================
-- SETUP STORAGE BUCKETS
-- ============================================

-- Reference: https://supabase.com/docs/guides/storage/security/access-control

-- 1. Create Buckets (if they don't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-data', 'app-data', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-images', 'audit-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-reports', 'audit-reports', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Public Access (Temporary, for fixing sync) / OR Authenticated Only
-- For now, we allow public read/write to ensure sync works, then we can lock it down with RLS.

-- Policy: Allow ALL for app-data
CREATE POLICY "Allow all on app-data" ON storage.objects FOR ALL USING (bucket_id = 'app-data') WITH CHECK (bucket_id = 'app-data');

-- Policy: Allow ALL for audit-images
CREATE POLICY "Allow all on audit-images" ON storage.objects FOR ALL USING (bucket_id = 'audit-images') WITH CHECK (bucket_id = 'audit-images');

-- Policy: Allow ALL for audit-reports
CREATE POLICY "Allow all on audit-reports" ON storage.objects FOR ALL USING (bucket_id = 'audit-reports') WITH CHECK (bucket_id = 'audit-reports');

-- Policy: Allow ALL for documents
CREATE POLICY "Allow all on documents" ON storage.objects FOR ALL USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');

SELECT 'Storage buckets created successfully!' as status;

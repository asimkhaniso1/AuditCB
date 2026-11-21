-- ============================================================
-- SECURE AUDIT-REPORTS / AUDIT-FILES STORAGE POLICIES
-- ============================================================
-- Follows SECURE_AUDIT_IMAGES_POLICIES.sql (audit-images, app-data,
-- audit-logos). Both buckets here are already private (public = false), but
-- their storage.objects policies apply to role public. Live definitions read
-- 2026-11-21:
--   audit-reports:
--     "Allow all on audit-reports"          ALL    using/check bucket_id only
--         -> no auth check: anyone with the anon key can list, upload,
--            overwrite and delete (it came from SETUP_STORAGE.sql)
--     "Authenticated Read/Insert/Delete Audit Reports"  bucket_id AND
--         auth.role() = 'authenticated'
--   audit-files:
--     "Allow All Audit Files Auth" (ALL), "Authenticated users can
--     upload/update/delete"                bucket_id AND
--         auth.role() = 'authenticated'
--         -> already signed-in only in effect; restated as TO authenticated
--
-- Neither bucket is used by the shipped app today: audit-files has no code
-- references, and SupabaseClient.storage.uploadAuditReport (audit-reports,
-- upsert + createSignedUrl) has no callers. Signed-in users keep full access
-- so that function still works if it is wired up later.
--
-- This migration:
--   0. Stops, changing nothing, if a policy on these buckets also covers
--      another bucket (review that one by hand).
--   1. Drops every storage.objects policy on the two buckets that applies to
--      role public or anon, printing each one's full definition (keep that
--      output: it is the rollback record).
--   2. Recreates select, insert, update, delete TO authenticated for both.
--   3. Warns about any policy still open to public/anon anywhere on
--      storage.objects (expected: none).
-- Bucket flags are not changed (both stay private). No object is deleted.
--
-- HOW TO RUN (Supabase dashboard > SQL editor, as the project owner):
--   1. Run the PREVIEW query below on its own and save the output.
--   2. Run everything from BEGIN to the end in one go. If step 0 raises an
--      exception, the transaction rolls back and nothing has changed.
--   3. Check the NOTICE/WARNING messages and the Verify results at the end.
-- Idempotent: a second run drops nothing and recreates the same policies.
-- NOT applied automatically.
-- ============================================================

-- PREVIEW (run alone first; the output is your record of the old state):
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
--       ~ '''(audit-reports|audit-files)'''
-- ORDER BY policyname;

BEGIN;

-- 0. Guard: a policy shared with another bucket must be reviewed by hand ---

DO $$
DECLARE
  pol record;
  other text;
BEGIN
  FOR pol IN
    SELECT policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS def
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~ '''(audit-reports|audit-files)'''
  LOOP
    SELECT string_agg(b.id, ', ') INTO other
    FROM storage.buckets b
    WHERE b.id NOT IN ('audit-reports', 'audit-files')
      AND position('''' || b.id || '''' IN pol.def) > 0;
    IF other IS NOT NULL THEN
      RAISE EXCEPTION 'storage.objects policy "%" also covers bucket(s) %; review it by hand. Nothing was changed.',
        pol.policyname, other;
    END IF;
  END LOOP;
END $$;

-- 1. Drop every public/anon policy on the two buckets ---------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public', 'anon']::name[]
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~ '''(audit-reports|audit-files)'''
  LOOP
    RAISE NOTICE 'Dropping storage.objects policy "%" (% to %): using=% check=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check;
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 2. Signed-in users only -----------------------------------------------------

-- audit-reports (report PDFs; uploadAuditReport uses upsert + signed URLs)
DROP POLICY IF EXISTS "audit_reports_select_authenticated" ON storage.objects;
CREATE POLICY "audit_reports_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-reports');

DROP POLICY IF EXISTS "audit_reports_insert_authenticated" ON storage.objects;
CREATE POLICY "audit_reports_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audit-reports');

DROP POLICY IF EXISTS "audit_reports_update_authenticated" ON storage.objects;
CREATE POLICY "audit_reports_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audit-reports')
  WITH CHECK (bucket_id = 'audit-reports');

DROP POLICY IF EXISTS "audit_reports_delete_authenticated" ON storage.objects;
CREATE POLICY "audit_reports_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audit-reports');

-- audit-files
DROP POLICY IF EXISTS "audit_files_select_authenticated" ON storage.objects;
CREATE POLICY "audit_files_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-files');

DROP POLICY IF EXISTS "audit_files_insert_authenticated" ON storage.objects;
CREATE POLICY "audit_files_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audit-files');

DROP POLICY IF EXISTS "audit_files_update_authenticated" ON storage.objects;
CREATE POLICY "audit_files_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audit-files')
  WITH CHECK (bucket_id = 'audit-files');

DROP POLICY IF EXISTS "audit_files_delete_authenticated" ON storage.objects;
CREATE POLICY "audit_files_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audit-files');

-- 3. Report anything still open to anonymous users --------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public', 'anon']::name[]
  LOOP
    RAISE WARNING 'storage.objects policy "%" (% to %) still applies to anonymous users: using=% check=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check;
  END LOOP;
END $$;

COMMIT;

-- Verify ------------------------------------------------------------------------
-- Expect: exactly the 8 *_authenticated policies above, none with {public}.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
      ~ '''(audit-reports|audit-files)'''
ORDER BY policyname;

-- Expect: no rows (nothing on storage.objects open to public/anon).
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND roles && ARRAY['public', 'anon']::name[];

-- ROLLBACK (only if something breaks). Recreate what step 1 dropped from the
-- NOTICE lines / PREVIEW output. The only one without an auth check was:
-- CREATE POLICY "Allow all on audit-reports" ON storage.objects
--   FOR ALL USING (bucket_id = 'audit-reports') WITH CHECK (bucket_id = 'audit-reports');

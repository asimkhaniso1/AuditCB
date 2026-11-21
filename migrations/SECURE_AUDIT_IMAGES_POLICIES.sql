-- ============================================================
-- SECURE AUDIT-IMAGES / APP-DATA / AUDIT-LOGOS STORAGE POLICIES
-- ============================================================
-- Found 2026-11-19 (read-only checks with the public anon key):
--   * audit-images (client evidence screenshots, ~214 files) has
--     "Allow all on audit-images": FOR ALL, no TO clause (= role public),
--     USING/CHECK bucket_id = 'audit-images' only. Anyone holding the anon
--     key (it is served in /env-config.js) can LIST every file, and the
--     policy also lets them upload, overwrite and delete evidence.
--   * app-data (4 legacy state-backup JSON files) has "Allow all on
--     app-data" the same way.
--   * audit-logos has "Global Permissive Select/Insert/Update/Delete" and
--     "Public Access Select/Insert/Update", all role public.
-- These came from SETUP_STORAGE.sql / CREATE_AUDIT_IMAGES_BUCKET.sql and
-- were not covered by the 2026-10-17 lockdown (SECURE_DOCUMENTS_BUCKET.sql).
--
-- This migration (step 0a of the audit-images privacy proposal):
--   0. Stops, changing nothing, if a policy on one of these buckets also
--      covers another bucket (review that one by hand).
--   1. Drops every storage.objects policy on these three buckets that
--      applies to role public or anon, printing each one's full definition
--      (keep that output: it is the rollback record).
--   2. Recreates access for signed-in users only (TO authenticated):
--        audit-images, audit-logos: select, insert, update, delete
--        app-data:                  select only (the app no longer uses it)
--   3. Warns about any policy still open to public/anon on other buckets
--      (audit-reports, audit-files) or not scoped to any bucket. Those are
--      NOT changed here.
--
-- What it does NOT change:
--   * Bucket "public" flags. audit-images and audit-logos stay public, so
--     every stored https://.../object/public/... URL, printed report,
--     Evidence Pack and the CORS canvas downscale keep working: Supabase
--     serves /object/public/ for a public bucket WITHOUT checking these
--     policies. What stops: anonymous list, upload, overwrite, delete.
--     A file can still be read by anyone who already has its exact URL;
--     closing that needs the signed-URL app change (not part of this file).
--   * No object is deleted, moved or rewritten. app-data's 4 JSON files
--     stay where they are (making that bucket private is an optional,
--     commented-out block at the end).
--
-- The app keeps working because it only touches these buckets while signed
-- in: uploadAuditImage / uploadClientLogo upload with upsert (needs select +
-- insert + update), and nothing calls list or delete anonymously.
--
-- HOW TO RUN (Supabase dashboard > SQL editor, as the project owner):
--   1. Run the PREVIEW queries below on their own and save the output.
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
--       ~ '''(audit-images|app-data|audit-logos)'''
-- ORDER BY policyname;
--
-- SELECT id, public FROM storage.buckets
-- WHERE id IN ('audit-images', 'app-data', 'audit-logos');

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
          ~ '''(audit-images|app-data|audit-logos)'''
  LOOP
    SELECT string_agg(b.id, ', ') INTO other
    FROM storage.buckets b
    WHERE b.id NOT IN ('audit-images', 'app-data', 'audit-logos')
      AND position('''' || b.id || '''' IN pol.def) > 0;
    IF other IS NOT NULL THEN
      RAISE EXCEPTION 'storage.objects policy "%" also covers bucket(s) %; review it by hand. Nothing was changed.',
        pol.policyname, other;
    END IF;
  END LOOP;
END $$;

-- 1. Drop every public/anon policy on the three buckets ---------------------

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
          ~ '''(audit-images|app-data|audit-logos)'''
  LOOP
    RAISE NOTICE 'Dropping storage.objects policy "%" (% to %): using=% check=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check;
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 2. Signed-in users only -----------------------------------------------------
-- No tenant model exists yet and there are no client logins (roles are CB
-- staff only, public sign-up is off), so "authenticated" = invited staff.

-- audit-images (evidence screenshots)
DROP POLICY IF EXISTS "audit_images_select_authenticated" ON storage.objects;
CREATE POLICY "audit_images_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-images');

DROP POLICY IF EXISTS "audit_images_insert_authenticated" ON storage.objects;
CREATE POLICY "audit_images_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audit-images');

DROP POLICY IF EXISTS "audit_images_update_authenticated" ON storage.objects;
CREATE POLICY "audit_images_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audit-images')
  WITH CHECK (bucket_id = 'audit-images');

DROP POLICY IF EXISTS "audit_images_delete_authenticated" ON storage.objects;
CREATE POLICY "audit_images_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audit-images');

-- audit-logos (client logos on reports and certificates)
DROP POLICY IF EXISTS "audit_logos_select_authenticated" ON storage.objects;
CREATE POLICY "audit_logos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "audit_logos_insert_authenticated" ON storage.objects;
CREATE POLICY "audit_logos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "audit_logos_update_authenticated" ON storage.objects;
CREATE POLICY "audit_logos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audit-logos')
  WITH CHECK (bucket_id = 'audit-logos');

DROP POLICY IF EXISTS "audit_logos_delete_authenticated" ON storage.objects;
CREATE POLICY "audit_logos_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audit-logos');

-- app-data (legacy backups; tools/data-sync.js no longer writes here)
DROP POLICY IF EXISTS "app_data_select_authenticated" ON storage.objects;
CREATE POLICY "app_data_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-data');

-- 3. Report what is still open (not changed here) --------------------------------

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
-- Expect: no row with roles {public} or {anon}; the 9 *_authenticated
-- policies above plus any older TO authenticated ones.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
      ~ '''(audit-images|app-data|audit-logos)'''
ORDER BY policyname;

-- Expect: unchanged (audit-images and audit-logos still public).
SELECT id, public FROM storage.buckets
WHERE id IN ('audit-images', 'app-data', 'audit-logos');

-- From outside (no login), after running:
--   POST /storage/v1/object/list/audit-images with only the anon key
--     -> []  (was: every file)
--   GET  an existing /storage/v1/object/public/audit-images/... URL
--     -> 200 (stored evidence still displays)
-- In the app, signed in: capture or upload one screenshot on a test
-- question and open a report; both should work as before.

-- ROLLBACK (only if the app breaks). Recreate what step 1 dropped from the
-- NOTICE lines / PREVIEW output. The evidence-bucket one was:
-- CREATE POLICY "Allow all on audit-images" ON storage.objects
--   FOR ALL USING (bucket_id = 'audit-images') WITH CHECK (bucket_id = 'audit-images');
-- and for app-data:
-- CREATE POLICY "Allow all on app-data" ON storage.objects
--   FOR ALL USING (bucket_id = 'app-data') WITH CHECK (bucket_id = 'app-data');

-- OPTIONAL, separate decision (not part of step 0a): app-data is unused by
-- the app, but while the bucket is public its 4 JSON files can still be
-- downloaded by anyone who knows their exact paths. Download copies from the
-- dashboard first (no backups on the Free plan), then:
-- UPDATE storage.buckets SET public = false WHERE id = 'app-data';

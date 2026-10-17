-- ============================================================
-- SECURE DOCUMENTS BUCKET
-- ============================================================
-- The 'documents' bucket holds client manuals, auditor qualifications and
-- KB standards. CREATE_DOCUMENT_CHECKLIST_BUCKETS.sql made it public and
-- added "Allow public read access to documents" (TO public), and
-- SETUP_STORAGE.sql / FIX_STORAGE.sql added "Allow all on documents" with no
-- TO clause — i.e. anonymous read AND write/delete. Anyone with the project
-- URL could list, download, overwrite or delete these files.
--
-- This migration:
--   1. Makes the bucket private (public URLs stop resolving).
--   2. Drops EVERY storage.objects policy that references the 'documents'
--      bucket (whatever its name or role), printing each one it drops.
--   3. Recreates access for signed-in users only (TO authenticated).
--   4. Warns about blanket anon/public SELECT policies on storage.objects
--      that are not scoped to any bucket (these would still expose files;
--      review them by hand — they may serve other buckets).
--
-- BEFORE RUNNING: deploy the app version that opens documents by storage
-- path with a signed URL (client-docs-bulk.js, settings-kb.js,
-- advanced-modules.js auditor documents). Records saved earlier with a
-- public cloudUrl but no cloudPath will no longer open and need re-upload.
--
-- Idempotent. Run in the Supabase SQL editor; NOT applied automatically.
-- ============================================================

-- Preview what will be dropped (run alone first if you want to review):
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND (coalesce(qual,'') LIKE '%''documents''%' OR coalesce(with_check,'') LIKE '%''documents''%');

BEGIN;

-- 1. Private bucket ----------------------------------------------------------

UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- 2. Drop every policy touching the documents bucket -------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (coalesce(qual, '') LIKE '%''documents''%'
           OR coalesce(with_check, '') LIKE '%''documents''%')
  LOOP
    RAISE NOTICE 'Dropping storage.objects policy % (% to %): using=% check=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check;
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3. Signed-in users only ----------------------------------------------------
-- (There is no tenant model yet, so "authenticated" is the narrowest scope
-- available; with public signup disabled that means invited staff only.)

CREATE POLICY "documents_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

-- 4. Flag unscoped anonymous read policies -----------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, roles, qual
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('SELECT', 'ALL')
      AND (roles && ARRAY['public', 'anon']::name[])
      AND coalesce(qual, '') NOT LIKE '%bucket_id%'
  LOOP
    RAISE WARNING 'storage.objects policy % (% to %) is not bucket-scoped and still lets anonymous users read objects: using=%',
      pol.policyname, pol.cmd, pol.roles, pol.qual;
  END LOOP;
END $$;

COMMIT;

-- Verify
SELECT id, public FROM storage.buckets WHERE id = 'documents';
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') LIKE '%''documents''%' OR coalesce(with_check, '') LIKE '%''documents''%');

-- ADD_NCR_AUDITEE_RESPONSE_FILES.sql
-- Lists the files the organisation sent back for a nonconformity: the filled-in
-- Corrective Action Request and its supporting evidence, uploaded from the
-- Review previous finding form (ncr-capa-module.js).
--
--   auditee_response_files  jsonb array of
--     { name, path, size, type, uploadedAt, uploadedBy }
--
-- The files themselves live in the private 'documents' storage bucket under
-- ncr-responses/<client id>/<ncr id>/ and open only through short-lived signed
-- URLs. The bucket's existing policies (SECURE_DOCUMENTS_BUCKET.sql: signed-in
-- users only) apply; no new storage policy is needed.
--
-- Until this runs, the app keeps working: persistNCR() sends the column only
-- for a record that carries response files, and tells the auditor to run this
-- migration if such a save is refused.
--
-- Idempotent: safe to re-run. No data loss.

ALTER TABLE public.audit_ncrs
    ADD COLUMN IF NOT EXISTS auditee_response_files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- New columns are invisible to PostgREST until its schema cache is reloaded.
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_ncrs'
  AND column_name = 'auditee_response_files';

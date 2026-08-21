-- ADD_NCR_SOURCE_IDENTITY.sql
-- Persists the identity that ties a register record to the checklist finding
-- that raised it:
--
--   source_checklist_id  the checklist the finding came from
--   source_item_idx      the item's position within that checklist
--
-- execution-module-v2.js's checklist sync deduplicates by this identity
-- (stableIdentityMatch) when its in-memory key is unavailable. Both fields
-- were mapped by fetchNCRs and carried across refetches WITHIN a session, but
-- never written to the database — persistNCR had no column for them. So every
-- fresh sign-in loaded the register with no identity on any record, the next
-- checklist save could not recognise its own findings, and it fell through to
-- an exact-text match on the description. Any finding whose wording had been
-- edited since — an AI polish, a corrected sentence — matched nothing and was
-- minted again. A four-finding audit accumulated some twenty register records
-- this way, and the withdraw pass that should have retired the extras keys on
-- the same missing identity, so it retired none of them.
--
-- TEXT rather than a foreign key: checklist ids are client-generated numbers
-- (Date.now()) and a checklist may be rebuilt under a new id while its findings
-- legitimately survive; a constraint here would block exactly that.
--
-- Idempotent: safe to re-run. No data loss. Existing rows stay NULL until the
-- next checklist save writes them, which is what the session-only carry-over
-- already does for records it can still identify.

ALTER TABLE public.audit_ncrs ADD COLUMN IF NOT EXISTS source_checklist_id text;
ALTER TABLE public.audit_ncrs ADD COLUMN IF NOT EXISTS source_item_idx     text;

-- New columns are invisible to PostgREST until its schema cache is reloaded;
-- without this the first write still fails with "column not found".
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_ncrs'
  AND column_name IN ('source_checklist_id', 'source_item_idx', 'criterion_ref', 'criterion_source')
ORDER BY column_name;

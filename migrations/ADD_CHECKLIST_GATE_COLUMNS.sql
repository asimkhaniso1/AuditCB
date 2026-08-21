-- ADD_CHECKLIST_GATE_COLUMNS.sql
-- The Ready-for-Audit gate (checklist-module.js / checklist-coverage.js) stores
-- three pieces of state on a checklist that the table has no column for:
--
--   ready_for_audit  {by, at, itemCount, coverage}  — the release record: who
--                    released the checklist for audit, when, and the coverage
--                    figures it was released against
--   resolved_issues  {key: {action, note, by, at}}  — the auditor's recorded
--                    dispositions for QA/coverage issues that were allowed to
--                    stand, keyed by code|itemRef|nearRef
--   qa_context       {standardIds, auditType, ceiling, soaApplicable,
--                    soaSupplied} — the scope the checklist was generated and
--                    judged against, including a Statement of Applicability
--                    supplied after creation
--
-- Without these columns every gate action (release, remove question, assign
-- clause, record justification, add controls, supply the SoA) persisted only to
-- local browser state: the cloud update named a column that does not exist and
-- failed with a 400, which the caller logged and swallowed. A release recorded
-- on one machine was invisible on another, and an audit trail an accreditation
-- assessor would expect to find was never leaving the browser.
--
-- jsonb rather than separate scalar columns: all three are documents whose shape
-- belongs to the application, and splitting them would put the gate's internals
-- into the schema, where every future change to it becomes a migration.
--
-- Idempotent: safe to re-run. No data loss.

ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS ready_for_audit jsonb;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS resolved_issues jsonb;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS qa_context      jsonb;

-- New columns are invisible to PostgREST until its schema cache is reloaded;
-- without this the first write still fails with "column not found".
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checklists'
ORDER BY ordinal_position;

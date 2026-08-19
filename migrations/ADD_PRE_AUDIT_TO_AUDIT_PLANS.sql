-- ADD_PRE_AUDIT_TO_AUDIT_PLANS.sql
-- ============================================================================
-- The client writes plan.preAudit (Stage 1 document review: status, completed
-- date, documentReview map, aiSummary, focusPoints) to audit_plans.pre_audit
-- on every plan sync (supabase-client.js syncAuditPlansToSupabase and the
-- single-plan update path). The column was never added, so PostgREST rejects
-- the WHOLE upsert/PATCH with PGRST204:
--   "Could not find the 'pre_audit' column of 'audit_plans' in the schema cache"
-- — meaning NO audit-plan changes persist to the cloud, not just pre-audit data.
--
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE public.audit_plans
    ADD COLUMN IF NOT EXISTS pre_audit jsonb;

-- Make PostgREST pick up the new column without waiting for a cache cycle.
NOTIFY pgrst, 'reload schema';

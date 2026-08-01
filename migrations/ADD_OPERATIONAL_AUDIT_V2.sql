-- Universal Audit Framework v2.0: operational audit data
-- Adds structured JSON columns to audit_reports so the report builder can
-- persist distribution lists, sampling plans, coverage matrices, finding
-- status tracking, and framework-specific technical pack data
-- (see audit-frameworks.js / report-frameworks.js).
-- Safe to re-run: all additions are IF NOT EXISTS.

ALTER TABLE audit_reports
  ADD COLUMN IF NOT EXISTS distribution jsonb,
  ADD COLUMN IF NOT EXISTS sampling jsonb,
  ADD COLUMN IF NOT EXISTS coverage jsonb,
  ADD COLUMN IF NOT EXISTS finding_status jsonb,
  ADD COLUMN IF NOT EXISTS framework_data jsonb;

NOTIFY pgrst, 'reload schema';

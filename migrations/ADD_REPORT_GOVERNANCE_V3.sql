-- Report Governance V3: technical review sign-off, issued-snapshot immutability,
-- and post-issue amendment logging for audit_reports; extended CAR status
-- vocabulary + verifier attribution for audit_ncrs.
-- (see ncr-capa-module.js CAR_STATUSES / normalizeCarStatus, report-*.js consumers).
-- Safe to re-run: all additions are IF NOT EXISTS.

ALTER TABLE audit_reports
  ADD COLUMN IF NOT EXISTS technical_review jsonb,
  ADD COLUMN IF NOT EXISTS issued_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS issue_log jsonb;

ALTER TABLE audit_ncrs
  ADD COLUMN IF NOT EXISTS car_status text,
  ADD COLUMN IF NOT EXISTS verified_by text;

NOTIFY pgrst, 'reload schema';

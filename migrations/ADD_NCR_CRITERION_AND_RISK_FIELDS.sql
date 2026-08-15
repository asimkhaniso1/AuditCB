-- Adds criterion-traceability and optional formal risk-assessment fields to audit_ncrs.
-- criterion_ref / criterion_source: real ISO clause backing a finding whose internal
-- reference is a pseudo-clause (FOCUS.x / SURV / ORG / DOC carryover items).
-- risk_likelihood / risk_impact: auditor-entered 1-5 values; NULL means no formal
-- risk assessment was performed (report then shows "Risk assessment not performed").
-- Until this migration is applied, the app keeps these fields in local state only —
-- persistNCR/fetchNCRs mappings must be enabled after running it (see ncr-capa-module.js).

ALTER TABLE audit_ncrs ADD COLUMN IF NOT EXISTS criterion_ref TEXT;
ALTER TABLE audit_ncrs ADD COLUMN IF NOT EXISTS criterion_source TEXT;
ALTER TABLE audit_ncrs ADD COLUMN IF NOT EXISTS risk_likelihood SMALLINT CHECK (risk_likelihood BETWEEN 1 AND 5);
ALTER TABLE audit_ncrs ADD COLUMN IF NOT EXISTS risk_impact SMALLINT CHECK (risk_impact BETWEEN 1 AND 5);

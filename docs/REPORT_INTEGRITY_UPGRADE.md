# Audit360 — Certification Audit Report Integrity & Professionalization

> **2026-08-17 addendum — KTD regression pass.** Page-by-page inspection of the real regenerated KTD PDF drove a final stabilization pass: the formal executive section is now the deterministic **Audit Outcome Summary** (7 rows; Board Decision Brief, Conformity Score tile, Overall Health Verdict, Strategic Concerns/Management Priorities removed from the formal report); narrative text can no longer print "Clause FOCUS.x" or raw "General" departments; `buildProgramme` gains `nextAudit` + impossible-chronology detection ("Requires scheduling" instead of a past-dated "Planned" recert, closing NEXT AUDIT never shows a date ≤ the audit date); NCR/CAR/lifecycle/CAR-form tables lead with the real criterion ("ISO 9001:2015 — Clause 9.2 / Internal Reference: FOCUS.2"); non-finding rows get a neutral "Internal focus item (Stage 1 carryover)" label; Document Revision History merged into the TOC page; validator extended with B8 (missing standard), B9 (next-audit chronology), B10 (missing recommendation), B1n (internal ref presented as Clause in narrative), B6p (secondary verdict/"fundamental soundness" phrases), W7/W9. Verified by regenerating the complete print HTML through the real export pipeline with a KTD fixture: zero banned phrases, validator READY FOR AUDITOR REVIEW with zero blockers, defective variant blocked on every new rule. Suite: 446 passed / 0 failed.

Date: 2026-08-15. Scope: evidence-bound reporting, certification-cycle correctness, clause integrity, AI guardrails, report restructure, and the Report Integrity Validator. Implemented via 5 parallel inspection agents + 4 parallel implementation agents with disjoint file ownership.

## 1. Existing-system assessment

Local-first vanilla-JS app; Supabase is the system of record, `window.state` + IndexedDB the mirror. Report engine = `execution-reporting.js` (sectionDefs + module `sections()` contract) with plug-in modules `report-scoring/risk/executive/operational/findings-ops/frameworks.js`; `report-stats.js` is the canonical figures source; finalize gate lives in `ai-service.js` (`finalizeAndPublish`); all AI routes through the `api/gemini.js` proxy. ~45 possible report sections; print = native print-to-PDF from a Blob popup.

Per-requirement classification (inspection phase):

| Req | Area | Classification found |
|---|---|---|
| 2 | Financial/business claims | EXISTS-BY-DESIGN defect: prompt few-shot literally taught "avoids a follow-up audit cost"; field specs demanded revenue/customer-trust language; deterministic fallbacks hardcoded the same |
| 3 | Recommendation wording | NEEDS IMPROVEMENT — pure `majorNC` ternary, identical for all audit types |
| 4 | Audit programme | CONFLICTS — preview path fixed previously, export path still fabricated Stage 1/2 from the current audit date |
| 5 | FOCUS.x criteria | MISSING — pseudo-clauses flowed unvalidated into formal NC tables and clause analytics |
| 6 | Strength vs NC | Deterministic path correct; AI path unchecked |
| 7 | "Recurring" | Correct in scoring/risk (real history); false in exec-insights (same-audit clusters) |
| 8 | "General" dept | CONFLICTS — 4 divergent normalizer copies + raw `\|\| 'General'` fallbacks in the engine |
| 9 | Scores as results | NEEDS IMPROVEMENT — grade/score beside recommendation, zero disclaimers |
| 10 | Risk logic | Ratings 100% derived from severity + keyword themes; no auditor override existed |
| 11 | RCA | Rule-templated "working hypothesis" (honestly labeled) but no auditee-ownership framing/gate |
| 13 | CAPA status | Mostly guarded (0% suppressed in 2 of 3 places); "Awaiting Auditee Response" MISSING |
| 14 | Maturity | Two engines: rigorous gated one (scoring) vs NC-count star rating (engine) — CONFLICTS |
| 16/17 | Duplication | 4 duplicated executive surfaces, 2 distribution sections, 4 CAPA renderings |
| 18 | Address | `client.address` read in 4 places, written nowhere; real data in `client.sites[0].address` |
| 19/20/21 | Validator/traceability/AI states | MISSING (finalize blockers framework existed and was reused) |

## 2. Issues confirmed in code (highlights)

- `report-executive.js:182,217-218` — prompt taught financial-claim fabrication; `:168` Big-Four persona; `:276` "operational resilience" fallback.
- `execution-reporting.js:2894-2922` — export programme fabricated Stage 1/2 dates at the current audit month for surveillance audits.
- `execution-reporting.js:433` — "Recommended for Certification" for every audit type.
- `client-docs-bulk.js:538` → `execution-module-v2.js:646` → NC tables: FOCUS.x stored verbatim as the NC clause; `tests/ncr-capa-reconcile.test.js` used `FOCUS.2/FOCUS.8` as normal.
- `report-executive.js:808-812` — "Recurring Weaknesses" from same-audit clause counts.
- `report-operational.js:59` — `UNASSIGNED_LABEL = 'General'` contradicting three other modules.
- `execution-reporting.js:562-570` — maturity stars from raw NC counts.
- Latent bug (found during implementation): checklist→NCR register sync threw a silently-caught TDZ `ReferenceError` whenever the register was non-empty — sync was effectively broken. Fixed.

## 3. Issues already handled (preserved, not duplicated)

- `report-scoring.js` maturity engine: sample-gated, shrinkage, "Not reported — insufficient data" fallback. Kept as the only maturity source.
- Genuine recurrence detection in `report-scoring.js:375-397` and `report-risk.js:494-523` (real prior-report comparison). Kept.
- CAPA 0%-suppression in `report-scoring.js` / `report-risk.js` inferred mode. Kept.
- Root-cause provenance labels ("Working hypothesis… auditor review required") and auditor-entered-value preference. Kept and extended.
- `finalizeAndPublish` blockers/warnings framework — reused as the validator mount point.
- Preview-path programme fix (certificate anchoring) — generalized into the shared `buildProgramme`.

## 4. Architecture changes

- **Single programme computation**: `ReportStats.buildProgramme({client, auditPlan, report, allReports})` → `{stages, anchored, issues}` consumed by preview, export, and validator. Anchors on certificate → history → explicit "unavailable" (never fabricates prior-stage dates). Generic "Surveillance" audits are slotted into the surveillance visit nearest their date in the cycle.
- **Deterministic recommendation**: `ReportStats.recommendationText(auditType, {majorNC, minorNC})`; AI is instructed to reproduce it verbatim, never rephrase.
- **Formal report vs annexes**: `SECTION_GROUPS` maps every section to `formal | analytics | evidence | capa`. Formal = 19 ISO-17021 sections incl. one consolidated Executive Summary. Annexes get divider pages with the disclaimer "Audit360 analytical indicators… does not form part of the certification decision", A.n/B.n/C.n numbering, per-report persisted config (`report.reportConfig.annexes`, defaults: analytics off, evidence on, capa off). Duplicate `opsDistribution` section removed.
- **Report Integrity Validator**: new `report-integrity.js`, pure functions, wired as a hard gate in `finalizeAndPublish` and as an auto-running panel in the Finalization tab.
- **AI guardrail layer**: `system_instruction` on every proxied Gemini call (api/gemini.js) + per-prompt rewrites + post-parse strength/NC filtering.
- **AI content states**: `_aiGenerated`/`_auditorConfirmed` on findings, `report.aiContent.{key}.status` draft→approved, `window.confirmAiContent()`, overwrite confirmation with previous-value preservation.

## 5. Database/schema changes

- No breaking changes. New NCR fields `criterionRef`, `criterionSource`, `riskLikelihood`, `riskImpact` live in local state (IndexedDB snapshot) and survive refetch via merge-forward; **cross-device persistence requires running `migrations/ADD_NCR_CRITERION_AND_RISK_FIELDS.sql`** and then enabling the persist/fetch column mappings in `ncr-capa-module.js`.
- Noted for cleanup: `audit_findings` is a dead table (never read/written by the app; `audit_ncrs` is the real store).

## 6. Report-engine changes (execution-reporting.js, report-stats.js)

Recommendation wording by audit type everywhere (badge, conclusion boilerplate, AI-polish prompt); programme export path rebuilt on `buildProgramme` with honest anchor captions; formal/annex grouped rendering + grouped TOC + persisted toggles (annex checkboxes in preview); engine-side executive facts table (type, standard, scope, sites, dates, team, counts, previous-NC status, recommendation) prepended to the exec summary; maturity stars removed (conformity % "(analytical indicator)" instead); `displayCriterion()` renders real criteria for FOCUS-carryover findings and flags unresolved ones ("Criterion not assigned — internal ref FOCUS.x"); clause analytics bucket pseudo-clauses under "Internal focus items"; dept fallbacks use the shared normalizer; preview/export address paths unified on `client.sites[0].address` fallback; EV-IDs reuse capture-time `EvidenceUtils.getEvidenceIndex()`; TOC/body heading mismatch and dead "Meetings" toggle fixed.

## 7. AI guardrails

Proxy-level system instruction (all ~10 AI features): no financial figures unless verbatim in input; no certification decisions (reproduce provided wording); no recurring/systemic claims without prior-audit records in input; no invented root causes/risk ratings/maturity; drafts labeled as requiring auditor confirmation. Prompt-level: Big-Four persona and financial few-shots removed; insights prompt now receives real prior-audit comparison data or forbids recurrence claims; exec-summary strengths post-filtered against the NC list. Content states per §4.

## 8. Integrity Validator rules

BLOCKERS: B1 FOCUS/SURV/ORG/DOC as final NC criterion without real clause · B2 impossible programme chronology (via buildProgramme issues) · B3 NC without objective evidence · B4 NC without criterion · B5 recommendation incompatible with audit type · B6 unsupported financial claim in narrative (unless auditor-confirmed) · B7 recurring/persistent language with no prior finalized audit.
WARNINGS: W1 clause both strength & NC · W2 risk ratings without formal assessment · W3 department "General" · W4 rule-generated RCA unreviewed · W5 address inconsistency (DataService.checkAddressConsistency; master site record authoritative; "Dr/Drive" normalized) · W6 unreviewed AI content · W7 technical review not approved · W8 manual/derived recommendation mismatch.
INFORMATION: I1 analytics annex enabled · I2 scores displayed · I3 maturity analytics · I4 disabled sections count.
Output: `{blockers, warnings, information, status: 'READY FOR AUDITOR REVIEW' | 'BLOCKED'}`; each item has id/severity/section/message/source/suggestion. Finalization is impossible with blockers.

## 9. UI/UX changes

Report Integrity card in the Finalization tab (auto-runs; counts + status + itemized list; Finalize button flagged when blocked); annex checkboxes in report preparation; pseudo-clause inline warning + "Actual criterion" field on manual NCRs; optional Likelihood/Impact (1–5) selects labeled "leave blank if not performed"; root cause relabeled "auditee-provided"; effectiveness tiles show "Not yet available — no closed CAPAs" instead of 0%. No new mandatory steps in the auditor workflow — validation is automatic.

## 10. Files modified

14 modified: ai-service.js, api/gemini.js, client-docs-bulk.js, dashboard-module.js, data-service.js, execution-module-v2.js, execution-reporting.js, index.html, ncr-capa-module.js, report-executive.js, report-operational.js, report-risk.js, report-scoring.js, report-stats.js.
4 created: report-integrity.js, migrations/ADD_NCR_CRITERION_AND_RISK_FIELDS.sql, tests/report-integrity.test.js, tests/capa-display-status.test.js, tests/ktd-acceptance.test.js (5 counting tests).
~1,700 insertions / ~370 deletions.

## 11. Tests performed

- Vitest full suite: **443 passed, 0 failed** (22 files; 7 pre-existing skips), including 5 new validator tests, the capaDisplayStatus vocabulary suite, and 11 KTD acceptance tests.
- `node --check` + ESLint clean (0 errors; only pre-existing warnings) on every touched file.
- Live browser boot on http-server: zero console errors; all new contracts verified live (`ReportIntegrity.check` blocks a defective surveillance report in-browser; recommendation/CAPA/dept normalization correct in the real load order).

## 12. Before/after — KTD surveillance scenario (tests/ktd-acceptance.test.js)

The real KTD Select data lives only in the tenant's Supabase/IndexedDB (no fixtures in repo — `NO-DEMO-DATA` policy), so the acceptance suite reconstructs the reported defects synthetically and asserts every code-assertable point of requirement 25:

| Check | Before | After |
|---|---|---|
| Surveillance recommendation | "Recommended for Certification" | "Continued certification is recommended subject to satisfactory closure of applicable nonconformities." |
| Programme (cert issued Aug 2024, audit Aug 2026) | Stage 1 & 2 "Completed Aug 2026" | S1/S2 Aug 2024, SV1 Aug 2025 Completed, SV2 Aug 2026 = This audit, Recert by Aug 2027; no anchor → "—" + blocker, never fabricated |
| $5M / contractual-penalty claims | Prompt-taught, fallback-hardcoded | Removed at source; B6 blocks any that appear in narratives |
| "Recurring weakness", first audit | Generated from same-audit clusters | Only with real prior-report evidence; B7 blocks otherwise |
| FOCUS.2/FOCUS.8 as criterion | Printed as the NC clause | Real criterion displayed (criterionRef); unresolved → visible flag + B1 blocker |
| Strength vs NC contradiction | Unchecked AI output | Post-parse filter + W1 |
| "General departments" | 4-way inconsistency | 'Unassigned / Cross-functional' everywhere; W3 |
| Risk ratings | Derived from NC class, presented plainly | 'Assessed by auditor' vs 'Derived (indicator)' basis; "no formal risk assessment performed" banner; annexed |
| RCA | Rule hypothesis in report | Auditee-owned; "Awaiting auditee root cause analysis"; draft suggestion labeled |
| CAPA fresh post-audit | 0% / Requires Attention risk | "Awaiting Auditee Response"; Overdue only after due date |
| Maturity | NC-count stars | Removed; only the gated scoring-module assessment remains, annexed with disclaimer |
| Address | Typed copies could drift silently | Master site record authoritative; drift → W5 + content-hash covers it post-issue |
| Report length | ~45 sections in one flat doc | 19-section formal report; 20 analytics sections opt-in annex; duplicate distribution removed |
| Validator | None | 0 blockers on the corrected dataset → READY FOR AUDITOR REVIEW |

## 13. Remaining risks / recommendations

1. **Run the migration** (`ADD_NCR_CRITERION_AND_RISK_FIELDS.sql`) and then enable the Supabase column mappings for criterionRef/criterionSource/riskLikelihood/riskImpact in ncr-capa-module.js — until then those four fields are per-device local state.
2. **Regenerate the real KTD report in the authenticated app** (preview → toggle annexes → Run Report Integrity Check) — the acceptance suite mirrors the scenario, but only the live tenant data proves the specific report. Expect W5 to fire on the Warwick/Warminster drift until the plan location is corrected.
3. `audit_plans` has no explicit "Surveillance 1 vs 2" type option — the engine now infers the slot from the certificate date; adding SV1/SV2 options in planning would remove the inference.
4. Statement-level traceability is partial: AI states, provenance captions, evidence index, and validator sources exist; a click-through "Why is this in the report?" per-statement panel (req. 20's full vision) remains future work.
5. `npm run lint` uses `--max-warnings 0` and fails on pre-existing warnings unrelated to this change.
6. Big-Four exec-summary/insights AI content is still not persistently editable (regenerated per session) — durable per-section auditor editing would strengthen the approval workflow.
7. Dead `audit_findings` table and the stray untracked `nul` file in the repo root should be cleaned up.

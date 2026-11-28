# Audit360 Checklist Engine — Phase 1: Investigation and Technical Validation

**Status:** Phase 1 complete. **STOPPED at the approval gate (F).** No production code, schema, checklist record or deployed service was changed.
**Code base examined:** `origin/main` at `c884059` (worktree `.claude/worktrees/checklist-engine-phase1`, branch `docs/checklist-engine-phase1`), plus the unmerged branch `origin/feat/checklist-client-export` (`cc912ca`, pushed 2026-11-28 by another session, no PR yet).
**Date:** 2026-11-28.

## How this was established

- The whole pipeline was traced through source code. Every defect below cites `file:line` on `origin/main`.
- The regression case was **executed through the real modules**. `tools/pcc-scenario.mjs` builds the PC Connection recertification checklist from `tests/fixtures/pcc-connection.mjs` (a reconstruction: 43 documents, not the live 162). Scratch probes in the session scratchpad varied man-days, SoA input, document metadata, prior plans and budgets.
  - The reconstruction produced **78 items**. A sibling build with the live-like item mix produced **82 items**.
  - Both reproduce the reported figures exactly: **25/25, 29/29, 44/44** with every item "Not checked", and Annex A **37/45** (live 43/45). They also return QA `ok: true` and coverage "Passed with notes — coverage validated".
- **Live data was not read.** The PC Connection report (live id 1794902180881) awaits technical review and was not touched.
  - Items that depend on live records are marked **"requires live verification"**: the 162/58 document split, where "AWS MSP Tier Plan" was suggested, and the exact live Annex A sample.
  - The fixture's certificate dates (`initialDate 2022-12-16`) are out of date. Project memory records the live Initial Date as **16/12/2023**, which matches the brief's cycle of 16 Dec 2023 – 15 Dec 2026.
- Four read-only subagents covered:
  1. knowledge base, registry and AI;
  2. question generation, completeness and Annex A;
  3. documents and SoA;
  4. coverage, QA, cycle and exports.

  Their key claims were spot-checked against the code before inclusion.

### Verdict on the brief's regression observations

| # | Brief observation | Finding |
|---|---|---|
| 1 | ISO/IEC 20000-1:2018 clause 6.3 "doesn't exist" and QA passed it | **Partly wrong, underlying defect confirmed.** 20000-1:2018 **does** have 6.3, titled "Plan the service management system". The defect is that the registry keys it to the shared concept *planning of changes* (`checklist-standards.js:341`). It is consolidated under a "Planning of changes" stem with 27001 6.3 and 22301 6.3, which is not an equivalent requirement, so the SMS plan is never asked. QA passes it because `isKnownRef` checks existence only, and the contradiction check is switched off whenever refs are declared (CE-01, CE-02). |
| 2 | Complaints mapped to 20000-1 8.6.3 | **Confirmed.** `RECERT_PRIORITIES.incidents.refsBy.iso20000 = ['8.6.1','8.6.3']` (`checklist-standards.js:645`). Complaints belong to 8.3.2 Business relationship management (CE-03). |
| 3 | 2024 climate-action amendments to 4.1 / 4.2 missing | **Confirmed.** There is no edition or amendment model anywhere, and `grep -i climate` returns 0 hits in JS (CE-04). |
| 4 | Generic placeholders for 20000-1 7.6, 8.2.1, 8.2.2, 8.4.2, 8.5.2 | **Confirmed, exactly these five.** They are the registry clauses that no theme walks (`planScope().residual`). They get the template at `client-docs-bulk.js:1981` and earn full coverage credit. QA reports them only as `SIMILAR_WORDING` info (CE-14). |
| 5 | Near-identical process walkthroughs | **Partly confirmed.** Lexical overlap is low (Jaccard 0.27–0.30), so QA's 0.82 test never fires. The real problems are different:<ul><li>walks are generated from the process **name** only, and the data model holds nothing more;</li><li>focus patterns mismatch ("Assessment And Design Tools" becomes a job-shop walk, "Continual Improvement" becomes "requirements confirmed before work starts");</li><li>walks duplicate theme questions semantically (Service Desk vs incident/request);</li><li>past 5 processes the angle repeats (CE-20, CE-21, CE-23).</li></ul> |
| 6 | Document matching: 162 docs, 58 unmapped, "AWS MSP Tier Plan" for previous findings | **Mechanisms confirmed; live origin requires verification.** The build-time previous-findings question gets **no** document hint. The confirmed path that names that document beside corrective action is the per-standard clause union (`linkedClauses` merges 22301/20000-1 "10.1 = NC" with 27001 "10.2 = NC"), read by the Stage 1 "Corrective Action Process" matcher. That matcher also accepts the word "improvement" and two-way prefix matches (CE-26, CE-27). Unmapped documents come from file types that are never text-extracted, vendor or project titles and heading thresholds (CE-31, CE-34). |
| 7 | SoA ingestion extracts no Annex A refs; A.5.35 and A.8.3 not covered | **Confirmed, several causes:**<ul><li>xlsx is never read;</li><li>docx tables (one cell per line) and PDF rows over 80 characters fail the heading regex;</li><li>ranges are not expanded;</li><li>exclusions are read as applicable;</li><li>nothing is reconciled against the 93 controls (CE-28).</li></ul>A.5.35 and A.8.3 drop out because the sample is a round-robin over **alphabetically sorted themes**, in registry order. Both are third in their theme bucket. A.8.3 needs a cap of at least 20; A.5.35 survives only when a risk document names it (CE-15). |
| 8 | Thematic grouping credits A.6.3 / A.6.7 under a joiner/mover/leaver question | **Confirmed.** Both carry theme `hr-access`. The grouped item uses `CONTROL_THEME_PROMPT['hr-access']`: "a recent joiner, a mover and a leaver … accounts and entitlements". That cannot verify awareness training or remote working. One status covers the whole group (CE-17, CE-19). |
| 9 | ISO 22301 8.4.4 / 8.4.5 completeness | **Confirmed.** The registry has 8.4, 8.4.2 and 8.4.3 only. 8.2.1, 8.3.1–8.3.5 and 8.4.1 are also absent. "29/29" is a complete count of an incomplete inventory (CE-05). |
| 10 | Certification cycle (16 Dec 2023 – 15 Dec 2026, one previous audit on file) | **Confirmed defects:**<ul><li>coverage counts the **current plan as a prior audit**;</li><li>it credits prior checklists from any plan regardless of status or execution;</li><li>it anchors on `certs[0]`, preferring Initial Date with a 48-month slack (the fixture gives a 4-year window);</li><li>the report programme marks unrecorded stages "Completed (certificate)" (CE-38 to CE-41).</li></ul>The last point conflicts with the brief's "missing record ≠ audit did not happen", but follows a recorded user rule. **Decision needed.** |
| 11 | 25/25, 29/29, 44/44, 43/45 while every question is "Not checked" | **Confirmed and reproduced.** Coverage counts the refs **planned** on the checklist and never reads execution status:<ul><li>a 20000-1 "8.2.2" item also credits 22301 8.2.2 (BIA) and, by parent prefix, 27001 8.2;</li><li>43/45 is the Annex A row against an **assumed** tier-1 pool of 45, not any 20000-1 figure;</li><li>the screen labels the figure "This audit" with a green bar; the PDF says "validated" (CE-35, CE-36, CE-37).</li></ul> |
| 12 | Auditor vs client export separation | **Confirmed absent on main.** One print carries QA/coverage diagnostics and SoA upload instructions, and hard-codes "Not Checked". The unmerged branch adds a client copy but still leaks unconfirmed citations, Stage 1 AI text, auditor-review items and the confidential Annex A sample, and prints no scope (CE-46, CE-47). |

---

## A. Existing architecture map

### A.1 Pipeline overview

```
 Knowledge Base (settings.knowledge_base JSONB)          Standards registry (code)
 settings-kb.js: upload → extractTextFromFile →          checklist-standards.js  window.ChecklistStandards
 extractStandardClauses (Gemini, 2–5 batches)            6 standards: 27001:2022 (+93 Annex A), 22301:2019,
 → doc.clauses[] status 'ready'                          20000-1:2018, 9001, 14001, 45001
 getBuiltInClauses() fallback                            SHARED concept keys, SHARED_PROMPT, themes,
        │                                                CONTROL_THEME_PROMPT, RECERT_PRIORITIES
        │ (only for standards NOT in registry)                    │
        ▼                                                         ▼
 Client record (clients row JSONB)                 client-docs-bulk.js  window.ClientDocsBulk
  certificates[], sites[], goodsServices[],        buildClientChecklist → resolveScope →
  keyProcesses[{name,category,owner}],             buildScopedChecklist (registry)   | buildLegacyChecklist (non-registry)
  documents[] (bulk import: parseDocumentName,     riskBasedBudget → planScope → RECERT/SURV → FOCUS (Stage 1 AI)
   parseContentMeta, mapClausesByStandard →        → ORG (scopedOrgQuestions, processWalkText) → IMS (consolidate)
   linkedClauses = union, clauseMap per std)       → per-standard themes + residual → Annex A (sampleAnnexAControls)
  compliance.changesLog                            → DOC sample → REVIEW → DOCNOTE → KB sections
        │                                          evidenceHint → supporting-docs.js SupportingDocs.hint
        │                                                         │
        ▼                                                         ▼
 Plans (audit_plans), findings (state.ncrs),       checklist-qa.js  ChecklistQA.validate   (internal defensibility)
 complaints/appeals, reports (audit_reports)  ───► checklist-coverage.js ChecklistCoverage.buildContext/assess/
                                                     riskDrivenControls/combine/readiness  (cycle completeness + gate)
                                                   report-stats.js ReportStats.buildProgramme (cycle stages)
                                                                  │
                                                                  ▼
                                                   checklists table (JSONB clauses, ready_for_audit, resolved_issues,
                                                   qa_context) — checklist-module.js (library, editor, detail, gate,
                                                   SoA supply, printChecklist) — audit-plan-integrity.js (agenda ↔
                                                   checklist traceability) — execution-module-v2.js (per-item status)
                                                                  │
                                                                  ▼
                                                   checklist-document.js ChecklistDocument.build (PDF via print-shell.js)
                                                   completed-checklist.js (completed print)
                                                   [branch] ChecklistDocument.buildClient (client preparation copy)
```

### A.2 Components

| Stage | File · function | What it does | Storage / schema |
|---|---|---|---|
| **KB storage** | `settings-kb.js:11-16`, `:521-532` | `state.knowledgeBase = {standards, sops, policies, marketing}`. A standard is `{id,name,fileName,status,extractedText,cloudUrl,clauses:[]}`. It has **no edition, amendment, version or approval fields**. | One JSONB column `settings.knowledge_base` (`migrations/ADD_KB_TO_SETTINGS.sql`), singleton settings row (`supabase-client.js:2330-2350`). Snapshot strips `extractedText` (`_buildKnowledgeBaseSnapshot`, `:75-99`). Last writer wins. |
| **KB extraction (AI)** | `settings-kb.js:1045` `extractStandardClauses`; prompt `:1234-1283` | 2–5 batched Gemini calls asking for "FULL requirement text verbatim". With no source text it says "Use your comprehensive expert knowledge". The 27001 Annex A batches always use `useSource:false`. Output: `[{clause,title,requirement,subRequirements,checklistQuestions}]`. | `doc.clauses`, `generatedChecklist`, `status='ready'` set automatically (`:1389-1392`). |
| **KB validation** | `settings-kb.js:1308-1312`, `:94`; `validation.js:108-113` | Format regex `_isValidClauseRef` and drops clauses below 4. **No existence, title or edition check.** | — |
| **Built-in fallback** | `settings-kb.js:1430-1741` `getBuiltInClauses` | 9001 hand-written. 14001 and 45001 are the 9001 list with regex word swaps (`:1659-1711`), evaluated **before** the registry branch (`:1718`). | — |
| **Standards registry** | `checklist-standards.js` | Clause tuples `[ref,title,shared,mandatory]` (`:141-485`), 93 Annex A controls with theme and tier (`:173-271`), themes `[id,label,refs,prompt]` (`:493-605`), `RECERT_PRIORITIES` (`:619-662`). API: `resolve`, `clausesFor`, `controlsFor`, `consolidate` (keys on `shared`), `planScope` (themeCovered, residual), `isKnownRef` (existence), `citation`. | Code only. No edition or amendment data. |
| **Scope resolution** | `client-docs-bulk.js:1224` `resolveScope`; `checklist-coverage.js` `resolveStandardIds` | Splits the client/plan standard text into registry ids, plus `unresolved` for anything else. | — |
| **Budget** | `client-docs-bulk.js:1247-1288` `riskBasedBudget` | Annex A sample: surveillance 8, recertification 18, initial 26, × size × man-day factor. `coverAllClauses` is on for initial and recert. | — |
| **Generation** | `client-docs-bulk.js:1795-2158` `buildScopedChecklist` | Sections RECERT/SURV, FOCUS, ORG, IMS, per-standard themes + residual, Annex A, DOC, REVIEW, DOCNOTE, KB. Items via `scopedQuestion` (`:1316-1342`): `{clause,title,requirement,refs[{stdId,ref}],citation,criterionRef=refs[0],criterionSource,auditorReview,documentNote,items:[1]}`. | Checklist object `generator:'scope-driven-v2'` with `qaContext{standardIds,auditType,ceiling,soaApplicable}`, `sourceDocumentSnapshot`, `qa`, `coverage` (`:2093-2157`). |
| **Consolidation** | `checklist-standards.js:877-898` `consolidate` | Groups clauses sharing a `shared` key across 2+ standards into one question with `SHARED_PROMPT` and `{systems}` substitution. | — |
| **Process questions** | `client-docs-bulk.js:1380-1593` | `PROCESS_THEME_MATCH` routes names to themes, otherwise `processWalkText` takes a regex focus (`PROCESS_WALK_FOCUS`) or one of 5 angles. Inputs are `keyProcesses{name,category,owner}`. | Client JSONB. Import `clients-import.js:1045-1049`; edit `clients-org-setup.js:1556-1600`. |
| **Annex A selection** | `client-docs-bulk.js:1610-1627` `sampleAnnexAControls`; risk drivers `checklist-coverage.js` `riskDrivenControls` | Pool: pasted SoA, else tier 1 (45). Removes theme-covered controls, puts risk-driven `required` first, then round-robins by sorted theme. Grouped per theme with `CONTROL_THEME_PROMPT` (`:2016-2026`). | `qaContext.soaApplicable` (pasted refs only). |
| **SoA supply** | `client-docs-bulk.js:4775-4777` (build modal paste); `checklist-module.js:2418-2585` (`refsFromSoAText`, `applyChecklistSoA`, pick/paste); `checklist-coverage.js:482-503` (auto-read of the SoA document's stored metadata) | Regex `/A\.\d{1,2}\.\d{1,2}/g` (`checklist-coverage.js:117`). Only a list of refs: no applicability column, justification, status, version or approval date. | `checklist.qaContext.soaApplicable`, `soaSupplied{source,document,…}`. |
| **Document import** | `client-docs-bulk.js:269-1000`, `3838-3880`, `4052-4160` | Name parse (category, revision, doc number, date). Text extracted for docx/pdf/txt/md/csv only, first 20,000 characters, **body discarded** (30 headings and 700-character notes kept). `mapClausesByStandard` gives `clauseMap{stdId:[…]}` and `linkedClauses` = union. | `client.documents[]` and `documents` table/bucket. |
| **Document relevance** | `supporting-docs.js` `SupportingDocs.hint` (`:411-480`) | Gates on status, template, topic and stated standard, then scores (`5 + … + 2·jaccard`, `:447-455`). The hint text hides the basis and score. | — |
| **Gap analysis** | `client-docs-bulk.js:2704-3025`, `3382-3518` | Presence-based "% covered" by `docCoversRef` (unstated standard = all; parent covers child). | — |
| **Stage 1 (AI)** | `client-docs-bulk.js:4271-4430`, `4518-4527`; `mapDocumentsToStage1` `:3533-3561` | Gemini review limited to "documents listed". Output `{items,summary,focusPoints}`. "Apply" overwrites statuses and becomes FOCUS items (`auditorReview:true`). | `plan.preAudit`. |
| **QA** | `checklist-qa.js:220-448` | OUT_OF_SCOPE_STANDARD, INVALID_REF (existence), DUPLICATE/NEAR_DUPLICATE/SIMILAR_WORDING (exact and Jaccard ≥ 0.82), REPETITIVE_BOILERPLATE, CONTRADICTORY_MAPPING (only when no refs declared), IRRELEVANT_REQUIREMENT, EXCESSIVE_COUNT, MISSING_REQUIREMENT, MISSING_ANNEX_A, AUDITOR_REVIEW, DOCUMENT_INTELLIGENCE_NOTE. Result `{ok, blocking, counts, issues}`. | `checklist.qa`. |
| **Coverage** | `checklist-coverage.js:209-230` (`coverageOf`, `covers`), `348-580` (`buildContext`), `600-1000` (`assess`), `1010-1030` (`combine`), `1033-1110` (`BLOCKING_CODES`, `readiness`) | Per-standard clause and control coverage from item refs **and** display clause; cycle credit from prior plans' `selectedChecklists`; Ready gate. | `checklist.coverage`, `readyForAudit`, `resolvedIssues` (`checklists.ready_for_audit`, `resolved_issues` — `ADD_CHECKLIST_GATE_COLUMNS.sql`). |
| **Cycle programme** | `report-stats.js:587-900` `buildProgramme` | Stages s1/s2/sv1/sv2/recert. A prior stage with no record and a certificate anchor is shown as `Completed / certificate` (`:872-884`). | — |
| **Plan traceability** | `audit-plan-integrity.js:564-950` (`buildAgenda`, `flattenChecklist`, `buildTraceability`) | Agenda sessions ↔ checklist questions ↔ findings. | `plan.traceability` (`plan-traceability-v1`). |
| **Execution** | `execution-module-v2.js` (per-item `status`, `:905-912`) | One status, NCR type and suggested ref per checklist item. | `audit_reports` progress. |
| **Export** | `checklist-module.js:2681-2744` `printChecklist`; `checklist-document.js:317-391` `build`; `completed-checklist.js` | One audience. Validation banner, coverage panel (with SoA upload instructions), items (DOCNOTE excluded), status hard-coded "Not Checked" (`:73`, `:346`, `:359`). QR via api.qrserver.com (`checklist-module.js:2728`). | — |
| **Client export (unmerged)** | `origin/feat/checklist-client-export` `checklist-document.js` `buildClient`, `clientItems`, `clientSentence` | Regex rewording of auditor verbs. Drops DOCNOTE/REVIEW, QA and coverage. | — |
| **Tenancy** | `checklists`, `settings`, `documents`, `audit_plans` | **No tenant/organisation column.** RLS SELECT/INSERT/UPDATE `TO authenticated USING (true)` (`ENSURE_CHECKLISTS_SYNC_AND_POLICIES.sql:58-63`, `FIX_SECURITY_ADVISOR.sql:69-77`). DELETE admin/cert-manager (`HARDEN_RLS_PHASE2.sql:103-115`). The app is a single-CB deployment. | — |

### A.3 AI calls that can shape checklist content

| Call | Prompt essence | Deterministic validation | How it is written |
|---|---|---|---|
| KB clause extraction (`settings-kb.js:1283`) | "verbatim"; "expert knowledge" when there is no text; Annex A from memory | Format only | **Automatic**, `status='ready'` |
| KB SOP/policy sections (`settings-kb.js:2049-2060`) | "Return ONLY JSON" | None | Automatic |
| Stage 1 review (`client-docs-bulk.js:4297`) | "only the documents listed"; ≤ 8 focus points | Item ids and status whitelist | Proposed, but Apply overwrites auditor statuses (`:4518-4521`) |
| Account-setup suggest (`client-ai-suggest.js:336`, `:632`) | "Ground every suggestion… Never invent" | Dedupe and caps | Proposed, but rows are **pre-ticked** (`:346`, `:653`) |
| Clause suggesters (`ai-service.js:1798`, `:1972`) | "do NOT guess or force a match" | Against the **KB**, not the registry (`:2058-2068`) | Opt-in |

The generator itself (`buildScopedChecklist`) makes **no** AI call. That is a sound base to keep.

---

## B. Confirmed defect register

Severity:
- **Critical:** gives false assurance to a certification decision.
- **High:** wrong or unsupported audit content, or a validation hole.
- **Medium:** quality or traceability weakness with a workaround.
- **Low:** cosmetic or local.

"Origin" uses the categories of section C.

### B.1 Coverage and QA (false assurance)

| ID | Sev | Description | file:line | Root cause | Affected | Evidence | Recommended correction |
|---|---|---|---|---|---|---|---|
| CE-35 | Critical | Coverage counts **planned** refs; execution status is never read. An all-"Not checked" checklist shows 100%, labelled "This audit" with a green bar, and the PDF says "Recertification coverage validation… Passed — coverage validated". | `checklist-coverage.js:209-223`, `:784-799` (`planned = thisAudit`); `checklist-module.js:2119`, `:2143`, `:2113`; `checklist-document.js:215-224`, `:241`, `:310-312` | No metric separation | Detail screen, PDF, Ready gate, report | Probe: 25/25, 29/29, 44/44, 37/45 with zero executed items | Split into structural / planned-semantic / completed / evidence-verified / cycle / applicability-confidence metrics (section D.11). Rename "This audit" to "Planned". Never print "validated" for planned coverage. |
| CE-36 | Critical | A bare clause number is credited to **every** standard in scope, and a sub-ref credits its parent. A 20000-1 "8.2.2 Plan the services" item credits 22301 8.2.2 (BIA) and, by prefix, 27001 8.2. 20000-1 8.4.2 credits 22301 8.4.2, and 8.5.2 credits 22301 8.5. Removing 20000-1's own 8.2.2 item still leaves 43/44. | `checklist-coverage.js:219-220`, `:226-230`; same pattern `checklist-qa.js:381` | Legacy pseudo-ref fallback applied to scoped items that already carry explicit refs | All integrated coverage | Probes `collide.mjs`, `build.js` | When `it.refs` is present, use **only** `it.refs`. Parent credit only when every mandatory child is covered, never child-from-parent. |
| CE-42 | High | Critical `EXCESSIVE_COUNT`, `MISSING_REQUIREMENT` and `MISSING_ANNEX_A` do not block Ready. | `checklist-coverage.js:1033-1049`, `:1101-1102` | Not in `BLOCKING_CODES` | Ready gate | `readiness({}, {qa:{issues:[3 criticals]}})` → `ready:true` | Block on every critical unless explicitly dispositioned with a reason. Add resolution actions in `checklist-module.js`. |
| CE-43 | High | There is no "Requires auditor review" outcome. `summarize` says "QA passed" when only info notes exist, and `combine()` turns warnings into "Passed with notes — coverage validated". | `checklist-qa.js:442`, `:458-460`; `checklist-coverage.js:1021-1022` | Two-flag model (`ok`/`blocking`) | QA banner, PDF | Probe: QA `ok:true` on the regression build | Four-state outcome (Passed / Passed with warnings / Requires auditor review / Failed validation) with per-issue diagnostics (what, which requirement, how to resolve). |
| CE-02 | High | QA cannot detect a citation whose **meaning** differs from the question. `isKnownRef` is existence-only, and `CONTRADICTORY_MAPPING` runs only when an item declares no refs or standards. | `checklist-standards.js:838-843`; `checklist-qa.js:264-266`, `:343-344` | Validation by number, not concept | All integrated questions | An item "Planning of changes" citing `iso20000 6.3` gives `[]` issues; without refs it gives CONTRADICTORY_MAPPING | Items carry the concept they test (`shared`/requirement id). QA checks each ref's registry concept equals the item concept, and fails on mismatch. |
| CE-14 | High | Generic placeholder residual questions (20000-1 7.6, 8.2.1, 8.2.2, 8.4.2, 8.5.2) get full coverage credit. QA only gives `SIMILAR_WORDING` info ("Both are needed for coverage"). 8.4.2 is not flagged at all. | `client-docs-bulk.js:1978-1983` (template `:1981`); `checklist-qa.js:283`, `:298-302`; `checklist-coverage.js:215` | No requirement content for un-themed clauses; no placeholder recognition | 20000-1 coverage, client copy | Probe SMS section | Registry-authored requirement elements for every clause (D.4). Mark template items `placeholder:true`. QA "Requires auditor review" with no coverage credit until the auditor rewrites them. |
| CE-38 | High | Prior checklists earn cycle credit regardless of plan status (cancelled or future plans count) or execution. | `checklist-coverage.js:435-445`, `:702-706` | Date-only plan filter | Cycle coverage, recert gate | Probe: Cancelled plan + empty current checklist → cycle 25/29/44 | Credit only items **executed** in a finalized/approved report of a non-cancelled plan. A planned-only historical checklist becomes "unverified history", not credit. |
| CE-39 | Medium | The current plan is counted as a "prior audit", and audits are compared with checklists in aggregate ("2 of 2 prior audits have no checklist" when only 1 exists). | `checklist-coverage.js:435`, `:558`, `:768-770` | `plans` not filtered by `o.planId` | Coverage messages | Probe and simulation | Exclude the current plan. Compare per plan. |
| CE-40 | Medium | The coverage cycle window is a second cycle rule. It uses `certs[0]` (not the standard's certificate) and prefers Initial Date with a 48-month slack (the fixture gives 2022-12-16 → 2026-12-15, four years). It diverges from `ReportStats` / `AuditPlanningDomain.resolveCertificateCycle`. | `checklist-coverage.js:392-411` | Re-derived anchor | Integrated or multi-cert clients | Probe cycle start 2022-12-16 | Use the one cycle resolver per standard (`AuditPlanningDomain.resolveCertificateCycle`). |
| CE-44 | Medium | Process coverage passes on incidental words: a substring of the process name anywhere in the checklist text. | `checklist-coverage.js:902-912` | Text match | CYCLE_PROCESS_GAP | Probe: "Legal", "Change", "Risk Management" covered with no walks | Credit a process only from an item that declares `process:<id>`. |
| CE-37 | High | Denominators come from an incomplete registry (CE-05) and, without an SoA, from an assumed tier-1 pool of 45 described as "applicable" ("8 of 45 applicable Annex A controls"). 43/45 is this row. | `checklist-coverage.js:604-610`, `:784`, `:885-886` | Assumed applicability presented as confirmed | Annex A figures | Probe | Without a confirmed SoA, report "provisional pool (no SoA)" and an applicability-confidence metric, never "applicable". |

### B.2 Registry, KB and integrated mapping

| ID | Sev | Description | file:line | Root cause | Affected | Evidence | Recommended correction |
|---|---|---|---|---|---|---|---|
| CE-01 | High | 20000-1 6.3 "Plan the service management system" carries `SHARED.PLAN_CHANGES`, so it is consolidated into "Planning of changes" (IMS) **and** RECERT "Changes since the previous audit". The SMS plan content (services, limitations, obligations, authorities, resources, other parties, technology, effectiveness measures) is never asked, yet is credited twice. | `checklist-standards.js:341`, `:630-633` | Equivalence asserted by clause number | IMS 6.3, RECERT changes, coverage | Probe IMS and RECERT rows cite 20000-1 6.3 | Set `shared:null`. Add a standard-specific 6.3 question. Keep 27001/22301 6.3 consolidated. |
| CE-03 | Medium | Complaints are cited to 20000-1 8.6.3 Problem management (should be 8.3.2). | `checklist-standards.js:645` | `refsBy` error | RECERT incidents item, findings citing it | Probe | `iso20000: ['8.6.1','8.3.2']`. Cite 8.6.3 only for trend/problem analysis. |
| CE-04 | High | No edition or amendment model. The 2024 climate-action amendments (27001:2022/Amd 1:2024, 22301:2019/Amd 1:2024; 20000-1:2018/Amd 1:2024 believed published, to confirm against the CB's licensed copy) are not reflected:<ul><li>`context.issues` / `context.parties` prompts do not ask whether climate change is a relevant issue, or about interested parties' climate-related requirements (a 4.2 note);</li><li>labels carry no "+A1:2024";</li><li>KB standards have no edition field;</li><li>built-in 9001 4.1 lacks the sentence.</li></ul> | `checklist-standards.js:115-116`, `:683-770`; `settings-kb.js:521-532`, `:1433` | Schema gap | Every Annex SL standard | `grep -i climate` = 0 | Registry `edition` + `amendments[]` with clause-level additions (requirement vs note). Prompts compose from them. The applicability outcome lets "climate change determined not relevant, with justification" pass without imposing controls. |
| CE-05 | High | 22301 inventory incomplete: no 8.2.1, 8.3.1–8.3.5 (parent only), 8.4.1, **8.4.4 Business continuity plans**, **8.4.5 Recovery**. `bcms-plans` (`8.4, 8.4.2, 8.4.3`) is counted as 8.4, so 29/29 = 100% while two substantive subclauses are never asked. | `checklist-standards.js:315-322`, `:521` | Registry omission | 22301 coverage and questions | Probe | Add the rows (mandatory). The 8.4.4 and 8.4.5 themes/questions get their own requirement elements. |
| CE-06 | Medium | 20000-1 held at parent where the parent prompt misses substance: 7.5.4 (mandatory SMS documented information), 8.5.1.1–8.5.1.3 (change policy, CIs under change control, criteria routing to 8.5.2), 8.5.2.1–8.5.2.3, 8.7.3.1–8.7.3.3. Conflations: `sms-slm` applies SLA tests to the catalogue (8.2.4 content unasked); `sms-config` credits 8.2.5 asset management without testing it. | `checklist-standards.js:346`, `:353-369`, `:530-543` | Granularity and themes wider than prompts | 20000-1 depth | Prompt text | Add subclause rows where there is distinct substance. Split themes so each ref has a testing prompt (see CE-18). |
| CE-07 | Medium | Prompts impose non-requirements: RPO (22301 `bcms-bia` `:516`, `bcms-disruption` `:526`); "the CMDB" (`:543`); "at least one major incident" (`:533`) and "at least one emergency change" (`:539`) with no fallback for periods with none. | `checklist-standards.js:516`, `:526`, `:533`, `:539`, `:543` | Prompt wording | Question validity | Text | Reword: "prioritised timeframes / minimum capacity; RPO only where the organisation defines one"; "configuration information"; "where none occurred in the period, test the documented arrangement and readiness". |
| CE-08 | Medium | RECERT "Risk assessment and treatment currency" cites 6.1.1/6.1 (actions on risks). The tested requirements are 27001 6.1.2/6.1.3/8.2/8.3 and 22301 8.2.3. | `checklist-standards.js:638-641` | `PLAN_RISK_ACTIONS` reuse | Citation | Probe | Use `refsBy`. |
| CE-09 | Low | 22301 `orgRefs.outsourced = null` on the claim "no supplier-control clause". 22301 8.1 requires outsourced processes and the supply chain to be controlled. | `checklist-standards.js:713-716` | Wrong assumption | Outsourced process citations | Text | `outsourced: '8.1'`. |
| CE-45 | Medium | The certification cycle is imposed as the client's internal-audit period ("covered every requirement … every site … over the certification cycle"). | `checklist-standards.js:648`; `client-docs-bulk.js:304`; `report-integrity.js:2369` | Wording | RECERT/SURV prompts, W38 | Text | Assess the client's own programme against its planned intervals. The cycle is only the CB's review window. |
| CE-10 | High | Built-in 14001/45001 are 9001 with word swaps. Example: 14001 gets "8.3 Design and development" and "9.1.2 Customer satisfaction"; 45001 8.2 becomes "Requirements for products and services". These branches shadow the registry. KB comprehensive analysis then gap-fills 9001 clauses with a generic question; an AI failure saves this list as `ready`. | `settings-kb.js:1659-1711` vs `:1718`; `:1339-1364`; `:1417-1420` | Branch order and legacy fallback | 14001/45001 KB, legacy build, gap analysis (not the PCC scope) | Probe `builtin-vs-registry.js` | Registry first. Delete the word-swap fallback. |
| CE-11 | High | KB requirement text is AI output, from memory when there is no text and always for Annex A. It is auto-approved (`ready`) with format-only validation. | `settings-kb.js:1234`, `:1242-1243`, `:1264`, `:1308-1312`, `:1392` | No approval step | KB-sourced checklists, NC clause text (`lookupClauseText` `:1748-1761`) | Prompt text | Status `extracted → reviewed → approved` with reviewer and date. Validate refs against the registry or an approved inventory. |
| CE-12 | High | KB items are exempt from `INVALID_REF`. KB precedence checks only **missing** registry refs (extra or mis-titled clauses win whole). QA `flatten` reads only the sub level and the first item, so deeper refs are never validated. | `checklist-qa.js:157-160`, `:258`, `:116-117`; `client-docs-bulk.js:2810-2813`, `:2848`; `settings-kb.js:2195` | Exemptions | KB and non-registry checklists | Code | Validate KB items against their approved KB inventory. Flatten all items. |
| CE-13 | Medium | A surveillance or client-tailored KB analysis overwrites the shared standard inventory (`doc.clauses`). | `settings-kb.js:1271-1272`, `:1389` | Per-client output stored on the shared record | All clients of that standard | Code | Store per-client analysis separately from the standard inventory. |

### B.3 Question generation, Annex A and process intelligence

| ID | Sev | Description | file:line | Root cause | Affected | Evidence | Recommended correction |
|---|---|---|---|---|---|---|---|
| CE-15 | High | Annex A sample order is alphabetical theme round-robin in registry order, not risk. Without an SoA the pool is tier 1. A.5.35 is third in `governance` and A.8.3 is third in `hr-access`, so with no risk driver both drop at medium band / 9 man-days (cap 18). A.8.3 needs cap ≥ 20. A.5.30 needs ≥ 16. Previous-cycle coverage is not used by the generator, only by coverage afterwards. | `client-docs-bulk.js:1610-1627` (`:1619` `.sort()`) | Ordering heuristic | Annex A sample, cycle gaps | Probe `budgets.mjs` (manDays 2–12) | Rank by risk drivers → controls never sampled in the cycle (rotation) → tier → theme spread. Disclose the basis per control. |
| CE-16 | High | The build-time sample uses only a **pasted** SoA, while `required` comes from a context that also reads the SoA **document**. Required controls outside the pool are discarded, so the generator and coverage disagree (RISK_CONTROL_GAP blocks the checklist the generator just built). | `client-docs-bulk.js:2004-2008`, `:1611-1616` | Two applicability sources | Annex A, Ready gate | Probe: tier-2 required A.5.3 dropped | One applicability resolver feeding both. A required control is always kept (or explicitly justified). |
| CE-17 | High | Theme prompts are unsuitable for some controls:<ul><li>`hr-access` joiner/mover/leaver prompt on A.6.3 (awareness training) and A.6.7 (remote working);</li><li>`asset` "pick two assets" on A.5.10 (acceptable use);</li><li>`continuity` "Ask for the last successful test" on A.5.29, A.5.30 and A.8.14: selection bias, and it never tests infosec *during* disruption.</li></ul> | `checklist-standards.js:282-286`; `client-docs-bulk.js:2016-2026` | Prompt per theme, not per control | Annex A validity | Probe group texts | A per-control prompt override in the registry where the theme prompt does not test it. Sampling wording: "the tests in the period including any that failed and their follow-up". |
| CE-18 | High | Theme refs are wider than what the prompt tests, yet every ref is credited and excluded from the Annex A sample:<ul><li>`isms-access` credits A.5.17 and A.8.5 (authentication, MFA) without asking;</li><li>`isms-backup` credits A.8.14 (redundancy);</li><li>`isms-crypto` credits A.8.20 (network security);</li><li>`sms-config` credits 8.2.5.</li></ul> | `checklist-standards.js:498`, `:508`, `:510`, `:542`; `planScope` `:967-975` | `refs` = "touches", not "tests" | Coverage and Annex A | Prompt text | Theme rows carry `tests[]` (credited) separately from `related[]` (cited, not credited), or the prompt is extended to test each ref. |
| CE-19 | High | A grouped item has one status and `criterionRef = refs[0]`. There is no per-control evidence or outcome, although the prompt says "Record the evidence seen against each control reference separately". An NC on the asset group defaults to A.5.9. | `client-docs-bulk.js:1330`, `:1338`, `:2024`; `execution-module-v2.js:905-912` | Item model | Annex A execution, NC criterion, coverage | Item keys | Per-control sub-results (`controlResults[{ref,status,evidence,outcome}]`) inside the grouped item. Coverage credits per control result. |
| CE-20 | Medium | Process walks use name, category and owner only. The data model has no purpose, inputs, outputs, risks, controls or interfaces. Regex focuses mismatch ("Assessment And Design Tools" gets a job-shop design walk; "Continual Improvement" gets "requirements confirmed before work starts", and duplicates IMS 10.x in substance). | `client-docs-bulk.js:1411-1487`, `:1549-1590`; `clients-import.js:1045-1049`; `clients-org-setup.js:1556-1600` | Thin model | ORG section | Probe texts | Extend `keyProcesses` (JSONB, additive) with the client's own description fields. Generate from them. Fall back to the current text marked "generic — process description not on file". |
| CE-21 | Medium | After the 5 angles are used, `processWalkText` adds nothing to `taken`, so every further process repeats one angle (90% overlap). | `client-docs-bulk.js:1483-1485` | Fallback bug | Clients with > 5 unmatched processes | Probe "Estates" vs "Payroll" | Combine angle and process attributes. Never repeat. Test with 12 processes. |
| CE-23 | Medium | `themeCoveringProcess` takes the first theme in scope order. ITSM "Incident Management" is routed to the 27001 incident theme. There is no `service desk|ticket` pattern, so Service Desk is walked again on top of `sms-incident` and `sms-request`. | `client-docs-bulk.js:1380-1400`, `:1490-1497` | Matching order | ORG vs themes | "Core processes…" item text | Prefer the standard whose theme matches the process domain. Cross-reference rather than re-walk. |
| CE-22 | Low | The generator's "maint/facilit" focus contains "calibration", which trips the 9001 7.1.5 foreign-term check, so QA raises a critical OUT_OF_SCOPE_STANDARD on its own output. | `client-docs-bulk.js:1440`; `checklist-qa.js:46` | Template wording | Facilities processes | Repro | Reword ("maintenance or inspection schedule"). |
| CE-24 | Low | Editing a process drops an imported `owner` and the "Management" category (the select offers only Core/Support). | `clients-org-setup.js:1580-1586` | Object replaced | Process data | Code | Merge fields. Full category list. |

### B.4 Documents and SoA

| ID | Sev | Description | file:line | Root cause | Affected | Evidence | Recommended correction |
|---|---|---|---|---|---|---|---|
| CE-28 | High | SoA ingestion yields zero or wrong refs:<ul><li>xlsx/xls never text-extracted;</li><li>docx table cells (one per line) and PDF rows over 80 characters fail the heading regex;</li><li>only the first 20,000 characters are read;</li><li>refs are taken only from heading-shaped lines;</li><li>ranges are not expanded, though the paste dialog says "ranges … are fine";</li><li>"A.8.3 Excluded" is read as applicable;</li><li>no reconciliation against the 93 controls (2013 "A.12.1.2" becomes "A.12.1"; unknown refs silently dropped but still counted in the success message);</li><li>no applicability, justification, implementation status, version or approval date.</li></ul> | `client-docs-bulk.js:3840`, `:3846`, `:552`; `checklist-coverage.js:117`; `checklist-module.js:2418-2426`, `:2481`, `:2575` | Regex-over-metadata design | Annex A applicability | Probe: docx 0 refs; PDF lost A.5.1 | Structured SoA ingestion (D.7) with human confirmation. |
| CE-30 | Medium | The automatic coverage read of an SoA document has no confirmation step and is labelled "per SoA — <name>". A provisional read is presented as confirmed. | `checklist-coverage.js:482-503`; `checklist-module.js:1952-1953` | No provisional state | Annex A | Code | Status `provisional` until the auditor confirms. |
| CE-29 | Low | A coverage message says import "never" extracts Annex A refs, contradicting `mapClauses` keeping `A.` refs. | `checklist-coverage.js:853` vs `client-docs-bulk.js:742` | Stale text | Guidance | Probe | Correct the text once D.7 lands. |
| CE-26 | High | `linkedClauses` is the **union** of per-standard clause maps, so 22301/20000-1 "10.1 = NC" and 27001 "10.2 = NC" merge. Non-standard-aware readers use the union: the Stage 1 matcher, the AI Stage 1 prompt (`clauses ${d.linkedClauses}`), DOCNOTE "unmapped" and the Build Checklist count. | `client-docs-bulk.js:867`, `:4139`, `:3543-3545`, `:4288`, `:2054` | Lossy storage field | Doc suggestions, Stage 1 | Probe: "Continual Improvement" heading gives `10.1, 10.2` | Read `clauseMap` everywhere. Keep `linkedClauses` only as display. |
| CE-27 | Medium | The Stage 1 "Corrective Action Process" item matches `/…improvement/` and two-way prefix `clauseCovers` (a bare "10" matches). This is the confirmed deterministic path that lists e.g. "AWS MSP Tier Plan" beside corrective action. | `client-docs-bulk.js:3506`, `:3518-3523` | Loose matcher | Stage 1 / pre-audit pack | Probe | Exact per-standard refs. Drop "improvement". |
| CE-31 | High | Document classification is too coarse for evidence use:<ul><li>blank forms/templates and completed records share "Records / Forms Register", so the "Retained records" sample can name blank templates;</li><li>no audit-report or historical category;</li><li>the status gate is dead for bulk import (`status` never stored);</li><li>revision gives only +0.5;</li><li>approval status, document date and audit period are never used.</li></ul> | `client-docs-bulk.js:31-54` (`:49`), `:414`, `:1668-1671`, `:4134-4160`; `supporting-docs.js:273-279`, `:323-327`, `:452` | Thin metadata | Evidence hints, DOC sample | Code | Add type (policy, procedure, work instruction, blank template, completed record, audit report, operational, historical, reference), status, approval and period. Never treat a template or historical record as current evidence. |
| CE-32 | Medium | Contradictory "names no standard" rule: the review screen says "applies to all", the recommender rejects it, and gap analysis counts it for every standard. The gap "% covered" is red/amber/green presence-based coverage that reads as a compliance score, and a parent clause covers its children. | `client-docs-bulk.js:3949`, `:821-825`, `:2706-2708`, `:3356`, `:3463`; `supporting-docs.js:441` | Two rules | Gap analysis | Code | One rule ("standard not stated → unconfirmed"). Relabel "documents mapped (not conformity)". |
| CE-33 | Medium | The evidence hint hides its basis, score and the fact that matching is metadata-only. | `supporting-docs.js:477-478`; gating on `name`/`docNumber` `:299`, `:318` | `via`/`score` dropped | Every hint | Code | Show "matched by title/heading (content not read)" plus a confidence band. |
| CE-34 | Medium | Text extraction is limited to docx/pdf/txt/md/csv and the first 20k characters. The body is discarded after parsing, so later content-based relevance is impossible. | `client-docs-bulk.js:3838-3880` | Storage choice | Unmapped docs (probable part of the 58) | Code | Keep a bounded text index per document (or extract on demand from storage). Disclose what was read. |

### B.5 Exports, persistence and AI-proposal rule

| ID | Sev | Description | file:line | Root cause | Affected | Evidence | Recommended correction |
|---|---|---|---|---|---|---|---|
| CE-46 | High | `origin/main` has one print for every audience. Page 1 carries the validation banner and coverage panel (including SoA upload instructions); the item status is hard-coded "Not Checked"; the QR sends the checklist id to api.qrserver.com. | `checklist-document.js:73`, `:317-391`, `:346`, `:359`; `checklist-module.js:2681-2744`, `:2728` | Single audience | Anything sent to a client | Code | Auditor Working Checklist and Client Preparation Checklist from one data source (D.13). Local QR generation. |
| CE-47 | High | The unmerged client export (`cc912ca`) still leaks or omits:<ul><li>unconfirmed suggested citations for `auditorReview` items (FOCUS, SURV 9.6.2), via a fallback to `cs.citation(refs)`;</li><li>Stage 1 AI focus text verbatim;</li><li>auditor-review RECERT items ("Areas requiring follow-up");</li><li>the exact Annex A sample and "Sites in the sampling plan" (confidential planning);</li><li>it prints no scope (`ck.auditScope` is never set by the generator);</li><li>generic residuals pass through;</li><li>RECERT/IMS duplicates are printed twice;</li><li>the CE-01/CE-03 errors carry through.</li></ul> | branch `checklist-document.js:382`, `:418-420`, `:441`, `:523` | Regex rewording over auditor text | Client copy | Run on the 82-item build | Rework before merge (coordinate with the owning session). Filter by a declared `audience` per item, not by regex. |
| CE-49 | High | The checklist editor save replaces `clauses` but keeps `readyForAudit`. Rows keep only `{clause, requirement}`, dropping refs, citation, criterionSource and auditorReview (traceability lost). The local persist never sends `ready_for_audit`. There is no content version history. | `checklist-module.js:1347-1350`, `:1384-1398` | Release is a flag, not a lock | Approved checklists | Code | Editing a released checklist withdraws the release or creates a new version. Preserve item provenance. Keep `resolvedIssues` history. |
| CE-50 | Medium | Stage 1 "Apply" is all-or-nothing and overwrites the auditor's statuses (including with `""`). | `client-docs-bulk.js:4518-4527` | Unconditional assignment | Pre-audit review | Code | Per-item accept. Never overwrite an auditor-set value (AI proposes only). |

### B.6 Suspected weaknesses (not proven, or needs live data or a decision)

- **S-01** The exact live origin of "AWS MSP Tier Plan" against previous findings. CE-26/CE-27 is the confirmed mechanism. It could also be a checklist built before the SupportingDocs gates, or the AI Stage 1 review. Needs a live export.
- **S-02** The live 162/58 split. Likely non-extracted formats (xlsx/pptx/images), vendor/project titles and heading thresholds. Unverified.
- **S-03** `ReportStats.buildProgramme` marks an unrecorded prior stage `Completed / source certificate` (`report-stats.js:872-884`). This is consistent with the **user rule of 2026-10-15** (lifecycle by Initial Date), but conflicts with brief §10 ("missing records do not mean an audit did not happen" implies *unknown*, not *completed*). **Decision needed.**
- **S-04** RECERT and IMS both ask 6.2, 6.3, 9.2, 9.3 and 10.x (word overlap 21–58%, so not caught). This may be intentional (cycle view vs current state), but it doubles credit.
- **S-05** 20000-1 6.1 and 10.2 carry extra content (risks to service requirements, improvement evaluation criteria) not reached by the shared prompts (medium confidence).
- **S-06** `bcms-disruption` cites 22301 10.1; 8.6/8.4 is probably more apt (medium confidence).
- **S-07** Account-setup AI suggestions arrive pre-ticked (opt-out), which is in tension with "AI proposes". `createChecklistFromKB` creates global checklists with no role check. A non-admin KB analysis may fail to sync (settings writes are admin-only).
- **S-08** KB prompts send client personnel names to Gemini (`settings-kb.js:1148-1152`). This is a privacy review item.
- **S-09** Tenancy: no tenant column and `USING (true)` policies. The app runs as a single CB, so this is not a leak today, but the brief's "cross-tenant isolation" tests cannot be written against the current model. **Decision needed.**
- **S-10** ISO/IEC 20000-1:2018/Amd 1:2024: believed published (about 70–75% confidence here). Confirm against the CB's standards subscription before encoding.

---

## C. Knowledge-base and pipeline-stage assessment

Stages: **SD** source data (registry/KB content), **RE** requirement extraction, **RT** retrieval, **IM** integrated mapping, **AG** AI generation, **QG** question generation (deterministic), **PV** post-generation validation, **CC** coverage calculation, **ER** export rendering. "AI generation" is listed because the brief asks; the scope-driven generator makes no AI call, so almost nothing originates there for registry standards.

| Issue | Origin (primary → contributing) | Notes |
|---|---|---|
| 20000-1 6.3 under "Planning of changes" | **IM** (registry `shared` key) → **PV** (QA existence-only, CE-02) → **CC** (credited twice) | Not a KB or AI problem. |
| Complaints → 8.6.3 | **IM** (`refsBy`) | Registry data. |
| Climate amendments missing | **SD** (no edition/amendment model) → **RE** (KB extraction has no edition) → **QG** (prompts) | Both the registry and the KB. |
| 20000-1 placeholders | **SD** (no requirement content for un-themed clauses) → **QG** (template `:1981`) → **PV** (info only) → **CC** (credited) → **ER** (client copy) | |
| Near-identical / mismatched walks | **SD** (thin keyProcesses model) → **QG** (regex focus, angle bug) → **PV** (lexical-only duplicate check) | |
| Unmapped documents / wrong suggestions | **RE** (name/heading-only extraction, union `linkedClauses`) → **RT** (Stage 1 matcher, SupportingDocs gates) → **ER** (hint hides basis) | |
| SoA refs not extracted | **RE** (format allowlist, heading regex, no table parse) → **RT** (metadata-only `docText`) → **IM** (two applicability sources, CE-16) | |
| A.5.35 / A.8.3 not covered | **QG** (alphabetical round-robin, CE-15) → **SD** (tier-1 assumption without SoA) → **CC** (flags it only afterwards) | |
| A.6.3 / A.6.7 under JML | **SD** (theme assignment and theme-level prompts) → **QG** (grouping) → **CC** (group credit) | |
| Theme-covered controls not tested (A.5.17, A.8.5, A.8.14, A.8.20) | **SD** (theme `refs` wider than the prompt) → **CC** | |
| 22301 8.4.4 / 8.4.5 | **SD** (registry omission) → **CC** (complete count of an incomplete inventory) | |
| RPO / CMDB / "at least one" | **SD** (prompt wording) | |
| Cycle handling | **RT** (prior plans: no status filter; current plan included; `certs[0]`) → **CC** (planned history credited) → programme (S-03) | |
| 25/25 … while "Not checked" | **CC** (planned = covered; cross-standard collision) → **ER** ("validated", "This audit", hard-coded status) | Most severe. |
| Client export leakage | **ER** (single audience on main; regex rewording on the branch) | |
| 14001/45001 built-ins | **SD** (word-swap fallback) → **RT** (branch order shadows the registry) | Outside the PCC scope. |
| KB clause text trustworthiness | **AG / RE** (AI from memory, auto-ready) → **PV** (KB items exempt) | Affects non-registry standards and NC clause text. |

---

## D. Gap analysis of the brief's capabilities

Legend: ✅ existing and working · ⚠️ existing but defective · ◐ partially implemented · ❌ missing · ❓ requires further verification.

| Brief § | Capability | Status | Evidence / defect |
|---|---|---|---|
| 2 | Pipeline traced, defects separated from weaknesses | ✅ (this document) | Sections A–C |
| 3 | Registry as deterministic source; unregistered standard generates nothing | ✅ | `checklist-standards.js:19-21`, `resolve().unresolved` → REVIEW item |
| 3 | Validation of standard / edition / amendment | ❌ | CE-04 |
| 3 | Clause and control **existence** validation | ✅ (registry items) / ⚠️ (KB items exempt) | `isKnownRef`; CE-12 |
| 3 | Requirement-type and equivalence validation before consolidation | ⚠️ | Concept keys exist, but one is wrong (CE-01) and QA never checks concept (CE-02) |
| 3 | Invalid reference blocks a QA pass | ◐ | INVALID_REF is blocking; meaning mismatch is not detected |
| 3 | Amendments incorporated (4.1 climate, 4.2 note) without imposing controls | ❌ | CE-04 |
| 4 | Requirement-level semantic coverage per question (requirement, implementation, evidence, effectiveness, sampling) | ❌ | Items carry refs plus free text only |
| 4 | Outcomes: fully / partially / referenced only / not addressed / applicability pending / N/A with justification | ❌ | Binary "ref present" |
| 4 | Deterministic checks plus grounded semantic evaluation | ◐ | Deterministic structural checks only |
| 5 | Client-specific process questions from the client's own descriptions | ⚠️ | Name-only (CE-20, CE-21, CE-23) |
| 5 | Cross-reference instead of duplicate | ◐ | "Core processes audited under their own standard" exists; routing is imperfect |
| 6 | Document relevance ranking (content, title, category, standard, requirement, process, revision, approval, date, period, confidence) | ◐ | Title, heading, topic and stated-standard gates plus Jaccard. No content, approval, date, period or confidence shown (CE-31, CE-33, CE-34) |
| 6 | Document-type classification incl. blank template vs completed record vs historical | ⚠️ | CE-31 |
| 6 | No forced matches; evidence category when nothing fits | ✅ | "No validated supporting document mapped" (`supporting-docs.js:480`) |
| 6 | Disclose metadata-only matching | ⚠️ | Review screen yes, hint no (CE-33) |
| 6 | Mapped-document count is not a compliance score | ⚠️ | Gap "% covered" RAG (CE-32) |
| 7 | Structured SoA ingestion (PDF/Word/Excel), fields, extra controls | ❌ | Ref-list regex only (CE-28) |
| 7 | Reconcile against the Annex A universe; human confirmation | ❌ / ◐ | No reconciliation; the pick-document route asks to check, the coverage auto-read does not (CE-30) |
| 7 | Provisional priorities never silently confirmed | ⚠️ | Tier-1 pool called "applicable" (CE-37) |
| 7 | Risk-based selection (SoA, risk, treatment, previous results, changes, incidents, complaints/appeals, critical services, previous coverage, scheme rules) | ◐ | `riskDrivenControls` uses findings, risk docs, changes and complaints/appeals; previous coverage and critical services are not used in selection; the order is alphabetical (CE-15, CE-16) |
| 7 | State limitations when inputs are missing | ✅ | `RISK_DRIVER_UNAVAILABLE`, `SOA_NOT_SUPPLIED` messages |
| 8 | Thematic grouping only when every control is substantively verified | ⚠️ | CE-17, CE-18 |
| 8 | Per-control evidence and outcome | ❌ | CE-19 |
| 8 | Avoid selection bias | ⚠️ | "last successful test" (CE-17) |
| 9 | Parent mapping is not subclause coverage | ⚠️ | Child-credits-parent and themes credit parents; 22301 subclauses missing (CE-05, CE-36) |
| 9 | 22301: BIA, timeframes, prioritised activities, minimum capacity, strategies, plans, recovery, exercise programme, evaluation, 8.4.4/8.4.5; no universal RPO | ◐ | BIA/strategy/exercise themes exist; 8.4.4/8.4.5/8.2.1/8.3.x missing; RPO imposed (CE-05, CE-07) |
| 9 | 20000-1: catalogue vs SLA, asset vs configuration, knowledge, service planning, demand, design and transition, continuity, complaints; no mandated CMDB; periods with no emergency changes or major incidents | ⚠️ | Conflations, placeholders, CMDB, no fallback, complaints mis-ref (CE-03, CE-06, CE-07, CE-14) |
| 10 | Certificate dates, cycle start, audit types | ◐ | Cycle resolvers exist but coverage uses its own (CE-40) |
| 10 | Previous findings and coverage | ◐ | Findings from `state.ncrs` ✅; prior coverage counts planned, unexecuted and cancelled (CE-38) |
| 10 | Missing history ≠ audit not done | ❓ / ⚠️ | Coverage hedges correctly in its messages; programme says "Completed" (S-03, decision) |
| 10 | Recert questions assess effectiveness over the cycle | ✅ | `RECERT_PRIORITIES` |
| 10 | Cycle not imposed as the internal-audit period | ⚠️ | CE-45 |
| 10 | Corrective action for NCs only | ✅ | `finding-workflow.js:125-128`, `:209`; RECERT prev-findings prompt |
| 11 | Separate structural / semantic / completed / evidence-verified / cycle / applicability-confidence metrics | ❌ | CE-35 |
| 11 | No inflation (duplicates, parents, invalid IDs, placeholders, unverified history, notes, assumed applicability, uploaded-only docs) | ⚠️ | DOCNOTE excluded ✅; the rest inflate (CE-14, CE-36, CE-37, CE-38) |
| 11 | Denominators from the authoritative inventory | ◐ | Registry used ✅, but it is incomplete (CE-05) and the Annex A denominator is assumed (CE-37) |
| 12 | 7-layer QA (structural, requirement, question quality, client context, evidence relevance, audit-type suitability, coverage integrity) | ◐ | Structural ✅, requirement ⚠️, question quality ◐ (lexical), client context ❌, evidence relevance ❌, audit-type ◐ (ceiling and MISSING_*), coverage integrity ⚠️ |
| 12 | Four outcomes; no unconditional pass; actionable diagnostics | ⚠️ | CE-42, CE-43 |
| 13 | One authoritative data source | ✅ | The checklist object; the branch export reads the same record |
| 13 | Auditor Working Checklist with diagnostics | ◐ | The main print is effectively this, but its status is hard-coded |
| 13 | Client Preparation Checklist, clean | ◐ (unmerged) / ⚠️ | CE-46, CE-47 |
| 13 | Keep the current PDF design and impartiality | ✅ | `print-shell.js`; the branch reuses it |
| 14 | Overrides with traceability; don't overwrite approved checklists | ⚠️ | `resolvedIssues` ✅; the editor keeps the release and drops provenance (CE-49) |
| 14 | No unnecessary AI; deterministic | ✅ (generator) / ⚠️ (KB auto-ready, Stage 1 Apply) | CE-11, CE-50 |
| 14 | Tenant isolation preserved | ❓ | Single-CB model (S-09) |
| 15 | Regression tests across combinations | ◐ | ~2,500 tests incl. `checklist-coverage`, `checklist-multistandard-coverage`, `process-walkthroughs-distinct`, `plan-integrity`, PCC fixture; no execution-aware coverage, SoA-format, per-control or client-export-leak tests; the PCC fixture dates are out of date |
| 16 | Acceptance criteria | ❌ (most) | See E.3 |

---

## E. Prioritised implementation plan

Principles, taken from the brief and the project:
- Extend the existing modules (`ChecklistStandards`, `ClientDocsBulk.buildScopedChecklist`, `ChecklistQA`, `ChecklistCoverage`, `SupportingDocs`, `ChecklistDocument`). No parallel engine.
- Standard knowledge goes into the **registry/KB data**, never `if (client === …)`.
- No new AI calls in generation.
- All schema change is additive JSONB on existing rows (checklist `clauses`/`qa_context`, client JSONB, settings `knowledge_base`). **No SQL migration is expected** except where noted.
- Existing checklists keep working: new fields are optional, and old checklists are assessed as "legacy — semantic coverage not available".
- Approved or released checklists are never rewritten; regeneration creates a new version.
- Each work package ships as its own PR with tests, `npx vitest run` and `npm run check:globals`.

### E.1 Work packages (in order)

| # | Work package | Fixes | Depends on | Files | Migration | Regression tests | Impact | Risks |
|---|---|---|---|---|---|---|---|---|
| **WP1** | **Truthful coverage metrics and gate** (stop the false assurance first) | CE-35, CE-36, CE-37, CE-38, CE-39, CE-42, CE-43, CE-44 | — | `checklist-coverage.js`, `checklist-qa.js`, `checklist-module.js` (coverage card, gate resolution actions), `checklist-document.js` (coverage panel wording) | None | Coverage must:<ul><li>stay **0 completed** on an all-Not-checked checklist;</li><li>never credit another standard for a clause number;</li><li>give no parent credit without all children;</li><li>not credit a cancelled or unexecuted prior plan;</li><li>exclude the current plan from priors;</li><li>block on criticals;</li><li>return four-state outcomes.</li></ul>Update snapshot tests that assert 100%. | Removes the 25/25 / "validated" false assurance immediately. Completed coverage reads execution progress (report checklistProgress). | Existing released checklists may show "blocked" after the change. Show it as a re-assessment, not a regression, and allow disposition. Needs a mapping from report progress to checklist items (exists in `execution-module-v2.js`). |
| **WP2** | **Registry v3: editions, amendments, corrected mappings, completeness** | CE-01, CE-03, CE-04, CE-05, CE-06 (rows), CE-07, CE-08, CE-09, CE-45 | — (parallel with WP1) | `checklist-standards.js`, `finding-workflow.js` (if the prompt is shared), `report-integrity.js:2369` (wording) | None | Tests:<ul><li>20000-1 6.3 not consolidated;</li><li>complaints cite 8.3.2;</li><li>22301 has 8.2.1, 8.3.x?, 8.4.1, 8.4.4, 8.4.5;</li><li>every theme ref is `tests` or `related`;</li><li>climate prompts present when an amendment is in scope, with an N/A-with-justification outcome;</li><li>no "RPO"/"CMDB" in prompts;</li><li>edition label "+A1:2024".</li></ul>Update `registry-hs-standards`, `checklist-multistandard-coverage`. | Correct citations and denominators. 22301/20000-1 inventories grow, so coverage % drops to honest values. | Registry text must be paraphrase, not verbatim ISO text (copyright). Amendment existence for 20000-1 to be confirmed (S-10). Changing denominators changes printed figures on new checklists only. |
| **WP3** | **Concept-aware QA and placeholder detection** | CE-02, CE-12 (registry part), CE-14 (QA side), CE-22 | WP2 (items carry `concept`/requirement ids) | `checklist-qa.js`, `client-docs-bulk.js` (`scopedQuestion` adds `concept`, `placeholder`) | None | Tests:<ul><li>an item whose concept ≠ the ref's concept fails;</li><li>a template item is "Requires auditor review" with no coverage credit;</li><li>KB items validated against their approved inventory;</li><li>QA flattens all nested items.</li></ul> | Invalid or mismatched references fail QA (acceptance criterion). | Legacy checklists without `concept` fall back to existence checks (flagged "legacy"). |
| **WP4** | **Requirement elements and residual questions** | CE-14 (content), CE-06 (themes), CE-18 | WP2, WP3 | `checklist-standards.js` (per-clause `elements: {requirement, implementation, evidence, effectiveness, sampling}` and per-theme `tests`/`related`), `client-docs-bulk.js:1978-1983` | None | Every registry clause and control has elements; no generated item uses the generic template for a registry standard; semantic coverage outcome per item (fully, partially, referenced-only, not addressed, applicability pending, N/A justified) computed deterministically from elements addressed. | Placeholders disappear; coverage becomes requirement-level. | Authoring effort for ~100 clauses plus 93 controls (data, not code). Keep checklist length within the existing ceiling: elements enrich questions, they do not add items. |
| **WP5** | **Annex A selection, prompts and per-control results** | CE-15, CE-16, CE-17, CE-19, CE-30 (selection side) | WP2 (control prompts), WP7 (confirmed SoA) for full effect; ordering can ship earlier | `client-docs-bulk.js:1610-1627`, `:1994-2032`; `checklist-coverage.js` `riskDrivenControls`; `checklist-standards.js` (per-control prompt overrides); `execution-module-v2.js` (per-control sub-results UI); `report-stats.js` (finding criterion per control) | None (JSONB `controlResults[]` on the item) | Tests:<ul><li>one applicability resolver for generator and coverage;</li><li>required controls always kept;</li><li>ordering = drivers → never-sampled-in-cycle → tier;</li><li>no alphabetical bias (A.5.35/A.8.3 rotate in);</li><li>A.6.3/A.6.7 get their own prompts;</li><li>continuity prompt asks for all tests including failures;</li><li>an NC raised on a group cites the failing control.</li></ul> | Defensible sample; accurate Annex A coverage. | Execution UI change (sub-rows) needs design approval (**decision F-2**). |
| **WP6** | **Cycle resolver unification and history** | CE-38 (history side), CE-40, S-03 | WP1 | `checklist-coverage.js:348-560`, `report-stats.js:872-884` (only if the decision changes the rule), `audit-planning-domain.js` (reuse `resolveCertificateCycle`), `tests/fixtures/pcc-connection.mjs` (dates → 2023-12-16) | None | Tests:<ul><li>per-standard cycle;</li><li>PCC cycle 2023-12-16 → 2026-12-15;</li><li>one prior audit on file is reported as such;</li><li>a missing surveillance is "no record on file", never credited coverage;</li><li>a cancelled plan is excluded;</li><li>multi-certificate client.</li></ul> | Correct recert history (acceptance criterion). | Must not contradict the 2026-10-15 lifecycle rule. Only the *coverage credit* and the *programme status label* are in question (**decision F-1**). |
| **WP7** | **Structured SoA ingestion with confirmation** | CE-28, CE-29, CE-30 | WP1 (provisional vs confirmed metric) | `client-docs-bulk.js` (xlsx via the existing lib loader if SheetJS is available, else CSV export guidance; table-aware docx/PDF row parse), new pure helper in `checklist-coverage.js` or a small `soa-ingest.js` (registered in the ship allowlist and duplicate-globals tests), `checklist-module.js` (confirmation modal) | None (checklist/client JSONB `soa{controls[{ref,title,applicable,justification,status,refs}], extraControls[], version, approvalDate, source, confirmedBy, confirmedAt}`) | Fixture SoAs as PDF text, docx table text, xlsx rows and pasted text with ranges; exclusions; 2013 refs flagged; reconciliation vs 93 (missing, unknown, extra); provisional until confirmed; never auto-confirmed. | SoA-driven, defensible applicability. | Extraction from arbitrary layouts stays heuristic, so a human confirmation step is mandatory. Store structured fields, not file bodies. |
| **WP8** | **Document intelligence** | CE-26, CE-27, CE-31, CE-32, CE-33, CE-34, CE-50 | WP1 | `client-docs-bulk.js` (import: type and status; `clauseMap` readers; Stage 1 matcher; Apply per item), `supporting-docs.js` (type/period/approval gates, confidence band, basis disclosure), gap analysis labels | None (document JSONB fields `docType`, `status`, `approvedOn`, `periodFrom/To`, `textIndex?`) | Tests:<ul><li>"AWS MSP Tier Plan" never suggested for findings or corrective action;</li><li>an improvement heading does not map to NC across standards;</li><li>a blank template is never evidence;</li><li>a historical record outside the audit period is flagged;</li><li>the hint discloses "title/heading only";</li><li>gap analysis is labelled as mapping, not conformity;</li><li>Stage 1 Apply never overwrites auditor values.</li></ul> | Fewer wrong suggestions; honest unmapped list. | Existing documents lack the new fields, so they are treated as "unclassified (metadata-only)" with an optional re-classify action, never silently changed. |
| **WP9** | **Client process intelligence** | CE-20, CE-21, CE-23, CE-24 | WP4 (elements for cross-reference) | `clients-org-setup.js` (form fields, merge on edit), `clients-import.js`, `client-docs-bulk.js:1380-1593` | None (keyProcesses JSONB adds `purpose, inputs, outputs, risks, controls, interfaces, documentRefs`) | Tests:<ul><li>walks use the client's own fields when present;</li><li>generic fallback labelled;</li><li>12 processes produce no repeated angle;</li><li>Service Desk cross-references the incident/request themes;</li><li>ITSM incident goes to the 20000-1 theme;</li><li>editing keeps owner and category.</li></ul> | Client-specific questions (Client Onboarding, Service Desk, Assessment and Design Tools, Continual Improvement) from the client's own descriptions. | Clients without descriptions keep today's questions (labelled), so no regression. AI may *propose* descriptions from documents only through the existing opt-in suggest flow, never auto-written. |
| **WP10** | **Exports: Auditor Working Checklist and Client Preparation Checklist** | CE-46, CE-47 | WP1, WP3 (item audience/placeholder flags), coordinate with the session owning `feat/checklist-client-export` | `checklist-document.js`, `checklist-module.js:2681-2744`, `planning-module.js` | None | Client copy contains no QA, coverage, AI/Stage 1 text, matching statistics, SoA instructions, DOCNOTE, REVIEW, auditor-review items, sampled-control list or site sampling plan; prints certified scope; only confirmed citations; representative evidence from elements. Auditor copy shows real item status and diagnostics. QR generated locally. | Clean client copy (acceptance criterion); impartiality kept. | The branch is in flight in another session. Rebase or replace by agreement (**decision F-4**). |
| **WP11** | **KB hardening** | CE-10, CE-11, CE-12 (KB part), CE-13 | WP2, WP3 | `settings-kb.js` (registry-first, remove the word-swap fallback, review/approval status, edition field, per-client analyses stored apart), `client-docs-bulk.js:2810-2860` | None (settings JSONB) | 14001/45001 built-ins = registry; an AI-extracted inventory is `extracted` until approved; QA validates KB items; a surveillance analysis does not overwrite the inventory. | Trustworthy KB for non-registry standards. | Existing KB entries become "unreviewed": offer a one-click review rather than blocking existing checklists. |
| **WP12** | **Editor and versioning safety** | CE-49 | WP3 | `checklist-module.js:1340-1400` | None | Editing a released checklist withdraws the release (or forks a version); item provenance preserved; override history kept. | Approved checklists are never silently changed. | UX: editors must re-release. |
| **WP13** | **Regression matrix** | §15 | Runs alongside each WP | `tests/fixtures/` (PCC updated plus synthetic: single-standard 27001, 22301-only, 20000-1-only, 9001+14001 legacy, Stage 1/Stage 2, surveillance, recert, with/without SoA, no/metadata-only/full-content documents, incomplete history, remote/on-site) | — | One parameterised suite asserting each acceptance criterion (E.3). Cross-tenant tests depend on **decision F-3**. | Locks the behaviour. | Keep fixtures synthetic; no live client data in the repo. |

Suggested release grouping (each one PR, Phase 2 to start only after approval):
1. **R1 (fast, highest value):** WP1 + the WP2 corrections that need no new content (CE-01, CE-03, CE-07, CE-08, CE-09, 22301 rows).
2. **R2:** WP3 + WP4.
3. **R3:** WP5 + WP7.
4. **R4:** WP6 + WP8.
5. **R5:** WP9 + WP10.
6. **R6:** WP11 + WP12.

WP13 grows with each release.

### E.2 Migrations

No SQL migration is required for WP1–WP12. All new data is optional JSONB inside existing columns (`checklists.clauses`/`qa_context`, client JSONB, `settings.knowledge_base`). If per-checklist **content versioning** (WP12) is chosen as a separate history table rather than an embedded `versions[]`, that would be the only new migration. It would be additive and non-destructive, run before the JS deploy as per project practice.

### E.3 Acceptance-criteria trace (brief §16)

| Criterion | Delivered by |
|---|---|
| Invalid references fail QA | WP3 (concept), existing INVALID_REF |
| Placeholders get no credit | WP3 + WP4 |
| Traceability to KB/registry | WP2/WP4 (element ids on items), WP12 (provenance kept) |
| Standard differences preserved | WP2 (6.3, complaints, risk refs), WP1 (no clause-number collision) |
| Amendments included | WP2 |
| Confidence-aware documents | WP8 |
| Provisional applicability without SoA | WP1 + WP7 |
| Accurate Annex A coverage | WP5 + WP1 |
| Planned separate from verified | WP1 |
| Correct recert history | WP6 |
| Notes excluded from scoring | Already true for DOCNOTE; WP1 extends to auditor-review/placeholder items |
| Clean client exports | WP10 |
| Existing functionality intact, tests passing | Every WP; legacy-checklist fallback paths |

---

## F. Approval gate — STOP

Phase 1 is complete. **Nothing in Phase 2 starts without approval.** Decisions needed:

1. **F-1 Programme status for audits with no record** (S-03). Should an unrecorded past surveillance read "No record on file (status unknown)" in the report programme and earn **no** coverage credit? The alternative is to keep "Completed (certificate)" per the 2026-10-15 lifecycle rule. The recommendation keeps the lifecycle stage rule and changes only the programme *status label* and coverage credit.
2. **F-2 Annex A grouped items.** The options are per-control sub-results inside one grouped question (recommended; checklist length unchanged), or one question per control (longer checklists, which the brief discourages).
3. **F-3 Tenant isolation.** The app has no tenant column, and RLS is `USING (true)` for authenticated users (single-CB deployment). Either accept the single-CB scope and write *client-scoping* tests, or plan a tenant model as a separate project.
4. **F-4 `feat/checklist-client-export`** is in flight in another session. Either that session applies the CE-47 corrections before merging, or WP10 supersedes it.
5. **F-5 Release order.** Approve the R1–R6 grouping, or reprioritise. R1 alone removes the most serious false assurance (CE-35, CE-36, CE-01).
6. **F-6 Inputs needed.**
   - A live state export (read-only) for PC Connection, to confirm S-01/S-02 and the live 82-item checklist.
   - Confirmation of ISO/IEC 20000-1:2018/Amd 1:2024 from the CB's standards subscription.
   - Agreement that the registry carries paraphrased requirement elements, not verbatim ISO text.

---

## Status log

### 2026-11-28 — R1 approved and implemented (branch `fix/checklist-r1-honest-coverage`)

Implemented (see `tests/checklist-r1-honest-coverage.test.js` and the R1 block in `tests/checklist-document.test.js`):

- **CE-35** Coverage reports `planned`, `completed` (answered conform/NC at this audit), `earlierAudited` and `cycleVerified` separately. The screen and the PDF show "Planned this audit" and "Audited so far" side by side. Planned bars are neutral grey, not green, and both say coverage is not conformity.
- **CE-36** `ChecklistQA.creditedRefs` is the single credit rule. An item credits only its own refs, and unconfirmed suggestions and awareness notes credit nothing. `ChecklistStandards.refCovered` gives a parent credit from a sub-clause only where the registry holds no sub-clause rows.
- **CE-37** The Annex A row says "provisional pool" when there is no SoA (`poolBasis`).
- **CE-38 / CE-39** `buildContext` excludes the current plan, cancelled plans and future plans. Prior checklists are credited only for answers on a **final** report (`priorExecuted`). There are new limitations `PRIOR_RESULTS_UNAVAILABLE` and a per-audit `PRIOR_CHECKLIST_UNAVAILABLE`.
- **CE-42** Critical `MISSING_REQUIREMENT`, `MISSING_ANNEX_A` and `EXCESSIVE_COUNT` now block Ready. The gate card shows every blocker, including an "Other" group.
- **CE-43** Outcomes are Passed / Passed with warnings / Requires auditor review / Failed validation, and none says "validated". `combine(qa, coverage, checklist)` uses the gate's own judgement, so the dispositioned criticals stop failing.
- **CE-44** Process coverage is matched question by question: by title, or by the text of organisation-context and legacy questions.
- **Registry fixes:**
  - CE-01: 20000-1 6.3 is no longer `planning.changes`; there is a new `sms-plan` theme, and the agenda puts it in "planning".
  - CE-03: complaints are cited to 20000-1 8.3.2.
  - CE-07: RPO, CMDB and "at least one" wording reworded, with fallbacks.
  - CE-08: risk-treatment `refsBy`.
  - CE-09: 22301 outsourced is cited to 8.1.
  - 22301 8.4.4 and 8.4.5 added: `bcms-plans` gains 8.4.4 and there is a new `bcms-recovery` theme. The agenda block covers both.
  - New themes are appended so surveillance samples are unchanged.
  - Consolidated questions name only the systems that share the requirement.

PC Connection reconstruction after R1:
- 80 items.
- 25/25, 31/31 and 44/44 **planned**, 0 audited.
- Annex A 37/45 in the provisional pool.
- Combined status "Requires auditor review": one auditor-review item and CYCLE_CONTROL_GAP.

Not in R1 (remains for R2+): the CE-04 climate amendments, the CE-05 rows other than 8.4.4 and 8.4.5, CE-14 placeholders, CE-17/18/19 Annex A prompts and per-control results, CE-40 cycle anchor, CE-45 internal-audit wording, and SoA, document and export work.

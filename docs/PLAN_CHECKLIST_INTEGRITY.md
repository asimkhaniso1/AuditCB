# Audit plan & checklist integrity (v35.0)

Root causes, design and operating notes for the PC CONNECTION, INC. recertification correction
(audit 3–5 November 2026). Tests: `tests/plan-integrity.test.js`, `checklist-document`,
`checklist-multistandard-coverage`, `supporting-docs`, `finding-workflow`, `doc-format`,
`planning-module-integrity`, `plan-data-heal`, `finding-response-ui`, `pdf-render.integration`.

## Read this first: the deployed code was newer than the checkout

`main` locally was **24 commits behind `origin/main`**, and the plan generator that produced the
PDFs ("Scheduled Audit / Recommended Audit Window / Duration Calculation", `audit-planning-domain.js`)
existed only there. All work is on a branch from `origin/main`.

## Root causes

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Every agenda row says `Other` | The auditor `<select>` had options `All`, each auditor name, `Other`. `Other` was `selected` whenever the stored value matched no other option. The AI prompt taught the model to answer `All Team`, which matches nothing → every row saved as `Other`. | No `Other` option; only assigned auditors; blank (not guessed) when unresolvable; rows carry an auditor ID; gate blocks placeholders per row. |
| 2 | `Audit Team: None` | `otherMembers.join(', ') \|\| 'None'` — the fallback for a team of one. | `auditTeamLabel()` → "Lead Auditor only"; gate rejects "Audit Team: None" in the rendered document. |
| 3 | "QA passed / Coverage validated" beside "could not be assessed" | Two resolvers. `runChecklistQA` parsed `checklist.standard`; `buildContext` read only `standardIds`/`qaContext.standardIds` (stored only inside `qa_context`; lost on a round-trip). Coverage filed the failure as `info`; `ok` stayed true; `summarize()` said "validated". | One resolver (`ChecklistCoverage.resolveStandardIds`) with heal; failure is `critical`/**Blocked**; four exclusive outcomes; readiness refuses a coverage pass that did not run. |
| 4 | Corrective action demanded of NCs, observations and OFIs alike | The `prev-findings` checklist prompt applied 10.2/10.1 requirements to every finding type. | `finding-workflow.js` defines each type's own treatment; the prompt is the required sentence; a test pins the registry wording to it. |
| 5 | Wrong supporting documents | `docCoversRef` treated "names no standard" as "applies to all standards" and let a parent clause cover any sub-clause (a supplier procedure tagged `8.4` covered 22301 8.4 and 20000-1 8.4.1–8.4.3). | `supporting-docs.js`: status, stated standard and subject gates; similarity ranks only; no fallback to the old matcher. |
| 6 | Literal `&amp;` | `Sanitizer.sanitizeText` HTML-escaped on **write**; the edit form escaped again on the way in (each edit→save added a layer); the print template interpolated raw. | Plain-text storage; every output path decodes once and escapes once; `DataMigration.healPlanText` + SQL heal; gate/lint reject entities. |
| 7 | Browser header/timestamp/`about:blank` | Blank popup + `window.print()` with no `@page` control. | `@page` margin boxes (measured: Chrome drops its own decoration when they exist). |
| 8 | Nearly blank sixth page | An in-flow `.footer` after the content overflowed onto a new page. | No in-flow footer; lint (`FLOW_FOOTER`) and gate reject it. |
| 9 | `Page 1 of 1` | A literal string. A browser cannot know the page count while laying out flow content. | `counter(page)` / `counter(pages)`; lint rejects a static "Page N of M". |
| 10 | Checklist "Audit date" = generation date | `new Date().toLocaleDateString()`. | Scheduled audit from the plan; generation date labelled separately. |
| 11 | Wrong clause numbers on the agenda | Free text from a language model; nothing tied a row to the registry. | Agenda built from a template whose every reference resolves through `ChecklistStandards`; `scanFreeText` catches legacy rows. |
| 12 | Seven follow-up sessions for eight findings | Findings came from `checklistProgress` items with status `nc` (capped at 20), not the register; "scheduling" was whatever the model wrote; nothing checked that each finding landed in a session. | `collectPreviousFindings` (register first, all types) + `mapFindings`; approval blocked naming any unmapped finding. |
| 13 | Untimed catch-all row after the closing meeting | Appended by the model with no time. | Gate: `UNTIMED_ROW`, `ACTIVITY_AFTER_CLOSING`; closing meeting must be last. |

## A discrepancy in the brief's ISO/IEC 20000-1 list

The brief labelled 8.2.4 "SMS planning", 8.2.5 "control of parties" and 8.2.6 "service catalogue".
In ISO/IEC 20000-1:2018 those are **service catalogue (8.2.4), asset management (8.2.5) and
configuration management (8.2.6)**; control of parties is **8.2.3** and planning the SMS is **6.3**.
The repository's registry holds the correct titles and is the authority (labels come only from it),
so the plan uses those. Every other clause in the brief matched the registry.

## Operating notes

- Re-run against live data: in the browser console `copy(JSON.stringify({clients:state.clients,
  auditors:state.auditors, auditPlans:state.auditPlans, auditReports:state.auditReports,
  ncrs:state.ncrs, checklists:state.checklists, cbSettings:state.cbSettings}))`, save it, then
  `node tools/render-pcc-pdfs.mjs --out <dir> --state <file>` and `python tools/pdf_qa.py <dir>/audit_plan.html <dir>/pdf`.
- The bundled PC CONNECTION fixture (`tests/fixtures/pcc-connection.mjs`) is a **reconstruction**;
  its finding IDs/types/statuses are placeholders for the live register.
- `--approve-demo` stamps a duration approval to show the approved rendering. Never for a real issue.
- No schema migration is required. `migrations/HEAL_PLAN_TEXT_AND_CHECKLIST_STANDARDS.sql` is an
  optional, idempotent data heal.

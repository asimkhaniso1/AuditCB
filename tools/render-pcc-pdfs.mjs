#!/usr/bin/env node
// Builds the PC CONNECTION audit plan, its internal certification record and
// the client-specific checklist through the REAL application modules (see
// tools/pcc-scenario.mjs) and writes them as print-ready HTML for
// tools/pdf_qa.py.
//
//   node tools/render-pcc-pdfs.mjs --out <dir> [--state <state.json>] [--approve-demo]
//
// Without --state it uses tests/fixtures/pcc-connection.mjs, which is a
// RECONSTRUCTION (see that file's header). With --state it reads a JSON export
// of the live app state — run this in the browser console, save the output, and
// pass the path:
//     copy(JSON.stringify({ clients: state.clients, auditors: state.auditors,
//       auditPlans: state.auditPlans, auditReports: state.auditReports,
//       ncrs: state.ncrs, checklists: state.checklists, cbSettings: state.cbSettings }))
//
// --approve-demo stamps a duration approval and an authorised status change so
// the approved-plan rendering can be inspected. Never use it for a real issue.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildScenario } from './pcc-scenario.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : dflt; };
const outDir = path.resolve(String(opt('--out', path.join(root, 'tmp', 'pcc-render'))));
const statePath = opt('--state', null);
fs.mkdirSync(outDir, { recursive: true });

const s = await buildScenario({
    approve: !!opt('--approve-demo', false),
    state: statePath ? JSON.parse(fs.readFileSync(path.resolve(String(statePath)), 'utf8')) : null
});

const w = (name, body) => fs.writeFileSync(path.join(outDir, name), body);
w('audit_plan.html', s.html);
w('audit_plan_internal_record.html', s.internal);
w('audit_checklist.html', s.checklistHtml);
w('checklist.json', JSON.stringify(s.checklist, null, 2));
w('plan.json', JSON.stringify(s.plan, null, 2));
w('validation.json', JSON.stringify({
    generatedAt: new Date().toISOString(), source: statePath ? 'state export' : 'reconstructed fixture',
    planLint: s.lint, checklistLint: s.checklistLint, blockers: s.validation.blockers, warnings: s.validation.warnings, summary: s.validation.summary,
    checklist: { outcome: s.coverage.outcome, label: s.coverage.outcomeLabel, qaPassed: s.qa.ok, combined: s.combined, integrated: s.coverage.coverage.integrated,
        notes: s.coverage.coverage.notes, issues: s.coverage.issues.map(i => ({ code: i.code, severity: i.severity, message: i.message })) }
}, null, 2));

console.log('wrote', outDir);
console.log('plan lint:', s.lint.length ? s.lint : 'clean', '| checklist lint:', s.checklistLint.length ? s.checklistLint : 'clean');
console.log('gate: blockers', s.validation.blockers.length, 'warnings', s.validation.warnings.length, '| findings', JSON.stringify(s.validation.summary.findings));
s.validation.blockers.forEach(b => console.log('  BLOCKER', b.code, '-', b.message));
s.validation.warnings.forEach(b => console.log('  warn   ', b.code, '-', b.message.slice(0, 140)));
console.log('checklist:', s.coverage.outcomeLabel, '| QA passed:', s.qa.ok, '| items:', s.checklist.itemCount);

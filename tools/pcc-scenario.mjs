// Builds the PC CONNECTION scenario through the REAL application modules and
// returns everything the tests and the render tool need. One implementation, so
// what the tests assert is what the PDFs are made from.
//
//   const s = await buildScenario({ approve: false, state: <live export>, mutate(ctx) {} });

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(pathToFileURL(path.join(root, 'x.js')));

globalThis.window = globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };

export const M = {
    DF: require('./doc-format.js'), PS: require('./print-shell.js'), FW: require('./finding-workflow.js'),
    CS: require('./checklist-standards.js'), QA: require('./checklist-qa.js'), SD: require('./supporting-docs.js'),
    CC: require('./checklist-coverage.js'), Domain: require('./audit-planning-domain.js'), IPI: require('./audit-plan-integrity.js'),
    PD: require('./plan-document.js'), CD: require('./checklist-document.js'), UTILS: require('./utils.js')
};
Object.assign(window, { DocFormat: M.DF, PrintShell: M.PS, FindingWorkflow: M.FW, ChecklistStandards: M.CS, ChecklistQA: M.QA, SupportingDocs: M.SD,
    ChecklistCoverage: M.CC, AuditPlanningDomain: M.Domain, AuditPlanIntegrity: M.IPI, PlanDocument: M.PD, ChecklistDocument: M.CD, UTILS: M.UTILS });
if (!window.ClientDocsBulk) eval(fs.readFileSync(path.join(root, 'client-docs-bulk.js'), 'utf8'));
export const B = window.ClientDocsBulk;

const BRAND = { primary: '#0f2a43', dark: '#0a1c2e', deep: '#16324d', text: '#0f2a43', tint: '#eaf0f6', tintBorder: '#b8c9db' };
export const TODAY = '2026-09-21';

/**
 * @param {Object} [o]
 * @param {boolean} [o.approve]   stamp a duration approval (never for a real issue)
 * @param {Object}  [o.state]     a live state export instead of the reconstructed fixture
 * @param {Function} [o.mutate]   ({plan, client, state, checklist}) => void, before assembly
 */
export async function buildScenario(o) {
    const opt = o || {};
    const { DF, PS, CS, QA, CC, Domain, IPI, PD, CD } = M;
    let client; let plan; let auditors; let docs; let state; let F = null;

    if (opt.state) {
        state = JSON.parse(JSON.stringify(opt.state));
        client = state.clients.find(c => /PC CONNECTION/i.test(c.name));
        plan = state.auditPlans.find(p => p.client === client.name && /recert/i.test(p.auditType || p.type) && String(p.date || '') >= '2026-01-01');
        auditors = state.auditors || [];
        docs = client.documents || [];
        state = Object.assign({ complaints: [], appeals: [] }, state);
    } else {
        F = await import(pathToFileURL(path.join(root, 'tests/fixtures/pcc-connection.mjs')).href);
        docs = F.DOCS.map(d => Object.assign({}, d));
        // Uploads assign linkedClauses from the document name; the reconstructed
        // documents get the same step. Standards stay unstated (legacy uploads).
        docs.forEach(d => { if (!d.linkedClauses) d.linkedClauses = B.mapClauses({ title: d.name, docNumber: d.docNumber }).join(', '); });
        client = Object.assign(JSON.parse(JSON.stringify(F.CLIENT)), { documents: docs });
        plan = JSON.parse(JSON.stringify(F.PLAN_BASE));
        auditors = JSON.parse(JSON.stringify(F.AUDITORS));
        state = { clients: [client], auditors, ncrs: JSON.parse(JSON.stringify(F.NCRS)), auditPlans: [JSON.parse(JSON.stringify(F.PRIOR_PLAN)), plan],
            auditReports: [], checklists: [], complaints: [], appeals: [], cbSettings: { cbName: 'Company Certification International', primaryColor: '#0f2a43' } };
    }
    window.state = state;
    const standardText = String(plan.standard || '');

    const checklist = B.buildClientChecklist(client, docs, { auditType: 'recertification', standard: standardText, manDays: plan.manDays, planId: plan.id });
    checklist.id = 'chk-pcc-recert-2026'; checklist.createdAt = TODAY; checklist.updatedAt = TODAY; checklist.planId = plan.id;
    plan.selectedChecklists = [checklist.id];
    state.checklists = [checklist];
    if (opt.approve) { plan.durationCalculation.approvedBy = 'Certification Manager (demo)'; plan.durationCalculation.approvedAt = '2026-09-22'; }
    if (opt.mutate) opt.mutate({ plan, client, state, checklist });

    const qa = QA.validate(checklist, checklist.qaContext);
    const coverage = CC.assess(checklist, CC.buildContext(checklist, { client, planId: plan.id, scopeStandards: standardText }));
    const combined = CC.combine(qa, coverage);

    const asm = IPI.assemble({ plan, client, auditors, state, checklist, settings: {}, competenceValid: true, domain: Domain });
    Object.assign(plan, asm.patch);
    plan.documentStatus = IPI.STATUSES[0];

    const ctx = {
        client, auditors, assigned: asm.team.assigned, standards: asm.standards, timeZone: asm.timeZone, scope: asm.scope, scopeCheck: asm.scope,
        findings: asm.findings, durationRecord: asm.durationRecord, brand: { name: 'Company Certification International' }, planRef: 'PLN-PCI-2026-02',
        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent('https://audit.companycertification.com/#/verify/plan/' + plan.id),
        checklists: [{ id: checklist.id, name: checklist.name, standardIds: checklist.standardIds, coverage }], traceability: plan.traceability, state
    };
    const validate = () => {
        const html = PD.build(plan, ctx);
        const lint = PS.lint(html);
        return { html, lint, validation: IPI.validate(plan, Object.assign({}, ctx, { html, lint, hoursPerDay: 8 })) };
    };
    let { html, lint, validation } = validate();
    ctx.validation = validation;
    if (opt.approve) {
        const t = IPI.canTransition(plan.documentStatus, IPI.STATUSES[1], { role: 'Certification Manager', validation, plan });
        if (t.allowed) { plan.documentStatus = IPI.STATUSES[1]; plan.approval = { by: 'Certification Manager (demo)', at: '2026-09-22', contentHash: IPI.contentHash(plan) }; }
        ({ html, lint, validation } = validate()); ctx.validation = validation;
    }
    const internal = PD.buildInternal(plan, ctx);
    const checklistHtml = CD.build(checklist, { brand: BRAND, cbName: 'Company Certification International', plan, client, siblings: state.checklists, qa, coverage, combined,
        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent('https://audit.companycertification.com/#/verify/checklist/' + checklist.id) });

    return { F, client, plan, auditors, docs, state, checklist, qa, coverage, combined, asm, ctx, html, lint, validation, internal, checklistHtml,
        checklistLint: PS.lint(checklistHtml), revalidate: () => { const r = validate(); ctx.validation = r.validation; return r; } };
}

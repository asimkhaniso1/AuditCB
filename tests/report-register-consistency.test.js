// The client report agrees with the NC register.
//
// PC Connection's February 2026 surveillance report v1.1 printed its two minor
// NCs as "NCR-177132-1 / -2, due 2026-05-18" while the register held NCR-021
// (no due date) and NCR-053 (due 2 June 2026). Its Managed Services area, with
// three observations and three OFIs and no NC, read "Minor NC" and "No findings
// raised". Its closing meeting summary said "Recommended for certification."
// on a surveillance report. Report Integrity rated it ready for review.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };
loadScript('./report-stats.js', { params: { module: undefined } });
loadScript('./data-service.js', { params: { module: undefined } });
loadScript('./report-executive.js', { params: { module: undefined } });
loadScript('./report-integrity.js', { params: { module: undefined } });
const RS = window.ReportStats;

const PLAN = 'feb-2026';
const CL = 'cl-1';
const nc = (itemIdx, clause, ncrType, extra) => Object.assign({ checklistId: CL, itemIdx, clause, status: 'nc', ncrType,
    comment: 'Objective evidence for ' + clause, department: 'Managed Services', evidenceImages: ['ev.png'] }, extra || {});
const report = () => ({
    id: '1771328365602', planId: PLAN, clientId: 'pcc', client: 'PC CONNECTION, INC.', date: '2026-02-17',
    auditType: 'Surveillance', standard: 'ISO 27001:2022', recommendation: 'Recommended',
    checklistProgress: [
        nc('A-1', 'A.8.8 (27001)', 'ofi'),
        nc('A-2', 'A.8.13 (27001)', 'observation'),
        nc('7-1', '7.5 (Integrated)', 'minor', { department: '' }),
        nc('9-1', '9.2 (Integrated)', 'minor', { department: '' }),
        { checklistId: CL, itemIdx: '4-1', clause: '4.3', status: 'conform', comment: 'Scope confirmed.' }
    ],
    closingMeeting: { date: '2026-02-18', summary: 'Recommended for certification.' }
});
const register = () => [
    // Linked to its checklist item; no due date recorded.
    { id: 21, clientId: 'pcc', auditId: PLAN, clause: '7.5 (Integrated)', severity: 'minor', status: 'Open', sourceChecklistId: CL, sourceItemIdx: '7-1', dueDate: null },
    // An observation copy on 9.2 must never be taken for the 9.2 NC.
    { id: 44, clientId: 'pcc', auditId: PLAN, clause: '9.2 (Integrated)', severity: 'observation', status: 'Open' },
    { id: 53, clientId: 'pcc', auditId: PLAN, clause: '9.2 (Integrated)', severity: 'minor', status: 'Open', sourceChecklistId: CL, sourceItemIdx: '9-1', dueDate: '2026-06-02' }
];
const build = (r) => RS.build({ report: r, hydratedProgress: r.checklistProgress, auditPlan: { id: PLAN, auditType: 'Surveillance' }, client: { id: 'pcc', name: 'PC CONNECTION, INC.' } });

describe('corrective actions carry the register reference and due date', () => {
    beforeEach(() => { window.state.ncrs = register(); });

    it('prints NCR-021 and NCR-053 with the register\'s due date, computing only a missing one', () => {
        const r = report();
        const cas = RS.correctiveActions(build(r), { auditDate: r.date });
        const byClause = Object.fromEntries(cas.map((c) => [c.clause, c]));
        expect(cas).toHaveLength(2);
        expect([byClause['9.2 (Integrated)'].ref, byClause['9.2 (Integrated)'].dueDate, byClause['9.2 (Integrated)'].dueSource])
            .toEqual(['NCR-053', '2026-06-02', 'register']);
        // No register due date: counted from the audit date (minor = 90 days), not from today.
        expect([byClause['7.5 (Integrated)'].ref, byClause['7.5 (Integrated)'].dueDate, byClause['7.5 (Integrated)'].dueSource])
            .toEqual(['NCR-021', '2026-05-18', 'computed']);
    });

    it('keeps the report\'s own id for an NC the register does not hold', () => {
        window.state.ncrs = [];
        const r = report();
        const cas = RS.correctiveActions(build(r), { auditDate: r.date });
        expect(cas.map((c) => c.ref).every((ref) => /^F-\d\d$/.test(ref))).toBe(true);
    });

    it('gives the preview and the PDF one source for the table', () => {
        const src = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
        expect(src.match(/ReportStats\.correctiveActions\(d\.stats\.rs, correctiveActionOpts\(d\)\)/g)).toHaveLength(2);
        // Neither path counts a due date from the day of export any more.
        expect(src).not.toMatch(/const dt = new Date\(\); dt\.setDate\(dt\.getDate\(\) \+ \(t === 'major'/);
        expect(src).not.toMatch(/var due = new Date\(\); due\.setDate/);
    });
});

describe('Report Integrity — what the v1.1 report should have been stopped for', () => {
    beforeEach(() => { window.state.ncrs = register(); });
    const run = (r) => window.ReportIntegrity.check({ report: r, auditPlan: { id: PLAN, auditType: 'Surveillance', auditMethod: 'Remote' },
        client: { id: 'pcc', name: 'PC CONNECTION, INC.' }, stats: build(r) });

    it('blocks certification-granting wording in the closing meeting summary', () => {
        const b5 = run(report()).blockers.filter((b) => b.id === 'B5');
        expect(b5).toHaveLength(1);
        expect(b5[0].message).toMatch(/closing meeting summary/);
        expect(b5[0].source).toBe('report.closingMeeting.summary');
    });

    it('passes a closing summary in surveillance wording', () => {
        const r = report();
        r.closingMeeting.summary = 'Continued certification recommended subject to closure of the two minor nonconformities.';
        expect(run(r).blockers.filter((b) => b.id === 'B5')).toEqual([]);
    });

    it('warns for each NC printed without a nonconformity statement', () => {
        const w31 = run(report()).warnings.filter((w) => w.id === 'W31');
        expect(w31.map((w) => w.message)).toEqual([
            expect.stringMatching(/minor nonconformity at clause 7\.5 \(Integrated\) has no nonconformity statement/),
            expect.stringMatching(/minor nonconformity at clause 9\.2 \(Integrated\) has no nonconformity statement/)
        ]);
        const r = report();
        r.checklistProgress.forEach((i) => { if (i.ncrType === 'minor') i.ncrDescription = 'Requirement X was not fulfilled, as shown by Y.'; });
        expect(run(r).warnings.filter((w) => w.id === 'W31')).toEqual([]);
    });

    it('warns when an NC\'s register record has no due date', () => {
        const w32 = run(report()).warnings.filter((w) => w.id === 'W32');
        expect(w32.map((w) => w.message)).toEqual([expect.stringMatching(/^NCR-021 has no corrective-action due date in the NC register; the report prints the computed date 2026-05-18/)]);
    });
});

describe('Audit Trails — an OFI is not a minor NC', () => {
    it('ranks observations and OFIs below NCs and labels them as what they are', () => {
        const src = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
        expect(src).toMatch(/else if \(\/\^\(ofi\|opportunit\)\/\.test\(t\)\) worstKey = 'ofi';/);
        expect(src).toMatch(/const worstLabel = \{ major: 'Major NC', minor: 'Minor NC', observation: 'Observation', ofi: 'OFI', conform: 'Conforming' \};/);
        // The timeline counts observations and OFIs as findings.
        expect(src).toMatch(/if \(\/\^\(obs\|ofi\|opportunit\)\/\.test\(t\)\) g\.advisory\+\+;/);
    });
});

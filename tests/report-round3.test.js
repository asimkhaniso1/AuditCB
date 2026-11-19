// PC Connection draft, 2026-11-19 (82 pages):
//  1. the CAR forms said "Report 1794902180881" (a database id), printed the
//     remark as the statement and only a photo count as the evidence;
//  2. "None. All findings were acknowledged by the auditee at the closing
//     meeting." was printed by default, with the closing meeting unrecorded;
//  3. "Unassigned / Cross-functional" was printed as if it were a department;
//  4. previous NCs printed internal FOCUS refs and "previous record not
//     available" while their NCR register records existed.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import fs from 'fs';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    window.UTILS.getPlanRef = () => 'PLN-PCI-2026-02';
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-executive.js', { params: { module: undefined } });
    loadScript('./report-findings-ops.js', { params: { module: undefined } });
    loadScript('./execution-reporting.js', { global: true });
});
beforeEach(() => {
    window.state = { auditReports: [], clients: [], auditPlans: [], ncrs: [] };
    globalThis.state = window.state;
});

describe('1. CAR forms', () => {
    const forms = (item) => {
        const d = {
            report: { id: '1794902180881', date: '2026-11-17', leadAuditor: 'Lead', ncrs: [] },
            auditPlan: { id: 'p1' }, cbSettings: { cbName: 'CB' },
            hydratedProgress: [Object.assign({ checklistId: 'cl1', itemIdx: 'A-0', clause: '7.5', status: 'nc', ncrType: 'minor', requirement: 'Control documented information.' }, item)]
        };
        const sec = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms');
        const el = document.createElement('div');
        el.innerHTML = sec.bodyHtml.replace(/<\/(td|div)>/g, ' </$1>');
        return el.textContent.replace(/\s+/g, ' ');
    };

    it('carry the report reference, the NC statement and the recorded evidence', () => {
        const t = forms({ ncrDescription: 'The procedures have no change-request section.', comment: 'Change request section missing in the Document Control Procedure &amp; SMS procedure', evidenceImages: ['a'] });
        expect(t).toContain('Report AR-PCI-2026-02');
        expect(t).not.toContain('1794902180881');
        expect(t).toContain('Statement of Nonconformity The procedures have no change-request section.');
        expect(t).toContain('Objective Evidence Change request section missing in the Document Control Procedure & SMS procedure.');
        expect(t).toContain('1 evidence item(s) attached');
    });

    it('say "Not recorded." for a missing statement or evidence, never the remark in its place', () => {
        const t = forms({ comment: 'Seen in the procedure' });
        expect(t).toContain('Statement of Nonconformity Not recorded.');
        expect(t).toContain('Objective Evidence Seen in the procedure.');
        expect(forms({})).toContain('Objective Evidence Not recorded.');
    });
});

describe('2. Closing meeting', () => {
    it('the export never prints an acknowledgement nobody recorded', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect(src).not.toMatch(/\|\| 'None\. All findings were acknowledged by the auditee at the closing meeting\.'/);
        expect(src).toMatch(/editedUnresolved \? htmlEsc\(editedUnresolved\) : CLOSING_NOT_RECORDED/);
    });

    it('the preview box starts empty, with a prompt', () => {
        window._reportPreviewData = {
            report: { id: 'r1', client: 'PC', standard: 'ISO 22301:2019', date: '2026-11-17', checklistProgress: [], ncrs: [] },
            hydratedProgress: [], client: { id: 'c1', name: 'PC', sites: [] }, auditPlan: { id: 'p1', team: [] },
            cbSettings: {}, cbSite: {}, clientLogo: '', cbLogo: '',
            stats: { majorNC: 0, minorNC: 0, ncCount: 0, observationCount: 0, ofiCount: 0, conformCount: 0, naCount: 0, totalItems: 0, statusColor: '#10b981', auditStatus: 'Recommended', coveragePct: 0, ncByClause: {} },
            today: '19/11/2026'
        };
        window.DataService = { syncAuditReport: () => {} };
        window.showReportPreviewModal();
        const box = document.getElementById('rp-unresolved');
        expect(box.textContent).toBe('');
        expect(box.getAttribute('data-placeholder')).toMatch(/unresolved issues or diverging opinions/);
    });
});

describe('3. No department recorded', () => {
    const d = () => ({
        report: { id: 'r1', standard: 'ISO 22301:2019', checklistProgress: [] },
        hydratedProgress: [
            { clause: '4.4', status: 'nc', ncrType: 'minor', department: '' },
            { clause: '7.5', status: 'nc', ncrType: 'minor', department: 'IT Operations' }
        ],
        auditPlan: {}, stats: {}
    });

    it('Key Findings names the clause alone, not "Unassigned / Cross-functional"', () => {
        const s = window.ReportExecutive.buildAuditOutcomeSummary(d(), { findings: [], strengths: [] });
        const text = s.findings.join(' ');
        expect(text).not.toContain('Unassigned');
        expect(text).toContain('(IT Operations)');
    });

    it('the AI is never offered it as a department to name', () => {
        const prompt = window.ReportExecutive.buildExecSummaryPrompt(d());
        const line = prompt.split('\n').find((l) => l.includes('Departments With Findings ('));
        expect(line).toContain('IT Operations');
        expect(line).not.toContain('Unassigned');
        expect(prompt).not.toMatch(/Dept: Unassigned/);
    });
});

describe('4. Previous findings', () => {
    const prevReport = { id: 'prev', planId: 'plan-2025', findingStatus: {} };
    const focusNc = { checklistId: 'cl9', itemIdx: 'F-1', clause: 'FOCUS.2', status: 'nc', ncrType: 'minor' };
    const plainNc = { checklistId: 'cl9', itemIdx: 'B-3', clause: '9.1', status: 'nc', ncrType: 'minor' };

    it('read the NCR register: number, criterion and state', () => {
        window.state.ncrs = [
            { id: 53, auditId: 'plan-2025', sourceChecklistId: 'cl9', sourceItemIdx: 'F-1', status: 'Open', criterionRef: '9.2' },
            { id: 21, auditId: 'plan-2025', sourceChecklistId: 'cl9', sourceItemIdx: 'B-3', status: 'Closed' }
        ];
        expect(window._prevNcRef(prevReport, focusNc, 0)).toBe('NCR-053');
        expect(window._prevNcCriterion(prevReport, focusNc)).toBe('9.2');
        expect(window._prevFollowUpForNC(prevReport, focusNc)).toMatch(/Open — corrective action not yet verified \(Open\)/);
        expect(window._prevFollowUpForNC(prevReport, plainNc)).toBe('Verified closed — corrective action implemented');
    });

    it('never print an internal FOCUS ref, and say when there is no record at all', () => {
        expect(window._prevNcRef(prevReport, focusNc, 0)).toBe('PREV-1');
        expect(window._prevNcCriterion(prevReport, focusNc)).toContain('Criterion not recorded');
        expect(window._prevNcCriterion(prevReport, plainNc)).toBe('9.1');
        expect(window._prevFollowUpForNC(prevReport, focusNc)).toContain('previous record not available');
    });

    it('a record from another audit does not count', () => {
        window.state.ncrs = [{ id: 7, auditId: 'other-plan', sourceChecklistId: 'cl9', sourceItemIdx: 'B-3', status: 'Closed' }];
        expect(window._prevFollowUpForNC(prevReport, plainNc)).toContain('previous record not available');
    });
});

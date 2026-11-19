// Phase 0 of AI evidence explanation (2026-11-19): an approved evidence
// statement must survive an ordinary checklist save, and the checks and the
// report must read it before the raw remark. A save rebuilt every answer from
// the screen and carried over only a hand-picked list of fields, so
// clientEvidenceStatement and _auditorConfirmed were lost on the next save.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const checklist = { id: 'cl1', name: 'PCC', clauses: [{ mainClause: 'A', title: 'Annex A', subClauses: [
    { clause: 'A.5.18', requirement: 'Access rights are reviewed.' },
    { clause: '7.5', requirement: 'Documented information is controlled.' }
] }] };

let report;
function setup(progress) {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = require('../utils.js');
    window.UTILS.escapeHtml = window.UTILS.escapeHtml || ((s) => String(s));
    report = { id: 'r1', checklistProgress: progress };
    window.state = { auditReports: [report], auditPlans: [], checklists: [checklist], clients: [], ncrs: [], cbSettings: {} };
    globalThis.state = window.state;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    loadScript('./sanitization.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    window.SupabaseClient = { db: { upsert: vi.fn(async () => ({})) } };
    window.ChecklistMerge.fetchRemote = async () => null;
    document.body.innerHTML = '<div id="tab-content"></div>';
    const progressMap = {};
    progress.forEach((p) => { progressMap[p.checklistId + '-' + p.itemIdx] = p; });
    vi.useFakeTimers();
    window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap, customItems: [] });
    vi.runAllTimers();
    vi.useRealTimers();
}

describe('a checklist save keeps what the screen does not edit', () => {
    beforeEach(() => setup([
        { checklistId: 'cl1', itemIdx: 'A-0', clause: 'A.5.18', status: 'conform', comment: 'Access review seen',
            clientEvidenceStatement: 'The Q3 2026 access review record for Active Directory was reviewed and signed off.',
            _aiGenerated: true, _auditorConfirmed: true,
            aiEvidence: { status: 'approved', explanation: 'x', inputHash: 'h1' },
            criterionSuggestedRef: 'A.5.18', caDueDate: '2027-02-15',
            evidenceThumbs: ['data:old-thumb'], kbMatch: { title: 'old' } },
        { checklistId: 'cl1', itemIdx: 'A-1', clause: '7.5', status: 'nc', ncrType: 'minor', comment: 'Change requests missing' }
    ]));

    it('approved statement, AI sign-off, AI explanation, suggested criterion and due date survive', () => {
        window.saveChecklist('r1', { quiet: true });
        const a = report.checklistProgress.find((p) => p.itemIdx === 'A-0');
        expect(a.clientEvidenceStatement).toBe('The Q3 2026 access review record for Active Directory was reviewed and signed off.');
        expect(a._auditorConfirmed).toBe(true);
        expect(a.aiEvidence).toEqual({ status: 'approved', explanation: 'x', inputHash: 'h1' });
        expect(a.criterionSuggestedRef).toBe('A.5.18');
        expect(a.caDueDate).toBe('2027-02-15');
        // What the screen owns still comes from the screen.
        expect(a.comment).toBe('Access review seen');
        expect(a.status).toBe('conform');
    });

    it('report-time copies of the screenshots are never kept', () => {
        window.saveChecklist('r1', { quiet: true });
        const a = report.checklistProgress.find((p) => p.itemIdx === 'A-0');
        expect(a.evidenceThumbs).toBeUndefined();
        expect(a.kbMatch).toBeUndefined();
    });

    it('a field the screen clears stays cleared', () => {
        document.getElementById('status-cl1-A-1').value = 'conform';
        window.saveChecklist('r1', { quiet: true });
        const b = report.checklistProgress.find((p) => p.itemIdx === 'A-1');
        expect(b.status).toBe('conform');
        expect(b.ncrType).toBe('');
    });
});

describe('checks and report read the approved statement first', () => {
    it('E1 is not raised for a raw remark once an approved statement replaces it', () => {
        loadScript('./report-integrity.js', { params: { module: undefined } });
        const mk = (extra) => ({ id: 'r1', checklistProgress: [Object.assign({ checklistId: 'cl1', itemIdx: 'A-0', clause: 'A.5.18', status: 'conform', comment: 'check access review' }, extra)] });
        const e1 = (r) => window.ReportIntegrity.check({ report: r, auditPlan: { id: 'p1', auditType: 'Recertification' }, client: {} }).editorial.filter((e) => /^E1-/.test(e.id));
        expect(e1(mk({}))).toHaveLength(1);
        expect(e1(mk({ clientEvidenceStatement: 'The quarterly access review record was reviewed.' }))).toHaveLength(0);
    });

    it('Fix findings does not list a remark that an approved statement replaces', () => {
        setup([{ checklistId: 'cl1', itemIdx: 'A-0', clause: 'A.5.18', status: 'conform', comment: 'check access review', clientEvidenceStatement: 'The quarterly access review record was reviewed.' }]);
        loadScript('./report-integrity.js', { params: { module: undefined } });
        loadScript('./fix-findings.js', { params: { module: undefined } });
        expect(window.FixFindings.collect(report)).toHaveLength(0);
    });

    it('the conformance table prints the approved statement, preview and PDF', () => {
        const fs = require('fs');
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        const conformRows = src.split('\n').filter((l) => />Conform<\/span><\/td>/.test(l));
        expect(conformRows.length).toBeGreaterThanOrEqual(2);
        conformRows.forEach((l) => expect(l).toContain('fmtRemark(item.clientEvidenceStatement || item.comment)'));
    });
});

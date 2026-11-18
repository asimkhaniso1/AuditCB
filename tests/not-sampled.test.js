// "Not sampled" (PC Connection recert, 2026-11-18): Annex A is audited by
// risk-based sample, so most controls on the agenda are deliberately not
// examined. There was no way to record that, and a blank answer printed as
// "Conforming" in the report's Requirements Matrix. A question marked Not
// sampled is a decision (not pending) but never assessed, audited, sampled or
// conforming in any figure.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed', FINALIZED: 'Finalized' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const checklist = { id: 'cl1', name: 'PCC', clauses: [{ mainClause: 'A', title: 'Annex A', subClauses: [
    { clause: 'A.7.1', requirement: 'Physical security perimeters.' },
    { clause: 'A.7.2', requirement: 'Physical entry.' },
    { clause: 'A.5.29', requirement: 'Information security during disruption.' }
] }] };

function base() {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), getPlanRef: () => 'PLN-1' };
    window.state = { auditReports: [], auditPlans: [], checklists: [], clients: [], ncrs: [], cbSettings: {} };
    globalThis.state = window.state;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
}

describe('the checklist', () => {
    let report;
    beforeEach(() => {
        base();
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
        window.ChecklistAutoSave = { schedule: vi.fn(), bind: vi.fn(), flush: vi.fn(), isPending: () => false };
        window.saveChecklist = vi.fn();
        window.showNotification = vi.fn();
        const progress = [{ checklistId: 'cl1', itemIdx: 'A-2', status: 'conform', comment: 'Tested.' }];
        report = { id: 'r1', checklistProgress: progress };
        document.body.innerHTML = '<div id="tab-content"></div>';
        vi.useFakeTimers();
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: { 'cl1-A-2': progress[0] }, customItems: [] });
        vi.runAllTimers();
        vi.useRealTimers();
        window.ChecklistAutoSave = { schedule: vi.fn(), bind: vi.fn(), flush: vi.fn(), isPending: () => false };
        window.saveChecklist = vi.fn();
    });

    it('each question has a Not sampled button that records the status', () => {
        const btn = document.querySelector('#row-cl1-A-0 .btn-ns');
        expect(btn.getAttribute('data-status')).toBe('not_sampled');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('status-cl1-A-0').value).toBe('not_sampled');
        expect(btn.classList.contains('active')).toBe(true);
        expect(window.ChecklistAutoSave.schedule).toHaveBeenCalled();
    });

    it('the bulk action marks only unanswered questions and never overwrites a result', () => {
        document.querySelectorAll('.checklist-item').forEach(r => r.classList.add('selected-item'));
        window.bulkUpdateStatus('r1', 'not_sampled');
        expect(document.getElementById('status-cl1-A-0').value).toBe('not_sampled');
        expect(document.getElementById('status-cl1-A-1').value).toBe('not_sampled');
        expect(document.getElementById('status-cl1-A-2').value).toBe('conform');
        expect(window.showNotification).toHaveBeenCalledWith('Updated 2 item(s) to Not sampled (1 already answered, left as they were)', 'success');
    });

    it('asks before marking every shown question when none are selected', () => {
        window.confirm = vi.fn(() => false);
        window.bulkUpdateStatus('r1', 'not_sampled');
        expect(window.confirm).toHaveBeenCalledWith('Mark 2 unanswered questions as Not sampled?');
        expect(document.getElementById('status-cl1-A-0').value).toBe('');
    });

    it('the bulk menu offers it', () => {
        expect(document.querySelector('.bulk-action-btn[data-action="not_sampled"]')).not.toBeNull();
    });
});

describe('report figures', () => {
    beforeEach(() => { base(); });

    it('ReportStats keeps it out of coverage and conformity, and says why', () => {
        loadScript('./report-stats.js', { params: { module: undefined } });
        const ds = window.ReportStats.build({ report: { checklistProgress: [] }, hydratedProgress: [
            { clause: 'A.7.1', status: 'not_sampled', comment: 'Risk-based sample' },
            { clause: 'A.7.2', status: '' },
            { clause: 'A.5.29', status: 'conform' }
        ] });
        expect(ds.resultCounts.notAssessed).toBe(2);
        expect(ds.resultCounts.conform).toBe(1);
        expect(ds.notSampled).toBe(1);
        expect(ds.conformityPct).toBe(100);
        expect(ds.coveragePct).toBe(33);
        expect(ds.reconciliation.find(r => r.code === 'coverage_gap').message).toMatch(/1 marked not sampled under risk-based sampling/);
    });

    it('the Requirements Matrix shows a blank or not-sampled answer as Not sampled, never Conforming', () => {
        window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };
        window.ReportStats = { formatCriterion: (f) => ({ label: (f && f.clause) || '', isInternal: false, real: null, internalRef: null }) };
        loadScript('./report-findings-ops.js', { params: { module: undefined } });
        const sec = window.ReportFindingsOps.sections({ hydratedProgress: [
            { clause: 'A.7.1', status: '' },
            { clause: 'A.7.2', status: 'not_sampled' },
            { clause: 'A.5.29', status: 'conform' }
        ] }).find(s => s.key === 'reqMatrix');
        const rows = Array.from(new DOMParser().parseFromString('<table>' + sec.bodyHtml + '</table>', 'text/html').querySelectorAll('tr'))
            .map(r => r.textContent.replace(/\s+/g, ' ').trim()).filter(t => /^A\./.test(t));
        expect(rows.find(r => r.startsWith('A.7.1'))).toMatch(/Not sampled/);
        expect(rows.find(r => r.startsWith('A.7.1'))).not.toMatch(/Conforming/);
        expect(rows.find(r => r.startsWith('A.7.2'))).toMatch(/Not sampled/);
        expect(rows.find(r => r.startsWith('A.5.29'))).toMatch(/Conforming/);
    });

    it('the coverage matrix counts it as neither audited nor sampled', () => {
        window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };
        loadScript('./report-stats.js', { params: { module: undefined } });
        loadScript('./report-operational.js', { params: { module: undefined } });
        const sec = window.ReportOperational.sections({ report: {}, hydratedProgress: [
            { clause: 'A.7.1', status: 'not_sampled', comment: 'Risk-based sample', department: 'Facilities' },
            { clause: 'A.7.2', status: 'conform', comment: 'Badge log seen', department: 'Facilities' }
        ] }).find(s => s.key === 'opsCoverage');
        const row = Array.from(new DOMParser().parseFromString('<table>' + sec.bodyHtml + '</table>', 'text/html').querySelectorAll('tr'))
            .find(r => r.textContent.includes('Facilities'));
        const cells = Array.from(row.cells).map(c => c.textContent.trim());
        expect(cells[1]).toBe('2/2');
        expect(cells[2]).toBe('1');
        expect(cells[3]).toBe('1');
    });
});

describe('the completed checklist print', () => {
    it('prints Not sampled and counts it apart from assessed', async () => {
        base();
        const DF = require('../doc-format.js'); const PS = require('../print-shell.js');
        window.DocFormat = DF; window.PrintShell = PS;
        loadScript('./execution-module-v2.js', { params: { module: undefined } });
        loadScript('./findings-summary.js', { params: { module: undefined } });
        loadScript('./completed-checklist.js', { params: { module: undefined } });
        window.state = {
            auditReports: [{ id: 'r1', planId: 'p1', client: 'C', ncrs: [], checklistProgress: [
                { checklistId: 'cl1', itemIdx: 'A-0', status: 'not_sampled' },
                { checklistId: 'cl1', itemIdx: 'A-2', status: 'conform', comment: 'Seen.' }] }],
            auditPlans: [{ id: 'p1', selectedChecklists: ['cl1'] }], checklists: [checklist], clients: [], cbSettings: {}
        };
        const open = vi.spyOn(PS, 'open').mockReturnValue({});
        await window.printCompletedChecklist('r1', { screenshots: false });
        const t = DF.renderedText(open.mock.calls[0][0]).replace(/\s+/g, ' ');
        open.mockRestore();
        expect(t).toContain('A 1 A.7.1 Physical security perimeters. Not sampled');
        expect(t).toContain('1 / 3 Questions assessed');
        expect(t).toContain('1 Not sampled');
    });
});

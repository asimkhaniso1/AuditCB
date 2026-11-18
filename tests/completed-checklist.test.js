// Completed checklist print (PC Connection recert, 2026-11-18): the only
// checklist print was the blank one from the plan. This prints the audit
// record: every question as the execution view shows it, its result, the
// auditor's notes and the finding it raised, with the same references as the
// Findings tab and the findings summary.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const DF = require('../doc-format.js');
const PS = require('../print-shell.js');
const RS = require('../report-stats.js');

const checklist = {
    id: 'cl1', name: 'PCC Integrated Checklist',
    clauses: [
        { mainClause: 'IMS', title: 'Integrated management system', subClauses: [
            { clause: '4.4', requirement: 'Determine the processes needed.' },
            { clause: '9.3', requirement: 'Management review at planned intervals.' },
            { clause: '7.5', requirement: 'Control documented information.' }
        ] },
        { mainClause: 'ISMS', title: 'Information security', subClauses: [
            { clause: 'A.5.9', requirement: 'Inventory of assets.' },
            { clause: '6.1.2', requirement: 'Risk assessment process.' }
        ] }
    ]
};

function seed(planExtra, reportExtra) {
    const report = Object.assign({
        id: 'r1', planId: 'p1', clientId: 'c1', client: 'PC CONNECTION, INC.', ncrs: [],
        customItems: [{ clause: '8.1', requirement: 'Change control for the data-centre move.' }],
        checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', comment: 'No process map shown.', ncrDescription: 'Process Map missing', personnel: 'J. Smith', designation: 'IT Director', evidenceImages: ['a', 'b'] },
            { checklistId: 'cl1', itemIdx: 'IMS-1', status: 'conform', comment: 'Review held 3 March &amp; minutes seen.' },
            { checklistId: 'cl1', itemIdx: 'ISMS-0', status: 'na', comment: 'Excluded in SoA v4.' },
            { checklistId: 'cl1', itemIdx: 'ISMS-1', status: 'nc', ncrType: 'ofi', comment: 'Three risk registers.' },
            { isCustom: true, itemIdx: 0, status: 'conform', comment: 'Change record CR-118 seen.' }
        ]
    }, reportExtra || {});
    window.state = {
        auditReports: [report],
        auditPlans: [Object.assign({ id: 'p1', date: '2026-11-17', endDate: '2026-11-19', auditType: 'Recertification', auditMethod: 'Remote', lead: 'Lead Auditor A', standard: 'ISO/IEC 27001:2022', selectedChecklists: ['cl1'] }, planExtra || {})],
        checklists: [checklist], clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }], ncrs: [], cbSettings: { cbName: 'Test CB' }
    };
    globalThis.state = window.state;
    return report;
}

beforeEach(() => {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), getPlanRef: () => 'PLN-PCC-2026-01' };
    window.DocFormat = DF; window.PrintShell = PS; window.ReportStats = RS;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    loadScript('./findings-summary.js', { params: { module: undefined } });
    loadScript('./completed-checklist.js', { params: { module: undefined } });
});

const text = (html) => DF.renderedText(html).replace(/\s+/g, ' ');
function printed() {
    const open = vi.spyOn(PS, 'open').mockReturnValue({});
    window.printCompletedChecklist('r1');
    const html = open.mock.calls[0] && open.mock.calls[0][0];
    open.mockRestore();
    return html;
}

describe('completed checklist', () => {
    it('prints every question with its result and the finding it raised', () => {
        seed();
        const t = text(printed());
        expect(t).toContain('IMS 1 4.4 Determine the processes needed. NCR-001 Minor nonconformity No process map shown. Finding: Process Map missing. Interviewed: J. Smith, IT Director 2 screenshots on file');
        expect(t).toContain('IMS 2 9.3 Management review at planned intervals. Conforming Review held 3 March & minutes seen.');
        expect(t).toContain('IMS 3 7.5 Control documented information. Not assessed');
        expect(t).toContain('ISMS 1 A.5.9 Inventory of assets. Not applicable Excluded in SoA v4.');
        expect(t).toContain('OFI-001 Opportunity for improvement Three risk registers.');
        expect(t).not.toContain('&amp;');
    });

    it('includes questions added during the audit, and counts what was assessed', () => {
        seed();
        const t = text(printed());
        expect(t).toContain('Questions added during the audit');
        expect(t).toContain('8.1 Change control for the data-centre move. Conforming Change record CR-118 seen.');
        expect(t).toContain('5 / 6 Questions assessed 2 Conforming 1 Nonconformities 0 Observations 1 Opportunities for improvement 1 Not applicable');
        expect(t).toContain('Record status Audit in progress, as at');
    });

    it('follows the plan: question selection, wording overrides and the saved section order', () => {
        seed({ selectedChecklistItems: { cl1: ['IMS-0', 'IMS-1', 'ISMS-1'] }, selectedChecklistOverrides: { cl1: { 'IMS-1': 'Was the 2026 management review held?' } } },
            { clauseOrder: ['cl1-ISMS', 'cl1-IMS'] });
        const t = text(printed());
        expect(t).not.toContain('Control documented information.');
        expect(t).not.toContain('Inventory of assets.');
        expect(t).toContain('Was the 2026 management review held?');
        expect(t.indexOf('ISMS · Information security')).toBeLessThan(t.indexOf('IMS · Integrated management system'));
    });

    it('saves answers still waiting for the autosave before printing', () => {
        seed();
        const flush = vi.fn();
        window.ChecklistAutoSave = { isPending: () => true, flush };
        printed();
        expect(flush).toHaveBeenCalled();
        delete window.ChecklistAutoSave;
    });

    it('passes the print lint', () => {
        seed();
        expect(PS.lint(printed())).toEqual([]);
    });

    it('escapes recorded text', () => {
        seed(null, { checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'conform', comment: '<img src=x onerror=alert(1)>' }] });
        expect(printed()).not.toContain('<img src=x');
    });
});

describe('print buttons', () => {
    it('the Checklist and Findings tabs both offer the completed checklist', () => {
        const report = seed();
        document.body.innerHTML = '<div id="tab-content"></div>';
        window.__renderExecutionTab(report, 'ncr', { assignedChecklists: [checklist] });
        expect(document.querySelector('#tab-content [data-action="printCompletedChecklist"]').getAttribute('data-id')).toBe('r1');
        vi.useFakeTimers();
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: {}, customItems: [] });
        expect(document.querySelector('#tab-content [data-action="printCompletedChecklist"]').getAttribute('data-id')).toBe('r1');
        vi.useRealTimers();
    });
});

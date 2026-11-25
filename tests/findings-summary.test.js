// Findings summary for the closing meeting (PC Connection recert, 2026-11-18):
// there was no way to give the client the findings before the report was
// issued. The checklist printed blank, the report only after issue, and the
// Findings tab cut every description off. This document prints every finding
// with the references the tab shows, from recorded data only.
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
    id: 'cl1',
    clauses: [
        { mainClause: 'IMS', subClauses: [
            { clause: '4.4', requirement: 'Determine the processes needed for the management system and their interactions.' },
            { clause: '9.3', requirement: 'Top management shall review the management system at planned intervals.' }
        ] },
        { mainClause: 'ISMS', subClauses: [
            { clause: 'A.5.9', requirement: 'An inventory of information and other associated assets shall be developed.' },
            { clause: '6.1.1', requirement: 'Plan actions to address risks and opportunities.' }
        ] },
        { mainClause: 'RECERT', subClauses: [{ clause: 'FOCUS.2', requirement: 'Previous findings closed.' }] }
    ]
};

function seedState(extra) {
    const report = Object.assign({
        id: 'r1', planId: 'p1', clientId: 'c1', client: 'PC CONNECTION, INC.',
        ncrs: [],
        checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', comment: 'No process map was shown; interactions are described only in the IT manual.', ncrDescription: 'Process Map missing', personnel: 'J. Smith', designation: 'IT Director', evidenceImages: ['https://x/1.jpg', 'https://x/2.jpg'] },
            { checklistId: 'cl1', itemIdx: 'ISMS-0', status: 'nc', ncrType: 'minor', comment: 'Asset list omits cloud services & laptops.', ncrDescription: 'Incomplete Asset list' },
            { checklistId: 'cl1', itemIdx: 'IMS-1', status: 'nc', ncrType: 'observation', comment: 'Meeting held but no schedule exists for 2027.' },
            { checklistId: 'cl1', itemIdx: 'ISMS-1', status: 'nc', ncrType: 'ofi', ncrDescription: 'Risk assessments are kept in three registers with different scales.' },
            { checklistId: 'cl1', itemIdx: 'RECERT-0', status: 'nc', ncrType: 'observation', comment: 'Internal audit scope missed one site.' },
            { checklistId: 'cl1', itemIdx: 'IMS-2', status: 'conform', comment: 'ok' }
        ]
    }, extra || {});
    window.state = {
        auditReports: [report],
        auditPlans: [{ id: 'p1', client: 'PC CONNECTION, INC.', date: '2026-11-17', endDate: '2026-11-19', auditType: 'Recertification', auditMethod: 'Remote', lead: 'Lead Auditor A', standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018', selectedChecklists: ['cl1'] }],
        checklists: [checklist],
        clients: [{ id: 'c1', name: 'PC CONNECTION, INC.' }],
        ncrs: [],
        cbSettings: { cbName: 'Test CB' }
    };
    globalThis.state = window.state;
    return report;
}

let FS;
beforeEach(() => {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), getPlanRef: () => 'PLN-PCC-2026-01' };
    window.DocFormat = DF; window.PrintShell = PS; window.ReportStats = RS;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    loadScript('./findings-summary.js', { params: { module: undefined } });
    FS = window.FindingsSummary;
});

const text = (html) => DF.renderedText(html).replace(/\s+/g, ' ');

describe('findings summary document', () => {
    it('prints every finding with the references and grades the Findings tab shows', () => {
        seedState();
        const ctx = FS.context('r1');
        const t = text(FS.build(ctx));
        expect(ctx.findings.map(f => f._ref)).toEqual(['NC-001', 'NC-002', 'OBS-001', 'OBS-002', 'OFI-001']);
        expect(t).toContain('NC-001 Minor nonconformity');
        expect(t).toContain('OBS-002 Observation');
        expect(t).toContain('OFI-001 Opportunity for improvement');
        expect(t).toContain('Nonconformities (2)');
        expect(t).toContain('Observations (2)');
        expect(t).toContain('Opportunities for improvement (1)');
    });

    it('prints a nonconformity as requirement, objective evidence and statement, in full', () => {
        seedState();
        const t = text(FS.build(FS.context('r1')));
        expect(t).toContain('Clause 4.4 · Checklist question IMS 1 · J. Smith, IT Director');
        expect(t).toContain('Requirement Determine the processes needed for the management system and their interactions.');
        expect(t).toContain('Objective evidence No process map was shown; interactions are described only in the IT manual.');
        expect(t).toContain('Nonconformity statement Process Map missing.');
        expect(t).toContain('2 screenshots on file with the audit record.');
        // Stored text is decoded once and escaped once: no "&amp;" on paper.
        expect(t).toContain('Asset list omits cloud services & laptops.');
        expect(t).not.toContain('&amp;');
    });

    it('never shows an internal tracking reference to the client', () => {
        seedState();
        const t = text(FS.build(FS.context('r1')));
        expect(t).not.toMatch(/FOCUS\.2/);
        expect(t).toContain('Internal audit scope missed one site.');
    });

    it('says plainly when a part was not recorded, instead of filling it in', () => {
        seedState({ checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', comment: 'Seen: no map.' }] });
        const t = text(FS.build(FS.context('r1')));
        expect(t).toContain('Nonconformity statement Nonconformity statement not recorded.');
    });

    it('marks itself preliminary and carries the sign-off and response deadline', () => {
        seedState({ findingsResponseDue: '2026-12-03' });
        const t = text(FS.build(FS.context('r1')));
        expect(t).toContain('Preliminary, subject to the audit report');
        expect(t).toContain('Response due: 3 December 2026');
        expect(t).toContain('It does not mean the organisation agrees with them');
        expect(t).toContain('Lead auditor Lead Auditor A');
        expect(t).toContain('Audit dates 17–19 November 2026');
        expect(t).toContain('Recertification · Remote');
        expect(t).toContain('ISO/IEC 27001:2022');
    });

    it('never invents a day count: no date and no configured timeframe prints a blank and the CB procedure', () => {
        seedState();
        const t = text(FS.build(FS.context('r1')));
        expect(t).toContain('(agreed at the closing meeting)');
        expect(t).toContain("in accordance with the certification body's applicable corrective-action procedure");
        expect(t).not.toMatch(/\b(30|90) days\b/);
    });

    it('uses the CB-configured timeframe when there is no agreed date', () => {
        seedState();
        window.state.cbSettings.capaTimeframes = { default: { major: 30, minor: 60 } };
        const t = text(FS.build(FS.context('r1')));
        expect(t).toContain('minor nonconformities within 60 days of the closing meeting');
        expect(t).not.toContain('major nonconformities within');
    });

    it('passes the print lint (page rule, page counter, no raw entities or numeric dates)', () => {
        seedState({ findingsResponseDue: '2026-12-03' });
        expect(PS.lint(FS.build(FS.context('r1')))).toEqual([]);
    });

    it('escapes recorded text', () => {
        seedState({ checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', ncrDescription: '<img src=x onerror=alert(1)>' }] });
        const html = FS.build(FS.context('r1'));
        expect(html).not.toContain('<img src=x');
    });
});

describe('Findings tab print controls', () => {
    it('the tab and the summary number findings from the same list', () => {
        const report = seedState();
        document.body.innerHTML = '<div id="tab-content"></div>';
        window.__renderExecutionTab(report, 'ncr', { assignedChecklists: [checklist] });
        const tab = document.getElementById('tab-content');
        const refs = Array.from(tab.querySelectorAll('tbody tr')).map(r => r.cells[0].textContent.trim());
        expect(refs).toEqual(FS.context('r1').findings.map(f => f._ref));
        const btn = tab.querySelector('[data-action="printFindingsSummary"]');
        expect(btn.getAttribute('data-id')).toBe('r1');
        expect(btn.disabled).toBe(false);
        expect(tab.querySelector('#findings-response-due').getAttribute('data-action-change')).toBe('setFindingsResponseDue');
    });

    it('stores the response-due date on the report', () => {
        const report = seedState();
        window.saveData = vi.fn();
        window.showNotification = vi.fn();
        window.setFindingsResponseDue('r1', '2026-12-03');
        expect(report.findingsResponseDue).toBe('2026-12-03');
        expect(window.saveData).toHaveBeenCalled();
        window.setFindingsResponseDue('r1', '');
        expect(report.findingsResponseDue).toBe('');
    });

    it('opens the print window, and asks first when a finding has no grade', () => {
        seedState({ checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', comment: 'Unclassified' }] });
        const open = vi.spyOn(PS, 'open').mockReturnValue({});
        window.confirm = vi.fn(() => false);
        expect(window.printFindingsSummary('r1')).toBeNull();
        expect(window.confirm).toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        window.confirm = vi.fn(() => true);
        window.printFindingsSummary('r1');
        expect(open).toHaveBeenCalledTimes(1);
        expect(text(open.mock.calls[0][0])).toContain('Nonconformity (grade to be confirmed)');
        open.mockRestore();
    });
});

describe('screenshots in the findings summary', () => {
    async function print() {
        const open = vi.spyOn(PS, 'open').mockReturnValue({ placeholder: true });
        await window.printFindingsSummary('r1');
        const calls = open.mock.calls.slice();
        open.mockRestore();
        return calls;
    }
    beforeEach(() => {
        window.EvidenceUtils = { compress: vi.fn(async (src) => 'data:image/jpeg;base64,' + Buffer.from(String(src)).toString('base64')) };
        window.confirm = vi.fn(() => true);
    });

    it('prints each finding\'s screenshots under it, downscaled and captioned with the finding reference', async () => {
        seedState();
        window.state.auditReports[0].checklistProgress[0].evidenceCapturedAtList = ['2026-11-17T14:42:00Z', ''];
        const calls = await print();
        expect(calls.length).toBe(2);
        expect(calls[0][0]).toContain('Preparing the findings summary with 2 screenshots');
        expect(calls[1][1]).toEqual({ win: { placeholder: true } });
        expect(window.EvidenceUtils.compress).toHaveBeenCalledWith('https://x/1.jpg', { maxPx: 900, quality: 0.72 });
        const doc = new DOMParser().parseFromString(calls[1][0], 'text/html');
        const block = Array.from(doc.querySelectorAll('.fs-finding')).find(b => b.textContent.includes('NC-001'));
        expect(block.classList.contains('fs-has-shots')).toBe(true);
        const caps = Array.from(block.querySelectorAll('figcaption')).map(c => c.textContent);
        expect(caps).toEqual(['NC-001 · screenshot 1 of 2 · captured 17 November 2026', 'NC-001 · screenshot 2 of 2']);
        expect(Array.from(block.querySelectorAll('img')).every(i => i.getAttribute('src').startsWith('data:image/jpeg;base64,'))).toBe(true);
        // The count line is replaced by the screenshots themselves.
        expect(block.textContent).not.toContain('on file with the audit record');
        // Findings without screenshots are unchanged.
        const other = Array.from(doc.querySelectorAll('.fs-finding')).find(b => b.textContent.includes('NC-002'));
        expect(other.querySelector('figure')).toBeNull();
        expect(PS.lint(calls[1][0])).toEqual([]);
    });

    it('includes a manual finding\'s screenshot', async () => {
        seedState({ checklistProgress: [], ncrs: [{ type: 'minor', clause: '8.1', description: 'Change not assessed', evidenceImage: 'https://x/manual.jpg', status: 'Open' }] });
        const calls = await print();
        expect(calls.length).toBe(2);
        expect(window.EvidenceUtils.compress).toHaveBeenCalledWith('https://x/manual.jpg', { maxPx: 900, quality: 0.72 });
        expect(calls[1][0]).toContain('NC-001 · screenshot 1 of 1');
    });

    it('prints straight away, with no placeholder, when no finding has screenshots', async () => {
        seedState({ checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', ncrDescription: 'Gap' }] });
        const calls = await print();
        expect(calls.length).toBe(1);
        expect(calls[0][1]).toBeUndefined();
        expect(window.EvidenceUtils.compress).not.toHaveBeenCalled();
    });

    it('asks about ungraded findings before opening any window', async () => {
        seedState({ checklistProgress: [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', comment: 'x', evidenceImages: ['https://x/1.jpg'] }] });
        window.confirm = vi.fn(() => false);
        const calls = await print();
        expect(calls.length).toBe(0);
    });
});

describe('print without screenshots', () => {
    async function print(opts) {
        const open = vi.spyOn(PS, 'open').mockReturnValue({ placeholder: true });
        await window.printFindingsSummary('r1', opts);
        const calls = open.mock.calls.slice();
        open.mockRestore();
        return calls;
    }
    beforeEach(() => {
        window.EvidenceUtils = { compress: vi.fn(async (src) => 'data:image/jpeg;base64,' + Buffer.from(String(src)).toString('base64')) };
        window.confirm = vi.fn(() => true);
        try { localStorage.clear(); } catch (_e) { /* jsdom */ }
    });

    it('includes screenshots by default', async () => {
        seedState();
        expect(window.printIncludesScreenshots()).toBe(true);
        const calls = await print();
        expect(calls.length).toBe(2);
        expect(calls[1][0]).toContain('<figure');
    });

    it('unticked, prints at once with the screenshot count instead, and remembers the choice', async () => {
        seedState();
        document.body.innerHTML = '<input type="checkbox" class="print-shots-toggle" checked><input type="checkbox" class="print-shots-toggle" checked>';
        window.setPrintScreenshots(false);
        expect(Array.from(document.querySelectorAll('.print-shots-toggle')).map(b => b.checked)).toEqual([false, false]);
        expect(window.printIncludesScreenshots()).toBe(false);
        const calls = await print();
        expect(calls.length).toBe(1);
        expect(calls[0][1]).toBeUndefined();
        expect(calls[0][0]).not.toContain('<figure');
        expect(text(calls[0][0])).toContain('2 screenshots on file with the audit record.');
        expect(window.EvidenceUtils.compress).not.toHaveBeenCalled();
        window.setPrintScreenshots(true);
        expect(window.printIncludesScreenshots()).toBe(true);
    });

    it('applies to the completed checklist as well', async () => {
        seedState();
        loadScript('./completed-checklist.js', { params: { module: undefined } });
        window.setPrintScreenshots(false);
        const open = vi.spyOn(PS, 'open').mockReturnValue({});
        await window.printCompletedChecklist('r1');
        expect(open).toHaveBeenCalledTimes(1);
        expect(open.mock.calls[0][0]).not.toContain('<figure');
        expect(text(open.mock.calls[0][0])).toContain('2 screenshots on file');
        open.mockRestore();
    });

    it('an explicit option overrides the remembered choice', async () => {
        seedState();
        window.setPrintScreenshots(false);
        const calls = await print({ screenshots: true });
        expect(calls.length).toBe(2);
    });

    it('the Checklist toolbar box changes the choice through the event delegator', () => {
        const report = seedState();
        window.setPrintScreenshots(true);
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="tab-content"></div>';
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: {}, customItems: [] });
        vi.useRealTimers();
        loadScript('./event-delegator.js', { params: { module: undefined } });
        const box = document.querySelector('#tab-content .print-shots-toggle');
        expect(box.checked).toBe(true);
        box.checked = false;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        expect(window.printIncludesScreenshots()).toBe(false);
        window.setPrintScreenshots(true);
    });

    it('shows the box beside the print buttons, reflecting the choice', () => {
        const report = seedState();
        window.setPrintScreenshots(false);
        document.body.innerHTML = '<div id="tab-content"></div>';
        window.__renderExecutionTab(report, 'ncr', { assignedChecklists: [checklist] });
        const box = document.querySelector('#tab-content .print-shots-toggle');
        expect(box.checked).toBe(false);
        expect(box.getAttribute('data-action-change')).toBe('setPrintScreenshots');
        expect(box.getAttribute('data-arg1')).toBe('this.checked');
        window.setPrintScreenshots(true);
    });
});

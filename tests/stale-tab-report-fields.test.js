// A tab opened before a change saved elsewhere must not write its old copy of
// the report back (PC Connection, 24 Nov 2026). The CAR deadline (11 Dec 2026)
// and headcount were set on the server while the auditor had the Execution
// page open from earlier; Finalize from that tab would have saved its whole
// old report over them: conclusion, closing summary, opening notes. Every save
// writes the whole report, so a save now first takes the server's newer value
// for each report field this tab has not changed, and Finalize waits for it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', FINALIZED: 'Finalized' },
    NCR_TYPES: { PENDING: 'pending', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const checklist = { id: 'cl1', name: 'Checklist', clauses: [
    { mainClause: 'IMS', title: 'Common', subClauses: [{ clause: '9.2', requirement: 'Internal audit' }] }
] };
const items = () => [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: 'nc', ncrType: 'minor', ncrDescription: 'BCMS not audited', comment: 'Audit summary' }];
const OLD = {
    conclusion: 'Recertification is recommended, subject to plans due by 15 February 2027.',
    closingMeeting: { date: '2026-11-19', summary: 'Plans by 15 February 2027 was explained.', attendees: [{ name: 'S. Johnston' }] },
    openingMeeting: { date: '2026-11-17', notes: 'Current no of emplyees required. ' },
    executiveSummary: 'Old summary'
};
// The server after the edit made elsewhere, as Postgres returns it (keys reordered).
const serverNow = () => ({
    id: 'r1', status: 'In Progress', client: 'PC CONNECTION, INC.', planId: 'p1', date: '2026-11-17',
    executiveSummary: 'Old summary',
    conclusion: 'Recertification is recommended, subject to plans due by 11 December 2026.',
    closingMeeting: { summary: 'Plans by 11 December 2026 was agreed.', date: '2026-11-19', attendees: [{ name: 'S. Johnston' }] },
    openingMeeting: { notes: 'Current number of employees: 50.', date: '2026-11-17' },
    checklistProgress: items(), checklistRevisions: [{ rev: 1 }]
});

let report, upserts, updates, remoteRow;
function setup() {
    vi.useFakeTimers();
    report = Object.assign({ id: 'r1', planId: 'p1', client: 'PC CONNECTION, INC.', date: '2026-11-17', status: 'In Progress', checklistProgress: items(), checklistRevisions: [{ rev: 1 }] }, JSON.parse(JSON.stringify(OLD)));
    window.state = { auditReports: [report], ncrs: [], clients: [], auditPlans: [], currentUser: { role: 'Lead Auditor', name: 'Lead' } };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '') };
    globalThis.Sanitizer = window.Sanitizer = { sanitizeText: s => String(s ?? '') };
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    upserts = []; updates = [];
    remoteRow = null;
    window.SupabaseClient = {
        db: {
            upsert: vi.fn(async (table, row) => { upserts.push(JSON.parse(JSON.stringify(row))); }),
            update: vi.fn(async (table, id, row) => { updates.push(JSON.parse(JSON.stringify(row))); })
        },
        client: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: remoteRow, error: null }) }) }) }) }
    };
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div id="tab-content"></div>';
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    // The tab draws the report as it holds it: the old copy.
    const map = {}; report.checklistProgress.forEach(p => { map[p.checklistId + '-' + p.itemIdx] = p; });
    window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: map });
    vi.advanceTimersByTime(200);
    // Then the change is saved elsewhere.
    const s = serverNow();
    remoteRow = { checklist_progress: s.checklistProgress, revisions: s.checklistRevisions, data: s };
}
afterEach(() => { vi.useRealTimers(); delete window.SupabaseClient; });

describe('ChecklistMerge.mergeFields', () => {
    beforeEach(() => setup());
    const M = () => window.ChecklistMerge;

    it('takes the newer saved value for every field this tab has not changed', () => {
        const local = { id: 'x', conclusion: 'A', closingMeeting: { date: 'd', summary: 'old' } };
        M().noteServerFields('x', local);
        const taken = M().mergeFields('x', local, { id: 'x', conclusion: 'B', closingMeeting: { summary: 'new', date: 'd' }, effLegal: 'Reviewed' });
        expect(local).toEqual({ id: 'x', conclusion: 'B', closingMeeting: { date: 'd', summary: 'new' }, effLegal: 'Reviewed' });
        expect(taken.sort()).toEqual(['closingMeeting.summary', 'conclusion', 'effLegal']);
    });

    it('keeps a field this tab changed, and merges objects key by key', () => {
        const local = { id: 'x', conclusion: 'A', closingMeeting: { date: 'd', summary: 'old', time: '10:00' } };
        M().noteServerFields('x', local);
        local.conclusion = 'Mine';
        local.closingMeeting.summary = 'Mine too';
        M().mergeFields('x', local, { id: 'x', conclusion: 'Theirs', closingMeeting: { date: 'd', summary: 'Theirs too', time: '11:45' } });
        expect(local.conclusion).toBe('Mine');
        expect(local.closingMeeting).toEqual({ date: 'd', summary: 'Mine too', time: '11:45' });
    });

    it('leaves the report alone when the tab has no record of what it loaded', () => {
        const local = { id: 'y', conclusion: 'A' };
        expect(M().mergeFields('y', local, { id: 'y', conclusion: 'B' })).toEqual([]);
        expect(local.conclusion).toBe('A');
    });

    it('does not count stored key order as a change', () => {
        const local = { id: 'z', closingMeeting: { date: 'd', summary: 's' } };
        M().noteServerFields('z', local);
        expect(M().mergeFields('z', local, { id: 'z', closingMeeting: { summary: 's', date: 'd' } })).toEqual([]);
    });
});

describe('saving from a tab opened before the change', () => {
    beforeEach(() => setup());

    it('writes the newer conclusion, meetings and notes, not the old copy', async () => {
        await window.saveChecklist('r1', { quiet: true });
        const row = upserts[upserts.length - 1];
        expect(row.data.conclusion).toContain('11 December 2026');
        expect(row.data.closingMeeting.summary).toBe('Plans by 11 December 2026 was agreed.');
        expect(row.closing_meeting.summary).toBe('Plans by 11 December 2026 was agreed.');
        expect(row.opening_meeting.notes).toBe('Current number of employees: 50.');
        expect(row.data.closingMeeting.attendees).toEqual([{ name: 'S. Johnston' }]);
    });

    it('still saves what was changed in this tab', async () => {
        report.executiveSummary = 'Summary written in this tab';
        await window.saveChecklist('r1', { quiet: true });
        const row = upserts[upserts.length - 1];
        expect(row.data.executiveSummary).toBe('Summary written in this tab');
        expect(row.data.conclusion).toContain('11 December 2026');
    });

    it('Finalize waits for that save, then issues the newer report', async () => {
        loadScript('./ai-service.js', { params: { module: undefined } });
        window.DataService = { findAuditReport: (id) => window.state.auditReports.find(r => String(r.id) === String(id)) };
        window.computeIssuanceGate = () => ({ report, stats: null, integrity: null, gateBlockers: [], gateWarnings: [] });
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
        await window.finalizeAndPublish('r1');
        await vi.waitFor(() => expect(updates).toHaveLength(1));
        const issued = updates[0].data;
        expect(issued.reportStatus).toBe('final');
        expect(issued.conclusion).toContain('11 December 2026');
        expect(issued.openingMeeting.notes).toBe('Current number of employees: 50.');
        expect(issued.closingMeeting.summary).toBe('Plans by 11 December 2026 was agreed.');
        // The save it waited for ran first.
        expect(upserts.length).toBeGreaterThan(0);
        confirmSpy.mockRestore();
    });
});

// Stale checklist view must not overwrite newer answers (PC Connection,
// 2026-11-18). saveChecklist rebuilt the whole checklist from the inputs on
// screen. A tab drawn at 13:25 UTC on Day 1 stayed open; its memory caught up
// through sync but its screen did not, and when the laptop woke the next
// morning its pending autosave wrote the near-empty screen over the whole day's
// work. A save now merges per question and per field: what was changed on this
// screen wins, everything else keeps the newer saved value.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na' },
    NCR_TYPES: { PENDING: 'pending', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};
const checklist = { id: 'cl1', name: 'Checklist', clauses: [
    { mainClause: 'IMS', title: 'Common', subClauses: [{ clause: '7.5', requirement: 'Documented information' }, { clause: '9.2', requirement: 'Internal audit' }] }
] };
const dayOne = () => [
    { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'conform', comment: 'Document control procedure sighted', evidenceImages: ['https://x/ims-0.jpg'], evidenceImage: 'https://x/ims-0.jpg', personnel: 'Jim Etchison' },
    { checklistId: 'cl1', itemIdx: 'IMS-1', status: 'nc', ncrType: 'minor', ncrDescription: 'No 2026 audit programme', comment: '' }
];
const revs = (n) => Array.from({ length: n }, (_, i) => ({ rev: i + 1, timestamp: '2026-11-17T15:00:00Z' }));

let report, upserts, remote, notes;
function setup({ drawnFrom = [], drawnRevs = 0 } = {}) {
    vi.useFakeTimers();
    report = { id: 'r1', planId: 'p1', client: 'PC CONNECTION, INC.', date: '2026-11-17', checklistProgress: drawnFrom, checklistRevisions: revs(drawnRevs) };
    window.state = { auditReports: [report], ncrs: [], clients: [], auditPlans: [], currentUser: { role: 'Lead Auditor' } };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
    globalThis.Sanitizer = window.Sanitizer = { sanitizeText: s => String(s ?? '') };
    notes = [];
    window.showNotification = (msg, type) => notes.push([type, msg]);
    window.saveData = vi.fn();
    upserts = [];
    remote = null;
    window.SupabaseClient = {
        db: { upsert: vi.fn(async (table, row) => { upserts.push(JSON.parse(JSON.stringify(row))); }) },
        client: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: remote, error: null }) }) }) }) }
    };
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div id="tab-content"></div>';
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    // The page-open progress map is passed in, as execution-list.js does.
    const openingMap = {};
    drawnFrom.forEach(p => { openingMap[p.checklistId + '-' + p.itemIdx] = p; });
    window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: openingMap });
    vi.advanceTimersByTime(200);
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const saved = () => upserts[upserts.length - 1];
const item = (row, idx) => row.checklist_progress.find(p => p.itemIdx === idx);
afterEach(() => { vi.useRealTimers(); delete window.SupabaseClient; });

describe('ChecklistMerge.merge', () => {
    beforeEach(() => setup());
    const M = () => window.ChecklistMerge;

    it('a question untouched on screen takes the newer saved answer', () => {
        const mine = [{ checklistId: 'cl1', itemIdx: 'IMS-0', status: '', comment: '', evidenceImages: [] }];
        const r = M().merge([], mine, dayOne());
        expect(r.items[0]).toMatchObject({ status: 'conform', comment: 'Document control procedure sighted', personnel: 'Jim Etchison', evidenceImages: ['https://x/ims-0.jpg'] });
        expect(r.items).toHaveLength(2); // the saved question not on screen is kept too
        expect(r.kept).toBe(2);
    });

    it('per field: a remark typed on the stale screen keeps the saved status and NC details', () => {
        const mine = [{ checklistId: 'cl1', itemIdx: 'IMS-1', status: '', ncrType: '', comment: 'check competency matrix', evidenceImages: [] }];
        const r = M().merge([], mine, dayOne());
        expect(r.items[0]).toMatchObject({ status: 'nc', ncrType: 'minor', ncrDescription: 'No 2026 audit programme', comment: 'check competency matrix' });
    });

    it('a value changed on screen wins over the saved one', () => {
        const base = dayOne();
        const mine = [Object.assign({}, base[0], { status: 'nc', ncrType: 'minor' })];
        const theirs = [Object.assign({}, base[0], { comment: 'edited elsewhere' })];
        const r = M().merge(base, mine, theirs);
        expect(r.items[0]).toMatchObject({ status: 'nc', ncrType: 'minor', comment: 'edited elsewhere' });
    });
});

describe('saveChecklist from a stale view', () => {
    it('replays 2026-11-18: memory synced, screen old — Day 1 is kept, the new remark is added', async () => {
        setup(); // drawn when the checklist was still empty
        Object.assign(report, { checklistProgress: dayOne(), checklistRevisions: revs(164) }); // Day 1 synced in
        remote = { checklist_progress: dayOne(), revisions: revs(164) };
        const remark = document.getElementById('comment-cl1-IMS-1');
        remark.value = 'check competency matrix';
        window.saveChecklist('r1', { quiet: true });
        await flush();
        const row = saved();
        expect(item(row, 'IMS-0')).toMatchObject({ status: 'conform', comment: 'Document control procedure sighted', personnel: 'Jim Etchison', evidenceImages: ['https://x/ims-0.jpg'] });
        expect(item(row, 'IMS-1')).toMatchObject({ status: 'nc', ncrType: 'minor', ncrDescription: 'No 2026 audit programme', comment: 'check competency matrix' });
        expect(row.data.checklistRevisions).toHaveLength(165);
        expect(notes.some(([t, m]) => t === 'warning' && /also saved in another tab/.test(m))).toBe(true);
    });

    it('memory stale too: the cloud copy is newer, so the save merges with it', async () => {
        setup();
        remote = { checklist_progress: dayOne(), revisions: revs(164) };
        window.setChecklistStatus('cl1-IMS-0', 'na');
        window.saveChecklist('r1', { quiet: true });
        await flush();
        const row = saved();
        expect(item(row, 'IMS-0').status).toBe('na');               // changed here
        expect(item(row, 'IMS-0').comment).toBe('Document control procedure sighted');
        expect(item(row, 'IMS-1')).toMatchObject({ status: 'nc', ncrType: 'minor' }); // kept from the cloud
        expect(row.data.checklistRevisions).toHaveLength(165);
    });

    it('a current view saves its screen as before, with no warning', async () => {
        setup({ drawnFrom: dayOne(), drawnRevs: 3 });
        remote = { checklist_progress: dayOne(), revisions: revs(3) };
        window.setChecklistStatus('cl1-IMS-1', 'conform');
        window.saveChecklist('r1', { quiet: true });
        await flush();
        expect(item(saved(), 'IMS-1')).toMatchObject({ status: 'conform', ncrType: '' });
        expect(item(saved(), 'IMS-0').comment).toBe('Document control procedure sighted');
        expect(notes.filter(([t]) => t === 'warning')).toHaveLength(0);
        // The next save from the same view is not mistaken for a stale one.
        remote = { checklist_progress: saved().checklist_progress, revisions: saved().data.checklistRevisions };
        window.saveChecklist('r1', { quiet: true });
        await flush();
        expect(notes.filter(([t]) => t === 'warning')).toHaveLength(0);
    });
});

describe('the checklist is drawn from the live report', () => {
    it('re-opening the checklist shows answers saved since the page opened', () => {
        setup();
        Object.assign(report, { checklistProgress: dayOne(), checklistRevisions: revs(5) });
        // execution-list.js passes the progress map built at page open (empty).
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [checklist], progressMap: {} });
        expect(document.getElementById('comment-cl1-IMS-0').value).toBe('Document control procedure sighted');
        expect(document.getElementById('status-cl1-IMS-1').value).toBe('nc');
        expect(window.ChecklistMerge.getBase('r1').revs).toBe(5);
    });
});

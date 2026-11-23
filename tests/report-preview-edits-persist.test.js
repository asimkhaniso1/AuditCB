// PC Connection, 23 Nov 2026: text typed into Report Preview (effectiveness
// rows, conclusion, changes since last audit, previous findings status) was
// read only by an export from that open preview and never saved, so closing
// the preview lost it and Report Integrity kept warning about blank fields.
// The first fix saved through saveChecklist/saveData, which do not reach the
// server when the preview is opened from the Plans page. Each box now writes
// its own field to the stored report when the auditor leaves a box they changed.
//
// execution-reporting.js is too DOM-dependent to load whole here (see
// tests/previous-findings-status.test.js), so the block is lifted from the
// source and run against a small DOM.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const BLOCK = (() => {
    const start = SRC.indexOf('// ─── Report Preview edits are saved to the report');
    const end = SRC.indexOf('// ─── Previous Findings Status default');
    if (start < 0 || end < 0) throw new Error('preview-edit block not found in execution-reporting.js');
    return SRC.slice(start, end);
})();

globalThis.window = globalThis.window || globalThis;

let report, server, updates, failWrites;
function load() {
    delete window.__previewEditsBound;
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', BLOCK)(window, document);
}

// A stand-in for the audit_reports row: select('data') and update(patch).
function fakeSupabase() {
    const tick = () => new Promise((r) => setTimeout(r, 5));
    return {
        from(table) {
            expect(table).toBe('audit_reports');
            return {
                select() {
                    return { eq() { return { async maybeSingle() { await tick(); return { data: { data: JSON.parse(JSON.stringify(server.data)) }, error: null }; } }; } };
                },
                update(patch) {
                    return {
                        async eq(col, id) {
                            await tick();
                            if (failWrites) return { error: { message: 'offline' } };
                            updates.push({ id, patch: JSON.parse(JSON.stringify(patch)) });
                            Object.assign(server, patch);
                            return { error: null };
                        }
                    };
                }
            };
        }
    };
}

// jsdom has no layout, so innerText is not implemented; use textContent.
function box(id, text) {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'rp-edit';
    el.setAttribute('contenteditable', 'true');
    el.textContent = text;
    Object.defineProperty(el, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; } });
    document.body.appendChild(el);
    return el;
}
const edit = (el, text) => {
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    el.textContent = text;
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
};
const settle = () => vi.waitFor(() => expect(window.showNotification).toHaveBeenCalled());

beforeEach(() => {
    document.body.innerHTML = '';
    report = { id: 'r1', closingMeeting: { date: '2026-11-19' } };
    // What the server holds, including work saved from another tab.
    server = { data: { id: 'r1', closingMeeting: { date: '2026-11-19' }, checklistProgress: [{ itemIdx: 'A-0', comment: 'saved in another tab' }] } };
    updates = [];
    failWrites = false;
    window.state = { auditReports: [report] };
    window._reportPreviewData = { report: Object.assign({}, report) };
    window.Sanitizer = { sanitizeText: (s) => String(s).replace(/&/g, '&amp;') };
    window.SupabaseClient = { client: fakeSupabase() };
    window.saveChecklist = vi.fn();
    window.saveData = vi.fn();
    window.showNotification = vi.fn();
    load();
});

describe('Report Preview edits', () => {
    it('writes an edited effectiveness row to the stored report, without saveChecklist (Plans page)', async () => {
        delete window.saveChecklist;
        edit(box('rp-eff-internal-audit', 'Not assessed during this audit.'), 'Implemented; 1 minor nonconformity identified (NCR-091).');
        expect(report.effInternalAudit).toBe('Implemented; 1 minor nonconformity identified (NCR-091).');
        expect(window._reportPreviewData.report.effInternalAudit).toBe(report.effInternalAudit);
        await settle();
        expect(server.data.effInternalAudit).toBe('Implemented; 1 minor nonconformity identified (NCR-091).');
        expect(window.showNotification).toHaveBeenCalledWith('Saved to the report.', 'success');
    });

    it('changes only that field: work saved meanwhile in another tab is kept', async () => {
        edit(box('rp-changes', ''), 'A new supplier has been added.');
        await settle();
        expect(server.data.changesSinceLastAudit).toBe('A new supplier has been added.');
        expect(server.data.checklistProgress[0].comment).toBe('saved in another tab');
    });

    it('several boxes left in quick succession all reach the server', async () => {
        edit(box('rp-conclusion', 'Click to edit this conclusion.'), 'Recertification is recommended.');
        edit(box('rp-changes', 'No significant changes.'), 'A new supplier has been added.');
        edit(box('rp-prev-findings', ''), 'NCR-085 remains open.');
        await vi.waitFor(() => expect(updates).toHaveLength(3));
        expect(server.data.conclusion).toBe('Recertification is recommended.');
        expect(server.conclusion).toBe('Recertification is recommended.');
        expect(server.data.changesSinceLastAudit).toBe('A new supplier has been added.');
        expect(server.data.previousFindingsStatus).toBe('NCR-085 remains open.');
    });

    it('writes the closing summary inside closingMeeting and its own column, keeping its other fields', async () => {
        edit(box('rp-closing-summary', ''), 'The organization accepted the findings.');
        await settle();
        expect(server.data.closingMeeting).toEqual({ date: '2026-11-19', summary: 'The organization accepted the findings.' });
        expect(server.closing_meeting).toEqual(server.data.closingMeeting);
        expect(report.closingMeeting).toEqual({ date: '2026-11-19', summary: 'The organization accepted the findings.' });
    });

    it('stores text the same way the other screens do (entity-encoded)', async () => {
        edit(box('rp-changes', ''), 'SharePoint & Intellex');
        await settle();
        expect(server.data.changesSinceLastAudit).toBe('SharePoint &amp; Intellex');
    });

    it('says so when the server write fails, and retries on the next exit from the box', async () => {
        failWrites = true;
        const el = box('rp-eff-legal', '');
        edit(el, 'Reviewed; no nonconformity was raised.');
        await settle();
        expect(window.showNotification).toHaveBeenCalledWith(expect.stringMatching(/Not saved/), 'error');
        failWrites = false;
        window.showNotification.mockClear();
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await settle();
        expect(server.data.effLegal).toBe('Reviewed; no nonconformity was raised.');
    });

    it('never stores a box the auditor only clicked into: an untouched default stays a default', async () => {
        const el = box('rp-eff-marks', 'Usage verified as conforming to CB rules.');
        el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 30));
        expect('effMarks' in report).toBe(false);
        expect(updates).toHaveLength(0);
    });

    it('keeps the Review & Submit box for the same text in step', async () => {
        const ta = document.createElement('textarea');
        ta.id = 'exec-summary-r1';
        ta.defaultValue = 'Old AI summary';
        document.body.appendChild(ta);
        edit(box('rp-exec-summary', 'Old AI summary'), 'The audit identified 5 minor nonconformities.');
        expect(ta.value).toBe('The audit identified 5 minor nonconformities.');
        expect(ta.defaultValue).toBe('The audit identified 5 minor nonconformities.');
        await settle();
        expect(server.data.executiveSummary).toBe('The audit identified 5 minor nonconformities.');
    });

    it('ignores editable boxes that are not report fields (e.g. the distribution list)', async () => {
        edit(box('rp-distribution', 'x'), 'y');
        await new Promise((r) => setTimeout(r, 30));
        expect(updates).toHaveLength(0);
    });
});

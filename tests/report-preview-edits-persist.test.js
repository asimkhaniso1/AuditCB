// PC Connection, 23 Nov 2026: text typed into Report Preview (effectiveness
// rows, conclusion, changes since last audit, previous findings status) was
// read only by an export from that open preview and never saved, so closing
// the preview lost it and Report Integrity kept warning about blank fields.
// The preview boxes now save to their report fields when the auditor leaves a
// box they changed.
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

let report;
function load() {
    delete window.__previewEditsBound;
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', BLOCK)(window, document);
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

beforeEach(() => {
    document.body.innerHTML = '';
    report = { id: 'r1', closingMeeting: { date: '2026-11-19' } };
    window.state = { auditReports: [report] };
    window._reportPreviewData = { report: Object.assign({}, report) };
    window.Sanitizer = { sanitizeText: (s) => String(s).replace(/&/g, '&amp;') };
    window.saveChecklist = vi.fn();
    window.saveData = vi.fn();
    window.showNotification = vi.fn();
    load();
});

describe('Report Preview edits', () => {
    it('saves an edited effectiveness row to the report and the open preview, then saves the report', () => {
        const el = box('rp-eff-internal-audit', 'Not assessed during this audit.');
        edit(el, 'Implemented; 1 minor nonconformity identified (NCR-091).');
        expect(report.effInternalAudit).toBe('Implemented; 1 minor nonconformity identified (NCR-091).');
        expect(window._reportPreviewData.report.effInternalAudit).toBe(report.effInternalAudit);
        expect(window.saveChecklist).toHaveBeenCalledWith('r1', { quiet: true });
    });

    it('saves the conclusion, changes and previous findings status', () => {
        edit(box('rp-conclusion', 'Click to edit this conclusion.'), 'Recertification is recommended.');
        edit(box('rp-changes', 'No significant changes.'), 'A new supplier has been added.');
        edit(box('rp-prev-findings', ''), 'NCR-085 remains open.');
        expect(report.conclusion).toBe('Recertification is recommended.');
        expect(report.changesSinceLastAudit).toBe('A new supplier has been added.');
        expect(report.previousFindingsStatus).toBe('NCR-085 remains open.');
    });

    it('writes the closing summary inside closingMeeting, keeping its other fields', () => {
        edit(box('rp-closing-summary', ''), 'The organization accepted the findings.');
        expect(report.closingMeeting).toEqual({ date: '2026-11-19', summary: 'The organization accepted the findings.' });
    });

    it('stores text the same way the other screens do (entity-encoded)', () => {
        edit(box('rp-changes', ''), 'SharePoint & Intellex');
        expect(report.changesSinceLastAudit).toBe('SharePoint &amp; Intellex');
    });

    it('never stores a box the auditor only clicked into: an untouched default stays a default', () => {
        const el = box('rp-eff-marks', 'Usage verified as conforming to CB rules.');
        el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        expect('effMarks' in report).toBe(false);
        expect(window.saveChecklist).not.toHaveBeenCalled();
    });

    it('keeps the Review & Submit box for the same text in step', () => {
        const ta = document.createElement('textarea');
        ta.id = 'exec-summary-r1';
        ta.defaultValue = 'Old AI summary';
        document.body.appendChild(ta);
        edit(box('rp-exec-summary', 'Old AI summary'), 'The audit identified 5 minor nonconformities.');
        expect(report.executiveSummary).toBe('The audit identified 5 minor nonconformities.');
        expect(ta.value).toBe('The audit identified 5 minor nonconformities.');
        expect(ta.defaultValue).toBe('The audit identified 5 minor nonconformities.');
    });

    it('ignores editable boxes that are not report fields (e.g. a CAR table cell)', () => {
        const el = box('rp-distribution', 'x');
        edit(el, 'y');
        expect(window.saveChecklist).not.toHaveBeenCalled();
    });
});

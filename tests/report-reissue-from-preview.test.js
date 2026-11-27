// PC Connection, 27 Nov 2026: the report was issued as v1.0 and changed
// afterwards, so it needed re-issuing. "Revert to Draft" in the preview changed
// only the open tab (saveData is browser-only), the server still held the
// report as issued, and after a reload the execution page again offered only
// "Download PDF". Two Draft PDFs were exported and no v1.1 was issued.
//
// Now the revert is written to the stored report, and the preview itself
// offers Finalize & Publish on a draft and "Re-issue as v1.1" on a final
// report changed since issue.
//
// execution-reporting.js is too DOM-dependent to load whole here (see
// tests/previous-findings-status.test.js), so the blocks are lifted from the
// source.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const slice = (from, to) => {
    const a = SRC.indexOf(from);
    const b = SRC.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error('block not found: ' + from);
    return SRC.slice(a, b);
};
const BLOCK = [
    "const isReportFinal = (report) => !!(report && report.reportStatus === 'final');",
    slice('// ─── Report Preview edits are saved to the report', '// ─── Previous Findings Status default'),
    slice('// Roles permitted to finalize/re-issue or change report status.', '// ─── Finding Status editor')
].join('\n');

globalThis.window = globalThis.window || globalThis;

let server, updates, d, modified;
function fakeSupabase() {
    return {
        from() {
            return {
                select() { return { eq() { return { async maybeSingle() { return { data: { data: JSON.parse(JSON.stringify(server.data)) }, error: null }; } }; } }; },
                update(patch) {
                    return { async eq() { updates.push(JSON.parse(JSON.stringify(patch))); Object.assign(server, patch); return { error: null }; } };
                }
            };
        }
    };
}
function load() {
    delete window.__previewEditsBound;
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', BLOCK)(window, document);
}
const issued = () => ({
    id: 'r1', status: 'Finalized', reportStatus: 'final',
    issueLog: [{ version: '1.0', at: '2026-11-25T11:25:40Z', action: 'issued' }],
    issuedSnapshot: { version: '1.0', contentHash: 'c37be5b5' }
});

beforeEach(() => {
    server = { status: 'Finalized', data: issued() };
    updates = [];
    modified = true;
    d = { report: issued() };
    window._reportPreviewData = d;
    window.state = { auditReports: [d.report] };
    window.CONSTANTS = { STATUS: { DRAFT: 'Draft', FINALIZED: 'Finalized' } };
    window.SupabaseClient = { client: fakeSupabase() };
    window.AuthManager = { hasRole: () => true };
    window.Sanitizer = { sanitizeText: (s) => s };
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    window.showReportPreviewModal = vi.fn();
    window._isModifiedSinceIssue = () => modified;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    load();
});

describe('Revert to Draft', () => {
    it('saves the draft status to the stored report, not just this tab', async () => {
        window.toggleReportStatus();
        expect(d.report.reportStatus).toBe('draft');
        await vi.waitFor(() => expect(updates).toHaveLength(2));
        expect(server.data.reportStatus).toBe('draft');
        expect(server.data.status).toBe('Draft');
        expect(server.status).toBe('Draft');
        // The issue history is kept for the re-issue.
        expect(server.data.issueLog).toHaveLength(1);
        await vi.waitFor(() => expect(window.showNotification).toHaveBeenCalledWith('Report reverted to draft and saved.', 'success'));
    });

    it('says so when the server write fails', async () => {
        window.SupabaseClient = { client: null };
        load();
        window.toggleReportStatus();
        await vi.waitFor(() => expect(window.showNotification).toHaveBeenCalled());
        expect(window.showNotification.mock.calls[0][1]).toBe('error');
    });
});

describe('issuing from the preview', () => {
    it('offers Finalize & Publish on a draft', () => {
        d.report.reportStatus = 'draft';
        expect(window._previewIssueAction(d)).toEqual({ label: 'Finalize & Publish', reissue: false });
    });

    it('offers to re-issue a final report changed since issue as the next version', () => {
        expect(window._previewIssueAction(d)).toEqual({ label: 'Re-issue as v1.1', reissue: true });
    });

    it('offers nothing for a final report unchanged since issue, or without the role', () => {
        modified = false;
        expect(window._previewIssueAction(d)).toBeNull();
        modified = true;
        window.AuthManager = { hasRole: () => false };
        expect(window._previewIssueAction(d)).toBeNull();
    });

    it('finalizes the open report and redraws the preview once issued', async () => {
        window.finalizeAndPublish = vi.fn(async () => { d.report.issueLog.push({ version: '1.1', action: 'reissued' }); });
        await window.finalizeFromPreview();
        expect(window.finalizeAndPublish).toHaveBeenCalledWith('r1');
        expect(window.showReportPreviewModal).toHaveBeenCalled();
    });

    it('leaves the preview alone when finalize is cancelled or blocked', async () => {
        window.finalizeAndPublish = vi.fn(async () => {});
        await window.finalizeFromPreview();
        expect(window.showReportPreviewModal).not.toHaveBeenCalled();
    });

    it('puts the button in the preview footer, before Export PDF', () => {
        // From the footer up to the Export PDF button.
        const footer = slice('<div class="rp-footer">', 'data-action="exportReportPDF"');
        expect(footer).toContain('previewIssueAction(d)');
        expect(footer).toContain('data-action="finalizeFromPreview"');
    });
});

// A finalized report must read FINAL everywhere it states its own status; a
// draft must read DRAFT everywhere. Before this fix that was not guaranteed:
// the preview path's cover Document Control block showed
// `d.report.recommendation || 'Draft'` under a "Status:" label — the audit
// recommendation text (or a hardcoded 'Draft' literal, regardless of actual
// status) instead of the report's real finalization state — while the export
// path's equivalent block, the running footer, and the watermark all
// correctly derived Final/Draft from d.report.reportStatus. A client could
// receive a cover that says FINAL next to a footer/doc-control block that
// still says Draft.
//
// The fix funnels every draft/final decision through one helper,
// isReportFinal(report), defined once in execution-reporting.js. These tests
// prove two things: (1) the helper itself is correct in both directions, and
// (2) every render site this fix touched is wired to the SAME helper call —
// not a local re-test of report.reportStatus — by extracting the actual
// ternary expressions out of the source (byte-for-byte) and evaluating them,
// the same "lift it out of the source" approach tests/previous-findings-status.test.js
// uses because execution-reporting.js is too DOM-dependent to import as a module.
//
// report.status (window.CONSTANTS.STATUS — 'Draft'/'In Review'/'Published'/
// 'Finalized') is a different, broader workflow field and is deliberately NOT
// read by any of this: toggleReportStatus reverts an issued report by
// clearing report.reportStatus alone, without touching report.status, so the
// two fields can disagree in practice (report.status can still read
// 'Finalized' while reportStatus reads 'draft') — see "authoritative field"
// tests below.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

function extract(pattern, label) {
    const m = SRC.match(pattern);
    if (!m) throw new Error('Could not find ' + label + ' in execution-reporting.js — has the render site moved or changed shape?');
    return m[0];
}

/** Lift isReportFinal itself and make it callable. */
function loadIsReportFinal() {
    const src = extract(/const isReportFinal = \(report\) => [^\n]+;/, 'isReportFinal definition');
    // eslint-disable-next-line no-new-func
    return new Function(src + '\nreturn isReportFinal;')();
}

/** Evaluate an extracted ternary expression exactly as it appears in the source. */
function evalSnippet(snippet, isReportFinal, d, modifiedSinceIssue) {
    // eslint-disable-next-line no-new-func
    const fn = new Function('isReportFinal', 'd', 'modifiedSinceIssue', 'return (' + snippet + ');');
    return fn(isReportFinal, d, modifiedSinceIssue);
}

const finalReport = { report: { reportStatus: 'final' } };
const draftReport = { report: { reportStatus: 'draft' } };

describe('isReportFinal — the single source of truth', () => {
    const isReportFinal = loadIsReportFinal();

    it('is defined exactly once, so a third status field cannot creep in beside it', () => {
        const hits = SRC.match(/const isReportFinal = \(report\) =>/g) || [];
        expect(hits.length).toBe(1);
    });

    it('is true only for a report actually marked reportStatus === "final"', () => {
        expect(isReportFinal({ reportStatus: 'final' })).toBe(true);
    });

    it('is false for draft, missing, malformed, or absent report objects (fail toward DRAFT, never FINAL)', () => {
        expect(isReportFinal({ reportStatus: 'draft' })).toBe(false);
        expect(isReportFinal({})).toBe(false);
        expect(isReportFinal(null)).toBe(false);
        expect(isReportFinal(undefined)).toBe(false);
        expect(isReportFinal({ reportStatus: 'Final' })).toBe(false); // case-sensitive: only the lowercase sentinel counts
        expect(isReportFinal({ status: 'Finalized' })).toBe(false); // report.status (workflow field) must not leak in here
    });

    it('every raw reportStatus === comparison in the file lives in exactly two places: the helper body, and the unrelated cross-report lookup for a client\'s prior finalized report', () => {
        // If this count grows, someone re-tested reportStatus directly instead of
        // calling isReportFinal(), reopening the preview/export disagreement risk.
        const hits = SRC.match(/reportStatus === 'final'/g) || [];
        expect(hits.length).toBe(2);
    });
});

describe('every touched render site calls isReportFinal(d.report), not a local reportStatus test', () => {
    it('cover status (preview), running footer, and export document-control block share one identical ternary', () => {
        // These three sites are textually identical on purpose: the preview's
        // Document Control "Status:" field (the site that was bugged — it used
        // to read d.report.recommendation instead), the printed running footer,
        // and the export cover's Document Control "Status:" field. Counting the
        // exact shared substring proves all three read the same logic, the same
        // way tests/previous-findings-status.test.js counts a shared call across
        // its two preview/export row builders.
        const hits = SRC.match(/isReportFinal\(d\.report\) \? 'Final' : 'Draft'/g) || [];
        expect(hits.length).toBe(3);
    });

    it('the toggle button, watermark CSS trigger, watermark div, and closing Report Status row all call isReportFinal(d.report)', () => {
        expect(SRC).toMatch(/isReportFinal\(d\.report\) \? 'FINAL' : 'DRAFT'/); // rp-status-toggle button
        expect(SRC).toMatch(/!isReportFinal\(d\.report\) \? '\.watermark\{display:flex !important;\}' : ''/); // print CSS
        expect(SRC).toMatch(/\+ \(!isReportFinal\(d\.report\)\s*\n\s*\? '<div class="watermark">/); // watermark div
        expect(SRC).toMatch(/isReportFinal\(d\.report\) \? 'Final — Issued' : 'Draft — not yet issued'/); // closing page
    });

    it('the preview→bug regression cannot come back: the cover Status field no longer reads report.recommendation', () => {
        expect(SRC).not.toMatch(/\$\{d\.report\.recommendation \|\| 'Draft'\}/);
    });
});

describe('both directions, using the real extracted source expressions', () => {
    const isReportFinal = loadIsReportFinal();

    it('cover / footer / document-control "Status:" field: FINAL prints Final, DRAFT prints Draft', () => {
        const snippet = "isReportFinal(d.report) ? 'Final' : 'Draft'";
        expect(evalSnippet(snippet, isReportFinal, finalReport)).toBe('Final');
        expect(evalSnippet(snippet, isReportFinal, draftReport)).toBe('Draft');
    });

    it('rp-status-toggle button label: FINAL prints "FINAL", DRAFT prints "DRAFT"', () => {
        const snippet = extract(/isReportFinal\(d\.report\) \? 'FINAL' : 'DRAFT'/, 'toggle button label ternary');
        expect(evalSnippet(snippet, isReportFinal, finalReport)).toBe('FINAL');
        expect(evalSnippet(snippet, isReportFinal, draftReport)).toBe('DRAFT');
    });

    it('closing page "Report Status" row: FINAL reads Issued, DRAFT reads not yet issued', () => {
        const snippet = extract(/isReportFinal\(d\.report\) \? 'Final — Issued' : 'Draft — not yet issued'/, 'closing Report Status row ternary');
        expect(evalSnippet(snippet, isReportFinal, finalReport)).toBe('Final — Issued');
        expect(evalSnippet(snippet, isReportFinal, draftReport)).toBe('Draft — not yet issued');
    });

    it('print CSS: only a DRAFT report forces the watermark visible; a FINAL report leaves it display:none by default', () => {
        const snippet = extract(/!isReportFinal\(d\.report\) \? '\.watermark\{display:flex !important;\}' : ''/, 'watermark CSS trigger ternary');
        expect(evalSnippet(snippet, isReportFinal, finalReport)).toBe('');
        expect(evalSnippet(snippet, isReportFinal, draftReport)).toBe('.watermark{display:flex !important;}');
    });

    it('watermark content: DRAFT always shows the DRAFT watermark regardless of modifiedSinceIssue; FINAL never shows DRAFT', () => {
        const snippet = extract(
            /\(!isReportFinal\(d\.report\)[\s\S]*?: '<div class="watermark"><span>CONFIDENTIAL<\/span><\/div>'\)\)/,
            'watermark div ternary'
        );
        // Draft always wins the DRAFT watermark, whether or not modifiedSinceIssue is (nonsensically) set.
        expect(evalSnippet(snippet, isReportFinal, draftReport, false)).toContain('DRAFT');
        expect(evalSnippet(snippet, isReportFinal, draftReport, true)).toContain('DRAFT');
        // A final, unmodified report shows CONFIDENTIAL — never DRAFT.
        const finalUnmodified = evalSnippet(snippet, isReportFinal, finalReport, false);
        expect(finalUnmodified).toContain('CONFIDENTIAL');
        expect(finalUnmodified).not.toContain('DRAFT');
        // A final report that has drifted since issue shows the MODIFIED SINCE ISSUE
        // watermark instead — never a plain DRAFT watermark.
        const finalModified = evalSnippet(snippet, isReportFinal, finalReport, true);
        expect(finalModified).toContain('MODIFIED SINCE ISSUE');
        expect(finalModified).not.toMatch(/>DRAFT</);
    });
});

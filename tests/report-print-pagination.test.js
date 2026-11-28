// PC Connection, 28 Nov 2026: the exported report had no page numbers, and
// sections could begin in the last few centimetres of a page. Both were
// measured in headless Chrome 158 with the report's own stylesheet:
// - "Page X of Y" prints in the bottom margin under the running footer, from
//   page margin boxes; all six boxes are defined so Chrome's own date/URL
//   never prints, even with "Headers and footers" on; the cover has no number.
// - a section starts a new page when less than half a page (115 mm) is left;
//   with more room it stays exactly where it was.
//
// execution-reporting.js is too DOM-dependent to load whole here (see
// tests/previous-findings-status.test.js), so the rules are read from the
// source and the spacer step is lifted out and run.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

describe('page numbers', () => {
    it('prints "Page X of Y" from the print engine in the bottom-right margin', () => {
        expect(SRC).toContain('@bottom-right{content:"Page " counter(page) " of " counter(pages);');
    });

    it('defines every other margin box empty, so the browser adds no date or URL', () => {
        ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center'].forEach((b) => {
            expect(SRC).toContain('@' + b + '{content:"";}');
        });
    });

    it('leaves the cover unnumbered, with an empty box rather than none', () => {
        expect(SRC).toContain("'@page :first{@bottom-right{content:\"\";}}'");
    });
});

describe('a section starts a new page when less than half a page is left', () => {
    it('has an unbreakable 115 mm spacer whose margin takes its height back', () => {
        expect(SRC).toContain('.sec-keep{display:block;height:115mm;margin:34px 0 -115mm;break-inside:avoid;page-break-inside:avoid;}');
        expect(SRC).toContain('.sec-keep + .sh{margin-top:0;}');
        expect(SRC).toContain('@media screen{.sec-keep{display:none;}}');
    });

    it('puts the spacer before every section header except those that always open a page', () => {
        const a = SRC.indexOf('const SECTION_FORCED_PAGE');
        const b = SRC.indexOf('const reportHtmlFinal', a);
        expect(a).toBeGreaterThan(0);
        const html = ['exec-summary', 'objectives', 'audit-trails', 'summary', 'observations', 'conclusion', 'signature', 'distribution']
            .map((k) => '<div id="sec-' + k + '" class="sh" style="x">' + k + '</div><div class="sb"></div>').join('');
        // eslint-disable-next-line no-new-func
        const out = new Function('reportHtmlColored', SRC.slice(a, b) + '\nreturn reportHtmlKept;')(html);
        const spaced = [...out.matchAll(/<div class="sec-keep" aria-hidden="true"><\/div><div id="sec-([a-z-]+)"/g)].map((m) => m[1]);
        expect(spaced).toEqual(['exec-summary', 'audit-trails', 'observations', 'distribution']);
    });

    it('still forces those four onto a new page', () => {
        expect(SRC).toContain('#sec-objectives,#sec-summary,#sec-conclusion,#sec-signature{page-break-before:always;break-before:page;}');
    });
});

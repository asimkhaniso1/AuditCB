// PC Connection, 24 Nov 2026: Signature & Attestation starts a new page and
// the Distribution List follows it. The fourth recipient (Certification
// Records) spilled onto a page of its own: the signature boxes carried large
// padding and every distribution row wrapped to two or three lines under the
// shared .info-tbl padding. Measured in headless Chrome with the report's own
// stylesheet, the list now ends 39 mm higher, about 28 mm inside the page.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const SECTIONS = (() => {
    const start = SRC.indexOf('// SECTION: SIGNATURE & ATTESTATION');
    const end = SRC.indexOf('// ═══ END OF FORMAL CERTIFICATION REPORT', start);
    if (start < 0 || end < 0) throw new Error('signature/distribution sections not found in execution-reporting.js');
    return SRC.slice(start, end);
})();

describe('Signature & Attestation and Distribution List share one page', () => {
    it('lays the distribution table out compactly, left-aligned and kept whole', () => {
        expect(SECTIONS).toContain('<table class="info-tbl dist-tbl">');
        const rule = /'\.dist-tbl\{([^}]*)\}\.dist-tbl th,\.dist-tbl td\{([^}]*)\}\.dist-tbl td:first-child\{([^}]*)\}'/.exec(SRC);
        expect(rule).not.toBeNull();
        expect(rule[1]).toContain('break-inside:avoid');
        expect(rule[2]).toBe('padding:6px 10px;font-size:0.8rem;line-height:1.4;text-align:left;');
        // .info-tbl styles a first cell as a 28% uppercase label; here it is the row number.
        expect(rule[3]).toContain('width:auto');
        expect(rule[3]).toContain('text-transform:none');
    });

    it('gives the organization column room for a client name on one line', () => {
        const widths = (SECTIONS.match(/<th style="width:(\d+)%;">/g) || []).map((t) => +/\d+/.exec(t)[0]);
        expect(widths).toEqual([5, 28, 22, 32, 13]);
        expect(widths.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('keeps the signature boxes and the confidentiality note compact', () => {
        expect(SECTIONS.match(/<div style="padding:14px 18px;background:#f8fafc;/g) || []).toHaveLength(2);
        expect(SECTIONS.match(/margin:16px 0 4px;/g) || []).toHaveLength(2);
        expect(SECTIONS).not.toContain('padding:20px;background:#f8fafc;');
        expect(SECTIONS).toContain('margin-top:12px;padding:8px 12px;background:#eff6ff;');
    });

    it('still starts Signature & Attestation on a new page', () => {
        expect(SRC).toMatch(/#sec-objectives,#sec-summary,#sec-conclusion,#sec-signature\{page-break-before:always;break-before:page;\}/);
    });
});

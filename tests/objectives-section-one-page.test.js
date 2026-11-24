// PC Connection, 24 Nov 2026: Section 4 (Audit Objectives, Criteria &
// Methodology) starts on its own page and Section 5 on the next, and at
// line-height 1.7 its narrow methodology column ran 3 lines onto an otherwise
// empty page. The columns now use line-height 1.5 at 0.85rem, which leaves
// about 17 mm to spare on that report's text.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');
const SECTION = (() => {
    const start = SRC.indexOf("// SECTION: OBJECTIVES, CRITERIA & METHODOLOGY");
    const end = SRC.indexOf('// SECTION: EXECUTIVE SUMMARY', start);
    if (start < 0 || end < 0) throw new Error('objectives section not found in execution-reporting.js');
    return SRC.slice(start, end);
})();

describe('Audit Objectives, Criteria & Methodology fits its page', () => {
    it('sets all three columns at line-height 1.5 and 0.85rem', () => {
        const cols = SECTION.match(/white-space:pre-line;line-height:[\d.]+;font-size:[\d.]+rem;/g) || [];
        expect(cols).toHaveLength(3);
        cols.forEach((c) => expect(c).toBe('white-space:pre-line;line-height:1.5;font-size:0.85rem;'));
    });

    it('still starts the section on a new page', () => {
        expect(SRC).toMatch(/#sec-objectives,[^{]*\{page-break-before:always;break-before:page;\}/);
    });
});

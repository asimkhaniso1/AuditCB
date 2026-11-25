// The Previous Findings Status text can be edited in the report preview
// whatever the previous audit found.
//
// The text prints in the executive summary and Report Integrity checks it, but
// the preview offered its box only when the previous audit had no
// nonconformities (or there was no previous report). With a table of previous
// NCs shown there was no box: PC Connection's recertification report kept text
// naming another client's NCRs, Report Integrity blocked it, and the auditor
// had nowhere to correct it (25 Nov 2026).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

describe('Prev Findings section of the report preview', () => {
    const start = SRC.indexOf('const prevFindingsNarrative = ');
    const end = SRC.indexOf('<!-- 5: Observations -->', start);
    const block = SRC.slice(start, end);

    it('appends the editable status box on every path that renders the section', () => {
        expect(start).toBeGreaterThan(-1);
        // no previous report, a previous report without NCs, and the table of previous NCs
        expect((block.match(/\breturn '/g) || []).length).toBe(3);
        expect((block.match(/\+\s*prevFindingsNarrative;/g) || []).length).toBe(3);
    });

    it('saves the box to report.previousFindingsStatus when the auditor leaves it', () => {
        expect(SRC).toMatch(/'rp-prev-findings': \{ path: \['previousFindingsStatus'\] \}/);
        expect(block).toMatch(/id="rp-prev-findings" class="rp-edit" contenteditable="true"/);
    });
});

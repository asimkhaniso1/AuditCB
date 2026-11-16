// The nonconformity statement can be written again.
//
// The client report prints each Major/Minor NC's "Nonconformity Statement" from
// checklistProgress[].ncrDescription. The box that wrote it had gone from the
// checklist's Finding Details panel, so every NC printed "Nonconformity
// statement not recorded." (PC Connection's February 2026 report, 7.5 and
// 9.2), and Report Integrity W31 pointed at a field the auditor could not find.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');
const RI = fs.readFileSync(path.resolve('./report-integrity.js'), 'utf8');

describe('Finding Details — nonconformity statement', () => {
    it('renders the statement box inside the NC panel, filled with the saved statement', () => {
        const panel = SRC.slice(SRC.indexOf('<div id="ncr-panel-${uniqueId}"'), SRC.indexOf('<!-- Cross-Reference: Personnel, Designation & Department -->'));
        expect(panel).toMatch(/<textarea id="ncr-desc-\$\{uniqueId\}"[^>]*>\$\{_execEscText\(saved\.ncrDescription \|\| ''\)\}<\/textarea>/);
        expect(panel).toMatch(/Nonconformity statement/);
    });

    it('is read by Save under the same id, and carried forward only when absent', () => {
        expect(SRC).toMatch(/const ncrDescEl = document\.getElementById\('ncr-desc-' \+ uniqueId\);/);
        expect(SRC).toMatch(/const ncrDesc = ncrDescEl \? Sanitizer\.sanitizeText\(ncrDescEl\.value \|\| ''\) : null;/);
        expect(SRC).toMatch(/if \(item\.ncrDescription === null\) item\.ncrDescription = \(prev && prev\.ncrDescription\) \|\| '';/);
    });

    it('W31 points the auditor at that box', () => {
        expect(RI).toMatch(/Finding Details → "Nonconformity statement"/);
    });
});

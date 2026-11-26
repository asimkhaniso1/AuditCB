// Technical review of PC Connection's 2026 recertification (item 17): Annex B
// opened with "Annexures & Appendices", listed an "Annexure A" and an
// "Annexure B" inside Annex B, and never said what the annex contains; its
// evidence overview also told the client findings "need supporting evidence
// before issuance".
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const SRC = fs.readFileSync(path.resolve('./execution-reporting.js'), 'utf8');

beforeAll(() => {
    window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
    loadScript('./utils.js', { global: true });
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./ai-service.js', { params: { module: undefined } });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-executive.js', { params: { module: undefined } });
    loadScript('./report-integrity.js', { params: { module: undefined } });
    loadScript('./execution-reporting.js', { global: true });
});

describe('Annex B introduction', () => {
    it('says what the annex holds, naming only the parts included', () => {
        const html = window._annexBIntroHtml([{ key: 'evidence-intel' }, { key: 'evidenceTrace' }], { evidence: true });
        expect(html).toContain('does not form part of the certification decision');
        expect(html).toContain('an overview of the evidence attached to the assessed items');
        expect(html).toContain('the evidence behind each finding');
        expect(html).toContain('; and an index of every evidence item');
        expect(html).not.toContain('framework-specific');
        expect(window._annexBIntroHtml([], {})).not.toContain('followed by');
    });

    it('no longer heads Annex B with "Annexures" or lists an Annexure A and B inside it', () => {
        expect(SRC).not.toMatch(/Annexure [AB] —/);
        expect(SRC).not.toContain("'ANNEXURES &amp; APPENDICES");
        expect(SRC).toContain('ANNEX CONTENTS &amp; REFERENCES');
    });

    it('the evidence overview states the position, not an internal to-do', () => {
        const items = [
            { status: 'conform', clause: '4.1', evidenceImages: ['a.jpg'] },
            { status: 'conform', clause: '4.2', evidenceImages: ['b.jpg'] },
            { status: 'nc', ncrType: 'minor', clause: '7.5', evidenceImages: [] }
        ];
        const intel = window.ReportExecutive.computeEvidenceIntel({ report: { checklistProgress: items }, hydratedProgress: items, auditPlan: {} });
        expect(intel.qualityNote).toBe('Evidence is attached to 67% of assessed items; 1 finding(s) have no attached evidence.');
        expect(intel.qualityNote).not.toMatch(/before issuance/);
    });
});

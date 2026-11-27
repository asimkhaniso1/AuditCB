// PC Connection, 27 Nov 2026: Annex B "Findings without supporting evidence"
// listed the observations at 8.1 and 8.7.2 as "Untitled item". Integrated
// findings have no Knowledge Base match, so the table now takes the clause
// title from the standards registry when the number means one thing across
// the report's standards, and prints a dash otherwise. The item's
// requirement/description never fills the slot (it can hold a department name).
import { describe, it, expect } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };
for (const f of ['./report-stats.js', './checklist-standards.js', './report-executive.js']) {
    loadScript(f, { params: { module: undefined } });
}

const STANDARD = 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019';
const obs = (clause, extra) => Object.assign({
    status: 'nc', ncrType: 'observation', clause, department: 'Management',
    requirement: 'Management', description: 'Management',
    comment: 'Recorded without a screenshot.'
}, extra);
const intelFor = (progress, standard) => window.ReportExecutive.computeEvidenceIntel({
    report: { id: 'r1', standard: standard === undefined ? STANDARD : standard, checklistProgress: progress },
    hydratedProgress: progress
});

describe('Findings without supporting evidence: item titles', () => {
    it('titles a clause shared by all three standards (PC Connection 8.1)', () => {
        expect(intelFor([obs('8.1')]).missingEvidence[0].item).toBe('Operational planning and control');
    });

    it('titles a clause only one of the standards has (PC Connection 8.7.2)', () => {
        expect(intelFor([obs('8.7.2')]).missingEvidence[0].item).toBe('Service continuity management');
    });

    it('prints a dash when the number means different clauses in different standards', () => {
        // 10.2 is Nonconformity and corrective action in 27001, Continual improvement in 22301.
        expect(intelFor([obs('10.2 / 10.1')]).missingEvidence[0].item).toBe('—');
        expect(intelFor([obs('8.3')]).missingEvidence[0].item).toBe('—');
    });

    it('prints a dash when the report names no registered standard', () => {
        expect(intelFor([obs('8.1')], '').missingEvidence[0].item).toBe('—');
    });

    it('never uses the requirement or description, and never prints "Untitled item"', () => {
        const items = intelFor([obs('8.1'), obs('8.3'), obs('IMS-0')]).missingEvidence.map(m => m.item);
        expect(items).not.toContain('Management');
        expect(items).not.toContain('Untitled item');
    });

    it('a Knowledge Base title still wins', () => {
        const item = obs('8.1', { kbMatch: { clause: '8.1', title: 'Operational planning and control (KB)' } });
        expect(intelFor([item]).missingEvidence[0].item).toBe('Operational planning and control (KB)');
    });

    it('labels the area column "Audit area", like the evidence-by-area heading', () => {
        const html = window.ReportExecutive.sections({
            report: { id: 'r2', standard: STANDARD, checklistProgress: [obs('8.1')] },
            hydratedProgress: [obs('8.1')]
        }).map(s => s.bodyHtml || '').join('');
        expect(html).toContain('Findings Without Supporting Evidence');
        expect(html).toContain('<th>Audit area</th>');
        expect(html).not.toContain('Untitled item');
    });
});

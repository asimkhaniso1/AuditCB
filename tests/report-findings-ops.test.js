import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditReports: [] };
window.ReportExecutive = { icon: () => '', bigFourCss: () => '' };
window.ReportStats = { formatCriterion: (f) => ({ label: (f && f.criterionRef) || (f && f.clause) || '', isInternal: false, real: null, internalRef: null }) };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./report-findings-ops.js'), 'utf8');
eval(src);

function fopsSection(key, d) {
    const secs = window.ReportFindingsOps.sections(d);
    return secs.find((s) => s.key === key);
}

describe('ReportFindingsOps — empty-column suppression', () => {
    it('drops CAPA Ref and Due Date from the finding lifecycle table when neither is recorded for any finding', () => {
        const d = {
            hydratedProgress: [
                { status: 'nc', ncrType: 'major', clause: '9.2', department: 'Quality', comment: 'gap noted' },
                { status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Maintenance', comment: 'gap noted' }
            ]
        };
        const sec = fopsSection('findingLifecycle', d);
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('<th>Ref</th>');
        expect(sec.bodyHtml).toContain('<th>Dept</th>');
        expect(sec.bodyHtml).not.toContain('<th>CAPA Ref</th>');
        expect(sec.bodyHtml).not.toContain('<th>Due Date</th>');
    });

    it('keeps Due Date when at least one finding has a caDueDate recorded', () => {
        const d = {
            hydratedProgress: [
                { status: 'nc', ncrType: 'major', clause: '9.2', department: 'Quality', comment: 'gap noted', caDueDate: '2026-09-01' },
                { status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Maintenance', comment: 'gap noted' }
            ]
        };
        const sec = fopsSection('findingLifecycle', d);
        expect(sec.bodyHtml).toContain('<th>Due Date</th>');
    });

    it('drops Auditor Note and CAPA ID from evidence traceability when neither is recorded for any finding', () => {
        const d = {
            hydratedProgress: [
                { status: 'nc', ncrType: 'major', clause: '9.2', department: 'Quality', requirement: 'Internal audits shall be conducted at planned intervals' },
                { status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Maintenance', requirement: 'Monitoring and measuring equipment shall be calibrated' }
            ]
        };
        const sec = fopsSection('evidenceTrace', d);
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('<th>Requirement</th>');
        expect(sec.bodyHtml).not.toContain('<th>Auditor Note</th>');
        expect(sec.bodyHtml).not.toContain('<th>CAPA ID</th>');
    });

    it('keeps Auditor Note when at least one finding has a comment recorded', () => {
        const d = {
            hydratedProgress: [
                { status: 'nc', ncrType: 'major', clause: '9.2', department: 'Quality', requirement: 'req text', comment: 'Observed during floor walk.' },
                { status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Maintenance', requirement: 'req text' }
            ]
        };
        const sec = fopsSection('evidenceTrace', d);
        expect(sec.bodyHtml).toContain('<th>Auditor Note</th>');
        expect(sec.bodyHtml).toContain('Observed during floor walk.');
    });
});

describe('ReportFindingsOps.criterionCell (fallback) — clause-only default', () => {
    it('renders the real clause only, without the internal-ref parenthetical, when ReportStats is unavailable', () => {
        const savedRS = window.ReportStats;
        window.ReportStats = undefined;
        try {
            // criterionCell reads global.ReportStats at call time via a try/catch,
            // so temporarily removing it exercises the local fallback branch.
            const sec = fopsSection('findingLifecycle', {
                hydratedProgress: [{ status: 'nc', ncrType: 'major', clause: 'FOCUS.2', criterionRef: '9.2', department: 'Quality', comment: 'x' }]
            });
            expect(sec.bodyHtml).toContain('9.2');
            expect(sec.bodyHtml).not.toContain('9.2 (FOCUS.2)');
        } finally {
            window.ReportStats = savedRS;
        }
    });
});

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

// TASK B — ground truth: a clause's official title comes ONLY from the KB
// match; item.requirement (the auditor's free-text checklist question) and
// item.department (the Process/Department field) are different fields and
// must never stand in for a missing title.
describe('ReportFindingsOps reqMatrix — a clause title is never substituted from another field (TASK B)', () => {
    it('renders an honest em dash, never item.requirement or item.department, when no kbMatch title exists', () => {
        const d = {
            hydratedProgress: [
                // requirement and department are deliberately set to the SAME
                // string a real department name would take, so any leak from
                // either field into the title slot is caught by the assertion.
                { status: 'nc', ncrType: 'minor', clause: '8.5.2', department: 'Management', requirement: 'Management', comment: 'x' }
            ]
        };
        const sec = fopsSection('reqMatrix', d);
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('8.5.2');
        expect(sec.bodyHtml).toContain('<td>—</td>');
        expect(sec.bodyHtml).not.toMatch(/>Management</);
    });

    it('renders the real KB clause title (e.g. 8.5.2 -> "Identification and traceability") when a kbMatch is present, still never the department', () => {
        const d = {
            hydratedProgress: [
                {
                    status: 'nc', ncrType: 'minor', clause: '8.5.2', department: 'Management',
                    requirement: 'Are finished goods labelled with a batch reference?',
                    kbMatch: { title: 'Identification and traceability' }, comment: 'x'
                }
            ]
        };
        const sec = fopsSection('reqMatrix', d);
        expect(sec.bodyHtml).toContain('Identification and traceability');
        expect(sec.bodyHtml).not.toMatch(/>Management</);
    });
});

// TASK A — a finding whose criterion is still an internal working reference
// (FOCUS/SURV/ORG/DOC — see NCR_PSEUDO_CLAUSE_PATTERN / ReportStats.classifyCriterion)
// must be shown honestly as pending assignment in the Applicable Requirements
// Matrix, never printed as if it were a real, plausible-looking clause number.
describe('ReportFindingsOps reqMatrix — internal/pseudo clause never shown as a real clause (TASK A)', () => {
    it('labels a working reference "internal ref FOCUS.8", never the bare pseudo-clause, in the matrix Ref column', () => {
        const savedRS = window.ReportStats;
        window.ReportStats = undefined; // exercise the local fallback (see matrixRefLabel)
        try {
            const d = {
                hydratedProgress: [
                    { status: 'nc', ncrType: 'major', clause: 'FOCUS.8', department: 'Quality', requirement: 'Ad-hoc working note', comment: 'x' }
                ]
            };
            const sec = fopsSection('reqMatrix', d);
            expect(sec).toBeTruthy();
            expect(sec.bodyHtml).toContain('internal ref FOCUS.8');
            expect(sec.bodyHtml).not.toMatch(/<td[^>]*>FOCUS\.8<\/td>/);
        } finally {
            window.ReportStats = savedRS;
        }
    });
});

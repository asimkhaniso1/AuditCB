// KTD Select surveillance-audit acceptance suite.
// Recreates the defects found in the original KTD report (invented financial
// claims, fabricated Stage 1/2 dates, FOCUS.x criteria, false "recurring",
// "General" departments, wrong recommendation wording, address drift) and
// asserts the corrected pipeline rejects or fixes each one.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };

const fs = await import('fs');
const path = await import('path');
function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    eval(src);
}
loadModule('./report-stats.js');
loadModule('./data-service.js');
loadModule('./report-integrity.js');

const KTD_CLIENT = () => ({
    id: 'ktd-1',
    name: 'KTD Select',
    sites: [{ address: '306 Camars Drive', city: 'Warminster', state: 'PA', zip: '18974' }],
    certificates: [{ standard: 'ISO 9001:2015', issueDate: '2024-08-20', expiryDate: '2027-08-19' }]
});

const KTD_PLAN = () => ({
    id: 'plan-ktd', clientId: 'ktd-1', auditType: 'Surveillance', type: 'Surveillance',
    standard: 'ISO 9001:2015', startDate: '2026-08-10', scope: 'Design and supply of selection systems',
    criteria: 'ISO 9001:2015', leadAuditor: 'A. Auditor'
});

function ncItem(overrides) {
    return Object.assign({
        status: 'nc', ncrType: 'minor', clause: '9.2',
        evidence: 'Internal audit programme IA-2026 reviewed; two scheduled audits not performed.',
        department: 'Quality', comment: 'Internal audit programme was not fully implemented.'
    }, overrides);
}

describe('KTD surveillance acceptance', () => {
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [KTD_CLIENT()], auditPlans: [KTD_PLAN()] };
    });

    // 25.1 — surveillance recommendation wording
    it('surveillance recommendation never grants certification', () => {
        const text = window.ReportStats.recommendationText('Surveillance', { majorNC: 0, minorNC: 4 });
        expect(text).toBe('Continued certification is recommended subject to satisfactory closure of applicable nonconformities.');
        expect(text.toLowerCase()).not.toContain('recommended for certification');
        expect(window.ReportStats.recommendationText('Recertification', { majorNC: 0, minorNC: 1 }))
            .toMatch(/^Recertification is recommended/);
        expect(window.ReportStats.recommendationText('Stage 2', { majorNC: 0, minorNC: 1 }))
            .toMatch(/^Recommended for certification/);
    });

    // 25.2 — programme chronology anchored on the certificate, not the audit date
    it('programme anchors on the certificate and slots the current audit correctly', () => {
        const p = window.ReportStats.buildProgramme({
            client: KTD_CLIENT(), auditPlan: KTD_PLAN(),
            report: { id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015' },
            allReports: []
        });
        expect(p.anchored).toBe('certificate');
        expect(p.issues).toEqual([]);
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));
        expect(byId.s1.timing).toBe('Aug 2024');            // NOT fabricated at Aug 2026
        expect(byId.s2.timing).toBe('Aug 2024');
        expect(byId.sv1.timing).toBe('Aug 2025');
        expect(byId.sv2.status).toBe('This audit');          // 2 years post-cert = SV2
        expect(p.stages.filter((s) => s.status === 'This audit')).toHaveLength(1);
    });

    it('programme never fabricates prior-stage dates without an anchor', () => {
        const p = window.ReportStats.buildProgramme({
            client: { id: 'x', name: 'NoCert Co' },
            auditPlan: KTD_PLAN(),
            report: { id: 'rep-2', clientId: 'x', date: '2026-08-12', auditType: 'Surveillance' },
            allReports: []
        });
        expect(p.anchored).toBe('audit-date-fallback');
        const byId = Object.fromEntries(p.stages.map((s) => [s.id, s]));
        expect(byId.s1.timing).toBe('—');
        expect(byId.s2.timing).toBe('—');
        expect(p.issues.length).toBeGreaterThan(0);
    });

    // 25.3/25.4/25.5/25.6/25.8 — the "old" defective KTD report must be BLOCKED
    it('the original defective KTD report is blocked with the expected rule hits', () => {
        const report = {
            id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'Certification protects an estimated $5M annual revenue tied to certified status. This recurring weakness may result in contractual penalties.',
            conclusion: 'The organization is Recommended for Certification.',
            checklistProgress: [
                ncItem({ clause: 'FOCUS.2', criterionRef: '', department: 'General', evidence: '' }),
                ncItem({ clause: 'FOCUS.8', criterionRef: '' })
            ],
            ncrs: []
        };
        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
        expect(result.status).toBe('BLOCKED');
        const ids = result.blockers.map((b) => b.id.split('-')[0]).concat(result.warnings.map((w) => w.id.split('-')[0]));
        expect(ids).toContain('B1'); // FOCUS.x as final criterion
        expect(ids).toContain('B5'); // granting language on a surveillance audit
        expect(ids).toContain('B6'); // unsupported $5M financial claim
        expect(ids).toContain('B7'); // "recurring" with no audit history
        expect(ids).toContain('B3'); // NC without objective evidence
        expect(ids).toContain('W3'); // department "General"
    });

    // 25 happy path — the corrected KTD report passes with zero blockers
    it('the corrected KTD report is READY FOR AUDITOR REVIEW', () => {
        window.state.auditReports.push({
            id: 'rep-prev', clientId: 'ktd-1', standard: 'ISO 9001:2015',
            date: '2025-08-15', auditType: 'Surveillance', reportStatus: 'final',
            checklistProgress: [], ncrs: []
        });
        const report = {
            id: 'rep-ktd', planId: 'plan-ktd', clientId: 'ktd-1', client: 'KTD Select',
            date: '2026-08-12', auditType: 'Surveillance', standard: 'ISO 9001:2015',
            executiveSummary: 'Four minor nonconformities and four observations were identified. The management system continues to meet the requirements of ISO 9001:2015.',
            conclusion: 'Continued certification is recommended subject to satisfactory closure of applicable nonconformities.',
            checklistProgress: [
                ncItem(),
                ncItem({ clause: 'FOCUS.2', criterionRef: '9.2', criterionSource: 'focus-carryover' }),
                ncItem({ clause: '7.1', department: 'Maintenance', evidence: 'Calibration record CAL-114 overdue since May 2026.' })
            ],
            ncrs: []
        };
        const result = window.ReportIntegrity.check({ report, auditPlan: KTD_PLAN(), client: KTD_CLIENT() });
        expect(result.blockers).toEqual([]);
        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
    });

    // 25.13 — address comes from authoritative master data, with drift warning
    it('address drift between plan and master site record is detected', () => {
        const issues = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: { location: '306 Camars Dr, Warwick, PA' },
            report: {}, certificate: null
        });
        expect(issues.length).toBeGreaterThan(0);
        const clean = window.DataService.checkAddressConsistency({
            client: KTD_CLIENT(),
            auditPlan: { location: '306 Camars Dr, Warminster, PA' },
            report: {}, certificate: null
        });
        expect(clean).toEqual([]); // "Dr" vs "Drive" normalized, same city
    });

    // 25.7 — "General" is not a department label anywhere in the shared normalizer
    it('department normalization never yields "General"', () => {
        expect(window.ReportStats.normalizeDeptName('General')).toBe('Unassigned / Cross-functional');
        expect(window.ReportStats.normalizeDeptName('')).toBe('Unassigned / Cross-functional');
        expect(window.ReportStats.normalizeDeptName('Production')).toBe('Production');
    });
});

// 25.11/25.14/25.15 — source-level hygiene: banned generators removed for good
describe('KTD acceptance — source hygiene', () => {
    const read = (f) => fs.readFileSync(path.resolve(f), 'utf8');

    it('execution-reporting.js no longer fabricates maturity or "General" departments', () => {
        const src = read('./execution-reporting.js');
        expect(src).not.toContain('_maturityStars');
        expect(src).not.toContain("|| 'General'");
    });

    it('report-executive.js no longer teaches financial/consultancy claims', () => {
        const src = read('./report-executive.js');
        expect(src).not.toContain('avoids a follow-up audit cost');
        expect(src).not.toMatch(/Big Four/i);
        expect(src).not.toContain('operational resilience');
    });

    it('formal/annex split exists and analytics sections are annexed', () => {
        const src = read('./execution-reporting.js');
        expect(src).toContain('SECTION_GROUPS');
        expect(src).toMatch(/['"]exec-dashboard['"]\s*:\s*['"]analytics['"]/);
        expect(src).toMatch(/['"]risk-heatmap['"]\s*:\s*['"]analytics['"]/);
        expect(src).toMatch(/['"]conclusion['"]\s*:\s*['"]formal['"]/);
    });

    it('auditee owns corrective actions in report-risk.js', () => {
        const src = read('./report-risk.js');
        expect(src).toMatch(/AUDITEE CORRECTIVE ACTION PLAN/);
        expect(src).not.toContain('retrain the relevant personnel');
    });
});

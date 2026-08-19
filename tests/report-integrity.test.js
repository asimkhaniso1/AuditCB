import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./report-integrity.js'), 'utf8');
eval(src);

function baseReport(overrides) {
    return Object.assign({
        id: 'report-1',
        clientId: 'client-1',
        client: 'Acme Manufacturing',
        checklistProgress: [],
        ncrs: []
    }, overrides);
}

function baseClient(overrides) {
    return Object.assign({
        id: 'client-1',
        name: 'Acme Manufacturing',
        sites: [{ address: '123 Main Street', city: 'Springfield' }]
    }, overrides);
}

describe('ReportIntegrity.check', () => {
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    });

    it('B1: a Major/Minor NC on a placeholder FOCUS clause with no criterionRef blocks', () => {
        const report = baseReport({
            checklistProgress: [
                {
                    status: 'nc',
                    ncrType: 'major',
                    clause: 'FOCUS.2',
                    evidence: 'Photograph of the non-conforming area on file.',
                    department: 'Production'
                }
            ]
        });
        const auditPlan = { auditType: 'Initial Certification' };
        const client = baseClient();

        const result = window.ReportIntegrity.check({ report, auditPlan, client });

        expect(result.status).toBe('BLOCKED');
        expect(result.blockers.some((b) => b.id.startsWith('B1'))).toBe(true);
    });

    it('B5: surveillance audit type with certification-granting recommendation language blocks', () => {
        const report = baseReport({
            conclusion: 'The audit team confirms the organization is Recommended for Certification without reservation.',
            checklistProgress: []
        });
        const auditPlan = { auditType: 'Surveillance' };
        const client = baseClient({ certificates: [{ id: 'cert-1' }] }); // avoid B2 chronology interference

        const result = window.ReportIntegrity.check({ report, auditPlan, client });

        expect(result.status).toBe('BLOCKED');
        expect(result.blockers.some((b) => b.id === 'B5')).toBe(true);
    });

    it('B7: recurring-finding language with no prior finalized report for the client blocks', () => {
        const report = baseReport({
            executiveSummary: 'This is a recurring weakness in the document control process observed this cycle.',
            checklistProgress: []
        });
        const auditPlan = { auditType: 'Initial Certification' };
        const client = baseClient();
        window.state.auditReports = []; // no prior report exists anywhere

        const result = window.ReportIntegrity.check({ report, auditPlan, client });

        expect(result.status).toBe('BLOCKED');
        expect(result.blockers.some((b) => b.id.startsWith('B7'))).toBe(true);
    });

    it('W3: a finding with department "General" produces a warning, not a blocker', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            conclusion: 'Continued conformity is confirmed, subject to satisfactory closure of the minor nonconformity raised.',
            checklistProgress: [
                {
                    status: 'nc',
                    ncrType: 'minor',
                    clause: '8.5.2',
                    evidence: 'Records reviewed on site confirming the gap.',
                    department: 'General'
                }
            ]
        });
        const auditPlan = { auditType: 'Initial Certification' };
        const client = baseClient();

        const result = window.ReportIntegrity.check({ report, auditPlan, client });

        expect(result.blockers.length).toBe(0);
        expect(result.warnings.some((w) => w.id.startsWith('W3'))).toBe(true);
        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
    });

    it('zero-issue happy path returns READY FOR AUDITOR REVIEW with no blockers or warnings', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            executiveSummary: 'The management system was found to be well-implemented and effective.',
            conclusion: 'Recommended for certification.',
            checklistProgress: [
                { status: 'conform', clause: '8.5.2', department: 'Production' }
            ]
        });
        const auditPlan = { auditType: 'Initial Certification' };
        const client = baseClient();

        const result = window.ReportIntegrity.check({ report, auditPlan, client });

        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
        expect(result.blockers.length).toBe(0);
        expect(result.warnings.length).toBe(0);
    });
});

// One authoritative audit dataset must drive every report section, and internal
// QA machinery must never reach the client document.
describe('ReportIntegrity — report/dataset agreement', () => {
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    });

    const STATS = { majorNC: 0, minorNC: 4, observationCount: 4, ofiCount: 1 };

    it('B11: internal system metadata in client-facing narrative blocks', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended. (system-derived: Continued certification is recommended subject to closure.)'
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.blockers.some((b) => b.id.startsWith('B11'))).toBe(true);
        expect(result.status).toBe('BLOCKED');
    });

    it('B12: a Remote audit claiming on-site observation blocks', () => {
        const report = baseReport({
            executiveSummary: 'The audit methodology included observation of activities and work environment on-site.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'Remote' }, client: baseClient()
        });

        expect(result.blockers.some((b) => b.id.startsWith('B12'))).toBe(true);
    });

    it('B12: a Remote audit that explicitly rules out on-site verification does not block', () => {
        const report = baseReport({
            executiveSummary: 'The audit was conducted remotely; no on-site verification was performed during this surveillance.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'Remote' }, client: baseClient()
        });

        expect(result.blockers.some((b) => b.id.startsWith('B12'))).toBe(false);
    });

    it('B12: on-site wording on an actual on-site audit does not block', () => {
        const report = baseReport({
            executiveSummary: 'The audit included on-site observation of production activities.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'On-site' }, client: baseClient()
        });

        expect(result.blockers.some((b) => b.id.startsWith('B12'))).toBe(false);
    });

    it('B13: narrative counts that contradict the findings dataset block', () => {
        // The real KTD defect: 1 OFI recorded, but the summary claimed 5.
        const report = baseReport({
            executiveSummary: 'The assessment concluded with the identification of 4 non-conformities and 5 opportunities for improvement.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: {}, client: baseClient(), stats: STATS
        });

        const b13 = result.blockers.find((b) => b.id.startsWith('B13'));
        expect(b13).toBeTruthy();
        expect(b13.message).toContain('opportunities for improvement');
    });

    it('B13: narrative counts that agree with the dataset do not block', () => {
        const report = baseReport({
            executiveSummary: 'The audit identified 4 non-conformities, 4 observations and 1 opportunity for improvement.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: {}, client: baseClient(), stats: STATS
        });

        expect(result.blockers.some((b) => b.id.startsWith('B13'))).toBe(false);
    });

    it('B14: an NC with no real clause blocks because clause totals cannot reconcile', () => {
        const report = baseReport({
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: 'FOCUS.4', criterionRef: '', comment: 'Objective evidence recorded during the audit for this item.' },
                { status: 'nc', ncrType: 'minor', clause: '9.2', comment: 'Objective evidence recorded during the audit for this item.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        const b14 = result.blockers.find((b) => b.id === 'B14');
        expect(b14).toBeTruthy();
        expect(b14.message).toContain('1 of 2');
    });

    it('B14: does not fire once every NC carries a validated clause', () => {
        const report = baseReport({
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: 'FOCUS.4', criterionRef: '7.2', comment: 'Objective evidence recorded during the audit for this item.' },
                { status: 'nc', ncrType: 'minor', clause: '9.2', comment: 'Objective evidence recorded during the audit for this item.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.blockers.some((b) => b.id === 'B14')).toBe(false);
    });

    it('W12: a headcount in field notes that contradicts the org profile warns', () => {
        const report = baseReport({
            checklistProgress: [{ status: 'conform', clause: '7.1', comment: '8 now total emplyees' }]
        });
        const client = baseClient({ sites: [{ city: 'Springfield', employees: 10 }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        const w12 = result.warnings.find((w) => w.id.startsWith('W12'));
        expect(w12).toBeTruthy();
        expect(w12.message).toContain('8');
        expect(w12.message).toContain('10');
    });

    it('W13: design activity in scope with clause 8.3 treated as not applicable warns', () => {
        const report = baseReport({
            checklistProgress: [{ status: 'conform', clause: '8.1', comment: 'No Design Development applicable.' }]
        });
        const client = baseClient({ certificationScope: 'Engineering and new product development, wire harness design and manufacturing.' });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        expect(result.warnings.some((w) => w.id === 'W13')).toBe(true);
    });

    it('W14: a surveillance report with no previous-findings status warns', () => {
        const report = baseReport({ previousFindingsStatus: '—' });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditType: 'Surveillance' }, client: baseClient()
        });

        expect(result.warnings.some((w) => w.id === 'W14')).toBe(true);
    });

    it('W14: an initial certification report is not expected to carry one', () => {
        const report = baseReport({ previousFindingsStatus: '' });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditType: 'Initial Certification' }, client: baseClient()
        });

        expect(result.warnings.some((w) => w.id === 'W14')).toBe(false);
    });

    it('E1: raw field notes are reported as editorial and never block issuance', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [
                { status: 'conform', clause: '7.1', comment: 'Records Are Available' },
                { status: 'conform', clause: '7.2', comment: 'Ssytem is in placed' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.editorial.length).toBeGreaterThanOrEqual(2);
        expect(result.editorial.every((e) => e.severity === 'editorial')).toBe(true);
        expect(result.status).toBe('READY FOR AUDITOR REVIEW');
    });

    it('E1: a full client-facing evidence statement is not flagged', () => {
        const report = baseReport({
            checklistProgress: [{
                status: 'conform',
                clause: '7.1',
                comment: 'Complaint records sampled during the audit demonstrated that the identified complaint had been investigated and closed through the established CAPA process.'
            }]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.editorial.length).toBe(0);
    });
});

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

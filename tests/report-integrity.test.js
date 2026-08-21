import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./report-integrity.js'), 'utf8');
eval(src);

// W25 needs real ReportStats.classifyCriterion (internal-ref detection,
// programme-criterion detection) rather than a hand-rolled stand-in — a
// mock could drift from the real classification rules and hide a false
// positive/negative. Loaded the same way report-stats.test.js loads it.
const reportStatsSrc = fs.readFileSync(path.resolve('./report-stats.js'), 'utf8');
eval(reportStatsSrc);

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

    // Reported from the field as "employee count field is not updating". It
    // was updating — but the auditor's own notes stated TWO different
    // headcounts, so no single controlled figure can satisfy W12 and a warning
    // always survived the fix action, which read as a failed save. Pinning the
    // behaviour so the per-figure warning stays (it is correct) and the fix
    // action's own messaging keeps having something honest to report.
    it('W12: two contradictory headcounts in evidence raise one warning EACH — confirming one cannot clear the other', () => {
        const report = baseReport({
            positiveObservations: 'The team confirmed 4 employees are trained.\nRecords show 5 employees in total.'
        });
        const atEight = window.ReportIntegrity.check({
            report, auditPlan: {}, client: baseClient({ sites: [{ city: 'Springfield', employees: 8 }] })
        }).warnings.filter((w) => w.id.startsWith('W12'));
        expect(atEight).toHaveLength(2);

        // Confirming 5 resolves that note and leaves the 4 — the profile is now
        // right, the other note is wrong, and only the auditor can say which.
        const atFive = window.ReportIntegrity.check({
            report, auditPlan: {}, client: baseClient({ sites: [{ city: 'Springfield', employees: 5 }] })
        }).warnings.filter((w) => w.id.startsWith('W12'));
        expect(atFive).toHaveLength(1);
        expect(atFive[0].message).toContain('4');
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

    it('W16: asserting no significant changes while evidence shows a headcount move warns', () => {
        const report = baseReport({
            // Left empty on purpose: the "no significant changes" sentence is a
            // render-time default, so the client still reads that claim.
            changesSinceLastAudit: '',
            checklistProgress: [{ status: 'conform', clause: '7.1', comment: '8 now total emplyees' }]
        });
        const client = baseClient({ sites: [{ city: 'Springfield', employees: 10 }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        const w16 = result.warnings.find((w) => w.id === 'W16');
        expect(w16).toBeTruthy();
        expect(w16.message).toContain('10');
        expect(w16.message).toContain('8');
    });

    it('W16: does not fire once the auditor records the change', () => {
        const report = baseReport({
            changesSinceLastAudit: 'Headcount reduced from 10 to 8 following a departmental restructure.',
            checklistProgress: [{ status: 'conform', clause: '7.1', comment: '8 now total emplyees' }]
        });
        const client = baseClient({ sites: [{ city: 'Springfield', employees: 10 }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        expect(result.warnings.some((w) => w.id === 'W16')).toBe(false);
    });

    it('W16: stays silent when the evidence agrees with the organization profile', () => {
        const report = baseReport({
            changesSinceLastAudit: '',
            checklistProgress: [{ status: 'conform', clause: '7.1', comment: '10 now total employees' }]
        });
        const client = baseClient({ sites: [{ city: 'Springfield', employees: 10 }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        expect(result.warnings.some((w) => w.id === 'W16')).toBe(false);
    });

    it('W17: an Observation that calls itself an opportunity for improvement warns', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [{
                status: 'nc', ncrType: 'observation', clause: '7.1',
                comment: 'An opportunity for improvement was identified regarding the competency matrix.'
            }]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W17'))).toBe(true);
    });

    it('W17: an Observation worded as an observation is left alone', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [{
                status: 'nc', ncrType: 'observation', clause: '7.1',
                comment: 'The competency matrix was maintained and available for the sample reviewed.'
            }]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W17'))).toBe(false);
    });

    it('W18: the same issue filed as both an OFI and a nonconformity warns', () => {
        const shared = 'Calibration records for torque tooling were not retained for the sampled production line';
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '7.1.5', comment: shared + '.' },
                { status: 'nc', ncrType: 'ofi', clause: '7.1.5', comment: shared + ' during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W18'))).toBe(true);
    });

    it('W18: genuinely different advisories are not flagged as duplicates', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '9.2', comment: 'Two scheduled internal audits were not performed within the planned programme.' },
                { status: 'nc', ncrType: 'ofi', clause: '6.1', comment: 'The risk register could link mitigation actions to named process owners.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W18'))).toBe(false);
    });

    it('W19: an advisory prescribing the solution warns (CB impartiality)', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [{
                status: 'nc', ncrType: 'ofi', clause: '6.1',
                comment: 'The organization must implement a documented risk-assessment procedure using FMEA.'
            }]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W19'))).toBe(true);
    });

    it('W19: neutral "may consider" wording is acceptable', () => {
        const report = baseReport({
            conclusion: 'Continued certification is recommended.',
            checklistProgress: [{
                status: 'nc', ncrType: 'ofi', clause: '6.1',
                comment: 'The organization may consider strengthening how risk-assessment outputs are recorded.'
            }]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W19'))).toBe(false);
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

// W13 exists to force an applicability decision, so a recorded decision must
// silence it — a warning that never clears is one auditors learn to ignore.
describe('ReportIntegrity — W13 respects a recorded applicability decision', () => {
    const designClient = () => baseClient({
        certificationScope: 'Engineering and new product development, wire harness design and manufacturing.'
    });
    const reportWithConflict = (overrides) => baseReport(Object.assign({
        conclusion: 'Continued certification is recommended.',
        checklistProgress: [{ status: 'conform', clause: '8.1', comment: 'No Design Development applicable.' }]
    }, overrides));

    it('still warns while no decision has been recorded', () => {
        const result = window.ReportIntegrity.check({
            report: reportWithConflict(), auditPlan: {}, client: designClient()
        });
        expect(result.warnings.some((w) => w.id === 'W13')).toBe(true);
    });

    it('clears once the exclusion is justified in writing', () => {
        const report = reportWithConflict({
            applicabilityDecisions: {
                '8.3': {
                    applicable: false,
                    justification: 'Design authority rests with the customer; the organization manufactures to supplied drawings only.',
                    decidedBy: 'Lead Auditor',
                    decidedAt: '2026-08-19T10:00:00Z'
                }
            }
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: designClient() });
        expect(result.warnings.some((w) => w.id === 'W13')).toBe(false);
    });

    it('clears when the auditor decides 8.3 IS applicable', () => {
        const report = reportWithConflict({
            applicabilityDecisions: { '8.3': { applicable: true, decidedBy: 'Lead Auditor' } }
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: designClient() });
        expect(result.warnings.some((w) => w.id === 'W13')).toBe(false);
    });

    it('keeps warning when an exclusion was recorded without a justification', () => {
        const report = reportWithConflict({
            applicabilityDecisions: { '8.3': { applicable: false, justification: '   ' } }
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: designClient() });
        expect(result.warnings.some((w) => w.id === 'W13')).toBe(true);
    });
});

// Phase B — classification, clause reference/title, audit mode, conclusion
// and previous-findings contradictions. Counts-vs-prose (requirement class 1
// of the cross-report validation pass) is already covered by B13 above,
// including the exact live defect (4 minor / 4 observations / 1 OFI with
// prose stating "5 opportunities for improvement" — see the B13 tests).
describe('ReportIntegrity — Phase B cross-report contradictions', () => {
    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    });

    it('B12: on-site wording in the audit plan\'s own methodology text blocks a Remote audit too', () => {
        const report = baseReport({});
        const auditPlan = { auditMethod: 'Remote', auditMethodology: 'The audit included on-site observation of production activities.' };
        const result = window.ReportIntegrity.check({ report, auditPlan, client: baseClient() });

        expect(result.blockers.some((b) => b.id === 'B12-auditPlan.auditMethodology')).toBe(true);
    });

    it('B12: remote-only methodology text on a Remote audit does not block', () => {
        const report = baseReport({});
        const auditPlan = { auditMethod: 'Remote', auditMethodology: 'Interviews were conducted via video conferencing; no on-site verification was possible.' };
        const result = window.ReportIntegrity.check({ report, auditPlan, client: baseClient() });

        expect(result.blockers.some((b) => b.id.startsWith('B12-'))).toBe(false);
    });

    it('B12r: an On-site audit method contradicted by remote-only methodology text blocks', () => {
        const report = baseReport({
            executiveSummary: 'The audit was conducted entirely remotely due to travel restrictions.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'On-site' }, client: baseClient()
        });

        expect(result.blockers.some((b) => b.id.startsWith('B12r-'))).toBe(true);
    });

    it('B12r: an On-site audit method with on-site narrative does not block', () => {
        const report = baseReport({
            executiveSummary: 'The audit included on-site observation of production activities.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'On-site' }, client: baseClient()
        });

        expect(result.blockers.some((b) => b.id.startsWith('B12r-'))).toBe(false);
    });

    it('W21: an unset Audit Method with an on-site narrative claim warns', () => {
        const report = baseReport({
            executiveSummary: 'The audit included on-site observation of production activities.'
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W21-'))).toBe(true);
    });

    it('W21: does not fire once the Audit Method is recorded', () => {
        const report = baseReport({
            executiveSummary: 'The audit included on-site observation of production activities.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditMethod: 'On-site' }, client: baseClient()
        });

        expect(result.warnings.some((w) => w.id.startsWith('W21-'))).toBe(false);
    });

    it('B18: a finding described in prose under a different classification than its record blocks', () => {
        const report = baseReport({
            executiveSummary: 'Clause 8.5.2 was raised as a minor nonconformity during the visit.',
            checklistProgress: [
                { status: 'nc', ncrType: 'observation', clause: '8.5.2', comment: 'Traceability records were incomplete for the sampled batch during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        const b18 = result.blockers.find((b) => b.id.startsWith('B18-'));
        expect(b18).toBeTruthy();
        expect(b18.message).toContain('8.5.2');
    });

    it('B18: narrative classification matching the finding record does not block', () => {
        const report = baseReport({
            executiveSummary: 'Clause 8.5.2 remains an observation for management review.',
            checklistProgress: [
                { status: 'nc', ncrType: 'observation', clause: '8.5.2', comment: 'Traceability records were incomplete for the sampled batch during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.blockers.some((b) => b.id.startsWith('B18-'))).toBe(false);
    });

    it('W23: a clause cited with a classification in prose but no matching finding record warns', () => {
        const report = baseReport({
            executiveSummary: 'Clause 9.2 was raised as a minor nonconformity during the visit.'
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W23-'))).toBe(true);
    });

    it('W23: does not fire when the cited clause has a matching finding record', () => {
        const report = baseReport({
            executiveSummary: 'Clause 9.2 was raised as a minor nonconformity during the visit.',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '9.2', evidence: 'Photograph on file.', comment: 'Internal audit records were incomplete for the sampled department during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W23-'))).toBe(false);
    });

    it('B19: a clause title that is actually a client department name blocks', () => {
        const report = baseReport({
            executiveSummary: 'The finding under Clause 8.5.2 (Management) was closed after review.'
        });
        const client = baseClient({ departments: [{ name: 'Management', head: 'J. Smith' }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        const b19 = result.blockers.find((b) => b.id.startsWith('B19-'));
        expect(b19).toBeTruthy();
        expect(b19.message).toContain('department');
    });

    it('B19: the real clause title does not block', () => {
        const report = baseReport({
            executiveSummary: 'Clause 8.5.2: Identification and traceability, was found non-conforming.'
        });
        const client = baseClient({ departments: [{ name: 'Management', head: 'J. Smith' }] });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client });

        expect(result.blockers.some((b) => b.id.startsWith('B19-'))).toBe(false);
    });

    it('W22: the same clause given two different titles in the report warns', () => {
        const report = baseReport({
            executiveSummary: 'Clause 8.5.2: Identification and traceability, was found non-conforming.',
            conclusion: 'The finding under Clause 8.5.2 (Process Control) remains open.'
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W22-'))).toBe(true);
    });

    it('W22: the same title repeated for a clause does not warn', () => {
        const report = baseReport({
            executiveSummary: 'Clause 8.5.2: Identification and traceability, was found non-conforming.',
            conclusion: 'Clause 8.5.2 (Identification and traceability) remains open pending closure.'
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.warnings.some((w) => w.id.startsWith('W22-'))).toBe(false);
    });

    it('B20: an unqualified certification statement with an open Major NC blocks', () => {
        const report = baseReport({
            conclusion: 'Certification is confirmed based on the audit results.',
            checklistProgress: [
                { status: 'nc', ncrType: 'major', clause: '8.5.2', evidence: 'Photograph on file.', comment: 'A significant nonconformity was identified in the traceability process during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.blockers.some((b) => b.id === 'B20')).toBe(true);
    });

    it('B20: a conclusion stating the closure contingency does not block', () => {
        const report = baseReport({
            conclusion: 'Certification is confirmed subject to satisfactory closure and verification of the major nonconformity raised.',
            checklistProgress: [
                { status: 'nc', ncrType: 'major', clause: '8.5.2', evidence: 'Photograph on file.', comment: 'A significant nonconformity was identified in the traceability process during the review.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: {}, client: baseClient() });

        expect(result.blockers.some((b) => b.id === 'B20')).toBe(false);
    });

    it('W24: claiming previous findings were verified closed while prior records show follow-up only planned warns', () => {
        window.state.auditReports = [{
            id: 'report-0',
            clientId: 'client-1',
            client: 'Acme Manufacturing',
            status: 'Finalized',
            date: '2025-01-10',
            checklistProgress: [{ status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Production' }],
            findingStatus: { '7.1|Production': { status: 'planned' } }
        }];
        const report = baseReport({
            executiveSummary: 'Previous nonconformities were verified and closed during this cycle.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditType: 'Surveillance' }, client: baseClient()
        });

        expect(result.warnings.some((w) => w.id === 'W24')).toBe(true);
    });

    it('W24: does not fire when the prior records genuinely show closure', () => {
        window.state.auditReports = [{
            id: 'report-0',
            clientId: 'client-1',
            client: 'Acme Manufacturing',
            status: 'Finalized',
            date: '2025-01-10',
            checklistProgress: [{ status: 'nc', ncrType: 'minor', clause: '7.1', department: 'Production' }],
            findingStatus: { '7.1|Production': { status: 'closed' } }
        }];
        const report = baseReport({
            executiveSummary: 'Previous nonconformities were verified and closed during this cycle.'
        });
        const result = window.ReportIntegrity.check({
            report, auditPlan: { auditType: 'Surveillance' }, client: baseClient()
        });

        expect(result.warnings.some((w) => w.id === 'W24')).toBe(false);
    });
});

// W12 — a document code is not a headcount.
//
// "FORM-004 Employee Training Record" matched the stated-headcount pattern:
// the word boundary after the hyphen let it capture "004" and warn that the
// evidence referred to 4 employees against a profile of 8 — and the offered
// note-rewrite could never clear it, because \b4 has no boundary inside "004".
// The auditor was locked in a loop of confirming a headcount that was never
// contradicted.
describe('W12 — form codes and document titles are not headcounts', () => {
    const CLIENT_8 = { id: 'c-1', name: 'KTD Select', sites: [{ employees: 8 }] };

    function w12(report) {
        const res = window.ReportIntegrity.check({ report, client: CLIENT_8, checklists: [], auditPlan: {} });
        return res.warnings.filter(w => String(w.id || '').indexOf('W12') === 0);
    }

    it('does not read FORM-004 / FORM-005 document codes as employee counts', () => {
        const hits = w12({
            id: 'r1', client: 'KTD Select', clientId: 'c-1', standard: 'ISO 9001:2015',
            positiveObservations: "Clause 7.2 Competence: the 'FORM-004 Employee Training Record' and 'FORM-005 Employee Competency Matrix' provided objective evidence of the organization's arrangements.",
            checklistProgress: []
        });
        expect(hits).toHaveLength(0);
    });

    it('does not read a singular Employee-titled document as a count', () => {
        const hits = w12({
            id: 'r2', client: 'KTD Select', clientId: 'c-1', standard: 'ISO 9001:2015',
            executiveSummary: 'Sampled 4 Employee Training records against the competence requirement.',
            checklistProgress: []
        });
        expect(hits).toHaveLength(0);
    });

    it('still warns on a genuinely stated headcount that disagrees with the profile', () => {
        const hits = w12({
            id: 'r3', client: 'KTD Select', clientId: 'c-1', standard: 'ISO 9001:2015',
            checklistProgress: [{ status: 'conform', comment: '4 now total employees confirmed at the opening meeting.' }]
        });
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].message).toContain('4 employees');
    });
});

// W25 — a finding cited against a bare top-level clause number ("7", "9")
// when the KB's own inventory for the audited standard shows that parent
// has subclauses. The permanent fix for the live defect that triggered this
// rule ("Clause 7 (Management)" cited on a Minor NC — ISO 9001:2015 Clause 7
// spans 7.1 Resources through 7.5 Documented information).
describe('W25 — bare parent-clause citation against a KB clause inventory', () => {
    function kbWithClause7Subclauses() {
        return {
            standards: [{
                name: 'ISO 9001:2015',
                status: 'ready',
                clauses: [
                    { clause: '7', title: 'Support' },
                    { clause: '7.1', title: 'Resources' },
                    { clause: '7.2', title: 'Competence' },
                    { clause: '7.3', title: 'Awareness' },
                    { clause: '7.4', title: 'Communication' },
                    { clause: '7.5', title: 'Documented information' },
                    // Clause 9 is present but deliberately carries no children,
                    // to prove a bare parent that IS a genuine KB leaf stays silent.
                    { clause: '9', title: 'Performance evaluation' }
                ]
            }]
        };
    }

    beforeEach(() => {
        window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], knowledgeBase: kbWithClause7Subclauses() };
    });

    function w25(warnings) {
        return warnings.filter((w) => String(w.id || '').indexOf('W25') === 0);
    }

    it('a Minor NC cited as bare "7" trips the warning and lists the KB subclauses', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '7', department: 'Management', comment: 'Insufficient competence records on file for the process.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        const hits = w25(result.warnings);
        expect(hits).toHaveLength(1);
        expect(hits[0].severity).toBe('warning');
        expect(hits[0].message).toContain('Clause 7');
        expect(hits[0].message).toContain('7.1');
        expect(hits[0].message).toContain('7.5');
    });

    it('a finding correctly cited against subclause "7.2" does not trip the warning', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '7.2', department: 'Management', comment: 'Insufficient competence records on file for the process.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        expect(w25(result.warnings)).toHaveLength(0);
    });

    it('an Observation cited as bare "7" also trips the warning (not just NC/OFI)', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'observation', clause: '7', department: 'Management', comment: 'Training plan review noted for the department this cycle.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        expect(w25(result.warnings)).toHaveLength(1);
    });

    it('a bare parent clause with NO KB inventory for the standard raises nothing', () => {
        window.state.knowledgeBase = undefined; // no KB at all
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '7', department: 'Management', comment: 'Insufficient competence records on file for the process.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        expect(w25(result.warnings)).toHaveLength(0);
    });

    it('a bare parent clause that is a genuine leaf in the KB (no subclauses recorded) raises nothing', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: '9', department: 'Management', comment: 'Analysis of customer satisfaction data was incomplete for the period.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        expect(w25(result.warnings)).toHaveLength(0);
    });

    it('a FOCUS.n internal tracking reference is skipped — not double-reported alongside B1', () => {
        const report = baseReport({
            standard: 'ISO 9001:2015',
            checklistProgress: [
                { status: 'nc', ncrType: 'minor', clause: 'FOCUS.2', department: 'Management', comment: 'Insufficient competence records on file for the process.' }
            ]
        });
        const result = window.ReportIntegrity.check({ report, auditPlan: { auditType: 'Surveillance' }, client: baseClient() });

        expect(w25(result.warnings)).toHaveLength(0);
    });
});

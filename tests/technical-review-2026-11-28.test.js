// Technical quality review of PC Connection's report AR-PCI-2026-02, 28 Nov
// 2026, against ISO/IEC 17021-1 reporting principles. Generic fixes, for
// single-standard and integrated reports alike; none changes a finding, its
// grading, a register record or the certification decision.
//   1. Clauses are cited against the finding's own standard(s), resolved by
//      concept in the standards registry ("10.2 / 10.1" is two standards).
//   2. A recommendation with only minor NCs is subject to acceptance of the
//      correction and corrective action plans, not to their closure.
//   3. The issued-report fingerprint keeps the old sentence, so the wording
//      change does not mark every issued report "modified since issue".
//   4. The certification-process statement is deterministic and factual; the
//      AI's impact/risk/readiness text and concerns are not used.
//   5. No conformity percentage is printed.
//   6. Report Integrity warns (W36) on a nonconformity raised where a
//      previous audit's one is still open, (W37) on an unjustified audit
//      duration, and (W38) on an internal-audit NC not checked against the
//      programme.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const STD = 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019';
const NC092 = 'ISO/IEC 27001:2022 clause 10.2, and ISO 22301:2019 and ISO/IEC 20000-1:2018 clause 10.1, require the organization to react to a nonconformity, evaluate the need for action to eliminate its causes, implement any action needed and review its effectiveness.';

beforeAll(() => {
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    window.CONSTANTS = { STATUS: { FINALIZED: 'Finalized' } };
    for (const f of ['./checklist-standards.js', './report-stats.js', './report-executive.js', './report-integrity.js', './report-findings-ops.js']) {
        loadScript(f, { params: { module: undefined } });
    }
});

describe('ReportStats.citeFinding', () => {
    const cite = (f, s) => window.ReportStats.citeFinding(f, s === undefined ? STD : s);

    it('cites a tagged finding against its standard', () => {
        expect(cite({ clause: '9.2', criterionRef: '9.2 (22301)' })).toBe('ISO 22301:2019 clause 9.2');
        expect(cite({ clause: '8.6.2', criterionRef: '8.6.2 (20000)' })).toBe('ISO/IEC 20000-1:2018 clause 8.6.2');
    });

    it('cites an integrated finding against every standard', () => {
        expect(cite({ clause: '7.5', criterionRef: '7.5.3 (integrated)' }))
            .toBe('ISO/IEC 20000-1:2018, ISO/IEC 27001:2022 and ISO 22301:2019 clause 7.5.3');
    });

    it('pairs "10.2 / 10.1" by meaning, using the statement to choose', () => {
        expect(cite({ clause: '10.2 / 10.1', ncrDescription: NC092 }))
            .toBe('ISO/IEC 27001:2022 clause 10.2 / ISO/IEC 20000-1:2018 and ISO 22301:2019 clause 10.1');
        // With nothing to choose by, the reference stays as recorded.
        expect(cite({ clause: '10.2 / 10.1' })).toBe('');
    });

    it('names the one standard a reference belongs to, and Annex A as controls', () => {
        expect(cite({ clause: 'A.5.9' })).toBe('ISO/IEC 27001:2022 Annex A control A.5.9');
        expect(cite({ clause: '8.6.2' })).toBe('ISO/IEC 20000-1:2018 clause 8.6.2');
    });

    it('does not attribute a shared or ambiguous clause by number alone', () => {
        expect(cite({ clause: '8.3' })).toBe('');
        expect(cite({ clause: '8.1' })).toBe('');
        expect(cite({ clause: 'FOCUS.3' })).toBe('');
    });

    it('works for a single-standard report', () => {
        expect(cite({ clause: '8.5.2' }, 'ISO 9001:2015')).toBe('ISO 9001:2015 clause 8.5.2');
    });
});

describe('recommendation wording', () => {
    const R = () => window.ReportStats;
    it('makes minor nonconformities subject to acceptance of the plans', () => {
        expect(R().recommendationText('Recertification', { majorNC: 0, minorNC: 4 }))
            .toBe("Recertification is recommended subject to the certification body's review and acceptance of the correction and corrective action plans for the minor nonconformities.");
        expect(R().recommendationText('Recertification', { majorNC: 0, minorNC: 4 })).not.toMatch(/closure/);
    });

    it('makes a major nonconformity subject to verification before the decision', () => {
        expect(R().recommendationText('Surveillance 1', { majorNC: 1, minorNC: 2 }))
            .toBe("Continued certification is recommended subject to the certification body's verification of the correction and corrective action for the major nonconformity, and its review and acceptance of the correction and corrective action plans for the minor nonconformities.");
        expect(R().recommendationText('Stage 2', { majorNC: 0, minorNC: 0 })).toBe('Recommended for certification.');
    });

    it('fingerprints issued reports on the sentence they were issued with', () => {
        expect(R().recommendationFingerprint('Recertification', { majorNC: 0, minorNC: 4 }))
            .toBe('Recertification is recommended subject to satisfactory closure of applicable nonconformities.');
        expect(R().recommendationFingerprint('Surveillance', { majorNC: 1, minorNC: 0 }))
            .toBe('Continued certification is recommended subject to satisfactory closure of the identified nonconformities, including verification of implemented corrective actions for major nonconformities.');
        const built = R().build({ report: { auditType: 'Recertification' }, hydratedProgress: [{ status: 'nc', ncrType: 'minor', clause: '9.2' }] });
        expect(built.recommendationKey).toBe('Recertification is recommended subject to satisfactory closure of applicable nonconformities.');
        for (const f of ['ai-service.js', 'execution-reporting.js']) {
            const src = fs.readFileSync(path.resolve(f), 'utf8');
            expect(src, f).toContain('recommendation: rs.recommendationKey != null ? rs.recommendationKey : rs.recommendation');
        }
    });
});

describe('executive summary', () => {
    const d = (minor) => ({
        report: { id: 'r-' + minor, standard: STD, auditType: 'Recertification', client: 'PC' },
        auditPlan: {},
        hydratedProgress: [
            { status: 'nc', ncrType: 'minor', clause: '9.2', criterionRef: '9.2 (22301)', ncrDescription: 'x', comment: 'y' },
            { status: 'nc', ncrType: 'minor', clause: '10.2 / 10.1', ncrDescription: NC092, comment: 'y' },
            { status: 'nc', ncrType: 'minor', clause: '7.5', criterionRef: '7.5.3 (integrated)', ncrDescription: 'x', comment: 'y' },
            { status: 'conform', clause: '5.1', comment: 'ok' }
        ].slice(minor ? 0 : 3),
        stats: {}
    });

    it('cites each finding against its standard in Key Findings', () => {
        const lines = window.ReportExecutive.buildKeyFindingsSummary(d(3), window.ReportExecutive.getStats ? window.ReportExecutive.getStats(d(3)) : { minorNC: 3 });
        const text = lines.join(' ');
        expect(text).toContain('ISO 22301:2019 clause 9.2');
        expect(text).toContain('ISO/IEC 27001:2022 clause 10.2 / ISO/IEC 20000-1:2018 and ISO 22301:2019 clause 10.1');
        expect(text).toContain('ISO/IEC 20000-1:2018, ISO/IEC 27001:2022 and ISO 22301:2019 clause 7.5.3');
        expect(text).not.toMatch(/\((22301|integrated)\)/);
    });

    it('never uses the AI for the certification-process statement or concerns', async () => {
        window.AI_SERVICE = {
            callProxyAPI: async () => JSON.stringify({
                strengths: ['Document control is well established.'],
                businessImpact: 'Failure to address Clause 9.2 may affect the scope of verification at the next audit.',
                risks: 'Certification may be jeopardized.',
                forwardOutlook: 'The audit team has high confidence in continued conformity.',
                concerns: ['Certification status is at risk.']
            })
        };
        const out = await window.ReportExecutive.generateExecutiveSummary(d(3));
        delete window.AI_SERVICE;
        expect(out.html).toContain('Certification Process');
        expect(out.html).toContain('reviews and accepts the correction and corrective action plans before the certification decision');
        expect(out.html).not.toMatch(/may affect the scope|jeopardi|high confidence|status is at risk/i);
        expect(out.html).not.toMatch(/Forward Readiness|Impact &amp; Risk/);
        expect(out.html).not.toMatch(/satisfactory closure/);
    });

    it('prints no conformity percentage', () => {
        const fb = window.ReportExecutive.fallbackExecSummaryData(d(0));
        expect(fb.strengths.join(' ')).not.toMatch(/%/);
        const er = fs.readFileSync(path.resolve('execution-reporting.js'), 'utf8');
        expect(er).not.toContain('<div class="stat-lbl">Conformity %');
    });
});

describe('CAR form criterion', () => {
    it('cites the finding against its own standards', () => {
        const item = { checklistId: 'c', itemIdx: 'RECERT-0', status: 'nc', ncrType: 'minor', clause: '10.2 / 10.1', ncrDescription: NC092, comment: 'Evidence.', caDueDate: '2026-12-11' };
        const d = { report: { id: 'r1', standard: STD, checklistProgress: [item], reportConfig: { annexes: { capa: true } } }, hydratedProgress: [item], auditPlan: {}, cbSettings: {} };
        const sec = window.ReportFindingsOps.sections(d).find((s) => s.key === 'carForms');
        expect(sec).toBeTruthy();
        expect(sec.bodyHtml).toContain('ISO/IEC 27001:2022 clause 10.2 / ISO/IEC 20000-1:2018 and ISO 22301:2019 clause 10.1');
    });
});

describe('Report Integrity: decisions left to the auditor', () => {
    let report, plan;
    beforeEach(() => {
        window.state = {
            auditReports: [], clients: [], auditPlans: [],
            ncrs: [
                { id: 85, clientId: 'c1', clientName: 'PC', auditId: 'prev', clause: '7.5 (Integrated)', criterionRef: '7.5.3', severity: 'minor', status: 'Open' },
                { id: 88, clientId: 'c1', clientName: 'PC', auditId: 'p1', clause: '7.5', criterionRef: '7.5.3 (integrated)', severity: 'minor', status: 'Open', sourceItemIdx: 'IMS-12' },
                { id: 91, clientId: 'c1', clientName: 'PC', auditId: 'p1', clause: '9.2', criterionRef: '9.2 (22301)', severity: 'minor', status: 'Open', sourceItemIdx: 'RECERT-5' },
                { id: 70, clientId: 'other', clientName: 'KTD', auditId: 'x', clause: '9.2', severity: 'minor', status: 'Open' }
            ]
        };
        report = {
            id: 'r1', clientId: 'c1', client: 'PC', planId: 'p1', standard: STD, auditType: 'Recertification',
            checklistProgress: [
                { itemIdx: 'IMS-12', status: 'nc', ncrType: 'minor', clause: '7.5', criterionRef: '7.5.3 (integrated)', ncrDescription: 'No defined way to request and authorize changes.', comment: 'Document Control Policy reviewed.' },
                { itemIdx: 'RECERT-5', status: 'nc', ncrType: 'minor', clause: '9.2', criterionRef: '9.2 (22301)', ncrDescription: 'The 2026 internal audit did not include the BCMS.', comment: 'The 2026 internal audit summary report (dated 9 Jun 2026) assessed the ISMS and SMS.' }
            ]
        };
        plan = { id: 'p1', auditType: 'Recertification', durationCalculation: { baselineDays: 4.5, finalDays: 1.5, justification: '', methodologyVersion: 'ENTER-APPROVED-VERSION', approvedBy: 'Admin', approvedAt: '2026-11-17', offAgendaReview: { days: 3 } } };
    });
    const run = () => window.ReportIntegrity.check({ report, auditPlan: plan, client: { id: 'c1', name: 'PC' } });
    const ids = (res, prefix) => res.warnings.filter((w) => w.id.startsWith(prefix));

    it('W36: flags NCR-088 against open NCR-085 for a grading decision', () => {
        const w = ids(run(), 'W36');
        expect(w).toHaveLength(1);
        expect(w[0].id).toBe('W36-88');
        expect(w[0].message).toContain('NCR-088');
        expect(w[0].message).toContain('NCR-085');
        expect(w[0].message).toContain('does not state that its grading was reassessed');
        expect(w[0].suggestion).toContain('not changed automatically');
    });

    it('W36: notes a stated grading, ignores closed and other clients’ records', () => {
        report.checklistProgress[0].ncrDescription += ' Graded minor: the process works elsewhere.';
        expect(ids(run(), 'W36')[0].message).toContain('states its grading');
        window.state.ncrs[0].status = 'Closed';
        expect(ids(run(), 'W36')).toHaveLength(0);
    });

    it('W37: flags an unjustified duration and a placeholder methodology version', () => {
        const w = ids(run(), 'W37');
        expect(w).toHaveLength(1);
        expect(w[0].message).toContain('"ENTER-APPROVED-VERSION"');
        expect(w[0].message).toContain('1.5 of the 4.5 auditor-days are in the audit agenda and 3 are remote document review outside it');
        plan.durationCalculation.justification = 'Pre-audit document review counted toward duration per CB procedure P-07: …';
        plan.durationCalculation.methodologyVersion = 'DM-2026.1';
        expect(ids(run(), 'W37')).toHaveLength(0);
    });

    it('W38: asks for the internal audit programme behind an internal-audit NC', () => {
        const w = ids(run(), 'W38');
        expect(w).toHaveLength(1);
        expect(w[0].message).toContain('9.2 (22301)');
        // A claim in the statement is not evidence (NCR-091, 28 Nov 2026).
        report.checklistProgress[1].ncrDescription += ' Graded minor: an earlier audit in the cycle covered the BCMS, so the internal audit programme extends to ISO 22301.';
        expect(ids(run(), 'W38')[0].message).toContain('relies on the programme, which the evidence does not show');
        report.checklistProgress[1].comment += ' The internal audit programme 2024–2026 was reviewed: the BCMS was audited in March 2025.';
        expect(ids(run(), 'W38')).toHaveLength(0);
    });

    it('changes nothing it checks', () => {
        const before = JSON.stringify({ report, plan, ncrs: window.state.ncrs });
        run();
        expect(JSON.stringify({ report, plan, ncrs: window.state.ncrs })).toBe(before);
    });
});

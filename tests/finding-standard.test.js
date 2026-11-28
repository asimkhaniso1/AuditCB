// PC Connection's integrated recertification (ISO 20000-1, 27001, 22301),
// November draft, 2026-11-19:
//  - the RTO/RPO finding at 22301 8.2.2 (business impact analysis) printed
//    27001's "information security risk assessment" requirement, because
//    every clause was looked up in one standard;
//  - the corrective-action table named all three standards beside every NC,
//    Annex A controls included;
//  - page 4 said "The audit assessed 109 checklist items" for 69 of 109;
//  - page 4's Previous Findings Status was a bare dash while page 3 said the
//    previous NCs remain open.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const STD = 'ISO 20000-1:2018, ISO 27001:2022, ISO 22301:2019';
const KB = {
    standards: [
        { name: 'ISO/IEC 27001:2022', status: 'ready', clauses: [
            { clause: '4.4', title: 'Information security management system', requirement: 'Establish an ISMS.' },
            { clause: '7.5', title: 'Documented information', requirement: 'ISMS documented information.' },
            { clause: '8.2', title: 'Information security risk assessment', requirement: 'Perform information security risk assessments.' }] },
        { name: 'ISO 22301:2019', status: 'ready', clauses: [
            { clause: '4.4', title: 'Business continuity management system', requirement: 'Establish a BCMS.' },
            { clause: '7.5', title: 'Documented information', requirement: 'BCMS documented information.' },
            { clause: '8.2.2', title: 'Business impact analysis', requirement: 'Determine prioritized timeframes for resuming activities.' }] },
        { name: 'ISO/IEC 20000-1:2018', status: 'ready', clauses: [
            { clause: '4.4', title: 'Service management system', requirement: 'Establish an SMS.' },
            { clause: '7.5', title: 'Documented information', requirement: 'SMS documented information.' },
            { clause: '8.2.2', title: 'Plan the services', requirement: 'Plan the services.' },
            { clause: '8.6.2', title: 'Service request management', requirement: 'Fulfil service requests.' }] }
    ]
};

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./ai-service.js', { params: { module: undefined } });
    loadScript('./checklist-standards.js', { params: { module: undefined } });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-executive.js', { params: { module: undefined } });
    loadScript('./report-integrity.js', { params: { module: undefined } });
    loadScript('./execution-reporting.js', { global: true });
});
beforeEach(() => {
    window.state = { knowledgeBase: KB, auditReports: [], clients: [], auditPlans: [], ncrs: [] };
    globalThis.state = window.state;
});

describe('each finding belongs to its own standard', () => {
    const own = (f, std = STD) => window.ReportStats.resolveFindingStandard(f, std);

    it('Annex A is ISO 27001, a tag names the standard, a clause only one standard has resolves', () => {
        expect(own({ clause: 'A.5.9, A.5.10, A.5.12' })).toMatchObject({ standard: 'ISO 27001:2022', basis: 'annex-a' });
        expect(own({ clause: '8.2.2', criterionRef: '8.2.2 (22301)' })).toMatchObject({ standard: 'ISO 22301:2019', basis: 'tag' });
        expect(own({ clause: '6.1.3 (27001)' })).toMatchObject({ standard: 'ISO 27001:2022', basis: 'tag' });
        expect(own({ clause: '8.6.2' })).toMatchObject({ standard: 'ISO 20000-1:2018', basis: 'inventory' });
    });

    it('never guesses between standards: 8.2.2 and 4.4 are in more than one, with different requirements', () => {
        expect(own({ clause: '8.2.2' })).toMatchObject({ standard: '', basis: 'ambiguous' });
        expect(own({ clause: '4.4' })).toMatchObject({ standard: '', basis: 'ambiguous' });
    });

    it('a clause every standard shares under the same title, or tagged Integrated, is common', () => {
        expect(own({ clause: '7.5' })).toMatchObject({ standard: '', basis: 'common' });
        expect(own({ clause: '9.1 (Integrated)' })).toMatchObject({ standard: '', basis: 'common' });
    });

    it('a single-standard report is unchanged', () => {
        expect(own({ clause: '8.2.2' }, 'ISO 9001:2015')).toMatchObject({ standard: 'ISO 9001:2015', basis: 'single' });
    });
});

describe('the requirement printed beside a finding', () => {
    it('comes from the finding’s own standard, and is left to the question when none is recorded', () => {
        const kb = window._kbRequirementFor;
        expect(kb({ clause: '8.2.2' }, STD)).toBeNull();
        expect(kb({ clause: '8.2.2', criterionRef: '8.2.2 (22301)' }, STD)).toMatchObject({ title: 'Business impact analysis' });
        expect(kb({ clause: '8.6.2' }, STD)).toMatchObject({ title: 'Service request management' });
    });
});

describe('the corrective-action criterion cell', () => {
    const cell = (f) => { const el = document.createElement('div'); el.innerHTML = window._formalCriterionCell(f, STD); return el.textContent; };

    // Cited from the standards registry (ReportStats.citeFinding), technical
    // review 28 Nov 2026: the standard's full name, "clause" or "Annex A control".
    it('names only the finding’s own standard', () => {
        expect(cell({ clause: 'A.5.9' })).toBe('ISO/IEC 27001:2022 Annex A control A.5.9');
        expect(cell({ clause: '8.6.2' })).toBe('ISO/IEC 20000-1:2018 clause 8.6.2');
        expect(cell({ clause: '8.2.2', criterionRef: '8.2.2 (22301)' })).toBe('ISO 22301:2019 clause 8.2.2');
    });

    it('cites a two-standard reference against each standard, not the first', () => {
        const stmt = 'ISO/IEC 27001:2022 clause 10.2, and ISO 22301:2019 and ISO/IEC 20000-1:2018 clause 10.1, require the organization to react to a nonconformity and take corrective action.';
        expect(cell({ clause: '10.2 / 10.1', ncrDescription: stmt }))
            .toBe('ISO/IEC 27001:2022 clause 10.2 / ISO/IEC 20000-1:2018 and ISO 22301:2019 clause 10.1');
        expect(cell({ clause: '7.5', criterionRef: '7.5.3 (integrated)' }))
            .toBe('ISO/IEC 20000-1:2018, ISO/IEC 27001:2022 and ISO 22301:2019 clause 7.5.3');
    });

    // PC Connection export of 28 Nov 2026: the CA table still printed NCR-092 as
    // "ISO 27001:2022 — Clause 10.2 / 10.1". Its rows came from
    // ReportStats.correctiveActions without the statement that pairs the two
    // numbers with their standards, and the fallback named the first one's.
    it('cites a corrective-action row for a two-standard reference from its statement', () => {
        const stmt = 'ISO/IEC 27001:2022 clause 10.2, and ISO 22301:2019 and ISO/IEC 20000-1:2018 clause 10.1, require the organization to react to a nonconformity and take corrective action.';
        const item = { checklistId: 'c', itemIdx: 'R0', status: 'nc', ncrType: 'minor', clause: '10.2 / 10.1', ncrDescription: stmt, comment: 'Findings from the previous audit were reviewed.' };
        const rs = window.ReportStats.build({ report: { standard: STD, checklistProgress: [item] }, hydratedProgress: [item] });
        const row = window.ReportStats.correctiveActions(rs, {})[0];
        expect(row.ncrDescription).toBe(stmt);
        expect(cell(row)).toBe('ISO/IEC 27001:2022 clause 10.2 / ISO/IEC 20000-1:2018 and ISO 22301:2019 clause 10.1');
    });

    it('never names one standard for a reference with several clause numbers', () => {
        expect(cell({ clause: '10.2 / 10.1' })).toBe('Clause 10.2 / 10.1');
        expect(cell({ clause: '4.4, 6.1' })).toBe('Clause 4.4, 6.1');
    });

    it('names none, rather than all three, when the standard is not recorded or the clause is common', () => {
        expect(cell({ clause: '8.2.2' })).toBe('Clause 8.2.2');
        expect(cell({ clause: '7.5' })).toBe('Clause 7.5');
    });
});

describe('Report Integrity', () => {
    it('warns (W34) for an NC whose standard is not recorded, and not for one that is', () => {
        const report = { id: 'r1', standard: STD, checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'A-0', clause: '8.2.2', status: 'nc', ncrType: 'minor', ncrDescription: 'x' },
            { checklistId: 'cl1', itemIdx: 'A-1', clause: '8.2.2', criterionRef: '8.2.2 (22301)', status: 'nc', ncrType: 'minor', ncrDescription: 'x' },
            { checklistId: 'cl1', itemIdx: 'A-2', clause: 'A.5.9', status: 'nc', ncrType: 'minor', ncrDescription: 'x' },
            { checklistId: 'cl1', itemIdx: 'A-3', clause: '4.4', status: 'nc', ncrType: 'observation' }
        ] };
        const res = window.ReportIntegrity.check({ report, auditPlan: { id: 'p1', auditType: 'Recertification' }, client: {} });
        const w34 = res.warnings.filter((w) => w.id === 'W34');
        expect(w34).toHaveLength(1);
        expect(w34[0].message).toContain('clause 8.2.2');
        expect(w34[0].remedy || w34[0].fix || w34[0].suggestion || JSON.stringify(w34[0])).toContain('8.2.2 (22301)');
    });
});

describe('page 4 Audit Outcome Summary', () => {
    const progress = () => [
        ...Array.from({ length: 6 }, (_, i) => ({ clause: '5.' + i, status: 'conform' })),
        { clause: '7.5', status: 'nc', ncrType: 'minor', ncrDescription: 'x' },
        { clause: '9.2', status: 'nc', ncrType: 'observation' },
        { clause: 'A.5.9', status: '' },
        { clause: 'A.5.10', status: 'not_sampled' },
        { clause: 'A.5.11', status: 'na' }
    ];
    const summary = (report) => window.ReportExecutive.buildAuditOutcomeSummary(
        { report: Object.assign({ id: 'r1', standard: STD, checklistProgress: [] }, report), hydratedProgress: progress(), auditPlan: { auditType: 'Recertification' }, stats: {} },
        { findings: [], strengths: [] });

    it('says how many of the applicable items were assessed', () => {
        const s = summary({});
        expect(s.conclusion).toMatch(/^Of 10 applicable checklist items, 8 were assessed within the sampled scope: /);
        expect(s.conclusion).toContain('Audit coverage across applicable items was 80%.');
        expect(s.conclusion).not.toMatch(/assessed 10 checklist items/);
    });

    it('Previous Findings Status is the same statement as page 3, never a bare dash', () => {
        const s = summary({});
        expect(s.previousFindingsStatus).not.toBe('—');
        expect(s.previousFindingsStatus).toBe(window._derivePreviousFindingsStatus({ report: { id: 'r1', standard: STD, checklistProgress: [] }, auditPlan: { auditType: 'Recertification' } }));
        expect(summary({ previousFindingsStatus: 'Previous NCs verified and closed on site.' }).previousFindingsStatus).toBe('Previous NCs verified and closed on site.');
    });

    it('the no-strengths line does not call a recertification a surveillance audit', () => {
        expect(summary({}).strengths[0]).toBe('No specific strengths were separately highlighted during this audit.');
    });
});

// R1 of the checklist-engine remediation (.planning/checklist-engine/PHASE1.md):
// coverage figures must say what they are.
//
//   - Planned is not audited. A checklist whose every question is still
//     "Not checked" plans full coverage and has audited nothing.
//   - A question credits only what it cites. A 20000-1 "8.2.2 Plan the
//     services" question is not 22301 8.2.2 (business impact analysis).
//   - A prior checklist earns cycle credit only for questions answered on a
//     final report — never for a plan that was cancelled or never carried out.
//   - The audit being planned is not one of its own "prior audits".
//   - Critical completeness issues block release; the combined status has a
//     "Requires auditor review" state and never says "validated".
//   - Registry corrections: 20000-1 6.3 is the SMS plan (not "planning of
//     changes"), complaints are 20000-1 8.3.2, 22301 holds 8.4.4 and 8.4.5.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

function load() {
    window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
    ['./checklist-standards.js', './checklist-qa.js', './checklist-coverage.js']
        .forEach(f => loadScript(f, { params: { module: undefined } }));
}

const CS = () => window.ChecklistStandards;
const CC = () => window.ChecklistCoverage;
const QA = () => window.ChecklistQA;

function mandatory(stdId) {
    return CS().byId(stdId).clauses.filter(c => c.mandatory).map(c => c.ref);
}

/** One RECERT section, one question per {stdId, ref}. */
function checklistFor(pairs, extra) {
    return Object.assign({
        id: 'cl-now', name: 'Recertification checklist', auditType: 'recertification', type: 'custom',
        standardIds: Array.from(new Set(pairs.map(p => p.stdId))),
        clauses: [{
            mainClause: 'IMS', title: 'Requirements',
            subClauses: pairs.map((p, i) => ({
                clause: p.ref, title: 'Question ' + (i + 1),
                requirement: 'Verify ' + p.stdId + ' ' + p.ref + ' is implemented and effective (' + i + ').',
                refs: [{ stdId: p.stdId, ref: p.ref }]
            }))
        }]
    }, extra || {});
}

/** Every item of a checklist answered conform. */
function answeredAll(checklist) {
    const out = {};
    CC().itemKeys(checklist).forEach(k => { out[k] = true; });
    return out;
}

function ctx(over) {
    return Object.assign({
        standardIds: ['iso27001'], auditType: 'recertification', soaApplicable: [],
        cycle: { start: '2023-12-16', end: '2026-12-15', anchored: 'certificate', stages: [] },
        priorAudits: [], priorChecklists: [], priorExecuted: {}, executed: {},
        keyProcesses: [], findings: [], incidents: [], changes: [], riskDocs: []
    }, over || {});
}

describe('R1 — planned coverage is not audited coverage', () => {
    beforeEach(load);

    it('a fully planned checklist with nothing answered reports 0 audited', () => {
        const ck = checklistFor(mandatory('iso27001').map(ref => ({ stdId: 'iso27001', ref })));
        const res = CC().assess(ck, ctx());
        const row = res.coverage.clauses[0];
        expect(row.planned).toBe(row.total);
        expect(row.completed).toBe(0);
        expect(row.cycleVerified).toBe(0);
        expect(row.percentVerified).toBe(0);
    });

    it('answered questions count as completed; unanswered ones do not', () => {
        const refs = mandatory('iso27001');
        const ck = checklistFor(refs.map(ref => ({ stdId: 'iso27001', ref })));
        const keys = CC().itemKeys(ck);
        const executed = { [keys[0]]: true, [keys[1]]: true, [keys[2]]: true };
        const row = CC().assess(ck, ctx({ executed })).coverage.clauses[0];
        expect(row.completed).toBe(3);
        expect(row.cycleVerified).toBe(3);
        expect(row.planned).toBe(refs.length);
    });

    it('item keys match how execution stores answers (<mainClause>-<index>)', () => {
        const ck = checklistFor([{ stdId: 'iso27001', ref: '4.1' }, { stdId: 'iso27001', ref: '4.2' }]);
        expect(CC().itemKeys(ck)).toEqual(['IMS-0', 'IMS-1']);
        const done = CC().executedByChecklist([{ checklistProgress: [
            { checklistId: 'cl-now', itemIdx: 'IMS-0', status: 'conform' },
            { checklistId: 'cl-now', itemIdx: 'IMS-1', status: 'na' },
            { checklistId: 'cl-now', itemIdx: 'IMS-2', status: '' },
            { checklistId: 'custom', itemIdx: 0, status: 'nc', isCustom: true }
        ] }]);
        expect(done).toEqual({ 'cl-now': { 'IMS-0': true } });
    });
});

describe('R1 — a question credits only the clauses it cites', () => {
    beforeEach(load);

    it('a 20000-1 8.2.2 question does not cover 22301 8.2.2 (BIA) or 27001 8.2', () => {
        const ck = checklistFor([{ stdId: 'iso20000', ref: '8.2.2' }], { standardIds: ['iso27001', 'iso22301', 'iso20000'] });
        const cov = CC().coverageOf(ck, ['iso27001', 'iso22301', 'iso20000']);
        expect(Object.keys(cov.refs)).toEqual(['iso20000::8.2.2']);
    });

    it('QA reports 22301 8.2.2 as missing when only 20000-1 asks "8.2.2"', () => {
        const ids = ['iso22301', 'iso20000'];
        const pairs = mandatory('iso22301').filter(r => r !== '8.2.2').map(ref => ({ stdId: 'iso22301', ref }))
            .concat(mandatory('iso20000').map(ref => ({ stdId: 'iso20000', ref })));
        const ck = checklistFor(pairs, { standardIds: ids });
        const res = QA().validate(ck, { standardIds: ids, auditType: 'recertification' });
        const miss = res.issues.find(i => i.code === 'MISSING_REQUIREMENT' && i.stdId === 'iso22301');
        expect(miss && miss.missing).toEqual(['8.2.2']);
    });

    it('a suggested (unconfirmed) citation earns no credit; a confirmed one does', () => {
        const ck = checklistFor([{ stdId: 'iso27001', ref: '9.2' }]);
        ck.clauses[0].subClauses[0].auditorReview = true;
        expect(Object.keys(CC().coverageOf(ck, ['iso27001']).refs)).toEqual([]);
        ck.clauses[0].subClauses[0].criterionConfirmed = true;
        expect(Object.keys(CC().coverageOf(ck, ['iso27001']).refs)).toEqual(['iso27001::9.2']);
    });

    it('a legacy question with no refs keeps its bare clause for each standard', () => {
        const ck = { id: 'old', clauses: [{ mainClause: '9', subClauses: [{ clause: '9.2', requirement: 'Internal audit' }] }] };
        expect(Object.keys(CC().coverageOf(ck, ['iso27001', 'iso22301']).refs).sort())
            .toEqual(['iso22301::9.2', 'iso27001::9.2']);
    });

    it('a sub-clause covers its parent only when the registry has no sub-clause rows for it', () => {
        // 27001 7.5 is held at parent level: "7.5.1" counts for it.
        expect(CS().refCovered({ 'iso27001::7.5.1': true }, 'iso27001', '7.5')).toBe(true);
        // 22301 8.4 has rows 8.4.2…8.4.5 of its own: "8.4.2" does not cover 8.4.
        expect(CS().refCovered({ 'iso22301::8.4.2': true }, 'iso22301', '8.4')).toBe(false);
        // A parent never covers a sub-clause.
        expect(CS().refCovered({ 'iso22301::8.4': true }, 'iso22301', '8.4.4')).toBe(false);
    });
});

describe('R1 — cycle credit comes only from audited prior results', () => {
    beforeEach(load);

    it('a prior checklist with no answers on a final report earns no credit', () => {
        const refs = mandatory('iso27001');
        const prior = checklistFor(refs.map(ref => ({ stdId: 'iso27001', ref })), { id: 'cl-prior' });
        const res = CC().assess(checklistFor([]), ctx({ priorChecklists: [prior] }));
        const row = res.coverage.clauses[0];
        expect(row.cycle).toBe(0);
        expect(res.issues.map(i => i.code)).toContain('PRIOR_RESULTS_UNAVAILABLE');
    });

    it('a prior checklist answered on a final report is credited for what was answered', () => {
        const refs = mandatory('iso27001');
        const prior = checklistFor(refs.map(ref => ({ stdId: 'iso27001', ref })), { id: 'cl-prior' });
        const res = CC().assess(checklistFor([]), ctx({ priorChecklists: [prior], priorExecuted: { 'cl-prior': answeredAll(prior) } }));
        const row = res.coverage.clauses[0];
        expect(row.cycle).toBe(row.total);
        expect(row.cycleVerified).toBe(row.total);
        expect(row.earlierAudited).toBe(row.total);
    });

    it('buildContext: excludes the current plan, cancelled and future plans; reads only final reports', () => {
        const prior = checklistFor([{ stdId: 'iso27001', ref: '5.1' }], { id: 'cl-prior' });
        const cancelled = checklistFor([{ stdId: 'iso27001', ref: '9.2' }], { id: 'cl-cancel' });
        const draftOnly = checklistFor([{ stdId: 'iso27001', ref: '9.3' }], { id: 'cl-draft' });
        const current = checklistFor([{ stdId: 'iso27001', ref: '4.1' }], { id: 'cl-now', clientId: 'c-1' });
        window.state = {
            clients: [{ id: 'c-1', name: 'Client', certificates: [{ standard: 'ISO/IEC 27001:2022', initialDate: '2023-12-16', expiryDate: '2026-12-15' }] }],
            auditPlans: [
                { id: 'p-s1', clientId: 'c-1', startDate: '2024-12-02', auditType: 'Surveillance 1', selectedChecklists: ['cl-prior'] },
                { id: 'p-x', clientId: 'c-1', startDate: '2025-03-01', status: 'Cancelled', selectedChecklists: ['cl-cancel'] },
                { id: 'p-s2', clientId: 'c-1', startDate: '2025-12-01', auditType: 'Surveillance 2', selectedChecklists: ['cl-draft'] },
                { id: 'p-now', clientId: 'c-1', startDate: '2026-11-03', auditType: 'Recertification', selectedChecklists: ['cl-now'] },
                { id: 'p-later', clientId: 'c-1', startDate: '2026-12-01', auditType: 'Special', selectedChecklists: [] }
            ],
            checklists: [prior, cancelled, draftOnly, current],
            auditReports: [
                { id: 'r-s1', planId: 'p-s1', status: 'Finalized', checklistProgress: [{ checklistId: 'cl-prior', itemIdx: 'IMS-0', status: 'conform' }] },
                { id: 'r-s2', planId: 'p-s2', status: 'Draft', checklistProgress: [{ checklistId: 'cl-draft', itemIdx: 'IMS-0', status: 'conform' }] },
                { id: 'r-now', planId: 'p-now', status: 'In Progress', checklistProgress: [{ checklistId: 'cl-now', itemIdx: 'IMS-0', status: 'nc' }] }
            ],
            ncrs: [], complaints: [], appeals: []
        };
        const c = CC().buildContext(current, { planId: 'p-now', now: '2026-11-04' });
        expect(c.priorAudits.map(p => p.id)).toEqual(['p-s1', 'p-s2']);
        expect(Object.keys(c.priorExecuted)).toEqual(['cl-prior']);
        expect(c.executed).toEqual({ 'IMS-0': true });

        const res = CC().assess(current, c);
        expect(res.coverage.cycle.priorAudits).toBe(2);
        expect(res.coverage.cycle.priorWithResults).toBe(1);
        const row = res.coverage.clauses[0];
        // 4.1 planned + answered here; 5.1 audited at S1; 9.3 (draft report) not credited.
        expect(row.completed).toBe(1);
        expect(row.earlierAudited).toBe(1);
        expect(row.gaps).toContain('9.3');
        expect(row.gaps).toContain('9.2');
    });

    it('reports a prior audit with no checklist per audit, not audits minus checklists', () => {
        const res = CC().assess(checklistFor([]), ctx({
            priorAudits: [{ id: 'a', checklistsOnFile: 2, resultsOnFile: 2 }, { id: 'b', checklistsOnFile: 0, resultsOnFile: 0 }],
            priorChecklists: []
        }));
        const i = res.issues.find(x => x.code === 'PRIOR_CHECKLIST_UNAVAILABLE');
        expect(i.unread).toBe(1);
    });
});

describe('R1 — critical processes count only from questions about them', () => {
    beforeEach(load);

    it('a process named only incidentally in another question is not covered', () => {
        const ck = checklistFor([{ stdId: 'iso27001', ref: '6.1.2' }]);
        ck.clauses[0].subClauses[0].criterionSource = 'process-theme';
        ck.clauses[0].subClauses[0].title = 'Information security risk assessment and treatment';
        ck.clauses[0].subClauses[0].requirement = 'Confirm legal and regulatory change is reflected in the risk management approach.';
        const res = CC().assess(ck, ctx({ keyProcesses: [{ name: 'Legal' }, { name: 'Risk Management' }, { name: 'Change' }] }));
        expect(res.coverage.processes.gaps.sort()).toEqual(['Change', 'Legal', 'Risk Management']);
    });

    it('a process walked by its own question is covered', () => {
        const ck = checklistFor([{ stdId: 'iso27001', ref: '8.1' }]);
        ck.clauses[0].subClauses[0].criterionSource = 'org-context';
        ck.clauses[0].subClauses[0].title = 'Client Onboarding (Core)';
        const res = CC().assess(ck, ctx({ keyProcesses: [{ name: 'Client Onboarding' }] }));
        expect(res.coverage.processes.covered).toBe(1);
    });
});

describe('R1 — gate and combined status', () => {
    beforeEach(load);

    it('critical EXCESSIVE_COUNT, MISSING_REQUIREMENT and MISSING_ANNEX_A block release', () => {
        const r = CC().readiness({}, { qa: { issues: [
            { code: 'EXCESSIVE_COUNT', severity: 'critical', message: 'x' },
            { code: 'MISSING_REQUIREMENT', severity: 'critical', message: 'x' },
            { code: 'MISSING_ANNEX_A', severity: 'critical', message: 'x' }
        ] } });
        expect(r.ready).toBe(false);
        expect(r.blockers.map(b => b.code).sort()).toEqual(['EXCESSIVE_COUNT', 'MISSING_ANNEX_A', 'MISSING_REQUIREMENT']);
    });

    it('the same codes at info / warning severity stay notes (surveillance sampling)', () => {
        const r = CC().readiness({}, { qa: { issues: [
            { code: 'MISSING_REQUIREMENT', severity: 'info', message: 'x' },
            { code: 'MISSING_ANNEX_A', severity: 'warning', message: 'x' }
        ] } });
        expect(r.ready).toBe(true);
    });

    it('no outcome label says "validated"', () => {
        Object.keys(CC().OUTCOMES).forEach(k => expect(CC().OUTCOMES[k]).not.toMatch(/validated/i));
    });

    it('an item awaiting an auditor decision gives "Requires auditor review", not a pass', () => {
        const coverage = { outcome: 'passed', counts: { critical: 0, warning: 0, info: 0 }, issues: [] };
        const qa = { counts: { critical: 0, warning: 0, info: 1 }, issues: [{ code: 'AUDITOR_REVIEW', severity: 'info', message: 'x' }] };
        expect(CC().combine(qa, coverage, {}).outcome).toBe('review');
        const resolved = { resolvedIssues: { 'AUDITOR_REVIEW||': { action: 'justified', note: 'Reviewed on site' } } };
        expect(CC().combine(qa, coverage, resolved).outcome).toBe('passed');
    });

    it('a critical gap the auditor has dispositioned no longer fails the checklist', () => {
        const issue = { code: 'RISK_CONTROL_GAP', severity: 'critical', message: 'x', itemRef: '' };
        const coverage = { outcome: 'failed', counts: { critical: 1, warning: 0, info: 0 }, issues: [issue] };
        const qa = { counts: { critical: 0, warning: 0, info: 0 }, issues: [] };
        expect(CC().combine(qa, coverage, {}).outcome).toBe('failed');
        const ck = { resolvedIssues: { 'RISK_CONTROL_GAP||': { action: 'justified', note: 'Sampled under the incident theme' } } };
        expect(CC().combine(qa, coverage, ck).outcome).toBe('passed-with-notes');
    });
});

describe('R1 — registry corrections', () => {
    beforeEach(load);

    it('ISO/IEC 20000-1 6.3 is the SMS plan and is not consolidated with "planning of changes"', () => {
        const row = CS().byId('iso20000').clauses.find(c => c.ref === '6.3');
        expect(row.title).toBe('Plan the service management system');
        expect(row.shared).toBe(null);
        const group = CS().consolidate(['iso27001', 'iso22301', 'iso20000']).common.find(g => g.shared === 'planning.changes');
        expect(group.members.map(m => m.stdId)).toEqual(['iso27001', 'iso22301']);
        const theme = CS().themesFor(['iso20000']).find(t => t.refs.indexOf('6.3') !== -1);
        expect(theme.prompt).toMatch(/SMS plan/);
    });

    it('complaints cite ISO/IEC 20000-1 8.3.2, not 8.6.3 problem management', () => {
        const p = CS().RECERT_PRIORITIES.find(x => x.id === 'incidents');
        expect(p.refsBy.iso20000).toEqual(['8.6.1', '8.3.2']);
    });

    it('risk-treatment currency cites the risk assessment and treatment clauses', () => {
        const p = CS().RECERT_PRIORITIES.find(x => x.id === 'risk-treatment');
        expect(p.shared).toBe(null);
        expect(p.refsBy.iso27001).toEqual(['6.1.2', '6.1.3', '8.2', '8.3']);
        expect(p.refsBy.iso22301).toEqual(['8.2.3']);
        Object.keys(p.refsBy).forEach(id => p.refsBy[id].forEach(ref => expect(CS().isKnownRef(id, ref), id + ' ' + ref).toBe(true)));
    });

    it('ISO 22301 holds 8.4.4 Business continuity plans and 8.4.5 Recovery, each walked by a theme', () => {
        ['8.4.4', '8.4.5'].forEach(ref => {
            expect(CS().isKnownRef('iso22301', ref)).toBe(true);
            expect(CS().planScope(['iso22301']).themeCovered.has('iso22301::' + ref)).toBe(true);
        });
    });

    it('ISO 22301 outsourced processes cite 8.1', () => {
        expect(CS().byId('iso22301').orgRefs.outsourced).toBe('8.1');
    });

    it('prompts do not impose an RPO, a CMDB, or an incident type the period may not have had', () => {
        const text = CS().themesFor(['iso22301', 'iso20000']).map(t => t.prompt).join(' ');
        expect(text).not.toMatch(/RTOs?, RPOs?|RTO\/RPO/);
        expect(text).not.toMatch(/the CMDB is verified/);
        expect(text).not.toMatch(/at least one (major incident|emergency change)/);
        expect(text).toMatch(/If no major incident occurred/);
        expect(text).toMatch(/If no emergency change was made/);
    });

    it('surveillance theme order is unchanged — new themes are appended', () => {
        expect(CS().themesFor(['iso22301']).slice(0, 6).map(t => t.id))
            .toEqual(['bcms-bia', 'bcms-risk', 'bcms-strategy', 'bcms-plans', 'bcms-exercise', 'bcms-disruption']);
        const sms = CS().themesFor(['iso20000']).map(t => t.id);
        expect(sms[sms.length - 1]).toBe('sms-plan');
    });
});

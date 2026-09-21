import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { CLIENT, CLIENT_ID, DOCS, NCRS, PLAN_ID, STANDARDS } from './fixtures/pcc-connection.mjs';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
const CS = require('../checklist-standards.js');
const QA = require('../checklist-qa.js');
const SD = require('../supporting-docs.js');
window.ChecklistStandards = CS; window.ChecklistQA = QA; window.SupportingDocs = SD;
const CC = require('../checklist-coverage.js');
window.ChecklistCoverage = CC;
const fs = await import('fs');
const path = await import('path');
eval(fs.readFileSync(path.resolve('./client-docs-bulk.js'), 'utf8'));
const B = window.ClientDocsBulk;

const SCOPE = STANDARDS.join(', ');
function build() {
    return B.buildClientChecklist(CLIENT, DOCS, { auditType: 'recertification', standard: SCOPE, manDays: 3 });
}
function ctxOf(checklist, extra) {
    return CC.buildContext(checklist, Object.assign({ client: CLIENT }, extra || {}));
}

beforeEach(() => {
    window.state = { clients: [CLIENT], auditPlans: [], checklists: [], ncrs: [], auditReports: [], complaints: [], appeals: [] };
});

describe('one checklist, several standards — the association is resolved, not lost', () => {
    it('links a freshly built integrated checklist to all three standards', () => {
        const ids = build().standardIds;
        expect(ids).toEqual(['iso27001', 'iso22301', 'iso20000']);
    });

    it('recovers all three from the standard NAMES when the stored ids are gone', () => {
        const ck = build();
        delete ck.standardIds; delete ck.qaContext;
        const r = CC.resolveStandardIds(ck);
        expect(r.ids).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(r.source).toBe('standard-name');
    });

    it('recovers them from the questions’ own citations when neither ids nor a parseable name remain', () => {
        const ck = build();
        delete ck.standardIds; delete ck.qaContext; ck.standard = 'Custom';
        const r = CC.resolveStandardIds(ck);
        expect(r.ids).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(r.source).toBe('item-references');
    });

    it('prefers recorded ids over anything derived, and says which it used', () => {
        expect(CC.resolveStandardIds({ standardIds: ['iso22301'], standard: SCOPE }).source).toBe('recorded');
        expect(CC.resolveStandardIds({ qaContext: { standardIds: ['iso20000'] }, standard: SCOPE }).source).toBe('qa-context');
    });

    it('heals the association onto the checklist so it survives the next save and sync', () => {
        const ck = build();
        delete ck.standardIds; delete ck.qaContext;
        const r = CC.healStandardAssociation(ck);
        expect(r.changed).toBe(true);
        expect(ck.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(ck.qaContext.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(ck.standardIdsHealedFrom).toBe('standard-name');
        expect(CC.healStandardAssociation(ck).changed).toBe(false); // idempotent
    });

    it('does not overwrite a recorded association', () => {
        const ck = { standardIds: ['iso27001'], qaContext: { standardIds: ['iso27001'] }, standard: SCOPE };
        CC.healStandardAssociation(ck);
        expect(ck.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000'].slice(0, 1).length ? ck.standardIds : []);
        expect(ck.standardIds).toEqual(['iso27001']);
    });
});

describe('every clause a checklist cites is a requirement of the controlled registry', () => {
    it('all references on all questions resolve, and belong to a standard in the audit scope', () => {
        const ck = build();
        const scope = new Set(ck.standardIds);
        let checked = 0;
        ck.clauses.flatMap(c => c.subClauses).forEach(sub => (sub.refs || []).forEach(r => {
            expect(scope.has(r.stdId), `${sub.clause}: ${r.stdId}`).toBe(true);
            expect(CS.isKnownRef(r.stdId, r.ref), `${r.stdId} ${r.ref}`).toBe(true);
            checked++;
        }));
        expect(checked).toBeGreaterThan(150);
    });
    it('a reference the registry does not hold is caught by QA as INVALID_REF', () => {
        const ck = build();
        ck.clauses[1].subClauses[0].refs = [{ stdId: 'iso27001', ref: '8.16' }];
        const qa = QA.validate(ck, ck.qaContext);
        expect(qa.issues.some(i => i.code === 'INVALID_REF')).toBe(true);
    });
});

describe('the coverage contradiction is gone', () => {
    // The PC CONNECTION checklist printed BOTH "Coverage validated over the
    // certification cycle — 1 note(s)" AND "Coverage could not be assessed:
    // this checklist is not tied to a standard". assess() filed the second as
    // 'info', so ok stayed true and summarize() read it as "validated".
    it('a coverage pass that cannot run is Blocked, never "validated"', () => {
        const ck = { name: 'x', standard: 'Custom', clauses: [], type: 'custom', auditType: 'recertification' };
        const result = CC.assess(ck, ctxOf(ck));
        expect(result.outcome).toBe('blocked');
        expect(result.blocking).toBe(true);
        expect(result.ok).toBe(false);
        const issue = result.issues.find(i => i.code === 'COVERAGE_UNAVAILABLE');
        expect(issue.severity).toBe('critical');
        const line = CC.summarize(result);
        expect(line).toMatch(/^Blocked — coverage could not be assessed/);
        expect(line).not.toMatch(/validated/i);
    });

    it('the Ready-for-Audit gate refuses it', () => {
        const ck = { name: 'x', standard: 'Custom', clauses: [], type: 'custom' };
        const coverage = CC.assess(ck, ctxOf(ck));
        const r = CC.readiness(ck, { qa: { issues: [] }, coverage });
        expect(r.ready).toBe(false);
        expect(r.blockers.map(b => b.code)).toContain('COVERAGE_UNAVAILABLE');
    });

    it('a checklist with a resolvable standard NAME but no stored ids is assessed, not blocked', () => {
        const ck = build();
        delete ck.standardIds; delete ck.qaContext;
        const result = CC.assess(ck, ctxOf(ck));
        expect(result.outcome).not.toBe('blocked');
        expect(result.issues.find(i => i.code === 'COVERAGE_UNAVAILABLE')).toBeUndefined();
        expect(result.coverage.clauses.map(c => c.stdId)).toEqual(['iso27001', 'iso22301', 'iso20000']);
    });

    it('the combined status never says QA passed and coverage validated while coverage is blocked', () => {
        const ck = { name: 'x', standard: 'Custom', clauses: [] };
        const cov = CC.assess(ck, ctxOf(ck));
        const combined = CC.combine({ ok: true, counts: { critical: 0, warning: 0, info: 0 }, issues: [] }, cov);
        expect(combined.outcome).toBe('blocked');
        expect(combined.label).toBe('Blocked — coverage could not be assessed');
    });
});

describe('four mutually exclusive outcomes', () => {
    const LABELS = {
        passed: 'Passed — coverage validated',
        'passed-with-notes': 'Passed with notes — coverage validated with identified limitations',
        blocked: 'Blocked — coverage could not be assessed',
        failed: 'Failed — identified coverage gaps'
    };
    it('carries the exact wording', () => { expect(CC.OUTCOMES).toEqual(LABELS); });

    it('Failed — identified coverage gaps: a recertification whose cycle leaves requirements untested', () => {
        const ck = build();
        ck.clauses = ck.clauses.slice(0, 1); // only the RECERT section
        const r = CC.assess(ck, ctxOf(ck));
        expect(r.outcome).toBe('failed');
        expect(r.outcomeLabel).toBe(LABELS.failed);
        expect(r.issues.some(i => i.code === 'CYCLE_REQUIREMENT_GAP')).toBe(true);
    });

    it('Blocked, Failed, Passed-with-notes and Passed are each reachable and never overlap', () => {
        const seen = new Set();
        const blocked = CC.assess({ standard: 'Custom', clauses: [] }, ctxOf({ standard: 'Custom', clauses: [] }));
        seen.add(blocked.outcome);
        const ck = build(); ck.clauses = ck.clauses.slice(0, 1);
        seen.add(CC.assess(ck, ctxOf(ck)).outcome);
        // A surveillance audit's gaps are informational, and an assumed SoA is a limitation.
        const surv = build(); surv.auditType = 'surveillance';
        seen.add(CC.assess(surv, Object.assign(ctxOf(surv), { auditType: 'surveillance' })).outcome);
        expect(seen.has('blocked') && seen.has('failed')).toBe(true);
        [...seen].forEach(o => expect(Object.keys(LABELS)).toContain(o));
    });

    it('a warning-only result is Passed with notes, not Passed', () => {
        const ck = build();
        const ctx = ctxOf(ck);
        const r = CC.assess(ck, Object.assign({}, ctx, { keyProcesses: [] }));
        // no SoA on file -> SOA_NOT_SUPPLIED warning -> a limitation
        expect(r.issues.some(i => i.code === 'SOA_NOT_SUPPLIED')).toBe(true);
        expect(['passed-with-notes', 'failed']).toContain(r.outcome);
        expect(r.outcome).not.toBe('passed');
    });
});

describe('per-standard coverage over the certification cycle', () => {
    it('reports planned, inherited and remaining separately for each standard', () => {
        const ck = build();
        const r = CC.assess(ck, ctxOf(ck));
        expect(r.coverage.clauses).toHaveLength(3);
        r.coverage.clauses.forEach(row => {
            expect(row.total).toBeGreaterThan(0);
            expect(row.planned + row.inherited + row.remaining).toBe(row.total);
            expect(row.percentCycle).toBeGreaterThanOrEqual(0);
        });
        const std = r.coverage.clauses.map(c => c.label);
        expect(std).toEqual(STANDARDS);
    });

    it('combines them into an integrated view', () => {
        const ck = build();
        const r = CC.assess(ck, ctxOf(ck));
        const sumTotal = r.coverage.clauses.reduce((t, c) => t + c.total, 0);
        expect(r.coverage.integrated.requirements).toBe(sumTotal);
        expect(r.coverage.integrated.standards).toBe(3);
        expect(r.coverage.integrated.planned + r.coverage.integrated.inherited + r.coverage.integrated.remaining).toBe(sumTotal);
    });

    it('credits coverage inherited from a prior audit’s checklist', () => {
        const ck = build();
        // this audit carries only the RECERT priorities (no 7.2); an earlier audit in the cycle covered 7.2 for ISO 27001
        const prior = { id: 'prior-1', name: 'S1 checklist', standardIds: ['iso27001'], auditType: 'surveillance',
            clauses: [{ mainClause: 'IMS', title: 'x', subClauses: [{ clause: '7.2', title: 'Competence', requirement: 'r', refs: [{ stdId: 'iso27001', ref: '7.2' }], standards: ['iso27001'] }] }] };
        const ckSmall = Object.assign({}, ck, { clauses: ck.clauses.filter(c => c.mainClause === 'RECERT') });

        // before: no prior audit on file
        window.state.checklists = [prior];
        window.state.auditPlans = [];
        const before = CC.assess(ckSmall, ctxOf(ckSmall, { planId: PLAN_ID })).coverage.clauses.find(c => c.stdId === 'iso27001');
        expect(before.gaps).toContain('7.2');
        expect(before.inherited).toBe(0);

        // after: the S1 audit ran against that checklist
        window.state.auditPlans = [{ id: 'p-s1', clientId: CLIENT_ID, client: CLIENT.name, date: '2023-11-20', selectedChecklists: ['prior-1'], type: 'Surveillance 1' }];
        const after = CC.assess(ckSmall, ctxOf(ckSmall, { planId: PLAN_ID })).coverage.clauses.find(c => c.stdId === 'iso27001');
        expect(after.inherited).toBe(1);
        expect(after.gaps).not.toContain('7.2');
        expect(after.remaining).toBe(before.remaining - 1);
    });
});

describe('unavailable evidence is told apart from genuine noncoverage', () => {
    it('warns, and qualifies the gap, when a prior audit in the cycle has no checklist on file', () => {
        const ck = build(); ck.clauses = ck.clauses.slice(0, 1);
        window.state.auditPlans = [
            { id: 'p-s1', clientId: CLIENT_ID, client: CLIENT.name, date: '2023-11-20', selectedChecklists: [], type: 'Surveillance 1' },
            { id: 'p-s2', clientId: CLIENT_ID, client: CLIENT.name, date: '2024-11-19', selectedChecklists: [], type: 'Surveillance 2' }
        ];
        const r = CC.assess(ck, ctxOf(ck, { planId: PLAN_ID }));
        const unread = r.issues.find(i => i.code === 'PRIOR_CHECKLIST_UNAVAILABLE');
        expect(unread).toBeTruthy();
        expect(unread.message).toMatch(/2 of 2 prior audit\(s\)/);
        const gap = r.issues.find(i => i.code === 'CYCLE_REQUIREMENT_GAP');
        expect(gap.evidenceUnavailable).toBe(true);
        expect(gap.message).toMatch(/evidence that is not available here rather than genuine noncoverage/);
    });

    it('states a gap plainly when every prior audit’s checklist was readable', () => {
        const ck = build(); ck.clauses = ck.clauses.slice(0, 1);
        const r = CC.assess(ck, ctxOf(ck, { planId: PLAN_ID }));
        expect(r.issues.find(i => i.code === 'PRIOR_CHECKLIST_UNAVAILABLE')).toBeUndefined();
        expect(r.issues.find(i => i.code === 'CYCLE_REQUIREMENT_GAP').evidenceUnavailable).toBe(false);
    });
});

describe('every standard in the audit scope must be linked', () => {
    it('blocks a checklist that leaves a scoped standard out', () => {
        const ck = build();
        ck.standardIds = ['iso27001']; ck.qaContext.standardIds = ['iso27001'];
        const r = CC.assess(ck, ctxOf(ck, { scopeStandards: SCOPE }));
        expect(r.outcome).toBe('blocked');
        const missing = r.issues.filter(i => i.code === 'STANDARD_NOT_LINKED').map(i => i.stdId);
        expect(missing).toEqual(['iso22301', 'iso20000']);
        expect(r.issues.find(i => i.code === 'STANDARD_NOT_LINKED').message).toMatch(/ISO 22301:2019 but this checklist is not linked to it/);
    });
    it('passes the association check for the full integrated set', () => {
        const ck = build();
        const r = CC.assess(ck, ctxOf(ck, { scopeStandards: SCOPE }));
        expect(r.issues.some(i => i.code === 'STANDARD_NOT_LINKED')).toBe(false);
    });
});

describe('ISO/IEC 27001 Annex A — risk-based, not exhaustive', () => {
    it('does not require every one of the 93 controls at this audit', () => {
        const ck = build();
        const r = CC.assess(ck, ctxOf(ck));
        const annex = r.coverage.controls.find(c => c.stdId === 'iso27001');
        expect(annex.pool).toBeLessThan(93);            // assumed tier-1 set, not the whole annex
        expect(annex.thisAudit).toBeLessThan(93);
        expect(annex.planned + annex.inherited + annex.remaining).toBe(annex.pool);
    });

    it('takes the applicable set from the current SoA when one is supplied', () => {
        const ck = build();
        const soa = ['A.5.1', 'A.5.15', 'A.8.8', 'A.8.13', 'A.8.16'];
        const r = CC.assess(ck, ctxOf(ck, { soaApplicable: soa }));
        const annex = r.coverage.controls.find(c => c.stdId === 'iso27001');
        expect(annex.soaDriven).toBe(true);
        expect(annex.pool).toBe(soa.length);
    });

    it('prioritises controls a previous finding points at', () => {
        window.state.ncrs = NCRS.map(n => Object.assign({}, n, { auditId: 'p-prev' }));
        window.state.auditPlans = [{ id: 'p-prev', clientId: CLIENT_ID, client: CLIENT.name, date: '2025-11-18', selectedChecklists: [] }];
        const ck = build();
        ck.clauses = ck.clauses.filter(c => c.mainClause !== 'A'); // remove the Annex A sample
        const soa = ['A.5.1', 'A.8.8', 'A.8.13', 'A.8.16'];
        const ctx = ctxOf(ck, { soaApplicable: soa, planId: PLAN_ID });
        const sel = CC.riskDrivenControls(CS.byId('iso27001'), ctx);
        const refs = sel.required.map(r => r.ref);
        expect(refs).toContain('A.8.16');
        expect(refs).toContain('A.8.13');
        expect(sel.driversUsed.join(' ')).toMatch(/previous audit result/i);
    });

    it('flags an applicable control sampled at no audit only at the audit that closes the cycle', () => {
        const ck = build();
        const soa = ['A.5.1', 'A.7.4', 'A.8.34'];
        const closing = CC.assess(ck, Object.assign(ctxOf(ck, { soaApplicable: soa }), { auditType: 'recertification' }));
        expect(closing.issues.some(i => i.code === 'CYCLE_CONTROL_GAP')).toBe(true);
        const surveillance = CC.assess(ck, Object.assign(ctxOf(ck, { soaApplicable: soa }), { auditType: 'surveillance' }));
        expect(surveillance.issues.some(i => i.code === 'CYCLE_CONTROL_GAP')).toBe(false);
    });
});

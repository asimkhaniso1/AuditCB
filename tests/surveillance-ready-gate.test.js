import { describe, it, expect } from 'vitest';
import { buildScenario, M, B } from '../tools/pcc-scenario.mjs';

// A generated SURVEILLANCE checklist could never be marked Ready for Audit,
// for any standard:
//  1. the ISO/IEC 17021-1 §9.6.2 mandatory elements, numbered "9.6.2 (a)–(h)",
//     were checked as clauses of the client's standard ("9.6.2 (c)" does not
//     exist in ISO 9001) -> INVALID_REF, and all eight counted as unmapped
//     hand-offs -> AUDITOR_REVIEW;
//  2. cycle gaps that coverage rates informational at a surveillance still
//     blocked the gate;
//  3. a control named by a previous finding was dropped from the Annex A
//     sample as "covered" by a theme the budgeted surveillance never asked
//     -> RISK_CONTROL_GAP.
const { QA, CC } = M;

const scope = 'Manufacturer, Exporter, and Retailer of Skin Care, Hair Care & Personal Care Products.';
const sg1888 = () => ({
    id: 'sg', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015', keyProcesses: [{ name: 'Production' }, { name: 'Purchasing' }],
    sites: [{ name: 'Head Office', employees: 100, standards: 'ISO 9001:2015' }], contacts: [],
    certificates: [{ id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', status: 'Active', initialDate: '2023-02-03', currentIssue: '2026-02-03', expiryDate: '2027-02-02', scope }]
});
const docsFor = (list) => list.map(([name, docNumber], i) => ({ id: 'd' + i, name, docNumber, linkedClauses: B.mapClauses({ title: name, docNumber }).join(', ') }));
const QMS_DOCS = docsFor([['Quality Manual', 'QM-01'], ['Supplier Evaluation Procedure', 'QP-08'], ['Internal Audit Procedure', 'QP-05'], ['Management Review Procedure', 'QP-06']]);

function gate(client, docs, opts, scopeStandards) {
    const ck = B.buildClientChecklist(client, docs, opts);
    ck.auditType = opts.auditType;
    const qa = QA.validate(ck, ck.qaContext);
    const coverage = CC.assess(ck, CC.buildContext(ck, { client, scopeStandards }));
    return { ck, qa, coverage, ready: CC.readiness(ck, { qa, coverage }) };
}

describe('Surveillance checklists can be released', () => {
    it('ISO 9001 surveillance (SG 1888) is Ready for Audit', () => {
        const { ready, qa } = gate(sg1888(), QMS_DOCS, { auditType: 'surveillance', standard: 'ISO 9001:2015', manDays: 1 }, 'ISO 9001:2015');
        expect(qa.issues.filter(i => i.code === 'INVALID_REF')).toEqual([]);
        expect(ready.blockers.map(b => b.code)).toEqual([]);
        expect(ready.ready).toBe(true);
    });

    it('keeps the eight §9.6.2 elements, and treats them as ISO/IEC 17021-1 criteria — not invalid clauses, not hand-offs', () => {
        const { ck, qa } = gate(sg1888(), QMS_DOCS, { auditType: 'surveillance', standard: 'ISO 9001:2015', manDays: 1 }, 'ISO 9001:2015');
        const surv = ck.clauses.find(c => c.mainClause === 'SURV');
        expect(surv.subClauses.map(s => s.clause)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(x => `9.6.2 (${x})`));
        expect(qa.issues.some(i => i.code === 'INVALID_REF')).toBe(false);
        expect(qa.issues.some(i => i.code === 'AUDITOR_REVIEW')).toBe(false);
    });

    it('surveillance cycle gaps are notes, not blockers; the same gaps still block a recertification', () => {
        const { ready, coverage } = gate(sg1888(), QMS_DOCS, { auditType: 'surveillance', standard: 'ISO 9001:2015', manDays: 1 }, 'ISO 9001:2015');
        const gaps = coverage.issues.filter(i => i.code === 'CYCLE_REQUIREMENT_GAP' || i.code === 'CYCLE_PROCESS_GAP');
        expect(gaps.length).toBeGreaterThan(0);
        expect(gaps.every(i => i.severity === 'info')).toBe(true);
        expect(ready.notes.map(n => n.code)).toEqual(expect.arrayContaining(gaps.map(g => g.code)));

        const recert = CC.readiness({}, { qa: { issues: [] }, coverage: { issues: [{ code: 'CYCLE_REQUIREMENT_GAP', severity: 'critical', message: 'x' }] } });
        expect(recert.ready).toBe(false);
    });

    it('a 9.6.2-style reference outside the surveillance section is still checked', () => {
        const ck = { clauses: [{ mainClause: '4', subClauses: [{ clause: '4.9', title: 'x', requirement: 'Is there a thing?' }] }] };
        const qa = QA.validate(ck, { standardIds: ['iso9001'], auditType: 'surveillance' });
        expect(qa.issues.some(i => i.code === 'INVALID_REF')).toBe(true);
    });

    it('a real hand-off is still reported for auditor review', () => {
        const ck = { clauses: [{ mainClause: 'FOCUS', subClauses: [{ clause: 'FOCUS.1', title: 'x', requirement: 'Follow up the thing.', auditorReview: true }] }] };
        const qa = QA.validate(ck, { standardIds: ['iso9001'], auditType: 'surveillance' });
        expect(qa.issues.some(i => i.code === 'AUDITOR_REVIEW')).toBe(true);
    });
});

describe('PC CONNECTION surveillance — controls named by previous findings are sampled', () => {
    it('samples A.8.13 and A.8.16 and is Ready for Audit', async () => {
        const s = await buildScenario();
        for (const manDays of [1, 2]) {
            const { ck, ready } = gate(s.client, s.docs, { auditType: 'surveillance', standard: s.plan.standard, manDays }, s.plan.standard);
            const annex = ck.clauses.find(c => c.mainClause === 'A');
            const sampled = annex.subClauses.flatMap(x => (x.refs || []).map(r => r.ref));
            expect(sampled).toEqual(expect.arrayContaining(['A.8.13', 'A.8.16']));
            expect(ready.blockers.map(b => b.code)).toEqual([]);
        }
    });

    it('the initial-audit checklist is unchanged in readiness', async () => {
        const s = await buildScenario();
        const { ready } = gate(s.client, s.docs, { auditType: 'initial', standard: s.plan.standard, manDays: 3 }, s.plan.standard);
        expect(ready.ready).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// "GMP Guidelines Pakistan - Initial Audit Checklist": GMP is not in the
// clause registry, so coverage can never be machine-checked. It was reported
// as an internal association error — "Blocked" — and the checklist could
// never be marked Ready for Audit. Every GMP / Halal / cGMP checklist was stuck.
const { CC } = M;

const gmpChecklist = {
    id: 'chk-gmp', name: 'GMP Guidelines Pakistan - Initial Audit Checklist', standard: 'GMP Guidelines Pakistan', auditType: 'initial',
    clauses: [{ mainClause: '4', title: 'Context', subClauses: [
        { clause: '4.1', requirement: 'Is there an organizational chart that clearly defines responsibilities of personnel in manufacturing?' },
        { clause: '4.2', requirement: 'Are specific duties of personnel involved in GMP recorded in writing?' }
    ] }]
};
const qaClean = { issues: [], counts: { critical: 0, warning: 0, info: 0 } };

describe('coverage of a checklist for a scheme outside the clause registry', () => {
    const ctx = CC.buildContext(gmpChecklist, {});
    const cov = CC.assess(gmpChecklist, ctx);

    it('is Not assessed — neither Blocked nor "validated"', () => {
        expect(cov.outcome).toBe('not-assessed');
        expect(cov.blocking).toBe(false);
        expect(CC.summarize(cov)).toMatch(/^Not assessed/);
        expect(CC.summarize(cov)).not.toMatch(/validated/i);
        expect(cov.issues.map(i => i.code)).toEqual(['STANDARD_NOT_IN_REGISTRY']);
    });

    it('does not stop the checklist being marked Ready for Audit', () => {
        const r = CC.readiness(gmpChecklist, { qa: qaClean, coverage: cov });
        expect(r.ready).toBe(true);
        expect(r.blockers).toEqual([]);
    });

    it('the combined status says the auditor confirms coverage', () => {
        const combined = CC.combine(qaClean, cov);
        expect(combined.outcome).toBe('not-assessed');
        expect(combined.reasons.join(' ')).toMatch(/auditor/);
    });

    it('a critical QA issue still fails it', () => {
        const combined = CC.combine({ issues: [{ code: 'DUPLICATE_QUESTION', severity: 'critical' }], counts: { critical: 1, warning: 0, info: 0 } }, cov);
        expect(combined.outcome).toBe('failed');
    });
});

describe('a checklist that names no standard at all is still an internal error', () => {
    it('stays Blocked', () => {
        const orphan = { id: 'x', name: 'Untitled', clauses: [] };
        const cov = CC.assess(orphan, CC.buildContext(orphan, {}));
        expect(cov.outcome).toBe('blocked');
        expect(CC.readiness(orphan, { qa: qaClean, coverage: cov }).ready).toBe(false);
    });
});

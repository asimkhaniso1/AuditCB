// The Findings tab (and the printed findings summary) name a nonconformity by
// its NC register reference, and show its clause.
//
// PC Connection's 2026 recertification Findings tab listed its five minor NCs as
// NCR-001 to NCR-005 while the register and the client report call them
// NCR-086 to NCR-091, and every row's Clause read "Checklist Item": the clause
// was only taken from the checklist template, which is skipped whenever the
// auditor assigned a criterion.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' }
};

const PLAN = 'plan-recert';
const item = (itemIdx, clause, ncrType, extra) => Object.assign({ checklistId: 'cl1', itemIdx, clause, status: 'nc', ncrType,
    comment: 'Evidence for ' + clause, criterionRef: clause.split(' ')[0], criterionSource: 'auditor-assigned' }, extra || {});
const report = () => ({ id: 'rep', planId: PLAN, ncrs: [], checklistProgress: [
    item('9-1', '9.2 (22301)', 'minor'),
    item('4-3', '4.4 (integrated)', 'minor'),
    item('8-6', '8.6.2 (20000)', 'minor'),
    item('9-3', '9.3', 'observation'),
    item('8-4', '8.4 (22301)', 'ofi')
] });

describe('collectAuditFindings — register references and clauses', () => {
    beforeEach(() => {
        loadScript('./execution-module-v2.js', { params: { module: undefined } });
        window.state = { ncrs: [
            // Linked to its checklist item.
            { id: 91, auditId: PLAN, clause: '9.2', severity: 'minor', status: 'Open', sourceChecklistId: 'cl1', sourceItemIdx: '9-1' },
            // Not linked: matched by its clause, the only open record on 4.4.
            { id: 86, auditId: PLAN, clause: '4.4', severity: 'minor', status: 'Open' },
            // Another client's NCR-001 must never be taken.
            { id: 1, auditId: 'other-plan', clause: '8.6.2', severity: 'minor', status: 'Open' },
            // Withdrawn copies and observations are not register NCs.
            { id: 90, auditId: PLAN, clause: '8.6.2', severity: 'minor', status: 'Withdrawn' },
            { id: 53, auditId: PLAN, clause: '9.3', severity: 'observation', status: 'Open' }
        ] };
    });

    it('names each NC by its register reference, and an unregistered one NC-001', () => {
        const { findings } = window.collectAuditFindings(report(), []);
        expect(findings.map((f) => [f._ref, f.clause])).toEqual([
            ['NCR-091', '9.2 (22301)'],
            ['NCR-086', '4.4 (integrated)'],
            ['NC-001', '8.6.2 (20000)'],
            ['OBS-001', '9.3'],
            ['OFI-001', '8.4 (22301)']
        ]);
        expect(findings[0]._registerId).toBe(91);
        expect(findings[2]._registerId).toBeNull();
    });

    it('shows the item\'s own clause, never "Checklist Item", when the criterion was assigned', () => {
        const { findings } = window.collectAuditFindings(report(), [{ id: 'cl1', clauses: [] }]);
        expect(findings.every((f) => f.clause !== 'Checklist Item')).toBe(true);
    });

    it('does not let a clause match take a record linked to another item', () => {
        const r = report();
        r.checklistProgress.push(item('9-9', '9.2 (27001)', 'minor'));
        const { findings } = window.collectAuditFindings(r, []);
        const refs = findings.filter((f) => /^9\.2/.test(f.clause)).map((f) => f._ref);
        expect(refs).toEqual(['NCR-091', 'NC-002']);
    });
});

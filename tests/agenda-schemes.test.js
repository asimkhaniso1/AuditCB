import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// The agenda builder only knew the three standards in the clause registry
// (ISO/IEC 27001, ISO 22301, ISO/IEC 20000-1): Build Agenda failed with
// "No standard in scope." for every other client — ISO 9001, Halal, cGMP...
const { IPI } = M;
const client = {
    id: 'sg', name: 'SG 1888 (PVT.) LTD.', sites: [{ name: 'Head Office', employees: 100 }], contacts: [],
    certificates: [
        { id: 'C-CGMP', standard: 'cGMP', status: 'Active', initialDate: '2025-08-21', scope: 'Manufacture of skin care, hair care and personal care products.' },
        { id: 'C-9001', standard: 'ISO 9001:2015', status: 'Active', initialDate: '2023-02-03', scope: 'Manufacture of skin care, hair care and personal care products.' },
        { id: 'C-GMP', standard: 'GMP', status: 'Active', initialDate: '2023-02-03', scope: 'A different product line.' }
    ]
};
const auditors = [{ id: 'a1', name: 'Hassan Javed.', role: 'Lead Auditor' }];
const planFor = (standard, extra) => Object.assign({
    id: 'p', client: client.name, standard, auditType: 'Surveillance 1', type: 'Surveillance 1', auditMethod: 'On-site',
    date: '2027-01-11', endDate: '2027-01-11', team: ['Hassan Javed.'], auditorIds: ['a1'], selectedSites: [{ name: 'Head Office' }],
    durationCalculation: { finalDays: 1 }, manDays: 1
}, extra || {});
const build = (standard, state) => IPI.assemble({ plan: planFor(standard), client, auditors, state: state || { ncrs: [], auditReports: [], auditPlans: [] }, settings: {} });

describe('agenda for standards and schemes outside the clause registry', () => {
    it('builds a cGMP agenda: topic sessions, no invented clause numbers', () => {
        const asm = build('cGMP');
        expect(asm.agenda.errors).toEqual([]);
        const items = asm.agenda.rows.map(r => r.item);
        expect(items[0]).toBe('Opening meeting');
        expect(items.at(-1)).toBe('Closing meeting');
        expect(items.some(i => /^cGMP: premises and equipment/.test(i))).toBe(true);
        expect(items).toContain('Management review');
        // Nothing cites a clause: the registry holds no cGMP clauses.
        expect(asm.agenda.rows.every(r => !(r.standards || []).length)).toBe(true);
        expect(asm.agenda.warnings.join(' ')).toMatch(/No clause registry is held for cGMP/);
    });

    it('builds ISO 9001 (cited from the registry) and Halal (by topic) together', () => {
        const rows = build('ISO 9001:2015, Halal').agenda.rows;
        const prod = rows.find(r => /^Production and service provision/.test(r.item));
        expect(prod.standards).toEqual([{ stdId: 'iso9001', refs: ['7.1.5', '8.5', '8.6', '8.7'] }]);
        const halal = rows.find(r => /^Halal: Halal assurance system/.test(r.item));
        expect(halal.standards).toEqual([]);
    });

    it('titles the opening review for a surveillance, not a recertification', () => {
        const items = build('cGMP').agenda.rows.map(r => r.item);
        expect(items.some(i => /^Surveillance review/.test(i))).toBe(true);
        expect(items.some(i => /^Recertification review/.test(i))).toBe(false);
    });

    it('fills the approved duration exactly', () => {
        const rows = build('cGMP').agenda.rows.filter(r => r.kind !== 'lunch');
        const minutes = rows.reduce((t, r) => { const [a, b] = [r.start, r.end].map(x => +x.slice(0, 2) * 60 + +x.slice(3)); return t + (b - a); }, 0);
        expect(minutes).toBe(8 * 60);
    });

    it('schedules a previous cGMP finding in the follow-up session', () => {
        const state = { ncrs: [{ id: 'N1', clientId: 'sg', client: client.name, clause: '5.2', type: 'minor', status: 'Open', standards: ['cGMP'] }], auditReports: [], auditPlans: [] };
        const asm = build('cGMP', state);
        const row = asm.agenda.rows.find(r => (r.findingIds || []).includes('N1'));
        expect(row.item).toMatch(/^Nonconformity and corrective action/);
    });

    it('verifies the scope against the cGMP certificate only, not every certificate the client holds', () => {
        const scope = IPI.checkScope({ plan: {}, client, standards: [], schemes: ['cGMP'] });
        expect(scope.certificateScope).toBe('Manufacture of skin care, hair care and personal care products.');
        expect(scope.issues.map(i => i.code)).not.toContain('SCOPE_CERTIFICATES_DIFFER');
    });

    it('does not demand remote-audit tooling of an on-site plan', () => {
        const asm = build('cGMP');
        const plan = Object.assign(planFor('cGMP'), asm.patch);
        const problems = IPI.checkNarratives(plan, []);
        expect(problems.filter(p => /secure communication/.test(p.message))).toEqual([]);
        const remote = IPI.checkNarratives(Object.assign({}, plan, { auditMethod: 'Remote', methodology: plan.methodology }), []);
        expect(remote.some(p => /secure communication/.test(p.message))).toBe(true);
    });
});

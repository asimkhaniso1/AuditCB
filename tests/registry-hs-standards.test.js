import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// ISO 9001:2015, ISO 14001:2015 and ISO 45001:2018 in the clause registry:
// real clause numbers, consolidated with the other harmonized-structure
// standards by shared concept (never by number).
const { CS, IPI, SD } = M;

describe('registry: ISO 9001, ISO 14001, ISO 45001', () => {
    it('resolves them by name and by id', () => {
        const r = CS.resolve('ISO 9001:2015, ISO 14001:2015, ISO 45001:2018, Halal');
        expect(r.standards.map(s => s.id)).toEqual(['iso9001', 'iso14001', 'iso45001']);
        expect(r.unresolved).toEqual(['Halal']);
        expect(CS.byId('iso45001').label).toBe('ISO 45001:2018');
    });

    it('holds their own requirements', () => {
        expect(CS.lookupRef(['iso9001'], '8.7')[0].title).toBe('Control of nonconforming outputs');
        expect(CS.lookupRef(['iso14001'], '6.1.2')[0].title).toBe('Environmental aspects');
        expect(CS.lookupRef(['iso45001'], '5.4')[0].title).toBe('Consultation and participation of workers');
        expect(CS.lookupRef(['iso45001'], '10.2')[0].title).toBe('Incident, nonconformity and corrective action');
    });

    it('does not invent clauses these editions do not have', () => {
        // ISO 14001:2015 and ISO 45001:2018 have no clause 6.3.
        expect(CS.isKnownRef('iso14001', '6.3')).toBe(false);
        expect(CS.isKnownRef('iso45001', '6.3')).toBe(false);
        expect(CS.isKnownRef('iso9001', '6.3')).toBe(true);
        // No Annex A: that is ISO/IEC 27001 only.
        expect(CS.isKnownRef('iso9001', 'A.5.1')).toBe(false);
    });

    it('consolidates by concept across differently numbered improvement clauses', () => {
        const nc = CS.clausesFor(['iso9001', 'iso22301', 'iso27001']).filter(c => c.shared === 'improvement.nonconformity-corrective-action');
        expect(nc.map(c => c.stdId + ' ' + c.ref).sort()).toEqual(['iso22301 10.1', 'iso27001 10.2', 'iso9001 10.2']);
    });

    it('every theme cites refs its own standard holds', () => {
        ['iso9001', 'iso14001', 'iso45001'].forEach(id => {
            CS.byId(id).themes.forEach(t => t.refs.forEach(ref => expect(CS.isKnownRef(id, ref), id + ' ' + t.id + ' ' + ref).toBe(true)));
        });
    });

    it('supporting-document topics cover the new standards and their shared requirements', () => {
        expect(SD.topicsForRef('iso9001', '8.4')).toContain('qms-supplier');
        expect(SD.topicsForRef('iso45001', '6.1.2')).toContain('ohs-hazards');
        expect(SD.topicsForRef('iso14001', '9.2')).toContain('ims-internal-audit');
        expect(SD.topicsForRef('iso9001', '10.3')).toContain('ims-improvement');
    });
});

describe('supporting documents: a standard is inferred only among those the client holds', () => {
    const supplierDoc = { id: 'd1', name: 'Supplier Evaluation Procedure', docNumber: 'QP-08', linkedClauses: '8.4' };
    const releaseDoc = { id: 'd2', name: 'Release Management Procedure', docNumber: 'P-22' };

    it('a 9001-only client: an unstated supplier procedure evidences ISO 9001 8.4', () => {
        const client = { standard: 'ISO 9001:2015', certificates: [{ standard: 'ISO 9001:2015' }] };
        const r = SD.rank([supplierDoc], { topic: 'qms-supplier', refs: [{ stdId: 'iso9001', ref: '8.4' }], client });
        expect(r.validated.map(v => v.doc.name)).toEqual(['Supplier Evaluation Procedure']);
    });

    it('an ISMS/BCMS/SMS client (no 9001): a release procedure still reads as ISO/IEC 20000-1, not ambiguous', () => {
        const client = { standard: 'ISO/IEC 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018' };
        expect(SD.profile(releaseDoc, client).standards).toEqual(['iso20000']);
        const r = SD.rank([releaseDoc], { topic: 'sms-release', refs: [{ stdId: 'iso20000', ref: '8.5.3' }], client });
        expect(r.validated.length).toBe(1);
    });

    it('a client holding both: an unstated supplier procedure stays unassigned — never guessed', () => {
        const client = { standard: 'ISO 9001:2015, ISO/IEC 27001:2022' };
        expect(SD.profile(supplierDoc, client).standards).toEqual([]);
    });
});

describe('agenda for the new registry standards', () => {
    const client = { id: 'c', name: 'Acme', sites: [{ name: 'HQ', employees: 60 }], contacts: [] };
    const auditors = [{ id: 'a1', name: 'Lead', role: 'Lead Auditor' }];
    const build = (standard, days, hoursPerDay) => IPI.assemble({
        plan: { id: 'p', client: 'Acme', standard, auditType: 'Recertification', date: '2027-01-11', endDate: '2027-01-13', team: ['Lead'], auditorIds: ['a1'], selectedSites: [{ name: 'HQ' }], durationCalculation: { finalDays: days }, manDays: days },
        client, auditors, state: { ncrs: [], auditReports: [], auditPlans: [] }, settings: {}, hoursPerDay
    }).agenda;

    it('cites ISO 9001 clauses session by session', () => {
        const a = build('ISO 9001:2015', 2);
        expect(a.errors).toEqual([]);
        const cite = (re) => a.rows.find(r => re.test(r.item)).standards;
        expect(cite(/^Customer requirements/)).toEqual([{ stdId: 'iso9001', refs: ['8.2', '8.3', '8.4'] }]);
        expect(cite(/^Production and service provision/)).toEqual([{ stdId: 'iso9001', refs: ['7.1.5', '8.5', '8.6', '8.7'] }]);
        expect(cite(/^Nonconformity and corrective action/)).toEqual([{ stdId: 'iso9001', refs: ['10.1', '10.2', '10.3'] }]);
    });

    it('audits emergency preparedness once for ISO 14001 and ISO 45001 together', () => {
        const a = build('ISO 9001:2015, ISO 14001:2015, ISO 45001:2018', 3);
        expect(a.errors).toEqual([]);
        const emergency = a.rows.filter(r => r.item === 'Emergency preparedness and response');
        expect(emergency.length).toBeGreaterThan(0);
        expect(emergency[0].standards.map(e => e.stdId)).toEqual(['iso14001', 'iso45001']);
        expect(a.rows.some(r => /^Consultation and participation of workers/.test(r.item))).toBe(true);
    });

    it('does not name another client’s processes in the operations session', () => {
        const a = build('ISO 9001:2015', 2);
        expect(a.rows.some(r => /client onboarding/i.test(r.item))).toBe(false);
        expect(a.rows.some(r => /^Operational planning and control: sampling of the organisation’s core processes/.test(r.item))).toBe(true);
    });

    it('builds a short audit (half a day) with tighter sessions instead of refusing', () => {
        const a = build('ISO 9001:2015', 0.5);
        expect(a.errors).toEqual([]);
        expect(a.rows[0].item).toBe('Opening meeting');
        expect(a.rows.at(-1).item).toBe('Closing meeting');
        expect(a.rows.at(-1).end).toBe('12:30');
    });

    it('says why when a scope genuinely cannot fit the duration', () => {
        const a = build('ISO 9001:2015, ISO 14001:2015, ISO 45001:2018', 0.5);
        expect(a.rows).toEqual([]);
        expect(a.errors.join(' ')).toMatch(/too short for this scope: it needs \d+ sessions/);
    });
});

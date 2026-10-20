import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// Language Services UK Limited holds six certificates, three of them for
// standards the clause registry does not hold (ISO 18841, ISO 18587 and
// ISO 17100). The plan's objectives and criteria named only ISO/IEC 27001,
// ISO 14001 and ISO 9001, and the printed agenda showed only those three:
// every label was built from registry ids, and the others resolve to none.
const { IPI, PD } = M;

const SCOPE = 'Provision of translation, interpreting and post-editing services.';
const cert = (id, standard, no) => ({ id, standard, certificateNo: no, status: 'Active', initialDate: '2025-11-07', currentIssue: '2025-11-07', expiryDate: '2026-11-06', scope: SCOPE });
const client = {
    id: '24d5cd19-47fe-4eee-88d0-ea07da86fa01', name: 'Language Services UK Limited',
    standard: 'ISO 9001:2015, ISO 14001:2015, ISO 27001:2022, ISO 18841:2018, ISO 18587:2017, ISO 17100:2015',
    sites: [{ name: 'Head Office', employees: 10, address: 'Suite 3, Davis House, Bristol', country: 'United Kingdom' }], contacts: [],
    certificates: [
        cert('c1', 'ISO 27001:2022', '25UK9003'), cert('c2', 'ISO 14001:2015', '25UK9002'), cert('c3', 'ISO 9001:2015', '25UK9001'),
        cert('c4', 'ISO 18841:2018', '25UK9006'), cert('c5', 'ISO 18587:2017', '25UK9005'), cert('c6', 'ISO 17100:2015', '25UK9004')
    ]
};
const CYCLE = client.certificates.map(c => c.standard);
const REGISTRY = ['ISO/IEC 27001:2022', 'ISO 14001:2015', 'ISO 9001:2015'];
const OUTSIDE = ['ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'];
const auditors = [{ id: 'a1', name: 'Lead One', role: 'Lead Auditor' }];
const plan = () => ({
    id: 'lsuk-s1', client: client.name, standard: CYCLE.join(', '), auditType: 'Surveillance 1', type: 'Surveillance 1', auditMethod: 'Remote',
    date: '2026-11-06', endDate: '2026-11-06', team: ['Lead One'], auditorIds: ['a1'], selectedSites: [{ name: 'Head Office' }],
    certificationCycle: { standards: CYCLE, stage: 'Surveillance 1', recommendedWindowStart: '2026-10-08', recommendedWindowEnd: '2026-12-07', certificateExpiry: '2026-11-06' },
    durationCalculation: { finalDays: 2 }, manDays: 2, timeZone: { iana: 'Europe/London', source: 'plan-agreed', confirmed: true }
});
const state = { ncrs: [], auditReports: [], auditPlans: [] };
const assembled = () => {
    const p = plan();
    const asm = IPI.assemble({ plan: p, client, auditors, state, settings: {} });
    return { plan: Object.assign(p, asm.patch), asm };
};
const docCtx = (asm, extra) => Object.assign({
    client, assigned: asm.team.assigned, standards: asm.standards, schemes: IPI.schemesOf(plan()), timeZone: asm.timeZone, scope: asm.scope,
    findings: asm.findings, durationRecord: asm.durationRecord, brand: { name: 'CB' }, planRef: 'PLN-LSUK'
}, extra || {});
const metaStandards = (html) => html.match(/Audit standards<\/span><\/td><td[^>]*>([\s\S]*?)<\/td>/)[1];
const agendaKey = (html) => html.match(/<div class="agenda-key">([\s\S]*?)<\/div>/)[1];
const criteriaStandardsLine = (text) => text.split('\n').find(l => /Standards, at the editions certified/.test(l));

describe('standards outside the clause registry stay in the audit plan (LSUK)', () => {
    it('splits the six standards into three registry standards and three uncited ones', () => {
        expect(IPI.standardIdsOf(plan())).toEqual(['iso27001', 'iso14001', 'iso9001']);
        expect(IPI.schemesOf(plan())).toEqual(OUTSIDE);
    });

    it('names all six standards in the objectives and the criteria', () => {
        const { plan: p } = assembled();
        const conformity = p.objectives.split('\n').find(l => /Determine the conformity/.test(l));
        REGISTRY.concat(OUTSIDE).forEach(s => {
            expect(conformity).toContain(s);
            expect(criteriaStandardsLine(p.criteria)).toContain(s);
        });
        expect(conformity).toMatch(/ISO 9001:2015, ISO 18841:2018, ISO 18587:2017 and ISO 17100:2015$/);
    });

    it('says the uncited standards are audited against their own requirements, without inventing clauses', () => {
        const { plan: p } = assembled();
        const line = p.criteria.split('\n').find(l => /cites no clause numbers/.test(l));
        expect(line).toBe('• ISO 18841:2018, ISO 18587:2017 and ISO 17100:2015: audited against the requirements of the standards themselves; this plan cites no clause numbers for them');
        OUTSIDE.forEach(s => expect(p.criteria).not.toMatch(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+\\d+\\.\\d')));
    });

    it('uses the singular for one uncited standard', () => {
        const n = IPI.buildNarratives({ auditType: 'Surveillance 1', standards: ['iso9001'], schemes: ['ISO 17100:2015'], method: 'Remote' });
        expect(n.criteria).toContain('ISO 17100:2015: audited against the requirements of the standard itself; this plan cites no clause numbers for it');
        expect(n.objectives).toContain('all requirements of ISO 9001:2015 and ISO 17100:2015');
    });

    it('builds a topic session for each uncited standard and carries them on the shared sessions', () => {
        const { plan: p, asm } = assembled();
        expect(asm.agenda.errors).toEqual([]);
        OUTSIDE.forEach(s => {
            const row = p.agenda.find(r => r.item.indexOf(s + ':') === 0);
            expect(row, s).toBeTruthy();
            expect(row.standards).toEqual([]);
            expect(row.schemes).toEqual([s]);
        });
        const review = p.agenda.find(r => /^Management review/.test(r.item));
        expect(review.schemes).toEqual(OUTSIDE);
        expect(review.standards.map(e => e.stdId).sort()).toEqual(['iso14001', 'iso27001', 'iso9001']);
    });

    it('verifies the scope against all six certificates', () => {
        const { asm } = assembled();
        expect(asm.scope.certificateNumbers.sort()).toEqual(['25UK9001', '25UK9002', '25UK9003', '25UK9004', '25UK9005', '25UK9006']);
    });

    it('a freshly built plan raises no missing-standard problem', () => {
        const { plan: p } = assembled();
        expect(IPI.checkNarratives(p, IPI.standardIdsOf(p), IPI.schemesOf(p)).filter(x => x.code === 'STANDARD_NOT_CITED')).toEqual([]);
        const v = IPI.validate(p, { client, auditors, standards: IPI.standardIdsOf(p), state, findings: [], checklists: [] });
        expect(v.blockers.filter(b => b.code === 'STANDARD_NOT_CITED')).toEqual([]);
    });

    it('flags a saved narrative that drops them (the production LSUK plan)', () => {
        const { plan: p } = assembled();
        const old = IPI.buildNarratives({ auditType: 'Surveillance 1', standards: IPI.standardIdsOf(p), method: 'Remote', sites: ['Head Office'] });
        Object.assign(p, old);
        expect(old.objectives).not.toContain('ISO 17100');
        const problems = IPI.checkNarratives(p, IPI.standardIdsOf(p), IPI.schemesOf(p)).filter(x => x.code === 'STANDARD_NOT_CITED');
        expect(problems.map(x => x.field + ' ' + x.message.match(/name (.+?), which/)[1])).toEqual([
            'objectives ISO 18841:2018', 'objectives ISO 18587:2017', 'objectives ISO 17100:2015',
            'criteria ISO 18841:2018', 'criteria ISO 18587:2017', 'criteria ISO 17100:2015'
        ]);
        // The gate reads the schemes from the plan itself when the caller passes none.
        const v = IPI.validate(p, { client, auditors, standards: IPI.standardIdsOf(p), state, findings: [], checklists: [] });
        expect(v.blockers.filter(b => b.code === 'STANDARD_NOT_CITED')).toHaveLength(6);
    });

    it('prints all six standards and the uncited ones in the agenda requirements', () => {
        const { plan: p, asm } = assembled();
        const html = PD.build(p, docCtx(asm));
        const meta = metaStandards(html);
        REGISTRY.concat(OUTSIDE).forEach(s => expect(meta).toContain(s));
        expect(html).toContain('integrated audit of 6 standards');
        // Rows cite each uncited standard by its number; the key above the
        // agenda names it in full and says, once, that no clauses are cited.
        expect(html).toContain('<b>17100</b> <span class="own">own requirements</span>');
        expect(html).toContain('<b>18841 · 18587 · 17100</b> <span class="own">own requirements</span>');
        OUTSIDE.forEach(s => expect(agendaKey(html)).toContain(s.match(/ISO (\d+)/)[1] + ' = ' + s));
        expect(agendaKey(html)).toContain('audited against the standard’s own requirements; no clause numbers are cited');
        // A topic session is not "all standards in scope".
        const row17100 = html.split('</tr>').find(r => r.indexOf('ISO 17100:2015: ') !== -1);
        expect(row17100).not.toContain('Integrated — all standards in scope');
    });

    it('keeps the uncited standards in the traceability record', () => {
        const { plan: p } = assembled();
        const review = p.traceability.sessions.find(s => s.blockId === 'management-review');
        expect(review.schemes).toEqual(OUTSIDE);
    });

    it('recovers the uncited standards for rows saved without them', () => {
        const { plan: p, asm } = assembled();
        p.agenda = p.agenda.map(r => Object.assign({}, r, { schemes: undefined }));
        const html = PD.build(p, docCtx(asm, { schemes: undefined }));
        expect(html).toContain('<b>18841 · 18587 · 17100</b> <span class="own">own requirements</span>');
        expect(metaStandards(html)).toContain('ISO 18587:2017');
        // A plan saved before traceability carried them: the topic session's title still names its standard.
        p.traceability = null;
        const legacy = PD.build(p, docCtx(asm));
        expect(legacy).toContain('<b>17100</b> <span class="own">own requirements</span>');
        expect(legacy.split('</tr>').find(r => r.indexOf('ISO 17100:2015: ') !== -1)).not.toContain('Integrated — all standards in scope');
    });
});

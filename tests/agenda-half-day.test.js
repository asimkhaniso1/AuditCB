import { describe, it, expect } from 'vitest';
import { M } from '../tools/pcc-scenario.mjs';

// A half-day (0.5 auditor-day, 4 h) plan for ISO/IEC 27001, or for more than
// one standard, had more template topics than 15-minute sessions fit into, so
// Build Agenda failed with "too short for this scope" and no agenda appeared.
// Neighbouring topics now share a session instead.
const { IPI } = M;

const cert = (id, standard) => ({ id, standard, status: 'Active', initialDate: '2025-11-07', scope: 'Provision of translation and interpreting services.' });
const SIX = ['ISO 27001:2022', 'ISO 14001:2015', 'ISO 9001:2015', 'ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'];
const client = { id: 'lsuk', name: 'Language Services UK Limited', sites: [{ name: 'Head Office', employees: 10 }], contacts: [], certificates: SIX.map((s, i) => cert('c' + i, s)) };
const auditors = [{ id: 'a1', name: 'Lead One', role: 'Lead Auditor' }];
const planFor = (standards, days) => ({
    id: 'p', client: client.name, standard: standards.join(', '), auditType: 'Surveillance 1', type: 'Surveillance 1', auditMethod: 'Remote',
    date: '2026-11-06', endDate: '2026-11-06', team: ['Lead One'], auditorIds: ['a1'], selectedSites: [{ name: 'Head Office' }],
    durationCalculation: { finalDays: days }, manDays: days, timeZone: { iana: 'Europe/London', source: 'plan-agreed', confirmed: true }
});
const build = (standards, days, state) => {
    const plan = planFor(standards, days);
    const asm = IPI.assemble({ plan, client, auditors, state: state || { ncrs: [], auditReports: [], auditPlans: [] }, settings: {} });
    return { plan: Object.assign(plan, asm.patch), asm };
};
const minutes = (rows) => rows.filter(r => r.kind !== 'lunch').reduce((t, r) => { const [a, b] = [r.start, r.end].map(x => +x.slice(0, 2) * 60 + +x.slice(3)); return t + (b - a); }, 0);
const refsOf = (rows) => {
    const out = {};
    rows.forEach(r => (r.standards || []).forEach(e => { out[e.stdId] = [...new Set((out[e.stdId] || []).concat(e.refs))].sort(); }));
    return out;
};

describe('half-day agenda', () => {
    [['ISO/IEC 27001', ['ISO 27001:2022']], ['ISO 9001 + ISO 14001', ['ISO 9001:2015', 'ISO 14001:2015']], ['all six LSUK standards', SIX]].forEach(([name, stds]) => {
        it('builds for ' + name + ' at 0.5 days, filling exactly 4 hours', () => {
            const { plan, asm } = build(stds, 0.5);
            expect(asm.agenda.errors).toEqual([]);
            expect(plan.agenda.length).toBeGreaterThan(0);
            expect(minutes(plan.agenda)).toBe(4 * 60);
            expect(plan.agenda[0].item).toBe('Opening meeting');
            expect(plan.agenda.at(-1).item).toBe('Closing meeting');
            // Sessions are at least 30 minutes once topics are combined.
            plan.agenda.filter(r => r.kind === 'session').forEach(r => expect(minutes([r])).toBeGreaterThanOrEqual(30));
        });
    });

    it('keeps every topic, requirement and uncited standard of the full-day agenda', () => {
        const half = build(SIX, 0.5).plan;
        const full = build(SIX, 1).plan;
        expect(refsOf(half.agenda)).toEqual(refsOf(full.agenda));
        const halfText = half.agenda.map(r => r.item).join(' | ');
        full.agenda.filter(r => r.kind === 'session').forEach(r => expect(halfText).toContain(r.item.replace(/ \(continued\)$/, '')));
        ['ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'].forEach(s => expect(half.agenda.some(r => (r.schemes || []).includes(s))).toBe(true));
    });

    it('says the topics were combined', () => {
        expect(build(SIX, 0.5).asm.agenda.warnings.join(' ')).toMatch(/short for this scope: its \d+ topics are combined into \d+ sessions/);
    });

    it('records every combined block in the traceability record', () => {
        const { plan } = build(['ISO 27001:2022'], 0.5);
        const ids = plan.traceability.sessions.flatMap(s => s.blockIds);
        expect(ids).toEqual(expect.arrayContaining(['management-review', 'internal-audit', 'improvement', 'isms-risk-soa']));
    });

    it('still schedules a previous finding in the corrective-action topic', () => {
        const state = { ncrs: [{ id: 'N1', clientId: 'lsuk', client: client.name, clause: '10.2', type: 'minor', status: 'Open', standards: ['ISO 27001:2022'] }], auditReports: [], auditPlans: [] };
        const { plan } = build(['ISO 27001:2022'], 0.5, state);
        const row = plan.agenda.find(r => (r.findingIds || []).includes('N1'));
        expect(row.item).toMatch(/Nonconformity and corrective action/);
    });

    it('passes the plan gate with no structural blocker', () => {
        const { plan } = build(SIX, 0.5);
        const v = IPI.validate(plan, { client, auditors, standards: IPI.standardIdsOf(plan), state: { ncrs: [], auditReports: [], auditPlans: [] }, findings: [], checklists: [] });
        const structural = /^(AUDITOR_|UNTIMED_ROW|ACTIVITY_AFTER_CLOSING|OPENING_MISSING|CLOSING_MISSING|CONSOLIDATION_|INVALID_CLAUSE|CLAUSE_TITLE_MISMATCH|FINDING_UNMAPPED|DURATION_MISMATCH|DOUBLE_BOOKED|DAY_TOO_LONG|OUTSIDE_SCHEDULED_DATES|SCOPE_MISMATCH|SITE_MISMATCH|EDITION_MISMATCH|STANDARD_OUT_OF_SCOPE|ROW_INCOMPLETE)/;
        expect(v.blockers.filter(b => structural.test(b.code))).toEqual([]);
    });

    it('leaves a full day unchanged: one session per topic', () => {
        const { plan, asm } = build(SIX, 1);
        expect(asm.agenda.warnings.join(' ')).not.toMatch(/combined into/);
        plan.traceability.sessions.forEach(s => expect(s.blockIds).toEqual([s.blockId]));
    });
});

// PC Connection's recertification plan was blocked with "Previous finding 85
// (Nonconformity, clause 7.5 (Integrated)) is not scheduled in any agenda
// session". The agenda had been built when that nonconformity was NCR-021;
// the register later withdrew NCR-021 (and NCR-084) as duplicates and kept
// NCR-085 open. The agenda still pointed at 21, so 85 looked unscheduled and
// the message gave no hint that rebuilding the agenda was the fix.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

const { IPI, PD } = M;
const clone = (o) => JSON.parse(JSON.stringify(o));

let base;
beforeAll(async () => { base = await buildScenario(); });

/**
 * Re-record the scenario's A.8.13 nonconformity under register number 85 and
 * withdraw the original, leaving the agenda exactly as it was built.
 */
function reRecorded(scn, opts) {
    const o = opts || {};
    const plan = clone(scn.plan);
    const state = clone(scn.ctx.state);
    const old = state.ncrs.find(n => n.id === 'NCR-PCC-08');
    const fresh = Object.assign(clone(old), { id: 85, status: 'Open' });
    delete fresh.ncrNumber;
    old.status = 'Withdrawn';
    if (o.clause) old.clause = o.clause;
    state.ncrs.push(fresh);
    if (o.dropOld) state.ncrs = state.ncrs.filter(n => n !== old);
    const findings = IPI.collectPreviousFindings({ state, client: scn.client, plan, standards: scn.ctx.standards });
    const ctx = Object.assign({}, scn.ctx, { auditors: scn.auditors, client: scn.client, state, findings });
    const html = PD.build(plan, ctx);
    return { plan, state, findings, v: IPI.validate(plan, Object.assign({}, ctx, { html, lint: M.PS.lint(html), hoursPerDay: 8 })) };
}

describe('FINDING_UNMAPPED names a withdrawn record the agenda still holds', () => {
    it('the scenario agenda schedules the original record', () => {
        expect(base.plan.agenda.some(r => (r.findingIds || []).includes('NCR-PCC-08'))).toBe(true);
        expect(base.validation.blockers.some(b => b.code === 'FINDING_UNMAPPED')).toBe(false);
    });

    it('says which withdrawn record the agenda lists and to rebuild it', () => {
        const { v } = reRecorded(base);
        const b = v.blockers.find(x => x.code === 'FINDING_UNMAPPED');
        expect(b).toBeTruthy();
        expect(String(b.findingId)).toBe('85');
        expect(b.message).toMatch(/^Previous finding NCR-085 \(Nonconformity, clause A\.8\.13/);
        expect(b.message).toMatch(/The agenda still lists PCC-F8 for this clause, which has been withdrawn\./);
        expect(b.message).toMatch(/Rebuild the agenda \(Build Agenda\) to schedule NCR-085\./);
        expect(b.staleFindingIds).toEqual(['NCR-PCC-08']);
    });

    it('rebuilding the agenda clears the blocker', () => {
        const { plan, state, findings } = reRecorded(base);
        const asm = IPI.assemble({ plan, client: base.client, auditors: base.auditors, state, checklist: state.checklists[0], settings: {}, competenceValid: true });
        Object.assign(plan, asm.patch);
        expect(plan.agenda.some(r => (r.findingIds || []).map(String).includes('85'))).toBe(true);
        const ctx = Object.assign({}, base.ctx, { auditors: base.auditors, client: base.client, state, findings });
        const html = PD.build(plan, ctx);
        const v = IPI.validate(plan, Object.assign({}, ctx, { html, lint: M.PS.lint(html), hoursPerDay: 8 }));
        expect(v.blockers.some(x => x.code === 'FINDING_UNMAPPED')).toBe(false);
    });

    it('does not name a withdrawn record for a different clause', () => {
        const { v } = reRecorded(base, { clause: '7.5' });
        const b = v.blockers.find(x => x.code === 'FINDING_UNMAPPED');
        expect(b.message).not.toMatch(/still lists/);
        expect(b.message).toMatch(/built from an earlier version of the findings register\. Rebuild the agenda \(Build Agenda\)\.$/);
        expect(b.staleFindingIds).toEqual([]);
    });

    it('still asks for a rebuild when the old record is gone from the register', () => {
        const { v } = reRecorded(base, { dropOld: true });
        const b = v.blockers.find(x => x.code === 'FINDING_UNMAPPED');
        expect(b.message).toMatch(/built from an earlier version of the findings register/);
    });

    it('keeps the plain message when the agenda holds no outdated ids', () => {
        const plan = clone(base.plan);
        plan.agenda.forEach(r => { r.findingIds = (r.findingIds || []).filter(id => id !== 'NCR-PCC-08'); });
        const ctx = Object.assign({}, base.ctx, { auditors: base.auditors, client: base.client });
        const html = PD.build(plan, ctx);
        const v = IPI.validate(plan, Object.assign({}, ctx, { html, lint: M.PS.lint(html), hoursPerDay: 8 }));
        const b = v.blockers.find(x => x.code === 'FINDING_UNMAPPED');
        expect(b.message).toMatch(/is not scheduled in any agenda session\.$/);
    });
});

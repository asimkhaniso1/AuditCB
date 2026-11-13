import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';

// The plan gate blocks an audit scheduled outside the recommended window
// (OUTSIDE_WINDOW) unless an authorised person records an override. Nothing in
// the app wrote plan.overrides: on 2026-11-13 PC Connection's 17 Nov
// Recertification needed one written from the browser console. These tests
// cover recording and withdrawing an override (gate helpers, editor, plan
// view), that Save / Save draft keep it, and that a withdrawn one really goes.

const { IPI, PD, PS } = M;
const clone = (o) => JSON.parse(JSON.stringify(o));
const codes = (v) => v.blockers.map(b => b.code);
const PAYLOAD = '<img src=x onerror=alert(1)>';

// The scenario's audit (3–5 Nov) against a window that closed on 1 Nov:
// past the window end, still before expiry (15 Dec) — PC Connection's case.
const WINDOW_END = '2026-11-01';
const SCHEDULED = { start: '2026-11-03', end: '2026-11-05' };
// The entry written by hand on PC Connection's live plan: the app must keep honouring it.
const LIVE_ENTRY = {
    category: 'window', user: 'Muhammad Asim Khan', role: 'Admin', reason: 'Client availability; certificate remains valid through the audit.',
    at: '2026-11-13T10:00:00.000Z', window: { start: '2026-09-16', end: WINDOW_END }, scheduled: SCHEDULED
};

let approved;
beforeAll(async () => {
    approved = await buildScenario({ approve: true });
});

function gate(plan) {
    const ctx = Object.assign({}, approved.ctx, { auditors: approved.auditors, client: approved.client });
    const html = PD.build(plan, ctx);
    return IPI.validate(plan, Object.assign({}, ctx, { html, lint: PS.lint(html), hoursPerDay: 8 }));
}
function closeWindow(plan) { plan.certificationCycle = Object.assign({}, plan.certificationCycle, { recommendedWindowEnd: WINDOW_END }); return plan; }
function outsidePlan(extra) { return Object.assign(closeWindow(clone(approved.plan)), extra || {}); }

// ═════════════════════════════════════════════════════════════════════
describe('the gate and the override helpers', () => {
    it('the scenario is clean inside the window, and blocks only on OUTSIDE_WINDOW outside it', () => {
        expect(approved.validation.blockers).toEqual([]);
        const v = gate(outsidePlan());
        expect(codes(v)).toContain('OUTSIDE_WINDOW');
        expect(v.blockers.find(b => b.code === 'OUTSIDE_WINDOW').overridable).toBe('window');
    });

    it('honours the entry already live on PC Connection’s plan', () => {
        expect(codes(gate(outsidePlan({ overrides: [clone(LIVE_ENTRY)] })))).not.toContain('OUTSIDE_WINDOW');
    });

    it('only an approver role may record one, and a reason is required', () => {
        const plan = outsidePlan();
        const base = { category: 'window', user: 'Ann Auditor', reason: 'x' };
        expect(IPI.recordOverride(plan, Object.assign({}, base, { role: 'Lead Auditor' })).ok).toBe(false);
        expect(IPI.recordOverride(plan, Object.assign({}, base, { role: 'Auditor' })).reason).toMatch(/Only Admin, Certification Manager, Cert Manager/);
        expect(IPI.recordOverride(plan, Object.assign({}, base, { role: 'Admin', reason: '   ' })).reason).toMatch(/reason is required/);
        expect(IPI.recordOverride(plan, Object.assign({}, base, { role: 'Admin', user: '' })).ok).toBe(false);
        expect(IPI.recordOverride(plan, Object.assign({}, base, { role: 'Admin', category: 'expiry' })).ok).toBe(false);
        ['Admin', 'Certification Manager', 'cert manager'].forEach(role => expect(IPI.recordOverride(plan, Object.assign({}, base, { role })).ok, role).toBe(true));
    });

    it('records who, role, reason, date and the window/scheduled context, in the live shape; the gate clears', () => {
        const plan = outsidePlan();
        const res = IPI.recordOverride(plan, { category: 'window', user: 'Cara Manager', role: 'Certification Manager', reason: '  Client shutdown  ', at: '2026-11-13T09:00:00Z' });
        expect(res.ok).toBe(true);
        expect(res.entry).toEqual({
            category: 'window', user: 'Cara Manager', role: 'Certification Manager', reason: 'Client shutdown', at: '2026-11-13T09:00:00Z',
            window: { start: '2026-09-16', end: WINDOW_END }, scheduled: SCHEDULED
        });
        expect(plan.overrides).toBeUndefined(); // pure: the caller decides when to keep it
        expect(codes(gate(Object.assign(plan, { overrides: res.overrides })))).not.toContain('OUTSIDE_WINDOW');
    });

    it('refuses a second override while one is in force', () => {
        const plan = outsidePlan({ overrides: [clone(LIVE_ENTRY)] });
        expect(IPI.recordOverride(plan, { category: 'window', user: 'A', role: 'Admin', reason: 'again' }).reason).toMatch(/already in force/);
    });

    it('withdrawing moves it to the history with who/when/why, and the gate blocks again', () => {
        const plan = outsidePlan({ overrides: [clone(LIVE_ENTRY)] });
        expect(IPI.withdrawOverride(plan, 0, { user: 'Ann', role: 'Auditor', reason: 'no' }).ok).toBe(false);
        expect(IPI.withdrawOverride(plan, 0, { user: 'Ann', role: 'Admin', reason: '' }).ok).toBe(false);
        expect(IPI.withdrawOverride(plan, 3, { user: 'Ann', role: 'Admin', reason: 'gone' }).ok).toBe(false);
        const res = IPI.withdrawOverride(plan, 0, { user: 'Cara Manager', role: 'Cert Manager', reason: 'Dates moved back into the window', at: '2026-11-14T08:00:00Z' });
        expect(res.ok).toBe(true);
        expect(res.overrides).toEqual([]);
        expect(res.overrideHistory).toEqual([Object.assign(clone(LIVE_ENTRY), { withdrawnAt: '2026-11-14T08:00:00Z', withdrawnBy: 'Cara Manager', withdrawnRole: 'Cert Manager', withdrawalReason: 'Dates moved back into the window' })]);
        expect(codes(gate(Object.assign(plan, { overrides: res.overrides, overrideHistory: res.overrideHistory })))).toContain('OUTSIDE_WINDOW');
    });

    it('an entry marked withdrawn, or missing who/role/reason, does not clear the gate', () => {
        expect(codes(gate(outsidePlan({ overrides: [Object.assign(clone(LIVE_ENTRY), { withdrawnAt: '2026-11-14' })] })))).toContain('OUTSIDE_WINDOW');
        ['user', 'role', 'reason'].forEach(k => {
            const e = clone(LIVE_ENTRY); e[k] = ' ';
            expect(codes(gate(outsidePlan({ overrides: [e] }))), k).toContain('OUTSIDE_WINDOW');
        });
    });

    it('warns when the dates changed after the override was recorded', () => {
        const v = gate(outsidePlan({ date: '2026-11-04', endDate: '2026-11-06', overrides: [clone(LIVE_ENTRY)] }));
        expect(codes(v)).not.toContain('OUTSIDE_WINDOW');
        expect(v.warnings.map(w => w.code)).toContain('OVERRIDE_STALE');
        expect(IPI.overrideIsStale(outsidePlan(), LIVE_ENTRY)).toBe(false);
    });

    it('lets an approved plan move to client issue only while the override is in force', () => {
        const plan = outsidePlan({ overrides: [clone(LIVE_ENTRY)] });
        expect(IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[1], { role: 'Admin', validation: gate(plan), plan }).allowed).toBe(true);
        delete plan.overrides;
        expect(IPI.canTransition(IPI.STATUSES[0], IPI.STATUSES[1], { role: 'Admin', validation: gate(plan), plan }).allowed).toBe(false);
    });

    it('the Internal Record lists overrides in force and withdrawn, escaped', () => {
        const plan = outsidePlan({
            overrides: [Object.assign(clone(LIVE_ENTRY), { reason: PAYLOAD })],
            overrideHistory: [Object.assign(clone(LIVE_ENTRY), { withdrawnAt: '2026-11-12', withdrawnBy: 'Old Manager', withdrawnRole: 'Admin', withdrawalReason: 'superseded' })]
        });
        const html = PD.buildInternal(plan, Object.assign({}, approved.ctx, { validation: gate(plan) }));
        expect(html).toContain('8. GATE OVERRIDES');
        expect(html).toContain('In force');
        expect(html).toContain('Withdrawn');
        expect(html).toContain('Old Manager');
        expect(html).not.toContain(PAYLOAD);
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
});

// ═════════════════════════════════════════════════════════════════════
// The editor, the plan view and the save path, in jsdom.
let notes; let s;
beforeAll(() => {
    globalThis.window = globalThis.window || globalThis;
    window.Sanitizer = { sanitizeText: (v) => v };
    window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
    if (!window.Validator) loadScript('./validation.js', { global: true });
    loadScript('./planning-module.js', { global: true });
    // After a save the module re-renders the plan list, which needs the whole app.
    globalThis.renderAuditPlanningEnhanced = () => { };
});

async function freshState(user, planPatch) {
    s = await buildScenario({ approve: true });
    Object.assign(closeWindow(s.plan), planPatch || {});
    notes = [];
    window.UTILS = M.UTILS;
    window.showNotification = (m, t) => notes.push([t, m]);
    window.saveData = () => { };
    window.DataService = { isPlanCompleted: () => false };
    window.state = Object.assign(s.state, { currentUser: user, settings: {} });
    document.body.innerHTML = '<div id="content-area"></div>';
    window.contentArea = document.getElementById('content-area');
}
let realCycleContext;
function openEditor() {
    // The form's cycle context (the window) comes from the certificate
    // register and today's date; pin it to the plan's recorded cycle so the
    // panel judges the same window as the gate.
    realCycleContext = realCycleContext || globalThis.getCurrentFormCycleContext;
    globalThis.getCurrentFormCycleContext = () => Object.assign(realCycleContext(), {
        recommendedWindowStart: s.plan.certificationCycle.recommendedWindowStart, recommendedWindowEnd: s.plan.certificationCycle.recommendedWindowEnd
    });
    vi.useFakeTimers();
    window.editAuditPlan(s.plan.id);
    vi.runAllTimers();
    vi.useRealTimers();
}
const panel = () => document.getElementById('plan-override-panel');
const stored = () => window.state.auditPlans.find(p => String(p.id) === String(s.plan.id));
async function save(draft) {
    try { window.saveAuditPlan(false, draft); } catch (e) { /* the save's tail needs more of the app; local state is written first */ }
    await new Promise(r => setTimeout(r, 0));
}
const ADMIN = { name: 'Cara <b>Manager</b>', role: 'Admin' };

describe('recording and withdrawing from the plan editor', () => {

    it('offers "Record override" to an approver when the dates leave the window', async () => {
        await freshState(ADMIN);
        openEditor();
        window.renderPlanOverridePanel();
        expect(panel().querySelector('[data-action="recordEditorPlanOverride"]')).not.toBeNull();
        expect(panel().querySelector('#plan-override-reason')).not.toBeNull();
        expect(panel().textContent).toMatch(/outside the recommended window/);
    });

    it('tells anyone else why they cannot, and offers no control', async () => {
        await freshState({ name: 'Lee Lead', role: 'Lead Auditor' });
        openEditor();
        window.renderPlanOverridePanel();
        expect(panel().querySelector('[data-action="recordEditorPlanOverride"]')).toBeNull();
        expect(panel().textContent).toMatch(/Only Admin, Certification Manager, Cert Manager can record an override/);
        expect(panel().textContent).toMatch(/signed in as Lead Auditor/);
    });

    it('requires a reason', async () => {
        await freshState(ADMIN);
        openEditor();
        window.renderPlanOverridePanel();
        window.recordEditorPlanOverride('window');
        expect(notes.pop()).toEqual(['error', 'A reason is required to record an override.']);
        expect(window._planOverrideState.overrides).toEqual([]);
    });

    it('records it with the user, role, date and context, shows it escaped, and Save draft keeps it', async () => {
        await freshState(ADMIN);
        openEditor();
        window.renderPlanOverridePanel();
        document.getElementById('plan-override-reason').value = PAYLOAD;
        window.recordEditorPlanOverride('window');
        const entry = window._planOverrideState.overrides[0];
        expect(entry).toMatchObject({ category: 'window', user: ADMIN.name, role: 'Admin', reason: PAYLOAD, window: { start: '2026-09-16', end: WINDOW_END }, scheduled: SCHEDULED });
        expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        // shown, escaped, with no record control left
        expect(panel().querySelector('img')).toBeNull();
        expect(panel().querySelector('b')).toBeNull();
        expect(panel().textContent).toContain(PAYLOAD);
        expect(panel().textContent).toContain('Cara <b>Manager</b>');
        expect(panel().querySelector('[data-action="recordEditorPlanOverride"]')).toBeNull();
        expect(stored().overrides).toBeUndefined(); // not on the plan until saved
        await save(true);
        expect(stored().overrides).toEqual([entry]);
        expect(codes(gate(stored()))).not.toContain('OUTSIDE_WINDOW');
        // and a full Save after reopening the plan keeps it too
        openEditor();
        expect(window._planOverrideState.overrides).toEqual([entry]);
        await save(false);
        expect(notes.some(n => n[0] === 'error')).toBe(false);
        expect(stored().overrides).toEqual([entry]);
    });

    it('Pre-save QA names the override instead of only warning about the window', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        openEditor();
        await save(true);
        const warnings = stored().validationSnapshot.warnings.join(' | ');
        expect(warnings).toContain('outside the recommended planning window; override recorded by Muhammad Asim Khan (Admin)');
        expect(warnings).not.toMatch(/Blocks approval for client issue: The scheduled audit/);
    });

    it('an override already on the plan survives a save that did not touch it', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        openEditor();
        await save(true);
        expect(stored().overrides).toEqual([LIVE_ENTRY]);
        openEditor();
        await save(false);
        expect(notes.map(n => n[1])).toContain('12/12 checks passed · 5 warnings'); // the full Save ran
        expect(stored().overrides).toEqual([LIVE_ENTRY]);
    });

    it('a withdrawn override really goes on Save draft and stays in the history', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        openEditor();
        window.renderPlanOverridePanel();
        expect(panel().textContent).toMatch(/Override in force/);
        window.prompt = () => 'Dates confirmed inside the window after all';
        expect(panel().querySelector('[data-action="withdrawEditorPlanOverride"]').getAttribute('data-arg1')).toBe('0');
        window.withdrawEditorPlanOverride('0');
        expect(window._planOverrideState.overrides).toEqual([]);
        await save(true);
        expect(stored().overrides).toEqual([]);
        expect(stored().overrideHistory).toHaveLength(1);
        expect(stored().overrideHistory[0]).toMatchObject({ user: LIVE_ENTRY.user, withdrawnBy: ADMIN.name, withdrawnRole: 'Admin', withdrawalReason: 'Dates confirmed inside the window after all' });
        expect(codes(gate(stored()))).toContain('OUTSIDE_WINDOW');
    });

    it('cancelling the withdrawal prompt changes nothing', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        openEditor();
        window.prompt = () => null;
        window.withdrawEditorPlanOverride('0');
        expect(window._planOverrideState.overrides).toHaveLength(1);
    });

    it('a new plan starts with no overrides from the plan edited before it', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        openEditor();
        window.renderCreateAuditPlanForm();
        expect(window._planOverrideState).toEqual({ planId: null, overrides: [], history: [] });
    });
});

describe('the plan view', () => {
    it('shows who, when and why, escaped, with a withdraw button for an approver only', async () => {
        await freshState(ADMIN, { overrides: [Object.assign(clone(LIVE_ENTRY), { reason: PAYLOAD })] });
        const host = document.createElement('div');
        host.innerHTML = planOverridesCardHTML(stored());
        expect(host.querySelector('img')).toBeNull();
        expect(host.textContent).toContain(PAYLOAD);
        expect(host.textContent).toContain('Muhammad Asim Khan');
        expect(host.textContent).toContain('(Admin)');
        expect(host.querySelector('[data-action="withdrawPlanOverride"]')).not.toBeNull();
        window.state.currentUser = { name: 'Lee', role: 'Lead Auditor' };
        host.innerHTML = planOverridesCardHTML(stored());
        expect(host.querySelector('[data-action="withdrawPlanOverride"]')).toBeNull();
    });

    it('shows nothing for a plan that never had an override', async () => {
        await freshState(ADMIN);
        expect(planOverridesCardHTML(stored())).toBe('');
    });

    it('withdrawing from the view takes effect at once and keeps the history', async () => {
        await freshState(ADMIN, { overrides: [clone(LIVE_ENTRY)] });
        window.prompt = () => 'No longer accepted';
        const view = window.viewAuditPlan; window.viewAuditPlan = () => { };
        await window.withdrawPlanOverride(String(s.plan.id), '0');
        window.viewAuditPlan = view;
        expect(stored().overrides).toEqual([]);
        expect(stored().overrideHistory[0]).toMatchObject({ category: 'window', withdrawalReason: 'No longer accepted', withdrawnBy: ADMIN.name });
    });

    it('refuses a withdrawal by a role that may not', async () => {
        await freshState({ name: 'Lee', role: 'Auditor' }, { overrides: [clone(LIVE_ENTRY)] });
        window.prompt = () => 'try';
        await window.withdrawPlanOverride(String(s.plan.id), '0');
        expect(stored().overrides).toHaveLength(1);
        expect(notes.pop()[0]).toBe('error');
    });
});

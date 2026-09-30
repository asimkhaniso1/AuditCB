import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'module';

// The progress bar and the Cert / S1 / S2 / Re dots follow the CURRENT stage,
// from the same lifecycle state as the Current / Next Stage text and the
// recommended window. Only the current milestone carries a status colour —
// not yet due = neutral blue, window open = amber, overdue = red; completed
// are green, future grey. The Next Audit Stage is a future stage: it was shown
// red when the current audit was due within 60 days, and it never is now.
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');
const fs = require('fs');
const path = require('path');

const TODAY = '2026-09-30';
const GREEN = '#10b981', BLUE = '#3b82f6', AMBER = '#f59e0b', RED = '#dc2626', GREY = '#cbd5e1';

const HALAL = { id: 'C-HALAL', standard: 'Halal', certificateNo: 'CR/IHC/SG/09/24/HC', status: 'Active', initialDate: '2024-09-14', currentIssue: '2025-09-14', expiryDate: '2026-09-13' };
const QMS = { id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', status: 'Active', initialDate: '2023-02-03', currentIssue: '2026-02-03', expiryDate: '2027-02-02' };
// Language Services UK — Current Stage Surveillance 1, window from 08/10/2026.
const LANG = { id: 'C-LS', standard: 'ISO/IEC 27001:2022', certificateNo: 'LS-27001', status: 'Active', initialDate: '2022-11-07', currentIssue: '2025-11-07', expiryDate: '2026-11-06' };

const ev = (certificateId, type, occurredAt) => ({ id: certificateId + type, certificateId, type, occurredAt, createdAt: occurredAt, metadata: {} });

let render, view;
beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(TODAY + 'T09:00:00'));
    globalThis.window = globalThis.window || globalThis;
    window.ReportStats = ReportStats;
    window.AuditPlanningDomain = Domain;
    window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
    window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s), formatDate: (d) => { const x = d instanceof Date ? d : new Date(d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; } };
    window.state = { auditPlans: [], auditReports: [], cbSettings: {} };
    const src = fs.readFileSync(path.resolve('./client-workspace.js'), 'utf8');
    const api = new Function('module', src + '\nreturn { render: renderCertificationCycleWidget, view: cycleLifecycleView, timeline: renderAuditCycleTimeline };')(undefined);
    render = api.render; view = api.view;
    window._timeline = api.timeline;
});
afterAll(() => vi.useRealTimers());

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
function card(cert, events = []) {
    const client = { id: 'c1', name: 'Client', certificates: [cert], certificationLifecycleEvents: events };
    document.body.innerHTML = render(client);
    const el = document.querySelector('.card');
    const nodes = {};
    el.querySelectorAll('.cycle-node').forEach(n => { nodes[n.dataset.milestone] = { state: n.dataset.state, bg: n.firstElementChild.style.background, title: n.getAttribute('title') }; });
    const bar = el.querySelector('.cycle-progress');
    const cells = {};
    el.querySelectorAll('.cycle-info-grid > div').forEach(cell => {
        const label = cell.children[0] && cell.children[0].textContent.trim().toUpperCase();
        if (label) cells[label] = cell.children[1];
    });
    return {
        nodes, cells,
        bar: { current: bar.dataset.current, status: bar.dataset.status,
            currentWidth: bar.querySelector('.cycle-progress-current').style.width, currentBg: bar.querySelector('.cycle-progress-current').style.background,
            doneWidth: bar.querySelector('.cycle-progress-done').style.width }
    };
}

describe('cycle card follows the current stage', () => {
    it('Current S1, window not yet open: bar ends at S1 in neutral blue; S2 and Re grey; Next Audit Stage not red', () => {
        const c = card(QMS);   // S1 window 04/01/2027 – 05/03/2027
        expect(c.cells['CURRENT STAGE'].textContent.trim()).toBe('Surveillance 1');
        expect(c.cells['NEXT AUDIT STAGE'].textContent.trim()).toBe('Surveillance 2');
        expect(c.cells['NEXT AUDIT STAGE'].style.color).toBe(rgb('#1e293b'));
        expect(c.bar).toMatchObject({ current: 's1', status: 'upcoming', currentWidth: '33.3%', doneWidth: '0%', currentBg: rgb(BLUE) });
        expect(c.nodes.cert.state).toBe('completed');
        expect(c.nodes.s1).toMatchObject({ state: 'upcoming', bg: rgb(BLUE) });
        expect(c.nodes.s2).toMatchObject({ state: 'future', bg: rgb(GREY) });
        expect(c.nodes.recert).toMatchObject({ state: 'future', bg: rgb(GREY) });
    });

    it('Current S1 due within weeks (Language Services UK): S1 is highlighted, S2 stays neutral and the Next text is not red', () => {
        const c = card(LANG);
        expect(c.cells['CURRENT STAGE'].textContent.trim()).toBe('Surveillance 1');
        expect(c.cells['NEXT AUDIT STAGE'].textContent.trim()).toBe('Surveillance 2');
        expect(c.cells['NEXT AUDIT STAGE'].style.color).toBe(rgb('#1e293b'));
        expect(c.bar.current).toBe('s1');
        expect(['upcoming', 'open']).toContain(c.nodes.s1.state);
        expect(c.nodes.s2.state).toBe('future');
        expect(c.nodes.s2.bg).toBe(rgb(GREY));
    });

    it('Current S2 with its window open (Halal): Cert + S1 green, bar green to S1 then amber to S2, Re neutral', () => {
        const c = card(HALAL, [ev('C-HALAL', 'surveillance-1-completed', '2025-09-10T00:00:00.000Z')]);
        expect(c.cells['CURRENT STAGE'].textContent.trim()).toBe('Surveillance 2');
        expect(c.cells['NEXT AUDIT STAGE'].textContent.trim()).toBe('Recertification');
        expect(c.bar).toMatchObject({ current: 's2', status: 'open', doneWidth: '33.3%', currentWidth: '66.7%', currentBg: rgb(AMBER) });
        expect(c.nodes.s1).toMatchObject({ state: 'completed', bg: rgb(GREEN) });
        expect(c.nodes.s2).toMatchObject({ state: 'open', bg: rgb(AMBER) });
        expect(c.nodes.recert).toMatchObject({ state: 'future', bg: rgb(GREY) });
        expect(c.cells['RECOMMENDED AUDIT WINDOW'].style.color).toBe(rgb('#b45309'));
    });

    it('Current Recertification: bar reaches Re, S1 and S2 green', () => {
        const c = card(HALAL, [ev('C-HALAL', 'surveillance-1-completed', '2025-09-10T00:00:00.000Z'), ev('C-HALAL', 'surveillance-2-completed', '2026-09-25T00:00:00.000Z')]);
        expect(c.cells['CURRENT STAGE'].textContent.trim()).toBe('Recertification');
        expect(c.bar).toMatchObject({ current: 'recert', doneWidth: '66.7%', currentWidth: '100%' });
        expect(c.nodes.s1.state).toBe('completed');
        expect(c.nodes.s2.state).toBe('completed');
        expect(c.nodes.recert.state).toBe(c.bar.status);
        expect(['upcoming', 'open']).toContain(c.nodes.recert.state);
    });

    it('A surveillance missed outright shows red, the stage it gave way to is current, later ones grey', () => {
        const c = card(HALAL);   // no S1 on file; its window closed in 2025
        expect(c.nodes.s1).toMatchObject({ state: 'missed', bg: rgb(RED) });
        expect(c.nodes.s2.state).toBe('open');
        expect(c.nodes.recert.state).toBe('future');
    });

    it('the Certification Cycle tab uses the same states', () => {
        document.body.innerHTML = window._timeline({ id: 'c1', name: 'Client', certificates: [HALAL], certificationLifecycleEvents: [ev('C-HALAL', 'surveillance-1-completed', '2025-09-10T00:00:00.000Z')] });
        const states = {};
        document.querySelectorAll('.cycle-node').forEach(n => { states[n.dataset.milestone] = n.dataset.state; });
        expect(states).toEqual({ s1: 'completed', s2: 'open', recert: 'future' });
        const line = document.querySelector('.cycle-progress');
        expect(line.dataset.current).toBe('s2');
        expect(line.getAttribute('style')).not.toMatch(/#dc2626/i);
    });
});

describe('cycleLifecycleView', () => {
    const dues = { s1: new Date('2026-01-01'), s2: new Date('2027-01-01'), recert: new Date('2027-11-01') };
    const today = new Date(TODAY);
    const states = (v) => v.milestones.map(m => m.state);

    it('overdue current milestone is red; nothing after it is', () => {
        const v = view({ current: 'Surveillance 1', done: {}, dues, today, windowState: { state: 'closed' } });
        expect(states(v)).toEqual(['overdue', 'future', 'future']);
        expect(v.progress.colour).toBe(RED);
    });

    it('completed milestones are green and the cycle completes at 100%', () => {
        const v = view({ current: 'Recertification completed', done: { s1: true, s2: true, recert: true }, dues, today, windowState: null });
        expect(states(v)).toEqual(['completed', 'completed', 'completed']);
        expect(v.progress).toMatchObject({ completedPct: 100, currentPct: 100, colour: GREEN });
    });

    it('a future milestone is never red, whatever its date', () => {
        const pastDues = { s1: new Date('2020-01-01'), s2: new Date('2020-06-01'), recert: new Date('2021-01-01') };
        const v = view({ current: 'Surveillance 1', done: {}, dues: pastDues, today, windowState: { state: 'upcoming' } });
        expect(states(v)).toEqual(['upcoming', 'future', 'future']);
    });

    it('an expired cycle puts Recertification overdue', () => {
        const v = view({ current: 'Certificate expired', done: { s1: true }, expired: true, dues, today, windowState: null });
        expect(states(v)).toEqual(['completed', 'missed', 'overdue']);
        expect(v.currentKey).toBe('recert');
    });
});

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { M } from '../tools/pcc-scenario.mjs';

// The agenda editor groups rows by day (a collapsible header per day) and
// each day header has a "Half day" switch. A half day keeps its morning only;
// the hours it gives up roll on to later days, so the agenda still schedules
// exactly the approved duration. The End Date is not moved: when the agenda
// needs more dates than the plan has, the builder says so and the save check
// reports it until the auditor changes the End Date.
const { IPI } = M;

const SIX = ['ISO 27001:2022', 'ISO 14001:2015', 'ISO 9001:2015', 'ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'];
const cert = (id, standard) => ({ id, standard, status: 'Active', initialDate: '2025-11-07', currentIssue: '2025-11-07', scope: 'Provision of translation and interpreting services.' });
const client = { id: 'lsuk', name: 'Language Services UK Limited', sites: [{ name: 'Head Office', employees: 10 }], contacts: [], keyProcesses: [], certificates: SIX.map((s, i) => cert('c' + i, s)) };
const auditors = [{ id: 'a1', name: 'Lead One', role: 'Lead Auditor', standards: SIX }];
const state = { clients: [client], auditors, auditPlans: [], auditReports: [], ncrs: [], checklists: [] };

function build(date, endDate, finalDays, halfDays) {
    const plan = {
        id: 'p', client: client.name, standard: SIX.join(', '), auditType: 'Surveillance 1', type: 'Surveillance 1', auditMethod: 'Remote',
        date, endDate, team: ['Lead One'], auditorIds: ['a1'], selectedSites: [{ name: 'Head Office' }], manDays: finalDays, halfDays,
        durationCalculation: { finalDays }, timeZone: { iana: 'Europe/London', source: 'plan-agreed', confirmed: true }
    };
    const asm = IPI.assemble({ plan, client, auditors, state, settings: {} });
    expect(asm.agenda.errors).toEqual([]);
    return { plan: Object.assign(plan, asm.patch), warnings: asm.agenda.warnings };
}
const minutes = (rows) => rows.filter(r => r.kind !== 'lunch').reduce((t, r) => {
    const m = (v) => +v.slice(0, 2) * 60 + +v.slice(3);
    return t + m(r.end) - m(r.start);
}, 0);
const days = (rows) => [...new Set(rows.map(r => r.day))];
const onDay = (rows, d) => rows.filter(r => r.day === d);

describe('half days in the agenda builder', () => {
    it('keeps only the morning of a half day and rolls the rest on, adding a day', () => {
        const full = build('2026-11-05', '2026-11-06', 2, []).plan.agenda;
        const { plan, warnings } = build('2026-11-05', '2026-11-06', 2, [2]);
        expect(days(full)).toEqual(['Day 1', 'Day 2']);
        expect(days(plan.agenda)).toEqual(['Day 1', 'Day 2', 'Day 3']);
        const day2 = onDay(plan.agenda, 'Day 2');
        expect(day2.some(r => r.kind === 'lunch')).toBe(false);
        expect(day2.every(r => r.end <= '12:30')).toBe(true);
        // The approved duration is unchanged: 2 auditor-days = 16 h.
        expect(minutes(plan.agenda)).toBe(minutes(full));
        expect(minutes(plan.agenda)).toBe(16 * 60);
        // Day 3 has no date in the plan, and the builder says the End Date must move.
        expect(onDay(plan.agenda, 'Day 3').every(r => r.date === '')).toBe(true);
        expect(warnings.join(' ')).toContain('runs to Day 3, but the plan is scheduled over 2 dates. Move the End Date to cover Day 3.');
    });

    it('takes the extra date when the End Date already covers it', () => {
        const { plan, warnings } = build('2026-11-05', '2026-11-07', 2, [1]);
        // Three dates for two auditor-days is a spread plan; Day 1 is capped at a morning.
        expect(onDay(plan.agenda, 'Day 1').every(r => r.end <= '12:30')).toBe(true);
        expect(minutes(plan.agenda)).toBe(16 * 60);
        expect(plan.agenda.every(r => r.date)).toBe(true);
        expect(warnings.join(' ')).not.toContain('Move the End Date');
    });

    it('keeps the opening first and the closing last', () => {
        const { plan } = build('2026-11-05', '2026-11-06', 2, [1, 2]);
        expect(plan.agenda[0].kind).toBe('opening');
        expect(plan.agenda[plan.agenda.length - 1].kind).toBe('closing');
        expect(days(plan.agenda)).toEqual(['Day 1', 'Day 2', 'Day 3']);
    });

    it('changes nothing when no day is marked', () => {
        const a = build('2026-11-05', '2026-11-06', 2, []).plan.agenda;
        const b = build('2026-11-05', '2026-11-06', 2, undefined).plan.agenda;
        expect(b.map(r => r.day + r.start + r.end + r.item)).toEqual(a.map(r => r.day + r.start + r.end + r.item));
    });
});

describe('agenda editor: a collapsible group per day', () => {
    beforeAll(() => {
        globalThis.window = globalThis.window || globalThis;
        window.showNotification = () => { };
        window.Sanitizer = { sanitizeText: (v) => v };
        window.Validator = {};
        window.UTILS = M.UTILS;
        window.DocFormat = M.DF;
        loadScript('./planning-module.js', { global: true });
    });
    beforeEach(() => {
        document.body.innerHTML = `<select id="plan-lead-auditor"><option value="Lead One" selected>Lead One</option></select>
            <select id="plan-team" multiple></select><table><tbody id="agenda-tbody"></tbody></table>`;
        window._agendaCollapsed = new Set();
        window._agendaHalfDays = new Set([2]);
        build('2026-11-05', '2026-11-06', 2, []).plan.agenda.forEach(r => window.addAgendaRow(r));
        window.renderAgendaDayGroups();
    });
    const heads = () => Array.from(document.querySelectorAll('#agenda-tbody tr.agenda-day-head'));
    const dataRows = () => Array.from(document.querySelectorAll('#agenda-tbody tr:not(.agenda-day-head)'));

    it('puts one header before each day, with its date, session count and a Half day switch', () => {
        expect(heads().map(h => h.dataset.day)).toEqual(['Day 1', 'Day 2']);
        const first = heads()[0];
        expect(first.nextElementSibling.querySelector('input').value).toBe('Day 1');
        expect(first.textContent).toContain('Thu 5 November 2026');
        expect(first.textContent).toMatch(/\d+ sessions · 8 h/);
        const switches = heads().map(h => h.querySelector('input.agenda-halfday'));
        expect(switches.map(s => s.checked)).toEqual([false, true]);
        expect(switches[1].dataset.actionChange).toBe('toggleAgendaHalfDay');
    });

    it('collapses and expands a day without touching its rows', () => {
        window.toggleAgendaDay('Day 1');
        const day1 = dataRows().filter(r => r.querySelector('input').value === 'Day 1');
        expect(day1.every(r => r.style.display === 'none')).toBe(true);
        expect(dataRows().filter(r => r.querySelector('input').value === 'Day 2').every(r => r.style.display === '')).toBe(true);
        window.expandAllAgendaDays();
        expect(dataRows().every(r => r.style.display === '')).toBe(true);
        window.collapseAllAgendaDays();
        expect(dataRows().every(r => r.style.display === 'none')).toBe(true);
    });

    it('regroups when a row is deleted, and a new row joins the last day', async () => {
        const n = dataRows().length;
        window.deleteAgendaRow(dataRows()[0].querySelector('[data-action="deleteAgendaRow"]'));
        expect(dataRows()).toHaveLength(n - 1);
        window.addAgendaRow({});
        await Promise.resolve();
        expect(dataRows().slice(-1)[0].querySelector('input').value).toBe('Day 2');
        expect(heads()).toHaveLength(2);
    });

    it('saving reads the data rows only, never the day headers', () => {
        const src = window.saveAuditPlan.toString();
        expect(src).toContain("#agenda-tbody tr:not(.agenda-day-head)");
        expect(src).toContain('halfDays: Array.from(window._agendaHalfDays');
    });
});

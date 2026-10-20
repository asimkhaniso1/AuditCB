import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import fs from 'fs';
import path from 'path';
import { M } from '../tools/pcc-scenario.mjs';

// The approved auditor-days can be scheduled as shorter days over more dates
// (2 auditor-days over four dates = four half days). The agenda builder and the
// plan gate allowed it, but the save check compared the agenda's last day with
// ceil(auditor-days) and refused it: "Agenda extends beyond the calculated
// audit duration".
const { IPI } = M;

const SIX = ['ISO 27001:2022', 'ISO 14001:2015', 'ISO 9001:2015', 'ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'];
const cert = (id, standard) => ({ id, standard, status: 'Active', initialDate: '2025-11-07', currentIssue: '2025-11-07', scope: 'Provision of translation and interpreting services.' });
const client = { id: 'lsuk', name: 'Language Services UK Limited', sites: [{ name: 'Head Office', employees: 10 }], contacts: [], keyProcesses: [], certificates: SIX.map((s, i) => cert('c' + i, s)) };
const auditors = [{ id: 'a1', name: 'Lead One', role: 'Lead Auditor', standards: SIX }];

beforeAll(() => {
    globalThis.window = globalThis.window || globalThis;
    window.showNotification = () => { };
    window.Sanitizer = { sanitizeText: (v) => v };
    window.Validator = {};
    window.UTILS = M.UTILS;
    loadScript('./planning-module.js', { global: true });
});

function planOver(date, endDate, finalDays) {
    const plan = {
        id: 'p', client: client.name, standard: SIX.join(', '), auditType: 'Surveillance 1', type: 'Surveillance 1', auditMethod: 'Remote',
        date, endDate, team: ['Lead One'], auditorIds: ['a1'], selectedSites: [{ name: 'Head Office' }], manDays: finalDays,
        teamAllocations: [{ auditor: 'Lead One', days: finalDays }], impartialityAssessment: { risk: 'None', notes: '' },
        durationCalculation: { basis: 'CB rule', baselineDays: finalDays, imsAdjustmentPercent: 0, remoteDays: finalDays, onsiteDays: 0, justifiedAdjustment: 0, justification: '', finalDays },
        timeZone: { iana: 'Europe/London', source: 'plan-agreed', confirmed: true }
    };
    const asm = IPI.assemble({ plan, client, auditors, state: window.state, settings: {} });
    expect(asm.agenda.errors).toEqual([]);
    return Object.assign(plan, asm.patch);
}

function saveCheck(plan, team) {
    window.state = { currentUser: { role: 'Admin', name: 'Admin' }, clients: [client], auditors: team || auditors, auditPlans: [], auditReports: [], ncrs: [], checklists: [] };
    document.body.innerHTML = `<select id="plan-client"><option value="${client.name}" selected>${client.name}</option></select><input type="checkbox" id="plan-cycle-confirmed" checked>`;
    const qa = window.validateAuditPlanForSave(plan);
    return { qa, dayErrors: qa.errors.filter(e => /^Agenda (extends beyond|runs past)/.test(e)), agendaCheck: qa.checks.find(c => /^Agenda contains/.test(c.label)) };
}

describe('auditor-days spread over more scheduled dates', () => {
    beforeAll(() => { window.state = { clients: [client], auditors, auditPlans: [], auditReports: [], ncrs: [], checklists: [] }; });

    it('2 auditor-days over four dates: four half days, accepted on save', () => {
        const plan = planOver('2026-11-03', '2026-11-06', 2);
        expect([...new Set(plan.agenda.map(r => r.day))]).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4']);
        // Each date is a four-hour morning with no lunch break.
        expect(plan.agenda.filter(r => r.kind === 'lunch')).toEqual([]);
        expect(plan.agenda.every(r => r.end <= '12:30')).toBe(true);
        const { dayErrors, agendaCheck } = saveCheck(plan);
        expect(dayErrors).toEqual([]);
        expect(agendaCheck.passed).toBe(true);
    });

    it('still refuses an agenda that runs past the last scheduled date', () => {
        const plan = planOver('2026-11-03', '2026-11-04', 2);
        plan.agenda = plan.agenda.concat([Object.assign({}, plan.agenda.at(-1), { day: 'Day 3' })]);
        const { dayErrors, agendaCheck } = saveCheck(plan);
        expect(dayErrors).toEqual(['Agenda runs past the last scheduled audit date.']);
        expect(agendaCheck.passed).toBe(false);
    });

    it('without dates, the limit is still the auditor-days', () => {
        const plan = planOver('2026-11-03', '2026-11-04', 2);
        plan.agenda = plan.agenda.concat([Object.assign({}, plan.agenda.at(-1), { day: 'Day 3' })]);
        plan.date = ''; plan.endDate = '';
        expect(saveCheck(plan).dayErrors).toEqual(['Agenda extends beyond the calculated audit duration.']);
    });
});

// A competence gap is the certification body's call: the save NOTIFIES it
// (a warning) instead of refusing the plan. The LSUK lead auditor's record
// covered 3 of the 6 standards ("Covers 3/6") and every save was blocked.
describe('competence gaps notify, they do not block', () => {
    const partial = [{ id: 'a1', name: 'Lead One', role: 'Lead Auditor', standards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022'] }];
    const gap = (m) => /lacks|does not collectively cover/i.test(m);

    it('a lead auditor covering 3 of 6 standards is a warning for each missing standard', () => {
        const { qa } = saveCheck(planOver('2026-11-03', '2026-11-04', 2), partial);
        expect(qa.errors.filter(gap)).toEqual([]);
        ['ISO 18841:2018', 'ISO 18587:2017', 'ISO 17100:2015'].forEach(std => {
            expect(qa.warnings).toContain('Lead Auditor lacks recorded competence for ' + std + '.');
            expect(qa.warnings).toContain('Audit team lacks recorded competence for ' + std + '.');
        });
        expect(qa.warnings.some(w => /Lead Auditor authorization|does not collectively cover/.test(w))).toBe(true);
    });

    it('a lead without the Lead Auditor role still blocks', () => {
        const { qa } = saveCheck(planOver('2026-11-03', '2026-11-04', 2), [Object.assign({}, partial[0], { role: 'Auditor' })]);
        expect(qa.errors).toContain('The assigned lead must have the Lead Auditor role.');
    });
});

import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { M } from '../tools/pcc-scenario.mjs';

// Editing a Remote plan loaded its 0 on-site days as a BLANK field
// (`plan.onsiteDays || ''`), and the save refused the blank with "Onsite Days
// must be a valid number" behind a bare "Please fix the form errors" — Pre-save
// QA never ran, so it showed nothing.
const SRC = fs.readFileSync(path.resolve('./planning-module.js'), 'utf8');
const VALIDATOR = fs.readFileSync(path.resolve('./validation.js'), 'utf8');

const client = { id: 'lsuk', name: 'Language Services UK Limited', sites: [{ name: 'Head Office', employees: 10 }], contacts: [], keyProcesses: [], certificates: [] };
const remotePlan = {
    id: 'p1', client: client.name, standard: 'ISO 9001:2015', type: 'Surveillance 1', auditType: 'Surveillance 1', auditMethod: 'Remote',
    date: '2026-11-03', endDate: '2026-11-04', team: [], manDays: 2, onsiteDays: 0, selectedSites: [], agenda: [],
    durationCalculation: { baselineDays: 3, remoteDays: 2, onsiteDays: 0, justifiedAdjustment: -1, justification: 'Documents review performed online', finalDays: 2 }
};

let notes;
beforeAll(() => {
    globalThis.window = globalThis.window || globalThis;
    window.UTILS = M.UTILS;
    window.Sanitizer = { sanitizeText: (v) => v };
    window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
    if (!window.Validator) (0, eval)(VALIDATOR);
    (0, eval)(SRC);
});

async function openForEdit(plan) {
    notes = [];
    window.showNotification = (m, t) => notes.push([t, m]);
    window.state = { currentUser: { role: 'Admin', name: 'Admin' }, clients: [client], auditors: [], auditPlans: [plan], auditReports: [], ncrs: [], checklists: [], settings: {} };
    document.body.innerHTML = '<div id="content-area"></div>';
    window.contentArea = document.getElementById('content-area');
    vi.useFakeTimers();
    window.editAuditPlan(plan.id);
    vi.runAllTimers();
    vi.useRealTimers();
}

describe('editing a Remote plan', () => {
    it('loads 0 on-site days as 0, not a blank field', async () => {
        await openForEdit(remotePlan);
        expect(document.getElementById('plan-onsite-days').value).toBe('0');
        expect(document.getElementById('plan-remote-days').value).toBe('2');
    });

    it('a plan saved before durationCalculation existed also loads 0', async () => {
        await openForEdit(Object.assign({}, remotePlan, { id: 'p2', durationCalculation: undefined }));
        expect(document.getElementById('plan-onsite-days').value).toBe('0');
    });

    it('a blank on-site field is saved as 0 instead of failing the form check', async () => {
        await openForEdit(remotePlan);
        document.getElementById('plan-onsite-days').value = '';
        try { window.saveAuditPlan(false, true); } catch (_e) { /* later steps need more of the app; only the form check matters here */ }
        expect(document.getElementById('plan-onsite-days').value).toBe('0');
        expect(notes.map(n => n[1]).join(' ')).not.toMatch(/Onsite Days must be a valid number/);
    });

    it('a form error names the field instead of "Please fix the form errors"', async () => {
        await openForEdit(remotePlan);
        document.getElementById('plan-mandays').value = '';
        try { window.saveAuditPlan(false, true); } catch (_e) { /* see above */ }
        expect(notes.find(n => n[0] === 'error')[1]).toMatch(/^Please fix: .*Man-Days/);
    });
});

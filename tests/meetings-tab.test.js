// Execution → Meetings tab (opening / closing meeting records, ISO/IEC 17021-1
// 9.4.7). Checked control by control on the PC Connection audit:
//  - an attendee added by hand was saved but not shown again, so the next save
//    dropped them; its ✕ removed only the button, so a "removed" attendee was
//    still saved;
//  - a meeting not yet recorded defaulted to 09:00 / 17:00 (closing date blank)
//    instead of the plan's opening and closing rows;
//  - the closing agenda printed "Major: 90 days, Minor: 6 months", which the
//    app's CAPA due dates contradict, and grading omitted observations.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

const plan = { id: 'p1', auditType: 'Recertification', standard: 'ISO/IEC 27001:2022',
    agenda: [
        { kind: 'opening', date: '2026-11-17', start: '08:30' },
        { kind: 'session', date: '2026-11-17', start: '09:00' },
        { kind: 'closing', date: '2026-11-19', start: '11:45' }
    ] };
const ctx = {
    plan,
    auditTeam: [{ name: 'Muhammad Asim Khan', role: 'Lead Auditor' }],
    clientPersonnel: [{ name: 'Samantha Johnston', role: 'Process & Quality Manager' }],
    clientData: { name: 'PC CONNECTION, INC.' }
};
let report, synced;

function render(r) {
    window.__renderExecutionTab(r, 'meetings', ctx);
    return document.getElementById('tab-content');
}

beforeEach(() => {
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [plan], settings: {}, cbSettings: {}, currentUser: { role: 'Lead Auditor' } };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
    window.ReportStats = require('../report-stats.js');
    window.showNotification = vi.fn();
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    synced = null;
    report = { id: 'r1', planId: 'p1', date: '2026-11-17', standard: 'ISO/IEC 27001:2022' };
    window.DataService = { findAuditReport: () => report, syncAuditReport: (id, patch) => { synced = patch; } };
    document.body.innerHTML = '<div id="tab-content"></div>';
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
});

describe('meeting defaults come from the plan', () => {
    it('opening 08:30 on day 1 and closing 11:45 on the last day when nothing is recorded', () => {
        render(report);
        expect(document.getElementById('opening-date').value).toBe('2026-11-17');
        expect(document.getElementById('opening-time').value).toBe('08:30');
        expect(document.getElementById('closing-date').value).toBe('2026-11-19');
        expect(document.getElementById('closing-time').value).toBe('11:45');
    });

    it('recorded values win over the plan', () => {
        report.openingMeeting = { date: '2026-11-17', time: '08:40' };
        render(report);
        expect(document.getElementById('opening-time').value).toBe('08:40');
    });
});

describe('agenda wording', () => {
    it('grading names observations, and timelines are not invented when the CB has none configured', () => {
        const tab = render(report);
        expect(tab.textContent).toContain('Finding grading criteria (Major / Minor NC, observation, OFI)');
        expect(tab.textContent).toContain('Presentation of audit findings (Major / Minor NCs, observations, OFIs)');
        expect(tab.textContent).toContain('Corrective action timelines and evidence required (per the CB procedure)');
        expect(tab.textContent).not.toContain('6 months');
    });

    it('states the configured CB timeframes', () => {
        window.state.cbSettings = { capaTimeframes: { default: { major: 30, minor: 90 } } };
        const tab = render(report);
        expect(tab.textContent).toContain('Corrective action timelines (Major: 30 days, Minor: 90 days)');
    });

    it('keeps the saved agenda ticks (keys unchanged)', () => {
        report.closingMeeting = { keyPointers: { 'cl-capa-timelines': true, 'cl-findings': true } };
        render(report);
        expect(document.querySelector('.closing-pointer[data-key="cl-capa-timelines"]').checked).toBe(true);
        expect(document.querySelector('.closing-pointer[data-key="cl-findings"]').checked).toBe(true);
    });
});

describe('attendees', () => {
    it('ticks, adds and removes attendees and saves exactly that list', () => {
        render(report);
        document.querySelector('.opening-attendee-cb[data-name="Samantha Johnston"]').checked = true;
        document.getElementById('opening-custom-name').value = 'Ken Mason';
        document.getElementById('opening-custom-role').value = 'Senior Director';
        document.getElementById('opening-custom-org').value = 'Connection';
        window.addCustomMeetingAttendee('opening');
        document.getElementById('opening-custom-name').value = 'Typo Person';
        window.addCustomMeetingAttendee('opening');
        const remove = Array.from(document.querySelectorAll('#opening-custom-list .custom-attendee-item'))
            .find(el => el.dataset.name === 'Typo Person').querySelector('button');
        expect(remove.getAttribute('data-action')).toBe('removeCustomMeetingAttendee');
        window.removeCustomMeetingAttendee(remove);
        window.saveMeetingRecords('r1');
        expect(synced.openingMeeting.attendees.map(a => a.name)).toEqual(['Samantha Johnston', 'Ken Mason']);
        expect(synced.openingMeeting.attendees[1]).toEqual({ name: 'Ken Mason', role: 'Senior Director', organization: 'Connection' });
    });

    it('an added attendee is shown again after reopening, so the next save keeps them', () => {
        report.openingMeeting = { attendees: [
            { name: 'Samantha Johnston', role: 'Process & Quality Manager', organization: 'PC CONNECTION, INC.' },
            { name: 'Ken Mason', role: 'Senior Director', organization: 'Connection' }
        ] };
        render(report);
        expect(document.querySelector('.opening-attendee-cb[data-name="Samantha Johnston"]').checked).toBe(true);
        const added = Array.from(document.querySelectorAll('#opening-custom-list .custom-attendee-item')).map(el => el.dataset.name);
        expect(added).toEqual(['Ken Mason']);
        window.saveMeetingRecords('r1');
        expect(synced.openingMeeting.attendees.map(a => a.name)).toEqual(['Samantha Johnston', 'Ken Mason']);
    });

    it('asks for a name before adding', () => {
        render(report);
        window.addCustomMeetingAttendee('closing');
        expect(window.showNotification).toHaveBeenCalledWith('Please enter a name', 'error');
        expect(document.querySelectorAll('#closing-custom-list .custom-attendee-item')).toHaveLength(0);
    });
});

describe('save', () => {
    it('saves dates, times, notes, summary, response and agenda ticks for both meetings', () => {
        render(report);
        document.getElementById('opening-notes').value = 'Scope confirmed';
        document.getElementById('closing-summary').value = '1 Minor, 2 OBS';
        document.getElementById('closing-response').value = 'Accepted';
        document.querySelector('.opening-pointer[data-key="op-scope"]').checked = true;
        window.saveMeetingRecords('r1');
        expect(synced.openingMeeting).toMatchObject({ date: '2026-11-17', time: '08:30', notes: 'Scope confirmed' });
        expect(synced.openingMeeting.keyPointers['op-scope']).toBe(true);
        expect(synced.closingMeeting).toMatchObject({ date: '2026-11-19', time: '11:45', summary: '1 Minor, 2 OBS', response: 'Accepted' });
        expect(report.closingMeeting.summary).toBe('1 Minor, 2 OBS');
    });
});

describe('bulk ticks', () => {
    it('Select all ticks and clears a whole list, and follows the list', () => {
        render(report);
        const all = document.querySelector(".meeting-select-all[data-target='.opening-pointer']");
        expect(all).not.toBeNull();
        all.checked = true;
        window.toggleMeetingSelectAll(all);
        const points = Array.from(document.querySelectorAll('.opening-pointer'));
        expect(points.length).toBe(9);
        expect(points.every(cb => cb.checked)).toBe(true);
        points[0].checked = false;
        window.syncMeetingSelectAll();
        expect(all.checked).toBe(false);
        expect(all.indeterminate).toBe(true);
        window.saveMeetingRecords('r1');
        expect(Object.values(synced.openingMeeting.keyPointers).filter(Boolean)).toHaveLength(8);
    });

    it('each attendee group has its own Select all', () => {
        render(report);
        const team = document.querySelector(".meeting-select-all[data-target=\".closing-attendee-cb[data-group='team']\"]");
        const client = document.querySelector(".meeting-select-all[data-target=\".closing-attendee-cb[data-group='client']\"]");
        client.checked = true;
        window.toggleMeetingSelectAll(client);
        expect(document.querySelector('.closing-attendee-cb[data-name="Samantha Johnston"]').checked).toBe(true);
        expect(document.querySelector('.closing-attendee-cb[data-name="Muhammad Asim Khan"]').checked).toBe(false);
        expect(team.checked).toBe(false);
    });

    it('starts ticked when the saved list is all ticked', () => {
        report.closingMeeting = { keyPointers: Object.fromEntries(['cl-findings', 'cl-ncr-severity', 'cl-capa-timelines', 'cl-positive', 'cl-recommendation', 'cl-appeals', 'cl-followup', 'cl-remote-evidence', 'cl-cert-scope'].map(k => [k, true])) };
        render(report);
        expect(document.querySelector(".meeting-select-all[data-target='.closing-pointer']").checked).toBe(true);
    });

    it('Same as opening copies the opening attendees, including added people', () => {
        render(report);
        document.querySelector('.opening-attendee-cb[data-name="Samantha Johnston"]').checked = true;
        document.getElementById('opening-custom-name').value = 'Ken Mason';
        window.addCustomMeetingAttendee('opening');
        window.copyOpeningAttendeesToClosing();
        window.saveMeetingRecords('r1');
        expect(synced.closingMeeting.attendees.map(a => a.name)).toEqual(['Samantha Johnston', 'Ken Mason']);
    });
});

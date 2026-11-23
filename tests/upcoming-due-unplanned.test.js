// Dashboard "Upcoming Audits": audits the certificate cycle owes soon with
// nothing planned (user request 2026-11-21 — the card showed 0 upcoming while
// recertifications fell due within days). Real ReportStats + planning domain,
// so the due dates are the ones each client's cycle card shows.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const UA = require('../upcoming-audits.js');
const RS = require('../report-stats.js');
const APD = require('../audit-planning-domain.js');

const TODAY = '2026-11-21';

// First certified 11 Dec 2025: Surveillance 1 is due 11 Dec 2026, so its
// window (due ±30 days) is open today.
function client(id, name, certs, extra) {
    return Object.assign({ id, name, status: 'Active', certificates: certs }, extra || {});
}
function cert(standard, initialDate, extra) {
    return Object.assign({ id: `${standard}-${initialDate}`, standard, initialDate, status: 'Active' }, extra || {});
}
function deps(extra) {
    return Object.assign({
        today: TODAY,
        cycleState: RS.cycleState,
        resolveCycle: APD.resolveCertificateCycle,
        belongsTo: RS.recordBelongsTo,
        coversStandard: RS.coversStandard,
        reports: [],
        settings: {}
    }, extra || {});
}

describe('UpcomingAudits.dueUnplanned', () => {
    it('lists the owed audit with its due date and window when nothing is planned', () => {
        const due = UA.dueUnplanned([client('a', 'Alpha Ltd', [cert('ISO 9001:2015', '2025-12-11')])], [], deps());
        expect(due).toHaveLength(1);
        expect(due[0]).toMatchObject({
            client: 'Alpha Ltd', auditType: 'Surveillance 1', standards: ['ISO 9001:2015'],
            due: '2026-12-11', windowStart: '2026-11-11', windowEnd: '2027-01-10',
            windowOpen: true, relative: 'Due in 20 days', bucket: 'due'
        });
    });

    it('leaves it out once a plan for that client, scheme and audit type sits near the due date', () => {
        const c = client('b', 'Beta Ltd', [cert('ISO 9001:2015', '2025-12-11')]);
        const planned = [{ id: 'p1', clientId: 'b', client: 'Beta Ltd', standard: 'ISO 9001:2015', auditType: 'Surveillance 1', date: '2026-12-08', status: 'Draft' }];
        expect(UA.dueUnplanned([c], planned, deps())).toEqual([]);
        // A cancelled plan, another client's plan, or a different audit type does not count.
        const notIt = [
            Object.assign({}, planned[0], { status: 'Cancelled' }),
            Object.assign({}, planned[0], { clientId: 'zz', client: 'Other Co' }),
            Object.assign({}, planned[0], { auditType: 'Recertification' })
        ];
        expect(UA.dueUnplanned([c], notIt, deps())).toHaveLength(1);
        // Last year's surveillance plan (12 months off) is not this one either.
        expect(UA.dueUnplanned([c], [Object.assign({}, planned[0], { date: '2025-12-10' })], deps())).toHaveLength(1);
    });

    it('matches a plan that names the client but carries no clientId, ignoring legal form', () => {
        const c = client('g', 'Gamma Traders (Pvt.) Ltd.', [cert('ISO 9001:2015', '2025-12-11')]);
        const plan = { id: 'p', clientId: null, client: 'GAMMA TRADERS', standard: 'ISO 9001:2015', auditType: 'Surveillance', date: '2026-12-15', status: 'Scheduled' };
        expect(UA.dueUnplanned([c], [plan], deps())).toEqual([]);
    });

    it('leaves out an audit already on record (a completed plan this cycle)', () => {
        const c = client('e', 'Epsilon Ltd', [cert('ISO 9001:2015', '2025-12-11')]);
        const done = [{ id: 'd', clientId: 'e', client: 'Epsilon Ltd', standard: 'ISO 9001:2015', auditType: 'Surveillance 1', date: '2026-11-15', status: 'Completed' }];
        expect(UA.dueUnplanned([c], done, deps())).toEqual([]);
    });

    it('waits until the window opens within 90 days', () => {
        const far = client('c', 'Far Ltd', [cert('ISO 9001:2015', '2026-06-01')]); // S1 window opens 2 May 2027
        expect(UA.dueUnplanned([far], [], deps())).toEqual([]);
        expect(UA.dueUnplanned([far], [], deps({ horizonDays: 200 }))).toHaveLength(1);
    });

    it('lists an integrated client once with every scheme on the same cycle', () => {
        const ims = client('d', 'Delta Ltd', [cert('ISO 9001:2015', '2025-12-11'), cert('ISO 14001:2015', '2025-12-11')]);
        const due = UA.dueUnplanned([ims], [], deps());
        expect(due).toHaveLength(1);
        expect(due[0].standards).toEqual(['ISO 9001:2015', 'ISO 14001:2015']);
    });

    it('skips withdrawn certificates, inactive clients and undated certificates', () => {
        expect(UA.dueUnplanned([
            client('w', 'W Ltd', [cert('ISO 9001:2015', '2025-12-11', { status: 'Withdrawn' })]),
            client('i', 'I Ltd', [cert('ISO 9001:2015', '2025-12-11')], { status: 'Inactive' }),
            client('u', 'U Ltd', [{ standard: 'ISO 9001:2015', status: 'Active' }])
        ], [], deps())).toEqual([]);
    });

    it('sorts by due date and says when a window that is still open has passed its due date', () => {
        const due = UA.dueUnplanned([
            client('a', 'Alpha Ltd', [cert('ISO 9001:2015', '2025-12-11')]),
            client('l', 'Late Ltd', [cert('ISO 9001:2015', '2025-11-10')]) // S1 due 10 Nov, window to 10 Dec
        ], [], deps());
        expect(due.map(d => d.client)).toEqual(['Late Ltd', 'Alpha Ltd']);
        expect(due[0].relative).toBe('Window closes in 19 days');
    });

    it('returns nothing (never throws) when the cycle engines are not loaded', () => {
        expect(UA.dueUnplanned([client('a', 'Alpha Ltd', [cert('ISO 9001:2015', '2025-12-11')])], [], { today: TODAY })).toEqual([]);
    });
});

describe('panel with due-not-planned audits', () => {
    beforeEach(() => { window.localStorage.clear(); });

    const evil = 'Acme <img src=x onerror=alert(1)>';
    function model(plans) {
        const due = UA.dueUnplanned([client('a', evil, [cert('ISO 9001:2015', '2025-12-11')])], [], deps());
        return UA.build(plans, { today: TODAY, due });
    }

    it('lists them after booked upcoming audits and before the collapsed passed group, outside the count', () => {
        const m = model([
            { id: 'up', client: 'Booked Co', date: '2026-11-30', status: 'Scheduled' },
            { id: 'old', client: 'Old Co', date: '2026-08-14', status: 'Scheduled' }
        ]);
        const html = UA.panelHtml(m);
        expect(html).toContain('Upcoming Audits <span class="ua-count">1</span>');
        const booked = html.indexOf('data-id="up"');
        const dueAt = html.indexOf('Due by certificate cycle — not planned <span>1</span>');
        const passed = html.indexOf('Dates passed — not closed');
        expect(booked).toBeGreaterThan(-1);
        expect(dueAt).toBeGreaterThan(booked);
        expect(passed).toBeGreaterThan(dueAt);
        expect(html).toContain('data-action="renderCreateAuditPlanForm"');
        expect(html).toContain('Window 11 Nov 2026 – 10 Jan 2027');
        expect(html).toContain('Not planned');
        expect(html).not.toContain('<img');
        expect(html).toContain('data-id="Acme &lt;img src=x onerror=alert(1)&gt;"');
    });

    it('shows them under the empty state when nothing is booked', () => {
        const html = UA.panelHtml(model([]));
        const empty = html.indexOf('No upcoming audits are scheduled.');
        expect(empty).toBeGreaterThan(-1);
        expect(html.indexOf('Due by certificate cycle — not planned')).toBeGreaterThan(empty);
    });

    it('points the calendar view at the list for them', () => {
        window.localStorage.setItem(UA.VIEW_KEY, 'calendar');
        expect(UA.panelHtml(model([]))).toContain('1 due by cycle, not planned — see list');
    });
});

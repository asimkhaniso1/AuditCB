import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const UA = require('../upcoming-audits.js');

// Monday 19 October 2026.
const TODAY = '2026-10-19';

function plan(id, date, extra) {
    return Object.assign({ id, client: `Client ${id}`, date, status: 'Planned' }, extra || {});
}

describe('which plans count as upcoming', () => {
    it('drops completed, closed and cancelled plans and keeps everything else open', () => {
        const model = UA.build([
            plan('a', '2026-10-21'),
            plan('b', '2026-10-22', { status: 'Completed' }),
            plan('c', '2026-10-23', { status: 'Closed' }),
            plan('d', '2026-10-24', { status: 'Cancelled' }),
            plan('e', '2026-10-25', { status: 'Draft' }),
            plan('f', null, { status: 'Scheduled' })
        ], { today: TODAY });
        expect(model.items.map(i => i.id)).toEqual(['a', 'e', 'f']);
        expect(model.openCount).toBe(3);
        expect(model.count).toBe(2); // the undated plan is open but not "upcoming"
    });

    it('uses the injected completion rule (DataService.isPlanCompleted)', () => {
        const model = UA.build([plan('a', '2026-10-21', { status: 'Finalized' }), plan('b', '2026-10-22')], {
            today: TODAY,
            isCompleted: p => p.status === 'Finalized'
        });
        expect(model.items.map(i => i.id)).toEqual(['b']);
    });

    it('openCount equals the listed items and bucket totals; count is the upcoming part only', () => {
        const model = UA.build([
            plan('a', '2026-09-01'), plan('b', TODAY), plan('c', '2026-10-25'),
            plan('d', '2026-11-10'), plan('e', '2027-03-01'), plan('f', '')
        ], { today: TODAY });
        const inBuckets = model.buckets.reduce((s, b) => s + b.items.length, 0);
        expect(model.openCount).toBe(6);
        expect(inBuckets).toBe(6);
        expect(Object.values(model.counts).reduce((s, n) => s + n, 0)).toBe(6);
        expect(model.count).toBe(4); // today, +6, +22, next year
        expect(model.count + model.counts.overdue + model.counts.unscheduled).toBe(model.openCount);
    });
});

describe('bucketing and ordering', () => {
    it('places each audit in its window relative to today', () => {
        const at = (start, end) => UA.bucketOf({ start, end: end || start }, TODAY);
        expect(at('2026-10-10', '2026-10-18')).toBe('overdue');    // ended yesterday
        expect(at('2026-10-17', '2026-10-20')).toBe('now');        // spans today
        expect(at(TODAY)).toBe('now');
        expect(at('2026-10-20')).toBe('week');                     // tomorrow
        expect(at('2026-10-26')).toBe('week');                     // +7
        expect(at('2026-10-27')).toBe('month');                    // +8
        expect(at('2026-11-18')).toBe('month');                    // +30
        expect(at('2026-11-19')).toBe('later');                    // +31
        expect(UA.bucketOf({ start: null, end: null }, TODAY)).toBe('unscheduled');
    });

    it('lists upcoming soonest first (in progress, then by start date), then undated, then passed-but-open', () => {
        const model = UA.build([
            plan('later', '2027-01-10'),
            plan('undated', null),
            plan('week2', '2026-10-24'),
            plan('week1', '2026-10-21'),
            plan('running', '2026-10-18', { endDate: '2026-10-20' }),
            plan('passed', '2026-08-03', { endDate: '2026-08-05' })
        ], { today: TODAY });
        expect(model.items.map(i => i.id)).toEqual(['running', 'week1', 'week2', 'later', 'undated', 'passed']);
        expect(model.buckets.map(b => b.key)).toEqual(['now', 'week', 'later', 'unscheduled', 'overdue']);
        expect(model.buckets.filter(b => b.secondary).map(b => b.key)).toEqual(['unscheduled', 'overdue']);
    });

    it('breaks start-date ties by end date, then client name', () => {
        const model = UA.build([
            plan('x', '2026-10-21', { client: 'Zeta', endDate: '2026-10-22' }),
            plan('y', '2026-10-21', { client: 'Beta', endDate: '2026-10-23' }),
            plan('z', '2026-10-21', { client: 'Alpha', endDate: '2026-10-22' })
        ], { today: TODAY });
        expect(model.items.map(i => i.id)).toEqual(['z', 'x', 'y']);
    });

    it('describes when each audit happens', () => {
        const rel = (start, end) => UA.relativeLabel({ start, end: end || start }, TODAY);
        expect(rel(TODAY)).toBe('Today');
        expect(rel('2026-10-20')).toBe('Tomorrow');
        expect(rel('2026-10-24')).toBe('In 5 days');
        expect(rel('2026-10-18', '2026-10-21')).toBe('Day 2 of 4');
        expect(rel('2026-10-15', '2026-10-18')).toBe('Ended 1 day ago');
        expect(rel(null)).toBe('Date not set');
    });
});

describe('plan normalisation', () => {
    const auditors = [{ id: 'aud-1', name: 'Sara Ahmed' }, { id: 7, name: 'Omar Khan' }];

    it('reads client, standards, audit type, dates, lead and status', () => {
        const it = UA.normalizePlan({
            id: 9, client: 'Atlas AG', standard: 'ISO 9001:2015, ISO 14001:2015, ISO 9001:2015',
            auditType: 'Stage 2', date: '2026-11-03', endDate: '2026-11-05', leadAuditor: 'aud-1', status: 'Confirmed'
        }, auditors);
        expect(it).toMatchObject({
            id: 9, client: 'Atlas AG', standards: ['ISO 9001:2015', 'ISO 14001:2015'],
            auditType: 'Stage 2', typeKey: 'stage2', start: '2026-11-03', end: '2026-11-05',
            lead: 'Sara Ahmed', status: 'Confirmed'
        });
    });

    it('falls back to the first team member, then the first assigned auditor id', () => {
        expect(UA.normalizePlan({ date: TODAY, team: ['Bilal', 'Hina'] }, auditors).lead).toBe('Bilal');
        expect(UA.normalizePlan({ date: TODAY, auditors: [7] }, auditors).lead).toBe('Omar Khan');
        expect(UA.normalizePlan({ date: TODAY }, auditors).lead).toBe('');
    });

    it('repairs end dates: missing or before the start means a one-day audit; runaway spans are capped', () => {
        expect(UA.normalizePlan({ date: '2026-10-21' }).end).toBe('2026-10-21');
        expect(UA.normalizePlan({ date: '2026-10-21', endDate: '2026-10-01' }).end).toBe('2026-10-21');
        const capped = UA.normalizePlan({ date: '2026-10-21', endDate: '2027-10-21' });
        expect(UA.diffDays(capped.start, capped.end)).toBe(62);
    });

    it('takes the audit type from auditType, then type, then the certification cycle', () => {
        expect(UA.normalizePlan({ type: 'Surveillance 1' }).auditType).toBe('Surveillance 1');
        expect(UA.normalizePlan({ certificationCycle: { auditType: 'Recertification' } }).typeKey).toBe('recert');
        expect(UA.normalizePlan({}).auditType).toBe('Audit');
    });

    it('maps audit types onto colour keys', () => {
        expect(UA.typeKey('Stage 1')).toBe('stage1');
        expect(UA.typeKey('Initial Certification - Stage 2')).toBe('stage2');
        expect(UA.typeKey('Surveillance 2')).toBe('surveillance');
        expect(UA.typeKey('Re-certification')).toBe('recert');
        expect(UA.typeKey('Special Audit')).toBe('other');
    });

    it('reads date-only and timestamp values as local calendar days, rejecting impossible dates', () => {
        expect(UA.toDay('2026-10-19')).toBe('2026-10-19');
        expect(UA.toDay('2026-10-19T23:30:00Z')).toBe('2026-10-19');
        expect(UA.toDay(new Date(2026, 9, 19, 15))).toBe('2026-10-19');
        expect(UA.toDay('2026-02-30')).toBeNull();
        expect(UA.toDay('not a date')).toBeNull();
        expect(UA.toDay('')).toBeNull();
    });

    it('writes date ranges without numeric ambiguity', () => {
        expect(UA.formatRange('2026-11-03', '2026-11-03')).toBe('3 Nov 2026');
        expect(UA.formatRange('2026-11-03', '2026-11-05')).toBe('3–5 Nov 2026');
        expect(UA.formatRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov 2026');
        expect(UA.formatRange('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027');
        expect(UA.formatRange(null)).toBe('Date not set');
    });
});

describe('month calendar grid', () => {
    function items(list) { return UA.build(list, { today: TODAY }).items; }

    it('lays October 2026 out in Monday-first weeks with today marked', () => {
        const grid = UA.monthGrid(2026, 9, [], TODAY);
        expect(grid.label).toBe('October 2026');
        expect(grid.weeks).toHaveLength(5);
        expect(grid.weeks[0].days[0]).toMatchObject({ iso: '2026-09-28', inMonth: false });
        expect(grid.weeks[0].days[3]).toMatchObject({ iso: '2026-10-01', inMonth: true });
        expect(grid.weeks[4].days[6]).toMatchObject({ iso: '2026-11-01', inMonth: false, isWeekend: true });
        const todays = grid.weeks.flatMap(w => w.days).filter(d => d.isToday);
        expect(todays.map(d => d.iso)).toEqual([TODAY]);
    });

    it('draws a multi-day audit as one bar per week, split where it crosses a week boundary', () => {
        const grid = UA.monthGrid(2026, 9, items([plan('m', '2026-10-30', { endDate: '2026-11-03' })]), TODAY);
        const last = grid.weeks[4];
        expect(last.segments).toHaveLength(1);
        expect(last.segments[0]).toMatchObject({ col: 4, span: 3, continuesBefore: false, continuesAfter: true });

        const nov = UA.monthGrid(2026, 10, items([plan('m', '2026-10-30', { endDate: '2026-11-03' })]), TODAY);
        // November 2026 starts on a Sunday, so week 1 is 26 Oct–1 Nov and week 2 starts 2 Nov.
        expect(nov.weeks[0].segments[0]).toMatchObject({ col: 4, span: 3, continuesAfter: true });
        expect(nov.weeks[1].segments[0]).toMatchObject({ col: 0, span: 2, continuesBefore: true, continuesAfter: false });
    });

    it('stacks overlapping audits on separate lanes and reuses a lane once it is free', () => {
        const grid = UA.monthGrid(2026, 9, items([
            plan('a', '2026-10-19', { endDate: '2026-10-21' }),
            plan('b', '2026-10-20', { endDate: '2026-10-20' }),
            plan('c', '2026-10-22', { endDate: '2026-10-23' })
        ]), TODAY);
        const week = grid.weeks[3];
        const lane = id => week.segments.find(s => s.item.id === id).lane;
        expect(lane('a')).toBe(0);
        expect(lane('b')).toBe(1);
        expect(lane('c')).toBe(0);
        expect(week.laneCount).toBe(2);
    });

    it('counts audits touching the month and leaves undated ones off the calendar', () => {
        const grid = UA.monthGrid(2026, 9, items([
            plan('a', '2026-09-29', { endDate: '2026-10-01' }),
            plan('b', '2026-10-25'),
            plan('c', '2026-11-05'),
            plan('d', null)
        ]), TODAY);
        expect(grid.count).toBe(2);
        const ids = grid.weeks.flatMap(w => w.segments.map(s => s.item.id));
        expect(ids).not.toContain('d');
    });
});

describe('panel rendering', () => {
    const evil = '<img src=x onerror=alert(1)>';
    let model;

    beforeEach(() => {
        window.localStorage.clear();
        model = UA.build([
            plan('p"1', '2026-10-21', { client: evil, leadAuditor: evil, standard: evil, auditType: 'Stage 1' }),
            plan('p2', null, { client: 'No Date Ltd' })
        ], { today: TODAY });
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('escapes client, auditor and standard text and the plan id in the list view', () => {
        const html = UA.panelHtml(model);
        expect(html).toContain('data-action="viewAuditPlan"');
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('data-id="p&quot;1"');
        expect(html).toContain('Upcoming Audits <span class="ua-count">1</span>');
    });

    it('opens in the calendar view when that is the viewer\'s saved choice, still escaped', () => {
        window.localStorage.setItem(UA.VIEW_KEY, 'calendar');
        const html = UA.panelHtml(model);
        expect(html).toContain('class="ua-cal"');
        expect(html).toContain('aria-current="date"');
        expect(html).not.toContain('<img');
        expect(html).toContain('1 without a date');
    });

    it('falls back to the list view when storage is unavailable', () => {
        vi.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(UA.panelHtml(model)).toContain('class="ua-list"');
    });

    it('remembers the toggle and re-renders the mounted panel in place', () => {
        document.body.innerHTML = `<div id="host">${UA.panelHtml(model)}</div>`;
        UA.showCalendar();
        expect(window.localStorage.getItem(UA.VIEW_KEY)).toBe('calendar');
        expect(document.querySelector('.ua-cal-label').textContent).toContain('October 2026');
        UA.nextMonth();
        expect(document.querySelector('.ua-cal-label').textContent).toContain('November 2026');
        UA.thisMonth();
        expect(document.querySelector('.ua-cal-label').textContent).toContain('October 2026');
        UA.showList();
        expect(window.localStorage.getItem(UA.VIEW_KEY)).toBe('list');
        expect(document.querySelector('.ua-list')).not.toBeNull();
    });

    it('shows an empty state with a route to planning when nothing is open', () => {
        const html = UA.panelHtml(UA.build([], { today: TODAY }));
        expect(html).toContain('No upcoming audits are scheduled.');
        expect(html).toContain('data-id="audit-planning"');
    });
});

// Live report 2026-11-21: the card opened on "Dates passed — not closed 8" with
// a badge of 8 because every open plan was overdue and the overdue group was
// listed first and counted as "upcoming". Upcoming must lead and own the count.
describe('upcoming audits lead; dates-passed plans are secondary', () => {
    const NOW = '2026-11-21';
    const plans = [
        plan('shanghai', '2026-01-08', { status: 'Scheduled' }),
        plan('ktd', '2026-08-14', { status: 'Scheduled' }),
        plan('pcc', '2026-11-17', { endDate: '2026-11-19', status: 'In Progress' }), // multi-day, ended 2 days ago
        plan('today', NOW, { status: 'Scheduled' }),
        plan('spanning', '2026-11-20', { endDate: '2026-11-23', status: 'In Progress' }), // started yesterday, endDate in future
        plan('soon', '2026-11-25', { endDate: '2026-11-26' }),
        plan('next-month', '2026-12-15'),
        plan('done', '2026-12-01', { status: 'Completed' })
    ];

    beforeEach(() => { window.localStorage.clear(); });

    it('counts only today-or-later audits, using endDate for multi-day plans', () => {
        const model = UA.build(plans, { today: NOW });
        expect(model.count).toBe(4);
        expect(model.counts.overdue).toBe(3);
        expect(model.openCount).toBe(7);
        expect(model.items.map(i => i.id)).toEqual(['spanning', 'today', 'soon', 'next-month', 'pcc', 'ktd', 'shanghai']);
        expect(model.items.find(i => i.id === 'pcc').bucket).toBe('overdue');
        expect(model.items.find(i => i.id === 'spanning').bucket).toBe('now');
        expect(model.items.find(i => i.id === 'today').bucket).toBe('now');
    });

    it('renders upcoming rows before a collapsed dates-passed group', () => {
        const html = UA.panelHtml(UA.build(plans, { today: NOW }));
        expect(html).toContain('Upcoming Audits <span class="ua-count">4</span>');
        expect(html).not.toContain('No upcoming audits are scheduled.');
        const firstRow = html.indexOf('ua-row');
        const passed = html.indexOf('Dates passed — not closed');
        expect(firstRow).toBeGreaterThan(-1);
        expect(passed).toBeGreaterThan(html.indexOf('data-id="next-month"'));
        expect(html).toMatch(/<details class="ua-group ua-secondary ua-secondary-overdue">\s*<summary/);
        expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    });

    it('shows an upcoming empty state first when every open plan is past, keeping them below', () => {
        const past = plans.filter(p => ['shanghai', 'ktd', 'pcc'].includes(p.id));
        const model = UA.build(past, { today: NOW });
        expect(model.count).toBe(0);
        expect(model.openCount).toBe(3);
        const html = UA.panelHtml(model);
        expect(html).toContain('Upcoming Audits <span class="ua-count">0</span>');
        const empty = html.indexOf('No upcoming audits are scheduled.');
        expect(empty).toBeGreaterThan(-1);
        expect(empty).toBeLessThan(html.indexOf('Dates passed — not closed'));
        expect(html).toContain('data-id="shanghai"');
        expect(html).toContain('Ended 2 days ago');
    });
});

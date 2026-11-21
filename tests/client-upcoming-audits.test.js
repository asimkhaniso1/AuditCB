// Client Overview "Upcoming Audits" alert, the Overview timeline and the Plans
// tab "Upcoming" card counted every open plan whatever its date, so Scheduled
// plans whose dates had passed showed as upcoming (and the timeline listed
// them as "Nd overdue"). They now use the dashboard's UpcomingAudits model.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { loadScript } from './helpers/load-script.js';

const require = createRequire(import.meta.url);

const CLIENT = { id: 'c1', name: 'Acme Ltd' };
function plan(id, date, extra) {
    return Object.assign({ id, client: 'Acme Ltd', clientId: 'c1', date, status: 'Scheduled', auditType: 'Surveillance', standard: 'ISO 9001:2015' }, extra || {});
}
const PLANS = [
    plan('long-past', '2026-01-08'),
    plan('ended', '2026-11-17', { endDate: '2026-11-19', status: 'In Progress' }), // ended 2 days ago
    plan('spanning', '2026-11-20', { endDate: '2026-11-23', status: 'In Progress' }), // runs through today
    plan('today', '2026-11-21'),
    plan('future', '2026-12-10', { auditType: 'Recertification' }),
    plan('undated', null, { status: 'Draft' }),
    plan('done', '2026-12-01', { status: 'Completed' })
];

let api;

beforeAll(() => {
    require('../upcoming-audits.js'); // sets window.UpcomingAudits
    window.UTILS = require('../utils.js');
    api = loadScript('./client-workspace.js', {
        params: { module: undefined },
        append: '\nreturn { clientUpcomingAudits, renderClientOverview, renderClientPlans };'
    });
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 10, 0, 0)); // Sat 21 Nov 2026, local
    window.state = { auditPlans: PLANS.slice(), auditors: [], clients: [CLIENT], certifications: [], auditReports: [], ncrs: [] };
    window.DataService = Object.assign({}, window.DataService, {
        isPlanCompleted: p => p.status === 'Completed' || p.status === 'Closed',
        getPlanCompletionStats: ps => ({ completed: ps.filter(p => p.status === 'Completed').length })
    });
});

afterEach(() => { vi.useRealTimers(); });

describe('clientUpcomingAudits', () => {
    it('counts today-or-later audits only, judging multi-day plans by endDate', () => {
        const r = api.clientUpcomingAudits(PLANS);
        expect(r.upcoming.map(i => i.id)).toEqual(['spanning', 'today', 'future']);
        expect(r.count).toBe(3);
        expect(r.overdue).toBe(2);   // long-past, ended
        expect(r.undated).toBe(1);
    });

    it('reports zero upcoming when every open plan is past its dates', () => {
        const r = api.clientUpcomingAudits([PLANS[0], PLANS[1]]);
        expect(r.count).toBe(0);
        expect(r.upcoming).toEqual([]);
        expect(r.overdue).toBe(2);
    });
});

describe('client pages use the upcoming rule', () => {
    it('Overview alert and timeline show only upcoming audits; past-open ones get their own alert', () => {
        const html = api.renderClientOverview(CLIENT);
        expect(html).toContain('3 Upcoming Audits');
        expect(html).toContain('2 Audits past date, not closed');
        expect(html).not.toMatch(/\d+d overdue/);
        const timeline = html.slice(html.indexOf('Upcoming Audit Timeline'), html.indexOf('Observation &amp; OFI Tracker') > -1
            ? html.indexOf('Observation &amp; OFI Tracker') : html.indexOf('Observation & OFI Tracker'));
        expect(timeline).toContain('Day 2 of 4');   // spanning, via endDate
        expect(timeline).toContain('Today');
        expect(timeline).toContain('In 19 days');   // 10 Dec
        expect(timeline).not.toContain('Ended');     // past-open plans stay out of the timeline
    });

    it('Plans tab "Upcoming" card excludes past-open plans and in-progress ones (they have their own card)', () => {
        const html = api.renderClientPlans(CLIENT);
        const card = /<p[^>]*>(\d+)<\/p>\s*<p[^>]*>Upcoming<\/p>/.exec(html);
        expect(card).not.toBeNull();
        expect(card[1]).toBe('2'); // today, future — "spanning" is In Progress
    });
});

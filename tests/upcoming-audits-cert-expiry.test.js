// Dashboard "Upcoming Audits": each row shows the certificate expiry beside the
// audit dates (user request 2026-11-24), so a recertification booked close to
// — or after — the expiry stands out. The expiry is the one the client's cycle
// card shows (ReportStats.cycleState periodEnd: the current annual period from
// the Initial Date), using the real ReportStats.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window || globalThis;
const UA = require('../upcoming-audits.js');
const RS = require('../report-stats.js');
const APD = require('../audit-planning-domain.js');

const TODAY = '2026-11-24';
const deps = { today: TODAY, cycleState: RS.cycleState, belongsTo: RS.recordBelongsTo, coversStandard: RS.coversStandard, reports: [], plans: [] };
const cert = (id, standard, initialDate, extra) => Object.assign({ id, standard, initialDate, status: 'Active' }, extra || {});
const CLIENTS = [
    { id: 'tpl', name: 'TPL TRAKKER LTD.', status: 'Active', certificates: [cert('c1', 'ISO 9001:2015', '2023-12-16')] },
    { id: 'new', name: 'New Co', status: 'Active', certificates: [cert('c2', 'ISO 9001:2015', '2026-02-10')] },
    { id: 'ims', name: 'IMS Co', status: 'Active', certificates: [cert('c3', 'ISO 9001:2015', '2024-03-01'), cert('c4', 'ISO 14001:2015', '2025-06-15')] }
];
const plan = (id, clientId, standard, auditType, date, endDate) => ({ id, clientId, client: CLIENTS.find(c => c.id === clientId)?.name || 'Unknown', standard, auditType, date, endDate: endDate || date, status: 'Scheduled' });
const build = (plans) => UA.build(plans, { today: TODAY, expiryOf: p => UA.certificateExpiries(p, CLIENTS, deps) });

describe('certificateExpiries', () => {
    it('gives the expiry the cycle card shows, and the cycle end', () => {
        expect(UA.certificateExpiries(plan('p', 'tpl', 'ISO 9001:2015'), CLIENTS, deps)).toEqual([{ standard: 'ISO 9001:2015', expiry: '2026-12-15', cycleEnd: '2026-12-15' }]);
        // Year 1 of a cycle: this year's certificate expires before the cycle ends.
        expect(UA.certificateExpiries(plan('p', 'new', 'ISO 9001:2015'), CLIENTS, deps)).toEqual([{ standard: 'ISO 9001:2015', expiry: '2027-02-09', cycleEnd: '2029-02-09' }]);
    });

    it('lists each standard an integrated audit covers, earliest first, and only those', () => {
        const both = UA.certificateExpiries(plan('p', 'ims', 'ISO 14001:2015, ISO 9001:2015'), CLIENTS, deps);
        expect(both.map(e => [e.standard, e.expiry])).toEqual([['ISO 9001:2015', '2027-02-28'], ['ISO 14001:2015', '2027-06-14']]);
        expect(UA.certificateExpiries(plan('p', 'ims', 'ISO 14001:2015'), CLIENTS, deps).map(e => e.standard)).toEqual(['ISO 14001:2015']);
    });

    it('gives nothing for a client with no certificate on file or not found', () => {
        expect(UA.certificateExpiries({ clientId: 'zz', client: 'Nobody', standard: 'ISO 9001:2015' }, CLIENTS, deps)).toEqual([]);
        const withdrawn = [{ id: 'w', name: 'W', certificates: [cert('c9', 'ISO 9001:2015', '2024-01-01', { status: 'Withdrawn' })] }];
        expect(UA.certificateExpiries({ clientId: 'w', standard: 'ISO 9001:2015' }, withdrawn, deps)).toEqual([]);
    });
});

describe('the Upcoming Audits list', () => {
    const rowText = (model) => {
        document.body.innerHTML = UA.panelHtml(model);
        return Array.from(document.querySelectorAll('.ua-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
    };

    it('shows the expiry on each row, and warns within 30 days', () => {
        const model = build([plan('p1', 'tpl', 'ISO 9001:2015', 'Recertification', '2026-12-01'), plan('p2', 'new', 'ISO 9001:2015', 'Surveillance 1', '2027-01-20')]);
        const [tpl, nw] = rowText(model);
        expect(tpl).toContain('Cert expires 15 Dec 2026 — expires within 30 days');
        expect(nw).toContain('Cert expires 9 Feb 2027');
        expect(nw).not.toContain('within 30 days');
        expect(document.querySelector('.ua-expiry-soon')).not.toBeNull();
        // the title names the cycle end where it differs
        expect(document.querySelectorAll('.ua-expiry')[1].getAttribute('title')).toContain('certification cycle ends 9 Feb 2029');
    });

    it('flags an audit that ends after the certificate expires', () => {
        const model = build([plan('p1', 'tpl', 'ISO 9001:2015', 'Recertification', '2026-12-14', '2026-12-17')]);
        expect(model.items[0].expiryRisk).toBe('before-end');
        expect(rowText(model)[0]).toContain('expires before the audit ends');
        expect(document.querySelector('.ua-expiry-before-end')).not.toBeNull();
    });

    it('shows each date with its standard when an integrated audit has two', () => {
        const model = build([plan('p1', 'ims', 'ISO 9001:2015, ISO 14001:2015', 'Surveillance', '2027-01-10')]);
        expect(rowText(model)[0]).toContain('Cert expires 28 Feb 2027 (ISO 9001:2015) · 14 Jun 2027 (ISO 14001:2015)');
    });

    it('leaves the line out when no certificate is found, and escapes what it prints', () => {
        const model = UA.build([{ id: 'x', clientId: 'zz', client: 'Nobody', standard: 'ISO 9001:2015', auditType: 'Stage 1', date: '2026-12-05', status: 'Scheduled' }], {
            today: TODAY,
            expiryOf: () => [{ standard: '<b>ISO</b>', expiry: '2027-01-01', cycleEnd: '2027-01-01' }, { standard: 'X', expiry: '2027-02-01', cycleEnd: '2027-02-01' }]
        });
        rowText(model);
        expect(document.querySelector('.ua-expiry b')).toBeNull();
        expect(rowText(UA.build([{ id: 'y', clientId: 'zz', standard: 'ISO 9001:2015', auditType: 'Stage 1', date: '2026-12-05', status: 'Scheduled' }], { today: TODAY }))[0]).not.toContain('Cert expires');
    });

    it('a failing lookup does not break the panel', () => {
        const model = UA.build([plan('p1', 'tpl', 'ISO 9001:2015', 'Recertification', '2026-12-01')], { today: TODAY, expiryOf: () => { throw new Error('bad record'); } });
        expect(model.items[0].expiries).toEqual([]);
        expect(rowText(model)).toHaveLength(1);
    });
});

describe('due by certificate cycle, not planned', () => {
    it('carries the expiry too', () => {
        // First certified 11 Dec 2025: Surveillance 1 due 11 Dec 2026, this year's certificate expires 10 Dec 2026.
        const alpha = { id: 'a', name: 'Alpha Ltd', status: 'Active', certificates: [cert('ca', 'ISO 9001:2015', '2025-12-11')] };
        const due = UA.dueUnplanned([alpha], [], Object.assign({}, deps, { resolveCycle: APD.resolveCertificateCycle, settings: {} }));
        expect(due).toHaveLength(1);
        expect(due[0]).toMatchObject({ auditType: 'Surveillance 1', expiry: '2026-12-10', expiryRisk: 'soon' });
        document.body.innerHTML = UA.panelHtml(UA.build([], { today: TODAY, due }));
        expect(document.querySelector('.ua-row-due').textContent).toContain('Cert expires 10 Dec 2026');
    });
});

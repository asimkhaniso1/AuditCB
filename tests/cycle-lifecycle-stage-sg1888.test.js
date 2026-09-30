import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'module';

// SG 1888 on 30/09/2026. The Halal certificate (Initial Date 14/09/2024) had
// Surveillance 1 recorded in 2025; the card read "Current Stage:
// Recertification, Next Audit Stage: Surveillance 2", because the stage was
// named by the calendar year (Year 3). The lifecycle runs Certification ->
// Surveillance 1 -> Surveillance 2 -> Recertification: with S1 done and S2
// still in its window, the stage is Surveillance 2 and Recertification
// follows. The cycle year, the annual period (Current Issue / Expiry) and the
// certificate on file are untouched. ISO 9001 and cGMP, already right, stay so.
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');
const fs = require('fs');
const path = require('path');

const TODAY = '2026-09-30';
const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const scope = 'Manufacturer, Exporter, and Retailer of Skin Care, Hair Care & Personal Care Products.';

const HALAL = { id: 'C-HALAL', standard: 'Halal', certificateNo: 'CR/IHC/SG/09/24/HC', status: 'Active', initialDate: '2024-09-14', currentIssue: '2025-09-14', expiryDate: '2026-09-13', scope };
const QMS = { id: 'C-9001', standard: 'ISO 9001:2015', certificateNo: '23PK9001', status: 'Active', initialDate: '2023-02-03', currentIssue: '2026-02-03', expiryDate: '2027-02-02', scope };
const CGMP = { id: 'C-CGMP', standard: 'cGMP', certificateNo: '23PK9012', status: 'Active', initialDate: '2023-09-20', currentIssue: '2025-09-20', expiryDate: '2026-09-19', scope };

const client = () => ({
    id: '135ebfe3', name: 'SG 1888 (PVT.) LTD.', standard: 'ISO 9001:2015, Halal, cGMP',
    certificates: [JSON.parse(JSON.stringify(HALAL)), JSON.parse(JSON.stringify(QMS)), JSON.parse(JSON.stringify(CGMP))],
    certificationLifecycleEvents: [{
        id: 'ev-s1', certificateId: 'C-HALAL', type: 'surveillance-1-completed',
        occurredAt: '2025-09-10', createdAt: '2025-09-12', note: 'Surveillance 1 performed'
    }]
});

function resolve(cert, c = client()) {
    const certificate = c.certificates.find(x => x.id === cert.id);
    const cycleState = ReportStats.cycleState({ client: c, standard: certificate.standard, certificate, allReports: [], allPlans: [], today: TODAY });
    const record = Domain.resolveCertificateCycle({ client: c, certificate, cycleState, now: TODAY, settings: {}, allReports: [], allPlans: [] });
    return { cycleState, record, certificate };
}

describe('SG 1888 — stage follows the lifecycle on the Initial-Date cycle', () => {
    it('Halal: S1 done, S2 in its window -> Current Surveillance 2, Next Recertification', () => {
        const { cycleState, record } = resolve(HALAL);
        expect(cycleState.completed).toMatchObject({ certification: true, s1: true, s2: false, recert: false });
        expect(cycleState.stage).toBe('Surveillance 2');
        expect(cycleState.nextStage).toBe('Recertification');
        expect(cycleState.cycleLabel).toBe('Cycle 1 · Year 3');
        expect(iso(cycleState.periodStart)).toBe('2026-09-14');
        expect(iso(cycleState.periodEnd)).toBe('2027-09-13');
        expect(iso(cycleState.nextAudit.date)).toBe('2026-09-14');
        expect(record.auditType).toBe('Surveillance 2');
        expect(record.stage).toBe('Surveillance 2');
        expect(record.recommendedWindowStart).toBe('2026-08-15');
        expect(record.recommendedWindowEnd).toBe('2026-10-14');
    });

    it('Halal: the certificate on file is not changed to get there', () => {
        const c = client();
        resolve(HALAL, c);
        expect(c.certificates[0]).toEqual(HALAL);
    });

    it('Halal: once S2 is recorded, Recertification is current and the next cycle follows', () => {
        const c = client();
        c.certificationLifecycleEvents.push({ id: 'ev-s2', certificateId: 'C-HALAL', type: 'surveillance-2-completed', occurredAt: '2026-09-25', createdAt: '2026-09-25' });
        const { cycleState, record } = resolve(HALAL, c);
        expect(cycleState.stage).toBe('Recertification');
        expect(cycleState.nextStage).toBe('Surveillance 1 (next cycle)');
        expect(record.auditType).toBe('Recertification');
        expect(cycleState.cycleLabel).toBe('Cycle 1 · Year 3');
    });

    it('ISO 9001 (regression): Cycle 2 · Year 1, Surveillance 1 then Surveillance 2', () => {
        const { cycleState, record } = resolve(QMS);
        expect(cycleState.cycleLabel).toBe('Cycle 2 · Year 1');
        expect(cycleState.stage).toBe('Surveillance 1');
        expect(cycleState.nextStage).toBe('Surveillance 2');
        expect(iso(cycleState.periodStart)).toBe('2026-02-03');
        expect(iso(cycleState.periodEnd)).toBe('2027-02-02');
        expect(record.auditType).toBe('Surveillance 1');
        expect(record.recommendedWindowStart).toBe('2027-01-04');
        expect(record.recommendedWindowEnd).toBe('2027-03-05');
    });

    it('cGMP (regression): Cycle 2 · Year 1, Surveillance 1 then Surveillance 2', () => {
        const { cycleState, record } = resolve(CGMP);
        expect(cycleState.cycleLabel).toBe('Cycle 2 · Year 1');
        expect(cycleState.stage).toBe('Surveillance 1');
        expect(cycleState.nextStage).toBe('Surveillance 2');
        expect(iso(cycleState.periodStart)).toBe('2026-09-20');
        expect(iso(cycleState.periodEnd)).toBe('2027-09-19');
        expect(record.auditType).toBe('Surveillance 1');
        expect(record.recommendedWindowStart).toBe('2027-08-21');
        expect(record.recommendedWindowEnd).toBe('2027-10-20');
    });
});

describe('SG 1888 overview card', () => {
    let render;
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
        render = new Function('module', src + '\nreturn renderCertificationCycleWidget;')(undefined);
    });
    afterAll(() => vi.useRealTimers());

    const cardFor = (html, std) => {
        document.body.innerHTML = html;
        const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h4').textContent.trim() === 'Certification Cycle - ' + std);
        const cells = Array.from(card.querySelectorAll('.cycle-info-grid > div'));
        const byLabel = {};
        cells.forEach(cell => {
            const label = cell.children[0] && cell.children[0].textContent.trim();
            if (label) byLabel[label.toUpperCase()] = cell.children[1] && cell.children[1].textContent.trim();
        });
        const dots = Array.from(card.querySelectorAll('[title]')).map(n => n.getAttribute('title'));
        return { byLabel, dots, card };
    };

    it('Halal shows Current Stage Surveillance 2, Next Audit Stage Recertification, window for S2', () => {
        const { byLabel, card, dots } = cardFor(render(client()), 'Halal');
        expect(byLabel['CURRENT STAGE']).toBe('Surveillance 2');
        expect(byLabel['NEXT AUDIT STAGE']).toBe('Recertification');
        expect(byLabel['RECOMMENDED AUDIT WINDOW']).toBe('15/08/2026 – 14/10/2026');
        expect(card.textContent).toMatch(/For Surveillance 2/);
        expect(byLabel['CURRENT ISSUE / EXPIRY']).toBe('14/09/2026 – 13/09/2027');
        expect(card.textContent).toMatch(/Cycle 1 · Year 3/);
        expect(dots).toContain('Surveillance 1 audit finalized');
        expect(dots.some(t => /^Surveillance 2 period passed/.test(t))).toBe(true);   // due, window open
        expect(dots).toContain('Recertification not yet due');
    });

    it('ISO 9001 and cGMP show Surveillance 1 then Surveillance 2', () => {
        const html = render(client());
        const qms = cardFor(html, 'ISO 9001:2015').byLabel;
        expect(qms['CURRENT STAGE']).toBe('Surveillance 1');
        expect(qms['NEXT AUDIT STAGE']).toBe('Surveillance 2');
        expect(qms['RECOMMENDED AUDIT WINDOW']).toBe('04/01/2027 – 05/03/2027');
        const gmp = cardFor(html, 'cGMP').byLabel;
        expect(gmp['CURRENT STAGE']).toBe('Surveillance 1');
        expect(gmp['NEXT AUDIT STAGE']).toBe('Surveillance 2');
        expect(gmp['CURRENT ISSUE / EXPIRY']).toBe('20/09/2026 – 19/09/2027');
    });
});

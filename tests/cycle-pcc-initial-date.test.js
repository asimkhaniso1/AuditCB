import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'module';

// PC CONNECTION on 15/10/2026. Originally certified December 2020, transferred
// to CCI December 2022, recertified December 2023; recertification is due in
// 2026. The card read "Cycle 1 · Year 3 — Current: Recertification, Next:
// Surveillance 1 (next cycle)" with S1 and S2 red, although a surveillance was
// performed in February 2026.
//
// USER RULE (2026-10-15): the lifecycle follows the Initial Date alone. The
// stage, the next audit and every dot come from the calendar; a recorded,
// finalized or closed audit does not move them. Records are shown beside the
// lifecycle — a missing one is never marked missed. The Next Audit Stage is
// the next audit actually required (Recertification), never the next cycle's
// Surveillance 1, which is shown separately. Certificate data is not changed.
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');
const fs = require('fs');
const path = require('path');

const TODAY = '2026-10-15';
const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

const CERT = {
    id: 'cert-27001', certificateNo: '22US9019', standard: 'ISO/IEC 27001:2022', status: 'Active', revision: '00',
    initialDate: '2020-12-16', transferDate: '2022-12-16', previousCB: 'Prior Registrar Inc.',
    currentIssue: '2025-12-16', expiryDate: '2026-12-15'
};
const client = (events = []) => ({
    id: 'pcc', name: 'PC CONNECTION, INC.',
    certificates: [JSON.parse(JSON.stringify(CERT))],
    certificationLifecycleEvents: events
});
const s2Feb = { id: 'ev-s2', certificateId: 'cert-27001', type: 'surveillance-2-completed', occurredAt: '2026-02-18T00:00:00.000Z', metadata: { source: 'cci', auditor: 'Muhammad Asim Khan' } };
const recert2023 = { id: 'ev-re', certificateId: 'cert-27001', type: 'recertification-completed', occurredAt: '2023-12-05T00:00:00.000Z', metadata: { source: 'cci' } };
// The February 2026 audit as a plan marked Completed, naming the client
// without its legal form.
const febPlan = { id: 'plan-feb', client: 'PC CONNECTION', standard: 'ISO/IEC 27001:2022, ISO 22301:2019', auditType: 'Surveillance', status: 'Completed', date: '2026-02-16', endDate: '2026-02-18' };

const state = (c, plans = []) => ReportStats.cycleState({ client: c, standard: CERT.standard, certificate: c.certificates[0], allReports: [], allPlans: plans, today: TODAY });

describe('PC CONNECTION lifecycle runs on the Initial Date', () => {
    it('Cycle 2 · Year 3: Recertification is current and is the next audit — not the next cycle\'s S1', () => {
        const cs = state(client());
        expect(cs.cycleLabel).toBe('Cycle 2 · Year 3');
        expect(iso(cs.anchor)).toBe('2023-12-16');
        expect(cs.stageSource).toBe('calendar');
        expect(cs.stage).toBe('Recertification');
        expect(cs.nextStage).toBe('Recertification');
        expect(iso(cs.nextDue)).toBe('2026-10-16');
        expect(cs.periodComplete).toEqual({ s1: true, s2: true, recert: false });
    });

    it('projects the next cycle separately', () => {
        const { nextCycle } = state(client());
        expect(nextCycle.number).toBe(3);
        expect(iso(nextCycle.start)).toBe('2026-12-16');
        expect(iso(nextCycle.surv1Due)).toBe('2027-12-16');
        expect(iso(nextCycle.surv2Due)).toBe('2028-12-16');
        expect(iso(nextCycle.recertDue)).toBe('2029-10-17');
    });

    it('the February 2026 audit is on record as S2 — it does not tick S1 and does not move the lifecycle', () => {
        const without = state(client());
        const withEvent = state(client([s2Feb]));
        const withPlan = state(client(), [febPlan]);
        expect(withEvent.completed).toMatchObject({ s1: false, s2: true });
        expect(withPlan.completed).toMatchObject({ s1: false, s2: true });
        expect(withPlan.recordedAudits.s2).toMatchObject({ origin: 'plan' });
        for (const cs of [withEvent, withPlan]) {
            expect(cs.stage).toBe(without.stage);
            expect(cs.nextStage).toBe(without.nextStage);
            expect(cs.periodComplete).toEqual(without.periodComplete);
        }
    });

    it('the planner recommends Recertification whatever is on record', () => {
        for (const c of [client(), client([s2Feb])]) {
            const record = Domain.resolveCertificateCycle({ client: c, certificate: c.certificates[0], cycleState: state(c), now: TODAY, settings: {} });
            expect(record.auditType).toBe('Recertification');
        }
    });

    it('keeps the original certification, transfer, recertification and surveillance history', () => {
        const c = client([recert2023, s2Feb]);
        const history = ReportStats.certificationHistory({ client: c, certificate: c.certificates[0], allReports: [], allPlans: [febPlan], today: TODAY });
        const rows = history.map(e => [iso(e.date), e.kind, e.label, e.cycle]);
        expect(rows[0]).toEqual(['2020-12-16', 'certification', 'Original certification', 1]);
        expect(rows).toContainEqual(['2022-12-16', 'transfer', 'Certificate transferred', 1]);
        expect(rows).toContainEqual(['2023-12-05', 'event', 'Recertification performed', 2]);
        expect(rows).toContainEqual(['2023-12-16', 'cycle', 'Cycle 2 began — recertification', 2]);
        expect(rows).toContainEqual(['2026-02-18', 'event', 'Surveillance 2 performed', 2]);
        expect(rows).toContainEqual(['2026-02-18', 'audit', 'Surveillance', 2]);
        expect(history.find(e => e.kind === 'transfer').detail).toBe('From Prior Registrar Inc.');
        expect(history.find(e => e.kind === 'cycle').detail).toBe('Recertification on record');
    });

    it('a cycle boundary with no recertification on file says so, and nothing is written back', () => {
        const c = client();
        const before = JSON.stringify(c);
        const history = ReportStats.certificationHistory({ client: c, certificate: c.certificates[0], allReports: [], allPlans: [], today: TODAY });
        expect(history.find(e => e.kind === 'cycle').detail).toBe('No recertification record on file');
        state(c);
        expect(JSON.stringify(c)).toBe(before);
    });
});

describe('PC CONNECTION cycle card and Certification Cycle tab', () => {
    let api;
    beforeAll(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(TODAY + 'T09:00:00'));
        globalThis.window = globalThis.window || globalThis;
        window.ReportStats = ReportStats;
        window.AuditPlanningDomain = Domain;
        window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
        window.UTILS = { escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), formatDate: (d) => { const x = d instanceof Date ? d : new Date(d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; } };
        window.state = { auditPlans: [febPlan], auditReports: [], cbSettings: {} };
        const src = fs.readFileSync(path.resolve('./client-workspace.js'), 'utf8');
        api = new Function('module', src + '\nreturn { card: renderCertificationCycleWidget, tab: renderAuditCycleTimeline };')(undefined);
    });
    afterAll(() => vi.useRealTimers());

    it('shows the Initial Date after Cert # and Rev, with the transfer', () => {
        document.body.innerHTML = api.card(client());
        const line = document.querySelector('.cycle-cert-line').textContent;
        expect(line).toMatch(/Cert #: 22US9019 • Rev: 00 • Initial Date: 16\/12\/2020 • Transferred: 16\/12\/2022 from Prior Registrar Inc\./);
    });

    it('Next Audit Stage is Recertification and sits after Current Issue / Expiry', () => {
        document.body.innerHTML = api.card(client([s2Feb]));
        const labels = Array.from(document.querySelectorAll('.cycle-info-grid > div')).map(cell => cell.children[0].textContent.trim().toUpperCase());
        expect(labels).toEqual(['CURRENT STAGE', 'RECOMMENDED AUDIT WINDOW', 'CURRENT ISSUE / EXPIRY', 'NEXT AUDIT STAGE']);
        const next = document.querySelector('.cycle-next-stage');
        expect(next.children[1].textContent.trim()).toBe('Recertification');
        expect(next.textContent).toMatch(/Due 16\/10\/2026/);
        expect(document.body.textContent).not.toMatch(/Surveillance 1 \(next cycle\)/);
        expect(document.querySelector('.cycle-next-cycle').textContent).toMatch(/Next cycle \(Cycle 3, projected\).*S1 16\/12\/2027/);
    });

    it('dots follow the calendar; the record behind each is named, and a missing one is not called missed', () => {
        document.body.innerHTML = api.card(client([s2Feb]));
        const node = (k) => document.querySelector(`.cycle-node[data-milestone="${k}"]`);
        expect(node('s1').dataset.state).toBe('completed');
        expect(node('s2').dataset.state).toBe('completed');
        expect(['upcoming', 'open']).toContain(node('recert').dataset.state);
        expect(node('s1').title).toMatch(/No Surveillance 1 audit record on file/);
        expect(node('s1').title).not.toMatch(/missed/i);
        expect(node('s2').title).toMatch(/Surveillance 2 audit on record: performed 18\/02\/2026 by CCI/);
    });

    it('the tab shows Next Audit Stage, the next cycle and the history', () => {
        document.body.innerHTML = api.tab(client([recert2023, s2Feb]));
        expect(document.querySelector('.cycle-next-stage').textContent).toMatch(/Recertification/);
        expect(document.querySelector('.cycle-initial-date').textContent).toBe('16/12/2020');
        expect(document.querySelector('.cycle-next-cycle').textContent).toMatch(/Cycle 3/);
        const kinds = Array.from(document.querySelectorAll('.cycle-history tr[data-kind]')).map(r => r.dataset.kind);
        expect(kinds).toEqual(expect.arrayContaining(['certification', 'transfer', 'cycle', 'event', 'audit']));
        expect(document.querySelector('.cycle-history').textContent).toMatch(/Original certification/);
    });
});

// "CAPA Annex" ticked, but the downloaded draft had no Annex C (PC Connection,
// 2026-11-19). The annex's only content is the CAR Forms section, which
// started switched off, and the sidebar was drawn from each section's default
// rather than the saved choice, so CAR Forms showed as ticked while the export
// left it out. The annex tick and the CAR Forms section are now one choice,
// and the sidebar shows what the export will print.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-findings-ops.js', { global: true });
    loadScript('./execution-reporting.js', { global: true });
});

function open(reportConfig) {
    window.state = { auditReports: [], clients: [], auditPlans: [] };
    document.body.innerHTML = '';
    window._reportPreviewData = {
        report: { id: 'r1', client: 'PC Connection', standard: 'ISO/IEC 27001:2022', date: '2026-11-17', checklistProgress: [], ncrs: [], reportConfig },
        hydratedProgress: [],
        client: { id: 'c1', name: 'PC Connection', sites: [] },
        auditPlan: { id: 'p1', team: [] },
        cbSettings: {}, cbSite: {}, clientLogo: '', cbLogo: '',
        stats: { majorNC: 0, minorNC: 0, ncCount: 0, observationCount: 0, ofiCount: 0, conformCount: 0, naCount: 0, totalItems: 0, statusColor: '#10b981', auditStatus: 'Recommended', coveragePct: 0, ncByClause: {} },
        today: '19/11/2026'
    };
    // The preview starts a 300 ms chart timer; one left pending fires after
    // the test environment is gone ("window is not defined", flaky CI).
    vi.useFakeTimers();
    window.showReportPreviewModal();
    vi.clearAllTimers();
    vi.useRealTimers();
}
const annexBox = () => document.getElementById('annex-toggle-capa');
const carRow = () => document.getElementById('pill-carForms');

describe('CAPA Annex and the CAR Forms section are one choice', () => {
    beforeEach(() => { window.DataService = { syncAuditReport: () => {} }; });

    it('a ticked CAPA Annex includes the CAR forms, even if they were saved as off', () => {
        open({ annexes: { capa: true }, sectionToggles: { carForms: false } });
        expect(annexBox().checked).toBe(true);
        expect(window._reportSectionState.carForms).toBe(true);
        expect(carRow().classList.contains('active')).toBe(true);
        expect(carRow().querySelector('input').checked).toBe(true);
    });

    it('CAPA Annex off by default leaves the CAR forms out, and the sidebar says so', () => {
        open({});
        expect(annexBox().checked).toBe(false);
        expect(window._reportSectionState.carForms).toBe(false);
        expect(carRow().querySelector('input').checked).toBe(false);
    });

    it('ticking CAPA Annex includes the CAR forms; unticking leaves them out', () => {
        open({});
        window.toggleReportAnnex('capa');
        expect(window._reportAnnexState.capa).toBe(true);
        expect(window._reportSectionState.carForms).toBe(true);
        expect(carRow().querySelector('input').checked).toBe(true);
        window.toggleReportAnnex('capa');
        expect(window._reportSectionState.carForms).toBe(false);
        expect(carRow().querySelector('input').checked).toBe(false);
    });

    it('ticking the CAR Forms section ticks CAPA Annex too', () => {
        open({});
        window.toggleReportSection('carForms');
        expect(window._reportSectionState.carForms).toBe(true);
        expect(window._reportAnnexState.capa).toBe(true);
        expect(annexBox().checked).toBe(true);
    });

    it('the choice is saved for the export', () => {
        open({});
        window.toggleReportAnnex('capa');
        const cfg = window._reportPreviewData.report.reportConfig;
        expect(cfg.annexes.capa).toBe(true);
        expect(cfg.sectionToggles.carForms).toBe(true);
    });
});

describe('the sidebar shows what the export will print', () => {
    beforeEach(() => { window.DataService = { syncAuditReport: () => {} }; });

    it('a section saved as left out is unticked and hidden in the preview', () => {
        open({ sectionToggles: { charts: false } });
        const row = document.getElementById('pill-charts');
        expect(row.querySelector('input').checked).toBe(false);
        expect(row.classList.contains('active')).toBe(false);
        expect(document.getElementById('sec-charts').style.display).toBe('none');
        // A section with no saved choice stays included.
        expect(document.getElementById('pill-summary').querySelector('input').checked).toBe(true);
    });
});

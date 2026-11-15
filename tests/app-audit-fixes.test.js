// Regressions for the 2026-11-12 app audit: one deadline for register and
// report, Certification Manager access, delta cert sync, auditor data on load,
// unique certificate ids, and the
// register's delete action withdrawing instead of hard-deleting.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = window.Logger || { debug() { }, info() { }, warn() { }, error() { } };
globalThis.Logger = window.Logger;
window.ErrorHandler = window.ErrorHandler || { log() { }, handle() { } };
window.showNotification = window.showNotification || (() => { });

const ReportStats = require('../report-stats.js');
const SC = require('../supabase-client.js');

describe('CAPA due date (one deadline for register and report)', () => {
    it('falls back to Major 30 / Minor 90 days, counted from the audit date', () => {
        expect(ReportStats.capaDueDate('Major', '2026-09-01')).toBe('2026-10-01');
        expect(ReportStats.capaDueDate('minor', '2026-09-01')).toBe('2026-11-30');
    });
    it('uses the CB-configured timeframes', () => {
        const settings = { capaTimeframes: { default: { major: 14, minor: 60 } } };
        expect(ReportStats.capaDueDate('major', '2026-09-01', { settings })).toBe('2026-09-15');
        expect(ReportStats.capaDueDate('Minor', '2026-09-01', { settings })).toBe('2026-10-31');
    });
    it('treats a YYYY-MM-DD date as a local day (no UTC shift)', () => {
        expect(ReportStats.capaDueDate('Major', '2026-01-31')).toBe('2026-03-02');
    });
});

describe('Certification Manager module access', () => {
    beforeEach(() => {
        loadScript('./auth-manager.js', { params: { module: undefined } });
    });
    it('matches the real role name against the default matrix', () => {
        window.state = { currentUser: { role: 'Certification Manager' }, rolePermissions: { 'Certification Manager': { clients: 'full' } } };
        expect(window.AuthManager.hasModuleAccess('clients')).toBe('full');
    });
    it('still honours a matrix saved under the old "Cert Manager" key', () => {
        window.state = { currentUser: { role: 'Certification Manager' }, rolePermissions: { 'Cert Manager': { certs: 'full' } } };
        expect(window.AuthManager.hasModuleAccess('certs')).toBe('full');
    });
});

describe('certification register sync', () => {
    const row = (id, status) => ({ id, client: 'Acme', standard: 'ISO 9001:2015', status, issue_date: '2026-01-01', decision_record: {} });
    beforeEach(() => {
        SC.isInitialized = true;
        window.state = { certifications: [{ id: 'CERT-2026-001', status: 'Valid' }, { id: 'CERT-2026-002', status: 'Valid' }] };
        try { sessionStorage.clear(); } catch (_e) { /* noop */ }
    });
    it('a delta sync merges changed rows instead of replacing the register', async () => {
        SC._buildSyncQuery = () => ({ isIncremental: true, query: { order: async () => ({ data: [row('CERT-2026-002', 'Suspended')], error: null }) } });
        await SC.syncCertificationDecisionsFromSupabase();
        expect(window.state.certifications.map(c => c.id)).toEqual(['CERT-2026-001', 'CERT-2026-002']);
        expect(window.state.certifications[1].status).toBe('Suspended');
    });
    it('a full sync still takes the cloud list as the truth', async () => {
        SC._buildSyncQuery = () => ({ isIncremental: false, query: { order: async () => ({ data: [row('CERT-2026-009', 'Valid')], error: null }) } });
        await SC.syncCertificationDecisionsFromSupabase();
        expect(window.state.certifications.map(c => c.id)).toEqual(['CERT-2026-009']);
    });
});

describe('auditor sync keeps the full record from the data JSONB', () => {
    it('restores trainings and rate, and never nests data', async () => {
        SC.isInitialized = true;
        window.state = { auditors: [{ id: 'a1', name: 'Old', data: { stale: true } }], users: [] };
        const rows = [
            { id: 'a1', name: 'Asha', role: 'Lead Auditor', email: 'a@x.test', standards: ['ISO 9001:2015'], data: { trainings: [{ course: 'LA' }], manDayRate: 900, data: { nested: 1 } } },
            { id: 'a2', name: 'Ben', role: 'Auditor', email: 'b@x.test', standards: [], data: { qualifications: ['IRCA'], manDayRate: 700 } }
        ];
        SC._buildSyncQuery = () => ({ isIncremental: false, query: { order: async () => ({ data: rows, error: null }) } });
        await SC.syncAuditorsFromSupabase();
        const [a1, a2] = window.state.auditors;
        expect(a1).toMatchObject({ name: 'Asha', trainings: [{ course: 'LA' }], manDayRate: 900 });
        expect(a1.data).toBeUndefined();
        expect(a2).toMatchObject({ name: 'Ben', qualifications: ['IRCA'], manDayRate: 700 });
        expect(a2.data).toBeUndefined();
    });
});

describe('sync timestamp', () => {
    it('backs off so rows written during the query are fetched next time', () => {
        const before = Date.now();
        SC._setSyncTimestamp('t1');
        const stamped = Date.parse(sessionStorage.getItem('sync_ts_t1'));
        expect(before - stamped).toBeGreaterThanOrEqual(2 * 60 * 1000 - 50);
    });
});

describe('certificate ids', () => {
    it('never reuses an existing id after a deletion', () => {
        window.state = { certifications: [], auditReports: [], clients: [], auditPlans: [] };
        loadScript('./certifications-module.js', { global: true });
        const y = new Date().getFullYear();
        window.state.certifications = [{ id: `CERT-${y}-001` }, { id: `CERT-${y}-003` }];
        // length + 1 would give 003 — taken.
        expect(window.nextCertificateId ? window.nextCertificateId() : globalThis.nextCertificateId()).toBe(`CERT-${y}-004`);
    });
});

describe('register delete action', () => {
    it('withdraws the NCR with a reason instead of deleting it', async () => {
        window.UTILS = require('../utils.js');
        window.state = { ncrs: [{ id: 7, status: 'Open', severity: 'Minor', clientId: 'c1' }], clients: [], auditPlans: [], auditReports: [] };
        window.saveData = () => { };
        window.prompt = () => 'Raised in error';
        delete window.SupabaseClient;
        loadScript('./ncr-capa-module.js', { global: true });
        window.contentArea = document.createElement('div');
        await window.deleteNCR(7);
        expect(window.state.ncrs).toHaveLength(1);
        expect(window.state.ncrs[0]).toMatchObject({ status: 'Withdrawn', carStatus: 'Withdrawn', withdrawnReason: 'Raised in error' });
    });
    it('does nothing when the prompt is cancelled', async () => {
        window.state.ncrs = [{ id: 8, status: 'Open' }];
        window.prompt = () => null;
        await window.deleteNCR(8);
        expect(window.state.ncrs[0].status).toBe('Open');
    });
});

vi.restoreAllMocks();

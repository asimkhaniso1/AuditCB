// Every ReportIntegrity rule used to run inside try { } catch { /* skip */ },
// so a rule that threw simply vanished from the result — and a report it
// could not examine read as READY. The gate must fail closed: a rule that
// cannot run is a blocker naming the rule, and finalize refuses to issue.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const fs = await import('fs');
const path = await import('path');
const INTEGRITY_JS = fs.readFileSync(path.resolve('./report-integrity.js'), 'utf8');
const AI_SERVICE_JS = fs.readFileSync(path.resolve('./ai-service.js'), 'utf8');

function loadIntegrity() {
    // eslint-disable-next-line no-new-func
    new Function('module', INTEGRITY_JS)(undefined);
    return window.ReportIntegrity;
}

// A clean, otherwise-issuable report whose `recommendation` cannot be read —
// the B10 rule reads it, so that rule throws mid-check.
function throwingReport() {
    const report = {
        id: 'r1', planId: 'p1', client: 'Acme', clientId: 'c1',
        leadAuditor: 'A. Auditor', scope: 'Design and manufacture of widgets',
        standard: 'ISO 9001:2015', checklistProgress: [], ncrs: []
    };
    Object.defineProperty(report, 'recommendation', {
        enumerable: false,
        get() { throw new Error('recommendation store unavailable'); }
    });
    return report;
}

beforeEach(() => {
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], auditors: [] };
    window.Logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() };
    delete window.ReportStats;
});

describe('ReportIntegrity fails closed', () => {
    it('turns a rule that throws into a blocker naming the rule', () => {
        const RI = loadIntegrity();
        const result = RI.check({ report: throwingReport() });

        expect(result.status).toBe('BLOCKED');
        const blocker = result.blockers.find(b => b.id === 'BX-checkB10MissingRecommendation');
        expect(blocker).toBeTruthy();
        expect(blocker.message).toBe('Check checkB10MissingRecommendation could not run: recommendation store unavailable');
        expect(window.Logger.error).toHaveBeenCalledWith(
            'ReportIntegrity',
            expect.stringContaining('checkB10MissingRecommendation could not run'),
            expect.any(Error)
        );
    });

    it('still reports every other rule when one throws', () => {
        const RI = loadIntegrity();
        const report = throwingReport();
        report.ncrs = [{ type: 'major', description: 'No calibration records', clause: '' }];
        const result = RI.check({ report });
        // B3 (no evidence) and B4 (no criterion) still run alongside the failure.
        const ids = result.blockers.map(b => b.id);
        expect(ids).toContain('BX-checkB10MissingRecommendation');
        expect(ids.some(id => id.startsWith('B3'))).toBe(true);
        expect(ids.some(id => id.startsWith('B4'))).toBe(true);
    });

    it('blocks finalisation when a rule cannot run', () => {
        loadIntegrity();
        const report = throwingReport();
        window.state.auditReports = [report];
        window.state.auditPlans = [{ id: 'p1', client: 'Acme', auditType: 'Special' }];
        window.DataService = { findAuditReport: (id) => window.state.auditReports.find(r => r.id === id) };
        window.showNotification = vi.fn();
        window.saveChecklist = vi.fn();
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        // eslint-disable-next-line no-new-func
        new Function('module', AI_SERVICE_JS)(undefined);
        window.finalizeAndPublish('r1');

        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy.mock.calls[0][0]).toContain('cannot be finalized');
        expect(alertSpy.mock.calls[0][0]).toContain('checkB10MissingRecommendation could not run');
        expect(window.saveChecklist).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
        confirmSpy.mockRestore();
    });

    it('blocks finalisation when the validator is not loaded at all', () => {
        delete window.ReportIntegrity;
        const report = { id: 'r2', planId: 'p1', leadAuditor: 'A', scope: 'Widgets', checklistProgress: [] };
        window.state.auditReports = [report];
        window.DataService = { findAuditReport: (id) => window.state.auditReports.find(r => r.id === id) };
        // eslint-disable-next-line no-new-func
        new Function('module', AI_SERVICE_JS)(undefined);
        const gate = window.computeIssuanceGate('r2');
        expect(gate.gateBlockers.some(m => /integrity validator is not loaded/.test(m))).toBe(true);
    });
});

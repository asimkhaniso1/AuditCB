// Technical review of PC Connection's 2026 recertification (item 12): no
// checklist item recorded a department, so Audit Trails printed all 78 items
// as one "Unassigned / Cross-functional" row. With no department, an item is
// now reported under the agenda session that covered its clause.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

beforeAll(() => {
    window.Logger = { debug() {}, info() {}, warn() {}, error() {} };
    loadScript('./utils.js', { global: true });
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./ai-service.js', { params: { module: undefined } });
    loadScript('./report-stats.js', { global: true });
    loadScript('./report-executive.js', { params: { module: undefined } });
    loadScript('./report-integrity.js', { params: { module: undefined } });
    loadScript('./execution-reporting.js', { global: true });
});

const plan = {
    traceability: {
        sessions: [
            { sessionId: 'S01', title: 'Opening meeting' },
            { sessionId: 'S03', title: 'Context and interested parties; leadership, policy, roles and responsibilities' },
            { sessionId: 'S07', title: 'Access lifecycle; supplier and cloud-service security' }
        ],
        checklist: {
            questions: [
                { clause: '4.2', sessionIds: ['S03'] },
                { clause: 'A.5.19 / A.5.20 / A.5.21', sessionIds: ['S07'] },
                { clause: '9.9', sessionIds: ['S99'] } // a session that no longer exists
            ]
        }
    }
};

describe('Audit Trails area for an item', () => {
    it('uses the agenda session that covered the item clause when no department is recorded', () => {
        const areaOf = window._auditTrailAreaResolver(plan);
        expect(areaOf({ clause: '4.2' }).label).toBe('Context and interested parties; leadership, policy, roles and responsibilities');
        expect(areaOf({ clause: 'A.5.20' }).label).toBe('Access lifecycle; supplier and cloud-service security');
        expect(areaOf({ clause: 'ISMS-4', criterionRef: 'A.5.21 / A.6.6' }).label).toBe('Access lifecycle; supplier and cloud-service security');
    });

    it('orders sessions as the agenda does', () => {
        const areaOf = window._auditTrailAreaResolver(plan);
        expect(areaOf({ clause: '4.2' }).rank).toBeLessThan(areaOf({ clause: 'A.5.19' }).rank);
    });

    it('never guesses: an item no session covered is listed as such, last', () => {
        const areaOf = window._auditTrailAreaResolver(plan);
        const other = areaOf({ clause: 'A.7.1' });
        expect(other.label).toBe('Other items (not tied to an agenda session)');
        expect(other.rank).toBeGreaterThan(areaOf({ clause: 'A.5.19' }).rank);
        expect(areaOf({ clause: '9.9' }).label).toBe('Other items (not tied to an agenda session)');
    });

    it('a recorded department still wins', () => {
        expect(window._auditTrailAreaResolver(plan)({ clause: '4.2', department: 'Service Desk' }).label).toBe('Service Desk');
    });

    it('a plan without traceability keeps the old grouping', () => {
        expect(window._auditTrailAreaResolver({})({ clause: '4.2' }).label).toBe('Unassigned / Cross-functional');
    });

    it('is one rule, in ReportStats, shared with the evidence annex', () => {
        expect(window.ReportStats.auditAreaResolver(plan)({ clause: '4.2' }).label)
            .toBe(window._auditTrailAreaResolver(plan)({ clause: '4.2' }).label);
    });
});

// The evidence annex (Annex B) grouped by department too, so PC Connection's
// read "Evidence attachment by department: Unassigned / Cross-functional 79%"
// and every evidence card carried that label.
describe('evidence annex areas', () => {
    const items = [
        { status: 'conform', clause: '4.2', evidenceImages: ['a.jpg'], comment: 'Seen.' },
        { status: 'conform', clause: 'A.5.19', evidenceImages: [], comment: 'Seen.' },
        { status: 'nc', ncrType: 'minor', clause: 'A.7.1', evidenceImages: ['b.jpg'], comment: 'Gap.' }
    ];
    const intel = () => window.ReportExecutive.computeEvidenceIntel({ report: { checklistProgress: items }, hydratedProgress: items, auditPlan: plan });

    it('groups attachment by agenda session, not "Unassigned / Cross-functional"', () => {
        const by = intel().byDepartment;
        expect(Object.keys(by)).toEqual(expect.arrayContaining([
            'Context and interested parties; leadership, policy, roles and responsibilities',
            'Access lifecycle; supplier and cloud-service security',
            'Other items (not tied to an agenda session)'
        ]));
        expect(by['Unassigned / Cross-functional']).toBeUndefined();
    });

    it('labels evidence cards with the same area', () => {
        expect(intel().evidenced.map((e) => e.department)).toContain('Context and interested parties; leadership, policy, roles and responsibilities');
    });
});

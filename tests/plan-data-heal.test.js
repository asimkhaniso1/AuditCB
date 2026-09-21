import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { buildScenario, M } from '../tools/pcc-scenario.mjs';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug() { }, info() { }, warn() { }, error() { } };
window.UTILS = M.UTILS;
const DataMigration = require('../data-migration.js');

describe('DataMigration.healPlanText — plan text stored HTML-escaped by older builds', () => {
    it('removes every escaping layer from agenda rows and narratives, and reports the plans it changed', () => {
        const plans = [
            { id: 'p1', agenda: [{ day: 'Day 1', item: 'Patch &amp; Vulnerability', dept: 'Business Continuity &amp;amp; Disaster Recovery', auditor: 'Other', time: '09:00 - 10:00' }],
                objectives: '• Determine conformity &amp; effectiveness', criteria: 'x', methodology: 'y' },
            { id: 'p2', agenda: [{ item: 'Clean text & more' }], objectives: 'clean' }
        ];
        const r = DataMigration.healPlanText(plans);
        expect(r.changed.map(p => p.id)).toEqual(['p1']);
        expect(plans[0].agenda[0].item).toBe('Patch & Vulnerability');
        expect(plans[0].agenda[0].dept).toBe('Business Continuity & Disaster Recovery');
        expect(plans[0].objectives).toBe('• Determine conformity & effectiveness');
        expect(plans[1].agenda[0].item).toBe('Clean text & more');
    });
    it('is idempotent', () => {
        const plans = [{ id: 'p1', agenda: [{ item: 'A &amp; B' }] }];
        DataMigration.healPlanText(plans);
        expect(DataMigration.healPlanText(plans).changed).toEqual([]);
    });
    it('tolerates malformed records', () => {
        expect(() => DataMigration.healPlanText([null, undefined, {}, { agenda: 'not an array' }])).not.toThrow();
        expect(DataMigration.healPlanText(undefined)).toEqual({ changed: [], fields: 0 });
    });
});

describe('DataMigration.healChecklistStandards — checklists that lost their standard association', () => {
    let s;
    beforeEach(async () => { s = await buildScenario(); });

    it('re-links a checklist whose ids were lost, from the standard names it carries', () => {
        const ck = JSON.parse(JSON.stringify(s.checklist));
        delete ck.standardIds; delete ck.qaContext;
        const r = DataMigration.healChecklistStandards([ck]);
        expect(r.changed).toHaveLength(1);
        expect(ck.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000']);
        expect(ck.qaContext.standardIds).toEqual(['iso27001', 'iso22301', 'iso20000']);
        // and the contradiction it caused is gone
        const cov = window.ChecklistCoverage.assess(ck, window.ChecklistCoverage.buildContext(ck, { client: s.client }));
        expect(cov.outcome).not.toBe('blocked');
    });
    it('leaves a correctly linked checklist alone, and reports one no source can link', () => {
        const good = JSON.parse(JSON.stringify(s.checklist));
        const orphan = { id: 'x', name: 'Custom list', standard: 'Custom', clauses: [] };
        const r = DataMigration.healChecklistStandards([good, orphan]);
        expect(r.changed).toEqual([]);
        expect(r.unresolved).toEqual([orphan]);
    });
    it('the association survives the cloud round-trip: standardIds ride in qa_context and are read back onto the checklist', () => {
        const src = require('fs').readFileSync(require('path').resolve('./supabase-client.js'), 'utf8');
        expect(src).toContain('qa_context: {');
        expect(src).toMatch(/standardIds: Array\.isArray\(checklist\.qa_context\?\.standardIds\)/);
    });
});

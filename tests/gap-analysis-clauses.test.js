// Document gap analysis — which clauses it checks, and how it counts them.
//
// For PC Connection (27001 + 22301 + 20000-1) the analysis showed 5 gaps of
// which one was real: a heading clause counted beside its own sub-clauses
// ("8.4 Supply and demand" and 8.4.1), and "General" sub-clauses whose
// requirements were all evidenced. Worse, the Knowledge Base clause lists it
// checked against were truncated (20000-1 stopped at 8.4.1), so the service
// management processes were never checked at all.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
const CS = (await import('../checklist-standards.js')).default || window.ChecklistStandards;
window.ChecklistStandards = CS;
loadScript('./client-docs-bulk.js', { params: { module: undefined } });
const B = window.ClientDocsBulk;

const doc = (name, clauses, std) => ({ name, linkedClauses: clauses, linkedStandards: std || '' });

describe('analyseDocumentGaps — heading clauses', () => {
    const clauses = [{ clause: '8.4', title: 'Supply and demand' }, { clause: '8.4.1', title: 'Budgeting' },
        { clause: '8.4.2', title: 'Demand management' }, { clause: '8.4.3', title: 'Capacity management' }];

    it('counts one missing topic once, on its sub-clauses', () => {
        const a = B.analyseDocumentGaps(clauses, [], 'iso20000');
        expect(a.rows.map(r => r.clause)).toEqual(['8.4.1', '8.4.2', '8.4.3']);
        expect(a.gaps).toBe(3);
    });

    it('still lets a document linked to the heading cover its sub-clauses', () => {
        const a = B.analyseDocumentGaps(clauses, [doc('Supply and Demand Procedure', '8.4', 'iso20000')], 'iso20000');
        expect(a.gaps).toBe(0);
    });

    it('keeps a heading clause listed on its own', () => {
        const a = B.analyseDocumentGaps([{ clause: '8.4', title: 'Supply and demand' }], [doc('Supplier Eval', '8.4.1')]);
        expect(a.rows.map(r => r.clause)).toEqual(['8.4']);
        expect(a.covered).toBe(1);
    });
});

describe('analyseDocumentGaps — "General" sub-clauses', () => {
    const bcms = [{ clause: '8.2.1', title: 'General' }, { clause: '8.2.2', title: 'Business impact analysis' }, { clause: '8.2.3', title: 'Risk assessment' }];

    it('credits a General clause when every requirement beside it is evidenced', () => {
        const docs = [doc('BIA Procedure', '8.2.2', 'iso22301'), doc('Risk Assessment Procedure 22301', '8.2.3', 'iso22301')];
        const a = B.analyseDocumentGaps(bcms, docs, 'iso22301');
        const general = a.rows.find(r => r.clause === '8.2.1');
        expect(general.covered).toBe(true);
        expect(general.coveredVia).toEqual(['8.2.2', '8.2.3']);
        expect(general.docs.map(d => d.name)).toEqual(['BIA Procedure', 'Risk Assessment Procedure 22301']);
        expect(a.gaps).toBe(0);
    });

    it('leaves it a gap while any of those requirements is not evidenced', () => {
        const a = B.analyseDocumentGaps(bcms, [doc('BIA Procedure', '8.2.2', 'iso22301')], 'iso22301');
        expect(a.rows.find(r => r.clause === '8.2.1').covered).toBe(false);
        expect(a.gaps).toBe(2);
    });

    it('does not infer a .1 clause that is a requirement in its own right', () => {
        const sms = [{ clause: '8.2.1', title: 'Service delivery' }, { clause: '8.2.2', title: 'Plan the services' }];
        const a = B.analyseDocumentGaps(sms, [doc('Service Management Plan', '8.2.2', 'iso20000')], 'iso20000');
        expect(a.rows.find(r => r.clause === '8.2.1').covered).toBe(false);
    });
});

describe('clausesForStandard — an incomplete Knowledge Base list does not hide clauses', () => {
    const std = CS.resolve('ISO 20000-1:2018').standards[0];
    beforeEach(() => {
        window.KB_HELPERS = { normalizeStdName: (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '') };
    });

    it('uses the registry, and says why, when the KB list is missing registry clauses', () => {
        const truncated = std.clauses.filter(c => !/^8\.[5-7]|^8\.4\.[23]|^9\.4/.test(c.ref)).map(c => ({ clause: c.ref, title: c.title }));
        window.state = { knowledgeBase: { standards: [{ name: 'ISO 20000-1:2018', status: 'ready', clauses: truncated }] } };
        const r = B.clausesForStandard('ISO 20000-1:2018');
        expect(r.clauses.map(c => c.clause)).toEqual(std.clauses.map(c => c.ref));
        expect(r.source).toMatch(/^Clause registry/);
        expect(r.source).toMatch(/Knowledge Base list for ISO 20000-1:2018 is missing \d+ clauses/);
        expect(r.kbIncomplete.missing).toContain('8.6.1');
    });

    it('keeps a complete KB list, including one that splits clauses further', () => {
        const full = std.clauses.flatMap(c => c.ref === '8.4.3'
            ? [{ clause: '8.4.3.1', title: 'Capacity a' }, { clause: '8.4.3.2', title: 'Capacity b' }]
            : [{ clause: c.ref, title: c.title }]);
        window.state = { knowledgeBase: { standards: [{ name: 'ISO 20000-1:2018', status: 'ready', clauses: full }] } };
        const r = B.clausesForStandard('ISO 20000-1:2018');
        expect(r.source).toBe('Knowledge Base — ISO 20000-1:2018');
        expect(r.clauses).toBe(full);
    });

    it('lists which registry clauses a KB list lacks', () => {
        expect(B.kbMissingRegistryRefs([{ clause: '4.1' }], { clauses: [{ ref: '4.1' }, { ref: '4.2' }] })).toEqual(['4.2']);
        expect(B.kbMissingRegistryRefs([{ clause: '8.4.2.1' }], { clauses: [{ ref: '8.4.2' }] })).toEqual([]);
    });
});

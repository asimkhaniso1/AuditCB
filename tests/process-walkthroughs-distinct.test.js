import { describe, it, expect } from 'vitest';
import { loadScript } from './helpers/load-script.js';

// Language Services: every key-process walkthrough was the same sentence with
// the process name swapped in ("Walk the X process end to end — its inputs,
// controls, records and handoffs — ..."). The QA check flagged them as
// near-duplicates (84-88% overlap), which held the checklist back from Ready
// for Audit, and the auditor could not tell from the checklist what each walk
// was for. Each walkthrough now names the sample, controls, records and the
// measure for its own kind of process; a process with no specific focus is
// walked from an angle no other walkthrough on the checklist uses.

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
window.state = window.state || {};
window.ChecklistStandards = (await import('../checklist-standards.js')).default || window.ChecklistStandards;
window.ChecklistQA = (await import('../checklist-qa.js')).default || window.ChecklistQA;
window.SupportingDocs = (await import('../supporting-docs.js')).default || window.SupportingDocs;
loadScript('./client-docs-bulk.js', { params: { module: undefined } });
const B = window.ClientDocsBulk;
const QA = window.ChecklistQA;

const PROCESSES = [
    'Client Enquiry and Quotation', 'Service Specification and Planning', 'Translation Workflow',
    'Service Provision and Delivery', 'Service Delivery & Client Handling',
    'Internal Audit', 'Management Review', 'Document Control Procedure', 'Records Control'
];
const CLIENT = {
    id: 'ls', name: 'Language Services UK', standard: 'ISO 9001:2015', employees: '40',
    sites: [{ name: 'London' }],
    keyProcesses: PROCESSES.map(name => ({ name, category: 'Core' }))
};

const walks = (ck) => ck.clauses.flatMap(c => c.subClauses || [])
    .filter(s => /^walk the .* process end to end/i.test(s.requirement || ''));

describe('key-process walkthroughs', () => {
    it('Language Services: each walkthrough asks something different, and QA finds no near-duplicates among them', () => {
        const ck = B.buildClientChecklist(CLIENT, [], { auditType: 'initial', standard: 'ISO 9001:2015', manDays: 4, maxItems: Infinity });
        const list = walks(ck);
        expect(list.length).toBeGreaterThanOrEqual(5);
        const qa = QA.validate ? QA.validate(ck) : ck.qa;
        const isWalk = (title) => PROCESSES.some(n => String(title || '').startsWith(n));
        const flagged = (qa.issues || []).filter(i => ['NEAR_DUPLICATE', 'DUPLICATE_QUESTION', 'SIMILAR_WORDING'].includes(i.code) && isWalk(i.itemTitle));
        expect(flagged.map(i => `${i.code} ${i.itemTitle}: ${i.message}`)).toEqual([]);
        // The words the questions share are only the frame, never the substance.
        const words = (t) => new Set(String(t).toLowerCase().match(/[a-z]{4,}/g));
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = words(list[i].requirement); const b = words(list[j].requirement);
                const shared = [...a].filter(w => b.has(w)).length;
                expect(shared / new Set([...a, ...b]).size).toBeLessThan(0.6);
            }
        }
    });

    it('names what to sample for the process type', () => {
        const used = new Set();
        expect(B.processWalkText('Translation Workflow', '', used)).toMatch(/translator and reviser .* qualification records/);
        expect(B.processWalkText('Client Enquiry and Quotation', '', used)).toMatch(/quotation issued against them/);
        expect(B.processWalkText('Service Desk Operations', '', used)).toMatch(/sample tickets/);
    });

    it('a second process matching the same focus takes the next one, then an unused angle', () => {
        const used = new Set();
        const a = B.processWalkText('Service Provision and Delivery', '', used);
        const b = B.processWalkText('Service Delivery & Client Handling', '', used);
        const c = B.processWalkText('Product Delivery', '', used);
        expect(a).toMatch(/from release to delivery/);
        expect(b).toMatch(/client contacts and complaints/);
        expect(c).toMatch(/concentrating on/);
        expect(new Set([a, b, c].map(t => t.replace(/Walk the .* process/, ''))).size).toBe(3);
    });

    it('keeps the process owner when one is recorded', () => {
        expect(B.processWalkText('Translation Workflow', ', owner Head of Production', new Set()))
            .toMatch(/^Walk the Translation Workflow process end to end, owner Head of Production: sample completed jobs/);
    });
});

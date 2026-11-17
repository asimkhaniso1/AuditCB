// AI Auto Map (execution checklist): assign the interviewee per question.
// Reported not working on the PC Connection audit (109 questions):
//  - one request for the whole checklist could time out or come back cut short,
//    and then nothing was mapped — it now runs in batches;
//  - the question text was scraped with a style selector that no longer matched
//    the row, so the AI saw only clause numbers — it now reads data-clause /
//    data-requirement from the row's status input;
//  - a name the AI invented was added to the dropdown — only names on the
//    client's contact list are assigned, with that contact's designation and
//    department.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const SRC = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');

const contacts = [
    { name: 'Samantha Johnston', designation: 'Compliance Manager', department: 'Compliance' },
    { name: 'Ken Mason', designation: 'President', department: 'Executive' },
    { name: 'Umair Khan', designation: 'IT Manager', department: 'IT' }
];

describe('PersonnelAutoMap', () => {
    let P;
    beforeEach(() => { loadScript('./execution-module-v2.js', { params: { module: undefined } }); P = window.PersonnelAutoMap; });

    it('splits a 109-question checklist into batches of 20', () => {
        const items = Array.from({ length: 109 }, (_, i) => ({ id: 'q' + i }));
        const batches = P.chunk(items, P.BATCH_SIZE);
        expect(batches.map(b => b.length)).toEqual([20, 20, 20, 20, 20, 9]);
    });

    it('sends clause and question text, safely encoded', () => {
        const prompt = P.buildPrompt(contacts, [{ id: 'cl1-IMS-12', clause: '7.5', question: 'Test "document" control' }]);
        expect(prompt).toContain('Samantha Johnston — Compliance Manager (Compliance)');
        expect(prompt).toContain('"clause":"7.5"');
        expect(prompt).toContain('Test \\"document\\" control');
    });

    it('reads a plain, fenced or wrapped JSON reply', () => {
        expect(P.parseMappings('[{"id":"a","personnel":"Ken Mason"}]')).toHaveLength(1);
        expect(P.parseMappings('```json\n[{"id":"a","personnel":"Ken Mason"}]\n```')).toHaveLength(1);
        expect(P.parseMappings('Here you go: [{"id":"a","personnel":"Ken Mason"}] done')).toHaveLength(1);
        expect(() => P.parseMappings('Sorry, I cannot help')).toThrow(/not a list/);
    });

    it('assigns only contacts on the list, with their own designation and department', () => {
        const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
        const r = P.resolve([
            { id: 'a', personnel: 'ken mason', designation: 'CEO (invented)' },
            { id: 'b', personnel: 'Jane Invented' },
            { id: 'c', personnel: 'Umair Khan' },
            { id: 'c', personnel: 'Ken Mason' },
            { id: 'zz', personnel: 'Ken Mason' }
        ], contacts, items);
        expect(r.assignments).toEqual([
            { id: 'a', personnel: 'Ken Mason', designation: 'President', department: 'Executive' },
            { id: 'c', personnel: 'Umair Khan', designation: 'IT Manager', department: 'IT' }
        ]);
        expect(r.skipped).toBe(2);
    });
});

describe('autoMapPersonnel wiring', () => {
    it('reads clause and question from the status input, not styled elements', () => {
        expect(SRC).toContain("document.getElementById('status-' + uniqueId)");
        expect(SRC).toContain('statusInput?.dataset.requirement');
        expect(SRC).not.toContain("row.querySelector('[style*=\"line-height\"]')");
    });

    it('calls the AI once per batch and keeps going when a batch fails', () => {
        expect(SRC).toContain('PAM.chunk(itemsToMap, PAM.BATCH_SIZE)');
        expect(SRC).toContain('AI_SERVICE.callProxyAPI(PAM.buildPrompt(contactList, batches[b]), { maxTokens: 8192 })');
        expect(SRC).toContain('failures.push(');
        expect(SRC).toContain('They save automatically in a few seconds.');
        expect(SRC).toContain('if (mapped && window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();');
    });
});

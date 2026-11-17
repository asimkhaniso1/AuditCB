// Checklist question numbers in the execution view.
//
// The printed checklist and the auditor's agenda index name a question by its
// section and 1-based position ("IMS 13"), but the execution screen showed only
// the clause and the question text, so finding "IMS 13" meant counting rows.
// Each sectioned row now carries a badge and data-q-ref, and a "Jump to" box
// opens the question's section, scrolls to it and highlights it.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const SRC = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');

describe('ChecklistQuestionRef', () => {
    beforeEach(() => { loadScript('./execution-module-v2.js', { params: { module: undefined } }); });

    it('derives the printed number from the item id (0-based index -> 1-based)', () => {
        const Q = window.ChecklistQuestionRef;
        expect(Q.fromItemId('IMS-12')).toBe('IMS 13');
        expect(Q.fromItemId('RECERT-0')).toBe('RECERT 1');
        expect(Q.fromItemId('A-43')).toBe('A 44');
    });

    it('gives custom and flat-format items no number', () => {
        const Q = window.ChecklistQuestionRef;
        expect(Q.fromItemId(null)).toBeNull();
        expect(Q.fromItemId(7)).toBeNull();
        expect(Q.fromItemId('custom')).toBeNull();
    });

    it('reads what an auditor types', () => {
        const Q = window.ChecklistQuestionRef;
        ['IMS 13', 'ims13', 'IMS-13', ' ims  13 ', 'Ims.13'].forEach(t => expect(Q.parse(t)).toBe('IMS 13'));
        expect(Q.parse('a 30')).toBe('A 30');
        expect(Q.parse('recert 1')).toBe('RECERT 1');
    });

    it('rejects a clause number or nonsense instead of guessing', () => {
        const Q = window.ChecklistQuestionRef;
        ['A.5.30', '7.5', 'IMS', '', '13', 'IMS 0'].forEach(t => expect(Q.parse(t)).toBeNull());
    });
});

describe('jumpToChecklistQuestion', () => {
    let notes;
    beforeEach(() => {
        loadScript('./execution-module-v2.js', { params: { module: undefined } });
        notes = [];
        window.showNotification = (msg, type) => notes.push([type, msg]);
        window.syncToggleAllAccordions = () => {};
        document.body.innerHTML = `
            <div class="accordion-section"><div class="accordion-content" id="clause-1-IMS" style="display: none;">
                <div class="card checklist-item" id="row-1-IMS-12" data-q-ref="IMS 13" style="border-left: 4px solid #e2e8f0;"></div>
            </div></div>
            <i id="icon-clause-1-IMS" style="transform: rotate(0deg);"></i>
            <input id="jump-to-question" value="ims13">`;
        Element.prototype.scrollIntoView = function () { this.dataset.scrolled = 'yes'; };
    });

    it('opens the collapsed section, scrolls to the question and highlights it', () => {
        expect(window.jumpToChecklistQuestion('IMS 13')).toBe(true);
        const row = document.getElementById('row-1-IMS-12');
        expect(document.getElementById('clause-1-IMS').style.display).toBe('block');
        expect(document.getElementById('icon-clause-1-IMS').style.transform).toBe('rotate(180deg)');
        expect(row.dataset.scrolled).toBe('yes');
        expect(row.style.borderLeftColor).not.toBe('');
        expect(notes).toEqual([]);
    });

    it('the Go button reads the box', () => {
        expect(window.jumpToChecklistQuestionFromBox()).toBe(true);
    });

    it('says so when the number is not in this checklist', () => {
        expect(window.jumpToChecklistQuestion('SMS 99')).toBe(false);
        expect(notes[0][0]).toBe('warning');
        expect(notes[0][1]).toContain('SMS 99');
    });

    it('asks for a question number when given a clause', () => {
        expect(window.jumpToChecklistQuestion('A.5.30')).toBe(false);
        expect(notes[0][1]).toMatch(/question number/);
    });

    it('stays quiet on an empty box', () => {
        expect(window.jumpToChecklistQuestion('')).toBe(false);
        expect(notes).toEqual([]);
    });
});

describe('execution view markup', () => {
    it('each sectioned row carries its number as data-q-ref and a badge', () => {
        expect(SRC).toContain('const qRef = window.ChecklistQuestionRef.fromItemId(isCustom ? null : idx);');
        expect(SRC).toMatch(/id="row-\$\{uniqueId\}"\$\{qRefAttr\}/);
        expect(SRC).toContain('${qRefBadge}<div>${item.clause || \'N/A\'}</div>');
    });

    it('the toolbar has the Jump to box wired to the delegated actions', () => {
        expect(SRC).toContain('id="jump-to-question"');
        expect(SRC).toContain('data-action-change="jumpToChecklistQuestion" data-arg1="this.value"');
        expect(SRC).toContain('data-action="jumpToChecklistQuestionFromBox"');
    });
});

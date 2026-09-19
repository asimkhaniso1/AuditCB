import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = window.state || {};
window.state.knowledgeBase = { standards: [], sops: [], policies: [], marketing: [] };
window.switchSettingsSubTab = () => {};

const fs = await import('fs');
const path = await import('path');
const source = fs.readFileSync(path.resolve('./settings-kb.js'), 'utf8');
const loadSorting = new Function(`${source}; return { sorted: _sortedKnowledgeDocs, header: _kbSortableHeader };`);
const sorting = loadSorting();

describe('Knowledge Base table sorting', () => {
    beforeEach(() => {
        window.state.knowledgeBase = { standards: [], sops: [], policies: [], marketing: [] };
    });

    it('sorts document names ascending by default without mutating stored order', () => {
        const documents = [{ name: 'ISO 50001' }, { name: 'ISO 14001' }];
        const result = sorting.sorted(documents, 'standard');

        expect(result.map(doc => doc.name)).toEqual(['ISO 14001', 'ISO 50001']);
        expect(documents.map(doc => doc.name)).toEqual(['ISO 50001', 'ISO 14001']);
    });

    it('toggles the selected column between ascending and descending', () => {
        window.sortKnowledgeBase('standard', 'uploadDate');
        const documents = [
            { name: 'Older', uploadDate: '2026-01-01' },
            { name: 'Newer', uploadDate: '2026-09-19' }
        ];

        expect(sorting.sorted(documents, 'standard').map(doc => doc.name)).toEqual(['Older', 'Newer']);
        window.sortKnowledgeBase('standard', 'uploadDate');
        expect(sorting.sorted(documents, 'standard').map(doc => doc.name)).toEqual(['Newer', 'Older']);
    });

    it('renders accessible sort state and an action for the event delegator', () => {
        window.sortKnowledgeBase('standard', 'name');
        const header = sorting.header('Document', 'standard', 'name');

        expect(header).toMatch(/aria-sort="(ascending|descending)"/);
        expect(header).toContain('data-action="sortKnowledgeBase"');
        expect(header).toContain('data-arg1="standard"');
        expect(header).toContain('data-arg2="name"');
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};
window.location = window.location || { hash: '' };

const fs = await import('fs');
const path = await import('path');
const source = fs.readFileSync(path.resolve('./supabase-client.js'), 'utf8');
const loadClient = new Function(`${source}; return SupabaseClient;`);
const SupabaseClient = loadClient();

describe('Knowledge Base cloud persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.state = {
            settings: { standards: [], roles: [], isAdmin: true },
            knowledgeBase: {
                standards: [{
                    id: 42,
                    name: 'ISO 42001:2023',
                    status: 'ready',
                    extractedText: 'recoverable PDF text'.repeat(1000),
                    clauses: [{ clause: '4.1', title: 'Context' }],
                    generatedChecklist: [{ clause: '4.1', question: 'Is context determined?' }],
                    checklistCount: 1,
                    lastAnalyzed: '2026-09-19',
                    cloudPath: 'standard/iso-42001.pdf'
                }],
                sops: [],
                policies: [],
                marketing: []
            }
        };
    });

    it('keeps completed analysis but excludes recoverable source text from the cloud snapshot', () => {
        const snapshot = SupabaseClient._buildKnowledgeBaseSnapshot(window.state.knowledgeBase);
        const saved = snapshot.standards[0];

        expect(saved.status).toBe('ready');
        expect(saved.clauses).toEqual([{ clause: '4.1', title: 'Context' }]);
        expect(saved.generatedChecklist).toHaveLength(1);
        expect(saved.lastAnalyzed).toBe('2026-09-19');
        expect(saved.cloudPath).toBe('standard/iso-42001.pdf');
        expect(saved).not.toHaveProperty('extractedText');
        expect(window.state.knowledgeBase.standards[0]).toHaveProperty('extractedText');
    });

    it('uses the compact snapshot in the settings upsert', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: 'settings-1' }, error: null });
        const select = vi.fn(() => ({ single }));
        const upsert = vi.fn(() => ({ select }));
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'settings-1' } });
        const limit = vi.fn(() => ({ maybeSingle }));
        const tableSelect = vi.fn(() => ({ limit }));

        SupabaseClient.isInitialized = true;
        SupabaseClient.client = {
            from: vi.fn(() => ({ select: tableSelect, upsert }))
        };

        await SupabaseClient.syncSettingsToSupabase();

        const payload = upsert.mock.calls[0][0];
        expect(payload.knowledge_base.standards[0].status).toBe('ready');
        expect(payload.knowledge_base.standards[0].clauses).toHaveLength(1);
        expect(payload.knowledge_base.standards[0]).not.toHaveProperty('extractedText');
    });
});

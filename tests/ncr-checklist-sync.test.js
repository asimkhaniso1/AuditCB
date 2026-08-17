// Checklist -> NCR sync dedupe (execution-module-v2.js) + the fetchNCRs()
// refetch-preservation fix (ncr-capa-module.js) that the dedupe depends on.
//
// Root cause confirmed: fetchNCRs() rebuilds window.state.ncrs purely from the
// Supabase row shape on every refetch (persistNCR() calls fetchNCRs() after
// every create/update). _sourceKey — and, before this fix, sourceChecklistId/
// sourceItemIdx — have no DB column, so they were silently dropped from EVERY
// record on the very next sync after the first save. The checklist-sync
// dedupe then had nothing to match on except an exact-text description
// comparison, which breaks the moment a finding's wording changes (AI-polish
// or a manual edit) — minting a fresh duplicate NCR each time.
//
// The sync closure itself lives inside saveChecklist, which is only attached
// to `window` when renderExecutionTab() runs the relevant tab branch, so it
// isn't callable in isolation here. This suite instead covers: the extracted
// pure key-building helpers the closure calls (window.NCRSyncUtils), the
// read-only duplicate finder (window.NCRModule.findDuplicateNCRs), and the
// fetchNCRs() preservation fix directly.
import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;

const fs = await import('fs');
const path = await import('path');
function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    // Shadow Vite/vitest's CJS-interop `module` binding so the eval'd file's
    // own `if (typeof module !== 'undefined' && module.exports) {...}` tail
    // guard is false here, exactly as it is in the browser (no `module`
    // global there). execution-module-v2.js's export list references
    // `_autoFillPersonnel`, a name that's only ever assigned as
    // `window._autoFillPersonnel = ...` inside a nested function — not a
    // hoisted top-level declaration — so letting that guard's branch execute
    // during eval throws a ReferenceError unrelated to anything under test.
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    eval(src);
}

// window.saveChecklist (which contains the checklist->NCR sync closure) only
// gets attached to `window` when renderExecutionTab() actually runs the
// relevant tab branch — it's not a hoisted top-level declaration, so the sync
// closure itself isn't callable in isolation from a unit test. Per the task's
// own fallback, this suite instead unit-tests the extracted, pure
// key-building helpers the closure now calls (window.NCRSyncUtils) plus
// window.NCRModule.findDuplicateNCRs() (tested further below), rather than
// the closure end-to-end.
describe('execution-module-v2 checklist -> NCR sync identity helpers (window.NCRSyncUtils)', () => {
    beforeEach(() => {
        loadModule('./execution-module-v2.js');
    });

    it('buildSourceKey embeds reportId + checklistId + itemIdx', () => {
        expect(window.NCRSyncUtils.buildSourceKey('rep-1', { checklistId: 'cl-1', itemIdx: '3' }))
            .toBe('exec-rep-1-cl-1-3');
    });

    it('buildSourceKey falls back to "custom" for items with no checklistId', () => {
        expect(window.NCRSyncUtils.buildSourceKey('rep-1', { itemIdx: '7' }))
            .toBe('exec-rep-1-custom-7');
    });

    it('buildStableIdentity is independent of reportId and description — only checklistId/itemIdx', () => {
        const identity = window.NCRSyncUtils.buildStableIdentity({ checklistId: 'cl-1', itemIdx: '3' });
        expect(identity).toEqual({ sourceChecklistId: 'cl-1', sourceItemIdx: '3' });
    });

    it('buildStableIdentity stringifies non-string ids so later String()-based matching is consistent', () => {
        const identity = window.NCRSyncUtils.buildStableIdentity({ checklistId: 5, itemIdx: 2 });
        expect(identity).toEqual({ sourceChecklistId: '5', sourceItemIdx: '2' });
    });

    it('buildStableIdentity returns null fields (never "undefined" strings) for a fully custom item', () => {
        const identity = window.NCRSyncUtils.buildStableIdentity({ itemIdx: null });
        expect(identity).toEqual({ sourceChecklistId: null, sourceItemIdx: null });
    });

    it('two different items (different itemIdx) never produce the same source key or stable identity — this is what lets defect-4\'s dedupe distinguish genuinely different findings on the same clause', () => {
        const keyA = window.NCRSyncUtils.buildSourceKey('rep-1', { checklistId: 'cl-1', itemIdx: '3' });
        const keyB = window.NCRSyncUtils.buildSourceKey('rep-1', { checklistId: 'cl-1', itemIdx: '9' });
        expect(keyA).not.toBe(keyB);

        const idA = window.NCRSyncUtils.buildStableIdentity({ checklistId: 'cl-1', itemIdx: '3' });
        const idB = window.NCRSyncUtils.buildStableIdentity({ checklistId: 'cl-1', itemIdx: '9' });
        expect(idA).not.toEqual(idB);
    });

    it('the SAME item produces a stable identity independent of description text — the defect-4 fix: AI-polish rewording a finding must not change its identity', () => {
        const before = window.NCRSyncUtils.buildStableIdentity({ checklistId: 'cl-1', itemIdx: '3', ncrDescription: 'Original wording' });
        const after = window.NCRSyncUtils.buildStableIdentity({ checklistId: 'cl-1', itemIdx: '3', ncrDescription: 'AI-polished wording, completely different text' });
        expect(before).toEqual(after);
    });
});

describe('window.NCRModule.findDuplicateNCRs', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [] };
        loadModule('./ncr-capa-module.js');
    });

    it('groups suspected duplicates by clientId + auditId + clause + severity, read-only', () => {
        window.state.ncrs = [
            { id: 'ncr-057', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.2', severity: 'Minor', status: 'Open', description: 'Wording A' },
            { id: 'ncr-061', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.2', severity: 'Minor', status: 'Open', description: 'Wording B (AI-polished)' },
            { id: 'ncr-063', clientId: 'ktd-1', auditId: 'plan-ktd', clause: '7', severity: 'Minor', status: 'Open', description: 'Unrelated finding' }
        ];

        const groups = window.NCRModule.findDuplicateNCRs();

        expect(groups.length).toBe(1);
        expect(groups[0].clientId).toBe('ktd-1');
        expect(groups[0].auditId).toBe('plan-ktd');
        expect(groups[0].clause).toBe('focus.2');
        expect(groups[0].records.map((r) => r.id).sort()).toEqual(['ncr-057', 'ncr-061']);

        // Read-only: nothing is mutated or withdrawn.
        expect(window.state.ncrs.every((n) => n.status === 'Open')).toBe(true);
    });

    it('excludes records already Withdrawn or already superseded', () => {
        window.state.ncrs = [
            { id: 'ncr-1', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.8', severity: 'Minor', status: 'Withdrawn', description: 'A' },
            { id: 'ncr-2', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.8', severity: 'Minor', status: 'Open', description: 'B', _supersededBy: 'ncr-3' },
            { id: 'ncr-3', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.8', severity: 'Minor', status: 'Open', description: 'C' }
        ];

        expect(window.NCRModule.findDuplicateNCRs()).toEqual([]);
    });

    it('does not group records missing clientId/auditId/clause', () => {
        window.state.ncrs = [
            { id: 'ncr-1', clientId: 'ktd-1', auditId: null, clause: 'FOCUS.8', severity: 'Minor', status: 'Open', description: 'A' },
            { id: 'ncr-2', clientId: 'ktd-1', auditId: null, clause: 'FOCUS.8', severity: 'Minor', status: 'Open', description: 'B' }
        ];

        expect(window.NCRModule.findDuplicateNCRs()).toEqual([]);
    });
});

describe('fetchNCRs preserves checklist-sync identity fields across a refetch', () => {
    beforeEach(() => {
        window.state = { ncrs: [], capaAnalytics: {} };
        window.contentArea = { innerHTML: '' };
        loadModule('./ncr-capa-module.js');
    });

    it('_sourceKey/sourceChecklistId/sourceItemIdx survive a refetch even though the DB row has no such columns', async () => {
        window.state.ncrs = [{
            id: 'db-1', clientId: 'ktd-1', auditId: 'plan-ktd', clause: 'FOCUS.2',
            description: 'Internal audit programme was not fully implemented.',
            severity: 'Minor', status: 'Open',
            _sourceKey: 'exec-rep-1-cl-1-3', sourceChecklistId: 'cl-1', sourceItemIdx: '3'
        }];

        // Simulate the Supabase response: the row shape has none of the
        // sync-identity fields (no migration for them yet).
        window.SupabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => Promise.resolve({
                        data: [{
                            id: 'db-1', client_id: 'ktd-1', audit_id: 'plan-ktd', clause: 'FOCUS.2',
                            description: 'Internal audit programme was not fully implemented.',
                            severity: 'Minor', status: 'Open', evidence: []
                        }],
                        error: null
                    })
                })
            })
        };

        await window.fetchNCRs();

        expect(window.state.ncrs.length).toBe(1);
        expect(window.state.ncrs[0]._sourceKey).toBe('exec-rep-1-cl-1-3');
        expect(window.state.ncrs[0].sourceChecklistId).toBe('cl-1');
        expect(window.state.ncrs[0].sourceItemIdx).toBe('3');
    });
});

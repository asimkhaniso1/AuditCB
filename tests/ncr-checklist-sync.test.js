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

// Report Integrity panel's "Set criterion" fix action (execution-module-v2.js).
// window.setFindingCriterion itself is DOM/modal glue that only attaches to
// `window` once renderExecutionTab() has run (same reason saveChecklist isn't
// directly testable above) — but its resolution/validation/persistence logic
// is pulled out into top-level, pure functions on window.NCRSyncUtils
// specifically so it doesn't have that problem. This suite covers those.
describe('window.NCRSyncUtils.resolveFindingFromRef', () => {
    beforeEach(() => {
        loadModule('./execution-module-v2.js');
    });

    it('tier 1: matches by checklistId + itemIdx against report.checklistProgress', () => {
        const report = {
            checklistProgress: [
                { checklistId: 'cl-1', itemIdx: 'ORG-0', status: 'nc', ncrType: 'major', clause: 'ORG' },
                { checklistId: 'cl-1', itemIdx: 'ORG-1', status: 'nc', ncrType: 'minor', clause: 'ORG' }
            ],
            ncrs: []
        };
        const result = window.NCRSyncUtils.resolveFindingFromRef(report, { checklistId: 'cl-1', itemIdx: 'ORG-1' });
        expect(result).toEqual({ kind: 'checklist', item: report.checklistProgress[1], index: 1 });
    });

    it('tier 2: falls back to the combined [checklist..., manual...] index when there is no checklistId/itemIdx', () => {
        const report = {
            checklistProgress: [
                { status: 'nc', ncrType: 'major', clause: 'FOCUS.1' },
                { status: 'conform', clause: 'FOCUS.2' }, // not NC — excluded from the combined list
                { status: 'nc', ncrType: 'minor', clause: 'FOCUS.3' }
            ],
            ncrs: [
                { type: 'Major', clause: '8.5.2' }
            ]
        };
        // Combined order: [FOCUS.1 (idx0), FOCUS.3 (idx0->2)] then [manual ncr (idx0)]
        const first = window.NCRSyncUtils.resolveFindingFromRef(report, { index: 0 });
        expect(first).toEqual({ kind: 'checklist', item: report.checklistProgress[0], index: 0 });

        const second = window.NCRSyncUtils.resolveFindingFromRef(report, { index: 1 });
        expect(second).toEqual({ kind: 'checklist', item: report.checklistProgress[2], index: 2 });

        const manual = window.NCRSyncUtils.resolveFindingFromRef(report, { index: 2 });
        expect(manual).toEqual({ kind: 'manual', item: report.ncrs[0], index: 0 });
    });

    it('tier 3: falls back to matching clause against report.ncrs', () => {
        const report = {
            checklistProgress: [],
            ncrs: [
                { type: 'Minor', clause: 'FOCUS.4' },
                { type: 'Major', clause: '9.2' }
            ]
        };
        const result = window.NCRSyncUtils.resolveFindingFromRef(report, { clause: '9.2' });
        expect(result).toEqual({ kind: 'manual', item: report.ncrs[1], index: 1 });
    });

    it('returns null when nothing matches', () => {
        const report = { checklistProgress: [], ncrs: [] };
        expect(window.NCRSyncUtils.resolveFindingFromRef(report, { clause: 'nowhere' })).toBeNull();
        expect(window.NCRSyncUtils.resolveFindingFromRef(null, { clause: 'x' })).toBeNull();
        expect(window.NCRSyncUtils.resolveFindingFromRef(report, null)).toBeNull();
    });
});

describe('window.NCRSyncUtils.isValidClauseRef', () => {
    beforeEach(() => {
        loadModule('./execution-module-v2.js');
        // Normally set once renderExecutionTab() has run — set directly here
        // since this suite exercises isValidClauseRef in isolation.
        window.NCR_PSEUDO_CLAUSE_PATTERN = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
        delete window.Validator; // exercise the local fallback regex by default
    });

    it.each(['9.2', '8.2.2', 'A.8.13', '9.6.2 (a)'])('accepts %s', (value) => {
        expect(window.NCRSyncUtils.isValidClauseRef(value)).toBe(true);
    });

    it.each(['FOCUS.2', 'SURV', 'ORG', 'DOC', 'focus.9', ''])('always rejects the pseudo-tag %s', (value) => {
        expect(window.NCRSyncUtils.isValidClauseRef(value)).toBe(false);
    });

    it('rejects free text that is not clause-shaped', () => {
        expect(window.NCRSyncUtils.isValidClauseRef('not a clause')).toBe(false);
    });

    it('prefers window.Validator.isClauseRef when present, but still rejects a pseudo-tag it would accept', () => {
        window.Validator = { isClauseRef: () => true }; // a permissive stub
        expect(window.NCRSyncUtils.isValidClauseRef('8.5.2')).toBe(true);
        expect(window.NCRSyncUtils.isValidClauseRef('FOCUS.2')).toBe(false);
    });

    it('falls back to the local regex when window.Validator.isClauseRef throws', () => {
        window.Validator = { isClauseRef: () => { throw new Error('boom'); } };
        expect(window.NCRSyncUtils.isValidClauseRef('9.2')).toBe(true);
    });
});

describe('window.NCRSyncUtils.applyCriterionToFinding + findSiblingFindingsByClause', () => {
    beforeEach(() => {
        window.state = { ncrs: [] };
        loadModule('./execution-module-v2.js');
    });

    it('sets criterionRef/criterionSource:auditor-assigned on a checklist-sourced finding', () => {
        const report = { id: 'rep-1', planId: 'plan-1', clientId: 'client-1', checklistProgress: [
            { checklistId: 'cl-1', itemIdx: 'FOCUS-0', clause: 'FOCUS.2', status: 'nc', ncrType: 'major' }
        ] };
        const resolved = { kind: 'checklist', item: report.checklistProgress[0], index: 0 };

        window.NCRSyncUtils.applyCriterionToFinding(report, resolved, '8.5.2');

        expect(report.checklistProgress[0].criterionRef).toBe('8.5.2');
        expect(report.checklistProgress[0].criterionSource).toBe('auditor-assigned');
    });

    it('also updates the matching window.state.ncrs register record by sourceChecklistId/sourceItemIdx', () => {
        const report = { id: 'rep-1', planId: 'plan-1', clientId: 'client-1', checklistProgress: [
            { checklistId: 'cl-1', itemIdx: 'FOCUS-0', clause: 'FOCUS.2', status: 'nc', ncrType: 'major' }
        ] };
        window.state.ncrs = [
            { id: 'ncr-1', clientId: 'client-1', auditId: 'plan-1', clause: 'FOCUS.2', sourceChecklistId: 'cl-1', sourceItemIdx: 'FOCUS-0', status: 'Open' }
        ];
        const resolved = { kind: 'checklist', item: report.checklistProgress[0], index: 0 };

        window.NCRSyncUtils.applyCriterionToFinding(report, resolved, '8.5.2');

        expect(window.state.ncrs[0].criterionRef).toBe('8.5.2');
        expect(window.state.ncrs[0].criterionSource).toBe('auditor-assigned');
    });

    it('falls back to clientId+clause when the register record has no stable identity', () => {
        const report = { id: 'rep-1', planId: 'plan-1', clientId: 'client-1', checklistProgress: [
            { checklistId: 'cl-1', itemIdx: 'FOCUS-0', clause: 'FOCUS.2', status: 'nc', ncrType: 'major' }
        ] };
        window.state.ncrs = [
            { id: 'ncr-legacy', clientId: 'client-1', clause: 'FOCUS.2', status: 'Open' } // no sourceChecklistId/sourceItemIdx
        ];
        const resolved = { kind: 'checklist', item: report.checklistProgress[0], index: 0 };

        window.NCRSyncUtils.applyCriterionToFinding(report, resolved, '8.5.2');

        expect(window.state.ncrs[0].criterionRef).toBe('8.5.2');
        expect(window.state.ncrs[0].criterionSource).toBe('auditor-assigned');
    });

    it('does not touch window.state.ncrs for a manual finding — the NCR record IS the finding', () => {
        const report = { id: 'rep-1', clientId: 'client-1', checklistProgress: [], ncrs: [{ clause: 'FOCUS.2', type: 'Major' }] };
        window.state.ncrs = [{ id: 'unrelated', clientId: 'client-1', clause: 'FOCUS.2', status: 'Open' }];
        const resolved = { kind: 'manual', item: report.ncrs[0], index: 0 };

        window.NCRSyncUtils.applyCriterionToFinding(report, resolved, '8.5.2');

        expect(report.ncrs[0].criterionRef).toBe('8.5.2');
        expect(window.state.ncrs[0].criterionRef).toBeUndefined();
    });

    it('findSiblingFindingsByClause finds other major/minor findings sharing the same pseudo-clause, excluding the one just fixed', () => {
        const report = {
            checklistProgress: [
                { clause: 'FOCUS.2', status: 'nc', ncrType: 'major' },   // index 0 — the one just fixed
                { clause: 'FOCUS.2', status: 'nc', ncrType: 'minor' },   // index 1 — sibling
                { clause: 'FOCUS.2', status: 'conform' },                // not NC — excluded
                { clause: 'FOCUS.8', status: 'nc', ncrType: 'major' }    // different clause — excluded
            ],
            ncrs: [
                { clause: 'FOCUS.2', type: 'Minor' } // index 0 — sibling, manual register
            ]
        };
        const resolved = { kind: 'checklist', item: report.checklistProgress[0], index: 0 };

        const siblings = window.NCRSyncUtils.findSiblingFindingsByClause(report, resolved, 'FOCUS.2');

        expect(siblings).toHaveLength(2);
        expect(siblings).toContainEqual({ kind: 'checklist', item: report.checklistProgress[1], index: 1 });
        expect(siblings).toContainEqual({ kind: 'manual', item: report.ncrs[0], index: 0 });
    });
});

// The bulk "Review all criteria" screen's data source. The modal itself is
// DOM/modal glue (same reasoning as window.setFindingCriterion above), but the
// decision of WHICH findings still need an auditor-assigned criterion — and
// which must deliberately never be offered one — is pure and worth pinning.
describe('window.NCRSyncUtils.collectUnconfirmedCriteria', () => {
    beforeEach(() => {
        window.state = { ncrs: [] };
        loadModule('./report-stats.js');
        loadModule('./execution-module-v2.js');
    });

    const collect = (checklistProgress) =>
        window.NCRSyncUtils.collectUnconfirmedCriteria({ id: 'r1', checklistProgress });

    it('collects a FOCUS item that has no assigned criterion', () => {
        const out = collect([
            { clause: 'FOCUS.1', status: 'nc', ncrType: 'observation', requirement: 'Verify management reviews.' }
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].clause).toBe('FOCUS.1');
    });

    it('skips an item that already carries a confirmed criterionRef', () => {
        expect(collect([
            { clause: 'FOCUS.1', criterionRef: '9.3', status: 'nc', ncrType: 'minor' }
        ])).toEqual([]);
    });

    it('skips an item whose own clause is already a real clause of the standard', () => {
        expect(collect([
            { clause: '9.2', status: 'nc', ncrType: 'minor' }
        ])).toEqual([]);
    });

    // The whole point of the exclusion: a §9.6.2 element's criterion is an
    // ISO/IEC 17021-1 programme criterion. Offering to assign it a clause of
    // the client's standard is the cross-framework confusion B15 blocks.
    it('never offers an ISO clause for an ISO/IEC 17021-1 surveillance element', () => {
        expect(collect([
            { clause: '9.6.2 (b)', criterionSource: 'surveillance-programme', status: 'conform' },
            { clause: '9.6.2 (d)', criterionSource: 'surveillance-programme', status: 'nc', ncrType: 'observation' }
        ])).toEqual([]);
    });

    it('carries the unconfirmed suggestion through with its confidence and basis', () => {
        const out = collect([
            {
                clause: 'FOCUS.4', status: 'conform', requirement: 'Evaluate competence and training.',
                criterionSuggestedRef: '7.2', criterionConfidence: 'low', criterionBasis: 'keyword-fallback'
            }
        ]);
        expect(out[0]).toMatchObject({ suggestedRef: '7.2', confidence: 'low', basis: 'keyword-fallback' });
    });

    it('reports an item with no suggestion at all rather than hiding it', () => {
        const out = collect([
            { clause: 'FOCUS.5', status: 'conform', requirement: 'Assess IPC/WHMA-A-620 Class 3 adherence.' }
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].suggestedRef).toBe('');
        expect(out[0].confidence).toBe('none');
    });

    it('flags only major/minor NCs as blocking issuance — advisories and conforming items do not', () => {
        const out = collect([
            { clause: 'FOCUS.1', status: 'nc', ncrType: 'observation' },
            { clause: 'FOCUS.2', status: 'nc', ncrType: 'minor' },
            { clause: 'FOCUS.3', status: 'conform' },
            { clause: 'FOCUS.4', status: 'nc', ncrType: 'ofi' }
        ]);
        const blocking = out.filter(o => o.blocksIssuance).map(o => o.clause);
        expect(blocking).toEqual(['FOCUS.2']);
    });

    it('orders blockers first, then by suggestion confidence', () => {
        const out = collect([
            { clause: 'FOCUS.1', status: 'conform', criterionSuggestedRef: '9.3', criterionConfidence: 'low' },
            { clause: 'FOCUS.2', status: 'conform', criterionSuggestedRef: '7.2', criterionConfidence: 'medium' },
            { clause: 'FOCUS.3', status: 'nc', ncrType: 'minor' }
        ]);
        expect(out.map(o => o.clause)).toEqual(['FOCUS.3', 'FOCUS.2', 'FOCUS.1']);
    });

    it('keeps the checklistProgress index so the modal can write back to the right item', () => {
        const out = collect([
            { clause: '4.1', status: 'conform' },
            { clause: 'FOCUS.9', status: 'nc', ncrType: 'minor' }
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].index).toBe(1);
    });

    it('returns an empty list for a report with nothing to assign', () => {
        expect(window.NCRSyncUtils.collectUnconfirmedCriteria({ checklistProgress: [] })).toEqual([]);
        expect(window.NCRSyncUtils.collectUnconfirmedCriteria(null)).toEqual([]);
    });
});

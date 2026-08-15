import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8');
eval(src);

function ncr(overrides) {
    return Object.assign({
        id: 'ncr-' + Math.random().toString(36).slice(2),
        clientId: 'client-1',
        auditId: 'audit-1',
        clause: 'FOCUS.8',
        description: 'Backup logs not retained for the required retention period',
        severity: 'Major',
        status: 'Open',
        raisedDate: '2026-01-01'
    }, overrides);
}

describe('reconcileDuplicateNCRs', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [] };
    });

    it('groups two NCRs with the same clause+description for the same client, even when auditId differs', () => {
        // Mirrors the real-world pair (NCR-072 raised on one audit engagement,
        // NCR-077 raised on a later one, same client, same clause, same wording).
        window.state.ncrs = [
            ncr({ id: 'ncr-072', ncrNumber: 'NCR-072', auditId: 'audit-1', raisedDate: '2026-01-01' }),
            ncr({ id: 'ncr-077', ncrNumber: 'NCR-077', auditId: 'audit-2', raisedDate: '2026-06-01' })
        ];

        const result = window.reconcileDuplicateNCRs();

        expect(result.groups).toBe(1);
        expect(result.superseded).toBe(1);
        expect(result.kept).toBe(1);

        // Non-destructive: both records still exist in the register.
        expect(window.state.ncrs.length).toBe(2);
        const survivor = window.state.ncrs.find((n) => n.status !== 'Withdrawn');
        const superseded = window.state.ncrs.find((n) => n.status === 'Withdrawn');
        expect(survivor).toBeTruthy();
        expect(superseded).toBeTruthy();
        expect(superseded._supersededBy).toBe(survivor.ncrNumber || survivor.id);
        expect(superseded.withdrawnReason).toMatch(/Duplicate of/);
    });

    it('does NOT group the same clause+description across different clients', () => {
        window.state.ncrs = [
            ncr({ id: 'ncr-a', clientId: 'client-1', auditId: 'audit-1' }),
            ncr({ id: 'ncr-b', clientId: 'client-2', auditId: 'audit-2' })
        ];

        const result = window.reconcileDuplicateNCRs();

        expect(result.groups).toBe(0);
        expect(result.superseded).toBe(0);
        expect(window.state.ncrs.every((n) => n.status !== 'Withdrawn')).toBe(true);
    });

    it('is idempotent: reconciling twice leaves the same end state as reconciling once', () => {
        window.state.ncrs = [
            ncr({ id: 'ncr-073', ncrNumber: 'NCR-073', auditId: 'audit-1', clause: 'FOCUS.2' }),
            ncr({ id: 'ncr-076', ncrNumber: 'NCR-076', auditId: 'audit-3', clause: 'FOCUS.2' })
        ];

        const first = window.reconcileDuplicateNCRs();
        const afterFirst = JSON.parse(JSON.stringify(window.state.ncrs));

        const second = window.reconcileDuplicateNCRs();
        const afterSecond = JSON.parse(JSON.stringify(window.state.ncrs));

        expect(first.groups).toBe(1);
        expect(first.superseded).toBe(1);
        // Second pass finds nothing left to group — the superseded record is
        // now Withdrawn/_supersededBy and is excluded up front.
        expect(second.groups).toBe(0);
        expect(second.superseded).toBe(0);
        expect(afterSecond).toEqual(afterFirst);
    });

    it('normalizes description case/whitespace before comparing, without loosening the match beyond that', () => {
        window.state.ncrs = [
            ncr({ id: 'ncr-1', auditId: 'audit-1', description: '  Backup   logs not retained for the required retention period  ' }),
            ncr({ id: 'ncr-2', auditId: 'audit-2', description: 'BACKUP LOGS NOT RETAINED FOR THE REQUIRED RETENTION PERIOD' })
        ];
        expect(window.reconcileDuplicateNCRs().groups).toBe(1);

        window.state = { ncrs: [], auditPlans: [] };
        // A genuinely different finding on the same clause must NOT collapse
        // into the same group just because normalization is applied.
        window.state.ncrs = [
            ncr({ id: 'ncr-3', auditId: 'audit-1', description: 'Backup logs not retained for the required retention period' }),
            ncr({ id: 'ncr-4', auditId: 'audit-2', description: 'Fire extinguishers past their inspection due date' })
        ];
        expect(window.reconcileDuplicateNCRs().groups).toBe(0);
    });

    it('resolves the client via auditId -> audit plan when a legacy record has no direct clientId', () => {
        window.state.auditPlans = [{ id: 'plan-9', clientId: 'client-9' }];
        window.state.ncrs = [
            ncr({ id: 'ncr-x', clientId: 'client-9', auditId: 'audit-1' }),
            ncr({ id: 'ncr-y', clientId: undefined, auditId: 'plan-9' })
        ];

        const result = window.reconcileDuplicateNCRs();
        expect(result.groups).toBe(1);
    });

    it('leaves records with no resolvable client ungrouped rather than guessing', () => {
        window.state.ncrs = [
            ncr({ id: 'ncr-p', clientId: undefined, auditId: 'unknown-audit-1' }),
            ncr({ id: 'ncr-q', clientId: undefined, auditId: 'unknown-audit-2' })
        ];

        const result = window.reconcileDuplicateNCRs();
        expect(result.groups).toBe(0);
    });
});

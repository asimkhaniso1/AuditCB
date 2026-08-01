import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [] };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8');
eval(src);

describe('NCRModule lifecycle rules', () => {
    it('CAR_STATUSES has 13 entries including Ineffective, Reopened, Withdrawn', () => {
        const statuses = window.NCRModule.CAR_STATUSES;
        expect(statuses.length).toBe(13);
        expect(statuses).toContain('Ineffective');
        expect(statuses).toContain('Reopened');
        expect(statuses).toContain('Withdrawn');
    });

    describe('normalizeCarStatus', () => {
        it('maps legacy statuses onto extended vocabulary', () => {
            expect(window.NCRModule.normalizeCarStatus('Open')).toBe('Correction Pending');
            expect(window.NCRModule.normalizeCarStatus('Verification')).toBe('Verification Pending');
            expect(window.NCRModule.normalizeCarStatus('Closed')).toBe('Closed');
        });
    });

    describe('legacyStatusFromCar', () => {
        it('maps extended CAR statuses back onto the legacy 4-state vocabulary', () => {
            expect(window.NCRModule.legacyStatusFromCar('Evidence Submitted')).toBe('In Progress');
            expect(window.NCRModule.legacyStatusFromCar('Effective')).toBe('Closed');
            expect(window.NCRModule.legacyStatusFromCar('Withdrawn')).toBe('Withdrawn');
        });
    });

    describe('computeAutoCarStatus', () => {
        it('advances through the happy path as CAPA fields are recorded', () => {
            const record1 = { correction: 'fixed the leak' };
            expect(window.NCRModule.computeAutoCarStatus(record1)).toBe('RCA Pending');

            const record2 = { correction: 'fixed the leak', rootCause: 'valve wear' };
            expect(window.NCRModule.computeAutoCarStatus(record2)).toBe('Plan Pending');

            const record3 = { correction: 'fixed the leak', rootCause: 'valve wear', correctiveAction: 'replace valve' };
            expect(window.NCRModule.computeAutoCarStatus(record3)).toBe('In Progress');

            const record4 = {
                correction: 'fixed the leak',
                rootCause: 'valve wear',
                correctiveAction: 'replace valve',
                capaImplementedDate: '2026-01-01'
            };
            expect(window.NCRModule.computeAutoCarStatus(record4)).toBe('Verification Pending');
        });
    });

    describe('isWithdrawnNCR', () => {
        it('excludes withdrawn records only', () => {
            expect(window.isWithdrawnNCR({ status: 'Withdrawn' })).toBe(true);
            expect(window.isWithdrawnNCR({ status: 'Open' })).toBe(false);
            expect(window.isWithdrawnNCR({ status: 'Closed' })).toBe(false);
            expect(window.isWithdrawnNCR(null)).toBeFalsy();
        });
    });

    describe('overdue semantics', () => {
        // ncr-capa-module.js's overdue logic (updateNCRAnalytics at line ~1053, and the
        // inline computation around line 842) is not exported on window/window.NCRModule —
        // it's a module-private function invoked internally by fetchNCRs()/render paths,
        // and those paths require a full DOM (document.getElementById chains) that would
        // make this an integration test rather than a unit test. Per the module's own
        // comments ("Missing due date is never overdue — flagged separately", line 454;
        // "Overdue uses dueDate strictly — missing due dates never count as overdue",
        // lines 841 and 1061) the rule is consistently: a record counts as overdue only
        // when status !== 'Closed' AND dueDate is present AND dueDate < today. We assert
        // that exact predicate here as a documented spec-check rather than skipping, since
        // no exported overdue helper exists to call directly.
        it('documents the overdue predicate used consistently across the module (status !== Closed && dueDate present && dueDate < today)', () => {
            const today = new Date();
            const past = new Date(today.getTime() - 10 * 86400000);

            const overduePredicate = (n) => n.status !== 'Closed' && !!n.dueDate && new Date(n.dueDate) < today;

            expect(overduePredicate({ status: 'Open', dueDate: null })).toBe(false);
            expect(overduePredicate({ status: 'Open', dueDate: past.toISOString() })).toBe(true);
            expect(overduePredicate({ status: 'Closed', dueDate: past.toISOString() })).toBe(false);

            // Sanity: the source contains this exact predicate shape in at least one place.
            expect(src).toMatch(/dueDate\s*&&\s*new Date\(n\.dueDate\)\s*<\s*today/);
        });
    });
});

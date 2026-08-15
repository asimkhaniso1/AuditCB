import { describe, it, expect, beforeEach } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.state = { ncrs: [], auditPlans: [] };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8');
eval(src);

function futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function pastDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

function ncr(overrides) {
    return Object.assign({
        id: 'ncr-' + Math.random().toString(36).slice(2),
        clientId: 'client-1',
        auditId: 'audit-1',
        clause: '8.5.2',
        description: 'Sample finding',
        severity: 'Minor',
        status: 'Open',
        raisedDate: '2026-01-01'
    }, overrides);
}

describe('window.NCRModule.capaDisplayStatus', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [] };
    });

    it('future due date + no response fields -> Awaiting Auditee Response', () => {
        const rec = ncr({ dueDate: futureDate(30) });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Awaiting Auditee Response');
    });

    it('past due date, unclosed, no response fields -> Overdue', () => {
        const rec = ncr({ dueDate: pastDate(5) });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Overdue');
    });

    it('past due date but some response filed -> Overdue (overrides Response Received too)', () => {
        const rec = ncr({ dueDate: pastDate(5), correction: 'Immediate fix applied' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Overdue');
    });

    it('some response fields filled, not yet reviewed -> Response Received', () => {
        const rec = ncr({ dueDate: futureDate(10), rootCause: 'Operator training gap' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Response Received');
    });

    it('carStatus Verification Pending -> Under Auditor Review', () => {
        const rec = ncr({ dueDate: futureDate(10), carStatus: 'Verification Pending' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Under Auditor Review');
    });

    it('carStatus Evidence Submitted -> Under Auditor Review', () => {
        const rec = ncr({ dueDate: futureDate(10), carStatus: 'Evidence Submitted' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Under Auditor Review');
    });

    it('carStatus Ineffective -> Additional Evidence Required', () => {
        const rec = ncr({ dueDate: futureDate(10), carStatus: 'Ineffective' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Additional Evidence Required');
    });

    it('carStatus Approved / In Progress -> Accepted — Implementation Pending', () => {
        expect(window.NCRModule.capaDisplayStatus(ncr({ dueDate: futureDate(10), carStatus: 'Approved' })))
            .toBe('Accepted — Implementation Pending');
        expect(window.NCRModule.capaDisplayStatus(ncr({ dueDate: futureDate(10), carStatus: 'In Progress' })))
            .toBe('Accepted — Implementation Pending');
    });

    it('capaImplementedDate set, no effectiveness recorded -> Effectiveness Review Pending', () => {
        const rec = ncr({ dueDate: futureDate(10), carStatus: 'Verification Pending', capaImplementedDate: '2026-03-01' });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Effectiveness Review Pending');
    });

    it('status Closed -> Closed', () => {
        const rec = ncr({ status: 'Closed', dueDate: pastDate(30) });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Closed');
    });

    it('carStatus Effective -> Closed', () => {
        const rec = ncr({ carStatus: 'Effective', dueDate: pastDate(30) });
        expect(window.NCRModule.capaDisplayStatus(rec)).toBe('Closed');
    });

    it('never shows Overdue before the due date has passed, even with no response', () => {
        const rec = ncr({ dueDate: futureDate(1) });
        expect(window.NCRModule.capaDisplayStatus(rec)).not.toBe('Overdue');
    });

    it('is presentation-only: never mutates status/carStatus on the record', () => {
        const rec = ncr({ dueDate: pastDate(5) });
        const before = JSON.stringify(rec);
        window.NCRModule.capaDisplayStatus(rec);
        expect(JSON.stringify(rec)).toBe(before);
    });
});

describe('window.NCRModule.isOverdue', () => {
    beforeEach(() => {
        window.state = { ncrs: [], auditPlans: [] };
    });

    it('is false when there is no due date', () => {
        expect(window.NCRModule.isOverdue(ncr({ dueDate: '' }))).toBe(false);
    });

    it('is false once closed, even past due', () => {
        expect(window.NCRModule.isOverdue(ncr({ status: 'Closed', dueDate: pastDate(10) }))).toBe(false);
    });

    it('is false for Withdrawn records', () => {
        expect(window.NCRModule.isOverdue(ncr({ status: 'Withdrawn', dueDate: pastDate(10) }))).toBe(false);
    });

    it('is true past due and unclosed', () => {
        expect(window.NCRModule.isOverdue(ncr({ dueDate: pastDate(1) }))).toBe(true);
    });
});

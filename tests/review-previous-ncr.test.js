// One-step review of a previous audit's nonconformity (PC Connection
// recertification, 2026-11-17). Reviewing a previous NC took two register
// forms, + CAPA and then Verify, and Verify only appeared once an
// implementation date was on file; an NC still being worked on had no verdict.
// The audit's CAPA tab now offers one Review per previous NC that records the
// organisation's response, the evidence seen and the outcome together.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const UTILS = {
    escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    formatDate: d => String(d)
};

function base() {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.UTILS = UTILS;
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    window.SupabaseClient = null;
    window.closeModal = vi.fn();
    window.openModal = vi.fn();
}

function loadNCR() {
    window.NCRModule = {};
    loadScript('./ncr-capa-module.js', { params: { module: undefined } });
    return window.NCRModule;
}

const TODAY = { by: 'Cara Auditor', today: '2026-11-17' };

describe('applyPreviousNCRReview', () => {
    let NM;
    beforeEach(() => { base(); window.state = { ncrs: [], auditPlans: [] }; NM = loadNCR(); });

    it('Closed records the response and the verification, and closes the NCR', () => {
        const ncr = { id: 53, severity: 'Minor', status: 'Open', carStatus: 'Correction Pending' };
        const r = NM.applyPreviousNCRReview(ncr, {
            outcome: 'closed', correction: 'Audit scheduled', rootCause: 'No BCMS auditor', correctiveAction: 'Trained two internal auditors; 22301 audit done',
            implementedDate: '2026-06-30', evidence: 'Internal audit report IA-2026-04 (22301), dated 2026-06-20; closure log'
        }, TODAY);
        expect(r).toEqual({ ok: true });
        expect(ncr).toMatchObject({
            status: 'Closed', carStatus: 'Closed', effectiveness: 'Effective', capaImplementedDate: '2026-06-30',
            correctiveAction: 'Trained two internal auditors; 22301 audit done', verificationMethod: 'Internal audit report IA-2026-04 (22301), dated 2026-06-20; closure log',
            verifiedBy: 'Cara Auditor', verifiedDate: '2026-11-17'
        });
    });

    it('Closed needs the corrective action, its date and the evidence; nothing changes until they are there', () => {
        const ncr = { id: 1, severity: 'Major', status: 'Open' };
        const before = JSON.stringify(ncr);
        expect(NM.applyPreviousNCRReview(ncr, { outcome: 'closed', implementedDate: '2026-06-30', evidence: 'x' }, TODAY).ok).toBe(false);
        expect(NM.applyPreviousNCRReview(ncr, { outcome: 'closed', correctiveAction: 'y', evidence: 'x' }, TODAY).ok).toBe(false);
        expect(NM.applyPreviousNCRReview(ncr, { outcome: 'closed', correctiveAction: 'y', implementedDate: '2026-06-30' }, TODAY).error).toMatch(/evidence/);
        expect(NM.applyPreviousNCRReview(ncr, { outcome: '' }, TODAY).error).toMatch(/outcome/);
        expect(JSON.stringify(ncr)).toBe(before);
    });

    it('Not effective keeps the NCR open and flags a new action plan', () => {
        const ncr = { id: 2, severity: 'Minor', status: 'In Progress', carStatus: 'Verification Pending', capaImplementedDate: '2026-05-01', correctiveAction: 'Retrained' };
        expect(NM.applyPreviousNCRReview(ncr, { outcome: 'ineffective', correctiveAction: 'Retrained', implementedDate: '2026-05-01', evidence: 'Three of five sampled changes had no risk assessment' }, TODAY).ok).toBe(true);
        expect(ncr).toMatchObject({ status: 'In Progress', carStatus: 'Ineffective', effectiveness: 'Not Effective', verifiedDate: '2026-11-17' });
    });

    it('Still open records progress and a new target date, without a verdict', () => {
        const ncr = { id: 3, severity: 'Minor', status: 'Open', dueDate: '2026-05-17' };
        expect(NM.applyPreviousNCRReview(ncr, { outcome: 'open', correction: 'Interim review held', targetDate: '2027-01-31' }, TODAY).ok).toBe(true);
        expect(ncr).toMatchObject({ status: 'In Progress', carStatus: 'RCA Pending', dueDate: '2027-01-31', correction: 'Interim review held' });
        expect(ncr.effectiveness).toBeUndefined();
        expect(ncr.verifiedDate).toBeUndefined();
    });
});

describe('the Review form', () => {
    let ncr;
    beforeEach(() => {
        base();
        ncr = { id: 53, auditId: 'feb', clientId: 'c1', clause: '9.2', severity: 'Minor', status: 'Open', description: 'No internal audit of <ISO 22301>' };
        window.state = { currentUser: { name: 'Cara Auditor' }, auditPlans: [], ncrs: [ncr] };
        document.body.innerHTML = '<h3 id="modal-title"></h3><div id="modal-body"></div><button id="modal-save"></button>';
        loadNCR();
        window.reviewPreviousNCR(53);
    });
    const set = (id, v) => { document.getElementById(id).value = v; };

    it('opens with the finding (escaped) and the three outcomes', () => {
        expect(document.getElementById('modal-title').textContent).toBe('Review previous finding — NCR-053');
        expect(document.getElementById('modal-body').textContent).toContain('No internal audit of <ISO 22301>');
        expect(document.querySelectorAll('input[name="prev-review-outcome"]')).toHaveLength(3);
    });

    it('shows what is missing instead of saving an unsupported closure', async () => {
        document.querySelector('input[value="closed"]').checked = true;
        await document.getElementById('modal-save').onclick();
        expect(document.getElementById('prev-review-error').textContent).toMatch(/corrective action/);
        expect(ncr.status).toBe('Open');
        expect(window.closeModal).not.toHaveBeenCalled();
    });

    it('saves a closure in one step', async () => {
        set('prev-review-action', 'Two internal auditors trained; ISO 22301 internal audit completed');
        set('prev-review-implemented', '2026-06-30');
        set('prev-review-evidence', 'IA-2026-04 report and closure log');
        document.querySelector('input[value="closed"]').checked = true;
        await document.getElementById('modal-save').onclick();
        expect(ncr).toMatchObject({ status: 'Closed', carStatus: 'Closed', effectiveness: 'Effective', verifiedBy: 'Cara Auditor' });
        expect(window.closeModal).toHaveBeenCalled();
    });
});

describe('the audit CAPA tab', () => {
    beforeEach(() => {
        base();
        window.CONSTANTS = { STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na' }, NCR_TYPES: {}, NCR_CRITERIA: { MAJOR: {}, MINOR: {} } };
        for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
        window.NCRModule = { capaDisplayStatus: n => n.status, resolveClauseDisplay: n => ({ text: n.clause }), resolveAuditRef: () => 'Surveillance — 2026-02-17', isOverdue: () => false };
        window.state = { currentUser: { role: 'Lead Auditor' }, auditPlans: [], ncrs: [
            { id: 53, auditId: 'feb', clientId: 'c1', clause: '9.2', type: 'minor', status: 'Open' },
            { id: 21, auditId: 'feb', clientId: 'c1', clause: '7.5', type: 'minor', status: 'In Progress', capaImplementedDate: '2026-11-10' },
            { id: 22, auditId: 'feb', clientId: 'c1', clause: '8.1', type: 'minor', status: 'Closed', carStatus: 'Closed', verifiedDate: '2026-11-17' },
            { id: 23, auditId: 'old', clientId: 'c1', clause: '6.2', type: 'minor', status: 'Closed', carStatus: 'Closed', verifiedDate: '2025-03-01' },
            { id: 60, auditId: 'nov', clientId: 'c1', clause: '8.6.2', type: 'major', status: 'Open' }
        ] };
        globalThis.state = window.state;
        document.body.innerHTML = '<div id="tab-content"></div>';
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
        window.__renderExecutionTab({ id: 'r1', planId: 'nov', clientId: 'c1', date: '2026-11-17' }, 'capa', {});
    });
    const tables = () => Array.from(document.querySelectorAll('#exec-capa-register table'));
    const rowFor = (t, ref) => Array.from(t.querySelectorAll('tbody tr')).find(r => r.cells[0].textContent.includes(ref));

    it('gives each previous NC one Review button and keeps + CAPA / Verify for this audit', () => {
        const [prev, here] = tables();
        const r53 = rowFor(prev, 'NCR-053');
        expect(r53.querySelector('[data-action="reviewPreviousNCR"]').getAttribute('data-id')).toBe('53');
        expect(r53.querySelector('[data-action="openAddCAPAModal"]')).toBeNull();
        expect(rowFor(prev, 'NCR-021').querySelector('[data-action="verifyCAPA"]')).toBeNull();
        expect(rowFor(here, 'NCR-060').querySelector('[data-action="openAddCAPAModal"]')).not.toBeNull();
        expect(rowFor(here, 'NCR-060').querySelector('[data-action="reviewPreviousNCR"]')).toBeNull();
    });

    it('keeps an NC closed in this audit in the list, and leaves out ones closed before it', () => {
        const prev = tables()[0];
        expect(rowFor(prev, 'NCR-022').textContent).toContain('Edit review');
        expect(rowFor(prev, 'NCR-023')).toBeUndefined();
        expect(document.getElementById('exec-capa-register').textContent).toContain('nonconformities to review (2 open, 1 closed in this audit)');
    });
});

// Execution → CAPA and Review & Submit tabs, checked on the PC Connection audit.
//  CAPA: the tab read report.capas, a store nothing else reads; "Create CAPA"
//  never advanced or closed a register NCR, and its Linked NCR list offered only
//  manual NCRs. It now shows the NCR & CAPA register for the audit (this audit's
//  NCRs and the previous audits' NCRs to verify) with the register's own
//  + CAPA / Verify forms, which redraw this tab instead of leaving the audit.
//  Review & Submit: classifying a finding saved only to this browser and never
//  re-enabled Finalize / Submit; the OBS/OFI tile disagreed with itself; the
//  findings were numbered #1, #2 instead of the Findings tab's references.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const NCR_SRC = fs.readFileSync(path.resolve('./ncr-capa-module.js'), 'utf8');

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed', COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', FINALIZED: 'Finalized', PUBLISHED: 'Published' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } },
    NCR_COLORS: { major: '#dc2626', minor: '#d97706', observation: '#8b5cf6', ofi: '#0891b2' }
};

function setup() {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), formatDate: d => String(d) };
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div class="tab-btn" data-tab="capa"></div><div id="tab-content"></div>';
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
}

describe('CAPA tab shows the NCR & CAPA register', () => {
    let tab;
    beforeEach(() => {
        setup();
        window.NCRModule = {
            isOverdue: n => n.id === 53,
            capaDisplayStatus: n => n.capaImplementedDate ? 'Verification Pending' : 'Open',
            resolveClauseDisplay: n => ({ text: n.clause }),
            resolveAuditRef: n => n.auditId === 'feb' ? 'Surveillance — 17/02/2026' : 'Recertification — 17/11/2026'
        };
        window.state = { currentUser: { role: 'Lead Auditor' }, auditPlans: [], ncrs: [
            { id: 53, auditId: 'feb', clientId: 'c1', clause: '9.2', type: 'minor', status: 'Open' },
            { id: 21, auditId: 'feb', clientId: 'c1', clause: '7.5', severity: 'Minor', status: 'In Progress', capaImplementedDate: '2026-11-10', correctiveAction: 'Retrained' },
            { id: 30, auditId: 'feb', clientId: 'c1', clause: '8.1', type: 'minor', status: 'Closed' },
            { id: 31, auditId: 'feb', clientId: 'c1', clause: '4.1', type: 'observation', status: 'Open' },
            { id: 32, auditId: 'feb', clientId: 'c1', clause: '5.1', type: 'minor', status: 'Withdrawn' },
            { id: 60, auditId: 'nov', clientId: 'c1', clause: '8.6.2', type: 'major', status: 'Open' },
            { id: 99, auditId: 'other', clientId: 'c9', clause: '9.1', type: 'minor', status: 'Open' }
        ] };
        globalThis.state = window.state;
        window.__renderExecutionTab({ id: 'r1', planId: 'nov', clientId: 'c1', client: 'PC CONNECTION, INC.' }, 'capa', {});
        tab = document.getElementById('tab-content');
    });

    const refs = (i) => Array.from(tab.querySelectorAll('table')[i].querySelectorAll('tbody tr')).map(r => r.cells[0].querySelector('strong').textContent);

    it('lists open previous-audit NCRs to verify, and this audit NCRs, from the register', () => {
        expect(tab.querySelector('#exec-capa-register')).not.toBeNull();
        expect(refs(0).sort()).toEqual(['NCR-021', 'NCR-053']);
        expect(refs(1)).toEqual(['NCR-060']);
        expect(tab.textContent).not.toContain('NCR-099');
        expect(tab.textContent).not.toContain('Create CAPA');
    });

    it('offers one Review on a previous NCR and + CAPA on this audit NCR', () => {
        // Previous NCs are reviewed in one step (tests/review-previous-ncr.test.js);
        // + CAPA / Verify stay for this audit's own NCRs.
        const row = (ref) => Array.from(tab.querySelectorAll('tbody tr')).find(r => r.cells[0].textContent.includes(ref));
        expect(row('NCR-053').querySelector('[data-action="reviewPreviousNCR"]').getAttribute('data-id')).toBe('53');
        expect(row('NCR-053').querySelector('[data-action="openAddCAPAModal"]')).toBeNull();
        expect(row('NCR-021').querySelector('[data-action="reviewPreviousNCR"]').getAttribute('data-id')).toBe('21');
        expect(row('NCR-060').querySelector('[data-action="openAddCAPAModal"]').getAttribute('data-id')).toBe('60');
        expect(row('NCR-021').textContent).toContain('Retrained');
        expect(row('NCR-053').textContent).toContain('OVERDUE');
    });
});

describe('register forms redraw the screen they were opened from', () => {
    it('after-save redraws go through refreshNCRViews, which stays on the audit CAPA tab', () => {
        const afterSave = NCR_SRC.split('\n').filter(l => /renderNCRCAPAModuleContent\(window\.state\.ncrContextClientId\);/.test(l));
        // Left: the two already-guarded redraws and the one inside refreshNCRViews.
        expect(afterSave).toHaveLength(3);
        expect(NCR_SRC).toContain("if (document.getElementById('exec-capa-register')) {");
        expect((NCR_SRC.match(/refreshNCRViews\(\);/g) || []).length).toBe(7); // + reviewPreviousNCR
    });
});

describe('Review & Submit', () => {
    let report, saved;
    beforeEach(async () => {
        setup();
        window.KB_HELPERS = { resolveChecklistClause: (item) => ({ clauseText: item.clause || '', reqText: '' }), lookupKBRequirement: () => null };
        window.state = { currentUser: { role: 'Lead Auditor' }, auditPlans: [], ncrs: [], auditReports: [] };
        globalThis.state = window.state;
        report = { id: 'r1', planId: 'nov', status: 'In Progress', checklistProgress: [
            { checklistId: 'cl1', itemIdx: 'ISMS-5', status: 'nc', ncrType: 'ofi', clause: 'A.8.8', comment: 'Patching' },
            { checklistId: 'cl1', itemIdx: 'RECERT-5', status: 'nc', clause: '9.2', comment: 'Internal audit' },
            { checklistId: 'cl1', itemIdx: 'IMS-0', status: 'conform' }
        ], ncrs: [] };
        saved = 0;
        window.__renderExecutionTab(report, 'review', { assignedChecklists: [] });
        // Rendering defines the real window.saveChecklist; stand it in after.
        window.saveChecklist = vi.fn(() => { saved++; });
        // The tab binds its handlers after 100 ms; let that happen inside this
        // test, or a previous test's timer binds to this test's page.
        await new Promise(r => setTimeout(r, 150));
    });

    it('numbers findings with the Findings tab references', async () => {
        const text = document.getElementById('tab-content').textContent;
        expect(text).toContain('OFI-001');
        expect(text).toContain('NCR-001');
        expect(text).not.toMatch(/#1\b/);
    });

    it('counts OBS and OFI together from the start', () => {
        expect(document.getElementById('review-stat-obsofi').textContent).toBe('1');
    });

    it('classifying the last pending finding enables Finalize and Submit, and saves to the cloud', async () => {
        const finalize = document.getElementById('btn-finalize-publish');
        const submit = document.getElementById('btn-submit-lead-auditor');
        expect(finalize.disabled || submit.disabled).toBe(true);
        const pendingSelect = document.querySelector('.review-severity[data-finding-id="checklist-1"]');
        pendingSelect.value = 'minor';
        pendingSelect.dispatchEvent(new Event('change'));
        expect(report.checklistProgress[1].ncrType).toBe('minor');
        expect(document.getElementById('review-stat-minor').textContent).toBe('1');
        expect(saved).toBe(1);
        expect(window.saveChecklist).toHaveBeenCalledWith('r1');
        if (finalize) expect(finalize.disabled).toBe(false);
        if (submit) expect(submit.disabled).toBe(false);
    });
});

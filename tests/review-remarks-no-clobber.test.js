// PC Connection, 23 Nov 2026: objective evidence written in Fix findings never
// reached the server. Every save run while the Review & Submit tab is drawn
// copied that tab's "Auditor Remarks" boxes, as drawn, back over each
// finding's remark, so the new text was reverted before the write. A save now
// takes from that tab only what was changed on it.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed', COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', FINALIZED: 'Finalized', PUBLISHED: 'Published' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } },
    NCR_COLORS: { major: '#dc2626', minor: '#d97706', observation: '#8b5cf6', ofi: '#0891b2' }
};

let report, upserts, save;

beforeEach(async () => {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), formatDate: d => String(d) };
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    globalThis.Sanitizer = window.Sanitizer = { sanitizeText: s => String(s ?? '') };
    window.KB_HELPERS = { resolveChecklistClause: (item) => ({ clauseText: item.clause || '', reqText: '' }), lookupKBRequirement: () => null };
    upserts = [];
    window.SupabaseClient = { db: { upsert: vi.fn(async (table, row) => { upserts.push({ table, row: JSON.parse(JSON.stringify(row)) }); return {}; }) } };
    window.persistNCR = vi.fn(async () => ({}));
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div class="tab-btn" data-tab="review"></div><div id="tab-content"></div>';
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });

    report = { id: 'r1', planId: 'nov', status: 'In Progress', checklistProgress: [
        { checklistId: 'cl1', itemIdx: 'SMS-2', status: 'nc', ncrType: 'minor', clause: '8.6.2', comment: 'Document Data Control issue' },
        { checklistId: 'cl1', itemIdx: 'RECERT-6', status: 'nc', ncrType: 'observation', clause: '9.3', comment: 'Meeting held' }
    ], ncrs: [] };
    window.state = { currentUser: { role: 'Lead Auditor' }, auditPlans: [], ncrs: [], clients: [], auditReports: [report] };
    globalThis.state = window.state;
    window.__renderExecutionTab(report, 'review', { assignedChecklists: [] });
    await new Promise(r => setTimeout(r, 150)); // the tab binds its handlers after 100 ms
    save = window.saveChecklist;
});

const sentItem = (idx) => upserts.filter(u => u.table === 'audit_reports').pop().row.checklist_progress[idx];
const flush = () => new Promise(r => setTimeout(r, 0));

describe('saving while Review & Submit is drawn', () => {
    it('keeps a remark changed elsewhere (Fix findings) instead of the text the tab was drawn with', async () => {
        expect(document.querySelector('.review-remarks[data-finding-id="checklist-0"]')).not.toBeNull();
        report.checklistProgress[0].comment = 'In ServiceNow, 14 of 18 requests sampled were past due.';
        save('r1');
        await flush();
        expect(report.checklistProgress[0].comment).toBe('In ServiceNow, 14 of 18 requests sampled were past due.');
        expect(sentItem(0).comment).toBe('In ServiceNow, 14 of 18 requests sampled were past due.');
    });

    it('keeps a classification changed elsewhere', async () => {
        report.checklistProgress[1].ncrType = 'ofi';
        save('r1');
        await flush();
        expect(sentItem(1).ncrType).toBe('ofi');
    });

    it('still writes a remark the auditor edited on this tab', async () => {
        const box = document.querySelector('.review-remarks[data-finding-id="checklist-1"]');
        box.value = 'Meeting held; no schedule for the next one.';
        save('r1');
        await flush();
        expect(sentItem(1).comment).toBe('Meeting held; no schedule for the next one.');
    });

    it('still writes a classification picked on this tab', async () => {
        const select = document.querySelector('.review-severity[data-finding-id="checklist-1"]');
        select.value = 'ofi';
        save('r1');
        await flush();
        expect(sentItem(1).ncrType).toBe('ofi');
    });

    it('keeps an executive summary saved elsewhere (Report Preview) instead of the box as drawn', async () => {
        const box = document.getElementById('exec-summary-r1');
        expect(box).not.toBeNull();
        report.executiveSummary = 'The audit identified 5 minor nonconformities.';
        save('r1');
        await flush();
        expect(upserts.filter(u => u.table === 'audit_reports').pop().row.data.executiveSummary).toBe('The audit identified 5 minor nonconformities.');
    });

    it('still writes an executive summary edited in its box on this tab', async () => {
        const box = document.getElementById('exec-summary-r1');
        box.value = 'Typed on the Review tab.';
        save('r1');
        await flush();
        expect(upserts.filter(u => u.table === 'audit_reports').pop().row.data.executiveSummary).toBe('Typed on the Review tab.');
    });

    it('leaving a remarks box without editing it does not write the drawn text back', async () => {
        report.checklistProgress[0].comment = 'New evidence from Fix findings.';
        const box = document.querySelector('.review-remarks[data-finding-id="checklist-0"]');
        box.dispatchEvent(new Event('blur'));
        await flush();
        expect(report.checklistProgress[0].comment).toBe('New evidence from Fix findings.');
    });
});

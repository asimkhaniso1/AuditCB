// The Review & Submit box beside each finding was labelled "Auditor Remarks /
// Notes" with a "Justification or internal notes..." placeholder, but it edits
// the checklist item's note (checklist finding) or the finding's description
// (manual finding), and both print in the report. The label must say so.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', CLOSED: 'Closed', COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', FINALIZED: 'Finalized', PUBLISHED: 'Published' },
    NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } },
    NCR_COLORS: { major: '#dc2626', minor: '#d97706', observation: '#8b5cf6', ofi: '#0891b2' }
};

beforeEach(async () => {
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), formatDate: d => String(d) };
    window.showNotification = vi.fn();
    window.saveData = vi.fn();
    globalThis.Sanitizer = window.Sanitizer = { sanitizeText: s => String(s ?? '') };
    window.KB_HELPERS = { resolveChecklistClause: (item) => ({ clauseText: item.clause || '', reqText: '' }), lookupKBRequirement: () => null };
    window.SupabaseClient = { db: { upsert: vi.fn(async () => ({})) } };
    window.persistNCR = vi.fn(async () => ({}));
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div class="tab-btn" data-tab="review"></div><div id="tab-content"></div>';
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });

    const report = { id: 'r1', planId: 'p1', status: 'In Progress', checklistProgress: [
        { checklistId: 'cl1', itemIdx: 'A-1', status: 'nc', ncrType: 'minor', clause: '10.2', comment: 'Findings from the previous audit were reviewed.' }
    ], ncrs: [{ type: 'observation', description: 'Training records incomplete.' }] };
    window.state = { currentUser: { role: 'Lead Auditor' }, auditPlans: [], ncrs: [], clients: [], auditReports: [report] };
    globalThis.state = window.state;
    window.__renderExecutionTab(report, 'review', { assignedChecklists: [] });
    await new Promise(r => setTimeout(r, 150));
});

const labelFor = (id) => document.querySelector(`label[for="review-remarks-${id}"]`);

describe('Review & Submit text box beside each finding', () => {
    it('is labelled as the checklist note for a checklist finding, and says it prints', () => {
        const box = document.querySelector('.review-remarks[data-finding-id="checklist-0"]');
        expect(box.id).toBe('review-remarks-checklist-0');
        expect(box.value).toBe('Findings from the previous audit were reviewed.');
        expect(labelFor('checklist-0').textContent).toMatch(/Checklist note/);
        expect(labelFor('checklist-0').textContent).toMatch(/prints in report/);
    });

    it('is labelled as the finding description for a manual finding', () => {
        const box = document.querySelector('.review-remarks[data-finding-id="ncr-0"]');
        expect(box.value).toBe('Training records incomplete.');
        expect(labelFor('ncr-0').textContent).toMatch(/Finding description/);
    });

    it('no longer invites internal notes', () => {
        const html = document.getElementById('tab-content').innerHTML;
        expect(html).not.toMatch(/Auditor Remarks/);
        expect(html).not.toMatch(/internal notes/i);
    });
});

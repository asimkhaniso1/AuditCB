// Checklist autosave (PC Connection audit, 2026-11-17). The checklist kept
// every status, remark and personnel pick on screen until Save Progress, so a
// reload, a closed tab or leaving the page lost them. Changes now save a few
// seconds after the last one, and at once before the checklist is left.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
const SRC = fs.readFileSync(path.resolve('./execution-module-v2.js'), 'utf8');
const EV = fs.readFileSync(path.resolve('./execution-evidence.js'), 'utf8');

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na' },
    NCR_TYPES: { PENDING: 'pending', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

let save;
beforeEach(() => {
    vi.useFakeTimers();
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], currentUser: { role: 'Lead Auditor' } };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<button class="tab-btn" data-tab="ncr">Findings</button><div id="tab-content"></div>';
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    const checklist = { id: 'cl1', name: 'Checklist', clauses: [
        { mainClause: 'IMS', title: 'Common', subClauses: [{ clause: '7.5', requirement: 'Documented information' }, { clause: '9.2', requirement: 'Internal audit' }] }
    ] };
    window.__renderExecutionTab({ id: 'r1', checklistProgress: [] }, 'checklist', { assignedChecklists: [checklist], progressMap: {} });
    vi.advanceTimersByTime(200); // post-render setup (binds autosave)
    save = vi.fn();
    window.saveChecklist = save; // rendering defines the real one; stand it in after
});
afterEach(() => { vi.useRealTimers(); });

describe('checklist autosave', () => {
    it('saves quietly a few seconds after the last edit, once for a burst of typing', () => {
        const remark = document.getElementById('comment-cl1-IMS-0');
        for (const v of ['a', 'ab', 'abc']) { remark.value = v; remark.dispatchEvent(new Event('input', { bubbles: true })); vi.advanceTimersByTime(1000); }
        expect(save).not.toHaveBeenCalled();
        vi.advanceTimersByTime(window.ChecklistAutoSave.DELAY);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith('r1', { quiet: true });
    });

    it('a status button schedules a save', () => {
        window.setChecklistStatus('cl1-IMS-1', 'conform');
        expect(window.ChecklistAutoSave.isPending()).toBe(true);
        vi.advanceTimersByTime(window.ChecklistAutoSave.DELAY);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('leaving for another tab saves at once, while the checklist is still on screen', () => {
        window.setChecklistStatus('cl1-IMS-0', 'nc');
        document.querySelector('.tab-btn[data-tab="ncr"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(save).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(window.ChecklistAutoSave.DELAY);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('does nothing once the checklist is no longer on screen', () => {
        window.setChecklistStatus('cl1-IMS-0', 'conform');
        document.getElementById('tab-content').innerHTML = '<p>Another tab</p>';
        vi.advanceTimersByTime(window.ChecklistAutoSave.DELAY);
        expect(save).not.toHaveBeenCalled();
    });
});

describe('quiet saves and other triggers', () => {
    it('Save Progress still confirms; autosave does not pop up', () => {
        expect(SRC).toContain("if (!quiet) window.showNotification('Audit progress saved to cloud', 'success');");
    });
    it('evidence attached or removed and AI Auto Map schedule a save', () => {
        expect((EV.match(/window\.ChecklistAutoSave\.schedule\(\)/g) || []).length).toBeGreaterThanOrEqual(4);
        expect(SRC).toContain('if (mapped && window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();');
    });
});

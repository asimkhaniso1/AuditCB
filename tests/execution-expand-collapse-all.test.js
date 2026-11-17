// Expand All / Collapse All on the audit execution checklist (PC Connection,
// 2026-11-17). Two faults:
//  1. Each checklist row closed one <div> too many: the NC panel ended after
//     Severity, so the nonconformity statement and personnel fields showed on
//     every item whatever its status, and the stray </div> closed the clause
//     section after its first item, so the rest of a section's items stood
//     outside it and Collapse All could not hide them.
//  2. The button decided from its own label, which started as "Collapse All"
//     while only the first section was open and went stale after a section was
//     opened by hand; Collapse All also set every NC panel to display:none, so
//     Expand All brought the sections back with each NC's Finding Details gone.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

const CONSTANTS = {
    STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na' },
    NCR_TYPES: { PENDING: 'pending', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
    NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
};

function render() {
    loadScript('./csp-adapters.js', { params: { module: undefined } });
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    const checklist = {
        id: 'cl1', name: 'Recertification checklist',
        clauses: [
            { mainClause: 'RECERT', title: 'Recertification priorities', subClauses: [{ clause: '6.3', requirement: 'Changes' }, { clause: '6.2', requirement: 'Objectives' }, { clause: '9.2', requirement: 'Internal audit' }] },
            { mainClause: '7', title: 'Support', subClauses: [{ clause: '7.5', requirement: 'Documented information' }, { clause: '7.2', requirement: 'Competence' }] },
            { mainClause: '8', title: 'Operation', subClauses: [{ clause: '8.1', requirement: 'Operational planning' }] }
        ]
    };
    const progressMap = { 'cl1-RECERT-2': { status: 'nc', ncrDescription: 'No ISO 22301 internal audit report.' } };
    window.__renderExecutionTab({ id: 'r1', checklistProgress: [] }, 'checklist', { assignedChecklists: [checklist], progressMap });
}

const sections = () => Array.from(document.querySelectorAll('.accordion-section > .accordion-content'));
const label = () => document.querySelector('#toggle-all-accordions span').textContent;
const shown = el => !el.closest('[style*="display: none"]');

beforeEach(async () => {
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [], currentUser: { role: 'Lead Auditor' } };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.CONSTANTS = CONSTANTS;
    window.UTILS = { escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = '<div id="tab-content"></div>';
    render();
    await new Promise(r => setTimeout(r, 0)); // the render finishes its setup on the next tick
});

describe('checklist row markup', () => {
    it('every item sits inside its clause section', () => {
        const counts = sections().map(s => s.querySelectorAll('.checklist-item').length);
        expect(counts).toEqual([3, 2, 1]);
        expect(document.querySelectorAll('.checklist-item').length).toBe(6);
    });

    it('the nonconformity statement and personnel fields are inside the NC panel', () => {
        document.querySelectorAll('.checklist-item').forEach(row => {
            const id = row.id.replace('row-', '');
            const panel = document.getElementById('ncr-panel-' + id);
            expect(panel.contains(document.getElementById('ncr-desc-' + id))).toBe(true);
            expect(panel.contains(document.getElementById('ncr-personnel-' + id))).toBe(true);
        });
        // only the NC item shows them
        const visibleStatements = Array.from(document.querySelectorAll('textarea[id^="ncr-desc-"]')).filter(t => t.closest('.ncr-panel').style.display !== 'none');
        expect(visibleStatements.map(t => t.id)).toEqual(['ncr-desc-cl1-RECERT-2']);
    });
});

describe('Expand All / Collapse All', () => {
    it('starts as "Expand All" when only the first section is open', () => {
        expect(sections().map(s => s.style.display)).toEqual(['block', 'none', 'none']);
        expect(label()).toBe('Expand All');
    });

    it('expands every section, then collapses every item', () => {
        window.toggleAllAccordions();
        expect(sections().every(s => s.style.display === 'block')).toBe(true);
        expect(label()).toBe('Collapse All');

        window.toggleAllAccordions();
        expect(sections().every(s => s.style.display === 'none')).toBe(true);
        expect(Array.from(document.querySelectorAll('.checklist-item')).some(shown)).toBe(false);
        expect(label()).toBe('Expand All');
    });

    it('an NC item keeps its Finding Details through Collapse All and Expand All', () => {
        window.toggleAllAccordions(); // expand
        window.toggleAllAccordions(); // collapse
        window.toggleAllAccordions(); // expand
        const panel = document.getElementById('ncr-panel-cl1-RECERT-2');
        expect(panel.style.display).toBe('block');
        expect(shown(document.getElementById('ncr-desc-cl1-RECERT-2'))).toBe(true);
    });

    it('follows sections opened or closed by hand', () => {
        window.toggleAccordion('clause-cl1-7');
        window.toggleAccordion('clause-cl1-8');
        expect(label()).toBe('Collapse All'); // all three are open now
        window.toggleAccordion('clause-cl1-RECERT');
        expect(label()).toBe('Expand All');
        window.toggleAllAccordions();
        expect(sections().every(s => s.style.display === 'block')).toBe(true);
    });

    it('turns each chevron with its section', () => {
        const icon = id => document.getElementById('icon-' + id).style.transform;
        expect(icon('clause-cl1-RECERT')).toBe('rotate(180deg)');
        expect(icon('clause-cl1-7')).toBe('rotate(0deg)');
        window.toggleAllAccordions();
        expect(icon('clause-cl1-7')).toBe('rotate(180deg)');
    });
});

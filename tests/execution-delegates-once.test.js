// renderExecutionTab runs on every execution tab click and used to add four
// document-level click listeners each time, so after visiting N tabs one
// click on a bulk action ran bulkUpdateStatus N times. That is not just slow:
// the first call clears the selection, so the repeats re-applied the status to
// every visible checklist item. The delegates must be bound exactly once.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

function loadExecutionModule() {
    // Plain-script evaluation (no CommonJS), exposing the top-level declaration.
    // eslint-disable-next-line no-new-func
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    return window.__renderExecutionTab;
}

beforeEach(() => {
    window.state = { auditReports: [], ncrs: [], clients: [], auditPlans: [] };
    globalThis.state = window.state;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    // Declared by execution-list.js, which loads first in index.html.
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) {
        globalThis[name] = window[name] = vi.fn();
    }
    document.body.innerHTML = `
        <div id="tab-content"></div>
        <div id="bulk-menu-1734000000000">
            <button class="bulk-action-btn" data-action="nc" data-report-id="1734000000000">NC</button>
        </div>
        <button class="status-btn" data-unique-id="u1" data-status="conform">OK</button>`;
});

describe('execution tab document delegates', () => {
    it('two renders produce one bulk-action handler call per click', () => {
        const renderExecutionTab = loadExecutionModule();
        const report = { id: '1734000000000', checklistProgress: [] };
        renderExecutionTab(report, 'no-such-tab', {});
        renderExecutionTab(report, 'no-such-tab', {});

        // The renders re-assign window.* helpers; stub after they ran.
        window.bulkUpdateStatus = vi.fn();
        window.setChecklistStatus = vi.fn();

        document.querySelector('.bulk-action-btn').click();
        expect(window.bulkUpdateStatus).toHaveBeenCalledTimes(1);
        // Report ids stay strings: parseInt turned UUID ids into NaN.
        expect(window.bulkUpdateStatus).toHaveBeenCalledWith('1734000000000', 'nc');

        document.querySelector('.status-btn').click();
        expect(window.setChecklistStatus).toHaveBeenCalledTimes(1);
    });

    it('does not bind again when the module script is evaluated twice', () => {
        const first = loadExecutionModule();
        first({ id: 'r' }, 'no-such-tab', {});
        const second = loadExecutionModule();
        second({ id: 'r' }, 'no-such-tab', {});

        window.bulkUpdateStatus = vi.fn();
        document.querySelector('.bulk-action-btn').click();
        expect(window.bulkUpdateStatus).toHaveBeenCalledTimes(1);
    });
});

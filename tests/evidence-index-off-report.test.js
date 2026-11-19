// Generating PC Connection's report put a 19 MB evidence index (210 embedded
// screenshots) on the report record as report._evidenceIndexBuilt. Every save
// after that sent it to the database's `data` column and timed out (Postgres
// 57014, "canceling statement due to statement timeout"), so checklist work
// stayed only in the browser behind a "Partial save" warning (2026-11-19).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

describe('a checklist save never sends the index', () => {
    beforeEach(() => {
        window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        window.CONSTANTS = {
            STATUS: { CONFORM: 'conform', NC: 'nc', NA: 'na', NOT_SAMPLED: 'not_sampled', CLOSED: 'Closed', IN_REVIEW: 'In Review' },
            NCR_TYPES: { PENDING: 'pending_classification', OBSERVATION: 'observation', OFI: 'ofi', MINOR: 'minor', MAJOR: 'major' },
            NCR_CRITERIA: { MAJOR: { description: 'major' }, MINOR: { description: 'minor' } }
        };
        window.UTILS = require('../utils.js');
        for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
        loadScript('./sanitization.js', { params: { module: undefined } });
        loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    });

    it('the upserted data has no _evidenceIndexBuilt, even when the report in memory carries one', async () => {
        const report = { id: 'r1', client: 'PC', checklistProgress: [{ checklistId: 'cl1', itemIdx: 'A-0', status: 'not_sampled' }], _evidenceIndexBuilt: [{ image: 'data:image/jpeg;base64,AAAA' }] };
        window.state = { auditReports: [report], checklists: [], ncrs: [], clients: [], cbSettings: {} };
        globalThis.state = window.state;
        const upsert = vi.fn(async () => ({}));
        window.SupabaseClient = { db: { upsert } };
        window.showNotification = vi.fn();
        window.saveData = vi.fn();
        window.ChecklistMerge.fetchRemote = vi.fn(async () => null);
        // saveChecklist is defined while a tab renders; render one off-screen,
        // then clear it so the save writes checklistProgress as it is.
        document.body.innerHTML = '<div id="tab-content"></div>';
        vi.useFakeTimers();
        window.__renderExecutionTab(report, 'checklist', { assignedChecklists: [], progressMap: {}, customItems: [] });
        vi.runAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        window.saveChecklist('r1', { quiet: true });
        await vi.waitFor(() => expect(upsert).toHaveBeenCalled());
        const payload = upsert.mock.calls[0][1];
        expect(payload.data._evidenceIndexBuilt).toBeUndefined();
        expect(JSON.stringify(payload.data)).not.toContain('_evidenceIndexBuilt');
        // The report in memory keeps it until the next report run replaces it.
        expect(report._evidenceIndexBuilt).toHaveLength(1);
        expect(payload.checklist_progress[0].status).toBe('not_sampled');
    });
});

describe('every full-report write drops the index', () => {
    it('no `data: report` writes remain', () => {
        for (const f of ['execution-module-v2.js', 'ai-service.js']) {
            const src = fs.readFileSync(f, 'utf8');
            expect(src).not.toMatch(/data: report( \|\| \{\})?\s*[,}\n]/);
        }
    });

    it('the report generator keeps the index beside the report, never on it', () => {
        const src = fs.readFileSync('execution-reporting.js', 'utf8');
        expect(src).not.toMatch(/report\._evidenceIndexBuilt = /);
        expect(src).toContain('evidenceIndexByReport[String(report.id)] = _evIndex;');
        expect(src).not.toMatch(/d\.report\._evidenceIndexBuilt/);
    });
});

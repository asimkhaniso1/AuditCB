// Polish Notes with AI filled every Conform row without a remark with AI text
// written from the requirement alone. The AI never saw the screenshots or the
// auditor's notes, and its prompt asked it to "be specific about the evidence",
// so it described reviews and interviews nobody recorded (PC Connection,
// 2026-11-19). Those rows are now left for the auditor, and the report states
// what was recorded: the screenshots on the row.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

beforeAll(() => {
    loadScript('./utils.js', { global: true });
    globalThis.openCreateReportModal = () => { };
    globalThis.openEditReportModal = () => { };
    loadScript('./report-stats.js', { global: true });
    loadScript('./execution-reporting.js', { global: true });
});

describe('a row with no written remark', () => {
    const text = (item) => {
        const el = document.createElement('div');
        el.innerHTML = window._noRemarkHtml(item);
        return el.textContent;
    };

    it('says how many screenshots were recorded instead of "No remarks recorded"', () => {
        expect(text({ evidenceImages: ['a', 'b', 'c'] })).toBe('No written remark; 3 screenshots of the evidence attached.');
        expect(text({ evidenceImage: 'a' })).toBe('No written remark; 1 screenshot of the evidence attached.');
    });

    it('still says "No remarks recorded" when there is nothing at all', () => {
        expect(text({})).toBe('No remarks recorded.');
        expect(text({ evidenceImages: ['', null] })).toBe('No remarks recorded.');
    });
});

describe('Polish Notes with AI', () => {
    beforeEach(() => {
        window.state = { auditReports: [], clients: [], auditPlans: [] };
        document.body.innerHTML = '<button id="ai-polish-btn">Polish Notes with AI</button>';
        window.showNotification = vi.fn();
        window.AI_SERVICE = {
            generateConformanceText: vi.fn(async (f) => f.map(x => ({ ...x, comment: 'Invented evidence.', _aiGenerated: true }))),
            refineAuditNotes: vi.fn(async (items) => items.map(i => (i.comment ? { ...i, comment: 'Polished: ' + i.comment, _originalComment: i.comment } : i))),
            callProxyAPI: vi.fn(async () => 'Conclusion.')
        };
        window._reportPreviewData = {
            report: { id: 'r1', standard: 'ISO/IEC 27001:2022', checklistProgress: [], ncrs: [] },
            auditPlan: {},
            hydratedProgress: [
                { clause: '6.1.3', status: 'conform', comment: '', requirement: 'Confirm the SoA is current.', evidenceImages: ['a', 'b', 'c'] },
                { clause: 'A.5.15', status: 'conform', comment: 'Background screening check HR, access grant service desk' }
            ],
            stats: { ncCount: 0, observationCount: 0, ofiCount: 0, complianceScore: 100 }
        };
    });

    it('never writes a remark for an empty row, and polishes the ones written', async () => {
        await window.polishNotesWithAI();
        const hp = window._reportPreviewData.hydratedProgress;
        expect(window.AI_SERVICE.generateConformanceText).not.toHaveBeenCalled();
        expect(hp[0].comment).toBe('');
        expect(hp[0]._aiGenerated).toBeUndefined();
        expect(hp[1].comment).toBe('Polished: Background screening check HR, access grant service desk');
    });

    it('tells the auditor how many Conform rows still need a remark', async () => {
        await window.polishNotesWithAI();
        const msg = window.showNotification.mock.calls.map(c => c[0]).find(m => /AI polished/.test(m));
        expect(msg).toBe("AI polished 1 auditor note. 1 Conform row has no remark; Polish doesn't write evidence, so add a line in the checklist for it.");
    });
});

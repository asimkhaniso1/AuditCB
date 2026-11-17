// Voice dictation into checklist remarks (PC Connection audit, 2026-11-17):
// "it's listening but nothing is saved".
//  - The mic button is wired to startDictation through the delegator, and a
//    separate stop listener was added to the same button, so the stop click
//    stopped the session and started a new one: it kept listening.
//  - The transcript was written into the box by code, which raises no input
//    event, so autosave never saw it.
//  - With an empty box the live preview re-appended earlier words each update.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

globalThis.window = globalThis.window || globalThis;

class FakeRecognition {
    constructor() { FakeRecognition.instances.push(this); this.started = false; this.stopped = false; }
    start() { this.started = true; }
    stop() { this.stopped = true; Promise.resolve().then(() => this.onend && this.onend()); }
    say(...chunks) {
        // chunks: [text, isFinal]
        const results = chunks.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f }));
        this.onresult({ resultIndex: 0, results });
    }
}
FakeRecognition.instances = [];

beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    window.SpeechRecognition = FakeRecognition;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.showNotification = vi.fn();
    window.UTILS = { escapeHtml: s => String(s ?? '') };
    window.state = { auditReports: [], ncrs: [] };
    globalThis.state = window.state;
    for (const name of ['renderAuditExecutionEnhanced', 'renderExecutionDetail']) globalThis[name] = window[name] = vi.fn();
    document.body.innerHTML = `<div class="checklist-item"><input id="comment-x1" value="Seen the register."><button id="mic-btn-x1" data-action="startDictation" data-id="x1"></button></div>`;
    // startDictation is defined inside renderExecutionTab's helper block; render once to define it.
    loadScript('./execution-module-v2.js', { params: { module: undefined }, append: '\nwindow.__renderExecutionTab = renderExecutionTab;' });
    document.body.insertAdjacentHTML('beforeend', '<div id="tab-content"></div>');
    window.CONSTANTS = { STATUS: {}, NCR_TYPES: {}, NCR_CRITERIA: { MAJOR: {}, MINOR: {} } };
    window.__renderExecutionTab({ id: 'r1' }, 'none', {}); // defines the helpers, draws nothing
    window.ChecklistAutoSave = { schedule: vi.fn() };
});
afterEach(() => { vi.useRealTimers(); delete window.SpeechRecognition; });

describe('dictation', () => {
    it('the same button stops the session instead of starting another', async () => {
        window.startDictation('x1');
        expect(FakeRecognition.instances).toHaveLength(1);
        window.startDictation('x1'); // the stop click
        expect(FakeRecognition.instances).toHaveLength(1);
        expect(FakeRecognition.instances[0].stopped).toBe(true);
        await Promise.resolve();
        window.startDictation('x1'); // a new click after it ended starts again
        expect(FakeRecognition.instances).toHaveLength(2);
    });

    it('adds the transcript after the existing remark, without repeating words while speaking', async () => {
        const box = document.getElementById('comment-x1');
        box.value = '';
        window.startDictation('x1');
        const rec = FakeRecognition.instances[0];
        rec.say(['restore test', false]);
        expect(box.value).toBe('restore test');
        rec.say(['restore test done in October', false]);
        expect(box.value).toBe('restore test done in October');
        rec.say(['restore test done in October', true]);
        window.startDictation('x1');
        await Promise.resolve();
        expect(box.value).toBe('restore test done in October');
    });

    it('keeps typed text and announces the change so autosave saves it', async () => {
        const box = document.getElementById('comment-x1');
        const onInput = vi.fn();
        box.addEventListener('input', onInput);
        window.startDictation('x1');
        FakeRecognition.instances[0].say(['backup logs reviewed monthly', true]);
        window.startDictation('x1');
        await Promise.resolve();
        expect(box.value).toBe('Seen the register. backup logs reviewed monthly');
        expect(onInput).toHaveBeenCalled();
        expect(window.ChecklistAutoSave.schedule).toHaveBeenCalled();
    });

    it('says how to unblock the microphone', () => {
        window.startDictation('x1');
        FakeRecognition.instances[0].onerror({ error: 'not-allowed' });
        expect(window.showNotification.mock.calls[0][0]).toMatch(/Microphone blocked/);
        expect(window._dictationSessions.x1).toBeUndefined();
    });

    it('stops after 60 seconds and says so', () => {
        window.startDictation('x1');
        vi.advanceTimersByTime(60000);
        expect(FakeRecognition.instances[0].stopped).toBe(true);
        expect(window.showNotification.mock.calls[0][0]).toMatch(/60 seconds/);
    });
});

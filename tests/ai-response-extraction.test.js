// AI_SERVICE.extractTextFromResponse failure-mode tests.
//
// Root cause under test: a 200-OK Gemini response with no usable text is not
// one failure mode, it's several (prompt blocked, candidate cut off at the
// output token limit, candidate filtered, unexpected payload shape) — and the
// old implementation collapsed all of them into a single generic
// "No content returned from AI" Error, which is what made a real production
// failure (execution-reporting.js's window.polishNotesWithAI swallowing the
// AI conclusion-generation error as "(continuing)") undiagnosable from the
// console. Each distinguishable case must now throw an Error with a stable
// `.code` the caller can react to, and the success path must keep returning
// a plain string unchanged (extractTextFromResponse has several other
// callers — see ai-service.js callProxyAPI).
import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const fs = await import('fs');
const path = await import('path');

function loadModule(file) {
    const src = fs.readFileSync(path.resolve(file), 'utf8');
    // Shadow Vite/vitest's CJS-interop `module` binding so the eval'd file's
    // own `if (typeof module !== 'undefined' && module.exports) {...}` tail
    // guard is false here, exactly as it is in the browser.
    // eslint-disable-next-line no-unused-vars
    const module = undefined;
    eval(src);
}

loadModule('./ai-service.js');

const extractTextFromResponse = window.AI_SERVICE.extractTextFromResponse;

// Runs fn and returns the Error it threw (or null if it didn't throw), so
// each test can assert on `.code`/`.message` without a try/catch per case.
function captureError(fn) {
    try {
        fn();
        return null;
    } catch (err) {
        return err;
    }
}

describe('AI_SERVICE.extractTextFromResponse', () => {
    describe('success path (return shape must stay a plain string)', () => {
        it('returns the text of the first candidate on a normal STOP response', () => {
            const data = {
                candidates: [
                    { content: { parts: [{ text: 'Hello world' }] }, finishReason: 'STOP' }
                ]
            };
            const result = extractTextFromResponse(data);
            expect(result).toBe('Hello world');
            expect(typeof result).toBe('string');
        });

        it('returns the text even when finishReason is absent', () => {
            const data = { candidates: [{ content: { parts: [{ text: 'Fine.' }] } }] };
            expect(extractTextFromResponse(data)).toBe('Fine.');
        });
    });

    describe('MAX_TOKENS — candidate cut off before producing usable text', () => {
        it('is coded MAX_TOKENS when parts is an empty array', () => {
            const data = {
                candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }]
            };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err).toBeInstanceOf(Error);
            expect(err.code).toBe('MAX_TOKENS');
            expect(err.message).toMatch(/output token limit/i);
        });

        it('is coded MAX_TOKENS when content is entirely absent (all budget spent on thinking)', () => {
            // Gemini "thinking" models (gemini-2.5/3.5 family — see api/gemini.js's
            // legacy-model remap) can omit `content` altogether when the whole
            // token budget was consumed by internal reasoning before any visible
            // output was written.
            const data = { candidates: [{ finishReason: 'MAX_TOKENS' }] };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('MAX_TOKENS');
        });

        it('is coded MAX_TOKENS when text is present but an empty string', () => {
            const data = {
                candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'MAX_TOKENS' }]
            };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('MAX_TOKENS');
        });
    });

    describe('BLOCKED — candidate or prompt filtered', () => {
        it('is coded BLOCKED with the reason named for a SAFETY finishReason', () => {
            const data = { candidates: [{ finishReason: 'SAFETY' }] };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('BLOCKED');
            expect(err.message).toMatch(/SAFETY/);
        });

        it('is coded BLOCKED for a RECITATION finishReason', () => {
            const data = { candidates: [{ finishReason: 'RECITATION' }] };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('BLOCKED');
            expect(err.message).toMatch(/RECITATION/);
        });

        it('is coded BLOCKED for any other non-STOP finishReason (e.g. OTHER)', () => {
            const data = { candidates: [{ finishReason: 'OTHER' }] };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('BLOCKED');
            expect(err.message).toMatch(/OTHER/);
        });

        it('is coded BLOCKED when the whole prompt was rejected (promptFeedback.blockReason, no candidates)', () => {
            const data = { promptFeedback: { blockReason: 'SAFETY' } };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('BLOCKED');
            expect(err.message).toMatch(/SAFETY/);
        });
    });

    describe('EMPTY_RESPONSE — no candidates and no block reason given', () => {
        it('is coded EMPTY_RESPONSE for a genuinely empty candidates array', () => {
            const data = { candidates: [] };
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('EMPTY_RESPONSE');
        });

        it('is coded EMPTY_RESPONSE when candidates is missing entirely', () => {
            const data = {};
            const err = captureError(() => extractTextFromResponse(data));
            expect(err.code).toBe('EMPTY_RESPONSE');
        });
    });

    describe('UNEXPECTED_SHAPE — payload is not the candidates/content/parts shape at all', () => {
        it('is coded UNEXPECTED_SHAPE for a null payload', () => {
            const err = captureError(() => extractTextFromResponse(null));
            expect(err.code).toBe('UNEXPECTED_SHAPE');
        });

        it('is coded UNEXPECTED_SHAPE for a non-object payload', () => {
            const err = captureError(() => extractTextFromResponse('not json'));
            expect(err.code).toBe('UNEXPECTED_SHAPE');
        });
    });
});

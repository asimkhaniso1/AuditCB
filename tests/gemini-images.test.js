// /api/gemini accepts evidence images (AI evidence explanation, phase 1):
// JPEG/PNG/WebP only, base64, at most 6, size-capped so a request stays under
// Vercel's ~4.5 MB body limit. A text-only call is unchanged.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, { imageParts, retryAfterSeconds } from '../api/gemini.js';

const b64 = (n) => 'A'.repeat(n);

describe('imageParts', () => {
    it('no images: no parts (text-only calls unchanged)', () => {
        expect(imageParts(undefined)).toEqual({ parts: [] });
        expect(imageParts(null)).toEqual({ parts: [] });
    });

    it('turns valid images into inline_data parts', () => {
        expect(imageParts([{ mimeType: 'image/jpeg', data: 'QUJD' }, { mimeType: 'IMAGE/PNG', data: 'REVG' }])).toEqual({ parts: [
            { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } },
            { inline_data: { mime_type: 'image/png', data: 'REVG' } }
        ] });
    });

    it('rejects other types, non-base64 data and data: URLs', () => {
        expect(imageParts([{ mimeType: 'application/pdf', data: 'QUJD' }]).status).toBe(400);
        expect(imageParts([{ mimeType: 'image/svg+xml', data: 'QUJD' }]).status).toBe(400);
        expect(imageParts([{ mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,QUJD' }]).status).toBe(400);
        expect(imageParts([{ mimeType: 'image/jpeg', data: '' }]).status).toBe(400);
        expect(imageParts('x').status).toBe(400);
    });

    it('caps the count, each image and the total', () => {
        expect(imageParts(Array.from({ length: 7 }, () => ({ mimeType: 'image/jpeg', data: 'QUJD' }))).status).toBe(413);
        expect(imageParts([{ mimeType: 'image/jpeg', data: b64(1_500_001) }]).status).toBe(413);
        expect(imageParts([1, 2, 3].map(() => ({ mimeType: 'image/jpeg', data: b64(1_200_000) }))).status).toBe(413);
        expect(imageParts([1, 2].map(() => ({ mimeType: 'image/jpeg', data: b64(1_200_000) }))).parts).toHaveLength(2);
    });
});

describe('the proxy request', () => {
    let sent;
    const res = () => {
        const r = { code: 0, body: null, headers: {} };
        r.status = (c) => { r.code = c; return r; };
        r.json = (b) => { r.body = b; return r; };
        r.end = () => r;
        r.setHeader = (k, v) => { r.headers[k] = v; };
        return r;
    };
    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'anon';
        sent = null;
        globalThis.fetch = vi.fn(async (url, opts) => {
            if (String(url).includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
            sent = JSON.parse(opts.body);
            return { ok: true, status: 200, json: async () => ({ candidates: [], usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 200, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 300 }, { modality: 'IMAGE', tokenCount: 1000 }] } }) };
        });
    });
    afterEach(() => { delete globalThis.fetch; });

    const req = (body) => ({ method: 'POST', headers: { authorization: 'Bearer t', origin: 'https://audit360.isoxpert.com' }, body });

    it('sends the images after the prompt, asks for JSON, and returns usage by modality', async () => {
        const r = res();
        await handler(req({ prompt: 'Explain.', model: 'gemini-2.0-flash', json: true, images: [{ mimeType: 'image/jpeg', data: 'QUJD' }] }), r);
        expect(r.code).toBe(200);
        expect(sent.contents[0].parts).toEqual([{ text: 'Explain.' }, { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } }]);
        expect(sent.generationConfig.responseMimeType).toBe('application/json');
        expect(r.body.model).toBe('gemini-2.5-flash-lite');
        expect(r.body.usage.promptTokensDetails).toEqual([{ modality: 'TEXT', tokenCount: 300 }, { modality: 'IMAGE', tokenCount: 1000 }]);
    });

    it('a text-only call is sent exactly as before', async () => {
        const r = res();
        await handler(req({ prompt: 'Hello', model: 'gemini-2.0-flash' }), r);
        expect(sent.contents[0].parts).toEqual([{ text: 'Hello' }]);
        expect(sent.generationConfig.responseMimeType).toBeUndefined();
    });

    // Live, 2026-11-21: a run of evidence requests was rejected for minutes
    // and the browser could not tell a rate limit from a bad request.
    it('a rejected request says whether it is worth trying again, never why in Gemini\'s words', async () => {
        const upstream = (status, body) => {
            globalThis.fetch = vi.fn(async (url) => (String(url).includes('/auth/v1/user')
                ? { ok: true, status: 200, json: async () => ({ id: 'u1' }) }
                : { ok: false, status, json: async () => body }));
        };
        upstream(429, { error: { message: 'Quota exceeded for key AIza-secret', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '26.4s' }] } });
        let r = res();
        await handler(req({ prompt: 'x', model: 'gemini-2.0-flash' }), r);
        expect(r.code).toBe(502);
        expect(r.body).toEqual({ error: 'AI model request failed', upstreamStatus: 429, busy: true, retryAfterSeconds: 27 });
        upstream(503, { error: { message: 'The model is overloaded.' } });
        r = res();
        await handler(req({ prompt: 'x', model: 'gemini-2.0-flash' }), r);
        expect(r.body).toEqual({ error: 'AI model request failed', upstreamStatus: 503, busy: true });
        upstream(400, { error: { message: 'Invalid argument' } });
        r = res();
        await handler(req({ prompt: 'x', model: 'gemini-2.0-flash' }), r);
        expect(r.body).toEqual({ error: 'AI model request failed', upstreamStatus: 400, busy: false });
    });

    it('the wait Gemini asks for is read from its reply and capped', () => {
        expect(retryAfterSeconds({ error: { details: [{ retryDelay: '5s' }] } })).toBe(5);
        expect(retryAfterSeconds({ error: { details: [{ retryDelay: '86400s' }] } })).toBe(300);
        expect(retryAfterSeconds({ error: { details: [{ retryDelay: 'soon' }] } })).toBe(0);
        expect(retryAfterSeconds({ error: {} })).toBe(0);
        expect(retryAfterSeconds(null)).toBe(0);
    });

    it('refuses bad images before calling the model', async () => {
        const r = res();
        await handler(req({ prompt: 'x', images: [{ mimeType: 'application/pdf', data: 'QUJD' }] }), r);
        expect(r.code).toBe(400);
        expect(sent).toBeNull();
    });
});

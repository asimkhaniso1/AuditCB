import { applyCors, requireUser } from './_auth.js';

// Map old/retired model names to current, valid v1beta models.
// gemini-2.0-flash, gemini-2.0-flash-lite, and gemini-1.5-flash were
// retired (June 2026 / earlier) — callers (e.g. ai-service.js) still
// request them in sequence as a fallback chain, so each legacy name is
// mapped to a distinct, currently-active replacement to preserve that
// chain's redundancy across model generations.
const MODEL_MAP = {
    'gemini-pro': 'gemini-2.5-flash',
    'gemini-1.5-flash': 'gemini-3.5-flash-lite',
    'gemini-1.5-flash-latest': 'gemini-3.5-flash-lite',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-1.5-pro-latest': 'gemini-2.5-pro',
    'gemini-2.0-flash': 'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite': 'gemini-2.5-flash'
};

// Only the models the map resolves to may be called. Anything else — including
// an arbitrary name a caller sends — is rejected so the key can't be spent on
// models (or model paths) we never chose.
const ALLOWED_MODELS = new Set(Object.values(MODEL_MAP));

const DEFAULT_MAX_TOKENS = 32768;
const MAX_TOKENS_CAP = 65536;
const MAX_PROMPT_CHARS = 1_000_000;

// Evidence images sent with a prompt (AI evidence explanation). Kept small:
// the caller downscales screenshots before sending, and Vercel caps a request
// body at about 4.5 MB.
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGES = 6;
const MAX_IMAGE_B64_CHARS = 1_500_000;
const MAX_IMAGES_B64_TOTAL = 3_500_000;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Validate body.images ([{ mimeType, data }], base64 without a data: prefix).
 * Returns { parts } for the request, or { error } for a 400/413.
 */
export function imageParts(images) {
    if (images == null) return { parts: [] };
    if (!Array.isArray(images)) return { error: 'images must be an array', status: 400 };
    if (images.length > MAX_IMAGES) return { error: `At most ${MAX_IMAGES} images per request`, status: 413 };
    let total = 0;
    const parts = [];
    for (const img of images) {
        const mimeType = img && String(img.mimeType || '').toLowerCase();
        const data = img && typeof img.data === 'string' ? img.data : '';
        if (!IMAGE_MIME_TYPES.has(mimeType)) return { error: 'Unsupported image type', status: 400 };
        if (!data || !BASE64_RE.test(data)) return { error: 'Image data must be base64', status: 400 };
        if (data.length > MAX_IMAGE_B64_CHARS) return { error: 'Image is too large', status: 413 };
        total += data.length;
        if (total > MAX_IMAGES_B64_TOTAL) return { error: 'Images are too large in total', status: 413 };
        parts.push({ inline_data: { mime_type: mimeType, data } });
    }
    return { parts };
}

// Gemini statuses that mean "try again later": rate limit, server error,
// model overloaded, upstream timeout.
const BUSY_STATUSES = new Set([429, 500, 503, 504]);

/**
 * Seconds Gemini asks the caller to wait (google.rpc.RetryInfo, "26s"), or 0.
 * Capped: a daily-quota answer can ask for hours.
 */
export function retryAfterSeconds(data) {
    const details = data && data.error && Array.isArray(data.error.details) ? data.error.details : [];
    for (const d of details) {
        const m = /^(\d+(?:\.\d+)?)s$/.exec(String((d && d.retryDelay) || ''));
        if (m) return Math.min(Math.ceil(Number(m[1])), 300);
    }
    return 0;
}

function resolveModel(requested) {
    const name = String(requested || 'gemini-2.0-flash');
    const mapped = MODEL_MAP[name] || name;
    return ALLOWED_MODELS.has(mapped) ? mapped : null;
}

function clampMaxTokens(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_TOKENS;
    return Math.min(n, MAX_TOKENS_CAP);
}

function clampTemperature(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.4;
    return Math.min(Math.max(n, 0), 2);
}

export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const user = await requireUser(req, res);
    if (!user) return;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const body = req.body || {};
    const { prompt, mode } = body;

    if (mode !== 'list') {
        if (typeof prompt !== 'string' || !prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
            return res.status(413).json({ error: 'Prompt is too large' });
        }
    }
    const imgs = mode === 'list' ? { parts: [] } : imageParts(body.images);
    if (imgs.error) {
        return res.status(imgs.status || 400).json({ error: imgs.error });
    }

    try {
        let url;
        let fetchOptions;

        if (mode === 'list') {
            url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            fetchOptions = {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            };
        } else {
            const modelName = resolveModel(body.model);
            if (!modelName) {
                return res.status(400).json({ error: 'Model not allowed' });
            }
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            // System-level guardrail applied to EVERY proxied call, regardless of
            // caller. Belt-and-suspenders alongside any per-prompt instructions
            // ai-service.js already includes — this is enforced server-side so it
            // can't be dropped by a caller that forgets to add its own rules.
            const GUARDRAIL_SYSTEM_INSTRUCTION = 'You assist certified-body auditors. Hard rules: '
                + '(1) Never state, estimate, or imply financial figures, revenue, penalties, contract values, customer loss, or reputational damage unless the exact figure appears in the user-provided input. '
                + '(2) Never assert certification decisions or recommendations — reproduce any provided recommendation wording verbatim. '
                + '(3) Never describe a finding as recurring, repeated, persistent, or systemic unless prior-audit records in the input demonstrate it. '
                + '(4) Never invent root causes, risk ratings, or maturity levels; where asked to draft such content, label it explicitly as a draft suggestion requiring auditor confirmation. '
                + '(5) Prefer plain, objective audit language: requirement, objective evidence, evaluation, finding.';

            fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: GUARDRAIL_SYSTEM_INSTRUCTION }]
                    },
                    contents: [{
                        parts: [{ text: prompt }].concat(imgs.parts)
                    }],
                    generationConfig: Object.assign({
                        maxOutputTokens: clampMaxTokens(body.maxTokens),
                        temperature: clampTemperature(body.temperature)
                    }, body.json === true ? { responseMimeType: 'application/json' } : {})
                })
            };
        }

        // Using native fetch (Node 18+)
        const response = await fetch(url, fetchOptions);

        const data = await response.json();

        if (!response.ok) {
            // Log the upstream detail server-side; the caller only needs to know
            // to try the next model in its fallback chain.
            console.error('Gemini upstream error:', response.status, data?.error?.message);
            // The status code (not Gemini's message) goes back too: a rate
            // limit or an overloaded model is worth waiting for and trying
            // again, a rejected request is not. Live, 2026-11-21, a run of
            // about 70 evidence requests was rejected for minutes at a time
            // and the caller could not tell why.
            return res.status(502).json(Object.assign(
                { error: 'AI model request failed', upstreamStatus: response.status, busy: BUSY_STATUSES.has(response.status) },
                retryAfterSeconds(data) ? { retryAfterSeconds: retryAfterSeconds(data) } : {}
            ));
        }

        if (mode === 'list') {
            // Only expose the models this proxy will actually call, so a
            // client-side "discover more models" fallback stays inside the allowlist.
            const models = (data.models || []).filter(m =>
                ALLOWED_MODELS.has(String(m.name || '').replace(/^models\//, ''))
            );
            return res.status(200).json({ models });
        }

        // Extract usage metadata if available
        const usageMetadata = data.usageMetadata || {
            promptTokenCount: 0,
            candidatesTokenCount: 0,
            totalTokenCount: 0
        };

        // Return data with usage metadata at top level for easy access, and the
        // model actually called (callers send a legacy name the map resolves).
        return res.status(200).json({
            ...data,
            usage: usageMetadata,
            model: resolveModel(body.model)
        });

    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

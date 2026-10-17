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
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        maxOutputTokens: clampMaxTokens(body.maxTokens),
                        temperature: clampTemperature(body.temperature)
                    }
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
            return res.status(502).json({ error: 'AI model request failed' });
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

        // Return data with usage metadata at top level for easy access
        return res.status(200).json({
            ...data,
            usage: usageMetadata
        });

    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

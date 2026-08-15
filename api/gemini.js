export default async function handler(req, res) {
    // CORS: restrict to same-origin or known deployment domains
    const allowedOrigins = [
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.CORS_ORIGIN || null,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000'
    ].filter(Boolean);
    const origin = req.headers.origin || '';
    const isAllowed = allowedOrigins.some(o => origin === o) || origin.endsWith('.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0] || '');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error: API Key not found' });
    }

    const { prompt, mode } = req.body;

    if (!prompt && mode !== 'list') {
        return res.status(400).json({ error: 'Prompt is required' });
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
            // Use the requested model or fallback to current stable model
            const requestedModel = req.body.model || 'gemini-2.0-flash';
            // Map old/retired model names to current, valid v1beta models.
            // gemini-2.0-flash, gemini-2.0-flash-lite, and gemini-1.5-flash were
            // retired (June 2026 / earlier) — callers (e.g. ai-service.js) still
            // request them in sequence as a fallback chain, so each legacy name is
            // mapped to a distinct, currently-active replacement to preserve that
            // chain's redundancy across model generations.
            const modelMap = {
                'gemini-pro': 'gemini-2.5-flash',
                'gemini-1.5-flash': 'gemini-3.5-flash-lite',
                'gemini-1.5-flash-latest': 'gemini-3.5-flash-lite',
                'gemini-1.5-pro': 'gemini-2.5-pro',
                'gemini-1.5-pro-latest': 'gemini-2.5-pro',
                'gemini-2.0-flash': 'gemini-2.5-flash-lite',
                'gemini-2.0-flash-lite': 'gemini-2.5-flash'
            };
            const modelName = modelMap[requestedModel] || requestedModel;
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
                        maxOutputTokens: req.body.maxTokens || 65536,
                        temperature: req.body.temperature ?? 0.4
                    }
                })
            };
        }

        // Using native fetch (Node 18+)
        const response = await fetch(url, fetchOptions);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API replied with an error');
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
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

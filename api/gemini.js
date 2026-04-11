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
            // Map old model names to current ones
            const modelMap = {
                'gemini-pro': 'gemini-2.0-flash',
                'gemini-1.5-flash': 'gemini-1.5-flash',
                'gemini-1.5-flash-latest': 'gemini-1.5-flash',
                'gemini-1.5-pro': 'gemini-1.5-pro',
                'gemini-1.5-pro-latest': 'gemini-1.5-pro',
                'gemini-2.0-flash': 'gemini-2.0-flash',
                'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite'
            };
            const modelName = modelMap[requestedModel] || requestedModel;
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
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

export default async function handler(req, res) {
    // CORS Headers for safety if called from different origin (optional but good practice)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

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
            // Default: Generate Content
            // Updated to gemini-1.5-flash-001 (specific version) to resolve "model not found"
            url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`;

            fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
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

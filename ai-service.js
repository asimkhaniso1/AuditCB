// ============================================
// AI SERVICE MODULE (GEMINI INTEGRATION)
// ============================================

const AI_SERVICE = {

    // Check if LOCAL API key is configured
    isConfigured: () => {
        return window.state && window.state.settings && window.state.settings.geminiApiKey;
    },

    // Main function to generate agenda
    generateAuditAgenda: async (planContext) => {
        const prompt = AI_SERVICE.buildPrompt(planContext);

        try {
            let apiResponseText;

            if (AI_SERVICE.isConfigured()) {
                // Option A: Use Local Key from Settings
                const apiKey = window.state.settings.geminiApiKey;
                apiResponseText = await AI_SERVICE.callDirectAPI(apiKey, prompt);
            } else {
                // Option B: Try Vercel Serverless Proxy (Env Var)
                console.log("No local API key found. Attempting to use server proxy...");
                apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            }

            return AI_SERVICE.parseAgendaResponse(apiResponseText);

        } catch (error) {
            console.error("AI Generation Error:", error);
            // Enhance error message for user
            if (error.message.includes('GEMINI_API_KEY')) {
                throw new Error("API Key missing. Please configure it in Settings OR add GEMINI_API_KEY to Vercel Environment Variables.");
            }
            throw error;
        }
    },

    // Construct the prompt based on plan details
    buildPrompt: (ctx) => {
        return `
You are an expert ISO Certification Body Lead Auditor. Create a detailed Audit Agenda/Itinerary (in valid JSON format) for the following audit plan.

**Audit Details:**
- Client: ${ctx.client}
- Standard(s): ${ctx.standard}
- Audit Type: ${ctx.type}
- Sites: ${ctx.sites.map(s => s.name).join(', ') || 'Main Site'}
- Total Man-Days: ${ctx.manDays}
- On-Site Days: ${ctx.onsiteDays}
- Audit Team: ${ctx.team.join(', ')}

**Requirements:**
1. Create a day-by-day schedule covering ${ctx.onsiteDays} days.
2. Include "Opening Meeting" (Day 1 AM) and "Closing Meeting" (Last Day PM).
3. Include "Lunch Break" (13:00-14:00) each day.
4. Assign specific auditors from the team to specific activities.
5. Cover specific ISO clauses relevant to ${ctx.standard}.
6. Ensure multiple sites are visited if applicable.
7. In the "Activity / Clause" column, you MUST include the Clause Number, Title, AND a brief summary of the standard requirement text (e.g., "5.1 Leadership: Top management shall demonstrate leadership and commitment...").
8. Times should be in "HH:MM - HH:MM" format.

**Output Format:**
Return ONLY a raw JSON array of objects. Do not include markdown formatting (like \`\`\`json).
Example:
[
  {"day": "Day 1", "time": "09:00 - 09:30", "item": "Opening Meeting", "dept": "Top Management", "auditor": "All Team"},
  {"day": "Day 1", "time": "09:30 - 10:30", "item": "Site Tour", "dept": "All", "auditor": "All Team"},
  ...
]
`;
    },

    // Option A: Call Gemini API directly (Client-side)
    callDirectAPI: async (apiKey, prompt) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Gemini API request failed');
        }

        const data = await response.json();
        return AI_SERVICE.extractTextFromResponse(data);
    },

    // Option B: Call Vercel Serverless Function
    callProxyAPI: async (prompt) => {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Server Proxy failed');
        }

        return AI_SERVICE.extractTextFromResponse(data);
    },

    // Helper: Extract text from Gemini JSON response
    extractTextFromResponse: (data) => {
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('No content returned from AI');
        }
    },

    // Parse the text response into JSON
    parseAgendaResponse: (text) => {
        // Clean up markdown code blocks if present
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const json = JSON.parse(cleanText);
            if (!Array.isArray(json)) throw new Error("AI response is not an array");
            return json;
        } catch (e) {
            console.error("JSON Parse Error. Raw Text:", text);
            throw new Error("Failed to parse AI response. Please try again.");
        }
    }
};

// Export to window
window.AI_SERVICE = AI_SERVICE;

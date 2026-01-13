// ============================================
// AI SERVICE MODULE (GEMINI INTEGRATION)
// ============================================

const AI_SERVICE = {

    // Main function to generate agenda
    generateAuditAgenda: async (planContext) => {
        const prompt = AI_SERVICE.buildPrompt(planContext);

        try {
            // ALWAYS use the server-side proxy for security
            // Client-side API keys are no longer supported
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            return AI_SERVICE.parseAgendaResponse(apiResponseText);

        } catch (error) {
            console.error("AI Generation Error:", error);
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

    // Call Vercel Serverless Function
    callProxyAPI: async (prompt) => {
        try {
            if (!window.navigator.onLine) {
                throw new Error('You appear to be offline. Please check your internet connection.');
            }

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                // Log failed API call
                if (window.APIUsageTracker) {
                    window.APIUsageTracker.logUsage({
                        feature: 'agenda-generation',
                        inputTokens: window.APIUsageTracker.estimateTokens(prompt),
                        outputTokens: 0,
                        success: false
                    });
                }
                throw new Error(data.error || 'AI Service Unavailable (Server Proxy)');
            }

            const data = await response.json();

            // Log successful API call with actual token usage
            if (window.APIUsageTracker) {
                const usage = data.usage || {};
                window.APIUsageTracker.logUsage({
                    feature: 'agenda-generation',
                    inputTokens: usage.promptTokenCount || window.APIUsageTracker.estimateTokens(prompt),
                    outputTokens: usage.candidatesTokenCount || 0,
                    success: true
                });
            }

            return AI_SERVICE.extractTextFromResponse(data);
        } catch (error) {
            console.error('Proxy API Error:', error);
            throw error; // Re-throw original error to preserve message
        }
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

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

    // ------------------------------------------------------------------
    // NEW: Smart Analysis Features
    // ------------------------------------------------------------------

    // 1. Auto-Classify Findings
    analyzeFindings: async (findings) => {
        if (!findings || findings.length === 0) return [];

        // Prepare simplified list for AI to save tokens
        const simplifedFindings = findings.map((f, idx) => ({
            id: idx,
            description: f.description,
            remarks: f.remarks || f.transcript || ''
        }));

        const prompt = `
You are a Lead Auditor. Classify the following audit findings based on ISO 19011 and ISO 17021 principles.
Determines if each finding is: "Major", "Minor", or "Observation".

Findings:
${JSON.stringify(simplifedFindings, null, 2)}

Return a raw JSON array of objects with 'id' and 'type' only.
Example: [{"id": 0, "type": "minor"}, {"id": 1, "type": "observation"}]
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            return AI_SERVICE.parseAgendaResponse(apiResponseText);
        } catch (error) {
            console.error("AI Analysis Error:", error);
            throw error;
        }
    },

    // 2. Draft Executive Summary
    draftExecutiveSummary: async (reportData) => {
        const ncCount = (reportData.ncrs || []).length + (reportData.checklistProgress || []).filter(i => i.status === 'nc').length;
        const prompt = `
Act as a professional ISO Lead Auditor. Write an Executive Summary for an Audit Report.

Client: ${reportData.client}
Standard: ${reportData.standard || 'ISO Standard'}
Date: ${reportData.date}
Total Non-Conformities: ${ncCount}

Instructions:
1. Write a professional "Executive Summary" paragraph summarizing the overall audit conclusion (positive tone, highlighting cooperation).
2. Write a bulleted list of "Key Strengths".
3. Write a bulleted list of "Opportunities for Improvement" (general, not specific NCs).
4. Return raw JSON: {"executiveSummary": "...", "strengths": ["...", "..."], "ofi": ["...", "..."]}
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            // Parse logic might need to be slightly different if it's an object, but parseAgendaResponse handles JSON parsing generally.
            // Let's reuse parseAgendaResponse but handle object return.
            const json = JSON.parse(apiResponseText.replace(/```json/g, '').replace(/```/g, '').trim());
            return json;
        } catch (error) {
            console.error("AI Summary Error:", error);
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
- Departments: ${ctx.departments && ctx.departments.length ? ctx.departments.join(', ') : 'All/General'}

**Requirements:**
1. Create a day-by-day schedule covering ${ctx.onsiteDays} days.
2. Include "Opening Meeting" (Day 1 AM) and "Closing Meeting" (Last Day PM).
3. Include "Lunch Break" (13:00-14:00) each day.
4. Assign specific auditors from the team to specific activities.
5. Cover specific ISO clauses relevant to ${ctx.standard}.
6. Ensure multiple sites are visited if applicable.
7. In the "Activity / Clause" column, provide ONLY the Clause Number and Title (e.g., "5.1 Leadership"). Do NOT include the full requirement text or summaries. Keep it a single line.
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

    // Call Vercel Serverless Function with Fallback Logic
    callProxyAPI: async (prompt) => {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
        let lastError;
        let proxyFailed = false;

        if (!window.navigator.onLine) {
            throw new Error('You appear to be offline. Please check your internet connection.');
        }

        // First, try the serverless proxy (for Vercel deployment)
        for (const model of models) {
            try {
                console.log(`Attempting AI generation with model: ${model} via proxy`);
                const response = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, model })
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    // Special handling for 404 (Not Found) or 400 (Bad Request) which might indicate model issues
                    if (response.status === 404 || response.status === 400) {
                        console.warn(`Model ${model} failed: ${data.error || response.statusText}. Retrying with next model...`);
                        lastError = new Error(data.error || `Model ${model} unavailable`);
                        continue; // Try next model
                    }
                    // For other errors (500, etc), might still be worth retrying or throwing immediate?
                    // Let's retry for robustness
                    lastError = new Error(data.error || 'AI Service Unavailable');
                    continue;
                }

                const data = await response.json();

                // Success!
                if (window.APIUsageTracker) {
                    const usage = data.usage || {};
                    window.APIUsageTracker.logUsage({
                        feature: 'ai-generation',
                        inputTokens: usage.promptTokenCount || window.APIUsageTracker.estimateTokens(prompt),
                        outputTokens: usage.candidatesTokenCount || 0,
                        success: true,
                        model: model
                    });
                }

                return AI_SERVICE.extractTextFromResponse(data);

            } catch (error) {
                console.error(`Error with model ${model}:`, error);
                lastError = error;

                // Check if this is a network/fetch error indicating the API isn't available
                if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                    proxyFailed = true;
                    break; // Stop trying proxy, fall through to direct API
                }
            }
        }

        // Determine if we should try fallback
        const hasClientKey = window.state?.settings?.geminiApiKey || localStorage.getItem('geminiApiKey');
        const shouldTryDirect = proxyFailed || (lastError && hasClientKey);

        // FALLBACK: If proxy failed or errored (and we have a key), try direct API call
        if (shouldTryDirect) {
            console.log('Proxy unavailable. Attempting direct Gemini API call...');

            // Get API key from settings
            const apiKey = window.state?.settings?.geminiApiKey || localStorage.getItem('geminiApiKey');

            if (!apiKey) {
                throw new Error(
                    'AI Service requires configuration. Please go to Settings > AI Configuration and enter your Gemini API Key. ' +
                    'You can get a free API key from https://makersuite.google.com/app/apikey'
                );
            }

            // Try direct API call
            for (const model of models) {
                try {
                    console.log(`Attempting direct Gemini API with model: ${model}`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        console.warn(`Direct API model ${model} failed:`, data.error?.message || response.statusText);
                        lastError = new Error(data.error?.message || `Model ${model} failed`);
                        continue;
                    }

                    const data = await response.json();

                    if (window.APIUsageTracker) {
                        window.APIUsageTracker.logUsage({
                            feature: 'ai-generation-direct',
                            inputTokens: window.APIUsageTracker.estimateTokens(prompt),
                            outputTokens: 0,
                            success: true,
                            model: model
                        });
                    }

                    console.log('Direct Gemini API call successful!');
                    return AI_SERVICE.extractTextFromResponse(data);

                } catch (error) {
                    console.error(`Direct API error with ${model}:`, error);
                    lastError = error;
                }
            }
        }


        // If all hardcoded models fail, try to dynamically fetch available models
        try {
            console.log('Standard models failed. Fetching available models from API...');
            const availableModels = await AI_SERVICE.getAvailableModels();

            // Filter for content generation models and sort by preference (Gemini 1.5 > 1.0 > Pro)
            const viableModels = availableModels
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', '')) // Remove prefix if present
                .filter(name => !models.includes(name)); // Avoid re-trying failed ones

            console.log('Found viable models:', viableModels);

            if (viableModels.length === 0) {
                throw new Error('No compatible AI models found for your API Key.');
            }

            // Try the dynamically found models
            for (const model of viableModels) {
                try {
                    console.log(`Attempting dynamic model: ${model}`);
                    const response = await fetch('/api/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, model })
                    });

                    if (!response.ok) continue;

                    const data = await response.json();
                    if (window.APIUsageTracker) {
                        window.APIUsageTracker.logUsage({
                            feature: 'ai-generation-dynamic',
                            inputTokens: window.APIUsageTracker.estimateTokens(prompt),
                            outputTokens: 0,
                            success: true,
                            model: model
                        });
                    }
                    return AI_SERVICE.extractTextFromResponse(data);
                } catch (e) {
                    console.error(`Dynamic model ${model} failed:`, e);
                }
            }

        } catch (listError) {
            console.error('Failed to list models:', listError);
            // Fall through to final error
        }

        // If loop finishes without return, all failed
        throw lastError || new Error('All AI models are currently unavailable. Please check your API Key and Region.');
    },

    // Get list of available models from Proxy
    getAvailableModels: async () => {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'list' })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch model list');
        }

        const data = await response.json();
        return data.models || [];
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

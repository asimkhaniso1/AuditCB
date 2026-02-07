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

    // Helper: Get KB clauses for token-efficient context
    getRelevantKBClauses: (standardName) => {
        const kb = window.state.knowledgeBase;
        if (!kb?.standards?.length) return '';

        // Match standard by name (normalize by removing "ISO " prefix)
        const normalizedName = standardName ? standardName.toLowerCase().replace('iso ', '').trim() : '';
        const stdDoc = kb.standards.find(s =>
            s.status === 'ready' && s.clauses?.length > 0 &&
            normalizedName && s.name.toLowerCase().replace('iso ', '').includes(normalizedName)
        );

        if (!stdDoc) {
            console.log('[KB] No matching standard found in KB for:', standardName);
            return '';
        }

        console.log(`[KB] Found ${stdDoc.clauses.length} clauses for ${stdDoc.name}`);

        // Return concise clause reference (saves tokens vs full text)
        // Limit to ~2000 chars to avoid overwhelming the prompt
        const clauseText = stdDoc.clauses
            .map(c => `${c.clause}: ${c.title} — ${c.requirement}`)
            .join('\n')
            .substring(0, 2000);

        return clauseText;
    },

    // 1. Auto-Classify Findings (with KB context)
    analyzeFindings: async (findings, standardName = null) => {
        if (!findings || findings.length === 0) return [];

        // Prepare simplified list for AI to save tokens
        const simplifedFindings = findings.map((f, idx) => ({
            id: idx,
            description: f.description,
            remarks: f.remarks || f.transcript || ''
        }));

        // Get KB context if standard name provided
        const kbContext = standardName ? AI_SERVICE.getRelevantKBClauses(standardName) : '';

        const prompt = `
You are a Lead Auditor. Classify the following audit findings based on ISO 19011 and ISO 17021 principles.
Determines if each finding is: "Major", "Minor", or "Observation".

${kbContext ? `Standard Requirements (from Knowledge Base):
${kbContext}

` : ''}Findings:
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

    // 2. Draft Executive Summary (with KB context)
    draftExecutiveSummary: async (reportData, compliantAreas = []) => {
        const ncCount = (reportData.ncrs || []).length + (reportData.checklistProgress || []).filter(i => i.status === 'nc').length;

        let areaText = "No specific compliant areas recorded.";
        if (compliantAreas.length > 0) {
            areaText = compliantAreas.join(', ');
        }

        // Get KB context for more accurate positive observations
        const kbContext = reportData.standard ? AI_SERVICE.getRelevantKBClauses(reportData.standard) : '';

        const prompt = `
Act as a professional ISO Lead Auditor. Write an Executive Summary, Positive Observations, and Opportunities for Improvement for an Audit Report.

Context:
- Client: ${reportData.client}
- Standard: ${reportData.standard || 'ISO Standard'}
- Date: ${reportData.date}
- Total Non-Conformities: ${ncCount}
- Compliant Clauses/Areas: ${areaText}
${kbContext ? `
Standard Requirements (from Knowledge Base):
${kbContext}
` : ''}
Instructions:
1. Executive Summary: Write a professional paragraph summarizing the audit conclusion.
2. Positive Observations: Based on the "Compliant Clauses/Areas" listed above${kbContext ? ' and the standard requirements from the Knowledge Base,' : ','} generate 3-5 specific positive observations. Reference the specific clause numbers and titles (e.g. "*** Effective implementation of Clause 5.1 Leadership was observed..."). Use professional reporting language with *** for emphasis.
3. OFI: Write a list of general opportunities for improvement (not specific NCs).

Return raw JSON:
{
  "executiveSummary": "...",
  "positiveObservations": "...",  // Can be a single string with newlines or an array. Prefer a formatted string.
  "ofi": ["...", "..."]
}
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
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

**Context:**
- Client: ${ctx.client}
- Standard: ${ctx.standard}
- Audit Type: ${ctx.type}
- Duration: ${ctx.manDays} Man-days (${ctx.onsiteDays} On-site Days)
- Sites: ${ctx.sites.map(s => s.name).join(', ')}
- Departments: ${(ctx.departments || []).join(', ')}
- Key Designations: ${(ctx.designations || []).map(d => d.title || d).join(', ')}

**Requirements:**
1. Create a day-by-day schedule covering ${ctx.onsiteDays} days.
2. Include "Opening Meeting" (Day 1 AM) and "Closing Meeting" (Last Day PM).
3. Include "Lunch Break" (13:00-14:00) each day.
4. Assign specific auditors from the team to specific activities.
5. Cover specific ISO clauses relevant to ${ctx.standard}.
6. Ensure multiple sites are visited if applicable.
7. In the "Activity / Clause" column, provide ONLY the Clause Number and Title (e.g., "5.1 Leadership"). Do NOT include the full requirement text or summaries. Keep it a single line.
8. Times should be in "HH:MM - HH:MM" format.
9. In the "Department / Auditee" column, use the provided Departments AND Designations. Be specific (e.g., "HR / HR Manager").

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
        // Updated model list - gemini-2.0-flash is the current stable model
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
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
                    const text = await response.text();
                    console.warn('AI Proxy Error Response:', text);

                    try {
                        const data = JSON.parse(text);
                        // Special handling for model-related errors (404, 400, 500)
                        if (response.status === 404 || response.status === 400 || response.status === 500) {
                            console.warn(`Model ${model} failed: ${data.error || response.statusText}. Retrying with next model...`);
                            lastError = new Error(data.error || `Model ${model} unavailable`);
                            continue; // Try next model
                        }
                        lastError = new Error(data.error || `AI Service Error: ${response.status} `);
                    } catch (e) {
                        // Change to warn to avoid scaring users when fallback is available
                        console.warn(`AI Proxy connection failed: ${response.status} ${response.statusText} - will attempt fallback.`);
                        lastError = new Error(`AI Service connection failed: ${response.status} ${response.statusText} `);
                    }
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
                console.warn(`Error with model ${model}: `, error);
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
                    console.log(`Attempting direct Gemini API with model: ${model} `);
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
                    console.warn(`Direct API fallback: ${model} unavailable, trying next...`);
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
                    console.warn(`Dynamic model ${model} unavailable, trying next...`);
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

// ============================================
// SMART AUDIT WORKFLOW HELPERS (Consolidated)
// ============================================
// Moved from smart-workflow-helpers.js for single-file AI logic

// 1. Finalize & Publish (One-Click Workflow)
window.finalizeAndPublish = function (reportId) {
    const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    if (!confirm('Are you sure you want to finalize and publish this report? This will lock the audit.')) return;

    // Save current state first
    window.saveChecklist(reportId);

    // Update status to FINALIZED directly
    report.status = window.CONSTANTS.STATUS.FINALIZED;
    report.finalizedAt = new Date().toISOString();
    report.finalizedBy = window.state.currentUser?.name || 'Lead Auditor';

    // Persist to Database
    (async () => {
        try {
            await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                status: report.status,
                data: report
            });
            window.showNotification('Audit Report successfully finalized and published!', 'success');

            // Redirect to list after short delay
            setTimeout(() => {
                window.renderAuditExecutionEnhanced && window.renderAuditExecutionEnhanced();
            }, 2000);

        } catch (err) {
            console.error('Finalization failed:', err);
            window.showNotification('Finalization saved locally. Cloud sync pending.', 'warning');
        }
    })();
};

// 2. AI Auto-Analysis for Findings
window.runFollowUpAIAnalysis = async function (reportId) {
    const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    const btn = document.querySelector(`button[onclick="window.runFollowUpAIAnalysis('${reportId}')"]`);
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        // Gather findings
        const findings = [];
        (report.checklistProgress || []).filter(p => p.status === 'nc').forEach((item, idx) => {
            findings.push({
                id: idx,
                type: 'checklist',
                description: item.ncrDescription || item.comment || 'Checklist finding',
                remarks: item.comment || ''
            });
        });

        // Call AI Service with standard name for KB lookup
        const suggestions = await window.AI_SERVICE.analyzeFindings(findings, report.standard);

        // Apply suggestions
        let updateCount = 0;
        suggestions.forEach(s => {
            if (s.type && ['major', 'minor', 'observation'].includes(s.type.toLowerCase())) {
                const finding = findings.find(f => f.id === s.id);
                if (finding && report.checklistProgress[finding.id]) {
                    report.checklistProgress[finding.id].ncrType = s.type.toLowerCase();
                    updateCount++;
                }
            }
        });

        if (updateCount > 0) {
            window.saveChecklist(reportId);
            window.renderExecutionDetail && window.renderExecutionDetail(reportId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]')?.click();
                window.showNotification(`AI classified ${updateCount} findings automatically.`, 'success');
            }, 300);
        } else {
            window.showNotification('AI analysis complete. No classification changes suggested.', 'info');
        }

    } catch (error) {
        console.error("AI Analysis Failed:", error);
        window.showNotification("AI Analysis failed. Please try again.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// 3. AI Auto-Summary Generation
window.runAutoSummary = async function (reportId) {
    const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    const btn = document.querySelector(`button[onclick="window.runAutoSummary('${reportId}')"]`);
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Drafting...';
    btn.disabled = true;

    try {
        // Gather compliant items for Positive Observations
        const compliantItems = [];
        const plan = window.state.auditPlans.find(p => p.id == report.planId) || {};
        const assignedChecklists = (window.state.checklists || []).filter(c => plan.checklistIds?.includes(c.id));

        if (report.checklistProgress) {
            report.checklistProgress.filter(p => p.status === 'compliant' || p.status === 'conform').forEach(item => {
                let clauseTitle = '';
                const cl = assignedChecklists.find(c => c.id == item.checklistId);
                if (cl) {
                    if (cl.clauses) {
                        const parts = String(item.itemIdx).split('-');
                        if (parts.length === 2) {
                            const main = cl.clauses.find(c => c.mainClause == parts[0]);
                            if (main) clauseTitle = `${main.mainClause} ${main.title}`;
                        }
                    } else if (cl.items && cl.items[item.itemIdx]) {
                        clauseTitle = cl.items[item.itemIdx].category || 'General';
                    }
                }
                if (clauseTitle) compliantItems.push(clauseTitle);
            });
        }

        const uniqueCompliantAreas = [...new Set(compliantItems)];
        const result = await window.AI_SERVICE.draftExecutiveSummary(report, uniqueCompliantAreas);

        if (result.executiveSummary) {
            report.executiveSummary = result.executiveSummary;
            const execInput = document.getElementById('exec-summary-' + reportId) || document.getElementById('exec-summary');
            if (execInput) execInput.value = result.executiveSummary;
        }

        if (result.positiveObservations) {
            report.positiveObservations = Array.isArray(result.positiveObservations) ? result.positiveObservations.join('\n') : result.positiveObservations;
            const posInput = document.getElementById('positive-observations');
            if (posInput) posInput.value = report.positiveObservations;
        }

        if (result.ofi && Array.isArray(result.ofi)) {
            report.ofi = result.ofi.join('\n');
            const ofiInput = document.getElementById('ofi');
            if (ofiInput) ofiInput.value = report.ofi;
        }

        window.saveChecklist(reportId);
        window.showNotification("Executive Summary & Observations drafted by AI.", "success");

    } catch (error) {
        console.error("AI Summary Failed:", error);
        window.showNotification("Failed to generate summary.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

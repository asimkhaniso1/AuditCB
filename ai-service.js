// ============================================
// AI SERVICE MODULE (GEMINI INTEGRATION)
// ============================================

// ============================================
// SHARED KB HELPERS (used by ai-service.js & execution-module-v2.js)
// ============================================
window.KB_HELPERS = {
    /**
     * Normalize standard name for matching (handles ISO, ISO/IEC, colons, dashes).
     * Unified version — replaces the simpler inline normalization that missed ISO/IEC patterns.
     */
    normalizeStdName: (name) => {
        return (name || '').toLowerCase()
            .replace(/iso\/iec/g, 'iso')
            .replace(/iso\s*/g, '')
            .replace(/[:\-–]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Extract leading clause number from text like "4.2 Understanding the needs..."
     */
    extractClauseNum: (clauseText) => {
        if (!clauseText) return '';
        let t = clauseText.replace(/^(clause|section|annex)\s+/i, '').trim();
        const m = t.match(/^([\d]+(?:\.[\d]+)*)/);
        return m ? m[1] : t.split(' ')[0].replace(/\.$/, '');
    },

    /**
     * Resolve standard name from a report, with fallback to plan → client.
     * Eliminates duplicated fallback chains across runFollowUpAIAnalysis & runAutoSummary.
     */
    resolveStandardName: (report) => {
        if (report.standard) return report.standard;
        // Fallback 1: linked audit plan
        if (report.planId) {
            const plan = window.state.auditPlans?.find(p => String(p.id) === String(report.planId));
            if (plan?.standard) return plan.standard;
        }
        // Fallback 2: client record
        if (report.client) {
            const client = window.state.clients?.find(c => c.name === report.client);
            if (client?.standard) return client.standard;
        }
        return '';
    },

    /**
     * Extract RELEVANT organizational context and audit plan info for AI prompts.
     * Only includes key facts (industry, scope, products, processes) — not full profile.
     */
    getOrgAndPlanContext: (reportData) => {
        let context = '';

        // Get client record
        const client = (reportData.client && window.state?.clients)
            ? window.state.clients.find(c => c.name === reportData.client || String(c.id) === String(reportData.clientId))
            : null;

        if (client) {
            const parts = [];
            if (client.industry) parts.push('Industry: ' + client.industry);
            if (client.employees) parts.push('Employees: ' + client.employees);
            if (client.sites?.length) parts.push('Sites: ' + client.sites.map(s => s.name + (s.city ? ' (' + s.city + ')' : '')).join(', '));
            if (client.goodsServices?.length) parts.push('Products/Services: ' + client.goodsServices.map(g => g.name).join(', '));
            if (client.keyProcesses?.length) parts.push('Key Processes: ' + client.keyProcesses.map(p => p.name).join(', '));
            if (client.departments?.length) parts.push('Departments: ' + client.departments.map(d => d.name).join(', '));
            if (client.shifts) parts.push('Shift Work: ' + (client.shifts === 'Yes' ? 'Multi-shift operations' : 'General shift'));

            // Include first 500 chars of profile for company overview (not full text)
            if (client.profile) {
                const summary = client.profile.substring(0, 500).replace(/\n+/g, ' ').trim();
                parts.push('Company Overview: ' + summary + (client.profile.length > 500 ? '...' : ''));
            }

            if (parts.length > 0) {
                context += '\nOrganization Context:\n' + parts.join('\n') + '\n';
            }
        }

        // Get linked audit plan
        const plan = (reportData.planId && window.state?.auditPlans)
            ? window.state.auditPlans.find(p => String(p.id) === String(reportData.planId))
            : null;

        if (plan) {
            const planParts = [];
            if (plan.type) planParts.push('Audit Type: ' + plan.type);
            if (plan.scope) planParts.push('Audit Scope: ' + plan.scope);
            if (plan.objectives) planParts.push('Objectives: ' + plan.objectives);
            if (plan.criteria) planParts.push('Audit Criteria: ' + plan.criteria);
            if (plan.leadAuditor) planParts.push('Lead Auditor: ' + plan.leadAuditor);
            if (plan.manDays) planParts.push('Duration: ' + plan.manDays + ' man-days');

            if (planParts.length > 0) {
                context += '\nAudit Plan Details:\n' + planParts.join('\n') + '\n';
            }
        }

        return context;
    },

    /**
     * Lookup a single clause from the Knowledge Base.
     * Uses 4 progressive matching strategies (exact → parent → prefix → top-level)
     * to support up to 4 levels of ISO clause hierarchy.
     * Returns { clause, title, requirement } or null if no match.
     */
    lookupKBRequirement: (clauseText, standardName) => {
        if (!clauseText || !standardName) return null;
        const kb = window.state?.knowledgeBase;
        if (!kb?.standards?.length) return null;

        const normStd = window.KB_HELPERS.normalizeStdName(standardName);
        const stdDoc = kb.standards.find(s =>
            s.status === 'ready' && s.clauses?.length > 0 &&
            window.KB_HELPERS.normalizeStdName(s.name).includes(normStd)
        ) || kb.standards.find(s =>
            s.status === 'ready' && s.clauses?.length > 0 &&
            normStd.includes(window.KB_HELPERS.normalizeStdName(s.name))
        );
        if (!stdDoc) {
            console.log(`[KB Lookup] No standard for "${standardName}". Available:`, kb.standards.map(s => `${s.name}(${s.status})`).join(', '));
            return null;
        }

        const clauseNum = window.KB_HELPERS.extractClauseNum(clauseText);
        if (!clauseNum) return null;

        // Strategy 1: Exact match
        let kbClause = stdDoc.clauses.find(c => c.clause === clauseNum);
        // Strategy 2: Parent clause (e.g. "7.1" for "7.1.2")
        if (!kbClause) {
            const parent = clauseNum.split('.').slice(0, 2).join('.');
            kbClause = stdDoc.clauses.find(c => c.clause === parent);
        }
        // Strategy 3: startsWith (e.g. "4.2" matches "4.2.1" or vice versa)
        if (!kbClause) {
            kbClause = stdDoc.clauses.find(c => c.clause.startsWith(clauseNum + '.') || clauseNum.startsWith(c.clause + '.'));
        }
        // Strategy 4: Top-level clause (e.g. "4" for "4.2")
        if (!kbClause) {
            const topLevel = clauseNum.split('.')[0];
            kbClause = stdDoc.clauses.find(c => c.clause === topLevel);
        }

        if (kbClause) {
            console.log(`[KB Lookup] MATCH ${clauseNum} → ${kbClause.clause}: "${(kbClause.requirement || '').substring(0, 120)}..."`);
            return {
                clause: kbClause.clause || '',
                title: kbClause.title || '',
                requirement: kbClause.requirement || '',
                standardName: stdDoc.name || standardName
            };
        }
        console.log(`[KB Lookup] NO MATCH for "${clauseNum}". KB clauses: ${stdDoc.clauses.map(c => c.clause).join(', ')}`);
        return null;
    },

    /**
     * Resolve clause text and requirement text from checklist data for a progress item.
     * Handles both clauses[] (new) and sections[]/items[] (old) structures.
     * Returns { clauseText, reqText }.
     */
    resolveChecklistClause: (item, checklists) => {
        let clauseText = '';
        let reqText = '';

        if (!item || !checklists) return { clauseText, reqText };

        const cl = checklists.find(c => String(c.id) === String(item.checklistId));
        if (!cl) return { clauseText, reqText };

        if (cl.clauses) {
            // New structure: clauses with subClauses (mainClause-subIdx format)
            const parts = String(item.itemIdx).split('-');
            if (parts.length === 2) {
                const main = cl.clauses.find(c => String(c.mainClause) === parts[0]);
                if (main && main.subClauses && main.subClauses[parts[1]]) {
                    const sub = main.subClauses[parts[1]];
                    clauseText = sub.clause || '';
                    // Check for nested items structure (KB-generated checklists)
                    if (sub.items && sub.items.length > 0) {
                        reqText = sub.items[0].requirement || sub.requirement || '';
                    } else {
                        reqText = sub.requirement || sub.text || '';
                    }
                }
            }
            // Cumulative index fallback
            if (!clauseText) {
                let cumulativeIdx = 0;
                for (const group of cl.clauses) {
                    let found = false;
                    for (const sub of (group.subClauses || [])) {
                        if (String(cumulativeIdx) === String(item.itemIdx)) {
                            clauseText = sub.clause || `${group.mainClause} ${group.title || ''}`.trim();
                            reqText = sub.requirement || sub.text || '';
                            found = true;
                            break;
                        }
                        cumulativeIdx++;
                    }
                    if (found) break;
                }
            }
        } else if (cl.sections) {
            // Old structure: sections with items
            let cumulativeIdx = 0;
            for (const section of cl.sections) {
                let found = false;
                for (const q of (section.items || [])) {
                    if (String(cumulativeIdx) === String(item.itemIdx)) {
                        clauseText = section.clauseNumber
                            ? `${section.clauseNumber} ${section.title || ''}`.trim()
                            : (section.title || section.clause || `Section ${section.id || ''}`);
                        reqText = q.text || q.requirement || q.description || '';
                        found = true;
                        break;
                    }
                    cumulativeIdx++;
                }
                if (found) break;
            }
        } else if (cl.items && cl.items[item.itemIdx]) {
            // Flat items array structure
            clauseText = cl.items[item.itemIdx].clause || cl.items[item.itemIdx].category || '';
            reqText = cl.items[item.itemIdx].requirement || cl.items[item.itemIdx].text || '';
        }

        return { clauseText, reqText };
    }
};

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
    // Smart Analysis Features
    // ------------------------------------------------------------------

    // Helper: Get KB clauses for token-efficient context
    getRelevantKBClauses: (standardName) => {
        const kb = window.state.knowledgeBase;
        if (!kb?.standards?.length) return '';

        // Match standard by name using unified normalization (handles ISO/IEC)
        const normalizedName = window.KB_HELPERS.normalizeStdName(standardName);
        if (!normalizedName) return '';
        const stdDoc = kb.standards.find(s =>
            s.status === 'ready' && s.clauses?.length > 0 &&
            window.KB_HELPERS.normalizeStdName(s.name).includes(normalizedName)
        );

        if (!stdDoc) {
            console.log('[KB] No matching standard found in KB for:', standardName);
            return '';
        }

        console.log(`[KB] Found ${stdDoc.clauses.length} clauses for ${stdDoc.name}`);

        // Return concise clause reference (saves tokens vs full text)
        // Limit to ~8000 chars for balanced context without overwhelming prompt
        const clauseText = stdDoc.clauses
            .map(c => `${c.clause}: ${c.title} — ${c.requirement}`)
            .join('\n')
            .substring(0, 8000);

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

    // 1b. Refine raw auditor notes/transcript into professional audit language
    refineAuditNotes: async (findings, standardName = null) => {
        if (!findings || findings.length === 0) return [];

        // Only refine items that have remarks/comments
        const itemsToRefine = findings
            .map((f, idx) => ({
                idx,
                clause: f.clause || f.clauseRef || '',
                status: f.status || f.type || '',
                raw: (f.comment || f.remarks || f.transcript || f.description || '').trim()
            }))
            .filter(f => f.raw.length > 5); // Skip empty or very short entries

        if (itemsToRefine.length === 0) return findings;

        // Get KB context for more accurate rephrasing
        const kbContext = standardName ? AI_SERVICE.getRelevantKBClauses(standardName) : '';

        // Get org context for industry-specific language (compact summary)
        let orgSummary = '';
        if (window.state?.clients) {
            // Try to find client from findings context
            const reports = window.state.reports || JSON.parse(localStorage.getItem('audit_reports') || '[]');
            const activeReport = reports.find(r => r.standard === standardName) || reports[0];
            if (activeReport) {
                const ctx = KB_HELPERS.getOrgAndPlanContext(activeReport);
                if (ctx) orgSummary = ctx.substring(0, 800);
            }
        }

        const prompt = `
You are a professional ISO Lead Auditor writing an audit report. Convert the following raw auditor notes and voice transcripts into professional audit report language.
${orgSummary ? `
${orgSummary}` : ''}
Rules:
1. Use formal, third-person audit language (e.g., "The organization has demonstrated...", "It was observed that...")
2. Reference clause numbers where provided
3. Reference the organization's specific products, processes, and industry when relevant
4. Keep the same meaning — do NOT change findings or add interpretations
5. Each remark should be 1-3 clear, complete sentences
6. Use ISO audit terminology (conformity, non-conformity, objective evidence, etc.)
7. Do NOT use markdown formatting (no **, ***, ##, or bullet symbols)
8. Return plain text only

${kbContext ? `Standard Requirements (from Knowledge Base):
${kbContext.substring(0, 3000)}

` : ''}Raw Auditor Notes:
${JSON.stringify(itemsToRefine.map(f => ({ id: f.idx, clause: f.clause, status: f.status, notes: f.raw })), null, 2)}

Return a raw JSON array with 'id' and 'refined' fields only:
[{"id": 0, "refined": "Professional version of the notes..."}, ...]
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            const cleaned = apiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const refined = JSON.parse(cleaned);

            // Merge refined text back into findings
            const result = [...findings];
            refined.forEach(r => {
                if (r.id !== undefined && r.refined && result[r.id]) {
                    result[r.id] = {
                        ...result[r.id],
                        comment: r.refined,
                        _originalComment: result[r.id].comment || result[r.id].remarks || result[r.id].transcript || ''
                    };
                }
            });
            console.log(`[AI] Refined ${refined.length} audit notes into professional language`);
            return result;
        } catch (error) {
            console.error("AI Note Refinement Error:", error);
            return findings; // Return original on failure
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

        // Get Organization Context & Audit Plan details
        const orgPlanContext = KB_HELPERS.getOrgAndPlanContext(reportData);

        const prompt = `
Act as a professional ISO Lead Auditor. Write an Executive Summary, Positive Observations, and Opportunities for Improvement for an Audit Report.

Context:
- Client: ${reportData.client}
- Standard: ${reportData.standard || 'ISO Standard'}
- Date: ${reportData.date}
- Total Non-Conformities: ${ncCount}
- Compliant Clauses/Areas: ${areaText}
${orgPlanContext}
${kbContext ? `
Standard Requirements (from Knowledge Base):
${kbContext}
` : ''}
Instructions:
1. Executive Summary: Write a professional paragraph summarizing the audit conclusion.
2. Positive Observations: Based on the "Compliant Clauses/Areas" listed above${kbContext ? ' and the standard requirements from the Knowledge Base,' : ','} generate 3-5 specific positive observations. Reference the specific clause numbers and titles (e.g. "Effective implementation of Clause 5.1 Leadership was observed..."). Use professional audit reporting language. Do NOT use markdown formatting (no asterisks, no bold markers, no bullet symbols).
3. OFI: Write a list of general opportunities for improvement (not specific NCs). Use plain text without markdown.

IMPORTANT: Return plain text only. Do NOT use markdown formatting like **, ***, ##, or bullet symbols in any field values. Use numbered lists (1. 2. 3.) instead.

Return raw JSON:
{
  "executiveSummary": "...",
  "positiveObservations": "...",
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
        // Build personnel roster for auditee assignment
        let personnelSection = '';
        if (ctx.contacts && ctx.contacts.length > 0) {
            const roster = ctx.contacts
                .map(c => `  - ${c.name}${c.designation ? ' (' + c.designation + ')' : ''}${c.department ? ' — ' + c.department : ''}`)
                .join('\n');
            personnelSection = `\n- Personnel Roster:\n${roster}\n`;
        }

        return `
You are an expert ISO Certification Body Lead Auditor. Create a detailed Audit Agenda/Itinerary (in valid JSON format) for the following audit plan.

**Context:**
- Client: ${ctx.client}
- Standard: ${ctx.standard}
- Audit Type: ${ctx.type}
- Duration: ${ctx.manDays} Man-days (${ctx.onsiteDays} On-site Days)
- Sites: ${ctx.sites.map(s => s.name).join(', ')}
- Departments: ${(ctx.departments || []).join(', ')}
- Key Designations: ${(ctx.designations || []).map(d => d.title || d).join(', ')}${personnelSection}
**Requirements:**
1. Create a day-by-day schedule covering ${ctx.onsiteDays} days.
2. Include "Opening Meeting" (Day 1 AM) and "Closing Meeting" (Last Day PM).
3. Include "Lunch Break" (13:00-14:00) each day.
4. Assign specific auditors from the team to specific activities.
5. Cover specific ISO clauses relevant to ${ctx.standard}.
6. Ensure multiple sites are visited if applicable.
7. In the "Activity / Clause" column, provide ONLY the Clause Number and Title (e.g., "5.1 Leadership"). Do NOT include the full requirement text or summaries. Keep it a single line.
8. Times should be in "HH:MM - HH:MM" format.
9. In the "Department / Auditee" column, use ACTUAL personnel names from the roster above where available. Format as "Department / Person Name" — e.g., "HR / Ahmed Khan". If no matching person exists for a clause, use the department name only.

**Output Format:**
Return ONLY a raw JSON array of objects. Do not include markdown formatting (like \`\`\`json).
Example:
[
  {"day": "Day 1", "time": "09:00 - 09:30", "item": "Opening Meeting", "dept": "Top Management / CEO Name", "auditor": "All Team"},
  {"day": "Day 1", "time": "09:30 - 10:30", "item": "Site Tour", "dept": "All", "auditor": "All Team"},
  ...
]
`;
    },

    // Call Vercel Serverless Function with Fallback Logic
    callProxyAPI: async (prompt, options = {}) => {
        // Model fallback list — use current, supported models only
        const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
        let lastError;
        let proxyFailed = false;
        const maxTokens = options.maxTokens || 32768;

        if (!window.navigator.onLine) {
            throw new Error('You appear to be offline. Please check your internet connection.');
        }

        // First, try the serverless proxy (for Vercel deployment)
        for (const model of models) {
            try {
                console.log(`Attempting AI generation with model: ${model} via proxy (maxTokens: ${maxTokens})`);
                const response = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, model, maxTokens })
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
                        const usage = data.usageMetadata || {};
                        window.APIUsageTracker.logUsage({
                            feature: 'ai-generation-direct',
                            inputTokens: usage.promptTokenCount || window.APIUsageTracker.estimateTokens(prompt),
                            outputTokens: usage.candidatesTokenCount || 0,
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

            // Filter for content generation models and sort by preference (Gemini 2.0 > 1.5 > Pro)
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
        let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Strategy 1: Direct parse
        try {
            const json = JSON.parse(cleanText);
            if (Array.isArray(json)) return json;
            // If it's an object, check common wrapper keys
            if (json && typeof json === 'object') {
                for (const key of ['classifications', 'findings', 'results', 'data', 'items', 'agenda']) {
                    if (Array.isArray(json[key])) return json[key];
                }
                return [json];
            }
        } catch (e) { /* try next strategy */ }

        // Strategy 2: Extract JSON array [...] from the text (greedy to handle nested objects)
        const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                const json = JSON.parse(arrayMatch[0]);
                if (Array.isArray(json)) return json;
            } catch (e) { /* try next strategy */ }
        }

        // Strategy 3: Extract individual JSON objects and collect them
        const objects = [];
        const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
        let match;
        while ((match = objRegex.exec(cleanText)) !== null) {
            try {
                objects.push(JSON.parse(match[0]));
            } catch (e) { /* skip invalid */ }
        }
        if (objects.length > 0) return objects;

        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Failed to parse AI response. Please try again.");
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
        // Gather findings with rich context using shared helper
        const findings = [];
        const plan = window.state.auditPlans?.find(p => String(p.id) === String(report.planId)) || {};
        const checklists = (window.state.checklists || []);
        const assignedChecklists = (plan.selectedChecklists || []).map(clId => checklists.find(c => String(c.id) === String(clId))).filter(c => c);

        // IMPORTANT: Track original index in checklistProgress array
        (report.checklistProgress || []).forEach((item, originalIdx) => {
            if (item.status !== 'nc') return;
            // Use shared helper for clause/requirement resolution
            const { clauseText, reqText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);
            findings.push({
                id: findings.length,
                originalIdx: originalIdx,
                type: 'checklist',
                clause: clauseText,
                requirement: reqText,
                description: item.ncrDescription || reqText || item.comment || 'Checklist finding',
                remarks: item.comment || item.transcript || ''
            });
        });

        // Resolve standard name using shared helper
        const standardName = window.KB_HELPERS.resolveStandardName(report);

        // Call AI Service with standard name for KB lookup
        const suggestions = await window.AI_SERVICE.analyzeFindings(findings, standardName);

        // Apply suggestions using originalIdx to update the right item
        let updateCount = 0;
        console.log('[AI Classify] Suggestions:', suggestions);
        suggestions.forEach(s => {
            if (s.type && ['major', 'minor', 'observation'].includes(s.type.toLowerCase())) {
                const finding = findings.find(f => f.id === s.id);
                if (finding && report.checklistProgress[finding.originalIdx]) {
                    console.log(`[AI Classify] Setting item ${finding.originalIdx} (${finding.clause}) to ${s.type}`);
                    report.checklistProgress[finding.originalIdx].ncrType = s.type.toLowerCase();
                    updateCount++;
                }
            }
        });

        if (updateCount > 0) {
            // IMPORTANT: Do NOT call saveChecklist here — it reads stale DOM values
            // from Review tab dropdowns and overwrites our AI changes.
            // Instead, persist directly to localStorage.
            try {
                const idx = window.state.auditReports.findIndex(r => String(r.id) === String(reportId));
                if (idx >= 0) {
                    localStorage.setItem('auditReports', JSON.stringify(window.state.auditReports));
                    console.log('[AI Classify] Persisted to localStorage directly (bypassed saveChecklist DOM read)');
                }
                // Also try Supabase
                if (window.SupabaseClient?.isInitialized) {
                    window.SupabaseClient.db.update('audit_reports', String(reportId), { data: report }).catch(e => console.warn('[AI Classify] Supabase save failed:', e));
                }
            } catch (e) { console.warn('[AI Classify] Direct save failed:', e); }

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
        // Gather compliant items for Positive Observations using shared helper
        const compliantItems = [];
        const plan = window.state.auditPlans.find(p => p.id == report.planId) || {};
        const assignedChecklists = (window.state.checklists || []).filter(c => plan.checklistIds?.includes(c.id));

        if (report.checklistProgress) {
            report.checklistProgress.filter(p => p.status === 'compliant' || p.status === 'conform').forEach(item => {
                const { clauseText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);
                if (clauseText) compliantItems.push(clauseText);
            });
        }

        const uniqueCompliantAreas = [...new Set(compliantItems)];

        // Resolve standard name using shared helper
        report.standard = window.KB_HELPERS.resolveStandardName(report) || report.standard;

        const result = await window.AI_SERVICE.draftExecutiveSummary(report, uniqueCompliantAreas);

        // Helper to strip any remaining markdown from AI response
        const stripMd = (text) => text ? text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/^#+\s*/gm, '').replace(/^[-•]\s*/gm, '').trim() : '';

        if (result.executiveSummary) {
            report.executiveSummary = stripMd(result.executiveSummary);
            const execInput = document.getElementById('exec-summary-' + reportId) || document.getElementById('exec-summary');
            if (execInput) execInput.value = report.executiveSummary;
        }

        if (result.positiveObservations) {
            report.positiveObservations = stripMd(Array.isArray(result.positiveObservations) ? result.positiveObservations.join('\n') : result.positiveObservations);
            const posInput = document.getElementById('positive-observations');
            if (posInput) posInput.value = report.positiveObservations;
        }

        if (result.ofi && Array.isArray(result.ofi)) {
            report.ofi = result.ofi.map(s => stripMd(s)).join('\n');
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

// ============================================
// AI SERVICE MODULE (GEMINI INTEGRATION) (ESM-ready)
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
            ? window.DataService.findAuditPlan(reportData.planId)
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

        // Append client document context if available
        if (client) {
            const docContext = KB_HELPERS.getClientDocumentContext(client);
            if (docContext) context += docContext;
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
            return {
                clause: kbClause.clause || '',
                title: kbClause.title || '',
                requirement: kbClause.requirement || '',
                standardName: stdDoc.name || standardName
            };
        }
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
    },

    /**
     * Build a token-efficient summary of client documents for AI prompt injection.
     * Includes document name, category, revision, linked clauses, and truncated notes.
     * @param {Object} client - Client object with .documents array
     * @returns {string} Formatted document context or empty string
     */
    getClientDocumentContext: (client) => {
        if (!client?.documents?.length) return '';

        const docs = client.documents.slice(0, 10); // Cap at 10 to manage token usage
        const lines = docs.map(doc => {
            let line = `- ${doc.name}`;
            if (doc.category) line += ` [${doc.category}]`;
            if (doc.revision) line += ` (${doc.revision})`;
            if (doc.linkedClauses) line += ` — Clauses: ${doc.linkedClauses}`;
            if (doc.notes) {
                const truncated = doc.notes.substring(0, 200).replace(/\n+/g, ' ').trim();
                line += `\n  Key Info: ${truncated}${doc.notes.length > 200 ? '...' : ''}`;
            }
            return line;
        });

        return `\nClient Documents Provided (${client.documents.length} total):\n${lines.join('\n')}\n`;
    }
};

// ============================================
// AUTHORITATIVE COUNT RESOLUTION + NARRATIVE GUARD
// ============================================
// "One authoritative audit dataset -> every report section." ReportStats.build()
// is that dataset for Major/Minor NC, Observation and OFI figures (see
// report-integrity.js B13). AI-drafted narrative must state those numbers
// verbatim, never re-derive or combine them — re-derivation is exactly how a
// shipped report once summed Observations + OFIs into an invented total
// ("4 non-conformities and 5 opportunities for improvement" when the audit
// actually recorded 4 minor NCs, 4 observations and 1 OFI).

// Resolve {majorNC, minorNC, observationCount, ofiCount} from ReportStats.
// Reads both the flat and resultCounts/advisories-nested shapes defensively —
// this file doesn't own report-stats.js and shouldn't assume one exact shape.
// Returns null (never throws) when ReportStats hasn't loaded or the report
// shape is unexpected, so callers can degrade to their own local tally exactly
// like every other ReportStats consumer in this repo already does.
function _resolveAuthoritativeCounts(reportData) {
    try {
        if (!window.ReportStats || typeof window.ReportStats.build !== 'function') return null;
        const plan = (reportData.planId && window.state?.auditPlans)
            ? window.DataService.findAuditPlan(reportData.planId)
            : null;
        const client = (reportData.client && window.state?.clients)
            ? window.state.clients.find(c => c.name === reportData.client || String(c.id) === String(reportData.clientId))
            : null;
        const rs = window.ReportStats.build({
            report: reportData,
            hydratedProgress: reportData.checklistProgress || [],
            auditPlan: plan,
            client
        });
        if (!rs) return null;
        const counts = rs.resultCounts || {};
        const advisories = rs.advisories || {};
        const pick = (flat, nested) => Number(flat != null ? flat : nested) || 0;
        return {
            majorNC: pick(rs.majorNC, counts.majorNC),
            minorNC: pick(rs.minorNC, counts.minorNC),
            observationCount: pick(rs.observationCount, advisories.observation),
            ofiCount: pick(rs.ofiCount, advisories.ofi)
        };
    } catch (_e) {
        return null; // degrade gracefully — caller falls back to its own local tally
    }
}

// Same regexes report-integrity.js's B13 check uses to parse narrative counts,
// duplicated deliberately (this file may not load after report-integrity.js) so
// that whatever this guard leaves uncorrected is exactly what B13 would block.
const _NARRATIVE_COUNT_PATTERNS = [
    { key: 'ncTotal', re: /(\d+)(\s+(?:minor\s+)?non-?conformit(?:y|ies))/gi, unitRe: /conformit(y|ies)/i },
    { key: 'ofiCount', re: /(\d+)(\s+opportunit(?:y|ies)\s+for\s+improvement)/gi, unitRe: /opportunit(y|ies)/i },
    { key: 'observationCount', re: /(\d+)(\s+observations?)\b/gi, unitRe: /observations?/i }
];

// Adjust a matched unit word ("conformities", "opportunity", ...) to agree in
// number with the corrected figure, without touching anything around it (e.g.
// a "minor " qualifier stays exactly as the model wrote it).
function _agreeInNumber(word, isPlural) {
    if (/ies$/i.test(word)) return isPlural ? word : word.replace(/ies$/i, 'y');
    if (/y$/i.test(word)) return isPlural ? word.replace(/y$/i, 'ies') : word;
    if (/s$/i.test(word)) return isPlural ? word : word.replace(/s$/i, '');
    return isPlural ? word + 's' : word;
}

// Deterministic post-generation guard: correct a stated count in place when it
// disagrees with the authoritative figure for that exact classification. Never
// touches wording beyond the numeral and its own unit word — no new facts, no
// rewritten sentences. If a single classification's phrase can't be resolved
// safely (unexpected match shape, regex failure), the field is left untouched
// and logged so report-integrity.js's B13 blocks issuance instead of a guessed
// rewrite reaching the client document.
function _reconcileNarrativeCounts(text, authoritative, fieldLabel) {
    if (!text || typeof text !== 'string' || !authoritative) return text;
    let result = text;
    _NARRATIVE_COUNT_PATTERNS.forEach((pattern) => {
        const expected = authoritative[pattern.key];
        if (expected == null) return;
        try {
            result = result.replace(pattern.re, (full, digits, tail) => {
                const stated = parseInt(digits, 10);
                if (isNaN(stated) || stated === expected) return full;
                const fixedTail = tail.replace(pattern.unitRe, (unit) => _agreeInNumber(unit, expected !== 1));
                return String(expected) + fixedTail;
            });
        } catch (e) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', `Could not reconcile "${pattern.key}" count in ${fieldLabel} against ReportStats; leaving for report-integrity.js to block.`, e);
        }
    });
    return result;
}

// ============================================
// EVIDENCE-DRIVEN CLAUSE SUGGESTER GUARDRAIL HELPERS (client spec #3)
// ============================================
// "Never invent an ISO clause" needs to be a structural guarantee, not just a
// prompt instruction — these helpers give AI_SERVICE.suggestFindingClause() a
// closed inventory to prompt from AND to validate the model's answer against,
// so an out-of-inventory clause can never reach the caller.

// Exact sentence the auditor-facing UI must display verbatim whenever
// suggestFindingClause() resolves with insufficientEvidence: true.
const CLAUSE_MAPPING_INSUFFICIENT_EVIDENCE_MESSAGE = 'Clause mapping requires auditor review — available evidence does not provide sufficient confidence for automatic classification.';

// Locate the audited standard's ready, populated KB clause inventory.
// Same two-direction normalized-name matching as getRelevantKBClauses() /
// KB_HELPERS.lookupKBRequirement() — duplicated rather than shared because
// those two also need to return different shapes (text vs a single clause).
function _findReadyKBStandardDoc(standardName) {
    const kb = window.state && window.state.knowledgeBase;
    if (!kb || !kb.standards || !kb.standards.length || !standardName) return null;
    const normStd = window.KB_HELPERS.normalizeStdName(standardName);
    if (!normStd) return null;
    return kb.standards.find(s => s.status === 'ready' && s.clauses && s.clauses.length > 0 &&
            window.KB_HELPERS.normalizeStdName(s.name).includes(normStd))
        || kb.standards.find(s => s.status === 'ready' && s.clauses && s.clauses.length > 0 &&
            normStd.includes(window.KB_HELPERS.normalizeStdName(s.name)))
        || null;
}

// Build the candidate-clause listing injected into the prompt. Includes
// requirement text where the size budget allows; when it doesn't, requirement
// text is dropped UNIFORMLY across every entry (never mid-string truncated)
// so the model always sees a complete, valid list of clause numbers/titles to
// choose from — partial truncation could silently hide legitimate choices.
function _buildClauseInventoryForPrompt(stdDoc) {
    const clauses = stdDoc.clauses || [];
    const withReq = clauses.map(c => `${c.clause}: ${c.title || ''}${c.requirement ? ' — ' + c.requirement : ''}`).join('\n');
    if (withReq.length <= 8000) return withReq;
    const titlesOnly = clauses.map(c => `${c.clause}: ${c.title || ''}`).join('\n');
    return titlesOnly.length <= 20000 ? titlesOnly : titlesOnly.substring(0, 20000);
}

// Defensive parse for a single JSON object response (the model may wrap it in
// prose or markdown fences) — same multi-strategy approach as
// AI_SERVICE.parseAgendaResponse(), adapted for an object instead of an array.
function _parseClauseSuggestionJSON(text) {
    if (!text) return null;
    const cleanText = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        const json = JSON.parse(cleanText);
        if (json && typeof json === 'object' && !Array.isArray(json)) return json;
    } catch (_e) { /* try next strategy */ }
    const objMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try {
            const json = JSON.parse(objMatch[0]);
            if (json && typeof json === 'object' && !Array.isArray(json)) return json;
        } catch (_e) { /* give up — caller degrades to insufficientEvidence */ }
    }
    return null;
}

// Minimal markdown stripper for model-authored free text (reason strings),
// same pattern already used inline by runAutoSummary()'s stripMd — kept as a
// small named helper here since it's needed before the AI_SERVICE object
// (and its confirm-overwrite flow) is reached.
function _stripMdLite(text) {
    if (!text) return '';
    return String(text).replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/^#+\s*/gm, '').replace(/^[-•]\s*/gm, '').trim();
}

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
            return '';
        }


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
You are a Senior Lead Auditor with over 30 years of experience at a top-tier international Certification Body (e.g., BSI, Bureau Veritas, DNV, TÜV, SGS). You are writing a formal audit report for client submission. Convert the following raw auditor notes and voice transcripts into polished, authoritative audit report language that reflects the depth of experience and professionalism expected from a world-class CB. The report will be reviewed and attested by a Qualified Registrar before client submission.
${orgSummary ? `
${orgSummary}` : ''}
Rules:
1. Write in a measured, authoritative tone using formal third-person audit language (e.g., "The audit team verified that the organization has established and maintains...", "Through examination of objective evidence, it was confirmed that...", "The assessment revealed that...")
2. Reference clause numbers precisely where provided, linking observations to specific standard requirements
3. Reference the organization's specific products, processes, industry context, and operational environment when relevant
4. Preserve the original meaning — do NOT alter findings, downgrade severity, or add speculative interpretations
5. Each remark should be 2-4 clear, authoritative sentences that demonstrate systematic assessment
6. IMPORTANT: Match the language precisely to the finding status:
   - If status is "conform", use affirmative conformity verification language (e.g., "The audit team confirmed effective implementation of...", "Objective evidence including [records/interviews/observation] substantiated conformity with...", "The organization demonstrated a mature and well-embedded approach to..."). Describe the specific evidence examined.
   - If status is "observation" or "ofi", use constructive Opportunity for Improvement language (e.g., "While conformity with the requirements was confirmed, the organization may benefit from...", "An opportunity to further strengthen the existing framework was identified...", "The audit team noted that enhanced..."). Do NOT use "non-conformity" or "failure" for observations/OFIs.
   - If status is "minor" or "major", use precise non-conformity language citing the specific gap between the requirement and the objective evidence.
7. Use ISO audit terminology consistently (conformity, non-conformity, objective evidence, systematic approach, effective implementation, continual improvement, opportunity for improvement)
8. Do NOT use markdown formatting (no **, ***, ##, or bullet symbols)
9. Return plain text only
10. CRITICAL — CCI Gold Standard: Do NOT use percentage scoring or compliance percentages. Do NOT mix clauses across different standards. Use legally defensible, accreditation-ready language suitable for ISO 17021 certification body reporting.

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
                        _originalComment: result[r.id].comment || result[r.id].remarks || result[r.id].transcript || '',
                        _aiGenerated: true,
                        _auditorConfirmed: false
                    };
                }
            });
            return result;
        } catch (error) {
            console.error("AI Note Refinement Error:", error);
            return findings; // Return original on failure
        }
    },

    // 1c. Generate conformance text for findings with empty remarks
    generateConformanceText: async (findings, standardName = null) => {
        if (!findings || findings.length === 0) return [];

        // Only generate for items with empty/missing remarks
        const emptyItems = findings
            .map((f, idx) => ({
                idx,
                clause: f.clause || f.clauseRef || '',
                description: (f.description || '').trim(),
                type: f.type || f.status || 'observation',
                requirement: f.requirement || ''
            }))
            .filter(f => f.description.length > 3);

        if (emptyItems.length === 0) return findings;

        // Get KB context for accurate conformance statements
        const kbContext = standardName ? AI_SERVICE.getRelevantKBClauses(standardName) : '';

        // Get org context
        let orgSummary = '';
        if (window.state?.clients) {
            const reports = window.state.reports || JSON.parse(localStorage.getItem('audit_reports') || '[]');
            const activeReport = reports.find(r => r.standard === standardName) || reports[0];
            if (activeReport) {
                const ctx = KB_HELPERS.getOrgAndPlanContext(activeReport);
                if (ctx) orgSummary = ctx.substring(0, 800);
            }
        }

        const prompt = `
You are a Senior Lead Auditor with over 30 years of experience at a top-tier international Certification Body (e.g., BSI, Bureau Veritas, DNV, TÜV, SGS). You are writing formal audit finding statements for client submission. Generate authoritative finding statements that reflect the depth of expertise and precision expected from a world-class CB. The report will be reviewed and attested by a Qualified Registrar before client submission. IMPORTANT: classify the language used based on the finding "type".
${orgSummary ? `
${orgSummary}` : ''}
Rules:
1. Write in a measured, authoritative tone using formal third-person audit language (e.g., "The audit team verified that the organization has established...", "Through examination of objective evidence, it was confirmed...", "The assessment revealed that...")
2. Reference clause numbers precisely and link to the specific requirement being assessed
3. For "observation" type: This is NOT a non-conformity. Write an Observation (OBS). Use authoritative observational language like "The audit team noted that...", "During the assessment, it was observed that...", "While conformity was established, the audit team draws attention to...". Do NOT use "non-conformity", "failure", or "absence" for observations.
4. For "ofi" type: This is NOT a non-conformity. Write an Opportunity for Improvement (OFI). Use constructive senior-level language like "The organization would benefit from further developing...", "An opportunity to enhance the effectiveness of the existing framework was identified...", "The audit team recommends consideration of...", "While the current approach meets the requirement, its effectiveness could be strengthened by...". Do NOT use "non-conformity", "failure", or "absence" for OFIs, and do not characterize the system's maturity.
5. For "minor" type: Write a minor non-conformity statement precisely citing the specific gap between the requirement and objective evidence. Use language like "A minor non-conformity was identified where...", "The assessment identified a partial implementation gap in..."
6. For "major" type: Write a major non-conformity statement referencing systemic failure or total absence of required controls. Use language like "A major non-conformity was raised due to...", "The audit team identified a systemic failure to..."
7. For "conform" type: Write an authoritative conformity verification statement describing the specific objective evidence examined. Use language like "The audit team confirmed effective implementation of...", "Through review of [specific records], interview with [role], and observation of [process], conformity with the requirement was verified...", "The organization demonstrated a well-embedded and mature approach to...". Be specific about the evidence.
8. Each statement should be 2-4 clear, authoritative sentences demonstrating systematic assessment
9. Use ISO audit terminology precisely: conformity, non-conformity, objective evidence, effective implementation, systematic approach, continual improvement, opportunity for improvement
10. Do NOT use markdown formatting (no **, ***, ##, or bullet symbols)
11. Return plain text only
12. Reference the organization's specific processes or products when the finding description provides that context
13. CRITICAL — CCI Gold Standard: Do NOT use percentage scoring or compliance percentages. Do NOT mix clauses across different standards. Use legally defensible, accreditation-ready language suitable for ISO 17021 certification body reporting.

${kbContext ? `Standard Requirements (from Knowledge Base):
${kbContext.substring(0, 3000)}

` : ''}Findings:
${JSON.stringify(emptyItems.map(f => ({ id: f.idx, clause: f.clause, type: f.type, description: f.description, requirement: f.requirement })), null, 2)}

Return a raw JSON array with 'id' and 'text' fields only:
[{"id": 0, "text": "Professional audit finding statement..."}, ...]
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            const cleaned = apiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const generated = JSON.parse(cleaned);

            // Merge generated text back into findings
            const result = [...findings];
            generated.forEach(g => {
                if (g.id !== undefined && g.text && result[g.id]) {
                    result[g.id] = {
                        ...result[g.id],
                        comment: g.text,
                        _aiGenerated: true,
                        _auditorConfirmed: false
                    };
                }
            });
            return result;
        } catch (error) {
            console.error("AI Conformance Text Error:", error);
            return findings; // Return original on failure
        }
    },

    // Exact sentence the UI must show verbatim when suggestFindingClause()
    // returns insufficientEvidence: true. Exposed here so the confirmation
    // modal (execution-module-v2.js, follow-up task) never has to re-author it.
    INSUFFICIENT_EVIDENCE_MESSAGE: CLAUSE_MAPPING_INSUFFICIENT_EVIDENCE_MESSAGE,

    /**
     * 1d. Evidence-driven clause suggester for NC conversion (client spec #3).
     *
     * When an auditor converts a FOCUS/custom checklist item into a
     * nonconformity, the source question's own clause is NOT trustworthy as
     * the answer — the objective evidence may independently point at a
     * different requirement entirely. This asks the model to apply the
     * governing test verbatim:
     *   "If the original FOCUS/checklist question were removed, which
     *   requirement of the applicable ISO standard would the objective
     *   evidence independently demonstrate was not fulfilled?"
     * reasoning from the evidence and the condition identified — explicitly
     * NOT from sourceQuestion/sourceClause, which are passed only as
     * background context.
     *
     * GUARDRAIL (structural, not just prompted): the model may choose only
     * from the audited standard's real clause inventory —
     * window.state.knowledgeBase.standards[] entries with status 'ready' and
     * a populated clauses[] of {clause, title, requirement}. That inventory
     * is (1) injected into the prompt as the closed candidate list and (2)
     * used again afterwards to validate the model's answer. A clause that
     * does not appear in the inventory is discarded and the result degrades
     * to insufficientEvidence — it is never surfaced to the caller. Returned
     * clauseTitle values are always the KB's own title text for the matched
     * clause, never the model's title, so a title cannot be invented even
     * when a clause number does validate. If the Knowledge Base has no ready
     * standard matching `standard`, this returns insufficientEvidence: true
     * immediately, before any AI call — it never falls back to guessing from
     * clause-number patterns.
     *
     * Never throws: any missing KB standard, network failure, or unparseable
     * AI response degrades to insufficientEvidence: true.
     *
     * @param {Object} params
     * @param {string} params.evidence - Objective evidence gathered by the auditor. Required — empty evidence short-circuits to insufficientEvidence without calling the AI.
     * @param {string} [params.auditorRemarks] - Auditor's own notes/interpretation of the evidence, if any.
     * @param {string} [params.sourceQuestion] - The FOCUS/custom checklist question text. Background context only — must not drive the answer.
     * @param {string} [params.sourceClause] - The source question's own clause. Background context only — must NOT be inherited as the answer.
     * @param {string} params.standard - The audited ISO standard name (e.g. "ISO 9001:2015"). Required — used to select the KB clause inventory that gates every answer.
     * @param {string} [params.department] - Department/process area, for context only.
     * @returns {Promise<{
     *   clause: string|null,
     *   clauseTitle: string|null,
     *   reason: string,
     *   alternatives: Array<{clause: string, clauseTitle: string}>,
     *   confidence: 'high'|'medium'|'low',
     *   insufficientEvidence: boolean
     * }>}
     *   clause/clauseTitle are null and alternatives is [] whenever
     *   insufficientEvidence is true. When insufficientEvidence is true, the
     *   caller should show AI_SERVICE.INSUFFICIENT_EVIDENCE_MESSAGE verbatim
     *   to the auditor — `reason` here carries the specific technical cause
     *   (missing KB standard, out-of-inventory clause, parse/network
     *   failure, etc.) for logging/debugging, not necessarily client-facing
     *   copy.
     */
    suggestFindingClause: async ({ evidence, auditorRemarks, sourceQuestion, sourceClause, standard, department } = {}) => {
        const insufficient = (reason) => ({
            clause: null,
            clauseTitle: null,
            reason: reason || 'Insufficient evidence to suggest a clause.',
            alternatives: [],
            confidence: 'low',
            insufficientEvidence: true
        });

        const evidenceText = String(evidence || '').trim();
        if (!evidenceText) return insufficient('No objective evidence was provided to evaluate.');
        if (!standard || !String(standard).trim()) return insufficient('No audited standard was specified — cannot validate against the Knowledge Base.');

        // Guardrail step 1: the audited standard must have a ready, populated
        // clause inventory in the Knowledge Base. Never fall back to guessing
        // from clause-number patterns when it doesn't (per spec — this is a
        // hard requirement, not a nicety).
        const stdDoc = _findReadyKBStandardDoc(standard);
        if (!stdDoc) {
            return insufficient(`No ready Knowledge Base standard matching "${standard}" was found — clause mapping cannot be validated without a clause inventory.`);
        }

        const validClauses = new Map((stdDoc.clauses || [])
            .filter(c => c && c.clause)
            .map(c => [String(c.clause).trim(), c]));
        if (validClauses.size === 0) {
            return insufficient(`The Knowledge Base entry for "${stdDoc.name || standard}" has no clauses recorded.`);
        }

        const clauseInventoryText = _buildClauseInventoryForPrompt(stdDoc);

        const prompt = `
You are a Senior Lead Auditor at a top-tier international Certification Body, determining the correct ISO clause classification for a nonconformity being raised from FOCUS/custom checklist evidence. The report will be reviewed by a Qualified Registrar before client submission.

GOVERNING TEST — apply this exact test and no other:
"If the original FOCUS/checklist question were removed, which requirement of the applicable ISO standard would the objective evidence independently demonstrate was not fulfilled?"

Reason ONLY from the objective evidence and the actual condition identified below. The source question and its own clause, if provided, are strictly background context to help you understand where this evidence came from — they must NOT determine your answer, and you must NOT simply inherit the source clause as the answer. Independently identify which requirement, if any, the evidence itself demonstrates was not fulfilled.

Audited Standard: ${stdDoc.name || standard}
${department ? `Department/Process Area: ${department}\n` : ''}${sourceQuestion ? `Source Checklist Question (context only — do not inherit its clause): ${sourceQuestion}\n` : ''}${sourceClause ? `Source Question's Own Clause (context only — do NOT default to this): ${sourceClause}\n` : ''}
Objective Evidence:
${evidenceText}
${auditorRemarks ? `\nAuditor Remarks:\n${String(auditorRemarks).trim()}\n` : ''}
Candidate Clauses — you MUST choose the primary clause and any alternatives ONLY from this list, exactly as written. Do not invent, rename, renumber, or paraphrase a clause number or title. If none of these clauses is clearly demonstrated as unfulfilled by the evidence, say so instead of guessing:
${clauseInventoryText}

Confidence rules:
- "high": ONLY when the evidence plainly and specifically demonstrates that one particular requirement above was not fulfilled.
- "medium" or "low": whenever identifying the requirement takes auditor judgement, the evidence is suggestive but not conclusive, or more than one clause is plausible.
- If the evidence does not provide sufficient basis to identify a specific requirement from the list above, set "insufficientEvidence": true, set "clause" and "clauseTitle" to null, and explain why in "reason" — do NOT guess or force a match to the nearest-sounding clause.

Alternative Related Clause(s): only include a clause here where it is genuinely relevant to the same evidence — do not pad the list. Return an empty array if there is no genuinely relevant alternative.

Return raw JSON only (no markdown code fences, no prose outside the JSON):
{
  "clause": "<clause number exactly as it appears in the candidate list above, or null>",
  "clauseTitle": "<its title exactly as it appears in the candidate list above, or null>",
  "reason": "<2-4 sentences grounded in the objective evidence and the specific requirement not fulfilled — not the source question>",
  "alternatives": [{"clause": "...", "clauseTitle": "..."}],
  "confidence": "high" | "medium" | "low",
  "insufficientEvidence": false
}
`;

        let responseText;
        try {
            responseText = await AI_SERVICE.callProxyAPI(prompt);
        } catch (error) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'suggestFindingClause: AI request failed, degrading to insufficientEvidence.', error);
            return insufficient('The AI request failed — clause mapping could not be evaluated automatically.');
        }

        const parsed = _parseClauseSuggestionJSON(responseText);
        if (!parsed) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'suggestFindingClause: could not parse AI response as JSON.');
            return insufficient('The AI response could not be interpreted — clause mapping could not be evaluated automatically.');
        }

        if (parsed.insufficientEvidence === true || !parsed.clause) {
            return insufficient(_stripMdLite(parsed.reason) || 'The available evidence does not clearly demonstrate that a specific requirement was not fulfilled.');
        }

        // Guardrail step 2: validate the model's answer against the SAME
        // inventory passed into the prompt. An out-of-inventory clause is
        // never surfaced to the caller — this is what makes "never invent an
        // ISO clause" a structural guarantee rather than a matter of trusting
        // the model's compliance with the prompt.
        const normalizedClause = window.KB_HELPERS.extractClauseNum(String(parsed.clause).trim());
        const kbEntry = validClauses.get(normalizedClause) || validClauses.get(String(parsed.clause).trim());
        if (!kbEntry) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', `suggestFindingClause: model returned clause "${parsed.clause}" not found in Knowledge Base inventory for "${stdDoc.name}" — discarding rather than surfacing an unvalidated clause.`);
            return insufficient(`The AI suggested a clause not found in the "${stdDoc.name || standard}" Knowledge Base inventory — this has been discarded rather than risking an invented clause reference.`);
        }

        // Alternatives go through the identical validation + KB title
        // lookup. Titles are ALWAYS the KB's own text, never the model's —
        // a title cannot be invented even for a clause number that validates.
        const alternatives = [];
        if (Array.isArray(parsed.alternatives)) {
            parsed.alternatives.forEach(alt => {
                if (!alt || !alt.clause) return;
                const altNorm = window.KB_HELPERS.extractClauseNum(String(alt.clause).trim());
                const altEntry = validClauses.get(altNorm) || validClauses.get(String(alt.clause).trim());
                if (altEntry && altEntry.clause !== kbEntry.clause) {
                    alternatives.push({ clause: altEntry.clause, clauseTitle: altEntry.title || '' });
                }
            });
        }

        let confidence = String(parsed.confidence || '').toLowerCase().trim();
        if (!['high', 'medium', 'low'].includes(confidence)) confidence = 'low'; // unrecognized/missing confidence defaults to the most conservative value

        return {
            clause: kbEntry.clause,
            clauseTitle: kbEntry.title || '',
            reason: _stripMdLite(parsed.reason) || 'The objective evidence indicates this requirement was not fulfilled.',
            alternatives,
            confidence,
            insufficientEvidence: false
        };
    },

    draftExecutiveSummary: async (reportData, compliantAreas = [], observationItems = []) => {
        // Authoritative figures come from ReportStats — the same dataset the
        // finalize gate reconciles narrative against. Fall back to a local
        // tally, kept split by classification (never combined), only when
        // ReportStats hasn't loaded — same graceful-degrade every other
        // consumer in this repo uses.
        const authoritativeCounts = _resolveAuthoritativeCounts(reportData);
        const localCounts = {
            majorNC: (reportData.checklistProgress || []).filter(i => i.status === 'nc' && String(i.ncrType || '').toLowerCase() === 'major').length,
            minorNC: (reportData.ncrs || []).length + (reportData.checklistProgress || []).filter(i => i.status === 'nc' && String(i.ncrType || '').toLowerCase() === 'minor').length,
            observationCount: (reportData.checklistProgress || []).filter(i => i.status === 'nc' && String(i.ncrType || '').toLowerCase() === 'observation').length,
            ofiCount: (reportData.checklistProgress || []).filter(i => i.status === 'nc' && String(i.ncrType || '').toLowerCase() === 'ofi').length
        };
        const stats = authoritativeCounts || localCounts;
        // Combined only for the "N non-conformities" phrase, matching how
        // report-integrity.js's B13 check reconciles that specific wording.
        // Observations and OFIs stay separate everywhere else in the prompt.
        const ncCount = stats.majorNC + stats.minorNC;

        let areaText = "No specific compliant areas recorded.";
        if (compliantAreas.length > 0) {
            areaText = compliantAreas.join(', ');
        }

        // Format observation items for the prompt
        let obsText = '';
        if (observationItems.length > 0) {
            obsText = observationItems.map((o, i) => `${i + 1}. Clause ${o.clause}: ${o.text}${o.comment ? ' — Auditor note: ' + o.comment : ''}`).join('\n');
        }

        // Get KB context for more accurate positive observations
        const kbContext = reportData.standard ? AI_SERVICE.getRelevantKBClauses(reportData.standard) : '';

        // Get Organization Context & Audit Plan details
        const orgPlanContext = KB_HELPERS.getOrgAndPlanContext(reportData);

        // Build opening meeting context
        let openingMeetingContext = '';
        if (reportData.openingMeeting) {
            const om = reportData.openingMeeting;
            const parts = [];
            if (om.date) parts.push(`Date: ${om.date}${om.time ? ' at ' + om.time : ''}`);
            if (om.attendees) {
                if (Array.isArray(om.attendees)) {
                    const attList = om.attendees.map(a => typeof a === 'object' ? `${a.name || ''}${a.role ? ' (' + a.role + ')' : ''}${a.organization ? ' - ' + a.organization : ''}` : a).filter(Boolean).join(', ');
                    parts.push(`Attendees: ${attList}`);
                } else {
                    parts.push(`Attendees: ${om.attendees}`);
                }
            }
            if (om.notes) parts.push(`Notes: ${om.notes}`);
            if (om.keyPointers) {
                const pointers = Object.entries(om.keyPointers).filter(([, v]) => v).map(([k]) => k);
                if (pointers.length > 0) parts.push(`Key Points Covered: ${pointers.join(', ')}`);
            }
            if (parts.length > 0) openingMeetingContext = `\nOpening Meeting:\n${parts.join('\n')}\n`;
        }

        // Get Audit Plan Objectives, Criteria, Methodology context
        let planScopeContext = '';
        if (reportData.planId && window.state?.auditPlans) {
            const plan = window.DataService.findAuditPlan(reportData.planId);
            if (plan) {
                const parts = [];
                if (plan.auditObjectives) parts.push(`Audit Objectives:\n${plan.auditObjectives}`);
                if (plan.auditCriteria) parts.push(`Audit Criteria:\n${plan.auditCriteria}`);
                if (plan.auditMethodology) parts.push(`Audit Methodology:\n${plan.auditMethodology}`);
                if (parts.length > 0) planScopeContext = `\n${parts.join('\n\n')}\n`;
            }
        }

        const prompt = `
You are a Senior Lead Auditor with over 30 years of experience at a top-tier international Certification Body (e.g., BSI, Bureau Veritas, DNV, TÜV, SGS). Write an Executive Summary, Positive Observations, and Opportunities for Improvement for a formal Audit Report that will be submitted to the client. Your writing must reflect the authority, precision, and measured judgment of a seasoned CB professional. The report will be reviewed and attested by a Qualified Registrar before client submission.

Context:
- Client: ${reportData.client}
- Standard: ${reportData.standard || 'ISO Standard'}
- Date: ${reportData.date}
- Major Non-Conformities: ${stats.majorNC}
- Minor Non-Conformities: ${stats.minorNC}
- Total Non-Conformities (Major + Minor): ${ncCount}
- Observations: ${stats.observationCount}
- Opportunities for Improvement (OFI): ${stats.ofiCount}
- Compliant Clauses/Areas: ${areaText}
${orgPlanContext}
${openingMeetingContext}
${planScopeContext}
${kbContext ? `
Standard Requirements (from Knowledge Base):
${kbContext}
` : ''}
${obsText ? `
Audit Observations & OFI Findings (from checklist):
${obsText}
` : ''}
AUTHORITATIVE COUNTS — TREAT AS FACT, DO NOT RECOMPUTE:
The five figures above (Major NC, Minor NC, Total NC, Observations, OFI) are taken directly from the validated audit dataset. Use them verbatim, exactly as given. Do NOT recount, re-derive, estimate, round, or infer these numbers from the findings text elsewhere in this prompt.
Observations and Opportunities for Improvement are SEPARATE ISO audit classifications and must NEVER be summed, merged, or reported as a single combined figure — for example, do not write "${stats.observationCount + stats.ofiCount} opportunities for improvement" or "${stats.observationCount + stats.ofiCount} observations/OFIs"; state Observations (${stats.observationCount}) and OFI (${stats.ofiCount}) as two distinct numbers wherever both are mentioned. Nonconformity counts cover Major and Minor only — never fold Observations or OFIs into a nonconformity count either.

CRITICAL RULES — CCI Gold Standard:
- Do NOT use percentage scoring or compliance percentages anywhere in the report
- Do NOT mix clauses across different standards — if multiple standards are audited, keep them clearly separated
- Use legally defensible, accreditation-ready language suitable for external review by an accreditation body
- The report must follow ISO 17021 certification body reporting requirements
- Never state, estimate, or imply financial figures, revenue, penalties, contract values, customer loss, or reputational damage unless the exact figure appears in the context provided above
- Never assert a certification decision or recommendation — that is decided separately by the audit team, not drafted by you
- Never describe a finding as recurring, repeated, persistent, or systemic unless the prior-audit records provided above demonstrate it
- Never assess the management system's maturity, health or resilience, and never use this vocabulary: maturity, mature, foundational, robustness, resilience, strategic integration, strategic value, journey, posture. Maturity is a scored analytic that belongs in the management annex, not an impression in a certification narrative
- State the audit location exactly as given in the Sites line of the context above — never name a city that does not appear there
- Prefer plain, objective audit language: requirement, objective evidence, evaluation, finding

Instructions:
1. Executive Summary: Write a comprehensive, authoritative paragraph (150-250 words) summarizing the audit scope, methodology, and overall conclusion. Open with the audit context (type, standard, dates). ${planScopeContext ? 'Reference the stated audit objectives and methodology from the audit plan.' : ''} Briefly reference the opening meeting (attendees, date). State the overall assessment outcome, mentioning the number of non-conformities (${ncCount}), observations (${stats.observationCount}) and opportunities for improvement (${stats.ofiCount}) as three separate figures — never combine observations and OFI into one number. Conclude by stating what the sampled evidence showed about conformity with the audit criteria and which processes carry the open findings — a factual closing statement, not an impression, a grade, or a maturity verdict. Keep the register plain and objective: requirement, objective evidence, evaluation, finding.
2. Positive Observations: Based on the "Compliant Clauses/Areas" listed above${kbContext ? ' and the standard requirements from the Knowledge Base,' : ','} generate 4-6 specific positive observations. Each must reference the specific clause number and title (e.g. "Clause 5.1 Leadership and commitment"). Describe the specific objective evidence of effective implementation observed. Use authoritative language (e.g., "The audit team confirmed that the organization has established a well-embedded approach to...", "Through examination of records and interviews, the assessment confirmed mature implementation of..."). Do NOT use markdown formatting. Each observation MUST be on its own numbered line (1. 2. 3. etc).
3. OFI: ${obsText ? 'Based on the "Audit Observations & OFI Findings" listed above, write specific, actionable opportunities for improvement that reference the actual observations raised during the audit. Include the relevant clause numbers and reference specific documents, procedures, or records where improvement is recommended.' : 'Write a list of specific, actionable opportunities for improvement referencing relevant clause requirements.'} Use measured, constructive improvement language befitting a senior auditor (e.g., "The organization would benefit from further developing...", "The audit team recommends consideration of...", "The organization may consider strengthening the control described in..."). These are NOT non-conformities.

IMPORTANT: Return plain text only. Do NOT use markdown formatting like **, ***, ##, or bullet symbols in any field values. Use numbered lists (1. 2. 3.) instead. Each numbered item MUST be separated by a newline character.

Return raw JSON:
{
  "executiveSummary": "...",
  "positiveObservations": "1. First observation\\n2. Second observation\\n3. Third observation",
  "ofi": ["...", "..."]
}
`;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            const json = JSON.parse(apiResponseText.replace(/```json/g, '').replace(/```/g, '').trim());

            // Deterministic post-generation guard: even with the counts stated
            // verbatim above, the model can still drift. Correct any stated count
            // that disagrees with ReportStats for its exact classification;
            // anything this can't resolve safely is left for report-integrity.js's
            // B13 check to block at finalize rather than risk an invented rewrite.
            if (authoritativeCounts) {
                if (typeof json.executiveSummary === 'string') {
                    json.executiveSummary = _reconcileNarrativeCounts(json.executiveSummary, authoritativeCounts, 'executiveSummary');
                }
                if (typeof json.positiveObservations === 'string') {
                    json.positiveObservations = _reconcileNarrativeCounts(json.positiveObservations, authoritativeCounts, 'positiveObservations');
                }
                if (Array.isArray(json.ofi)) {
                    json.ofi = json.ofi.map((entry, idx) => typeof entry === 'string'
                        ? _reconcileNarrativeCounts(entry, authoritativeCounts, `ofi[${idx}]`)
                        : entry);
                }
            }

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

        // Build previous audit findings section if available
        let previousAuditSection = '';
        if (ctx.previousAudit) {
            const pa = ctx.previousAudit;
            let ncList = '';
            if (pa.ncFindings && pa.ncFindings.length > 0) {
                ncList = pa.ncFindings.map(nc => `  - [${nc.severity}] Clause ${nc.clause}: ${nc.description}`).join('\n');
            }
            previousAuditSection = `
**Previous Audit Findings (${pa.auditType || 'Audit'} — ${pa.date}):**
- Recommendation: ${pa.recommendation || 'N/A'}
- Total Non-Conformities: ${pa.ncCount || 0}
${ncList ? '- NC Details:\n' + ncList : ''}
${pa.ofiSummary ? '- Opportunities for Improvement: ' + pa.ofiSummary : ''}
${pa.positiveObservations ? '- Positive Observations: ' + pa.positiveObservations : ''}

**IMPORTANT — Previous Findings Follow-up:**
- Allocate dedicated time to verify CORRECTIVE ACTIONS for each NC from the previous audit.
- Prioritize clauses that had non-conformities: ensure objective evidence of closure.
- Note any recurring problem areas and schedule deeper sampling in those processes.
`;
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
- Key Designations: ${(ctx.designations || []).map(d => d.title || d).join(', ')}${personnelSection}${previousAuditSection}${ctx.clientDocumentContext || ''}
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
${ctx.previousAudit ? '10. Include a dedicated "Previous Findings Follow-up / CAPA Verification" session referencing the specific NC clauses from the previous audit.' : ''}
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
                    } catch (_e) {
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
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey
                        },
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

                    return AI_SERVICE.extractTextFromResponse(data);

                } catch (error) {
                    console.warn(`Direct API fallback: ${model} unavailable, trying next...`);
                    lastError = error;
                }
            }
        }


        // If all hardcoded models fail, try to dynamically fetch available models
        try {
            const availableModels = await AI_SERVICE.getAvailableModels();

            // Filter for content generation models and sort by preference (Gemini 2.0 > 1.5 > Pro)
            const viableModels = availableModels
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', '')) // Remove prefix if present
                .filter(name => !models.includes(name)); // Avoid re-trying failed ones


            if (viableModels.length === 0) {
                throw new Error('No compatible AI models found for your API Key.');
            }

            // Try the dynamically found models
            for (const model of viableModels) {
                try {
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
                } catch (_e) {
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
        } catch (_e) { /* try next strategy */ }

        // Strategy 2: Extract JSON array [...] from the text (greedy to handle nested objects)
        const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                const json = JSON.parse(arrayMatch[0]);
                if (Array.isArray(json)) return json;
            } catch (_e) { /* try next strategy */ }
        }

        // Strategy 3: Extract individual JSON objects and collect them
        const objects = [];
        const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
        let match;
        while ((match = objRegex.exec(cleanText)) !== null) {
            try {
                objects.push(JSON.parse(match[0]));
            } catch (_e) { /* skip invalid */ }
        }
        if (objects.length > 0) return objects;

        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Failed to parse AI response. Please try again.");
    }
};

// Window export (used by all existing code)
window.AI_SERVICE = AI_SERVICE;

// ============================================
// SMART AUDIT WORKFLOW HELPERS (Consolidated)
// ============================================
// Moved from smart-workflow-helpers.js for single-file AI logic

// ─── Cheap content fingerprint for issued-report drift detection ──────────────
// djb2 over a stable JSON serialization of findings + stats. Not cryptographic —
// good enough to flag "this report changed since it was issued" so exports can
// warn the operator to re-issue. Shared with execution-reporting.js via
// window._reportContentHash (loaded after this file, but both are only invoked
// at user-interaction time, well after both scripts have executed).
function _djb2Hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & 0xFFFFFFFF;
    }
    return (h >>> 0).toString(16);
}
// Resolve a report's client by every identifier the report and its plan carry.
// Matching on report.clientId alone silently returned undefined for reports
// saved without one — and a client that resolves to undefined has no
// certificates, which made the integrity validator report "no certificate on
// file" for a client that plainly has one. Delegates to DataService so there is
// one resolver; the inline fallback keeps this working if DataService is absent.
function _resolveClientForReport(report, plan) {
    try {
        if (window.DataService && typeof window.DataService.resolveReportClient === 'function') {
            return window.DataService.resolveReportClient(report, plan);
        }
    } catch (_e) { /* fall through */ }
    const clients = (window.state && window.state.clients) || [];
    const ids = [report && report.clientId, plan && plan.clientId].filter(v => v != null);
    return clients.find(c => ids.some(id => String(c.id) === String(id)))
        || clients.find(c => String(c.name || '').trim().toLowerCase()
            === String((report && report.client) || '').trim().toLowerCase());
}

window._reportContentHash = function (report, statsSummary) {
    try {
        const findings = (report.checklistProgress || [])
            .filter(i => i && i.status === 'nc')
            .map(i => ({ clause: i.clause, ncrType: i.ncrType, comment: i.comment }));

        // Master-data drift detection: fold in the resolved client name + primary
        // site address so an edit to the client record AFTER issuance (e.g. a
        // corrected site address) also trips the MODIFIED SINCE ISSUE banner, not
        // just changes to the report's own findings/stats.
        let clientName = report.client || '';
        let primarySiteAddress = '';
        try {
            const client = _resolveClientForReport(report, null);
            if (client) {
                clientName = client.name || clientName;
                const site = Array.isArray(client.sites) && client.sites[0];
                if (site) primarySiteAddress = site.address || '';
            }
        } catch (_e) { /* best-effort — hash still valid without master-data fields */ }

        const payload = JSON.stringify({
            findings,
            ncrs: report.ncrs || [],
            statsSummary: statsSummary || null,
            clientName,
            primarySiteAddress
        });
        return _djb2Hash(payload);
    } catch (e) { return '0'; }
};

// Roles permitted to finalize/re-issue a report. Enforced here (not just at the
// button-visibility level) so finalizeAndPublish can't be bypassed by calling it
// directly.
const REPORT_ISSUANCE_ROLES = ['Lead Auditor', 'Admin', 'Certification Manager'];
function _hasReportIssuanceRole() {
    try {
        if (window.AuthManager && typeof window.AuthManager.hasRole === 'function') {
            return !!window.AuthManager.hasRole(REPORT_ISSUANCE_ROLES);
        }
    } catch (e) { /* fall through */ }
    return true; // AuthManager not wired in this environment — fail open rather than lock out.
}

// Shared pre-issuance gate. Computes everything finalizeAndPublish checks
// BEYOND the ReportIntegrity validator (scope, lead auditor, ReportStats
// reconciliation, technical review) plus the validator's own result. Exposed
// on window so the Finalization tab's Report Integrity panel can display the
// SAME totals the Finalize gate enforces — previously the panel counted only
// validator items, so its numbers disagreed with the Finalize dialog (e.g.
// 7 warnings in the panel vs 9 at finalize) and the check button looked broken.
// Returns { report, plan, stats, gateBlockers, gateWarnings, integrity } or
// null when the report cannot be found.
window.computeIssuanceGate = function (reportId) {
    const report = window.DataService.findAuditReport(reportId);
    if (!report) return null;

    const plan = (window.state && window.state.auditPlans || []).find(p => String(p.id) === String(report.planId));
    const gateBlockers = [];
    const gateWarnings = [];

    const scopeText = report.scope || report.auditScope || (plan && (plan.auditObjectives || plan.scope || plan.auditCriteria));
    if (!scopeText) gateBlockers.push('Audit scope/criteria is not recorded on the report or linked audit plan.');

    // Lead auditor: fall back to the linked plan, mirroring the scope check above.
    // report.leadAuditor is only backfilled when the report PREVIEW is opened
    // (execution-reporting.js:320-331), so finalizing without having opened the preview
    // blocked on a name the plan already holds. Resolve and persist it here instead.
    if (!report.leadAuditor && plan) {
        const auditors = (window.state && window.state.auditors) || [];
        const resolveName = function (v) {
            if (!v) return '';
            if (typeof v === 'object') return v.name || '';
            const a = auditors.find(x => String(x.id) === String(v));
            return a ? a.name : String(v);
        };
        report.leadAuditor = resolveName(plan.leadAuditor)
            || resolveName(plan.lead)
            || resolveName(plan.teamIds && plan.teamIds[0])
            || resolveName(plan.team && plan.team[0])
            || '';
    }

    if (!report.leadAuditor) gateBlockers.push('Lead auditor is not set on the report.');

    let rs = null;
    try {
        if (window.ReportStats && typeof window.ReportStats.build === 'function') {
            const hydratedProgress = report.checklistProgress || [];
            const client = _resolveClientForReport(report, plan);
            rs = window.ReportStats.build({ report, hydratedProgress, auditPlan: plan, client });
        }
    } catch (e) { console.error('ReportStats.build failed during finalize gate:', e); }

    const reconciliation = (rs && Array.isArray(rs.reconciliation)) ? rs.reconciliation : [];
    const hasPendingClassification = reconciliation.some(r => r.code === 'pending_classification')
        || (report.checklistProgress || []).some(i => i.status === 'nc' && !i.ncrType);
    if (hasPendingClassification) gateBlockers.push('One or more findings are still pending severity classification.');

    // 'coverage_gap' is downgraded to a warning per spec; every other reconciliation
    // code is treated as error-level and blocks finalize.
    reconciliation.forEach(r => {
        if (r.code === 'coverage_gap') return;
        gateBlockers.push('Data quality: ' + (r.message || r.code));
    });

    const coverageGap = reconciliation.find(r => r.code === 'coverage_gap');
    if (coverageGap) gateWarnings.push(coverageGap.message || 'Audit coverage is incomplete.');

    const auditTypeStr = String((plan && plan.auditType) || report.auditType || '').toLowerCase();
    const isCertificationType = /stage|surveillance|recert/i.test(auditTypeStr);
    const reviewOutcome = report.technicalReview && report.technicalReview.outcome;
    if (isCertificationType && reviewOutcome !== 'Approved') {
        gateWarnings.push('Technical review outcome is not "Approved" for this certification-type audit.');
    }

    // ─── Report Integrity Validator: additional cross-cutting checks (evidence,
    // criterion refs, chronology, financial claims, AI-content review, etc).
    // Defensive — the validator module may not have loaded, or may throw on
    // unexpected data shapes; never let it block finalize on its own failure. ───
    let integrityResult = null;
    try {
        if (window.ReportIntegrity && typeof window.ReportIntegrity.check === 'function') {
            const client = _resolveClientForReport(report, plan);
            integrityResult = window.ReportIntegrity.check({ report, auditPlan: plan, client, stats: rs });
        }
    } catch (e) { console.error('ReportIntegrity.check failed during finalize gate:', e); }

    return { report, plan, stats: rs, gateBlockers, gateWarnings, integrity: integrityResult };
};

// 1. Finalize & Publish (One-Click Workflow)
window.finalizeAndPublish = function (reportId) {
    if (!_hasReportIssuanceRole()) {
        window.showNotification && window.showNotification('You do not have permission to finalize this report.', 'error');
        return;
    }

    // ─── Issuance gate: hard blockers stop finalize outright; soft warnings need
    // an explicit confirm before proceeding ───
    const gate = window.computeIssuanceGate(reportId);
    if (!gate) return;
    const report = gate.report;
    const rs = gate.stats;
    const integrityResult = gate.integrity;
    const blockers = gate.gateBlockers.slice();
    const warnings = gate.gateWarnings.slice();

    if (integrityResult) {
        integrityResult.blockers.forEach(b => blockers.push(b.message));
        integrityResult.warnings.forEach(w => warnings.push(w.message));
    }

    if (blockers.length) {
        const infoCount = integrityResult ? integrityResult.information.length : 0;
        const preview = blockers.slice(0, 5).map(m => '- ' + m).join('\n');
        const more = blockers.length > 5 ? `\n… and ${blockers.length - 5} more.` : '';
        alert(
            'REPORT INTEGRITY — Blockers: ' + blockers.length + ' / Warnings: ' + warnings.length + ' / Information: ' + infoCount +
            '\n\nThis report cannot be finalized yet:\n\n' + preview + more
        );
        return;
    }
    if (warnings.length) {
        const infoCount = integrityResult ? integrityResult.information.length : 0;
        const preview = warnings.slice(0, 5).map(m => '- ' + m).join('\n');
        const more = warnings.length > 5 ? `\n… and ${warnings.length - 5} more.` : '';
        const proceed = confirm(
            'REPORT INTEGRITY — Blockers: 0 / Warnings: ' + warnings.length + ' / Information: ' + infoCount +
            '\n\nThe following issues were found but do not block finalization:\n\n' + preview + more + '\n\nFinalize anyway?'
        );
        if (!proceed) return;
    }

    if (!confirm('Are you sure you want to finalize and publish this report? This will lock the audit.')) return;

    // Save current state first
    window.saveChecklist(reportId);

    // ─── Versioning: bump ONLY here, on finalize/re-issue, authored by the ACTUAL
    // current user (not report.leadAuditor). Replaces the old +0.1-per-export scheme
    // that lived in execution-reporting.js. ───
    const issuerName = (window.state && window.state.currentUser && window.state.currentUser.name) || 'Unknown User';
    const nowIso = new Date().toISOString();
    if (!Array.isArray(report.issueLog)) report.issueLog = [];
    const isReissue = report.issueLog.length > 0;
    const lastVer = isReissue ? (parseFloat(report.issueLog[report.issueLog.length - 1].version) || 1.0) : 0;
    const newVersion = isReissue ? (lastVer + 0.1).toFixed(1) : '1.0';
    report.issueLog.push({ version: newVersion, at: nowIso, by: issuerName, action: isReissue ? 'reissued' : 'issued' });

    const statsSummary = rs ? {
        majorNC: rs.majorNC, minorNC: rs.minorNC, observationCount: rs.observationCount,
        ofiCount: rs.ofiCount, coveragePct: rs.coveragePct, conformityPct: rs.conformityPct,
        recommendation: rs.recommendation
    } : null;
    const contentHash = window._reportContentHash(report, statsSummary);
    report.issuedSnapshot = { version: newVersion, issuedAt: nowIso, issuedBy: issuerName, statsSummary, contentHash };
    // Finalize is the ONLY path that clears the draft/watermark state.
    report.reportStatus = 'final';

    // Update status to FINALIZED directly
    report.status = window.CONSTANTS.STATUS.FINALIZED;
    report.finalizedAt = nowIso;
    report.finalizedBy = issuerName;

    // Persist to Database
    (async () => {
        try {
            await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                status: report.status,
                data: report
            });
            if (typeof window.saveData === 'function') window.saveData();
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
    const report = window.DataService.findAuditReport(reportId);
    if (!report) return;

    const btn = document.querySelector(`button[data-action="runFollowUpAIAnalysis"][data-id="${reportId}"]`);
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
        suggestions.forEach(s => {
            if (s.type && ['major', 'minor', 'observation'].includes(s.type.toLowerCase())) {
                const finding = findings.find(f => f.id === s.id);
                if (finding && report.checklistProgress[finding.originalIdx]) {
                    report.checklistProgress[finding.originalIdx].ncrType = s.type.toLowerCase();
                    report.checklistProgress[finding.originalIdx]._aiGenerated = true;
                    report.checklistProgress[finding.originalIdx]._auditorConfirmed = false;
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
    const report = window.DataService.findAuditReport(reportId);
    if (!report) return;

    const btn = document.querySelector(`button[data-action="runAutoSummary"][data-id="${reportId}"]`);
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Drafting...';
    btn.disabled = true;

    try {
        // Gather compliant items for Positive Observations using shared helper
        const compliantItems = [];
        const plan = window.DataService.findAuditPlan(report.planId) || {};
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

        // Gather OBS/OFI items for AI analysis
        const obsItems = [];
        if (report.checklistProgress) {
            report.checklistProgress.filter(p => p.status === 'nc' && (!p.ncrType || p.ncrType.toLowerCase() === 'observation' || p.ncrType.toLowerCase() === 'ofi')).forEach(item => {
                const { clauseText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);
                obsItems.push({
                    clause: clauseText || item.clause || item.id,
                    text: item.requirement || item.description || item.text || clauseText || '',
                    comment: item.comment || ''
                });
            });
        }

        const result = await window.AI_SERVICE.draftExecutiveSummary(report, uniqueCompliantAreas, obsItems);

        // Helper to strip any remaining markdown from AI response
        const stripMd = (text) => text ? text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/^#+\s*/gm, '').replace(/^[-•]\s*/gm, '').trim() : '';

        // Guard against silently clobbering auditor-edited text: if a field already
        // has non-empty content that would change, require explicit confirmation
        // and preserve the previous value for recovery.
        const trim = (s) => (s == null ? '' : String(s)).trim();
        const confirmOverwrite = (fieldLabel, existing, incoming) => {
            if (!existing || !trim(existing) || trim(existing) === trim(incoming)) return true;
            return confirm(`Overwrite the current ${fieldLabel} text with a new AI draft?`);
        };

        if (result.executiveSummary) {
            const draft = stripMd(result.executiveSummary);
            if (confirmOverwrite('Executive Summary', report.executiveSummary, draft)) {
                if (trim(report.executiveSummary) && trim(report.executiveSummary) !== trim(draft)) {
                    report._previousExecutiveSummary = report.executiveSummary;
                }
                report.executiveSummary = draft;
                const execInput = document.getElementById('exec-summary-' + reportId) || document.getElementById('exec-summary');
                if (execInput) execInput.value = report.executiveSummary;
            }
        }

        if (result.positiveObservations) {
            const draft = stripMd(Array.isArray(result.positiveObservations) ? result.positiveObservations.join('\n') : result.positiveObservations);
            if (confirmOverwrite('Positive Observations', report.positiveObservations, draft)) {
                if (trim(report.positiveObservations) && trim(report.positiveObservations) !== trim(draft)) {
                    report._previousPositiveObservations = report.positiveObservations;
                }
                report.positiveObservations = draft;
                const posInput = document.getElementById('positive-observations');
                if (posInput) posInput.value = report.positiveObservations;
            }
        }

        if (result.ofi && Array.isArray(result.ofi)) {
            const draft = result.ofi.map(s => stripMd(s)).join('\n');
            if (confirmOverwrite('Opportunities for Improvement', report.ofi, draft)) {
                if (trim(report.ofi) && trim(report.ofi) !== trim(draft)) {
                    report._previousOfi = report.ofi;
                }
                report.ofi = draft;
                const ofiInput = document.getElementById('ofi');
                if (ofiInput) ofiInput.value = report.ofi;
            }
        }

        report.aiContent = Object.assign({}, report.aiContent, {
            execSummary: { status: 'draft', generatedAt: new Date().toISOString(), generatedBy: 'gemini' }
        });

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

// 4. Confirm AI-generated content (auditor sign-off)
// Flips _aiGenerated checklist items to _auditorConfirmed:true and report.aiContent
// entries to status:'approved'. CSP-safe: exposed on window so a data-action button
// (built by another agent's UI panel) can invoke it without an inline handler.
// scope: 'all' (default) | 'findings' (checklistProgress only) | an aiContent key
// (e.g. 'execSummary') to confirm just that piece of narrative content.
window.confirmAiContent = function (reportId, scope) {
    const report = window.DataService.findAuditReport(reportId);
    if (!report) return false;

    const targetScope = scope || 'all';
    let changed = false;

    if (targetScope === 'all' || targetScope === 'findings') {
        (report.checklistProgress || []).forEach(item => {
            if (item && item._aiGenerated === true && item._auditorConfirmed !== true) {
                item._auditorConfirmed = true;
                changed = true;
            }
        });
    }

    if (report.aiContent) {
        Object.keys(report.aiContent).forEach(key => {
            if (targetScope !== 'all' && targetScope !== 'findings' && targetScope !== key) return;
            const entry = report.aiContent[key];
            if (entry && entry.status !== 'approved') {
                entry.status = 'approved';
                entry.approvedAt = new Date().toISOString();
                changed = true;
            }
        });
    }

    if (changed) {
        if (typeof window.saveChecklist === 'function') window.saveChecklist(reportId);
        else if (typeof window.saveData === 'function') window.saveData();
        window.showNotification && window.showNotification('AI-generated content confirmed by auditor.', 'success');
    }

    return changed;
};

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_SERVICE;
}

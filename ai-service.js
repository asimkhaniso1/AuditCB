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
     * Eliminates duplicated fallback chains across the AI callers (runAutoSummary and others).
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

// Spelled-out numerals a narrative sentence might use instead of digits (e.g.
// "Four minor non-conformities were identified"). Digit-only regexes miss
// these entirely — the exact gap that let a report ship stating "Four minor
// non-conformities" while naming only one of the four affected clauses,
// because nothing downstream ever parsed "Four" as the number 4 to check it
// against anything. Covers 0-20, the realistic range for a finding count;
// anything stated beyond that already reads as a digit in practice.
const _NUMBER_WORDS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20
};
const _NUMBER_WORD_RE = Object.keys(_NUMBER_WORDS).join('|');
// A matched numeral group is either digits or one of the words above; resolve
// either form to its integer value.
function _parseStatedNumber(raw) {
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    const n = _NUMBER_WORDS[String(raw || '').toLowerCase()];
    return n == null ? NaN : n;
}

// Same regexes report-integrity.js's B13 check uses to parse narrative counts,
// duplicated deliberately (this file may not load after report-integrity.js) so
// that whatever this guard leaves uncorrected is exactly what B13 would block.
const _NARRATIVE_COUNT_PATTERNS = [
    { key: 'ncTotal', re: new RegExp(`(\\d+|${_NUMBER_WORD_RE})(\\s+(?:minor\\s+)?non-?conformit(?:y|ies))`, 'gi'), unitRe: /conformit(y|ies)/i },
    { key: 'ofiCount', re: new RegExp(`(\\d+|${_NUMBER_WORD_RE})(\\s+opportunit(?:y|ies)\\s+for\\s+improvement)`, 'gi'), unitRe: /opportunit(y|ies)/i },
    { key: 'observationCount', re: new RegExp(`(\\d+|${_NUMBER_WORD_RE})(\\s+observations?)\\b`, 'gi'), unitRe: /observations?/i }
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
                const stated = _parseStatedNumber(digits);
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

// ============================================
// CLIENT-FACING EVIDENCE STATEMENT HELPERS (client spec #10)
// ============================================
// "Never invent a fact" needs the same structural treatment here that
// suggestFindingClause() gives clause numbers above: a deterministic
// pre-filter for notes too thin to safely expand, plus a deterministic
// post-generation numeric-token check, so a faithful raw-note fallback is
// what ships whenever the model's own judgement can't be fully trusted —
// never an invention.

// A raw note this thin (word count, not character count) cannot be expanded
// into a statement without guessing at unstated context — "Website." is the
// spec's own example. Kept intentionally low (<=2 words) so it only catches
// genuinely content-free fragments; "Records Are Available." (3 words) and
// "8 now total emplyees." (4 words) both carry enough to work from and are
// sent to the model.
const EVIDENCE_STATEMENT_SPARSE_MAX_WORDS = 2;

function _evidenceWordCount(text) {
    const t = String(text || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
}

// Same field-priority convention already used by refineAuditNotes/
// generateConformanceText for locating an item's raw note text, with
// `rawNote` checked first for callers that already model the two-field
// (raw vs client-facing) contract this function introduces.
function _extractRawNoteText(item) {
    if (!item) return '';
    return String(item.rawNote || item.comment || item.remarks || item.transcript || item.ncrDescription || item.description || '').trim();
}

// Mechanical-only fallback: defers to the canonical window.ReportStats.
// cleanEvidenceText() (whitespace/capitalization/terminal period/entity
// cleanup — never rewording) per this task's instruction not to reimplement
// it. Falls back to an equivalent local mechanical pass only when
// ReportStats hasn't loaded, so this never throws and never invents wording
// either way.
function _mechanicalCleanFallback(raw) {
    try {
        if (window.ReportStats && typeof window.ReportStats.cleanEvidenceText === 'function') {
            return window.ReportStats.cleanEvidenceText(raw);
        }
    } catch (_e) { /* fall through to local mechanical pass */ }
    let text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!text) return text;
    text = text.charAt(0).toUpperCase() + text.slice(1);
    if (/[A-Za-z0-9]$/.test(text)) text += '.';
    return text;
}

// Deterministic numeric-token safety net (client spec #10, task 4).
// Extracts digit-led tokens (numbers, dates, percentages, decimals — e.g.
// "2", "2-week", "50%", "2024-01-05") from a string. Boundary punctuation
// (leading/trailing separators) is trimmed so "2." at a sentence end and a
// bare "2" compare equal; internal separators (decimals, date dashes/slashes)
// are kept so "2024-01-05" isn't fragmented into unrelated single digits.
function _extractNumericTokens(text) {
    if (!text) return [];
    const matches = String(text).match(/\d[\d,.:/-]*%?/g) || [];
    return matches
        .map(m => m.replace(/^[,.:/-]+|[,.:/-]+$/g, ''))
        .filter(Boolean);
}

// Returns the list of numeric tokens present in `proposed` but absent from
// `raw` — i.e. numbers/dates/percentages the model's rewrite introduced that
// the auditor's own note never stated. An empty array means the proposal is
// clean; ANY entry means the whole proposal for that item must be rejected
// (never trimmed down to "just the sentence with the new number removed" —
// a proposal that needed an invented number to read naturally is not safe to
// partially salvage).
function _introducedNumericTokens(raw, proposed) {
    const rawTokens = new Set(_extractNumericTokens(raw));
    const proposedTokens = _extractNumericTokens(proposed);
    return proposedTokens.filter(t => !rawTokens.has(t));
}

// ---------- AI evidence explanation (phase 1, 2026-11-19) ----------
// One call per audit question with all its screenshots: what each image
// shows (with exact quotes of visible text), how the evidence relates to the
// question, what it does not show, and a suggested assessment of the evidence
// — never a conformity conclusion. Checked before anyone sees it: a sentence
// that names a figure, date or document not found in the screenshots' quoted
// text, the auditor's remark, the question or the requirement is removed and
// flagged, and so is any conformity wording. Nothing here writes to a
// checklist answer; the result is a draft record for the auditor to review.
// ev2 (pilot fixes, 2026-11-19): every figure the AI mentions must be quoted;
// one-line descriptions; an explicit check of each part of the question;
// nothing read from an unreadable image; no assessment from a remark alone.
const EVIDENCE_PROMPT_VERSION = 'ev2';
const EVIDENCE_MAX_QUOTES = 20;
const EVIDENCE_CHECK_FINDINGS = ['shown', 'partly_shown', 'not_shown', 'differs'];
// Gemini 2.5 Flash, by the legacy name /api/gemini maps to it. In the pilot
// the default (2.5 Flash-Lite) called a late account removal "matching" and
// missed columns a register showed; 2.5 Flash got every comparison right
// (about $0.30 an audit against $0.02; user decision 2026-11-19). Only this
// model is tried: a silent fall back to Lite would hide the quality drop.
const EVIDENCE_MODEL = 'gemini-2.0-flash-lite';
const EVIDENCE_IMAGE_MAX_PX = 1280;
const EVIDENCE_IMAGE_QUALITY = 0.7;
const EVIDENCE_MAX_IMAGES = 6;
const EVIDENCE_ASSESSMENTS = ['supports', 'partially_supports', 'insufficient', 'cannot_determine'];
const EVIDENCE_RELEVANCE = ['relevant', 'partial', 'irrelevant', 'unreadable'];
const EVIDENCE_CONCLUSION_RE = /\b(non-?conform\w*|conform(?:s|ed|ing|ity|ance)?|compliant|non-?compliant|compliance)\b/i;
const EVIDENCE_DOC_NAME_RE = /\b(?:[A-Z][\w&/-]*\s+){1,5}(?:Policy|Procedure|Register|Plan|Report|Log|Matrix|Manual|Standard|SOP|Records?|Schedule|Minutes)\b/g;

function _fnv1a(str) {
    let h = 0x811c9dc5;
    const s = String(str == null ? '' : str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
}

// Same inputs, same hash: a question is only sent again when its question,
// requirement, remark, screenshots, model or this prompt version changed.
function _evidenceInputHash(input, model) {
    const i = input || {};
    const images = (Array.isArray(i.images) ? i.images : []).map((im) => String((im && im.evId) || '') + ':' + _fnv1a(String((im && (im.src || im.dataUrl)) || '')));
    return EVIDENCE_PROMPT_VERSION + '-' + _fnv1a(JSON.stringify({ q: i.question || '', c: i.clause || '', r: i.requirements || [], m: i.remark || '', i: images, model: model || '' }));
}

// Sentences, without splitting at an initial or a common abbreviation: the
// pilot cut "Approved: M. Chen, 02-Oct-2026" at "M." and then dropped the rest.
const EVIDENCE_NO_SPLIT_RE = /(?:^|\s)(?:[A-Z]|Rev|No|Nos|Dr|Mr|Mrs|Ms|St|vs|approx|Ref|Fig|e\.g|i\.e|etc|Inc|Ltd|Co|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$/i;
function _evidenceSentences(text) {
    const pieces = String(text == null ? '' : text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    pieces.forEach((p) => {
        if (out.length && EVIDENCE_NO_SPLIT_RE.test(out[out.length - 1])) out[out.length - 1] += ' ' + p;
        else out.push(p);
    });
    return out;
}

// Figures and document names in a sentence that its sources don't contain.
// "Image 2" and evidence IDs are the AI's own references, not facts.
function _evidenceUnsupported(sentence, sourceLower, sourceNumbers) {
    const s = String(sentence).replace(/\bImage\s+\d+\b/gi, '').replace(/\bEV-\d+\b/gi, '');
    const out = [];
    _extractNumericTokens(s).forEach((t) => { if (!sourceNumbers.has(t)) out.push(t); });
    (s.match(EVIDENCE_DOC_NAME_RE) || []).forEach((d) => {
        const core = d.trim().replace(/^(?:The|A|An|This|That|These|Those|Its|Their)\s+/, '').toLowerCase();
        if (core && sourceLower.indexOf(core) === -1) out.push(d.trim());
    });
    return out;
}

function _evidenceClean(text, source, where, flags) {
    const src = String(source || '');
    const srcLower = src.toLowerCase();
    const srcNumbers = new Set(_extractNumericTokens(src));
    const kept = [];
    _evidenceSentences(text).forEach((sentence) => {
        if (EVIDENCE_CONCLUSION_RE.test(sentence)) {
            flags.push(where + ': removed a sentence with conformity wording ("' + sentence.slice(0, 80) + '").');
            return;
        }
        const unsupported = _evidenceUnsupported(sentence, srcLower, srcNumbers);
        if (unsupported.length) {
            flags.push(where + ': removed a sentence naming ' + unsupported.map((u) => '"' + u + '"').join(', ') + ', which the AI did not quote from a screenshot and is not in the remark, the question or the requirement. Check it against the screenshot.');
            return;
        }
        kept.push(sentence);
    });
    return kept.join(' ');
}

function _evidencePrompt(input, sent) {
    const i = input || {};
    const reqs = Array.isArray(i.requirements) ? i.requirements : [];
    const reqText = reqs.length
        ? reqs.map((r) => '- ' + [r.standard, r.clause ? 'clause ' + r.clause : '', r.title].filter(Boolean).join(' — ') + ': ' + (r.text || '')).join('\n')
        : 'Not resolved for this question — rely on the audit question.';
    const imageList = sent.length
        ? 'The ' + sent.length + ' image(s) follow this prompt in this order: ' + sent.map((s, n) => 'Image ' + (n + 1) + ' = ' + s.evId).join('; ') + '.'
        : 'No images were sent. Explain only what the auditor\'s remark states, return "images": [] and set suggestedAssessment to "cannot_determine".';
    return `You help a certification body auditor review audit evidence. Describe what the attached screenshots actually show and how they relate to the audit question. You do not decide conformity; the auditor does.

AUDIT QUESTION${i.clause ? ' (' + i.clause + ')' : ''}:
${i.question || 'Not recorded.'}

REQUIREMENT(S):
${reqText}

AUDITOR'S REMARK:
${i.remark ? '"' + i.remark + '"' : 'None recorded.'}

IMAGES:
${imageList}

Rules:
1. Describe only what is visible. If an image's text is too small or blurred to read, set its relevance "unreadable", its shows to "Text not legible." and its visibleText to []. Never take a title or any wording from the question to describe an unreadable image.
2. shows: ONE short sentence (at most 25 words) saying what the image is, e.g. "A quarterly access review list for Active Directory." Do not list its rows or cells.
3. visibleText: copy up to ${EVIDENCE_MAX_QUOTES} short pieces of text exactly as they appear in that image. Copy; never paraphrase, correct or complete them. EVERY document name or number, date, figure, person or system name you mention anywhere in your answer must also be copied into the visibleText of the image it comes from (unless it is in the auditor's remark, the question or the requirement).
4. checks: split the audit question into its separate parts. For each part, look at every image again and compare: "shown" (an image clearly shows it), "partly_shown", "not_shown" (no image or remark shows it), or "differs" (an image shows something that does not match what the question expects, e.g. a date or value that differs). A column heading or value that shows the part counts as shown. In "evidence", cite the image and the exact row or value.
5. explanation: 2-3 factual sentences on how the evidence relates to the audit question, referring to images as "Image 1", "Image 2". Mention any "differs" result.
6. relevance of each image to the question: relevant | partial | irrelevant | unreadable.
7. suggestedAssessment, about the evidence only: supports | partially_supports | insufficient | cannot_determine. Never write "conform", "conformity", "nonconformity", "compliant", "compliance" or any certification judgement anywhere.
8. Do not infer frequency, completeness, approval, ownership or effectiveness unless an image shows it.

Return JSON only, in this shape:
{"images":[{"evId":"","shows":"","visibleText":[""],"relevance":""}],"checks":[{"part":"","finding":"","evidence":""}],"explanation":"","suggestedAssessment":"","assessmentReason":""}`;
}

// ---------- A busy AI service (2026-11-21) ----------
// Three live runs of the evidence check in a row: after about 60 to 80
// requests Gemini rejected every request (even a one-word prompt) for two to
// five minutes. Second readings were lost, so fewer moves came out "strong",
// and the search for questions with no screenshot did not run at all. A
// request that is rejected as busy now waits and is tried again; every other
// evidence request waits with it instead of adding to the load.
let _evidenceBusyUntil = 0;

async function _evidenceHold() {
    while (Date.now() < _evidenceBusyUntil) {
        const hook = AI_SERVICE.evidenceBusy;
        if (hook && typeof hook.cancelled === 'function' && hook.cancelled()) {
            const stopped = new Error('Stopped.');
            stopped.stopped = true;
            throw stopped;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000, Math.max(1, _evidenceBusyUntil - Date.now()))));
    }
}

/**
 * callProxyAPI for the evidence checks: through the server proxy only, and a
 * "busy" rejection is waited out (AI_SERVICE.evidenceBusyWaits, or longer when
 * Gemini says how long) and tried again. AI_SERVICE.evidenceBusy, when a
 * screen sets it, is told of each wait and can cancel one:
 * { onWait(seconds), cancelled() }.
 */
async function _evidenceCall(prompt, options) {
    const waits = AI_SERVICE.evidenceBusyWaits || [];
    for (let attempt = 0; ; attempt++) {
        await _evidenceHold();
        try {
            return await AI_SERVICE.callProxyAPI(prompt, Object.assign({ proxyOnly: true }, options));
        } catch (err) {
            if (!err || !err.busy) throw err;
            if (attempt >= waits.length) {
                const busy = new Error('The AI service is busy (a rate limit or an overloaded model). Try again in a few minutes.');
                busy.busy = true;
                busy.upstreamStatus = err.upstreamStatus || null;
                throw busy;
            }
            const wait = Math.min(Math.max(waits[attempt], (err.retryAfterSeconds || 0) * 1000), 300000);
            _evidenceBusyUntil = Math.max(_evidenceBusyUntil, Date.now() + wait);
            const hook = AI_SERVICE.evidenceBusy;
            if (hook && typeof hook.onWait === 'function') hook.onWait(Math.ceil((_evidenceBusyUntil - Date.now()) / 1000));
        }
    }
}

/**
 * _evidenceCall for a reply that must be JSON. A reply that cannot be read
 * (cut off: thinking tokens count against the output limit) is asked for
 * again, `tries` times in all, before the caller is told. Returns
 * { resp, parsed }. Live, 2026-11-21: the one text request that starts the
 * search for questions with no screenshot came back unreadable, it was not
 * asked for again, and the whole search reported "did not run".
 */
async function _evidenceJsonCall(prompt, options, tries) {
    const attempts = Math.max(1, tries || 2);
    for (let attempt = 0; attempt < attempts; attempt++) {
        const resp = await _evidenceCall(prompt, options);
        let parsed;
        try {
            parsed = JSON.parse(String((resp && resp.text) || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
        } catch (_e) { parsed = null; }
        if (parsed && typeof parsed === 'object') return { resp, parsed };
    }
    throw new Error('The AI reply could not be read.');
}

function _evidenceUsage(u) {
    const usage = u || {};
    const details = Array.isArray(usage.promptTokensDetails) ? usage.promptTokensDetails : [];
    const by = (m) => details.filter((d) => d && String(d.modality).toUpperCase() === m).reduce((n, d) => n + (Number(d.tokenCount) || 0), 0);
    return {
        promptTokens: Number(usage.promptTokenCount) || 0,
        imageTokens: by('IMAGE'),
        textTokens: by('TEXT'),
        outputTokens: Number(usage.candidatesTokenCount) || 0,
        thinkingTokens: Number(usage.thoughtsTokenCount) || 0,
        totalTokens: Number(usage.totalTokenCount) || 0
    };
}

// ---------- Evidence mapping check (2026-11-20) ----------
// On the PC Connection recert, 19 of 118 screenshots sat under a different
// question from the one they supported (the change register under the incident
// review, the remote-work policies under budgeting), which left "conform"
// answers with no evidence of their own. This asks, for the screenshots on one
// question, whether each belongs there or under another question on the same
// checklist. It proposes; the auditor decides, and nothing is moved here.
// em2 (first live run, 2026-11-20): asked only "fits or fits better elsewhere",
// the model proposed 51 moves of 118 where a hand check found 19: it moved an
// image whenever another question matched a little better. It now rates how
// well the image supports the question it is under and names the one question
// it is the most direct evidence for; a move is proposed only when the rating
// is "none". Item numbers came back as clause numbers ("4.4") and as strings.
const EVIDENCE_MAP_PROMPT_VERSION = 'em2';
const EVIDENCE_MAP_HERE = ['direct', 'partial', 'none', 'unreadable'];
const EVIDENCE_MAP_QUESTION_CHARS = 170;
const EVIDENCE_MAP_MAX_ALSO = 2;

function _evidenceMapPrompt(input, sent) {
    const i = input || {};
    const cur = i.current || {};
    const list = (Array.isArray(i.questions) ? i.questions : [])
        .map((q) => q.n + ' | ' + (q.clause || '-') + ' | ' + String(q.text || '').replace(/\s+/g, ' ').slice(0, EVIDENCE_MAP_QUESTION_CHARS))
        .join('\n');
    return `You help a certification body auditor check that each screenshot is filed under the right audit question. You do not decide conformity; the auditor does.

THESE SCREENSHOTS ARE FILED UNDER item ${cur.n}${cur.clause ? ' (' + cur.clause + ')' : ''}:
${cur.text || 'Not recorded.'}

EVERY QUESTION ON THE CHECKLIST (item number | clause | question):
${list}

IMAGES:
The ${sent.length} image(s) follow this prompt in this order: ${sent.map((s, n) => 'Image ' + (n + 1) + ' = ' + s.evId).join('; ')}.

Rules:
1. shows: ONE short sentence (at most 25 words) saying what the image is, from what is visible only. If its text is too small or blurred to read, set here "unreadable", shows "Text not legible." and visibleText [].
2. visibleText: copy up to 8 short pieces of text exactly as they appear in the image (its title, headings, system or document name). Every document, system or person name and every figure you mention must be copied here.
3. here: how well the image supports the question it is filed under. "direct": it is evidence of what that question asks the auditor to verify. "partial": it is related to that question, though it is mainly evidence of something else. "none": an auditor answering that question would not use this image.
4. Be conservative with "none": use it only for a clear mismatch. If the image plausibly supports the question it is filed under, answer "direct" or "partial".
5. bestItem: the item number of the ONE question in the list that this image is the most direct evidence for. It may be the item it is filed under. Use null when the image is not audit evidence for any question (for example a meeting invitation or a blank screen).
6. alsoItems: up to ${EVIDENCE_MAP_MAX_ALSO} other item numbers that this image is direct evidence for; otherwise [].
7. An item number is the whole number in the first column of the list. Never give a clause number such as "7.5" or "A.8.3".
8. reason: one sentence (at most 25 words) naming what in the image ties it to bestItem. Never write "conform", "nonconformity", "compliant", "compliance" or any certification judgement.

Return JSON only, in this shape:
{"images":[{"evId":"","shows":"","visibleText":[""],"here":"","bestItem":null,"alsoItems":[],"reason":""}]}`;
}

// ---------- Evidence for questions with no screenshot (2026-11-20) ----------
// The mapping check offered such a question whatever screenshots had named it
// as "also supports", a by-product of a call about a different question. Live,
// that put the backup dashboard under 9.1 monitoring while five KPI dashboards
// sat one question away, and the Document Control Policy under leadership.
// Now each of these questions is searched for on its own: first against the
// descriptions of every screenshot (one text call), then each candidate is
// checked against the image itself, and only "direct" evidence is offered.
// eg2 (deployed run, 2026-11-21): eg1 rated thin candidates "direct": an
// access-revocation email for 7.4 communication, a purchase request for A.8.32
// change management, a BCDR RACI chart for 5.1 leadership, a training record
// for 7.6 knowledge. The check now names the record the question needs first
// and rates the image against that.
const EVIDENCE_GAP_PROMPT_VERSION = 'eg2';
const EVIDENCE_GAP_MAX_CANDIDATES = 3;
const EVIDENCE_GAP_SUPPORT = ['direct', 'partial', 'none'];
const EVIDENCE_GAP_QUESTION_CHARS = 320;
const _evidenceGapQuestion = (text) => String(text || '').replace(FINDING_DRAFT_PLANNING_RE, '').replace(/\s+/g, ' ').trim();

function _evidenceGapMatchPrompt(questions, screenshots) {
    const qList = questions.map((q) => q.n + ' | ' + (q.clause || '-') + ' | ' + _evidenceGapQuestion(q.text).slice(0, EVIDENCE_GAP_QUESTION_CHARS)).join('\n');
    const sList = screenshots.map((s) => s.id + ' | filed under item ' + s.item + (s.clause ? ' (' + s.clause + ')' : '') + ' | ' + String(s.shows || '').replace(/\s+/g, ' ')).join('\n');
    return `You help a certification body auditor find evidence already captured during an audit. You do not decide conformity; the auditor does.

These audit questions have no screenshot attached (item number | clause | question):
${qList}

These are the screenshots captured during the audit, each filed under another question (id | where it is filed | what it shows):
${sList}

For each question, list the ids of at most ${EVIDENCE_GAP_MAX_CANDIDATES} screenshots whose description shows what that question asks the auditor to verify.

Rules:
1. Be strict. A screenshot that only shares a topic with the question is not evidence for it. Most questions will have none or one.
2. Prefer the screenshot that shows the record the question asks for (a register, a log, a dashboard of results) over one that shows a policy or a general overview.
3. Use only ids from the list. Give an empty list when nothing fits.

Return JSON only, in this shape:
{"matches":[{"item":0,"screenshots":[""]}]}`;
}

function _evidenceGapVerifyPrompt(question, sent) {
    const q = question || {};
    return `You help a certification body auditor decide whether screenshots filed under other questions are also evidence for this one. You do not decide conformity; the auditor does.

QUESTION — item ${q.n}${q.clause ? ' (' + q.clause + ')' : ''}:
${_evidenceGapQuestion(q.text) || 'Not recorded.'}

IMAGES:
The ${sent.length} image(s) follow this prompt in this order: ${sent.map((s, n) => 'Image ' + (n + 1) + ' = ' + s.evId).join('; ')}.

Rules:
1. needs: first, in at most 15 words, name the record an auditor must see to answer this question (for example "a change record followed from request to approval").
2. is: for each image, in at most 10 words, what kind of record it is.
3. support: "direct" only when the image is that record, or a clear instance of it, and the subject of this question is the main subject of the image. "partial" when it relates to the subject but is not that record. "none" otherwise, or when its text cannot be read.
4. These are "partial", not "direct":
   - the subject of the question appears in the image only as one line or an incidental detail;
   - a single example of an activity (one email, one ticket, one chat message) offered for a question about how that activity is planned, defined or controlled, unless the question asks to sample such an example;
   - a record of a different process, approval or purchase that merely resembles what the question asks for;
   - a document about one process offered as evidence of another process, or of management commitment in general.
5. When in doubt, "partial". Most candidates are not "direct"; an auditor answering this question must be able to attach a "direct" image without explaining why it is there.
6. visibleText: copy up to 6 short pieces of text exactly as they appear in the image (its title, headings, system or document name).
7. reason: one sentence (at most 25 words) naming what in the image shows it. Never write "conform", "nonconformity", "compliant", "compliance" or any certification judgement.

Return JSON only, in this shape:
{"needs":"","images":[{"evId":"","is":"","support":"","visibleText":[""],"reason":""}]}`;
}

// ---------- Draft from evidence, for Fix findings (2026-11-20) ----------
// "Polish" rewrites the text in a box, so it can do nothing for the empty
// "What you saw" box of a finding whose only records are a two-word note and a
// screenshot. This drafts that box from what the auditor did record: the note,
// the finding note, who it was recorded with, when the screenshots were taken
// and what the screenshots show. A fact none of those gives is left as
// "[To write: …]" for the auditor, and Fix findings will not save a box that
// still has one. Every name, date and figure in the draft must come from a
// quoted screenshot or the auditor's own record, or its sentence is removed.
// fd2 (live samples, 2026-11-20): fd1 put quotation marks round every name
// and date, gave the person's name beside the role, restated the question's
// pre-audit note, said what the evidence "did not show", wrote "the auditor
// noted", left no blank where the note only named an issue ("Document Data
// Control issue"), and took a requirement from the wrong standard when the
// finding's standard was not set.
// fd3: the question's planning notes ("Pre-audit gap: no documented
// information was on file…") were written up as if the auditor had found
// them, so they are cut from the question before it is sent or used as a
// source; quotation marks the model still put round names are removed.
// fd4 (first run in the deployed app, 2026-11-20): for the note "Document
// Data Control issue" the draft explained the issue itself ("observed in the
// document's title, which included No Label" — Word's sensitivity label).
// A note that only names an issue or a task now always ends in a blank, and a
// sentence that explains such an issue is removed. It also listed table
// dates, wrote "a screenshot shows" and "as noted by the auditor".
const FINDING_DRAFT_PROMPT_VERSION = 'fd4';

// A judgement, as opposed to a document's own name. The first live run of
// the mapping check lost the description of every screenshot of the
// Non-Conformity Register, because "non-conformity" alone counted as one.
const EVIDENCE_JUDGEMENT_RE = new RegExp([
    '\\b(?:is|are|was|were|appears?|seems?|remains?|not|fully|partially)\\s+(?:non-?)?(?:conform(?:ing|ant)|compliant)\\b',
    '\\b(?:conforms?|conformed|complies|complied)\\s+(?:to|with)\\b',
    '\\b(?:demonstrat\\w+|show\\w*|confirm\\w*|evidenc\\w+|indicat\\w+|ensur\\w+)\\s+(?:full\\s+|continued\\s+)?(?:non-?)?(?:conformity|conformance|compliance)\\b',
    '\\b(?:is|was|constitutes?|represents?)\\s+(?:an?|the)\\s+(?:minor\\s+|major\\s+)?non-?conform\\w+',
    '\\b(?:requirement|clause|control)\\s+(?:is|was|has been)\\s+(?:not\\s+)?(?:met|fulfilled|satisfied)\\b'
].join('|'), 'i');

// Text quoted from a screenshot is taken out of a sentence before it is
// tested for a judgement: a heading such as "Fully compliant" is a fact.
function _evidenceWithoutQuoted(sentence, quotes) {
    let s = String(sentence || '');
    (Array.isArray(quotes) ? quotes : []).map((q) => String(q == null ? '' : q).trim()).filter((q) => q.length >= 4)
        .sort((a, b) => b.length - a.length)
        .forEach((q) => { s = s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '); });
    return s;
}

// Sentence by sentence: no judgement, and no document name or figure that is
// not in `source`. Used for what the mapping check says about a screenshot.
function _evidenceFactsClean(text, source, quotes, where, flags) {
    const srcLower = String(source || '').toLowerCase();
    const srcNumbers = new Set(_extractNumericTokens(source));
    const kept = [];
    _evidenceSentences(text).forEach((sentence) => {
        if (EVIDENCE_JUDGEMENT_RE.test(_evidenceWithoutQuoted(sentence, quotes))) {
            flags.push(where + ': removed a sentence that stated a result ("' + sentence.slice(0, 80) + '").');
            return;
        }
        const unsupported = _evidenceUnsupported(sentence, srcLower, srcNumbers);
        if (unsupported.length) {
            flags.push(where + ': removed a sentence naming ' + unsupported.map((u) => '"' + u + '"').join(', ') + ', which the AI did not quote from the screenshot.');
            return;
        }
        kept.push(sentence);
    });
    return kept.join(' ');
}

// A note that names an issue or a task without saying what was found:
// "Document Data Control issue", "check competency matrix", "No CRM?".
function _findingDraftVagueNote(note) {
    const t = String(note || '').replace(/\s+/g, ' ').trim();
    if (!t || t.split(' ').length > 8) return false;
    return /\b(?:issues?|problems?|concerns?|gaps?)\b/i.test(t) || /\?/.test(t) || /^(?:check|update|review|verify|confirm|see|revise)\b/i.test(t);
}
// "The finding note recorded 'Process Map missing'": the note quoted back as
// if it were evidence. Live drafts kept doing it whatever the prompt said.
const FINDING_DRAFT_NOTE_ECHO_RE = /\b(?:the\s+)?(?:auditor'?s?\s+)?(?:finding\s+)?notes?\s+(?:stated|states|said|says|recorded|records|read|reads|indicated|indicates|mentioned|mentions)\b/i;
// A sentence that says where such an issue was seen or what it consists of.
const FINDING_DRAFT_EXPLAINS_RE = /\b(?:issues?|problems?|concerns?|gaps?)\b[^.]*\b(?:(?:was|were|is|are)\s+(?:observed|seen|found|identified|evident|noted|apparent)\s+(?:in|on|at|within|from)\b|which\s+(?:included|showed|contained|lacked|stated)\b|because\b|due\s+to\b|namely\b|specifically\b|as\s+(?:shown|seen|evidenced)\s+(?:by|in)\b)/i;
// What the checklist builder appends to a question for the auditor's planning.
const FINDING_DRAFT_PLANNING_RE = /\s*(?:Documented information on file|Pre-audit gap\s*:|No validated supporting document mapped)[\s\S]*$/i;
function _findingDraftInput(input) {
    const i = input || {};
    return Object.assign({}, i, { question: String(i.question || '').replace(FINDING_DRAFT_PLANNING_RE, '').trim() });
}
// "Workflow" → Workflow. An apostrophe inside a word is not a quotation mark.
function _findingDraftUnquote(text) {
    return String(text || '')
        .replace(/["\u201C\u201D]([^"\u201C\u201D]{1,90})["\u201C\u201D]/g, '$1')
        .replace(/(^|[\s(])['\u2018]([^'\u2018\u2019]{1,90})['\u2019](?=[\s.,;:)\]]|$)/g, '$1$2');
}
const FINDING_DRAFT_TO_WRITE_RE = /\[To write:[^\]]*\]/gi;
const FINDING_DRAFT_GRADES = { major: 'Major nonconformity', minor: 'Minor nonconformity', observation: 'Observation', ofi: 'Opportunity for improvement' };

function _findingDraftPrompt(input, sent) {
    const i = input || {};
    const reqs = Array.isArray(i.requirements) ? i.requirements : [];
    const reqText = reqs.length
        ? reqs.map((r) => '- ' + [r.standard, r.clause ? 'clause ' + r.clause : '', r.title].filter(Boolean).join(' — ') + ': ' + (r.text || '')).join('\n')
        : 'Not resolved for this question — rely on the audit question.';
    const grade = String(i.grade || '').toLowerCase();
    const result = FINDING_DRAFT_GRADES[grade] || (grade === 'conform' ? 'Conforming' : 'Not stated');
    const imageList = sent.length
        ? 'The ' + sent.length + ' screenshot(s) the auditor captured follow this prompt in this order: ' + sent.map((s, n) => 'Image ' + (n + 1)).join('; ') + '.'
        : 'No screenshots were sent. Use the auditor\'s notes only.';
    const middle = grade === 'ofi'
        ? 'what could be more effective'
        : (grade === 'observation' ? 'what was seen and the risk if it continues' : 'what was not fulfilled');
    const task = i.kind === 'statement'
        ? `Write the finding statement in three parts, 2 to 4 sentences in all:
(1) what clause ${i.clause || 'the requirement'} requires, in one sentence. Take it from the AUDIT QUESTION; use the REQUIREMENT(S) text only when it is clearly about the same subject as the question. Refer to the clause exactly as written here.
(2) ${middle}, only from the auditor's notes. If the notes do not say it, write [To write: ${middle}] in its place.
(3) one sentence starting "Evidence:" naming what showed it, from the notes and the screenshots.
Write the statement itself, not a report of it.`
        : `Write the "objective evidence" paragraph: what was reviewed, and what it showed. 2 to 4 sentences, past tense, plain audit-report English, for example "The <document> was reviewed with the <role> on <date>. It <what it shows>."
Do not say whether the requirement is met: never write "conform", "nonconformity", "compliant" or any certification judgement.
Do not restate the audit question, and do not say what the evidence fails to show beyond what the auditor's notes say.`;
    return `You help a certification body lead auditor write up what the auditor recorded for one audit question. You never add facts, and you never decide the result: the auditor has recorded it.

AUDIT QUESTION${i.clause ? ' (' + i.clause + ')' : ''}:
${i.question || 'Not recorded.'}

REQUIREMENT(S):
${reqText}

RESULT RECORDED BY THE AUDITOR: ${result}
AUDITOR'S NOTE: ${i.remark ? '"' + i.remark + '"' : 'None recorded.'}
AUDITOR'S FINDING NOTE: ${i.statement ? '"' + i.statement + '"' : 'None recorded.'}
RECORDED WITH: ${[i.auditee, i.designation].filter(Boolean).join(', ') || 'Not recorded.'}
SCREENSHOTS CAPTURED ON: ${(Array.isArray(i.dates) && i.dates.length) ? i.dates.join('; ') : 'Not recorded.'}

IMAGES:
${imageList}

TASK:
${task}

Rules:
1. Use only the auditor's notes, the facts above and what is visible in the screenshots. Name documents, systems and records exactly as they appear.
2. quotes: copy into "quotes", exactly as it appears, every document, system or person name, date and figure you take from a screenshot.
3. Where the text needs a fact that neither the notes nor the screenshots give (what exactly was missing, which record was sampled, what a person said), do not guess. Write [To write: what is needed] in that place. Use at most 3.
4. The auditor's notes are short. When a note names an issue or a task without saying what was found (for example "document control issue", "check competency matrix"), repeat the note's point in a few words and add [To write: what was found]. Never explain it yourself: do not say where it was seen, what caused it or what it consists of. A note with a question mark is the auditor's open question, not a finding: do not answer it; add [To write: your conclusion on <the question>].
5. When a role is recorded, write the role (the Process & Quality Manager) and never the person's name.
6. Write names, dates and figures as plain text, with no quotation marks round them.
7. Do not infer frequency, completeness, approval, ownership or effectiveness unless a screenshot shows it. Ignore a screenshot whose text cannot be read.
8. The auditor is the writer and the screenshots are the auditor's evidence: never write "the auditor noted", "as noted by the auditor", "the auditor's note", "the finding note", "the review identified", "an opportunity was identified" or "a screenshot shows". Name the document or record instead.
9. Do not list individual rows, dates or values from a table: name the record and say what it shows. Leave out any name or number you cannot read with certainty.

Return JSON only, in this shape:
{"text":"","quotes":[""]}`;
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

    // ---------- AI evidence explanation (phase 1) ----------
    evidenceInputHash: _evidenceInputHash,

    /**
     * The question, its requirement(s) from its own standard, the remark and
     * the screenshots of one checklist answer. Reads only; never changes it.
     */
    evidenceInputFor: (item, report) => {
        const it = item || {};
        const U = window.UTILS || {};
        const dec = (v) => (U.decodeEntities ? U.decodeEntities(String(v == null ? '' : v)) : String(v == null ? '' : v));
        let question = it.requirement || '';
        if (!question && window.KB_HELPERS && typeof window.KB_HELPERS.resolveChecklistClause === 'function') {
            try { question = window.KB_HELPERS.resolveChecklistClause(it, (window.state && window.state.checklists) || []).reqText || ''; } catch (_e) { question = ''; }
        }
        const ref = String(it.criterionRef || it.clause || '').trim();
        const standard = (report && report.standard) || '';
        const requirements = [];
        const RS = window.ReportStats;
        if (ref && RS && typeof RS.resolveFindingStandard === 'function' && window.KB_HELPERS && typeof window.KB_HELPERS.lookupKBRequirement === 'function') {
            const res = RS.resolveFindingStandard({ clause: it.clause, criterionRef: it.criterionRef }, standard);
            const stds = res.standard ? [res.standard] : (res.basis === 'common' ? (res.standards || []) : []);
            stds.forEach((s) => {
                const kb = window.KB_HELPERS.lookupKBRequirement(ref, s);
                if (kb && kb.requirement) requirements.push({ standard: s, clause: kb.clause || '', title: kb.title || '', text: kb.requirement });
            });
        }
        const srcs = (Array.isArray(it.evidenceImages) && it.evidenceImages.length ? it.evidenceImages : (it.evidenceImage ? [it.evidenceImage] : [])).filter(Boolean);
        const evIds = Array.isArray(it._evIds) ? it._evIds : [];
        return {
            clause: ref,
            question: dec(question),
            requirements,
            remark: dec(it.comment || ''),
            standard,
            images: srcs.map((src, n) => ({ evId: evIds[n] || ('Image ' + (n + 1)), src }))
        };
    },

    /** Downscale each screenshot (1280 px JPEG) and base64 it; at most 6. */
    prepareEvidenceImages: async (images) => {
        const sent = [];
        const failed = [];
        const EU = window.EvidenceUtils;
        for (const im of (Array.isArray(images) ? images : [])) {
            const evId = String((im && im.evId) || ('Image ' + (sent.length + failed.length + 1)));
            if (sent.length >= EVIDENCE_MAX_IMAGES) { failed.push({ evId, reason: 'More than ' + EVIDENCE_MAX_IMAGES + ' images; not sent.' }); continue; }
            try {
                let src = String((im && (im.src || im.dataUrl)) || '');
                if (/^idb:\/\//.test(src)) src = (window._EvidenceDB && await window._EvidenceDB.get(src)) || '';
                if (!src) throw new Error('image not found');
                const jpeg = (EU && typeof EU.compress === 'function') ? await EU.compress(src, { maxPx: EVIDENCE_IMAGE_MAX_PX, quality: EVIDENCE_IMAGE_QUALITY }) : src;
                const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(jpeg));
                if (!m) throw new Error('could not be converted');
                sent.push({ evId, mimeType: m[1], data: m[2] });
            } catch (e) {
                failed.push({ evId, reason: 'Could not be loaded (' + ((e && e.message) || 'error') + '); not sent.' });
            }
        }
        return { sent, failed };
    },

    /** Normalise the model's JSON and apply the checks above. */
    validateEvidenceExplanation: (parsed, input, prep) => {
        const flags = [];
        const i = input || {};
        const sentIds = ((prep && prep.sent) || []).map((s) => s.evId);
        const p = (parsed && typeof parsed === 'object') ? parsed : {};
        const byId = new Map();
        (Array.isArray(p.images) ? p.images : []).forEach((im, n) => {
            let id = String((im && im.evId) || '').trim();
            if (sentIds.indexOf(id) === -1) id = sentIds[n];
            if (!id || byId.has(id)) return;
            const relevance = EVIDENCE_RELEVANCE.indexOf(im && im.relevance) !== -1 ? im.relevance : 'partial';
            // Nothing is read from an unreadable image: the pilot's blurred
            // screenshot came back titled "Event Log", a phrase from the question.
            if (relevance === 'unreadable') {
                byId.set(id, { evId: id, shows: 'Text not legible.', visibleText: [], relevance });
                return;
            }
            const visibleText = (Array.isArray(im && im.visibleText) ? im.visibleText : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, EVIDENCE_MAX_QUOTES);
            byId.set(id, { evId: id, shows: String((im && im.shows) || '').trim(), visibleText, relevance });
        });
        sentIds.forEach((id) => {
            if (!byId.has(id)) {
                byId.set(id, { evId: id, shows: '', visibleText: [], relevance: 'unreadable' });
                flags.push(id + ': the AI did not describe this image.');
            }
        });
        const reqText = (Array.isArray(i.requirements) ? i.requirements : []).map((r) => [r.clause, r.title, r.text].filter(Boolean).join(' ')).join('\n');
        const base = [i.remark || '', i.question || '', i.clause || '', reqText].join('\n');
        const quotes = Array.from(byId.values()).map((x) => x.visibleText.join('\n')).join('\n');
        const images = sentIds.map((id) => {
            const im = byId.get(id);
            if (im.relevance === 'unreadable') return im;
            // One sentence: the pilot's descriptions listed every cell.
            const shows = _evidenceClean(im.shows, im.visibleText.join('\n') + '\n' + base, id, flags);
            const first = _evidenceSentences(shows)[0] || '';
            return Object.assign({}, im, { shows: first.length > 240 ? first.slice(0, 237).replace(/\s+\S*$/, '') + '…' : first });
        });
        const source = quotes + '\n' + base;
        const explanation = _evidenceClean(p.explanation, source, 'Explanation', flags);
        // Each part of the question against the evidence. Gaps and differences
        // come from these checks, so the list of what is missing can't
        // disagree with what the checks found shown.
        const checks = (Array.isArray(p.checks) ? p.checks : []).map((c) => {
            const part = _evidenceClean(String((c && c.part) || ''), source, 'Check', flags);
            if (!part) return null;
            const finding = EVIDENCE_CHECK_FINDINGS.indexOf(c && c.finding) !== -1 ? c.finding : 'not_shown';
            return { part, finding, evidence: _evidenceClean(String((c && c.evidence) || ''), source, 'Check', flags) };
        }).filter(Boolean).filter((c, n, all) => {
            // A "part" that is just the whole question again adds nothing
            // and turned the entire question into one gap (pilot ev2).
            if (all.length < 2) return true;
            const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const part = norm(c.part);
            const question = norm(i.question);
            return !(question && part.length >= question.length * 0.8 && (question.indexOf(part) !== -1 || part.indexOf(question) !== -1));
        }).slice(0, 12);
        const gaps = checks.filter((c) => c.finding === 'not_shown' || c.finding === 'partly_shown').map((c) => c.part + (c.finding === 'partly_shown' ? ' (partly shown)' : ''));
        const differences = checks.filter((c) => c.finding === 'differs').map((c) => c.part + (c.evidence ? ': ' + c.evidence : ''));
        let assessment = EVIDENCE_ASSESSMENTS.indexOf(p.suggestedAssessment) !== -1 ? p.suggestedAssessment : 'cannot_determine';
        let assessmentReason = _evidenceClean(p.assessmentReason, source, 'Assessment reason', flags);
        // No screenshot sent: the remark is the auditor's own account, not
        // evidence the AI has seen, so it never suggests "supports" from it.
        const basis = sentIds.length ? 'evidence' : 'remark_only';
        if (basis === 'remark_only') {
            assessment = 'cannot_determine';
            assessmentReason = 'No screenshot is attached; this summarises the auditor\'s remark only.';
        }
        if (!explanation) flags.push('The explanation was empty after the checks; write it yourself.');
        return { result: { images, checks, explanation, gaps, differences, suggestedAssessment: assessment, assessmentReason, basis }, flags };
    },

    /**
     * Explain one question's evidence. input: from evidenceInputFor, or
     * { clause, question, requirements:[{standard,clause,title,text}], remark,
     *   standard, images:[{evId, src}] }. opts.cached: an earlier record — returned
     *   as it is, with no call, while the inputs are unchanged (opts.force re-runs).
     * Returns a draft record; it never writes to a checklist answer.
     */
    explainEvidence: async (input, opts = {}) => {
        const o = opts || {};
        const inputHash = _evidenceInputHash(input, EVIDENCE_MODEL);
        const cached = o.cached;
        if (cached && cached.inputHash === inputHash && cached.status !== 'rejected' && !o.force) {
            return Object.assign({}, cached, { fromCache: true });
        }
        const prep = await AI_SERVICE.prepareEvidenceImages((input && input.images) || []);
        if (!prep.sent.length && !String((input && input.remark) || '').trim()) {
            return { status: 'nothing', inputHash, fromCache: false, imagesFailed: prep.failed, result: null, flags: ['No readable screenshot and no remark: nothing to explain.'] };
        }
        const prompt = _evidencePrompt(input, prep.sent);
        const started = Date.now();
        const resp = await AI_SERVICE.callProxyAPI(prompt, {
            images: prep.sent.map((s) => ({ mimeType: s.mimeType, data: s.data })),
            json: true,
            withUsage: true,
            feature: 'evidence-explanation',
            models: [EVIDENCE_MODEL],
            // Thinking tokens count against this limit on 2.5 Flash.
            maxTokens: 8192,
            temperature: 0.1
        });
        const latencyMs = Date.now() - started;
        let parsed;
        try {
            parsed = JSON.parse(String(resp.text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
        } catch (_e) { parsed = null; }
        const checked = AI_SERVICE.validateEvidenceExplanation(parsed, input, prep);
        if (!parsed) checked.flags.unshift('The AI reply was not valid JSON.');
        return {
            status: 'draft',
            inputHash,
            promptVersion: EVIDENCE_PROMPT_VERSION,
            model: resp.model,
            createdAt: new Date().toISOString(),
            fromCache: false,
            latencyMs,
            imagesSent: prep.sent.map((s) => s.evId),
            imagesFailed: prep.failed,
            usage: _evidenceUsage(resp.usage),
            result: checked.result,
            flags: checked.flags
        };
    },

    // ---------- Evidence mapping check ----------
    EVIDENCE_MAX_IMAGES: EVIDENCE_MAX_IMAGES,
    // How long an evidence request waits each time the AI service is busy
    // (ms); after the last wait the request fails. See _evidenceCall.
    evidenceBusyWaits: [30000, 60000, 120000, 120000],
    // Set by a screen while it runs evidence checks: { onWait(seconds), cancelled() }.
    evidenceBusy: null,

    /**
     * Normalise the model's reply for one question's screenshots into
     * fit: fits | fits_better_elsewhere | unrelated | unreadable. A move
     * (fits_better_elsewhere + betterItem) needs the image rated "none" where
     * it is and a best question that is on the checklist and is a different
     * one; anything less leaves the image where it is.
     */
    validateEvidenceMapping: (parsed, input, prep) => {
        const flags = [];
        const i = input || {};
        const cur = i.current || {};
        const questions = Array.isArray(i.questions) ? i.questions : [];
        const byN = new Map(questions.map((q) => [Number(q.n), q]));
        const sentIds = ((prep && prep.sent) || []).map((s) => s.evId);
        const p = (parsed && typeof parsed === 'object') ? parsed : {};
        const seen = new Map();
        (Array.isArray(p.images) ? p.images : []).forEach((im, n) => {
            let id = String((im && im.evId) || '').trim();
            if (sentIds.indexOf(id) === -1) id = sentIds[n];
            if (!id || seen.has(id)) return;
            seen.set(id, im || {});
        });
        const oneSentence = (text) => {
            const first = _evidenceSentences(text)[0] || '';
            return first.length > 240 ? first.slice(0, 237).replace(/\s+\S*$/, '') + '…' : first;
        };
        // A whole item number from the list; "13" counts, a clause number does not.
        const onList = (v) => {
            if (v == null || v === '') return null;
            const n = Number(v);
            return Number.isInteger(n) && byN.has(n) ? n : null;
        };
        const here = Number(cur.n);
        const images = sentIds.map((id) => {
            const im = seen.get(id);
            if (!im) {
                flags.push(id + ': the AI did not describe this image.');
                return { evId: id, shows: '', visibleText: [], here: 'unreadable', fit: 'unreadable', betterItem: null, alsoItems: [], reason: '' };
            }
            // No rating given: treated as fitting, so nothing is proposed.
            const rating = EVIDENCE_MAP_HERE.indexOf(im.here) !== -1 ? im.here : 'direct';
            if (rating === 'unreadable') return { evId: id, shows: 'Text not legible.', visibleText: [], here: rating, fit: 'unreadable', betterItem: null, alsoItems: [], reason: '' };
            const visibleText = (Array.isArray(im.visibleText) ? im.visibleText : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 8);
            const best = onList(im.bestItem);
            const named = im.bestItem != null && im.bestItem !== '';
            // A move is proposed only for an image rated "none" where it is.
            let fit = 'fits';
            let betterItem = null;
            if (rating === 'none') {
                if (best != null && best !== here) { fit = 'fits_better_elsewhere'; betterItem = best; }
                else if (!named) fit = 'unrelated';
                else if (best == null) flags.push(id + ': the AI proposed a question that is not on this checklist; left where it is.');
            }
            const alsoItems = [];
            const also = (n) => {
                if (n != null && n !== here && n !== betterItem && alsoItems.indexOf(n) === -1 && alsoItems.length < EVIDENCE_MAP_MAX_ALSO + 1) alsoItems.push(n);
            };
            // Fits where it is, and is the most direct evidence for another question too.
            if (fit === 'fits') also(best);
            (Array.isArray(im.alsoItems) ? im.alsoItems : []).forEach((v) => also(onList(v)));
            const target = betterItem != null ? byN.get(betterItem) : null;
            const source = [visibleText.join('\n'), cur.text || '', cur.clause || '', target ? target.text + ' ' + (target.clause || '') : '',
                alsoItems.map((n) => byN.get(n).text + ' ' + (byN.get(n).clause || '')).join('\n')].join('\n');
            return {
                evId: id,
                shows: oneSentence(_evidenceFactsClean(String(im.shows || ''), source, visibleText, id, flags)),
                visibleText,
                here: rating,
                fit,
                betterItem,
                alsoItems,
                reason: oneSentence(_evidenceFactsClean(String(im.reason || ''), source, visibleText, id + ' reason', flags))
            };
        });
        return { images, flags };
    },

    /**
     * Check the screenshots filed under one question against every question
     * on the checklist. input: { current: {n, clause, text},
     * questions: [{n, clause, text}], images: [{evId, src}] } with at most
     * EVIDENCE_MAX_IMAGES images (the caller splits larger sets).
     * Returns proposals only; it never changes a checklist answer.
     */
    mapEvidence: async (input) => {
        const prep = await AI_SERVICE.prepareEvidenceImages((input && input.images) || []);
        if (!prep.sent.length) {
            return { status: 'nothing', promptVersion: EVIDENCE_MAP_PROMPT_VERSION, imagesSent: [], imagesFailed: prep.failed, images: [], flags: ['No screenshot could be loaded: nothing was sent.'] };
        }
        const started = Date.now();
        const prompt = _evidenceMapPrompt(input, prep.sent);
        // In the live run 2 of 48 replies were cut off (thinking tokens count
        // against the limit) and could not be parsed. One more try, then the
        // caller is told: an unread reply must not look like unreadable images.
        const { resp, parsed } = await _evidenceJsonCall(prompt, {
            images: prep.sent.map((s) => ({ mimeType: s.mimeType, data: s.data })),
            json: true,
            withUsage: true,
            feature: 'evidence-mapping',
            models: [EVIDENCE_MODEL],
            maxTokens: 16384,
            temperature: 0.1
        }, 2);
        const checked = AI_SERVICE.validateEvidenceMapping(parsed, input, prep);
        return {
            status: 'draft',
            promptVersion: EVIDENCE_MAP_PROMPT_VERSION,
            model: resp.model,
            latencyMs: Date.now() - started,
            imagesSent: prep.sent.map((s) => s.evId),
            imagesFailed: prep.failed,
            usage: _evidenceUsage(resp.usage),
            images: checked.images,
            flags: checked.flags
        };
    },

    // ---------- Evidence for questions with no screenshot ----------
    /**
     * Step 1, text only: for each question with no screenshot, the screenshots
     * whose description fits it. input: { questions: [{n, clause, text}],
     * screenshots: [{id, item, clause, shows}] }. Returns { matches: [{n, ids}] }
     * with only questions and ids that were sent, at most three ids each.
     */
    matchEvidenceToQuestions: async (input) => {
        const questions = (input && Array.isArray(input.questions)) ? input.questions : [];
        const screenshots = (input && Array.isArray(input.screenshots)) ? input.screenshots : [];
        if (!questions.length || !screenshots.length) return { status: 'nothing', matches: [] };
        // The whole search hangs on this one request, so it gets three tries
        // and a larger output limit (its reply lists every question, and the
        // model's thinking counts against the limit).
        const { resp, parsed } = await _evidenceJsonCall(_evidenceGapMatchPrompt(questions, screenshots), {
            json: true,
            withUsage: true,
            feature: 'evidence-mapping',
            models: [EVIDENCE_MODEL],
            maxTokens: 32768,
            temperature: 0.1
        }, 3);
        const asked = new Set(questions.map((q) => Number(q.n)));
        const known = new Set(screenshots.map((s) => String(s.id)));
        const byN = new Map();
        (Array.isArray(parsed.matches) ? parsed.matches : []).forEach((m) => {
            const n = Number(m && m.item);
            if (!Number.isInteger(n) || !asked.has(n) || byN.has(n)) return;
            const ids = [];
            (Array.isArray(m.screenshots) ? m.screenshots : []).forEach((id) => {
                const key = String(id == null ? '' : id).trim();
                if (known.has(key) && ids.indexOf(key) === -1 && ids.length < EVIDENCE_GAP_MAX_CANDIDATES) ids.push(key);
            });
            byN.set(n, ids);
        });
        return {
            status: 'draft',
            promptVersion: EVIDENCE_GAP_PROMPT_VERSION,
            model: resp.model,
            usage: _evidenceUsage(resp.usage),
            matches: questions.map((q) => ({ n: Number(q.n), ids: byN.get(Number(q.n)) || [] }))
        };
    },

    /**
     * Step 2, with the images: is each candidate direct evidence for this one
     * question? input: { question: {n, clause, text}, images: [{evId, src}] }.
     * Returns { images: [{evId, support, reason}] }; an image the reply does
     * not rate counts as "none".
     */
    verifyEvidenceFor: async (input) => {
        const i = input || {};
        const prep = await AI_SERVICE.prepareEvidenceImages(i.images || []);
        if (!prep.sent.length) return { status: 'nothing', images: [], imagesFailed: prep.failed, flags: [] };
        const { resp, parsed } = await _evidenceJsonCall(_evidenceGapVerifyPrompt(i.question, prep.sent), {
            images: prep.sent.map((s) => ({ mimeType: s.mimeType, data: s.data })),
            json: true,
            withUsage: true,
            feature: 'evidence-mapping',
            models: [EVIDENCE_MODEL],
            maxTokens: 8192,
            temperature: 0.1
        }, 2);
        const flags = [];
        const sentIds = prep.sent.map((s) => s.evId);
        const seen = new Map();
        (Array.isArray(parsed.images) ? parsed.images : []).forEach((im, n) => {
            let id = String((im && im.evId) || '').trim();
            if (sentIds.indexOf(id) === -1) id = sentIds[n];
            if (id && !seen.has(id)) seen.set(id, im || {});
        });
        const q = i.question || {};
        const images = sentIds.map((id) => {
            const im = seen.get(id);
            if (!im) return { evId: id, support: 'none', reason: '' };
            const support = EVIDENCE_GAP_SUPPORT.indexOf(im.support) !== -1 ? im.support : 'none';
            const visibleText = (Array.isArray(im.visibleText) ? im.visibleText : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 6);
            const source = [visibleText.join('\n'), q.text || '', q.clause || ''].join('\n');
            let reason = _evidenceSentences(_evidenceFactsClean(String(im.reason || ''), source, visibleText, id, flags))[0] || '';
            // An offer always says why. When the reason did not survive the
            // fact check (live: both BCDR report offers came with none), what
            // the image itself says stands in; with neither, it is not offered.
            if (support === 'direct' && !reason) {
                if (!visibleText.length) return { evId: id, support: 'partial', reason: '' };
                reason = 'The screenshot reads: ' + visibleText.slice(0, 3).map((t) => '"' + t + '"').join(', ') + '.';
            }
            return { evId: id, support, reason };
        });
        return { status: 'draft', promptVersion: EVIDENCE_GAP_PROMPT_VERSION, model: resp.model, usage: _evidenceUsage(resp.usage), images, imagesFailed: prep.failed, flags };
    },

    // ---------- Draft from evidence (Fix findings) ----------
    FINDING_DRAFT_TO_WRITE_RE: new RegExp(FINDING_DRAFT_TO_WRITE_RE.source, 'i'),

    /**
     * Check a drafted text sentence by sentence. A sentence is removed when it
     * names a document or gives a figure that is not in the quoted screenshot
     * text or the auditor's own record, or (evidence paragraph only) states a
     * conformity judgement. "[To write: …]" blanks are kept as they are.
     */
    validateFindingDraft: (parsed, input) => {
        const flags = [];
        const i = _findingDraftInput(input);
        const p = (parsed && typeof parsed === 'object') ? parsed : {};
        const quotes = (Array.isArray(p.quotes) ? p.quotes : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, 40);
        const reqText = (Array.isArray(i.requirements) ? i.requirements : []).map((r) => [r.standard, r.clause, r.title, r.text].filter(Boolean).join(' ')).join('\n');
        const source = [quotes.join('\n'), i.remark || '', i.statement || '', i.question || '', i.clause || '', reqText, i.auditee || '', i.designation || '', (i.dates || []).join('\n')].join('\n');
        const srcLower = source.toLowerCase();
        const srcNumbers = new Set(_extractNumericTokens(source));
        const kept = [];
        const vague = [i.remark, i.statement].map((n) => String(n || '').replace(/\s+/g, ' ').trim()).filter(_findingDraftVagueNote);
        // The auditor is the writer: "…, as noted by the auditor" says nothing.
        const plain = _findingDraftUnquote(p.text).replace(/\s+/g, ' ').trim()
            .replace(/,?\s+as (?:noted|stated|recorded|observed|identified) by the auditor/gi, '')
            .replace(/\bThe auditor (?:noted|stated|observed|recorded|identified) that\s+([a-z])/g, (m, c) => c.toUpperCase());
        // "Evidence:" is carried to the next sentence when its own is removed.
        let carryEvidence = false;
        _evidenceSentences(plain).forEach((raw) => {
            let sentence = raw;
            if (carryEvidence && !/^Evidence:/i.test(sentence)) sentence = 'Evidence: ' + sentence;
            carryEvidence = false;
            // What sits inside a blank is an instruction to the auditor, not a fact.
            const facts = sentence.replace(FINDING_DRAFT_TO_WRITE_RE, ' ');
            // With a blank in it the sentence stays: the auditor rewrites it anyway.
            if (FINDING_DRAFT_NOTE_ECHO_RE.test(facts) && facts === sentence) {
                carryEvidence = /^Evidence:/i.test(sentence);
                return;
            }
            if (i.kind !== 'statement' && EVIDENCE_JUDGEMENT_RE.test(_evidenceWithoutQuoted(facts, quotes))) {
                flags.push('Removed a sentence that stated a result ("' + sentence.slice(0, 80) + '"); the result is yours to record.');
                return;
            }
            // The note only names an issue: what it was is the auditor's to say.
            if (vague.length && FINDING_DRAFT_EXPLAINS_RE.test(facts)) {
                flags.push('Removed a sentence that explained an issue your note only names ("' + sentence.slice(0, 80) + '"); say what it was yourself.');
                return;
            }
            const unsupported = _evidenceUnsupported(facts, srcLower, srcNumbers);
            if (unsupported.length) {
                flags.push('Removed a sentence naming ' + unsupported.map((u) => '"' + u + '"').join(', ') + ', which is not in your notes and was not quoted from a screenshot.');
                return;
            }
            kept.push(sentence);
        });
        let text = kept.join(' ');
        if (!text) flags.push('Nothing was left after the checks; write it yourself.');
        // A note that names an issue or a task never yields a finished text.
        if (text && vague.length && !(text.match(FINDING_DRAFT_TO_WRITE_RE) || []).length) {
            text += ' [To write: what you found. Your note says: ' + vague[0].replace(/[[\]]/g, '') + ']';
        }
        return { text, flags, blanks: (text.match(FINDING_DRAFT_TO_WRITE_RE) || []).length };
    },

    /**
     * Draft the text of one Fix findings box from what the auditor recorded.
     * input: evidenceInputFor(item, report) plus { kind: 'evidence'|'statement',
     * grade, statement, auditee, designation, dates }. Returns
     * { status, text, blanks, flags }; it never writes to a checklist answer.
     */
    draftFindingText: async (input) => {
        const i = _findingDraftInput(input);
        const prep = await AI_SERVICE.prepareEvidenceImages(i.images || []);
        if (!prep.sent.length && !String(i.remark || '').trim() && !String(i.statement || '').trim()) {
            return { status: 'nothing', text: '', blanks: 0, imagesSent: [], imagesFailed: prep.failed, flags: ['No note and no readable screenshot is recorded for this question: there is nothing to draft from.'] };
        }
        const resp = await AI_SERVICE.callProxyAPI(_findingDraftPrompt(i, prep.sent), {
            images: prep.sent.map((s) => ({ mimeType: s.mimeType, data: s.data })),
            json: true,
            withUsage: true,
            feature: 'finding-draft',
            models: [EVIDENCE_MODEL],
            maxTokens: 8192,
            temperature: 0.1
        });
        let parsed;
        try {
            parsed = JSON.parse(String(resp.text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
        } catch (_e) { parsed = null; }
        if (!parsed || typeof parsed !== 'object') throw new Error('The AI reply could not be read.');
        const checked = AI_SERVICE.validateFindingDraft(parsed, i);
        return {
            status: 'draft',
            promptVersion: FINDING_DRAFT_PROMPT_VERSION,
            model: resp.model,
            text: checked.text,
            blanks: checked.blanks,
            imagesSent: prep.sent.map((s) => s.evId),
            imagesFailed: prep.failed,
            usage: _evidenceUsage(resp.usage),
            flags: checked.flags
        };
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

    /**
     * 1d-2. Question-clause suggester for FOCUS/ORG/DOC checklist items
     * (Review Criteria modal, execution-module-v2.js).
     *
     * suggestFindingClause() above answers "what did the objective evidence
     * prove was NOT fulfilled" — the right test for a nonconformity, the
     * wrong one here. Review Criteria rows are a mix of conform/observation/
     * nc, and most carry no evidence at all; a conforming item still needs a
     * clause. This asks a different, outcome-independent question instead:
     *   "Which single requirement of the audited standard is this audit
     *   question testing conformity against?"
     * `status` is passed only for context — the requirement a question tests
     * does not change because the recorded outcome happened to be conform,
     * an observation, or an nc.
     *
     * Same structural guardrail as suggestFindingClause(): the model may
     * choose only from the audited standard's real KB clause inventory —
     * window.state.knowledgeBase.standards[] entries with status 'ready' and
     * a populated clauses[] of {clause, title, requirement}. The answer (and
     * every alternative) is re-validated against that same inventory
     * afterwards; an out-of-inventory clause is discarded and the result
     * degrades to insufficient — it is never surfaced to the caller.
     * Returned clauseTitle values are always the KB's own title text, never
     * the model's, so a title cannot be invented even when a clause number
     * does validate. If the Knowledge Base has no ready standard matching
     * `standard`, this returns insufficient: true immediately, before any AI
     * call — it never falls back to guessing from clause-number patterns.
     *
     * Never throws: any missing KB standard, network failure, or unparseable
     * AI response degrades to insufficient: true.
     *
     * @param {Object} params
     * @param {string} params.question - The checklist question text. Required — empty question short-circuits to insufficient without calling the AI.
     * @param {string} [params.sourceClause] - The item's FOCUS.n/ORG/DOC working reference. Background only — must NOT be inherited or echoed as the answer; it is not a clause of the standard.
     * @param {string} params.standard - The audited standard name (e.g. "ISO 9001:2015"). Required — used to select the KB clause inventory that gates every answer.
     * @param {string} [params.auditorNotes] - The auditor's comment/evidence for this item, if any. Strengthens the mapping but is NOT required — an absent value is normal for a checklist question, not a reason to refuse.
     * @param {string} [params.status] - 'conform' | 'observation' | 'nc' etc. Context only; the clause a question tests does not change with the outcome.
     * @returns {Promise<{
     *   clause: string|null,
     *   clauseTitle: string|null,
     *   reason: string,
     *   alternatives: Array<{clause: string, clauseTitle: string}>,
     *   confidence: 'high'|'medium'|'low',
     *   insufficient: boolean
     * }>}
     *   clause/clauseTitle are null and alternatives is [] whenever
     *   insufficient is true. `reason` carries the specific technical cause
     *   (missing KB standard, out-of-inventory clause, parse/network
     *   failure, unmappable question, etc.) for logging/debugging.
     */
    suggestQuestionClause: async ({ question, sourceClause, standard, auditorNotes, status } = {}) => {
        const insufficient = (reason) => ({
            clause: null,
            clauseTitle: null,
            reason: reason || 'Insufficient information to suggest a clause.',
            alternatives: [],
            confidence: 'low',
            insufficient: true
        });

        const questionText = String(question || '').trim();
        if (!questionText) return insufficient('No question text was provided to evaluate.');
        if (!standard || !String(standard).trim()) return insufficient('No audited standard was specified — cannot validate against the Knowledge Base.');

        // Guardrail step 1: identical to suggestFindingClause() — the audited
        // standard must have a ready, populated clause inventory in the
        // Knowledge Base. Never fall back to guessing from clause-number
        // patterns when it doesn't.
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
You are a Senior Lead Auditor at a top-tier international Certification Body, mapping an audit checklist question to the requirement of the audited standard it tests. The mapping will be reviewed by a Qualified Registrar before client submission.

GOVERNING TEST — apply this exact test and no other:
"Which single requirement of the audited standard is this audit question testing conformity against?"

This is NOT asking what was breached, and it is NOT asking what the objective evidence proves — the same question tests the same requirement regardless of whether the recorded audit outcome was conforming, an observation, or a nonconformity. Reason from what the question itself is actually asking the auditee to demonstrate.

The item's internal working reference, if given below, is NOT a clause of the audited standard — it is an internal checklist tracking code (e.g. FOCUS.1, ORG, DOC). It is background context only; do NOT inherit it, echo it back, or treat it as if it were already the answer.

Audited Standard: ${stdDoc.name || standard}
${status ? `Recorded Audit Outcome (context only — does not change which requirement the question tests): ${status}\n` : ''}${sourceClause ? `Internal Working Reference (context only — NOT a clause of the standard, do not inherit): ${sourceClause}\n` : ''}
Audit Question:
${questionText}
${auditorNotes ? `\nAuditor Notes/Evidence for this item:\n${String(auditorNotes).trim()}\n` : '\n(No auditor notes were recorded for this item. That is normal for a checklist question and is NOT a reason to refuse a mapping — map the question itself.)\n'}
Candidate Clauses — you MUST choose the primary clause and any alternatives ONLY from this list, exactly as written. Do not invent, rename, renumber, or paraphrase a clause number or title. If the question genuinely cannot be mapped to one of these clauses, say so instead of guessing:
${clauseInventoryText}

Confidence rules:
- "high": ONLY when the question plainly and specifically tests one particular requirement above.
- "medium" or "low": whenever identifying the requirement takes auditor judgement, the question is generic or spans more than one clause, or more than one clause is plausible.
- If the question does not provide sufficient basis to identify a specific requirement from the list above, set "insufficient": true, set "clause" and "clauseTitle" to null, and explain why in "reason" — do NOT guess or force a match to the nearest-sounding clause.

Alternative Related Clause(s): only include a clause here where it is genuinely relevant to the same question — do not pad the list. Return an empty array if there is no genuinely relevant alternative.

Return raw JSON only (no markdown code fences, no prose outside the JSON):
{
  "clause": "<clause number exactly as it appears in the candidate list above, or null>",
  "clauseTitle": "<its title exactly as it appears in the candidate list above, or null>",
  "reason": "<2-4 sentences grounded in what the question itself is testing, not the internal working reference>",
  "alternatives": [{"clause": "...", "clauseTitle": "..."}],
  "confidence": "high" | "medium" | "low",
  "insufficient": false
}
`;

        let responseText;
        try {
            responseText = await AI_SERVICE.callProxyAPI(prompt);
        } catch (error) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'suggestQuestionClause: AI request failed, degrading to insufficient.', error);
            return insufficient('The AI request failed — clause mapping could not be evaluated automatically.');
        }

        const parsed = _parseClauseSuggestionJSON(responseText);
        if (!parsed) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'suggestQuestionClause: could not parse AI response as JSON.');
            return insufficient('The AI response could not be interpreted — clause mapping could not be evaluated automatically.');
        }

        if (parsed.insufficient === true || !parsed.clause) {
            return insufficient(_stripMdLite(parsed.reason) || 'The question does not clearly map to a single requirement of the standard.');
        }

        // Guardrail step 2: identical to suggestFindingClause() — validate
        // the model's answer against the SAME inventory passed into the
        // prompt. An out-of-inventory clause is never surfaced to the
        // caller, structurally, not just by prompt compliance.
        const normalizedClause = window.KB_HELPERS.extractClauseNum(String(parsed.clause).trim());
        const kbEntry = validClauses.get(normalizedClause) || validClauses.get(String(parsed.clause).trim());
        if (!kbEntry) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', `suggestQuestionClause: model returned clause "${parsed.clause}" not found in Knowledge Base inventory for "${stdDoc.name}" — discarding rather than surfacing an unvalidated clause.`);
            return insufficient(`The AI suggested a clause not found in the "${stdDoc.name || standard}" Knowledge Base inventory — this has been discarded rather than risking an invented clause reference.`);
        }

        // Alternatives go through the identical validation + KB title
        // lookup. Titles are ALWAYS the KB's own text, never the model's.
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
            reason: _stripMdLite(parsed.reason) || 'This is the requirement the question tests conformity against.',
            alternatives,
            confidence,
            insufficient: false
        };
    },

    /**
     * 1e. Client-facing evidence statement builder (client spec #10).
     *
     * Raw auditor field notes ("Records Are Available.", "Ssytem is in
     * placed.", "8 now total emplyees.") are fine during fieldwork but must
     * never print verbatim in a client certification report. This proposes,
     * per checklist item, a professionalized "Client-Facing Evidence
     * Statement" — WITHOUT ever touching the auditor's original raw note.
     * The two fields stay structurally separate in the return value; nothing
     * this function does mutates `items` or any field on it.
     *
     * THE HARD RULE (governs the prompt and both safety nets below): the
     * model may improve grammar, spelling, capitalization and professional
     * register ONLY. It must add no fact, finding, quantity, date, name,
     * cause, or compliance/risk judgement absent from the raw note, and must
     * not turn a plain observation into a finding. Preferring a faithful,
     * plainly-worded statement over an impressive one is deliberate — see
     * task spec #10 for the worked example this prompt is calibrated
     * against ("Govt complain closed in a 2 week..." -> "...closed within
     * approximately two weeks...").
     *
     * Two deterministic guardrails keep that rule structural, not just
     * prompted:
     *   1. Sparse-note pre-filter — a raw note of
     *      EVIDENCE_STATEMENT_SPARSE_MAX_WORDS words or fewer (e.g.
     *      "Website.") is too thin to expand without guessing at unstated
     *      context. These are never sent to the model at all: `proposed` is
     *      a purely mechanical clean of the raw note (via
     *      window.ReportStats.cleanEvidenceText — never reworded) and
     *      `flaggedSparse: true` tells the caller to prompt the auditor
     *      directly rather than ship anything AI-authored for that item.
     *   2. Numeric-token safety net — after generation, every digit-led
     *      token (number, date, percentage — see _extractNumericTokens) in
     *      the model's proposed text is compared against the tokens present
     *      in the raw note. If the proposal contains ANY numeric token the
     *      raw note doesn't have, the ENTIRE proposal for that item is
     *      discarded (never partially salvaged) and replaced with the same
     *      mechanical clean fallback used for sparse notes;
     *      `safetyNetTriggered: true` marks that this happened.
     *
     * Never throws. Any missing AI configuration, network failure, or
     * unparseable response degrades every eligible item to its mechanical
     * clean fallback (raw note, tidied only) rather than propagating an
     * error — same "fail toward the raw note" posture as the two guardrails
     * above.
     *
     * @param {Array<Object>} items - Checklist items (or any objects) carrying
     *   a raw auditor note. The raw note is read from, in priority order:
     *   item.rawNote, item.comment, item.remarks, item.transcript,
     *   item.ncrDescription, item.description. Not mutated.
     * @param {Object} [opts]
     * @param {string} [opts.standard] - Audited ISO standard name (e.g.
     *   "ISO 9001:2015"), passed only as light framing context for register/
     *   tone — never used to inject clause text or other facts the model
     *   could fold into a rewrite.
     * @returns {Promise<Array<{
     *   index: number,
     *   raw: string,
     *   proposed: string,
     *   unchanged: boolean,
     *   flaggedSparse: boolean,
     *   safetyNetTriggered: boolean
     * }>>}
     *   One entry per input item, in the same order, so `index` always maps
     *   back to `items[index]` even for items skipped or degraded below:
     *   - `raw` — the auditor's original note, verbatim, untouched.
     *   - `proposed` — the candidate client-facing evidence statement. Equal
     *     to a mechanical clean of `raw` (never AI-reworded) whenever
     *     `flaggedSparse` or `safetyNetTriggered` is true, or the AI call
     *     failed.
     *   - `unchanged` — true when `proposed` carries no real
     *     professionalization over `raw` (empty note, sparse note, safety-net
     *     fallback, or AI failure). false only when the model's rewrite was
     *     generated AND passed the numeric-token safety net.
     *   - `flaggedSparse` — true when the raw note was too thin to safely
     *     expand; the UI should ask the auditor for input rather than treat
     *     `proposed` as a real draft.
     *   - `safetyNetTriggered` — true when a model proposal was generated but
     *     rejected for introducing a number/date/percentage absent from the
     *     raw note, and `proposed` was replaced with the mechanical fallback.
     *
     * Additive only — not wired into any UI or existing function. auditor
     * approve/edit UI is a follow-up task; this only needs to expose a stable
     * contract for it to build against.
     */
    buildClientEvidenceStatements: async (items, opts = {}) => {
        const standard = opts && opts.standard;
        const list = Array.isArray(items) ? items : [];

        const baseResult = (index, raw) => ({
            index,
            raw,
            proposed: _mechanicalCleanFallback(raw),
            unchanged: true,
            flaggedSparse: false,
            safetyNetTriggered: false
        });

        let entries;
        try {
            entries = list.map((item, index) => {
                const raw = _extractRawNoteText(item);
                const result = baseResult(index, raw);
                if (raw && _evidenceWordCount(raw) <= EVIDENCE_STATEMENT_SPARSE_MAX_WORDS) {
                    result.flaggedSparse = true;
                }
                return result;
            });
        } catch (e) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'buildClientEvidenceStatements: failed to read raw notes from items; returning empty result.', e);
            return [];
        }

        // Only non-sparse notes with actual content are worth an AI call.
        const eligible = entries.filter(r => r.raw && !r.flaggedSparse);
        if (eligible.length === 0) return entries;

        const prompt = `
You are professionalizing raw auditor field notes into client-facing evidence statements for a formal ISO certification audit report${standard ? ` (Standard: ${standard})` : ''}. These statements will appear in a document submitted to the client.

THE HARD RULE — apply this before anything else: you may improve grammar, spelling, capitalization and professional register ONLY. You MUST NOT add any fact, finding, quantity, date, name, cause, conclusion, or compliance/risk judgement that is not already present in the raw note. Do not turn a plain observation into a finding. Do not infer why something happened, its significance, or whether it demonstrates conformity or non-conformity unless the raw note already says so. A faithful, plainly-worded statement is always preferred over an impressive one.

Rules:
1. Fix grammar, spelling, capitalization and punctuation only.
2. Preserve every fact stated in the raw note. Remove nothing material.
3. Do not add adjectives, qualifiers, causes, outcomes, or interpretations that are not already present in the raw note.
4. Preserve the auditor's own terminology, abbreviations, and any proper nouns EXACTLY as written — do not substitute synonyms for named systems, people, roles, or documents.
5. Preserve every number, date, percentage and quantity exactly as given — never add, remove, or change a numeral or amount. You may spell a number out in words (e.g. "2" -> "two") but must not introduce any numeral, date, or percentage that is not already in the raw note.
6. Write one to two clear, complete, professional sentences. Do not pad, elaborate, or speculate beyond what the raw note states.
7. If a raw note is too sparse, fragmentary, or ambiguous to turn into a meaningful, faithful statement without guessing at unstated context, do NOT invent a subject, action, or context to fill the gap — instead return the note only trivially cleaned (spelling/case/punctuation) and set "sparse": true for that entry.
8. Each entry is independent — do not cross-reference, combine, or borrow context from any other entry.
9. Do NOT use markdown formatting. Return plain text only in each "proposed" value.

Raw Auditor Notes:
${JSON.stringify(eligible.map(r => ({ id: r.index, note: r.raw })), null, 2)}

Return raw JSON only (no markdown fences, no prose outside the JSON), an array with 'id', 'proposed' and 'sparse' fields:
[{"id": 0, "proposed": "Professional client-facing statement...", "sparse": false}, ...]
`;

        let parsed;
        try {
            const apiResponseText = await AI_SERVICE.callProxyAPI(prompt);
            parsed = AI_SERVICE.parseAgendaResponse(apiResponseText);
        } catch (error) {
            if (window.Logger) window.Logger.warn('AI_SERVICE', 'buildClientEvidenceStatements: AI request/parse failed; degrading every eligible item to its mechanical clean fallback.', error);
            return entries; // every entry already carries its mechanical-clean fallback
        }

        if (!Array.isArray(parsed)) return entries;

        const byIndex = new Map(entries.map(r => [r.index, r]));
        parsed.forEach(p => {
            if (!p || p.id === undefined || p.id === null) return;
            const target = byIndex.get(Number(p.id));
            if (!target) return;

            if (p.sparse === true) {
                // Model itself judged this too thin — trust the flag, but never
                // its own rewrite; the mechanical fallback already in `target`
                // (from baseResult) is what ships.
                target.flaggedSparse = true;
                return;
            }

            const candidate = _stripMdLite(String(p.proposed || '').trim());
            if (!candidate) return; // nothing usable returned — keep mechanical fallback

            const introduced = _introducedNumericTokens(target.raw, candidate);
            if (introduced.length > 0) {
                if (window.Logger) window.Logger.warn('AI_SERVICE', `buildClientEvidenceStatements: rejected proposal for item ${target.index} — introduced numeric token(s) not present in the raw note: ${introduced.join(', ')}. Falling back to mechanical clean.`);
                target.safetyNetTriggered = true;
                target.unchanged = true;
                // target.proposed already holds the mechanical fallback from baseResult
                return;
            }

            target.proposed = candidate;
            const cleanedRaw = _mechanicalCleanFallback(target.raw);
            target.unchanged = candidate.trim().toLowerCase() === cleanedRaw.trim().toLowerCase();
        });

        return entries;
    },

    // `ofiItems` MUST be strictly ncrType==='ofi' — see runAutoSummary's caller
    // comment. This function does not re-filter its input; it trusts the
    // classification the caller already applied, same as every other
    // ReportStats-adjacent helper in this file.
    draftExecutiveSummary: async (reportData, compliantAreas = [], ofiItems = []) => {
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

        // Format OFI items for the prompt — true OFI findings only, never
        // Observations (those get their own section elsewhere in the report;
        // blending them in here is exactly what produced an "Opportunities for
        // Improvement" narrative that restated every Observation as if it were
        // an OFI).
        let obsText = '';
        if (ofiItems.length > 0) {
            obsText = ofiItems.map((o, i) => `${i + 1}. Clause ${o.clause}: ${o.text}${o.comment ? ' — Auditor note: ' + o.comment : ''}`).join('\n');
        }

        // Get KB context for more accurate positive observations
        // Processes/departments that actually carry a nonconformity.
        //
        // The instruction below asks the model to close by saying "which
        // processes carry the open findings", and until now nothing in the
        // context told it which those were. With no grounding it supplied
        // plausible ISO textbook process names instead: a shipped report
        // attributed its findings to "Rework & Repair, Risk and Opportunity
        // Management, Maintenance and Calibration" — none of which had a
        // finding against it. A named process in a certification report is an
        // assertion about the client's management system, so it has to come
        // from a record rather than from what reads well.
        const ncDepartments = (function () {
            const seen = new Set();
            const add = (v) => { const d = String(v == null ? '' : v).trim(); if (d) seen.add(d); };
            (reportData.checklistProgress || []).forEach(function (i) {
                if (!i || i.status !== 'nc') return;
                if (!['major', 'minor'].includes(String(i.ncrType || '').toLowerCase())) return;
                add(i.department);
            });
            (reportData.ncrs || []).forEach(function (n) {
                if (!n || !/^(major|minor)$/i.test(String(n.type || n.ncrType || n.severity || ''))) return;
                add(n.department);
            });
            return Array.from(seen);
        })();
        const ncDepartmentText = ncDepartments.length ? ncDepartments.join(', ') : 'NONE RECORDED';

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

        // First to last day of the audit: the summary used to be told the
        // first day only and wrote "from 2026-11-17 to 2026-11-17".
        const auditDatesLine = (function () {
            const RS = window.ReportStats;
            const plan = (reportData.planId && window.DataService && typeof window.DataService.findAuditPlan === 'function')
                ? window.DataService.findAuditPlan(reportData.planId) : null;
            const info = RS && typeof RS.auditDates === 'function' ? RS.auditDates(reportData, plan) : null;
            if (!info || !info.text) return String(reportData.date || '');
            return info.text + (info.days > 1 ? ' (' + info.days + ' days)' : ' (one day)');
        })();

        const prompt = `
You are a Senior Lead Auditor with over 30 years of experience at a top-tier international Certification Body (e.g., BSI, Bureau Veritas, DNV, TÜV, SGS). Write an Executive Summary, Positive Observations, and Opportunities for Improvement for a formal Audit Report that will be submitted to the client. Your writing must reflect the authority, precision, and measured judgment of a seasoned CB professional. The report will be reviewed and attested by a Qualified Registrar before client submission.

Context:
- Client: ${reportData.client}
- Standard: ${reportData.standard || 'ISO Standard'}
- Audit dates: ${auditDatesLine}
- Major Non-Conformities: ${stats.majorNC}
- Minor Non-Conformities: ${stats.minorNC}
- Total Non-Conformities (Major + Minor): ${ncCount}
- Observations: ${stats.observationCount}
- Opportunities for Improvement (OFI): ${stats.ofiCount}
- Compliant Clauses/Areas: ${areaText}
- Processes/departments carrying a nonconformity: ${ncDepartmentText}
${orgPlanContext}
${openingMeetingContext}
${planScopeContext}
${kbContext ? `
Standard Requirements (from Knowledge Base):
${kbContext}
` : ''}
${obsText ? `
Opportunities for Improvement (OFI) — from checklist, OFI classification only, does NOT include Observations:
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
1. Executive Summary: Write a comprehensive, authoritative paragraph (150-250 words) summarizing the audit scope, methodology, and overall conclusion. Open with the audit context (type, standard, dates). ${planScopeContext ? 'Reference the stated audit objectives and methodology from the audit plan.' : ''} Briefly reference the opening meeting (attendees, date). State the overall assessment outcome, mentioning the number of non-conformities (${ncCount}), observations (${stats.observationCount}) and opportunities for improvement (${stats.ofiCount}) as three separate figures — never combine observations and OFI into one number. Conclude by stating what the sampled evidence showed about conformity with the audit criteria and which processes carry the open findings — a factual closing statement, not an impression, a grade, or a maturity verdict. Name ONLY processes that appear on the "Processes/departments carrying a nonconformity" line above, spelled exactly as written there. If that line reads NONE RECORDED, name no process at all and do not substitute one that sounds plausible — say the findings are recorded against the clauses cited instead. Naming a process with no finding against it misattributes a nonconformity to part of the client's business that did not receive one. Keep the register plain and objective: requirement, objective evidence, evaluation, finding.
2. Positive Observations: Based on the "Compliant Clauses/Areas" listed above${kbContext ? ' and the standard requirements from the Knowledge Base,' : ','} generate 4-6 specific positive observations. Each must reference the specific clause number and title (e.g. "Clause 5.1 Leadership and commitment"). Describe the specific objective evidence of effective implementation observed. Use authoritative language (e.g., "The audit team confirmed that the organization has established a well-embedded approach to...", "Through examination of records and interviews, the assessment confirmed mature implementation of..."). Do NOT use markdown formatting. Each observation MUST be on its own numbered line (1. 2. 3. etc).
3. OFI: ${obsText ? `Based on the "Opportunities for Improvement (OFI)" list above, write one improvement statement per OFI item listed — exactly ${stats.ofiCount} item${stats.ofiCount === 1 ? '' : 's'} in the returned "ofi" array, no more and no fewer. Do not draw on, restate, or reference any Observation — Observations are a separate classification with their own section of the report and must never appear here. Include the relevant clause numbers and reference specific documents, procedures, or records where improvement is recommended.` : 'Write a list of specific, actionable opportunities for improvement referencing relevant clause requirements.'} Use measured, constructive improvement language befitting a senior auditor (e.g., "The organization would benefit from further developing...", "The audit team recommends consideration of...", "The organization may consider strengthening the control described in..."). These are NOT non-conformities.

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
                    // The model was told exactly how many OFI items to write
                    // (one per genuine OFI finding). More than that means it
                    // invented items or folded in something that isn't an OFI
                    // (an Observation, most likely) — truncate to the
                    // authoritative count rather than let extra entries reach
                    // the printed report and read as more OFIs than exist.
                    if (json.ofi.length > authoritativeCounts.ofiCount) {
                        if (window.Logger) window.Logger.warn('AI_SERVICE', `draftExecutiveSummary returned ${json.ofi.length} OFI item(s) but only ${authoritativeCounts.ofiCount} exist; truncating.`);
                        json.ofi = json.ofi.slice(0, authoritativeCounts.ofiCount);
                    }
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
- Certification Cycle Stage: ${ctx.cycleStage || ctx.type}
- Audit Method: ${ctx.method || 'On-site'}
- Duration: ${ctx.manDays} Man-days (${ctx.onsiteDays} On-site, ${ctx.remoteDays || 0} Remote)
- Approved Scope: ${ctx.scope || 'As recorded in the certification cycle'}
- Risk/Sampling Priority: ${ctx.riskLevel || 'Medium'}
- Significant Changes: ${Array.isArray(ctx.significantChanges) ? ctx.significantChanges.map(change => change.description || change.title || change).join('; ') : (ctx.significantChanges || 'None recorded')}
- Operational/Control Areas: ${(ctx.operationalAreas || []).join(', ') || 'Derive only from the approved scope and applicable standard clauses'}
- Approved Coverage Matrix (mandatory; sequence it but do not delete entries): ${JSON.stringify(ctx.coverageMatrix || {})}
- Sites: ${ctx.sites.map(s => s.name).join(', ')}
- Departments: ${(ctx.departments || []).join(', ')}
- Key Designations: ${(ctx.designations || []).map(d => d.title || d).join(', ')}${personnelSection}${previousAuditSection}${ctx.clientDocumentContext || ''}
**Requirements:**
1. Create a day-by-day schedule covering ${ctx.manDays} audit days and respect the stated remote/on-site allocation.
2. Include "Opening Meeting" (Day 1 AM) and "Closing Meeting" (Last Day PM).
3. Include "Lunch Break" (13:00-14:00) each day.
4. Assign specific auditors from the team to specific activities.
5. Cover specific ISO clauses relevant to ${ctx.standard}.
6. Ensure multiple sites are visited if applicable.
7. In the "Activity / Clause" column, provide ONLY the Clause Number and Title (e.g., "5.1 Leadership"). Do NOT include the full requirement text or summaries. Keep it a single line.
8. Times should be in "HH:MM - HH:MM" format.
9. In the "Department / Auditee" column, use ACTUAL personnel names from the roster above where available. Format as "Department / Person Name" — e.g., "HR / Ahmed Khan". If no matching person exists for a clause, use the department name only.
${ctx.previousAudit ? '10. Include a dedicated "Previous Findings Follow-up / CAPA Verification" session referencing the specific NC clauses from the previous audit.' : ''}
${ctx.method === 'Remote' ? '11. This is a REMOTE audit. Do not schedule physical presence, an on-site review, a facility tour, or other physical site activity.' : ''}
${ctx.method === 'Hybrid' ? '11. Label every activity clearly as Remote or On-site and use each only within its allocated days.' : ''}
12. Optimize sequencing and timing only. Do not remove opening/closing meetings, previous-findings follow-up, applicable management-system clauses, or required operational/control-area coverage. Do not invent requirements.
13. Give sampling priority to previous findings, significant changes, higher-risk processes, applicable management-system clauses and operational/control areas supplied above.
14. Every mandatory entry in the approved coverage matrix must be represented. Common IMS areas may be combined once; standard-specific and site entries must retain their identity.
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

    // JSON headers plus the caller's Supabase access token — /api/gemini
    // rejects requests without a valid session.
    proxyHeaders: async () => {
        if (typeof window.apiJsonHeaders === 'function') return window.apiJsonHeaders();
        return { 'Content-Type': 'application/json' };
    },

    // Call Vercel Serverless Function with Fallback Logic
    callProxyAPI: async (prompt, options = {}) => {
        // Model fallback list — use current, supported models only
        // options.models: a caller that needs a particular model (evidence
        // explanation) names its own list and gets no silent downgrade.
        const models = Array.isArray(options.models) && options.models.length ? options.models : ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
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
                    headers: await AI_SERVICE.proxyHeaders(),
                    body: JSON.stringify(Object.assign({ prompt, model, maxTokens },
                        Array.isArray(options.images) && options.images.length ? { images: options.images } : {},
                        options.json ? { json: true } : {},
                        options.temperature != null ? { temperature: options.temperature } : {}))
                });

                if (response.status === 401) {
                    // Every model would get the same answer — stop here.
                    const authError = new Error('Your session has expired. Please sign in again to use AI features.');
                    authError.authRequired = true;
                    throw authError;
                }

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
                        // The proxy says when Gemini is rate limiting or
                        // overloaded: worth waiting for (see _evidenceCall).
                        lastError.upstreamStatus = data.upstreamStatus || null;
                        lastError.busy = data.busy === true;
                        lastError.retryAfterSeconds = Number(data.retryAfterSeconds) || 0;
                    } catch (_e) {
                        // Change to warn to avoid scaring users when fallback is available
                        console.warn(`AI Proxy connection failed: ${response.status} ${response.statusText} - will attempt fallback.`);
                        lastError = new Error(`AI Service connection failed: ${response.status} ${response.statusText} `);
                        // A gateway answer with no JSON: the function timed out or is rate limited.
                        lastError.busy = response.status === 429 || response.status === 503 || response.status === 504;
                    }
                    continue;
                }

                const data = await response.json();

                // Success!
                if (window.APIUsageTracker) {
                    const usage = data.usage || {};
                    window.APIUsageTracker.logUsage({
                        feature: options.feature || 'ai-generation',
                        inputTokens: usage.promptTokenCount || window.APIUsageTracker.estimateTokens(prompt),
                        // Thinking tokens are billed as output.
                        outputTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0),
                        success: true,
                        model: model
                    });
                }

                const text = AI_SERVICE.extractTextFromResponse(data);
                return options.withUsage ? { text, usage: data.usage || {}, model: data.model || model } : text;

            } catch (error) {
                if (error.authRequired) throw error;
                console.warn(`Error with model ${model}: `, error);
                lastError = error;

                // Check if this is a network/fetch error indicating the API isn't available
                if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                    proxyFailed = true;
                    break; // Stop trying proxy, fall through to direct API
                }
            }
        }

        // Evidence images go only through the server proxy, never the
        // browser-key fallback below. options.proxyOnly: the same for a
        // text-only evidence call (its prompt holds what the screenshots show).
        if (options.proxyOnly || (Array.isArray(options.images) && options.images.length)) {
            throw lastError || new Error('The AI service is not available.');
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
                        headers: await AI_SERVICE.proxyHeaders(),
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
            headers: await AI_SERVICE.proxyHeaders(),
            body: JSON.stringify({ mode: 'list' })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch model list');
        }

        const data = await response.json();
        return data.models || [];
    },

    // Helper: Extract text from Gemini JSON response.
    //
    // A 200-OK Gemini response with no usable text is NOT one failure mode —
    // it's several, and they need different handling by the caller:
    //   - the whole prompt was rejected (promptFeedback.blockReason, no candidates)
    //   - a candidate exists but was cut off before producing text
    //     (finishReason MAX_TOKENS — common on "thinking" models, e.g.
    //     gemini-2.5-flash/-lite, when the reasoning budget consumes the
    //     entire token budget before any visible output is written)
    //   - a candidate was blocked/filtered (finishReason SAFETY/RECITATION/OTHER)
    //   - the JSON body simply isn't the candidates/content/parts shape we expect
    // Collapsing all of these into one generic "No content returned from AI"
    // (the old behavior) is what made a real production failure undiagnosable
    // from the console. Each thrown Error now carries a stable `.code` so
    // callers (e.g. execution-reporting.js's polishNotesWithAI) can show the
    // auditor the real reason instead of silently doing nothing.
    //
    // SUCCESS-PATH RETURN SHAPE IS UNCHANGED — still just the plain text
    // string. Do not change that: extractTextFromResponse is called from
    // several sites (grep the name) that all destructure/parse the returned
    // string directly.
    extractTextFromResponse: (data) => {
        const fail = (code, message) => {
            const err = new Error(message);
            err.code = code;
            throw err;
        };

        if (!data || typeof data !== 'object') {
            fail('UNEXPECTED_SHAPE', 'AI response was not valid JSON.');
        }

        if (!data.candidates || data.candidates.length === 0) {
            // Prompt-level block: Gemini omits `candidates` entirely and reports
            // the reason at the top level when the INPUT (not a generated
            // candidate) was rejected by safety filtering.
            const blockReason = data.promptFeedback && data.promptFeedback.blockReason;
            if (blockReason) {
                fail('BLOCKED', `AI request was blocked before generating a response (reason: ${blockReason}).`);
            }
            fail('EMPTY_RESPONSE', 'AI returned no candidates in its response.');
        }

        const candidate = data.candidates[0];
        const text = candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

        if (typeof text === 'string' && text.length > 0) {
            return text;
        }

        // Candidate exists but carries no usable text — finishReason says why.
        const finishReason = candidate.finishReason;
        if (finishReason === 'MAX_TOKENS') {
            fail('MAX_TOKENS', 'AI response was cut off before producing any output because it hit the model\'s output token limit (finishReason: MAX_TOKENS).');
        }
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
            fail('BLOCKED', `AI declined to respond because the content was flagged by its filters (finishReason: ${finishReason}).`);
        }
        if (finishReason && finishReason !== 'STOP') {
            fail('BLOCKED', `AI returned no usable text (finishReason: ${finishReason}).`);
        }

        fail('EMPTY_RESPONSE', 'AI returned an empty response with no text content.');
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
    } catch (_e) { return '0'; }
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
    } catch (_e) { /* fall through */ }
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
    // Fails closed: a report the validator could not examine is unverified, so
    // a missing module or a thrown error blocks issuance rather than passing. ───
    let integrityResult = null;
    try {
        if (window.ReportIntegrity && typeof window.ReportIntegrity.check === 'function') {
            const client = _resolveClientForReport(report, plan);
            integrityResult = window.ReportIntegrity.check({ report, auditPlan: plan, client, stats: rs });
        } else {
            gateBlockers.push('Report integrity validator is not loaded — reload the page before issuing.');
        }
    } catch (e) {
        if (window.Logger) window.Logger.error('AI_SERVICE', 'ReportIntegrity.check failed during finalize gate', e);
        else console.error('ReportIntegrity.check failed during finalize gate:', e);
        gateBlockers.push('Report integrity check could not run: ' + ((e && e.message) || String(e)));
    }

    return { report, plan, stats: rs, gateBlockers, gateWarnings, integrity: integrityResult };
};

// 1. Finalize & Publish (One-Click Workflow)
window.finalizeAndPublish = async function (reportId) {
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

    // Save current state first, and wait for it: that save merges in what was
    // saved elsewhere since this tab loaded (ChecklistMerge.mergeFields), so
    // the write below no longer puts an old copy back over it. It used to run
    // unawaited, and this write sent the tab's copy as it stood.
    if (typeof window.saveChecklist === 'function') await window.saveChecklist(reportId);

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
        // The frozen sentence, so wording changes never alter the fingerprint
        // (see ReportStats.recommendationFingerprint).
        recommendation: rs.recommendationKey != null ? rs.recommendationKey : rs.recommendation
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
                data: Object.assign({}, report, { _evidenceIndexBuilt: undefined })
            });
            if (window.ChecklistMerge) window.ChecklistMerge.noteServerFields(reportId, report);
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

// 2. AI auto-analysis of findings (window.runFollowUpAIAnalysis, "AI
// Auto-Classify & Polish") was removed on 2026-11-19; see execution-reporting.js.

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

        // Gather TRUE OFI items only for the AI's "opportunities for improvement"
        // narrative. This used to also sweep in Observations (and even blank/
        // pending-classification NCs) under the label "OBS/OFI items", handed to
        // the AI as if they were all OFI findings — which is exactly why the
        // Opportunities for Improvement section could read as 4-5 paragraphs
        // (one per observation, restated) when only 1 real OFI existed, and why
        // the executive summary's own count sentence would drift to match that
        // inflated list length instead of the authoritative OFI count. Strictly
        // ncrType==='ofi' now — Observations get their own section from
        // report-findings-ops.js and must never be drafted as if they were OFIs.
        const ofiItems = [];
        if (report.checklistProgress) {
            report.checklistProgress.filter(p => p.status === 'nc' && String(p.ncrType || '').toLowerCase() === 'ofi').forEach(item => {
                const { clauseText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);
                ofiItems.push({
                    clause: clauseText || item.clause || item.id,
                    text: item.requirement || item.description || item.text || clauseText || '',
                    comment: item.comment || ''
                });
            });
        }

        const result = await window.AI_SERVICE.draftExecutiveSummary(report, uniqueCompliantAreas, ofiItems);

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

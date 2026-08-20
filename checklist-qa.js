// ============================================
// CHECKLIST QA VALIDATION  (window.ChecklistQA)
// ============================================
// Automated defensibility pass over a generated checklist, run BEFORE the
// checklist is printed, exported to PDF or handed to an auditor.
//
// It answers one question: could this checklist be defended in front of an
// accreditation assessor? Every issue names the item it came from so the
// generator — or the auditor — can act on it.
//
// Pure functions, no DOM. Consumed by client-docs-bulk.js (at generation time)
// and checklist-module.js (at print/export time).
//
// CONTRACT
//   window.ChecklistQA.validate(checklist, ctx) -> {
//       ok, blocking, counts, issues: [{code, severity, message, itemRef, section}]
//   }
//   ctx = { standardIds: [], auditType, ceiling, soaApplicable: ['A.5.1', ...] }
//
// SEVERITY
//   'critical' — the checklist is wrong and must not go out as-is
//   'warning'  — defensible only with an auditor's judgement call
//   'info'     — a deliberate hand-off to the auditor, recorded for the file

(function (global) {
    'use strict';

    const CS = () => global.ChecklistStandards;

    // ── Foreign-requirement lexicon ───────────────────────────────────
    // Terminology that belongs to a specific standard. An item using it is
    // flagged unless one of the standards that actually requires it is in the
    // audit scope. This is what catches the ISO 9001 clause set leaking into a
    // 27001 / 22301 / 20000-1 engagement.
    //
    // `requiredBy` lists the standard ids (registry ids where the registry has
    // them, plain tokens otherwise) whose presence makes the term legitimate.
    // Patterns are deliberately tight: "design and development" is a 9001
    // concept, while ISO/IEC 20000-1's "service design and transition" is not
    // matched by it.
    const FOREIGN_TERMS = [
        [/\bcustomer focus\b/i, 'Customer focus', ['iso9001'], 'ISO 9001:2015 5.1.2'],
        [/\bdesign and development\b|\bdesign & development\b/i, 'Design and development', ['iso9001', 'iso13485'], 'ISO 9001:2015 8.3'],
        [/\bquality management system\b|\bQMS\b/, 'Quality management system', ['iso9001'], 'ISO 9001:2015'],
        [/\bquality (policy|objectives?|manual|plan)\b/i, 'Quality policy / objectives', ['iso9001'], 'ISO 9001:2015 5.2 / 6.2'],
        [/\bmonitoring and measuring (equipment|resources|devices)\b|\bcalibrat(ion|ed|e)\b/i, 'Monitoring and measuring resources / calibration', ['iso9001', 'iso17025', 'iso13485'], 'ISO 9001:2015 7.1.5'],
        [/\bnonconforming outputs?\b/i, 'Control of nonconforming outputs', ['iso9001'], 'ISO 9001:2015 8.7'],
        [/\bproduction and service provision\b/i, 'Production and service provision', ['iso9001'], 'ISO 9001:2015 8.5'],
        [/\bpost-delivery activities\b/i, 'Post-delivery activities', ['iso9001'], 'ISO 9001:2015 8.5.5'],
        [/\brelease of products and services\b/i, 'Release of products and services', ['iso9001'], 'ISO 9001:2015 8.6'],
        [/\benvironmental (aspects?|impacts?|management system)\b|\bEMS\b/, 'Environmental management', ['iso14001'], 'ISO 14001:2015'],
        [/\bcompliance obligations\b/i, 'Compliance obligations', ['iso14001'], 'ISO 14001:2015 6.1.3'],
        [/\blife cycle perspective\b/i, 'Life cycle perspective', ['iso14001'], 'ISO 14001:2015 6.1.2'],
        [/\bhazard identification\b|\bOH&S\b|\boccupational health and safety\b|\bhierarchy of controls\b/i, 'Occupational health and safety', ['iso45001'], 'ISO 45001:2018'],
        [/\bconsultation and participation of workers\b/i, 'Worker consultation and participation', ['iso45001'], 'ISO 45001:2018 5.4'],
        [/\bHACCP\b|\bfood safety\b|\bprerequisite programme\b|\bPRPs?\b/, 'Food safety', ['iso22000'], 'ISO 22000:2018'],
        // Legitimate for ISO/IEC 20000-1 (8.3.2 business relationship
        // management explicitly requires it) and for ISO 9001. Not for an
        // ISMS/BCMS-only scope.
        [/\bcustomer satisfaction\b/i, 'Customer satisfaction measurement', ['iso9001', 'iso20000'], 'ISO/IEC 20000-1:2018 8.3.2 / ISO 9001:2015 9.1.2']
    ];

    // Boilerplate that adds no audit value when it is asked of every document
    // in turn. Counted, and flagged once the count passes the threshold — the
    // document-control requirement is meant to be tested by representative
    // sampling, not repeated per document.
    const BOILERPLATE = [
        [/current approved issue/i, 'document is the current approved issue'],
        [/uncontrolled cop(y|ies)/i, 'no uncontrolled copies in circulation'],
        [/is documented, implemented, (controlled and )?reviewed/i, 'documented / implemented / controlled / reviewed'],
        [/confirm its status, control and relevance/i, 'document status, control and relevance']
    ];
    const BOILERPLATE_LIMIT = 3;

    const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'it', 'its',
        'for', 'that', 'this', 'has', 'have', 'been', 'be', 'was', 'were', 'on', 'at', 'by', 'with',
        'as', 'from', 'they', 'their', 'confirm', 'verify', 'review', 'check']);

    /** Strip the client-specific noise so two questions can be compared on substance. */
    function normalizeText(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[‘’“”]/g, "'")
            .replace(/\((rev|issue|ver)[^)]*\)/gi, ' ')
            .replace(/\bv?\d+(\.\d+)*\b/g, ' ')
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokens(s) {
        return normalizeText(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
    }

    function jaccard(a, b) {
        if (!a.size || !b.size) return 0;
        let shared = 0;
        a.forEach(t => { if (b.has(t)) shared++; });
        return shared / (a.size + b.size - shared);
    }

    /**
     * Walk a checklist's clause -> subClause -> items tree into a flat list the
     * checks can iterate. Tolerates both the generated shape and the legacy
     * flat `items` shape older checklists still use.
     */
    function flatten(checklist) {
        const out = [];
        const cl = (checklist && checklist.clauses) || [];
        cl.forEach(main => {
            (main.subClauses || []).forEach(sub => {
                out.push({
                    section: main.mainClause,
                    sectionTitle: main.title || '',
                    clause: sub.clause,
                    title: sub.title || '',
                    requirement: sub.requirement || (sub.items && sub.items[0] && sub.items[0].requirement) || '',
                    refs: Array.isArray(sub.refs) ? sub.refs : null,
                    standards: Array.isArray(sub.standards) ? sub.standards : null,
                    auditorReview: !!sub.auditorReview,
                    raw: sub
                });
            });
        });
        if (!out.length && Array.isArray(checklist && checklist.items)) {
            checklist.items.forEach(it => out.push({
                section: '', sectionTitle: '', clause: it.clause, title: it.title || '',
                requirement: it.requirement || it.text || '', refs: null, standards: null,
                auditorReview: false, raw: it
            }));
        }
        return out;
    }

    /** A ref the generator uses as a section tag rather than a standard citation. */
    const PSEUDO_REFS = new Set(['ORG', 'DOC', 'IMS', 'RECERT', 'REVIEW', 'FOCUS', 'SURV', 'THEME', 'SOA', '']);
    function isPseudoRef(ref) {
        const r = String(ref || '').trim();
        return PSEUDO_REFS.has(r) || /^(FOCUS|SURV|DOC|ORG|IMS|RECERT|REVIEW|THEME|SOA)[.\d]*$/i.test(r);
    }

    function issue(code, severity, message, item, extra) {
        return Object.assign({
            code, severity, message,
            itemRef: item ? (item.clause || item.section || '') : '',
            itemTitle: item ? (item.title || '') : '',
            section: item ? item.section : ''
        }, extra || {});
    }

    /**
     * Run the full QA pass.
     *
     * @param {Object} checklist - as produced by buildClientChecklist
     * @param {Object} ctx
     * @param {string[]} ctx.standardIds  - registry ids actually selected for the audit
     * @param {string}   ctx.auditType    - 'surveillance' | 'initial' | 'recertification'
     * @param {number}  [ctx.ceiling]     - risk-based maximum question count
     * @param {string[]}[ctx.soaApplicable] - Annex A refs the SoA marks applicable
     * @returns {{ok, blocking, counts, itemCount, issues}}
     */
    function validate(checklist, ctx) {
        const c = ctx || {};
        const ids = (c.standardIds || []).slice();
        const items = flatten(checklist);
        const issues = [];
        const Std = CS();

        // ── 1. Clauses belonging to unselected standards ──────────────
        // (a) declared: the item says which standard it tests
        items.forEach(it => {
            (it.standards || []).forEach(sid => {
                if (!ids.includes(sid)) {
                    issues.push(issue('OUT_OF_SCOPE_STANDARD', 'critical',
                        `Item is tagged to "${sid}", which is not one of the selected audit standards.`, it));
                }
            });
        });
        // (b) inferred from terminology
        items.forEach(it => {
            const hay = `${it.title} ${it.requirement}`;
            FOREIGN_TERMS.forEach(([re, concept, requiredBy, origin]) => {
                if (!re.test(hay)) return;
                if (requiredBy.some(r => ids.includes(r))) return;
                issues.push(issue('OUT_OF_SCOPE_STANDARD', 'critical',
                    `"${concept}" is a requirement of ${origin}, which is not in the audit scope.`, it,
                    { concept, origin }));
            });
        });

        // ── 2. Invalid clause / control references ────────────────────
        items.forEach(it => {
            const refs = it.refs && it.refs.length
                ? it.refs
                : (isPseudoRef(it.clause) ? [] : ids.map(id => ({ stdId: id, ref: it.clause })));
            if (!refs.length) return;
            if (!Std) return;
            // A citation is valid when at least one selected standard genuinely
            // has that ref. An item citing an explicit {stdId, ref} pair must
            // match that exact standard.
            const anyValid = it.refs && it.refs.length
                ? it.refs.every(r => Std.isKnownRef(r.stdId, r.ref))
                : refs.some(r => Std.isKnownRef(r.stdId, r.ref));
            if (!anyValid) {
                issues.push(issue('INVALID_REF', 'critical',
                    `Clause/control reference "${it.clause}" does not exist in ${ids.length ? 'any selected standard' : 'the selected scope'}.`, it));
            }
        });

        // ── 3. Duplicate and near-duplicate questions ─────────────────
        const seen = new Map();
        const tokenSets = items.map(it => new Set(tokens(`${it.title} ${it.requirement}`)));
        items.forEach((it, i) => {
            const key = normalizeText(it.requirement);
            if (!key) return;
            if (seen.has(key)) {
                issues.push(issue('DUPLICATE_QUESTION', 'warning',
                    `Identical to the question at ${seen.get(key)}.`, it, { duplicateOf: seen.get(key) }));
            } else {
                seen.set(key, it.clause || `#${i + 1}`);
            }
        });
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const sim = jaccard(tokenSets[i], tokenSets[j]);
                if (sim >= 0.82 && normalizeText(items[i].requirement) !== normalizeText(items[j].requirement)) {
                    issues.push(issue('NEAR_DUPLICATE', 'warning',
                        `Reads as the same question as "${items[j].clause}" (${Math.round(sim * 100)}% overlap).`,
                        items[i], { nearRef: items[j].clause, similarity: Math.round(sim * 100) }));
                }
            }
        }

        // Repetitive document-control boilerplate.
        BOILERPLATE.forEach(([re, label]) => {
            const hits = items.filter(it => re.test(it.requirement));
            if (hits.length > BOILERPLATE_LIMIT) {
                issues.push(issue('REPETITIVE_BOILERPLATE', 'warning',
                    `"${label}" is asked ${hits.length} times. Test document control through representative sampling instead.`,
                    hits[0], { occurrences: hits.length }));
            }
        });

        // ── 4. Contradictory mappings ─────────────────────────────────
        // The same reference used for two materially different requirements —
        // the symptom of a clause number being reused across standards without
        // checking what it actually requires.
        if (Std) {
            const byRef = new Map();
            items.forEach(it => {
                if (isPseudoRef(it.clause)) return;
                if (!byRef.has(it.clause)) byRef.set(it.clause, []);
                byRef.get(it.clause).push(it);
            });
            byRef.forEach((group, ref) => {
                const known = Std.lookupRef(ids, ref);
                if (!known.length) return;
                const titles = new Set(known.map(k => normalizeText(k.title)));
                // Two selected standards give this number genuinely different
                // titles: any item citing it must say which standard it means.
                if (titles.size > 1) {
                    group.forEach(it => {
                        const declared = (it.refs || []).length || (it.standards || []).length;
                        if (!declared) {
                            issues.push(issue('CONTRADICTORY_MAPPING', 'critical',
                                `Clause ${ref} means different things in the selected standards (${known.map(k => `${k.label}: ${k.title}`).join('; ')}). The item does not say which one it tests.`,
                                it, { ref }));
                        }
                    });
                }
            });
        }

        // ── 5. Requirements that tie to nothing in scope ──────────────
        items.forEach(it => {
            if (it.auditorReview) return;
            if (!isPseudoRef(it.clause)) return;
            const hasRefs = (it.refs || []).length > 0;
            // ORG items are scope/process sampling and legitimately carry the
            // organisation's own reference rather than a clause; everything
            // else without any citation cannot be defended as a requirement.
            if (!hasRefs && it.section !== 'ORG') {
                issues.push(issue('IRRELEVANT_REQUIREMENT', 'warning',
                    'Question cannot be tied to a requirement of any selected standard.', it));
            }
        });

        // ── 6. Excessive question count ───────────────────────────────
        const ceiling = c.ceiling;
        if (ceiling && items.length > ceiling) {
            issues.push(issue('EXCESSIVE_COUNT', 'critical',
                `${items.length} questions against a risk-based ceiling of ${ceiling} for this audit. Checklist length must follow scope and risk, not the number of documents on file.`,
                null, { count: items.length, ceiling }));
        }

        // ── 7. Missing selected-standard requirements ─────────────────
        if (Std && ids.length) {
            const coveredRefs = new Set();
            items.forEach(it => {
                (it.refs || []).forEach(r => coveredRefs.add(`${r.stdId}::${r.ref}`));
                if (!isPseudoRef(it.clause)) ids.forEach(id => coveredRefs.add(`${id}::${it.clause}`));
            });
            ids.forEach(id => {
                const std = Std.byId(id);
                if (!std) return;
                const missing = std.clauses
                    .filter(cl => cl.mandatory && !coveredRefs.has(`${id}::${cl.ref}`))
                    // A parent clause is covered when a sub-clause of it is.
                    .filter(cl => !Array.from(coveredRefs).some(k =>
                        k.indexOf(`${id}::${cl.ref}.`) === 0));
                if (missing.length) {
                    issues.push(issue('MISSING_REQUIREMENT',
                        c.auditType === 'surveillance' ? 'info' : 'critical',
                        `${std.label}: ${missing.length} requirement(s) not covered — ${missing.slice(0, 8).map(m => m.ref).join(', ')}${missing.length > 8 ? '…' : ''}.`,
                        null, { stdId: id, missing: missing.map(m => m.ref) }));
                }
            });

            // Annex A coverage, sampled against the SoA when one is available.
            ids.forEach(id => {
                const std = Std.byId(id);
                if (!std || !std.hasSoA) return;
                const applicable = (c.soaApplicable && c.soaApplicable.length)
                    ? std.controls.filter(ct => c.soaApplicable.includes(ct.ref))
                    : std.controls.filter(ct => ct.tier === 1);
                const covered = applicable.filter(ct => coveredRefs.has(`${id}::${ct.ref}`));
                if (!covered.length) {
                    issues.push(issue('MISSING_ANNEX_A', 'critical',
                        `${std.label}: no Annex A controls are sampled. A ${c.auditType || 'certification'} audit of an ISMS must sample the controls the Statement of Applicability declares applicable.`,
                        null, { stdId: id }));
                } else if (covered.length < Math.min(8, Math.ceil(applicable.length * 0.25))) {
                    issues.push(issue('MISSING_ANNEX_A', 'warning',
                        `${std.label}: only ${covered.length} of ${applicable.length} applicable Annex A controls are sampled — thin for a defensible SoA sample.`,
                        null, { stdId: id, covered: covered.length, applicable: applicable.length }));
                }
            });
        }

        // ── 8. Deliberate auditor hand-offs ───────────────────────────
        const handoffs = items.filter(it => it.auditorReview);
        if (handoffs.length) {
            issues.push(issue('AUDITOR_REVIEW', 'info',
                `${handoffs.length} item(s) carry no clause citation and are marked for auditor review — a reliable mapping could not be established, so none was invented.`,
                null, { count: handoffs.length }));
        }

        const counts = { critical: 0, warning: 0, info: 0 };
        issues.forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });

        return {
            ok: counts.critical === 0 && counts.warning === 0,
            blocking: counts.critical > 0,
            counts,
            itemCount: items.length,
            issues
        };
    }

    /** One-line summary for a toast or a print banner. */
    function summarize(result) {
        if (!result) return '';
        if (result.ok) {
            // `ok` means nothing to fix. Informational notes — auditor
            // hand-offs, surveillance coverage gaps — are still stated, because
            // "no issues" would misdescribe a checklist that deliberately left
            // items for the auditor.
            return result.counts.info
                ? `QA passed — ${result.itemCount} questions, no issues to resolve, ${result.counts.info} note(s) for the auditor.`
                : `QA passed — ${result.itemCount} questions, no issues.`;
        }
        const bits = [];
        if (result.counts.critical) bits.push(`${result.counts.critical} critical`);
        if (result.counts.warning) bits.push(`${result.counts.warning} warning`);
        if (result.counts.info) bits.push(`${result.counts.info} note`);
        return `QA: ${bits.join(', ')} across ${result.itemCount} questions.`;
    }

    const API = { validate, summarize, flatten, normalizeText, jaccard, tokens, FOREIGN_TERMS, isPseudoRef };
    global.ChecklistQA = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger) global.Logger.debug('Modules', 'checklist-qa.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * report-stats.js — Canonical dataset builder for AuditCB-360 audit reports.
 * =============================================================================
 * Standalone, framework-free companion module. Does NOT modify any other
 * file. Provides a single pure, synchronous, never-throwing function that
 * every other report-*.js module (and execution-reporting.js /
 * execution-module-v2.js) can consume as the single source of truth for
 * result counts, coverage/conformity percentages, unique findings,
 * advisories, CAPA rollups, department/clause breakdowns, and headline
 * audit status — instead of every module recounting `hydratedProgress`
 * with its own (and sometimes inconsistent) rules.
 *
 * Public API — window.ReportStats:
 *   build({report, hydratedProgress, auditPlan, client}) -> dataset
 *   version: 1
 *
 * Classification rules (the whole point of this module):
 *   - item.status === '' or missing  -> notAssessed. Never counted as
 *     applicable-assessed, never conforming, never NC.
 *   - item.status === 'na'           -> excluded from BOTH coverage and
 *     conformity denominators entirely.
 *   - item.status === 'nc' with ncrType 'major'/'minor'      -> real NC.
 *   - item.status === 'nc' with ncrType blank/unrecognized   -> counted in
 *     the NC bucket as 'pendingClassification' AND flagged in
 *     `reconciliation` as an unclassified finding.
 *   - item.status === 'nc' with ncrType 'observation'/'ofi'  -> advisory.
 *     Advisories are ASSESSED and ASSESSED-CONFORMING for conformity
 *     purposes (they do not reduce conformityPct), but they are not
 *     literal 'conform' items either — tracked separately.
 *   - item.status === 'conform' (with or without a leftover ncrType)
 *     -> conform. ncrType is ignored in this case.
 *
 *   applicable  = totalItems - na
 *   assessed    = conform + majorNC + minorNC + pendingClassification + advisories.total
 *   coveragePct   = round(assessed / applicable * 100); null if applicable === 0
 *   conformityPct = round((assessed - majorNC - minorNC - pendingClassification) / assessed * 100);
 *                   null if assessed === 0
 *                   (i.e. only real NCs reduce conformity — advisories are
 *                   "conforming with comment")
 * =============================================================================
 */
(function (global) {
    'use strict';

    const round = (n) => Math.round(Number(n) || 0);
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const pct = (num, den) => (den > 0 ? clamp(round((num / den) * 100), 0, 100) : null);
    const safeArr = (a) => (Array.isArray(a) ? a : []);
    const trim = (s) => String(s == null ? '' : s).trim();

    const UNASSIGNED_LABEL = 'Unassigned / Cross-functional';
    function normalizeDeptName(raw) {
        const s = trim(raw);
        if (!s) return UNASSIGNED_LABEL;
        if (/^(unassigned|general|n\/?a|none|other)$/i.test(s)) return UNASSIGNED_LABEL;
        return s;
    }

    // The area an item is reported under (Audit Trails, the evidence annex):
    // its department when one is recorded, otherwise the agenda session that
    // covered its clause (plan.traceability), otherwise "not tied to an agenda
    // session". PC Connection's 2026 recertification recorded no departments,
    // so every item read "Unassigned / Cross-functional" (technical review
    // item 12). Returns item -> { label, rank }; rank orders departments
    // first, then sessions in agenda order, then untied items.
    const UNTIED_AREA_LABEL = 'Other items (not tied to an agenda session)';
    function auditAreaResolver(plan) {
        const tr = (plan && plan.traceability) || {};
        const titles = {};
        const rank = {};
        safeArr(tr.sessions).forEach((sn, i) => {
            if (sn && sn.sessionId && sn.title) { titles[sn.sessionId] = trim(sn.title); rank[sn.sessionId] = i; }
        });
        const tokens = (c) => String(c == null ? '' : c).split(/[,/;]+/).map(trim).filter(Boolean);
        const byToken = {};
        safeArr(tr.checklist && tr.checklist.questions).forEach((q) => {
            const ids = safeArr(q && q.sessionIds).filter((id) => titles[id]);
            if (!ids.length) return;
            [trim(q.clause)].concat(tokens(q.clause)).forEach((t) => { if (t && !byToken[t]) byToken[t] = ids[0]; });
        });
        const hasSessions = Object.keys(titles).length > 0;
        return (item) => {
            const raw = trim(item && item.department);
            if (raw || !hasSessions) return { label: normalizeDeptName(raw), rank: -1 };
            const cands = [item && item.clause, item && item.criterionRef].map(trim).filter(Boolean);
            const all = cands.concat(cands.reduce((acc, c) => acc.concat(tokens(c)), []));
            for (let i = 0; i < all.length; i++) {
                const sid = byToken[all[i]];
                if (sid) return { label: titles[sid], rank: rank[sid] };
            }
            return { label: UNTIED_AREA_LABEL, rank: 100000 };
        };
    }

    function itemHasEvidence(item) {
        return !!(item && (item.evidenceImage || (Array.isArray(item.evidenceImages) && item.evidenceImages.length > 0)));
    }

    function evidenceCount(item) {
        if (!item) return 0;
        if (Array.isArray(item.evidenceImages)) return item.evidenceImages.length;
        return item.evidenceImage ? 1 : 0;
    }

    // Classifies a single checklist item into exactly one bucket.
    // Returns one of: 'notAssessed' | 'na' | 'conform' | 'majorNC' | 'minorNC'
    //                | 'pendingClassification' | 'observation' | 'ofi'
    function classifyItem(item) {
        const status = trim(item && item.status).toLowerCase();
        if (!status) return 'notAssessed';
        if (status === 'na') return 'na';
        if (status === 'conform') return 'conform';
        if (status === 'nc') {
            const t = trim(item && item.ncrType).toLowerCase();
            if (t === 'major') return 'majorNC';
            if (t === 'minor') return 'minorNC';
            if (t === 'observation') return 'observation';
            if (t === 'ofi') return 'ofi';
            return 'pendingClassification';
        }
        // 'not_sampled' (risk-based sampling) and any unrecognized status string
        // — treat conservatively as not assessed
        // rather than guessing a classification that could misstate conformity.
        return 'notAssessed';
    }

    function severityFromBucket(bucket) {
        if (bucket === 'majorNC') return 'major';
        if (bucket === 'minorNC') return 'minor';
        if (bucket === 'pendingClassification') return 'pending_classification';
        return null;
    }

    const CHECKLIST_LEADIN = /^(show|verify|verify that|check|confirm|confirm that|provide|demonstrate|ensure|ensure that|describe|explain|review|observe|inspect|examine|validate|assess)\b\s*(that|whether)?\s*/i;
    function cleanText(raw, maxLen) {
        let text = String(raw == null ? '' : raw);
        text = text.replace(/\s*\[[^\]]*\]\s*/g, ' ');
        text = text.replace(CHECKLIST_LEADIN, '');
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/^[\s,:;.-]+/, '');
        if (!text) text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
        if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
        if (maxLen && text.length > maxLen) {
            const cut = text.slice(0, maxLen - 1);
            const lastSpace = cut.lastIndexOf(' ');
            text = (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,:;.-]+$/, '') + '…';
        }
        return text;
    }

    // ─── Mechanical evidence-text normalizer ────────────────────────────────
    // Trim / collapse whitespace / capitalize the first letter / add a missing
    // terminal period / un-double-encode stray HTML entities. Deliberately
    // mechanical only — never rewords, rephrases, or corrects spelling; the
    // auditor's actual words are never altered, only their formatting.
    function cleanEvidenceText(raw) {
        let text = String(raw == null ? '' : raw);
        // Un-double-encode stray entities, e.g. '&amp;amp;' -> '&amp;',
        // '&amp;lt;' -> '&lt;' — textual substitution only, not a full HTML decode.
        text = text.replace(/&amp;(#\w+;|[a-zA-Z]+;)/g, '&$1');
        // Auditors type plain characters; an entity sitting in stored text got
        // there from an HTML round-trip. Left encoded it is escaped AGAIN at
        // render time and prints literally as "&amp;" (seen in the KTD report:
        // "Share Point in Place &amp; Quickbooks"). Decode the handful of entities
        // that occur in practice — the renderer escapes once afterwards, so the
        // output stays safe.
        text = text
            .replace(/&(amp|#38);/gi, '&')
            .replace(/&(lt|#60);/gi, '<')
            .replace(/&(gt|#62);/gi, '>')
            .replace(/&(quot|#34);/gi, '"')
            .replace(/&(#39|apos|rsquo|#8217);/gi, "'")
            .replace(/&nbsp;/gi, ' ');
        // Collapse internal whitespace/newlines to single spaces, trim ends.
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) return text;
        // Capitalize only the first character — spelling/casing of every other
        // character is left exactly as the auditor wrote it.
        text = text.charAt(0).toUpperCase() + text.slice(1);
        // A sentence fragment left hanging on a letter/digit gets a terminal
        // period; text already ending in punctuation (. ! ? ; : ) " etc.) is
        // left alone.
        if (/[A-Za-z0-9]$/.test(text)) text += '.';
        return text;
    }

    // Best-effort audit date window, widened by ±7 days per report-risk.js's
    // linkedCapaRecords convention, used to sanity-bound register matches.
    function auditWindow(report, auditPlan) {
        const baseDate = (report && (report.date || report.createdAt)) || null;
        const startRaw = (auditPlan && (auditPlan.startDate || auditPlan.date)) || baseDate;
        const endRaw = (auditPlan && (auditPlan.endDate || auditPlan.date)) || baseDate;
        let startTime = startRaw ? new Date(startRaw).getTime() : null;
        let endTime = endRaw ? new Date(endRaw).getTime() : null;
        if (startTime != null && isNaN(startTime)) startTime = null;
        if (endTime != null && isNaN(endTime)) endTime = null;
        if (startTime != null) startTime -= 7 * 86400000;
        if (endTime != null) endTime += 7 * 86400000;
        return { startTime, endTime };
    }

    function dateWithinWindow(dateStr, win) {
        if (!dateStr) return true; // no date on record — don't exclude, just can't confirm
        const t = new Date(dateStr).getTime();
        if (isNaN(t)) return true;
        if (win.startTime != null && t < win.startTime) return false;
        if (win.endTime != null && t > win.endTime) return false;
        return true;
    }

    // ─── Deterministic, audit-type-aware certification recommendation ──────────
    // Never AI-generated. base sentence keyed off the audit type string, suffix
    // keyed off NC severity. A surveillance audit must never read "Recommended
    // for Certification" — only initial/Stage 2 audits grant certification.
    function recommendationText(auditType, counts) {
        const majorNC = (counts && Number(counts.majorNC)) || 0;
        const minorNC = (counts && Number(counts.minorNC)) || 0;
        const t = trim(auditType).toLowerCase();

        let base;
        if (/stage\s*1|stage1/.test(t)) {
            base = 'Progression to Stage 2 is recommended';
        } else if (/stage\s*2|stage2|initial/.test(t)) {
            base = 'Recommended for certification';
        } else if (/surveillance/.test(t)) {
            base = 'Continued certification is recommended';
        } else if (/re-?cert/.test(t)) {
            base = 'Recertification is recommended';
        } else {
            base = 'Certification recommendation';
        }

        // Acceptance is not closure. With only minor nonconformities the
        // certification body reviews and accepts the correction and corrective
        // action plans before its decision, and verifies implementation at the
        // next audit; with a major it verifies correction and corrective action
        // before the decision. "Subject to satisfactory closure of applicable
        // nonconformities" said a minor had to be closed first, contradicting
        // the report's own conclusion (PC Connection technical review,
        // 28 Nov 2026).
        const nc = (n) => (n === 1 ? 'nonconformity' : 'nonconformities');
        let suffix;
        if (majorNC > 0) {
            suffix = " subject to the certification body's verification of the correction and corrective action for the major " + nc(majorNC)
                + (minorNC > 0 ? ', and its review and acceptance of the correction and corrective action plans for the minor ' + nc(minorNC) : '') + '.';
        } else if (minorNC > 0) {
            suffix = " subject to the certification body's review and acceptance of the correction and corrective action plans for the minor " + nc(minorNC) + '.';
        } else {
            suffix = '.';
        }
        return base + suffix;
    }

    // The sentence recommendationText produced before 28 Nov 2026, frozen.
    // An issued report's "modified since issue" fingerprint was computed over
    // it (ai-service.js finalizeAndPublish); fingerprinting the current wording
    // instead would flag every issued report with an open nonconformity as
    // modified, though nothing in it changed. It depends only on the audit
    // type and the major/minor counts, which is what the fingerprint is for.
    function recommendationFingerprint(auditType, counts) {
        const majorNC = (counts && Number(counts.majorNC)) || 0;
        const minorNC = (counts && Number(counts.minorNC)) || 0;
        const base = recommendationText(auditType, { majorNC: 0, minorNC: 0 }).replace(/\.$/, '');
        if (majorNC > 0) return base + ' subject to satisfactory closure of the identified nonconformities, including verification of implemented corrective actions for major nonconformities.';
        if (minorNC > 0) return base + ' subject to satisfactory closure of applicable nonconformities.';
        return base + '.';
    }

    // ─── What a report's recommendation prints as ────────────────────────────
    // `primary` is the auditor's DECISION (the radio: Recommended / Pending /
    // Not Recommended) and drives the badge colour. `wording` is what is
    // printed: a "Recommended" decision is printed in the audit type's own
    // words (recommendationText above — "Continued certification is
    // recommended…" for a surveillance), never as a bare "Recommended", which
    // on a surveillance report reads as a certification grant. `auto` is the
    // derived sentence; `showAutoCaption` flags a decision that departs from it.
    function resolveRecommendation(report, stats) {
        const manual = trim(report && report.recommendation);
        const auto = trim((stats && stats.rs && stats.rs.recommendation) || (stats && stats.recommendation));
        const primary = manual || auto || 'Pending';
        const typed = manual === 'Recommended' && /\brecommended\b/i.test(auto) ? auto : '';
        return {
            primary,
            wording: typed || primary,
            isManual: !!manual,
            auto,
            showAutoCaption: !!manual && !!auto && manual !== auto && !typed
        };
    }

    // ─── Single-source criterion formatter ─────────────────────────────────────
    // Internal tracking references (FOCUS.n / SURV.n / ORG / DOC — Stage 1
    // carryover pseudo-clauses, never real standard clauses) need one shared
    // definition of "what do we show for this finding's criterion" so every
    // consumer (execution-reporting.js's displayCriterion, report-executive.js's
    // narrative generation, CAPA/NCR renders) agrees. Pure, never throws.
    //
    // Contract: formatCriterion(finding, opts) -> {label, isInternal, real, internalRef}
    //   - criterionRef present              -> real clause is the label by
    //                                          default; real = criterionRef.
    //                                          If the finding's `clause` is an
    //                                          internal FOCUS/SURV/ORG/DOC tag
    //                                          that differs from criterionRef
    //                                          (a resolved Stage 1 carryover),
    //                                          internalRef carries that tag.
    //                                          opts.showInternal:true restores
    //                                          the 'real (internalRef)' label
    //                                          for internal/CAPA-style contexts.
    //   - no criterionRef, clause looks     -> unresolved internal reference;
    //     like FOCUS/SURV/ORG/DOC              isInternal = true, real = null,
    //                                          label = 'internal ref FOCUS.x'
    //                                          (opts.showInternal has no effect
    //                                          here — nothing more to restore).
    //   - otherwise                         -> clause is already a real/plain
    //                                          reference; used as-is.
    const FOCUS_REF_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;

    // ─── Criterion classification ────────────────────────────────────────────
    // Three different things can sit in a finding's criterion field, and a client
    // report must never present them as if they were the same:
    //   'standard'   a clause of the management-system standard being audited
    //                (ISO 9001:2015 9.2) — may be printed as an ISO requirement
    //   'programme'  a certification/surveillance programme criterion, e.g. the
    //                ISO 17021-1 surveillance elements cited as "9.6.2(b)".
    //                These are NOT clauses of the audited standard and must be
    //                labelled as a surveillance criterion instead
    //   'internal'   an internal tracking reference (FOCUS/SURV/ORG/DOC)
    //   'unverified' a reference that cannot be confirmed against the audited
    //                standard's clause inventory — never claim it is a clause
    //
    // Surveillance programme elements are cited with a parenthesised sub-letter
    // ("9.6.2(b)"); management-system clauses are not written that way.
    const PROGRAMME_CRITERION_RE = /^\d{1,2}(?:\.\d{1,2}){1,3}\s*\(\s*[a-z]\s*\)$/i;

    /**
     * Classify a finding's criterion. `opts.standardClauses` is the audited
     * standard's clause inventory (e.g. from the Knowledge Base) — when supplied,
     * a reference absent from it is reported 'unverified' rather than being
     * assumed to be a clause of that standard.
     * @returns {{kind:'standard'|'programme'|'internal'|'unverified'|'none', ref:string}}
     */
    function classifyCriterion(finding, opts) {
        const f = finding || {};
        const o = opts || {};
        const clause = trim(f.clause);
        const criterionRef = trim(f.criterionRef);
        const source = trim(f.criterionSource).toLowerCase();
        const ref = criterionRef || clause;
        if (!ref) return { kind: 'none', ref: '' };

        // How the item was authored is authoritative when it was recorded.
        if (/programme|surveillance|17021/.test(source)) return { kind: 'programme', ref };
        if (FOCUS_REF_RE.test(ref)) return { kind: 'internal', ref };
        if (PROGRAMME_CRITERION_RE.test(ref)) return { kind: 'programme', ref };

        const inventory = safeArr(o.standardClauses).map(trim).filter(Boolean);
        if (inventory.length) {
            const known = inventory.some((c) => ref === c || ref.indexOf(c + '.') === 0);
            if (!known) return { kind: 'unverified', ref };
        }
        return { kind: 'standard', ref };
    }

    // ─── Which of the report's standards a finding belongs to ───────────────
    // An integrated report (ISO 20000-1, 27001 and 22301 together) looked every
    // clause up in one standard and printed all three names beside every NC:
    // PC Connection's RTO/RPO finding at 22301 8.2.2 (business impact analysis)
    // printed 27001's "information security risk assessment", and Annex A
    // controls were attributed to 22301 and 20000-1 too (2026-11-19).
    // Resolution, first that applies:
    //   1. a standard tag on the criterion or clause: "8.2.2 (22301)";
    //   2. an Annex A control (A.5.9) belongs to ISO/IEC 27001;
    //   3. the only one of the report's standards whose clause list (Knowledge
    //      Base) has this exact clause;
    //   4. the same clause with the same title in every standard that has it
    //      ("7.5 Documented information") is common to them: basis 'common';
    //   otherwise 'ambiguous' — never guessed.
    // A single-standard report always resolves to that standard.
    function splitStandards(value) {
        return String(value == null ? '' : value).split(/\s*[,;+]\s*|\s+&\s+|\s+and\s+/i).map(trim).filter(Boolean);
    }
    function standardNumber(name) {
        const m = String(name == null ? '' : name).match(/(\d{4,5})(?:-\d+)?/);
        return m ? m[1] : '';
    }
    function clauseNumberOf(ref) {
        const m = trim(ref).replace(/^(clause|section)\s+/i, '').match(/^([A-Za-z]\.)?\d+(?:\.\d+)*/);
        return m ? m[0] : '';
    }
    function normTitle(t) { return trim(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

    // { standardName: { clause: title } } for the report's standards, from the
    // Knowledge Base (window.state.knowledgeBase) unless opts.inventory is given.
    function standardInventory(standards, opts) {
        if (opts && opts.inventory) return opts.inventory;
        const kb = global.state && global.state.knowledgeBase;
        const docs = (kb && Array.isArray(kb.standards)) ? kb.standards.filter((s) => s && s.status === 'ready' && Array.isArray(s.clauses) && s.clauses.length) : [];
        const out = {};
        standards.forEach((name) => {
            const num = standardNumber(name);
            const doc = num && docs.find((s) => standardNumber(s.name) === num);
            if (!doc) return;
            const map = {};
            doc.clauses.forEach((c) => { if (c && c.clause) map[trim(c.clause)] = c.title || ''; });
            out[name] = map;
        });
        return out;
    }

    function resolveFindingStandard(finding, reportStandard, opts) {
        const f = finding || {};
        const standards = splitStandards(reportStandard);
        if (standards.length <= 1) return { standard: standards[0] || '', basis: standards.length ? 'single' : 'none', standards };
        const ref = trim(f.criterionRef) || trim(f.clause);
        if (/\(\s*integrated\s*\)/i.test(trim(f.criterionRef) || trim(f.clause))) return { standard: '', basis: 'common', standards };
        const tagged = (trim(f.criterionRef) + ' ' + trim(f.clause)).match(/\(\s*(?:ISO(?:\/IEC)?\s*)?(\d{4,5})(?:[-:]\d+)?\s*\)/i);
        if (tagged) {
            const s = standards.find((x) => standardNumber(x) === tagged[1]);
            if (s) return { standard: s, basis: 'tag', standards };
        }
        if (/^A\.\d/i.test(ref)) {
            const s = standards.find((x) => standardNumber(x) === '27001');
            if (s) return { standard: s, basis: 'annex-a', standards };
        }
        const num = clauseNumberOf(ref);
        const inv = standardInventory(standards, opts);
        const having = num ? standards.filter((s) => inv[s] && Object.prototype.hasOwnProperty.call(inv[s], num)) : [];
        // Only decide from the clause lists when every standard has one.
        const allKnown = standards.every((s) => inv[s]);
        if (allKnown && having.length === 1) return { standard: having[0], basis: 'inventory', standards };
        if (allKnown && having.length > 1) {
            const titles = having.map((s) => normTitle(inv[s][num]));
            if (titles.every((t) => t && t === titles[0])) return { standard: '', basis: 'common', standards: having };
        }
        return { standard: '', basis: 'ambiguous', standards };
    }

    // ── A finding's clause, cited against its own standard(s) ────────────────
    // Integrated reports printed the auditor's working shorthand: "Clause 9.2
    // (22301)", "Clause 7.5.3 (integrated)", "Clause 10.2 / 10.1"; and the
    // corrective-action table named one standard for a two-standard reference
    // ("ISO 27001:2022 — Clause 10.2 / 10.1", where 10.1 is the ISO 22301 and
    // ISO/IEC 20000-1 clause). PC Connection technical review, 28 Nov 2026.
    // This resolves the citation from the standards registry
    // (window.ChecklistStandards), which keys clauses by concept, so a number
    // that means different things in different standards is never attributed
    // by number alone:
    //   single standard          -> "ISO 9001:2015 clause 8.5.2"
    //   tagged "9.2 (22301)"     -> "ISO 22301:2019 clause 9.2"
    //   "7.5.3 (integrated)"     -> "ISO/IEC 27001:2022, ISO 22301:2019 and ISO/IEC 20000-1:2018 clause 7.5.3"
    //   "10.2 / 10.1" on 3 stds  -> "ISO/IEC 27001:2022 clause 10.2 / ISO 22301:2019 and ISO/IEC 20000-1:2018 clause 10.1"
    // Returns '' when it cannot be resolved unambiguously; callers then keep
    // the reference as recorded. Never changes the finding.
    function citeFinding(finding, reportStandard) {
        const f = finding || {};
        const CS = global.ChecklistStandards;
        const raw = trim(f.criterionRef) || trim(f.clause);
        if (!raw || FOCUS_REF_RE.test(raw)) return '';
        const refs = raw.replace(/\([^)]*\)/g, ' ').split(/\s*[/,;]\s*|\s+and\s+/i).map(clauseNumberOf).filter(Boolean);
        if (!refs.length) return '';
        const names = splitStandards(reportStandard);
        const reg = (name) => {
            if (!CS || typeof CS.resolve !== 'function') return null;
            const hit = CS.resolve(name).standards[0];
            return hit || null;
        };
        const label = (name) => { const r = reg(name); return r ? r.label : name; };
        const join = (list) => list.length <= 1 ? (list[0] || '') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
        // Annex A references are controls, not clauses.
        const clausesWord = (rs) => (rs.every((r) => /^A\./i.test(r)) ? (rs.length === 1 ? 'Annex A control ' : 'Annex A controls ') : (rs.length === 1 ? 'clause ' : 'clauses ')) + join(rs);
        // A tag names the finding's standard outright.
        const tagged = raw.match(/\(\s*(?:ISO(?:\/IEC)?\s*)?(\d{4,5})(?:[-:]\d+)?\s*\)/i);
        let scope = names;
        if (tagged) {
            const s = names.find((x) => standardNumber(x) === tagged[1]);
            if (!s) return '';
            scope = [s];
        }
        if (!scope.length) return '';
        if (scope.length === 1) return label(scope[0]) + ' ' + clausesWord(refs);
        // Several standards: only the registry can say which clause is which.
        if (!CS || typeof CS.lookupRef !== 'function') return '';
        const regs = scope.map((n) => ({ name: n, r: reg(n) }));
        if (regs.some((x) => !x.r)) return '';
        // A sub-clause the registry does not list (7.5.3) takes its parent's
        // meaning (7.5).
        const hitOf = (x, ref, exact) => {
            if (exact) return CS.lookupRef([x.r.id], ref)[0] || null;
            for (let r = ref; r; r = r.includes('.') ? r.slice(0, r.lastIndexOf('.')) : '') {
                if (/^[A-Za-z]$/.test(r)) break;
                const h = CS.lookupRef([x.r.id], r)[0];
                if (h) return h;
            }
            return null;
        };
        const concept = (h) => h ? (h.shared || ('title:' + normTitle(h.title))) : null;
        const integrated = /\(\s*integrated\s*\)/i.test(raw);
        if (refs.length === 1) {
            // The auditor tagged it as common to the integrated system.
            if (integrated && regs.every((x) => hitOf(x, refs[0]))) return join(regs.map((x) => x.r.label)) + ' ' + clausesWord(refs);
            // Exact references only: 8.6.2 is ISO/IEC 20000-1's alone, though
            // ISO 22301 has an 8.6.
            const having = regs.filter((x) => hitOf(x, refs[0], true));
            // Untagged: only a reference that exists in one standard says which
            // it is (A.5.9, 8.6.2). A clause the standards share (7.5, 8.1) is
            // left as recorded: naming all of them would say the finding
            // concerns every system, which the auditor did not record.
            if (having.length !== 1) return '';
            return having[0].r.label + ' ' + clausesWord(refs);
        }
        // "10.2 / 10.1": every standard must have exactly one of the refs for a
        // concept all of them share; the standards are grouped by that ref.
        const conceptsPer = regs.map((x) => refs.map((ref) => ({ ref, c: concept(hitOf(x, ref)) })).filter((e) => e.c));
        const candidates = Array.from(new Set(conceptsPer[0].map((e) => e.c)))
            .filter((c) => conceptsPer.every((list) => list.filter((e) => e.c === c).length === 1));
        let shared = candidates.length === 1 ? candidates[0] : '';
        if (candidates.length > 1) {
            // 27001 10.1/10.2 and 22301 10.2/10.1 pair up both ways (continual
            // improvement, and nonconformity). The finding's own wording decides;
            // when it names neither, the citation is left as recorded.
            const text = normTitle([f.ncrDescription, f.requirement, f.comment, f.title].filter(Boolean).join(' '));
            const score = (c) => {
                const title = (hitOf(regs[0], conceptsPer[0].find((e) => e.c === c).ref) || {}).title || '';
                const words = normTitle(title).split(' ').filter((w) => w.length > 3 && w !== 'general');
                return words.filter((w) => text.includes(w)).length;
            };
            const scored = candidates.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s);
            if (scored[0].s > 0 && scored[0].s > scored[1].s) shared = scored[0].c;
        }
        if (!shared) return '';
        const byRef = [];
        regs.forEach((x, i) => {
            const ref = conceptsPer[i].find((e) => e.c === shared).ref;
            let g = byRef.find((b) => b.ref === ref);
            if (!g) { g = { ref, labels: [] }; byRef.push(g); }
            g.labels.push(x.r.label);
        });
        byRef.sort((a, b) => refs.indexOf(a.ref) - refs.indexOf(b.ref));
        return byRef.map((g) => join(g.labels) + ' clause ' + g.ref).join(' / ');
    }

    function formatCriterion(finding, opts) {
        const f = finding || {};
        const showInternal = !!(opts && opts.showInternal);
        const clause = trim(f.clause);
        const criterionRef = trim(f.criterionRef);
        // `kind` tells a caller whether this may be presented as a clause of the
        // audited standard; existing fields are unchanged for older callers.
        const kind = classifyCriterion(f, opts).kind;
        if (criterionRef) {
            const isCarryover = clause && FOCUS_REF_RE.test(clause) && clause.toLowerCase() !== criterionRef.toLowerCase();
            const internalRef = isCarryover ? clause : null;
            return {
                label: (showInternal && internalRef) ? (criterionRef + ' (' + internalRef + ')') : criterionRef,
                isInternal: false,
                real: criterionRef,
                internalRef,
                kind
            };
        }
        if (clause && FOCUS_REF_RE.test(clause)) {
            return { label: 'internal ref ' + clause, isInternal: true, real: null, internalRef: null, kind };
        }
        // `real` keeps its long-standing meaning (the reference itself) so
        // existing callers are unaffected; `kind` is what tells a caller whether
        // it may be presented as a clause of the audited standard. A programme
        // criterion such as "9.6.2(b)" must be labelled a surveillance criterion,
        // never "ISO 9001:2015 — Clause 9.6.2(b)".
        return {
            label: clause,
            isInternal: false,
            real: clause || null,
            internalRef: null,
            kind
        };
    }

    // ─── Certification-cycle programme — single computation for preview + export ──
    // Anchors the 3-year cycle on the client's certificate (not the current audit
    // date), overlays real historical audits for this client+standard so completed
    // stages show their actual dates/types, and never fabricates Stage 1/2 dates
    // when there is neither a certificate nor history to anchor on.
    function buildProgramme(input) {
        try {
            return buildProgrammeInner(input || {});
        } catch (_e) {
            return { stages: [], anchored: 'audit-date-fallback', issues: ['Unable to compute certification programme.'], nextAudit: null };
        }
    }

    const STAGE_DEFS = [
        { id: 's1', label: 'Stage 1', offset: 0, def: 'Readiness review — documentation, context, scope confirmation', typeTest: /stage\s*1|stage1/i },
        { id: 's2', label: 'Stage 2 (Initial Certification)', offset: 0, def: 'Full system implementation audit', typeTest: /stage\s*2|stage2|initial/i },
        { id: 'sv1', label: 'Surveillance 1', offset: 12, def: 'Key processes, use of marks, changes, previous findings follow-up', typeTest: /surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/i },
        { id: 'sv2', label: 'Surveillance 2', offset: 24, def: 'Key processes, use of marks, changes, previous findings follow-up', typeTest: /surveillance\s*2|sv2|2nd\s*surveillance|second\s*surveillance/i },
        { id: 'recert', label: 'Recertification', offset: 36, def: 'Full system re-assessment over the certification cycle', typeTest: /re-?cert/i }
    ];

    function classifyAuditType(t) {
        const s = trim(t).toLowerCase();
        if (/stage\s*1|stage1/.test(s)) return 's1';
        if (/stage\s*2|stage2|initial/.test(s)) return 's2';
        if (/surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/.test(s)) return 'sv1';
        if (/surveillance\s*2|sv2|2nd\s*surveillance|second\s*surveillance/.test(s)) return 'sv2';
        if (/re-?cert/.test(s)) return 'recert';
        if (/surveillance/.test(s)) return 'sv1'; // generic "Surveillance" defaults to SV1
        return 's2'; // default to Stage 2 / Initial
    }

    function parseDateSafe(v) {
        if (!v) return null;
        const dt = new Date(v);
        return isNaN(dt.getTime()) ? null : dt;
    }

    function addMonths(date, months) {
        const dt = new Date(date.getTime());
        dt.setMonth(dt.getMonth() + months);
        return dt;
    }

    // Where the CURRENT three-year cycle began.
    //
    // Initial Date is the first certification and never moves. Current Issue
    // and Expiry are the certificate ON FILE — re-issued on their own schedule,
    // often annually — so neither marks a cycle boundary. Certification simply
    // runs in three-year cycles from first certification: recertify at the end
    // of one and the next begins. The current cycle is therefore the three-year
    // period that contains today.
    //
    // Deriving it from Current Issue instead put Lithocraft (first certified
    // March 2024, certificate re-issued to April 2027) in a 2027–2030 cycle
    // asking for a surveillance in 2028; anchoring on Initial Date forever gave
    // RYMA a four-year cycle and demanded a recertification it had just had.
    const CYCLE_MONTHS = 36;
    const REISSUE_SNAP_DAYS = 90;
    function cycleStartFrom(firstCertified, today, currentIssue) {
        if (!firstCertified) return null;
        const now = today || new Date();
        let start = new Date(firstCertified.getTime());
        for (let cycles = 0; cycles < 40; cycles++) {
            const next = addMonths(start, CYCLE_MONTHS);
            if (next > now) break;
            start = next;
        }
        // A cycle that began with a recertification has a real certificate
        // behind it, and that certificate's issue date is the day the cycle
        // actually started — the anniversary of first certification is only an
        // estimate of it. Where the two are close, prefer the real date, so the
        // surveillance dates the app derives match the certificate in hand.
        // A re-issue far from the boundary is an ANNUAL one, mid-cycle, and
        // must not move the anchor.
        if (currentIssue) {
            const drift = Math.abs(currentIssue.getTime() - start.getTime());
            if (drift > 0 && drift <= REISSUE_SNAP_DAYS * 24 * 60 * 60 * 1000 && currentIssue <= now) return new Date(currentIssue.getTime());
        }
        return start;
    }

    // The one cycle-end rule, shared by buildProgramme (report) and cycleState
    // (dashboard widget). A certification cycle is three years from its start —
    // the certificate ON FILE expires on its own schedule (often annually, and
    // occasionally carrying a date years out) and never defines the cycle. Its
    // expiry is reported separately, as a certificate that has lapsed or is
    // valid, which is a different fact from where the cycle ends.
    function cycleEndFrom(anchor, expiry) {
        const nominal = addMonths(anchor, CYCLE_MONTHS);
        // A certificate issued for the full cycle expires the day before the
        // anniversary, and that recorded date is the precise end of validity —
        // worth keeping over a date computed to the day. Only a date sitting
        // right on the nominal end can be that; an annual re-issue (years
        // early) or a certificate carrying a date beyond the cycle (years late)
        // is not describing the cycle at all.
        if (expiry) {
            const drift = Math.abs(expiry.getTime() - nominal.getTime());
            if (drift <= 60 * 24 * 60 * 60 * 1000) return expiry;
        }
        return nominal;
    }

    function buildProgrammeInner(input) {
        const client = input.client || {};
        const auditPlan = input.auditPlan || {};
        const report = input.report || {};
        const allReports = safeArr(input.allReports);

        const standard = report.standard || auditPlan.standard || '';
        const currentTypeStr = auditPlan.auditType || auditPlan.type || report.auditType || 'Initial';
        let currentStageId = classifyAuditType(currentTypeStr);

        const issues = [];

        // Anchor: prefer the matching client certificate; else fall back to the
        // current audit's own date (only used for the audit-date-fallback path).
        const certs = safeArr(client.certificates);
        const cert = certs.find((c) => trim(c.standard).toLowerCase() === trim(standard).toLowerCase()) || certs[0] || null;
        const certStart = cert ? (parseDateSafe(cert.initialDate) || parseDateSafe(cert.issueDate) || parseDateSafe(cert.currentIssue)) : null;
        const certExpiry = cert ? parseDateSafe(cert.expiryDate) : null;

        // History: real audits for this client+standard, finalized/approved/published,
        // mirroring the filter used by planning-module.js:2744-2780 (clientId+standard+status)
        // without importing that module.
        // The client by id when both sides carry one, else by name: reports in
        // the field often have no clientId, which left PC Connection's
        // finalized February 2026 surveillance out of its recertification
        // programme (Surveillance 2 printed the calendar's "Dec 2025"). The
        // standards are compared as a set: the two reports list the same three
        // standards in a different order.
        const owner = {
            id: report.clientId != null ? report.clientId : (client.id != null ? client.id : null),
            name: report.client || report.clientName || client.name || ''
        };
        const wanted = standardSet({ standard });
        const history = allReports.filter((r) => {
            if (!r || String(r.id) === String(report.id)) return false;
            if (!recordBelongsTo(r, owner)) return false;
            if (wanted.size) {
                const theirs = standardSet(r);
                if (theirs.size && !Array.from(theirs).some((s) => wanted.has(s))) return false;
            }
            const status = trim(r.reportStatus || r.status).toLowerCase();
            return status === 'final' || status === 'finalized' || status === 'approved' || status === 'published';
        }).sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));

        const auditDateStr = report.date || auditPlan.startDate || auditPlan.date || null;
        const auditDate = parseDateSafe(auditDateStr) || new Date();

        let anchored;
        let baseDate;
        if (certStart) {
            anchored = 'certificate';
            baseDate = certStart;
        } else if (history.length > 0) {
            anchored = 'history';
            baseDate = parseDateSafe(history[0].date || history[0].createdAt) || auditDate;
        } else {
            anchored = 'audit-date-fallback';
            baseDate = auditDate;
        }

        // The programme describes the CURRENT three-year cycle: the one that
        // contains this audit, counted from first certification (the same rule
        // as cycleState). Counting every stage from Initial Date put PC
        // Connection's February 2026 surveillance (first certified Dec 2020,
        // recertified Dec 2023) after a recertification "by Dec 2023" and
        // blocked the report. A recertification held shortly after the
        // anniversary still closes the cycle it belongs to.
        let cycleStart = baseDate;
        if (certStart) {
            // A certificate that lapsed before the audit evidences no later
            // cycle: the audit is placed in the cycle the certificate covered,
            // so an overdue recertification is still flagged, not skipped.
            const cycleRef = certExpiry && certExpiry < auditDate ? certExpiry : auditDate;
            cycleStart = cycleStartFrom(certStart, cycleRef, cert ? parseDateSafe(cert.currentIssue) : null);
            const LATE_RECERT_DAYS = 180;
            if (currentStageId === 'recert' && cycleStart > certStart
                && auditDate.getTime() - cycleStart.getTime() < LATE_RECERT_DAYS * 24 * 60 * 60 * 1000) {
                cycleStart = addMonths(cycleStart, -CYCLE_MONTHS);
                if (cycleStart < certStart) cycleStart = certStart;
            }
        }
        // A later cycle began with a recertification, not with Stage 1/2.
        const laterCycle = !!certStart && cycleStart.getTime() - certStart.getTime() > 180 * 24 * 60 * 60 * 1000;
        if (laterCycle) {
            // Audits from earlier cycles are not this cycle's stages. The
            // recertification that opened this cycle fills its opening row.
            const from = cycleStart.getTime() - 90 * 24 * 60 * 60 * 1000;
            for (let i = history.length - 1; i >= 0; i--) {
                const d = parseDateSafe(history[i].date || history[i].createdAt);
                if (!d || d.getTime() < from) history.splice(i, 1);
            }
        }

        // A generic "Surveillance" audit type carries no cycle-year. When a real
        // anchor exists, slot the current audit into the surveillance visit nearest
        // its own date (two years after initial certification = Surveillance 2) —
        // UNLESS real audit history already contains a prior Surveillance for this
        // client+standard, in which case the current generic-Surveillance audit
        // must slot AFTER it (Surveillance 2) regardless of date proximity. A
        // second surveillance visit can land close to its own 12-month-post-SV1
        // due date too, and naive date-proximity alone would misclassify it back
        // as Surveillance 1.
        const hasPriorSv1History = history.some((r) => r && classifyAuditType(r.auditType || (r.auditPlan && r.auditPlan.type)) === 'sv1');
        if (currentStageId === 'sv1' && anchored !== 'audit-date-fallback'
            && !/surveillance\s*1|sv1|1st\s*surveillance|first\s*surveillance/i.test(currentTypeStr)) {
            if (hasPriorSv1History) {
                currentStageId = 'sv2';
            } else {
                const sv1Due = new Date(cycleStart.getTime()); sv1Due.setMonth(sv1Due.getMonth() + 12);
                const sv2Due = new Date(cycleStart.getTime()); sv2Due.setMonth(sv2Due.getMonth() + 24);
                if (Math.abs(auditDate - sv2Due) < Math.abs(auditDate - sv1Due)) currentStageId = 'sv2';
            }
        }
        const currentStageIdx = STAGE_DEFS.findIndex((s) => s.id === currentStageId);

        const fmt = (dt) => dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        const offsetDate = (offset) => { const dt = new Date(cycleStart.getTime()); dt.setMonth(dt.getMonth() + offset); return dt; };
        const monthYear = (offset) => fmt(offsetDate(offset));
        // recertDate is the precise anchor used for chronology comparisons;
        // recertTiming is its display string. Kept separate so month/year
        // formatting never masks a same-month chronology conflict.
        //
        // cycleEnd rule: many certificates on file are ANNUAL re-issues within a
        // 3-year cycle (expiry = currentIssue + ~364 days, an app convention) —
        // not a genuine 3-year expiry. Treat the recorded expiryDate as the true
        // cycle end only when it is at least 30 months after the cycle anchor
        // (initialDate/issueDate); otherwise the cert is annual-issue and the
        // real cycle end is anchor + 36 months.
        // Same cycle arithmetic as the widget: the three-year period containing
        // the audit, counted from first certification — not from the date the
        // certificate on file happens to carry.
        const recertDate = certStart
            ? cycleEndFrom(cycleStart, certExpiry)
            : (certExpiry ? cycleEndFrom(baseDate, certExpiry) : offsetDate(36));
        const recertTiming = certExpiry ? ('by ' + fmt(recertDate)) : monthYear(36);

        // Match history records to stage slots by their own audit type. In a
        // later cycle the recertification that opened it sits in the opening
        // row (s2), and only one dated well into the cycle is its closing one.
        const historyByStage = {};
        const svDue = (n) => addMonths(cycleStart, 12 * n);
        history.forEach((r) => {
            const typeStr = trim(r.auditType || (r.auditPlan && r.auditPlan.type));
            let sid = classifyAuditType(typeStr);
            // A bare "Surveillance" record carries no visit number:
            // classifyAuditType calls it Surveillance 1. Slot it by its date
            // against this cycle's two due dates instead, so PC Connection's
            // February 2026 audit (the cycle's second) lands in Surveillance 2.
            if (sid === 'sv1' && certStart && !/surveillance\s*1|sv1|1st|first/i.test(typeStr)) {
                const d = parseDateSafe(r.date || r.createdAt);
                if (d && Math.abs(d - svDue(2)) < Math.abs(d - svDue(1))) sid = 'sv2';
                if (historyByStage[sid]) sid = sid === 'sv1' ? 'sv2' : 'sv1';
            }
            if (laterCycle && (sid === 's1' || sid === 's2')) return;
            if (laterCycle && sid === 'recert') {
                const d = parseDateSafe(r.date || r.createdAt);
                if (d && d.getTime() < cycleStart.getTime() + 180 * 24 * 60 * 60 * 1000) sid = 's2';
            }
            if (!historyByStage[sid]) historyByStage[sid] = r;
        });

        // Only flag missing anchor data from Surveillance onward (idx >= 2): a
        // Stage 1 or Stage 2/Initial audit legitimately has no certificate or
        // prior history yet — that's the normal case for a brand-new client, not
        // a data-integrity problem. Surveillance/recertification audits, by
        // contrast, are only ever scheduled against an existing certificate, so
        // having neither one on file there is a genuine gap worth flagging.
        const noAnchor = anchored === 'audit-date-fallback' && currentStageIdx > 1;
        if (noAnchor) {
            issues.push('No certificate or audit history on file; prior stage dates unavailable.');
        }

        // rawDates[stageId] holds the precise Date behind each stage's display
        // `timing` string (or null when genuinely unknown) — used below for
        // chronology comparisons that must not be fooled by month/year rounding.
        const rawDates = {};
        const stages = STAGE_DEFS.map((s, i) => {
            const isCurrent = s.id === currentStageId;
            const histRec = historyByStage[s.id];
            let timing, status, source, rawDate;

            if (isCurrent) {
                timing = fmt(auditDate);
                status = 'This audit';
                source = 'current';
                rawDate = auditDate;
            } else if (histRec) {
                rawDate = parseDateSafe(histRec.date || histRec.createdAt) || auditDate;
                timing = fmt(rawDate);
                status = 'Completed';
                source = 'history';
            } else if (i < currentStageIdx) {
                // A stage prior to the current one with no matching history record.
                if (noAnchor || (anchored === 'audit-date-fallback' && !certStart && history.length === 0)) {
                    timing = '—';
                    status = 'Unknown';
                    source = 'unknown';
                    rawDate = null;
                } else {
                    rawDate = s.id === 'recert' ? recertDate : offsetDate(s.offset);
                    timing = s.id === 'recert' ? recertTiming : monthYear(s.offset);
                    status = 'Completed';
                    source = anchored;
                }
            } else {
                rawDate = s.id === 'recert' ? recertDate : offsetDate(s.offset);
                timing = s.id === 'recert' ? recertTiming : monthYear(s.offset);
                status = 'Planned';
                source = anchored;
            }

            // A later cycle has no Stage 1/2 of its own: its opening rows are the
            // original certification and the recertification that began it.
            let label = s.label;
            let def = s.def;
            if (laterCycle && !isCurrent && (s.id === 's1' || s.id === 's2')) {
                if (s.id === 's1') {
                    label = 'Initial certification';
                    def = 'First certification of the management system (previous cycle)';
                    rawDate = certStart;
                    timing = fmt(certStart);
                    status = 'Completed';
                    source = 'certificate';
                } else {
                    label = 'Recertification (start of this cycle)';
                    def = 'Recertification audit that began the current three-year cycle';
                    if (!histRec) {
                        rawDate = cycleStart;
                        timing = fmt(cycleStart);
                        status = 'Completed';
                        source = 'certificate';
                    }
                }
            }

            rawDates[s.id] = rawDate;
            return { id: s.id, label, timing, status, source, def };
        });

        // Chronology rule: a stage still awaiting its visit ('Planned') whose
        // computed date lands on or before the current audit date is an
        // impossible/unreliable programme (e.g. a certificate expiry that falls
        // before or during the audit that is meant to keep it alive). Flag it and
        // relabel the stage rather than silently inventing a different date.
        stages.forEach((s) => {
            if (s.status !== 'Planned') return;
            const dt = rawDates[s.id];
            if (dt && !isNaN(dt.getTime()) && dt.getTime() <= auditDate.getTime()) {
                issues.push('Next required audit/recertification (' + s.label + ' — ' + s.timing + ') is not after the current audit date — the certification programme or certificate expiry needs correction.');
                s.status = 'Requires scheduling';
            }
        });

        // nextAudit: the first stage strictly after the current one with a valid,
        // future-dated timing. null (with the issue above present) when the
        // programme cannot substantiate a next audit date. Carries a machine-
        // readable `date` (ISO string) alongside label/timing so consumers never
        // need to re-parse the display `timing` string themselves.
        let nextAudit = null;
        for (let i = currentStageIdx + 1; i < stages.length; i++) {
            const dt = rawDates[stages[i].id];
            if (dt && !isNaN(dt.getTime()) && dt.getTime() > auditDate.getTime()) {
                nextAudit = Object.assign({}, stages[i], { date: dt.toISOString() });
                break;
            }
        }

        // Chronology sanity checks.
        const withDates = stages
            .map((s, i) => ({ i, s, dt: parseDateSafe(s.timing !== '—' ? s.timing : null) }))
            .filter((x) => x.dt);
        for (let i = 1; i < withDates.length; i++) {
            if (withDates[i].dt < withDates[i - 1].dt) {
                issues.push('Stage dates are out of chronological order (' + withDates[i - 1].s.label + ' after ' + withDates[i].s.label + ').');
            }
        }
        if (currentStageIdx >= 2 && certStart && auditDate < certStart) {
            issues.push('Surveillance/recertification audit is dated before the certification start date.');
        }
        const currentCount = stages.filter((s) => s.status === 'This audit').length;
        if (currentCount !== 1) {
            issues.push('Current audit does not match exactly one programme stage — check the audit type against the certification cycle.');
        }

        return { stages, anchored, issues, anchorDate: baseDate ? baseDate.toISOString() : null,
            cycleStart: cycleStart ? cycleStart.toISOString() : null, laterCycle, nextAudit };
    }

    // ─── Certification-cycle state for dashboards ───────────────────────────
    // Answers "where is this client in their 3-year cycle right now" from the
    // SAME facts the report programme uses: the certificate anchor plus the
    // client's finalized audit history. A stage is complete because an audit
    // for it was finalized — not because the calendar passed its due date — so
    // publishing a surveillance report advances the widget immediately, and a
    // visit that never happened never silently counts as done. Falls back to a
    // pure calendar projection only when there is no finalized history at all.
    //
    // Returns null when there is no usable certificate (caller keeps its own
    // "no cycle started" empty state).
    // Records name their client by id, or only by name, and the name on an
    // audit record is not always written the way the client record has it
    // ("PC CONNECTION" against "PC CONNECTION, INC."). Case, punctuation and a
    // trailing legal form are not part of who the client is.
    const LEGAL_FORM = /\s(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|plc|pvt|private|gmbh|pty|sa|srl|bv)$/;
    function organisationKey(name) {
        let key = trim(name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
        for (let i = 0; i < 3; i++) {
            const next = key.replace(LEGAL_FORM, '').trim();
            if (next === key || !next) break;
            key = next;
        }
        return key;
    }

    // Does this report or plan belong to the client? The id decides when both
    // carry one. Reports in the field carry no clientId at all, and an id check
    // skipped whenever either side lacked one made every finalized audit count
    // as every client's history, so a record naming neither the id nor the
    // client is attributed to nobody rather than to all.
    function recordBelongsTo(record, client) {
        if (!record || !client) return false;
        if (record.clientId != null && client.id != null) return String(record.clientId) === String(client.id);
        const named = organisationKey(record.client || record.clientName);
        const ours = organisationKey(client.name);
        return !!named && !!ours && named === ours;
    }

    const FINAL_STATUS_RE = /^(final|finalized|approved|published)$/i;

    // The client's previous audit report: finalized, dated before this one,
    // newest first. The ONE lookup behind the Previous Findings table (preview
    // and PDF), its derived status sentence and Report Integrity.
    //
    // The tables used to match on `r.clientId === report.clientId` alone.
    // Reports in the field often carry no clientId, and undefined === undefined,
    // so PC Connection's 2026 recertification report took KTD Select's August
    // audit as its "previous report" and printed KTD Select's four NCs as its
    // own. recordBelongsTo decides by id when both sides carry one, else by
    // the client's name, and attributes a record naming neither to nobody.
    //
    // @param {{report:object, client?:object, allReports?:Array}} input
    // @returns {object|null}
    function previousReport(input) {
        const o = input || {};
        const report = o.report || {};
        const client = o.client || {};
        const owner = {
            id: report.clientId != null ? report.clientId : (client.id != null ? client.id : null),
            name: report.client || report.clientName || client.name || ''
        };
        if (owner.id == null && !trim(owner.name)) return null;
        const before = parseDateSafe(report.date || report.createdAt);
        return safeArr(o.allReports)
            .filter((r) => {
                if (!r || String(r.id) === String(report.id)) return false;
                if (report.planId != null && r.planId != null && String(r.planId) === String(report.planId)) return false;
                if (!recordBelongsTo(r, owner)) return false;
                if (!FINAL_STATUS_RE.test(trim(r.reportStatus)) && !FINAL_STATUS_RE.test(trim(r.status))) return false;
                const d = parseDateSafe(r.date || r.createdAt);
                return !before || !d || d < before;
            })
            .sort((a, b) => (parseDateSafe(b.date || b.createdAt) || 0) - (parseDateSafe(a.date || a.createdAt) || 0))[0] || null;
    }

    // The certified standards a record lists, normalized, whatever their order
    // ("ISO 27001:2022, ISO 22301:2019" and "ISO 22301:2019, ISO 27001:2022").
    function standardSet(record) {
        return new Set([].concat(safeArr(record && record.standards), String((record && record.standard) || '').split(/\s*[,;+]\s*/))
            .map((x) => trim(x).toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
    }

    // An integrated audit's record lists several standards.
    function coversStandard(record, want) {
        const wanted = trim(want).toLowerCase();
        if (!wanted) return true;
        const listed = [].concat(safeArr(record.standards), String(record.standard || '').split(/\s*[,;+]\s*/))
            .map((x) => trim(x).toLowerCase()).filter(Boolean);
        return !listed.length || listed.includes(wanted);
    }

    // Every completed audit on record for a client and standard, oldest first:
    // finalized reports, and audit plans marked Completed or Closed — an audit
    // the CB ran and closed out is on record even where no report was
    // finalized in the app.
    const FINAL_REPORT_STATUSES = new Set(['final', 'finalized', 'approved', 'published', 'completed']);
    const COMPLETED_PLAN_STATUSES = new Set(['completed', 'closed']);
    function completedAuditRecords(client, standard, allReports, allPlans, today) {
        const out = [];
        safeArr(allReports).forEach((r) => {
            if (!r || !recordBelongsTo(r, client) || !coversStandard(r, standard)) return;
            if (!FINAL_REPORT_STATUSES.has(trim(r.reportStatus || r.status).toLowerCase())) return;
            const d = parseDateSafe(r.date || r.createdAt);
            if (d && d <= today) out.push({ origin: 'report', id: r.id || null, auditType: trim(r.auditType || r.type), date: d });
        });
        safeArr(allPlans).forEach((plan) => {
            if (!plan || !recordBelongsTo(plan, client) || !coversStandard(plan, standard)) return;
            if (!COMPLETED_PLAN_STATUSES.has(trim(plan.status).toLowerCase())) return;
            const d = parseDateSafe(plan.endDate || plan.date || plan.startDate);
            if (d && d <= today) out.push({ origin: 'plan', id: plan.id || null, auditType: trim(plan.auditType || plan.type), date: d });
        });
        return out.sort((a, b) => a.date - b.date);
    }

    function cycleState(input) {
        try {
            return cycleStateInner(input || {});
        } catch (_e) {
            return null;
        }
    }

    function cycleStateInner(input) {
        const client = input.client || {};
        const standard = trim(input.standard);
        const allReports = safeArr(input.allReports);
        const allPlans = safeArr(input.allPlans);
        const today = parseDateSafe(input.today) || new Date();

        const certs = safeArr(client.certificates);
        const cert = input.certificate
            || (standard ? certs.find((c) => trim(c.standard).toLowerCase() === standard.toLowerCase()) : null)
            || certs[0] || null;
        if (!cert) return null;

        const firstCertified = parseDateSafe(cert.initialDate) || parseDateSafe(cert.issueDate) || parseDateSafe(cert.currentIssue);
        if (!firstCertified) return null;
        const anchor = cycleStartFrom(firstCertified, today, parseDateSafe(cert.currentIssue));

        const rawExpiry = parseDateSafe(cert.expiryDate);
        const cycleEnd = cycleEndFrom(anchor, rawExpiry);
        const surv1Due = addMonths(anchor, 12);
        const surv2Due = addMonths(anchor, 24);
        const recertDue = new Date(cycleEnd.getTime());
        recertDue.setDate(recertDue.getDate() - 60); // recert visit precedes cycle end

        // Finalized audits belonging to THIS cycle, oldest first. The window
        // opens 60 days before the anchor so the initial-certification audit
        // that produced the certificate still counts as in-cycle.
        const windowStart = new Date(anchor.getTime());
        windowStart.setDate(windowStart.getDate() - 60);

        const belongsToThisClient = (record) => recordBelongsTo(record, client);
        const reportsInCycle = (forStandard) => completedAuditRecords(client, forStandard, allReports, allPlans, today)
            .filter((r) => r.date >= windowStart);

        // Slot each completed audit against the milestone it evidences. An
        // explicitly numbered type wins; a generic "Surveillance" goes to the
        // due date it sits closest to, and a second generic visit long after
        // the first Surveillance 1 is the Surveillance 2. Each milestone ticks
        // from ITS OWN record only: a Surveillance 2 on file says nothing about
        // whether Surveillance 1 took place, so it never ticks S1 as well.
        const tallyVisits = (list) => {
            const slot = { s1: null, s2: null, recert: null };
            list.forEach((r) => {
                const sid = classifyAuditType(r.auditType);
                if (sid === 'recert') { if (!slot.recert) slot.recert = r; return; }
                if (sid === 's1' || sid === 's2') return; // stage 1 / initial certification audit
                let key;
                if (sid === 'sv2') key = 's2';
                else if (/surveillance\s*1|sv1|1st|first/i.test(r.auditType)) key = 's1';
                else {
                    key = Math.abs(r.date - surv2Due) < Math.abs(r.date - surv1Due) ? 's2' : 's1';
                    if (key === 's1' && slot.s1 && r.date - slot.s1.date > 120 * 24 * 60 * 60 * 1000) key = 's2';
                }
                if (!slot[key]) slot[key] = r;
            });
            return { s1: slot.s1, s2: slot.s2, recert: slot.recert, recertDone: !!slot.recert };
        };

        const history = reportsInCycle(standard);
        const ownVisits = tallyVisits(history);

        // Append-only certification lifecycle events supplement finalized report
        // history. They never overwrite certificate fields, and authorized stage
        // overrides are interpreted by the planning domain rather than here.
        const certIdOf = (c) => String((c && (c.id || c.certificateId || c.certificateNo)) || '');
        const certificateId = certIdOf(cert);
        const allEvents = safeArr(client.certificationLifecycleEvents).filter(Boolean);
        const lifecycleEvents = allEvents.filter((event) => !certificateId || String(event.certificateId || '') === certificateId);

        // Certificates issued on the same dates are maintained by ONE audit
        // programme: an integrated visit surveils every management system in
        // that cycle, but the completion is recorded against a single
        // certificate. Reading only that certificate's own events left the
        // other standard's card claiming the surveillance never happened, with
        // amber nodes and a projected stage beside an identical certificate
        // showing green. Siblings sharing this cycle's anchor AND expiry lend
        // completion evidence — and only that: an authorized stage override is
        // specific to the certificate it names and is never shared.
        const siblings = new Map();
        certs.forEach((c) => {
            if (!c || c === cert || certIdOf(c) === certificateId) return;
            const cAnchor = cycleStartFrom(
                parseDateSafe(c.initialDate) || parseDateSafe(c.issueDate) || parseDateSafe(c.currentIssue),
                today, parseDateSafe(c.currentIssue));
            const cExpiry = parseDateSafe(c.expiryDate);
            const sameAnchor = !!cAnchor && cAnchor.getTime() === anchor.getTime();
            const sameExpiry = (!cExpiry && !rawExpiry) || (!!cExpiry && !!rawExpiry && cExpiry.getTime() === rawExpiry.getTime());
            if (sameAnchor && sameExpiry) siblings.set(certIdOf(c), c);
        });
        const COMPLETION_TYPES = new Set(['surveillance-1-completed', 'surveillance-2-completed', 'recertification-completed', 'certification-renewal']);
        // Milestones belong to the cycle they happened in. A surveillance
        // completed under the previous certificate cannot satisfy this cycle's
        // first surveillance, so completion events are held to the same window
        // as finalized reports.
        const inThisCycle = (event) => {
            const when = parseDateSafe(event.occurredAt || event.createdAt);
            return !!when && when >= windowStart && when <= today;
        };
        const lifecycleTypes = new Set(lifecycleEvents.filter(inThisCycle).map((event) => trim(event.type).toLowerCase()));
        // What was recorded against each milestone of this cycle — when it was
        // performed, by whom (CCI or a named third party) and the evidence
        // filed with it — so a tick carries its record, not just a colour.
        const COMPLETION_KEY = { 'surveillance-1-completed': 's1', 'surveillance-2-completed': 's2', 'recertification-completed': 'recert', 'certification-renewal': 'recert' };
        const completionRecords = { s1: null, s2: null, recert: null };
        lifecycleEvents.filter(inThisCycle).forEach((event) => {
            const key = COMPLETION_KEY[trim(event.type).toLowerCase()];
            if (!key) return;
            const meta = event.metadata || {};
            const record = {
                eventId: event.id || null,
                performedAt: parseDateSafe(event.occurredAt || event.createdAt),
                source: meta.source === 'third-party' ? 'third-party' : (meta.source === 'cci' ? 'cci' : null),
                auditor: trim(meta.auditor) || null,
                evidence: safeArr(meta.evidence),
                note: trim(event.reason) || null,
                recordedBy: event.user || null
            };
            const prior = completionRecords[key];
            if (!prior || (record.performedAt && prior.performedAt && record.performedAt > prior.performedAt)) completionRecords[key] = record;
        });

        // Sharing fills a SILENT record, it never edits one that is being kept.
        // A certificate with a milestone of its own is tracked individually, and
        // may legitimately sit at a different stage than the others in its cycle
        // — an integrated client whose standards genuinely diverge must still be
        // caught by the planner and split into separate plans.
        const tracksOwnEvidence = history.length > 0
            || [...lifecycleTypes].some((type) => COMPLETION_TYPES.has(type));
        // A sibling's milestones come from EITHER of the two evidence stores:
        // its finalized audit reports (which carry a standard, not a
        // certificate) or completion events recorded against it.
        const siblingProgress = tracksOwnEvidence ? [] : [...siblings.values()].map((sib) => {
            const visits = tallyVisits(reportsInCycle(sib.standard));
            const types = new Set(allEvents
                .filter((event) => String(event.certificateId || '') === certIdOf(sib) && inThisCycle(event))
                .map((event) => trim(event.type).toLowerCase()));
            return {
                name: sib.certificateNo || sib.standard || certIdOf(sib),
                s1: !!visits.s1 || types.has('surveillance-1-completed'),
                s2: !!visits.s2 || types.has('surveillance-2-completed'),
                recert: visits.recertDone || types.has('recertification-completed') || types.has('certification-renewal')
            };
        });
        // Which certificate evidenced each milestone, when it was not this one —
        // the widget names it, so a tick is always traceable to its record.
        const sharedEvidence = { s1: null, s2: null, recert: null };
        const sharedFrom = (milestone) => (siblingProgress.find((sib) => sib[milestone]) || {}).name || null;
        let s1Done = !!ownVisits.s1 || lifecycleTypes.has('surveillance-1-completed');
        if (!s1Done && (sharedEvidence.s1 = sharedFrom('s1'))) s1Done = true;
        let s2Done = !!ownVisits.s2 || lifecycleTypes.has('surveillance-2-completed');
        if (!s2Done && (sharedEvidence.s2 = sharedFrom('s2'))) s2Done = true;
        let recertDone = ownVisits.recertDone || lifecycleTypes.has('recertification-completed') || lifecycleTypes.has('certification-renewal');
        if (!recertDone && (sharedEvidence.recert = sharedFrom('recert'))) recertDone = true;
        const surveillancesDone = (s1Done ? 1 : 0) + (s2Done ? 1 : 0);
        // The report or plan that evidenced each milestone, so a tick names it.
        const recordedAudits = { s1: ownVisits.s1, s2: ownVisits.s2, recert: ownVisits.recert };
        const completed = {
            certification: true,
            s1: s1Done,
            s2: s2Done,
            recert: recertDone,
            technicalReview: lifecycleTypes.has('technical-review'),
            certificationDecision: lifecycleTypes.has('certification-decision'),
            certificateIssued: lifecycleTypes.has('certificate-issue') || lifecycleTypes.has('certification-renewal')
        };
        const hasHistory = history.length > 0;

        // USER RULE (2026-10-15): the lifecycle follows the Initial Date
        // alone. The cycle, its year, the stage, the next audit and every
        // milestone's status come from the calendar; whether an audit was
        // recorded, finalized or its plan closed does not move any of them.
        // Audit records are kept beside the lifecycle (completed,
        // recordedAudits, completionRecords) so a milestone can say what is on
        // file, but a missing record is never read as a missed audit and a
        // recorded one never advances the stage.
        const stageSource = 'calendar';
        const cycleYear = today < surv1Due ? 1 : (today < surv2Due ? 2 : 3);
        const monthsFromFirst = (anchor.getFullYear() - firstCertified.getFullYear()) * 12 + (anchor.getMonth() - firstCertified.getMonth());
        const cycleNumber = Math.max(1, Math.round(monthsFromFirst / CYCLE_MONTHS) + 1);
        const dayBefore = (d) => { const x = new Date(d.getTime()); x.setDate(x.getDate() - 1); return x; };
        // Validity runs to the day BEFORE an anniversary. A cycle end taken from
        // a full-cycle certificate's recorded expiry already is that day.
        const cycleLastDay = cycleEnd.getTime() === addMonths(anchor, CYCLE_MONTHS).getTime() ? dayBefore(cycleEnd) : new Date(cycleEnd.getTime());
        // The current annual period: the Current Issue and Expiry the cycle
        // implies today, whatever certificate happens to be on file.
        const periodStart = addMonths(anchor, (cycleYear - 1) * 12);
        const periodEnd = cycleYear === 3 ? cycleLastDay : dayBefore(addMonths(anchor, cycleYear * 12));
        const cycleLabel = 'Cycle ' + cycleNumber + ' · Year ' + cycleYear;
        let progress = Math.max(0, Math.min(100, Math.round((today - anchor) / (cycleEnd - anchor) * 100)));

        // The stage is the first milestone whose window — its due date from
        // the Initial Date plus the grace the CB allows after it — has not
        // closed: Surveillance 1, then Surveillance 2, then Recertification.
        // Dates alone decide it, so the stage and the planner's recommended
        // window always name the same audit (graceDays mirrors the planning
        // policy's surveillanceWindowAfterDays). The Next Audit Stage is the
        // next audit this certificate actually requires within the cycle: it
        // stops at Recertification and never names the next cycle's
        // Surveillance 1, which is projected separately (nextCycle).
        const graceDays = Number.isFinite(Number(input.graceDays)) ? Number(input.graceDays) : 30;
        const stillOpen = (due) => { const end = new Date(due.getTime()); end.setDate(end.getDate() + graceDays); return end >= today; };
        const MILESTONES = ['Surveillance 1', 'Surveillance 2', 'Recertification'];
        const DUES = [surv1Due, surv2Due, recertDue];
        const stageIndex = stillOpen(surv1Due) ? 0 : stillOpen(surv2Due) ? 1 : 2;
        let stage = MILESTONES[stageIndex];
        let nextStage = MILESTONES[Math.min(stageIndex + 1, 2)];
        let dueDate = DUES[stageIndex];
        const nextDue = DUES[Math.min(stageIndex + 1, 2)];
        if (today > cycleEnd) { stage = 'Certificate expired'; nextStage = 'Recertification'; dueDate = null; progress = 100; }
        // Milestones the calendar has moved past. This, not a record, is what
        // turns a node green; a milestone with no record is never "missed".
        const periodComplete = { s1: stageIndex >= 1, s2: stageIndex >= 2, recert: false };

        // The cycle after this one, projected from where this one ends. Shown
        // apart from the current cycle's milestones and never as owed.
        const nextStart = new Date(cycleLastDay.getTime());
        nextStart.setDate(nextStart.getDate() + 1);
        const nextRecertDue = addMonths(nextStart, CYCLE_MONTHS);
        nextRecertDue.setDate(nextRecertDue.getDate() - 60);
        const nextCycle = {
            number: cycleNumber + 1, start: nextStart,
            surv1Due: addMonths(nextStart, 12), surv2Due: addMonths(nextStart, 24), recertDue: nextRecertDue,
            projected: true
        };

        // A real scheduled plan always beats a computed due date.
        let nextAudit = dueDate ? { date: dueDate, source: 'calendar', label: stage } : null;
        const scheduled = allPlans.filter((p) => {
            if (!p) return false;
            if (!belongsToThisClient(p)) return false;
            if (standard && trim(p.standard) && trim(p.standard).toLowerCase() !== standard.toLowerCase()) return false;
            const st = trim(p.status).toLowerCase();
            if (st === 'completed' || st === 'cancelled') return false;
            const d = parseDateSafe(p.startDate || p.date);
            return !!d && d >= today;
        }).sort((a, b) => (parseDateSafe(a.startDate || a.date) - parseDateSafe(b.startDate || b.date)))[0];
        if (scheduled) {
            nextAudit = {
                date: parseDateSafe(scheduled.startDate || scheduled.date),
                source: 'scheduled',
                label: trim(scheduled.auditType || scheduled.type) || 'Scheduled audit'
            };
        }

        return {
            anchor, firstCertified, cycleEnd, rawExpiry, surv1Due, surv2Due, recertDue,
            // The certificate ON FILE can lapse long before the cycle does when
            // it is re-issued annually: that is a re-issue overdue, not the end
            // of certification, and the two must not be conflated.
            certificateExpired: !!rawExpiry && today > rawExpiry,
            completed, completionRecords, recordedAudits, surveillancesDone, recertDone, hasHistory, sharedEvidence,
            stage, nextStage, nextDue, stageSource, progress, nextAudit, nextCycle, periodComplete,
            cycleNumber, cycleYear, cycleLabel, periodStart, periodEnd, cycleLastDay,
            expired: today > cycleEnd,
            lifecycleEvents
        };
    }

    // ─── Certification history — every cycle, read-only ─────────────────────
    // The original certification, a transfer from another certification body,
    // each cycle boundary (a recertification) and every audit on record —
    // completion records, finalized reports and completed plans — across ALL
    // cycles, oldest first. cycleState only reads the current cycle; this
    // keeps the earlier ones visible. Nothing here is derived into a decision
    // or written back: a boundary with no recertification on record says so.
    const HISTORY_EVENT_LABELS = {
        'surveillance-1-completed': 'Surveillance 1 performed',
        'surveillance-2-completed': 'Surveillance 2 performed',
        'recertification-completed': 'Recertification performed',
        'certification-renewal': 'Certification renewed',
        'certificate-issue': 'Certificate issued',
        'certification-decision': 'Certification decision',
        'technical-review': 'Technical review'
    };
    function certificationHistory(input) {
        try {
            return certificationHistoryInner(input || {});
        } catch (_e) {
            return [];
        }
    }
    function certificationHistoryInner(input) {
        const client = input.client || {};
        const certs = safeArr(client.certificates);
        const standard = trim(input.standard);
        const cert = input.certificate
            || (standard ? certs.find((c) => trim(c.standard).toLowerCase() === standard.toLowerCase()) : null)
            || certs[0] || null;
        if (!cert) return [];
        const today = parseDateSafe(input.today) || new Date();
        const first = parseDateSafe(cert.initialDate) || parseDateSafe(cert.issueDate) || parseDateSafe(cert.currentIssue);
        const DAY = 24 * 60 * 60 * 1000;
        // Which cycle a date belongs to. An audit up to 60 days before a
        // boundary is the next cycle's (the same window cycleState reads).
        const cycleOf = (d) => {
            if (!first || !d) return null;
            const shifted = new Date(d.getTime() + 60 * DAY);
            if (shifted < first) return null;
            let n = 1;
            let start = first;
            while (n < 40 && addMonths(start, CYCLE_MONTHS) <= shifted) { start = addMonths(start, CYCLE_MONTHS); n++; }
            return n;
        };
        const entries = [];
        if (first) entries.push({ date: first, kind: 'certification', label: 'Original certification', detail: 'Initial Date on the certificate record', cycle: 1 });
        const transfer = parseDateSafe(cert.transferDate);
        if (transfer) {
            entries.push({
                date: transfer, kind: 'transfer', label: 'Certificate transferred',
                detail: trim(cert.previousCB) ? 'From ' + trim(cert.previousCB) : 'From the previous certification body', cycle: cycleOf(transfer)
            });
        }

        const certificateId = String(cert.id || cert.certificateId || cert.certificateNo || '');
        const events = safeArr(client.certificationLifecycleEvents)
            .filter((event) => event && HISTORY_EVENT_LABELS[trim(event.type).toLowerCase()]
                && (!certificateId || String(event.certificateId || '') === certificateId));
        events.forEach((event) => {
            const when = parseDateSafe(event.occurredAt || event.createdAt);
            if (!when) return;
            const meta = event.metadata || {};
            const by = meta.source === 'third-party' ? 'Third-party audit' + (trim(meta.auditor) ? ': ' + trim(meta.auditor) : '')
                : meta.source === 'cci' ? 'CCI' + (trim(meta.auditor) ? ': ' + trim(meta.auditor) : '') : '';
            entries.push({
                date: when, kind: 'event', type: trim(event.type).toLowerCase(), label: HISTORY_EVENT_LABELS[trim(event.type).toLowerCase()],
                detail: [by, trim(event.reason)].filter(Boolean).join(' — ') || 'Recorded on the certificate', cycle: cycleOf(when)
            });
        });
        const records = completedAuditRecords(client, standard || cert.standard, input.allReports, input.allPlans, today);
        records.forEach((r) => {
            entries.push({
                date: r.date, kind: 'audit', type: classifyAuditType(r.auditType), label: r.auditType || 'Audit',
                detail: r.origin === 'plan' ? 'Audit plan marked Completed' : 'Finalized audit report', cycle: cycleOf(r.date)
            });
        });

        // Each cycle boundary reached so far, with the recertification behind
        // it where one is on record.
        if (first) {
            const isRecert = (e) => (e.kind === 'event' && (e.type === 'recertification-completed' || e.type === 'certification-renewal'))
                || (e.kind === 'audit' && e.type === 'recert');
            let boundary = addMonths(first, CYCLE_MONTHS);
            for (let n = 2; n < 40 && boundary <= today; n++) {
                const lo = boundary.getTime() - 180 * DAY;
                const hi = boundary.getTime() + 90 * DAY;
                const evidence = entries.filter(isRecert).find((e) => e.date.getTime() >= lo && e.date.getTime() <= hi);
                entries.push({
                    date: new Date(boundary.getTime()), kind: 'cycle', label: 'Cycle ' + n + ' began — recertification',
                    detail: evidence ? 'Recertification on record' : 'No recertification record on file', cycle: n
                });
                boundary = addMonths(boundary, CYCLE_MONTHS);
            }
        }
        return entries.sort((a, b) => a.date - b.date);
    }

    // ─── Clause Area Performance — single computation for the whole report ────
    // The report used to build this table with its OWN clause-resolution rule
    // (criterionRef-only for NCs, kbMatch.clause-only for everything else) in
    // execution-reporting.js, entirely separate from resultCounts/uniqueFindings
    // above. Two rules over the same items meant the table's own "Checked"
    // total could silently disagree with the report's headline assessed-item
    // count. This is the ONE clause attribution used for every item type here,
    // via formatCriterion() — the same function every other report module
    // already trusts to decide whether a reference is a real standard clause.
    const CLAUSE_AREA_NAMES = { '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning', '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation', '10': 'Improvement' };
    const CLAUSE_AREA_ORDER = ['4', '5', '6', '7', '8', '9', '10'];

    function emptyAreaRow(mainClause) {
        return { clause: mainClause, area: CLAUSE_AREA_NAMES[mainClause] || null, checked: 0, conform: 0, majorNC: 0, minorNC: 0, observation: 0, ofi: 0 };
    }

    /**
     * Per-clause-area (4-10) breakdown of every ASSESSED item (conform, NC of
     * any severity, observation, ofi — notAssessed/na items carry no result to
     * attribute). Items whose resolved criterion isn't a real clause 4-10 (an
     * internal FOCUS/SURV/ORG/DOC reference, a surveillance-programme
     * criterion, or nothing at all) land in `unresolved` instead of being
     * silently dropped, so `totals` below can be checked against
     * resultCounts/advisories and a discrepancy is a bug, not a rounding
     * artefact.
     *
     * pendingClassification items (status 'nc', no ncrType) fold into the
     * minorNC column — the finalize gate blocks issuance while any exist, so a
     * printed report should never carry one, but a table cell silently
     * dropping an assessed item would defeat the whole point of this function.
     *
     * @param {Array} items - hydratedProgress-shaped items
     * @param {Object} [opts] - passed through to formatCriterion (e.g. standardClauses)
     * @returns {{rows: Array, unresolved: Object, totals: Object}}
     */
    // Items outside clauses 4-10 are not all "unassigned". PC Connection's 2026
    // recertification showed 17 under "Criterion not assigned": 16 were ISO/IEC
    // 27001 Annex A controls, one was a recertification-programme question,
    // and none lacked a criterion. They are now three rows: Annex A controls,
    // certification-programme items, and items with no criterion. A FOCUS
    // item carries a previous finding forward and needs a clause of its own;
    // without one it stays "Criterion not assigned".
    const PROGRAMME_REF_RE = /^(RECERT|SURV|ORG|DOC|DOCNOTE|REVIEW)\b/i;
    function computeClauseAreaBreakdown(items, opts) {
        const areas = {};
        const unresolved = emptyAreaRow(null);
        const annexA = emptyAreaRow('A');
        const programme = emptyAreaRow(null);
        CLAUSE_AREA_ORDER.forEach((c) => { areas[c] = emptyAreaRow(c); });

        safeArr(items).forEach((item) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (bucket === 'notAssessed' || bucket === 'na') return;

            // formatCriterion().real is truthy for a surveillance-programme
            // criterion too (e.g. "9.6.2(b)") — it just echoes clause/criterionRef
            // back verbatim outside the internal-ref branch, with no opinion on
            // whether that's actually a clause of the STANDARD. classifyCriterion's
            // kind is what actually distinguishes them: only 'standard' belongs in
            // a numbered clause area — 'programme' (17021-1 surveillance elements),
            // 'internal' (FOCUS/SURV/ORG/DOC), 'unverified' and 'none' all go to
            // unresolved, same as an NC with no clause at all.
            const classified = classifyCriterion(item, opts);
            const resolved = classified.kind === 'standard' ? classified.ref : null;
            const mainC = resolved ? String(resolved).split('.')[0] : null;
            const rawRef = trim(item.criterionRef || item.clause);
            let row;
            if (mainC && areas[mainC]) row = areas[mainC];
            else if (PROGRAMME_REF_RE.test(rawRef) || classified.kind === 'programme') row = programme;
            else if (resolved && /^A\.\d/.test(String(resolved))) row = annexA;
            else row = unresolved;

            row.checked++;
            if (bucket === 'conform') row.conform++;
            else if (bucket === 'majorNC') row.majorNC++;
            else if (bucket === 'minorNC' || bucket === 'pendingClassification') row.minorNC++;
            else if (bucket === 'observation') row.observation++;
            else if (bucket === 'ofi') row.ofi++;
        });

        const rows = CLAUSE_AREA_ORDER.map((c) => areas[c]).filter((r) => r.checked > 0);
        const all = rows.concat([annexA, programme, unresolved].filter((r) => r.checked > 0));
        const totals = all.reduce((t, r) => ({
            checked: t.checked + r.checked,
            conform: t.conform + r.conform,
            majorNC: t.majorNC + r.majorNC,
            minorNC: t.minorNC + r.minorNC,
            observation: t.observation + r.observation,
            ofi: t.ofi + r.ofi
        }), { checked: 0, conform: 0, majorNC: 0, minorNC: 0, observation: 0, ofi: 0 });

        return {
            rows,
            annexA: annexA.checked > 0 ? annexA : null,
            programme: programme.checked > 0 ? programme : null,
            unresolved: unresolved.checked > 0 ? unresolved : null,
            totals
        };
    }

    function safeMinimalDataset() {
        return {
            resultCounts: { conform: 0, majorNC: 0, minorNC: 0, na: 0, notAssessed: 0, pendingClassification: 0 },
            notSampled: 0,
            advisories: { observation: 0, ofi: 0, total: 0 },
            totals: { totalItems: 0, applicable: 0, assessed: 0 },
            coveragePct: null,
            conformityPct: null,
            coverageInputs: { assessed: 0, applicable: 0 },
            conformityInputs: { conforming: 0, assessed: 0 },
            uniqueFindings: [],
            clauseRefsAffected: 0,
            advisoryItems: [],
            carRollup: { raised: 0, confirmed: 0, awaitingResponse: 0, carsCreated: 0, inProgress: 0, awaitingVerification: 0, verified: 0, closed: 0 },
            byDepartment: {},
            byClauseTop: {},
            byClauseArea: { rows: [], unresolved: null, totals: { checked: 0, conform: 0, majorNC: 0, minorNC: 0, observation: 0, ofi: 0 } },
            auditStatus: 'Insufficient Data',
            statusColor: 'neutral',
            recommendation: null,
            recColor: 'neutral',
            methodologyNote: 'Insufficient checklist data was available to compute coverage or conformity for this audit.',
            reconciliation: []
        };
    }

    function build(input) {
        try {
            return buildInner(input || {});
        } catch (_e) {
            return safeMinimalDataset();
        }
    }

    function buildInner(input) {
        const report = input.report || {};
        const auditPlan = input.auditPlan || {};
        const items = Array.isArray(input.hydratedProgress) && input.hydratedProgress.length
            ? input.hydratedProgress
            : safeArr(report.checklistProgress);

        // ── Pass 1: classify every item, accumulate counts + per-dept/clause aggregates ──
        const resultCounts = { conform: 0, majorNC: 0, minorNC: 0, na: 0, notAssessed: 0, pendingClassification: 0 };
        const advisories = { observation: 0, ofi: 0, total: 0 };
        // Items the auditor marked "not sampled" (risk-based sampling). They
        // stay in notAssessed for every figure; this only lets the text say why.
        let notSampled = 0;
        const byDepartment = {};
        const byClauseTop = {};

        function deptAgg(name) {
            if (!byDepartment[name]) byDepartment[name] = { total: 0, assessed: 0, conform: 0, majorNC: 0, minorNC: 0, advisories: 0, notAssessed: 0, evidence: 0 };
            return byDepartment[name];
        }
        function clauseAgg(clause) {
            if (!byClauseTop[clause]) byClauseTop[clause] = { total: 0, assessed: 0, conform: 0, majorNC: 0, minorNC: 0, advisories: 0 };
            return byClauseTop[clause];
        }

        items.forEach((item) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (trim(item.status).toLowerCase() === 'not_sampled') notSampled++;
            const dept = normalizeDeptName(item.department);
            const clause = trim(item.clause) || 'General';
            const dAgg = deptAgg(dept);
            const cAgg = clauseAgg(clause);
            dAgg.total++;
            cAgg.total++;
            if (itemHasEvidence(item)) dAgg.evidence++;

            switch (bucket) {
                case 'notAssessed':
                    resultCounts.notAssessed++;
                    dAgg.notAssessed++;
                    break;
                case 'na':
                    resultCounts.na++;
                    break;
                case 'conform':
                    resultCounts.conform++;
                    dAgg.assessed++; dAgg.conform++;
                    cAgg.assessed++; cAgg.conform++;
                    break;
                case 'majorNC':
                    resultCounts.majorNC++;
                    dAgg.assessed++; dAgg.majorNC++;
                    cAgg.assessed++; cAgg.majorNC++;
                    break;
                case 'minorNC':
                    resultCounts.minorNC++;
                    dAgg.assessed++; dAgg.minorNC++;
                    cAgg.assessed++; cAgg.minorNC++;
                    break;
                case 'pendingClassification':
                    resultCounts.pendingClassification++;
                    dAgg.assessed++;
                    cAgg.assessed++;
                    break;
                case 'observation':
                    advisories.observation++; advisories.total++;
                    dAgg.assessed++; dAgg.advisories++;
                    cAgg.assessed++; cAgg.advisories++;
                    break;
                case 'ofi':
                    advisories.ofi++; advisories.total++;
                    dAgg.assessed++; dAgg.advisories++;
                    cAgg.assessed++; cAgg.advisories++;
                    break;
                default:
                    resultCounts.notAssessed++;
                    dAgg.notAssessed++;
            }
        });

        const totalItems = items.length;
        const applicable = totalItems - resultCounts.na;
        const assessed = resultCounts.conform + resultCounts.majorNC + resultCounts.minorNC
            + resultCounts.pendingClassification + advisories.total;

        const coveragePct = applicable > 0 ? pct(assessed, applicable) : null;
        const conformingAssessed = assessed - resultCounts.majorNC - resultCounts.minorNC - resultCounts.pendingClassification;
        const conformityPct = assessed > 0 ? pct(conformingAssessed, assessed) : null;

        // Raw inputs behind each percentage, exposed so renderers can show
        // "N of M items" alongside the percentage without recomputing it from
        // resultCounts/totals themselves.
        const coverageInputs = { assessed, applicable };
        const conformityInputs = { conforming: conformingAssessed, assessed };

        // ── Pass 2: unique findings (majors/minors/pending) with register/manual merge ──
        const win = auditWindow(report, auditPlan);
        const clientId = report.clientId;
        const planId = report.planId != null ? report.planId : (auditPlan && auditPlan.id != null ? auditPlan.id : null);
        const registerAll = safeArr(global.state && global.state.ncrs);

        // Register records linked to this audit: primary by auditId===planId,
        // secondary by clientId + matching clause + within audit window.
        const findingClauseSet = new Set();
        const rawFindingItems = [];
        items.forEach((item, idx) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (bucket === 'majorNC' || bucket === 'minorNC' || bucket === 'pendingClassification') {
                findingClauseSet.add(trim(item.clause));
                rawFindingItems.push({ item, idx, bucket });
            }
        });

        const linkedRegister = [];
        const claimedIds = {};
        registerAll.forEach((n) => {
            if (!n) return;
            // Superseded duplicates are retained in the register for
            // traceability and must never reach a report figure.
            if (String(n.status || '').toLowerCase() === 'withdrawn') return;
            if (planId != null && n.auditId != null && String(n.auditId) === String(planId)) {
                linkedRegister.push(n);
                if (n.id != null) claimedIds[String(n.id)] = true;
            }
        });
        registerAll.forEach((n) => {
            if (!n) return;
            if (n.id != null && claimedIds[String(n.id)]) return;
            if (clientId == null || n.clientId == null || String(n.clientId) !== String(clientId)) return;
            if (!n.clause || !findingClauseSet.has(trim(n.clause))) return;
            if (!dateWithinWindow(n.raisedDate, win)) return;
            const sevOk = /^major|minor$/i.test(trim(n.severity || n.type));
            if (!sevOk) return;
            linkedRegister.push(n);
            if (n.id != null) claimedIds[String(n.id)] = true;
        });

        // Manual entries (report.ncrs) — major/minor only, matched against
        // checklist findings by clause+department; unmatched become extra findings.
        const manualNcrs = safeArr(report.ncrs).filter((n) => n && /^major|minor$/i.test(trim(n.type || n.ncrType || n.severity)));

        const registerByClause = {};
        linkedRegister.forEach((rec) => {
            const c = trim(rec.clause);
            if (!c) return;
            (registerByClause[c] = registerByClause[c] || []).push(rec);
        });
        const claimedRegisterIds = {};

        function buildFindingKey(item, idx) {
            const checklistId = item.checklistId || item.id;
            return checklistId != null ? `${checklistId}|${idx}` : `${trim(item.clause)}|${normalizeDeptName(item.department)}|${idx}`;
        }

        const findingsPre = rawFindingItems.map(({ item, idx, bucket }) => {
            const clause = trim(item.clause) || 'General';
            const dept = normalizeDeptName(item.department);
            const sources = ['checklist'];
            let capaRef = null;

            // The register record this finding is: first the one linked to
            // this checklist item, else one on the same clause — a Major/Minor
            // record only, since the pool also holds observations and OFIs.
            const unclaimed = (r) => !(r.id != null && claimedRegisterIds[String(r.id)]);
            const isNcRecord = (r) => /^(major|minor)/i.test(trim(r.severity || r.type));
            const regMatch = linkedRegister.find((r) => unclaimed(r) && r.sourceChecklistId != null
                    && item.checklistId != null && String(r.sourceChecklistId) === String(item.checklistId)
                    && String(r.sourceItemIdx) === String(item.itemIdx))
                || (registerByClause[clause] || []).find((r) => unclaimed(r) && isNcRecord(r));
            let registerDueDate = null;
            if (regMatch) {
                sources.push('register');
                if (regMatch.id != null) { claimedRegisterIds[String(regMatch.id)] = true; capaRef = regMatch.id; }
                registerDueDate = trim(regMatch.dueDate) || null;
            }

            const manualMatchIdx = manualNcrs.findIndex((n) => n && trim(n.clause) === clause && !n._statsClaimed);
            if (manualMatchIdx !== -1) {
                manualNcrs[manualMatchIdx]._statsClaimed = true;
                if (sources.indexOf('manual') === -1) sources.push('manual');
            }

            return {
                key: buildFindingKey(item, idx),
                clause,
                // Carried through so any consumer (CAPA/NCR register renders,
                // narrative generation) can resolve the real standard clause via
                // ReportStats.formatCriterion() instead of printing `clause` raw —
                // `clause` alone can be an internal FOCUS/SURV/ORG/DOC reference.
                criterionRef: item.criterionRef || null,
                criterionSource: item.criterionSource || null,
                department: dept,
                severity: severityFromBucket(bucket),
                statement: cleanText(item.requirement || item.description || '', 120),
                comment: cleanText(item.comment || '', 200),
                evidenceCount: evidenceCount(item),
                caDueDate: item.caDueDate || null,
                registerDueDate,
                sources,
                capaRef
            };
        });

        // Unmatched manual NCRs (major/minor) become additional findings.
        manualNcrs.forEach((n, i) => {
            if (n._statsClaimed) return;
            const clause = trim(n.clause) || 'General';
            const dept = normalizeDeptName(n.department);
            const sev = /major/i.test(trim(n.type || n.ncrType || n.severity)) ? 'major' : 'minor';
            const regPool = registerByClause[clause] || [];
            const regMatch = regPool.find((r) => !(r.id != null && claimedRegisterIds[String(r.id)]));
            const sources = ['manual'];
            let capaRef = null;
            if (regMatch) {
                sources.push('register');
                if (regMatch.id != null) { claimedRegisterIds[String(regMatch.id)] = true; capaRef = regMatch.id; }
            }
            findingsPre.push({
                key: `manual|${clause}|${dept}|${i}`,
                clause,
                criterionRef: n.criterionRef || null,
                criterionSource: n.criterionSource || null,
                department: dept,
                severity: sev,
                statement: cleanText(n.description || n.comment || '', 120),
                comment: cleanText(n.comment || n.description || '', 200),
                evidenceCount: 0,
                caDueDate: n.caDueDate || null,
                sources,
                capaRef
            });
        });

        // Stable sort by (clause, department), assign F-01... ids.
        findingsPre.sort((a, b) => (a.clause || '').localeCompare(b.clause || '', undefined, { numeric: true })
            || (a.department || '').localeCompare(b.department || ''));
        const uniqueFindings = findingsPre.map((f, i) => Object.assign({ id: 'F-' + String(i + 1).padStart(2, '0') }, f));

        const clauseRefsAffected = new Set(uniqueFindings.map((f) => f.clause)).size;

        // ── Advisory items (observation/ofi) ──
        let advCounter = { observation: 0, ofi: 0 };
        const advisoryItems = [];
        items.forEach((item) => {
            if (!item) return;
            const bucket = classifyItem(item);
            if (bucket !== 'observation' && bucket !== 'ofi') return;
            advCounter[bucket]++;
            advisoryItems.push({
                id: (bucket === 'observation' ? 'OBS-' : 'OFI-') + String(advCounter[bucket]).padStart(2, '0'),
                type: bucket,
                clause: trim(item.clause) || 'General',
                // Additive field — carried through for the same reason
                // uniqueFindings carries it: so a consumer can resolve a
                // FOCUS/SURV/ORG/DOC-carryover advisory to its real clause
                // (e.g. effectivenessFindings below) instead of reading
                // `clause` raw, which may be an internal working reference.
                criterionRef: item.criterionRef || null,
                department: normalizeDeptName(item.department),
                comment: cleanText(item.comment || '', 200),
                evidenceCount: evidenceCount(item)
            });
        });

        // ── CAPA rollup ──
        function registerStatus(rec) {
            const status = trim(rec.status).toLowerCase();
            if (status === 'closed') return 'closed';
            if (rec.verifiedDate) return 'verified';
            if (/verif/.test(status)) return 'verified';
            if (/progress/.test(status)) return 'inProgress';
            return null;
        }
        let carsCreated, inProgress = 0, awaitingVerification = 0, verified = 0, closed = 0;
        const linkedForFindings = uniqueFindings.filter((f) => f.capaRef != null);
        carsCreated = linkedForFindings.length;
        linkedRegister.forEach((rec) => {
            if (rec.id == null || !claimedRegisterIds[String(rec.id)]) return; // only records actually attached to a finding
            const st = registerStatus(rec);
            if (st === 'closed') closed++;
            else if (st === 'verified') { verified++; }
            if (/verification/i.test(trim(rec.status))) awaitingVerification++;
            if (st === 'inProgress') inProgress++;
        });
        const raised = uniqueFindings.length;
        const carRollup = {
            raised,
            confirmed: uniqueFindings.filter((f) => f.severity !== 'pending_classification').length,
            awaitingResponse: Math.max(0, raised - carsCreated),
            carsCreated,
            inProgress,
            awaitingVerification,
            verified,
            closed
        };

        // ── Headline status / recommendation ──
        let auditStatus, statusColor, recommendation, recColor;
        // Manual Major/Minor NCRs that match no checklist item are findings too
        // (they are in uniqueFindings). They stay out of the item-based conformity
        // math, but the headline status and the certification recommendation must
        // see them — otherwise an audit whose only NC is a manual Major read
        // "Conforming / Recommended for certification".
        const manualOnly = uniqueFindings.filter((f) => f.sources && f.sources[0] === 'manual');
        const decisionMajor = resultCounts.majorNC + manualOnly.filter((f) => f.severity === 'major').length;
        const decisionMinor = resultCounts.minorNC + manualOnly.filter((f) => f.severity === 'minor').length;
        if (decisionMajor > 0) {
            auditStatus = 'Non-Conformities Identified'; statusColor = 'bad';
            recColor = 'bad';
        } else if (decisionMinor > 0 || resultCounts.pendingClassification > 0) {
            auditStatus = 'Minor Non-Conformities'; statusColor = 'warn';
            recColor = 'warn';
        } else {
            auditStatus = 'Conforming'; statusColor = 'good';
            recColor = 'good';
        }
        const auditTypeForRec = report.auditType || auditPlan.type || auditPlan.auditType || '';
        recommendation = recommendationText(auditTypeForRec, { majorNC: decisionMajor, minorNC: decisionMinor });
        const recommendationKey = recommendationFingerprint(auditTypeForRec, { majorNC: decisionMajor, minorNC: decisionMinor });

        // Always populated (never conditional) — exact wording per spec, shown
        // next to the coverage/conformity figures in every consumer.
        // No conformity figure is printed (PC Connection technical review,
        // 28 Nov 2026), so the note no longer defines one.
        const methodologyNote = 'Audit Coverage = items assessed ÷ applicable checklist items (N/A excluded). '
            + 'Analytical indicator only — not a certification score.';

        // ── Reconciliation checks ──
        const reconciliation = [];
        if (resultCounts.pendingClassification > 0) {
            reconciliation.push({ code: 'unclassified_finding', message: `${resultCounts.pendingClassification} finding(s) are marked non-conforming without a Major/Minor/Observation/OFI classification.` });
        }
        const ncSum = resultCounts.majorNC + resultCounts.minorNC + advisories.observation + advisories.ofi + resultCounts.pendingClassification;
        const ncItemCount = items.filter((i) => i && trim(i.status).toLowerCase() === 'nc').length;
        if (ncSum !== ncItemCount) {
            reconciliation.push({ code: 'nc_count_mismatch', message: `Sum of classified NC/advisory items (${ncSum}) does not match total items marked non-conforming (${ncItemCount}).` });
        }
        if (resultCounts.notAssessed > 0) {
            reconciliation.push({ code: 'coverage_gap', message: notSampled
                ? `${resultCounts.notAssessed} checklist item(s) have no assessed result (${notSampled} marked not sampled under risk-based sampling) and are excluded from coverage and conformity.`
                : `${resultCounts.notAssessed} checklist item(s) have no recorded status and are excluded from coverage and conformity.` });
        }
        // Duplicate detection: a manual NCR that matched a checklist finding is fine;
        // flag only if the same clause+department appears as more than one *unmatched*
        // manual entry alongside an existing checklist finding (would double count in a naive rollup).
        const seenComboForDup = {};
        findingsPre.forEach((f) => {
            const combo = f.clause + '|' + f.department;
            seenComboForDup[combo] = (seenComboForDup[combo] || 0) + (f.sources.length > 1 ? 0 : 1);
        });
        Object.keys(seenComboForDup).forEach((combo) => {
            if (seenComboForDup[combo] > 1) {
                reconciliation.push({ code: 'possible_duplicate_finding', message: `Multiple unmatched findings share clause/department "${combo}" — verify these are not duplicate records.` });
            }
        });

        return {
            resultCounts,
            notSampled,
            advisories,
            totals: { totalItems, applicable, assessed },
            coveragePct,
            conformityPct,
            coverageInputs,
            conformityInputs,
            uniqueFindings,
            clauseRefsAffected,
            advisoryItems,
            carRollup,
            byDepartment,
            byClauseTop,
            byClauseArea: computeClauseAreaBreakdown(items, { standardClauses: input.standardClauses }),
            auditStatus,
            statusColor,
            recommendation,
            recommendationKey,
            recColor,
            methodologyNote,
            reconciliation
        };
    }

    // ─── Management system effectiveness, derived from the findings ──────────
    // The Management System Effectiveness table used to print a fixed
    // "Implemented and effective; conforms to the requirements of the standard"
    // for every process, so a report could declare the internal audit programme
    // conforming on one page while raising a nonconformity against clause 9.2 on
    // another. Effectiveness is therefore derived from the validated findings:
    // an area governed by an open NC can never be reported as fully conforming.
    //
    // Clause prefixes per area. An area is matched on the finding's RESOLVED
    // criterion (criterionRef when present, else clause) so a Stage 1 carryover
    // resolved to 9.2 counts against the internal audit programme.
    const EFFECTIVENESS_AREAS = {
        internalAudit: { label: 'internal audit programme', clauses: ['9.2'] },
        mgmtReview: { label: 'management review', clauses: ['9.3'] },
        complaints: { label: 'handling of complaints', clauses: ['9.1.2', '8.2.1', '10.2'] },
        legal: { label: 'legal and regulatory compliance', clauses: ['4.2', '6.1.3', '8.2.2'] }
    };

    // Single source of truth (Task B): this used to run its OWN pass over
    // report.checklistProgress + report.ncrs — status==='nc' plus a raw
    // ncrType read, entirely separate from classifyItem()/buildInner() above.
    // A manual NCR already matched to a checklist finding there (so it isn't
    // double-counted in resultCounts/uniqueFindings) would still be counted
    // again here as an independent finding, and a hydration-resolved clause
    // could differ from the raw report.checklistProgress value this function
    // read directly — either way, Management System Effectiveness could
    // silently disagree with the same audit's headline counts. Deriving from
    // build()'s own uniqueFindings (majorNC/minorNC/pendingClassification,
    // register/manual-NCR merge already applied) and advisoryItems
    // (observation/ofi) instead makes this exactly as correct as every other
    // consumer of the canonical dataset — never a second count.
    function effectivenessFindings(report) {
        const ds = build({ report: report || {} });
        const fromFindings = safeArr(ds.uniqueFindings).map((f) => ({
            ref: trim(f.criterionRef) || trim(f.clause),
            type: f.severity === 'major' ? 'major' : (f.severity === 'minor' ? 'minor' : '')
        }));
        const fromAdvisories = safeArr(ds.advisoryItems).map((a) => ({
            ref: trim(a.criterionRef) || trim(a.clause),
            type: a.type
        }));
        return fromFindings.concat(fromAdvisories).filter((f) => f.ref);
    }

    function matchesArea(ref, clauses) {
        return clauses.some((c) => ref === c || ref.indexOf(c + '.') === 0);
    }

    /**
     * Effectiveness statement per process area, derived from the findings.
     * Returns { internalAudit, mgmtReview, complaints, legal } — sentences ready
     * to print. Callers treat these as DEFAULTS: an auditor's own wording wins.
     */
    function effectivenessStatements(report) {
        const findings = effectivenessFindings(report);
        const assessedRefs = safeArr(report && report.checklistProgress)
            .map((i) => trim(i && (i.criterionRef || i.clause)))
            .filter(Boolean);
        const out = {};
        Object.keys(EFFECTIVENESS_AREAS).forEach((key) => {
            const area = EFFECTIVENESS_AREAS[key];
            const hits = findings.filter((f) => matchesArea(f.ref, area.clauses));
            const major = hits.filter((f) => f.type === 'major').length;
            const minor = hits.filter((f) => f.type === 'minor').length;
            const advisory = hits.filter((f) => f.type === 'observation' || f.type === 'ofi').length;
            const assessed = assessedRefs.some((r) => matchesArea(r, area.clauses));

            if (major) {
                out[key] = 'Not effective — ' + major + ' major nonconformity(ies) identified regarding the '
                    + area.label + '. Corrective action required.';
            } else if (minor) {
                out[key] = 'Implemented; ' + minor + ' minor nonconformity(ies) identified regarding the '
                    + area.label + '. Corrective action required.';
            } else if (advisory) {
                out[key] = 'Implemented; opportunity for improvement identified regarding the ' + area.label + '.';
            } else if (assessed) {
                out[key] = 'Implemented and effective; conforms to the requirements of the standard.';
            } else {
                out[key] = 'Not assessed during this audit.';
            }
        });
        return out;
    }

    // ─── Corrective-action timeframes ───────────────────────────────────────
    // 30/90 days are the certification body's own scheme rules, NOT requirements
    // of ISO 9001 — printing them as though the standard mandates them is wrong,
    // and a CB operating a different scheme cannot change them. They are
    // therefore configuration, resolved most-specific-first:
    //   settings.capaTimeframes.byStage[stage]      (e.g. 'Stage 2', 'Surveillance')
    //   settings.capaTimeframes.byStandard[standard]
    //   settings.capaTimeframes.default             (or a flat {major, minor})
    //   built-in fallback
    // `source` reports which level answered, so the UI can show whether a CB has
    // actually configured its scheme or is running on the fallback.
    const DEFAULT_CAPA_TIMEFRAMES = { major: 30, minor: 90 };
    // Printed instead of a hardcoded day count when the CB has not configured
    // its scheme — the procedure governs, not a number we invented.
    const CAPA_PROCEDURE_SENTENCE = 'Corrective action timeframe: in accordance with the certification body\'s applicable corrective-action procedure.';

    function positiveDays(v) {
        const n = Number(v);
        return (!isNaN(n) && n > 0) ? Math.round(n) : null;
    }

    function normalizeTimeframeEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const major = positiveDays(entry.major);
        const minor = positiveDays(entry.minor);
        if (major === null && minor === null) return null;
        return { major, minor };
    }

    /**
     * Resolve corrective-action timeframes for an audit.
     * @param {{settings?:object, standard?:string, stage?:string}} opts
     * @returns {{major:number, minor:number, source:'stage'|'standard'|'default'|'fallback', configured:boolean}}
     */
    function capaTimeframes(opts) {
        const o = opts || {};
        const cfg = (o.settings && o.settings.capaTimeframes) || null;
        const stage = trim(o.stage);
        const standard = trim(o.standard);

        const candidates = [];
        if (cfg) {
            if (stage && cfg.byStage) candidates.push(['stage', normalizeTimeframeEntry(cfg.byStage[stage])]);
            if (standard && cfg.byStandard) candidates.push(['standard', normalizeTimeframeEntry(cfg.byStandard[standard])]);
            candidates.push(['default', normalizeTimeframeEntry(cfg.default) || normalizeTimeframeEntry(cfg)]);
        }
        for (let i = 0; i < candidates.length; i++) {
            const [source, entry] = candidates[i];
            if (!entry) continue;
            return {
                major: entry.major === null ? DEFAULT_CAPA_TIMEFRAMES.major : entry.major,
                minor: entry.minor === null ? DEFAULT_CAPA_TIMEFRAMES.minor : entry.minor,
                source,
                configured: true
            };
        }
        return {
            major: DEFAULT_CAPA_TIMEFRAMES.major,
            minor: DEFAULT_CAPA_TIMEFRAMES.minor,
            source: 'fallback',
            configured: false
        };
    }

    /**
     * Corrective-action due date for a Major/Minor NC, from the same resolved
     * timeframes the report prints — so the CAPA register and the client report
     * give one deadline. Returns a local YYYY-MM-DD (toISOString shifts a day
     * east of UTC).
     * @param {string} severity  'Major'|'Minor' (any case)
     * @param {Date|string} [from] raised date; defaults to today
     * @param {{settings?:object, standard?:string, stage?:string}} [opts]
     */
    function capaDueDate(severity, from, opts) {
        const tf = capaTimeframes(opts);
        const days = /major/i.test(String(severity || '')) ? tf.major : tf.minor;
        const ymd = typeof from === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
        let base = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : (from ? new Date(from) : new Date());
        if (isNaN(base.getTime())) base = new Date();
        const due = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
        const pad = (n) => String(n).padStart(2, '0');
        return due.getFullYear() + '-' + pad(due.getMonth() + 1) + '-' + pad(due.getDate());
    }

    // The NC register reference, as the register itself shows it (NCR-021).
    function registerRefLabel(id) {
        const s = trim(id);
        return /^\d+$/.test(s) ? 'NCR-' + s.padStart(3, '0') : s;
    }

    // ─── Corrective-action requirements, one source for preview and PDF ─────
    // Each Major/Minor finding of the report, under the reference and due date
    // the client must answer against. Those are the NC register's: PC
    // Connection's v1.1 report printed "NCR-177132-1, due 2026-05-18" while
    // the register held NCR-021 and NCR-053 (due 2 June), so the client's
    // responses could not be matched to the records the CB tracks. A finding
    // with no register record keeps its report id; its due date is counted
    // from the AUDIT date with the CB's timeframes, never from the day the
    // PDF happens to be exported.
    //
    // @param {object} rs   ReportStats.build() result
    // @param {{auditDate?:string, settings?:object, standard?:string, stage?:string}} opts
    function correctiveActions(rs, opts) {
        const o = opts || {};
        return safeArr(rs && rs.uniqueFindings)
            .filter((f) => !/^(observation|ofi)$/i.test(trim(f.severity)))
            .map((f) => {
                const sev = /major/i.test(trim(f.severity)) ? 'Major' : 'Minor';
                const dueDate = f.registerDueDate || f.caDueDate
                    || capaDueDate(sev, o.auditDate, { settings: o.settings, standard: o.standard, stage: o.stage });
                return {
                    ref: f.capaRef != null ? registerRefLabel(f.capaRef) : f.id,
                    findingId: f.id,
                    capaRef: f.capaRef != null ? f.capaRef : null,
                    clause: f.clause || '',
                    criterionRef: f.criterionRef || null,
                    criterionSource: f.criterionSource || null,
                    type: sev,
                    desc: f.comment || f.statement || '',
                    dueDate,
                    dueSource: f.registerDueDate ? 'register' : (f.caDueDate ? 'report' : 'computed')
                };
            });
    }

    // ── The audit's dates, as every report section prints them ──────────────
    // A report row carries only `date`, the first day; the last day is on the
    // plan (endDate). The report read report.endDate alone, so a three-day
    // audit printed as one day on the cover, the summaries and the narrative
    // (PC Connection, 17–19 November 2026, printed "2026-11-17"; the closing
    // meeting on the 19th and two days of evidence contradicted it).
    // Returns { start, end, days, text }; end is '' for a one-day audit.
    function auditDates(report, auditPlan) {
        const r = report || {};
        const p = auditPlan || {};
        const df = global.DocFormat;
        const iso = (v) => ((df && df.toIso && df.toIso(v)) || String(v == null ? '' : v).slice(0, 10));
        const start = trim(r.date || p.startDate || p.date);
        let end = trim(r.endDate || p.endDate);
        // An end on or before the start is not a range.
        if (!start || !end || iso(end) <= iso(start)) end = '';
        let days = start ? 1 : 0;
        if (end) {
            const span = df && df.daysBetween ? df.daysBetween(start, end)
                : Math.round((Date.parse(iso(end)) - Date.parse(iso(start))) / 86400000);
            days = (span > 0 ? span : 0) + 1;
        }
        let text = '';
        if (start) {
            text = (df && df.formatDateRange && df.formatDateRange(start, end))
                || (end ? start + ' — ' + end : start);
        }
        return { start, end, days, text };
    }

    // ── The requirement, as the client reads it ──────────────────────────────
    // The checklist appends planning notes for the auditor to a question:
    // which documents were on file, that none was mapped, what was missing at
    // the pre-audit review. They printed in the Requirement column of the
    // report and on the corrective action forms ("Pre-audit gap: … Record what
    // was supplied, or whether its absence affects conformity."). Everything
    // from the first such note on is dropped.
    const PLANNING_NOTE_RE = /\s*(?:Documented information on file that should support this|Pre-audit gap\s*:|No validated supporting document mapped)[\s\S]*$/i;
    function clientRequirement(text) {
        return String(text == null ? '' : text).replace(PLANNING_NOTE_RE, '').trim();
    }

    global.ReportStats = {
        build,
        auditDates,
        clientRequirement,
        classifyItem,
        version: 1,
        capaTimeframes,
        capaDueDate,
        correctiveActions,
        registerRefLabel,
        CAPA_PROCEDURE_SENTENCE,
        normalizeDeptName,
        UNASSIGNED_LABEL,
        auditAreaResolver,
        UNTIED_AREA_LABEL,
        recommendationText,
        recommendationFingerprint,
        resolveRecommendation,
        buildProgramme,
        cycleState,
        recordBelongsTo,
        previousReport,
        coversStandard,
        certificationHistory,
        formatCriterion,
        classifyCriterion,
        resolveFindingStandard,
        citeFinding,
        splitStandards,
        cleanEvidenceText,
        effectivenessStatements,
        computeClauseAreaBreakdown,
        CLAUSE_AREA_NAMES
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.ReportStats;
    }
})(typeof window !== 'undefined' ? window : globalThis);

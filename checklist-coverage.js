// ============================================
// RECERTIFICATION COVERAGE VALIDATION  (window.ChecklistCoverage)
// ============================================
// ChecklistQA answers "is this checklist internally defensible?". This module
// answers the question an accreditation assessor asks at recertification:
//
//   over the whole three-year certification cycle, has every applicable
//   requirement and every critical process actually been audited — and was
//   this audit's control selection driven by risk rather than by habit?
//
// ISO/IEC 17021-1 §9.6.3 makes recertification a review of the management
// system over the ENTIRE cycle, so coverage is assessed against this audit
// PLUS the audit programme's completed visits, never against this checklist
// alone. For an ISMS, ISO/IEC 27006 does not require every Annex A control to
// be audited at every audit — controls are selected risk-based — but the
// applicable controls are expected to have been covered by the close of the
// cycle. Both halves of that rule are implemented here:
//
//   per audit   — the controls the risk drivers point at must be sampled
//   per cycle   — applicable controls never sampled anywhere in the cycle are
//                 flagged as the cycle closes, not before
//
// Risk drivers are taken from data that actually exists on the client record:
// the Statement of Applicability, the risk-assessment documents on file,
// changes logged against the client during the cycle (ISO 17021-1 9.6.2) or
// flagged by this audit's own pre-audit review, incidents (complaints/
// appeals) raised in the cycle, and previous audit results (the NCR/CAPA
// register). A driver with no data behind it is reported as unavailable
// rather than assumed — an invented driver is worse than a missing one,
// because it reads as evidence.
//
// CONTRACT
//   window.ChecklistCoverage.buildContext(checklist, opts) -> cycle context
//        (impure — reads window.state; the only function here that does)
//   window.ChecklistCoverage.assess(checklist, ctx) -> {
//        ok, blocking, counts, issues: [{code, severity, message, itemRef}],
//        coverage: { clauses, controls, processes, cycle }
//   }
//   window.ChecklistCoverage.readiness(checklist, opts) -> {
//        ready, blockers: [{code, label, detail, itemRef}], notes: []
//   }
//
// SEVERITY matches ChecklistQA: critical / warning / info.

(function (global) {
    'use strict';

    const CS = () => global.ChecklistStandards;
    const QA = () => global.ChecklistQA;

    // ── Risk drivers ──────────────────────────────────────────────────
    // Each driver names the evidence that justifies auditing a control at THIS
    // audit. `label` is what the auditor sees on the checklist and in the QA
    // panel, so it has to read as a reason, not as a code.
    const DRIVERS = {
        soa: { label: 'Statement of Applicability', code: 'soa' },
        risk: { label: 'risk assessment / risk treatment', code: 'risk' },
        change: { label: 'change since the previous audit', code: 'change' },
        incident: { label: 'incident, complaint or appeal', code: 'incident' },
        finding: { label: 'previous audit result', code: 'finding' },
        unsampled: { label: 'not sampled anywhere in this cycle', code: 'unsampled' }
    };

    // Annex A control themes reached by each driver when the evidence names no
    // control reference of its own. An incident log that cites no control still
    // makes incident-response controls auditable; it does not make, say, the
    // physical-security controls auditable, so the mapping stays narrow.
    const THEME_BY_DRIVER = {
        incident: ['incident', 'continuity'],
        change: ['change', 'cloud', 'supplier'],
        risk: ['governance', 'asset', 'compliance']
    };

    // Words that mark a document as risk-assessment evidence, and words in a
    // finding or incident that point at a control theme.
    const RISK_DOC = /risk (assessment|register|treatment|methodolog)|statement of applicability|\bsoa\b|risk treatment plan|\brtp\b/i;
    // Deliberately narrower than RISK_DOC: a risk assessment or treatment plan
    // routinely cites the SoA without being one, and RISK_DOC exists precisely
    // to catch that wider set as risk evidence. This is the test for "IS the
    // current Statement of Applicability", used only to pick the document that
    // Annex A applicability is read FROM.
    const SOA_DOC = /\bstatement of applicability\b|\bsoa\b/i;
    const CHANGE_WORDS = /\bchange[sd]?\b|\bnew\b|migrat|transition|acquisi|restructur|re-?organis|onboard|decommission|upgrade|replatform/i;
    const THEME_WORDS = [
        [/access|password|credential|identity|privileg|joiner|leaver/i, 'hr-access'],
        [/supplier|vendor|third[- ]party|outsourc|subcontract/i, 'supplier'],
        [/cloud|aws|azure|saas|hosting/i, 'cloud'],
        [/incident|breach|event|complaint|outage/i, 'incident'],
        [/continuit|disaster|recovery|resilien|bcp|drp/i, 'continuity'],
        [/backup|malware|logging|monitor|vulnerab|patch|network|encrypt|crypto/i, 'technical'],
        [/asset|inventory|classification|labelling/i, 'asset'],
        [/legal|regulat|complian|contract|privacy|personal data/i, 'compliance'],
        [/change|project|development|deploy|release/i, 'change'],
        [/physical|premises|clear desk|equipment|site/i, 'physical'],
        [/awareness|training|screening|disciplin|employment/i, 'people']
    ];

    function str(v) { return String(v == null ? '' : v); }
    function lower(v) { return str(v).toLowerCase(); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    function refKey(stdId, ref) { return stdId + '::' + str(ref).trim(); }

    function parseDate(v) {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }

    function addMonths(date, months) {
        const d = new Date(date.getTime());
        d.setMonth(d.getMonth() + months);
        return d;
    }

    /** Control references named anywhere in a piece of free text. */
    function refsInText(text) {
        return (str(text).match(/A\.\d{1,2}\.\d{1,2}/g) || []);
    }

    /** Themes a piece of free text points at, via THEME_WORDS. */
    function themesInText(text) {
        const t = str(text);
        const out = [];
        THEME_WORDS.forEach(function (pair) {
            if (pair[0].test(t) && out.indexOf(pair[1]) === -1) out.push(pair[1]);
        });
        return out;
    }

    /**
     * Free text still available on a client document record after import.
     * The full body is deliberately never retained (see client-docs-bulk.js —
     * a whole manual would bloat the row that syncs to Supabase), so this is
     * everything identification and reference extraction have to work with:
     * the title, its category, the clause refs the importer captured, the
     * numbered headings it read, and any notes an auditor typed.
     */
    function docText(d) {
        const headings = arr(d && d.headings).map(function (h) {
            return str(h && h.clause) + ' ' + str(h && h.text);
        }).join(' ');
        return [d && d.name, d && d.category, d && d.linkedClauses, d && d.docNumber, headings, d && d.notes]
            .map(str).join(' ');
    }

    /** Sortable rank for a "Rev 4" / "Rev B" marker; no marker sorts last. */
    function revisionRank(v) {
        const s = str(v);
        const num = s.match(/(\d+(?:\.\d+)?)/);
        if (num) return parseFloat(num[1]);
        const letter = s.match(/([A-Za-z])\s*$/);
        return letter ? letter[1].toUpperCase().charCodeAt(0) : -Infinity;
    }

    /**
     * The current version among several candidate documents — by issue date,
     * falling back to the revision marker when neither carries a usable date.
     * "Current" is what applicability has to be read from; an outdated SoA
     * left on file from a prior cycle would misstate what is applicable now.
     */
    function latestDocument(list) {
        return list.slice().sort(function (a, b) {
            const ad = parseDate(a.date), bd = parseDate(b.date);
            if (ad && bd) return bd.getTime() - ad.getTime();
            if (ad || bd) return ad ? -1 : 1;
            return revisionRank(b.revision) - revisionRank(a.revision);
        })[0];
    }

    /**
     * Flatten a checklist to its questions. Delegates to ChecklistQA so both
     * modules always see the same item list; carries its own fallback so
     * coverage can still be assessed if QA has not loaded.
     */
    function flatten(checklist) {
        const qa = QA();
        if (qa && typeof qa.flatten === 'function') return qa.flatten(checklist);
        const out = [];
        arr(checklist && checklist.clauses).forEach(function (main) {
            arr(main.subClauses).forEach(function (sub) {
                out.push({
                    section: main.mainClause, sectionTitle: main.title || '',
                    clause: sub.clause, title: sub.title || '',
                    requirement: sub.requirement || (arr(sub.items)[0] || {}).requirement || '',
                    refs: Array.isArray(sub.refs) ? sub.refs : null,
                    standards: Array.isArray(sub.standards) ? sub.standards : null,
                    auditorReview: !!sub.auditorReview, raw: sub
                });
            });
        });
        if (!out.length) {
            arr(checklist && checklist.items).forEach(function (it) {
                out.push({
                    section: '', sectionTitle: '', clause: it.clause, title: it.title || '',
                    requirement: it.requirement || it.text || '', refs: null, standards: null,
                    auditorReview: false, raw: it
                });
            });
        }
        return out;
    }

    /**
     * The id execution uses for each question, in flatten() order:
     * "<mainClause>-<subIdx>" for a sectioned checklist, the item index for a
     * flat one. Matches report.checklistProgress[].itemIdx.
     */
    function itemKeys(checklist) {
        const keys = [];
        arr(checklist && checklist.clauses).forEach(function (main) {
            arr(main.subClauses).forEach(function (_sub, i) { keys.push(str(main.mainClause) + '-' + i); });
        });
        if (!keys.length) arr(checklist && checklist.items).forEach(function (_it, i) { keys.push(String(i)); });
        return keys;
    }

    /** What a question earns credit for — ChecklistQA.creditedRefs is THE rule. */
    function creditedRefs(it, ids) {
        const qa = QA();
        if (qa && typeof qa.creditedRefs === 'function') return qa.creditedRefs(it, ids);
        if (!it || it.documentNote || it.auditorReview) return [];
        if (Array.isArray(it.refs)) return it.refs.filter(function (r) { return r && r.stdId && r.ref; });
        const clause = str(it.clause).trim();
        return clause ? arr(ids).map(function (id) { return { stdId: id, ref: clause }; }) : [];
    }

    /**
     * Every `stdId::ref` a checklist tests, plus the text each question tests
     * it with (used for process matching).
     *
     * With `opts.executed` (a set of item ids answered conform / nonconform),
     * only those questions count: that is what was AUDITED, as opposed to what
     * is merely planned on the checklist.
     *
     * @param {Object} [opts] - { executed: {itemId: true} }
     * @returns {{refs: Object, text: string, items: Array<{text: string}>}}
     */
    function coverageOf(checklist, standardIds, opts) {
        const ids = arr(standardIds);
        const only = opts && opts.executed ? opts.executed : null;
        const refs = Object.create(null);
        const parts = [];
        const items = [];
        const keys = itemKeys(checklist);
        flatten(checklist).forEach(function (it, i) {
            if (only && !only[keys[i]]) return;
            parts.push(it.title, it.requirement);
            const raw = it.raw || {};
            // A process counts as audited only where a question is ABOUT it:
            // its title names the process, or it is an organisation-context
            // question listing the processes it walks. Matching the whole
            // checklist text credited "Legal", "Change" and "Risk Management"
            // from words in unrelated questions. A legacy question (no source
            // recorded) keeps its full text.
            const source = str(raw.criterionSource || raw.source);
            items.push({ text: (!source || source === 'org-context') ? str(it.title) + ' \n ' + str(it.requirement) : str(it.title) });
            creditedRefs(it, ids).forEach(function (r) { refs[refKey(r.stdId, r.ref)] = true; });
        });
        return { refs: refs, text: parts.join(' \n '), items: items };
    }

    /**
     * True when registry row `ref` is covered for that standard. A sub-clause
     * citation covers its parent only where the registry holds no sub-clause
     * rows of its own (ChecklistStandards.refCovered); a parent never covers a
     * sub-clause.
     */
    function covers(refs, stdId, ref) {
        const Std = CS();
        if (Std && typeof Std.refCovered === 'function') return Std.refCovered(refs, stdId, ref);
        if (refs[refKey(stdId, ref)]) return true;
        const prefix = refKey(stdId, ref) + '.';
        return Object.keys(refs).some(function (k) { return k.indexOf(prefix) === 0; });
    }

    /** Report statuses that mean the audit's results are final. */
    function isFinalReport(r) {
        const s = lower(str(r && (r.reportStatus || r.status)).trim());
        return s === 'final' || s === 'finalized' || s === 'finalised' || s === 'approved' || s === 'published' || s === 'issued';
    }

    /** Execution answers that mean a question was actually audited. */
    function isAudited(status) {
        const s = lower(status);
        return s === 'conform' || s === 'compliant' || s === 'nc';
    }

    /**
     * Item ids answered conform / nonconform, by checklist id, across the given
     * reports' checklistProgress.
     * @returns {Object} { checklistId: { itemIdx: true } }
     */
    function executedByChecklist(reports) {
        const out = {};
        arr(reports).forEach(function (r) {
            arr(r && r.checklistProgress).forEach(function (p) {
                if (!p || p.isCustom || p.checklistId == null || p.itemIdx == null || !isAudited(p.status)) return;
                const cid = String(p.checklistId);
                (out[cid] = out[cid] || {})[String(p.itemIdx)] = true;
            });
        });
        return out;
    }

    // ── Which standards is this checklist tied to? ────────────────────
    //
    // ONE resolver, used by coverage, QA and the print path. It used to exist
    // twice: ChecklistQA fell back to parsing `checklist.standard` while
    // coverage read only `standardIds` / `qaContext.standardIds` and gave up.
    // A checklist that had lost those ids — they live only inside qa_context on
    // the cloud row — therefore passed QA ("every clause belongs to a standard
    // in scope") and was in the same breath reported as "not tied to a standard
    // in the clause registry". Both statements were printed on the PC CONNECTION
    // checklist. There is now exactly one answer.
    //
    // Order: recorded ids -> qa_context ids -> the standard NAMES on the
    // checklist -> the standards its own questions cite. The first that yields
    // a registry standard wins; `source` says which, so a derived answer is
    // never mistaken for a recorded one.

    function registryOrder(ids) {
        const Std = CS();
        const all = Std && Std.all ? Std.all().map(function (x) { return x.id; }) : [];
        return ids.slice().sort(function (a, b) { return all.indexOf(a) - all.indexOf(b); });
    }

    /**
     * @param {Object} checklist
     * @returns {{ids: string[], source: string, unresolved: string[]}}
     */
    function resolveStandardIds(checklist) {
        const Std = CS();
        const ck = checklist || {};
        const inRegistry = function (list) {
            return Array.from(new Set(arr(list).map(str).filter(Boolean)))
                .filter(function (id) { return Std && Std.byId ? !!Std.byId(id) : true; });
        };
        let ids = inRegistry(ck.standardIds);
        if (ids.length) return { ids: registryOrder(ids), source: 'recorded', unresolved: [] };
        ids = inRegistry(ck.qaContext && ck.qaContext.standardIds);
        if (ids.length) return { ids: registryOrder(ids), source: 'qa-context', unresolved: [] };
        let unresolved = [];
        if (Std && Std.resolve && str(ck.standard)) {
            const r = Std.resolve(ck.standard);
            unresolved = arr(r.unresolved);
            if (arr(r.standards).length) {
                return { ids: registryOrder(r.standards.map(function (x) { return x.id; })), source: 'standard-name', unresolved: unresolved };
            }
        }
        const cited = new Set();
        flatten(ck).forEach(function (it) {
            arr(it.refs).forEach(function (r) { if (r && r.stdId) cited.add(r.stdId); });
            arr(it.standards).forEach(function (id) { cited.add(id); });
        });
        ids = inRegistry(Array.from(cited));
        if (ids.length) return { ids: registryOrder(ids), source: 'item-references', unresolved: unresolved };
        return { ids: [], source: 'none', unresolved: unresolved };
    }

    /**
     * Write the resolved association back onto the checklist so it survives the
     * next save, sync and reload. Idempotent; never overwrites recorded ids.
     * Used by the data-migration heal and before any validation is run.
     * @returns {{changed: boolean, ids: string[], source: string}}
     */
    function healStandardAssociation(checklist) {
        if (!checklist || typeof checklist !== 'object') return { changed: false, ids: [], source: 'none' };
        const r = resolveStandardIds(checklist);
        if (!r.ids.length) return { changed: false, ids: [], source: r.source };
        let changed = false;
        const same = function (a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); };
        if (!same(arr(checklist.standardIds), r.ids)) { checklist.standardIds = r.ids.slice(); changed = true; }
        if (!checklist.qaContext) { checklist.qaContext = {}; changed = true; }
        if (!same(arr(checklist.qaContext.standardIds), r.ids)) { checklist.qaContext.standardIds = r.ids.slice(); changed = true; }
        if (changed) checklist.standardIdsHealedFrom = r.source;
        return { changed: changed, ids: r.ids, source: r.source };
    }

    // ── Outcomes ──────────────────────────────────────────────────────
    // Four states, mutually exclusive. "Validated" is printed ONLY for the two
    // that actually assessed coverage — a coverage pass that could not run must
    // never read as one that found nothing wrong.
    // Coverage here is PLANNED coverage: it says what the checklist intends to
    // ask, plus what earlier audits in the cycle actually answered. It is never
    // a statement that the requirements were audited, and never conformity \u2014
    // so no label says "validated".
    const OUTCOMES = {
        passed: 'Passed \u2014 planned coverage complete',
        'passed-with-notes': 'Passed with warnings \u2014 planned coverage complete, with identified limitations',
        review: 'Requires auditor review \u2014 items need a decision before the checklist is released',
        blocked: 'Failed validation \u2014 coverage could not be assessed',
        failed: 'Failed validation \u2014 identified coverage gaps',
        // A checklist for a scheme the clause registry does not hold (GMP,
        // Halal, cGMP, ...): there is no requirement set to check it against.
        // That is a known limit, not an internal error \u2014 it must neither
        // block nor read as "validated".
        'not-assessed': 'Not assessed \u2014 no clause registry is held for this scheme; the auditor confirms coverage'
    };
    // Issues that mean the assessment worked from less evidence than it wanted.
    // They are limitations, not gaps: the auditor's judgement is needed, but
    // nothing has been shown to be uncovered.
    const LIMITATION_CODES = {
        SOA_NOT_SUPPLIED: 1, SOA_DOCUMENT_UNREADABLE: 1, RISK_DRIVER_UNAVAILABLE: 1, PROGRAMME_INCOMPLETE: 1,
        CYCLE_ANCHOR_ASSUMED: 1, PRIOR_CHECKLIST_UNAVAILABLE: 1, PRIOR_RESULTS_UNAVAILABLE: 1, STANDARD_NOT_IN_REGISTRY: 1
    };
    // Issues that mean the assessment could not be made at all — an internal
    // error in how the checklist is associated with its standards, not a
    // finding about the audit.
    const BLOCKED_CODES = { COVERAGE_UNAVAILABLE: 1, STANDARD_NOT_LINKED: 1, COVERAGE_NOT_ASSESSED: 1 };

    // ── Context assembly ──────────────────────────────────────────────

    /**
     * Assemble the certification-cycle view a coverage assessment needs.
     *
     * This is the one impure function in the module: it reads window.state so
     * that `assess` itself stays a pure function of (checklist, ctx) and can be
     * tested without a browser. Everything it cannot find is returned as an
     * empty collection and reported by `assess` as an unavailable driver — it
     * never substitutes a default that would read as evidence.
     *
     * @param {Object} checklist
     * @param {Object} [opts] - { client, planId, soaApplicable, now }
     * @returns {Object} cycle context
     */
    function buildContext(checklist, opts) {
        const o = opts || {};
        const state = (global.state || {});
        const clients = arr(state.clients);
        const client = o.client
            || clients.find(function (c) { return String(c.id) === String(checklist && checklist.clientId); })
            || clients.find(function (c) { return c.name === (checklist && checklist.clientName); })
            || null;

        const resolution = resolveStandardIds(checklist);
        const standardIds = resolution.ids;

        // Cycle window. The programme builder owns the anchor rule (a recorded
        // expiry is only the true cycle end when it is at least 30 months after
        // the anchor — many certificates on file are annual re-issues), so it is
        // used when available rather than re-deriving a second, conflicting rule.
        const now = o.now ? parseDate(o.now) : new Date();
        const plan = o.planId && global.DataService && global.DataService.findAuditPlan
            ? global.DataService.findAuditPlan(o.planId) : null;
        const allReports = arr(state.auditReports);

        // The standards the AUDIT is scoped to — from the caller, the plan, or
        // the client's certificates — so a checklist covering fewer of them than
        // the audit needs is caught rather than assessed against its own subset.
        const scopeText = o.scopeStandards
            || (plan && plan.standard)
            || (checklist && checklist.standard)
            || '';
        const scopeResolved = CS() && CS().resolve && (Array.isArray(scopeText) ? arr(scopeText).length : str(scopeText))
            ? CS().resolve(scopeText) : { standards: [], unresolved: [] };
        const scopeStandardIds = registryOrder(arr(scopeResolved.standards).map(function (x) { return x.id; }));

        let programme = null;
        if (global.ReportStats && typeof global.ReportStats.buildProgramme === 'function') {
            try {
                programme = global.ReportStats.buildProgramme({
                    client: client || {},
                    auditPlan: plan || {},
                    report: { standard: (checklist && checklist.standard) || '', clientId: client && client.id },
                    allReports: allReports
                });
            } catch (_e) { programme = null; }
        }

        const certs = arr(client && client.certificates);
        const cert = certs[0] || null;
        // First certification anchors the window, EXCEPT when it is plainly an
        // earlier cycle: a client first certified in 2020 read "cycle 16 Dec
        // 2020 – 15 Dec 2026" (six years, two cycles) at its 2026
        // recertification, crediting coverage from the previous cycle. When the
        // initial date lies more than four years before expiry (one cycle plus
        // a year's slack for certificates re-issued off-pattern), the window is
        // the three years that end at expiry.
        const certExpiry = parseDate(cert && cert.expiryDate);
        let anchor = parseDate(cert && (cert.initialDate || cert.issueDate || cert.currentIssue))
            || parseDate(programme && programme.cycleStart)
            || addMonths(now, -36);
        if (certExpiry && addMonths(anchor, 48).getTime() < certExpiry.getTime()) {
            anchor = addMonths(certExpiry, -36);
            anchor.setDate(anchor.getDate() + 1);
        }
        const expiry = parseDate(cert && cert.expiryDate);
        const cycleEnd = expiry && expiry.getTime() >= addMonths(anchor, 30).getTime()
            ? expiry : addMonths(anchor, 36);

        const inCycle = function (v) {
            const d = parseDate(v);
            return !!d && d.getTime() >= anchor.getTime() && d.getTime() <= cycleEnd.getTime();
        };
        const forClient = function (rec) {
            if (!client) return false;
            if (rec.clientId != null) return String(rec.clientId) === String(client.id);
            // Complaints carry no clientId at all — the "Related Client" field
            // on the Log Complaint form (appeals-complaints-module.js
            // openNewComplaintModal) writes the client's NAME into clientName,
            // never an id. Appeals do carry clientId, so this branch is a
            // fallback for the one record shape that genuinely lacks one, not
            // a loosening of scope: it is still an exact name match against
            // THIS client, so one client's records still cannot match another.
            if (rec.clientName && rec.clientName === client.name) return true;
            return !!rec.client && rec.client === client.name;
        };

        // Prior audits in this cycle, and the checklists they were run against.
        // plan.selectedChecklists is the field the Configure Checklists screen
        // and the execution view both write, so it is the authoritative link
        // between an audit and what it actually covered.
        // Only audits that are genuinely PRIOR count: not the audit this
        // checklist is for (it was reported as "2 of 2 prior audits" when one
        // existed), not a cancelled plan, and not one scheduled for later.
        const isCurrentPlan = function (p) { return !!(o.planId && String(p.id) === String(o.planId)); };
        const plans = arr(state.auditPlans).filter(function (p) {
            if (!p || isCurrentPlan(p) || !forClient(p)) return false;
            if (/cancel/i.test(str(p.status))) return false;
            const when = parseDate(p.startDate || p.date || p.createdAt);
            if (when && when.getTime() > now.getTime()) return false;
            return inCycle(p.startDate || p.date || p.createdAt);
        });
        const priorChecklistIds = {};
        plans.forEach(function (p) {
            arr(p.selectedChecklists).forEach(function (cid) { priorChecklistIds[String(cid)] = true; });
        });
        const priorChecklists = arr(state.checklists).filter(function (c) {
            return c && String(c.id) !== String(checklist && checklist.id) && priorChecklistIds[String(c.id)];
        });
        const checklistOnFile = {};
        priorChecklists.forEach(function (c) { checklistOnFile[String(c.id)] = true; });

        // What was actually AUDITED: answers from each prior audit's FINAL
        // report, and from this audit's report as it stands. A prior checklist
        // that was planned but never answered on a final report is not
        // evidence that anything was covered.
        const reportsOf = function (planId) {
            return allReports.filter(function (r) { return r && r.planId != null && String(r.planId) === String(planId); });
        };
        const priorExecuted = {};
        plans.forEach(function (p) {
            const done = executedByChecklist(reportsOf(p.id).filter(isFinalReport));
            arr(p.selectedChecklists).forEach(function (cid) {
                if (done[String(cid)]) priorExecuted[String(cid)] = done[String(cid)];
            });
        });
        const executed = (o.planId && checklist)
            ? (executedByChecklist(reportsOf(o.planId))[String(checklist.id)] || {})
            : {};

        // Previous results: the CAPA register is the real store of findings,
        // joined to an audit by auditId -> planId.
        const planIds = {};
        plans.forEach(function (p) { planIds[String(p.id)] = true; });
        const findings = arr(state.ncrs).filter(function (n) {
            if (!n) return false;
            // A superseded duplicate is not a previous audit result and must
            // not drive control selection as though it were one.
            if (String(n.status || '').toLowerCase() === 'withdrawn') return false;
            if (n.auditId != null && planIds[String(n.auditId)]) return true;
            return forClient(n) && inCycle(n.raisedDate || n.dateRaised || n.createdAt || n.date);
        });

        const incidents = arr(state.complaints).concat(arr(state.appeals)).filter(function (r) {
            return r && forClient(r) && inCycle(r.dateReceived || r.date || r.createdAt);
        });

        const docs = arr(client && client.documents).filter(function (d) { return d && d.name; });
        // Matched on name, category AND notes — a client document never carries
        // a `summary` field (client-docs-bulk.js and the manual upload form in
        // clients-module.js both write `notes`, not `summary`; see docText()
        // above, which reads the same field). Testing a field that is never
        // populated silently drops the one place a generically-named document
        // ("Q3 Review.xlsx") says what it actually is.
        const riskDocs = docs.filter(function (d) {
            return RISK_DOC.test(str(d.name) + ' ' + str(d.category) + ' ' + str(d.notes));
        });

        // ── Statement of Applicability ────────────────────────────────
        // A pasted SoA is the auditor looking at the current document right
        // now, so it always wins and the document set is never even searched.
        // Failing that, the current SoA on file — if the client has uploaded
        // one — is the only other source of applicability that is not an
        // assumption. Several SoA documents can be on file across a cycle's
        // worth of uploads; only the most recent is current.
        const suppliedSoa = arr(o.soaApplicable).length
            ? arr(o.soaApplicable)
            : arr(checklist && checklist.qaContext && checklist.qaContext.soaApplicable);
        let soaApplicable = suppliedSoa;
        let soaSource = suppliedSoa.length ? 'supplied' : null;
        let soaDocument = null;
        if (!suppliedSoa.length) {
            // Identification is deliberately narrower than extraction: it
            // tests only what the document IS — its name and category — not
            // its full text. A risk assessment routinely cites "the SoA" in
            // its notes without being one; matching on notes here would read
            // that mention as the document declaring itself the SoA.
            const soaDocs = docs.filter(function (d) { return SOA_DOC.test(str(d.name) + ' ' + str(d.category)); });
            if (soaDocs.length) {
                const chosen = latestDocument(soaDocs);
                const refs = Array.from(new Set(refsInText(docText(chosen))));
                // Identify the document either way — found-but-unreadable has
                // to be reported too, not treated as if nothing was found.
                soaDocument = { name: chosen.name, revision: chosen.revision || '', date: chosen.date || '', refCount: refs.length };
                if (refs.length) { soaApplicable = refs; soaSource = 'document'; }
            }
        }

        // ── Changes since the previous audit ──────────────────────────
        // Two independent sources, neither a substitute for the other.
        // client.compliance.changesLog is ISO 17021-1 9.6.2's own record of
        // significant client changes — dated, typed, written by the "Log
        // Change" action on the client's Compliance tab (clients-module.js
        // addClientChangeLog) — and is on file whether or not this audit ever
        // ran an AI document review. plan.preAudit.focusPoints is a narrower,
        // audit-specific source: the free-text output of the optional Stage 1
        // AI review (client-docs-bulk.js aiReviewPreAuditDocuments), which
        // only exists once that review has been run for THIS plan. A change
        // logged mid-cycle but never fed back into an AI review must still
        // count, so the log is read directly rather than only via the plan.
        const focusPoints = arr(plan && plan.preAudit && plan.preAudit.focusPoints);
        const changeLogEntries = arr(client && client.compliance && client.compliance.changesLog)
            .filter(function (log) { return log && inCycle(log.date); })
            // Every entry here was deliberately logged as a change — unlike
            // focusPoints (free AI text that may talk about anything), it is
            // not run through CHANGE_WORDS: that heuristic exists to find
            // change signal in unstructured text, not to second-guess a
            // record whose entire purpose is recording a change.
            .map(function (log) { return str([log.type, log.description].filter(Boolean).join(': ')); });
        const changes = changeLogEntries.concat(focusPoints.filter(function (f) {
            return CHANGE_WORDS.test(str(typeof f === 'string' ? f : (f.text || f.point || f.title)));
        }).map(function (f) { return str(typeof f === 'string' ? f : (f.text || f.point || f.title)); }));

        return {
            standardIds: standardIds,
            standardResolution: { source: resolution.source, unresolved: resolution.unresolved },
            scopeStandardIds: scopeStandardIds,
            auditType: (checklist && checklist.auditType) || (plan && plan.auditType) || '',
            soaApplicable: soaApplicable,
            // 'supplied' (pasted into the checklist), 'document' (read off the
            // current SoA on file), or null (neither — assess() assumes tier 1).
            soaSource: soaSource,
            // Identifies the SoA document that was used, or the one that was
            // found but yielded no control references, so assess() can name it
            // and the auditor can go look at it. Null only when no document on
            // file reads as an SoA at all.
            soaDocument: soaDocument,
            // How many of the client's documents were actually searched for an
            // SoA — lets assess() say "checked N documents, none looked like
            // an SoA" instead of a generic "none was supplied" that reads the
            // same whether the client has one undiscoverable document or none
            // on file at all.
            soaDocsChecked: docs.length,
            client: client,
            cycle: {
                start: anchor.toISOString().slice(0, 10),
                end: cycleEnd.toISOString().slice(0, 10),
                anchored: (programme && programme.anchored) || (cert ? 'certificate' : 'assumed'),
                stages: arr(programme && programme.stages),
                issues: arr(programme && programme.issues)
            },
            priorAudits: plans.map(function (p) {
                const ids = arr(p.selectedChecklists).map(String);
                return {
                    id: p.id, date: p.startDate || p.date || p.createdAt || '',
                    type: p.auditType || p.type || '', checklists: ids.length,
                    checklistsOnFile: ids.filter(function (cid) { return checklistOnFile[cid]; }).length,
                    resultsOnFile: ids.filter(function (cid) { return !!priorExecuted[cid]; }).length
                };
            }),
            priorChecklists: priorChecklists,
            // { checklistId: { itemIdx: true } } — questions answered on a
            // prior audit's final report. Only these earn cycle credit.
            priorExecuted: priorExecuted,
            // { itemIdx: true } — this checklist's questions answered so far.
            executed: executed,
            keyProcesses: arr(client && client.keyProcesses).map(function (p) {
                return typeof p === 'string' ? { name: p } : p;
            }),
            findings: findings.map(function (n) {
                return {
                    clause: n.clause || n.clauseRef || '', grade: n.grade || n.type || '',
                    text: [n.description, n.finding, n.statement, n.title, n.rootCause].filter(Boolean).join(' ')
                };
            }),
            incidents: incidents.map(function (r) {
                return { text: [r.subject, r.description, r.summary, r.details].filter(Boolean).join(' ') };
            }),
            changes: changes,
            // `summary` here is this context object's own field name (read by
            // riskDrivenControls' `text` accessor below) — it is populated
            // from the document's real `notes` field, per the fix above.
            riskDocs: riskDocs.map(function (d) { return { name: d.name, summary: str(d.notes) }; })
        };
    }

    // ── Risk-based Annex A selection ──────────────────────────────────

    /**
     * The controls this audit is expected to sample, and why.
     *
     * The pool is what the SoA declares applicable; with no SoA on file it
     * falls back to the controls prioritised for the scope (tier 1), which is
     * stated as an assumption rather than presented as the SoA. Selection
     * inside that pool is driven only by evidence: a control is required when a
     * previous finding, an incident, a recorded change or a risk document
     * points at it — by reference where the evidence cites one, by theme where
     * it does not.
     *
     * This deliberately does NOT return the whole pool. Requiring every Annex A
     * control at every audit is not what ISO/IEC 27006 asks for and it buries
     * the controls that risk actually points at.
     *
     * @returns {{pool: Array, required: Array, soaDriven: boolean, driversUsed: Array, driversMissing: Array}}
     */
    function riskDrivenControls(std, ctx) {
        const c = ctx || {};
        const soa = arr(c.soaApplicable);
        const soaDriven = soa.length > 0;
        const pool = soaDriven
            ? arr(std.controls).filter(function (ct) { return soa.indexOf(ct.ref) !== -1; })
            : arr(std.controls).filter(function (ct) { return ct.tier === 1; });

        const byRef = {};
        pool.forEach(function (ct) { byRef[ct.ref] = ct; });

        const required = {};
        const driversUsed = [];
        const driversMissing = [];

        const add = function (ref, driverCode, why) {
            const ct = byRef[ref];
            if (!ct) return;                       // outside the applicable pool
            if (!required[ref]) required[ref] = { ref: ref, title: ct.title, theme: ct.theme, drivers: [], why: [] };
            if (required[ref].drivers.indexOf(driverCode) === -1) required[ref].drivers.push(driverCode);
            if (why && required[ref].why.indexOf(why) === -1) required[ref].why.push(why);
        };
        const addByTheme = function (themes, driverCode, why) {
            pool.forEach(function (ct) {
                if (themes.indexOf(ct.theme) !== -1) add(ct.ref, driverCode, why);
            });
        };

        // Evidence sources, each either used or explicitly reported as absent.
        const sources = [
            ['finding', arr(c.findings), function (f) { return f.text + ' ' + f.clause; }],
            ['incident', arr(c.incidents), function (i) { return i.text; }],
            ['change', arr(c.changes), function (t) { return str(t); }],
            ['risk', arr(c.riskDocs), function (d) { return d.name + ' ' + d.summary; }]
        ];
        sources.forEach(function (entry) {
            const code = entry[0], rows = entry[1], text = entry[2];
            if (!rows.length) { driversMissing.push(DRIVERS[code].label); return; }
            driversUsed.push(DRIVERS[code].label);
            rows.forEach(function (row) {
                const t = text(row);
                const cited = refsInText(t);
                if (cited.length) {
                    cited.forEach(function (ref) { add(ref, code, DRIVERS[code].label); });
                    return;
                }
                // No control cited: reach only the themes the evidence names,
                // intersected with the themes that driver can legitimately reach.
                const named = themesInText(t);
                const allowed = THEME_BY_DRIVER[code] || [];
                const themes = named.filter(function (th) { return allowed.indexOf(th) !== -1; });
                if (themes.length) addByTheme(themes, code, DRIVERS[code].label);
                else if (allowed.length) addByTheme(allowed, code, DRIVERS[code].label);
            });
        });

        if (!soaDriven) driversMissing.unshift(DRIVERS.soa.label);
        else driversUsed.unshift(DRIVERS.soa.label);

        return {
            pool: pool,
            required: Object.keys(required).map(function (k) { return required[k]; }),
            soaDriven: soaDriven,
            driversUsed: driversUsed,
            driversMissing: driversMissing
        };
    }

    // ── Assessment ────────────────────────────────────────────────────

    function issue(code, severity, message, extra) {
        return Object.assign({ code: code, severity: severity, message: message, itemRef: '', section: '' }, extra || {});
    }

    /**
     * Assess coverage of this audit together with the certification cycle.
     *
     * Pure: everything it needs comes from `ctx` (see buildContext).
     *
     * @param {Object} checklist
     * @param {Object} ctx - { standardIds, auditType, soaApplicable, cycle, priorChecklists, keyProcesses, findings, incidents, changes, riskDocs }
     * @returns {{ok, blocking, counts, issues, coverage}}
     */
    function assess(checklist, ctx) {
        const c = ctx || {};
        const Std = CS();
        const ids = arr(c.standardIds);
        const auditType = lower(c.auditType);
        // A recertification closes the cycle, so a gap left anywhere in the
        // cycle is a finding now rather than a note for next time. Surveillance
        // audits sample; their gaps are informational until the cycle closes.
        const closing = auditType.indexOf('recert') === 0 || auditType.indexOf('recert') > -1;
        const gapSeverity = closing ? 'critical' : 'info';
        const issues = [];

        // Three different things, kept apart (they used to be one number):
        //   planned   — what this checklist intends to ask (here)
        //   completed — what this audit has actually answered (done)
        //   earlier   — what prior audits in the cycle answered on a final
        //               report (priorRefs). A prior checklist that was planned
        //               but never answered earns nothing.
        // The Ready gate judges planned + earlier: it runs before the audit.
        // Nothing here is a statement of conformity.
        const here = coverageOf(checklist, ids);
        const done = coverageOf(checklist, ids, { executed: c.executed || {} });
        const priorRefs = Object.create(null);
        const priorItems = [];
        let priorWithoutResults = 0;
        arr(c.priorChecklists).forEach(function (prior) {
            const exec = c.priorExecuted && c.priorExecuted[String(prior.id)];
            if (!exec) { priorWithoutResults++; return; }
            const cov = coverageOf(prior, arr(prior.standardIds).length ? prior.standardIds : ids, { executed: exec });
            Object.keys(cov.refs).forEach(function (k) { priorRefs[k] = true; });
            cov.items.forEach(function (x) { priorItems.push(x); });
        });
        const cycleRefs = Object.assign(Object.create(null), here.refs, priorRefs);
        const verifiedRefs = Object.assign(Object.create(null), done.refs, priorRefs);

        const coverage = {
            cycle: {
                start: c.cycle && c.cycle.start, end: c.cycle && c.cycle.end,
                anchored: c.cycle && c.cycle.anchored,
                priorAudits: arr(c.priorAudits).length,
                priorChecklists: arr(c.priorChecklists).length,
                priorWithResults: arr(c.priorChecklists).length - priorWithoutResults
            },
            clauses: [], controls: [], processes: { total: 0, covered: 0, gaps: [] }
        };

        const unresolvedNames = arr(c.standardResolution && c.standardResolution.unresolved);
        if (Std && !ids.length && unresolvedNames.length) {
            // Every standard this checklist names is outside the registry: a
            // scheme checklist (GMP, Halal, cGMP, ...). Nothing is broken — there
            // is simply no clause set to check it against. It is reported, not
            // blocked, and it does not claim to be validated.
            unresolvedNames.forEach(function (name) {
                issues.push(issue('STANDARD_NOT_IN_REGISTRY', 'warning',
                    name + ' is not held in the clause registry, so its coverage is not machine-checked; the auditor confirms the checklist covers the scheme requirements.',
                    { standard: name }));
            });
            const result = finish(issues, coverage);
            result.outcome = 'not-assessed';
            result.outcomeLabel = OUTCOMES['not-assessed'];
            result.blocking = false;
            return result;
        }
        if (!Std || !ids.length) {
            // An internal error, not a finding: the association between this
            // checklist and its standards is missing. It BLOCKS — filing it as
            // 'info' is what let "Coverage validated" print next to "could not
            // be assessed".
            issues.push(issue('COVERAGE_UNAVAILABLE', 'critical',
                'Coverage could not be assessed: this checklist is not linked to any standard in the clause registry'
                + (arr(c.standardResolution && c.standardResolution.unresolved).length
                    ? ' (not held in the registry: ' + c.standardResolution.unresolved.join(', ') + ')'
                    : '')
                + '. This is an internal association error, not a finding about the audit.'));
            return finish(issues, coverage);
        }

        // Every standard the audit is scoped to must be linked to this
        // checklist. A custom integrated checklist is ONE checklist for
        // several standards — it is not forced to have one.
        const notLinked = arr(c.scopeStandardIds).filter(function (id) { return ids.indexOf(id) === -1; });
        notLinked.forEach(function (id) {
            const std = Std.byId(id);
            issues.push(issue('STANDARD_NOT_LINKED', 'critical',
                'The audit scope includes ' + (std ? std.label : id) + ' but this checklist is not linked to it, so its coverage cannot be assessed.',
                { stdId: id }));
        });
        arr(c.standardResolution && c.standardResolution.unresolved).forEach(function (name) {
            issues.push(issue('STANDARD_NOT_IN_REGISTRY', 'warning',
                name + ' is named on this checklist but is not held in the clause registry; its coverage has not been assessed.',
                { standard: name }));
        });

        // Prior audits whose checklist is not on file: their coverage cannot be
        // credited. A gap reported below may then be unavailable evidence
        // rather than genuine noncoverage, and the message says so.
        // Counted per audit, not audits against checklists: one audit with two
        // checklists used to hide another audit with none.
        const priorAuditList = arr(c.priorAudits);
        const priorAuditCount = priorAuditList.length;
        const perAudit = priorAuditList.length && priorAuditList.every(function (p) { return p && p.checklistsOnFile != null; });
        const unread = perAudit
            ? priorAuditList.filter(function (p) { return !p.checklistsOnFile; }).length
            : Math.max(0, priorAuditCount - arr(c.priorChecklists).length);
        const noResults = perAudit
            ? priorAuditList.filter(function (p) { return p.checklistsOnFile && !p.resultsOnFile; }).length
            : 0;
        const unknownPrior = unread + noResults;
        const unreadNote = unknownPrior
            ? ' (' + unknownPrior + ' of ' + priorAuditCount + ' prior audit(s) in the cycle have no audited results on file, so part of this may be evidence that is not available here rather than genuine noncoverage — a missing record does not mean the audit did not cover it)'
            : '';
        if (unread) {
            issues.push(issue('PRIOR_CHECKLIST_UNAVAILABLE', 'warning',
                unread + ' of ' + priorAuditCount + ' prior audit(s) in the certification cycle have no checklist on file. What they covered is unknown and is not credited.',
                { unread: unread }));
        }
        if (priorWithoutResults) {
            issues.push(issue('PRIOR_RESULTS_UNAVAILABLE', 'warning',
                priorWithoutResults + ' checklist(s) from prior audits in this cycle have no answers on a final audit report, so their planned questions are not credited as covered. Finalize that audit\'s report, or record what it covered, to credit it.',
                { checklists: priorWithoutResults }));
        }

        // ── 1. Requirements of the standards, over the cycle ──────────
        ids.forEach(function (id) {
            const std = Std.byId(id);
            if (!std) return;
            const mandatory = arr(std.clauses).filter(function (cl) { return cl.mandatory; });
            const missHere = mandatory.filter(function (cl) { return !covers(here.refs, id, cl.ref); });
            const missCycle = mandatory.filter(function (cl) { return !covers(cycleRefs, id, cl.ref); });
            const thisAudit = mandatory.length - missHere.length;
            const overCycle = mandatory.length - missCycle.length;
            const completed = mandatory.filter(function (cl) { return covers(done.refs, id, cl.ref); }).length;
            const verified = mandatory.filter(function (cl) { return covers(verifiedRefs, id, cl.ref); }).length;
            const earlier = mandatory.filter(function (cl) { return covers(priorRefs, id, cl.ref); }).length;
            coverage.clauses.push({
                stdId: id, label: std.label, total: mandatory.length,
                // `thisAudit` is kept for existing readers; it is PLANNED.
                thisAudit: thisAudit,
                cycle: overCycle,
                // Planned in THIS audit, inherited from earlier audits in the
                // cycle, and what remains — the three things an assessor asks.
                planned: thisAudit,
                // Answered at this audit so far (conform / nonconform) — the
                // only "done" figure. Zero until the audit is carried out.
                completed: completed,
                inherited: Math.max(0, overCycle - thisAudit),
                // Covered by an audited answer: this audit's or a prior final
                // report's. Planned questions never count here.
                cycleVerified: verified,
                earlierAudited: earlier,
                remaining: missCycle.length,
                percentCycle: mandatory.length ? Math.round(overCycle / mandatory.length * 100) : 100,
                percentVerified: mandatory.length ? Math.round(verified / mandatory.length * 100) : 100,
                gaps: missCycle.map(function (m) { return m.ref; })
            });
            if (missCycle.length) {
                issues.push(issue('CYCLE_REQUIREMENT_GAP', gapSeverity,
                    std.label + ': ' + missCycle.length + ' requirement(s) audited nowhere in this certification cycle — '
                    + missCycle.slice(0, 8).map(function (m) { return m.ref; }).join(', ')
                    + (missCycle.length > 8 ? '…' : '') + unreadNote + '.',
                    { stdId: id, missing: missCycle.map(function (m) { return m.ref; }), evidenceUnavailable: unread > 0 }));
            } else if (missHere.length && !closing) {
                issues.push(issue('SAMPLED_ELSEWHERE_IN_CYCLE', 'info',
                    std.label + ': ' + missHere.length + ' requirement(s) not in this checklist were covered earlier in the cycle.',
                    { stdId: id }));
            }
        });

        // ── 2. Annex A — risk-based this audit, complete over the cycle ─
        ids.forEach(function (id) {
            const std = Std.byId(id);
            if (!std || !std.hasSoA) return;
            const sel = riskDrivenControls(std, c);
            const missingRequired = sel.required.filter(function (r) { return !covers(here.refs, id, r.ref); });
            const sampledHere = sel.pool.filter(function (ct) { return covers(here.refs, id, ct.ref); });
            const sampledCycle = sel.pool.filter(function (ct) { return covers(cycleRefs, id, ct.ref); });
            const neverSampled = sel.pool.filter(function (ct) { return !covers(cycleRefs, id, ct.ref); });
            const completedHere = sel.pool.filter(function (ct) { return covers(done.refs, id, ct.ref); });
            const verifiedCycle = sel.pool.filter(function (ct) { return covers(verifiedRefs, id, ct.ref); });

            coverage.controls.push({
                stdId: id, label: std.label, pool: sel.pool.length, soaDriven: sel.soaDriven,
                // What the pool's applicability rests on. Without an SoA it is
                // the tier-1 PROVISIONAL set — a working assumption, never
                // "applicable" (applicability is the client's, in its SoA).
                poolBasis: sel.soaDriven ? (c.soaSource === 'document' ? 'soa-document' : 'soa-supplied') : 'provisional',
                completed: completedHere.length, cycleVerified: verifiedCycle.length,
                // 'supplied' | 'document' | null — lets the printed panel and
                // the detail card say where the applicable set came from,
                // rather than only whether one was found.
                soaSource: c.soaSource || null, soaDocument: c.soaDocument || null,
                required: sel.required.length, thisAudit: sampledHere.length, cycle: sampledCycle.length,
                planned: sampledHere.length,
                inherited: Math.max(0, sampledCycle.length - sampledHere.length),
                remaining: neverSampled.length,
                neverSampled: neverSampled.map(function (ct) { return ct.ref; }),
                driversUsed: sel.driversUsed, driversMissing: sel.driversMissing
            });

            if (!sel.soaDriven) {
                // A document was found and read as the SoA but yielded no
                // Annex A references — that is not the same failure as no SoA
                // being on file at all, and treating it as such would send the
                // auditor to paste references that already exist somewhere,
                // rather than to the actual problem: the document could not be
                // read. Either way the message names exactly what was checked
                // (document name/category to find it; linked-clauses, headings
                // and notes to read it) so "no SoA on file" and "SoA on file
                // but unreadable" are never reported in the same words.
                if (c.soaDocument) {
                    issues.push(issue('SOA_DOCUMENT_UNREADABLE', 'warning',
                        std.label + ': "' + c.soaDocument.name + '"'
                        + (c.soaDocument.revision ? ' (' + c.soaDocument.revision + ')' : '')
                        + ' reads as the Statement of Applicability by name, but its linked-clauses, extracted headings and notes carried no Annex A control reference (e.g. "A.5.1") to read, so the applicable set is assumed to be the '
                        + sel.pool.length + ' controls prioritised for this scope. Document import only auto-extracts numbered body clauses (4–10), never Annex A references, so re-uploading the same file will not fix this — instead paste the applicable control list (e.g. "A.5.1, A.5.9, A.8.13…") into this document\'s Linked ISO Clause(s) or Notes field, or paste it directly into the checklist\'s SoA field.',
                        { stdId: id }));
                } else {
                    const checked = c.soaDocsChecked || 0;
                    issues.push(issue('SOA_NOT_SUPPLIED', 'warning',
                        std.label + ': no Statement of Applicability was supplied, and '
                        + (checked
                            ? 'none of the ' + checked + ' client document(s) on file is named or categorised as one (searched each document\'s name and category for "Statement of Applicability" or "SoA")'
                            : 'this client has no documents on file at all')
                        + ', so the applicable set is assumed to be the ' + sel.pool.length
                        + ' controls prioritised for this scope. Paste the SoA references directly into the checklist, or upload the current SoA as a client document named "Statement of Applicability" or "SoA" (then paste its applicable control list into the document\'s Linked ISO Clause(s) or Notes field — import does not read Annex A references off the file itself) to make the sample defensible.',
                        { stdId: id, docsChecked: checked }));
                }
            } else if (c.soaSource === 'document') {
                issues.push(issue('SOA_FROM_DOCUMENT', 'info',
                    std.label + ': applicability was read from "' + (c.soaDocument && c.soaDocument.name) + '"'
                    + (c.soaDocument && c.soaDocument.revision ? ' (' + c.soaDocument.revision + ')' : '')
                    + (c.soaDocument && c.soaDocument.date ? ', dated ' + c.soaDocument.date : '')
                    + ' — ' + sel.pool.length + ' control(s) declared applicable.',
                    { stdId: id }));
            }
            if (missingRequired.length) {
                issues.push(issue('RISK_CONTROL_GAP', 'critical',
                    std.label + ': ' + missingRequired.length + ' control(s) that this audit\'s risk drivers point at are not sampled — '
                    + missingRequired.slice(0, 8).map(function (r) { return r.ref + ' (' + r.why.join(', ') + ')'; }).join('; ')
                    + (missingRequired.length > 8 ? '…' : '') + '.',
                    { stdId: id, controls: missingRequired }));
            }
            // Cycle closure. Not a per-audit requirement: only at the audit that
            // closes the cycle does an unsampled applicable control become a gap.
            if (closing && neverSampled.length) {
                issues.push(issue('CYCLE_CONTROL_GAP', sel.soaDriven ? 'critical' : 'warning',
                    std.label + ': ' + neverSampled.length + ' of ' + sel.pool.length
                    + (sel.soaDriven
                        ? ' applicable Annex A control(s) were sampled at no audit in this cycle — '
                        : ' Annex A control(s) in the provisional pool (no Statement of Applicability confirmed, so applicability is assumed, not established) were sampled at no audit in this cycle — ')
                    + neverSampled.slice(0, 10).map(function (ct) { return ct.ref; }).join(', ')
                    + (neverSampled.length > 10 ? '…' : '') + unreadNote
                    + '. Sample them at this audit or record why they need not be.',
                    { stdId: id, missing: neverSampled.map(function (ct) { return ct.ref; }) }));
            }
            if (sel.driversMissing.length) {
                issues.push(issue('RISK_DRIVER_UNAVAILABLE', 'info',
                    std.label + ': control selection could not use ' + sel.driversMissing.join(', ')
                    + ' — nothing is on file for this cycle. Selection used ' + (sel.driversUsed.join(', ') || 'no evidence source')
                    + '; confirm the selection on site rather than treating it as risk-driven.',
                    { stdId: id, missing: sel.driversMissing }));
            }
        });

        // ── 3. Critical processes, over the cycle ─────────────────────
        const processes = arr(c.keyProcesses).filter(function (p) { return p && str(p.name).trim(); });
        // Matched question by question (this checklist's planned questions and
        // the questions prior audits actually answered), never across the
        // whole checklist text at once.
        const norm = function (s) { return lower(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
        const questionTexts = here.items.concat(priorItems).map(function (x) { return ' ' + norm(x.text) + ' '; });
        const gaps = processes.filter(function (p) {
            const name = norm(p.name);
            if (!name) return false;
            // A multi-word process name still counts as covered when the words
            // that carry its meaning all appear in ONE question — "Order to
            // Cash" vs "order-to-cash".
            const words = name.split(' ').filter(function (w) { return w.length > 3; });
            return !questionTexts.some(function (t) {
                if (t.indexOf(' ' + name + ' ') !== -1) return true;
                return words.length > 0 && words.every(function (w) { return t.indexOf(w) !== -1; });
            });
        });
        coverage.processes = {
            total: processes.length, covered: processes.length - gaps.length,
            gaps: gaps.map(function (p) { return p.name; })
        };
        if (gaps.length) {
            issues.push(issue('CYCLE_PROCESS_GAP', gapSeverity,
                gaps.length + ' critical process(es) are audited nowhere in this cycle — '
                + gaps.slice(0, 6).map(function (p) { return p.name; }).join(', ')
                + (gaps.length > 6 ? '…' : '') + '.',
                { processes: gaps.map(function (p) { return p.name; }) }));
        }

        // ── 4. The programme itself ───────────────────────────────────
        const stages = arr(c.cycle && c.cycle.stages);
        if (closing && stages.length) {
            const unknown = stages.filter(function (s) {
                return s.id !== 'recert' && (s.status === 'Unknown' || s.source === 'unknown');
            });
            if (unknown.length) {
                issues.push(issue('PROGRAMME_INCOMPLETE', 'warning',
                    unknown.length + ' audit(s) in the three-year programme have no record on file ('
                    + unknown.map(function (s) { return s.label; }).join(', ')
                    + '). Cycle coverage below is computed from the audits that do.',
                    { stages: unknown.map(function (s) { return s.label; }) }));
            }
        }
        if (c.cycle && c.cycle.anchored === 'assumed') {
            issues.push(issue('CYCLE_ANCHOR_ASSUMED', 'info',
                'No certificate on file for this client, so the cycle is assumed to be the 36 months ending today. '
                + 'Coverage dates are indicative until the certificate is recorded.'));
        }

        return finish(issues, coverage);
    }

    function finish(issues, coverage) {
        const counts = { critical: 0, warning: 0, info: 0 };
        issues.forEach(function (i) { counts[i.severity] = (counts[i.severity] || 0) + 1; });
        const blocked = issues.some(function (i) { return BLOCKED_CODES[i.code]; });
        let outcome;
        if (blocked) outcome = 'blocked';
        else if (counts.critical > 0) outcome = 'failed';
        else if (counts.warning > 0 || issues.some(function (i) { return LIMITATION_CODES[i.code]; })) outcome = 'passed-with-notes';
        else outcome = 'passed';

        // The integrated view: every standard's figures combined, so an
        // integrated audit reads as one audit as well as three.
        const rows = arr(coverage && coverage.clauses);
        const sum = function (key) { return rows.reduce(function (t, r) { return t + (r[key] || 0); }, 0); };
        const total = sum('total');
        coverage.integrated = {
            standards: rows.length, requirements: total, planned: sum('planned'), inherited: sum('inherited'),
            completed: sum('completed'), cycleVerified: sum('cycleVerified'),
            remaining: sum('remaining'), percentCycle: total ? Math.round(sum('cycle') / total * 100) : null,
            percentVerified: total ? Math.round(sum('cycleVerified') / total * 100) : null
        };
        // What needs an auditor's judgement rather than a fix.
        coverage.notes = issues.filter(function (i) { return LIMITATION_CODES[i.code] || i.code === 'RISK_DRIVER_UNAVAILABLE'; })
            .map(function (i) { return { code: i.code, message: i.message }; });

        return {
            ok: counts.critical === 0 && counts.warning === 0 && !blocked,
            blocking: counts.critical > 0 || blocked,
            outcome: outcome, outcomeLabel: OUTCOMES[outcome],
            counts: counts, issues: issues, coverage: coverage
        };
    }

    /**
     * One-line summary for a toast or a print banner. Always leads with the
     * outcome label; "validated" appears only for the two outcomes that
     * actually assessed coverage.
     */
    function summarize(result) {
        if (!result) return OUTCOMES.blocked;
        const label = result.outcomeLabel || OUTCOMES[result.outcome] || OUTCOMES.blocked;
        const c = result.counts || {};
        const bits = [];
        if (c.critical && result.outcome !== 'blocked') bits.push(c.critical + ' gap' + (c.critical > 1 ? 's' : ''));
        if (c.warning) bits.push(c.warning + ' warning' + (c.warning > 1 ? 's' : ''));
        if (c.info) bits.push(c.info + ' note' + (c.info > 1 ? 's' : ''));
        return label + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '.';
    }

    /**
     * ONE status for the whole checklist from the two passes, so the printed
     * document can never say "QA passed" and "coverage validated" while
     * coverage could not run.
     * @returns {{outcome: string, label: string, reasons: string[]}}
     */
    function combine(qa, coverage, checklist) {
        const reasons = [];
        if (!coverage) {
            reasons.push('The coverage pass did not run.');
            return { outcome: 'blocked', label: OUTCOMES.blocked, reasons: reasons };
        }
        if (coverage.outcome === 'blocked') {
            reasons.push('Coverage could not be assessed \u2014 see the internal error below.');
            return { outcome: 'blocked', label: OUTCOMES.blocked, reasons: reasons };
        }
        if (!qa) reasons.push('The QA pass did not run; only coverage was checked.');
        const qaCritical = qa && qa.counts && qa.counts.critical > 0;
        if (qaCritical) reasons.push(qa.counts.critical + ' critical QA issue(s).');
        if (coverage.outcome === 'not-assessed') {
            reasons.push('No clause registry is held for this scheme; coverage is the auditor’s to confirm.');
            if (qaCritical) return { outcome: 'failed', label: OUTCOMES.failed, reasons: reasons };
            return { outcome: 'not-assessed', label: OUTCOMES['not-assessed'], reasons: reasons };
        }
        if (coverage.outcome === 'failed') reasons.push(coverage.counts.critical + ' coverage gap(s).');
        // The same judgement the Ready gate makes, so the printed status and
        // the gate can never disagree. A critical issue the auditor has
        // dispositioned (recorded justification) no longer fails the
        // checklist; anything else the gate would block needs a decision.
        const gate = readiness(checklist || {}, { qa: qa || undefined, coverage: coverage });
        const openCritical = gate.blockers.filter(function (b) { return b.severity === 'critical'; });
        const dispositionedOnly = (qaCritical || coverage.outcome === 'failed') && !openCritical.length && checklist;
        if ((qaCritical || coverage.outcome === 'failed') && !dispositionedOnly) {
            return { outcome: 'failed', label: OUTCOMES.failed, reasons: reasons };
        }
        if (dispositionedOnly) reasons.push('Every critical issue has a recorded auditor disposition.');
        if (!gate.ready) {
            reasons.push(gate.blockers.length + ' item(s) need an auditor decision before release: '
                + Array.from(new Set(gate.blockers.map(function (b) { return b.label; }))).join('; ') + '.');
            return { outcome: 'review', label: OUTCOMES.review, reasons: reasons };
        }
        const notes = (qa && qa.counts && qa.counts.warning) || coverage.outcome === 'passed-with-notes' || !qa || dispositionedOnly;
        if (notes) return { outcome: 'passed-with-notes', label: OUTCOMES['passed-with-notes'], reasons: reasons };
        return { outcome: 'passed', label: OUTCOMES.passed, reasons: reasons };
    }

    // ── Ready-for-Audit gate ──────────────────────────────────────────

    // Issue codes that must be resolved — not merely acknowledged — before a
    // checklist can be marked ready. Duplicates waste audit time and make the
    // question count meaningless; an item with no clause behind it cannot be
    // defended as a requirement, and a coverage gap means the audit would not
    // do what the certification decision needs it to do.
    const BLOCKING_CODES = {
        DUPLICATE_QUESTION: 'Duplicate question',
        NEAR_DUPLICATE: 'Near-duplicate question',
        IRRELEVANT_REQUIREMENT: 'Question with no clause behind it',
        AUDITOR_REVIEW: 'Item left unmapped for auditor review',
        INVALID_REF: 'Clause reference that does not exist',
        OUT_OF_SCOPE_STANDARD: 'Requirement from a standard outside the audit scope',
        CONTRADICTORY_MAPPING: 'Clause that means different things in the selected standards',
        CYCLE_REQUIREMENT_GAP: 'Requirement audited nowhere in the cycle',
        CYCLE_CONTROL_GAP: 'Annex A control in the pool sampled nowhere in the cycle',
        RISK_CONTROL_GAP: 'Risk-driven control not sampled',
        CYCLE_PROCESS_GAP: 'Critical process audited nowhere in the cycle',
        VALIDATION_UNAVAILABLE: 'Checklist could not be validated',
        COVERAGE_UNAVAILABLE: 'Coverage could not be assessed',
        COVERAGE_NOT_ASSESSED: 'Coverage pass did not run',
        STANDARD_NOT_LINKED: 'Checklist not linked to every standard in the audit scope',
        // QA criticals that used to fall through to "notes" and let a
        // checklist be released with them. They block only when critical
        // (SEVERITY_GATED_CODES): a surveillance rates a missing requirement
        // 'info' and a thin Annex A sample 'warning', which stay notes.
        MISSING_REQUIREMENT: 'Mandatory requirement not covered',
        MISSING_ANNEX_A: 'No Annex A control sampled',
        EXCESSIVE_COUNT: 'More questions than the scope justifies'
    };
    const SEVERITY_GATED_CODES = { MISSING_REQUIREMENT: true, MISSING_ANNEX_A: true, EXCESSIVE_COUNT: true };

    // Cycle gaps are judged over the whole certification cycle. assess() rates
    // them critical only at the audit that closes the cycle (recertification);
    // at a surveillance they are informational — the requirement can still be
    // audited at a later visit — and the gate treats them the way coverage
    // does, as notes, instead of refusing to release every surveillance
    // checklist. RISK_CONTROL_GAP is not here: risk drivers name controls THIS
    // audit must sample, whatever the audit type.
    const CYCLE_GAP_CODES = { CYCLE_REQUIREMENT_GAP: true, CYCLE_CONTROL_GAP: true, CYCLE_PROCESS_GAP: true };

    /**
     * Decide whether a checklist may be marked Ready for Audit.
     *
     * Pure. Callers pass the two validation results rather than having this
     * re-run them, so the gate always judges exactly what the auditor was shown.
     *
     * @param {Object} checklist
     * @param {Object} [opts] - { qa, coverage }  results from ChecklistQA.validate / assess
     * @returns {{ready: boolean, blockers: Array, notes: Array, counts: Object}}
     */
    function readiness(checklist, opts) {
        const o = opts || {};
        const all = arr(o.qa && o.qa.issues).concat(arr(o.coverage && o.coverage.issues));
        const blockers = [];
        const notes = [];
        const resolved = (checklist && checklist.resolvedIssues) || {};

        // A checklist neither pass could run against — no standard in the
        // registry, so no clause set to check it with — must not read as
        // "validated, nothing found". Releasing it is a decision an auditor
        // takes explicitly, by recording why, not one the gate makes by default.
        const qaRan = !!(o.qa && o.qa.issues);
        const coverageRan = !!(o.coverage && arr(o.coverage.issues)
            .every(function (i) { return i.code !== 'COVERAGE_UNAVAILABLE'; }));
        // A caller that asked for coverage (passed the key) and got null: the
        // pass could not run. That is a blocker, not a pass. A caller that did
        // not pass the key is asking only about the QA result and is unaffected.
        if (Object.prototype.hasOwnProperty.call(o, 'coverage') && o.coverage == null && qaRan) {
            all.push({ code: 'COVERAGE_NOT_ASSESSED', severity: 'critical', itemRef: '',
                message: 'The coverage pass did not run, so coverage of the certification cycle has not been assessed.' });
        }
        if (!qaRan && !coverageRan) {
            all.push({
                code: 'VALIDATION_UNAVAILABLE', severity: 'warning', itemRef: '',
                message: 'Neither the QA pass nor the coverage pass could run: this checklist is not tied to a '
                    + 'standard held in the clause registry, so nothing was checked. Release it only on a recorded justification.'
            });
        }

        const list = (!qaRan && !coverageRan) ? all.filter(function (i) { return i.code !== 'COVERAGE_UNAVAILABLE'; }) : all;
        list.forEach(function (i) {
            const label = BLOCKING_CODES[i.code];
            if (!label) { notes.push(i); return; }
            if (CYCLE_GAP_CODES[i.code] && i.severity === 'info') { notes.push(i); return; }
            if (SEVERITY_GATED_CODES[i.code] && i.severity !== 'critical') { notes.push(i); return; }
            // An issue an auditor has explicitly dispositioned — item removed,
            // clause assigned, or a recorded justification — stops blocking.
            const key = i.code + '|' + (i.itemRef || '') + '|' + (i.nearRef || '');
            if (resolved[key]) { notes.push(Object.assign({ resolved: resolved[key] }, i)); return; }
            blockers.push({
                code: i.code, label: label, severity: i.severity,
                detail: i.message, itemRef: i.itemRef || '', key: key,
                // RISK_CONTROL_GAP and CYCLE_CONTROL_GAP name the standard and
                // the exact controls their gap is about (assess() puts them on
                // the issue as `controls` / `missing`). Carried through here,
                // rather than discarded with the rest of the issue, so a
                // caller can offer "add these to the audit" instead of only
                // "record why they're missing" — the other blocker codes carry
                // no controls and these fields are simply absent for them.
                stdId: i.stdId || '',
                controls: i.controls || null,
                missing: i.missing || null
            });
        });

        return {
            ready: blockers.length === 0,
            blockers: blockers,
            notes: notes,
            counts: {
                duplicates: blockers.filter(function (b) { return b.code === 'DUPLICATE_QUESTION' || b.code === 'NEAR_DUPLICATE'; }).length,
                unmapped: blockers.filter(function (b) { return b.code === 'IRRELEVANT_REQUIREMENT' || b.code === 'AUDITOR_REVIEW' || b.code === 'INVALID_REF'; }).length,
                coverage: blockers.filter(function (b) { return b.code.indexOf('CYCLE_') === 0 || b.code === 'RISK_CONTROL_GAP'; }).length
            }
        };
    }

    const API = {
        buildContext: buildContext,
        resolveStandardIds: resolveStandardIds,
        healStandardAssociation: healStandardAssociation,
        combine: combine,
        OUTCOMES: OUTCOMES,
        LIMITATION_CODES: LIMITATION_CODES,
        assess: assess,
        readiness: readiness,
        summarize: summarize,
        riskDrivenControls: riskDrivenControls,
        coverageOf: coverageOf,
        itemKeys: itemKeys,
        executedByChecklist: executedByChecklist,
        isFinalReport: isFinalReport,
        flatten: flatten,
        refsInText: refsInText,
        docText: docText,
        DRIVERS: DRIVERS,
        BLOCKING_CODES: BLOCKING_CODES
    };
    global.ChecklistCoverage = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger) global.Logger.debug('Modules', 'checklist-coverage.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

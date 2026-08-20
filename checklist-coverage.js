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
// changes recorded for this audit, incidents (complaints/appeals) raised in
// the cycle, and previous audit results (the NCR/CAPA register). A driver with
// no data behind it is reported as unavailable rather than assumed — an
// invented driver is worse than a missing one, because it reads as evidence.
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
     * Every `stdId::ref` a checklist tests, plus the free text it tests them
     * with (used for process matching).
     *
     * @returns {{refs: Object, text: string}} refs is a plain-object set
     */
    function coverageOf(checklist, standardIds) {
        const ids = arr(standardIds);
        const refs = Object.create(null);
        const parts = [];
        flatten(checklist).forEach(function (it) {
            parts.push(it.title, it.requirement);
            arr(it.refs).forEach(function (r) { refs[refKey(r.stdId, r.ref)] = true; });
            const qa = QA();
            const pseudo = qa && typeof qa.isPseudoRef === 'function'
                ? qa.isPseudoRef(it.clause)
                : !str(it.clause).trim();
            if (!pseudo) ids.forEach(function (id) { refs[refKey(id, it.clause)] = true; });
        });
        return { refs: refs, text: parts.join(' \n ') };
    }

    /** True when `ref`, or any sub-clause of it, is covered for that standard. */
    function covers(refs, stdId, ref) {
        if (refs[refKey(stdId, ref)]) return true;
        const prefix = refKey(stdId, ref) + '.';
        return Object.keys(refs).some(function (k) { return k.indexOf(prefix) === 0; });
    }

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

        const standardIds = arr(checklist && checklist.standardIds).length
            ? arr(checklist.standardIds)
            : arr(checklist && checklist.qaContext && checklist.qaContext.standardIds);

        // Cycle window. The programme builder owns the anchor rule (a recorded
        // expiry is only the true cycle end when it is at least 30 months after
        // the anchor — many certificates on file are annual re-issues), so it is
        // used when available rather than re-deriving a second, conflicting rule.
        const now = o.now ? parseDate(o.now) : new Date();
        const plan = o.planId && global.DataService && global.DataService.findAuditPlan
            ? global.DataService.findAuditPlan(o.planId) : null;
        const allReports = arr(state.auditReports);

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
        const anchor = parseDate(cert && (cert.initialDate || cert.issueDate || cert.currentIssue))
            || parseDate(programme && programme.cycleStart)
            || addMonths(now, -36);
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
            return !!rec.client && rec.client === client.name;
        };

        // Prior audits in this cycle, and the checklists they were run against.
        // plan.selectedChecklists is the field the Configure Checklists screen
        // and the execution view both write, so it is the authoritative link
        // between an audit and what it actually covered.
        const plans = arr(state.auditPlans).filter(function (p) {
            return forClient(p) && inCycle(p.startDate || p.date || p.createdAt);
        });
        const priorChecklistIds = {};
        plans.forEach(function (p) {
            if (checklist && o.planId && String(p.id) === String(o.planId)) return;
            arr(p.selectedChecklists).forEach(function (cid) { priorChecklistIds[String(cid)] = true; });
        });
        const priorChecklists = arr(state.checklists).filter(function (c) {
            return c && String(c.id) !== String(checklist && checklist.id) && priorChecklistIds[String(c.id)];
        });

        // Previous results: the CAPA register is the real store of findings,
        // joined to an audit by auditId -> planId.
        const planIds = {};
        plans.forEach(function (p) { planIds[String(p.id)] = true; });
        const findings = arr(state.ncrs).filter(function (n) {
            if (!n) return false;
            if (n.auditId != null && planIds[String(n.auditId)]) return true;
            return forClient(n) && inCycle(n.raisedDate || n.dateRaised || n.createdAt || n.date);
        });

        const incidents = arr(state.complaints).concat(arr(state.appeals)).filter(function (r) {
            return r && forClient(r) && inCycle(r.dateReceived || r.date || r.createdAt);
        });

        const docs = arr(client && client.documents).filter(function (d) { return d && d.name; });
        const riskDocs = docs.filter(function (d) {
            return RISK_DOC.test(str(d.name) + ' ' + str(d.category) + ' ' + str(d.summary));
        });

        const focusPoints = arr(plan && plan.preAudit && plan.preAudit.focusPoints);
        const changes = focusPoints.filter(function (f) {
            return CHANGE_WORDS.test(str(typeof f === 'string' ? f : (f.text || f.point || f.title)));
        }).map(function (f) { return str(typeof f === 'string' ? f : (f.text || f.point || f.title)); });

        return {
            standardIds: standardIds,
            auditType: (checklist && checklist.auditType) || (plan && plan.auditType) || '',
            soaApplicable: arr(o.soaApplicable).length
                ? arr(o.soaApplicable)
                : arr(checklist && checklist.qaContext && checklist.qaContext.soaApplicable),
            client: client,
            cycle: {
                start: anchor.toISOString().slice(0, 10),
                end: cycleEnd.toISOString().slice(0, 10),
                anchored: (programme && programme.anchored) || (cert ? 'certificate' : 'assumed'),
                stages: arr(programme && programme.stages),
                issues: arr(programme && programme.issues)
            },
            priorAudits: plans.map(function (p) {
                return {
                    id: p.id, date: p.startDate || p.date || p.createdAt || '',
                    type: p.auditType || p.type || '', checklists: arr(p.selectedChecklists).length
                };
            }),
            priorChecklists: priorChecklists,
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
            riskDocs: riskDocs.map(function (d) { return { name: d.name, summary: str(d.summary) }; })
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

        const here = coverageOf(checklist, ids);
        const cycleRefs = Object.assign(Object.create(null), here.refs);
        let cycleText = here.text;
        arr(c.priorChecklists).forEach(function (prior) {
            const cov = coverageOf(prior, arr(prior.standardIds).length ? prior.standardIds : ids);
            Object.keys(cov.refs).forEach(function (k) { cycleRefs[k] = true; });
            cycleText += ' \n ' + cov.text;
        });

        const coverage = {
            cycle: {
                start: c.cycle && c.cycle.start, end: c.cycle && c.cycle.end,
                anchored: c.cycle && c.cycle.anchored,
                priorAudits: arr(c.priorAudits).length,
                priorChecklists: arr(c.priorChecklists).length
            },
            clauses: [], controls: [], processes: { total: 0, covered: 0, gaps: [] }
        };

        if (!Std || !ids.length) {
            issues.push(issue('COVERAGE_UNAVAILABLE', 'info',
                'Coverage could not be assessed: this checklist is not tied to a standard in the clause registry.'));
            return finish(issues, coverage);
        }

        // ── 1. Requirements of the standards, over the cycle ──────────
        ids.forEach(function (id) {
            const std = Std.byId(id);
            if (!std) return;
            const mandatory = arr(std.clauses).filter(function (cl) { return cl.mandatory; });
            const missHere = mandatory.filter(function (cl) { return !covers(here.refs, id, cl.ref); });
            const missCycle = mandatory.filter(function (cl) { return !covers(cycleRefs, id, cl.ref); });
            coverage.clauses.push({
                stdId: id, label: std.label, total: mandatory.length,
                thisAudit: mandatory.length - missHere.length,
                cycle: mandatory.length - missCycle.length,
                gaps: missCycle.map(function (m) { return m.ref; })
            });
            if (missCycle.length) {
                issues.push(issue('CYCLE_REQUIREMENT_GAP', gapSeverity,
                    std.label + ': ' + missCycle.length + ' requirement(s) audited nowhere in this certification cycle — '
                    + missCycle.slice(0, 8).map(function (m) { return m.ref; }).join(', ')
                    + (missCycle.length > 8 ? '…' : '') + '.',
                    { stdId: id, missing: missCycle.map(function (m) { return m.ref; }) }));
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

            coverage.controls.push({
                stdId: id, label: std.label, pool: sel.pool.length, soaDriven: sel.soaDriven,
                required: sel.required.length, thisAudit: sampledHere.length, cycle: sampledCycle.length,
                neverSampled: neverSampled.map(function (ct) { return ct.ref; }),
                driversUsed: sel.driversUsed, driversMissing: sel.driversMissing
            });

            if (!sel.soaDriven) {
                issues.push(issue('SOA_NOT_SUPPLIED', 'warning',
                    std.label + ': no Statement of Applicability was supplied, so the applicable set is assumed to be the '
                    + sel.pool.length + ' controls prioritised for this scope. Paste the SoA references to make the sample defensible.',
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
                    + ' applicable Annex A control(s) were sampled at no audit in this cycle — '
                    + neverSampled.slice(0, 10).map(function (ct) { return ct.ref; }).join(', ')
                    + (neverSampled.length > 10 ? '…' : '')
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
        const haystack = lower(cycleText);
        const gaps = processes.filter(function (p) {
            const name = lower(p.name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!name) return false;
            if (haystack.indexOf(name) !== -1) return false;
            // A multi-word process name still counts as covered when the words
            // that carry its meaning all appear — "Order to Cash" vs "order-to-cash".
            const words = name.split(' ').filter(function (w) { return w.length > 3; });
            return !(words.length && words.every(function (w) { return haystack.indexOf(w) !== -1; }));
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
        return {
            ok: counts.critical === 0 && counts.warning === 0,
            blocking: counts.critical > 0,
            counts: counts, issues: issues, coverage: coverage
        };
    }

    /** One-line summary for a toast or a print banner. */
    function summarize(result) {
        if (!result) return '';
        const c = result.counts || {};
        if (!c.critical && !c.warning) {
            return c.info
                ? 'Coverage validated over the certification cycle — ' + c.info + ' note(s).'
                : 'Coverage validated over the certification cycle — no gaps.';
        }
        const bits = [];
        if (c.critical) bits.push(c.critical + ' gap' + (c.critical > 1 ? 's' : ''));
        if (c.warning) bits.push(c.warning + ' warning' + (c.warning > 1 ? 's' : ''));
        if (c.info) bits.push(c.info + ' note' + (c.info > 1 ? 's' : ''));
        return 'Cycle coverage: ' + bits.join(', ') + '.';
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
        CYCLE_CONTROL_GAP: 'Applicable control sampled nowhere in the cycle',
        RISK_CONTROL_GAP: 'Risk-driven control not sampled',
        CYCLE_PROCESS_GAP: 'Critical process audited nowhere in the cycle',
        VALIDATION_UNAVAILABLE: 'Checklist could not be validated'
    };

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
        if (!qaRan && !coverageRan) {
            all.push({
                code: 'VALIDATION_UNAVAILABLE', severity: 'warning', itemRef: '',
                message: 'Neither the QA pass nor the coverage pass could run: this checklist is not tied to a '
                    + 'standard held in the clause registry, so nothing was checked. Release it only on a recorded justification.'
            });
        }

        all.forEach(function (i) {
            const label = BLOCKING_CODES[i.code];
            if (!label) { notes.push(i); return; }
            // An issue an auditor has explicitly dispositioned — item removed,
            // clause assigned, or a recorded justification — stops blocking.
            const key = i.code + '|' + (i.itemRef || '') + '|' + (i.nearRef || '');
            if (resolved[key]) { notes.push(Object.assign({ resolved: resolved[key] }, i)); return; }
            blockers.push({
                code: i.code, label: label, severity: i.severity,
                detail: i.message, itemRef: i.itemRef || '', key: key
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
        assess: assess,
        readiness: readiness,
        summarize: summarize,
        riskDrivenControls: riskDrivenControls,
        coverageOf: coverageOf,
        flatten: flatten,
        DRIVERS: DRIVERS,
        BLOCKING_CODES: BLOCKING_CODES
    };
    global.ChecklistCoverage = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger) global.Logger.debug('Modules', 'checklist-coverage.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================
// AUDIT PLAN INTEGRITY  (window.AuditPlanIntegrity)
// ============================================
// Builds, traces and gates an audit plan. Pure — no DOM, no window.state — so
// the same code runs in the app, in the tests and in the PDF QA run.
//
// WHAT WAS WRONG (PC CONNECTION recertification plan, 3-5 November 2026)
// ---------------------------------------------------------------------
// The agenda was written by a language model and stored as free text:
//   * clause labels were invented ("8.16 Information security incident
//     management", "8.15 Change management", ISO 22301 "8.2/8.3/8.4" with the
//     wrong titles) because nothing tied a row to the clause registry;
//   * the auditor column was a <select> whose values were "All", each auditor
//     NAME, or "Other". The prompt taught the model to answer "All Team"; that
//     matched no option, the browser fell through to the one it could select
//     ("Other"), and every row saved as "Other";
//   * "Audit Team: None" was the `|| 'None'` fallback for a team of one;
//   * previous findings came from `checklistProgress` items with status 'nc'
//     only, capped at 20 — not from the NC register — and were "scheduled" by
//     whatever the model chose to write, with nothing checking that every
//     finding landed in a session;
//   * a catch-all "Management system clauses and operational controls" row was
//     appended after the closing meeting, untimed;
//   * lunch counted toward audit time, and no allocation was reconciled with
//     the approved duration.
//
// HOW IT WORKS NOW
// ----------------
// The agenda is BUILT from a controlled template whose every clause reference
// is resolved through ChecklistStandards (the clause registry) — a label can
// only be one the registry holds, with the registry's own title. Each session
// carries a traceability record (standard, clauses, checklist questions,
// previous findings, processes, auditee, auditor). `validate()` is the single
// gate: it returns specific, row-level blockers for everything Part D lists.
//
// CONTRACT (see the sections below)
//   registry      clauseLabel, refTitle, compressRefs, describeStandards, scanFreeText
//   auditors      resolveAuditors, auditTeamLabel
//   findings      collectPreviousFindings, mapFindings
//   agenda        buildAgenda
//   duration      buildDurationRecord, reconcileDuration
//   scope         checkScope
//   narratives    buildNarratives, checkNarratives
//   gate          validate, STATUSES, canTransition, contentHash

(function (global) {
    'use strict';

    const need = function (name, file) {
        return global[name] || (typeof require === 'function' ? require(file) : null);
    };
    const CS = function () { return need('ChecklistStandards', './checklist-standards.js'); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const FW = function () { return need('FindingWorkflow', './finding-workflow.js'); };

    function str(v) { return String(v == null ? '' : v).trim(); }
    function lower(v) { return str(v).toLowerCase(); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    function uniq(list) { return Array.from(new Set(list)); }
    function norm(v) { return lower(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

    // ═════════════════════════════════════════════════════════════════
    // 1. CONTROLLED CLAUSE LABELS
    // ═════════════════════════════════════════════════════════════════
    // Short forms are part of the controlled registry: a fixed key printed on
    // the agenda, never free text.
    const STD_SHORT = { iso27001: '27001', iso22301: '22301', iso20000: '20000-1' };

    function stdLabel(stdId) { const s = CS().byId(stdId); return s ? s.label : ''; }
    function shortLabel(stdId) { return STD_SHORT[stdId] || stdId; }

    function refTitle(stdId, ref) {
        const hit = CS().lookupRef([stdId], ref)[0];
        return hit ? hit.title : '';
    }

    /**
     * The full label for one requirement — "ISO/IEC 27001:2022 A.5.24 Information
     * security incident management planning and preparation" — or null when the
     * registry does not hold it. There is no other way to obtain a label.
     */
    function clauseLabel(stdId, ref) {
        if (!CS().isKnownRef(stdId, ref)) return null;
        return { stdId: stdId, ref: ref, title: refTitle(stdId, ref), label: stdLabel(stdId) + ' ' + ref + ' ' + refTitle(stdId, ref) };
    }

    function refParts(ref) {
        const annex = /^A\./.test(ref);
        const nums = String(ref).replace(/^A\./, '').split('.').map(Number);
        return { annex: annex, nums: nums };
    }
    function compareRefs(a, b) {
        const pa = refParts(a); const pb = refParts(b);
        if (pa.annex !== pb.annex) return pa.annex ? 1 : -1;
        for (let i = 0; i < Math.max(pa.nums.length, pb.nums.length); i++) {
            const d = (pa.nums[i] || 0) - (pb.nums[i] || 0);
            if (d) return d;
        }
        return 0;
    }

    /**
     * "A.5.24, A.5.25, A.5.26, A.5.27, A.5.28, A.6.8" -> "A.5.24–A.5.28, A.6.8".
     * Ranges are only ever built from consecutive refs of the same parent, and
     * both ends keep the A. prefix.
     */
    function compressRefs(refs) {
        const sorted = uniq(arr(refs).map(str).filter(Boolean)).sort(compareRefs);
        const out = [];
        let i = 0;
        while (i < sorted.length) {
            let j = i;
            while (j + 1 < sorted.length && consecutive(sorted[j], sorted[j + 1])) j++;
            if (j - i >= 2) out.push(sorted[i] + '–' + sorted[j]);
            else for (let k = i; k <= j; k++) out.push(sorted[k]);
            i = j + 1;
        }
        return out.join(', ');
    }
    function consecutive(a, b) {
        const pa = refParts(a); const pb = refParts(b);
        if (pa.annex !== pb.annex || pa.nums.length !== pb.nums.length) return false;
        for (let i = 0; i < pa.nums.length - 1; i++) if (pa.nums[i] !== pb.nums[i]) return false;
        return pb.nums[pb.nums.length - 1] - pa.nums[pa.nums.length - 1] === 1;
    }

    /**
     * How a session's requirements are shown: standards that share an identical
     * reference list are grouped on one line, otherwise one line per standard.
     * @param {Array<{stdId, refs}>} entries
     * @returns {Array<{standards: string[], text: string}>} e.g. [{standards:['27001','22301'], text:'4.1, 4.2'}]
     */
    function describeStandards(entries, opts) {
        const max = (opts && opts.maxRefs) || 0;
        const byText = new Map();
        arr(entries).filter(function (e) { return e && arr(e.refs).length; }).forEach(function (e) {
            let refs = uniq(e.refs).sort(compareRefs);
            let text = compressRefs(refs);
            if (max && refs.length > max) {
                text = compressRefs(refs.slice(0, max)) + ' … +' + (refs.length - max) + ' per the audit checklist';
            }
            const key = text;
            if (!byText.has(key)) byText.set(key, { standards: [], text: text });
            byText.get(key).standards.push(shortLabel(e.stdId));
        });
        return Array.from(byText.values());
    }

    /**
     * Find clause mentions in FREE TEXT (a legacy or hand-typed agenda row) and
     * check each against the registry. This is what would have caught
     * "8.16 Information security incident management (ISO 27001:2022)".
     * @returns {Array<{text, ref, stdId, code, message}>} problems only
     */
    function scanFreeText(text, scopeIds) {
        const s = str(text);
        const problems = [];
        const ids = arr(scopeIds).length ? scopeIds : ['iso27001', 'iso22301', 'iso20000'];
        // "<ref> <Title...> (<standard hint>)" — ref at the start of the text.
        const m = s.match(/^\s*(A\.\d+\.\d+|\d{1,2}(?:\.\d{1,2}){0,2})\s+([^()\n]+?)\s*(?:\(([^)]*)\))?\s*$/);
        if (!m) return problems;
        const ref = m[1]; const title = str(m[2]); const hint = str(m[3]);
        let stdIds = ids;
        if (/27001/.test(hint)) stdIds = ['iso27001'];
        else if (/22301/.test(hint)) stdIds = ['iso22301'];
        else if (/20000/.test(hint)) stdIds = ['iso20000'];
        const known = stdIds.filter(function (id) { return CS().isKnownRef(id, ref); });
        if (!known.length) {
            problems.push({ text: s, ref: ref, stdId: stdIds[0], code: 'INVALID_CLAUSE',
                message: '"' + ref + '" is not a clause or control of ' + stdIds.map(stdLabel).join(' / ') + '.' });
            return problems;
        }
        const tokens = function (x) { return new Set(norm(x).split(' ').filter(function (w) { return w.length > 3; })); };
        const wanted = tokens(title);
        const best = known.map(function (id) {
            const have = tokens(refTitle(id, ref));
            let inter = 0; wanted.forEach(function (w) { if (have.has(w)) inter++; });
            // Precision: how much of what the row SAYS the registry title also says.
            // An abbreviated correct label ("Incident management") scores 1; a title
            // that borrows a couple of the standard's generic words ("Business
            // continuity plans and procedures" against 8.3, "Business continuity
            // strategies and solutions") does not clear one half.
            return { id: id, score: wanted.size ? inter / wanted.size : 1, title: refTitle(id, ref) };
        }).sort(function (a, b) { return b.score - a.score; })[0];
        if (best.score <= 0.5) {
            problems.push({ text: s, ref: ref, stdId: best.id, code: 'CLAUSE_TITLE_MISMATCH',
                message: '"' + ref + '" in ' + stdLabel(best.id) + ' is "' + best.title + '", not "' + title + '".' });
        }
        return problems;
    }

    // ═════════════════════════════════════════════════════════════════
    // 2. ASSIGNED AUDITORS
    // ═════════════════════════════════════════════════════════════════
    const PLACEHOLDER_AUDITOR = /^(?:|other|none|tbd|tba|n\/a|na|null|undefined|unknown|unassigned|to be confirmed|to be determined|-|—|–)$/i;
    function isPlaceholderAuditor(v) { return PLACEHOLDER_AUDITOR.test(str(v)); }

    /**
     * Resolve the people on the plan to auditor RECORDS. A name that does not
     * resolve is reported, never printed as if it did.
     * @param {Object} plan  { team:[names, lead first], auditorIds? }
     * @param {Array} auditors  state.auditors
     * @returns {{assigned:Array, lead:Object|null, issues:Array}}
     */
    function resolveAuditors(plan, auditors) {
        const list = arr(auditors);
        const names = arr(plan && plan.team).map(str).filter(Boolean);
        const ids = arr(plan && plan.auditorIds).map(str);
        const assigned = [];
        const issues = [];
        names.forEach(function (name, i) {
            let rec = null;
            if (ids[i]) rec = list.find(function (a) { return str(a.id) === ids[i]; }) || null;
            if (!rec) rec = list.find(function (a) { return lower(a.name) === lower(name); }) || null;
            if (!rec) {
                issues.push({ code: 'AUDITOR_UNRESOLVED', name: name, message: 'Auditor "' + name + '" does not match any auditor record.' });
                assigned.push({ id: null, name: name, role: i === 0 ? 'Lead Auditor' : 'Auditor', record: null, resolved: false });
            } else {
                assigned.push({ id: str(rec.id), name: str(rec.name), role: i === 0 ? 'Lead Auditor' : (rec.role || 'Auditor'), record: rec, resolved: true });
            }
        });
        if (!assigned.length) issues.push({ code: 'AUDITOR_MISSING', message: 'No Lead Auditor is assigned to the plan.' });
        return { assigned: assigned, lead: assigned[0] || null, issues: issues };
    }

    /** The value printed for "Audit Team". Never "None". */
    function auditTeamLabel(assigned) {
        const team = arr(assigned);
        if (team.length <= 1) return 'Lead Auditor only';
        return team.slice(1).map(function (a) { return a.name + (a.role && a.role !== 'Auditor' ? ' (' + a.role + ')' : ''); }).join(', ');
    }

    // ═════════════════════════════════════════════════════════════════
    // 3. PREVIOUS FINDINGS
    // ═════════════════════════════════════════════════════════════════
    function sameClient(rec, client) {
        if (!rec || !client) return false;
        if (rec.clientId != null && client.id != null) return String(rec.clientId) === String(client.id);
        const n = lower(rec.client || rec.clientName);
        return !!n && n === lower(client.name);
    }

    function standardsOfFinding(f, scopeIds) {
        const text = [f.standards, f.standard].flat().filter(Boolean).join(', ');
        const resolved = text ? CS().resolve(text).standards.map(function (s) { return s.id; }) : [];
        const clause = str(f.clause);
        if (resolved.length) return resolved.filter(function (id) { return scopeIds.indexOf(id) !== -1; });
        // No standard recorded: an Annex A control can only be ISO/IEC 27001;
        // anything else is an integrated finding against all standards in scope.
        if (/^A\./.test(clause)) return scopeIds.indexOf('iso27001') !== -1 ? ['iso27001'] : [];
        return scopeIds.slice();
    }

    /**
     * Every previous finding relevant to this plan, from the AUTHORITATIVE
     * sources: the NC register (state.ncrs), then findings recorded on prior
     * audit reports that the register does not already hold. Observations and
     * opportunities for improvement are included — they are findings too — and
     * are typed, not flattened into "NC".
     *
     * @param {Object} o { state, client, plan, standards:[ids] }
     * @returns {Array} findings, each {id, ref, clause, type, status, standards[], requiresFollowUp, source, ...}
     */
    function collectPreviousFindings(o) {
        const st = (o && o.state) || {};
        const client = o && o.client;
        const plan = (o && o.plan) || {};
        const scopeIds = arr(o && o.standards);
        const fw = FW();
        const planId = str(plan.id);
        const planStart = plan.date || '';

        const priorPlans = arr(st.auditPlans).filter(function (p) {
            if (!sameClient(p, client) || str(p.id) === planId) return false;
            return !(planStart && p.date && String(p.date) >= String(planStart));
        });
        const priorIds = new Set(priorPlans.map(function (p) { return str(p.id); }));

        const out = [];
        const seen = { source: new Set(), text: new Set() };
        const key = function (clause, text) { return norm(clause) + '|' + norm(text).slice(0, 60); };
        const push = function (f) {
            const std = standardsOfFinding(f, scopeIds);
            if (scopeIds.length && !std.length) return;
            const type = fw.normalizeType(f);
            out.push({
                id: str(f.id), ref: str(f.ncrNumber || f.ref || f.id), clause: str(f.clause), type: type,
                typeLabel: (fw.treatment(type) || { label: 'Finding' }).label, severity: str(f.severity || f.ncrType || f.type),
                status: str(f.carStatus || f.status), description: str(f.description || f.finding || f.title),
                raisedDate: str(f.raisedDate || f.date), auditRef: str(f.auditId), standards: std, source: f.__source,
                requiresFollowUp: fw.requiresFollowUp(f), raw: f
            });
        };

        arr(st.ncrs).forEach(function (n) {
            if (!n || !sameClient(n, client)) return;
            if (/^withdrawn/i.test(str(n.status))) return;
            if (str(n.auditId) === planId && planId) return;
            const inPrior = n.auditId != null && priorIds.has(str(n.auditId));
            const noAudit = n.auditId == null || str(n.auditId) === '';
            if (!inPrior && !noAudit) return;
            if (n.sourceChecklistId != null) seen.source.add(str(n.sourceChecklistId) + ':' + str(n.sourceItemIdx));
            seen.text.add(key(n.clause, n.description));
            push(Object.assign({}, n, { __source: 'register' }));
        });

        arr(st.auditReports).forEach(function (r) {
            if (!r || !sameClient(r, client) || !priorIds.has(str(r.planId))) return;
            arr(r.checklistProgress).forEach(function (item, idx) {
                if (!item || item.status !== 'nc') return;
                const clause = item.criterionRef || item.clauseRef || item.clause || '';
                const desc = item.ncrDescription || item.comment || item.requirement || '';
                if (item.checklistId != null && seen.source.has(str(item.checklistId) + ':' + str(item.itemIdx))) return;
                if (seen.text.has(key(clause, desc))) return;
                seen.text.add(key(clause, desc));
                push({ id: r.id + ':' + (item.checklistId || '') + ':' + (item.itemIdx != null ? item.itemIdx : idx), clause: clause,
                    ncrType: item.ncrType, type: item.ncrType, description: desc, auditId: r.planId, raisedDate: r.date, status: item.ncrStatus || 'Open', __source: 'report-checklist' });
            });
            arr(r.findings).forEach(function (f, idx) {
                if (!f) return;
                const desc = f.description || '';
                if (seen.text.has(key(f.clause, desc))) return;
                seen.text.add(key(f.clause, desc));
                push(Object.assign({}, f, { id: f.id != null ? f.id : r.id + ':f' + idx, auditId: r.planId, raisedDate: f.date || r.date, __source: 'report-finding' }));
            });
        });
        return out;
    }

    // ═════════════════════════════════════════════════════════════════
    // 4. THE AGENDA TEMPLATE
    // ═════════════════════════════════════════════════════════════════
    // Every clause reference below is resolved through the registry at build
    // time (`shared` keys resolve to each standard's OWN clause number; explicit
    // `std` refs are validated). A reference the registry does not hold is a
    // template defect and fails the build test, it is never printed.
    const S = { // registry shared-concept keys (checklist-standards.js SHARED)
        ISSUES: 'context.issues', PARTIES: 'context.parties', SCOPE: 'context.scope', SYSTEM: 'context.system',
        COMMIT: 'leadership.commitment', POLICY: 'leadership.policy', ROLES: 'leadership.roles',
        RISK: 'planning.risk-actions', OBJ: 'planning.objectives', CHANGES: 'planning.changes',
        RES: 'support.resources', COMP: 'support.competence', AWARE: 'support.awareness', COMM: 'support.communication', DOC: 'support.documented-information',
        OPS: 'operation.planning-and-control', MON: 'performance.monitoring', IA: 'performance.internal-audit', MR: 'performance.management-review',
        NC: 'improvement.nonconformity-corrective-action', CI: 'improvement.continual'
    };

    const SM = { top: 'Top management', risk: 'Risk owner', support: 'Support functions', isms: 'Information security management',
        bcm: 'Business continuity management', sms: 'Service management', ops: 'Service operations', ci: 'Continual improvement' };

    // hours: productive auditor time. Sum = 24 h = 3 auditor-days at 8 h/day
    // for a three-standard recertification; the builder rescales for other
    // scopes/durations and the reconciliation proves the result.
    // `std` lists explicit refs per standard; `shared` adds each standard's own
    // clause for those concepts. `for` restricts a block to standards in scope.
    const BLOCKS = [
        { id: 'opening', kind: 'opening', title: 'Opening meeting', hours: 0.5, fixed: 'start', auditee: SM.top,
          subject: 'Introductions; confirmation of audit objectives, scope, criteria, plan, methodology and communication channels; availability of resources and people.' },
        { id: 'cycle-review', title: 'Recertification review: changes since the previous audit, continued relevance of the scope, and objectives and performance over the certification cycle', hours: 1.0, auditee: SM.top,
          shared: [S.SCOPE, S.CHANGES, S.MON], priorities: ['changes', 'scope', 'objectives-performance'] },
        { id: 'context-leadership', title: 'Context and interested parties; leadership, policy, roles and responsibilities', hours: 1.5, auditee: SM.top,
          shared: [S.ISSUES, S.PARTIES, S.SYSTEM, S.COMMIT, S.POLICY, S.ROLES], priorities: ['context', 'scope-and-interaction', 'leadership'] },
        { id: 'planning', title: 'Risks, opportunities and objectives', hours: 1.0, auditee: SM.risk,
          shared: [S.RISK, S.OBJ], priorities: ['risks-objectives'] },
        { id: 'support', title: 'Resources, competence, awareness, communication and documented information', hours: 1.0, auditee: SM.support,
          shared: [S.RES, S.COMP, S.AWARE, S.COMM, S.DOC], std: { iso20000: ['7.6'] }, priorities: ['support'] },
        { id: 'isms-risk-soa', title: 'Information security risk assessment and treatment; Statement of Applicability; risk-based Annex A sampling', hours: 1.25, auditee: SM.isms,
          std: { iso27001: ['6.1.2', '6.1.3', '8.2', '8.3'], iso20000: ['8.7.3'] }, annexA: true, priorities: ['isms-risk', 'soa', 'annex-a'] },
        { id: 'access-supplier-cloud', title: 'Access lifecycle; supplier and cloud-service security', hours: 1.0, auditee: SM.isms,
          std: { iso27001: ['A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.6.1', 'A.6.5', 'A.8.2', 'A.8.5', 'A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.5.23', 'A.6.6'] },
          processes: ['Cloud Services Operations'], priorities: ['access', 'supplier-cloud'] },
        { id: 'core-onboarding-design', title: 'Operational planning and control: core process sampling — client onboarding; assessment and design tools', hours: 0.75, auditee: SM.ops,
          shared: [S.OPS], processes: ['Client Onboarding', 'Assessment And Design Tools'], priorities: ['core-processes'] },
        { id: 'vuln-crypto', title: 'Vulnerability and patch management; cryptography and secure configuration', hours: 1.0, auditee: SM.isms,
          std: { iso27001: ['A.8.8', 'A.5.7', 'A.8.9', 'A.8.24', 'A.8.20'] }, processes: ['Patch & Vulnerability Management'], priorities: ['vuln', 'crypto'] },
        { id: 'incident', title: 'Security incident management; service desk, incident and service request management', hours: 1.25, auditee: SM.ops,
          std: { iso27001: ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.6.8'], iso20000: ['8.6.1', '8.6.2'] },
          processes: ['Service Desk Operations', 'Incident Management'], priorities: ['incident'] },
        { id: 'backup-logging', title: 'Backup, logging and monitoring; backup and recovery operations', hours: 1.0, auditee: SM.isms,
          std: { iso27001: ['A.8.13', 'A.8.14', 'A.8.15', 'A.8.16'] }, processes: ['Backup & Recovery Operations'], priorities: ['backup-logging-monitoring'] },
        { id: 'problem', title: 'Problem management', hours: 0.75, auditee: SM.ops,
          std: { iso20000: ['8.6.3'] }, processes: ['Problem Management'], priorities: ['problem'] },
        { id: 'bcms-bia-risk', title: 'Business impact analysis; business continuity risk assessment', hours: 1.0, auditee: SM.bcm,
          std: { iso22301: ['8.2.2', '8.2.3'] }, processes: ['Business Continuity & Disaster Recovery'], priorities: ['bia', 'bc-risk'] },
        { id: 'bcms-strategy-plans', title: 'Business continuity strategies and solutions; continuity plans and response structure', hours: 1.0, auditee: SM.bcm,
          std: { iso22301: ['8.3', '8.4', '8.4.2', '8.4.3'] }, processes: ['Business Continuity & Disaster Recovery'], priorities: ['bc-strategies', 'bc-plans'] },
        { id: 'bcms-exercise', title: 'Exercise programme; evaluation of continuity documentation and capabilities; actual disruptions or invocations, where applicable', hours: 1.0, auditee: SM.bcm,
          std: { iso22301: ['8.5', '8.6'] }, priorities: ['bc-exercise', 'bc-evaluation', 'bc-disruptions'] },
        { id: 'sms-continuity-capacity', title: 'Service continuity, availability, capacity and demand management', hours: 1.0, auditee: SM.sms,
          std: { iso20000: ['8.7.2', '8.7.1', '8.4.3', '8.4.2'] }, priorities: ['service-continuity', 'demand-capacity-availability'] },
        { id: 'sms-catalogue-slm-brm', title: 'Service catalogue and service levels; business relationships and customer satisfaction; service delivery and planning', hours: 1.0, auditee: SM.sms,
          std: { iso20000: ['8.2.4', '8.3.3', '8.3.2', '8.2.1', '8.2.2'] }, priorities: ['catalogue-sla', 'brm'] },
        { id: 'sms-supplier-cloud', title: 'Supplier management and control of parties in the service lifecycle; cloud services operations', hours: 0.75, auditee: SM.ops,
          std: { iso20000: ['8.3.4', '8.2.3'] }, processes: ['Cloud Services Operations'], priorities: ['supplier-management'] },
        { id: 'sms-change-release-config', title: 'Change management; release and deployment; service design and transition; configuration and asset management', hours: 1.25, auditee: SM.ops,
          std: { iso20000: ['8.5.1', '8.5.3', '8.5.2', '8.2.5', '8.2.6'] }, processes: ['Change Management', 'Configuration and Change Management'], priorities: ['change', 'release', 'config-asset'] },
        { id: 'sms-reporting-budget', title: 'Service reporting; performance monitoring and reporting; service budgeting and accounting, where applicable', hours: 1.0, auditee: SM.sms,
          std: { iso20000: ['9.4', '8.4.1'] }, processes: ['Performance Monitoring & Reporting'], priorities: ['service-reporting', 'budgeting'] },
        { id: 'internal-audit', title: 'Internal audit programme', hours: 0.75, auditee: SM.risk, shared: [S.IA], priorities: ['internal-audit'] },
        { id: 'management-review', title: 'Management review', hours: 0.75, auditee: SM.top, shared: [S.MR], priorities: ['management-review'] },
        { id: 'improvement', title: 'Nonconformity and corrective action, including effectiveness of corrective action; continual improvement; overall effectiveness of the integrated management system', hours: 1.0, auditee: SM.ci,
          shared: [S.NC, S.CI], processes: ['Continual Improvement and Process Optimization'], priorities: ['nc-effectiveness', 'continual-improvement', 'ims-effectiveness'] },
        { id: 'consolidation', kind: 'consolidation', title: 'Auditor consolidation: review of objective evidence, finalization of findings, preparation of audit conclusions and closing-meeting preparation', hours: 0.75, fixed: 'end-1', auditee: 'Audit team only — no auditee interviews',
          subject: 'Audit team only; no auditee interviews.' },
        { id: 'closing', kind: 'closing', title: 'Closing meeting', hours: 0.75, fixed: 'end', auditee: SM.top,
          subject: 'Presentation of audit findings and conclusions; agreement of the way forward, including timescales for responding to any nonconformities.' }
    ];

    // What the agenda must visibly cover on a recertification. `any` = a block
    // id or a ref must appear. Used by validate() as a coverage self-check.
    const REQUIRED_COVERAGE = [
        ['Changes since the previous audit', ['cycle-review']], ['Continued relevance of the scope', ['cycle-review']],
        ['Objectives and performance over the certification cycle', ['cycle-review']],
        ['Previous findings and corrective-action effectiveness for nonconformities', ['improvement']],
        ['Internal audit programme', ['internal-audit']], ['Management review', ['management-review']],
        ['Continual improvement and overall effectiveness of the integrated management system', ['improvement']],
        ['Context and interested parties', ['context-leadership']], ['Leadership, policies and responsibilities', ['context-leadership']],
        ['Risks, opportunities and objectives', ['planning']], ['Resources, competence and awareness; communication; documented information', ['support']],
        ['Operational planning and control', ['core-onboarding-design']],
        ['ISO/IEC 27001: risk assessment and treatment; Statement of Applicability; Annex A sampling', ['isms-risk-soa'], 'iso27001'],
        ['ISO/IEC 27001: access lifecycle; supplier and cloud-service security', ['access-supplier-cloud'], 'iso27001'],
        ['ISO/IEC 27001: vulnerability and patch management; cryptography and secure configuration', ['vuln-crypto'], 'iso27001'],
        ['ISO/IEC 27001: security incident management', ['incident'], 'iso27001'],
        ['ISO/IEC 27001: backup, logging and monitoring', ['backup-logging'], 'iso27001'],
        ['ISO 22301: BIA and business continuity risk assessment', ['bcms-bia-risk'], 'iso22301'],
        ['ISO 22301: strategies, solutions, plans and response structure', ['bcms-strategy-plans'], 'iso22301'],
        ['ISO 22301: exercise programme, evaluation and actual disruptions', ['bcms-exercise'], 'iso22301'],
        ['ISO/IEC 20000-1: service catalogue, service levels, business relationships', ['sms-catalogue-slm-brm'], 'iso20000'],
        ['ISO/IEC 20000-1: incident and service request management', ['incident'], 'iso20000'],
        ['ISO/IEC 20000-1: problem management', ['problem'], 'iso20000'],
        ['ISO/IEC 20000-1: supplier management', ['sms-supplier-cloud'], 'iso20000'],
        ['ISO/IEC 20000-1: demand, capacity, availability and service continuity', ['sms-continuity-capacity'], 'iso20000'],
        ['ISO/IEC 20000-1: change, release and deployment; configuration and asset management', ['sms-change-release-config'], 'iso20000'],
        ['ISO/IEC 20000-1: service reporting and budgeting', ['sms-reporting-budget'], 'iso20000']
    ];

    const CORE_PROCESSES = ['Client Onboarding', 'Assessment And Design Tools', 'Service Desk Operations', 'Incident Management', 'Problem Management',
        'Change Management', 'Cloud Services Operations', 'Patch & Vulnerability Management', 'Backup & Recovery Operations',
        'Performance Monitoring & Reporting', 'Continual Improvement and Process Optimization'];

    /** Resolve a block's requirements against the registry for the standards in scope. */
    function resolveBlockRefs(block, scopeIds, annexRefs) {
        const out = [];
        scopeIds.forEach(function (id) {
            let refs = arr(block.std && block.std[id]).slice();
            arr(block.shared).forEach(function (key) {
                CS().clausesFor([id]).filter(function (c) { return c.shared === key; }).forEach(function (c) { refs.push(c.ref); });
            });
            if (block.annexA && id === 'iso27001') refs = refs.concat(annexRefs || []);
            refs = uniq(refs);
            const invalid = refs.filter(function (r) { return !CS().isKnownRef(id, r); });
            if (invalid.length) throw new Error('Agenda template "' + block.id + '" cites ' + invalid.join(', ') + ' which ' + stdLabel(id) + ' does not contain.');
            if (refs.length) out.push({ stdId: id, refs: refs.sort(compareRefs) });
        });
        return out;
    }

    function hhmm(min) { const h = Math.floor(min / 60); const m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
    function toMin(hhmmStr) { const m = String(hhmmStr).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }

    /**
     * Build the agenda, its traceability and the previous-finding map.
     *
     * @param {Object} ctx {
     *   plan: {date,endDate,auditMethod,team,teamAllocations},
     *   standards: [registry ids], finalDays, hoursPerDay=8,
     *   assigned: [{id,name,role}]  (from resolveAuditors),
     *   client: {keyProcesses, contacts, keyPersonnel}, findings: [collectPreviousFindings],
     *   checklist: (optional) for the question map, timeZone: {iana} }
     * @returns {{rows, sessions, traceability, findingMap, errors, warnings}}
     */
    function buildAgenda(ctx) {
        const c = ctx || {};
        const errors = [];
        const warnings = [];
        const scopeIds = arr(c.standards).filter(function (id) { return CS().byId(id); });
        const unknown = arr(c.standards).filter(function (id) { return !CS().byId(id); });
        unknown.forEach(function (u) { errors.push('No controlled agenda template exists for "' + u + '"; it is not in the clause registry and no clauses will be invented for it.'); });
        if (!scopeIds.length) return { rows: [], sessions: [], traceability: null, findingMap: [], errors: errors.concat(['No standard in scope.']), warnings: warnings };

        const hoursPerDay = Number(c.hoursPerDay) || 8;
        const finalDays = Number(c.finalDays) || 0;
        const total = Math.round(finalDays * hoursPerDay * 4) / 4;
        if (!(total > 0)) return { rows: [], sessions: [], traceability: null, findingMap: [], errors: errors.concat(['An approved audit duration is needed before the agenda can be built.']), warnings: warnings };
        const assigned = arr(c.assigned);
        if (!assigned.length) return { rows: [], sessions: [], traceability: null, findingMap: [], errors: errors.concat(['Assign a Lead Auditor before building the agenda.']), warnings: warnings };

        const annexRefs = uniq(flattenChecklist(c.checklist, scopeIds).filter(function (q) { return q.source === 'annex-a-sample'; })
            .flatMap(function (q) { return q.refs.filter(function (r) { return r.stdId === 'iso27001'; }).map(function (r) { return r.ref; }); }));

        // 1. Resolve every block against the registry; drop blocks with nothing in scope.
        let blocks = BLOCKS.map(function (b) {
            const standards = b.kind ? [] : resolveBlockRefs(b, scopeIds, annexRefs);
            return Object.assign({}, b, { standards: standards });
        }).filter(function (b) { return b.kind || b.standards.length; });

        // 2. Scale the variable blocks to the approved duration, 15-minute steps.
        const fixed = blocks.filter(function (b) { return b.kind; });
        const variable = blocks.filter(function (b) { return !b.kind; });
        const fixedHours = fixed.reduce(function (t, b) { return t + b.hours; }, 0);
        const baseVar = variable.reduce(function (t, b) { return t + b.hours; }, 0);
        const avail = total - fixedHours;
        if (avail < 1) return { rows: [], sessions: [], traceability: null, findingMap: [], errors: errors.concat(['The approved duration is too short to hold the mandatory opening, consolidation and closing activities.']), warnings: warnings };
        const scale = avail / baseVar;
        variable.forEach(function (b) { b.hours = Math.max(0.5, Math.round(b.hours * scale * 4) / 4); });
        let drift = Math.round((avail - variable.reduce(function (t, b) { return t + b.hours; }, 0)) * 4) / 4;
        const order = variable.slice().sort(function (a, b) { return b.hours - a.hours; });
        for (let i = 0; drift !== 0 && i < 400; i++) {
            const b = order[i % order.length];
            const step = drift > 0 ? 0.25 : -0.25;
            if (b.hours + step >= 0.5) { b.hours += step; drift = Math.round((drift - step) * 4) / 4; }
        }
        blocks = [fixed.find(function (b) { return b.fixed === 'start'; })]
            .concat(variable)
            .concat([fixed.find(function (b) { return b.fixed === 'end-1'; }), fixed.find(function (b) { return b.fixed === 'end'; })]).filter(Boolean);

        // 3. Lay the blocks into working days: AM window, lunch, PM window.
        const dayCount = Math.max(1, Math.ceil(finalDays));
        const startMin = toMin(c.dayStart || '08:30');
        const half = hoursPerDay / 2;
        const lunchLen = 60;
        const slots = [];
        let remaining = total;
        for (let d = 1; d <= dayCount; d++) {
            const cap = Math.min(hoursPerDay, remaining);
            remaining = Math.round((remaining - cap) * 4) / 4;
            const am = Math.min(cap, half);
            slots.push({ day: d, half: 'am', start: startMin, cap: am });
            if (cap > half) slots.push({ day: d, half: 'pm', start: startMin + half * 60 + lunchLen, cap: cap - half, lunchBefore: true });
        }
        const dates = DF().eachDay(c.plan && c.plan.date, c.plan && c.plan.endDate);
        const parts = [];
        let bi = 0; let bLeft = blocks[0] ? blocks[0].hours : 0;
        slots.forEach(function (slot) {
            let cursor = slot.start; let capLeft = slot.cap;
            if (slot.lunchBefore) parts.push({ lunch: true, day: slot.day, start: slot.start - lunchLen, end: slot.start });
            while (capLeft > 0.001 && bi < blocks.length) {
                const take = Math.min(capLeft, bLeft);
                const isSplit = take < blocks[bi].hours - 0.001;
                parts.push({ block: blocks[bi], day: slot.day, start: cursor, end: cursor + Math.round(take * 60), hours: take, split: isSplit, first: bLeft === blocks[bi].hours });
                cursor += Math.round(take * 60); capLeft = Math.round((capLeft - take) * 4) / 4; bLeft = Math.round((bLeft - take) * 4) / 4;
                if (bLeft <= 0.001) { bi++; bLeft = blocks[bi] ? blocks[bi].hours : 0; }
            }
        });
        if (bi < blocks.length) errors.push('The agenda could not be fitted into ' + dayCount + ' day(s) at ' + hoursPerDay + ' productive hours per day.');

        // 4. Assign auditors. Single stream; opening, consolidation and closing are the Lead's.
        const lead = assigned[0];
        const allocation = {};
        arr(c.plan && c.plan.teamAllocations).forEach(function (a) { allocation[lower(a.auditor)] = Number(a.days || 0) * hoursPerDay; });
        const left = {};
        assigned.forEach(function (a) { left[a.name] = assigned.length === 1 ? Infinity : (allocation[lower(a.name)] != null ? allocation[lower(a.name)] : (a === lead ? total : 0)); });
        const pick = function (block, hours) {
            if (block.kind || assigned.length === 1) return lead;
            const pool = assigned.filter(function (a) { return left[a.name] >= hours; });
            return (pool.sort(function (x, y) { return left[y.name] - left[x.name]; })[0]) || lead;
        };

        // 5. Auditees from the client's own contacts and key personnel.
        // A person is named only on an explicit phrase match between the
        // session's function and a department or designation on the contact
        // record ("Top management" <-> designation "Top Management"). A shared
        // generic word ("management") is NOT a match — naming the wrong
        // person on a client-facing plan is worse than naming the role.
        const contacts = arr(c.client && c.client.contacts);
        const roleMap = (c.client && c.client.keyPersonnel) || {};
        const whole = function (hay, needle) { return (' ' + hay + ' ').indexOf(' ' + needle + ' ') !== -1; };
        const person = function (label) {
            const l = norm(label);
            const hit = contacts.find(function (p) {
                return [p.designation, p.department].filter(Boolean).join(';').split(/[;,/]/).map(norm).filter(function (t) { return t.length > 3; })
                    .some(function (t) { return whole(l, t) || whole(t, l); });
            });
            if (hit) return hit.name;
            const key = Object.keys(roleMap).find(function (k) { return whole(l, norm(k)); });
            return key ? roleMap[key] : '';
        };

        // 6. Findings -> sessions. Cover every clause the findings cite.
        const followUp = arr(c.findings).filter(function (f) { return f.requiresFollowUp; });
        const sessions = [];
        const sessionByBlock = {};
        let n = 0;
        const processNames = arr(c.client && c.client.keyProcesses).map(function (p) { return typeof p === 'string' ? p : p.name; });
        parts.filter(function (p) { return !p.lunch; }).forEach(function (p) {
            const b = p.block;
            if (sessionByBlock[b.id]) { // continuation of a split block: same session, extra time span
                sessionByBlock[b.id].spans.push({ day: p.day, start: p.start, end: p.end });
                return;
            }
            n++;
            const auditor = pick(b, b.hours);
            if (auditor && left[auditor.name] !== Infinity) left[auditor.name] -= b.hours;
            const s = {
                sessionId: 'S' + String(n).padStart(2, '0'), blockId: b.id, kind: b.kind || 'session', title: b.title, subject: b.subject || '',
                spans: [{ day: p.day, start: p.start, end: p.end }], hours: b.hours,
                standards: b.standards.map(function (e) { return { stdId: e.stdId, refs: e.refs.slice() }; }),
                processes: arr(b.processes).map(function (name) {
                    return processNames.find(function (pn) { return norm(pn).indexOf(norm(name)) === 0 || norm(name).indexOf(norm(pn)) === 0; }) || name;
                }),
                priorities: arr(b.priorities), findingIds: [],
                auditee: { dept: b.auditee, person: b.kind === 'consolidation' ? '' : person(b.auditee) },
                auditor: auditor, allocation: b
            };
            sessions.push(s); sessionByBlock[b.id] = s;
        });

        const findingMap = mapFindings(followUp, sessions);

        // 7. Rows (persisted plan.agenda) — one per time span, lunch between.
        const dayDate = function (d) { return dates[d - 1] || ''; };
        const rows = [];
        // A Hybrid plan labels every activity Remote or On-site. On-site days come
        // first; the rest are remote. (Remote and On-site plans are not labelled.)
        const hybrid = lower(c.plan && c.plan.auditMethod) === 'hybrid';
        const onsiteDays = Math.ceil(Number((c.plan && c.plan.durationCalculation && c.plan.durationCalculation.onsiteDays) || (c.plan && c.plan.onsiteDays)) || 0);
        const label = function (day) { return hybrid ? (day <= onsiteDays ? '[On-site] ' : '[Remote] ') : ''; };
        const emit = function (p) {
            if (p.lunch) {
                rows.push({ day: 'Day ' + p.day, date: dayDate(p.day), start: hhmm(p.start), end: hhmm(p.end), time: hhmm(p.start) + ' – ' + hhmm(p.end),
                    item: 'Lunch break', dept: 'All', auditor: 'N/A', auditorId: null, kind: 'lunch', sessionId: null, standards: [], findingIds: [], processes: [] });
                return;
            }
            const s = sessionByBlock[p.block.id];
            const cont = p.split && !p.first;
            rows.push({
                day: 'Day ' + p.day, date: dayDate(p.day), start: hhmm(p.start), end: hhmm(p.end), time: hhmm(p.start) + ' – ' + hhmm(p.end),
                item: label(p.day) + s.title + (cont ? ' (continued)' : ''), dept: s.auditee.person ? s.auditee.dept + ' / ' + s.auditee.person : s.auditee.dept,
                auditor: s.auditor.name, auditorId: s.auditor.id, kind: s.kind, sessionId: s.sessionId,
                standards: s.standards, findingIds: s.findingIds.slice(), processes: s.processes.slice(), subject: s.subject
            });
        };
        parts.forEach(emit);
        // Finding IDs are attached to sessions by mapFindings; refresh the rows.
        rows.forEach(function (r) { const s = sessions.find(function (x) { return x.sessionId === r.sessionId; }); if (s) { r.findingIds = s.findingIds.slice(); r.standards = s.standards; } });

        const traceability = buildTraceability({ sessions: sessions, findings: arr(c.findings), findingMap: findingMap, checklist: c.checklist, scopeIds: scopeIds, planId: c.plan && c.plan.id });
        if (assigned.length > 1) warnings.push('Parallel audit streams are not generated: the agenda is a single stream, with sessions allocated to auditors in turn.');
        return { rows: rows, sessions: sessions, traceability: traceability, findingMap: findingMap, errors: errors, warnings: warnings };
    }

    /**
     * Put every finding that needs follow-up into a session. A finding maps
     * when a session covers its clause (exact, a sub-clause of it, or the
     * clause it is a sub-clause of). If no session does, it is attached to the
     * session that owns its topic and the clause is ADDED to that session so
     * the agenda shows it — mapped with a stated reason, never silently lost.
     */
    function mapFindings(findings, sessions) {
        const map = [];
        arr(findings).forEach(function (f) {
            const clause = str(f.clause);
            const hits = [];
            sessions.forEach(function (s) {
                if (s.kind !== 'session') return;
                const covered = s.standards.some(function (e) {
                    if (arr(f.standards).length && f.standards.indexOf(e.stdId) === -1) return false;
                    return e.refs.some(function (r) { return r === clause || r.indexOf(clause + '.') === 0 || (clause && clause.indexOf(r + '.') === 0); });
                });
                if (covered) hits.push(s);
            });
            let via = 'clause';
            let target = hits;
            if (!target.length && clause) {
                const stdId = /^A\./.test(clause) ? 'iso27001' : (arr(f.standards)[0] || '');
                const fallback = /^A\./.test(clause) ? sessions.find(function (s) { return s.blockId === 'isms-risk-soa'; })
                    : sessions.find(function (s) { return s.blockId === 'improvement'; });
                if (fallback && stdId && CS().isKnownRef(stdId, clause)) {
                    let entry = fallback.standards.find(function (e) { return e.stdId === stdId; });
                    if (!entry) { entry = { stdId: stdId, refs: [] }; fallback.standards.push(entry); }
                    if (entry.refs.indexOf(clause) === -1) entry.refs.push(clause);
                    target = [fallback]; via = 'added-to-' + fallback.blockId;
                }
            }
            target.forEach(function (s) { if (s.findingIds.indexOf(f.id) === -1) s.findingIds.push(f.id); });
            map.push({ findingId: f.id, ref: f.ref, clause: clause, type: f.type, sessionIds: target.map(function (s) { return s.sessionId; }), via: target.length ? via : null, mapped: target.length > 0 });
        });
        return map;
    }

    /** The questions of a checklist with the requirements each one tests. */
    function flattenChecklist(checklist, scopeIds) {
        const out = [];
        const ck = checklist || {};
        arr(ck.clauses).forEach(function (main) {
            arr(main.subClauses).forEach(function (sub) {
                let refs = arr(sub.refs).filter(function (r) { return r && r.stdId && r.ref; });
                if (!refs.length && sub.clause && !/^(RECERT|FOCUS|ORG|DOC|REVIEW|THEME)/i.test(str(sub.clause))) {
                    refs = arr(scopeIds).filter(function (id) { return CS().isKnownRef(id, sub.clause); }).map(function (id) { return { stdId: id, ref: str(sub.clause) }; });
                }
                out.push({ section: main.mainClause, clause: str(sub.clause), title: str(sub.title), refs: refs, source: sub.criterionSource || '' });
            });
        });
        return out;
    }

    function buildTraceability(o) {
        const sessions = arr(o.sessions);
        const findings = arr(o.findings);
        const fmap = arr(o.findingMap);
        const questions = flattenChecklist(o.checklist, o.scopeIds).map(function (q) {
            const ids = sessions.filter(function (s) {
                return q.refs.some(function (r) {
                    return s.standards.some(function (e) { return e.stdId === r.stdId && e.refs.some(function (x) { return x === r.ref || r.ref.indexOf(x + '.') === 0 || x.indexOf(r.ref + '.') === 0; }); });
                });
            }).map(function (s) { return s.sessionId; });
            return { section: q.section, clause: q.clause, title: q.title, sessionIds: ids };
        });
        const required = findings.filter(function (f) { return f.requiresFollowUp; });
        return {
            version: 'plan-traceability-v1', generatedAt: new Date().toISOString(), planId: o.planId || null, standards: arr(o.scopeIds),
            sessions: sessions.map(function (s) {
                return {
                    sessionId: s.sessionId, blockId: s.blockId, kind: s.kind, title: s.title, spans: s.spans, hours: s.hours,
                    standards: s.standards.map(function (e) { return { stdId: e.stdId, label: stdLabel(e.stdId), refs: e.refs, titles: e.refs.map(function (r) { return { ref: r, title: refTitle(e.stdId, r) }; }) }; }),
                    processes: s.processes, findingIds: s.findingIds, auditee: s.auditee, auditorId: s.auditor && s.auditor.id, auditorName: s.auditor && s.auditor.name,
                    priorities: s.priorities,
                    checklistQuestions: questions.filter(function (q) { return q.sessionIds.indexOf(s.sessionId) !== -1; }).map(function (q) { return { clause: q.clause, title: q.title }; })
                };
            }),
            findings: fmap,
            checklist: { questions: questions, unscheduled: questions.filter(function (q) { return !q.sessionIds.length && !/^(RECERT|FOCUS|DOC|REVIEW|DOCNOTE)/i.test(q.clause) && q.clause; }) },
            summary: { findingsRequiringFollowUp: required.length, findingsMapped: fmap.filter(function (m) { return m.mapped; }).length, findingsUnmapped: fmap.filter(function (m) { return !m.mapped; }).length,
                findingsTotal: findings.length }
        };
    }

    // ═════════════════════════════════════════════════════════════════
    // 5. DURATION RECORD AND RECONCILIATION
    // ═════════════════════════════════════════════════════════════════
    /**
     * The full, certification-record form of the duration calculation. The
     * client-facing plan shows a summary; this stays in the internal record.
     */
    function buildDurationRecord(plan, ctx) {
        const p = plan || {};
        const c = ctx || {};
        const d = p.durationCalculation || {};
        const Domain = c.domain || global.AuditPlanningDomain;
        const stds = arr(c.standards);
        const standardsFull = stds.map(function (id) { return stdLabel(id) || id; });
        const employees = Number(d.employees) || Number(c.effectivePersonnel) || 0;
        let perStandard = [];
        if (Domain && stds.length) {
            try {
                const methodology = Domain.resolveDurationMethodology(c.settings || {}, standardsFull);
                const calc = Domain.calculateConfiguredDuration(methodology, { employees: employees, sites: Number(d.sites) || arr(p.selectedSites).length || 1, auditType: p.auditType || p.type, riskLevel: d.riskLevel || 'Medium' });
                if (calc && calc.configured) {
                    perStandard = calc.results.map(function (r, i) {
                        return { standard: standardsFull[i] || r.name, methodology: r.name, version: r.version, band: r.band ? { minEmployees: r.band.minEmployees, maxEmployees: r.band.maxEmployees, days: r.band.days } : null,
                            baselineDays: r.days, defaultTableUsed: !!r.defaultUsed, siteAdjustmentDays: r.siteAdjustment || 0, riskAdjustmentDays: r.riskAdjustment || 0 };
                    });
                }
            } catch (_e) { perStandard = []; }
        }
        const baseline = Number(d.baselineDays) || (perStandard.length ? Math.max.apply(null, perStandard.map(function (x) { return x.baselineDays; })) : 0);
        const ims = Number(d.imsAdjustmentPercent) || 0;
        const justified = Number(d.justifiedAdjustment) || 0;
        const adjustments = [];
        if (ims) adjustments.push({ type: 'IMS integration', percent: ims, days: Math.round(baseline * ims / 100 * 100) / 100, justification: str(d.imsJustification || d.justification) });
        if (justified) adjustments.push({ type: 'Justified adjustment', percent: null, days: justified, justification: str(d.justification) });
        const finalDays = Number(d.finalDays) || Number(p.manDays) || 0;
        const usesDefaults = perStandard.some(function (x) { return x.defaultTableUsed; }) || /default/i.test(str(d.basis + ' ' + d.methodologyVersion));
        return {
            version: 'duration-record-v1',
            basisByStandard: perStandard,
            effectivePersonnel: { value: employees, source: str(c.effectivePersonnelSource) || 'personnel at the audited site(s)', organisationTotal: c.organisationTotal || null,
                note: (c.organisationTotal && employees && Number(c.organisationTotal) !== employees) ? 'The organisation-wide figure (' + c.organisationTotal + ') differs from the effective personnel used (' + employees + '); the basis for the difference needs certification-manager confirmation.' : '' },
            scopeAndComplexity: { riskLevel: str(d.riskLevel) || 'Medium', scope: str(c.scopeSummary) },
            sites: Number(d.sites) || arr(p.selectedSites).length || 1,
            recertificationAdjustment: { applied: /recert/i.test(str(p.auditType || p.type)), note: /recert/i.test(str(p.auditType || p.type)) ? 'The recertification duration table is used; no separate percentage adjustment is applied.' : '' },
            imsIntegration: { standards: stds.length, adjustmentPercent: ims, ruleVersion: str(d.imsRuleVersion) || null, degree: stds.length > 1 ? 'Integrated audit of ' + stds.length + ' standards' : 'Single standard' },
            teamAbility: { integratedAuditCapable: c.competenceValid !== false, note: c.competenceNote || '' },
            remote: { method: str(p.auditMethod), remoteDays: Number(d.remoteDays) || 0, onsiteDays: Number(d.onsiteDays) || 0,
                considerations: /remote|hybrid/i.test(str(p.auditMethod)) ? 'Remote audit time is counted as audit time; secure communication and document sharing are in place.' : '' },
            increases: adjustments.filter(function (a) { return a.days > 0; }), reductions: adjustments.filter(function (a) { return a.days < 0; }),
            baselineDays: baseline, finalDays: finalDays, calculated: baseline * (1 + ims / 100) + justified,
            methodology: { version: str(d.methodologyVersion), imsRule: str(d.imsRuleVersion), builtInDefault: usesDefaults, provisional: !!d.provisional,
                note: usesDefaults ? 'Calculated from the Audit360 default duration table, which is a starter table and not a certification-body-approved methodology.' : '' },
            approval: { approvedBy: str(d.approvedBy) || null, approvedAt: str(d.approvedAt) || null }
        };
    }

    /**
     * Prove the agenda equals the approved duration and is workable.
     * Lunch is excluded; opening, closing and auditor-consolidation time are
     * audit time. Checks double-booking, daily hours and the scheduled dates.
     */
    function reconcileDuration(o) {
        const c = o || {};
        const hoursPerDay = Number(c.hoursPerDay) || 8;
        const rows = arr(c.rows);
        const errors = [];
        const byAuditor = {}; const byDay = {}; const spans = {};
        let scheduled = 0;
        const perAuditorIntervals = {};
        rows.forEach(function (r, i) {
            if (r.kind === 'lunch' || r.kind === 'break' || /^lunch|^break/i.test(str(r.item))) return;
            const s = toMin(r.start || r.time); const e = toMin(r.end || String(r.time || '').split(/[-–]/)[1]);
            if (s == null || e == null || e <= s) return; // reported as UNTIMED elsewhere
            const hrs = (e - s) / 60;
            const names = /^all team$/i.test(str(r.auditor)) ? arr(c.teamNames) : [str(r.auditor)];
            names.forEach(function (name) {
                byAuditor[name] = (byAuditor[name] || 0) + hrs; scheduled += hrs;
                const k = name + '|' + (r.date || r.day);
                (perAuditorIntervals[k] = perAuditorIntervals[k] || []).push({ s: s, e: e, row: i + 1, item: r.item });
            });
            byDay[r.day] = (byDay[r.day] || 0) + hrs;
            const sp = spans[r.day] = spans[r.day] || { min: s, max: e };
            sp.min = Math.min(sp.min, s); sp.max = Math.max(sp.max, e);
        });
        const approved = Math.round(Number(c.finalDays || 0) * hoursPerDay * 100) / 100;
        scheduled = Math.round(scheduled * 100) / 100;
        if (Math.abs(scheduled - approved) > 0.01) errors.push({ code: 'DURATION_MISMATCH', message: 'The agenda schedules ' + scheduled.toFixed(2) + ' productive auditor-hours (lunch excluded); the approved duration of ' + Number(c.finalDays || 0) + ' auditor-day(s) is ' + approved.toFixed(2) + ' hours.' });
        const doubleBooked = [];
        Object.keys(perAuditorIntervals).forEach(function (k) {
            const list = perAuditorIntervals[k].sort(function (a, b) { return a.s - b.s; });
            for (let i = 1; i < list.length; i++) if (list[i].s < list[i - 1].e) doubleBooked.push({ auditor: k.split('|')[0], rows: [list[i - 1].row, list[i].row] });
        });
        doubleBooked.forEach(function (d) { errors.push({ code: 'DOUBLE_BOOKED', message: d.auditor + ' is double-booked in agenda rows ' + d.rows.join(' and ') + '.' }); });
        Object.keys(byDay).forEach(function (day) {
            if (byDay[day] > hoursPerDay + 0.01) errors.push({ code: 'DAY_TOO_LONG', message: day + ' schedules ' + byDay[day].toFixed(2) + ' productive hours; the working day is ' + hoursPerDay + '.' });
            const sp = spans[day];
            if (sp && (sp.max - sp.min) / 60 > 10.01) errors.push({ code: 'DAY_TOO_LONG', message: day + ' runs ' + hhmm(sp.min) + '–' + hhmm(sp.max) + ', a span of more than 10 hours.' });
        });
        const allowed = arr(c.scheduledDates);
        if (allowed.length) {
            rows.forEach(function (r, i) { if (r.date && allowed.indexOf(r.date) === -1) errors.push({ code: 'OUTSIDE_SCHEDULED_DATES', message: 'Agenda row ' + (i + 1) + ' (' + r.day + ') is dated ' + r.date + ', outside the scheduled audit dates.' }); });
        }
        const dayNumbers = uniq(rows.map(function (r) { return r.day; }));
        return { valid: errors.length === 0, errors: errors, scheduledHours: scheduled, approvedHours: approved, byAuditor: byAuditor, byDay: byDay, days: dayNumbers.length, doubleBooked: doubleBooked };
    }

    // ═════════════════════════════════════════════════════════════════
    // 6. CERTIFIED SCOPE
    // ═════════════════════════════════════════════════════════════════
    function squash(v) { return str(v).replace(/\s+/g, ' '); }
    const PLATFORM_RE = /\b(aws|amazon web services|gcp|google cloud(?: platform)?|azure|microsoft 365|m365|office 365|csp|vmware|oracle cloud)\b/gi;
    function canonicalPlatform(p) {
        const x = lower(p);
        if (/aws|amazon/.test(x)) return 'AWS';
        if (/gcp|google/.test(x)) return 'GCP';
        if (/azure/.test(x)) return 'Azure';
        if (/m365|microsoft 365|office 365/.test(x)) return 'M365';
        if (/csp/.test(x)) return 'CSP';
        return p.toUpperCase();
    }
    function platformsIn(text) { return uniq((String(text || '').match(PLATFORM_RE) || []).map(canonicalPlatform)); }

    /**
     * Compare the plan's scope with the ACTIVE CERTIFICATES', and the
     * activities the client says it delivers today with both.
     *
     * The certificate is the authority: its wording is reproduced exactly —
     * never expanded, shortened or reworded. A mismatch blocks client issue;
     * a difference between current activities and the certificate is flagged
     * for authorised certification review (it is not for this code to decide
     * which of the two is right).
     *
     * @param {Object} o { plan, client, standards:[ids] }
     */
    function checkScope(o) {
        const c = o || {};
        const plan = c.plan || {};
        const client = c.client || {};
        const stdIds = arr(c.standards);
        const certs = arr(client.certificates).filter(function (x) { return !/withdrawn|expired/i.test(str(x.status)); })
            .filter(function (x) { const r = CS().resolve(x.standard); return !stdIds.length || r.standards.some(function (s) { return stdIds.indexOf(s.id) !== -1; }); });
        const texts = uniq(certs.map(function (x) { return squash(x.scope); }).filter(Boolean));
        const issues = [];
        if (!certs.length) issues.push({ code: 'SCOPE_NO_CERTIFICATE', message: 'No active certificate is on file for the standards in scope, so the plan scope cannot be verified.' });
        else if (!texts.length) issues.push({ code: 'SCOPE_NO_CERTIFICATE', message: 'The active certificate(s) carry no scope wording.' });
        else if (texts.length > 1) issues.push({ code: 'SCOPE_CERTIFICATES_DIFFER', message: 'The active certificates carry different scope wording (' + texts.length + ' variants); the authoritative wording needs certification-manager confirmation.' });
        const certificateScope = texts[0] || '';

        // The plan's own scope statement: the field, else (legacy) the text embedded in Audit Criteria.
        let planScope = squash(plan.scope || plan.certifiedScope && plan.certifiedScope.text);
        let embedded = false;
        if (!planScope && plan.criteria) {
            const m = String(plan.criteria).match(/approved certification scope\s*\(([\s\S]*?)\)\s*;\s*the organi[sz]ation/i);
            if (m) { planScope = squash(m[1]); embedded = true; }
        }
        const exact = !!planScope && !!certificateScope && planScope === certificateScope;
        if (certificateScope && !planScope) issues.push({ code: 'SCOPE_MISSING', message: 'The plan does not state the certified scope.' });
        else if (certificateScope && !exact) issues.push({ code: 'SCOPE_MISMATCH', message: 'The plan scope does not match the active certificate.', planScope: planScope, certificateScope: certificateScope });

        // Sites: every audited site must be a site of the client (and of the certificate where it lists them).
        const clientSites = arr(client.sites).map(function (s) { return lower(s.name); });
        const certSites = uniq(certs.flatMap(function (x) { return Object.keys(x.siteScopes || {}); }).map(lower));
        arr(plan.selectedSites).forEach(function (s) {
            const nm = lower(s.name);
            if (clientSites.length && clientSites.indexOf(nm) === -1) issues.push({ code: 'SITE_MISMATCH', message: 'Site "' + s.name + '" is not a site of the client.' });
            else if (certSites.length && certSites.indexOf(nm) === -1) issues.push({ code: 'SITE_MISMATCH', message: 'Site "' + s.name + '" is not covered by the certificate.' });
        });

        // Current activities against the certificate wording.
        const activities = arr(client.goodsServices).map(function (g) { return typeof g === 'string' ? g : g.name; }).filter(Boolean);
        const scopeTokens = new Set(norm(certificateScope).split(' ').filter(function (w) { return w.length > 2; }).map(function (w) { return w.replace(/s$/, ''); }));
        const stop = new Set(['and', 'the', 'for', 'of', 'in', 'to', 'services', 'service', 'management', 'operation']);
        const unlisted = activities.filter(function (a) {
            const toks = norm(a).split(' ').filter(function (w) { return w.length > 2 && !stop.has(w); }).map(function (w) { return w.replace(/s$/, ''); });
            if (!toks.length) return false;
            return toks.filter(function (w) { return scopeTokens.has(w); }).length / toks.length < 0.5;
        });
        const certPlatforms = platformsIn(certificateScope);
        const livePlatforms = uniq(activities.flatMap(platformsIn));
        const platformsNotCertified = livePlatforms.filter(function (p) { return certPlatforms.indexOf(p) === -1; });
        const platformsNotEvidenced = certPlatforms.filter(function (p) { return livePlatforms.length && livePlatforms.indexOf(p) === -1; });
        const differs = unlisted.length > 0 || platformsNotCertified.length > 0 || platformsNotEvidenced.length > 0;
        if (differs && certificateScope) {
            issues.push({ code: 'SCOPE_ACTIVITIES_DIFFER', severity: 'warning', requiresCertificationReview: true,
                message: 'Activities the client reports today differ from the certificate wording'
                    + (unlisted.length ? '; not described by it: ' + unlisted.join('; ') : '')
                    + (platformsNotCertified.length ? '; platforms in use but not named on it: ' + platformsNotCertified.join(', ') : '')
                    + (platformsNotEvidenced.length ? '; platforms named on it but not in the current services: ' + platformsNotEvidenced.join(', ') : '')
                    + '. Refer to authorised certification review.' });
        }
        // Processes chosen for audit must be processes the client actually runs.
        const known = arr(client.keyProcesses).map(function (p) { return norm(typeof p === 'string' ? p : p.name); });
        const outside = uniq(arr(c.processes).filter(function (p) { return !known.some(function (k) { return k.indexOf(norm(p)) === 0 || norm(p).indexOf(k) === 0; }); }));
        outside.forEach(function (p) { issues.push({ code: 'PROCESS_OUTSIDE_BOUNDARY', message: 'Process "' + p + '" scheduled for audit is not one of the client’s recorded processes.' }); });

        return { ok: !issues.some(function (i) { return i.severity !== 'warning'; }), exact: exact, embedded: embedded, certificateScope: certificateScope, planScope: planScope,
            certificateNumbers: certs.map(function (x) { return x.certificateNo || x.certificateNumber; }).filter(Boolean),
            activities: { listed: activities.filter(function (a) { return unlisted.indexOf(a) === -1; }), unlisted: unlisted, platformsNotCertified: platformsNotCertified, platformsNotEvidenced: platformsNotEvidenced,
                requiresCertificationReview: differs && !!certificateScope }, issues: issues };
    }

    // ═════════════════════════════════════════════════════════════════
    // 7. OBJECTIVES, CRITERIA, METHODOLOGY
    // ═════════════════════════════════════════════════════════════════
    /**
     * @param {Object} o { auditType, standards:[ids], scope, sites:[names], method, previousCount }
     * @returns {{objectives, criteria, methodology}} bullet lists as strings
     */
    function buildNarratives(o) {
        const c = o || {};
        const ids = arr(c.standards);
        const labels = ids.map(stdLabel).filter(Boolean);
        const list = labels.length > 1 ? labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1] : (labels[0] || '');
        const method = lower(c.method || 'remote');
        const remote = method === 'remote';
        const hybrid = method === 'hybrid';
        const b = function (items) { return items.map(function (x) { return '• ' + x; }).join('\n'); };
        const objectives = b([
            'Determine the conformity of the management system with all requirements of ' + list,
            'Evaluate the effectiveness of the management system in ensuring the organization meets its objectives and its statutory, regulatory and contractual requirements',
            'Confirm continued fulfilment of the certification requirements',
            'Evaluate the action taken on previous findings and the effect of significant changes since the previous audit',
            'Determine the continued suitability and relevance of the certification scope',
            'Provide the audit conclusions that support the ' + lower(c.auditType || 'recertification') + ' decision'
        ]);
        const criteria = b([
            'Standards, at the editions certified: ' + list,
            'The approved certification scope, exactly as stated on the certificate' + (c.scope ? ' (see the certified scope above)' : ''),
            'The organization’s documented management system',
            'Applicable legal, statutory, regulatory and contractual requirements',
            'The certification-programme requirements of the certification body',
            'Applicable site(s): ' + (arr(c.sites).join('; ') || 'as scheduled')
        ]);
        const methodology = b([
            remote ? 'Remote audit: all activities are performed remotely; no physical site activity is planned'
                : (hybrid ? 'Hybrid audit: activities are labelled remote or on-site in the agenda' : 'On-site audit at the applicable site(s)'),
            remote || hybrid ? 'Secure communication and document-sharing tools agreed with the organization are used for meetings, interviews and evidence review' : 'Evidence is reviewed and interviews are held on-site',
            'Interviews with management and operational personnel',
            'Review of documented information and records',
            remote ? 'Observation where possible, for example live screen-share of systems and tools' : 'Observation of activities and the work environment',
            'Risk-based sampling of processes, records, controls and sites',
            'Follow-up of every previous finding, treated according to its type',
            'Review of significant changes since the previous audit',
            'Sampling does not remove the mandatory audit activities or the applicable scheme requirements'
        ]);
        return { objectives: objectives, criteria: criteria, methodology: methodology };
    }

    const NARRATIVE_REQUIRED = {
        objectives: [['conformity with all requirements of the standards', /conformity/i], ['effectiveness', /effectiveness/i], ['continued fulfilment of certification requirements', /continued fulfil/i],
            ['previous findings and significant changes', /previous findings/i], ['continued suitability of scope', /suitab\w+.*scope|scope.*suitab/i], ['support for the recertification decision', /decision/i]],
        criteria: [['the correct edition of every standard', null], ['the exact approved scope', /scope/i], ['the organization’s documented management system', /documented management system/i],
            ['legal, regulatory and contractual requirements', /legal|regulatory/i], ['certification-programme requirements', /certification[- ]programme|programme requirements/i], ['applicable sites', /site/i]],
        methodology: [['the audit method', /remote|on-site|hybrid/i], ['secure communication / document-sharing tools', /secure|communication|document-sharing/i], ['interviews', /interview/i],
            ['review of documented information and records', /documented information|records/i], ['observation', /observation/i], ['risk-based sampling', /risk-based sampling/i],
            ['previous-finding follow-up', /previous finding/i], ['significant-change review', /significant change/i], ['the limitation that sampling does not remove mandatory activities', /sampling does not remove|mandatory/i]]
    };

    function checkNarratives(plan, standards) {
        const p = plan || {};
        const problems = [];
        ['objectives', 'criteria', 'methodology'].forEach(function (field) {
            const text = str(p[field] || p['audit' + field.charAt(0).toUpperCase() + field.slice(1)]);
            if (!text) { problems.push({ code: 'NARRATIVE_MISSING', field: field, message: 'The plan has no audit ' + field + '.' }); return; }
            NARRATIVE_REQUIRED[field].forEach(function (rule) {
                if (rule[1] && !rule[1].test(text)) problems.push({ code: 'NARRATIVE_INCOMPLETE', field: field, message: 'Audit ' + field + ' do not state ' + rule[0] + '.' });
            });
            if (field === 'criteria') {
                arr(standards).forEach(function (id) {
                    const label = stdLabel(id); const std = CS().byId(id);
                    if (label && text.indexOf(label) === -1) problems.push({ code: 'EDITION_MISMATCH', field: field, message: 'Audit criteria do not cite ' + label + ' at its certified edition.' });
                    const wrongEdition = text.match(new RegExp('(?:ISO(?:/IEC)?\\s*' + (id === 'iso27001' ? '27001' : id === 'iso22301' ? '22301' : '20000-1') + ')\\s*:\\s*(\\d{4})', 'g')) || [];
                    wrongEdition.forEach(function (m) { const yr = m.match(/(\d{4})$/)[1]; if (std && label.indexOf(':' + yr) === -1) problems.push({ code: 'EDITION_MISMATCH', field: field, message: 'Audit criteria cite "' + m + '" but the certified edition is ' + label + '.' }); });
                });
            }
        });
        return problems;
    }

    // ═════════════════════════════════════════════════════════════════
    // 8. STATUS WORKFLOW
    // ═════════════════════════════════════════════════════════════════
    const STATUSES = ['Draft — Internal Review', 'Approved for Client Issue', 'Issued to Client', 'Client Acknowledged'];
    const APPROVER_ROLES = ['Admin', 'Certification Manager', 'Cert Manager'];

    function contentHash(plan) {
        const p = plan || {};
        const basis = JSON.stringify({ d: p.date, e: p.endDate, t: p.team, m: p.auditMethod, a: arr(p.agenda).map(function (r) { return [r.day, r.start, r.end, r.item, r.dept, r.auditor]; }),
            o: p.objectives, c: p.criteria, me: p.methodology, s: p.scope, tz: p.timeZone && p.timeZone.iana, dur: p.durationCalculation && p.durationCalculation.finalDays, std: p.standard });
        let h = 5381;
        for (let i = 0; i < basis.length; i++) { h = ((h << 5) + h) + basis.charCodeAt(i); h = h & 0xFFFFFFFF; }
        return (h >>> 0).toString(16);
    }

    /**
     * May the document move from `from` to `to`?
     * Approval and issue need an authorised role AND a clean gate. A plan edited
     * after approval is no longer the approved plan.
     */
    function canTransition(from, to, o) {
        const c = o || {};
        const fi = STATUSES.indexOf(from || STATUSES[0]);
        const ti = STATUSES.indexOf(to);
        if (ti < 0) return { allowed: false, reason: 'Unknown status "' + to + '".' };
        if (to === STATUSES[0]) return { allowed: true };
        if (ti !== fi + 1) return { allowed: false, reason: 'A plan cannot move from "' + (from || STATUSES[0]) + '" to "' + to + '".' };
        if (ti <= 2) {
            if (APPROVER_ROLES.map(lower).indexOf(lower(c.role)) === -1) return { allowed: false, reason: 'Only ' + APPROVER_ROLES.join(', ') + ' may ' + (ti === 1 ? 'approve' : 'issue') + ' an audit plan.' };
            const blockers = arr(c.validation && c.validation.blockers);
            if (blockers.length) return { allowed: false, reason: blockers.length + ' blocking issue(s) must be resolved first.', blockers: blockers };
            if (ti === 2 && c.plan && c.plan.approval && c.plan.approval.contentHash && c.plan.approval.contentHash !== contentHash(c.plan)) {
                return { allowed: false, reason: 'The plan was changed after approval; approve it again before issue.' };
            }
        }
        if (ti === 3 && !(c.acknowledgedBy && str(c.acknowledgedBy))) return { allowed: false, reason: 'Record who acknowledged the plan for the client.' };
        return { allowed: true };
    }

    // ═════════════════════════════════════════════════════════════════
    // 9. THE GATE
    // ═════════════════════════════════════════════════════════════════
    function issue(code, message, extra) { return Object.assign({ code: code, message: message, severity: 'blocker' }, extra || {}); }

    /**
     * Everything that stops a plan being approved for, or issued to, a client.
     * Each blocker names the exact row, standard, finding or field.
     *
     * @param {Object} plan
     * @param {Object} ctx {
     *   client, auditors, standards:[ids], state, checklists:[{id,name,standardIds,coverage}],
     *   html (the rendered client document, optional), lint (PrintShell.lint(html)),
     *   findings (collectPreviousFindings), hoursPerDay, cbCountry, now }
     * @returns {{blockers, warnings, summary, ok}}
     */
    function validate(plan, ctx) {
        const p = plan || {};
        const c = ctx || {};
        const df = DF();
        const blockers = []; const warnings = [];
        const B = function (code, msg, extra) { blockers.push(issue(code, msg, extra)); };
        const W = function (code, msg, extra) { warnings.push(Object.assign({ code: code, message: msg, severity: 'warning' }, extra || {})); };
        const scopeIds = arr(c.standards);
        const rows = arr(p.agenda);

        // ── dates, window, expiry ────────────────────────────────────
        const start = df.toIso(p.date); const end = df.toIso(p.endDate);
        if (!start || !end) B('DATES_MISSING', 'The scheduled audit start and end dates are both required.', { field: 'date' });
        if (start && end && end < start) B('DATES_INVALID', 'The scheduled audit ends before it starts.', { field: 'endDate' });
        const cyc = p.certificationCycle || {};
        const wStart = df.toIso(cyc.recommendedWindowStart); const wEnd = df.toIso(cyc.recommendedWindowEnd); const exp = df.toIso(cyc.certificateExpiry);
        const overridden = function (cat) { return arr(p.overrides).some(function (o) { return o && o.category === cat && o.user && o.role && o.reason; }); };
        if (start && wStart && wEnd && (start < wStart || end > wEnd) && !overridden('window')) {
            B('OUTSIDE_WINDOW', 'The scheduled audit (' + df.formatDateRange(start, end) + ') is outside the approved window (' + df.formatDateRange(wStart, wEnd) + ').', { field: 'date' });
        }
        if (end && exp && end > exp) B('AFTER_EXPIRY', 'The scheduled audit ends after the certificate expires on ' + df.formatDate(exp) + '.', { field: 'endDate' });

        // ── time zone ────────────────────────────────────────────────
        const tz = df.resolveTimeZone({ plan: p, client: c.client, site: (arr(c.client && c.client.sites).find(function (s) { return arr(p.selectedSites)[0] && lower(s.name) === lower(arr(p.selectedSites)[0].name); })) });
        if (df.requiresAgreedTimeZone({ plan: p, client: c.client, cbCountry: c.cbCountry })) {
            if (!tz.iana) B('TIMEZONE_MISSING', 'This is a remote international audit and no time zone is agreed or resolvable from the site.', { field: 'timeZone' });
            else if (!tz.confirmed) B('TIMEZONE_UNCONFIRMED', 'The site’s time zone is not certain (its state spans zones); an authorised user must select the agreed zone.', { field: 'timeZone' });
        }

        // ── auditors ─────────────────────────────────────────────────
        const team = resolveAuditors(p, c.auditors);
        team.issues.forEach(function (i) { B(i.code, i.message, { field: 'team' }); });
        const assignedNames = team.assigned.map(function (a) { return lower(a.name); });
        const assignedIds = team.assigned.map(function (a) { return a.id; }).filter(Boolean);
        rows.forEach(function (r, i) {
            if (r.kind === 'lunch' || /^lunch|^break/i.test(str(r.item))) return;
            const at = 'Agenda row ' + (i + 1) + ' (' + str(r.day) + ' ' + str(r.time || r.start) + ' “' + str(r.item).slice(0, 48) + '”)';
            if (!str(r.auditor) && !r.auditorId) B('AUDITOR_MISSING', at + ' has no auditor.', { row: i + 1 });
            else if (isPlaceholderAuditor(r.auditor)) B('AUDITOR_PLACEHOLDER', at + ' names “' + str(r.auditor) + '”, which is a placeholder, not an auditor.', { row: i + 1 });
            else if (/^all team$/i.test(str(r.auditor))) { if (team.assigned.length < 2) B('AUDITOR_PLACEHOLDER', at + ' names “All Team” but only one auditor is assigned; name the Lead Auditor.', { row: i + 1 }); }
            else if (assignedNames.indexOf(lower(r.auditor)) === -1) B('AUDITOR_UNRESOLVED', at + ' names “' + str(r.auditor) + '”, who is not an auditor assigned to this plan.', { row: i + 1 });
            else if (r.auditorId != null && assignedIds.length && assignedIds.indexOf(str(r.auditorId)) === -1) B('AUDITOR_UNRESOLVED', at + ' references auditor ID ' + r.auditorId + ', which is not assigned to this plan.', { row: i + 1 });
            else if (r.auditorId == null || str(r.auditorId) === '') B('AUDITOR_UNRESOLVED', at + ' has no auditor ID: the auditor is not linked to an auditor record.', { row: i + 1 });
        });

        // ── agenda structure ─────────────────────────────────────────
        const kinds = function (k) { return rows.filter(function (r) { return r.kind === k || (k === 'opening' && /opening meeting/i.test(str(r.item))) || (k === 'closing' && /closing meeting/i.test(str(r.item))) || (k === 'consolidation' && /consolidation/i.test(str(r.item))); }); };
        if (!rows.length) B('AGENDA_MISSING', 'The plan has no agenda.', { field: 'agenda' });
        if (rows.length) {
            if (!kinds('opening').length) B('OPENING_MISSING', 'The agenda has no opening meeting.', { field: 'agenda' });
            if (!kinds('consolidation').length) B('CONSOLIDATION_MISSING', 'The agenda has no auditor-consolidation period before the closing meeting.', { field: 'agenda' });
            if (!kinds('closing').length) B('CLOSING_MISSING', 'The agenda has no closing meeting.', { field: 'agenda' });
            rows.forEach(function (r, i) {
                const s = toMin(r.start || r.time); const e = toMin(r.end || String(r.time || '').split(/[-–]/)[1]);
                if (s == null || e == null || e <= s) B('UNTIMED_ROW', 'Agenda row ' + (i + 1) + ' (“' + str(r.item).slice(0, 48) + '”) has no valid start and end time.', { row: i + 1 });
                if (!str(r.day)) B('ROW_INCOMPLETE', 'Agenda row ' + (i + 1) + ' has no day.', { row: i + 1 });
                if (r.kind !== 'lunch' && !/^lunch/i.test(str(r.item)) && !str(r.dept)) B('ROW_INCOMPLETE', 'Agenda row ' + (i + 1) + ' has no department/auditee.', { row: i + 1 });
            });
            const closingIdx = rows.map(function (r, i) { return kinds('closing').indexOf(r) !== -1 ? i : -1; }).filter(function (i) { return i >= 0; }).pop();
            if (closingIdx != null && closingIdx >= 0) {
                rows.slice(closingIdx + 1).forEach(function (r, k) { B('ACTIVITY_AFTER_CLOSING', 'Agenda row ' + (closingIdx + k + 2) + ' (“' + str(r.item).slice(0, 48) + '”) is scheduled after the closing meeting, which must be the final activity.', { row: closingIdx + k + 2 }); });
                const cons = rows.map(function (r, i) { return kinds('consolidation').indexOf(r) !== -1 ? i : -1; }).filter(function (i) { return i >= 0; }).pop();
                if (cons != null && cons >= 0 && cons > closingIdx) B('CONSOLIDATION_AFTER_CLOSING', 'The auditor-consolidation period is after the closing meeting.', {});
            }
        }

        // ── clauses and standards ────────────────────────────────────
        rows.forEach(function (r, i) {
            arr(r.standards).forEach(function (e) {
                arr(e.refs).forEach(function (ref) {
                    if (!CS().isKnownRef(e.stdId, ref)) B('INVALID_CLAUSE', 'Agenda row ' + (i + 1) + ' cites ' + ref + ', which is not a requirement of ' + (stdLabel(e.stdId) || e.stdId) + '.', { row: i + 1 });
                    else if (scopeIds.length && scopeIds.indexOf(e.stdId) === -1) B('STANDARD_OUT_OF_SCOPE', 'Agenda row ' + (i + 1) + ' cites ' + stdLabel(e.stdId) + ', which is not in the audit scope.', { row: i + 1 });
                });
            });
            if (!arr(r.standards).length && r.kind !== 'lunch' && r.kind !== 'opening' && r.kind !== 'closing' && r.kind !== 'consolidation') {
                scanFreeText(r.item, scopeIds).forEach(function (pr) { B(pr.code, 'Agenda row ' + (i + 1) + ': ' + pr.message, { row: i + 1 }); });
                if (r.kind == null && !scanFreeText(r.item, scopeIds).length && /^\s*(?:A\.)?\d/.test(str(r.item))) W('CLAUSE_UNVERIFIED', 'Agenda row ' + (i + 1) + ' is free text; its clause reference could not be checked against a structured record.', { row: i + 1 });
                if (/^management system clauses|^\s*$/.test(lower(r.item)) && !toMin(r.start || r.time)) B('UNTIMED_ROW', 'Agenda row ' + (i + 1) + ' is an untimed catch-all row.', { row: i + 1 });
            }
        });
        checkNarratives(p, scopeIds).filter(function (x) { return x.code === 'EDITION_MISMATCH'; }).forEach(function (x) { B('EDITION_MISMATCH', x.message, { field: x.field }); });
        const stdText = str(p.standard);
        if (stdText && scopeIds.length) {
            const named = CS().resolve(stdText).standards.map(function (s) { return s.id; });
            scopeIds.forEach(function (id) { if (named.indexOf(id) === -1) B('EDITION_MISMATCH', 'The plan’s standards do not include ' + stdLabel(id) + '.', { field: 'standard' }); });
            (stdText.match(/\b(?:27001|22301|20000-1)\s*:\s*\d{4}\b/g) || []).forEach(function (m) {
                const num = m.match(/^(\d+(?:-\d)?)/)[1]; const id = num === '27001' ? 'iso27001' : num === '22301' ? 'iso22301' : 'iso20000'; const yr = m.match(/(\d{4})$/)[1];
                if (stdLabel(id).indexOf(':' + yr) === -1) B('EDITION_MISMATCH', 'The plan cites ' + m + ' but the certified edition is ' + stdLabel(id) + '.', { field: 'standard' });
            });
        }

        // ── narratives ───────────────────────────────────────────────
        checkNarratives(p, scopeIds).filter(function (x) { return x.code !== 'EDITION_MISMATCH'; }).forEach(function (x) { B(x.code, x.message, { field: x.field }); });

        // ── duration ─────────────────────────────────────────────────
        const dur = p.durationCalculation || {};
        if (!(Number(dur.finalDays) > 0)) B('DURATION_MISSING', 'No audit duration is recorded.', { field: 'durationCalculation' });
        if (!dur.approvedBy || !dur.approvedAt || dur.provisional || /^draft$/i.test(str(dur.methodologyVersion))) B('DURATION_NOT_APPROVED', 'The audit duration has not been approved (approver and approval date are required).', { field: 'durationCalculation' });
        const teamNames = team.assigned.map(function (a) { return a.name; });
        const rec = reconcileDuration({ rows: rows, finalDays: dur.finalDays || p.manDays, hoursPerDay: c.hoursPerDay, teamNames: teamNames, scheduledDates: start && end ? df.eachDay(start, end) : [] });
        if (rows.length) rec.errors.forEach(function (e) { B(e.code, e.message, { field: 'agenda' }); });
        // An auditor may not be scheduled for more time than the plan allocates them.
        const perDay = Number(c.hoursPerDay) || 8;
        arr(p.teamAllocations).forEach(function (a) {
            const allocated = Number(a.days || 0) * perDay;
            const scheduledHrs = rec.byAuditor[a.auditor] || 0;
            if (scheduledHrs > allocated + 0.01) B('AUDITOR_OVERALLOCATED', a.auditor + ' is scheduled for ' + scheduledHrs.toFixed(2) + ' hours but is allocated ' + allocated.toFixed(2) + ' (' + Number(a.days || 0) + ' auditor-day(s)).', { field: 'teamAllocations' });
        });

        // ── previous findings ────────────────────────────────────────
        const findings = arr(c.findings);
        const need = findings.filter(function (f) { return f.requiresFollowUp; });
        const claimed = p.traceability && p.traceability.findings ? p.traceability.findings : [];
        const mappedIds = new Set();
        rows.forEach(function (r) { arr(r.findingIds).forEach(function (id) { mappedIds.add(str(id)); }); });
        const unmapped = need.filter(function (f) { return !mappedIds.has(str(f.id)); });
        unmapped.forEach(function (f) { B('FINDING_UNMAPPED', 'Previous finding ' + (f.ref || f.id) + ' (' + f.typeLabel + ', clause ' + (f.clause || 'not stated') + ') is not scheduled in any agenda session.', { findingId: f.id }); });
        const findingSummary = { required: need.length, mapped: need.length - unmapped.length, unmapped: unmapped.length, total: findings.length };
        if (claimed.length && need.length && claimed.length !== need.length) W('FINDING_COUNT_DIFFERS', 'The traceability record lists ' + claimed.length + ' finding(s) but the register now requires follow-up of ' + need.length + '. Rebuild the agenda.', {});

        // ── scope and sites ──────────────────────────────────────────
        const scope = checkScope({ plan: p, client: c.client, standards: scopeIds, processes: uniq(rows.flatMap(function (r) { return arr(r.processes); })) });
        scope.issues.forEach(function (i) {
            if (i.severity === 'warning') W(i.code, i.message, { requiresCertificationReview: !!i.requiresCertificationReview });
            else B(i.code, i.message, { field: 'scope', planScope: i.planScope, certificateScope: i.certificateScope });
        });

        // ── checklist association and coverage ───────────────────────
        const cks = arr(c.checklists);
        if (!cks.length) B('CHECKLIST_MISSING', 'No audit checklist is linked to the plan.', { field: 'selectedChecklists' });
        cks.forEach(function (ck) {
            const linked = arr(ck.standardIds);
            scopeIds.filter(function (id) { return linked.indexOf(id) === -1; }).forEach(function (id) { B('CHECKLIST_NOT_LINKED', 'Checklist "' + ck.name + '" is not linked to ' + stdLabel(id) + ', which is in the audit scope.', { checklistId: ck.id, standard: id }); });
            const cov = ck.coverage;
            if (!cov || cov.outcome === 'blocked') B('COVERAGE_NOT_ASSESSED', 'Coverage of checklist "' + ck.name + '" could not be assessed.', { checklistId: ck.id });
            else if (cov.outcome === 'failed' && !arr(p.coverageDispositions).some(function (d) { return String(d.checklistId) === String(ck.id) && d.by && d.role && d.reason; })) {
                B('COVERAGE_GAP', 'Checklist "' + ck.name + '" has identified coverage gaps (' + cov.counts.critical + ') with no authorised disposition.', { checklistId: ck.id });
            }
        });

        // ── the rendered document ────────────────────────────────────
        if (c.html != null) {
            const text = df.renderedText(c.html);
            df.findUnwrittenDates(text).forEach(function (m) { B('AMBIGUOUS_DATE', 'The client document contains the numeric date "' + m.text + '"; dates must be written (e.g. 3 November 2026).', { text: m.text }); });
            if (/audit team\s*:?\s*none\b/i.test(text)) B('AUDIT_TEAM_NONE', 'The client document states "Audit Team: None".', {});
            df.findRawEntities(text).slice(0, 3).forEach(function (m) { B('RAW_ENTITY', 'The client document contains the raw HTML entity ' + m + '.', { text: m }); });
            df.findBrowserArtifacts(text).forEach(function (k) { B('BROWSER_ARTIFACT', 'The client document contains browser print decoration (' + k + ').', {}); });
            arr(c.lint).forEach(function (l) {
                if (l.code === 'STATIC_PAGE_NUMBER' || l.code === 'NO_PAGE_COUNTER' || l.code === 'NO_PAGE_RULE') B('INCORRECT_PAGINATION', l.message, {});
                else if (l.code === 'FLOW_FOOTER' || l.code === 'VIEWPORT_HEIGHT' || l.code === 'FIXED_FOOTER') B('TRAILING_BLANK_PAGE_RISK', l.message, {});
            });
        }

        // ── coverage of the recertification priorities ───────────────
        if (rows.length && /recert/i.test(str(p.auditType || p.type))) {
            const blockIds = new Set(rows.map(function (r) { const s = arr(p.traceability && p.traceability.sessions).find(function (x) { return x.sessionId === r.sessionId; }); return s ? s.blockId : r.blockId; }).filter(Boolean));
            const havePlanBlocks = arr(p.traceability && p.traceability.sessions).length > 0;
            if (havePlanBlocks) {
                const titles = rows.map(function (r) { return lower(r.item); }).join(' | ');
                REQUIRED_COVERAGE.forEach(function (rc) {
                    if (rc[2] && scopeIds.indexOf(rc[2]) === -1) return;
                    const found = rc[1].some(function (id) { return blockIds.has(id) || titles.indexOf(id) !== -1; });
                    if (!found) W('AGENDA_COVERAGE_GAP', 'The agenda does not visibly cover: ' + rc[0] + '.', {});
                });
            }
        }

        return { ok: blockers.length === 0, blockers: blockers, warnings: warnings, summary: { findings: findingSummary, reconciliation: rec, scope: { exact: scope.exact, certificateNumbers: scope.certificateNumbers }, timeZone: tz } };
    }

    // ═════════════════════════════════════════════════════════════════
    // 10. ASSEMBLY — one path for the app, the tests and the render tool
    // ═════════════════════════════════════════════════════════════════
    function standardIdsOf(plan) {
        const fromCycle = arr(plan && plan.certificationCycle && plan.certificationCycle.standards);
        const text = fromCycle.length ? fromCycle.join(', ') : str(plan && plan.standard);
        return CS().resolve(text).standards.map(function (x) { return x.id; });
    }

    /**
     * Build everything a plan needs from its structured inputs and return it
     * as a patch to apply to the plan, plus the derived records the gate and
     * the documents use. Nothing here reads window.state — callers pass it in.
     *
     * @param {Object} o { plan, client, auditors, state, settings, checklist, checklists, hoursPerDay, cbCountry }
     */
    function assemble(o) {
        const c = o || {};
        const plan = c.plan || {};
        const df = DF();
        const ids = standardIdsOf(plan);
        const team = resolveAuditors(plan, c.auditors);
        const findings = collectPreviousFindings({ state: c.state, client: c.client, plan: plan, standards: ids });
        const dur = plan.durationCalculation || {};
        const built = buildAgenda({ plan: plan, standards: ids, finalDays: dur.finalDays || plan.manDays, hoursPerDay: c.hoursPerDay || 8, assigned: team.assigned,
            client: c.client, findings: findings, checklist: c.checklist });
        const scope = checkScope({ plan: plan, client: c.client, standards: ids, processes: uniq(built.rows.flatMap(function (r) { return arr(r.processes); })) });
        const site = arr(c.client && c.client.sites).find(function (s) { return arr(plan.selectedSites)[0] && lower(s.name) === lower(arr(plan.selectedSites)[0].name); });
        const tz = df.resolveTimeZone({ plan: plan, client: c.client, site: site });
        const narratives = buildNarratives({ auditType: plan.auditType || plan.type, standards: ids, scope: scope.certificateScope, sites: arr(plan.selectedSites).map(function (s) { return s.name; }), method: plan.auditMethod });
        const effective = arr(plan.selectedSites).reduce(function (n, s) { const r = arr(c.client && c.client.sites).find(function (x) { return lower(x.name) === lower(s.name); }); return n + (Number(r && r.employees) || 0); }, 0);
        const durationRecord = buildDurationRecord(plan, { standards: ids, settings: c.settings, effectivePersonnel: effective, effectivePersonnelSource: 'employees at the audited site(s)',
            organisationTotal: c.client && (c.client.totalEmployees || null), scopeSummary: scope.certificateScope, competenceValid: c.competenceValid, domain: c.domain });
        const patch = {
            agenda: built.rows, traceability: built.traceability, objectives: narratives.objectives, criteria: narratives.criteria, methodology: narratives.methodology,
            scope: scope.certificateScope || plan.scope || '', assignedAuditors: team.assigned.map(function (a) { return { id: a.id, name: a.name, role: a.role }; }),
            timeZone: tz.iana ? { iana: tz.iana, source: tz.source, confirmed: tz.confirmed, agreedBy: tz.agreedBy || '', agreedAt: tz.agreedAt || '' } : (plan.timeZone || null),
            durationRecord: durationRecord
        };
        return { patch: patch, standards: ids, team: team, findings: findings, agenda: built, scope: scope, timeZone: tz, durationRecord: durationRecord, effectivePersonnel: effective };
    }

    const API = {
        STD_SHORT, BLOCKS, REQUIRED_COVERAGE, CORE_PROCESSES, STATUSES, APPROVER_ROLES,
        clauseLabel, refTitle, compressRefs, describeStandards, scanFreeText, stdLabel, shortLabel,
        resolveAuditors, auditTeamLabel, isPlaceholderAuditor,
        collectPreviousFindings, mapFindings,
        buildAgenda, buildTraceability, flattenChecklist,
        buildDurationRecord, reconcileDuration,
        checkScope, buildNarratives, checkNarratives,
        validate, canTransition, contentHash, assemble, standardIdsOf
    };
    global.AuditPlanIntegrity = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'audit-plan-integrity.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

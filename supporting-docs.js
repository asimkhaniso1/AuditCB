// ============================================
// SUPPORTING DOCUMENT RELEVANCE  (window.SupportingDocs)
// ============================================
// Decides which client documents may be named on a checklist question as
// "documented information on file that should support this".
//
// WHY THIS FILE EXISTS
// --------------------
// The recommendations were wrong in three specific ways, all visible on the
// PC CONNECTION checklist:
//   * an ISMS risk-assessment question named ISO/IEC 20000-1 risk procedures;
//   * the business impact analysis named incident-management SOPs;
//   * continuity plans, capacity/availability, demand management and budgeting
//     all named "Supplier Management Procedure for ISO 27001".
// Cause: docCoversRef() (client-docs-bulk.js) treated a document that names no
// standard as applying to ALL standards, and let a parent clause cover any
// sub-clause — so a supplier procedure tagged "8.4" satisfied 22301 8.4 and
// 20000-1 8.4.1, 8.4.2 and 8.4.3, which are unrelated requirements that merely
// share a number. Clause numbers are not concepts.
//
// HOW IT WORKS
// ------------
// A document is a validated candidate for a question only if EVERY gate passes:
//   1. STATUS     not obsolete, superseded, withdrawn, draft; not a blank template.
//   2. STANDARD   its stated applicability includes the question's standard.
//                 Stated = explicit metadata, else the document number prefix
//                 (ISMS-/BCMP-/ITSM-), else "for ISO xxxx" in its title, else —
//                 weaker — a subject inherent to one standard ("security
//                 incident"). A document that states nothing is NOT assumed to
//                 apply to everything. An integrated document counts only where its
//                 approved applicability names each standard.
//                 One exception, explicit and narrow: a client-specific PROCESS
//                 document (an SOP named after one of the client's own key
//                 processes) may evidence that process's topics under any
//                 standard, because the process — not the standard — is what it
//                 describes.
//   3. TOPIC      it is about what the question is about (BIA methodology for a
//                 BIA question, not "an incident procedure").
// Only then is text similarity used, and only to ORDER the survivors.
// Nothing survives -> the question carries "No validated supporting document
// mapped" and the auditor chooses; nothing is forced.
//
// CONTRACT
//   SupportingDocs.profile(doc, client)                 -> structured metadata for a document
//   SupportingDocs.rank(docs, {topic, refs, client})    -> {validated[], rejected[], expected, topic}
//   SupportingDocs.hint(docs, refs, opts)               -> sentence to append to a question ('' if none needed)
//   SupportingDocs.NO_VALIDATED_DOCUMENT                -> the fallback wording
//   SupportingDocs.topicsForRef(stdId, ref)             -> [topicId]

(function (global) {
    'use strict';

    const NO_VALIDATED_DOCUMENT = 'No validated supporting document mapped';
    const AUDITOR_CONFIRM = ' — auditor to select or confirm the document.';

    const DOMAIN_OF = { iso27001: 'isms', iso22301: 'bcms', iso20000: 'sms' };
    const STD_LABEL = { iso27001: 'ISO/IEC 27001:2022', iso22301: 'ISO 22301:2019', iso20000: 'ISO/IEC 20000-1:2018' };

    function str(v) { return String(v == null ? '' : v).trim(); }
    function lower(v) { return str(v).toLowerCase(); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    function csv(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : str(v).split(',').map(str).filter(Boolean); }

    // ── Topics ────────────────────────────────────────────────────────
    // id            what a question is about
    // std           standards whose questions this topic can arise under (documents
    //               stated for another standard are refused)
    // kw            what a document TITLE says when it is about this
    // expected      a controlled document is normally expected for this topic, so
    //               a missing one is reported rather than left silent
    // process       client key-process names whose SOP evidences the topic
    // related       topics whose documents also evidence this one
    // refs          the requirements that belong to it, per standard
    const T = function (id, label, std, kw, opts) {
        return Object.assign({ id: id, label: label, std: std, kw: kw, expected: false, process: [], related: [], refs: {} }, opts || {});
    };
    const ALL3 = ['iso27001', 'iso22301', 'iso20000'];

    const TOPICS = [
        // ── ISO/IEC 27001 ──
        T('isms-risk', 'Information security risk assessment and treatment', ['iso27001'],
            [/risk (assessment|management|treatment|methodology|register)/i], { expected: true, refs: { iso27001: ['6.1.2', '8.2', '8.3'] } }),
        T('isms-soa', 'Statement of Applicability', ['iso27001'],
            [/statement of applicability|\bsoa\b/i], { expected: true, refs: { iso27001: ['6.1.3'] } }),
        T('isms-access', 'Access control and the joiner-mover-leaver lifecycle', ['iso27001'],
            [/access control|user access|identity|joiner|leaver|privileged/i], { expected: true, refs: { iso27001: ['A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.6.1', 'A.6.5', 'A.8.2', 'A.8.5'] } }),
        T('isms-cloud', 'Cloud services security', ['iso27001'],
            [/cloud (security|services?|policy)|shared responsibility/i], { expected: true, refs: { iso27001: ['A.5.23'] } }),
        T('isms-supplier', 'Supplier and ICT supply chain security', ['iso27001'],
            [/supplier|vendor|third[- ]party/i], { expected: true, refs: { iso27001: ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.6.6'] } }),
        T('isms-vuln', 'Technical vulnerability and patch management', ['iso27001'],
            [/vulnerab|patch(ing)? |patch management/i], { expected: true, process: [/patch|vulnerab/i], refs: { iso27001: ['A.8.8', 'A.5.7', 'A.8.9'] } }),
        T('isms-incident', 'Information security incident management', ['iso27001'],
            [/security incident|information security incident|incident response/i], { expected: true, refs: { iso27001: ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.6.8'] } }),
        T('isms-backup', 'Backup, logging and monitoring', ['iso27001'],
            [/backup|restor|logging|log management|monitoring policy|siem/i], { expected: true, process: [/backup|recovery/i], refs: { iso27001: ['A.8.13', 'A.8.14', 'A.8.15', 'A.8.16'] } }),
        T('isms-crypto', 'Cryptography and secure configuration', ['iso27001'],
            [/cryptograph|encryption|key management|hardening|secure configuration/i], { expected: true, refs: { iso27001: ['A.8.24', 'A.8.9', 'A.8.20'] } }),

        // ── ISO 22301 ──
        T('bcms-bia', 'Business impact analysis', ['iso22301'],
            [/business impact|\bbia\b|impact analysis/i], { expected: true, refs: { iso22301: ['8.2.2'] } }),
        T('bcms-risk', 'Business continuity risk assessment', ['iso22301'],
            [/continuity risk|bc risk|business continuity risk|disruption risk|risk assessment/i], { expected: true, refs: { iso22301: ['8.2.3'] } }),
        T('bcms-strategy', 'Business continuity strategies and solutions', ['iso22301'],
            [/continuity strateg|recovery strateg|continuity solution/i], { expected: true, refs: { iso22301: ['8.3'] } }),
        T('bcms-plans', 'Business continuity plans and response structure', ['iso22301'],
            [/continuity plan|\bbcp\b|disaster recovery plan|\bdrp\b|business continuity (procedure|plan)|crisis|incident response plan/i], { expected: true, refs: { iso22301: ['8.4', '8.4.2', '8.4.3'] } }),
        T('bcms-exercise', 'Exercise programme and evaluation', ['iso22301'],
            [/exercise|drill|continuity test|dr test|post[- ]exercise/i], { expected: true, refs: { iso22301: ['8.5', '8.6'] } }),
        T('bcms-disruption', 'Actual disruptions and invocation', ['iso22301'],
            [/invocation|disruption report|post[- ]incident review/i], { refs: { iso22301: ['10.1'] } }),

        // ── ISO/IEC 20000-1 ──
        T('sms-slm', 'Service level management and service catalogue', ['iso20000'],
            [/service level|\bsla\b|service catalogue|service catalog/i], { expected: true, refs: { iso20000: ['8.3.3', '8.2.4'] } }),
        T('sms-incident', 'Incident management', ['iso20000'],
            [/incident management|incident (handling|process)|major incident/i], { expected: true, process: [/incident/i, /service desk/i], refs: { iso20000: ['8.6.1'] } }),
        T('sms-request', 'Service request management', ['iso20000'],
            [/service request|request fulfil/i], { expected: true, process: [/service desk/i], refs: { iso20000: ['8.6.2'] } }),
        T('sms-problem', 'Problem management', ['iso20000'],
            [/problem management|known error/i], { expected: true, process: [/problem/i], refs: { iso20000: ['8.6.3'] } }),
        T('sms-change', 'Change management', ['iso20000'],
            [/change management|change (control|process)|configuration and change/i], { expected: true, process: [/change/i], refs: { iso20000: ['8.5.1'] } }),
        T('sms-release', 'Release and deployment management', ['iso20000'],
            [/release|deployment/i], { expected: true, refs: { iso20000: ['8.5.3'] } }),
        T('sms-config', 'Configuration and asset management', ['iso20000'],
            [/configuration management|\bcmdb\b|asset management|asset register/i], { expected: true, process: [/configuration/i], refs: { iso20000: ['8.2.5', '8.2.6'] } }),
        T('sms-capacity', 'Capacity and availability management', ['iso20000'],
            [/capacity|availability/i], { expected: true, process: [/capacity|availability|performance monitoring/i], refs: { iso20000: ['8.4.3', '8.7.1'] } }),
        T('sms-continuity', 'Service continuity management', ['iso20000'],
            [/service continuity|continuity of service/i], { expected: true, refs: { iso20000: ['8.7.2'] } }),
        T('sms-supplier', 'Supplier management and parties in the service lifecycle', ['iso20000'],
            [/supplier|vendor|third[- ]party/i], { expected: true, refs: { iso20000: ['8.3.4', '8.2.3'] } }),
        T('sms-brm', 'Business relationship management and customer satisfaction', ['iso20000'],
            [/customer satisfaction|business relationship|complaint|customer survey/i], { expected: true, refs: { iso20000: ['8.3.2'] } }),
        T('sms-reporting', 'Service reporting', ['iso20000'],
            [/service report|performance report|monthly report|reporting procedure/i], { expected: true, process: [/performance monitoring|reporting/i], refs: { iso20000: ['9.4'] } }),
        T('sms-security', 'Information security within the SMS', ['iso20000'],
            [/information security/i], { refs: { iso20000: ['8.7.3'] } }),
        T('sms-budget', 'Budgeting and accounting for services', ['iso20000'],
            [/budget|accounting|service cost|financial management/i], { expected: true, refs: { iso20000: ['8.4.1'] } }),
        T('sms-demand', 'Demand management', ['iso20000'],
            [/demand management|demand forecast/i], { expected: true, refs: { iso20000: ['8.4.2'] } }),
        T('sms-delivery', 'Service delivery and planning the services', ['iso20000'],
            [/service delivery|service plan|plan the services/i], { refs: { iso20000: ['8.2.1', '8.2.2'] } }),
        T('sms-design', 'Service design and transition', ['iso20000'],
            [/service design|transition/i], { refs: { iso20000: ['8.5.2'] } }),
        T('sms-knowledge', 'Knowledge', ['iso20000'],
            [/knowledge (management|base)/i], { refs: { iso20000: ['7.6'] } }),

        // ── Shared management-system requirements (Annex SL) ──
        T('ims-context', 'Context of the organization and interested parties', ALL3,
            [/context of the organi[sz]ation|interested part|needs and expectations/i], { expected: true, refs: { iso27001: ['4.1', '4.2'], iso22301: ['4.1', '4.2'], iso20000: ['4.1', '4.2'] } }),
        T('ims-scope', 'Scope of the management system', ALL3,
            [/\bscope\b/i], { refs: { iso27001: ['4.3'], iso22301: ['4.3'], iso20000: ['4.3'] } }),
        T('ims-policy', 'Policy', ALL3,
            [/\bpolic(y|ies)\b/i], { expected: true, refs: { iso27001: ['5.2'], iso22301: ['5.2'], iso20000: ['5.2'] } }),
        T('ims-risk-actions', 'Actions to address risks and opportunities', ALL3,
            [/risk (assessment|management)|risks? and opportunit/i], { expected: true, refs: { iso27001: ['6.1.1'], iso22301: ['6.1'], iso20000: ['6.1'] } }),
        T('ims-objectives', 'Objectives', ALL3,
            [/objective/i], { expected: true, refs: { iso27001: ['6.2'], iso22301: ['6.2'], iso20000: ['6.2'] } }),
        T('ims-competence', 'Competence and training', ALL3,
            [/competence|training/i], { expected: true, refs: { iso27001: ['7.2'], iso22301: ['7.2'], iso20000: ['7.2'] } }),
        T('ims-awareness', 'Awareness', ALL3,
            [/awareness/i], { expected: true, refs: { iso27001: ['7.3'], iso22301: ['7.3'], iso20000: ['7.3'] } }),
        T('ims-communication', 'Communication', ALL3,
            [/communication/i], { expected: true, refs: { iso27001: ['7.4'], iso22301: ['7.4'], iso20000: ['7.4'] } }),
        T('ims-docinfo', 'Control of documented information', ALL3,
            [/document control|control of documents|documented information|records? control/i], { expected: true, refs: { iso27001: ['7.5'], iso22301: ['7.5'], iso20000: ['7.5'] } }),
        T('ims-internal-audit', 'Internal audit', ALL3,
            [/internal audit/i], { expected: true, refs: { iso27001: ['9.2'], iso22301: ['9.2'], iso20000: ['9.2'] } }),
        T('ims-mgmt-review', 'Management review', ALL3,
            [/management review/i], { expected: true, refs: { iso27001: ['9.3'], iso22301: ['9.3'], iso20000: ['9.3'] } }),
        T('ims-nonconformity', 'Nonconformity and corrective action', ALL3,
            [/nonconformity|non-conformity|corrective action|\bcapa\b/i], { expected: true, refs: { iso27001: ['10.2'], iso22301: ['10.1'], iso20000: ['10.1'] } }),
        T('ims-improvement', 'Continual improvement', ALL3,
            [/continual improvement|process optimi[sz]ation/i], { expected: true, process: [/continual improvement/i], refs: { iso27001: ['10.1'], iso22301: ['10.2'], iso20000: ['10.2'] } })
    ];

    const BY_ID = {};
    TOPICS.forEach(function (t) { BY_ID[t.id] = t; });

    // The registry's shared concepts and process-theme ids -> a topic here.
    const ALIASES = {
        'context.issues': 'ims-context', 'context.parties': 'ims-context', 'context.scope': 'ims-scope',
        'context.system': 'ims-scope', 'leadership.policy': 'ims-policy', 'planning.risk-actions': 'ims-risk-actions',
        'planning.objectives': 'ims-objectives', 'support.competence': 'ims-competence',
        'support.awareness': 'ims-awareness', 'support.communication': 'ims-communication',
        'support.documented-information': 'ims-docinfo', 'performance.internal-audit': 'ims-internal-audit',
        'performance.management-review': 'ims-mgmt-review',
        'improvement.nonconformity-corrective-action': 'ims-nonconformity', 'improvement.continual': 'ims-improvement'
    };

    function resolveTopic(id) {
        if (!id) return null;
        return BY_ID[id] || BY_ID[ALIASES[id]] || null;
    }

    /** Topics a requirement belongs to, by its own standard — never by number alone. */
    function topicsForRef(stdId, ref) {
        const r = str(ref);
        return TOPICS.filter(function (t) {
            const list = t.refs[stdId];
            return list && list.some(function (x) { return x === r; });
        }).map(function (t) { return t.id; });
    }

    // ── Document profile ──────────────────────────────────────────────

    const NUMBER_PREFIX = [
        [/^ISMS[-\s]/i, 'iso27001'], [/^BCMP?[-\s]/i, 'iso22301'], [/^BCMS[-\s]/i, 'iso22301'],
        [/^ITSM[-\s]/i, 'iso20000'], [/^SMS[-\s]/i, 'iso20000']
    ];
    const TITLE_STANDARD = [
        [/(?:for|per|iso(?:\/iec)?)\s*27001|\bisms\b|information security (?:management|policies|policy|manual)/i, 'iso27001'],
        [/(?:for|per|iso)\s*22301|\bbcms\b|business continuity management|business continuity (?:awareness|policy)/i, 'iso22301'],
        [/(?:for|per|iso(?:\/iec)?)\s*20000|\bitsms\b|\bitsm\b|it service management/i, 'iso20000']
    ];
    const TYPE_RULES = [
        ['template', /\btemplate\b|\bblank\b|\bboilerplate\b/i],
        ['record', /\bminutes\b|\bmins\b|\breport\b|\brecord\b|\blog\b|\bticket\b|^TK[-\s]?\d+/i],
        ['plan', /\bplan\b/i],
        ['policy', /\bpolic(y|ies)\b|\bmanual\b/i],
        ['procedure', /\bprocedure\b|\bsop\b|\bprocess\b|\bwork instruction\b/i]
    ];
    // What document type best evidences a topic; used only to rank.
    const PREFERRED = {
        'bcms-bia': ['procedure', 'record', 'plan'], 'bcms-plans': ['plan', 'procedure'], 'ims-policy': ['policy'],
        'isms-soa': ['record', 'policy'], 'ims-internal-audit': ['procedure', 'record'], 'ims-mgmt-review': ['procedure', 'record']
    };

    function classifyType(doc) {
        const hay = [doc.name, doc.category, doc.type].map(str).join(' ');
        for (let i = 0; i < TYPE_RULES.length; i++) if (TYPE_RULES[i][1].test(hay)) return TYPE_RULES[i][0];
        return 'document';
    }

    function statedStandards(doc) {
        const explicit = csv(doc.linkedStandards).concat(csv(doc.applicableStandards));
        if (explicit.length) return { ids: Array.from(new Set(explicit.map(normalizeStd))).filter(Boolean), basis: 'metadata' };
        const number = str(doc.docNumber);
        for (let i = 0; i < NUMBER_PREFIX.length; i++) {
            if (NUMBER_PREFIX[i][0].test(number)) return { ids: [NUMBER_PREFIX[i][1]], basis: 'document-number' };
        }
        const title = str(doc.name);
        const hits = [];
        TITLE_STANDARD.forEach(function (p) { if (p[0].test(title) && hits.indexOf(p[1]) === -1) hits.push(p[1]); });
        if (hits.length) return { ids: hits, basis: 'title' };
        return { ids: [], basis: 'unstated' };
    }

    function normalizeStd(v) {
        const s = lower(v);
        if (/^iso(27001|22301|20000)$/.test(s)) return s;
        if (/27001/.test(s)) return 'iso27001';
        if (/22301/.test(s)) return 'iso22301';
        if (/20000/.test(s)) return 'iso20000';
        return '';
    }

    function classifyTopics(doc) {
        const explicit = csv(doc.topics).map(function (t) { return resolveTopic(t) && resolveTopic(t).id; }).filter(Boolean);
        if (explicit.length) return { ids: Array.from(new Set(explicit)), basis: 'metadata' };
        const title = str(doc.name);
        const ids = TOPICS.filter(function (t) { return t.kw.some(function (re) { return re.test(title); }); }).map(function (t) { return t.id; });
        return { ids: ids, basis: ids.length ? 'title-keywords' : 'unclassified' };
    }

    function usable(doc) {
        const status = lower(doc.status);
        if (/obsolete|superseded|withdrawn|archived|retired|draft/.test(status)) return 'status is ' + status;
        return '';
    }

    /**
     * Structured metadata for one document, with how each fact was established.
     * @param {Object} doc
     * @param {Object} [client] - its keyProcesses tie an SOP to a process
     */
    function profile(doc, client) {
        const d = doc || {};
        let std = statedStandards(d);
        const topics = classifyTopics(d);
        // Nothing stated by metadata, number or title. If EVERY topic the title
        // names is inherent to one standard ("security incident" is an ISMS
        // subject), that is a controlled inference — weaker than a stated
        // applicability, and refused the moment the title spans domains
        // ("risk assessment", "supplier" and "internal audit" belong to several).
        if (!std.ids.length && topics.ids.length) {
            const domainStds = new Set();
            topics.ids.forEach(function (id) { BY_ID[id].std.forEach(function (x) { domainStds.add(x); }); });
            if (domainStds.size === 1) std = { ids: Array.from(domainStds), basis: 'topic-domain' };
        }
        const type = classifyType(d);
        const name = lower(d.name);
        const norm = function (s) { return lower(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
        const processes = arr(client && client.keyProcesses).map(function (p) { return str(p && p.name); }).filter(Boolean)
            .filter(function (p) {
                const words = norm(p).split(' ').filter(function (w) { return w.length > 2; });
                return words.length && words.every(function (w) { return norm(name).indexOf(w) !== -1; });
            });
        return {
            id: d.id != null ? String(d.id) : str(d.name), name: str(d.name), docNumber: str(d.docNumber), revision: str(d.revision),
            standards: std.ids, standardBasis: std.basis, integrated: std.ids.length > 1,
            topics: topics.ids, topicBasis: topics.basis, type: type,
            domain: std.ids.length === 1 ? DOMAIN_OF[std.ids[0]] : (std.ids.length > 1 ? 'integrated' : 'unstated'),
            processes: processes,
            processDocument: processes.length > 0 && (type === 'procedure' || type === 'policy' || /\bsop\b|process/i.test(name)),
            usableProblem: usable(d),
            linkedClauses: csv(d.linkedClauses)
        };
    }

    function tokenSet(text) {
        return new Set(lower(text).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; }));
    }
    function jaccard(a, b) {
        if (!a.size || !b.size) return 0;
        let inter = 0;
        a.forEach(function (x) { if (b.has(x)) inter++; });
        return inter / (a.size + b.size - inter);
    }

    /**
     * Rank documents for a question.
     *
     * @param {Array} docs
     * @param {Object} q - { topic, refs:[{stdId,ref}], client, text }
     * @returns {{validated:Array, rejected:Array, expected:boolean, topic:string|null}}
     */
    function rank(docs, q) {
        const query = q || {};
        const refs = arr(query.refs).filter(function (r) { return r && r.stdId && r.ref; });
        let topic = resolveTopic(query.topic);
        const topicIds = topic ? [topic.id] : Array.from(new Set(refs.reduce(function (acc, r) { return acc.concat(topicsForRef(r.stdId, r.ref)); }, [])));
        const topics = topicIds.map(function (id) { return BY_ID[id]; }).filter(Boolean);
        const stds = Array.from(new Set(refs.map(function (r) { return r.stdId; })));
        const out = { validated: [], rejected: [], expected: topics.some(function (t) { return t.expected; }), topic: topics[0] ? topics[0].id : null };
        if (!topics.length) return out; // nothing to judge relevance against: no recommendation
        const qTokens = tokenSet((query.text || '') + ' ' + topics.map(function (t) { return t.label; }).join(' '));

        arr(docs).forEach(function (raw) {
            if (!raw || !raw.name) return;
            const p = profile(raw, query.client);
            const reasons = [];
            if (p.usableProblem) reasons.push('Document ' + p.usableProblem + '.');
            if (p.type === 'template') reasons.push('A blank template is not evidence.');

            // Topic gate: the document must be about what the question is about.
            const relatedIds = topics.reduce(function (acc, t) { return acc.concat([t.id], t.related); }, []);
            const topicHit = p.topics.filter(function (id) { return relatedIds.indexOf(id) !== -1; });
            if (!topicHit.length) reasons.push('Its subject (' + (p.topics.map(function (id) { return BY_ID[id].label; }).join('; ') || 'unclassified') + ') is not ' + topics.map(function (t) { return t.label; }).join(' / ') + '.');

            // Standard gate.
            let standardOk = false;
            let via = '';
            if (stds.length === 0) {
                standardOk = false;
                reasons.push('The question is not tied to a standard.');
            } else if (p.standards.length) {
                const shared = stds.filter(function (s) { return p.standards.indexOf(s) !== -1; });
                if (shared.length) {
                    standardOk = true;
                    via = p.integrated ? 'integrated document stated for ' + shared.map(function (s) { return STD_LABEL[s]; }).join(', ')
                        : (p.standardBasis === 'topic-domain' ? 'subject specific to ' : 'stated for ') + STD_LABEL[shared[0]];
                    if (p.processDocument) via += ' · client process SOP: ' + p.processes[0];
                }
                else reasons.push((p.standardBasis === 'topic-domain' ? 'Its subject belongs to ' : 'Stated for ') + p.standards.map(function (s) { return STD_LABEL[s]; }).join(', ') + ' — not ' + stds.map(function (s) { return STD_LABEL[s]; }).join(', ') + '; no approved cross-standard applicability.');
            } else if (p.processDocument && topics.some(function (t) { return t.process.some(function (re) { return p.processes.some(function (proc) { return re.test(proc); }); }); })) {
                standardOk = true; via = 'client process SOP: ' + p.processes[0];
            } else {
                reasons.push('States no applicable standard, so it is not assumed to apply to this one.');
            }

            if (reasons.length || !standardOk) { out.rejected.push({ doc: raw, profile: p, reasons: reasons }); return; }

            // Ranking only — never overrides a gate.
            let score = 5 + (p.topicBasis === 'metadata' ? 2 : 0);
            score += p.standardBasis === 'metadata' ? 3 : p.standardBasis === 'document-number' ? 2 : p.standardBasis === 'title' ? 1.5 : 1;
            if (p.standardBasis === 'topic-domain') score -= 0.5; // inferred, not stated
            const pref = topics.reduce(function (acc, t) { return acc.concat(PREFERRED[t.id] || []); }, []);
            if (pref.indexOf(p.type) !== -1) score += 1;
            if (p.revision) score += 0.5;
            const exactClause = refs.some(function (r) { return p.linkedClauses.indexOf(r.ref) !== -1; });
            if (exactClause) score += 1;
            score += 2 * jaccard(qTokens, tokenSet(p.name));
            out.validated.push({ doc: raw, profile: p, score: score, via: via });
        });
        out.validated.sort(function (a, b) { return b.score - a.score || a.profile.name.localeCompare(b.profile.name); });
        return out;
    }

    function docLabel(doc) {
        const bits = [doc.docNumber, doc.revision].filter(Boolean).join(' ');
        return bits ? doc.name + ' (' + bits + ')' : doc.name;
    }

    /**
     * The sentence appended to a checklist question.
     *  - validated documents  -> "Documented information on file that should support this: …"
     *  - none, but one is expected for this topic -> "No validated supporting document mapped — auditor to select or confirm."
     *  - none, none expected  -> '' (silence is right: the question is an interview or observation)
     */
    function hint(docs, refs, opts) {
        const o = opts || {};
        const r = rank(docs, { topic: o.topic, refs: refs, client: o.client, text: o.text });
        if (r.validated.length) {
            const list = r.validated.slice(0, o.cap || 3).map(function (v) { return docLabel(v.doc); });
            return ' Documented information on file that should support this: ' + list.join('; ') + '.';
        }
        if (r.expected) return ' ' + NO_VALIDATED_DOCUMENT + AUDITOR_CONFIRM;
        return '';
    }

    const API = { NO_VALIDATED_DOCUMENT, TOPICS, resolveTopic, topicsForRef, profile, rank, hint, docLabel };
    global.SupportingDocs = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'supporting-docs.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

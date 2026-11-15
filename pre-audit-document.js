// ============================================
// PRE-AUDIT REVIEW DOCUMENT  (window.PreAuditDocument)
// ============================================
// The printable record of the document review done before an audit, in the
// same controlled layout as the audit plan and checklist (PrintShell page
// rules, masthead, running header/footer, "Page X of Y"; DocFormat dates).
//
// It replaces a stand-alone popup that had its own gradient cover, loaded Font
// Awesome from a CDN, printed numeric dates, relied on an inline script the CSP
// blocks, and called EVERY review an "ISO 17021-1 Stage 1 Assessment" that
// decides "readiness for the Stage 2 on-site audit" — wrong for surveillance,
// recertification and remote audits.
//
// Also the single source of the review's items and wording, so the on-screen
// form and the printed record cannot disagree.
//
// Pure: data in, HTML out.
//   PreAuditDocument.items(plan)      -> [{id, label, category}]
//   PreAuditDocument.wording(plan)    -> labels that depend on the audit type
//   PreAuditDocument.build(plan, ctx) -> full HTML document

(function (global) {
    'use strict';

    const need = function (name, file) { return global[name] || (typeof require === 'function' ? require(file) : null); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const PS = function () { return need('PrintShell', './print-shell.js'); };

    function arr(v) { return Array.isArray(v) ? v : []; }
    function plain(v) { return DF().decodeEntities(v == null ? '' : String(v)); }
    function t(v) { return DF().escapeHtml(plain(v)); }
    /** Escaped text with its line breaks kept. */
    function tLines(v) { return t(v).replace(/\r?\n/g, '<br>'); }

    const CATEGORIES = ['Documentation', 'Compliance', 'Readiness'];

    // Ids are stored on plan.preAudit.documentReview: never rename one.
    const BASE_ITEMS = [
        { id: 'scope', label: 'Management System Scope', category: 'Documentation' },
        { id: 'processes', label: 'Process Identification & Interaction', category: 'Documentation' },
        { id: 'legal', label: 'Legal & Statutory Requirements', category: 'Compliance' },
        { id: 'objectives', label: 'Objectives & Planning to Achieve Them', category: 'Documentation' },
        { id: 'resources', label: 'Resource Availability (Personnel, Infrastructure)', category: 'Readiness' },
        { id: 'competence', label: 'Competence & Training Records', category: 'Compliance' },
        { id: 'documented_info', label: 'Documented Information Control', category: 'Documentation' },
        { id: 'internal_audit', label: 'Internal Audit Program', category: 'Compliance' },
        { id: 'management_review', label: 'Management Review Evidence', category: 'Compliance' },
        { id: 'corrective_action', label: 'Corrective Action Process', category: 'Compliance' },
        { id: 'risks_opportunities', label: 'Risk & Opportunity Management', category: 'Documentation' },
        { id: 'monitoring', label: 'Monitoring & Measurement Methods', category: 'Compliance' },
        { id: 'context', label: 'Organizational Context & Interested Parties', category: 'Documentation' },
        { id: 'leadership', label: 'Leadership & Commitment Evidence', category: 'Documentation' },
        { id: 'communication', label: 'Internal & External Communication', category: 'Documentation' },
        { id: 'site_readiness', label: '', category: 'Readiness' }
    ];

    function auditTypeOf(plan) { return String((plan && (plan.auditType || plan.type)) || '').trim(); }

    /** Initial certification: the review IS the Stage 1 audit and decides on Stage 2. */
    function isInitial(plan) {
        const type = auditTypeOf(plan);
        return !type || /stage\s*[12]|initial/i.test(type);
    }

    function isRemote(plan) { return /remote/i.test(String(plan && plan.auditMethod || '')); }

    /** Every label that depends on the audit type and method. */
    function wording(plan) {
        const type = auditTypeOf(plan);
        if (isInitial(plan)) {
            return {
                initial: true,
                reviewName: 'Stage 1 review',
                formTitle: 'Pre-Audit Review (Stage 1)',
                docTitle: 'Stage 1 Review Report',
                auditLabel: 'Stage 2 audit',
                purpose: 'This record documents the Stage 1 audit: a review of the organization’s management system documentation, '
                    + 'carried out under ISO/IEC 17021-1 to determine whether the organization is ready for the Stage 2 audit.',
                readyLabel: 'Ready for Stage 2',
                siteReadinessLabel: 'Site Readiness for Stage 2 Audit'
            };
        }
        const label = (type || 'audit').replace(/\s*audit\s*$/i, '') + ' audit';
        return {
            initial: false,
            reviewName: 'Pre-audit review',
            formTitle: 'Pre-Audit Review (' + label + ')',
            docTitle: 'Pre-Audit Review Report',
            auditLabel: label,
            purpose: 'This record documents the review of the organization’s documented information carried out when planning the '
                + label + ' under ISO/IEC 17021-1. It covers changes since the previous audit and records whether the audit can go ahead as planned.',
            readyLabel: 'Ready for the audit',
            siteReadinessLabel: isRemote(plan)
                ? 'Remote Audit Readiness (Access, Systems, People)'
                : 'Site Readiness for the Audit'
        };
    }

    function items(plan) {
        const w = wording(plan);
        return BASE_ITEMS.map(function (i) {
            return i.id === 'site_readiness' ? Object.assign({}, i, { label: w.siteReadinessLabel }) : Object.assign({}, i);
        });
    }

    function decisionText(decision, w) {
        if (decision === 'Ready') return w.readyLabel;
        if (decision === 'Conditional') return 'Conditionally ready';
        if (decision === 'Not Ready') return 'Not ready';
        return 'Decision not recorded';
    }
    function decisionClass(decision) {
        if (decision === 'Ready') return 'status-approved';
        if (decision === 'Not Ready') return 'status-refused';
        return 'status-draft';
    }

    const RESULT = {
        ok: { text: 'OK', cls: 'ok' },
        minor: { text: 'Minor', cls: 'warn' },
        major: { text: 'Major', cls: 'bad' }
    };

    const CSS = [
        '.status-line{margin:0 0 6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}',
        '.status-pill{display:inline-block;padding:1px 10px;border-radius:12px;font-size:8.5pt;font-weight:700;border:1px solid}',
        '.status-draft{background:#fffbeb;color:#92400e;border-color:#fcd34d}',
        '.status-approved{background:#f0fdf4;color:#166534;border-color:#86efac}',
        '.status-refused{background:#fef2f2;color:#991b1b;border-color:#fca5a5}',
        '.meta-table{margin:2px 0 4px;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}',
        '.meta-table td{padding:4px 8px 4px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:8.8pt;line-height:1.35}',
        '.meta-table tr:last-child td{border-bottom:0}',
        '.meta-table td.mk{width:19%;padding-top:5px}',
        '.meta-table td.mv{width:31%;padding-right:14px}',
        '.meta-label{display:block;font-weight:700;color:#64748b;font-size:7.2pt;text-transform:uppercase;letter-spacing:.05em;line-height:1.35}',
        '.pd-section-title{display:flex;align-items:center;gap:7px;color:#0f2a43;font-weight:700;font-size:9.5pt;letter-spacing:.05em;margin:12px 0 5px;padding:0 0 3px;border-bottom:1.2pt solid #0f2a43}',
        '.pd-section-title .no{display:inline-block;min-width:17px;padding:1px 4px;text-align:center;background:#0f2a43;color:#fff;border-radius:3px;font-size:8pt;letter-spacing:0;line-height:1.3}',
        '.pd-subhead{font-weight:700;font-size:8.2pt;color:#0f2a43;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 2px;break-after:avoid;page-break-after:avoid}',
        '.purpose{font-size:9pt;line-height:1.5;margin:0 0 6px;color:#334155}',
        '.decision-box{border-left:3px solid #0f2a43;background:#f8fafc;padding:6px 10px;font-size:9pt;line-height:1.5;margin:4px 0 3px}',
        'table.grid{margin:4px 0 10px;table-layout:fixed}',
        'table.grid th{background:#f1f5f9;text-align:left;padding:5px 7px;border-bottom:2px solid #cbd5e1;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#334155}',
        'table.grid td{padding:5px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:8.5pt;overflow-wrap:break-word}',
        'table.grid tr.catband th{background:#0f2a43;color:#fff;font-size:8.6pt;text-transform:none;letter-spacing:.02em;padding:4px 7px;border-bottom:0}',
        'table.grid td.res{font-weight:700;white-space:nowrap}',
        'table.grid td.nt{color:#475569;font-size:8.2pt}',
        '.note{font-size:8.5pt;color:#475569;margin:4px 0}',
        'ul.bul,ol.bul{margin:2px 0 6px;padding-left:16px}',
        'ul.bul li,ol.bul li{margin:0 0 1px;font-size:8.8pt;line-height:1.4}',
        '.ok{color:#166534}.bad{color:#b91c1c}.warn{color:#92400e}.muted{color:#64748b;font-weight:400}'
    ].join('\n');

    /**
     * @param {Object} plan  the audit plan, with plan.preAudit
     * @param {Object} ctx   { client, brand:{name,logoUrl}, planRef, classification, leadAuditor }
     */
    function build(plan, ctx) {
        const c = ctx || {};
        const p = plan || {};
        const pa = p.preAudit || {};
        const review = pa.documentReview || {};
        const df = DF(); const shell = PS();
        const w = wording(p);
        const list = items(p);
        const clientName = plain(c.client && c.client.name || p.client);
        const ref = c.planRef || ('PLN-' + String(p.id || '').slice(0, 8));
        const typeLabel = auditTypeOf(p) || 'Not recorded';
        const scheduled = p.date ? df.formatDateRange(p.date, p.endDate) : 'Not yet booked';
        const completed = pa.completedDate ? df.formatDate(pa.completedDate) : '';
        const reviewStatus = pa.status === 'Complete' ? 'Complete' : (pa.status || 'Not started');

        const meta = function (label, value) { return '<td class="mk"><span class="meta-label">' + t(label) + '</span></td><td class="mv">' + value + '</td>'; };
        const wide = function (label, value) { return '<tr><td class="mk"><span class="meta-label">' + t(label) + '</span></td><td class="mv" colspan="3">' + value + '</td></tr>'; };
        const pair = function (a, b) { return '<tr>' + a + (b || '<td class="mk"></td><td class="mv"></td>') + '</tr>'; };

        const metaTable = '<table class="meta-table">'
            + pair(meta('Client', t(clientName)), meta('Audit type', t(typeLabel)))
            + wide('Audit standards', t(p.standard || 'Not recorded'))
            + pair(meta('Scheduled audit', t(scheduled)), meta('Audit method', t(p.auditMethod || 'Not recorded')))
            + pair(meta('Review status', t(reviewStatus)), meta('Review completed', completed ? t(completed) : '<span class="muted">Not completed</span>'))
            + pair(meta('Reviewed by', t(pa.completedBy || 'Not recorded')), meta('Lead Auditor', t(c.leadAuditor || p.leadAuditor || arr(p.team)[0] || 'Not assigned')))
            + '</table>';

        let n = 0;
        const section = function (title) { n += 1; return '<div class="pd-section-title"><span class="no">' + n + '</span>' + title + '</div>'; };

        // 1. Decision
        const decision = pa.readinessDecision || '';
        const summary = String(pa.notes || '').trim();
        const decisionSection = section('READINESS DECISION')
            + '<p class="purpose">' + t(w.purpose) + '</p>'
            + '<p class="status-line"><span class="status-pill ' + decisionClass(decision) + '">' + t(decisionText(decision, w)) + '</span></p>'
            + (summary ? '<div class="decision-box">' + tLines(summary) + '</div>' : '<p class="note bad">No summary or recommendations recorded.</p>');

        // 2. Findings from the document review, when the review produced them
        const s = pa.aiSummary;
        const focus = arr(pa.focusPoints).filter(Boolean);
        const block = function (title, value) {
            const vals = (Array.isArray(value) ? value : (value ? [value] : [])).filter(Boolean);
            return vals.length ? '<div class="pd-subhead">' + t(title) + '</div><ul class="bul">' + vals.map(function (v) { return '<li>' + t(v) + '</li>'; }).join('') + '</ul>' : '';
        };
        const findingsBody = s ? (block('New or changed processes', s.newOrChangedProcesses)
            + block('Documents updated', s.documentsUpdated)
            + block('Competence and training records', s.trainingRecords)
            + block('Last management review', s.managementReview)
            + block('Last internal audit', s.internalAudit)
            + block('Most likely findings', s.keyRisks)) : '';
        const focusBody = focus.length
            ? '<div class="pd-subhead">Points this audit must cover</div><ol class="bul">' + focus.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ol>'
                + '<p class="note">These are carried into the audit checklist as an Audit Focus section.</p>'
            : '';
        const findingsSection = (findingsBody || focusBody)
            ? section('DOCUMENT REVIEW FINDINGS') + '<p class="note">Established from the documented information supplied by the client before the audit.</p>' + findingsBody + focusBody
            : '';

        // 3. Item-by-item results
        const counts = { ok: 0, minor: 0, major: 0, none: 0 };
        list.forEach(function (i) { const st = (review[i.id] || {}).status; counts[RESULT[st] ? st : 'none'] += 1; });
        const countLine = '<p class="note">' + list.length + ' items: '
            + '<span class="ok">' + counts.ok + ' OK</span> · <span class="warn">' + counts.minor + ' minor</span> · <span class="bad">' + counts.major + ' major</span> · '
            + counts.none + ' not reviewed.</p>';
        const resultTables = CATEGORIES.map(function (cat) {
            const rows = list.filter(function (i) { return i.category === cat; });
            if (!rows.length) return '';
            return '<table class="grid"><colgroup><col style="width:32%"><col style="width:12%"><col style="width:56%"></colgroup>'
                + '<thead><tr class="catband"><th colspan="3">' + t(cat) + '</th></tr><tr><th>Item</th><th>Result</th><th>Notes</th></tr></thead><tbody>'
                + rows.map(function (i) {
                    const r = review[i.id] || {};
                    const res = RESULT[r.status];
                    return '<tr><td>' + t(i.label) + '</td>'
                        + '<td class="res ' + (res ? res.cls : 'muted') + '">' + (res ? res.text : 'Not reviewed') + '</td>'
                        + '<td class="nt">' + (String(r.notes || '').trim() ? tLines(r.notes) : '—') + '</td></tr>';
                }).join('')
                + '</tbody></table>';
        }).join('');
        const resultsSection = section('REVIEW RESULTS') + countLine + resultTables;

        const body = shell.masthead({ brandName: c.brand && c.brand.name, logoUrl: c.brand && c.brand.logoUrl, title: w.docTitle, subtitle: 'Ref: ' + ref + ' · ' + clientName })
            + metaTable + decisionSection + findingsSection + resultsSection;

        return shell.buildDocument({
            title: w.docTitle + ' - ' + clientName,
            header: { left: plain(c.brand && c.brand.name || 'Audit360'), center: clientName, right: ref + ' · ' + typeLabel },
            footer: { left: c.classification ? plain(c.classification) : w.docTitle + ' · internal record', center: plain(scheduled) },
            bodyHtml: body, extraCss: shell.MASTHEAD_CSS + '\n' + CSS
        });
    }

    const API = { CATEGORIES, items, wording, isInitial, decisionText, build };
    global.PreAuditDocument = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'pre-audit-document.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

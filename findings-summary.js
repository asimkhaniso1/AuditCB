// ============================================
// FINDINGS SUMMARY  (window.FindingsSummary)
// ============================================
// The paper the lead auditor hands over at the closing meeting
// (ISO/IEC 17021-1 9.4.7): every finding of the audit with its grade,
// criterion, objective evidence and statement, what the client has to send
// back and by when, and a sign-off confirming the findings were presented
// and understood.
//
// It is PRELIMINARY by design: the audit report is the formal record. The
// findings come from window.collectAuditFindings, the list the Findings tab
// shows, so the references (NCR-001, OBS-002, OFI-001) on paper match the
// screen. Each part is printed only from what was recorded; a missing part
// prints as "not recorded", never as generated text. The audit team does not
// prescribe solutions, so nothing here suggests one.
//
// CONTRACT
//   FindingsSummary.build(ctx)                 -> HTML string (pure)
//   FindingsSummary.context(reportId, state)   -> ctx | null   (reads state)
//   FindingsSummary.gradeLabel(catKey)         -> 'Minor nonconformity' …
//   window.printFindingsSummary(reportId)      -> opens the print window
//   window.setFindingsResponseDue(reportId, isoDate)

(function (global) {
    'use strict';

    const need = function (name, file) { return global[name] || (typeof require === 'function' ? require(file) : null); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const PS = function () { return need('PrintShell', './print-shell.js'); };
    const RS = function () { return global.ReportStats || null; };

    function arr(v) { return Array.isArray(v) ? v : []; }
    function plain(v) { return DF().decodeEntities(v == null ? '' : String(v)); }
    function t(v) { return DF().escapeHtml(plain(v)); }
    function str(v) { return v == null ? '' : String(v).trim(); }

    // Mechanical clean-up only (spacing, capital, full stop): the auditor's
    // words are never reworded. Same normaliser the audit report uses.
    function clean(v) {
        const s = str(v);
        if (!s) return '';
        const rs = RS();
        return rs && typeof rs.cleanEvidenceText === 'function' ? rs.cleanEvidenceText(s) : s;
    }

    const GRADES = {
        major: 'Major nonconformity',
        minor: 'Minor nonconformity',
        pending: 'Nonconformity (grade to be confirmed)',
        obs: 'Observation',
        ofi: 'Opportunity for improvement'
    };
    function gradeLabel(key) { return GRADES[key] || GRADES.pending; }
    const isNC = function (f) { return f && f._cat && /^(major|minor|pending)$/.test(f._cat.key); };

    /**
     * The criterion as the report prints it. An internal tracking reference
     * (FOCUS/SURV/ORG/DOC) is never shown to the client.
     */
    function criterionOf(f) {
        const rs = RS();
        if (rs && typeof rs.formatCriterion === 'function') {
            try {
                const fc = rs.formatCriterion(f);
                return { label: fc.isInternal ? '' : str(fc.label), kind: fc.kind || 'standard' };
            } catch (_e) { /* fall through to the recorded clause */ }
        }
        const raw = str(f.criterionRef) || str(f.clause);
        return { label: /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i.test(raw) ? '' : raw, kind: 'standard' };
    }

    /** What the client reads for one finding, from recorded data only. */
    function partsOf(f) {
        const manual = f.source === 'manual';
        const statement = clean(manual ? f.description : f.ncrDescription);
        const evidenceRaw = str(f.clientEvidenceStatement) || (manual ? str(f.evidence) : str(f.comment));
        let evidence = clean(evidenceRaw);
        // A manual finding often has its text in one field only; don't print it twice.
        if (evidence && statement && evidence.toLowerCase() === statement.toLowerCase()) evidence = '';
        const crit = criterionOf(f);
        // A requirement is printed only when the criterion is a clause of the
        // audited standard — same rule as the report's formal NC statement.
        const requirement = crit.kind === 'standard' ? clean(f.requirement) : '';
        const where = [str(f.department), [str(f.personnel), str(f.designation)].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
        return { statement, evidence, requirement, criterion: crit.label, where, photos: Number(f.evidenceCount) || 0 };
    }

    function field(label, html) {
        return '<div class="fs-field"><div class="fs-label">' + t(label) + '</div><div class="fs-value">' + html + '</div></div>';
    }
    const missing = function (what) { return '<span class="fs-missing">' + t(what) + ' not recorded.</span>'; };

    function findingBlock(f) {
        const p = partsOf(f);
        const key = (f._cat && f._cat.key) || 'pending';
        const meta = [
            p.criterion ? 'Clause ' + p.criterion : 'Clause not recorded',
            f.questionRef ? 'Checklist question ' + f.questionRef : '',
            p.where
        ].filter(Boolean).map(t).join(' &middot; ');
        let body;
        if (isNC(f)) {
            body = (p.requirement ? field('Requirement', t(p.requirement)) : '')
                + field('Objective evidence', p.evidence ? t(p.evidence) : missing('Objective evidence'))
                + field('Nonconformity statement', p.statement ? t(p.statement) : missing('Nonconformity statement'));
        } else {
            const text = p.statement || p.evidence;
            body = field(key === 'ofi' ? 'Opportunity' : 'Observation', text ? t(text) : missing('Finding text'))
                + (p.statement && p.evidence ? field('Evidence', t(p.evidence)) : '');
        }
        if (p.photos) body += '<div class="fs-photos">' + p.photos + ' screenshot' + (p.photos === 1 ? '' : 's') + ' on file with the audit record.</div>';
        return '<div class="fs-finding fs-' + key + '">'
            + '<div class="fs-head"><span class="fs-ref">' + t(f._ref || '') + '</span> '
            + '<span class="fs-grade fs-grade-' + key + '">' + t(gradeLabel(key)) + '</span></div>'
            + '<div class="fs-meta">' + meta + '</div>'
            + body
            + '</div>';
    }

    function section(title, intro, list) {
        if (!list.length) return '';
        return '<h2 class="fs-h2">' + t(title) + ' (' + list.length + ')</h2>'
            + (intro ? '<p class="fs-intro">' + t(intro) + '</p>' : '')
            + list.map(findingBlock).join('');
    }

    /** When the client's response is due, from the auditor's date or the CB's configured timeframe. */
    function dueText(ctx, counts) {
        const df = DF();
        const due = str(ctx.responseDue);
        if (due && df.formatDate(due)) return { html: '<strong>' + t(df.formatDate(due)) + '</strong>', set: true };
        const tf = ctx.timeframes;
        if (tf && tf.configured) {
            const parts = [];
            if (counts.major) parts.push('major nonconformities within ' + tf.major + ' days');
            if (counts.minor || counts.pending) parts.push('minor nonconformities within ' + tf.minor + ' days');
            if (parts.length) return { html: t(parts.join('; ') + ' of the closing meeting'), set: true };
        }
        const rs = RS();
        const sentence = (rs && rs.CAPA_PROCEDURE_SENTENCE) || 'Corrective action timeframe: in accordance with the certification body\'s applicable corrective-action procedure.';
        return { html: '<span class="fs-blank"></span> (agreed at the closing meeting). ' + t(sentence), set: false };
    }

    /** The audit identification block shared by the summary and the completed checklist. */
    function metaTableHtml(c, extraRows) {
        const row = function (label, value) { return '<tr><th>' + t(label) + '</th><td>' + value + '</td></tr>'; };
        return '<table class="fs-meta-table">'
            + row('Organisation', t(str(c.clientName) || 'Client'))
            + row('Audit standards', arr(c.standards).length ? arr(c.standards).map(t).join(' &middot; ') : 'Not recorded')
            + row('Audit', t([str(c.auditType), str(c.method)].filter(Boolean).join(' · ') || 'Not recorded'))
            + row('Audit dates', t(str(c.auditDates) || 'Not recorded'))
            + row('Lead auditor', t(str(c.leadAuditor) || 'Not recorded'))
            + (c.auditRef ? row('Audit reference', t(c.auditRef)) : '')
            + arr(extraRows).map(function (r) { return row(r.label, r.html); }).join('')
            + '</table>';
    }

    /**
     * @param {Object} ctx {
     *   findings: numbered findings (window.collectAuditFindings().findings),
     *   clientName, standards:[labels], auditType, method, auditDates, leadAuditor,
     *   auditRef, closingDate, responseDue, timeframes:{configured,major,minor},
     *   brand:{name, logoUrl}, classification, generatedOn }
     */
    function build(ctx) {
        const c = ctx || {};
        const df = DF(); const shell = PS();
        const findings = arr(c.findings);
        const counts = { major: 0, minor: 0, pending: 0, obs: 0, ofi: 0 };
        findings.forEach(function (f) { const k = (f._cat && f._cat.key) || 'pending'; counts[k] = (counts[k] || 0) + 1; });
        const ncs = findings.filter(isNC);
        const obs = findings.filter(function (f) { return f._cat && f._cat.key === 'obs'; });
        const ofi = findings.filter(function (f) { return f._cat && f._cat.key === 'ofi'; });
        const brandName = str(c.brand && c.brand.name) || 'Audit360';
        const clientName = str(c.clientName) || 'Client';
        const generated = df.formatDate(c.generatedOn || new Date()) || '';
        const closing = df.formatDate(c.closingDate) || '';
        const due = dueText(c, counts);

        const metaTable = metaTableHtml(c, [{ label: 'Closing meeting', html: closing ? t(closing) : '<span class="fs-blank"></span>' }]);

        const cell = function (n, label, cls) { return '<td class="' + cls + '"><div class="fs-n">' + n + '</div><div class="fs-n-label">' + t(label) + '</div></td>'; };
        const countTable = '<table class="fs-counts"><tr>'
            + cell(counts.major, 'Major nonconformities', counts.major ? 'fs-c-major' : '')
            + cell(counts.minor, 'Minor nonconformities', counts.minor ? 'fs-c-minor' : '')
            + (counts.pending ? cell(counts.pending, 'Grade to be confirmed', 'fs-c-pending') : '')
            + cell(counts.obs, 'Observations', '')
            + cell(counts.ofi, 'Opportunities for improvement', '')
            + '</tr></table>';

        const next = [];
        if (ncs.length) {
            next.push(t('For each nonconformity, send the certification body: the correction (what was done to fix the situation found), the root-cause analysis, the corrective action that will stop it recurring, who is responsible, and the target dates.'));
            next.push('Response due: ' + due.html);
        }
        if (counts.major) next.push(t('Major nonconformities must be corrected, and the corrective action verified by the certification body, before certification can be granted or maintained.'));
        if (obs.length || ofi.length) next.push(t('Observations and opportunities for improvement need no formal response. They are not nonconformities; the organisation decides whether and how to act on them.'));
        next.push(t('The audit team does not recommend specific solutions. How each finding is addressed is for the organisation to decide.'));
        next.push(t('This summary is preliminary. The audit report is the formal record of the audit and takes precedence over this summary.'));
        // Every line is HTML already: text escaped with t(), the due date with its own markup.
        const nextHtml = '<h2 class="fs-h2">What happens next</h2><ul class="fs-next">'
            + next.map(function (line) { return '<li>' + line + '</li>'; }).join('') + '</ul>';

        const sig = function (who, lines) {
            return '<div class="fs-sig"><div class="fs-sig-who">' + t(who) + '</div>'
                + lines.map(function (l) { return '<div class="fs-sig-line"><span>' + t(l.label) + '</span>' + (l.value ? ' <b>' + t(l.value) + '</b>' : '') + '</div>'; }).join('')
                + '</div>';
        };
        const signOff = '<div class="fs-signoff pd-keep">'
            + '<h2 class="fs-h2">Acknowledgement</h2>'
            + '<p class="fs-intro">Signing confirms that the findings above were presented at the closing meeting and understood. It does not mean the organisation agrees with them; any diverging opinion is recorded below.</p>'
            + '<div class="fs-diverging"><div class="fs-label">Diverging opinions, if any</div><div class="fs-box"></div></div>'
            + '<div class="fs-sigs">'
            + sig('For the certification body', [{ label: 'Lead auditor', value: str(c.leadAuditor) }, { label: 'Signature' }, { label: 'Date' }])
            + sig('For the organisation', [{ label: 'Name' }, { label: 'Position' }, { label: 'Signature' }, { label: 'Date' }])
            + '</div></div>';

        const body = shell.masthead({
            brandName: brandName, logoUrl: c.brand && c.brand.logoUrl,
            title: 'Audit Findings Summary',
            subtitle: 'Presented at the closing meeting · Preliminary, subject to the audit report'
        })
            + metaTable
            + countTable
            + (findings.length ? '' : '<p class="fs-intro">No findings were raised at this audit.</p>')
            + section('Nonconformities', 'A nonconformity is a requirement that was not fulfilled. Each needs a correction and a corrective action.', ncs)
            + section('Observations', '', obs)
            + section('Opportunities for improvement', '', ofi)
            + nextHtml
            + signOff;

        return shell.buildDocument({
            title: 'Audit Findings Summary - ' + plain(clientName),
            header: { left: brandName, center: plain(clientName), right: 'Findings summary' + (c.auditRef ? ' · ' + plain(c.auditRef) : '') },
            footer: { left: c.classification ? plain(c.classification) : 'Prepared ' + generated, center: 'Preliminary, subject to the audit report' },
            bodyHtml: body,
            extraCss: shell.MASTHEAD_CSS + '\n' + CSS
        });
    }

    const CSS = [
        '.fs-meta-table{margin:4px 0 10px;font-size:9pt}',
        '.fs-meta-table th{text-align:left;width:34mm;color:#64748b;font-weight:600;padding:2px 6px 2px 0;vertical-align:top}',
        '.fs-meta-table td{padding:2px 0;vertical-align:top}',
        '.fs-counts{margin:6px 0 12px;table-layout:fixed}',
        '.fs-counts td{border:.6pt solid #cbd5e1;text-align:center;padding:6px 4px}',
        '.fs-n{font-size:16pt;font-weight:700;color:#0f172a;line-height:1.1}',
        '.fs-n-label{font-size:7.5pt;color:#475569}',
        '.fs-c-major{background:#fef2f2}.fs-c-major .fs-n{color:#b91c1c}',
        '.fs-c-minor{background:#fffbeb}.fs-c-minor .fs-n{color:#b45309}',
        '.fs-c-pending{background:#f1f5f9}',
        '.fs-h2{font-size:11.5pt;color:#0f2a43;margin:14px 0 6px;padding-bottom:3px;border-bottom:1pt solid #cbd5e1}',
        '.fs-intro{color:#475569;font-size:8.5pt;margin:0 0 8px}',
        '.fs-finding{border:.6pt solid #cbd5e1;border-left:3pt solid #64748b;border-radius:3px;padding:7px 9px;margin:0 0 8px;break-inside:avoid;page-break-inside:avoid}',
        '.fs-major{border-left-color:#dc2626}.fs-minor{border-left-color:#d97706}.fs-obs{border-left-color:#7c3aed}.fs-ofi{border-left-color:#0891b2}',
        '.fs-head{display:flex;gap:8px;align-items:baseline}',
        '.fs-ref{font-weight:700;font-size:10.5pt;color:#0f172a}',
        '.fs-grade{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#475569}',
        '.fs-grade-major{color:#b91c1c}.fs-grade-minor{color:#b45309}.fs-grade-obs{color:#6d28d9}.fs-grade-ofi{color:#0e7490}',
        '.fs-meta{font-size:8pt;color:#64748b;margin:1px 0 5px}',
        '.fs-field{margin-top:4px}',
        '.fs-label{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b}',
        '.fs-value{white-space:pre-wrap;overflow-wrap:anywhere}',
        '.fs-missing{color:#94a3b8;font-style:italic}',
        '.fs-photos{margin-top:4px;font-size:8pt;color:#64748b}',
        '.fs-next{margin:0 0 6px 16px;padding:0}',
        '.fs-next li{margin-bottom:3px}',
        '.fs-blank{display:inline-block;min-width:38mm;border-bottom:.6pt solid #475569;height:1em;vertical-align:bottom}',
        '.fs-diverging{margin:6px 0 10px}',
        '.fs-box{border:.6pt solid #94a3b8;height:22mm;margin-top:3px}',
        '.fs-sigs{display:flex;gap:10mm}',
        '.fs-sig{flex:1 1 0;min-width:0}',
        '.fs-sig-who{font-weight:700;color:#0f2a43;margin-bottom:4px}',
        '.fs-sig-line{display:flex;align-items:flex-end;gap:6px;height:9mm;border-bottom:.6pt solid #475569;font-size:8pt;color:#64748b}',
        '.fs-sig-line b{color:#0f172a;font-weight:600;font-size:9pt}'
    ].join('\n');

    // ── Browser glue: everything below reads window.state ─────────────────

    function standardsOf(plan, report) {
        const text = arr(plan && plan.certificationCycle && plan.certificationCycle.standards).join(', ')
            || str(plan && plan.standard) || str(report && report.standard);
        const cs = global.ChecklistStandards;
        if (!text) return [];
        if (cs && typeof cs.resolve === 'function') {
            const r = cs.resolve(text);
            return r.standards.map(function (s) { return s.label; }).concat(r.unresolved);
        }
        return text.split(/\s*,\s*/).filter(Boolean);
    }

    function context(reportId, state) {
        const s = state || global.state || {};
        const report = arr(s.auditReports).find(function (r) { return String(r.id) === String(reportId); });
        if (!report) return null;
        const plan = arr(s.auditPlans).find(function (p) { return report.planId != null && String(p.id) === String(report.planId); }) || null;
        const checklists = arr(plan && plan.selectedChecklists)
            .map(function (id) { return arr(s.checklists).find(function (c) { return String(c.id) === String(id); }); })
            .filter(Boolean);
        const client = arr(s.clients).find(function (c) { return report.clientId != null && String(c.id) === String(report.clientId); })
            || arr(s.clients).find(function (c) { return c.name === report.client; }) || null;
        const collected = global.collectAuditFindings(report, checklists);
        const cb = s.cbSettings || {};
        const df = DF();
        const rs = RS();
        const timeframes = rs && typeof rs.capaTimeframes === 'function'
            ? rs.capaTimeframes({ settings: cb, standard: report.standard || (plan && plan.standard) || '', stage: (plan && plan.auditType) || report.auditType || '' })
            : null;
        const start = (plan && plan.date) || report.date;
        const lead = (plan && plan.lead) || report.leadAuditor || arr(plan && plan.team)[0] || '';
        let auditRef;
        try { auditRef = plan && global.UTILS && global.UTILS.getPlanRef ? global.UTILS.getPlanRef(plan) : ''; } catch (_e) { auditRef = ''; }
        return {
            report: report,
            findings: collected.findings,
            counts: collected.counts,
            clientName: (client && client.name) || report.client || '',
            standards: standardsOf(plan, report),
            auditType: (plan && (plan.auditType || plan.type)) || report.auditType || '',
            method: (plan && plan.auditMethod) || '',
            auditDates: df.formatDateRange(start, plan && plan.endDate),
            leadAuditor: lead,
            auditRef: auditRef,
            closingDate: (report.closingMeeting && report.closingMeeting.date) || '',
            responseDue: report.findingsResponseDue || '',
            timeframes: timeframes,
            brand: { name: cb.cbName || 'ISOXPERT Audit360', logoUrl: cb.logoUrl && (String(cb.logoUrl).indexOf('data:') === 0 || String(cb.logoUrl).indexOf('http') === 0) ? cb.logoUrl : '' },
            classification: cb.documentClassification || cb.confidentialityLabel || '',
            generatedOn: new Date()
        };
    }

    function notify(msg, type) { if (typeof global.showNotification === 'function') global.showNotification(msg, type); }

    global.printFindingsSummary = function (reportId) {
        const id = reportId && typeof reportId === 'object' ? (reportId.dataset && reportId.dataset.id) : reportId;
        if (!PS() || !global.collectAuditFindings) {
            notify('The print module is not loaded. Reload the page and try again.', 'warning');
            return null;
        }
        const ctx = context(id);
        if (!ctx) { notify('Audit report not found.', 'error'); return null; }
        if (!ctx.findings.length) { notify('There are no findings to print.', 'info'); return null; }
        // An unclassified finding prints as "grade to be confirmed": say so
        // before it goes on paper in front of the client.
        if (ctx.counts.pending && typeof global.confirm === 'function'
            && !global.confirm(ctx.counts.pending + ' finding' + (ctx.counts.pending === 1 ? ' has' : 's have') + ' no grade yet and will print as "grade to be confirmed". Print anyway?')) {
            return null;
        }
        const html = build(ctx);
        const problems = PS().lint(html);
        if (problems.length && global.Logger) global.Logger.warn('FindingsSummary', 'Print lint: ' + problems.map(function (p) { return p.code; }).join(', '));
        const win = PS().open(html);
        if (!win) notify('Pop-up blocked. Allow pop-ups for this site to print the findings summary.', 'warning');
        return win;
    };

    global.setFindingsResponseDue = function (reportId, value) {
        const report = arr(global.state && global.state.auditReports).find(function (r) { return String(r.id) === String(reportId); });
        if (!report) return;
        const iso = DF().toIso(value);
        report.findingsResponseDue = iso || '';
        if (typeof global.saveData === 'function') global.saveData();
        if (iso) notify('Client response due ' + DF().formatDate(iso) + '. It prints on the findings summary.', 'success');
    };

    const API = { build: build, context: context, gradeLabel: gradeLabel, partsOf: partsOf, metaTableHtml: metaTableHtml, clean: clean, CSS: CSS };
    global.FindingsSummary = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'findings-summary.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================
// CHECKLIST DOCUMENT  (window.ChecklistDocument)
// ============================================
// Builds the printable client-specific audit checklist. Pure: everything it
// needs is passed in, so the same function serves the print window, the tests
// and the PDF QA run.
//
// WHAT THIS CORRECTS (all seen on the PC CONNECTION checklist)
//   * "Date: 21 Sept 2026" was the day the PDF was PRINTED, on a checklist for
//     an audit on 3-5 November 2026. The cover now states the SCHEDULED audit
//     and, separately, when the checklist was generated.
//   * The lifecycle was unstated. A pre-audit checklist now says
//     "Prepared — audit not started"; its items are "Not Checked".
//   * "Checklist QA validation passed" and "Coverage validated" were printed
//     beside "Coverage could not be assessed". One combined status is printed.
//   * The browser's own header, timestamp, "about:blank" and page counter were
//     on every page; the document now defines its own (see print-shell.js).
//   * Stored text that had been HTML-escaped printed literally as "&amp;".
//     Every string is decoded once and escaped once, here.
//
// CONTRACT
//   ChecklistDocument.build(checklist, ctx)   -> HTML string
//     ctx.audience 'auditor' (default) prints the auditor checklist with its
//     validation and coverage panels; 'client' prints the Client Preparation
//     Checklist from the same data, with no internal diagnostics.
//   ChecklistDocument.clientItems(checklist)  -> [{isHeader,title} | {clause,title,citation,prepare,documents}]
//   ChecklistDocument.printItems(checklist)   -> [{clause, requirement, isHeader, level}]
//   ChecklistDocument.lifecycle(ctx)          -> {key, label}
//   ChecklistDocument.reference(checklist, ctx)
//   ChecklistDocument.validateItemStatus(status, justification) -> {ok, error}
//   ChecklistDocument.qaPanel(qa) / coveragePanel(cov, checklist) / validationBanner(combined)

(function (global) {
    'use strict';

    const DF = function () { return global.DocFormat || (typeof require === 'function' ? require('./doc-format.js') : null); };
    const PS = function () { return global.PrintShell || (typeof require === 'function' ? require('./print-shell.js') : null); };

    /** Decode text stored HTML-escaped, then escape once for output. */
    function t(v) {
        const d = DF();
        return d.escapeHtml(d.decodeEntities(v == null ? '' : String(v)));
    }
    function plain(v) { const d = DF(); return d.decodeEntities(v == null ? '' : String(v)); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    const CSd = function () { return global.ChecklistStandards || (typeof require === 'function' ? require('./checklist-standards.js') : null); };

    /**
     * The clause column shows a run of references as a range
     * ("A.5.24 / A.5.25 / A.5.26 / A.5.27 / A.6.8" -> "A.5.24–A.5.27, A.6.8"),
     * so five-line clause cells stay readable. Display only: the stored value
     * is untouched. Anything that is not purely a list of references (a
     * pseudo-clause such as RECERT, or "9.6.2 (a)") is shown as it is.
     */
    function displayClause(value) {
        const raw = String(value == null ? '' : value).trim();
        const tokens = raw.split(/\s*(?:\/|,)\s*/).filter(Boolean);
        const isRef = function (x) { return /^(?:A\.\d+\.\d+|\d{1,2}(?:\.\d{1,2}){0,2})$/.test(x); };
        if (tokens.length < 3 || !tokens.every(isRef)) return raw;
        const cs = CSd();
        return cs && cs.compressRuns ? cs.compressRuns(tokens).replace(/, /g, ' / ') : raw;
    }

    // ── Controlled item statuses ──────────────────────────────────────
    // Before the audit every item is "Not Checked". Once it begins the auditor
    // may use these. Not Applicable is a claim that a requirement does not
    // apply, and an unsupported one is how a requirement gets skipped, so it
    // is not accepted without a stated reason.
    const ITEM_STATUSES = [
        { key: 'conform', label: 'Conforming' },
        { key: 'nc', label: 'Nonconforming' },
        { key: 'observation', label: 'Observation' },
        { key: 'ofi', label: 'Opportunity for Improvement' },
        { key: 'na', label: 'Not Applicable', requiresJustification: true },
        { key: '', label: 'Not Checked' }
    ];
    const DEFAULT_ITEM_STATUS = 'Not Checked';
    const LIFECYCLE_PREPARED = 'Prepared — audit not started';

    function validateItemStatus(status, justification) {
        const s = String(status == null ? '' : status).toLowerCase();
        const known = ITEM_STATUSES.find(function (x) { return x.key === s || x.label.toLowerCase() === s; });
        if (!known) return { ok: false, error: 'Unknown status "' + status + '".' };
        if (known.requiresJustification && !String(justification == null ? '' : justification).trim()) {
            return { ok: false, error: 'Not Applicable requires a justification.' };
        }
        return { ok: true, error: '' };
    }

    /**
     * Where the checklist is in its life. Derived from the audit's own record,
     * never asserted by the print.
     */
    function lifecycle(ctx) {
        const c = ctx || {};
        const report = c.report;
        const status = String((report && report.status) || '').toLowerCase();
        if (/final|publish|approved|issued/.test(status)) return { key: 'completed', label: 'Audit completed' };
        if (report && arr(report.checklistProgress).some(function (p) { return p && p.status; })) return { key: 'in-progress', label: 'Audit in progress' };
        return { key: 'prepared', label: LIFECYCLE_PREPARED };
    }

    /** CHK-<client initials>-<year>-<nn>, stable for a given checklist. */
    function reference(checklist, ctx) {
        const c = ctx || {};
        if (checklist && checklist.reference) return String(checklist.reference);
        const d = DF();
        const initials = String((checklist && (checklist.clientName || c.clientName)) || (c.client && c.client.name) || '')
            .replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0].toUpperCase(); }).join('').slice(0, 3) || 'XX';
        const p = d.parseDateParts((c.plan && c.plan.date) || (checklist && (checklist.createdAt || checklist.updatedAt)));
        const year = p ? p.y : new Date().getFullYear();
        const list = arr(c.siblings).filter(function (x) { return x && (x.clientId === checklist.clientId || x.clientName === checklist.clientName); })
            .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
        const idx = Math.max(0, list.findIndex(function (x) { return String(x.id) === String(checklist.id); }));
        return 'CHK-' + initials + '-' + year + '-' + String(idx + 1).padStart(2, '0');
    }

    // Preparation notes the builder appends to a question for the person
    // building the checklist. They are not part of the question and are not
    // printed.
    const PREP_NOTES = [/\s*No validated supporting document mapped — auditor to select or confirm the document\.?/g];
    function forPrint(text) {
        let out = text == null ? '' : String(text);
        PREP_NOTES.forEach(function (re) { out = out.replace(re, ''); });
        return out.trim();
    }

    /**
     * The checklist's questions in print order, from either data shape. The
     * Document Intelligence section (DOCNOTE) is an awareness note about the
     * client's document set — "not an audit finding" — and asks nothing, so
     * it is left out of the printed checklist.
     */
    function printItems(checklist) {
        const out = [];
        const ck = checklist || {};
        if (arr(ck.clauses).length) {
            ck.clauses.forEach(function (main) {
                if (String(main.mainClause || '').toUpperCase() === 'DOCNOTE') return;
                out.push({ clause: main.mainClause || main.clause, requirement: main.title || main.requirement, isHeader: true, level: 1 });
                arr(main.subClauses).forEach(function (sub) {
                    const nested = function (o) {
                        if (!o.items || !o.items[0]) return null;
                        return o.items[0].requirement || o.items[0].text || o.items[0].title;
                    };
                    if (sub.items && sub.items.length) {
                        const subTitle = sub.title || sub.requirement || sub.text || '';
                        // A scope-driven item carries the exact standard(s) and
                        // clause(s) it tests in `citation`, so the criterion is
                        // on the record rather than inferred from a bare number
                        // that means different things in different standards.
                        out.push({ clause: sub.clause, requirement: sub.citation ? subTitle + ' — ' + sub.citation : subTitle, isHeader: true, level: 2 });
                        sub.items.forEach(function (item) {
                            out.push({ clause: item.clause, requirement: forPrint(item.requirement || item.text || item.title || '') });
                        });
                    } else {
                        out.push({ clause: sub.clause, requirement: forPrint(sub.requirement || sub.title || sub.requirement_text || sub.text || nested(sub) || '') });
                    }
                });
            });
        } else if (arr(ck.items).length) {
            return ck.items.map(function (i) { return { clause: i.clause, requirement: forPrint(i.requirement || i.text || i.title || '') }; });
        }
        return out;
    }

    // ── Validation panels ─────────────────────────────────────────────

    function qaPanel(qa) {
        if (!qa) return '';
        if (qa.ok) {
            return '<div class="qa-panel qa-pass">'
                + '<h2>Checklist QA validation <span class="qa-scope">(internal consistency of the questions)</span></h2>'
                + '<p><strong>Passed.</strong> ' + qa.itemCount + ' questions. Every clause and control cited belongs to a standard in the audit scope; no duplicate, contradictory or out-of-scope requirements were found.</p>'
                + '</div>';
        }
        const cls = qa.blocking ? 'qa-fail' : 'qa-warn';
        const order = { critical: 0, warning: 1, info: 2 };
        const rows = arr(qa.issues).slice().sort(function (a, b) { return order[a.severity] - order[b.severity]; }).slice(0, 25)
            .map(function (i) { return '<li><span class="qa-tag qa-tag-' + t(i.severity) + '">' + t(i.severity) + '</span>' + (i.itemRef ? '<strong>' + t(i.itemRef) + '</strong> — ' : '') + t(i.message) + '</li>'; }).join('');
        const hidden = arr(qa.issues).length - Math.min(arr(qa.issues).length, 25);
        const summary = (global.ChecklistQA && global.ChecklistQA.summarize) ? global.ChecklistQA.summarize(qa) : '';
        return '<div class="qa-panel ' + cls + '">'
            + '<h2>Checklist QA validation <span class="qa-scope">(internal consistency of the questions)</span></h2>'
            + '<p><strong>' + t(summary) + '</strong>' + (qa.blocking ? ' Resolve the critical items before the checklist is used as an audit record.' : '') + '</p>'
            + '<ul>' + rows + '</ul>' + (hidden > 0 ? '<p style="margin-top:6px;">…and ' + hidden + ' further item(s).</p>' : '') + '</div>';
    }

    function annexALabel(ct) {
        if (!ct.soaDriven) return ct.soaDocument ? 'assumed — SoA document on file could not be read' : 'assumed, no SoA supplied';
        if (ct.soaSource === 'document') return 'per SoA — ' + (ct.soaDocument && ct.soaDocument.name ? ct.soaDocument.name : 'document on file');
        return 'per SoA';
    }

    /**
     * The cycle-coverage panel. Leads with the OUTCOME label — "validated"
     * appears only for the two outcomes that assessed coverage — and reports
     * each standard's figures as planned in this audit, inherited from earlier
     * audits in the cycle, and remaining.
     */
    function coverageHeading(checklist) {
        const type = String((checklist && checklist.auditType) || '').toLowerCase();
        if (type.indexOf('recert') !== -1) return 'Recertification coverage validation';
        if (type.indexOf('surv') !== -1) return 'Coverage validation — this audit and the cycle so far';
        return 'Coverage validation';
    }

    function coveragePanel(cov, checklist) {
        if (!cov) {
            return '<div class="qa-panel qa-cov qa-fail"><h2>' + coverageHeading(checklist) + '</h2>'
                + '<p><strong>Blocked — coverage could not be assessed.</strong> The coverage pass did not run. This is an internal error; it is not a finding about the audit.</p></div>';
        }
        const c = cov.coverage || {};
        const outcome = cov.outcome || (cov.blocking ? 'failed' : 'passed');
        const cls = outcome === 'blocked' || outcome === 'failed' ? 'qa-fail' : (outcome === 'passed-with-notes' || outcome === 'not-assessed' ? 'qa-warn' : 'qa-pass');
        const label = (global.ChecklistCoverage && global.ChecklistCoverage.OUTCOMES && global.ChecklistCoverage.OUTCOMES[outcome]) || outcome;
        const rows = [];
        arr(c.clauses).forEach(function (cl) {
            rows.push('<tr><td>' + t(cl.label) + ' — requirements</td><td>' + cl.planned + ' / ' + cl.total + '</td><td>' + cl.inherited + '</td><td>' + cl.remaining + '</td></tr>');
        });
        arr(c.controls).forEach(function (ct) {
            rows.push('<tr><td>' + t(ct.label) + ' — Annex A applicable (' + t(annexALabel(ct)) + ')</td><td>' + ct.planned + ' / ' + ct.pool + '</td><td>' + ct.inherited + '</td><td>' + ct.remaining + '</td></tr>');
        });
        if (c.processes && c.processes.total) {
            rows.push('<tr><td>Critical processes</td><td>—</td><td>' + c.processes.covered + ' / ' + c.processes.total + ' over the cycle</td><td>' + (c.processes.total - c.processes.covered) + '</td></tr>');
        }
        if (c.integrated && c.integrated.standards > 1) {
            rows.push('<tr class="cov-total"><td>Integrated view — ' + c.integrated.standards + ' standards</td><td>' + c.integrated.planned + ' / ' + c.integrated.requirements + '</td><td>' + c.integrated.inherited + '</td><td>' + c.integrated.remaining + '</td></tr>');
        }
        const order = { critical: 0, warning: 1, info: 2 };
        const list = arr(cov.issues).slice().sort(function (a, b) { return order[a.severity] - order[b.severity]; }).slice(0, 20)
            .map(function (i) { return '<li><span class="qa-tag qa-tag-' + t(i.severity) + '">' + t(i.severity === 'critical' ? (outcome === 'blocked' ? 'internal error' : 'gap') : i.severity) + '</span>' + t(i.message) + '</li>'; }).join('');
        const cycle = c.cycle || {};
        const d = DF();
        const resolved = Object.keys((checklist && checklist.resolvedIssues) || {}).map(function (k) { return checklist.resolvedIssues[k]; });
        const disp = resolved.length
            ? '<p style="margin-top:8px;"><strong>Dispositioned by the auditor:</strong></p><ul>' + resolved.map(function (r) {
                return '<li>' + t(r.note || r.action) + ' <em>(' + t(r.by || '') + (r.at ? ', ' + t(d.formatDate(r.at) || r.at) : '') + ')</em></li>'; }).join('') + '</ul>'
            : '';
        const cycleText = (cycle.start && cycle.end) ? 'Certification cycle ' + d.formatDateRange(cycle.start, cycle.end) + (cycle.anchored ? ' (anchored on ' + t(cycle.anchored) + ')' : '')
            + ', ' + (cycle.priorAudits || 0) + ' prior audit(s) on file, ' + (cycle.priorChecklists || 0) + ' of their checklists read for coverage.' : '';
        return '<div class="qa-panel qa-cov ' + cls + '">'
            + '<h2>' + coverageHeading(checklist) + '</h2>'
            + '<p><strong>' + t(label) + '.</strong> ' + t(cycleText) + '</p>'
            + (rows.length ? '<table class="cov-table"><thead><tr><th>Coverage by standard</th><th>Planned this audit</th><th>Inherited from cycle</th><th>Remaining</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '')
            + (list ? '<ul>' + list + '</ul>' : '') + disp
            + '<p class="cov-note">Annex A controls are selected risk-based from the applicable set — the Statement of Applicability, the risk assessment, changes since the previous audit, incidents and previous audit results. Auditing every control at every audit is not required; covering the applicable set across the certification cycle is.</p>'
            + '</div>';
    }

    /** The single status line for the whole checklist. */
    function validationBanner(combined) {
        if (!combined) return '';
        const cls = combined.outcome === 'blocked' || combined.outcome === 'failed' ? 'qa-fail' : (combined.outcome === 'passed-with-notes' || combined.outcome === 'not-assessed' ? 'qa-warn' : 'qa-pass');
        return '<div class="qa-panel ' + cls + ' pd-keep"><h2>Checklist validation status</h2><p><strong>' + t(combined.label) + '</strong>'
            + (combined.reasons && combined.reasons.length ? ' ' + t(combined.reasons.join(' ')) : '') + '</p></div>';
    }

    // ── Client preparation copy ───────────────────────────────────────
    // The same checklist, written for the organisation being audited. It is
    // derived from the stored questions by fixed rules — nothing is generated
    // again and nothing is added that the checklist does not already say. What
    // it leaves out is everything about how Audit360 built and checked the
    // checklist: QA validation, coverage, cycle matrix, document statistics,
    // SoA handling, and the auditor's own sampling tactics.

    const AUDIENCES = ['auditor', 'client'];
    // Sections that describe the checklist itself, not the audit.
    const INTERNAL_SECTIONS = /^(?:DOCNOTE|REVIEW)$/i;
    // Section codes and pseudo-references that mean nothing to the client.
    const PSEUDO_REF = /^(?:RECERT|ORG|IMS|THEME|DOC|DOCNOTE|REVIEW|SURV|FOCUS(?:\.\d+)?|A)$/i;
    const DOC_HINT = /\s*Documented information on file that should support this:\s*([\s\S]+?)\s*$/;
    const ANNEX_A_PREPARE = 'Have evidence available that each control listed is implemented and operating as described in your Statement of Applicability.';
    const GENERIC_PREPARE = 'Be prepared to show how this requirement is met, with the supporting records.';
    const CLIENT_INTRO = 'This checklist sets out the areas the audit will cover, the requirements of each standard in scope, and the evidence and documents to have available. It is a preparation aid: it does not limit what the audit team may ask to see.';
    const CLIENT_SAMPLING = 'Records and Annex A controls are examined on a sample basis; the audit team may select other examples on the day.';

    // Sentences that are the auditor's own technique, with nothing for the
    // organisation to prepare.
    const DROP_SENTENCE = [
        /^(?:Record|Note|Probe|Ask for|Extend the sample|Observe)\b/i,
        /^Awareness is evidenced\b/i,
        /^Sample across\b.*\brather than\b/i,
        /^For awareness only\b/i
    ];
    // What may never reach the client copy, after rewriting. A segment of a
    // sentence (split on " — ") that still carries one is dropped.
    const LEAK = /\b(?:verify|probe|interview|obtain|examine|record (?:the|here|only|what)|check this control|test this control|extend the sample|for awareness only|the auditor)\b/i;

    // Leading imperatives, auditor -> organisation. Checked in order.
    const LEAD = [
        [/^Test awareness with ([^:]+):\s*/i, 'Arrange for $1 to be available to discuss '],
        [/^Interview (.+?) to establish\s+/i, 'Arrange for $1 to be available to explain '],
        [/^Interview ([^:]+):\s*/i, 'Arrange for $1 to be available to the audit team, and '],
        [/^Sample\s+(one|two|three|a|an)\s+(?=[^.]*\bthrough to\b)/i, 'Be prepared to trace $1 '],
        [/^Sample\s+(one|two|three|four|five|a|an|the)\s+/i, 'Make available $1 '],
        [/^Sample\s+(?!of\b)/i, 'Make available a sample of '],
        [/^(?:Take|Pick)\s+(?!of\b)/i, 'Make available '],
        [/^Review\s+(?!of\b)/i, 'Make available '],
        [/^(?:Verify|Confirm|Check)\s+that\s+/i, 'Be prepared to show that '],
        [/^(?:Verify|Confirm|Check|Assess|Examine|Test|Determine|Evaluate)\s+(?!of\b)/i, 'Be prepared to show '],
        [/^Establish\s+/i, 'Be prepared to explain '],
        [/^Identify\s+/i, 'Be prepared to identify '],
        [/^Trace\s+/i, 'Be prepared to trace '],
        [/^Walk\s+(?:through\s+)?/i, 'Be prepared to walk through '],
        [/^Follow\s+/i, 'Be prepared to follow '],
        [/^Compare\s+/i, 'Be prepared to compare '],
        [/^Cover\s+/i, 'Be prepared to discuss ']
    ];
    // The same verbs inside a sentence, after a list or clause boundary.
    const CONNECTOR = '(^|[:;,—–]\\s*|\\b(?:and|then|or)\\s+)';
    const INNER = [
        [new RegExp(CONNECTOR + 'test its boundaries', 'gi'), '$1explain its boundaries'],
        [new RegExp(CONNECTOR + 'test that against\\b', 'gi'), '$1show that this matches'],
        [new RegExp(CONNECTOR + '(?:verify|confirm|check)(?= that\\b)', 'gi'), '$1show'],
        [new RegExp(CONNECTOR + '(?:verify|confirm|check|examine|assess|test|review)\\b(?!\\s+of\\b)', 'gi'), '$1show'],
        [new RegExp(CONNECTOR + 'establish\\b', 'gi'), '$1explain'],
        [new RegExp(CONNECTOR + 'sample\\s+(one|two|three|a|an)\\s+(?=[^.]*\\bthrough to\\b)', 'gi'), '$1trace $2 '],
        [new RegExp(CONNECTOR + 'sample\\s+(one|two|three|four|five|a|an|the)\\s+', 'gi'), '$1make available $2 '],
        [new RegExp(CONNECTOR + 'sample\\s+(?!of\\b|size\\b)', 'gi'), '$1make available a sample of '],
        [new RegExp(CONNECTOR + 'decide whether\\b', 'gi'), '$1consider whether'],
        [new RegExp(CONNECTOR + 'note any\\b', 'gi'), '$1identify any'],
        [/\bobtain (?:objective )?evidence\b/gi, 'have evidence'],
        // A dash-led instruction reads as one addressed to the organisation.
        [/(—\s+)(show|explain)\b/g, '$1be prepared to $2']
    ];
    // Wording addressed to the auditor, restated for the organisation.
    const PHRASE = [
        [/\bthe organi([sz])ation[’']s own\b/gi, 'your own'],
        [/\bthe organi([sz])ation\b/gi, 'your organi$1ation'],
        [/\bwhat you see on site\b/gi, 'the activities on site'],
        [/\s+by representative sampling\b/gi, ''],
        [/\bon this representative sample:/gi, 'for these documents:'],
        [/\s+for depth of evidence\b/gi, ''],
        [/^Sites sampled at this audit:/i, 'Sites included in this audit:']
    ];

    function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    function clientSentence(sentence) {
        let s = String(sentence || '').trim();
        if (!s) return '';
        if (DROP_SENTENCE.some(function (re) { return re.test(s); })) return '';
        if (!/\?$/.test(s)) {
            for (let i = 0; i < LEAD.length; i++) {
                if (LEAD[i][0].test(s)) { s = s.replace(LEAD[i][0], LEAD[i][1]); break; }
            }
            INNER.forEach(function (r) { s = s.replace(r[0], r[1]); });
        }
        PHRASE.forEach(function (r) { s = s.replace(r[0], r[1]); });
        // Drop any " — " segment that still speaks to the auditor; drop the
        // sentence if its first segment does.
        const segments = s.split(/\s+—\s+/);
        if (LEAK.test(segments[0])) return '';
        s = segments.filter(function (seg, i) { return i === 0 || !LEAK.test(seg); }).join(' — ');
        if (!/[.?!]$/.test(s)) s += '.';
        return capitalise(s);
    }

    /**
     * Auditor question -> what the organisation should prepare, plus the
     * client documents the question names. Deterministic; adds nothing.
     */
    function clientPrepare(text) {
        let body = forPrint(plain(text));
        let documents = [];
        const hint = body.match(DOC_HINT);
        if (hint) {
            documents = hint[1].replace(/\.\s*$/, '').split(/;\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
            body = body.slice(0, hint.index);
        }
        const sentences = body.split(/(?<=[.?!][”"’]?)\s+(?=[A-Z“"(])/);
        const out = sentences.map(clientSentence).filter(Boolean).join(' ');
        return { prepare: out, documents };
    }

    /** "Standard clause" for a question, citing each standard it tests. */
    function clientCitation(sub, ck) {
        if (sub.citation) return plain(sub.citation);
        const cs = CSd();
        const refs = arr(sub.refs).filter(function (r) { return r && r.stdId && r.ref; });
        if (refs.length && cs && cs.citation) return cs.citation(refs);
        const ref = String(sub.criterionRef || sub.clause || '').trim();
        if (!ref || PSEUDO_REF.test(ref)) return '';
        if (sub.criterionStandard) return plain(sub.criterionStandard) + ' ' + ref;
        const RS = global.ReportStats;
        if (RS && typeof RS.citeFinding === 'function') {
            try { return RS.citeFinding({ clause: ref }, ck.standard || '') || ''; } catch (_e) { return ''; }
        }
        return '';
    }

    function annexAControls(sub) {
        const cs = CSd();
        const named = arr(sub.refs).map(function (r) {
            const hit = cs && cs.lookupRef ? cs.lookupRef([r.stdId], r.ref)[0] : null;
            return hit ? hit.ref + ' ' + hit.title : '';
        }).filter(Boolean);
        if (named.length) return named.join('; ');
        const m = plain(sub.requirement || '').match(/^Sample (.+?)\.\s/);
        return m ? m[1] : '';
    }

    function clientAreaTitle(title) {
        return plain(title)
            .replace(/\s+—\s+\d+ controls sampled of \d+\b.*$/i, ' — selected controls')
            .replace(/\s+—\s+requirements from the Knowledge Base \([^)]*\)/i, ' — requirements')
            .replace(/\s+—\s+\d+ of \d+ clauses sampled\b/i, '')
            .replace(/^Annex A control sample\b/i, 'Annex A controls');
    }

    function clientRow(sub, ck, text) {
        const isAnnexA = sub.criterionSource === 'annex-a-sample';
        const r = clientPrepare(text);
        let prepare = r.prepare;
        if (isAnnexA) {
            const controls = annexAControls(sub);
            prepare = (controls ? 'Controls: ' + controls + '. ' : '') + ANNEX_A_PREPARE;
        } else if (String(sub.criterionSource || '') === 'focus-carryover') {
            prepare = 'Point carried over from the Stage 1 document review: “' + forPrint(plain(text)) + '” Be prepared to show how it has been addressed.';
        }
        const clause = String(sub.clause || '').trim();
        return {
            clause: PSEUDO_REF.test(clause) ? '' : clause,
            title: clientAreaTitle(sub.title || ''),
            citation: clientCitation(sub, ck),
            prepare: prepare || GENERIC_PREPARE,
            documents: r.documents
        };
    }

    /** The checklist as the client sees it: areas and what to prepare. */
    function clientItems(checklist) {
        const ck = checklist || {};
        const out = [];
        if (arr(ck.clauses).length) {
            ck.clauses.forEach(function (main) {
                if (INTERNAL_SECTIONS.test(String(main.mainClause || ''))) return;
                const rows = [];
                arr(main.subClauses).forEach(function (sub) {
                    if (!sub || sub.documentNote || sub.criterionSource === 'auditor-review' || sub.criterionSource === 'document-intelligence') return;
                    const items = arr(sub.items);
                    if (items.length > 1) {
                        items.forEach(function (item) {
                            rows.push(clientRow(Object.assign({}, sub, { clause: item.clause || sub.clause }), ck, item.requirement || item.text || item.title || ''));
                        });
                    } else {
                        const text = sub.requirement || (items[0] && (items[0].requirement || items[0].text)) || sub.requirement_text || sub.text || sub.title || '';
                        rows.push(clientRow(sub, ck, text));
                    }
                });
                if (!rows.length) return;
                out.push({ isHeader: true, title: clientAreaTitle(main.title || main.requirement || main.mainClause || '') });
                rows.forEach(function (r) { out.push(r); });
            });
        } else if (arr(ck.items).length) {
            ck.items.forEach(function (i) { out.push(clientRow({ clause: i.clause, title: '' }, ck, i.requirement || i.text || i.title || '')); });
        }
        return out;
    }

    function clientCss(brand) {
        return [
            '.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 22px;margin:2px 0 10px}',
            '.meta-grid div{font-size:9pt;color:#475569}',
            '.meta-grid strong{color:#0f172a}',
            '.prep-intro{font-size:9pt;color:#334155;margin:6px 0 4px}',
            'table.items{margin-top:8px;table-layout:fixed}',
            'table.items th { background: ' + brand.deep + '; color: #f8fafc; padding: 7px 10px; text-align: left; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }',
            'table.items td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 9pt; overflow-wrap: break-word; }',
            'table.items td.clause { font-weight: 700; background: #f8fafc; color: #334155; font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; }',
            'tr.section-header td { background: ' + brand.primary + '; color: #fff; font-weight: 700; font-size: 9.5pt; border-color: ' + brand.primary + '; padding: 6px 10px; }',
            'tr.section-header{break-after:avoid;page-break-after:avoid}',
            'tr.item{break-inside:avoid}',
            'table.items tr.item:nth-child(even) td:not(.clause) { background: #fafbfc; }',
            '.prep-title{font-weight:700;color:#0f172a;display:block}',
            '.prep-cite{display:block;font-size:8pt;color:#475569;margin:1px 0 3px}',
            '.prep-docs{margin:0;padding-left:14px}',
            '.prep-docs li{font-size:8.5pt;color:#334155;margin-bottom:2px}',
            '.prep-none{color:#94a3b8}',
            '.sign-note { font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 12px; }'
        ].join('\n');
    }

    function buildClient(ck, c) {
        const d = DF();
        const shell = PS();
        const brand = c.brand || {};
        const ref = reference(ck, c);
        const plan = c.plan;
        const cbName = plain(c.cbName || 'ISOXPERT Audit360');
        const clientName = plain(ck.clientName || (c.client && c.client.name) || '');
        const auditType = ck.auditType ? String(ck.auditType).replace(/^./, function (m) { return m.toUpperCase(); }) : '';
        const scheduled = plan && plan.date ? d.formatDateRange(plan.date, plan.endDate) : '';
        const issued = d.formatDate(c.generatedOn) || d.formatDate(new Date());
        const items = clientItems(ck);
        let area = 0;
        const rows = items.map(function (it) {
            if (it.isHeader) {
                area++;
                return '<tr class="section-header"><td>Area ' + area + '</td><td colspan="3">' + t(it.title) + '</td></tr>';
            }
            const docs = it.documents.length
                ? '<ul class="prep-docs">' + it.documents.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul>'
                : '<span class="prep-none">—</span>';
            return '<tr class="item"><td class="clause">' + t(displayClause(it.clause)) + '</td><td>'
                + (it.title ? '<span class="prep-title">' + t(it.title) + '</span>' : '')
                + (it.citation ? '<span class="prep-cite">' + t(it.citation) + '</span>' : '')
                + t(it.prepare) + '</td><td>' + docs + '</td><td></td></tr>';
        }).join('');

        const body = shell.masthead({
            brandName: cbName, logoUrl: c.logoUrl, title: 'Audit Preparation Checklist',
            subtitle: (clientName ? clientName + ' · ' : '') + (auditType ? auditType + ' audit · ' : '') + ref
        })
            + '<div class="meta-grid">'
            + '<div><strong>Organisation:</strong> ' + t(clientName) + '</div>'
            + '<div><strong>Standards:</strong> ' + t(plain(ck.standard || '')) + '</div>'
            + '<div><strong>Scheduled audit:</strong> ' + (scheduled ? t(scheduled) : 'Not yet scheduled') + '</div>'
            + '<div><strong>Audit type:</strong> ' + (auditType ? t(auditType) : '—') + '</div>'
            + '<div><strong>Reference:</strong> ' + t(ref) + '</div>'
            + '<div><strong>Issued:</strong> ' + t(issued) + '</div>'
            + (ck.auditScope ? '<div><strong>Scope:</strong> ' + t(ck.auditScope) + '</div>' : '')
            + '</div>'
            + '<p class="prep-intro">' + t(CLIENT_INTRO) + ' ' + t(CLIENT_SAMPLING) + '</p>'
            + '<table class="items"><thead><tr>'
            + '<th style="width:84px">Clause</th><th>Requirement and what to prepare</th><th style="width:170px">Your documents on file</th><th style="width:110px">Your notes</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table>'
            + '<p class="sign-note">Issued by ' + t(cbName) + ' for audit preparation</p>';

        return shell.buildDocument({
            title: 'Audit Preparation Checklist' + (clientName ? ' — ' + clientName : ''),
            header: { left: cbName, center: clientName, right: ref },
            footer: { left: c.classification ? plain(c.classification) : 'Issued ' + issued, center: 'Audit preparation checklist' },
            bodyHtml: body,
            extraCss: shell.MASTHEAD_CSS + '\n' + clientCss(brand)
        });
    }

    // ── The document ──────────────────────────────────────────────────

    function css(brand) {
        // The rules the existing print tests pin (brand-coloured section
        // headers, green/amber/red status panels) keep their exact form.
        return [
            '.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 22px;margin:2px 0 10px}',
            '.meta-grid div{font-size:9pt;color:#475569}',
            '.meta-grid strong{color:#0f172a}',
            '.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8.5pt; font-weight: 600; }',
            '.badge-green { background: #dcfce7; color: #166534; }',
            '.badge-blue { background: ' + brand.tint + '; color: ' + brand.text + '; }',
            'table.items{margin-top:8px;table-layout:fixed}',
            'table.items th { background: ' + brand.deep + '; color: #f8fafc; padding: 7px 10px; text-align: left; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }',
            'table.items td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 9pt; overflow-wrap: break-word; }',
            'table.items td.clause { font-weight: 700; background: #f8fafc; color: #334155; font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; }',
            // A section code can be a standard name ("ISO 18841:2018"); it
            // wraps inside the clause column rather than running into the title.
            'tr.section-header td:first-child, tr.sub-header td:first-child { overflow-wrap: anywhere; word-break: break-word; }',
            'table.items tr.item:nth-child(even) td:not(.clause) { background: #fafbfc; }',
            'tr.section-header td { background: ' + brand.primary + '; color: #fff; font-weight: 700; font-size: 9.5pt; border-color: ' + brand.primary + '; padding: 6px 10px; }',
            'tr.sub-header td { background: ' + brand.tint + '; color: ' + brand.text + '; font-weight: 600; font-size: 9pt; border-bottom: 2px solid ' + brand.tintBorder + '; }',
            'tr.section-header,tr.sub-header{break-after:avoid;page-break-after:avoid}',
            '.status-col { text-align: center; font-size: 8.5pt; color: #64748b; }',
            '.qa-panel { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; break-inside: avoid; }',
            '.qa-panel.qa-cov { break-inside: auto; }',
            '.qa-panel.qa-pass { border-left: 4px solid #059669; background: #f0fdf4; }',
            '.qa-panel.qa-warn { border-left: 4px solid #f59e0b; background: #fffbeb; }',
            '.qa-panel.qa-fail { border-left: 4px solid #dc2626; background: #fef2f2; }',
            '.qa-panel h2 { font-size: 9pt; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; }',
            '.qa-panel .qa-scope{text-transform:none;letter-spacing:0;font-weight:400;color:#64748b}',
            '.qa-panel p { margin: 0 0 4px 0; font-size: 9pt; color: #475569; }',
            '.qa-panel ul { margin: 4px 0 0 0; padding-left: 16px; }',
            '.qa-panel li { font-size: 8.5pt; color: #475569; margin-bottom: 2px; }',
            '.qa-tag { display: inline-block; font-size: 7pt; font-weight: 700; letter-spacing: 0.3px; padding: 1px 5px; border-radius: 8px; margin-right: 5px; text-transform: uppercase; }',
            '.qa-tag-critical { background: #fee2e2; color: #991b1b; }',
            '.qa-tag-warning { background: #fef3c7; color: #92400e; }',
            '.qa-tag-info { background: #e0f2fe; color: #075985; }',
            '.cov-table { width: 100%; border-collapse: collapse; margin: 6px 0 4px; }',
            '.cov-table th { background: transparent; color: #64748b; padding: 3px 5px; font-size: 7.5pt; text-align: left; }',
            '.cov-table td { border: none; border-bottom: 1px solid #e2e8f0; padding: 3px 5px; font-size: 8.5pt; color: #475569; }',
            '.cov-table td:not(:first-child),.cov-table th:not(:first-child) { text-align: right; width: 78px; font-variant-numeric: tabular-nums; }',
            '.cov-table tr.cov-total td{font-weight:700;color:#0f172a}',
            '.cov-note { font-size: 8pt; color: #64748b; margin-top: 5px; }',
            '.status-key{font-size:8.5pt;color:#475569;margin:8px 0 0}',
            '.status-key span{display:inline-block;margin-right:10px}',
            'tr.keep-next{break-after:avoid;page-break-after:avoid}',
            'tr.sign-row td{border:0 !important;background:#fff !important;padding:14px 4px 0;break-inside:avoid;border-top:2px solid #e2e8f0 !important}',
            '.sig-row { display: flex; justify-content: space-between; gap: 30px; margin-top: 14px; }',
            '.sig-block { flex: 1; }',
            '.sig-line { border-bottom: 1px solid #94a3b8; margin-top: 24px; }',
            '.sig-label { font-size: 8.5pt; color: #64748b; margin-top: 3px; }',
            '.sign-note { font-size: 8pt; color: #94a3b8; text-align: center; margin-top: 12px; }'
        ].join('\n');
    }

    /**
     * @param {Object} checklist
     * @param {Object} ctx {
     *   brand, cbName, logoUrl, qrUrl, plan, report, client, siblings,
     *   qa, coverage, combined, items, generatedOn, classification,
     *   audience: 'auditor' (default) | 'client' }
     *
     * audience 'client' builds the Client Preparation Checklist from the same
     * checklist: no validation banner, coverage panel, QA, status key,
     * auditor evidence column or sign-off, and qa / coverage / combined are
     * ignored even when passed.
     */
    function build(checklist, ctx) {
        const c = ctx || {};
        if (c.audience === 'client') return buildClient(checklist || {}, c);
        const d = DF();
        const shell = PS();
        const ck = checklist || {};
        const items = c.items || printItems(ck);
        const brand = c.brand;
        const life = lifecycle(c);
        const ref = reference(ck, c);
        const plan = c.plan;
        const cbName = plain(c.cbName || 'ISOXPERT Audit360');
        const clientName = plain(ck.clientName || (c.client && c.client.name) || '');
        const auditType = ck.auditType ? String(ck.auditType).replace(/^./, function (m) { return m.toUpperCase(); }) : '';

        // The audit date is the SCHEDULED date. It is never today's date: a
        // checklist printed in September for a November audit must not say
        // "September". No plan / no booked dates -> say so.
        const scheduled = plan && plan.date ? d.formatDateRange(plan.date, plan.endDate) : '';
        const generated = d.formatDate(ck.createdAt || ck.updatedAt || c.generatedOn) || d.formatDate(new Date());
        const scope = ck.auditScope ? '<div><strong>Scope:</strong> ' + t(ck.auditScope) + '</div>' : '';
        const stdList = plain(ck.standard || '');
        const nItems = items.filter(function (i) { return !i.isHeader; }).length;

        const lastItems = items.length - 3;
        const rows = items.map(function (item, idx) {
            if (item.isHeader) {
                return '<tr class="' + (item.level === 2 ? 'sub-header' : 'section-header') + '"><td>' + t(displayClause(item.clause)) + '</td><td colspan="3">' + t(item.requirement) + '</td></tr>';
            }
            return '<tr class="item' + (idx >= lastItems ? ' keep-next' : '') + '"><td class="clause">' + t(displayClause(item.clause || '')) + '</td><td>' + t(item.requirement || '') + '</td>'
                + '<td class="status-col">' + DEFAULT_ITEM_STATUS + '</td><td class="evidence-col">-</td></tr>';
        }).join('');

        const body = shell.masthead({
            brandName: cbName, logoUrl: c.logoUrl, title: plain(ck.name || 'Audit Checklist'),
            subtitle: 'Audit checklist' + (auditType ? ' · ' + auditType : '') + ' · ' + ref, qrUrl: c.qrUrl
        })
            + '<div class="meta-grid">'
            + '<div><strong>Client:</strong> ' + t(clientName) + '</div>'
            + '<div><strong>Standards:</strong> <span class="badge badge-blue">' + t(stdList) + '</span></div>'
            + '<div><strong>Scheduled audit:</strong> ' + (scheduled ? t(scheduled) : 'Not yet scheduled') + '</div>'
            + '<div><strong>Audit type:</strong> ' + (auditType ? t(auditType) : '—') + '</div>'
            + '<div><strong>Checklist status:</strong> ' + t(life.label) + '</div>'
            + '<div><strong>Item status:</strong> ' + DEFAULT_ITEM_STATUS + '</div>'
            + '<div><strong>Checklist reference:</strong> ' + t(ref) + '</div>'
            + '<div><strong>Type:</strong> <span class="badge ' + (ck.type === 'global' ? 'badge-green' : 'badge-blue') + '">' + (ck.type === 'global' ? 'Global' : 'Custom') + '</span> · <strong>Items:</strong> ' + nItems + '</div>'
            + '<div><strong>Checklist generated:</strong> ' + t(generated) + '</div>'
            + scope
            + '</div>'
            + validationBanner(c.combined)
            // The QA issue list (duplicate / consistency warnings) is an
            // internal check on how the checklist was built. It is shown in the
            // app, not printed; the validation status above summarises it.
            + coveragePanel(c.coverage, ck)
            + '<p class="status-key"><strong>Item status key</strong> (once the audit begins): '
            + ITEM_STATUSES.map(function (s) { return '<span>' + t(s.label) + (s.requiresJustification ? ' (justification required)' : '') + '</span>'; }).join('') + '</p>'
            + '<table class="items"><thead><tr>'
            + '<th style="width:84px">Clause</th><th>Requirement</th><th style="width:74px;text-align:center">Status</th><th style="width:150px">Auditor comments / evidence</th>'
            + '</tr></thead><tbody>' + rows
            // The sign-off is the table's LAST ROW and the rows before it are
            // marked keep-with-next, so it can never be stranded alone on a page.
            + '<tr class="sign-row"><td colspan="4"><div class="sig-row">'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Lead Auditor Signature</div></div>'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Client Representative</div></div>'
            + '<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Date</div></div>'
            + '</div><p class="sign-note">Generated by ' + t(cbName) + ' · This is a controlled document</p></td></tr>'
            + '</tbody></table>';

        return shell.buildDocument({
            title: plain(ck.name || 'Audit Checklist'),
            header: { left: cbName, center: clientName, right: ref + (auditType ? ' · ' + auditType : '') },
            footer: { left: c.classification ? plain(c.classification) : 'Checklist generated ' + generated, center: 'Audit checklist' },
            bodyHtml: body,
            extraCss: shell.MASTHEAD_CSS + '\n' + css(brand)
        });
    }

    /** Questions on the printed checklist (section headings not counted). */
    function itemCount(checklist) {
        return printItems(checklist).filter(function (i) { return !i.isHeader; }).length;
    }

    /**
     * A short fingerprint of what the printed checklist asks (clause +
     * requirement of every row, in order). Recorded when a checklist is sent
     * to a client so a later edit shows as "changed since sent". djb2, not
     * cryptographic: it detects edits, it does not prove anything.
     */
    function fingerprint(checklist) {
        const text = printItems(checklist).map(function (i) {
            return (i.isHeader ? '#' : '') + String(i.clause == null ? '' : i.clause) + '\u0001' + String(i.requirement == null ? '' : i.requirement);
        }).join('\u0002');
        let h = 5381;
        for (let k = 0; k < text.length; k++) h = ((h << 5) + h + text.charCodeAt(k)) | 0;
        return (h >>> 0).toString(16).padStart(8, '0');
    }

    const API = { displayClause, ITEM_STATUSES, DEFAULT_ITEM_STATUS, LIFECYCLE_PREPARED, validateItemStatus, lifecycle, reference, printItems,
        itemCount, fingerprint, qaPanel, coveragePanel, validationBanner, build,
        AUDIENCES, clientItems, clientPrepare, clientSentence };
    global.ChecklistDocument = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'checklist-document.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================
// CORRECTIVE ACTION REQUEST  (window.CarDocument)
// ============================================
// One CAR per register nonconformity, issued to the client in the CB's name.
// Part A (the nonconformity) is completed by the certification body, Part B
// (correction, root cause, corrective action) by the organisation, Part C (the
// review) by the auditor. Two outputs from one context so they never differ:
//
//   - PDF: a PrintShell A4 document (running header/footer, "Page X of Y"),
//     printed or saved from the preview window.
//   - Word: a real .docx written here (stored-ZIP, no library, no CDN), so the
//     client can type Part B into it and send it back.
//
// The filled-in CAR comes back through the Review previous finding form,
// which uploads it to the NCR (auditeeResponseFiles).
//
// CONTRACT
//   CarDocument.context(ncr, state)        -> ctx | null   (pure)
//   CarDocument.buildHtml(ctx)             -> full HTML document (pure)
//   CarDocument.buildDocx(ctx, logo?)      -> Uint8Array .docx (pure; logo = {bytes, ext, width, height})
//   CarDocument.fileName(ctx, ext)         -> download file name
//   window.printCAR(ncrId)                 -> opens the PDF preview window
//   window.downloadCARWord(ncrId)          -> downloads the .docx
//   CarDocument.buildBatchHtml([ctx])      -> one document, a CAR per page (pure)
//   CarDocument.buildDocxZip([ctx], logo?) -> .zip of one .docx per CAR (pure)
//   window.printCARs('85,86,90')           -> every CAR of an audit in one PDF preview
//   window.downloadCARsWord('85,86,90')    -> the .zip

(function (global) {
    'use strict';

    const need = function (name, file) { return global[name] || (typeof require === 'function' ? require(file) : null); };
    const DF = function () { return need('DocFormat', './doc-format.js'); };
    const PS = function () { return need('PrintShell', './print-shell.js'); };
    const NM = function () { return global.NCRModule || {}; };

    function arr(v) { return Array.isArray(v) ? v : []; }
    function str(v) { return v == null ? '' : String(v).trim(); }
    // NCR text may have been stored through Sanitizer.sanitizeText (entities):
    // decode once, then escape once.
    function plain(v) { return str(DF().decodeEntities(v == null ? '' : String(v))); }
    function h(v) { return DF().escapeHtml(plain(v)); }
    function date(v) { return v ? DF().formatDate(v) : ''; }
    function same(a, b) { return a != null && b != null && String(a) === String(b); }

    function ncrRef(ncr) {
        return ncr && ncr.id != null && ncr.id !== '' ? 'NCR-' + String(ncr.id).padStart(3, '0') : 'NCR (unsaved)';
    }

    function criterionOf(ncr) {
        const rs = global.ReportStats;
        if (rs && typeof rs.formatCriterion === 'function') {
            try {
                const label = str(rs.formatCriterion(ncr).label);
                if (label) return label;
            } catch (_e) { /* fall through */ }
        }
        // formatCriterion's default never prints an internal FOCUS/SURV ref;
        // the fallback keeps that rule.
        const ref = str(ncr.criterionRef);
        if (ref) return ref;
        const clause = str(ncr.clause);
        return /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i.test(clause) ? '' : clause;
    }

    function logoOf(cb) {
        const u = str(cb.logoUrl);
        return /^(data:image\/|https?:\/\/)/i.test(u) ? u : '';
    }

    /**
     * Everything the CAR prints, resolved from the register record and the
     * state around it. Null when there is no record.
     */
    function context(ncr, state) {
        if (!ncr) return null;
        const s = state || global.state || {};
        const cb = s.cbSettings || {};
        const plan = arr(s.auditPlans).find(function (p) { return p && same(p.id, ncr.auditId); }) || null;
        const reports = arr(s.auditReports).filter(function (r) { return r && same(r.planId, ncr.auditId); });
        const client = arr(s.clients).find(function (c) {
            return c && ((ncr.clientId != null && same(c.id, ncr.clientId)) || (ncr.clientName && c.name === ncr.clientName));
        }) || null;

        // The checklist answer that raised this finding, for its objective evidence.
        let progress = null;
        if (ncr.sourceChecklistId != null && ncr.sourceItemIdx != null) {
            reports.some(function (r) {
                progress = arr(r.checklistProgress).find(function (p) {
                    return p && same(p.checklistId, ncr.sourceChecklistId) && same(p.itemIdx, ncr.sourceItemIdx);
                }) || null;
                return !!progress;
            });
        }
        const description = plain(ncr.description);
        let evidence = typeof ncr.evidence === 'string' ? plain(ncr.evidence) : '';
        if (!evidence && progress) evidence = plain(progress.clientEvidenceStatement || progress.comment);
        if (evidence && evidence.toLowerCase() === description.toLowerCase()) evidence = '';

        const nctx = typeof NM().resolveNCRContext === 'function'
            ? NM().resolveNCRContext(ncr)
            : { standard: str(ncr.standard) || str(plan && plan.standard) || str(client && client.standard), requirement: '' };

        let auditRef;
        try { auditRef = plan && global.UTILS && global.UTILS.getPlanRef ? str(global.UTILS.getPlanRef(plan)) : ''; } catch (_e) { auditRef = ''; }
        const report = reports[0] || null;
        const sev = str(ncr.severity || ncr.type).toLowerCase();
        // Two different deadlines. The response (this form back, with the
        // correction and the plan) is due on the date agreed for the audit's
        // findings — set on the audit's Findings tab and printed on the
        // findings summary. ncr.dueDate is the corrective action deadline from
        // the CB's CAPA timeframes (e.g. 90 days for a minor).
        const findingsDue = str((reports.find(function (r) { return str(r.findingsResponseDue); }) || {}).findingsResponseDue);
        const actionDue = str(ncr.dueDate);

        return {
            ref: ncrRef(ncr),
            grade: /major/.test(sev) ? 'Major' : 'Minor',
            clientName: plain((client && client.name) || ncr.clientName),
            standard: plain(nctx.standard),
            criterion: plain(criterionOf(ncr)),
            requirement: plain(nctx.requirement),
            statement: description,
            evidence: evidence,
            auditType: plain((plan && (plan.auditType || plan.type)) || (report && report.auditType)),
            auditDate: (plan && plan.date) || (report && report.date) || '',
            auditEndDate: (plan && plan.endDate) || '',
            auditRef: auditRef,
            leadAuditor: plain((plan && plan.lead) || (report && report.leadAuditor)),
            raisedBy: plain(ncr.raisedBy),
            raisedDate: ncr.raisedDate || '',
            responseDue: findingsDue || actionDue,
            // Shown separately only when it is a different date.
            actionDue: findingsDue && actionDue && actionDue !== findingsDue ? actionDue : '',
            response: {
                correction: plain(ncr.correction),
                rootCause: plain(ncr.rootCause),
                correctiveAction: plain(ncr.correctiveAction),
                responsible: plain(ncr.capaResponsible),
                implementedDate: ncr.capaImplementedDate || ''
            },
            review: {
                method: plain(ncr.verificationMethod),
                by: plain(ncr.verifiedBy),
                date: ncr.verifiedDate || '',
                effectiveness: plain(ncr.effectiveness)
            },
            brand: {
                name: plain(cb.cbName || (arr(cb.cbSites)[0] || {}).name || cb.name) || 'ISOXPERT Audit360',
                logoUrl: logoOf(cb),
                email: plain(cb.cbEmail),
                phone: plain(cb.cbPhone),
                website: plain(cb.cbWebsite),
                accreditation: [plain(cb.accreditationBody), plain(cb.accreditationNumber)].filter(Boolean).join(' · ')
            },
            classification: plain(cb.documentClassification || cb.confidentialityLabel),
            issuedOn: new Date()
        };
    }

    function auditLine(c) {
        const dates = c.auditEndDate && c.auditEndDate !== c.auditDate
            ? DF().formatDateRange(c.auditDate, c.auditEndDate) : date(c.auditDate);
        return [c.auditType, dates, c.auditRef ? 'Ref ' + c.auditRef : ''].filter(Boolean).join(' · ');
    }

    function returnInstruction(c) {
        const to = c.brand.email ? ' to ' + c.brand.email : '';
        const by = c.responseDue ? ' by ' + date(c.responseDue) : ' by the response due date';
        if (c.actionDue) {
            return 'Complete Part B and return this form' + to + by
                + ', with the correction taken and your corrective action plan. Send evidence that the corrective action is implemented by '
                + date(c.actionDue) + '. Quote ' + c.ref + ' on everything you send.';
        }
        return 'Complete Part B and return this form' + to + by
            + ', with evidence of the correction and the corrective action taken. Quote ' + c.ref + ' on everything you send.';
    }

    const DEFINITIONS = [
        ['Correction', 'the immediate action to fix this nonconformity. Write N/A if none was possible, and say why.'],
        ['Root cause', 'why the nonconformity happened.'],
        ['Corrective action', 'what removes the root cause so it does not happen again.']
    ];

    // ─── PDF (HTML) ─────────────────────────────────────────────────────────

    const CSS = [
        '.car-meta{margin:0 0 12px}',
        '.car-meta td{border:.5pt solid #cbd5e1;padding:5px 8px;vertical-align:top}',
        '.car-meta td.k{background:#f1f5f9;font-weight:600;color:#334155;width:22%}',
        '.car-grade{display:inline-block;padding:1px 8px;border-radius:3px;font-weight:700;color:#fff}',
        '.car-grade.major{background:#b91c1c}.car-grade.minor{background:#b45309}',
        '.car-part{margin:14px 0 6px;padding:5px 8px;background:#0f2a43;color:#fff;font-weight:700;font-size:10pt;letter-spacing:.02em}',
        '.car-part span{font-weight:400;opacity:.85;font-size:8.5pt}',
        '.car-tbl td{border:.5pt solid #cbd5e1;padding:6px 8px;vertical-align:top;white-space:pre-wrap}',
        '.car-tbl td.k{background:#f8fafc;font-weight:600;color:#334155;width:26%;white-space:normal}',
        '.car-tbl td.fill{height:22mm}',
        '.car-tbl td.fill-sm{height:9mm}',
        '.car-note{border:.5pt solid #94a3b8;background:#f8fafc;padding:7px 10px;margin:8px 0;font-size:8.5pt}',
        '.car-note ul{margin:4px 0 0 16px;padding:0}',
        '.car-sign{display:flex;gap:18px;margin-top:14px}',
        '.car-sign div{flex:1;border-top:.5pt solid #334155;padding-top:3px;font-size:8pt;color:#475569;margin-top:22px}'
    ].join('\n');

    function row(label, value, fill) {
        const v = plain(value);
        return '<tr class="pd-keep"><td class="k">' + h(label) + '</td><td class="' + (v ? '' : (fill || 'fill')) + '">' + h(v) + '</td></tr>';
    }

    function carBody(c) {
        const ps = PS();
        const meta = '<table class="car-meta"><tbody>'
            + '<tr><td class="k">NCR number</td><td><strong>' + h(c.ref) + '</strong></td>'
            + '<td class="k">Grade</td><td><span class="car-grade ' + c.grade.toLowerCase() + '">' + h(c.grade) + '</span></td></tr>'
            + '<tr><td class="k">Organisation</td><td colspan="3">' + h(c.clientName || '—') + '</td></tr>'
            + '<tr><td class="k">Standard</td><td colspan="3">' + h(c.standard || '—') + '</td></tr>'
            + '<tr><td class="k">Audit</td><td colspan="3">' + h(auditLine(c) || '—') + '</td></tr>'
            + '<tr><td class="k">Raised by</td><td>' + h([c.raisedBy || c.leadAuditor, date(c.raisedDate)].filter(Boolean).join(', ') || '—') + '</td>'
            + '<td class="k">Response due</td><td><strong>' + h(date(c.responseDue) || 'See audit report') + '</strong></td></tr>'
            + (c.actionDue ? '<tr><td class="k">Corrective action due</td><td colspan="3">' + h(date(c.actionDue)) + ' — evidence of implementation</td></tr>' : '')
            + '</tbody></table>';

        const partA = '<div class="car-part">PART A — NONCONFORMITY <span>(completed by ' + h(c.brand.name) + ')</span></div>'
            + '<table class="car-tbl"><tbody>'
            + row('Clause', c.criterion || '—')
            + (c.requirement ? row('Requirement', c.requirement) : '')
            + row('Statement of nonconformity', c.statement || '—')
            + row('Objective evidence', c.evidence || 'As recorded in the audit report.')
            + '</tbody></table>';

        const note = '<div class="car-note pd-keep"><strong>' + h(returnInstruction(c)) + '</strong><ul>'
            + DEFINITIONS.map(function (d) { return '<li><strong>' + h(d[0]) + '</strong>: ' + h(d[1]) + '</li>'; }).join('')
            + '</ul></div>';

        const r = c.response;
        const partB = '<div class="car-part">PART B — ORGANISATION’S RESPONSE <span>(completed by the organisation)</span></div>'
            + '<table class="car-tbl"><tbody>'
            + row('Correction (immediate fix) and date', r.correction)
            + row('Root cause', r.rootCause)
            + row('Corrective action', r.correctiveAction)
            + row('Responsible person', r.responsible, 'fill-sm')
            + row('Implemented or target date', date(r.implementedDate), 'fill-sm')
            + row('Evidence attached', '', 'fill-sm')
            + '</tbody></table>'
            + '<div class="car-sign pd-keep"><div>Name and position</div><div>Signature</div><div>Date</div></div>';

        const v = c.review;
        const partC = '<div class="car-part">PART C — REVIEW <span>(completed by ' + h(c.brand.name) + ')</span></div>'
            + '<table class="car-tbl"><tbody>'
            + row('Evidence reviewed', v.method)
            + row('Outcome', v.effectiveness === 'Effective' ? 'Closed — corrective action effective'
                : v.effectiveness === 'Not Effective' ? 'Not effective — further action required' : '', 'fill-sm')
            + row('Reviewed by and date', [v.by, date(v.date)].filter(Boolean).join(', '), 'fill-sm')
            + '</tbody></table>';

        const contact = [c.brand.email, c.brand.phone, c.brand.website].filter(Boolean).join(' · ');
        return ps.masthead({
            brandName: c.brand.name, logoUrl: c.brand.logoUrl,
            title: 'Corrective Action Request',
            subtitle: [c.ref, c.clientName].filter(Boolean).join(' · ')
        })
            + (c.brand.accreditation || contact ? '<div style="font-size:8pt;color:#64748b;margin:-6px 0 10px">' + h([c.brand.accreditation, contact].filter(Boolean).join(' · ')) + '</div>' : '')
            + meta + partA + note + partB + partC;
    }

    function buildHtml(c) {
        const ps = PS();
        return ps.buildDocument({
            title: fileName(c, '').replace(/\.$/, ''),
            bodyHtml: carBody(c),
            extraCss: ps.MASTHEAD_CSS + '\n' + CSS,
            header: { left: c.brand.name, center: c.clientName, right: c.ref + ' · ' + c.grade },
            footer: { left: c.classification || 'Corrective Action Request', center: 'Issued ' + date(c.issuedOn) }
        });
    }

    /** Every CAR of one audit in one document, each starting on a new page. */
    function buildBatchHtml(list) {
        const ps = PS();
        const cs = arr(list).filter(Boolean);
        if (!cs.length) return '';
        const first = cs[0];
        const body = cs.map(function (c, i) {
            return '<section class="car-one"' + (i ? ' style="break-before:page;page-break-before:always"' : '') + '>' + carBody(c) + '</section>';
        }).join('');
        return ps.buildDocument({
            title: batchName(cs, ''),
            bodyHtml: body,
            extraCss: ps.MASTHEAD_CSS + '\n' + CSS,
            header: { left: first.brand.name, center: first.clientName, right: 'Corrective Action Requests (' + cs.length + ')' },
            footer: { left: first.classification || 'Corrective Action Requests', center: 'Issued ' + date(first.issuedOn) }
        });
    }

    function batchName(cs, ext) {
        const c = cs[0] || {};
        const base = ('CARs ' + (c.clientName || '') + (c.auditDate ? ' - ' + date(c.auditDate) : ''))
            .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
        return ext ? base + '.' + ext : base;
    }

    /** One .docx per CAR, zipped; each file named so the returned copy matches its NCR. */
    function buildDocxZip(list, logo) {
        const enc = new TextEncoder();
        const seen = {};
        return zipStore(arr(list).filter(Boolean).map(function (c) {
            let name = fileName(c, 'docx');
            if (seen[name]) name = name.replace(/\.docx$/, ' (' + (++seen[name]) + ').docx'); else seen[name] = 1;
            return { name: name, data: buildDocx(c, logo) };
        }).concat([{ name: 'README.txt', data: enc.encode(
            'Corrective Action Requests\r\n\r\nOne Word file per nonconformity. Complete Part B of each and return it with your evidence, '
            + 'keeping the NCR number in the file name.\r\n') }]));
    }

    function fileName(c, ext) {
        const base = ('CAR ' + c.ref + (c.clientName ? ' - ' + c.clientName : ''))
            .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
        return ext ? base + '.' + ext : base;
    }

    // ─── Word (.docx) ───────────────────────────────────────────────────────

    function x(v) {
        return String(v == null ? '' : v)
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** A run: text with line breaks kept. */
    function run(text, o) {
        const opt = o || {};
        const rpr = (opt.bold ? '<w:b/>' : '') + (opt.color ? '<w:color w:val="' + opt.color + '"/>' : '')
            + (opt.size ? '<w:sz w:val="' + opt.size + '"/><w:szCs w:val="' + opt.size + '"/>' : '');
        return String(text == null ? '' : text).split(/\r?\n/).map(function (line, i) {
            return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + x(line) + '</w:t></w:r>';
        }).join('');
    }

    function para(runs, o) {
        const opt = o || {};
        const ppr = (opt.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opt.shade + '"/>' : '')
            + '<w:spacing w:before="' + (opt.before || 0) + '" w:after="' + (opt.after == null ? 80 : opt.after) + '"/>'
            + (opt.keepNext ? '<w:keepNext/>' : '');
        return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runs + '</w:p>';
    }

    const COL = [2600, 6760]; // twips; 9360 = 6.5in text width
    function cell(content, o) {
        const opt = o || {};
        return '<w:tc><w:tcPr><w:tcW w:w="' + opt.w + '" w:type="dxa"/>'
            + (opt.span ? '<w:gridSpan w:val="' + opt.span + '"/>' : '')
            + (opt.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opt.fill + '"/>' : '')
            + '</w:tcPr>' + para(content, { after: 0 }) + '</w:tc>';
    }

    function tbl(rows, grid) {
        const b = '<w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/>'
            + '<w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/>'
            + '<w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/>';
        return '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>' + b + '</w:tblBorders>'
            + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>'
            + '<w:tblGrid>' + grid.map(function (g) { return '<w:gridCol w:w="' + g + '"/>'; }).join('') + '</w:tblGrid>'
            + rows.join('') + '</w:tbl>' + para('', { after: 0 });
    }

    /** A label/value row; an empty value becomes a box to write in (minHeight twips). */
    function trKV(label, value, minHeight) {
        const v = plain(value);
        const h2 = v ? '' : '<w:trPr><w:trHeight w:val="' + (minHeight || 1300) + '" w:hRule="atLeast"/><w:cantSplit/></w:trPr>';
        return '<w:tr>' + (h2 || '<w:trPr><w:cantSplit/></w:trPr>')
            + cell(run(label, { bold: true, color: '334155' }), { w: COL[0], fill: 'F1F5F9' })
            + cell(run(v), { w: COL[1] }) + '</w:tr>';
    }

    function partHeading(title, by) {
        return para(run(title, { bold: true, color: 'FFFFFF', size: 21 }) + run('  (' + by + ')', { color: 'E2E8F0', size: 17 }),
            { shade: '0F2A43', before: 200, after: 60, keepNext: true });
    }

    function logoXml(logo) {
        if (!logo) return '';
        const maxH = 48; const maxW = 220;
        const s = Math.min(1, maxH / logo.height, maxW / logo.width);
        const cx = Math.round(logo.width * s * 9525); const cy = Math.round(logo.height * s * 9525);
        return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>'
            + '<wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.' + logo.ext + '"/><pic:cNvPicPr/></pic:nvPicPr>'
            + '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
            + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    function documentXml(c, logo) {
        const r = c.response; const v = c.review;
        const contact = [c.brand.accreditation, c.brand.email, c.brand.phone, c.brand.website].filter(Boolean).join(' · ');
        const grid4 = [2000, 2680, 2000, 2680];
        const meta = tbl([
            '<w:tr>' + cell(run('NCR number', { bold: true }), { w: grid4[0], fill: 'F1F5F9' }) + cell(run(c.ref, { bold: true }), { w: grid4[1] })
                + cell(run('Grade', { bold: true }), { w: grid4[2], fill: 'F1F5F9' }) + cell(run(c.grade, { bold: true, color: c.grade === 'Major' ? 'B91C1C' : 'B45309' }), { w: grid4[3] }) + '</w:tr>',
            '<w:tr>' + cell(run('Organisation', { bold: true }), { w: grid4[0], fill: 'F1F5F9' }) + cell(run(c.clientName || '—'), { w: 7360, span: 3 }) + '</w:tr>',
            '<w:tr>' + cell(run('Standard', { bold: true }), { w: grid4[0], fill: 'F1F5F9' }) + cell(run(c.standard || '—'), { w: 7360, span: 3 }) + '</w:tr>',
            '<w:tr>' + cell(run('Audit', { bold: true }), { w: grid4[0], fill: 'F1F5F9' }) + cell(run(auditLine(c) || '—'), { w: 7360, span: 3 }) + '</w:tr>',
            '<w:tr>' + cell(run('Raised by', { bold: true }), { w: grid4[0], fill: 'F1F5F9' })
                + cell(run([c.raisedBy || c.leadAuditor, date(c.raisedDate)].filter(Boolean).join(', ') || '—'), { w: grid4[1] })
                + cell(run('Response due', { bold: true }), { w: grid4[2], fill: 'F1F5F9' })
                + cell(run(date(c.responseDue) || 'See audit report', { bold: true }), { w: grid4[3] }) + '</w:tr>',
            c.actionDue ? '<w:tr>' + cell(run('Corrective action due', { bold: true }), { w: grid4[0], fill: 'F1F5F9' })
                + cell(run(date(c.actionDue) + ' — evidence of implementation'), { w: 7360, span: 3 }) + '</w:tr>' : ''
        ].filter(Boolean), grid4);

        const body = [
            logo ? para(logoXml(logo), { after: 40 }) : '',
            para(run(c.brand.name.toUpperCase(), { bold: true, color: '64748B', size: 16 }), { after: 0 }),
            para(run('Corrective Action Request', { bold: true, color: '0F172A', size: 34 }), { after: 0 }),
            para(run([c.ref, c.clientName].filter(Boolean).join(' · '), { color: '475569', size: 19 }), { after: contact ? 0 : 160 }),
            contact ? para(run(contact, { color: '64748B', size: 16 }), { after: 160 }) : '',
            meta,
            partHeading('PART A — NONCONFORMITY', 'completed by ' + c.brand.name),
            tbl([
                trKV('Clause', c.criterion || '—'),
                c.requirement ? trKV('Requirement', c.requirement) : '',
                trKV('Statement of nonconformity', c.statement || '—'),
                trKV('Objective evidence', c.evidence || 'As recorded in the audit report.')
            ].filter(Boolean), COL),
            para(run(returnInstruction(c), { bold: true, size: 18 }), { shade: 'F8FAFC', before: 60, after: 20 }),
            DEFINITIONS.map(function (d) { return para(run(d[0] + ': ', { bold: true, size: 17 }) + run(d[1], { size: 17 }), { shade: 'F8FAFC', after: 0 }); }).join(''),
            partHeading('PART B — ORGANISATION’S RESPONSE', 'completed by the organisation'),
            tbl([
                trKV('Correction (immediate fix) and date', r.correction),
                trKV('Root cause', r.rootCause),
                trKV('Corrective action', r.correctiveAction),
                trKV('Responsible person', r.responsible, 500),
                trKV('Implemented or target date', date(r.implementedDate), 500),
                trKV('Evidence attached', '', 500),
                trKV('Name and position', '', 500),
                trKV('Signature and date', '', 600)
            ], COL),
            partHeading('PART C — REVIEW', 'completed by ' + c.brand.name),
            tbl([
                trKV('Evidence reviewed', v.method),
                trKV('Outcome', v.effectiveness === 'Effective' ? 'Closed — corrective action effective'
                    : v.effectiveness === 'Not Effective' ? 'Not effective — further action required' : '', 500),
                trKV('Reviewed by and date', [v.by, date(v.date)].filter(Boolean).join(', '), 500)
            ], COL)
        ].join('');

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            + ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
            + '<w:body>' + body
            + '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/>'
            + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1270" w:bottom="1000" w:left="1270" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr>'
            + '</w:body></w:document>';
    }

    function footerXml(c) {
        const sz = '<w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr>';
        const fld = function (code) {
            return '<w:r>' + sz + '<w:fldChar w:fldCharType="begin"/></w:r><w:r>' + sz + '<w:instrText xml:space="preserve"> ' + code + ' </w:instrText></w:r>'
                + '<w:r>' + sz + '<w:fldChar w:fldCharType="separate"/></w:r><w:r>' + sz + '<w:t>1</w:t></w:r><w:r>' + sz + '<w:fldChar w:fldCharType="end"/></w:r>';
        };
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            + '<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="94A3B8"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr>'
            + run(c.brand.name + ' · ' + c.ref + ' · Corrective Action Request', { color: '475569', size: 15 })
            + '<w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:tab/><w:t xml:space="preserve">Page </w:t></w:r>' + fld('PAGE')
            + '<w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r>' + fld('NUMPAGES')
            + '</w:p></w:ftr>';
    }

    const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/>'
        + '<w:color w:val="1E293B"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
        + '</w:styles>';

    function buildDocx(c, logo) {
        const enc = function (s) { return new TextEncoder().encode(s); };
        const img = logo && logo.bytes && /^(png|jpe?g|gif)$/i.test(logo.ext || '') && logo.width > 0 && logo.height > 0
            ? { bytes: logo.bytes, ext: String(logo.ext).toLowerCase().replace('jpg', 'jpeg'), width: logo.width, height: logo.height } : null;
        const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + (img ? '<Default Extension="' + img.ext + '" ContentType="image/' + img.ext + '"/>' : '')
            + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
            + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            + '</Types>';
        const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            + '</Relationships>';
        const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            + '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
            + (img ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.' + img.ext + '"/>' : '')
            + '</Relationships>';
        const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
            + '<dc:title>' + x('Corrective Action Request ' + c.ref) + '</dc:title><dc:creator>' + x(c.brand.name) + '</dc:creator></cp:coreProperties>';

        const files = [
            { name: '[Content_Types].xml', data: enc(ct) },
            { name: '_rels/.rels', data: enc(rels) },
            { name: 'docProps/core.xml', data: enc(core) },
            { name: 'word/document.xml', data: enc(documentXml(c, img)) },
            { name: 'word/styles.xml', data: enc(STYLES_XML) },
            { name: 'word/footer1.xml', data: enc(footerXml(c)) },
            { name: 'word/_rels/document.xml.rels', data: enc(docRels) }
        ];
        if (img) files.push({ name: 'word/media/logo.' + img.ext, data: img.bytes });
        return zipStore(files);
    }

    // ─── Minimal ZIP writer (STORE, no compression) ─────────────────────────

    let CRC_TABLE = null;
    function crc32(bytes) {
        if (!CRC_TABLE) {
            CRC_TABLE = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
                CRC_TABLE[n] = c >>> 0;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zipStore(files) {
        const enc = new TextEncoder();
        const locals = []; const centrals = []; let offset = 0;
        files.forEach(function (f) {
            const name = enc.encode(f.name); const data = f.data; const crc = crc32(data);
            const lh = new DataView(new ArrayBuffer(30));
            lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
            lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
            lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
            lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
            locals.push(new Uint8Array(lh.buffer), name, data);
            const ch = new DataView(new ArrayBuffer(46));
            ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
            ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
            ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
            ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
            centrals.push(new Uint8Array(ch.buffer), name);
            offset += 30 + name.length + data.length;
        });
        const centralSize = centrals.reduce(function (n, b) { return n + b.length; }, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
        end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
        const parts = locals.concat(centrals, [new Uint8Array(end.buffer)]);
        const out = new Uint8Array(parts.reduce(function (n, b) { return n + b.length; }, 0));
        let p = 0;
        parts.forEach(function (b) { out.set(b, p); p += b.length; });
        return out;
    }

    // ─── Browser actions ────────────────────────────────────────────────────

    function notify(msg, type) { if (typeof global.showNotification === 'function') global.showNotification(msg, type); }

    function findNCR(ncrId) {
        const id = ncrId && typeof ncrId === 'object' ? (ncrId.dataset && ncrId.dataset.id) : ncrId;
        return arr(global.state && global.state.ncrs).find(function (n) { return n && same(n.id, id); }) || null;
    }

    /** The CB logo as image bytes with its pixel size, or null (Word then prints the name alone). */
    async function loadLogo(url) {
        if (!url) return null;
        try {
            let blob;
            const m = /^data:([^;,]+);base64,(.*)$/i.exec(url);
            if (m) {
                // Decoded here rather than fetched: a data: fetch is subject to
                // the site's connect-src.
                const bin = atob(m[2]);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                blob = new Blob([bytes], { type: m[1] });
            } else {
                const res = await fetch(url);
                if (!res.ok) return null;
                blob = await res.blob();
            }
            const type = String(blob.type || '').toLowerCase();
            const ext = /png/.test(type) ? 'png' : /jpe?g/.test(type) ? 'jpeg' : /gif/.test(type) ? 'gif' : '';
            if (!ext) return null;
            const bmp = await createImageBitmap(blob);
            const out = { bytes: new Uint8Array(await blob.arrayBuffer()), ext: ext, width: bmp.width, height: bmp.height };
            if (bmp.close) bmp.close();
            return out;
        } catch (_e) {
            return null;
        }
    }

    global.printCAR = function (ncrId) {
        if (!PS() || !DF()) { notify('The print module is not loaded. Reload the page and try again.', 'warning'); return null; }
        const ncr = findNCR(ncrId);
        if (!ncr) { notify('That nonconformity could not be found in the register.', 'error'); return null; }
        const win = PS().open(buildHtml(context(ncr)));
        if (!win) notify('Allow pop-ups for this site to open the CAR.', 'warning');
        return win;
    };

    function saveBytes(bytes, type, name) {
        const url = URL.createObjectURL(new Blob([bytes], { type: type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    global.downloadCARWord = async function (ncrId) {
        const ncr = findNCR(ncrId);
        if (!ncr) { notify('That nonconformity could not be found in the register.', 'error'); return; }
        const c = context(ncr);
        saveBytes(buildDocx(c, await loadLogo(c.brand.logoUrl)), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName(c, 'docx'));
    };

    /** Register records for a comma-separated id list, in register order; Major/Minor only. */
    function findNCRs(idList) {
        const ids = String(idList == null ? '' : idList).split(',').map(str).filter(Boolean);
        return ids.map(findNCR).filter(function (n) {
            return n && /^(major|minor)/i.test(str(n.severity || n.type)) && str(n.status) !== 'Withdrawn';
        });
    }

    global.printCARs = function (idList) {
        if (!PS() || !DF()) { notify('The print module is not loaded. Reload the page and try again.', 'warning'); return null; }
        const ncrs = findNCRs(idList);
        if (!ncrs.length) { notify('There are no Major or Minor nonconformities to issue.', 'info'); return null; }
        const win = PS().open(buildBatchHtml(ncrs.map(function (n) { return context(n); })));
        if (!win) notify('Allow pop-ups for this site to open the CARs.', 'warning');
        return win;
    };

    global.downloadCARsWord = async function (idList) {
        const ncrs = findNCRs(idList);
        if (!ncrs.length) { notify('There are no Major or Minor nonconformities to issue.', 'info'); return; }
        const cs = ncrs.map(function (n) { return context(n); });
        saveBytes(buildDocxZip(cs, await loadLogo(cs[0].brand.logoUrl)), 'application/zip', batchName(cs, 'zip'));
    };

    const API = {
        context: context, buildHtml: buildHtml, buildBatchHtml: buildBatchHtml, buildDocx: buildDocx, buildDocxZip: buildDocxZip,
        fileName: fileName, batchName: batchName, crc32: crc32
    };
    global.CarDocument = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'car-document.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

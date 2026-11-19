// fix-findings.js — one screen for every finding that still needs the
// auditor's own words, and a review-then-approve step for AI-drafted text.
//
// PC Connection's Report Integrity panel (2026-11-19) listed three NCs with no
// statement, eight raw field notes printed as client-facing evidence, two NCs
// with no objective evidence and an unapproved AI summary, each fixed one
// question at a time (and the AI summary had no approve control at all).
//
// Nothing here writes on the auditor's behalf:
//  - a missing statement is pre-filled with the template, the auditor's own
//    remark as the evidence, and the judgement left as a [blank] to write;
//  - "Polish" rewrites only text already in the box, and the result stays
//    editable (Undo puts the auditor's version back);
//  - Save writes only boxes the auditor changed, refuses a statement with a
//    [blank] still in it, and keeps the original note of a rewritten remark.
// It saves through window.saveChecklist, the same path as Review Criteria.
(function (global) {
    'use strict';

    const trim = (s) => String(s == null ? '' : s).trim();
    const lower = (s) => trim(s).toLowerCase();
    const isRegister = (t) => ['major', 'minor'].includes(lower(t));

    function decode(v) {
        const U = global.UTILS || {};
        const raw = String(v == null ? '' : v);
        return U.decodeEntities ? U.decodeEntities(raw) : raw;
    }
    function esc(v) {
        const U = global.UTILS || {};
        const s = String(v == null ? '' : v);
        return U.escapeHtml ? U.escapeHtml(s) : s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    // Stored checklist text is entity-encoded (saveChecklist runs it through
    // Sanitizer.sanitizeText); store the same way.
    function store(v) {
        const S = global.Sanitizer;
        return S && typeof S.sanitizeText === 'function' ? S.sanitizeText(v) : v;
    }

    // The same "reads as a field note" test as Report Integrity's E1.
    function rawNote(text) {
        const RI = global.ReportIntegrity;
        if (RI && typeof RI.looksLikeRawNote === 'function') return RI.looksLikeRawNote(text);
        const t = trim(text);
        if (!t || t.length > 120) return false;
        if (t.split(/\s+/).filter(Boolean).length > 6) return false;
        return !/[.!?]$/.test(t) || /^[a-z]/.test(t);
    }
    function hasBlanks(text) {
        const H = global.FindingStatementHint;
        return !!(H && H.hasBlanks(text));
    }

    // The question's own text, from the checklist when the answer doesn't carry it.
    function requirementOf(item) {
        const KB = global.KB_HELPERS;
        if (!KB || typeof KB.resolveChecklistClause !== 'function') return '';
        try { return KB.resolveChecklistClause(item, (global.state && global.state.checklists) || []).reqText || ''; } catch (_e) { return ''; }
    }

    /** Every checklist answer that needs the auditor's text, register NCs first. */
    function collect(report) {
        const out = [];
        (report && Array.isArray(report.checklistProgress) ? report.checklistProgress : []).forEach((item, index) => {
            if (!item) return;
            const nc = item.status === 'nc';
            const reg = nc && isRegister(item.ncrType);
            const comment = decode(item.comment || '');
            const statement = decode(item.ncrDescription || '');
            const approvedEvidence = trim(item.clientEvidenceStatement);
            const requirement = decode(item.requirement || requirementOf(item));
            const fields = [];

            if (trim(comment) && !approvedEvidence && rawNote(comment)) {
                fields.push({ key: 'comment', label: 'What you saw (printed as the objective evidence)', why: 'Reads as a field note, not a statement of what was reviewed and what it showed.', value: comment });
            } else if (reg && !trim(comment) && !approvedEvidence) {
                fields.push({ key: 'comment', label: 'What you saw (printed as the objective evidence)', why: 'No objective evidence recorded; the report prints "No evidence recorded."', value: '' });
            }

            if (reg && !trim(statement)) {
                const H = global.FindingStatementHint;
                const value = H ? H.withEvidence(H.forType(item.ncrType, item.criterionRef || item.clause, requirement), comment) : '';
                fields.push({ key: 'ncrDescription', label: 'Nonconformity statement', why: 'No statement recorded; the report prints "Nonconformity statement not recorded." Write the part in [brackets].', value, template: true });
            } else if (nc && hasBlanks(statement)) {
                fields.push({ key: 'ncrDescription', label: (reg ? 'Nonconformity statement' : 'Finding statement'), why: 'A template blank is still in the statement.', value: statement });
            } else if (nc && trim(statement) && !trim(comment) && rawNote(statement)) {
                fields.push({ key: 'ncrDescription', label: (reg ? 'Nonconformity statement' : 'Finding statement'), why: 'Reads as a field note, not a statement of the requirement and what was not fulfilled.', value: statement });
            }

            if (!fields.length) return;
            out.push({
                index,
                item,
                clause: trim(item.criterionRef) || trim(item.clause) || '(no clause)',
                grade: nc ? (trim(item.ncrType) || 'finding') : (trim(item.status) || 'not assessed'),
                question: requirement,
                register: reg,
                fields
            });
        });
        return out.sort((a, b) => (b.register ? 1 : 0) - (a.register ? 1 : 0) || a.index - b.index);
    }

    function rowHtml(row, r) {
        const q = row.question.length > 220 ? row.question.slice(0, 220) + '…' : row.question;
        const boxes = row.fields.map((f, k) => `
            <div style="margin-top:0.5rem;">
                <div style="display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap;">
                    <label for="ff-${r}-${k}" style="font-size:0.78rem;font-weight:600;color:#334155;margin:0;">${esc(f.label)}</label>
                    <span style="font-size:0.72rem;color:#b45309;flex:1;">${esc(f.why)}</span>
                    <button type="button" class="btn btn-sm btn-link ff-polish" data-box="ff-${r}-${k}" style="padding:0;font-size:0.72rem;" title="Rewrite only the text in this box in report language; you can edit or undo it">Polish</button>
                    <button type="button" class="btn btn-sm btn-link ff-undo" data-box="ff-${r}-${k}" style="padding:0;font-size:0.72rem;display:none;">Undo</button>
                </div>
                <textarea id="ff-${r}-${k}" class="form-control form-control-sm ff-box" rows="${f.key === 'ncrDescription' ? 3 : 2}"
                    data-row="${r}" data-index="${row.index}" data-key="${f.key}" data-template="${f.template ? '1' : ''}"
                    style="font-size:0.82rem;">${esc(f.value)}</textarea>
                <div class="ff-warning" data-box="ff-${r}-${k}" style="display:none;color:#dc2626;font-size:0.72rem;margin-top:0.15rem;"></div>
            </div>`).join('');
        return `
            <div class="ff-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.8rem;">
                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                    <span style="font-family:monospace;font-weight:700;font-size:0.82rem;">${esc(row.clause)}</span>
                    <span style="background:${row.register ? '#fee2e2' : '#eff6ff'};color:${row.register ? '#991b1b' : '#1d4ed8'};font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;text-transform:uppercase;">${esc(row.grade)}</span>
                    <span style="font-size:0.72rem;color:#94a3b8;">Checklist item ${row.index + 1}</span>
                </div>
                ${q ? `<div style="font-size:0.78rem;color:#64748b;margin-top:0.25rem;line-height:1.4;">${esc(q)}</div>` : ''}
                ${boxes}
            </div>`;
    }

    function refresh(reportId, message) {
        if (typeof global.saveChecklist === 'function') global.saveChecklist(reportId);
        if (typeof global.runReportIntegrityCheck === 'function') global.runReportIntegrityCheck(reportId);
        if (message && typeof global.showNotification === 'function') global.showNotification(message, 'success');
    }

    function findReport(reportId) {
        const st = global.state || {};
        return (st.auditReports || []).find((r) => String(r.id) === String(reportId)) || null;
    }

    /** Apply the edited boxes. Returns {applied, blocked}; writes nothing when blocked. */
    function apply(report, boxes) {
        const pending = [];
        const blocked = [];
        boxes.forEach((b) => {
            const value = trim(b.value);
            if (!value || value === trim(b.initial)) return;
            if (b.key === 'ncrDescription' && hasBlanks(value)) { blocked.push(b); return; }
            pending.push(Object.assign({}, b, { value }));
        });
        if (blocked.length) return { applied: 0, blocked };
        pending.forEach((b) => {
            const item = (report.checklistProgress || [])[b.index];
            if (!item) return;
            if (b.key === 'comment' && trim(item.comment) && !trim(item._originalComment)) item._originalComment = item.comment;
            item[b.key] = store(b.value);
        });
        return { applied: pending.length, blocked: [] };
    }

    global.openFixFindings = function (reportId) {
        const report = findReport(reportId);
        if (!report) { if (global.showNotification) global.showNotification('Report not found.', 'error'); return; }
        const rows = collect(report);
        if (!rows.length) {
            if (global.showNotification) global.showNotification('No finding needs your text: statements, evidence and notes are all written.', 'info');
            return;
        }
        const count = rows.reduce((n, r) => n + r.fields.length, 0);
        global.DataService.openFormModal('Fix findings — ' + count + ' to write', `
            <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;line-height:1.5;">
                Write what you saw and what was not fulfilled. A missing statement starts from the template with your remark as the evidence; replace the part in [brackets].
                "Polish" rewrites only the text in that box, and you can edit or undo it. Boxes you leave as they are stay unchanged. Save writes them all at once.
            </div>
            <div id="ff-list" style="display:flex;flex-direction:column;gap:0.6rem;max-height:58vh;overflow:auto;">${rows.map(rowHtml).join('')}</div>
        `, () => {
            const boxes = Array.from(document.querySelectorAll('.ff-box')).map((el) => ({
                el,
                index: parseInt(el.getAttribute('data-index'), 10),
                key: el.getAttribute('data-key'),
                value: el.value,
                initial: el.defaultValue
            }));
            document.querySelectorAll('.ff-warning').forEach((w) => { w.style.display = 'none'; w.textContent = ''; });
            const res = apply(report, boxes);
            if (res.blocked.length) {
                res.blocked.forEach((b) => {
                    const w = document.querySelector('.ff-warning[data-box="' + b.el.id + '"]');
                    if (w) { w.textContent = 'Replace the part in [brackets] before saving.'; w.style.display = 'block'; }
                });
                res.blocked[0].el.focus();
                if (global.showNotification) global.showNotification('A statement still has a [bracketed] blank. Write it, or clear the box to skip it.', 'error');
                return;
            }
            if (!res.applied) { if (global.showNotification) global.showNotification('Nothing changed, so nothing was written.', 'info'); return; }
            if (typeof global.closeModal === 'function') global.closeModal();
            refresh(reportId, 'Saved ' + res.applied + ' finding text' + (res.applied === 1 ? '' : 's') + '.');
        });

        const list = document.getElementById('ff-list');
        if (!list) return;
        list.addEventListener('click', async (e) => {
            const polish = e.target.closest('.ff-polish');
            const undo = e.target.closest('.ff-undo');
            if (undo) {
                const box = document.getElementById(undo.getAttribute('data-box'));
                if (box && box.dataset.before != null) { box.value = box.dataset.before; delete box.dataset.before; }
                undo.style.display = 'none';
                return;
            }
            if (!polish) return;
            const box = document.getElementById(polish.getAttribute('data-box'));
            if (!box) return;
            const text = trim(box.value);
            if (!text) { if (global.showNotification) global.showNotification('Write your note first; Polish only rewrites what is in the box.', 'info'); return; }
            if (hasBlanks(text)) { if (global.showNotification) global.showNotification('Fill the [bracketed] part first, then Polish.', 'info'); return; }
            const AI = global.AI_SERVICE;
            if (!AI || typeof AI.refineAuditNotes !== 'function') { if (global.showNotification) global.showNotification('AI is not available.', 'warning'); return; }
            const row = rows[parseInt(box.getAttribute('data-row'), 10)];
            polish.disabled = true;
            polish.textContent = 'Polishing…';
            try {
                const out = await AI.refineAuditNotes([{ clause: row.clause, status: row.item.status === 'nc' ? lower(row.item.ncrType) : row.item.status, comment: text }], report.standard || '');
                const refined = out && out[0] && trim(out[0].comment);
                if (refined && refined !== text) {
                    box.dataset.before = box.value;
                    box.value = refined;
                    const u = list.querySelector('.ff-undo[data-box="' + box.id + '"]');
                    if (u) u.style.display = '';
                }
            } catch (err) {
                if (global.showNotification) global.showNotification('Polish failed: ' + ((err && err.message) || 'unknown error'), 'error');
            } finally {
                polish.disabled = false;
                polish.textContent = 'Polish';
            }
        });
    };

    /** The AI-drafted text not yet approved: report narrative and checklist remarks. */
    function pendingAi(report) {
        const content = report && report.aiContent ? report.aiContent : {};
        const keys = Object.keys(content).filter((k) => content[k] && content[k].status !== 'approved');
        const items = (report && Array.isArray(report.checklistProgress) ? report.checklistProgress : [])
            .map((i, index) => ({ i, index }))
            .filter((x) => x.i && x.i._aiGenerated === true && x.i._auditorConfirmed !== true);
        return { keys, items };
    }

    const NARRATIVE = { execSummary: [['Executive summary', 'executiveSummary'], ['Positive observations', 'positiveObservations'], ['Opportunities for improvement', 'ofi']] };

    global.approveAiText = function (reportId) {
        const report = findReport(reportId);
        if (!report) { if (global.showNotification) global.showNotification('Report not found.', 'error'); return; }
        const p = pendingAi(report);
        if (!p.keys.length && !p.items.length) {
            if (global.showNotification) global.showNotification('There is no AI-drafted text waiting for approval.', 'info');
            return;
        }
        const block = (label, text) => `
            <div style="margin-bottom:0.6rem;">
                <div style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;">${esc(label)}</div>
                <div style="font-size:0.82rem;color:#1e293b;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.5rem 0.6rem;margin-top:0.2rem;">${trim(text) ? esc(decode(text)) : '<em style="color:#94a3b8;">empty</em>'}</div>
            </div>`;
        const narrative = p.keys.map((k) => (NARRATIVE[k] || [[k, k]]).map(([label, field]) => block(label, report[field])).join('')).join('');
        const remarks = p.items.map((x) => block('Checklist item ' + (x.index + 1) + ' — ' + (trim(x.i.criterionRef) || trim(x.i.clause)), x.i.comment)).join('');
        global.DataService.openFormModal('Review AI-drafted text', `
            <div style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;line-height:1.5;">
                Read it against what you recorded. To change the summary, close this and edit it in Report Preview first.
                <strong>Save approves this text as yours</strong> and clears the "AI-generated content has not been approved" warning.
            </div>
            <div style="max-height:58vh;overflow:auto;">${narrative}${remarks}</div>
        `, () => {
            const changed = typeof global.confirmAiContent === 'function' ? global.confirmAiContent(reportId, 'all') : false;
            if (typeof global.closeModal === 'function') global.closeModal();
            if (changed && typeof global.runReportIntegrityCheck === 'function') global.runReportIntegrityCheck(reportId);
        });
    };

    global.FixFindings = { collect, apply, pendingAi };
})(typeof window !== 'undefined' ? window : globalThis);

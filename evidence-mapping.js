// evidence-mapping.js — is each screenshot filed under the right question?
//
// PC Connection recert (2026-11-20): 19 of 118 screenshots sat under a
// different question from the one they supported. The change register was
// under the incident review, the remote-work policies and the CCTV procedure
// under budgeting, the training records under the policy question. The report
// then showed "conform" answers with no evidence of their own while the
// evidence sat one question away, and a per-question file count hid it.
//
// The check sends the screenshots of one question at a time, with the list of
// every question on the checklist, and asks where each belongs
// (AI_SERVICE.mapEvidence). Nothing here writes on the auditor's behalf:
//  - a proposal is a row on a review screen, set to "Leave where it is";
//  - the auditor picks Move or Also attach per screenshot, then Save;
//  - Save moves only those, keeps each capture time with its screenshot,
//    records the move on the question that received it, and goes through
//    window.saveChecklist like Fix findings.
(function (global) {
    'use strict';

    const trim = (s) => String(s == null ? '' : s).trim();
    const lower = (s) => trim(s).toLowerCase();
    const DERIVED = ['evidenceThumbs', 'evidenceImageThumb', '_evIds', '_origEvKeys'];
    const CONCURRENCY = 3;
    const ALSO_PER_QUESTION = 2;

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
    function notify(message, type) {
        if (typeof global.showNotification === 'function') global.showNotification(message, type);
    }

    // Same key as ChecklistMerge: a question keeps it when the list is reordered.
    const keyOf = (p) => (p && p.isCustom ? 'custom-' + p.itemIdx : (p ? p.checklistId + '-' + p.itemIdx : ''));
    const imagesOf = (item) => (item && Array.isArray(item.evidenceImages) && item.evidenceImages.length
        ? item.evidenceImages
        : (item && item.evidenceImage ? [item.evidenceImage] : [])).filter(Boolean).map(String);
    const progressOf = (report) => (report && Array.isArray(report.checklistProgress) ? report.checklistProgress : []);

    function requirementOf(item) {
        if (item && item.requirement) return item.requirement;
        const KB = global.KB_HELPERS;
        if (!KB || typeof KB.resolveChecklistClause !== 'function') return '';
        try { return KB.resolveChecklistClause(item, (global.state && global.state.checklists) || []).reqText || ''; } catch (_e) { return ''; }
    }

    /** Every question on the checklist, numbered as the auditor sees them. */
    function questionIndex(report) {
        return progressOf(report).map((item, index) => ({
            n: index + 1,
            index,
            key: keyOf(item),
            clause: trim(item && (item.criterionRef || item.clause)),
            text: decode(requirementOf(item)).replace(/\s+/g, ' ').trim(),
            status: lower(item && item.status)
        }));
    }

    /** One AI call each: the screenshots of one question, at most `max` at a time. */
    function batches(report, max) {
        const size = max || (global.AI_SERVICE && global.AI_SERVICE.EVIDENCE_MAX_IMAGES) || 6;
        const out = [];
        progressOf(report).forEach((item, index) => {
            const srcs = imagesOf(item);
            for (let at = 0; at < srcs.length; at += size) {
                out.push({
                    index,
                    n: index + 1,
                    key: keyOf(item),
                    images: srcs.slice(at, at + size).map((src, k) => ({ evId: 'Image ' + (at + k + 1), src }))
                });
            }
        });
        return out;
    }

    function totals(report) {
        let images = 0;
        let questions = 0;
        progressOf(report).forEach((item) => {
            const n = imagesOf(item).length;
            if (n) { images += n; questions++; }
        });
        return { images, questions };
    }

    // Where every screenshot is filed now: results are reused only while this
    // has not changed.
    function signature(report) {
        return progressOf(report).map((item) => keyOf(item) + '=' + imagesOf(item).join('|')).join('\n');
    }

    const cache = {};

    /**
     * Run the check. Returns { rows, calls, failedCalls, stopped }; one row
     * per screenshot: { src, from, shows, fit, to, also, reason, flags, error }.
     * opts.onProgress(done, total); opts.shouldStop() ends it early.
     */
    async function check(report, opts) {
        const o = opts || {};
        const AI = global.AI_SERVICE;
        if (!AI || typeof AI.mapEvidence !== 'function') throw new Error('AI is not available.');
        const questions = questionIndex(report);
        const byN = new Map(questions.map((q) => [q.n, q]));
        const work = batches(report);
        const rows = [];
        let done = 0;
        let failedCalls = 0;
        let next = 0;
        let stopped = false;
        // empty: the question has no screenshot of its own, so one that also
        // supports it is worth offering.
        const withImages = new Set(progressOf(report).filter((item) => imagesOf(item).length).map(keyOf));
        const place = (q) => (q ? { n: q.n, key: q.key, clause: q.clause, text: q.text, status: q.status, empty: !withImages.has(q.key) } : null);

        async function worker() {
            while (next < work.length) {
                if (typeof o.shouldStop === 'function' && o.shouldStop()) { stopped = true; return; }
                const b = work[next++];
                const from = place(byN.get(b.n));
                const base = (im, extra) => Object.assign({ src: im.src, from, shows: '', here: '', fit: 'unchecked', to: null, also: [], reason: '', flags: [], error: '' }, extra);
                try {
                    const res = await AI.mapEvidence({
                        current: { n: from.n, clause: from.clause, text: from.text },
                        questions: questions.map((q) => ({ n: q.n, clause: q.clause, text: q.text })),
                        images: b.images
                    });
                    const byId = new Map((res.images || []).map((im) => [im.evId, im]));
                    const failed = new Map((res.imagesFailed || []).map((f) => [f.evId, f.reason]));
                    b.images.forEach((im) => {
                        const r = byId.get(im.evId);
                        if (!r) { rows.push(base(im, { error: failed.get(im.evId) || 'Not checked.' })); return; }
                        rows.push(base(im, {
                            shows: r.shows,
                            here: r.here || '',
                            fit: r.fit,
                            to: r.betterItem != null ? place(byN.get(r.betterItem)) : null,
                            also: (r.alsoItems || []).map((n) => place(byN.get(n))).filter(Boolean),
                            reason: r.reason,
                            flags: (res.flags || []).filter((f) => f.indexOf(im.evId + ':') === 0 || f.indexOf(im.evId + ' reason:') === 0)
                        }));
                    });
                } catch (err) {
                    failedCalls++;
                    b.images.forEach((im) => rows.push(base(im, { error: (err && err.message) || 'The AI call failed.' })));
                    if (err && err.authRequired) { stopped = true; next = work.length; }
                }
                done++;
                if (typeof o.onProgress === 'function') o.onProgress(done, work.length);
            }
        }
        await Promise.all(Array.from({ length: Math.min(o.concurrency || CONCURRENCY, work.length) }, worker));
        rows.sort((a, b) => a.from.n - b.from.n);
        return { rows, calls: work.length, failedCalls, stopped };
    }

    // A question that has no screenshot and is not set aside (not sampled, not
    // applicable) is worth offering a screenshot that also supports it.
    const needsEvidence = (p) => !!p && p.empty && p.status !== 'not_sampled' && p.status !== 'na';

    /**
     * What the auditor has to decide on. move: screenshots that may belong with
     * another question. gaps: questions with no screenshot of their own, each
     * with the screenshots under other questions that also support it — at
     * most ALSO_PER_QUESTION, the directly fitting ones first (the live run
     * found five dashboards for one question; one or two is enough).
     */
    function proposals(rows) {
        const list = Array.isArray(rows) ? rows : [];
        const byTarget = new Map();
        list.filter((r) => r.fit === 'fits').forEach((r) => {
            (r.also || []).filter(needsEvidence).forEach((p) => {
                const g = byTarget.get(p.key) || { target: p, rows: [] };
                g.rows.push(r);
                byTarget.set(p.key, g);
            });
        });
        const rank = (r) => (r.here === 'direct' ? 0 : 1);
        const gaps = Array.from(byTarget.values()).sort((a, b) => a.target.n - b.target.n).map((g) => ({
            target: g.target,
            total: g.rows.length,
            rows: g.rows.slice().sort((a, b) => rank(a) - rank(b) || a.from.n - b.from.n).slice(0, ALSO_PER_QUESTION)
        }));
        return {
            move: list.filter((r) => r.fit === 'fits_better_elsewhere' && r.to),
            gaps,
            unrelated: list.filter((r) => r.fit === 'unrelated'),
            unreadable: list.filter((r) => r.fit === 'unreadable'),
            unchecked: list.filter((r) => r.fit === 'unchecked'),
            fits: list.filter((r) => r.fit === 'fits')
        };
    }

    /**
     * Questions that have screenshots now and would have none once the chosen
     * moves are made. decisions: [{src, fromKey, toKey, mode}].
     */
    function hollowAfter(report, decisions) {
        const moved = {};
        (decisions || []).forEach((d) => { if (d.mode === 'move') (moved[d.fromKey] = moved[d.fromKey] || new Set()).add(String(d.src)); });
        const out = [];
        progressOf(report).forEach((item, index) => {
            const gone = moved[keyOf(item)];
            if (!gone) return;
            const srcs = imagesOf(item);
            if (srcs.length && srcs.every((s) => gone.has(s))) {
                out.push({ n: index + 1, clause: trim(item.criterionRef || item.clause), remark: !!trim(decode(item.comment)) });
            }
        });
        return out;
    }

    function who() {
        const st = global.state || {};
        const u = st.currentUser || {};
        return trim(u.name || u.email || '');
    }

    /**
     * Make the chosen moves on the report in memory. A screenshot that is no
     * longer under the question it was checked under is skipped, never guessed.
     * Returns { moved, copied, skipped }.
     */
    function apply(report, decisions) {
        const items = progressOf(report);
        const byKey = new Map(items.map((item) => [keyOf(item), item]));
        const res = { moved: 0, copied: 0, skipped: 0 };
        const stamp = new Date().toISOString();
        const normalise = (item) => {
            const srcs = imagesOf(item);
            const times = Array.isArray(item.evidenceCapturedAtList) ? item.evidenceCapturedAtList.slice(0, srcs.length) : [];
            while (times.length < srcs.length) times.push('');
            if (!times[0] && srcs.length && item.evidenceCapturedAt) times[0] = item.evidenceCapturedAt;
            return { srcs, times };
        };
        const write = (item, srcs, times) => {
            item.evidenceImages = srcs;
            item.evidenceImage = srcs[0] || '';
            item.evidenceCapturedAtList = times;
            item.evidenceCapturedAt = times.find(Boolean) || '';
            // Report-time copies are aligned to the old list; they are rebuilt.
            DERIVED.forEach((k) => { delete item[k]; });
        };
        (decisions || []).forEach((d) => {
            const from = byKey.get(d.fromKey);
            const to = byKey.get(d.toKey);
            const src = String(d.src || '');
            if (!from || !to || from === to || !src || (d.mode !== 'move' && d.mode !== 'copy')) { res.skipped++; return; }
            const f = normalise(from);
            const at = f.srcs.indexOf(src);
            if (at === -1) { res.skipped++; return; }
            const t = normalise(to);
            if (t.srcs.indexOf(src) === -1) {
                t.srcs.push(src);
                t.times.push(f.times[at] || '');
                write(to, t.srcs, t.times);
                const log = Array.isArray(to.evidenceRemapLog) ? to.evidenceRemapLog.slice() : [];
                log.push({ at: stamp, by: who(), mode: d.mode, from: d.fromKey, fromClause: trim(from.criterionRef || from.clause), file: src.split('?')[0].split('/').pop() });
                to.evidenceRemapLog = log;
            }
            if (d.mode === 'move') {
                f.srcs.splice(at, 1);
                f.times.splice(at, 1);
                write(from, f.srcs, f.times);
                res.moved++;
            } else {
                res.copied++;
            }
        });
        return res;
    }

    // ── The review screen ─────────────────────────────────────────────

    function findReport(reportId) {
        const st = global.state || {};
        return (st.auditReports || []).find((r) => String(r.id) === String(reportId)) || null;
    }
    const short = (text, n) => (text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text);
    const placeLabel = (p) => 'item ' + p.n + (p.clause ? ' · ' + p.clause : '');

    function thumbHtml(src) {
        const idb = /^idb:\/\//.test(src);
        const attrs = idb ? 'data-idb-key="' + esc(src) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="' : 'src="' + esc(src) + '"';
        const img = '<img ' + attrs + ' alt="Screenshot" loading="lazy" style="width:132px;height:84px;object-fit:cover;border:1px solid #cbd5e1;border-radius:6px;background:#f1f5f9;display:block;">';
        // Open the full screenshot to check the AI's reading of it.
        return /^https?:\/\//i.test(src)
            ? '<a href="' + esc(src) + '" target="_blank" rel="noopener" title="Open the screenshot" style="flex:none;">' + img + '</a>'
            : '<span style="flex:none;">' + img + '</span>';
    }

    // kind 'move': a screenshot that may belong with row.to. kind 'also': a
    // screenshot that fits where it is and also supports `gap`, a question
    // with no screenshot; the only thing offered there is to attach it too.
    // (The first live run listed 46 "also supports" rows, most of them between
    // well-evidenced questions, so those are not offered.)
    function rowHtml(row, r, kind, gap) {
        const options = ['<option value="">Leave where it is</option>'];
        if (kind === 'move') {
            options.push('<option value="move:' + esc(row.to.key) + '">Move to ' + esc(placeLabel(row.to)) + '</option>');
            options.push('<option value="copy:' + esc(row.to.key) + '">Also attach to ' + esc(placeLabel(row.to)) + '</option>');
            (row.also || []).forEach((p) => options.push('<option value="copy:' + esc(p.key) + '">Also attach to ' + esc(placeLabel(p)) + '</option>'));
        } else {
            options.push('<option value="copy:' + esc(gap.key) + '">Also attach to ' + esc(placeLabel(gap)) + '</option>');
        }
        const target = kind === 'move' ? row.to : null;
        return `
            <div class="em-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.8rem;display:flex;gap:0.8rem;align-items:flex-start;">
                ${thumbHtml(row.src)}
                <div style="flex:1;min-width:0;font-size:0.8rem;line-height:1.45;color:#334155;">
                    <div><strong>${esc(row.shows || 'No description: look at the screenshot.')}</strong></div>
                    <div style="color:#64748b;">Filed under <span style="font-family:monospace;">${esc(placeLabel(row.from))}</span>: ${esc(short(row.from.text, 110))}</div>
                    ${target ? `<div style="color:#1d4ed8;">May belong with <span style="font-family:monospace;">${esc(placeLabel(target))}</span>: ${esc(short(target.text, 110))}</div>` : ''}
                    ${row.reason ? `<div style="color:#64748b;">Why: ${esc(row.reason)}</div>` : ''}
                    <select class="form-control form-control-sm em-choice" data-row="${r}" aria-label="What to do with this screenshot" style="margin-top:0.35rem;max-width:26rem;font-size:0.8rem;">${options.join('')}</select>
                </div>
            </div>`;
    }

    function summaryText(p, total) {
        const parts = [p.fits.length + ' fit the question they are under'];
        if (p.move.length) parts.push(p.move.length + ' may belong with another question');
        if (p.unrelated.length) parts.push(p.unrelated.length + ' ' + (p.unrelated.length === 1 ? 'does' : 'do') + ' not look like evidence for any question');
        if (p.unreadable.length) parts.push(p.unreadable.length + ' could not be read');
        if (p.unchecked.length) parts.push(p.unchecked.length + ' could not be checked');
        return total + ' screenshot' + (total === 1 ? '' : 's') + ' checked: ' + parts.join(', ') + '.';
    }

    function listHtml(title, rows) {
        if (!rows.length) return '';
        return `<div style="font-size:0.78rem;color:#64748b;margin-top:0.5rem;"><strong>${esc(title)}:</strong> ${rows.map((r) => esc(placeLabel(r.from) + (r.error ? ' (' + r.error + ')' : ''))).join('; ')}</div>`;
    }

    function showResults(reportId, report, result) {
        const p = proposals(result.rows);
        const shown = p.move.map((row) => ({ row, kind: 'move' }));
        const gapsHtml = p.gaps.map((g) => {
            const more = g.total > g.rows.length ? ' <span style="color:#94a3b8;">(' + g.rows.length + ' of ' + g.total + ' shown)</span>' : '';
            const head = '<div style="font-size:0.8rem;color:#334155;margin-top:0.2rem;"><span style="font-family:monospace;font-weight:700;">' + esc(placeLabel(g.target)) + '</span> has no screenshot of its own: ' + esc(short(g.target.text, 120)) + more + '</div>';
            return head + g.rows.map((row) => { shown.push({ row, kind: 'also' }); return rowHtml(row, shown.length - 1, 'also', g.target); }).join('');
        }).join('');
        const body = `
            <div style="font-size:0.85rem;color:#475569;margin-bottom:0.6rem;line-height:1.5;">
                ${esc(summaryText(p, result.rows.length))}
                ${shown.length ? 'Each proposal below is the AI\'s reading of the screenshot. Nothing moves unless you choose it here and press Save.' : 'There is nothing to move.'}
                ${result.stopped ? '<strong>The check was stopped before it finished.</strong>' : ''}
            </div>
            <div id="em-hollow" style="display:none;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.8rem;color:#92400e;margin-bottom:0.6rem;"></div>
            <div id="em-list" style="display:flex;flex-direction:column;gap:0.6rem;max-height:54vh;overflow:auto;">
                ${p.move.length ? '<div style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;">May belong with another question</div>' : ''}
                ${p.move.map((row, i) => rowHtml(row, i, 'move')).join('')}
                ${p.gaps.length ? '<div style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;margin-top:0.3rem;">Questions with no screenshot that one filed elsewhere also supports</div>' : ''}
                ${gapsHtml}
            </div>
            ${listHtml('Not evidence for any question', p.unrelated)}
            ${listHtml('Could not be read', p.unreadable)}
            ${listHtml('Could not be checked', p.unchecked)}
            <div style="margin-top:0.6rem;"><button type="button" class="btn btn-sm btn-link" id="em-again" style="padding:0;font-size:0.78rem;">Check again</button></div>`;

        const decisionsNow = () => Array.from(document.querySelectorAll('.em-choice')).map((el) => {
            const value = el.value || '';
            const at = value.indexOf(':');
            if (at === -1) return null;
            const s = shown[parseInt(el.getAttribute('data-row'), 10)];
            return s ? { src: s.row.src, fromKey: s.row.from.key, toKey: value.slice(at + 1), mode: value.slice(0, at) } : null;
        }).filter(Boolean);

        global.DataService.openFormModal('Evidence mapping — ' + p.move.length + ' to review', body, shown.length ? () => {
            const decisions = decisionsNow();
            if (!decisions.length) { notify('Nothing was chosen, so nothing was moved.', 'info'); return; }
            const res = apply(report, decisions);
            delete cache[String(reportId)];
            if (typeof global.closeModal === 'function') global.closeModal();
            if (res.moved || res.copied) {
                if (typeof global.saveChecklist === 'function') global.saveChecklist(reportId);
                if (typeof global.runReportIntegrityCheck === 'function') global.runReportIntegrityCheck(reportId);
            }
            const said = [];
            if (res.moved) said.push('moved ' + res.moved);
            if (res.copied) said.push('attached ' + res.copied + ' to another question');
            if (res.skipped) said.push('skipped ' + res.skipped + ' no longer where they were');
            notify('Screenshots: ' + said.join(', ') + '.', res.moved || res.copied ? 'success' : 'warning');
        } : null);

        const hollow = document.getElementById('em-hollow');
        const list = document.getElementById('em-list');
        if (list && hollow) {
            list.addEventListener('change', () => {
                const h = hollowAfter(report, decisionsNow());
                hollow.style.display = h.length ? 'block' : 'none';
                hollow.textContent = h.length
                    ? 'After these moves, ' + h.map((x) => 'item ' + x.n + ' (' + [x.clause, x.remark ? '' : 'no remark either'].filter(Boolean).join(', ') + ')').join('; ') + ' would have no screenshot of ' + (h.length === 1 ? 'its' : 'their') + ' own.'
                    : '';
            });
        }
        const again = document.getElementById('em-again');
        if (again) again.addEventListener('click', () => { delete cache[String(reportId)]; global.openEvidenceMapping(reportId); });
        if (typeof global.resolveAllIdbThumbs === 'function') global.resolveAllIdbThumbs();
    }

    async function run(reportId, report) {
        let stop = false;
        const t = totals(report);
        global.DataService.openFormModal('Evidence mapping — checking', `
            <div style="font-size:0.9rem;color:#334155;line-height:1.6;">
                <div id="em-progress">Checking ${t.images} screenshot${t.images === 1 ? '' : 's'}…</div>
                <div style="height:8px;background:#e2e8f0;border-radius:4px;margin:0.6rem 0;overflow:hidden;"><div id="em-bar" style="height:100%;width:0;background:#2563eb;transition:width 0.3s;"></div></div>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="em-stop">Stop</button>
            </div>`, null);
        const stopBtn = document.getElementById('em-stop');
        if (stopBtn) stopBtn.addEventListener('click', () => { stop = true; stopBtn.disabled = true; stopBtn.textContent = 'Stopping…'; });
        const sig = signature(report);
        let result;
        try {
            result = await check(report, {
                shouldStop: () => stop,
                onProgress: (done, total) => {
                    const label = document.getElementById('em-progress');
                    const bar = document.getElementById('em-bar');
                    if (label) label.textContent = 'Checked ' + done + ' of ' + total + ' question group' + (total === 1 ? '' : 's') + '…';
                    if (bar) bar.style.width = Math.round(done / total * 100) + '%';
                }
            });
        } catch (err) {
            if (typeof global.closeModal === 'function') global.closeModal();
            notify('Evidence mapping failed: ' + ((err && err.message) || 'unknown error'), 'error');
            return;
        }
        if (!result.stopped && signature(report) === sig) cache[String(reportId)] = { sig, result };
        showResults(reportId, report, result);
    }

    global.openEvidenceMapping = function (reportId) {
        const report = findReport(reportId);
        if (!report) { notify('Report not found.', 'error'); return; }
        const t = totals(report);
        if (!t.images) { notify('No screenshots are attached to this checklist.', 'info'); return; }
        const AI = global.AI_SERVICE;
        if (!AI || typeof AI.mapEvidence !== 'function') { notify('AI is not available.', 'warning'); return; }
        const kept = cache[String(reportId)];
        if (kept && kept.sig === signature(report)) { showResults(reportId, report, kept.result); return; }
        const calls = batches(report).length;
        global.DataService.openFormModal('Evidence mapping', `
            <div style="font-size:0.88rem;color:#334155;line-height:1.6;">
                <p style="margin:0 0 0.6rem;">This checks that each screenshot is filed under the question it supports, and proposes a better question where it is not.</p>
                <ul style="margin:0 0 0.8rem 1.1rem;padding:0;">
                    <li><strong>${t.images} screenshot${t.images === 1 ? '' : 's'}</strong> on ${t.questions} question${t.questions === 1 ? '' : 's'} will be sent to the AI service, in ${calls} request${calls === 1 ? '' : 's'}. It takes a few minutes.</li>
                    <li>You get a list of proposals. <strong>Nothing moves unless you choose it and press Save.</strong></li>
                    <li>Results and remarks are not changed.</li>
                </ul>
                <button type="button" class="btn btn-primary" id="em-start">Check ${t.images} screenshot${t.images === 1 ? '' : 's'}</button>
            </div>`, null);
        const start = document.getElementById('em-start');
        if (start) start.addEventListener('click', () => { run(reportId, report); });
    };

    /** Drop kept results, for one report or all. */
    function forget(reportId) {
        if (reportId == null) Object.keys(cache).forEach((k) => { delete cache[k]; });
        else delete cache[String(reportId)];
    }

    global.EvidenceMapping = { questionIndex, batches, totals, check, proposals, hollowAfter, apply, signature, forget };
})(typeof window !== 'undefined' ? window : globalThis);

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
//  - every screenshot is read twice; a move both readings agree on is marked
//    Strong, and one button sets all of those to Move (2026-11-20: the user
//    asked for less reading per audit, and single runs disagreed with each
//    other on the borderline cases);
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
    // Each screenshot is read twice, so the moves both readings agree on can
    // be told from the ones that come and go between runs.
    const PASSES = 2;
    // Measured live: 48 requests, three at a time, took about 230 seconds.
    const SECONDS_PER_REQUEST = 4.8;

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

    // One row from every reading of one screenshot. On the same 118 screenshots
    // three single runs proposed 26, 24 and 29 moves: the clear misfiles came
    // back every time, the borderline ones came and went. So with two or more
    // readings a move is 'strong' only when every reading proposes the same
    // question; anything less is 'possible' and says why.
    function combine(entry, passes) {
        const row = { src: entry.src, from: entry.from, shows: '', here: '', fit: 'unchecked', to: null, alt: null, also: [], strength: '', doubt: '', reason: '', flags: [], error: '', reads: 0 };
        const ok = entry.reads.filter((r) => r.ok);
        // How many readings came back: fewer than asked for means a request failed.
        row.reads = ok.length;
        if (!ok.length) return Object.assign(row, { error: (entry.reads.find((r) => r.error) || {}).error || 'Not checked.' });
        const readable = ok.filter((r) => r.fit !== 'unreadable');
        if (!readable.length) return Object.assign(row, { fit: 'unreadable', here: 'unreadable', shows: ok[0].shows || '' });
        const first = (list, field) => (list.find((r) => r[field]) || {})[field] || '';
        const flags = Array.from(new Set([].concat.apply([], readable.map((r) => r.flags || []))));
        const places = (skip) => {
            const seen = new Set(skip.filter(Boolean).map((x) => x.key));
            const out = [];
            readable.forEach((r) => (r.also || []).forEach((x) => { if (x && !seen.has(x.key)) { seen.add(x.key); out.push(x); } }));
            return out;
        };
        const moves = readable.filter((r) => r.fit === 'fits_better_elsewhere' && r.to);
        if (moves.length) {
            const to = moves[0].to;
            const other = moves.find((m) => m.to.key !== to.key);
            const agreed = passes > 1 && moves.length === passes && !other;
            let doubt = '';
            if (passes > 1 && !agreed) {
                doubt = other ? 'The checks proposed different questions.'
                    : (ok.length < passes ? 'Only one check gave a reading.' : 'Not every check proposed a move.');
            }
            return Object.assign(row, {
                fit: 'fits_better_elsewhere', here: 'none', to, alt: other ? other.to : null,
                strength: passes > 1 ? (agreed ? 'strong' : 'possible') : '', doubt,
                shows: first(moves, 'shows') || first(readable, 'shows'), reason: first(moves, 'reason'),
                also: places([to, other && other.to]), flags
            });
        }
        if (readable.every((r) => r.fit === 'unrelated')) return Object.assign(row, { fit: 'unrelated', here: 'none', shows: first(readable, 'shows'), flags });
        // Fits where it is. An "also supports" question every reading named is the surer one.
        const counts = new Map();
        readable.forEach((r) => new Set((r.also || []).filter(Boolean).map((x) => x.key)).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1)));
        return Object.assign(row, {
            fit: 'fits', here: readable.some((r) => r.here === 'direct') ? 'direct' : first(readable, 'here'),
            shows: first(readable, 'shows'), reason: first(readable, 'reason'),
            also: places([]).map((x) => Object.assign({}, x, { agreed: passes > 1 && counts.get(x.key) === passes })), flags
        });
    }

    /**
     * Run the check. Returns { rows, calls, failedCalls, stopped, passes }; one
     * row per screenshot: { src, from, shows, here, fit, to, alt, also,
     * strength, doubt, reason, flags, error }.
     * opts.passes: how many times each screenshot is read (default 1); see
     * combine() for what 'strong' means. opts.onProgress(done, total);
     * opts.shouldStop() ends it early.
     */
    async function check(report, opts) {
        const o = opts || {};
        const AI = global.AI_SERVICE;
        if (!AI || typeof AI.mapEvidence !== 'function') throw new Error('AI is not available.');
        const questions = questionIndex(report);
        const byN = new Map(questions.map((q) => [q.n, q]));
        const work = batches(report);
        const passes = Math.max(1, parseInt(o.passes, 10) || 1);
        // Every screenshot once before any is read a second time, so a run
        // that is stopped part-way still has a reading of each.
        const jobs = [];
        for (let pass = 0; pass < passes; pass++) work.forEach((b) => jobs.push({ b, id: jobs.length }));
        // opts.resume: an earlier result for the same screenshots. Requests
        // that were answered then are not sent again; only the rest are.
        const sig = signature(report);
        const prior = o.resume && o.resume._state && o.resume._state.sig === sig && o.resume.passes === passes ? o.resume._state : null;
        const doneIds = new Set(prior ? prior.doneIds : []);
        const todo = jobs.filter((j) => !doneIds.has(j.id));
        let done = doneIds.size;
        let failedCalls = 0;
        let next = 0;
        let stopped = false;
        let stoppedBusy = false;
        // empty: the question has no screenshot of its own, so one that also
        // supports it is worth offering.
        const withImages = new Set(progressOf(report).filter((item) => imagesOf(item).length).map(keyOf));
        const place = (q) => (q ? { n: q.n, key: q.key, clause: q.clause, text: q.text, status: q.status, empty: !withImages.has(q.key) } : null);
        const entries = new Map();
        const entryOf = (b, im) => b.key + '|' + im.evId + '|' + im.src;
        work.forEach((b) => b.images.forEach((im) => {
            const key = entryOf(b, im);
            // Readings from requests that were answered before; a failed
            // request's placeholder readings are dropped, it is sent again.
            const kept = prior && prior.entries.get(key) ? prior.entries.get(key).reads.filter((r) => doneIds.has(r.job)) : [];
            entries.set(key, { src: im.src, from: place(byN.get(b.n)), reads: kept });
        }));

        async function worker() {
            while (next < todo.length) {
                if (typeof o.shouldStop === 'function' && o.shouldStop()) { stopped = true; return; }
                const job = todo[next++];
                const b = job.b;
                const from = place(byN.get(b.n));
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
                        entries.get(entryOf(b, im)).reads.push(r ? {
                            ok: true,
                            job: job.id,
                            shows: r.shows,
                            here: r.here || '',
                            fit: r.fit,
                            to: r.betterItem != null ? place(byN.get(r.betterItem)) : null,
                            also: (r.alsoItems || []).map((n) => place(byN.get(n))).filter(Boolean),
                            reason: r.reason,
                            flags: (res.flags || []).filter((f) => f.indexOf(im.evId + ':') === 0 || f.indexOf(im.evId + ' reason:') === 0)
                        } : { ok: false, job: job.id, error: failed.get(im.evId) || 'Not checked.' });
                    });
                    doneIds.add(job.id);
                } catch (err) {
                    failedCalls++;
                    // A stopped wait is not a failure of this screenshot.
                    if (!(err && err.stopped)) b.images.forEach((im) => entries.get(entryOf(b, im)).reads.push({ ok: false, job: job.id, error: (err && err.message) || 'The AI call failed.' }));
                    // Signed out, or the AI service stayed busy through every
                    // wait: the remaining requests would only do the same.
                    // (Live, 2026-11-21: a rate limit lasted over 12 minutes,
                    // and 63 requests were each going to wait 5 minutes.)
                    if (err && (err.authRequired || err.busy)) { stopped = true; stoppedBusy = !!err.busy; next = todo.length; }
                }
                done++;
                if (typeof o.onProgress === 'function') o.onProgress(Math.min(done, jobs.length), jobs.length);
            }
        }
        await whileHalting(() => stopped, () => Promise.all(Array.from({ length: Math.min(o.concurrency || CONCURRENCY, todo.length) }, worker)));
        const rows = Array.from(entries.values()).map((e) => combine(e, passes));
        rows.sort((x, y) => x.from.n - y.from.n);
        const result = { rows, calls: jobs.length, pending: jobs.length - doneIds.size, failedCalls, stopped, stoppedBusy, passes };
        // What a later run needs to send only the rest (not part of the result's data).
        Object.defineProperty(result, '_state', { value: { sig, entries, doneIds }, enumerable: false });
        return result;
    }

    // While fn runs, a request that is waiting for a busy AI service gives up
    // its wait as soon as halted() is true (the run was stopped, or another
    // request has already found the service busy for too long).
    async function whileHalting(halted, fn) {
        const AI = global.AI_SERVICE;
        const outer = AI ? AI.evidenceBusy : null;
        if (AI) {
            AI.evidenceBusy = {
                onWait: (seconds) => { if (outer && typeof outer.onWait === 'function') outer.onWait(seconds); },
                cancelled: () => halted() || !!(outer && typeof outer.cancelled === 'function' && outer.cancelled())
            };
        }
        try { return await fn(); } finally { if (AI) AI.evidenceBusy = outer || null; }
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
                const g = byTarget.get(p.key) || { target: p, rows: [], sure: new Set() };
                g.rows.push(r);
                if (p.agreed) g.sure.add(r);
                byTarget.set(p.key, g);
            });
        });
        const gaps = Array.from(byTarget.values()).sort((a, b) => a.target.n - b.target.n).map((g) => {
            const rank = (r) => (g.sure.has(r) ? 0 : 2) + (r.here === 'direct' ? 0 : 1);
            return {
                target: g.target,
                total: g.rows.length,
                rows: g.rows.slice().sort((a, b) => rank(a) - rank(b) || a.from.n - b.from.n).slice(0, ALSO_PER_QUESTION)
            };
        });
        const move = list.filter((r) => r.fit === 'fits_better_elsewhere' && r.to)
            .sort((a, b) => (a.strength === 'strong' ? 0 : 1) - (b.strength === 'strong' ? 0 : 1) || a.from.n - b.from.n);
        return {
            move,
            strong: move.filter((r) => r.strength === 'strong'),
            gaps,
            unrelated: list.filter((r) => r.fit === 'unrelated'),
            unreadable: list.filter((r) => r.fit === 'unreadable'),
            unchecked: list.filter((r) => r.fit === 'unchecked'),
            fits: list.filter((r) => r.fit === 'fits')
        };
    }

    /**
     * Evidence for the questions that have no screenshot, looked for on its
     * own rather than read off what the mapping calls happened to mention.
     * Step 1 matches each such question against the description of every
     * screenshot; step 2 shows the AI the candidate images with that one
     * question, and only "direct" evidence is kept (at most ALSO_PER_QUESTION).
     * Returns { gaps: [{target, total, rows}], none: [place], failed: [place],
     * error }, or null when the AI service cannot do it. A question a proposed
     * move would already fill is left to that move. failed: questions whose
     * candidates could not be checked. opts.previous: an earlier result; only
     * its failed questions are searched again and the rest is kept.
     */
    async function findGapEvidence(report, rows, opts) {
        const o = opts || {};
        const AI = global.AI_SERVICE;
        if (!AI || typeof AI.matchEvidenceToQuestions !== 'function' || typeof AI.verifyEvidenceFor !== 'function') return null;
        const list = Array.isArray(rows) ? rows : [];
        const withImages = new Set(progressOf(report).filter((item) => imagesOf(item).length).map(keyOf));
        const moveTargets = new Set();
        list.filter((r) => r.fit === 'fits_better_elsewhere').forEach((r) => { if (r.to) moveTargets.add(r.to.key); if (r.alt) moveTargets.add(r.alt.key); });
        const place = (q) => ({ n: q.n, key: q.key, clause: q.clause, text: q.text, status: q.status, empty: true });
        const prev = o.previous && !o.previous.error && (o.previous.failed || []).length ? o.previous : null;
        const again = prev ? new Set(prev.failed.map((x) => x.key)) : null;
        const targets = questionIndex(report).filter((q) => q.text && !withImages.has(q.key) && !moveTargets.has(q.key) && needsEvidence(place(q)) && (!again || again.has(q.key)));
        const usable = list.filter((r) => r.shows && (r.fit === 'fits' || r.fit === 'fits_better_elsewhere'));
        const byItem = (x, y) => x.n - y.n;
        // With an earlier result, what it found and ruled out is kept.
        const merged = (res) => (prev ? {
            gaps: prev.gaps.concat(res.gaps).sort((x, y) => x.target.n - y.target.n),
            none: prev.none.concat(res.none).sort(byItem),
            failed: res.failed,
            error: ''
        } : res);
        if (!targets.length || !usable.length) return merged({ gaps: [], none: targets.map(place), failed: [], error: '' });
        const catalogue = usable.map((r, k) => ({ id: 'S' + (k + 1), item: r.from.n, clause: r.from.clause, shows: r.shows }));
        const byId = new Map(catalogue.map((c, k) => [c.id, usable[k]]));
        let matched;
        try {
            matched = await AI.matchEvidenceToQuestions({ questions: targets.map((q) => ({ n: q.n, clause: q.clause, text: q.text })), screenshots: catalogue });
        } catch (err) {
            if (prev) return merged({ gaps: [], none: [], failed: prev.failed, error: '' });
            return { gaps: [], none: [], failed: [], error: (err && err.message) || 'The AI call failed.' };
        }
        const byN = new Map(targets.map((q) => [q.n, q]));
        // A screenshot is not evidence for the question it is already under.
        const jobs = (matched.matches || []).map((m) => ({ q: byN.get(m.n), ids: (m.ids || []).filter((id) => byId.has(id) && byId.get(id).from.n !== m.n) })).filter((j) => j.q && j.ids.length);
        const found = new Map();
        // Questions whose candidates could not be checked (the call failed, or
        // the search was stopped first): not the same as "nothing supports it".
        const unchecked = new Set(jobs.map((j) => j.q.n));
        let next = 0;
        let done = 0;
        let halted = false;
        async function worker() {
            while (next < jobs.length) {
                if (typeof o.shouldStop === 'function' && o.shouldStop()) { halted = true; return; }
                const job = jobs[next++];
                try {
                    const res = await AI.verifyEvidenceFor({ question: { n: job.q.n, clause: job.q.clause, text: job.q.text }, images: job.ids.map((id) => ({ evId: id, src: byId.get(id).src })) });
                    const direct = (res.images || []).filter((im) => im.support === 'direct' && byId.has(im.evId));
                    if (direct.length) found.set(job.q.n, direct.map((im) => Object.assign({}, byId.get(im.evId), { reason: im.reason })));
                    unchecked.delete(job.q.n);
                } catch (err) {
                    // Stays unchecked. Signed out, or busy through every wait:
                    // the other questions would only do the same.
                    if (err && (err.authRequired || err.busy)) { halted = true; next = jobs.length; }
                }
                done++;
                if (typeof o.onProgress === 'function') o.onProgress(done, jobs.length);
            }
        }
        await whileHalting(() => halted, () => Promise.all(Array.from({ length: Math.min(o.concurrency || CONCURRENCY, jobs.length) }, worker)));
        const gaps = targets.filter((q) => found.has(q.n)).map((q) => ({ target: place(q), total: found.get(q.n).length, rows: found.get(q.n).slice(0, ALSO_PER_QUESTION) }));
        return merged({
            gaps,
            none: targets.filter((q) => !found.has(q.n) && !unchecked.has(q.n)).map(place),
            failed: targets.filter((q) => unchecked.has(q.n)).map(place),
            error: ''
        });
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
            // The other reading's question, when the two differed.
            if (row.alt) options.push('<option value="move:' + esc(row.alt.key) + '">Move to ' + esc(placeLabel(row.alt)) + '</option>');
            (row.also || []).forEach((p) => options.push('<option value="copy:' + esc(p.key) + '">Also attach to ' + esc(placeLabel(p)) + '</option>'));
        } else {
            options.push('<option value="copy:' + esc(gap.key) + '">Also attach to ' + esc(placeLabel(gap)) + '</option>');
        }
        const target = kind === 'move' ? row.to : null;
        const strong = kind === 'move' && row.strength === 'strong';
        const badge = kind !== 'move' || !row.strength ? ''
            : (strong
                ? '<span class="em-strength" title="Both checks proposed the same question" style="background:#dcfce7;color:#166534;font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;margin-right:0.4rem;">STRONG</span>'
                : '<span class="em-strength" title="' + esc(row.doubt) + '" style="background:#f1f5f9;color:#475569;font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;margin-right:0.4rem;">POSSIBLE</span>');
        return `
            <div class="em-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.8rem;display:flex;gap:0.8rem;align-items:flex-start;">
                ${thumbHtml(row.src)}
                <div style="flex:1;min-width:0;font-size:0.8rem;line-height:1.45;color:#334155;">
                    <div>${badge}<strong>${esc(row.shows || 'No description: look at the screenshot.')}</strong></div>
                    <div style="color:#64748b;">Filed under <span style="font-family:monospace;">${esc(placeLabel(row.from))}</span>: ${esc(short(row.from.text, 110))}</div>
                    ${target ? `<div style="color:#1d4ed8;">May belong with <span style="font-family:monospace;">${esc(placeLabel(target))}</span>: ${esc(short(target.text, 110))}</div>` : ''}
                    ${row.reason ? `<div style="color:#64748b;">Why: ${esc(row.reason)}</div>` : ''}
                    ${kind === 'move' && row.doubt ? `<div style="color:#94a3b8;">${esc(row.doubt)}${row.alt ? ' The other was ' + esc(placeLabel(row.alt)) + '.' : ''}</div>` : ''}
                    <select class="form-control form-control-sm em-choice" data-row="${r}"${strong ? ' data-strong="1"' : ''} aria-label="What to do with this screenshot" style="margin-top:0.35rem;max-width:26rem;font-size:0.8rem;">${options.join('')}</select>
                </div>
            </div>`;
    }

    function summaryText(p, total, pending) {
        const parts = [p.fits.length + ' fit the question they are under'];
        if (p.move.length) parts.push(p.move.length + ' may belong with another question' + (p.strong.length ? ' (' + p.strong.length + ' strong)' : ''));
        if (p.unrelated.length) parts.push(p.unrelated.length + ' ' + (p.unrelated.length === 1 ? 'does' : 'do') + ' not look like evidence for any question');
        if (p.unreadable.length) parts.push(p.unreadable.length + ' could not be read');
        if (p.unchecked.length) parts.push(p.unchecked.length + (pending ? ' not checked yet' : ' could not be checked'));
        return total + ' screenshot' + (total === 1 ? '' : 's') + (pending ? ': ' : ' checked: ') + parts.join(', ') + '.';
    }

    function listHtml(title, rows) {
        if (!rows.length) return '';
        return `<div style="font-size:0.78rem;color:#64748b;margin-top:0.5rem;"><strong>${esc(title)}:</strong> ${rows.map((r) => esc(placeLabel(r.from) + (r.error ? ' (' + r.error + ')' : ''))).join('; ')}</div>`;
    }

    function showResults(reportId, report, result) {
        const p = proposals(result.rows);
        const pending = result.pending || 0;
        const shown = p.move.map((row) => ({ row, kind: 'move' }));
        // Searched for on their own (findGapEvidence); the "also supports"
        // by-product of the mapping calls is only the fallback.
        const ge = result.gapEvidence || null;
        const searched = ge && !ge.error ? ge : null;
        // A search that failed says so and can be run again on its own (live,
        // 2026-11-21: it failed twice and the screen showed the old lists as
        // if nothing had happened). Those lists stand in only when no search
        // was made at all (a stopped check, or an AI service without it).
        // Nor for a part-finished check: the search runs when it is complete.
        const gaps = searched ? searched.gaps : (ge || (pending && result.stopped) ? [] : p.gaps);
        const unsearched = searched ? (searched.failed || []) : [];
        const gapNotice = ge && ge.error
            ? 'The search for evidence for the questions with no screenshot did not run: ' + ge.error
            : (unsearched.length
                ? 'The search could not check ' + unsearched.length + ' question' + (unsearched.length === 1 ? '' : 's') + ' with no screenshot (' + unsearched.map(placeLabel).join('; ') + ').'
                : '');
        // Screenshots read fewer times than asked for: a request failed or was not sent.
        const readShort = result.passes > 1 ? result.rows.filter((r) => r.reads > 0 && r.reads < result.passes).length : 0;
        // Requests not answered yet: the check was stopped, the AI service
        // stayed busy, or a request failed. "Check the rest" sends only these.
        const sent = result.calls - pending;
        const pendingText = (result.stoppedBusy
            ? 'The AI service stayed busy (a rate limit) through every wait, so the check stopped after ' + sent + ' of ' + result.calls + ' requests. Give it some time before going on.'
            : (result.stopped
                ? 'The check was stopped after ' + sent + ' of ' + result.calls + ' requests.'
                : pending + ' of ' + result.calls + ' requests to the AI service failed.'))
            + ' What was read is kept: only the remaining ' + (pending === 1 ? 'request is' : pending + ' requests are') + ' sent.'
            + (result.stopped ? ' The questions with no screenshot are searched for once the check is complete.' : '');
        const gapsHtml = gaps.map((g) => {
            const more = g.total > g.rows.length ? ' <span style="color:#94a3b8;">(' + g.rows.length + ' of ' + g.total + ' shown)</span>' : '';
            const head = '<div style="font-size:0.8rem;color:#334155;margin-top:0.2rem;"><span style="font-family:monospace;font-weight:700;">' + esc(placeLabel(g.target)) + '</span> has no screenshot of its own: ' + esc(short(g.target.text, 120)) + more + '</div>';
            return head + g.rows.map((row) => { shown.push({ row, kind: 'also' }); return rowHtml(row, shown.length - 1, 'also', g.target); }).join('');
        }).join('');
        const body = `
            <div style="font-size:0.85rem;color:#475569;margin-bottom:0.6rem;line-height:1.5;">
                ${esc(summaryText(p, result.rows.length, pending))}
                ${shown.length ? 'Each proposal below is the AI\'s reading of the screenshot. Nothing moves unless you choose it here and press Save.' : 'There is nothing to move.'}
                ${result.passes > 1 && p.move.length ? 'Each screenshot was checked ' + (result.passes === 2 ? 'twice' : result.passes + ' times') + ': <strong>Strong</strong> means every check proposed the same question.' : ''}
                ${readShort ? esc(readShort + ' screenshot' + (readShort === 1 ? ' has' : 's have') + ' been read once only, so ' + (readShort === 1 ? 'it' : 'they') + ' cannot be Strong' + (pending ? ' yet.' : '.')) : ''}
                ${result.stopped && !pending ? '<strong>The check was stopped before it finished.</strong>' : ''}
            </div>
            ${pending ? `<div id="em-pending" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.8rem;color:#1e3a8a;margin-bottom:0.6rem;display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
                <span style="flex:1;min-width:14rem;">${esc(pendingText)}</span>
                <button type="button" class="btn btn-sm btn-primary" id="em-resume">Check the rest (${pending} request${pending === 1 ? '' : 's'})</button>
            </div>` : ''}
            ${gapNotice ? `<div id="em-gap-failed" style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.8rem;color:#92400e;margin-bottom:0.6rem;display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;">
                <span style="flex:1;min-width:14rem;">${esc(gapNotice)}</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="em-gap-retry">Search again</button>
            </div>` : ''}
            ${p.strong.length ? `<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.6rem;">
                <button type="button" class="btn btn-sm btn-outline-primary" id="em-accept-strong">Accept all strong (${p.strong.length})</button>
                <button type="button" class="btn btn-sm btn-link" id="em-clear" style="padding:0;font-size:0.78rem;">Clear choices</button>
                <span id="em-accepted" style="font-size:0.78rem;color:#64748b;"></span>
            </div>` : ''}
            <div id="em-hollow" style="display:none;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:0.4rem 0.6rem;font-size:0.8rem;color:#92400e;margin-bottom:0.6rem;"></div>
            <div id="em-list" style="display:flex;flex-direction:column;gap:0.6rem;max-height:54vh;overflow:auto;">
                ${p.move.length ? '<div style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;">May belong with another question</div>' : ''}
                ${p.move.map((row, i) => rowHtml(row, i, 'move')).join('')}
                ${gaps.length ? '<div style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;margin-top:0.3rem;">Questions with no screenshot: evidence found under another question</div>' : ''}
                ${gapsHtml}
            </div>
            ${listHtml('Not evidence for any question', p.unrelated)}
            ${listHtml('Could not be read', p.unreadable)}
            ${listHtml(pending ? 'Not checked yet' : 'Could not be checked', pending ? p.unchecked.map((r) => Object.assign({}, r, { error: '' })) : p.unchecked)}
            ${searched && searched.none.length ? `<div id="em-none" style="font-size:0.78rem;color:#64748b;margin-top:0.5rem;"><strong>No screenshot in this audit supports:</strong> ${searched.none.map((x) => esc(placeLabel(x))).join('; ')}</div>` : ''}
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
            // What the answers were before the moves: the save records a
            // checklist revision and, if the cloud copy is newer than this
            // tab, merges with it so that only the moves made here win.
            const before = JSON.parse(JSON.stringify(progressOf(report)));
            const res = apply(report, decisions);
            delete cache[String(reportId)];
            if (typeof global.closeModal === 'function') global.closeModal();
            if (res.moved || res.copied) {
                if (typeof global.saveChecklist === 'function') global.saveChecklist(reportId, { changedFrom: before });
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
        // One click sets every Strong row to Move; Save still applies them.
        const accept = document.getElementById('em-accept-strong');
        const said = document.getElementById('em-accepted');
        const setAll = (pick) => {
            let n = 0;
            document.querySelectorAll('.em-choice').forEach((el) => { const v = pick(el); if (v != null && el.value !== v) { el.value = v; n++; } });
            if (list) list.dispatchEvent(new Event('change'));
            return n;
        };
        if (accept) accept.addEventListener('click', () => {
            setAll((el) => (el.getAttribute('data-strong') === '1' ? el.options[1].value : null));
            if (said) said.textContent = p.strong.length + ' set to Move. Press Save to apply them.';
        });
        const clear = document.getElementById('em-clear');
        if (clear) clear.addEventListener('click', () => { setAll(() => ''); if (said) said.textContent = ''; });
        // Run only the search again; the screenshot readings are kept, and so
        // are the choices already made on the rows above.
        const retry = document.getElementById('em-gap-retry');
        if (retry) retry.addEventListener('click', async () => {
            const kept = Array.from(document.querySelectorAll('.em-choice')).slice(0, p.move.length).map((el) => el.value);
            retry.disabled = true;
            retry.textContent = 'Searching…';
            let found;
            try {
                found = await whileBusyShown((seconds) => { retry.textContent = 'The AI service is busy: trying again in ' + seconds + ' s…'; }, () => !retry.isConnected, () => findGapEvidence(report, result.rows, {
                    previous: result.gapEvidence,
                    shouldStop: () => !retry.isConnected,
                    onProgress: (done, total) => { retry.textContent = 'Checked ' + done + ' of ' + total + '…'; }
                }));
            } catch (_e) { found = null; }
            // Closed or replaced while it ran: nothing to show it on.
            if (!retry.isConnected) return;
            result.gapEvidence = found || { gaps: [], none: [], failed: [], error: 'The AI service is not available.' };
            showResults(reportId, report, result);
            const selects = document.querySelectorAll('.em-choice');
            kept.forEach((value, i) => { if (value && selects[i]) selects[i].value = value; });
            const shownList = document.getElementById('em-list');
            if (shownList) shownList.dispatchEvent(new Event('change'));
        });
        const resume = document.getElementById('em-resume');
        if (resume) resume.addEventListener('click', () => { run(reportId, report, result); });
        const again = document.getElementById('em-again');
        if (again) again.addEventListener('click', () => { delete cache[String(reportId)]; global.openEvidenceMapping(reportId); });
        if (typeof global.resolveAllIdbThumbs === 'function') global.resolveAllIdbThumbs();
    }

    // While fn runs, the screen hears when the AI service makes a request wait
    // (AI_SERVICE.evidenceBusy) and can cancel that wait.
    async function whileBusyShown(onWait, cancelled, fn) {
        const AI = global.AI_SERVICE;
        const before = AI ? AI.evidenceBusy : null;
        if (AI) AI.evidenceBusy = { onWait, cancelled };
        try { return await fn(); } finally { if (AI) AI.evidenceBusy = before || null; }
    }

    // earlier: a part-finished result for the same screenshots; only the
    // requests it is missing are sent ("Check the rest").
    async function run(reportId, report, earlier) {
        let stop = false;
        const requests = batches(report).length * PASSES;
        const already = earlier && earlier.pending ? earlier.calls - earlier.pending : 0;
        global.DataService.openFormModal('Evidence mapping — checking', `
            <div style="font-size:0.9rem;color:#334155;line-height:1.6;">
                <div id="em-progress">Checked ${already} of ${requests} requests… The first results take about 15 seconds.</div>
                <div style="height:8px;background:#e2e8f0;border-radius:4px;margin:0.6rem 0;overflow:hidden;"><div id="em-bar" style="height:100%;width:0;background:#2563eb;transition:width 0.3s;"></div></div>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="em-stop">Stop</button>
            </div>`, null);
        const stopBtn = document.getElementById('em-stop');
        if (stopBtn) stopBtn.addEventListener('click', () => { stop = true; stopBtn.disabled = true; stopBtn.textContent = 'Stopping…'; });
        const sig = signature(report);
        let last = '';
        let busyUntil = 0;
        let ticker = null;
        // The progress line, with the time left of a wait counted down.
        const paint = () => {
            const label = document.getElementById('em-progress');
            const left = Math.ceil((busyUntil - Date.now()) / 1000);
            if (label) label.textContent = left > 0 ? (last ? last + ' ' : '') + 'The AI service is busy: trying again in ' + left + ' second' + (left === 1 ? '' : 's') + '.' : last;
            if (left <= 0 && ticker) { clearInterval(ticker); ticker = null; }
        };
        const say = (text) => { last = text; paint(); };
        const busy = (seconds) => {
            busyUntil = Date.now() + seconds * 1000;
            paint();
            if (!ticker) ticker = setInterval(paint, 1000);
        };
        const quiet = () => { if (ticker) { clearInterval(ticker); ticker = null; } };
        let result;
        try {
            result = await whileBusyShown(busy, () => stop, () => check(report, {
                passes: PASSES,
                resume: earlier || null,
                shouldStop: () => stop,
                onProgress: (done, total) => {
                    const bar = document.getElementById('em-bar');
                    say('Checked ' + done + ' of ' + total + ' request' + (total === 1 ? '' : 's') + '…');
                    if (bar) bar.style.width = Math.round(done / total * 100) + '%';
                }
            }));
        } catch (err) {
            quiet();
            if (typeof global.closeModal === 'function') global.closeModal();
            notify('Evidence mapping failed: ' + ((err && err.message) || 'unknown error'), 'error');
            return;
        }
        if (!result.stopped) {
            const bar = document.getElementById('em-bar');
            say('Looking for evidence for the questions with no screenshot…');
            try {
                result.gapEvidence = await whileBusyShown(busy, () => stop, () => findGapEvidence(report, result.rows, {
                    shouldStop: () => stop,
                    onProgress: (done, total) => {
                        say('Checked the evidence found for ' + done + ' of ' + total + ' question' + (total === 1 ? '' : 's') + ' with no screenshot…');
                        if (bar) bar.style.width = Math.round(done / total * 100) + '%';
                    }
                }));
            } catch (_e) { result.gapEvidence = null; }
        }
        quiet();
        // A part-finished result is kept too, so the rest can be checked later
        // without sending what was already read.
        if (signature(report) === sig) cache[String(reportId)] = { sig, result };
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
        const calls = batches(report).length * PASSES;
        const minutes = Math.max(1, Math.ceil(calls * SECONDS_PER_REQUEST / 60));
        global.DataService.openFormModal('Evidence mapping', `
            <div style="font-size:0.88rem;color:#334155;line-height:1.6;">
                <p style="margin:0 0 0.6rem;">This checks that each screenshot is filed under the question it supports, and proposes a better question where it is not.</p>
                <ul style="margin:0 0 0.8rem 1.1rem;padding:0;">
                    <li><strong>${t.images} screenshot${t.images === 1 ? '' : 's'}</strong> on ${t.questions} question${t.questions === 1 ? '' : 's'} will be sent to the AI service twice, in ${calls} requests. It takes about ${minutes} minute${minutes === 1 ? '' : 's'}.</li>
                    <li>A move that both checks agree on is marked <strong>Strong</strong>, and you can accept all of those with one click.</li>
                    <li>Each question with no screenshot is then searched for across all of them, and what is found is checked against the image.</li>
                    <li>If the AI service stays busy, or you press Stop, what was read is kept and you can check the rest later.</li>
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

    global.EvidenceMapping = { questionIndex, batches, totals, check, proposals, findGapEvidence, hollowAfter, apply, signature, forget };
})(typeof window !== 'undefined' ? window : globalThis);

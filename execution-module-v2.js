// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs (ESM-ready)
// ============================================
// List view, report CRUD, and detail view => Extracted to execution-list.js

// ---------- KB Helpers loaded from ai-service.js (window.KB_HELPERS) ----------
// normalizeStdName, extractClauseNum, lookupKBRequirement, resolveChecklistClause,
// resolveStandardName are all available via window.KB_HELPERS.*

// ---------- Checklist -> NCR sync identity helpers (single source of truth) ----------
// Pure, top-level (unlike the checklist-sync closure itself, which only exists
// inside saveChecklist's per-invocation scope and so isn't callable in
// isolation) so the key-building logic is directly unit-testable and so
// there's exactly one definition of "what identifies this checklist item"
// shared by the dedupe matchers below.
function buildChecklistSourceKey(reportId, item) {
    return `exec-${reportId}-${(item && item.checklistId) || 'custom'}-${item && item.itemIdx}`;
}
function buildChecklistStableIdentity(item) {
    return {
        sourceChecklistId: (item && item.checklistId != null) ? String(item.checklistId) : null,
        sourceItemIdx: (item && item.itemIdx != null) ? String(item.itemIdx) : null
    };
}
window.NCRSyncUtils = window.NCRSyncUtils || {};
window.NCRSyncUtils.buildSourceKey = buildChecklistSourceKey;
window.NCRSyncUtils.buildStableIdentity = buildChecklistStableIdentity;

// ---------- Checklist question numbers ("IMS 13") ----------
// The printed checklist and the auditor's agenda index name a question by its
// section and its 1-based position in that section. The execution view's item
// id is "<section>-<0-based index>", so the number is derived, never stored.
// parse() accepts what an auditor types: "IMS 13", "ims13", "IMS-13", "a 30".
// ---------- Finding statement: label, example and template ----------
// The statement box showed one fixed example (clause 9.2 internal audits)
// under every question, so on a 6.1 risk question it was no use as a model
// (PC Connection, 2026-11-18). The label, the example and an insertable
// template now follow the question's own clause and requirement and the
// grade chosen: a nonconformity states the requirement, what was not
// fulfilled and the evidence; an observation what was seen and the risk; an
// OFI where a met requirement could be more effective, without prescribing
// how. Bracketed blanks mark what the auditor writes; hasBlanks() finds any
// left in, so a template is never printed half-filled.
window.FindingStatementHint = (function () {
    const BLANKS = ['What was not fulfilled', 'What was seen', 'record, interview or observation', 'the risk if it continues', 'evidence that it is met', 'What could be more effective, and why'];
    const BLANK_RE = new RegExp('\\[(?:' + BLANKS.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, ch => '\\' + ch)).join('|') + ')\\]');
    // "Verify that …" / "Check whether …" are how a question asks; the
    // requirement is what follows.
    const LEADIN = /^(?:please\s+)?(?:verify|check|confirm|ensure|review|assess|evaluate|examine|establish|determine|demonstrate|show)\s+(?:that|whether|if)\s+/i;
    // The checklist builder appends the client documents that should evidence
    // a question; they are not part of the requirement.
    const DOC_NOTE = /\s*Documented information on file[\s\S]*$/i;

    function requirementPhrase(requirement) {
        let s = String(requirement == null ? '' : requirement).replace(DOC_NOTE, '').replace(/\s+/g, ' ').trim();
        const first = /^(.+?[.?!])(?:\s|$)/.exec(s);
        if (first) s = first[1];
        s = s.replace(/[.?!]+$/, '').trim();
        if (!s) return '';
        const lead = LEADIN.exec(s);
        let phrase;
        if (lead) phrase = 'that ' + s.slice(lead[0].length);
        else phrase = (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
        if (phrase.length > 170) phrase = phrase.slice(0, 167).replace(/\s+\S*$/, '') + '…';
        return lead ? phrase : ': ' + phrase;
    }

    function kindOf(type) {
        const t = String(type == null ? '' : type).trim().toLowerCase();
        if (t === 'observation' || t === 'obs') return 'obs';
        if (t === 'ofi' || t.indexOf('opportunit') === 0) return 'ofi';
        return 'nc';
    }

    function forType(type, clause, requirement) {
        const c = String(clause == null ? '' : clause).trim();
        const req = requirementPhrase(requirement);
        const who = c ? 'Clause ' + c : 'The requirement';
        const reqPart = req ? who + ' requires' + (req.indexOf(': ') === 0 ? req : ' ' + req) : who + ' applies';
        const kind = kindOf(type);
        if (kind === 'obs') {
            return { kind, title: 'Observation', help: 'what was seen, and why it could become a nonconformity if it continues',
                template: reqPart + '. [What was seen], as shown by [record, interview or observation]. This is not a nonconformity yet, but [the risk if it continues].' };
        }
        if (kind === 'ofi') {
            return { kind, title: 'Opportunity for improvement', help: 'a requirement that is met but could be more effective; do not prescribe a solution',
                template: reqPart + '. This is met: [evidence that it is met]. [What could be more effective, and why].' };
        }
        return { kind, title: 'Nonconformity statement', help: 'the requirement, what was not fulfilled, and the objective evidence',
            template: reqPart + '. [What was not fulfilled], as shown by [record, interview or observation].' };
    }

    function example(hint) { return 'e.g. ' + hint.template; }
    function hasBlanks(text) { return BLANK_RE.test(String(text == null ? '' : text)); }

    // The template with the question's remark put in as the evidence, so the
    // auditor doesn't type what they saw twice (PC Connection, 2026-11-19).
    // An OFI's remark is the evidence that the requirement is met; for a
    // nonconformity or observation it becomes the objective-evidence sentence.
    // The judgement blanks stay for the auditor to write.
    function sentence(s) {
        const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        return t && !/[.!?…]$/.test(t) ? t + '.' : t;
    }
    function withEvidence(hint, remark) {
        const ev = sentence(remark);
        if (!ev) return hint.template;
        if (hint.kind === 'ofi') return hint.template.replace('[evidence that it is met].', () => ev);
        return hint.template.replace(', as shown by [record, interview or observation].', () => '. Objective evidence: ' + ev);
    }

    // Redraw the label and example for the grade now chosen.
    function apply(uniqueId) {
        if (typeof document === 'undefined') return;
        const sel = document.getElementById('ncr-type-' + uniqueId);
        const box = document.getElementById('ncr-desc-' + uniqueId);
        if (!sel || !box) return;
        const hint = forType(sel.value, box.getAttribute('data-clause'), box.getAttribute('data-req'));
        box.setAttribute('placeholder', example(hint));
        const title = document.getElementById('ncr-desc-title-' + uniqueId);
        const help = document.getElementById('ncr-desc-help-' + uniqueId);
        if (title) title.textContent = hint.title;
        if (help) help.textContent = '(' + hint.help + ')';
    }

    // Put the template in an empty box and select its first blank.
    function insert(uniqueId) {
        const sel = document.getElementById('ncr-type-' + uniqueId);
        const box = document.getElementById('ncr-desc-' + uniqueId);
        if (!box) return false;
        if (String(box.value || '').trim()) {
            if (typeof window.showNotification === 'function') window.showNotification('The statement already has text. Clear it first to insert the template.', 'info');
            return false;
        }
        const hint = forType(sel ? sel.value : '', box.getAttribute('data-clause'), box.getAttribute('data-req'));
        const remark = document.getElementById('comment-' + uniqueId);
        box.value = withEvidence(hint, remark ? remark.value : '');
        // Programmatic edits raise no input event; autosave listens for one.
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.focus();
        const start = box.value.indexOf('[');
        if (start !== -1 && typeof box.setSelectionRange === 'function') box.setSelectionRange(start, box.value.indexOf(']', start) + 1);
        return true;
    }

    if (typeof document !== 'undefined' && !window._findingHintBound) {
        window._findingHintBound = true;
        document.addEventListener('change', function (e) {
            const el = e.target;
            if (el && el.id && el.id.indexOf('ncr-type-') === 0) apply(el.id.slice('ncr-type-'.length));
        });
    }

    return { forType, example, requirementPhrase, hasBlanks, withEvidence, apply, insert, BLANKS };
})();
window.insertFindingTemplate = function (uniqueId) { return window.FindingStatementHint.insert(uniqueId); };

window.ChecklistQuestionRef = {
    fromItemId: function (itemId) {
        const m = /^(.+)-(\d+)$/.exec(String(itemId == null ? '' : itemId));
        return m ? m[1] + ' ' + (Number(m[2]) + 1) : null;
    },
    // Reads the number at the start and ignores the rest, so a chip pasted from
    // the agenda index ("ORG 3 8.1 Onboarding") works. A clause is not a number:
    // "A.5.30" or "IMS 7.5" never resolve, because the section may not be
    // joined to its number by a dot and the number may not run on into ".5".
    parse: function (text) {
        const m = /^\s*([A-Za-z][A-Za-z0-9]*?)[\s\-_]*(\d+)(?![.\d])/.exec(String(text == null ? '' : text));
        return m && Number(m[2]) > 0 ? m[1].toUpperCase() + ' ' + Number(m[2]) : null;
    }
};

// Bulk ticks on the Meetings tab
window.toggleMeetingSelectAll = function (el) {
    if (!el || !el.dataset || !el.dataset.target) return;
    document.querySelectorAll(el.dataset.target).forEach(cb => { cb.checked = el.checked; });
};
window.syncMeetingSelectAll = function () {
    document.querySelectorAll('.meeting-select-all').forEach(sa => {
        const boxes = Array.from(document.querySelectorAll(sa.dataset.target));
        sa.checked = boxes.length > 0 && boxes.every(cb => cb.checked);
        sa.indeterminate = !sa.checked && boxes.some(cb => cb.checked);
    });
};
// Closing attendees = opening attendees (ticks and added people)
window.copyOpeningAttendeesToClosing = function () {
    const ticked = new Set(Array.from(document.querySelectorAll('.opening-attendee-cb:checked')).map(cb => cb.dataset.name));
    document.querySelectorAll('.closing-attendee-cb').forEach(cb => { cb.checked = ticked.has(cb.dataset.name); });
    const from = document.getElementById('opening-custom-list');
    const to = document.getElementById('closing-custom-list');
    if (from && to) to.innerHTML = from.innerHTML;
    window.syncMeetingSelectAll();
};

// ---------- Checklist autosave ----------
// The checklist kept every status, remark and personnel pick on screen until
// Save Progress was clicked, so a reload, a closed tab or leaving the page lost
// them. Changes now save on their own DELAY ms after the last one, and at once
// before the checklist is left. saveChecklist reads the on-screen inputs, so a
// pending save is flushed while they are still there (capture-phase click on a
// tab or navigation link, page hide, unload). Quiet: the save indicator shows,
// the success pop-up does not; errors still do.
window.ChecklistAutoSave = (function () {
    const DELAY = 4000;
    let timer = null;
    let reportId = null;
    let bound = false;
    const onChecklist = () => document.querySelectorAll('.status-input').length > 0;
    function save() {
        timer = null;
        if (reportId != null && onChecklist() && typeof window.saveChecklist === 'function') {
            window.saveChecklist(reportId, { quiet: true });
            return true;
        }
        return false;
    }
    function schedule() {
        if (reportId == null) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(save, DELAY);
    }
    function flush() {
        if (!timer) return false;
        clearTimeout(timer);
        return save();
    }
    function bind(id, container) {
        reportId = id;
        if (container && !container._checklistAutoSaveBound) {
            container._checklistAutoSaveBound = true;
            const onEdit = (e) => { if (e.target && e.target.closest && e.target.closest('.checklist-item')) schedule(); };
            container.addEventListener('input', onEdit);
            container.addEventListener('change', onEdit);
        }
        if (!bound) {
            bound = true;
            document.addEventListener('click', (e) => {
                const leaving = e.target && e.target.closest && e.target.closest('.tab-btn, [data-hash], a[href^="#"], nav a, .sidebar a, [data-action="clickTab"]');
                if (leaving) flush();
            }, true);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
            window.addEventListener('beforeunload', () => { flush(); });
        }
    }
    return { DELAY: DELAY, schedule: schedule, flush: flush, bind: bind, isPending: () => !!timer };
})();

// ---------- Stale-view guard for checklist saves ----------
// saveChecklist rebuilds checklistProgress from the inputs on screen. A view
// drawn earlier (a second tab left open, a tab woken from sleep, the checklist
// re-opened from data loaded when the page opened) therefore wrote its old
// screen over everything saved since: PC Connection lost Day 1 this way on
// 2026-11-18, when a tab drawn at 13:25 UTC autosaved its near-empty view at
// 05:27 UTC the next morning. Each view now remembers what it was drawn from
// (`base`). When a save finds newer data — in this tab's memory or in the cloud —
// only the questions changed in this view are taken from the screen; every
// other question keeps the newer saved value (a three-way merge per question).
window.ChecklistMerge = (function () {
    const bases = {};
    const FIELDS = ['status', 'comment', 'ncrType', 'ncrDescription', 'transcript', 'personnel', 'designation', 'department'];
    const keyOf = (p) => (p && p.isCustom ? 'custom-' + p.itemIdx : (p ? p.checklistId + '-' + p.itemIdx : ''));
    const norm = (v) => (v == null ? '' : String(v).trim());
    const images = (p) => ((p && p.evidenceImages) || (p && p.evidenceImage ? [p.evidenceImage] : [])).map(String).join('|');
    function same(a, b) {
        a = a || {}; b = b || {};
        return FIELDS.every(f => norm(a[f]) === norm(b[f])) && images(a) === images(b);
    }
    const clone = (v) => JSON.parse(JSON.stringify(v == null ? null : v));
    const revCount = (report) => ((report && report.checklistRevisions) || []).length;

    const EVIDENCE = ['evidenceImages', 'evidenceImage', 'evidenceCapturedAtList', 'evidenceCapturedAt', 'evidenceLocation', 'evidenceLocationRaw'];

    // mine: the questions as on screen; base: what this view was drawn from;
    // theirs: the newer saved copy. Per question and per field, a value changed
    // on this screen wins; every other value comes from theirs.
    // opts.allFields: `mine` is this tab's memory, changed away from the
    // checklist screen (Evidence mapping moves screenshots from the
    // Finalization tab). Then any field this tab changed since `base` wins,
    // not only the ones the checklist screen has inputs for.
    function merge(baseItems, mine, theirs, opts) {
        const allFields = !!(opts && opts.allFields);
        const baseMap = {}; (baseItems || []).forEach(p => { baseMap[keyOf(p)] = p; });
        const theirMap = {}; (theirs || []).forEach(p => { theirMap[keyOf(p)] = p; });
        const seen = new Set();
        let kept = 0;
        const out = (mine || []).map(m => {
            const k = keyOf(m); seen.add(k);
            const t = theirMap[k];
            if (!t) return m;
            const b = baseMap[k] || {};
            const r = Object.assign(clone(t), { checklistId: m.checklistId, itemIdx: m.itemIdx, isCustom: m.isCustom, clause: m.clause || t.clause, requirement: m.requirement || t.requirement });
            if (allFields) {
                new Set(Object.keys(m).concat(Object.keys(b))).forEach(f => {
                    if (JSON.stringify(m[f]) === JSON.stringify(b[f])) return;
                    if (m[f] === undefined) delete r[f]; else r[f] = clone(m[f]);
                });
            } else {
                FIELDS.forEach(f => { if (norm(m[f]) !== norm(b[f])) r[f] = m[f]; });
                if (images(m) !== images(b)) EVIDENCE.forEach(f => { r[f] = m[f]; });
            }
            if (r.status !== 'nc' && norm(m.status) !== norm(b.status)) r.ncrType = '';
            if (!same(r, m)) kept++;
            return r;
        });
        (theirs || []).forEach(t => { if (!seen.has(keyOf(t))) { out.push(clone(t)); kept++; } });
        return { items: out, kept: kept };
    }

    // Called when the checklist is drawn and after each save from it.
    function setBase(reportId, report) {
        bases[String(reportId)] = { revs: revCount(report), items: clone((report && report.checklistProgress) || []) };
    }
    const getBase = (reportId) => bases[String(reportId)] || null;

    // Before a save: newer data in this tab's memory than the view was drawn from?
    function reconcileLocal(reportId, report, mine) {
        const base = getBase(reportId);
        if (!base || revCount(report) <= base.revs) return { items: mine, merged: false, kept: 0 };
        const r = merge(base.items, mine, report.checklistProgress || []);
        return { items: r.items, merged: true, kept: r.kept };
    }

    // The cloud copy's progress and revision log, plus the whole stored report
    // (`data`) for the report-level merge below, or null when it can't be read.
    async function fetchRemote(reportId) {
        const sb = window.SupabaseClient && window.SupabaseClient.client;
        if (!sb || typeof sb.from !== 'function') return null;
        try {
            const { data, error } = await sb.from('audit_reports')
                .select('checklist_progress, revisions:data->checklistRevisions, data')
                .eq('id', String(reportId)).maybeSingle();
            if (error || !data) return null;
            const stored = data.data && typeof data.data === 'object' ? data.data : null;
            return { items: data.checklist_progress || [], revisions: Array.isArray(data.revisions) ? data.revisions : [], data: stored };
        } catch (_e) {
            return null;
        }
    }

    // ---- Report-level fields (conclusion, meetings, status, issue log…) ----
    // Every save writes the whole report, so a tab opened before a change made
    // elsewhere wrote its old copy back over it: PC Connection, 24 Nov 2026,
    // the CAR deadline and headcount set on the server would have been undone
    // by Finalize from a tab opened earlier. Each tab now remembers the report
    // as it last read or wrote it; at save time a field this tab has not
    // changed since then takes the server's newer value, and a field it did
    // change keeps this tab's value. Plain objects (closingMeeting…) merge per
    // key. The checklist questions keep their own per-question merge above.
    const FIELD_SKIP = { checklistProgress: 1, checklistRevisions: 1, _evidenceIndexBuilt: 1 };
    const fieldBases = {};
    const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    // Key order differs once Postgres has stored a value, so compare sorted.
    function stable(v) {
        if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
        if (isPlain(v)) return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
        return v === undefined ? 'undefined' : JSON.stringify(v);
    }
    const eq = (a, b) => stable(a) === stable(b);
    function fieldsOf(report) {
        const out = {};
        Object.keys(report || {}).forEach(k => { if (!FIELD_SKIP[k] && report[k] !== undefined) out[k] = report[k]; });
        return clone(out);
    }
    // opts.ifAbsent: only when this tab has no record yet (the view being drawn).
    function noteServerFields(reportId, report, opts) {
        if (!report) return;
        const id = String(reportId);
        if (opts && opts.ifAbsent && fieldBases[id]) return;
        fieldBases[id] = fieldsOf(report);
    }
    function mergeInto(base, local, remote, path, taken) {
        new Set(Object.keys(local).concat(Object.keys(remote))).forEach(k => {
            if (!path && FIELD_SKIP[k]) return;
            const b = base ? base[k] : undefined;
            const l = local[k];
            const r = remote[k];
            if (eq(r, b) || eq(l, r)) return; // not changed on the server, or already equal
            if (isPlain(b) && isPlain(l) && isPlain(r)) { mergeInto(b, l, r, path + k + '.', taken); return; }
            if (!eq(l, b)) return; // changed in this tab: this tab's value is kept
            if (r === undefined) delete local[k]; else local[k] = clone(r);
            taken.push(path + k);
        });
    }
    // Brings the server's newer values into `report` for every field this tab
    // left untouched. Returns the field paths taken. No record → no change.
    function mergeFields(reportId, report, remoteData) {
        const base = fieldBases[String(reportId)];
        if (!base || !report || !isPlain(remoteData)) return [];
        const taken = [];
        mergeInto(base, report, remoteData, '', taken);
        return taken;
    }

    return { keyOf: keyOf, same: same, merge: merge, setBase: setBase, getBase: getBase, reconcileLocal: reconcileLocal, fetchRemote: fetchRemote, revCount: revCount, noteServerFields: noteServerFields, mergeFields: mergeFields };
})();

// The checklist view is drawn from the report as it is now, not from the
// progress map built when the page opened (switching Findings → Checklist
// redrew the opening data, and the next autosave wrote it back).
window.liveProgressMap = function (report, fallback) {
    const live = ((window.state && window.state.auditReports) || []).find(r => r && report && String(r.id) === String(report.id)) || report;
    const progress = (live && live.checklistProgress) || [];
    if (!progress.length) return { report: live, progressMap: fallback || {} };
    const map = {};
    progress.forEach(p => { if (p) map[window.ChecklistMerge.keyOf(p)] = p; });
    return { report: live, progressMap: map };
};

// ---------- AI Auto Map: personnel per question ----------
// Pure helpers for window.autoMapPersonnel (inside renderExecutionTab). The AI
// only proposes a name; designation and department always come from the
// client's contact list, and a name not on that list is never assigned.
window.PersonnelAutoMap = {
    BATCH_SIZE: 20,
    chunk: function (list, size) {
        const out = [];
        for (let i = 0; i < (list || []).length; i += size) out.push(list.slice(i, i + size));
        return out;
    },
    buildPrompt: function (contacts, items) {
        const people = contacts.map((c, i) => `${i + 1}. ${c.name} — ${c.designation || 'No designation'}${c.department ? ' (' + c.department + ')' : ''}`).join('\n');
        return 'You are an ISO audit expert. Given these client personnel:\n' + people
            + '\n\nFor each audit question below, choose the one person who would be interviewed for it, based on their role.'
            + ' Spread assignments across the personnel by role; do not give every question to the same person.'
            + '\n\nQuestions (JSON):\n' + JSON.stringify(items.map(it => ({ id: it.id, clause: it.clause, question: it.question })))
            + '\n\nRespond ONLY with a JSON array, no markdown, no explanation:\n[{"id":"...","personnel":"exact name from the list"}]'
            + '\nUse EXACT names from the list. If no one fits, use the most senior person.';
    },
    parseMappings: function (text) {
        const raw = String(text || '').replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
        try {
            const v = JSON.parse(raw);
            if (Array.isArray(v)) return v;
        } catch (_e) { /* fall through to the first array in the text */ }
        const m = raw.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('The AI reply was not a list of assignments');
        const v = JSON.parse(m[0]);
        if (!Array.isArray(v)) throw new Error('The AI reply was not a list of assignments');
        return v;
    },
    // -> { assignments: [{id, personnel, designation, department}], skipped }
    resolve: function (mappings, contacts, items) {
        const byName = new Map(contacts.map(c => [String(c.name || '').trim().toLowerCase(), c]));
        const wanted = new Set(items.map(it => String(it.id)));
        const seen = new Set();
        const assignments = [];
        (mappings || []).forEach(m => {
            const id = String(m && m.id);
            if (!wanted.has(id) || seen.has(id)) return;
            const contact = byName.get(String(m.personnel || '').trim().toLowerCase());
            if (!contact) return;
            seen.add(id);
            assignments.push({ id: id, personnel: contact.name, designation: contact.designation || '', department: contact.department || '' });
        });
        return { assignments: assignments, skipped: items.length - assignments.length };
    }
};

// ---------- Audit finding categories ----------
// An audit finding is a nonconformity (Major or Minor), an observation (OBS) or
// an opportunity for improvement (OFI). Only Major/Minor are NCRs; the others
// are numbered in their own series so an observation is never shown as an NCR.
// A flagged item not yet classified is a nonconformity awaiting classification.
window.AuditFindingCategory = (function () {
    const CATS = {
        major: { key: 'major', label: 'Major NC', prefix: 'NCR', color: '#dc2626', order: 0 },
        minor: { key: 'minor', label: 'Minor NC', prefix: 'NCR', color: '#d97706', order: 1 },
        pending: { key: 'pending', label: 'Unclassified', prefix: 'NCR', color: '#6b7280', order: 2 },
        obs: { key: 'obs', label: 'OBS', prefix: 'OBS', color: '#7c3aed', order: 3 },
        ofi: { key: 'ofi', label: 'OFI', prefix: 'OFI', color: '#0891b2', order: 4 }
    };
    function of(type) {
        const t = String(type == null ? '' : type).trim().toLowerCase();
        if (t === 'major') return CATS.major;
        if (t === 'minor') return CATS.minor;
        if (t === 'observation' || t === 'obs') return CATS.obs;
        if (t === 'ofi' || t.indexOf('opportunit') === 0) return CATS.ofi;
        return CATS.pending;
    }
    // Sorted NCRs first (Major, Minor, unclassified), then OBS, then OFI, each
    // keeping its original order; each record gets _cat and _ref ("OBS-002").
    function numberFindings(list) {
        const seq = {};
        return (list || [])
            .map((f, i) => ({ f, i, cat: of(f && (f.type || f.ncrType || f.severity)) }))
            .sort((a, b) => a.cat.order - b.cat.order || a.i - b.i)
            .map(({ f, cat }) => {
                seq[cat.prefix] = (seq[cat.prefix] || 0) + 1;
                return Object.assign({}, f, { _cat: cat, _ref: cat.prefix + '-' + String(seq[cat.prefix]).padStart(3, '0') });
            });
    }
    function counts(numbered) {
        const c = { major: 0, minor: 0, pending: 0, obs: 0, ofi: 0 };
        (numbered || []).forEach(f => { c[f._cat.key]++; });
        c.nc = c.major + c.minor + c.pending;
        return c;
    }
    // A nonconformity is known by its NC register reference (NCR-091), which
    // the client report and the client's corrective-action responses use. The
    // findings lists numbered them NCR-001, NCR-002… by position, so screen and
    // printed findings summary named a finding differently from the report,
    // and "NCR-001" read like another register record (PC Connection, 2026).
    // Each Major/Minor finding takes its register record's reference, matched
    // first by the checklist item that raised it, else by a clause that only
    // one open record of this audit carries. A nonconformity with no register
    // record is numbered NC-001… so it is never mistaken for a register entry.
    const clauseToken = (v) => {
        const m = String(v == null ? '' : v).trim().match(/^(A\.\d{1,2}\.\d{1,2}|\d{1,2}(?:\.\d{1,2}){0,3})/);
        return m ? m[1] : String(v == null ? '' : v).trim().toLowerCase();
    };
    function withRegisterRefs(numbered, report, ncrs) {
        const planId = report && report.planId != null ? String(report.planId) : null;
        const pool = (Array.isArray(ncrs) ? ncrs : []).filter(n => n
            && !/^withdrawn$/i.test(String(n.status || '').trim())
            && /^(major|minor)/i.test(String(n.severity || n.type || '').trim())
            && (!planId || String(n.auditId == null ? '' : n.auditId) === planId));
        const claimed = new Set();
        const isNc = f => f._cat && (f._cat.key === 'major' || f._cat.key === 'minor');
        const linked = f => pool.find(n => !claimed.has(n) && n.sourceChecklistId != null && f.sourceChecklistId != null
            && String(n.sourceChecklistId) === String(f.sourceChecklistId) && String(n.sourceItemIdx) === String(f.sourceItemIdx));
        const byClause = f => {
            const tok = clauseToken(f.criterionRef || f.clause);
            const hits = pool.filter(n => !claimed.has(n) && (clauseToken(n.clause) === tok || clauseToken(n.criterionRef) === tok));
            return hits.length === 1 ? hits[0] : null;
        };
        const recordOf = new Map();
        // Linked records first, so a clause match can never take another item's record.
        (numbered || []).filter(isNc).forEach(f => { const n = linked(f); if (n) { claimed.add(n); recordOf.set(f, n); } });
        (numbered || []).filter(isNc).forEach(f => { if (recordOf.has(f)) return; const n = byClause(f); if (n) { claimed.add(n); recordOf.set(f, n); } });
        let unregistered = 0;
        return (numbered || []).map(f => {
            if (!f._cat || f._cat.prefix !== 'NCR') return f;
            const n = recordOf.get(f);
            if (n && n.id != null && n.id !== '') {
                return Object.assign({}, f, { _ref: 'NCR-' + String(n.id).padStart(3, '0'), _registerId: n.id });
            }
            unregistered++;
            return Object.assign({}, f, { _ref: 'NC-' + String(unregistered).padStart(3, '0'), _registerId: null });
        });
    }
    return { of: of, numberFindings: numberFindings, counts: counts, withRegisterRefs: withRegisterRefs };
})();

// Every finding of an audit: the manual ones (report.ncrs) and the checklist
// items flagged NC (report.checklistProgress), numbered by category. The
// Findings tab and the printed findings summary both read this, so the paper
// handed to the client carries the same references (NCR-091, OBS-002) as the
// screen. Checklist findings also carry what the summary prints: the
// requirement, the auditor's evidence remark and the NC statement as recorded.
window.collectAuditFindings = function (report, assignedChecklists) {
    const r = report || {};
    const lists = Array.isArray(assignedChecklists) ? assignedChecklists : [];
    const manualNCRs = r.ncrs || [];
    const checklistNCRs = (r.checklistProgress || [])
        .filter(item => item && item.status === 'nc')
        .map(item => {
            // Resolve clause from checklist definition. Start from the clause and
            // requirement saved on the item itself: the template lookup below is
            // skipped when the auditor assigned a criterion, which left every
            // such finding showing "Checklist Item" in the Clause column.
            let clauseText = String(item.clause || '').trim() || 'Checklist Item';
            let reqText = String(item.requirement || '').trim();
            // Carried from the checklist item when present (FOCUS.n/SURV items
            // store the real ISO clause here since their own `clause` is an
            // internal pseudo-reference — see client-docs-bulk.js's question()).
            // The item's own value (e.g. set via window.setFindingCriterion)
            // takes precedence over the checklist template lookup below, same
            // reasoning as the checklist->NCR sync.
            let criterionRef = item.criterionRef;
            let criterionSource = item.criterionSource;

            if (!criterionSource && item.checklistId && lists.length > 0) {
                const cl = lists.find(c => String(c.id) === String(item.checklistId));
                if (cl) {
                    if (cl.clauses && (String(item.itemIdx).includes('-'))) {
                        const [mainClauseVal, subIdxVal] = String(item.itemIdx).split('-');
                        const mainObj = cl.clauses.find(m => m.mainClause === mainClauseVal);
                        if (mainObj && mainObj.subClauses && mainObj.subClauses[subIdxVal]) {
                            const subItem = mainObj.subClauses[subIdxVal];
                            clauseText = subItem.clause || `Clause ${mainClauseVal}`;
                            reqText = subItem.requirement || '';
                            if (subItem.criterionRef !== undefined) criterionRef = subItem.criterionRef;
                            if (subItem.criterionSource) criterionSource = subItem.criterionSource;
                        }
                    } else if (cl.items && cl.items[item.itemIdx]) {
                        clauseText = cl.items[item.itemIdx].clause || 'Checklist Item';
                        reqText = cl.items[item.itemIdx].requirement || '';
                        if (cl.items[item.itemIdx].criterionRef !== undefined) criterionRef = cl.items[item.itemIdx].criterionRef;
                        if (cl.items[item.itemIdx].criterionSource) criterionSource = cl.items[item.itemIdx].criterionSource;
                    }
                }
            } else if (item.isCustom) {
                const customItem = (r.customItems || [])[item.itemIdx];
                if (customItem) {
                    clauseText = customItem.clause || 'Custom Question';
                    reqText = customItem.requirement || '';
                }
            }

            const images = Array.isArray(item.evidenceImages) ? item.evidenceImages.filter(Boolean)
                : (item.evidenceImage ? [item.evidenceImage] : []);
            return {
                // Not yet classified = pending (as on Review & Submit), never
                // silently an observation.
                type: item.ncrType || window.CONSTANTS.NCR_TYPES.PENDING,
                // clause is kept as-is (the internal FOCUS/SURV/ORG/DOC reference
                // when that's what it is) — criterionRef/criterionSource, when
                // present, tell a consumer to display criterionRef as the criterion.
                clause: clauseText,
                description: item.ncrDescription || item.comment || reqText || 'Non-conformity identified in checklist',
                status: 'Open',
                source: 'checklist',
                // The checklist item that raised it, so the row's link can
                // open it (row id = "<checklistId>-<itemIdx>", or
                // "custom-<idx>" for an added question).
                sourceChecklistId: item.isCustom ? 'custom' : (item.checklistId == null ? '' : item.checklistId),
                sourceItemIdx: item.itemIdx == null ? '' : item.itemIdx,
                questionRef: item.isCustom ? null : window.ChecklistQuestionRef.fromItemId(item.itemIdx),
                requirement: reqText,
                comment: item.comment || '',
                ncrDescription: item.ncrDescription || '',
                clientEvidenceStatement: item.clientEvidenceStatement || '',
                personnel: item.personnel || '',
                department: item.department || '',
                designation: item.designation || '',
                evidenceImage: item.evidenceImage,
                evidenceImages: images,
                evidenceCapturedAtList: Array.isArray(item.evidenceCapturedAtList) ? item.evidenceCapturedAtList : [],
                evidenceCapturedAt: item.evidenceCapturedAt || '',
                evidenceCount: images.length,
                ...(criterionSource ? { criterionRef: criterionRef || '', criterionSource } : {})
            };
        });

    // A manual record keeps its index in report.ncrs for the edit button,
    // whatever the display order.
    const findings = window.AuditFindingCategory.withRegisterRefs(window.AuditFindingCategory.numberFindings([
        ...manualNCRs.map((ncr, manualIdx) => ({
            ...ncr, source: 'manual', _manualIdx: manualIdx,
            evidenceCount: Array.isArray(ncr.evidenceImages) ? ncr.evidenceImages.filter(Boolean).length : (ncr.evidenceImage ? 1 : 0)
        })),
        ...checklistNCRs
    ]), r, (window.state && window.state.ncrs) || []);
    return {
        findings,
        counts: window.AuditFindingCategory.counts(findings),
        manualCount: manualNCRs.length,
        checklistCount: checklistNCRs.length
    };
};

// Jump to a checklist question by its number: open its section, scroll it into
// view and highlight it — the same landing the NC-register "go to item" uses.
window.jumpToChecklistQuestion = function (text) {
    const ref = window.ChecklistQuestionRef.parse(text);
    if (!ref) {
        if (String(text || '').trim()) window.showNotification('Start with a question number such as IMS 13 or SMS 3 (a clause like 7.5 is not one).', 'warning');
        return false;
    }
    const row = Array.from(document.querySelectorAll('.checklist-item[data-q-ref]'))
        .find(function (r) { return r.getAttribute('data-q-ref').toUpperCase() === ref; });
    if (!row) {
        window.showNotification('There is no question ' + ref + ' in this audit’s checklist.', 'warning');
        return false;
    }
    const section = row.closest('.accordion-content');
    if (section && section.style.display === 'none') {
        section.style.display = 'block';
        const icon = document.getElementById('icon-' + section.id);
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (typeof window.syncToggleAllAccordions === 'function') window.syncToggleAllAccordions();
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const previousBorder = row.style.borderLeftColor;
    row.style.transition = 'border-left-color 0.4s';
    row.style.borderLeftColor = '#8b5cf6';
    setTimeout(function () { row.style.borderLeftColor = previousBorder; }, 2500);
    return true;
};
window.jumpToChecklistQuestionFromBox = function () {
    const box = document.getElementById('jump-to-question');
    return window.jumpToChecklistQuestion(box ? box.value : '');
};

// Escape stored text (auditor remarks, AI-drafted summary, client/KB names)
// for an HTML string. Several of these fields were written through
// Sanitizer.sanitizeText (escaped on WRITE), so decode first: the value is
// escaped exactly once and an AI reply containing "</textarea><img …>" can
// no longer break out of the textarea it is seeded into.
function _execEscText(v) {
    const U = window.UTILS || {};
    const raw = String(v ?? '');
    return U.escapeHtml(U.decodeEntities ? U.decodeEntities(raw) : raw);
}
window._execEscText = _execEscText;
// Stored text decoded to what the user typed (no escaping), tolerant of a
// UTILS without decodeEntities.
function _execDecode(v) {
    const U = window.UTILS || {};
    const raw = String(v ?? '');
    return U.decodeEntities ? U.decodeEntities(raw) : raw;
}

// ---------- Report Integrity "Set criterion" fix action — pure helpers ----------
// Same reasoning as buildChecklistSourceKey/buildChecklistStableIdentity above:
// top-level (not nested inside renderExecutionTab/saveChecklist) so they're
// directly unit-testable. window.setFindingCriterion itself (the data-action
// handler wired to the panel's "Set criterion" button) stays nested near
// runReportIntegrityCheck, same as saveChecklist/createNCR/editNCR — it's DOM/
// modal glue, not pure logic.

/**
 * Resolve a Report Integrity blocker's `ref` (see report-integrity.js's
 * findingRef()) to the actual finding record in this report. Tiered,
 * most-reliable match first — mirrors how report-integrity.js's own
 * allNCRs() assembles its combined [checklist..., manual...] list, since
 * that file exports only check()/checkById() and not allNCRs() itself.
 *
 * @param {Object} report
 * @param {{index?:number, clause?:string, source?:string, checklistId?:*, itemIdx?:*}} ref
 * @returns {{kind:'checklist'|'manual', item:Object, index:number}|null}
 */
function resolveFindingFromRef(report, ref) {
    if (!report || !ref) return null;
    const isRegisterSeverity = (t) => ['major', 'minor'].includes(String(t || '').toLowerCase());

    // Tier 1: checklistId + itemIdx against report.checklistProgress — the
    // most reliable, identity-based match (same fields the checklist->NCR
    // sync keys off via buildChecklistStableIdentity above).
    if (ref.checklistId != null && ref.checklistId !== '' && ref.itemIdx != null && ref.itemIdx !== '') {
        const list = report.checklistProgress || [];
        const idx = list.findIndex(p => p
            && String(p.checklistId) === String(ref.checklistId)
            && String(p.itemIdx) === String(ref.itemIdx));
        if (idx !== -1) return { kind: 'checklist', item: list[idx], index: idx };
    }

    // Tier 2: by combined index. report-integrity.js's allNCRs() builds one
    // array as [...majorMinorChecklistNCs, ...majorMinorManualNCRs] in that
    // order, and `ref.index` is the position within that combined array —
    // rebuild the same filter/order locally to translate it back.
    if (typeof ref.index === 'number' && !isNaN(ref.index) && ref.index >= 0) {
        const fromChecklist = (report.checklistProgress || [])
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => p && p.status === 'nc' && isRegisterSeverity(p.ncrType));
        if (ref.index < fromChecklist.length) {
            const hit = fromChecklist[ref.index];
            return { kind: 'checklist', item: hit.p, index: hit.i };
        }
        const manualIdx = ref.index - fromChecklist.length;
        const fromManual = (report.ncrs || [])
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => n && isRegisterSeverity(n.type || n.ncrType || n.severity));
        if (manualIdx >= 0 && manualIdx < fromManual.length) {
            const hit = fromManual[manualIdx];
            return { kind: 'manual', item: hit.n, index: hit.i };
        }
    }

    // Tier 3: by clause against the manual NCR register.
    if (ref.clause) {
        const list = report.ncrs || [];
        const idx = list.findIndex(n => n && String(n.clause || '').trim() === String(ref.clause).trim());
        if (idx !== -1) return { kind: 'manual', item: list[idx], index: idx };
    }

    return null;
}
window.NCRSyncUtils.resolveFindingFromRef = resolveFindingFromRef;

// Whether a clause ref the auditor typed into "Set criterion" is well-formed.
// The one implementation is window.isValidClauseRef in checklist-module.js
// (loads after this file; it carries the pseudo-tag guard and try/catch this
// file's own copy had). This file used to declare a second global
// isValidClauseRef, which checklist-module.js's replaced at load, so the
// checks below were already running that one. Resolved at call time.
window.NCRSyncUtils.isValidClauseRef = function (value) {
    return window.isValidClauseRef(value);
};

/**
 * Write criterionRef/criterionSource:'auditor-assigned' onto a resolved
 * finding (see resolveFindingFromRef) and, when it's checklist-sourced, onto
 * the matching live NCR/CAPA register record (window.state.ncrs) too, so the
 * register and the checklist item don't drift apart. Matches the register
 * record via sourceChecklistId/sourceItemIdx when the checklist item has
 * them, else falls back to clientId+clause. Does not itself talk to
 * Supabase — callers persist through the normal saveChecklist()/persistNCR()
 * paths afterward (see window.setFindingCriterion).
 *
 * @param {Object} report
 * @param {{kind:'checklist'|'manual', item:Object, index:number}} resolved
 * @param {string} value
 */
function applyCriterionToFinding(report, resolved, value) {
    const item = resolved.item;
    item.criterionRef = value;
    item.criterionSource = 'auditor-assigned';

    if (resolved.kind !== 'checklist') return; // a manual NCR IS the register record — nothing else to update
    if (!window.state || !Array.isArray(window.state.ncrs)) return;

    const auditId = report.planId != null ? String(report.planId) : null;
    let match = null;
    if (item.checklistId != null && item.itemIdx != null) {
        match = window.state.ncrs.find(n => n
            && String(n.sourceChecklistId) === String(item.checklistId)
            && String(n.sourceItemIdx) === String(item.itemIdx)
            && (!auditId || String(n.auditId || '') === auditId));
    }
    if (!match) {
        const clientKey = report.clientId != null ? String(report.clientId) : null;
        const clauseKey = String(item.clause || '').trim();
        if (clientKey && clauseKey) {
            match = window.state.ncrs.find(n => n
                && String(n.clientId) === clientKey
                && String(n.clause || '').trim() === clauseKey
                && String(n.status || '').toLowerCase() !== 'withdrawn');
        }
    }
    if (match) {
        match.criterionRef = value;
        match.criterionSource = 'auditor-assigned';
        if (typeof persistNCR === 'function') persistNCR(match).catch(e => console.warn('NCR criterion persist error:', e));
        else if (window.persistNCR) window.persistNCR(match).catch(e => console.warn('NCR criterion persist error:', e));
    }
}
window.NCRSyncUtils.applyCriterionToFinding = applyCriterionToFinding;

/**
 * Every checklist item still waiting on an auditor-assigned criterion.
 *
 * A Stage 1 focus point / org-context / unmapped-document question carries an
 * internal working reference (FOCUS.n, ORG, DOC) as its `clause`, never a
 * clause of the audited standard. The builder deliberately does NOT stamp one
 * on from the question's own text — a clause sitting in a question is what the
 * question is ABOUT, not the requirement an auditor found unfulfilled, and
 * guessing produced a real defect (a competence finding recorded against 9.2
 * because "9.2" appeared in the prompt). So `criterionRef` stays empty and any
 * recovered clause is held as an unconfirmed `criterionSuggestedRef`.
 *
 * That is correct, but it left the assignment itself as a per-finding hunt
 * through the Report Integrity panel, which is why real reports shipped with
 * items unattributed. This collects them all so one screen can confirm them.
 *
 * Deliberately EXCLUDES:
 *  - items with a confirmed criterionRef — nothing to decide
 *  - items whose own clause is already a real clause of the standard
 *  - ISO/IEC 17021-1 surveillance elements ("9.6.2 (b)") — their criterion is
 *    a certification-PROGRAMME criterion, not a clause of the client's
 *    standard, so there is nothing to assign and offering one invites exactly
 *    the cross-framework confusion B15 blocks at issuance.
 *
 * @param {Object} report
 * @returns {Array<{index, item, clause, requirement, status, ncrType, suggestedRef,
 *   confidence, basis, blocksIssuance}>} ordered blockers-first
 */
function collectUnconfirmedCriteria(report, opts) {
    if (!report) return [];
    // includeAssigned: list every finding, not only the unassigned ones. An
    // assigned criterion can be WRONG — a competence finding filed under 9.2
    // Internal audit — and a bare parent clause ("7") is a real clause that
    // W25 rightly flags. Both need changing, and the review screen is the
    // only control that writes a criterion; excluding assigned items from it
    // left no way back once a wrong clause was saved.
    const includeAssigned = !!(opts && opts.includeAssigned);
    const pseudo = window.NCR_PSEUDO_CLAUSE_PATTERN || /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
    const isRegisterSeverity = (t) => ['major', 'minor'].includes(String(t || '').toLowerCase());
    const out = [];

    (report.checklistProgress || []).forEach((item, index) => {
        if (!item) return;
        const currentRef = String(item.criterionRef || '').trim();
        const clause = String(item.clause || '').trim();

        // Canonical decision on what KIND of reference this is, when the
        // report layer is loaded; a local pseudo-pattern test otherwise so
        // this stays correct regardless of script load order.
        let kind = null;
        if (window.ReportStats && typeof window.ReportStats.classifyCriterion === 'function') {
            try { kind = window.ReportStats.classifyCriterion(item).kind; } catch (_e) { kind = null; }
        }
        // A certification-programme criterion (ISO/IEC 17021-1 9.6.2) must
        // never be given a clause of the audited standard, in either mode.
        if (kind === 'programme') return;
        const rawReal = kind === 'standard' || (!kind && clause && !pseudo.test(clause));
        if (includeAssigned) {
            // Assigned, or a finding on a real clause: changeable. A conforming
            // item on a real clause has nothing to review.
            if (!currentRef && rawReal && item.status !== 'nc') return;
            if (!currentRef && !rawReal && kind && kind !== 'internal' && kind !== 'none') return;
        } else {
            if (currentRef) return; // already assigned
            if (kind) {
                // 'standard' needs nothing; 'programme' was excluded above.
                if (kind !== 'internal' && kind !== 'none') return;
            } else if (clause && !pseudo.test(clause)) {
                return;
            }
        }
        // What the report currently prints for this finding: the assigned
        // criterion, else the raw clause when that is itself a real one.
        const effectiveRef = currentRef || (rawReal ? clause : '');

        out.push({
            index,
            item,
            clause: clause || '(none)',
            requirement: item.requirement || item.description || item.text || '',
            status: item.status || '',
            ncrType: item.ncrType || '',
            suggestedRef: item.criterionSuggestedRef || '',
            confidence: item.criterionConfidence || 'none',
            basis: item.criterionBasis || 'none',
            // A major/minor NC with no criterion is what B1/B14 block issuance
            // on; an observation, OFI or conforming item is attribution quality,
            // not a gate. Sorting on it puts the ones that actually stop the
            // report from issuing at the top of the review. Once a criterion
            // is assigned, B1 no longer fires, so an assigned finding never
            // blocks (PC Connection, 2026-11-19: "5 of them block issuance"
            // with 0 unassigned).
            blocksIssuance: !effectiveRef && item.status === 'nc' && isRegisterSeverity(item.ncrType),
            currentRef: effectiveRef,
            assigned: !!effectiveRef
        });
    });

    const CONF_RANK = { medium: 0, low: 1, none: 2 };
    // Unassigned first — those are the gaps; assigned rows follow for review.
    return out.sort((a, b) =>
        (a.assigned ? 1 : 0) - (b.assigned ? 1 : 0)
        || (b.blocksIssuance ? 1 : 0) - (a.blocksIssuance ? 1 : 0)
        || (CONF_RANK[a.confidence] ?? 3) - (CONF_RANK[b.confidence] ?? 3)
        || a.index - b.index);
}
window.NCRSyncUtils.collectUnconfirmedCriteria = collectUnconfirmedCriteria;

/**
 * Other Major/Minor findings on this report (checklist or manual) sharing
 * the same pseudo-clause as the one just fixed — repeated FOCUS.n/SURV items
 * are common on a real checklist, so fixing them one at a time is tedious.
 * Powers the "Set criterion" bulk-apply offer.
 */
function findSiblingFindingsByClause(report, resolved, clause) {
    if (!clause) return [];
    const isRegisterSeverity = (t) => ['major', 'minor'].includes(String(t || '').toLowerCase());
    const clauseKey = String(clause).trim();
    const out = [];
    (report.checklistProgress || []).forEach((p, i) => {
        if (!p || p.status !== 'nc' || !isRegisterSeverity(p.ncrType)) return;
        if (String(p.clause || '').trim() !== clauseKey) return;
        if (resolved.kind === 'checklist' && i === resolved.index) return;
        out.push({ kind: 'checklist', item: p, index: i });
    });
    (report.ncrs || []).forEach((n, i) => {
        if (!n || !isRegisterSeverity(n.type || n.ncrType || n.severity)) return;
        if (String(n.clause || '').trim() !== clauseKey) return;
        if (resolved.kind === 'manual' && i === resolved.index) return;
        out.push({ kind: 'manual', item: n, index: i });
    });
    return out;
}
window.NCRSyncUtils.findSiblingFindingsByClause = findSiblingFindingsByClause;

/**
 * Rewrite the headcount inside ONE note so it states `newCount`.
 *
 * Confirming a headcount corrects the controlled profile; it cannot correct
 * a field note that states a different number, and that note keeps its own
 * W12 warning. Only the auditor can decide which note is wrong, so this is
 * driven per-note from the review dialog rather than applied wholesale.
 *
 * Replaces only the numeral in the "<n> employees" phrase, leaving the rest
 * of the sentence exactly as the auditor wrote it — no rewording, no
 * regenerated text.
 *
 * @param {Object} report
 * @param {{kind:'checklist'|'narrative', index?:number, field:string}} ref
 * @param {number} oldCount
 * @param {number} newCount
 * @returns {boolean} true when something was actually changed
 */
function correctHeadcountInNote(report, ref, oldCount, newCount) {
    if (!report || !ref) return false;
    const pattern = new RegExp('\\b' + oldCount + '(\\s+(?:now\\s+)?(?:total\\s+)?empl\\w*)', 'gi');
    const rewrite = (text) => String(text || '').replace(pattern, String(newCount) + '$1');

    if (ref.kind === 'checklist') {
        const item = (report.checklistProgress || [])[ref.index];
        if (!item) return false;
        const before = item[ref.field];
        const after = rewrite(before);
        if (after === before) return false;
        item[ref.field] = after;
        return true;
    }
    // Narrative. report.ofi may be an array (one entry per OFI) — rewrite
    // each entry rather than flattening it to a string, which would destroy
    // the structure the OFI section and B17 both read.
    if (ref.field === 'ofi' && Array.isArray(report.ofi)) {
        let changed = false;
        report.ofi = report.ofi.map((entry) => {
            if (typeof entry !== 'string') return entry;
            const after = rewrite(entry);
            if (after !== entry) changed = true;
            return after;
        });
        return changed;
    }
    const before = report[ref.field];
    const after = rewrite(before);
    if (after === before) return false;
    report[ref.field] = after;
    return true;
}
window.NCRSyncUtils.correctHeadcountInNote = correctHeadcountInNote;

// eslint-disable-next-line no-unused-vars
function renderExecutionTab(report, tabName, contextData = {}) {
    const tabContent = document.getElementById('tab-content');
    // The report as this tab first shows it: what a later save compares with
    // to tell this tab's changes from changes saved elsewhere meanwhile.
    if (report && window.ChecklistMerge) window.ChecklistMerge.noteServerFields(report.id, report, { ifAbsent: true });

    switch (tabName) {
        case 'checklist': {
            const { assignedChecklists = [], progressMap: passedProgressMap = {}, customItems = [], departments: _departments = [], designations: _designations = [], auditTeam: _auditTeam = [], clientPersonnel = [], clientData = null, plan: _plan = null, selectionMap = {}, overridesMap = {} } = contextData;
            // Drawn from the report as saved now; the view remembers it so a later
            // save can tell newer data apart from edits made on this screen.
            const liveView = window.liveProgressMap(report, passedProgressMap);
            const progressMap = liveView.progressMap;
            window.ChecklistMerge.setBase(report.id, liveView.report);

            // Auto-fill designation and department when personnel name is selected
            window._autoFillPersonnel = function (suffix) {
                const sel = document.getElementById('ncr-personnel-' + suffix);
                const desEl = document.getElementById('ncr-designation-' + suffix);
                const deptEl = document.getElementById('ncr-department-' + suffix);
                if (!sel) return;
                const name = sel.value;
                let designation = '';
                let department = '';
                if (name) {
                    // Find contact to get designation
                    const contacts = (clientData && clientData.contacts) || [];
                    const contact = contacts.find(c => c.name === name);
                    if (contact && contact.designation) {
                        designation = contact.designation;
                        // Find department from designations mapping
                        const desigs = (clientData && clientData.designations) || [];
                        const desMatch = desigs.find(d => (d.title || d) === designation);
                        if (desMatch && desMatch.department) {
                            department = desMatch.department;
                        }
                    }
                }
                if (desEl) desEl.value = designation;
                if (deptEl) deptEl.value = department;
            };

            // AI Auto Map: Use AI to assign personnel/designation/department based on question context
            window.autoMapPersonnel = async function (_reportId) {
                const allContacts = (clientData && clientData.contacts) || [];
                const desigs = (clientData && clientData.designations) || [];
                if (!allContacts.length) {
                    window.showNotification('No client contacts found. Please add contacts in the client profile first.', 'warning');
                    return;
                }

                // Filter to only opening meeting attendees
                const attendees = report.openingMeeting?.attendees;
                let contacts = allContacts;
                if (attendees && Array.isArray(attendees) && attendees.length > 0) {
                    const attendeeNames = new Set(
                        attendees.map(a => (typeof a === 'object' ? (a.name || '') : String(a)).trim().toLowerCase()).filter(Boolean)
                    );
                    contacts = allContacts.filter(c => c.name && attendeeNames.has(c.name.trim().toLowerCase()));
                    if (!contacts.length) {
                        // Fallback if name matching failed
                        window.showNotification('Could not match opening meeting attendees to contacts. Using full roster.', 'warning');
                        contacts = allContacts;
                    } else {
                        window.showNotification(`Using ${contacts.length} personnel from Opening Meeting attendees.`, 'info');
                    }
                } else {
                    window.showNotification('No opening meeting attendees recorded. Using full client roster.', 'warning');
                }

                // Build contacts list with departments for AI context
                const contactList = contacts.map(c => {
                    let dept = '';
                    if (c.designation) {
                        const dm = desigs.find(d => (d.title || d) === c.designation);
                        if (dm && dm.department) dept = dm.department;
                    }
                    return { name: c.name, designation: c.designation || '', department: dept };
                });

                // Ask user: unfilled only or all items?
                const choice = await new Promise(resolve => {
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
                    overlay.innerHTML = `
                        <div style="background:white;border-radius:12px;padding:2rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                            <div style="text-align:center;margin-bottom:1.5rem;">
                                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem;background:linear-gradient(135deg,#8b5cf6,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;"></i>
                                <h3 style="margin:0.5rem 0 0.25rem;">AI Auto Map Personnel</h3>
                                <p style="color:#64748b;font-size:0.85rem;margin:0;">Choose which items to auto-assign</p>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:0.75rem;">
                                <button id="am-unfilled" class="btn" style="padding:0.75rem;border:2px solid #8b5cf6;background:#f5f3ff;border-radius:8px;cursor:pointer;font-weight:600;color:#6d28d9;" aria-label="Filter">
                                    <i class="fa-solid fa-filter" style="margin-right:0.5rem;"></i> Unfilled Items Only
                                </button>
                                <button id="am-all" class="btn" style="padding:0.75rem;border:2px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;font-weight:500;color:#334155;" aria-label="Refresh">
                                    <i class="fa-solid fa-arrows-rotate" style="margin-right:0.5rem;"></i> Re-map All Items
                                </button>
                                <button id="am-cancel" style="padding:0.5rem;border:none;background:none;cursor:pointer;color:#94a3b8;font-size:0.85rem;">Cancel</button>
                            </div>
                        </div>`;
                    document.body.appendChild(overlay);
                    overlay.querySelector('#am-unfilled').onclick = () => { document.body.removeChild(overlay); resolve('unfilled'); };
                    overlay.querySelector('#am-all').onclick = () => { document.body.removeChild(overlay); resolve('all'); };
                    overlay.querySelector('#am-cancel').onclick = () => { document.body.removeChild(overlay); resolve(null); };
                    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } };
                });

                if (!choice) return;

                // Collect the questions to map. Clause and question text come from
                // the row's status input (data-clause / data-requirement), not from
                // scraping styled elements, which broke whenever the row layout moved.
                const PAM = window.PersonnelAutoMap;
                const itemsToMap = [];
                document.querySelectorAll('.checklist-item').forEach(row => {
                    const uniqueId = row.id?.replace('row-', '');
                    if (!uniqueId) return;
                    const personnelEl = document.getElementById('ncr-personnel-' + uniqueId);
                    if (!personnelEl) return;
                    if (choice === 'unfilled' && personnelEl.value) return;
                    const statusInput = document.getElementById('status-' + uniqueId);
                    const clause = String(statusInput?.dataset.clause || '').trim();
                    const question = String(statusInput?.dataset.requirement || '').trim();
                    if (clause || question) itemsToMap.push({ id: uniqueId, clause, question: question.substring(0, 300) });
                });

                if (!itemsToMap.length) {
                    window.showNotification(choice === 'unfilled' ? 'All items already have personnel assigned!' : 'No items found to map.', 'info');
                    return;
                }

                // One request per batch: a single request for a whole checklist
                // (100+ questions) can time out or come back cut short, and then
                // nothing is mapped. Each batch stands alone, so one failed batch
                // does not lose the others.
                const batches = PAM.chunk(itemsToMap, PAM.BATCH_SIZE);
                let mapped = 0;
                let skipped = 0;
                const failures = [];
                for (let b = 0; b < batches.length; b++) {
                    window.showNotification(`AI mapping questions ${b * PAM.BATCH_SIZE + 1}–${b * PAM.BATCH_SIZE + batches[b].length} of ${itemsToMap.length}…`, 'info');
                    try {
                        const response = await AI_SERVICE.callProxyAPI(PAM.buildPrompt(contactList, batches[b]), { maxTokens: 8192 });
                        const result = PAM.resolve(PAM.parseMappings(response), contactList, batches[b]);
                        skipped += result.skipped;
                        result.assignments.forEach(a => {
                            const pEl = document.getElementById('ncr-personnel-' + a.id);
                            if (!pEl) return;
                            if (!Array.from(pEl.options).some(o => o.value === a.personnel)) {
                                const opt = document.createElement('option');
                                opt.value = a.personnel;
                                opt.textContent = a.personnel;
                                pEl.appendChild(opt);
                            }
                            pEl.value = a.personnel;
                            const dEl = document.getElementById('ncr-designation-' + a.id);
                            const dpEl = document.getElementById('ncr-department-' + a.id);
                            if (dEl) dEl.value = a.designation;
                            if (dpEl) dpEl.value = a.department;
                            mapped++;
                        });
                    } catch (error) {
                        console.error('AI Auto Map batch error:', error);
                        failures.push(error && error.message ? error.message : 'Unknown error');
                    }
                }

                const parts = [`AI Auto Map: ${mapped} of ${itemsToMap.length} question(s) assigned.`];
                if (skipped) parts.push(`${skipped} left blank (no clear match on the contact list).`);
                if (failures.length) parts.push(`${failures.length} of ${batches.length} batch(es) failed: ${failures[0]}`);
                if (mapped) parts.push('They save automatically in a few seconds.');
                if (mapped && window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();
                window.showNotification(parts.join(' '), failures.length && !mapped ? 'error' : (failures.length ? 'warning' : 'success'));
            };

            // Helper to render row
            const renderRow = (item, checklistId, idx, isCustom = false) => {
                const uniqueId = isCustom ? `custom-${idx}` : `${checklistId}-${idx}`;
                const saved = progressMap[uniqueId] || {};
                const s = saved.status || ''; // 'conform', 'nc', 'na' or ''

                // APPLY LOCAL OVERRIDES
                const getNestedReq = (obj) => { if (!obj || !obj.items || !obj.items[0]) return null; return obj.items[0].requirement; };
                let requirementText = item.requirement || item.text || item.title || item.requirement_text || getNestedReq(item) || 'No requirement text provided';
                if (overridesMap && overridesMap[checklistId] && overridesMap[checklistId][idx]) {
                    requirementText = overridesMap[checklistId][idx];
                }

                // Question number as printed on the checklist and the agenda
                // index ("IMS 13" = 13th question of section IMS), so the
                // auditor can find a question named on paper. Only sectioned
                // items have one; custom and old flat-format items don't.
                const qRef = window.ChecklistQuestionRef.fromItemId(isCustom ? null : idx);
                const stmtHint = window.FindingStatementHint.forType(saved.ncrType, item.clause, requirementText);
                // Stored text is entity-encoded (saved through sanitizeText); compare
                // and render it decoded, or every save adds a layer of "&amp;".
                const savedPersonnel = _execDecode(saved.personnel || '');
                const qRefAttr = qRef ? ` data-q-ref="${_execEscText(qRef)}"` : '';
                const qRefBadge = qRef
                    ? `<div class="q-ref-badge" title="Checklist question ${_execEscText(qRef)}" style="display: inline-block; margin-bottom: 0.25rem; padding: 0 0.4rem; border: 1px solid var(--primary-color); border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: var(--primary-color); white-space: nowrap;">${_execEscText(qRef)}</div>`
                    : '';

                return `
                    <div class="card checklist-item" id="row-${uniqueId}"${qRefAttr} style="margin-bottom: 0.5rem; padding: 1rem; border-left: 4px solid #e2e8f0;">
                         <div style="display: grid; grid-template-columns: 30px 80px 1fr 180px; gap: 1rem; align-items: start;">
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" class="item-checkbox" data-unique-id="${uniqueId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select this item for bulk action">
                            </div>
                            <div style="font-weight: bold; color: var(--primary-color);">${qRefBadge}<div>${item.clause || 'N/A'}</div></div>
                            <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(requirementText)}</div>
                                <div style="position: relative;">
                                    <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${_execEscText(saved.comment || '')}" style="margin-bottom: 0; padding-right: 35px;">
                                    <button type="button" id="mic-btn-${uniqueId}" data-action="startDictation" data-id="${uniqueId}" style="position: absolute; right: 0; top: 0; height: 100%; width: 35px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;" title="Dictate to Remarks">
                                        <i class="fa-solid fa-microphone"></i>
                                    </button>
                                </div>
                                ${saved._originalComment ? `
                                <div style="margin-top: 4px;">
                                    <button type="button" data-action="toggleOrigNotes" data-id="${uniqueId}" style="font-size:0.7rem;color:#8b5cf6;background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">
                                        <i class="fa-solid fa-clock-rotate-left" style="font-size:0.65rem;"></i> <span>View Original Notes</span>
                                    </button>
                                    <div id="orig-note-${uniqueId}" style="display:none;margin-top:4px;padding:6px 10px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;font-size:0.78rem;color:#92400e;line-height:1.4;">
                                        <div style="font-weight:600;font-size:0.7rem;color:#b45309;margin-bottom:2px;"><i class="fa-solid fa-pen-nib" style="margin-right:4px;"></i>Original Auditor Notes:</div>
                                        ${_execEscText(saved._originalComment)}
                                    </div>
                                </div>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button type="button" class="btn-icon btn-ns status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NOT_SAMPLED || 'not_sampled'}" title="Not sampled at this audit (risk-based sampling). Counts as not assessed, never as conforming." aria-label="Not sampled"><i class="fa-solid fa-eye-slash"></i></button>
                                <button type="button" class="btn-icon btn-na status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NA}" title="Not Applicable">N/A</button>
                                <button type="button" class="btn-icon btn-ok status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.CONFORM}" title="Conformity" aria-label="Confirm"><i class="fa fa-check"></i></button>
                                <button type="button" class="btn-icon btn-nc status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NC}" title="Non-Conformity" aria-label="Flag"><i class="fa fa-flag"></i></button>
                            </div>
                         </div>
                         
                         <!-- Evidence Photos (available for ALL statuses) -->
                         <div style="margin-top: 0.75rem; padding: 0.5rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                             <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                                 <label style="font-size: 0.78rem; font-weight: 600; color: #475569; margin: 0;"><i class="fa-solid fa-images" style="margin-right: 0.25rem; color: #6366f1;"></i>Evidence Photos</label>
                                 <div style="display: flex; gap: 4px;">
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #6366f1; color: white; border: none; border-radius: 4px;" data-action="clickElement" data-id="img-${uniqueId}" title="Upload image">
                                         <i class="fa-solid fa-file-image"></i> Upload
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #0ea5e9; color: white; border: none; border-radius: 4px;" data-action="handleCameraButton" data-id="${uniqueId}" title="Camera">
                                         <i class="fa-solid fa-camera"></i>
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #8b5cf6; color: white; border: none; border-radius: 4px;" data-action="captureScreenEvidence" data-id="${uniqueId}" title="Screen capture">
                                         <i class="fa-solid fa-desktop"></i>
                                     </button>
                                 </div>
                             </div>
                             <!-- Multi-image preview strip -->
                             <div id="evidence-preview-${uniqueId}" style="display: ${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'flex' : 'none'}; flex-wrap: wrap; gap: 6px; align-items: center;">
                                 ${(function () {
                        const imgs = saved.evidenceImages || (saved.evidenceImage ? [saved.evidenceImage] : []);
                        return imgs.map((src, imgIdx) => {
                            const isIdb = src.startsWith('idb://');
                            const displaySrc = isIdb ? '' : src;
                            return `
                                         <div class="ev-thumb" data-idx="${imgIdx}" data-save-url="${window.UTILS.escapeHtml(src)}" data-captured-at="${window.UTILS.escapeHtml((saved.evidenceCapturedAtList && saved.evidenceCapturedAtList[imgIdx]) || '')}" style="position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;">
                                             <img src="${displaySrc}" data-idb-key="${isIdb ? window.UTILS.escapeHtml(src) : ''}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;${isIdb ? ' background: #e2e8f0;' : ''}" data-action="viewEvidenceImageByUrlSelf" data-src="${window.UTILS.escapeHtml(displaySrc)}"/>
                                             <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${imgIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">×</button>
                                         </div>
                                     `;
                        }).join('');
                    })()}
                             </div>
                             <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                             <input type="file" id="cam-${uniqueId}" accept="image/*" capture="environment" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                             <input type="hidden" id="evidence-data-${uniqueId}" value="${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'attached' : ''}">
                         </div>
                         
                         <!-- Hidden status input -->
                         <input type="hidden" class="status-input" data-checklist="${checklistId}" data-item="${idx}" data-custom="${isCustom}" data-clause="${window.UTILS.escapeHtml(item.clause || '')}" data-requirement="${window.UTILS.escapeHtml(requirementText || '')}" id="status-${uniqueId}" value="${s}">
                         
                             <!-- Auditee interviewed for this question (personnel, designation, department).
                              Shown on every question, not only NCs: saveChecklist stores these
                              for every item and AI Auto Map fills them across all rows. -->
                             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Personnel Name</label>
                                     <select id="ncr-personnel-${uniqueId}" class="form-control form-control-sm" data-action-change="_autoFillPersonnel" data-id="${uniqueId}">
                                        <option value="">-- Select --</option>
                                        ${clientPersonnel.map(p => `<option value="${_execEscText(p.name)}" ${savedPersonnel === _execDecode(p.name || '') ? 'selected' : ''}>${_execEscText(p.name)}</option>`).join('')}
                                        ${savedPersonnel && !clientPersonnel.some(p => _execDecode(p.name || '') === savedPersonnel) ? `<option value="${_execEscText(savedPersonnel)}" selected>${_execEscText(savedPersonnel)}</option>` : ''}
                                     </select>
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Designation</label>
                                     <input type="text" id="ncr-designation-${uniqueId}" class="form-control form-control-sm" value="${_execEscText(saved.designation || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Department</label>
                                     <input type="text" id="ncr-department-${uniqueId}" class="form-control form-control-sm" value="${_execEscText(saved.department || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                                 </div>
                             </div>

                         <!-- NCR Panel (Conditional) -->
                         <div id="ncr-panel-${uniqueId}" class="ncr-panel" style="display: ${s === 'nc' ? 'block' : 'none'}; background: #fff1f2; border: 1px solid #fecaca; padding: 1rem; margin-top: 1rem; border-radius: 6px;">
                             <h5 style="color: var(--danger-color); margin-bottom: 0.5rem; display: flex; align-items: center;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i> Finding Details</h5>
                             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Severity</label>
                                     <div style="display: flex; gap: 5px;">
                                         <select id="ncr-type-${uniqueId}" class="form-control form-control-sm" style="${!saved.ncrType || saved.ncrType === window.CONSTANTS.NCR_TYPES.PENDING ? 'border-color: var(--warning-color, #f59e0b); box-shadow: 0 0 0 1px var(--warning-color, #f59e0b);' : ''}">
                                             <option value="${window.CONSTANTS.NCR_TYPES.PENDING}" ${!saved.ncrType || saved.ncrType === window.CONSTANTS.NCR_TYPES.PENDING ? 'selected' : ''}>— Select classification —</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation (OBS)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.OFI}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.OFI ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor NC</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major NC</option>

                                         </select>
                                         <button type="button" class="btn btn-sm btn-info" data-action="toggleDisplay" data-id="criteria-${uniqueId}" title="View Classification Matrix (ISO 17021-1)">
                                            <i class="fa-solid fa-scale-balanced"></i>
                                         </button>
                                     </div>
                                     <div id="criteria-${uniqueId}" style="display: none; position: absolute; background: white; border: 1px solid #ccc; padding: 10px; z-index: 100; width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 4px; font-size: 0.8rem; margin-top: 5px;">
                                        <strong>ISO 17021-1 Criteria</strong>
                                        <div style="margin-top:5px; border-left: 3px solid var(--danger-color); padding-left: 5px; background: #fff5f5;">
                                            <strong>Major:</strong> ${window.CONSTANTS.NCR_CRITERIA.MAJOR.description}
                                        </div>
                                        <div style="margin-top:5px; border-left: 3px solid var(--warning-color); padding-left: 5px; background: #fffaf0;">
                                            <strong>Minor:</strong> ${window.CONSTANTS.NCR_CRITERIA.MINOR.description}
                                        </div>
                                        <div style="text-align: right; margin-top: 5px;"><small style="color: blue; cursor: pointer;" data-action="hideGrandparent">Close</small></div>
                                     </div>
                                 </div>
                                 </div>

                             <!-- Nonconformity statement: printed under "Nonconformity
                                  Statement" for each Major/Minor NC in the client report
                                  (execution-reporting.js buildFormalNCParts). Its input had
                                  gone from this panel, so every NC printed "Nonconformity
                                  statement not recorded." with no way to write one. -->
                             <div style="margin-bottom: 0.75rem;">
                                 <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem;">
                                     <label for="ncr-desc-${uniqueId}" style="font-size: 0.8rem; margin: 0;"><span id="ncr-desc-title-${uniqueId}">${_execEscText(stmtHint.title)}</span> <span id="ncr-desc-help-${uniqueId}" style="color:#64748b;font-weight:400;">(${_execEscText(stmtHint.help)})</span></label>
                                     <button type="button" class="btn btn-sm btn-link" style="padding: 0; font-size: 0.75rem; white-space: nowrap;" data-action="insertFindingTemplate" data-arg1="${_execEscText(uniqueId)}" title="Fill the box with a statement built from this question's clause, requirement and your remark (as the evidence); then replace the [bracketed] parts">Insert template</button>
                                 </div>
                                 <textarea id="ncr-desc-${uniqueId}" class="form-control form-control-sm" rows="3" data-clause="${_execEscText(item.clause || '')}" data-req="${_execEscText(requirementText)}" placeholder="${_execEscText(window.FindingStatementHint.example(stmtHint))}">${_execEscText(saved.ncrDescription || '')}</textarea>
                             </div>

                             


                         </div>
                    </div>
                `;
            };

            let checklistHTML;

            if (assignedChecklists.length > 0) {
                checklistHTML = assignedChecklists.map(checklist => {
                    // Support both old (items) and new (clauses) format
                    const useClauses = checklist.clauses && checklist.clauses.length > 0;

                    if (useClauses) {
                        // New hierarchical format with accordion
                        let itemIdx = 0;

                        // Apply saved clause order if available
                        let orderedClauses = [...checklist.clauses];
                        const savedOrder = report.clauseOrder;
                        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
                            orderedClauses.sort((a, b) => {
                                const idA = `${checklist.id}-${a.mainClause}`;
                                const idB = `${checklist.id}-${b.mainClause}`;
                                const posA = savedOrder.indexOf(idA);
                                const posB = savedOrder.indexOf(idB);
                                // Items not in savedOrder go to the end, in original order
                                return (posA === -1 ? 9999 : posA) - (posB === -1 ? 9999 : posB);
                            });
                        }

                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; margin-bottom: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    <i class="fa-solid fa-clipboard-list" style="color: var(--primary-color); -webkit-text-fill-color: #667eea;"></i> ${_execEscText(checklist.name)}
                                </h4>
                                ${orderedClauses.map((clause, clauseIdx) => {
                            const allowedIds = selectionMap[checklist.id];
                            const isSelective = Array.isArray(allowedIds) && allowedIds.length > 0;

                            // Filter valid items first
                            const itemsToRender = clause.subClauses
                                .map((item, subIdx) => ({ item, itemId: `${clause.mainClause}-${subIdx}` }))
                                .filter(obj => !isSelective || allowedIds.includes(obj.itemId));

                            if (itemsToRender.length === 0) return ''; // Skip empty clauses

                            const sectionId = `clause-${checklist.id}-${clause.mainClause}`;
                            const renderedItems = itemsToRender.map(obj => {
                                const _globalIdx = itemIdx++;
                                return renderRow(obj.item, checklist.id, obj.itemId, false);
                            }).join('');

                            // Calculate progress for this section
                            const sectionProgress = itemsToRender.map(obj => {
                                const key = `${checklist.id}-${obj.itemId}`;
                                return progressMap[key]?.status || '';
                            });
                            const completed = sectionProgress.filter(s => s === 'conform' || s === 'nc' || s === 'na' || s === 'not_sampled').length;
                            const total = itemsToRender.length;
                            const _progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return `
                                        <div class="accordion-section" data-clause-id="${checklist.id}-${clause.mainClause}" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                            <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); user-select: none;">
                                                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                                                    <span class="clause-drag-handle" style="cursor: grab; color: #94a3b8; padding: 0 4px; font-size: 1rem;" title="Drag to reorder section"><i class="fa-solid fa-grip-vertical"></i></span>
                                                    <input type="checkbox" class="section-checkbox" data-section-id="${sectionId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select all items in this section">
                                                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; cursor: pointer;" data-action="toggleAccordion" data-id="${sectionId}">${_execEscText(clause.mainClause)}</span>
                                                    <span style="font-weight: 600; color: #1e293b; cursor: pointer; flex: 1;" data-action="toggleAccordion" data-id="${sectionId}">${_execEscText(clause.title)}</span>
                                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">(${total} items)</span>
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 1rem;">
                                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${completed}/${total}</span>
                                                    <i class="fa-solid fa-chevron-down accordion-icon" id="icon-${sectionId}" style="transition: transform 0.3s; cursor: pointer; transform: rotate(${clauseIdx === 0 ? '180deg' : '0deg'});" data-action="toggleAccordion" data-id="${sectionId}"></i>
                                                </div>
                                            </div>
                                            <div class="accordion-content" id="${sectionId}" style="display: ${clauseIdx === 0 ? 'block' : 'none'}; padding: 1rem; background: white;">
                                                ${renderedItems}
                                            </div>
                                        </div>
                                    `;
                        }).join('')}
                            </div>
                        `;
                    } else {
                        // Fallback for old flat format
                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: var(--primary-color);">
                                    ${_execEscText(checklist.name)}
                                </h4>
                                ${(checklist.items || []).map((item, idx) => renderRow(item, checklist.id, idx, false)).join('')}
                            </div>
                        `;
                    }
                }).join('');
            } else {
                checklistHTML = `<div class="alert alert-warning" style="display:flex;align-items:flex-start;gap:1rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;color:#d97706;margin-top:2px;"></i>
                    <div>
                        <strong>No configured checklists found.</strong>
                        <p style="margin:0.5rem 0 0;color:#6b7280;font-size:0.9rem;">To add checklists:<br>
                        1. Go to <strong>Plans & Audits</strong> → select this audit plan<br>
                        2. Under <strong>Checklist Selection</strong>, choose the applicable standard checklist(s)<br>
                        3. Return here and refresh the page</p>
                    </div>
                </div>`;
            }

            // Custom Items Section
            if (customItems.length > 0) {
                checklistHTML += `
                    <div style="margin-bottom: 2rem; margin-top: 2rem;">
                         <h4 style="border-bottom: 2px solid var(--warning-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: #d97706;">
                            <i class="fa-solid fa-pen-to-square"></i> Custom Audit Questions
                        </h4>
                        ${customItems.map((item, idx) => renderRow(item, 'custom', idx, true)).join('')}
                    </div>
                `;
            }



            tabContent.innerHTML = `
                <style>
                    .btn-icon { border: 1px solid #d1d5db; background: white; width: 32px; height: 32px; border-radius: 4px; color: #6b7280; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; cursor: pointer; }
                    .btn-icon:hover { background: #f3f4f6; }
                    .btn-icon.active { transform: scale(1.1); font-weight: bold; border-color: transparent; }
                    .btn-icon.btn-ok.active { background: var(--success-color); color: white; }
                    .btn-icon.btn-nc.active { background: var(--danger-color); color: white; }
                    .btn-icon.btn-na.active { background: #9ca3af; color: white; }
                    .btn-icon.btn-ns.active { background: #64748b; color: white; }
                    .checklist-item:focus-within { border-color: var(--primary-color) !important; background: #f0f9ff !important; }
                    .checklist-item.filtered-out { display: none !important; }
                    .progress-ring { transform: rotate(-90deg); }
                    .progress-ring-circle { transition: stroke-dashoffset 0.5s; }
                    .filter-btn { padding: 0.5rem 1rem; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
                    .filter-btn:hover { background: #f8fafc; }
                    .filter-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                    .save-indicator { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 1000; animation: slideIn 0.3s; }
                    @keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    .keyboard-hint { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; z-index: 999; }
                </style>
                <div>


                    <!-- Filters & Actions Bar -->
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100;">

                        <div style="display: flex; gap: 0.25rem; align-items: center; margin-right: auto;">
                            <label for="jump-to-question" style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; margin: 0;">Jump to</label>
                            <input type="text" id="jump-to-question" class="form-control" style="width: 9rem;" placeholder="e.g. IMS 13" autocomplete="off" title="Type a question number from the checklist or agenda index, then press Enter" data-action-change="jumpToChecklistQuestion" data-arg1="this.value">
                            <button type="button" class="btn btn-outline-secondary" data-action="jumpToChecklistQuestionFromBox" title="Go to the question">Go</button>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${window.printScreenshotsToggleHtml ? window.printScreenshotsToggleHtml() : ''}
                            <button class="btn btn-outline-secondary" data-action="printCompletedChecklist" data-id="${_execEscText(String(report.id))}" title="Print the checklist with your answers, notes and finding references" aria-label="Print completed checklist">
                                <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print
                            </button>
                            <button class="btn btn-outline-secondary" id="toggle-all-accordions" data-action="toggleAllAccordions" title="Collapse/Expand all sections">
                                <i class="fa-solid fa-compress-alt" style="margin-right: 0.5rem;"></i> <span>Collapse All</span>
                            </button>
                            <button class="btn btn-secondary" data-action="addCustomQuestion" data-id="${report.id}" aria-label="Add">
                                <i class="fa-solid fa-plus-circle" style="margin-right: 0.5rem;"></i> Add Question
                            </button>
                            <div style="position: relative;">
                                <button class="btn btn-outline-secondary" data-action="toggleHidden" data-id="bulk-menu-${report.id}" aria-label="Checklist">
                                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i> Bulk Actions
                                </button>
                                <div id="bulk-menu-${report.id}" class="hidden" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px; z-index: 1000;">
                                    <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Mark Items As:</div>
                                    </div>
                                    <button class="bulk-action-btn" data-action="conform" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" aria-label="Confirm">
                                        <i class="fa-solid fa-check" style="color: var(--success-color); width: 18px;"></i>
                                        <span>Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="nc" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" aria-label="Flag">
                                        <i class="fa-solid fa-flag" style="color: var(--danger-color); width: 18px;"></i>
                                        <span>Non-Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="na" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                                        <i class="fa-solid fa-ban" style="color: #9ca3af; width: 18px;"></i>
                                        <span>Not Applicable</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="not_sampled" data-report-id="${report.id}" title="Marks the selected (or shown) questions that have no answer yet; answered ones are left as they are" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                                        <i class="fa-solid fa-eye-slash" style="color: #64748b; width: 16px;"></i> <span>Not sampled</span>
                                    </button>
                                    <div style="border-top: 1px solid #e2e8f0; padding: 0.75rem 1rem;">
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-info-circle"></i> Select items to limit scope
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-outline-secondary" data-action="autoMapPersonnel" data-id="${report.id}" title="AI auto-assign personnel, designation & department to items" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none;" aria-label="Auto-generate">
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto Map
                            </button>
                            <button class="btn btn-primary" data-action="saveChecklist" data-id="${report.id}" id="save-progress-btn" aria-label="Save">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                            </button>
                            ${(report.checklistRevisions && report.checklistRevisions.length > 0) ? `
                            <span id="revision-badge" title="${report.checklistRevisions.map(r => 'v' + r.rev + ' — ' + new Date(r.timestamp).toLocaleString()).join('\n')}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:0.75rem;font-weight:600;color:#166534;cursor:help;">
                                <i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${report.checklistRevisions.length}
                            </span>` : ''}
                        </div>
                    </div>

                    ${checklistHTML}
                    
                    <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                        <button class="btn btn-primary btn-lg" data-action="saveChecklist" data-id="${report.id}">
                            <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Save All Progress
                        </button>
                    </div>
                </div>

                <!-- Save Indicator -->
                <div class="save-indicator" id="save-indicator">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Progress Saved
                </div>

            `;

            // Setup event delegation for section checkboxes & bulk actions
            setTimeout(() => {
                document.querySelectorAll('.section-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function (e) {
                        e.stopPropagation();
                        const sectionId = this.getAttribute('data-section-id');
                        window.Logger.debug('Execution', 'Checkbox clicked for section:', sectionId);
                        window.toggleSectionSelection(sectionId, this);

                        // Sync individual item checkboxes
                        const section = document.getElementById(sectionId);
                        if (section) {
                            section.querySelectorAll('.item-checkbox').forEach(cb => {
                                cb.checked = this.checked;
                            });
                        }
                    });
                });

                // Item checkbox listener
                document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function () {
                        const uniqueId = this.getAttribute('data-unique-id');
                        const item = document.getElementById('row-' + uniqueId);
                        if (this.checked) {
                            item.classList.add('selected-item');
                            item.style.background = '#eff6ff';
                            item.style.borderLeft = '4px solid var(--primary-color)';
                        } else {
                            item.classList.remove('selected-item');
                            item.style.background = '';
                            item.style.borderLeft = '4px solid #e2e8f0';
                        }
                    });
                });

                // Autosave: saves a few seconds after the last change, and at once
                // before leaving the checklist (another tab, another page, closing).
                if (window.ChecklistAutoSave) window.ChecklistAutoSave.bind(report.id, tabContent);

                // Init clause section drag-to-reorder
                if (window.initClauseDragReorder) window.initClauseDragReorder();
                // The first section opens on render; the button says what a click will do.
                if (window.syncToggleAllAccordions) window.syncToggleAllAccordions();

                // Bulk action buttons are handled by the document delegate in
                // bindExecutionDocumentDelegates() — exactly once per click,
                // because bulkUpdateStatus clears the selection and a second
                // call would re-apply the status to every visible item.

                // CRITICAL: Restore saved status to buttons after render
                document.querySelectorAll('.status-input').forEach(input => {
                    const uniqueId = input.id.replace('status-', '');
                    const savedStatus = input.value; // 'conform', 'nc', 'na', or ''

                    if (savedStatus) {
                        // Apply active state to the corresponding button
                        window.setChecklistStatus(uniqueId, savedStatus);
                    }
                });
            }, 100);

            break;
        }

        case 'ncr': {
            // All findings of this audit: nonconformities (Major / Minor), observations
            // and OFIs, grouped by category: NCs under their NC register reference
            // (NCR-091; NC-001 when not in the register), then OBS-001, OFI-001,
            // so an observation is never labelled an NCR. Same list the printed
            // findings summary uses (window.collectAuditFindings).
            const collected = window.collectAuditFindings(report, contextData.assignedChecklists || []);
            const allFindings = collected.findings;
            const fc = collected.counts;
            const esc = window.UTILS.escapeHtml;

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        <div style="flex: 1 1 320px; min-width: 0;">
                            <h3>Audit Findings</h3>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">
                                ${fc.nc} nonconformit${fc.nc === 1 ? 'y' : 'ies'} (Major ${fc.major} &middot; Minor ${fc.minor})${fc.pending ? ` &middot; ${fc.pending} awaiting classification` : ''} &middot; ${fc.obs} observation${fc.obs === 1 ? '' : 's'} &middot; ${fc.ofi} OFI${fc.ofi === 1 ? '' : 's'}
                                &mdash; ${collected.manualCount} manual, ${collected.checklistCount} from checklist
                            </p>
                        </div>
                        <button class="btn btn-primary" data-action="createNCR" data-id="${report.id}" aria-label="Add" style="flex: none; white-space: nowrap;">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Finding
                        </button>
                    </div>

                    <!-- Print toolbar: settings on the left, the two prints on the right, one line on a wide screen. -->
                    <div class="findings-print-bar" style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; padding: 0.75rem 1rem; margin-bottom: 1.25rem; border: 1px solid var(--border-color); border-radius: 8px;">
                        <label for="findings-response-due" style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); margin: 0; white-space: nowrap;" title="Printed on the findings summary as the date the client's correction and corrective action plan is due">
                            Client response due
                            <input type="date" class="form-control" id="findings-response-due" value="${esc(String(report.findingsResponseDue || ''))}" data-action-change="setFindingsResponseDue" data-arg1="${esc(String(report.id))}" data-arg2="this.value" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: auto; margin: 0;">
                        </label>
                        ${window.printScreenshotsToggleHtml ? window.printScreenshotsToggleHtml() : ''}
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-left: auto;">
                            <button class="btn btn-outline-secondary" data-action="printCompletedChecklist" data-id="${esc(String(report.id))}" title="Print the checklist with your answers, notes and finding references" aria-label="Print completed checklist" style="white-space: nowrap;">
                                <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem;"></i> Print completed checklist
                            </button>
                            <button class="btn btn-outline-secondary" data-action="printFindingsSummary" data-id="${esc(String(report.id))}" title="Print the findings for the closing meeting, for the client to acknowledge" aria-label="Print findings summary" style="white-space: nowrap;"${allFindings.length ? '' : ' disabled'}>
                                <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print findings summary
                            </button>
                        </div>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ref</th>
                                    <th>Source</th>
                                    <th>Finding type</th>
                                    <th>Clause</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allFindings.length > 0 ? allFindings.map(f => `
                                    <tr>
                                        <td><strong>${esc(f._ref)}</strong></td>
                                        <td><span style="background: ${f.source === 'manual' ? '#3b82f6' : '#8b5cf6'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${f.source === 'manual' ? 'Manual' : 'Checklist'}</span></td>
                                        <td><span style="background: ${f._cat.color}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; white-space: nowrap;">${esc(f._cat.label)}</span></td>
                                        <td>${esc(f.clause || '-')}</td>
                                        <td style="min-width: 260px; max-width: 520px; font-size: 0.8rem; line-height: 1.4;" title="${esc(f.description || '-')}"><div class="finding-desc" style="display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere;">${esc(f.description || '-')}</div></td>
                                        <td><span style="background: ${f.status === window.CONSTANTS.STATUS.CLOSED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${esc(f.status || 'Open')}</span></td>
                                        <td>${f.source === 'manual'
                    ? `<button class="btn btn-sm" style="color: var(--primary-color);" data-action="editExecutionNCR" data-arg1="${report.id}" data-arg2="${f._manualIdx}" title="Edit this finding" aria-label="Edit"><i class="fa-solid fa-edit"></i></button>`
                    : `<button class="btn btn-sm" style="color: #8b5cf6;" title="Open the checklist item that raised this" data-action="openNCRInChecklist" data-arg1="${esc(String(f.sourceChecklistId == null ? '' : f.sourceChecklistId))}" data-arg2="${esc(String(f.sourceItemIdx == null ? '' : f.sourceItemIdx))}" aria-label="Open in checklist"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
                }</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                                            No findings raised yet. Flag a question in the Checklist tab and classify it, or click "Add Finding".
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;
        }

        case 'capa': {
            // Corrective action lives in the NCR & CAPA register (window.state.ncrs),
            // the store the report, the Verify step and closure all read. This tab
            // shows that register for the audit — this audit's Major/Minor NCRs and
            // the previous audits' NCRs still to verify — and uses the register's own
            // + CAPA / Verify forms. The old "Create CAPA" here wrote report.capas,
            // which nothing else read: it never advanced or closed an NCR.
            const esc = _execEscText;
            const NM = window.NCRModule || {};
            const isMM = (n) => /^(major|minor)$/i.test(String((n && (n.severity || n.type)) || '').trim());
            const live = (n) => n && String(n.status || '') !== 'Withdrawn' && isMM(n);
            const clientKey = String(report.clientId || '');
            const clientName = String(report.client || '').trim().toLowerCase();
            const sameClient = (n) => (clientKey && String(n.clientId || '') === clientKey)
                || (clientName && String(n.clientName || n.client || '').trim().toLowerCase() === clientName);
            const isClosed = (n) => n.status === 'Closed' || n.carStatus === 'Closed' || n.carStatus === 'Effective';
            const registerNcrs = (window.state.ncrs || []).filter(live);
            const thisAudit = registerNcrs.filter(n => report.planId != null && String(n.auditId) === String(report.planId));
            // Previous audits' NCs: every open one, plus any closed by a review
            // made during this audit, so a reviewed finding stays in view
            // instead of dropping off the list the moment it is closed.
            const auditStart = String(report.date || '').slice(0, 10);
            const reviewedHere = (n) => !!(auditStart && n.verifiedDate && String(n.verifiedDate).slice(0, 10) >= auditStart);
            const previous = registerNcrs.filter(n => !thisAudit.includes(n) && sameClient(n) && (!isClosed(n) || reviewedHere(n)));
            const previousOpen = previous.filter(n => !isClosed(n)).length;
            const legacyCapas = report.capas || [];

            const rowHTML = (n, isPrevious) => {
                const ref = 'NCR-' + String(n.id).padStart(3, '0');
                const sev = String(n.severity || n.type || '').toLowerCase() === 'major' ? 'Major' : 'Minor';
                const overdue = typeof NM.isOverdue === 'function' ? NM.isOverdue(n) : false;
                const status = typeof NM.capaDisplayStatus === 'function' ? NM.capaDisplayStatus(n) : (n.carStatus || n.status || 'Open');
                const canAdd = n.status === 'Open' || n.carStatus === 'Ineffective' || n.carStatus === 'Reopened';
                const canVerify = (n.status === 'In Progress' || n.status === 'Verification') && !!n.capaImplementedDate;
                const clause = typeof NM.resolveClauseDisplay === 'function' ? NM.resolveClauseDisplay(n).text : (n.clause || '-');
                const audit = typeof NM.resolveAuditRef === 'function' ? NM.resolveAuditRef(n) : '';
                return `
                    <tr style="${overdue ? 'background: #fef2f2;' : ''}">
                        <td><strong>${esc(ref)}</strong><div style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">${esc(audit)}</div></td>
                        <td>${esc(clause)}</td>
                        <td><span style="background: ${sev === 'Major' ? '#dc2626' : '#d97706'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${sev}</span></td>
                        <td style="max-width: 260px; font-size: 0.85rem;">
                            <div><strong>Correction:</strong> ${esc(n.correction || '—')}</div>
                            <div><strong>Root cause:</strong> ${esc(n.rootCause || '—')}</div>
                            <div><strong>Corrective action:</strong> ${esc(n.correctiveAction || '—')}</div>
                        </td>
                        <td style="white-space: nowrap;">${n.dueDate ? esc(window.UTILS.formatDate ? window.UTILS.formatDate(n.dueDate) : n.dueDate) : '-'}${overdue ? '<br><span style="color: #dc2626; font-size: 0.75rem; font-weight: bold;">OVERDUE</span>' : ''}</td>
                        <td>${esc(status)}${n.capaImplementedDate ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">Implemented ${esc(n.capaImplementedDate)}</div>` : ''}</td>
                        <td style="white-space: nowrap;">
                            <button class="btn btn-sm btn-icon" data-action="viewNCRDetails" data-id="${esc(String(n.id))}" title="View details" aria-label="View"><i class="fa-solid fa-eye" style="color: var(--primary-color);"></i></button>
                            ${isPrevious ? `<button class="btn btn-sm btn-primary" style="margin-left: 0.25rem;" data-action="reviewPreviousNCR" data-id="${esc(String(n.id))}" title="Record what the organisation did, the evidence you saw and the outcome: closed, not effective or still open"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>${isClosed(n) ? 'Edit review' : 'Review'}</button>` : ''}
                            ${!isPrevious && canAdd ? `<button class="btn btn-sm" style="background: #10b981; color: white; margin-left: 0.25rem;" data-action="openAddCAPAModal" data-id="${esc(String(n.id))}" title="Record correction, root cause, corrective action and implementation"><i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>CAPA</button>` : ''}
                            ${!isPrevious && canVerify ? `<button class="btn btn-sm" style="background: #3b82f6; color: white; margin-left: 0.25rem;" data-action="verifyCAPA" data-id="${esc(String(n.id))}" title="Record verification and effectiveness; Effective closes the NCR"><i class="fa-solid fa-check"></i> Verify</button>` : ''}
                        </td>
                    </tr>`;
            };
            const tableHTML = (list, empty, isPrevious) => list.length ? `
                <div class="table-container">
                    <table>
                        <thead><tr><th>NCR #</th><th>Clause</th><th>Severity</th><th>CAPA</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>${list.map(n => rowHTML(n, isPrevious)).join('')}</tbody>
                    </table>
                </div>` : `<p style="color: var(--text-secondary); padding: 0.75rem 0;">${empty}</p>`;

            tabContent.innerHTML = `
                <div class="card" id="exec-capa-register">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0;">Corrective Actions (CAPA)</h3>
                        <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">
                            From the NCR & CAPA register. For a previous audit's nonconformity, <strong>Review</strong> records in one step what the organisation did, the evidence you saw and the outcome; the report's Previous Findings Status follows. For this audit's, <strong>+ CAPA</strong> records the organisation's correction, root cause, corrective action and implementation date; <strong>Verify</strong> then records how you verified it, and <em>Effective</em> closes the NCR. Observations and OFIs need no CAPA.
                        </p>
                    </div>

                    <h4 style="font-size: 1rem; margin: 1rem 0 0.5rem;">Previous audits — nonconformities to review (${previousOpen} open${previous.length > previousOpen ? `, ${previous.length - previousOpen} closed in this audit` : ''})</h4>
                    ${tableHTML(previous, 'No open nonconformities from previous audits.', true)}

                    <h4 style="font-size: 1rem; margin: 1.5rem 0 0.5rem;">This audit — nonconformities (${thisAudit.length})</h4>
                    ${tableHTML(thisAudit, 'No Major or Minor nonconformities raised in this audit yet. Flag a checklist question, classify it Major or Minor and click Save Progress; it appears here.')}

                    ${legacyCapas.length ? `
                    <h4 style="font-size: 1rem; margin: 1.5rem 0 0.5rem;">Earlier CAPA notes on this report (${legacyCapas.length})</h4>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.5rem;">Entered with the old Create CAPA button, which did not update the register. Copy anything still needed into the NCR's + CAPA.</p>
                    <div class="table-container"><table>
                        <thead><tr><th>Linked NCR</th><th>Root cause</th><th>Action plan</th><th>Due date</th><th>Status</th></tr></thead>
                        <tbody>${legacyCapas.map(c => `<tr><td>${esc(c.linkedNCR || '-')}</td><td>${esc(c.rootCause || '-')}</td><td>${esc(c.actionPlan || '-')}</td><td>${esc(c.dueDate || '-')}</td><td>${esc(c.status || '-')}</td></tr>`).join('')}</tbody>
                    </table></div>` : ''}
                </div>
            `;
            break;
        }

        case 'observations':
            // Redirect to Unified Review Tab
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab for unified reporting.</div>`;
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'review': {
            // UNIFIED DASHBOARD: MERGES REVIEW & SUMMARY
            // Auditor's Findings Review & Final Submission Screen
            const allFindings = [];
            // Cache evidence images for viewing from Review tab
            if (!window._evidenceCache) window._evidenceCache = {};

            // Destructure for lookup
            const { assignedChecklists = [] } = contextData;

            // Known bad values from old DOM scraping — filter these out
            const BAD_VALUES = ['severity', 'non-conformity details', 'personnel name', 'department', 'evidence image', 'upload', 'camera', 'screen'];
            const isBadValue = (v) => !v || BAD_VALUES.includes(v.toLowerCase().trim());

            // Collect checklist NCs — use original index into checklistProgress
            (report.checklistProgress || []).forEach((item, originalIdx) => {
                if (item.status !== 'nc') return;
                // Use shared helper for clause/requirement resolution
                let { clauseText, reqText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);

                // Fallback: use clause/requirement saved directly on the progress item
                // BUT only if the saved values are not corrupted (from old DOM scraping)
                if (!clauseText && item.clause && !isBadValue(item.clause)) clauseText = item.clause;
                if (!reqText && item.requirement && !isBadValue(item.requirement)) reqText = item.requirement;

                // KB Lookup: Get actual ISO Standard requirement text from Knowledge Base
                // From the finding's own standard on an integrated report.
                const kbMatch = (typeof window._kbRequirementFor === 'function')
                    ? window._kbRequirementFor({ clause: clauseText, criterionRef: item.criterionRef }, report.standard)
                    : window.KB_HELPERS.lookupKBRequirement(clauseText, report.standard);

                allFindings.push({
                    id: `checklist-${originalIdx}`,
                    source: 'Checklist',
                    // An NC with no classification yet is PENDING, not an observation.
                    // Defaulting it to 'observation' made the review select save it as
                    // one, silently dropping the finding out of the NC counts.
                    type: item.ncrType || window.CONSTANTS.NCR_TYPES.PENDING,
                    // Don't repeat reqText here — it's already shown in the requirement box above
                    description: item.ncrDescription || item.comment || item.transcript || '',
                    remarks: item.comment || item.transcript || '',
                    designation: item.designation || '',
                    department: item.department || '',
                    hasEvidence: !!(item.evidenceImage || (item.evidenceImages && item.evidenceImages.length)),
                    evidenceImage: item.evidenceImage,
                    evidenceImages: item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []),
                    clause: clauseText,
                    criterionRef: item.criterionRef || null,
                    // The checklist item, so the reference resolves to its
                    // register record (AuditFindingCategory.withRegisterRefs).
                    sourceChecklistId: item.checklistId == null ? null : item.checklistId,
                    sourceItemIdx: item.itemIdx == null ? null : item.itemIdx,
                    requirement: reqText && !isBadValue(reqText) ? reqText : '',
                    kbMatch: kbMatch
                });
                const evImgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                if (evImgs.length) window._evidenceCache[`checklist-${originalIdx}`] = evImgs;
            });

            // Collect manual NCRs
            (report.ncrs || []).forEach((ncr, idx) => {
                allFindings.push({
                    id: `ncr-${idx}`,
                    source: 'Manual',
                    type: ncr.type || 'observation',
                    description: ncr.description || '',
                    // For a manual NCR the remarks box edits its description (see the
                    // blur and save handlers), so it must start from the description —
                    // `remarks` is never written, and an empty box blanked it on save.
                    remarks: ncr.remarks || ncr.description || '',
                    designation: ncr.designation || '',
                    department: ncr.department || '',
                    hasEvidence: !!ncr.evidenceImage,
                    evidenceImage: ncr.evidenceImage
                });
                if (ncr.evidenceImage) window._evidenceCache[`ncr-${idx}`] = ncr.evidenceImage;
            });

            // Same references as the Findings tab (the register's NCR-091, OBS-001,
            // OFI-001), so a finding is called the same thing on both screens.
            const reviewRefById = {};
            window.AuditFindingCategory.withRegisterRefs(window.AuditFindingCategory.numberFindings([
                ...allFindings.filter(f => f.source === 'Manual'),
                ...allFindings.filter(f => f.source === 'Checklist')
            ]), report, (window.state && window.state.ncrs) || []).forEach(f => { reviewRefById[f.id] = f._ref; });

            const pendingFindings = allFindings.filter(f => f.type === window.CONSTANTS.NCR_TYPES.PENDING);
            const isReadyToSubmit = pendingFindings.length === 0;
            const notReadyReason = pendingFindings.length
                ? pendingFindings.length + ' finding(s) are still unclassified. Set each one to major, minor, observation or OFI before the report can be issued.'
                : '';
            const currentUserRole = window.state.currentUser?.role || 'Auditor';
            const finalizeRoles = ['Lead Auditor', 'Admin', 'Certification Manager'];
            const canOneClickFinalize = (typeof window.AuthManager?.hasRole === 'function')
                ? finalizeRoles.some(r => window.AuthManager.hasRole(r))
                : finalizeRoles.some(r => String(currentUserRole).toLowerCase() === r.toLowerCase());

            let primaryActionBtn;

            // Whether the report has actually been ISSUED, which is what decides
            // between offering issuance and offering the issued PDF.
            //
            // reportStatus is the issued flag; report.status is the broader
            // workflow state, and the two can disagree. A report that was
            // finalized and then reverted to draft kept report.status at
            // 'Finalized', so this screen went on offering "Download PDF" and
            // never rendered Finalize & Publish — while the preview's own toggle
            // refuses to act on a draft and points the auditor at that missing
            // button. The report became impossible to issue by any route.
            //
            // Records predating the reportStatus field carry no issued flag at
            // all, so those still fall back to the workflow state rather than
            // being offered re-issuance of a report that was already issued.
            const issuedFlag = String(report.reportStatus == null ? '' : report.reportStatus).trim().toLowerCase();
            const isIssued = issuedFlag
                ? issuedFlag === 'final'
                : (report.status === window.CONSTANTS.STATUS.FINALIZED || report.status === window.CONSTANTS.STATUS.PUBLISHED);

            if (isIssued) {
                primaryActionBtn = `
                    <button class="btn btn-secondary" data-action="generateAuditReport" data-id="${report.id}" aria-label="Export PDF">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Download PDF
                    </button>
                `;
            } else if (canOneClickFinalize) {
                primaryActionBtn = `
                    <button id="btn-finalize-publish" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);" data-action="finalizeAndPublish" data-id="${report.id}" ${!isReadyToSubmit ? 'disabled title="' + window.UTILS.escapeHtml(notReadyReason) + '"' : ''}>
                        <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Finalize & Publish
                    </button>
                `;
            } else {
                primaryActionBtn = `
                   <button class="btn" id="btn-submit-lead-auditor" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none;" data-action="submitToLeadAuditor" data-id="${report.id}" ${!isReadyToSubmit ? 'disabled title="' + window.UTILS.escapeHtml(notReadyReason) + '"' : ''} aria-label="Send">
                        <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit for Review
                    </button>
                `;
            }


            tabContent.innerHTML = `
                <div class="card" style="border-top: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.5rem; background: linear-gradient(90deg, #1e293b, #475569); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                <i class="fa-solid fa-flag-checkered" style="color: var(--primary-color); -webkit-text-fill-color: initial; margin-right: 0.5rem;"></i> Audit Finalization
                            </h3>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.95rem;">Review findings, generate AI summaries, and finalize the report.</p>
                            ${notReadyReason ? '<p style="margin: 0.5rem 0 0 0; color: #92400e; font-size: 0.9rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.4rem;"></i>' + window.UTILS.escapeHtml(notReadyReason) + '</p>' : ''}
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                             <button class="btn btn-outline-secondary" data-action="saveChecklist" data-id="${report.id}" aria-label="Save">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Draft
                            </button>
                            ${primaryActionBtn}
                        </div>
                    </div>

                    <!-- 1. High Level Stats -->
                     <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div id="review-stat-total" style="font-size: 2rem; font-weight: 800; color: #3b82f6; line-height: 1;">${allFindings.length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Total Findings</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fee2e2; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.05);">
                            <div id="review-stat-major" style="font-size: 2rem; font-weight: 800; color: #dc2626; line-height: 1;">${allFindings.filter(f => f.type === 'major').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Major NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fef3c7; box-shadow: 0 1px 3px rgba(217, 119, 6, 0.05);">
                            <div id="review-stat-minor" style="font-size: 2rem; font-weight: 800; color: #d97706; line-height: 1;">${allFindings.filter(f => f.type === 'minor').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Minor NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #f3e8ff; box-shadow: 0 1px 3px rgba(139, 92, 246, 0.05);">
                            <div id="review-stat-obsofi" style="font-size: 2rem; font-weight: 800; color: #8b5cf6; line-height: 1;">${allFindings.filter(f => f.type === 'observation' || f.type === 'ofi').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">OBS / OFI</div>
                        </div>
                    </div>

                    <!-- Report Integrity -->
                    <div class="card" id="report-integrity-card" style="margin-bottom: 2rem; border: 1px solid #e2e8f0; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">
                                <i class="fa-solid fa-shield-halved" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Report Integrity
                            </h4>
                            <button class="btn btn-sm btn-outline-secondary" data-action="runReportIntegrityCheck" data-id="${report.id}" aria-label="Run check">
                                <i class="fa-solid fa-magnifying-glass-chart" style="margin-right: 0.5rem;"></i> Run Report Integrity Check
                            </button>
                        </div>
                        <div id="report-integrity-results">
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Not yet run for this session.</p>
                        </div>
                        <!-- Technical Review QA (client spec #31) — filled by the same
                             runReportIntegrityCheck run, alongside the panel above. -->
                        <div id="report-integrity-qa-panel"></div>
                    </div>

                    <!-- 2. Findings Review -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Findings & Classification</h4>
                        </div>

                         ${allFindings.length > 0 ? `
                        <div style="max-height: 600px; overflow-y: auto; padding-right: 5px;">
                            ${allFindings.map((f, idx) => `
                                <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; border-left: 5px solid ${f.type === 'major' ? '#dc2626' : f.type === 'minor' ? '#d97706' : '#8b5cf6'}; transition: transform 0.2s;">
                                    <div style="display: grid; grid-template-columns: 1fr 180px 250px; gap: 1.5rem; align-items: start;">
                                        <!-- Finding Details Column -->
                                        <div>
                                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                                <span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${_execEscText(f.source)}</span>
                                                <span style="font-weight: 700; color: #1e293b;">${_execEscText(reviewRefById[f.id] || '#' + (idx + 1))}</span>
                                                ${f.hasEvidence ? `<span data-action="viewEvidenceImageDirect" data-id="${f.id}" style="cursor: pointer; color: var(--primary-color); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-image"></i> View Evidence</span>` : ''}
                                            </div>
                                            ${f.clause || f.requirement ? `
                                                <div style="font-size: 0.85rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.75rem;">
                                                    <strong style="color: var(--primary-color);">${f.clause ? `${_execEscText(f.clause)}` : 'Requirement'}:</strong> 
                                                    <span style="color: #334155;">${_execEscText(f.requirement || '')}</span>
                                                </div>
                                            ` : ''}
                                            ${f.kbMatch ? `
                                                <div style="font-size: 0.8rem; padding: 0.5rem 0.75rem; background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 6px; border-left: 3px solid #3b82f6; margin-bottom: 0.75rem; color: #1e40af;">
                                                    <strong><i class="fa-solid fa-book" style="margin-right: 4px;"></i>${_execEscText(f.kbMatch.standardName || 'ISO Standard')} — Clause ${_execEscText(f.kbMatch.clause)}${f.kbMatch.title ? ': ' + _execEscText(f.kbMatch.title) : ''}</strong>
                                                    <div style="margin-top: 4px; color: #334155; font-style: italic; line-height: 1.5;">${_execEscText(f.kbMatch.requirement)}</div>
                                                </div>
                                            ` : ''}
                                            <div style="font-weight: 500; color: #334155; line-height: 1.5; margin-bottom: 0.5rem;">${_execEscText(f.description)}</div>
                                            ${f.designation || f.department ? `
                                                <div style="font-size: 0.8rem; color: #64748b; display: flex; gap: 1rem;">
                                                    <span><i class="fa-solid fa-user" style="width: 14px;"></i> ${_execEscText(f.designation || '-')}</span> 
                                                    <span><i class="fa-solid fa-building" style="width: 14px;"></i> ${_execEscText(f.department || '-')}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <!--Severity Column-->
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Severity Classification</label>
                                            <select class="form-control form-control-sm review-severity" data-finding-id="${f.id}" style="font-size: 0.9rem; padding: 0.4rem;">
                                                <option value="${window.CONSTANTS.NCR_TYPES.PENDING}" ${f.type === window.CONSTANTS.NCR_TYPES.PENDING ? 'selected' : ''}>— Select classification —</option>
                                                <option value="observation" ${f.type === 'observation' ? 'selected' : ''}>Observation (OBS)</option>
                                                <option value="ofi" ${f.type === 'ofi' ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                                                <option value="minor" ${f.type === 'minor' ? 'selected' : ''}>Minor NC</option>
                                                <option value="major" ${f.type === 'major' ? 'selected' : ''}>Major NC</option>
                                            </select>
                                        </div>
                                        <!--Remarks Column-->
            <!-- This box is not a private remark: for a checklist finding it edits the
                 item's checklist note, for a manual one the finding's description, and
                 both print in the report, the completed checklist and the findings
                 summary. The label says which, so nobody types a private remark here. -->
            ${(() => {
                const isManual = f.source === 'Manual';
                const lbl = isManual ? 'Finding description' : 'Checklist note';
                const hint = isManual
                    ? 'This is the finding text. It prints in the report and the findings summary.'
                    : 'This is the checklist item’s note. It prints in the report, the completed checklist and the findings summary.';
                const ph = isManual ? 'Describe the finding as it will appear in the report...' : 'Evidence seen, as it will appear in the report...';
                return `<div>
                <label for="review-remarks-${_execEscText(f.id)}" class="review-remarks-label" style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">${lbl} <span style="font-weight: 400;">(prints in report)</span></label>
                <textarea id="review-remarks-${_execEscText(f.id)}" class="form-control form-control-sm review-remarks" data-finding-id="${f.id}" placeholder="${ph}" title="${hint}" rows="3" style="font-size: 0.85rem;">${_execEscText(f.remarks || '')}</textarea>
            </div>`;
            })()}

                                    </div >
                                </div >
                `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0;">
                            <div style="width: 64px; height: 64px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; font-size: 2rem;">
                                <i class="fa-solid fa-check"></i>
                            </div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.2rem;">Detailed Audit Complete!</h4>
                            <p style="color: #64748b; margin: 0; max-width: 400px; margin: 0 auto;">No non-conformities were raised during this audit. You can proceed to generate the summary confirming full compliance.</p>
                        </div>
                    `}
                    </div>

                    <!-- 3. Executive Summary Generation -->
                    <div style="background: linear-gradient(to right, #f8fafc, #f1f5f9); padding: 2rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">
                                <i class="fa-solid fa-pen-nib" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Executive Summary & Reporting
                            </h4>
                             <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: none;" data-action="runAutoSummary" data-id="${report.id}" aria-label="AI assist">
                                <i class="fa-solid fa-robot" style="margin-right: 0.5rem;"></i> AI Draft Summary
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                             <!-- Executive Summary -->
                             <div>
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Executive Summary</label>
                                <textarea id="exec-summary-${report.id}" class="form-control" rows="5" placeholder="Overall conclusion on the effectiveness of the management system...">${_execEscText(report.executiveSummary || '')}</textarea>
                             </div>
                        </div>

                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Positive Observations</h4>
                                <textarea id="positive-observations" class="form-control" rows="4" placeholder="Document good practices and positive findings...">${_execEscText(report.positiveObservations || '')}</textarea>
                            </div>
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Opportunities for Improvement</h4>
                                <textarea id="ofi" class="form-control" rows="4" placeholder="Suggestions for improvement (not non-conformities)...">${_execEscText(report.ofi || '')}</textarea>
                            </div>
                        </div>
                        

                        <!-- Meeting Records Summary (from Meetings Tab) -->
                        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.95rem; margin: 0; color: var(--text-secondary); text-transform: uppercase;">Meeting Records</h4>
                                <button class="btn btn-sm btn-outline-primary" data-action="clickTab" data-id="meetings" aria-label="Edit">
                                    <i class="fa-solid fa-pen" style="margin-right: 0.25rem;"></i>Edit in Meetings Tab
                                </button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #2563eb;"><i class="fa-solid fa-door-open" style="margin-right: 0.25rem;"></i>Opening Meeting</label>
                                    ${report.openingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${_execEscText(report.openingMeeting.date)} ${_execEscText(report.openingMeeting.time || '')}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.openingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${_execEscText(a.name)}${a.role ? ' - ' + _execEscText(a.role) : ''}${a.organization ? ' (' + _execEscText(a.organization) + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${_execEscText(a)}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${_execEscText(att)}</div>`; })()}
                                </div>
                                <div style="background: #fff7ed; padding: 1rem; border-radius: 8px; border: 1px dashed #fdba74;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #ea580c;"><i class="fa-solid fa-door-closed" style="margin-right: 0.25rem;"></i>Closing Meeting</label>
                                    ${report.closingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${_execEscText(report.closingMeeting.date)} ${_execEscText(report.closingMeeting.time || '')}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.closingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${_execEscText(a.name)}${a.role ? ' - ' + _execEscText(a.role) : ''}${a.organization ? ' (' + _execEscText(a.organization) + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${_execEscText(a)}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${_execEscText(att)}</div>`; })()}
                                </div>
                            </div>
                        </div>

                        <!-- Audit Conclusion / Recommendation -->
                             <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Audit Conclusion & Recommendation</label>
                                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Recommended" ${report.recommendation === 'Recommended' ? 'checked' : ''} data-action-change="setReportRecommendation" data-arg1="this" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Recommended for Certification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Pending" ${report.recommendation === 'Pending' ? 'checked' : ''} data-action-change="setReportRecommendation" data-arg1="this" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Recommended Pending Plan Verification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Not Recommended" ${report.recommendation === 'Not Recommended' ? 'checked' : ''} data-action-change="setReportRecommendation" data-arg1="this" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Not Recommended (Major NCs)</span>
                                    </label>
                                </div>
                             </div>
                    </div>

                </div>
            `;

            // Auto-save severity changes and update stats in real-time
            setTimeout(() => {
                document.querySelectorAll('.review-severity').forEach(select => {
                    select.addEventListener('change', function () {
                        const findingId = this.dataset.findingId;
                        const newType = this.value;

                        // Update data model immediately
                        if (findingId.startsWith('checklist-')) {
                            const idx = parseInt(findingId.replace('checklist-', ''), 10);
                            if (report.checklistProgress && report.checklistProgress[idx]) {
                                report.checklistProgress[idx].ncrType = newType;
                            }
                        } else if (findingId.startsWith('ncr-')) {
                            const idx = parseInt(findingId.replace('ncr-', ''), 10);
                            if (report.ncrs && report.ncrs[idx]) {
                                report.ncrs[idx].type = newType;
                            }
                        }

                        // Update card border color
                        const card = this.closest('.card');
                        if (card) {
                            const colors = window.CONSTANTS.NCR_COLORS;
                            card.style.borderLeftColor = colors[newType] || '#8b5cf6';
                        }

                        // Update stat counters (by id: a style-selector lookup picked
                        // the wrong elements whenever the layout above changed)
                        const allSelects = document.querySelectorAll('.review-severity');
                        let majors = 0, minors = 0, obs = 0, ofis = 0, pending = 0;
                        allSelects.forEach(s => {
                            if (s.value === 'major') majors++;
                            else if (s.value === 'minor') minors++;
                            else if (s.value === 'observation') obs++;
                            else if (s.value === 'ofi') ofis++;
                            else pending++;
                        });
                        const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
                        setStat('review-stat-total', allSelects.length);
                        setStat('review-stat-major', majors);
                        setStat('review-stat-minor', minors);
                        setStat('review-stat-obsofi', obs + ofis);

                        // Finalize / Submit were enabled or disabled only when the tab
                        // was drawn, so classifying the last pending finding left them
                        // disabled until the tab was reopened.
                        ['btn-finalize-publish', 'btn-submit-lead-auditor'].forEach(id => {
                            const btn = document.getElementById(id);
                            if (!btn) return;
                            btn.disabled = pending > 0;
                            if (pending > 0) btn.title = pending + ' finding(s) are still unclassified. Set each one to major, minor, observation or OFI before the report can be issued.';
                            else btn.removeAttribute('title');
                        });

                        // Save to the cloud and the NCR register, not just this browser:
                        // saveData() is local only, so a classification made here did
                        // not reach the database or create/update the register record
                        // until the next Save Progress on the Checklist tab.
                        if (typeof window.saveChecklist === 'function') window.saveChecklist(report.id);
                        else window.saveData();
                        window.showNotification('Classification saved', 'success');
                    });
                });

                // Auto-save remarks on blur
                document.querySelectorAll('.review-remarks').forEach(textarea => {
                    textarea.addEventListener('blur', function () {
                        // Leaving the box without editing it must not write the
                        // text as drawn over a remark changed elsewhere since.
                        if (this.value === this.defaultValue) return;
                        const findingId = this.dataset.findingId;
                        const remarks = this.value;
                        this.defaultValue = remarks;

                        if (findingId.startsWith('checklist-')) {
                            const idx = parseInt(findingId.replace('checklist-', ''), 10);
                            if (report.checklistProgress && report.checklistProgress[idx]) {
                                report.checklistProgress[idx].comment = remarks;
                            }
                        } else if (findingId.startsWith('ncr-')) {
                            const idx = parseInt(findingId.replace('ncr-', ''), 10);
                            if (report.ncrs && report.ncrs[idx] && remarks) {
                                report.ncrs[idx].description = remarks;
                            }
                        }
                        if (typeof window.saveChecklist === 'function') window.saveChecklist(report.id);
                        else window.saveData();
                    });
                });

                // Auto-run the Report Integrity check when this tab renders — silent
                // (no spinner/error UI) since it's a background convenience, not a
                // user-initiated action; the button re-runs it visibly on demand.
                if (typeof window.runReportIntegrityCheck === 'function') {
                    window.runReportIntegrityCheck(report.id, { silent: true });
                }
            }, 100);
        }
            break;

        case 'summary':
            // LEGACY: Redirect to Finalization or Show Simplified View
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab.</div>`;
            // Auto switch
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'meetings': {
            // ISO 17021-1 Opening/Closing Meeting Records
            const openingMeeting = report.openingMeeting || {};
            const closingMeeting = report.closingMeeting || {};
            // Build attendee picker data
            const { auditTeam: mAuditTeam = [], clientPersonnel: mClientPersonnel = [], clientData: mClientData = null } = contextData;
            const cbName = window.state.settings?.orgName || window.state.settings?.cbName || 'CB';
            const clientOrgName = mClientData?.name || report.client || 'Client';
            // Parse existing attendees to check who's already selected
            const parseExisting = (att) => {
                if (!att) return [];
                if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? a.name : a);
                return att.split('\n').map(l => l.split('-')[0].trim()).filter(Boolean);
            };
            const existingOpeningNames = parseExisting(openingMeeting.attendees);
            const existingClosingNames = parseExisting(closingMeeting.attendees);

            // Defaults for a meeting not yet recorded come from the audit plan's own
            // opening/closing rows (date and start time), not a fixed 09:00 / 17:00.
            const mPlan = contextData.plan || (window.state.auditPlans || []).find(p => String(p.id) === String(report.planId)) || null;
            const planRow = (kind) => ((mPlan && mPlan.agenda) || []).find(r => r && r.kind === kind) || null;
            const openRow = planRow('opening');
            const closeRow = planRow('closing');
            const openingDate = openingMeeting.date || (openRow && openRow.date) || report.date || '';
            const openingTime = openingMeeting.time || (openRow && openRow.start) || '09:00';
            const closingDate = closingMeeting.date || (closeRow && closeRow.date) || '';
            const closingTime = closingMeeting.time || (closeRow && closeRow.start) || '17:00';

            // Corrective-action timelines as the report states them: day counts only
            // when the CB has configured them, otherwise the CB's own procedure.
            const mTf = window.ReportStats && typeof window.ReportStats.capaTimeframes === 'function'
                ? window.ReportStats.capaTimeframes({ settings: window.state.cbSettings || {}, standard: report.standard || (mPlan && mPlan.standard) || '', stage: (mPlan && mPlan.auditType) || report.auditType || '' })
                : null;
            const capaTimelineLabel = mTf && mTf.configured
                ? `Corrective action timelines (Major: ${mTf.major} days, Minor: ${mTf.minor} days)`
                : 'Corrective action timelines and evidence required (per the CB procedure)';

            // Attendees added by hand (not on the audit team or the client's
            // personnel list) are shown again in the added list, so a later save
            // keeps them instead of silently dropping them.
            const knownNames = new Set([...mAuditTeam, ...mClientPersonnel].map(p => p && p.name).filter(Boolean));
            const customAttendeesHTML = (att) => (Array.isArray(att) ? att : [])
                .filter(a => a && typeof a === 'object' && a.name && !knownNames.has(a.name))
                .map(a => window._customAttendeeItemHTML(a.name, a.role || '', a.organization || ''))
                .join('');

            // "Select all" for a list of meeting checkboxes; its target is a CSS
            // selector for the list's own checkboxes. Its ticked state follows the
            // list (window.syncMeetingSelectAll after render and on every change).
            const selectAllHTML = (target) => `<label style="margin-left: auto; display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; font-weight: 500; color: #475569; text-transform: none; letter-spacing: 0; cursor: pointer;"><input type="checkbox" class="meeting-select-all" data-target="${target}" data-action-change="toggleMeetingSelectAll" style="width: 14px; height: 14px;">Select all</label>`;

            const buildAttendeeSection = (prefix, existingNames) => {
                let html = '<div style="margin-bottom: 0.75rem;">';
                if (prefix === 'closing') {
                    html += '<button type="button" class="btn btn-sm btn-outline-secondary" data-action="copyOpeningAttendeesToClosing" style="margin-bottom: 0.5rem; font-size: 0.75rem;" title="Tick the same people as the opening meeting"><i class="fa-solid fa-copy" style="margin-right: 0.3rem;"></i>Same as opening</button>';
                }
                // Audit Team section
                if (mAuditTeam.length > 0) {
                    html += `<div style="margin-bottom: 0.5rem;"><div style="display: flex; align-items: center; font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.35rem;"><i class="fa-solid fa-user-shield" style="margin-right: 0.25rem;"></i>Audit Team${selectAllHTML(`.${prefix}-attendee-cb[data-group='team']`)}</div>`;
                    mAuditTeam.forEach(a => {
                        const checked = existingNames.includes(a.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; cursor: pointer; font-size: 0.82rem;">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-group="team" data-name="${(a.name || '').replace(/"/g, '&quot;')}" data-role="${(a.role || '').replace(/"/g, '&quot;')}" data-org="${cbName.replace(/"/g, '&quot;')}" ${checked} style="width: 15px; height: 15px; flex-shrink: 0;">`;
                        html += `<span style="font-weight: 500;">${_execEscText(a.name)}</span><span style="color: #64748b; font-size: 0.78rem; white-space: nowrap;">– ${_execEscText(a.role)}</span>`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Client Personnel section
                if (mClientPersonnel.length > 0) {
                    html += `<div style="margin-bottom: 0.5rem;"><div style="display: flex; align-items: center; font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.35rem;"><i class="fa-solid fa-building" style="margin-right: 0.25rem;"></i>Client Personnel${selectAllHTML(`.${prefix}-attendee-cb[data-group='client']`)}</div>`;
                    mClientPersonnel.forEach(p => {
                        const checked = existingNames.includes(p.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; cursor: pointer; font-size: 0.82rem;">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-group="client" data-name="${(p.name || '').replace(/"/g, '&quot;')}" data-role="${(p.role || '').replace(/"/g, '&quot;')}" data-org="${clientOrgName.replace(/"/g, '&quot;')}" ${checked} style="width: 15px; height: 15px; flex-shrink: 0;">`;
                        html += `<span style="font-weight: 500;">${_execEscText(p.name)}</span>${p.role ? `<span style="color: #64748b; font-size: 0.78rem; white-space: nowrap;">– ${_execEscText(p.role)}</span>` : ''}`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Custom add
                html += `<div style="margin-top: 0.4rem; display: flex; gap: 0.35rem;">`;
                html += `<input type="text" id="${prefix}-custom-name" class="form-control form-control-sm" placeholder="Name" style="flex: 2; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<input type="text" id="${prefix}-custom-role" class="form-control form-control-sm" placeholder="Role" style="flex: 1.5; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<input type="text" id="${prefix}-custom-org" class="form-control form-control-sm" placeholder="Organization" style="flex: 1.5; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<button class="btn btn-sm btn-outline-primary" data-action="addCustomMeetingAttendee" data-id="${prefix}" style="padding: 0.25rem 0.5rem;" aria-label="Add"><i class="fa-solid fa-plus"></i></button>`;
                html += '</div>';
                // Custom attendees list
                html += `<div id="${prefix}-custom-list" style="margin-top: 0.35rem;">${customAttendeesHTML(prefix === 'opening' ? openingMeeting.attendees : closingMeeting.attendees)}</div>`;
                html += '</div>';
                return html;
            };

            tabContent.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
                    <!-- Opening Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #16a34a; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #16a34a;">
                            <i class="fa-solid fa-door-open" style="margin-right: 0.5rem;"></i>Opening Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="opening-date" class="form-control" value="${_execEscText(openingDate)}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="opening-time" class="form-control" value="${_execEscText(openingTime)}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('opening', existingOpeningNames)}
                        </div>
                        <div class="form-group">
                            <label>Meeting Notes</label>
                            <textarea id="opening-notes" class="form-control" rows="3" placeholder="Key points discussed, scope confirmed, agenda presented...">${_execEscText(openingMeeting.notes || '')}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" data-action="toggleNextHidden">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #166534; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Opening Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #166534; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
                                <div style="display: flex; padding: 0 0.25rem;">${selectAllHTML('.opening-pointer')}</div>
                                ${[
                    { id: 'op-scope', label: 'Introduction of audit team & confirmation of audit scope' },
                    { id: 'op-methodology', label: 'Audit plan, methodology & sampling approach' },
                    { id: 'op-ncr-grading', label: 'Finding grading criteria (Major / Minor NC, observation, OFI)' },
                    { id: 'op-remote-evidence', label: 'Evidence collection method (photos, screen-shares for remote audits)' },
                    { id: 'op-process-flow', label: 'Process flow & department visit sequence' },
                    { id: 'op-confidentiality', label: 'Confidentiality & impartiality declaration' },
                    { id: 'op-communication', label: 'Communication arrangements & guide/escort' },
                    { id: 'op-schedule', label: 'Daily schedule, breaks & logistics' },
                    { id: 'op-prev-findings', label: 'Status of previous audit findings & CAPAs' }
                ].map(p => '<label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.75rem; background: white; border-radius: 6px; border: 1px solid #dcfce7; text-align: left;"><input type="checkbox" class="opening-pointer" data-key="' + p.id + '" ' + ((openingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="accent-color: #16a34a; flex-shrink: 0; width: 16px; height: 16px;"><span style="flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Closing Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #dc2626; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #dc2626;">
                            <i class="fa-solid fa-door-closed" style="margin-right: 0.5rem;"></i>Closing Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="closing-date" class="form-control" value="${_execEscText(closingDate)}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="closing-time" class="form-control" value="${_execEscText(closingTime)}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('closing', existingClosingNames)}
                        </div>
                        <div class="form-group">
                            <label>Findings Summary Presented</label>
                            <textarea id="closing-summary" class="form-control" rows="2" placeholder="Summary of findings as presented to client...">${_execEscText(closingMeeting.summary || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Client Response/Agreement</label>
                            <textarea id="closing-response" class="form-control" rows="2" placeholder="Client's response to findings...">${_execEscText(closingMeeting.response || '')}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" data-action="toggleNextHidden">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #991b1b; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Closing Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #991b1b; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
                                <div style="display: flex; padding: 0 0.25rem;">${selectAllHTML('.closing-pointer')}</div>
                                ${[
                    { id: 'cl-findings', label: 'Presentation of audit findings (Major / Minor NCs, observations, OFIs)' },
                    { id: 'cl-ncr-severity', label: 'Nonconformity severity & implications for certification' },
                    { id: 'cl-capa-timelines', label: capaTimelineLabel },
                    { id: 'cl-positive', label: 'Positive observations & good practices noted' },
                    { id: 'cl-recommendation', label: 'Audit recommendation (grant / maintain / suspend / withdraw)' },
                    { id: 'cl-appeals', label: 'Appeals & complaints process' },
                    { id: 'cl-followup', label: 'Follow-up / surveillance audit schedule' },
                    { id: 'cl-remote-evidence', label: 'Remote evidence sufficiency confirmation (if applicable)' },
                    { id: 'cl-cert-scope', label: 'Certification scope, mark usage & public information' }
                ].map(p => '<label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.75rem; background: white; border-radius: 6px; border: 1px solid #fecaca; text-align: left;"><input type="checkbox" class="closing-pointer" data-key="' + p.id + '" ' + ((closingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="accent-color: #dc2626; flex-shrink: 0; width: 16px; height: 16px;"><span style="flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button class="btn btn-primary" data-action="saveMeetingRecords" data-id="${report.id}" aria-label="Save">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>Save Meeting Records
                    </button>
                </div>
                
                <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                        <strong>ISO 17021-1 Requirement:</strong> Maintain records of opening and closing meetings including attendees and key discussions (Clause 9.4.7).
                    </p>
                </div>
            `;
            window.syncMeetingSelectAll();
            if (!tabContent._meetingSelectAllBound) {
                tabContent._meetingSelectAllBound = true;
                tabContent.addEventListener('change', function (e) {
                    if (e.target && e.target.type === 'checkbox' && !e.target.classList.contains('meeting-select-all')) window.syncMeetingSelectAll();
                });
            }
            break;
        }
    }

    // Helper functions for execution module
    // (window.toggleAccordion — section id or header element — is defined
    // once, in csp-adapters.js.)

    // Collapse/Expand ALL accordion sections at once
    // The action is read from the sections, not from the button's own label:
    // any section closed → Expand All, all open → Collapse All. The label used
    // to start as "Collapse All" while only the first section was open, and a
    // section opened or closed by hand left it stale. Only the clause sections
    // open and close; what is inside an item (an NC's Finding Details panel,
    // evidence) is hidden with its section and comes back as it was. Collapse
    // All used to set every NC panel to display:none, so Expand All brought
    // the sections back with each NC's severity and statement gone.
    const execSections = () => Array.from(document.querySelectorAll('.accordion-section > .accordion-content'));

    window.syncToggleAllAccordions = function () {
        const btn = document.getElementById('toggle-all-accordions');
        if (!btn) return;
        const sections = execSections();
        const expand = sections.some(s => s.style.display === 'none');
        const icon = btn.querySelector('i');
        const label = btn.querySelector('span');
        if (icon) icon.className = expand ? 'fa-solid fa-expand-alt' : 'fa-solid fa-compress-alt';
        if (label) label.textContent = expand ? 'Expand All' : 'Collapse All';
        btn.title = expand ? 'Expand all sections' : 'Collapse all sections';
    };

    window.toggleAllAccordions = function () {
        const sections = execSections();
        const shouldExpand = sections.some(s => s.style.display === 'none');
        sections.forEach(content => {
            content.style.display = shouldExpand ? 'block' : 'none';
            const icon = document.getElementById('icon-' + content.id);
            if (icon) icon.style.transform = shouldExpand ? 'rotate(180deg)' : 'rotate(0deg)';
        });
        window.syncToggleAllAccordions();
    };

    // Drag-to-reorder clause sections (data-safe: only changes DOM order, not progress keys)
    window.initClauseDragReorder = function () {
        let draggedSection = null;
        document.querySelectorAll('.accordion-section[data-clause-id]').forEach(section => {
            const handle = section.querySelector('.clause-drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', () => { section.draggable = true; });
            section.addEventListener('mouseup', () => { section.draggable = false; });

            section.addEventListener('dragstart', (e) => {
                if (!section.draggable) { e.preventDefault(); return; }
                draggedSection = section;
                section.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            section.addEventListener('dragend', () => {
                section.draggable = false;
                draggedSection = null;
                section.style.opacity = '1';
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!draggedSection || section === draggedSection) return;
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });
                const rect = section.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    section.style.borderTop = '3px solid #2563eb';
                } else {
                    section.style.borderBottom = '3px solid #2563eb';
                }
            });

            section.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedSection || section === draggedSection) return;
                const parent = section.parentNode;
                const rect = section.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    parent.insertBefore(draggedSection, section);
                } else {
                    parent.insertBefore(draggedSection, section.nextElementSibling);
                }
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });

                // Persist the new clause order
                const newOrder = Array.from(document.querySelectorAll('.accordion-section[data-clause-id]'))
                    .map(s => s.getAttribute('data-clause-id'));
                // Find report from current execution context
                const reportId = document.querySelector('[data-report-id]')?.getAttribute('data-report-id')
                    || document.querySelector('.bulk-action-btn[data-report-id]')?.getAttribute('data-report-id');
                if (reportId) {
                    const report = window.state.auditReports?.find(r => String(r.id) === String(reportId));
                    if (report) {
                        report.clauseOrder = newOrder;
                        window.saveData();
                    }
                }
            });
        });
    };

    window.toggleSectionSelection = function (sectionId, checkbox) {
        window.Logger.debug('Execution', 'toggleSectionSelection called for:', sectionId);
        const section = document.getElementById(sectionId);
        if (!section) {
            window.Logger.error('Execution', 'Section not found: ' + sectionId);
            return;
        }

        // Use passed checkbox or find it
        const box = checkbox || document.querySelector(`.section-checkbox[data-section-id="${sectionId}"]`);
        const isChecked = box ? box.checked : false;

        window.Logger.debug('Execution', 'Checkbox is checked:', isChecked);

        // Toggle items in this section
        let _count = 0;
        const items = section.querySelectorAll('.checklist-item');
        window.Logger.debug('Execution', 'Found items:', items.length);
        items.forEach(item => {
            if (isChecked) {
                item.classList.add('selected-item');
                item.style.background = '#eff6ff'; // Light blue highlight
                item.style.borderLeft = '4px solid var(--primary-color)';
                _count++;
            } else {
                item.classList.remove('selected-item');
                item.style.background = ''; // Reset
                item.style.borderLeft = '4px solid #e2e8f0'; // Reset
            }
        });

        // Optional: Update UI or show brief feedback
        // window.showNotification(isChecked ? `Selected ${count} items` : 'Selection cleared', 'info');
    };

    window.setChecklistStatus = function (uniqueId, status) {
        window.Logger.debug('Execution', 'setChecklistStatus called:', { uniqueId, status });

        const row = document.getElementById('row-' + uniqueId);
        if (!row) {
            window.Logger.error('Execution', 'Row not found: row-' + uniqueId);
            return;
        }

        // Update buttons
        row.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));

        let activeBtnClass = '';
        if (status === window.CONSTANTS.STATUS.CONFORM) activeBtnClass = '.btn-ok';
        else if (status === window.CONSTANTS.STATUS.NC) activeBtnClass = '.btn-nc';
        else if (status === window.CONSTANTS.STATUS.NA) activeBtnClass = '.btn-na';
        else if (status === (window.CONSTANTS.STATUS.NOT_SAMPLED || 'not_sampled')) activeBtnClass = '.btn-ns';

        if (activeBtnClass) row.querySelector(activeBtnClass)?.classList.add('active');

        // Show/Hide NCR Panel
        const panelId = 'ncr-panel-' + uniqueId;
        const panel = document.getElementById(panelId);
        window.Logger.debug('Execution', 'Looking for panel:', { panelId, found: !!panel });

        if (panel) {
            if (status === window.CONSTANTS.STATUS.NC) {
                panel.style.display = 'block';
                window.Logger.debug('Execution', 'NCR Panel shown for:', uniqueId);
            } else {
                panel.style.display = 'none';
            }
        } else {
            window.Logger.error('Execution', 'NCR Panel not found: ' + panelId);
        }

        // Update hidden input
        const statusInput = document.getElementById('status-' + uniqueId);
        if (statusInput) {
            statusInput.value = status;
        }

        // Update accordion counter dynamically
        window.updateAccordionCounter(uniqueId);
        if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();
    };

    // Update accordion counter based on current statuses
    window.updateAccordionCounter = function (changedId) {
        // Find the section containing this item
        const row = document.getElementById('row-' + changedId);
        if (!row) return;

        const accordionContent = row.closest('.accordion-content');
        if (!accordionContent) return;

        const _sectionId = accordionContent.id;
        const items = accordionContent.querySelectorAll('.checklist-item');
        let completed = 0;

        items.forEach(item => {
            const itemId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + itemId);
            const status = statusInput?.value || '';
            if (status === 'conform' || status === 'nc' || status === 'na' || status === 'not_sampled') {
                completed++;
            }
        });

        // Update the counter text in the accordion header
        const accordionSection = accordionContent.closest('.accordion-section');
        if (accordionSection) {
            const counterSpan = accordionSection.querySelector('.accordion-header span[style*="text-secondary"]');
            if (counterSpan && counterSpan.textContent.includes('/')) {
                counterSpan.textContent = `${completed}/${items.length}`;
            }
        }
    };

    window.addCustomQuestion = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        window.DataService.openFormModal('Add Custom Question', `
        <form id="custom-question-form">
            <div class="form-group">
                <label>Clause Number/Title <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="custom-clause" placeholder="e.g. New 1.1 or Additional" required>
            </div>
            <div class="form-group">
                <label>Requirement / Question <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="custom-req" rows="3" placeholder="Enter the audit question or requirement..." required></textarea>
            </div>
        </form>
    `, () => {
            const clause = document.getElementById('custom-clause').value;
            const req = document.getElementById('custom-req').value;

            if (clause && req) {
                if (!report.customItems) report.customItems = [];
                report.customItems.push({ clause, requirement: req });

                window.saveData();
                window.closeModal();
                window.renderExecutionDetail(reportId);
                window.showNotification('Custom question added successfully');
            } else {
                window.showNotification('Please fill in both fields', 'error');
            }
        });
    };

    // Report-time copies built from an answer's screenshots; a save never keeps them.
    const DERIVED_EVIDENCE_KEYS = new Set(['evidenceThumbs', 'evidenceImageThumb', '_evIds', '_origEvKeys', 'kbMatch']);
    // A Review & Submit classification picked since the tab was drawn.
    function reviewSelectChanged(select) {
        const opts = Array.from((select && select.options) || []);
        if (!opts.some(o => o.defaultSelected)) return true; // drawn with no classification: keep the old behaviour
        return opts.some(o => o.selected !== o.defaultSelected);
    }
    window.saveChecklist = function (reportId, opts) {
        const quiet = !!(opts && opts.quiet);
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Show indicator immediately
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = 'Saving Changes...';
            indicator.style.display = 'block';
            indicator.style.background = '#3b82f6'; // Blue for loading
        }

        const statusInputs = document.querySelectorAll('.status-input');
        let checklistData = [];
        // Stale-view guard (window.ChecklistMerge): what this view was drawn
        // from, the questions as on screen, and how many revisions this tab knew.
        let domData = null;
        let baseUsed = null;
        let knownRevs = 0;
        let mergedKept = -1;
        let offScreen = false;

        // Only update checklistProgress if we are on a screen that has checklist inputs
        if (statusInputs.length > 0) {
            statusInputs.forEach(input => {
                const uniqueId = input.id.replace('status-', '');

                const status = input.value;
                const comment = Sanitizer.sanitizeText(document.getElementById('comment-' + uniqueId)?.value || '');
                // The NC statement box is in the Finding Details panel; the transcript
                // box is not rendered. When an input is absent the value is null and
                // the previously saved text is carried forward below, instead of the
                // save blanking it.
                const ncrDescEl = document.getElementById('ncr-desc-' + uniqueId);
                const transcriptEl = document.getElementById('ncr-transcript-' + uniqueId);
                const ncrDesc = ncrDescEl ? Sanitizer.sanitizeText(ncrDescEl.value || '') : null;
                const transcript = transcriptEl ? Sanitizer.sanitizeText(transcriptEl.value || '') : null;
                let ncrType = document.getElementById('ncr-type-' + uniqueId)?.value || '';
                // Contradictory-data guard: only persist a classification when the
                // item is actually marked NC; clear stale classification otherwise.
                if (status !== 'nc') {
                    ncrType = '';
                }

                // Get all evidence images from thumbnail strip
                const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
                const evidenceImages = [];
                // Capture metadata recorded by execution-evidence.js at capture time.
                // Kept aligned to evidenceImages[] so exhibit N maps to timestamp N.
                const evidenceCapturedAtList = [];
                if (previewDiv) {
                    previewDiv.querySelectorAll('.ev-thumb').forEach(thumb => {
                        // Prefer data-save-url (cloud URL or idb:// key) over img.src (may be base64)
                        const saveUrl = thumb.dataset.saveUrl;
                        const imgEl = thumb.querySelector('img');
                        const url = saveUrl || (imgEl && imgEl.src) || '';
                        if (url && !url.includes('data:,') && url !== window.location.href) {
                            evidenceImages.push(url);
                            evidenceCapturedAtList.push(thumb.dataset.capturedAt || '');
                        }
                    });
                }
                // Prior saves already hold capture metadata for existing evidence; the
                // in-memory store only knows about captures made in this session, so
                // fall back to what was persisted before rather than dropping it.
                // execution-evidence.js exposes the in-session store as
                // {capturedAt, capturedAtList, location, locationRaw}; the persisted
                // checklist item uses the evidence*-prefixed names the report reads.
                const capMeta = (typeof window.getEvidenceCaptureMeta === 'function')
                    ? (window.getEvidenceCaptureMeta(uniqueId) || {}) : {};
                // (Read from this report: `state.currentReport` is never assigned, so
                // looking there dropped every saved timestamp/location on reload.)
                const isCustomItem = input.dataset.custom === 'true';
                const priorItem = (report.checklistProgress || [])
                    .find(p => p && !!p.isCustom === isCustomItem
                        && (isCustomItem || String(p.checklistId) === String(input.dataset.checklist))
                        && String(p.itemIdx) === String(input.dataset.item)) || {};
                const evidenceCapturedAt = capMeta.capturedAt
                    || evidenceCapturedAtList.find(Boolean)
                    || priorItem.evidenceCapturedAt || '';
                const evidenceLocation = capMeta.location || priorItem.evidenceLocation || '';
                const evidenceLocationRaw = capMeta.locationRaw || priorItem.evidenceLocationRaw || null;
                // Backward compat: also store first image as evidenceImage
                const evidenceImage = evidenceImages.length > 0 ? evidenceImages[0] : '';
                const evidenceSize = '';

                // Get personnel, designation and department
                const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-' + uniqueId)?.value || '');
                const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-' + uniqueId)?.value || '');
                const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-' + uniqueId)?.value || '');

                // Get clause and requirement from data attributes (reliable) instead of DOM scraping
                const clauseText = input.dataset.clause || '';
                const requirementText = input.dataset.requirement || '';

                // Save ALL items (not just ones with status/comment)
                // This ensures Conform/NC/NA selections persist even without comments
                checklistData.push({
                    checklistId: input.dataset.checklist,
                    itemIdx: input.dataset.item,
                    isCustom: input.dataset.custom === 'true',
                    status: status,
                    comment: comment,
                    ncrDescription: ncrDesc,
                    transcript: transcript,
                    ncrType: ncrType,
                    evidenceImage: evidenceImage,
                    evidenceImages: evidenceImages,
                    evidenceSize: evidenceSize,
                    evidenceCapturedAt: evidenceCapturedAt,
                    evidenceCapturedAtList: evidenceCapturedAtList,
                    evidenceLocation: evidenceLocation,
                    evidenceLocationRaw: evidenceLocationRaw,
                    personnel: personnel,
                    designation: designation,
                    department: department,
                    // Include clause and requirement for report display
                    clause: clauseText || input.dataset.clause || '',
                    requirement: requirementText || input.dataset.requirement || ''
                });
            });
            // Preserve _originalComment from previous saves (set by AI refinement)
            checklistData.forEach(item => {
                const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
                const prev = (report.checklistProgress || []).find(p => {
                    const pk = p.isCustom ? `custom-${p.itemIdx}` : `${p.checklistId}-${p.itemIdx}`;
                    return pk === key;
                });
                if (item.ncrDescription === null) item.ncrDescription = (prev && prev.ncrDescription) || '';
                if (item.transcript === null) item.transcript = (prev && prev.transcript) || '';
                if (prev && prev._originalComment && !item._originalComment) {
                    item._originalComment = prev._originalComment;
                }
                if (prev && prev._aiGenerated && !item._aiGenerated) {
                    item._aiGenerated = prev._aiGenerated;
                }
                // Preserve criterionRef/criterionSource the same way. The DOM
                // scrape above has no input field for these (they're set out of
                // band — e.g. by window.setFindingCriterion, the Report Integrity
                // panel's "Set criterion" fix action) so without carrying them
                // forward here, the very next ordinary checklist save on this tab
                // would silently wipe out an auditor's criterion assignment.
                if (prev && prev.criterionRef && !item.criterionRef) {
                    item.criterionRef = prev.criterionRef;
                    item.criterionSource = prev.criterionSource;
                }
                // Every other field the screen has no input for is kept as it
                // was: an approved evidence statement (clientEvidenceStatement),
                // an AI sign-off (_auditorConfirmed), an AI evidence explanation
                // (aiEvidence), a suggested criterion, a CAPA due date. Listing
                // them one by one lost each new one on the next ordinary save.
                // Fields the screen does own are already on `item`, so this
                // never overrides what the auditor just changed.
                if (prev) {
                    Object.keys(prev).forEach((k) => {
                        // Derived from the evidence on screen: never carried, or
                        // a deleted screenshot's thumbnail could print.
                        if (DERIVED_EVIDENCE_KEYS.has(k)) return;
                        if (!Object.prototype.hasOwnProperty.call(item, k)) item[k] = prev[k];
                    });
                }
            });

            // This tab holds newer answers than the view was drawn from (saved in
            // another tab and synced here): keep them for every question that was
            // not changed on this screen, instead of writing the old screen back.
            domData = checklistData;
            baseUsed = window.ChecklistMerge.getBase(reportId);
            const local = window.ChecklistMerge.reconcileLocal(reportId, report, checklistData);
            checklistData = local.items;
            if (local.merged) mergedKept = local.kept;

            report.checklistProgress = checklistData;

            // Revision tracking
            if (!report.checklistRevisions) report.checklistRevisions = [];
            report.checklistRevisions.push({
                rev: report.checklistRevisions.length + 1,
                timestamp: new Date().toISOString(),
                itemCount: checklistData.length,
                ncCount: checklistData.filter(d => d.status === 'nc').length,
                conformCount: checklistData.filter(d => d.status === 'conform').length,
                naCount: checklistData.filter(d => d.status === 'na').length
            });
            knownRevs = report.checklistRevisions.length - 1;
            window.ChecklistMerge.setBase(reportId, report);

            // Update revision badge in UI
            const badge = document.getElementById('revision-badge');
            const rev = report.checklistRevisions.length;
            if (badge) {
                badge.innerHTML = `<i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${rev}`;
                badge.title = report.checklistRevisions.map(r => 'v' + r.rev + ' — ' + new Date(r.timestamp).toLocaleString()).join('\n');
            } else {
                // Insert badge after save button
                const saveBtn = document.getElementById('save-progress-btn');
                if (saveBtn) {
                    const span = document.createElement('span');
                    span.id = 'revision-badge';
                    span.title = 'v' + rev + ' — ' + new Date().toLocaleString();
                    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:0.75rem;font-weight:600;color:#166534;cursor:help;';
                    span.innerHTML = `<i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${rev}`;
                    saveBtn.parentElement.appendChild(span);
                }
            }
        } else if (opts && Array.isArray(opts.changedFrom)) {
            // Answers changed away from the checklist screen: Evidence mapping
            // moves screenshots from the Finalization tab and passes what the
            // answers were before. This save used to write memory straight to
            // the cloud with no revision entry, so another open tab's
            // stale-view guard could not tell the cloud copy had moved on and
            // wrote the old screenshot positions back (found 2026-11-21, when
            // 19 moves were applied to a live audit). It now counts as a
            // checklist save: a revision is recorded, and a newer cloud copy
            // is merged in before the write, with this tab's changes winning.
            offScreen = true;
            domData = report.checklistProgress || [];
            baseUsed = { items: opts.changedFrom };
            if (!report.checklistRevisions) report.checklistRevisions = [];
            knownRevs = report.checklistRevisions.length;
            report.checklistRevisions.push({
                rev: knownRevs + 1,
                timestamp: new Date().toISOString(),
                itemCount: domData.length,
                ncCount: domData.filter(d => d.status === 'nc').length,
                conformCount: domData.filter(d => d.status === 'conform').length,
                naCount: domData.filter(d => d.status === 'na').length
            });
            window.ChecklistMerge.setBase(reportId, report);
        }

        // Handle Review & Submit Tab classifications if present.
        // Only what was changed on this tab is written back. The boxes show the
        // finding as it was when the tab was drawn; copying them back on every
        // save undid text written elsewhere meanwhile (PC Connection, 23 Nov
        // 2026: Fix findings' new objective evidence was reverted to the old
        // field note by this loop on each save, so it never reached the server).
        const reviewSeverities = document.querySelectorAll('.review-severity');
        if (reviewSeverities.length > 0) {
            reviewSeverities.forEach(select => {
                const findingId = select.dataset.findingId;
                const newType = select.value;
                const remarksEl = document.querySelector(`.review-remarks[data-finding-id="${findingId}"]`);
                const remarks = remarksEl ? remarksEl.value : '';
                const typeChanged = reviewSelectChanged(select);
                const remarksChanged = !!remarksEl && remarksEl.value !== remarksEl.defaultValue;

                if (findingId.startsWith('checklist-')) {
                    const idx = parseInt(findingId.replace('checklist-', ''), 10);
                    // idx is the ORIGINAL index into checklistProgress (not a filtered sequential index)
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        if (typeChanged) report.checklistProgress[idx].ncrType = newType;
                        if (remarksChanged && remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (findingId.startsWith('ncr-')) {
                    const idx = parseInt(findingId.replace('ncr-', ''), 10);
                    if (report.ncrs && report.ncrs[idx]) {
                        if (typeChanged) report.ncrs[idx].type = newType;
                        if (remarksChanged && remarks) report.ncrs[idx].description = remarks;
                    }
                }
            });
        }

        // Save Executive Summary & Observations (Unified View)
        // Only when changed in that box: the boxes hold the text as drawn, and
        // copying them back on every save undid wording saved since from Report
        // Preview or by AI drafting. Once written, the box counts as saved.
        const takeNarrative = (el, field) => {
            if (!el || el.value === el.defaultValue) return;
            report[field] = Sanitizer.sanitizeText(el.value);
            el.defaultValue = el.value;
        };
        takeNarrative(document.getElementById(`exec-summary-${reportId}`), 'executiveSummary');
        takeNarrative(document.getElementById('positive-observations'), 'positiveObservations');
        takeNarrative(document.getElementById('ofi'), 'ofi');

        // Persist to Database (Async). The promise is returned so Finalize can
        // wait for this save before it writes.
        const persisted = (async () => {
            try {
                // The cloud copy moved on since this tab last knew it (another tab or
                // device saved): merge with it per question before writing.
                let remoteMerged = false;
                const remote = await window.ChecklistMerge.fetchRemote(reportId);
                // Report-level fields this tab did not change take the newer saved value.
                if (remote && remote.data) {
                    const taken = window.ChecklistMerge.mergeFields(reportId, report, remote.data);
                    if (taken.length) console.info('[saveChecklist] kept newer saved values for: ' + taken.join(', '));
                }
                if (domData) {
                    if (remote && remote.revisions.length > knownRevs) {
                        const r = window.ChecklistMerge.merge(baseUsed ? baseUsed.items : [], domData, remote.items, { allFields: offScreen });
                        const ours = report.checklistRevisions[report.checklistRevisions.length - 1] || {};
                        report.checklistProgress = r.items;
                        report.checklistRevisions = remote.revisions.concat([Object.assign({}, ours, {
                            rev: remote.revisions.length + 1,
                            itemCount: r.items.length,
                            ncCount: r.items.filter(d => d.status === 'nc').length,
                            conformCount: r.items.filter(d => d.status === 'conform').length,
                            naCount: r.items.filter(d => d.status === 'na').length
                        })]);
                        window.ChecklistMerge.setBase(reportId, report);
                        mergedKept = Math.max(mergedKept, 0) + r.kept;
                        remoteMerged = true;
                    }
                }

                // Use correct DB column names (client_name, not client)
                await window.SupabaseClient.db.upsert('audit_reports', {
                    id: String(reportId),  // DB uses TEXT for id
                    plan_id: report.planId ? String(report.planId) : null,
                    client_name: report.client,  // DB column is client_name, not client
                    client_id: report.clientId || null,
                    date: report.date,
                    status: report.status,
                    findings: report.findings || 0,
                    checklist_progress: report.checklistProgress || [],  // Standardized column name
                    data: Object.assign({}, report, { _evidenceIndexBuilt: undefined }),
                    custom_items: report.customItems || [],
                    opening_meeting: report.openingMeeting || {},
                    closing_meeting: report.closingMeeting || {},
                    ncrs: report.ncrs || []
                });
                window.ChecklistMerge.noteServerFields(reportId, report);

                // Success UI
                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Changes Saved Successfully';
                    indicator.style.background = '#10b981'; // Green
                    setTimeout(() => {
                        indicator.style.display = 'none';
                    }, 2000);
                }
                if (!quiet) window.showNotification('Audit progress saved to cloud', 'success');

                // Merged with newer answers: redraw so the screen shows them, and
                // after a cloud merge save once more so the NCR register is synced
                // from the merged checklist rather than from the old screen.
                if (mergedKept >= 0) {
                    window.showNotification('This checklist was also saved in another tab or device. Your changes here were merged with it'
                        + (mergedKept ? ` and ${mergedKept} newer answer${mergedKept === 1 ? ' was' : 's were'} kept.` : '.'), 'warning');
                    const tabBtn = document.querySelector('.tab-btn[data-tab="checklist"]');
                    if (tabBtn && document.querySelectorAll('.status-input').length) {
                        const y = window.scrollY;
                        tabBtn.click();
                        window.scrollTo(0, y);
                        if (remoteMerged) setTimeout(() => window.saveChecklist(reportId, { quiet: true }), 0);
                    }
                }

            } catch (dbError) {
                console.error('Database Sync Error:', JSON.stringify(dbError, null, 2));

                // Attempt Fallback: Save BASIC info only
                try {
                    console.warn('Attempting fallback save (basic info only)...');
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        client_name: report.client,
                        date: report.date,
                        status: report.status,
                        findings: report.findings || 0
                    });
                    window.showNotification('Partial save: Basic info saved. Full data saved locally.', 'warning');
                } catch (fallbackError) {
                    console.error('Fallback save also failed:', fallbackError);
                    window.showNotification(`Sync Failed: ${dbError.message || dbError.error_description || 'Unknown error'}`, 'error');
                }

                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sync Error';
                    indicator.style.background = '#ef4444'; // Red
                }
            }
        })();

        // ── Sync checklist NC items → NCR & CAPA Register ──
        // ISO 17021-1 requires NCRs to flow into the formal CAPA lifecycle
        try {
            // Only Major/Minor NCs get a formal CAPA register record — Observations,
            // OFIs, and pending_classification items need no corrective action
            // (see ncr-capa-module.js:539) and must never be written to state.ncrs/audit_ncrs.
            const isRegisterSeverity = (t) => ['major', 'minor'].includes(String(t || '').toLowerCase());
            const ncItems = (report.checklistProgress || []).filter(p => p.status === 'nc' && isRegisterSeverity(p.ncrType));
            if (!window.state.ncrs) window.state.ncrs = [];
            const assignedChecklists = [];
            // Resolve client by name first, then by ID as fallback
            const client = window.state.clients?.find(c => c.name === report.client)
                || window.state.clients?.find(c => String(c.id) === String(report.clientId));
            const resolvedClientId = client?.id || report.clientId || '';
            if (client && client.data?.assignedChecklists) {
                assignedChecklists.push(...client.data.assignedChecklists);
            }

            const persist = (rec) => {
                if (typeof persistNCR === 'function') persistNCR(rec).catch(e => console.warn('NCR sync persist error:', e));
                else if (window.persistNCR) window.persistNCR(rec).catch(e => console.warn('NCR sync persist error:', e));
            };

            // Track which sourceKeys are still active major/minor NC
            const activeSourceKeys = new Set();

            // Register records already tied to one of this save's NC items by
            // exact key or stable identity. The clause-level fallback below
            // may only adopt records NOT in this set, so it can never steal
            // another item's record.
            const claimed = new Set();
            ncItems.forEach(item => {
                const sk = buildChecklistSourceKey(reportId, item);
                const ident = buildChecklistStableIdentity(item);
                window.state.ncrs.forEach(n => {
                    if (!n) return;
                    if (n._sourceKey === sk) { claimed.add(n); return; }
                    if (String(n.auditId || '') === String(report.planId || '')
                        && n.sourceChecklistId != null
                        && String(n.sourceChecklistId) === String(ident.sourceChecklistId)
                        && String(n.sourceItemIdx) === String(ident.sourceItemIdx)) claimed.add(n);
                });
            });
            // One deadline for the register and the client report: both resolve the
            // CB's configured CAPA timeframes (fallback Major 30 / Minor 90 days).
            const capaDueFor = (sev, from) => {
                if (window.ReportStats && typeof window.ReportStats.capaDueDate === 'function') {
                    return window.ReportStats.capaDueDate(sev, from, {
                        settings: window.state.cbSettings, standard: report.standard || '', stage: report.auditType || ''
                    });
                }
                const d = new Date(from || Date.now());
                const base = isNaN(d.getTime()) ? new Date() : d;
                base.setDate(base.getDate() + (/major/i.test(String(sev)) ? 30 : 90));
                return base.toISOString().split('T')[0];
            };
            const normClause = (c) => String(c || '').trim().toLowerCase();
            const capaWork = (n) => (n.verifiedDate ? 5 : 0) + (n.correctiveAction ? 4 : 0)
                + (n.rootCause ? 3 : 0) + (n.correction ? 2 : 0);

            ncItems.forEach(item => {
                // Build stable key to prevent duplicates
                const sourceKey = buildChecklistSourceKey(reportId, item);
                activeSourceKeys.add(sourceKey);
                // Stable source identity, stored on the NCR record itself (separate
                // from _sourceKey, which also embeds reportId) so a finding can be
                // re-matched by "same checklist item" alone — independent of both
                // the report id and the finding's description text.
                const { sourceChecklistId, sourceItemIdx } = buildChecklistStableIdentity(item);

                // Resolve clause text (and any criterionRef/criterionSource the
                // checklist item carries) up front — sameFinding()'s dedupe match
                // below needs clauseText, and it's needed again to build/refresh the
                // register record. FOCUS.n/SURV items store the real ISO clause in
                // criterionRef because their own `clause` is an internal
                // pseudo-reference (see client-docs-bulk.js's question()); the report
                // engine displays criterionRef as the criterion when it's present.
                let clauseText = item.clause || 'Checklist Item';
                // The checklistProgress item's own criterionRef/criterionSource —
                // e.g. set by window.setFindingCriterion (Report Integrity panel's
                // "Set criterion" fix action, criterionSource:'auditor-assigned') —
                // takes precedence over the checklist template lookup below. An
                // auditor's explicit correction must not be silently overwritten by
                // the template's original (possibly wrong) auto-derived suggestion
                // the next time this sync runs.
                let criterionRef = item.criterionRef;
                let criterionSource = item.criterionSource;
                if (!criterionSource && item.checklistId && assignedChecklists.length > 0) {
                    const cl = assignedChecklists.find(c => String(c.id) === String(item.checklistId));
                    if (cl && cl.clauses && String(item.itemIdx).includes('-')) {
                        const [mc, si] = String(item.itemIdx).split('-');
                        const mainObj = cl.clauses.find(m => m.mainClause === mc);
                        if (mainObj && mainObj.subClauses && mainObj.subClauses[si]) {
                            const subItem = mainObj.subClauses[si];
                            clauseText = subItem.clause || clauseText;
                            if (subItem.criterionRef !== undefined) criterionRef = subItem.criterionRef;
                            if (subItem.criterionSource) criterionSource = subItem.criterionSource;
                        }
                    }
                }

                // Check if already synced. Three tiers, most-reliable first:
                //
                //  1. _sourceKey exact match — same report, same checklist item.
                //  2. STABLE IDENTITY match — same audit + same source checklist
                //     item (sourceChecklistId/sourceItemIdx stored on the record),
                //     independent of description text. checklistId/itemIdx change
                //     when a checklist is rebuilt or re-indexed, but NOT when a
                //     finding's wording is later AI-polished — so this tier is what
                //     keeps a polished re-sync from minting a duplicate NCR: the
                //     old description-based fallback below fails once the wording
                //     no longer matches character-for-character.
                //  3. Legacy fallback — client/audit + clause + finding text, for
                //     records synced before sourceChecklistId/sourceItemIdx were
                //     tracked (no stable identity to match on).
                const findingKey = (item.ncrDescription || item.comment || '')
                    .toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 180);
                const stableIdentityMatch = (n) => {
                    if (!n || n._sourceKey === sourceKey) return false;
                    if (String(n.auditId || '') !== String(report.planId || '')) return false;
                    if (String(n.status || '').toLowerCase() === 'withdrawn') return false;
                    if (n.sourceChecklistId == null && n.sourceItemIdx == null) return false;
                    return String(n.sourceChecklistId) === String(sourceChecklistId)
                        && String(n.sourceItemIdx) === String(sourceItemIdx);
                };
                const sameFinding = (n) => {
                    if (!n || n._sourceKey === sourceKey) return false;
                    if (String(n.auditId || '') !== String(report.planId || '')) return false;
                    if (String(n.clause || '').trim() !== String(clauseText || '').trim()) return false;
                    if (String(n.status || '').toLowerCase() === 'withdrawn') return false;
                    const d = String(n.description || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 180);
                    return !!findingKey && d === findingKey;
                };
                let existing = window.state.ncrs.find(n => n._sourceKey === sourceKey);
                if (!existing) existing = window.state.ncrs.find(stableIdentityMatch);
                if (!existing) {
                    const adopted = window.state.ncrs.find(sameFinding);
                    if (adopted) {
                        adopted._sourceKey = sourceKey;   // re-point to the current checklist
                        existing = adopted;
                    }
                }
                //  4. Clause fallback — the checklist was rebuilt (new item ids)
                //     AND the wording changed, so none of the tiers above can
                //     match. If this audit has exactly ONE NC item on this clause,
                //     any open checklist-raised record on the same clause for the
                //     same audit is that finding. With two NC items on one clause
                //     there is no safe way to pair them, so nothing is adopted.
                if (!existing && report.planId != null && report.planId !== '') {
                    const itemsOnClause = ncItems.filter(p => normClause(p.clause) === normClause(item.clause)).length;
                    if (itemsOnClause === 1) {
                        const candidates = window.state.ncrs.filter(n => n && !claimed.has(n)
                            && String(n.auditId || '') === String(report.planId)
                            && String(n.source || '').toLowerCase() === 'checklist'
                            && String(n.status || '').toLowerCase() !== 'withdrawn'
                            && normClause(n.clause) === normClause(clauseText));
                        if (candidates.length) {
                            // Keep the one the auditee has already worked on; any
                            // others are surfaced by the register's duplicate review.
                            candidates.sort((a, b) => capaWork(b) - capaWork(a)
                                || String(a.raisedDate || '').localeCompare(String(b.raisedDate || '')));
                            existing = candidates[0];
                        }
                    }
                }
                if (existing) claimed.add(existing);
                if (existing) {
                    // Backfill/refresh stable identity on every match so future
                    // re-syncs — including after further AI-polish edits — can match
                    // on identity alone rather than falling back to description text.
                    existing._sourceKey = sourceKey;
                    existing.sourceChecklistId = sourceChecklistId;
                    existing.sourceItemIdx = sourceItemIdx;
                    // Legacy records created by the old buggy behavior (severity was
                    // Observation/OFI) are no longer valid register entries — withdraw
                    // them and create a fresh Major/Minor record instead.
                    const legacySeverity = !isRegisterSeverity(existing.severity);
                    if (legacySeverity) {
                        existing.status = 'Withdrawn';
                        persist(existing);
                    } else {
                        // Update severity/description/dueDate if changed
                        const newSeverity = item.ncrType || existing.severity;
                        if (String(newSeverity).toLowerCase() !== String(existing.severity).toLowerCase()) {
                            existing.dueDate = capaDueFor(newSeverity, existing.raisedDate || report.date);
                        }
                        existing.severity = newSeverity;
                        existing.description = item.ncrDescription || item.comment || existing.description;
                        existing.status = existing.status === 'Withdrawn' ? 'Open' : existing.status;
                        if (criterionSource) {
                            existing.criterionSource = criterionSource;
                            existing.criterionRef = criterionRef || '';
                        }
                        persist(existing);
                        return;
                    }
                }

                // Severity-based default due date (matches ncr-capa-module.js:1015-1026),
                // counted from the AUDIT date rather than from whenever this save ran.
                //
                // A nonconformity is raised on the day it is found. Dating it
                // "today" made the raised date drift to whichever day the auditor
                // happened to press Save, and the due date drift with it — one
                // audit produced NCRs due 13 September and others due 14, purely
                // because the checklist was saved across two days. The client is
                // then given inconsistent response deadlines for a single audit.
                const severity = item.ncrType || 'Minor';
                const raisedOn = (function () {
                    const d = new Date(report.date || report.createdAt || Date.now());
                    return isNaN(d.getTime()) ? new Date() : d;
                })();
                const dueDate = capaDueFor(severity, report.date || raisedOn);

                // Create new NCR record
                const ncrRecord = {
                    _sourceKey: sourceKey,
                    sourceChecklistId: sourceChecklistId,
                    sourceItemIdx: sourceItemIdx,
                    clientId: resolvedClientId,
                    clientName: report.client || '',
                    auditId: report.planId || null,          // FK → audit_plans(id)
                    level: 'client',
                    source: 'checklist',
                    standard: report.standard || '',
                    clause: clauseText,
                    severity: severity,
                    description: item.ncrDescription || item.comment || 'Non-conformity identified during audit',
                    raisedBy: report.auditor || 'Auditor',
                    raisedDate: raisedOn.toISOString().split('T')[0],
                    dueDate: dueDate,
                    status: 'Open',
                    correction: '',
                    rootCause: '',
                    correctiveAction: '',
                    evidence: item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : [])
                };
                if (criterionSource) {
                    ncrRecord.criterionSource = criterionSource;
                    ncrRecord.criterionRef = criterionRef || '';
                }

                window.state.ncrs.push(ncrRecord);

                // Persist to Supabase async (fire-and-forget)
                persist(ncrRecord);
            });

            // Items that are no longer Major/Minor NC (downgraded, cleared, or
            // reclassified to Observation/OFI/pending) get their register record
            // marked Withdrawn — both locally and via the existing save/persist
            // path — instead of being hard-deleted, which previously left orphaned
            // rows in Supabase. Consumers of state.ncrs (e.g. open-count/overdue
            // widgets) must exclude status:'Withdrawn'.
            window.state.ncrs.forEach(n => {
                if (!n._sourceKey || !n._sourceKey.startsWith(`exec-${reportId}-`)) return;
                if (!activeSourceKeys.has(n._sourceKey) && n.status !== 'Withdrawn') {
                    n.status = 'Withdrawn';
                    persist(n);
                }
            });

            if (typeof updateNCRAnalytics === 'function') updateNCRAnalytics();
            else if (window.updateNCRAnalytics) window.updateNCRAnalytics();
        } catch (syncErr) {
            console.warn('NCR register sync error (non-fatal):', syncErr);
        }

        window.saveData();
        return persisted;
    };

    // Filter checklist items by status
    window.filterChecklistItems = function (filterType) {
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filterType) {
                btn.classList.add('active');
            }
        });

        // Filter items
        document.querySelectorAll('.checklist-item').forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + uniqueId);
            const status = statusInput?.value || '';

            let shouldShow;

            if (filterType === 'all') {
                shouldShow = true;
            } else if (filterType === 'pending') {
                shouldShow = !status || status === '';
            } else {
                shouldShow = status === filterType;
            }

            if (shouldShow) {
                item.classList.remove('filtered-out');
            } else {
                item.classList.add('filtered-out');
            }
        });
    };

    // Bulk update status - prioritizes selected items, falls back to filtered items
    window.bulkUpdateStatus = function (reportId, status) {
        window.Logger.debug('Execution', 'bulkUpdateStatus called:', { reportId, status });

        // Check if any items are selected via checkboxes
        let targetItems = document.querySelectorAll('.checklist-item.selected-item');
        let useSelection = targetItems.length > 0;

        window.Logger.debug('Execution', 'Selected items:', targetItems.length);

        // If no items selected, fall back to filtered items
        if (!useSelection) {
            targetItems = document.querySelectorAll('.checklist-item:not(.filtered-out)');
            window.Logger.debug('Execution', 'Using filtered items:', targetItems.length);
        }

        if (targetItems.length === 0) {
            window.showNotification('No items to update', 'warning');
            return;
        }

        // "Not sampled" is for questions with no answer yet: it never replaces
        // a recorded result (an NC would be withdrawn from the register).
        const notSampled = status === (window.CONSTANTS.STATUS.NOT_SAMPLED || 'not_sampled');
        let skipped = 0;
        if (notSampled) {
            const open = Array.from(targetItems).filter(item => {
                const v = (document.getElementById('status-' + item.id.replace('row-', '')) || {}).value || '';
                return !v || v === status;
            });
            skipped = targetItems.length - open.length;
            targetItems = open;
            if (!targetItems.length) {
                window.showNotification('Every question in this set already has a result; none were marked Not sampled.', 'info');
                return;
            }
            if (!useSelection && typeof window.confirm === 'function'
                && !window.confirm('Mark ' + targetItems.length + ' unanswered question' + (targetItems.length === 1 ? '' : 's') + ' as Not sampled?')) {
                return;
            }
        }

        window.Logger.debug('Execution', `Bulk updating ${targetItems.length} items to status: ${status}`);
        let updatedCount = 0;
        targetItems.forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            window.Logger.debug('Execution', 'Updating item:', { uniqueId, status });
            window.setChecklistStatus(uniqueId, status);
            updatedCount++;
        });
        window.Logger.debug('Execution', 'Updated items count:', updatedCount);

        // Clear selections if items were selected
        if (useSelection) {
            document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.checklist-item.selected-item').forEach(item => {
                item.classList.remove('selected-item');
                item.style.background = '';
                item.style.borderLeft = '';
            });
        }

        // Close dropdown
        const menu = document.getElementById(`bulk-menu-${reportId}`);
        if (menu) {
            menu.classList.add('hidden');
            window.Logger.debug('Execution', 'Menu closed');
        } else {
            window.Logger.error('Execution', 'Menu not found: bulk-menu-' + reportId);
        }

        const statusLabel = { conform: 'Conforming', nc: 'Nonconforming', na: 'Not applicable', not_sampled: 'Not sampled' }[status] || String(status).toUpperCase();
        window.showNotification(`Updated ${updatedCount} item(s) to ${statusLabel}` + (skipped ? ` (${skipped} already answered, left as they were)` : ''), 'success');
        window.saveChecklist(reportId);
    };


    // Submit findings to Lead Auditor for review
    window.submitToLeadAuditor = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Use saveChecklist to gather all UI changes first
        window.saveChecklist(reportId);

        // Update report status to In Review (as per CONSTANTS)
        report.status = window.CONSTANTS.STATUS.IN_REVIEW;
        report.submittedAt = new Date().toISOString();
        report.submittedBy = window.state.currentUser?.name || 'Auditor';

        // Persist to Database
        (async () => {
            try {
                await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                    status: report.status,
                    data: Object.assign({}, report, { _evidenceIndexBuilt: undefined })
                });
                window.showNotification('Findings submitted to Lead Auditor for review!', 'success');
            } catch (err) {
                console.error('Submission failed:', err);
                window.showNotification('Submitted locally. Cloud sync pending.', 'warning');
            }
        })();

        window.saveData();

        // Navigate back to execution list
        setTimeout(() => {
            renderAuditExecutionEnhanced();
        }, 1500);
    };

    // Voice dictation into a checklist remark. One session per remark: the mic
    // button starts it and the same button stops it. (The button is wired through
    // the delegator to startDictation, so a separate stop listener stopped the
    // session and the same click started a new one — it kept listening.) The
    // transcript is written after the text already in the box and announced with
    // an input event, so autosave picks it up like typing.
    const DICTATION_LIMIT_MS = 60000;
    const dictationSessions = {};
    window._dictationSessions = dictationSessions;
    window.startDictation = function (uniqueId) {
        const active = dictationSessions[uniqueId];
        if (active) { active.stop(); return; }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            window.showNotification('Voice dictation is not supported in this browser. Please use Chrome or Edge.', 'warning');
            return;
        }
        const micBtn = document.getElementById('mic-btn-' + uniqueId);
        const box = document.getElementById('comment-' + uniqueId);
        if (!micBtn || !box) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        const base = box.value;
        const join = (text) => (base && text ? base.replace(/\s+$/, '') + ' ' + text.trim() : (base || text.trim()));
        let finalTranscript = '';
        let stopped = false;
        const originalIcon = '<i class="fa-solid fa-microphone"></i>';
        micBtn.innerHTML = '<i class="fa-solid fa-stop fa-fade" style="color: red;"></i>';
        micBtn.title = 'Listening — click to stop';

        const finish = () => {
            if (stopped) return;
            stopped = true;
            clearTimeout(limit);
            delete dictationSessions[uniqueId];
            micBtn.innerHTML = originalIcon;
            micBtn.title = 'Dictate to Remarks';
            const text = finalTranscript.trim();
            box.value = join(text);
            if (text) {
                box.dispatchEvent(new Event('input', { bubbles: true }));
                box.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();
            }
        };
        const limit = setTimeout(() => {
            try { recognition.stop(); } catch (_e) { /* already stopping */ }
            window.showNotification('Dictation stops after 60 seconds. Click the microphone again to continue.', 'info');
        }, DICTATION_LIMIT_MS);

        dictationSessions[uniqueId] = { stop: () => { try { recognition.stop(); } catch (_e) { finish(); } } };

        recognition.onresult = function (event) {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
                else interim += event.results[i][0].transcript;
            }
            box.value = join(finalTranscript + interim);
        };
        recognition.onend = finish;
        recognition.onerror = function (event) {
            window.Logger.error('Execution', 'Speech recognition error', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                const DICTATION_ERRORS = {
                    'not-allowed': 'Microphone blocked. Click the lock icon in the address bar, allow Microphone for this site, then try again.',
                    'service-not-allowed': 'Dictation is not available in this browser. Use Chrome or Edge.',
                    'audio-capture': 'No microphone found. Check that a microphone is connected and not muted.',
                    'network': 'Dictation needs an internet connection to the browser’s speech service.'
                };
                window.showNotification(DICTATION_ERRORS[event.error] || ('Error recording audio: ' + event.error), 'error');
            }
            finish();
        };

        try {
            recognition.start();
        } catch (e) {
            finish();
            window.showNotification('Could not start dictation: ' + (e && e.message ? e.message : e), 'error');
        }
    };

    // A clause value that is actually an internal checklist pseudo-reference
    // (FOCUS.n / SURV / ORG / DOC — see client-docs-bulk.js's buildClientChecklist)
    // rather than a standard clause. Shared by the manual NCR create/edit forms'
    // inline warning and their non-blocking save-time check.
    window.NCR_PSEUDO_CLAUSE_PATTERN = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;

    // CSP-safe data-action-input handler: toggles the inline warning shown under
    // the free-text Clause/Requirement input when its value looks like an
    // internal pseudo-reference rather than an ISO clause. Non-blocking — it
    // never prevents save, it just prompts the auditor to also fill in the
    // "Actual criterion" field.
    window.checkNCRClausePseudoPattern = function (el) {
        const warningId = (el.dataset && el.dataset.id) || 'ncr-clause-warning';
        const warning = document.getElementById(warningId);
        if (!warning) return;
        warning.style.display = window.NCR_PSEUDO_CLAUSE_PATTERN.test(String(el.value || '').trim()) ? 'block' : 'none';
    };

    function createNCR(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        window.DataService.openFormModal('Create Non-Conformity Report', `
        <form id="ncr-form">
            <div class="form-group">
                <label>Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-type" required>
                    <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}">Observation (OBS)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.OFI}">Opportunity for Improvement (OFI)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MINOR}">Minor NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}">Major NC</option>

                </select>
            </div>
            <div class="form-group">
                <label>Clause/Requirement</label>
                <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3" data-action-input="checkNCRClausePseudoPattern" data-id="ncr-clause-warning">
                <small id="ncr-clause-warning" style="display:none; color: #b45309; margin-top: 0.35rem;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.25rem;"></i>This is an internal reference, not an ISO clause — enter the applicable standard clause.
                </small>
            </div>
            <div class="form-group">
                <label>Actual criterion (standard clause) <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.8rem;">— optional</span></label>
                <input type="text" class="form-control" id="ncr-criterion-ref" placeholder="e.g. 8.5.2">
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <div style="position: relative;">
                    <textarea class="form-control" id="ncr-description" rows="3" placeholder="Describe the non-conformity..." required></textarea>
                    <button type="button" id="mic-btn-modal" style="position: absolute; bottom: 10px; right: 10px; background: none; border: none; color: var(--primary-color); cursor: pointer;" title="Dictate Description">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Evidence / Objective Evidence</label>
                <textarea class="form-control" id="ncr-evidence" rows="2" placeholder="What evidence supports this finding?"></textarea>
            </div>

            <!-- Cross-Reference Fields -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Personnel Name</label>
                    <select class="form-control" id="ncr-personnel-modal" data-action-change="_autoFillPersonnel" data-id="modal">
                        <option value="">-- Select --</option>
                        ${((state.clients || []).find(c => c.name === report.client)?.contacts || []).map(c => `<option value="${window.UTILS.escapeHtml(c.name)}">${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Designation</label>
                    <input type="text" class="form-control" id="ncr-designation-modal" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Department</label>
                    <input type="text" class="form-control" id="ncr-department-modal" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                </div>
            </div>

            <div class="form-group" style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Multimedia Evidence</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" id="btn-capture-img" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-camera"></i> Capture Image
                    </button>
                    <span id="img-status" style="font-size: 0.8rem; color: #666;"></span>
                </div>
                <input type="hidden" id="ncr-evidence-image-url">
                <div id="image-preview" style="margin-top: 10px;"></div>
            </div>
        </form>
    `, () => {
            // 1. Define Fields
            const fieldIds = {
                description: 'ncr-description',
                type: 'ncr-type'
            };

            // 2. Define Rules
            const rules = {
                description: [
                    { rule: 'required', fieldName: 'Description' },
                    { rule: 'noHtmlTags' }
                ],
                type: [{ rule: 'required', fieldName: 'Type' }]
            };

            // 3. Validate
            const result = Validator.validateFormElements(fieldIds, rules);
            if (!result.valid) {
                Validator.displayErrors(result.errors, fieldIds);
                window.showNotification('Please fix the form errors', 'error');
                return;
            }
            Validator.clearErrors(fieldIds);

            // 4. Sanitize Input
            const type = document.getElementById('ncr-type').value;
            const clause = Sanitizer.sanitizeText(document.getElementById('ncr-clause').value);
            const criterionRefInput = Sanitizer.sanitizeText(document.getElementById('ncr-criterion-ref')?.value || '');
            const description = Sanitizer.sanitizeText(document.getElementById('ncr-description').value);
            const evidence = Sanitizer.sanitizeText(document.getElementById('ncr-evidence').value);
            const evidenceImage = Sanitizer.sanitizeURL(document.getElementById('ncr-evidence-image-url').value);
            const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-modal')?.value || '');
            const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-modal')?.value || '');
            const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-modal')?.value || '');

            // 5. Save
            if (!report.ncrs) report.ncrs = [];
            report.ncrs.push({
                type,
                clause,
                description,
                evidence,
                evidenceImage,
                transcript: description,
                personnel,
                designation,
                department,
                status: 'Open',
                createdAt: new Date().toISOString(),
                // criterionRef is optional (auditor-supplied "actual criterion"); it's
                // only attached when the auditor filled it in or flagged the clause as
                // an internal reference, so plain manual NCRs stay unchanged.
                ...(criterionRefInput || window.NCR_PSEUDO_CLAUSE_PATTERN.test(clause)
                    ? { criterionRef: criterionRefInput, criterionSource: 'manual' } : {})
            });
            report.findings = report.ncrs.length;

            window.saveData();

            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR created successfully with evidence', 'success');
        });

        // Voice Dictation Logic for Modal
        const micBtn = document.getElementById('mic-btn-modal');
        if (micBtn) {
            micBtn.onclick = () => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;

                    micBtn.innerHTML = '<i class="fa-solid fa-circle-dot fa-fade" style="color: red;"></i>';
                    recognition.start();

                    recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        const desc = document.getElementById('ncr-description');
                        desc.value = desc.value ? desc.value + ' ' + transcript : transcript;
                    };

                    recognition.onend = () => {
                        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                    };
                } else {
                    alert('Speech recognition not supported in this browser.');
                }
            };
        }

        // Camera Capture Logic - triggers file input for real image upload
        const captureBtn = document.getElementById('btn-capture-img');
        if (captureBtn) {
            captureBtn.onclick = function () {
                // Create file input for image selection
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment'; // Use back camera on mobile

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    captureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

                    try {
                        // Upload to Supabase if available
                        if (window.SupabaseClient?.isInitialized) {
                            const result = await window.SupabaseClient.storage.uploadAuditImage(file, 'ncr-evidence', Date.now().toString());
                            if (result?.url) {
                                document.getElementById('ncr-evidence-image-url').value = result.url;
                                document.getElementById('image-preview').innerHTML = `<img src="${window.UTILS.escapeHtml(result.url)}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image uploaded successfully";
                            }
                        } else {
                            // Fallback: Use base64 data URL for local storage
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                document.getElementById('ncr-evidence-image-url').value = ev.target.result;
                                document.getElementById('image-preview').innerHTML = `<img src="${ev.target.result}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image captured (stored locally)";
                            };
                            reader.readAsDataURL(file);
                        }

                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retake';
                        captureBtn.classList.remove('btn-secondary');
                        captureBtn.classList.add('btn-success');
                    } catch (error) {
                        console.error('Image upload failed:', error);
                        document.getElementById('img-status').textContent = "Upload failed: " + error.message;
                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retry';
                    }
                };

                fileInput.click();
            };
        }

    }

    // Edit existing NCR
    // Named for the table it serves, because there are two different editors.
    //
    // ncr-capa-module.js also defines window.editNCR, taking a single NCR id
    // from the register, and it loads AFTER this file — so its one-argument
    // version silently replaced this two-argument one. This table's Edit button
    // then called it with (reportId, index): the register looked for an NCR
    // whose id was a REPORT id, found none, and returned without a word. The
    // button appeared to do nothing at all.
    function editExecutionNCR(reportId, ncrIdx) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report || !report.ncrs || !report.ncrs[ncrIdx]) {
            // Say so rather than returning silently — a dead button teaches an
            // auditor to distrust the screen.
            window.showNotification('That nonconformity could not be opened for editing — it is no longer on this report.', 'error');
            return;
        }

        const ncr = report.ncrs[ncrIdx];

        window.DataService.openFormModal('Edit NCR-' + String(ncrIdx + 1).padStart(3, '0'), `
    <form id="ncr-form">
        <div class="form-group">
            <label>Type <span style="color: var(--danger-color);">*</span></label>
            <select class="form-control" id="ncr-type" required>
                <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${ncr.type === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation (OBS)</option>
                <option value="${window.CONSTANTS.NCR_TYPES.OFI}" ${ncr.type === window.CONSTANTS.NCR_TYPES.OFI ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor NC</option>
                <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major NC</option>
            </select>
        </div>
        <div class="form-group">
            <label>Clause/Requirement</label>
            <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3" value="${window.UTILS.escapeHtml(ncr.clause || '')}" data-action-input="checkNCRClausePseudoPattern" data-id="edit-ncr-clause-warning">
            <small id="edit-ncr-clause-warning" style="display:${window.NCR_PSEUDO_CLAUSE_PATTERN.test(String(ncr.clause || '').trim()) ? 'block' : 'none'}; color: #b45309; margin-top: 0.35rem;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.25rem;"></i>This is an internal reference, not an ISO clause — enter the applicable standard clause.
            </small>
        </div>
        <div class="form-group">
            <label>Actual criterion (standard clause) <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.8rem;">— optional</span></label>
            <input type="text" class="form-control" id="ncr-criterion-ref" placeholder="e.g. 8.5.2" value="${window.UTILS.escapeHtml(ncr.criterionRef || '')}">
        </div>
        <div class="form-group">
            <label>Description <span style="color: var(--danger-color);">*</span></label>
            <textarea class="form-control" id="ncr-description" rows="3" required>${window.UTILS.escapeHtml(ncr.description || '')}</textarea>
        </div>
        <div class="form-group">
            <label>Evidence / Objective Evidence</label>
            <textarea class="form-control" id="ncr-evidence" rows="2">${window.UTILS.escapeHtml(ncr.evidence || '')}</textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Personnel Name</label>
                <select class="form-control" id="ncr-personnel-modal" data-action-change="_autoFillPersonnel" data-id="modal">
                    <option value="">-- Select --</option>
                    ${((state.clients || []).find(c => c.name === report.client)?.contacts || []).map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${ncr.personnel === c.name ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                    ${ncr.personnel && !((state.clients || []).find(c => c.name === report.client)?.contacts || []).some(c => c.name === ncr.personnel) ? `<option value="${window.UTILS.escapeHtml(ncr.personnel)}" selected>${window.UTILS.escapeHtml(ncr.personnel)}</option>` : ''}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Designation</label>
                <input type="text" class="form-control" id="ncr-designation-modal" value="${window.UTILS.escapeHtml(ncr.designation || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Department</label>
                <input type="text" class="form-control" id="ncr-department-modal" value="${window.UTILS.escapeHtml(ncr.department || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Status</label>
                <select class="form-control" id="ncr-status">
                    <option value="Open" ${ncr.status === 'Open' || !ncr.status ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${ncr.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Closed" ${ncr.status === 'Closed' || ncr.status === window.CONSTANTS.STATUS.CLOSED ? 'selected' : ''}>Closed</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Created</label>
                <input type="text" class="form-control" value="${ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : 'N/A'}" readonly style="background: #f1f5f9;">
            </div>
        </div>
        <input type="hidden" id="ncr-evidence-image-url" value="${window.UTILS.escapeHtml(ncr.evidenceImage || '')}">
        ${ncr.evidenceImage ? '<div style="margin-top: 0.5rem;"><img src="' + ncr.evidenceImage + '" style="max-height: 100px; border-radius: 6px; border: 1px solid #e2e8f0;"></div>' : ''}
    </form>
`, () => {
            const type = document.getElementById('ncr-type').value;
            const clause = Sanitizer.sanitizeText(document.getElementById('ncr-clause').value);
            const criterionRefInput = Sanitizer.sanitizeText(document.getElementById('ncr-criterion-ref')?.value || '');
            const description = Sanitizer.sanitizeText(document.getElementById('ncr-description').value);
            const evidence = Sanitizer.sanitizeText(document.getElementById('ncr-evidence').value);
            const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-modal')?.value || '');
            const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-modal')?.value || '');
            const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-modal')?.value || '');
            const status = document.getElementById('ncr-status').value;
            const evidenceImage = document.getElementById('ncr-evidence-image-url').value;

            if (!description.trim()) {
                window.showNotification('Description is required', 'error');
                return;
            }

            // Update existing NCR
            report.ncrs[ncrIdx] = {
                ...report.ncrs[ncrIdx],
                type,
                clause,
                description,
                evidence,
                evidenceImage,
                personnel,
                designation,
                department,
                status,
                updatedAt: new Date().toISOString(),
                // criterionRef is optional — only attach/refresh it when the
                // auditor supplied one or flagged the clause as an internal
                // reference; otherwise leave whatever the record already had.
                ...(criterionRefInput || window.NCR_PSEUDO_CLAUSE_PATTERN.test(clause)
                    ? { criterionRef: criterionRefInput, criterionSource: 'manual' } : {})
            };

            window.saveData();
            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR updated successfully', 'success');
        });
    }

    function createCAPA(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const ncrs = report.ncrs || [];

        window.DataService.openFormModal('Create CAPA', `
        <form id="capa-form">
            <div class="form-group">
                <label>Linked NCR</label>
                <select class="form-control" id="capa-ncr">
                    <option value="">-- None --</option>
                    ${ncrs.map((ncr, idx) => `<option value="NCR-${String(idx + 1).padStart(3, '0')}">NCR-${String(idx + 1).padStart(3, '0')} - ${ncr.description?.substring(0, 30)}...</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Root Cause <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-root-cause" rows="2" placeholder="What caused this issue?" required></textarea>
            </div>
            <div class="form-group">
                <label>Action Plan <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-action" rows="2" placeholder="What corrective/preventive actions will be taken?" required></textarea>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" class="form-control" id="capa-due">
            </div>
        </form>
    `, () => {
            const linkedNCR = document.getElementById('capa-ncr').value;
            const rootCause = document.getElementById('capa-root-cause').value;
            const actionPlan = document.getElementById('capa-action').value;
            const dueDate = document.getElementById('capa-due').value;

            if (rootCause && actionPlan) {
                if (!report.capas) report.capas = [];
                report.capas.push({
                    linkedNCR,
                    rootCause,
                    actionPlan,
                    dueDate,
                    status: 'In Progress',
                    createdAt: new Date().toISOString()
                });

                window.saveData();
                window.closeModal();
                renderExecutionDetail(reportId);
                window.showNotification('CAPA created successfully');
            } else {
                window.showNotification('Please fill in all required fields', 'error');
            }
        });
    }

    // eslint-disable-next-line no-unused-vars
    function saveObservations(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        report.positiveObservations = document.getElementById('positive-observations')?.value || '';
        report.ofi = document.getElementById('ofi')?.value || '';

        window.saveData();
        window.showNotification('Observations saved successfully');
    }

    // Save Opening/Closing Meeting Records (ISO 17021-1 Clause 9.4.7)
    // Collect attendees from checkboxes + custom list
    window._collectMeetingAttendees = function (prefix) {
        const attendees = [];
        document.querySelectorAll(`.${prefix}-attendee-cb:checked`).forEach(cb => {
            attendees.push({ name: cb.dataset.name, role: cb.dataset.role || '', organization: cb.dataset.org || '' });
        });
        // Custom attendees
        document.querySelectorAll(`#${prefix}-custom-list .custom-attendee-item`).forEach(el => {
            attendees.push({ name: el.dataset.name, role: el.dataset.role || '', organization: el.dataset.org || '' });
        });
        return attendees;
    };

    // One added attendee in a meeting's "added" list. The remove button removes
    // the whole entry (it used removeSelf, which removed only the button, so a
    // "removed" attendee was still saved).
    window._customAttendeeItemHTML = function (name, role, org) {
        const esc = window.UTILS.escapeHtml;
        return `<div class="custom-attendee-item" data-name="${esc(name)}" data-role="${esc(role || '')}" data-org="${esc(org || '')}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: #eff6ff; border-radius: 6px; font-size: 0.85rem; margin-bottom: 0.25rem;">`
            + `<i class="fa-solid fa-user-plus" style="color: #3b82f6;"></i><strong>${esc(name)}</strong>${role ? ' – ' + esc(role) : ''}${org ? ' (' + esc(org) + ')' : ''}`
            + '<button type="button" class="btn btn-sm" style="margin-left: auto; padding: 0 0.25rem; color: #dc2626;" data-action="removeCustomMeetingAttendee" title="Remove" aria-label="Remove"><i class="fa-solid fa-times"></i></button></div>';
    };
    window.removeCustomMeetingAttendee = function (el) {
        const item = el && el.closest ? el.closest('.custom-attendee-item') : null;
        if (item) item.remove();
    };

    window.addCustomMeetingAttendee = function (prefix) {
        const nameEl = document.getElementById(`${prefix}-custom-name`);
        const roleEl = document.getElementById(`${prefix}-custom-role`);
        const orgEl = document.getElementById(`${prefix}-custom-org`);
        if (!nameEl || !nameEl.value.trim()) { window.showNotification('Please enter a name', 'error'); return; }
        const name = nameEl.value.trim();
        const role = roleEl?.value?.trim() || '';
        const org = orgEl?.value?.trim() || '';
        const list = document.getElementById(`${prefix}-custom-list`);
        if (list) list.insertAdjacentHTML('beforeend', window._customAttendeeItemHTML(name, role, org));
        nameEl.value = ''; if (roleEl) roleEl.value = ''; if (orgEl) orgEl.value = '';
    };

    window.saveMeetingRecords = function (reportId) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) return;

        report.openingMeeting = {
            date: document.getElementById('opening-date')?.value || '',
            time: document.getElementById('opening-time')?.value || '',
            attendees: window._collectMeetingAttendees('opening'),
            notes: document.getElementById('opening-notes')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.opening-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        report.closingMeeting = {
            date: document.getElementById('closing-date')?.value || '',
            time: document.getElementById('closing-time')?.value || '',
            attendees: window._collectMeetingAttendees('closing'),
            summary: document.getElementById('closing-summary')?.value || '',
            response: document.getElementById('closing-response')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.closing-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        // Sync meetings to Supabase
        window.DataService.syncAuditReport(reportId, {
            openingMeeting: report.openingMeeting,
            closingMeeting: report.closingMeeting
        });

        window.showNotification('Meeting records saved successfully', 'success');
    };

    // ── Technical Review QA dimension map (client spec #31) ─────────────────
    // "Before approval, give the Technical Reviewer a concise QA panel... show
    // only exceptions requiring human decision" — this maps each
    // report-integrity.js rule id (by prefix; see that file for the rule
    // inventory) onto the QA dimension a reviewer actually thinks in, so the
    // reviewer sees "Clause Mapping: REVIEW" instead of having to reread the
    // whole report to notice B1/B4/B14/B15/W20/W7 are all the same underlying
    // problem. One rule id can only belong to one dimension; a dimension can
    // be fed by several rule ids.
    //
    //   Dimension                    Rule ids (report-integrity.js prefixes)
    //   ────────────────────────     ──────────────────────────────────────
    //   Clause Mapping                B1, B4, B14, B15, W20, W7
    //   Finding Evidence              B3
    //   Finding Counts                B13
    //   Audit Method                  B12
    //   Scope & Applicability         W13 (+ the finalize-gate scope check —
    //                                  no rule id of its own; matched by message,
    //                                  see GATE_SCOPE_MESSAGE_RE below)
    //   Effectiveness Consistency     W1, W17, W18
    //   Certification Cycle           B2, B9, W15
    //   Client-Facing Language        B6p, W10, W19
    //   Internal Metadata             B11
    //
    // Adding a rule to report-integrity.js later? Add its prefix to the
    // matching row here. A rule id that fires and matches none of these rows
    // is NOT dropped — classifyQaDimension's fallback below buckets it into
    // QA_OTHER_DIMENSION so it still surfaces as a REVIEW exception instead of
    // silently vanishing (e.g. B1n/B5/B6/B7/B8/B10/W2/W3/W4/W5/W6/W8/W9/W11/
    // W12/W14/W16 are real rules today but aren't named in the spec's table,
    // so they land in "Other" until someone gives them a real home).
    const QA_DIMENSION_RULES = [
        { dimension: 'Clause Mapping', prefixes: ['B1', 'B4', 'B14', 'B15', 'W20', 'W7'] },
        { dimension: 'Finding Evidence', prefixes: ['B3'] },
        { dimension: 'Finding Counts', prefixes: ['B13'] },
        { dimension: 'Audit Method', prefixes: ['B12'] },
        { dimension: 'Scope & Applicability', prefixes: ['W13'] },
        { dimension: 'Effectiveness Consistency', prefixes: ['W1', 'W17', 'W18'] },
        { dimension: 'Certification Cycle', prefixes: ['B2', 'B9', 'W15'] },
        { dimension: 'Client-Facing Language', prefixes: ['B6p', 'W10', 'W19'] },
        { dimension: 'Internal Metadata', prefixes: ['B11'] }
    ];
    const QA_OTHER_DIMENSION = 'Other (unmapped rule)';

    // Exact id, or id + '-' — so tag 'B1' matches 'B1-0' but not 'B14'/'B15-0'
    // or the unrelated 'B1n-...' rule, and tag 'W1' matches 'W1-clause' but
    // not 'W10-.../W11-.../W12-...' etc.
    function idMatchesRule(id, ruleTag) {
        return id === ruleTag || id.indexOf(ruleTag + '-') === 0;
    }

    // The finalize gate's own scope check (ai-service.js computeIssuanceGate)
    // has no ReportIntegrity rule id — it's a plain string pushed onto
    // gate.gateBlockers and given a synthetic 'GATE-Bn' id below. Recognise it
    // by the same message text the "Set audit scope" fix action matches on.
    const GATE_SCOPE_MESSAGE_RE = /scope\/criteria is not recorded/i;

    function classifyQaDimension(it) {
        const id = String((it && it.id) || '');
        if (GATE_SCOPE_MESSAGE_RE.test(String((it && it.message) || ''))) return 'Scope & Applicability';
        for (let i = 0; i < QA_DIMENSION_RULES.length; i++) {
            const row = QA_DIMENSION_RULES[i];
            if (row.prefixes.some((tag) => idMatchesRule(id, tag))) return row.dimension;
        }
        return null;
    }

    /**
     * Pure classification (no DOM): the same blockers+warnings already shown
     * in the main panel, bucketed per QA dimension. Kept separate from the
     * HTML builder below so it's unit-testable in isolation — same reasoning
     * as resolveFindingFromRef/isValidClauseRef/applyCriterionToFinding
     * elsewhere in this file.
     */
    function buildTechnicalReviewQA(blockers, warnings) {
        const dimensionOrder = QA_DIMENSION_RULES.map((r) => r.dimension).concat([QA_OTHER_DIMENSION]);
        const buckets = {};
        dimensionOrder.forEach((d) => { buckets[d] = []; });
        (blockers || []).concat(warnings || []).forEach((it) => {
            const dim = classifyQaDimension(it) || QA_OTHER_DIMENSION;
            buckets[dim].push(it);
        });
        return dimensionOrder.map((dim) => ({ dimension: dim, status: buckets[dim].length ? 'REVIEW' : 'PASS', items: buckets[dim] }));
    }

    /**
     * Compact reviewer-aid HTML: the dimension PASS/REVIEW grid, then only
     * the items behind REVIEW dimensions (no repeat of the full blocker/
     * warning cards already rendered above, and no fix-action buttons — this
     * is a reviewer aid, not a second gate).
     */
    function renderTechnicalReviewQAPanel(qaRows, esc) {
        const reviewRows = qaRows.filter((r) => r.status === 'REVIEW');
        const dimensionList = qaRows.map((r) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0.1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.8rem;">
                <span style="color: #475569;">${esc(r.dimension)}</span>
                <span style="font-weight: 700; font-size: 0.7rem; letter-spacing: 0.03em; padding: 0.1rem 0.5rem; border-radius: 8px; ${r.status === 'PASS' ? 'background: #ecfdf5; color: #059669;' : 'background: #fff7ed; color: #c2410c;'}">${r.status}${r.status === 'REVIEW' ? ' (' + r.items.length + ')' : ''}</span>
            </div>`).join('');

        const exceptions = reviewRows.length ? `
            <div style="margin-top: 0.75rem; padding-top: 0.6rem; border-top: 1px dashed #e2e8f0;">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.4rem;">Exceptions requiring a reviewer decision:</div>
                ${reviewRows.map((r) => `
                    <div style="margin-bottom: 0.5rem;">
                        <div style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.15rem;">${esc(r.dimension)}</div>
                        <ul style="margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.2rem;">
                            ${r.items.map((it) => `<li style="font-size: 0.78rem; color: #475569;">${esc((it && it.message) || '')}</li>`).join('')}
                        </ul>
                    </div>`).join('')}
            </div>` : `
            <div style="margin-top: 0.5rem; font-size: 0.78rem; color: #059669;"><i class="fa-solid fa-circle-check" style="margin-right: 0.3rem;"></i>No cross-dimension exceptions — nothing further for the reviewer to decide.</div>`;

        return `
            <div style="margin-top: 1.25rem; padding: 0.9rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-user-check" style="margin-right: 0.4rem; color: #64748b;"></i>Technical Review QA
                    <span style="font-weight: 400; color: #94a3b8; font-size: 0.72rem; margin-left: 0.4rem;">(reviewer aid, derived from the checks above — not a second gate)</span>
                </div>
                ${dimensionList}
                ${exceptions}
            </div>`;
    }

    /**
     * Run window.ReportIntegrity.checkById(reportId) (owned by another agent —
     * see report-integrity.js) and render its result into the Finalization
     * tab's Report Integrity card. Defensive throughout: the module may not be
     * loaded yet, may not exist in this build, or may reject — none of that
     * should break the Finalization tab. `opts.silent` is used for the
     * automatic on-render check (no spinner/error text, and it simply does
     * nothing when the module isn't available); the button click always shows
     * some outcome.
     */
    window.runReportIntegrityCheck = async function (reportId, opts) {
        const silent = !!(opts && opts.silent);
        let container = document.getElementById('report-integrity-results');
        if (!container) {
            // The panel only exists inside the 'review' (Audit Finalization) tab's
            // markup. A fix-it modal (Set criterion, Record technical review, Set
            // audit scope, ...) opens FROM that tab, but its Save button can fire
            // well after the auditor has switched to another tab underneath the
            // still-open modal — the container is gone by the time this runs,
            // and returning here used to do so silently: the fix really saved, but
            // the panel that should show the result had vanished with no route
            // back to it (reported as "on save it jumps to another page" —
            // nothing navigates, the modal just closes onto a tab that never had
            // this panel). The silent background check (the auto-run inside the
            // 'review' case itself) has no such user-facing gap to paper over, so
            // it keeps its original quiet no-op.
            if (silent) return;
            const reviewTabBtn = document.querySelector('.tab-btn[data-tab="review"]');
            if (document.getElementById('tab-content') && reviewTabBtn) {
                // Re-render via the tab button's own click handler (execution-list.js)
                // instead of calling renderExecutionTab directly here — that
                // handler still closes over the full contextData (assignedChecklists,
                // plan, clientPersonnel, ...) this function has no other way to
                // rebuild, and it also restores the 'review' tab's active state.
                reviewTabBtn.click();
                container = document.getElementById('report-integrity-results');
            }
            if (!container) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Saved — but the Report Integrity panel could not be refreshed here. Reopen this report\'s Finalization tab to see the latest result.', 'warning');
                }
                return;
            }
        }
        const esc = window.UTILS.escapeHtml;

        if (!window.ReportIntegrity || typeof window.ReportIntegrity.checkById !== 'function') {
            if (silent) return;
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Report Integrity checks are not available in this build.</p>';
            return;
        }

        if (!silent) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;"><i class="fa-solid fa-spinner fa-spin"></i> Running checks...</p>';
        }

        // Prefer the shared issuance gate (ai-service.js computeIssuanceGate) so
        // this panel shows EXACTLY what Finalize & Publish will enforce —
        // validator items plus the gate-level checks (scope, lead auditor, data
        // reconciliation, technical review). The two used to disagree (panel
        // counted validator items only), which read as the button being broken.
        let result;
        let gateItems = [];
        try {
            if (typeof window.computeIssuanceGate === 'function') {
                const gate = window.computeIssuanceGate(reportId);
                if (!gate) throw new Error('Report not found.');
                result = gate.integrity || { blockers: [], warnings: [], information: [] };
                gateItems = (gate.gateBlockers || []).map((m, i) => ({ id: 'GATE-B' + i, severity: 'blocker', section: 'issuance', message: m, source: 'finalize gate', suggestion: '' }))
                    .concat((gate.gateWarnings || []).map((m, i) => ({ id: 'GATE-W' + i, severity: 'warning', section: 'issuance', message: m, source: 'finalize gate', suggestion: '' })));
            } else {
                result = await window.ReportIntegrity.checkById(reportId);
            }
        } catch (err) {
            console.warn('Report Integrity check failed:', err);
            if (!silent) {
                container.innerHTML = '<p style="color: #dc2626; font-size: 0.9rem; margin: 0;">Report Integrity check failed to run: ' + esc(err && err.message ? err.message : 'Unknown error') + '</p>';
            }
            return;
        }

        if (!result || typeof result !== 'object') {
            if (!silent) container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">No integrity data returned.</p>';
            return;
        }

        const blockers = (Array.isArray(result.blockers) ? result.blockers : []).concat(gateItems.filter(g => g.severity === 'blocker'));
        const warnings = (Array.isArray(result.warnings) ? result.warnings : []).concat(gateItems.filter(g => g.severity === 'warning'));
        const information = Array.isArray(result.information) ? result.information : [];
        // Editorial (client spec #30) is presentation-only — raw field notes
        // printed as client-facing evidence, auto-correctable, never a gate
        // input. Kept out of allItems and rendered in its own visually
        // distinct block below so it can never be mistaken for a warning.
        const editorial = Array.isArray(result.editorial) ? result.editorial : [];
        const allItems = [...blockers, ...warnings, ...information];
        const ready = blockers.length === 0;

        const statusLine = ready
            ? '<div style="color: #059669; font-weight: 700;"><i class="fa-solid fa-circle-check" style="margin-right: 0.4rem;"></i>READY FOR AUDITOR REVIEW</div>'
            : '<div style="color: #dc2626; font-weight: 700;"><i class="fa-solid fa-circle-exclamation" style="margin-right: 0.4rem;"></i>BLOCKED — resolve blockers before finalization</div>';

        container.innerHTML = `
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 0.75rem 1rem; min-width: 100px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: #dc2626;">${blockers.length}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Blockers</div>
                </div>
                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 0.75rem 1rem; min-width: 100px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: #d97706;">${warnings.length}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Warnings</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 0.75rem 1rem; min-width: 100px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: #2563eb;">${information.length}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Information</div>
                </div>
                <div style="background: #f5f3ff; border: 1px dashed #ddd6fe; border-radius: 8px; padding: 0.75rem 1rem; min-width: 100px; text-align: center;" title="Presentation-only — auto-correctable, never blocks issuance">
                    <div style="font-size: 1.5rem; font-weight: 800; color: #7c3aed;">${editorial.length}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Editorial<br><span style="font-size: 0.65rem; color: #a78bfa;">non-blocking</span></div>
                </div>
            </div>
            <div style="margin-bottom: 1rem; font-size: 0.95rem;">${statusLine}</div>
            <div style="margin: -0.5rem 0 1rem; font-size: 0.75rem; color: #94a3b8;"><i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.3rem;"></i>Last checked ${esc(new Date().toLocaleTimeString())} — totals match the Finalize &amp; Publish gate.</div>
            ${(function () {
        // Bulk criterion review. Surfaced whenever anything is unassigned —
        // not only when a blocker fires — because conforming and advisory
        // items with no criterion still land in the report's "Criterion not
        // assigned" row and weaken clause-level attribution, they just don't
        // stop issuance.
        const panelReport = state.auditReports.find(r => String(r.id) === String(reportId));
        const unassigned = panelReport ? collectUnconfirmedCriteria(panelReport) : [];
        const blocks = unassigned.filter(u => u.blocksIssuance).length;
        if (!unassigned.length) {
            // Nothing unassigned — but an assigned criterion can still be
            // wrong, and this is the only control that can change one. Hiding
            // it left the auditor with a W25 warning pointing at a screen
            // that no longer existed.
            return `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.9rem;">
                    <div style="flex:1;min-width:220px;font-size:0.85rem;color:#334155;">Every finding carries a criterion. Review or change any assignment here — a bare parent clause, or a clause the evidence does not support.</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="reviewAllCriteria" data-id="${esc(String(reportId))}" aria-label="Review or change criteria">
                        <i class="fa-solid fa-list-check" style="margin-right: 0.3rem;"></i>Review / change criteria
                    </button>
                </div>`;
        }
        return `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;background:${blocks ? '#fef2f2' : '#f8fafc'};border:1px solid ${blocks ? '#fee2e2' : '#e2e8f0'};border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:1rem;">
                    <div style="flex:1;min-width:220px;font-size:0.85rem;color:#334155;">
                        <strong>${unassigned.length} finding(s)</strong> carry an internal reference (FOCUS/ORG/DOC) with no assigned criterion${blocks ? ` — <strong style="color:#991b1b;">${blocks} block issuance</strong>` : ''}.
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary"
                        data-action="reviewAllCriteria" data-id="${esc(String(reportId))}"
                        aria-label="Review all criteria">
                        <i class="fa-solid fa-list-check" style="margin-right: 0.3rem;"></i>Review all criteria
                    </button>
                </div>`;
    })()}
            ${(function () {
        // One screen for every finding that still needs the auditor's words
        // (fix-findings.js): missing statements, missing evidence, template
        // blanks and raw field notes printed as evidence.
        const r = state.auditReports.find(x => String(x.id) === String(reportId));
        const rows = (r && window.FixFindings) ? window.FixFindings.collect(r) : [];
        if (!rows.length) return '';
        const n = rows.reduce((s, x) => s + x.fields.length, 0);
        return `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.9rem;">
                    <div style="flex:1;min-width:220px;font-size:0.85rem;color:#334155;"><strong>${n} text${n === 1 ? '' : 's'} to write</strong> across ${rows.length} finding${rows.length === 1 ? '' : 's'}: statements, objective evidence and field notes. Write them all on one screen.</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="openFixFindings" data-id="${esc(String(reportId))}" aria-label="Fix findings">
                        <i class="fa-solid fa-pen-to-square" style="margin-right: 0.3rem;"></i>Fix findings
                    </button>
                </div>`;
    })()}
            ${(function () {
        // Is each screenshot filed under the question it supports
        // (evidence-mapping.js)? Proposals only; the auditor chooses each move.
        const r = state.auditReports.find(x => String(x.id) === String(reportId));
        const t = (r && window.EvidenceMapping) ? window.EvidenceMapping.totals(r) : { images: 0, questions: 0 };
        if (!t.images) return '';
        return `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.9rem;margin-bottom:0.9rem;">
                    <div style="flex:1;min-width:220px;font-size:0.85rem;color:#334155;"><strong>${t.images} screenshot${t.images === 1 ? '' : 's'}</strong> on ${t.questions} question${t.questions === 1 ? '' : 's'}. Check that each is filed under the question it supports; you choose what moves.</div>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="openEvidenceMapping" data-id="${esc(String(reportId))}" aria-label="Check evidence mapping">
                        <i class="fa-solid fa-images" style="margin-right: 0.3rem;"></i>Check evidence mapping
                    </button>
                </div>`;
    })()}
            ${allItems.length ? `
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${allItems.map(it => {
        const sevKey = String((it && it.severity) || '').toLowerCase();
        const badgeColor = sevKey === 'blocker' ? '#dc2626' : sevKey === 'warning' ? '#d97706' : '#3b82f6';
        // "Set criterion" fix action: only for the criterion blockers that
        // carry a resolvable finding ref (B1 = placeholder clause with no
        // criterionRef, B4 = no clause and no criterionRef at all — see
        // report-integrity.js's checkB1FocusCriterion/checkB4MissingCriterion).
        // Consumed defensively: no button when `ref` is absent, e.g. an older
        // ReportIntegrity build that hasn't attached one yet.
        const ref = it && it.ref;
        const showSetCriterion = !!ref && ref.kind === 'finding' && /^(B1|B4)-/.test(String((it && it.id) || ''));
        // Second fix action: the technical-review warning demanded an "Approved"
        // outcome without offering any path to record one (the actual control is
        // buried in the preview modal's Signature section) — surface it here.
        const showTechReview = /technical review outcome/i.test(String((it && it.message) || ''));
        // Third fix action: the scope blocker ("Audit scope/criteria is not
        // recorded…") likewise pointed at data with no edit path from this tab.
        const showSetScope = /scope\/criteria is not recorded/i.test(String((it && it.message) || ''));
        // Fourth fix action: W12 (report-integrity.js's checkW12EmployeeCount)
        // flags a headcount in evidence that contradicts the controlled client
        // profile. Its id is 'W12-' + the stated figure, so match by prefix
        // the same way the criterion buttons match B1/B4 by id prefix.
        const showReviewEmployeeCount = /^W12-/.test(String((it && it.id) || ''));
        // Fifth fix action: W13 (checkW13DesignApplicability) flags a design/
        // development scope alongside clause 8.3 treated as not applicable —
        // an applicability conflict only an explicit auditor decision can
        // resolve. Its id is the fixed literal 'W13'.
        const showConfirm83 = String((it && it.id) || '') === 'W13';
        // Sixth: W6 (unapproved AI-drafted text) had no control to approve it.
        const showApproveAi = /^W6-/.test(String((it && it.id) || ''));
        const fixBtn = showApproveAi ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="approveAiText" data-id="${esc(String(reportId))}"
                            aria-label="Review and approve AI-drafted text">
                            <i class="fa-solid fa-user-check" style="margin-right: 0.3rem;"></i>Review &amp; approve AI text
                        </button>` : showSetCriterion ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="setFindingCriterion"
                            data-report-id="${esc(String(reportId))}"
                            data-finding-index="${ref.index != null ? esc(String(ref.index)) : ''}"
                            data-finding-clause="${esc(String(ref.clause || ''))}"
                            data-finding-source="${esc(String(ref.source || ''))}"
                            data-checklist-id="${ref.checklistId != null ? esc(String(ref.checklistId)) : ''}"
                            data-item-idx="${ref.itemIdx != null ? esc(String(ref.itemIdx)) : ''}"
                            aria-label="Set criterion">
                            <i class="fa-solid fa-wrench" style="margin-right: 0.3rem;"></i>Set criterion
                        </button>` : showTechReview ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="recordTechnicalReview" data-id="${esc(String(reportId))}"
                            aria-label="Record technical review">
                            <i class="fa-solid fa-user-check" style="margin-right: 0.3rem;"></i>Record technical review
                        </button>` : showSetScope ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="setAuditScope" data-id="${esc(String(reportId))}"
                            aria-label="Set audit scope">
                            <i class="fa-solid fa-bullseye" style="margin-right: 0.3rem;"></i>Set audit scope
                        </button>` : showReviewEmployeeCount ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="reviewEmployeeCount" data-id="${esc(String(reportId))}"
                            aria-label="Review employee count">
                            <i class="fa-solid fa-users" style="margin-right: 0.3rem;"></i>Review employee count
                        </button>` : showConfirm83 ? `
                        <button type="button" class="btn btn-sm btn-outline-primary" style="margin-top: 0.45rem;"
                            data-action="confirmDesignApplicability" data-id="${esc(String(reportId))}"
                            aria-label="Confirm 8.3 applicability">
                            <i class="fa-solid fa-drafting-compass" style="margin-right: 0.3rem;"></i>Confirm 8.3 applicability
                        </button>` : '';
        return `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                            <span style="background: ${badgeColor}; color: white; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 10px;">${esc(it && it.severity || 'info')}</span>
                            ${it && it.section ? `<span style="font-size: 0.8rem; color: #475569; font-weight: 600;">${esc(it.section)}</span>` : ''}
                        </div>
                        <div style="font-size: 0.9rem; color: #1e293b; margin-bottom: 0.25rem;">${esc(it && it.message || '')}</div>
                        ${it && it.source ? `<div style="font-size: 0.75rem; color: #94a3b8;">Source: ${esc(it.source)}</div>` : ''}
                        ${it && it.suggestion ? `<div style="font-size: 0.8rem; color: #059669; margin-top: 0.25rem;"><i class="fa-solid fa-lightbulb" style="margin-right: 0.3rem;"></i>${esc(it.suggestion)}</div>` : ''}
                        ${fixBtn}
                    </div>
                `;
    }).join('')}
            </div>
            ` : '<p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">No issues found.</p>'}
            ${editorial.length ? `
            <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #f5f3ff; border: 1px dashed #ddd6fe; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                    <span style="background: #7c3aed; color: white; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 10px;">Editorial</span>
                    <span style="font-size: 0.78rem; color: #6d28d9; font-weight: 600;">${editorial.length} presentation-only item(s) — auto-correctable, does NOT block issuance</span>
                </div>
                <ul style="margin: 0; padding-left: 1.15rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    ${editorial.map(it => `
                    <li style="font-size: 0.8rem; color: #475569;">
                        ${esc((it && it.message) || '')}
                        ${it && it.suggestion ? `<div style="font-size: 0.74rem; color: #7c3aed; margin-top: 0.1rem;"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.25rem;"></i>${esc(it.suggestion)}</div>` : ''}
                    </li>`).join('')}
                </ul>
            </div>
            ` : ''}
        `;

        // Technical Review QA (client spec #31) — same blockers/warnings the
        // panel above just rendered, reclassified per reviewer dimension. See
        // buildTechnicalReviewQA/renderTechnicalReviewQAPanel above. Optional
        // container: older cached DOM without it just skips this quietly.
        const qaContainer = document.getElementById('report-integrity-qa-panel');
        if (qaContainer) {
            try {
                const qaRows = buildTechnicalReviewQA(blockers, warnings);
                qaContainer.innerHTML = renderTechnicalReviewQAPanel(qaRows, esc);
            } catch (err) {
                console.warn('Technical Review QA render failed:', err);
                qaContainer.innerHTML = '';
            }
        }

        // A manual run needs unmistakable feedback — the re-render is instant
        // and often shows identical totals, which read as "the button did
        // nothing". Silent (auto) runs stay quiet.
        if (!silent && typeof window.showNotification === 'function') {
            window.showNotification(
                'Integrity check complete — ' + blockers.length + ' blocker(s), ' + warnings.length + ' warning(s).',
                blockers.length ? 'warning' : 'success'
            );
        }

        // Visual hint only — the hard finalize gate lives in finalizeAndPublish.
        const finalizeBtn = document.getElementById('btn-finalize-publish');
        if (finalizeBtn) {
            if (!ready) {
                finalizeBtn.style.outline = '2px solid #dc2626';
                finalizeBtn.style.outlineOffset = '2px';
                finalizeBtn.title = blockers.length + ' report integrity blocker(s) must be resolved before finalizing.';
            } else {
                finalizeBtn.style.outline = '';
                finalizeBtn.style.outlineOffset = '';
                finalizeBtn.title = '';
            }
        }
    };

    // ── "Set criterion" fix action (Report Integrity panel) ────────────────
    // Lets an auditor resolve a B1/B4 criterion blocker directly from the
    // Finalization tab instead of hunting through the Checklist/NCR tabs with
    // no visible path to a fix. See window.setFindingCriterion below and its
    // "Set criterion" button rendered in runReportIntegrityCheck above. The
    // pure resolution/validation/persistence helpers themselves
    // (resolveFindingFromRef, isValidClauseRef, applyCriterionToFinding) are
    // top-level functions near the top of this file — same reasoning as
    // buildChecklistSourceKey/buildChecklistStableIdentity above: they need
    // to be callable in isolation from a unit test, not only after
    // renderExecutionTab() has run.

    /**
     * Persist the current in-memory report state and refresh the panel.
     * `severity` defaults to 'success'; pass 'warning' when the action only
     * partially resolved what it was opened for, so the toast doesn't claim a
     * clean result the panel is about to contradict.
     */
    function persistAndRefreshIntegrity(reportId, message, severity) {
        // Remember which tab the auditor is on before anything re-renders.
        //
        // These fix actions are reached from the Report Integrity panel on the
        // Review & Submit tab, and saving from one of them was landing the
        // auditor back on a different tab — losing their place and making a
        // successful save look like it had gone wrong. Whatever re-renders,
        // the tab they were working in is restored.
        const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || null;
        if (typeof window.saveChecklist === 'function') window.saveChecklist(reportId);
        if (typeof window.runReportIntegrityCheck === 'function') window.runReportIntegrityCheck(reportId);
        if (activeTab) {
            const stillActive = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
            if (stillActive !== activeTab) {
                document.querySelector('.tab-btn[data-tab="' + activeTab + '"]')?.click();
            }
        }
        if (message && typeof window.showNotification === 'function') window.showNotification(message, severity || 'success');
    }

    /**
     * "Set criterion" fix action for a Report Integrity B1/B4 blocker (data-
     * action target — see the button rendered in runReportIntegrityCheck).
     * Resolves the blocker's ref to the actual finding, opens the shared modal
     * helper (window.DataService.openFormModal) pre-filled with a suggested
     * clause, validates and persists the auditor's entry, and offers to bulk-
     * apply the same criterion to sibling findings that share the same
     * pseudo-clause.
     * @param {HTMLElement} el - the clicked "Set criterion" button; its
     *   data-report-id/data-finding-index/data-finding-clause/
     *   data-finding-source/data-checklist-id/data-item-idx carry the ref.
     */
    window.setFindingCriterion = function (el) {
        const ds = (el && el.dataset) || {};
        const reportId = ds.reportId;
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const ref = {
            index: ds.findingIndex !== undefined && ds.findingIndex !== '' ? parseInt(ds.findingIndex, 10) : undefined,
            clause: ds.findingClause || '',
            source: ds.findingSource || '',
            checklistId: ds.checklistId || undefined,
            itemIdx: ds.itemIdx || undefined
        };

        const resolved = resolveFindingFromRef(report, ref);
        if (!resolved) {
            window.showNotification('Could not locate this finding — it may have changed since the check last ran. Re-run the check and try again.', 'error');
            return;
        }

        const finding = resolved.item;
        const currentClause = finding.clause || ref.clause || '';
        const requirementText = finding.requirement || finding.ncrDescription || finding.comment || finding.description || '';

        // Pre-suggest: (1) existing criterionRef, (2) deriveCriterionRef() off
        // the question text, (3) blank.
        let suggested = '';
        let isDerivedSuggestion = false;
        if (finding.criterionRef && String(finding.criterionRef).trim()) {
            suggested = finding.criterionRef;
        } else if (window.ClientDocsBulk && typeof window.ClientDocsBulk.deriveCriterionRef === 'function') {
            const text = [requirementText, finding.comment].filter(Boolean).join(' ');
            const derived = window.ClientDocsBulk.deriveCriterionRef(text, report.standard);
            if (derived) { suggested = derived; isDerivedSuggestion = true; }
        }

        const esc = window.UTILS.escapeHtml;
        window.DataService.openFormModal('Set Criterion', `
            <div class="form-group">
                <label>Current clause reference</label>
                <div style="padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-family: monospace;">${esc(currentClause || '(none)')}</div>
            </div>
            <div class="form-group">
                <label>Finding text</label>
                <div style="padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; max-height: 140px; overflow-y: auto; font-size: 0.85rem;">${esc(requirementText || '(no text recorded)')}</div>
            </div>
            <div class="form-group">
                <label>Actual criterion (standard clause) <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="set-criterion-input" placeholder="e.g. 8.5.2" value="${esc(suggested)}">
                <small id="set-criterion-warning" style="display:none; color: #dc2626; margin-top: 0.35rem;"></small>
                ${isDerivedSuggestion ? '<small style="display:block; color: #b45309; margin-top: 0.35rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:0.25rem;"></i>Suggested from the question text — confirm or correct.</small>' : ''}
            </div>
        `, () => {
            const input = document.getElementById('set-criterion-input');
            const warning = document.getElementById('set-criterion-warning');
            const value = Sanitizer.sanitizeText((input && input.value) || '').trim();

            if (window.NCR_PSEUDO_CLAUSE_PATTERN.test(value)) {
                if (warning) { warning.textContent = 'That looks like an internal checklist reference (FOCUS/SURV/ORG/DOC), not a real standard clause. Enter the actual clause being audited.'; warning.style.display = 'block'; }
                return;
            }
            if (!window.isValidClauseRef(value)) {
                if (warning) { warning.textContent = 'Enter a valid clause reference, e.g. "8.5.2" or "A.8.13".'; warning.style.display = 'block'; }
                return;
            }

            applyCriterionToFinding(report, resolved, value);
            const siblings = findSiblingFindingsByClause(report, resolved, currentClause);

            window.closeModal();
            persistAndRefreshIntegrity(reportId, 'Criterion set to "' + value + '".');

            if (siblings.length && currentClause) {
                window.DataService.confirmAction(
                    siblings.length + ' other finding(s) on this report also use clause "' + currentClause + '". Apply criterion "' + value + '" to all of them too?',
                    () => {
                        siblings.forEach(s => applyCriterionToFinding(report, s, value));
                        persistAndRefreshIntegrity(reportId, 'Applied "' + value + '" to ' + siblings.length + ' more finding(s).');
                    }
                );
            }
        });
    };

    // ── "Review all criteria" bulk fix action ─────────────────────────────
    // window.setFindingCriterion above resolves ONE finding at a time, reached
    // from one integrity blocker. That is the right shape for fixing a single
    // flagged item, but it is the wrong shape for the common real case: a
    // surveillance checklist built from a Stage 1 review carries a whole block
    // of FOCUS.n / ORG / DOC items, none of which may carry an auto-stamped
    // criterion (see collectUnconfirmedCriteria's contract). Assigning them one
    // modal at a time is why issued reports still had items unattributed.
    //
    // This keeps the auditor as the decision-maker on every single row — nothing
    // is written that they did not type or accept — while letting them work the
    // whole list in one pass.

    /** Colour/label for a suggestion's confidence, matching the panel's palette. */
    function criterionConfidenceBadge(entry) {
        const esc = window.UTILS.escapeHtml;
        if (!entry.suggestedRef) {
            return '<span style="font-size:0.7rem;color:#64748b;">no suggestion — auditor judgement</span>';
        }
        const isMedium = entry.confidence === 'medium';
        const bg = isMedium ? '#fef3c7' : '#f1f5f9';
        const fg = isMedium ? '#92400e' : '#475569';
        const basisText = entry.basis === 'clause-token-in-question'
            ? 'clause named in the question text'
            : entry.basis === 'keyword-fallback' ? 'keyword match only' : 'unknown basis';
        return '<span style="background:' + bg + ';color:' + fg + ';font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;text-transform:uppercase;">'
            + esc(entry.confidence) + ' confidence</span>'
            + '<span style="font-size:0.7rem;color:#64748b;margin-left:0.4rem;">' + esc(basisText) + '</span>';
    }

    /**
     * Badge for an AI-sourced proposal — a different palette and basis text
     * ("AI — mapped from...") from criterionConfidenceBadge above so an AI
     * suggestion can never be mistaken for the heuristic's own proposal, let
     * alone for something the auditor typed. `reason` rides along as a title
     * (tooltip) so the proposal can be judged, not just trusted.
     */
    function aiCriterionBadge(confidence, reason) {
        const esc = window.UTILS.escapeHtml;
        const isStrong = confidence === 'high' || confidence === 'medium';
        const bg = isStrong ? '#ede9fe' : '#f1f5f9';
        const fg = isStrong ? '#5b21b6' : '#475569';
        const reasonAttr = esc(reason || 'No reason returned.');
        return '<span style="background:' + bg + ';color:' + fg + ';font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;text-transform:uppercase;" title="' + reasonAttr + '">'
            + '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right:3px;"></i>' + esc(confidence || 'ai') + '</span>'
            + '<span style="font-size:0.7rem;color:#7c3aed;margin-left:0.4rem;" title="' + reasonAttr + '">AI — mapped from the question wording</span>';
    }

    /**
     * Row note when the AI call answered but had nothing safe to propose (its
     * `insufficient` contract) — the returned reason stays visible in place
     * of a proposal; nothing is ever guessed to fill the gap.
     */
    function aiInsufficientNote(reason) {
        const esc = window.UTILS.escapeHtml;
        return '<span style="font-size:0.7rem;color:#64748b;" title="' + esc(reason || '') + '">AI checked — no suggestion (' + esc(reason || 'insufficient information') + ')</span>';
    }

    /**
     * "Review all criteria" — one screen to confirm every unassigned criterion.
     *
     * Every row starts BLANK unless the auditor ticks "use" for that row; the
     * suggestion is shown as a proposal with its confidence and basis, never
     * pre-accepted. Rows left untouched are skipped, not cleared, so a partial
     * pass is safe and repeatable. This applies identically to AI-sourced
     * proposals (see "Suggest clauses with AI" below) — they fill the same
     * checkbox+badge proposal shape and are never written into the input until
     * the auditor ticks "use" and presses Save.
     *
     * @param {string} reportId
     */
    window.reviewAllCriteria = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const entries = collectUnconfirmedCriteria(report, { includeAssigned: true });
        if (!entries.length) {
            window.showNotification('This report has no findings to assign a criterion to.', 'info');
            return;
        }
        const unassignedCount = entries.filter(e => !e.assigned).length;

        const esc = window.UTILS.escapeHtml;
        const blocking = entries.filter(e => e.blocksIssuance).length;
        // Rows the heuristic left with nothing AND that have no criterion yet —
        // the only ones "Suggest clauses with AI" is allowed to touch. A row
        // with a heuristic proposal keeps it, and an assigned criterion is the
        // auditor's: an AI proposal there plus "use all AI proposals" would
        // replace it with one tick.
        const aiTargets = entries.map((e, i) => i).filter(i => !entries[i].suggestedRef && !entries[i].assigned);
        const assignedCount = entries.length - unassignedCount;
        const introHtml = unassignedCount
            ? esc(unassignedCount + (unassignedCount === 1 ? ' finding carries' : ' findings carry')
                + ' an internal working reference (FOCUS/ORG/DOC) or none, not a clause of the audited standard.')
                + (blocking ? ' <strong style="color:#991b1b;">' + blocking + ' of them block issuance</strong> and are listed first.' : '')
                + (assignedCount ? esc(' The ' + assignedCount + ' with a criterion already follow, for review.') : '')
                + ' A suggestion is only ever a proposal from the question’s own wording — confirm or correct each one. Leave a row blank to skip it.'
            : 'Every finding already has a criterion, so nothing blocks issuance here. Review the list and change a criterion only if it is wrong; a row left as it is stays unchanged.';

        const rows = entries.map((e, i) => {
            const sevLabel = e.blocksIssuance
                ? '<span style="background:#fee2e2;color:#991b1b;font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;text-transform:uppercase;">blocks issuance</span>'
                : '<span style="background:#eff6ff;color:#1d4ed8;font-size:0.68rem;font-weight:600;padding:1px 7px;border-radius:9px;">' + esc((e.status === 'nc' ? (e.ncrType || 'finding') : (e.status || 'not assessed'))) + '</span>';
            return `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:0.55rem 0.5rem;vertical-align:top;width:7.5rem;max-width:7.5rem;white-space:normal;overflow-wrap:anywhere;font-family:monospace;font-weight:700;font-size:0.82rem;">${esc(e.clause)}</td>
                <td style="padding:0.55rem 0.5rem;vertical-align:top;">
                    <div style="font-size:0.82rem;color:#334155;line-height:1.45;">${esc(e.requirement.slice(0, 220))}${e.requirement.length > 220 ? '…' : ''}</div>
                    <div style="margin-top:0.3rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">${e.currentRef ? '<span style="background:#f1f5f9;color:#334155;font-size:0.68rem;font-weight:700;padding:1px 7px;border-radius:9px;font-family:monospace;" title="What the report prints today">current: ' + esc(e.currentRef) + '</span>' : ''}${sevLabel}<span class="rac-conf-badge" data-row="${i}">${criterionConfidenceBadge(e)}</span></div>
                </td>
                <td style="padding:0.55rem 0.5rem;vertical-align:top;white-space:nowrap;">
                    <div class="rac-proposal-slot" data-row="${i}">${e.suggestedRef ? `<label style="display:flex;gap:0.35rem;align-items:center;font-size:0.78rem;cursor:pointer;margin-bottom:0.3rem;">
                        <input type="checkbox" class="rac-use" data-row="${i}" data-suggested="${esc(e.suggestedRef)}"> use ${esc(e.suggestedRef)}
                    </label>` : ''}</div>
                    <input type="text" class="form-control rac-input" data-row="${i}" data-index="${e.index}"
                        style="margin:0;font-size:0.82rem;padding:4px 8px;width:120px;font-family:monospace;"
                        placeholder="e.g. 8.5.2" value="${esc(e.currentRef || '')}" data-current="${esc(e.currentRef || '')}">
                    <div class="rac-warning" data-row="${i}" style="display:none;color:#dc2626;font-size:0.7rem;margin-top:0.2rem;"></div>
                </td>
            </tr>`;
        }).join('');

        window.DataService.openFormModal('Review Criteria — ' + unassignedCount + ' unassigned, ' + (entries.length - unassignedCount) + ' to review', `
            <div id="rac-intro" style="font-size:0.85rem;color:#475569;margin-bottom:0.75rem;line-height:1.5;">${introHtml}</div>
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;padding:0.6rem 0.8rem;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;">
                <button type="button" id="rac-ai-suggest-btn" class="btn btn-sm" style="background:linear-gradient(135deg,#a855f7 0%,#7c3aed 100%);color:white;border:none;" ${aiTargets.length ? 'title="Proposes a clause for findings with no criterion and no suggestion. A criterion you already chose is never touched."' : 'disabled title="' + (unassignedCount ? 'Every finding without a criterion already has a suggestion.' : 'Every finding already has a criterion. AI only proposes one where there is none.') + '"'}>
                    <i class="fa-solid fa-wand-magic-sparkles" style="margin-right:0.35rem;"></i>Suggest clauses with AI${aiTargets.length ? ' (' + aiTargets.length + ')' : ''}
                </button>
                <span id="rac-ai-progress" style="font-size:0.78rem;color:#6d28d9;"></span>
                <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;color:#5b21b6;cursor:pointer;margin-left:auto;" title="Run &quot;Suggest clauses with AI&quot; first.">
                    <input type="checkbox" id="rac-ai-toggle-all" disabled> use all AI proposals
                </label>
            </div>
            <div id="rac-table-wrap" style="max-height:52vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                    <thead><tr style="background:#f8fafc;position:sticky;top:0;">
                        <th style="padding:0.5rem;text-align:left;font-size:0.72rem;text-transform:uppercase;color:#64748b;">Ref</th>
                        <th style="padding:0.5rem;text-align:left;font-size:0.72rem;text-transform:uppercase;color:#64748b;">Audit question</th>
                        <th style="padding:0.5rem;text-align:left;font-size:0.72rem;text-transform:uppercase;color:#64748b;">Criterion</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div style="margin-top:0.6rem;font-size:0.75rem;color:#94a3b8;">
                ISO/IEC 17021-1 surveillance elements (9.6.2 (a)–(h)) are deliberately excluded — their criterion is a certification-programme criterion, not a clause of the client’s standard.
            </div>
        `, () => {
            const inputs = Array.from(document.querySelectorAll('.rac-input'));
            let applied = 0;
            let firstInvalid = null;

            // Validate everything BEFORE writing anything, so a typo halfway
            // down the list can't leave half the batch applied.
            const pending = [];
            inputs.forEach((input) => {
                const rowKey = input.getAttribute('data-row');
                const warnEl = document.querySelector('.rac-warning[data-row="' + rowKey + '"]');
                if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
                const value = Sanitizer.sanitizeText(input.value || '').trim();
                if (!value) return; // skipped row
                // An unchanged prefilled value is a review, not an edit.
                if (value === String(input.getAttribute('data-current') || '').trim()) return;

                if (window.NCR_PSEUDO_CLAUSE_PATTERN.test(value)) {
                    if (warnEl) { warnEl.textContent = 'Internal reference, not a clause.'; warnEl.style.display = 'block'; }
                    if (!firstInvalid) firstInvalid = input;
                    return;
                }
                if (!window.isValidClauseRef(value)) {
                    if (warnEl) { warnEl.textContent = 'Not a valid clause reference.'; warnEl.style.display = 'block'; }
                    if (!firstInvalid) firstInvalid = input;
                    return;
                }
                pending.push({ index: parseInt(input.getAttribute('data-index'), 10), value });
            });

            if (firstInvalid) {
                window.showNotification('Correct the highlighted reference(s) before saving.', 'error');
                firstInvalid.focus();
                return;
            }
            if (!pending.length) {
                window.showNotification('No criteria changed — nothing was written.', 'info');
                return;
            }

            pending.forEach(({ index, value }) => {
                const item = (report.checklistProgress || [])[index];
                if (!item) return;
                applyCriterionToFinding(report, { kind: 'checklist', item, index }, value);
                applied++;
            });

            window.closeModal();
            persistAndRefreshIntegrity(reportId, 'Criteria written for ' + applied + ' finding(s).');
        });

        // "use <suggestion>" ticks copy the proposal into that row's input.
        // Delegated on the table wrapper (rather than one listener per
        // checkbox) because AI proposals inject NEW .rac-use checkboxes into
        // the DOM after this modal has already opened — a per-element
        // listener attached only here, once, would never see them.
        const tableWrap = document.getElementById('rac-table-wrap');
        if (tableWrap) {
            tableWrap.addEventListener('change', (evt) => {
                const box = evt.target.closest('.rac-use');
                if (!box) return;
                const row = box.getAttribute('data-row');
                const input = document.querySelector('.rac-input[data-row="' + row + '"]');
                if (!input) return;
                // Unticking puts back what the row had, not a blank box.
                input.value = box.checked ? (box.getAttribute('data-suggested') || '') : (input.getAttribute('data-current') || '');
            });
        }

        // -- "Suggest clauses with AI" -------------------------------------
        // Fills a proposal for exactly the rows collectUnconfirmedCriteria left
        // with no suggestedRef (aiTargets, computed above from the frozen
        // entries snapshot — never re-evaluated against what the auditor has
        // ticked since). Each row renders through the same checkbox +
        // confidence-badge proposal shape as the heuristic; AI never writes
        // rac-input directly — only ticking "use" and pressing Save does that.
        // Modest concurrency (3 in flight) so a review with dozens of blank
        // rows doesn't fire them all at once, but also doesn't wait on each
        // one serially.
        const aiBtn = document.getElementById('rac-ai-suggest-btn');
        const aiProgress = document.getElementById('rac-ai-progress');
        const aiToggleAll = document.getElementById('rac-ai-toggle-all');

        const resolveStandardForAI = () => {
            try {
                if (typeof AI_SERVICE.resolveStandardName === 'function') return AI_SERVICE.resolveStandardName(report) || '';
            } catch (_e) { /* fall through to report.standard */ }
            if (window.KB_HELPERS && typeof window.KB_HELPERS.resolveStandardName === 'function') {
                try { return window.KB_HELPERS.resolveStandardName(report) || ''; } catch (_e) { /* fall through */ }
            }
            return report.standard || '';
        };

        // Only pass along a note the auditor actually wrote — an empty
        // auditorNotes string would read to the AI as "the auditor said
        // nothing relevant" rather than "no notes exist yet".
        const collectAuditorNotesForAI = (item) => {
            const parts = [item && item.comment, item && item.ncrDescription, item && item.transcript]
                .filter((t) => t && String(t).trim());
            return parts.length ? parts.join('\n') : undefined;
        };

        if (aiBtn) {
            aiBtn.addEventListener('click', async () => {
                if (!aiTargets.length) return;
                if (typeof AI_SERVICE === 'undefined' || typeof AI_SERVICE.suggestQuestionClause !== 'function') {
                    window.showNotification('AI clause suggestions are not available in this build.', 'error');
                    return;
                }

                aiBtn.disabled = true;
                const standard = resolveStandardForAI();
                const total = aiTargets.length;
                let done = 0;
                let succeeded = 0;
                if (aiProgress) aiProgress.textContent = 'Suggesting… 0 / ' + total;

                const runOne = async (i) => {
                    const e = entries[i];
                    const payload = { question: e.requirement, sourceClause: e.clause, standard, status: e.status };
                    const notes = collectAuditorNotesForAI(e.item);
                    if (notes) payload.auditorNotes = notes;

                    const badgeSlot = document.querySelector('.rac-conf-badge[data-row="' + i + '"]');
                    const proposalSlot = document.querySelector('.rac-proposal-slot[data-row="' + i + '"]');

                    try {
                        const suggestion = await AI_SERVICE.suggestQuestionClause(payload);
                        if (!suggestion || suggestion.insufficient || !suggestion.clause) {
                            // Honest "we looked and found nothing safe" — never a
                            // guessed clause standing in for a real answer.
                            if (badgeSlot) badgeSlot.innerHTML = aiInsufficientNote(suggestion && suggestion.reason);
                            return;
                        }
                        if (badgeSlot) badgeSlot.innerHTML = aiCriterionBadge(suggestion.confidence, suggestion.reason);
                        if (proposalSlot) {
                            const reasonAttr = esc(suggestion.reason || 'No reason returned.');
                            proposalSlot.innerHTML = '<label style="display:flex;gap:0.35rem;align-items:center;font-size:0.78rem;cursor:pointer;margin-bottom:0.3rem;color:#5b21b6;" title="' + reasonAttr + '">'
                                + '<input type="checkbox" class="rac-use rac-use-ai" data-row="' + i + '" data-suggested="' + esc(suggestion.clause) + '"> use ' + esc(suggestion.clause)
                                + ' <i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.65rem;"></i></label>';
                            succeeded++;
                        }
                    } catch (err) {
                        console.warn('suggestQuestionClause failed for row', i, err);
                        if (badgeSlot) badgeSlot.innerHTML = '<span style="font-size:0.7rem;color:#dc2626;">AI suggestion failed for this row — try again or enter it manually.</span>';
                    } finally {
                        done++;
                        if (aiProgress) aiProgress.textContent = 'Suggesting… ' + done + ' / ' + total;
                    }
                };

                // Bounded-concurrency pool: a handful of workers pulling from a
                // shared cursor — not Promise.all(aiTargets.map(...)) (unbounded,
                // fires every row at once) and not a for-await loop (serial, slow
                // for a review with dozens of blank rows).
                let cursor = 0;
                const worker = async () => {
                    while (cursor < aiTargets.length) {
                        const idx = aiTargets[cursor++];
                        await runOne(idx);
                    }
                };

                try {
                    await Promise.all(Array.from({ length: Math.min(3, aiTargets.length) }, worker));
                } catch (err) {
                    // runOne catches its own row's rejection, so only a bug in the
                    // pool machinery itself lands here — nothing has been
                    // silently mis-filled, so just report it and stop.
                    console.error('AI clause suggestion batch failed:', err);
                    window.showNotification('AI clause suggestions failed to run: ' + (err && err.message ? err.message : 'unknown error'), 'error');
                    aiBtn.disabled = false;
                    if (aiProgress) aiProgress.textContent = '';
                    return;
                }

                aiBtn.disabled = false;
                if (aiProgress) aiProgress.textContent = '';
                window.showNotification('AI suggested ' + succeeded + ' of ' + total + ' clause(s) — review and tick “use” to accept.', succeeded ? 'success' : 'info');
                if (aiToggleAll) {
                    aiToggleAll.disabled = succeeded === 0;
                    aiToggleAll.title = succeeded ? 'Tick every AI proposal at once — still requires Save to apply.' : 'Run "Suggest clauses with AI" first.';
                }
            });
        }

        // Convenience for a review with dozens of AI proposals: tick/untick
        // them all at once. Dispatches a real bubbling 'change' event so the
        // delegated .rac-use listener above (which fills rac-input) fires the
        // same way it would for a manual click — this never bypasses that path.
        if (aiToggleAll) {
            aiToggleAll.addEventListener('change', () => {
                document.querySelectorAll('.rac-use-ai').forEach((box) => {
                    box.checked = aiToggleAll.checked;
                    box.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        }
    };

    /**
     * "Record technical review" fix action for the issuance-gate warning
     * (data-action target — see the button rendered in runReportIntegrityCheck).
     * Writes report.technicalReview {reviewer, outcome, date, notes} — the same
     * structure the preview modal's Signature section edits — then persists and
     * re-runs the check so the warning clears immediately.
     */
    window.recordTechnicalReview = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }
        const tr = (report.technicalReview && typeof report.technicalReview === 'object')
            ? report.technicalReview
            : { reviewer: report.technicalReviewer || '', outcome: '', date: '', notes: '' };
        const esc = window.UTILS.escapeHtml;
        const today = new Date().toISOString().split('T')[0];
        // The audit team, for the independence check (ISO/IEC 17021-1 9.5).
        const plan = (state.auditPlans || []).find(p => String(p.id) === String(report.planId)) || null;
        const RI = window.ReportIntegrity || {};
        const team = typeof RI.auditTeamOf === 'function' ? RI.auditTeamOf(report, plan) : [];
        const prior = tr.recordedBy && tr.recordedBy.name
            ? `<p style="margin:0 0 0.75rem;font-size:0.8rem;color:var(--text-secondary);">Last recorded by ${esc(tr.recordedBy.name)}${tr.recordedBy.role ? ' (' + esc(tr.recordedBy.role) + ')' : ''}${tr.recordedBy.at ? ' on ' + esc(String(tr.recordedBy.at).slice(0, 10)) : ''}.</p>`
            : '';

        window.DataService.openFormModal('Record Technical Review', `
            ${prior}
            <p style="margin:0 0 0.75rem;font-size:0.8rem;color:var(--text-secondary);">The reviewer must not have been involved in the audit${team.length ? ' (audit team: ' + esc(team.join(', ')) + ')' : ''}. Your name is saved as the person recording this review.</p>
            <div class="form-group">
                <label>Technical reviewer <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="tr-reviewer-input" placeholder="Reviewer name" value="${esc(tr.reviewer || '')}">
            </div>
            <div class="form-group">
                <label>Outcome <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="tr-outcome-input">
                    <option value="" ${!tr.outcome ? 'selected' : ''}>— pending —</option>
                    <option value="Approved" ${tr.outcome === 'Approved' ? 'selected' : ''}>Approved</option>
                    <option value="Returned" ${tr.outcome === 'Returned' ? 'selected' : ''}>Returned (rework required)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Review date</label>
                <input type="date" class="form-control" id="tr-date-input" value="${esc(tr.date || today)}">
            </div>
            <div class="form-group">
                <label>Notes (optional)</label>
                <textarea class="form-control" id="tr-notes-input" rows="3">${esc(tr.notes || '')}</textarea>
            </div>
            <small id="tr-warning" style="display:none; color: #dc2626;"></small>
        `, () => {
            const reviewer = Sanitizer.sanitizeText(document.getElementById('tr-reviewer-input')?.value || '').trim();
            const outcome = document.getElementById('tr-outcome-input')?.value || '';
            const date = document.getElementById('tr-date-input')?.value || '';
            const notes = Sanitizer.sanitizeText(document.getElementById('tr-notes-input')?.value || '').trim();
            const warning = document.getElementById('tr-warning');
            if (!reviewer || !outcome) {
                if (warning) { warning.textContent = 'Reviewer name and outcome are both required.'; warning.style.display = 'block'; }
                return;
            }
            const member = typeof RI.reviewerOnAuditTeam === 'function' ? RI.reviewerOnAuditTeam(reviewer, report, plan) : '';
            if (member) {
                if (warning) { warning.textContent = member + ' was on the audit team. The technical review must be done by someone not involved in the audit (ISO/IEC 17021-1 9.5).'; warning.style.display = 'block'; }
                return;
            }
            // Who entered it, so a review recorded on someone's behalf says so.
            const recordedBy = typeof RI.reviewRecordedBy === 'function' ? RI.reviewRecordedBy() : null;
            report.technicalReview = { reviewer, outcome, date, notes, recordedBy };
            window.closeModal();
            persistAndRefreshIntegrity(reportId, 'Technical review recorded: ' + outcome + ' (' + reviewer + ').');
        });
    };

    /**
     * "Set audit scope" fix action for the issuance-gate scope blocker (data-
     * action target — see the button rendered in runReportIntegrityCheck).
     * The gate accepts report.scope OR the linked plan's objectives/scope/
     * criteria; this writes report.scope (report-level, always checked first)
     * and mirrors it onto an empty plan.scope so Plans views agree.
     */
    window.setAuditScope = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }
        const plan = (state.auditPlans || []).find(p => String(p.id) === String(report.planId));
        const current = report.scope || report.auditScope
            || (plan && (plan.auditObjectives || plan.scope || plan.auditCriteria)) || '';
        const esc = window.UTILS.escapeHtml;

        window.DataService.openFormModal('Set Audit Scope / Criteria', `
            <div class="form-group">
                <label>Audit scope &amp; criteria <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="scope-input" rows="5" placeholder="e.g. Provision of postal and logistics services at the Head Office, audited against ISO 9001:2015 clauses 4–10.">${esc(current)}</textarea>
                <small style="color: var(--text-secondary); display: block; margin-top: 0.35rem;">Printed on the report cover and checked by the issuance gate.</small>
                <small id="scope-warning" style="display:none; color: #dc2626;"></small>
            </div>
        `, () => {
            const value = Sanitizer.sanitizeText(document.getElementById('scope-input')?.value || '').trim();
            const warning = document.getElementById('scope-warning');
            if (value.length < 10) {
                if (warning) { warning.textContent = 'Enter a meaningful scope statement (at least 10 characters).'; warning.style.display = 'block'; }
                return;
            }
            report.scope = value;
            if (plan && !plan.scope) {
                plan.scope = value;
                // Plans sync in batch — SupabaseClient.syncAuditPlansToSupabase.
                // Not awaited, so a failure arrives as a rejection: report it
                // instead of losing it (local state persists via saveData).
                if (window.SupabaseClient && typeof window.SupabaseClient.syncAuditPlansToSupabase === 'function') {
                    Promise.resolve(window.SupabaseClient.syncAuditPlansToSupabase([plan])).catch(err => {
                        window.showNotification('The plan scope was saved on this device but not to the cloud: ' + (err && err.message || err), 'warning');
                    });
                }
            }
            window.closeModal();
            persistAndRefreshIntegrity(reportId, 'Audit scope recorded.');
        });
    };

    // ── "Review employee count" fix action (Report Integrity panel) ────────
    // W12 (report-integrity.js's checkW12EmployeeCount) flags a headcount
    // mentioned in audit evidence that contradicts the controlled
    // organization profile. Per spec, auditor free text must never silently
    // override controlled data — the auditor confirms explicitly, and only
    // then does the confirmed figure propagate to the client record. Both
    // figures are RECOMPUTED here from the client record and report evidence
    // (not parsed back out of the warning's message text), so the fix action
    // stays correct even when several evidence mentions exist.

    /** Controlled headcount — mirrors report-integrity.js's controlledEmployeeCount(). */
    function controlledEmployeeCountLocal(client) {
        if (!client) return null;
        const siteTotal = (Array.isArray(client.sites) ? client.sites : [])
            .reduce((acc, s) => acc + (parseInt(s && s.employees, 10) || 0), 0);
        if (siteTotal > 0) return siteTotal;
        const direct = parseInt(client.employees, 10);
        return isNaN(direct) ? null : direct;
    }

    /**
     * Every headcount mentioned in evidence that disagrees with `controlled`
     * — mirrors report-integrity.js's checkW12EmployeeCount source scan
     * (checklist comments + narrative fields, same regex) so this agrees
     * with the validator about what it's flagging.
     */
    function findEvidenceEmployeeCounts(report, controlled) {
        const re = /\b(\d{1,6})\s+(?:now\s+)?(?:total\s+)?empl\w*/gi;
        const sources = [];
        // `ref` locates the text so a caller can correct the note in place —
        // confirming a headcount fixes the PROFILE, but a note stating a
        // different number keeps its own warning, and until this existed there
        // was no path from the warning to the note that caused it.
        ((report && report.checklistProgress) || []).forEach((i, index) => {
            const text = String((i && (i.comment || i.ncrDescription)) || '').trim();
            if (text) {
                sources.push({
                    text, label: 'checklist comment',
                    ref: { kind: 'checklist', index, field: (i && i.comment) ? 'comment' : 'ncrDescription' }
                });
            }
        });
        const narrative = {
            'executive summary': { text: report && report.executiveSummary, field: 'executiveSummary' },
            'positive observations': { text: report && report.positiveObservations, field: 'positiveObservations' },
            'opportunities for improvement': { text: Array.isArray(report && report.ofi) ? report.ofi.join('\n') : (report && report.ofi), field: 'ofi' },
            'conclusion': { text: report && (report.editedConclusion || report.conclusion), field: (report && report.editedConclusion) ? 'editedConclusion' : 'conclusion' },
            'previous findings status': { text: report && report.previousFindingsStatus, field: 'previousFindingsStatus' }
        };
        Object.keys(narrative).forEach((label) => {
            const entry = narrative[label];
            const text = String(entry.text || '').trim();
            if (text) sources.push({ text, label, ref: { kind: 'narrative', field: entry.field } });
        });

        const found = [];
        const seen = {};
        sources.forEach(({ text, label, ref }) => {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                const stated = parseInt(m[1], 10);
                if (isNaN(stated) || stated === controlled) continue;
                // A number glued to a document code is not a headcount:
                // "FORM-004 Employee Training Record" is a form reference, and
                // reading it as "4 employees" produced a warning the offered
                // note-rewrite could never clear (\b4 cannot match inside 004).
                const prevChar = m.index > 0 ? text.charAt(m.index - 1) : '';
                if (/[-/._#]/.test(prevChar)) continue;
                const employeeWord = (m[0].match(/empl\w*$/i) || [''])[0];
                const tailText = text.slice(m.index + m[0].length);
                // Singular "Employee" opening a document title is a name, not a
                // count — a genuine count reads "4 employees".
                if (!/s$/i.test(employeeWord) && /^\s+(training|competenc|handbook|record|matrix|register|file|induction|onboard|appraisal)/i.test(tailText)) continue;
                const key = stated + '|' + label;
                if (seen[key]) continue;
                seen[key] = true;
                // `excerpt` gives the auditor the sentence they are about to
                // change, so a blind find-and-replace is never what they confirm.
                const start = Math.max(0, m.index - 60);
                const excerpt = (start > 0 ? '…' : '') + text.slice(start, Math.min(text.length, m.index + m[0].length + 60)).trim()
                    + (m.index + m[0].length + 60 < text.length ? '…' : '');
                found.push({ stated, label, ref, excerpt, matched: m[0] });
            }
        });
        return found;
    }

    /**
     * Write a confirmed headcount to the client's controlled record so it
     * propagates everywhere client.sites[]/client.employees is read. A
     * single-site client gets the figure directly. A multi-site client keeps
     * its existing relative site sizes: the new total is distributed
     * proportionally to each site's current share, with the last site
     * absorbing the rounding remainder so the sum is exact (site totals, not
     * a guess, drive the controlled figure — see controlledEmployeeCountLocal
     * above). A client with no per-site breakdown yet records the whole
     * figure on its first site rather than inventing a split with no basis.
     */
    function propagateEmployeeCount(client, newTotal) {
        const sites = Array.isArray(client.sites) ? client.sites : [];
        if (!sites.length) {
            client.employees = newTotal;
            return;
        }
        if (sites.length === 1) {
            sites[0].employees = newTotal;
            client.employees = newTotal;
            return;
        }
        const currentTotal = sites.reduce((acc, s) => acc + (parseInt(s && s.employees, 10) || 0), 0);
        if (currentTotal > 0) {
            let allocated = 0;
            sites.forEach((s, idx) => {
                if (idx === sites.length - 1) {
                    s.employees = newTotal - allocated;
                } else {
                    const share = Math.round((parseInt(s.employees, 10) || 0) / currentTotal * newTotal);
                    s.employees = share;
                    allocated += share;
                }
            });
        } else {
            sites[0].employees = newTotal;
        }
        client.employees = sites.reduce((acc, s) => acc + (parseInt(s && s.employees, 10) || 0), 0);
    }


    /**
     * "Review employee count" fix action for a Report Integrity W12 warning
     * (data-action target — see the button rendered in runReportIntegrityCheck).
     * Shows the controlled figure and every conflicting figure recomputed
     * from evidence, and requires the auditor to explicitly confirm a real
     * headcount before anything changes. On confirm, writes the controlled
     * client record (client.sites[]/client.employees) via
     * propagateEmployeeCount and persists through window.DataService.syncClient
     * — the same path clients-org-setup.js uses for a site edit — then
     * refreshes the integrity check. Closing the dialog without confirming
     * changes nothing (dismissed as not a real change).
     */
    window.reviewEmployeeCount = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }
        const plan = (state.auditPlans || []).find(p => String(p.id) === String(report.planId));
        const client = window.DataService.resolveReportClient(report, plan);
        if (!client) { window.showNotification('Could not resolve the client for this report.', 'error'); return; }

        const controlled = controlledEmployeeCountLocal(client);
        const evidence = findEvidenceEmployeeCounts(report, controlled);
        if (!evidence.length) {
            window.showNotification('No conflicting headcount found in evidence — re-run the check.', 'info');
            return;
        }

        // Default to the most recently authored mention as the likely-current
        // figure; the auditor can still adjust it before confirming.
        const suggested = evidence[evidence.length - 1].stated;
        const esc = window.UTILS.escapeHtml;
        const evidenceListHtml = evidence.map(e => `<li><strong>${esc(String(e.stated))}</strong> employees — <em>${esc(e.label)}</em></li>`).join('');

        // How many DIFFERENT headcounts the evidence states. When there is more
        // than one, no single controlled figure can satisfy the check: confirming
        // 5 still leaves a note saying 4. Saying "may have changed from 8 to 5"
        // in that case is misleading — it reads as one pending change, so an
        // auditor confirms it, sees the warning persist, and reasonably concludes
        // the field did not save. It did; the contradiction is between the NOTES.
        const distinctFigures = Array.from(new Set(evidence.map(e => e.stated)));
        const conflictingNotes = distinctFigures.length > 1;

        const leadIn = conflictingNotes
            ? `<div style="background:#fffbeb;border-left:3px solid #d97706;border-radius:0 6px 6px 0;padding:0.6rem 0.85rem;font-size:0.88rem;color:#92400e;line-height:1.5;">
                   <strong>The evidence contradicts itself.</strong> It states ${distinctFigures.length} different headcounts (${esc(distinctFigures.join(', '))}), so they disagree with each other, not only with the profile.
                   Confirming one figure here <strong>cannot clear the others</strong> — the remaining warning(s) will stay until the note(s) stating a different number are corrected in the checklist or narrative.
               </div>`
            : `<p style="font-size: 0.9rem; color: #1e293b;">Auditor evidence indicates employee count may have changed from ${esc(String(controlled))} to ${esc(String(suggested))}. Update organization profile?</p>`;

        window.DataService.openFormModal('Review Employee Count', `
            <div class="form-group">
                <label>Controlled organization profile</label>
                <div style="padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">${esc(String(controlled))} employees</div>
            </div>
            <div class="form-group">
                <label>Figure(s) found in audit evidence</label>
                <ul style="margin: 0.25rem 0 0; padding-left: 1.25rem; font-size: 0.85rem;">${evidenceListHtml}</ul>
            </div>
            ${leadIn}
            <div class="form-group" style="margin-top: 0.85rem;">
                <label>Confirmed headcount <span style="color: var(--danger-color);">*</span></label>
                <input type="number" min="0" class="form-control" id="employee-count-input" value="${esc(String(suggested))}">
                <small id="employee-count-warning" style="display:none; color: #dc2626; margin-top: 0.35rem;"></small>
            </div>
            <div class="form-group" style="margin-top: 0.9rem;">
                <label>Notes stating a different figure</label>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.4rem;">
                    Tick a note to rewrite its headcount to the confirmed figure above. Only the number changes — the wording stays exactly as written. Untick to leave a note alone.
                </div>
                <div style="max-height:34vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:0.25rem 0.5rem;">
                    ${evidence.map((e, i) => `
                    <label style="display:flex;gap:0.55rem;align-items:flex-start;padding:0.5rem 0.25rem;border-bottom:1px solid #f1f5f9;cursor:pointer;">
                        <input type="checkbox" class="ec-fix" data-idx="${i}" style="margin-top:0.2rem;">
                        <span style="font-size:0.82rem;line-height:1.45;">
                            <strong>${esc(String(e.stated))}</strong> in <em>${esc(e.label)}</em>
                            <span style="display:block;color:#475569;margin-top:0.15rem;">“${esc(e.excerpt || '')}”</span>
                        </span>
                    </label>`).join('')}
                </div>
            </div>
            <small style="color: var(--text-secondary); display: block; margin-top: 0.35rem;">Confirming updates the client's controlled organization profile everywhere it is used. Ticked notes are rewritten to agree with it.</small>
        `, () => {
            const input = document.getElementById('employee-count-input');
            const warning = document.getElementById('employee-count-warning');
            const value = parseInt((input && input.value) || '', 10);
            if (isNaN(value) || value < 0) {
                if (warning) { warning.textContent = 'Enter a valid non-negative headcount.'; warning.style.display = 'block'; }
                return;
            }

            // Rewrite the notes the auditor ticked, BEFORE persisting, so the
            // profile write and the note edits land in one save.
            const ticked = Array.from(document.querySelectorAll('.ec-fix:checked'))
                .map(el => evidence[parseInt(el.getAttribute('data-idx'), 10)])
                .filter(Boolean);
            let notesFixed = 0;
            ticked.forEach((e) => {
                if (e.stated === value) return; // already agrees; nothing to rewrite
                if (correctHeadcountInNote(report, e.ref, e.stated, value)) notesFixed++;
            });

            propagateEmployeeCount(client, value);
            window.closeModal();
            window.DataService.syncClient(client);

            // Report honestly on what this confirmation could and could not
            // resolve. Any evidence figure still differing from the confirmed
            // headcount keeps its own W12 warning — the profile is now correct,
            // that note is not, and only the auditor can decide which is wrong.
            const untouched = distinctFigures.filter(n =>
                n !== value && !ticked.some(t => t.stated === n));
            const fixedNote = notesFixed ? ` ${notesFixed} note(s) rewritten to match.` : '';
            if (untouched.length) {
                persistAndRefreshIntegrity(reportId,
                    `Profile updated to ${value}.${fixedNote} ${untouched.length} note(s) still state ${untouched.join(', ')} — tick them here, or edit the text, to clear the remaining warning(s).`,
                    'warning');
            } else {
                persistAndRefreshIntegrity(reportId,
                    `Employee count confirmed at ${value}.${fixedNote}`);
            }
        });
    };

    // ── "Confirm 8.3 applicability" fix action (Report Integrity panel) ────
    // W13 (report-integrity.js's checkW13DesignApplicability) flags a
    // scope/applicability conflict: certified activities indicate design and
    // development work while clause 8.3 has been treated as not applicable.
    // Per spec, applicability must never be inferred from keywords alone —
    // this requires the auditor's explicit decision, with a non-trivial
    // written justification whenever the auditor still excludes 8.3.

    /** True once a justification reads as a real explanation, not a token dismissal ("n/a", "no"). */
    function isNonTrivialJustification(text) {
        const trimmed = String(text || '').trim();
        const words = trimmed.split(/\s+/).filter(Boolean);
        return words.length >= 3 && trimmed.length >= 15;
    }

    /**
     * "Confirm 8.3 applicability" fix action for the Report Integrity W13
     * warning (data-action target — see the button rendered in
     * runReportIntegrityCheck). States the conflict plainly and offers the
     * auditor exactly two explicit outcomes — the system records the
     * decision, it never determines applicability itself. Writes
     * report.applicabilityDecisions['8.3'] = {applicable, justification,
     * decidedBy, decidedAt} and persists via persistAndRefreshIntegrity, the
     * same path the other fix actions use. Note: checkW13DesignApplicability
     * itself is a text heuristic over scope/checklist/narrative wording (see
     * report-integrity.js) and does not consult this decision record, so the
     * warning can legitimately keep appearing after a decision is recorded —
     * that's expected: it is a nag to re-review, not a data mismatch this
     * action is meant to erase, and the recorded decision is what satisfies
     * the "explicit auditor justification" requirement regardless.
     */
    window.confirmDesignApplicability = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const existing = (report.applicabilityDecisions && report.applicabilityDecisions['8.3']) || null;
        const esc = window.UTILS.escapeHtml;

        window.DataService.openFormModal('Confirm Clause 8.3 Applicability', `
            <p style="font-size: 0.9rem; color: #1e293b;">The certified scope indicates design and development activity, but clause 8.3 (Design and Development) has been treated as not applicable. This is an auditor decision — it cannot be inferred from keywords alone.</p>
            <div class="form-group">
                <label>Decision <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="applicability-decision-input">
                    <option value="" ${!existing ? 'selected' : ''}>— select —</option>
                    <option value="applicable" ${existing && existing.applicable === true ? 'selected' : ''}>Clause 8.3 IS applicable — must be assessed</option>
                    <option value="excluded" ${existing && existing.applicable === false ? 'selected' : ''}>Exclusion of clause 8.3 is justified</option>
                </select>
            </div>
            <div class="form-group">
                <label>Justification <span style="color: var(--danger-color);">*</span> when excluding</label>
                <textarea class="form-control" id="applicability-justification-input" rows="3" placeholder="Explain why clause 8.3 does or does not apply to the certified scope.">${esc((existing && existing.justification) || '')}</textarea>
                <small style="color: var(--text-secondary); display: block; margin-top: 0.35rem;">Required and must be a real explanation (not "N/A" or one word) when excluding clause 8.3.</small>
                <small id="applicability-warning" style="display:none; color: #dc2626; margin-top: 0.35rem;"></small>
            </div>
        `, () => {
            const decision = document.getElementById('applicability-decision-input')?.value || '';
            const justification = Sanitizer.sanitizeText(document.getElementById('applicability-justification-input')?.value || '').trim();
            const warning = document.getElementById('applicability-warning');

            if (decision !== 'applicable' && decision !== 'excluded') {
                if (warning) { warning.textContent = 'Select whether clause 8.3 is applicable or the exclusion is justified.'; warning.style.display = 'block'; }
                return;
            }
            const applicable = decision === 'applicable';
            if (!applicable && !isNonTrivialJustification(justification)) {
                if (warning) { warning.textContent = 'Enter a real justification for excluding clause 8.3 — a blank or one-word entry is not acceptable.'; warning.style.display = 'block'; }
                return;
            }

            if (!report.applicabilityDecisions) report.applicabilityDecisions = {};
            report.applicabilityDecisions['8.3'] = {
                applicable,
                justification,
                decidedBy: window.state.currentUser?.name || 'Auditor',
                decidedAt: new Date().toISOString()
            };

            window.closeModal();
            persistAndRefreshIntegrity(reportId, applicable
                ? 'Clause 8.3 recorded as applicable — assess it in the checklist.'
                : 'Clause 8.3 exclusion justification recorded.');
        });
    };

    // Export functions
    window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
    window.renderAuditExecution = renderAuditExecutionEnhanced;
    window.renderExecutionDetail = renderExecutionDetail;
    window.saveChecklist = saveChecklist;
    window.createNCR = createNCR;
    window.editExecutionNCR = editExecutionNCR;

    /**
     * Open the checklist item a nonconformity was raised from.
     *
     * A checklist-raised NCR is not editable in the NCR table — its wording and
     * classification belong to the checklist item that produced it. The action
     * button said so in a toast and then did nothing, leaving the auditor to
     * find the item themselves among a hundred-odd rows. The record already
     * carries sourceChecklistId and sourceItemIdx, which is exactly the id the
     * checklist row is rendered with, so it can simply go there.
     */
    window.openNCRInChecklist = function (sourceChecklistId, sourceItemIdx) {
        const checklistId = String(sourceChecklistId == null ? '' : sourceChecklistId).trim();
        const itemIdx = String(sourceItemIdx == null ? '' : sourceItemIdx).trim();
        if (!checklistId || !itemIdx) {
            window.showNotification('This nonconformity does not record which checklist item raised it, so it cannot be opened automatically.', 'warning');
            return;
        }

        const checklistTab = document.querySelector('.tab-btn[data-tab="checklist"]');
        if (!checklistTab) {
            window.showNotification('The Checklist tab is not available on this screen.', 'warning');
            return;
        }
        checklistTab.click();

        // The tab renders synchronously, but the row lives inside an accordion
        // that may be collapsed — open it before scrolling, or the item is
        // scrolled to while it has no height and the auditor lands nowhere.
        setTimeout(function () {
            const row = document.getElementById('row-' + checklistId + '-' + itemIdx);
            if (!row) {
                window.showNotification('That checklist item is no longer in this audit — the checklist may have been rebuilt since the nonconformity was raised.', 'warning');
                return;
            }
            const section = row.closest('.accordion-content');
            if (section && section.style.display === 'none') section.style.display = 'block';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // A brief highlight so the item is findable once the scroll settles.
            const previousBorder = row.style.borderLeftColor;
            row.style.borderLeftColor = '#8b5cf6';
            row.style.transition = 'border-left-color 0.4s';
            setTimeout(function () { row.style.borderLeftColor = previousBorder; }, 2500);
        }, 80);
    };
    window.createCAPA = createCAPA;
    // Note: submitForReview, publishReport, revertToDraft, saveReportDraft,
    //       generateAIConclusion, generateAuditReport are now in reporting-module.js

    // Evidence handling extracted to execution-evidence.js
    // Generate Printable Report - Enhanced Version
    // Generate Printable Report - Enhanced Version
    // Reporting, AI & PDF export extracted to execution-reporting.js
    // Persistent stream for remote audits
    // Screen capture & webcam extracted to execution-evidence.js

    // These document-level delegates read only the DOM and window.*, so bind
    // them once: this function runs on every tab click, and re-binding made
    // each click (bulk status updates included) fire once per tab visited.
    if (!document._auditExecutionDelegatesBound) {
        document._auditExecutionDelegatesBound = true;
        bindExecutionDocumentDelegates();
    }

    // Helper to update meeting records (Opening/Closing)
    window.updateMeetingData = function (reportId, meetingType, field, value) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) return;

        if (!report[meetingType + 'Meeting']) {
            report[meetingType + 'Meeting'] = {};
        }

        if (field === 'attendees') {
            // Split by comma and clean up
            report[meetingType + 'Meeting'][field] = value.split(',').map(s => s.trim()).filter(s => s);
        } else {
            report[meetingType + 'Meeting'][field] = value;
        }

        window.saveData();
        window.saveChecklist(reportId);
    };

}

function bindExecutionDocumentDelegates() {
    // Global event delegation for section checkboxes (works with dynamically rendered content)
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('section-checkbox')) {
            e.stopPropagation();
            const sectionId = e.target.getAttribute('data-section-id');
            const isChecked = e.target.checked;

            // Find all items in this section and toggle selection
            const section = document.getElementById(sectionId);
            if (!section) {
                console.error('Section not found:', sectionId);
                return;
            }

            const items = section.querySelectorAll('.checklist-item');

            items.forEach((item, _idx) => {
                // Toggle the individual checkbox too
                const itemCheckbox = item.querySelector('.item-checkbox');
                if (itemCheckbox) {
                    itemCheckbox.checked = isChecked;
                }

                if (isChecked) {
                    item.classList.add('selected-item');
                    item.style.background = '#eff6ff';
                    item.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    item.classList.remove('selected-item');
                    item.style.background = '';
                    item.style.borderLeft = '4px solid #e2e8f0';
                }
            });

        }
    });

    // Global event delegation for individual item checkboxes
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('item-checkbox')) {
            const checkbox = e.target;
            const uniqueId = checkbox.getAttribute('data-unique-id');
            const row = document.getElementById('row-' + uniqueId);

            if (row) {
                if (checkbox.checked) {
                    row.classList.add('selected-item');
                    row.style.background = '#eff6ff';
                    row.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    row.classList.remove('selected-item');
                    row.style.background = '';
                    row.style.borderLeft = '4px solid #e2e8f0';
                }
            }
        }
    });

    // Global event delegation for bulk action buttons
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.bulk-action-btn');
        if (btn) {
            const action = btn.getAttribute('data-action');
            const reportId = btn.getAttribute('data-report-id');

            if (action && reportId) {
                window.bulkUpdateStatus(reportId, action);

                // Close menu
                const menu = document.getElementById('bulk-menu-' + reportId);
                if (menu) menu.classList.add('hidden');
            }
        }
    });

    // Global event delegation for status buttons (OK, NC, N/A) - using capture phase
    document.addEventListener('click', function (e) {
        // Check if clicked element or any parent has status-btn class
        let btn = e.target;

        // Log all clicks for debugging
        if (btn.classList && (btn.classList.contains('btn-nc') || btn.classList.contains('btn-ok') || btn.classList.contains('btn-na'))) {
            console.debug('[Execution] Status button clicked:', btn.className);
        }

        while (btn && btn.classList && !btn.classList.contains('status-btn')) {
            btn = btn.parentElement;
            if (!btn || btn === document.body) {
                btn = null;
                break;
            }
        }

        if (btn && btn.classList && btn.classList.contains('status-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const uniqueId = btn.getAttribute('data-unique-id');
            const status = btn.getAttribute('data-status');

            if (uniqueId && status) {
                window.setChecklistStatus(uniqueId, status);
            }
        }
    }, true); // true = capture phase
}

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _autoFillPersonnel, toggleAllAccordions, initClauseDragReorder, toggleSectionSelection, setChecklistStatus, updateAccordionCounter, addCustomQuestion, saveChecklist, filterChecklistItems, bulkUpdateStatus, submitToLeadAuditor, startDictation, _collectMeetingAttendees, addCustomMeetingAttendee, saveMeetingRecords, renderAuditExecutionEnhanced, renderAuditExecution, renderExecutionDetail, createNCR, editExecutionNCR, createCAPA, openCreateReportModal, openEditReportModal, updateMeetingData };
}

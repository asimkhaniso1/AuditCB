// ============================================
// DASHBOARD UPCOMING AUDITS  (window.UpcomingAudits)
// ============================================
// The dashboard's "Upcoming Audits" panel: a list (soonest first) and a month
// calendar of every OPEN audit plan the viewer can see. The "Upcoming Audits"
// KPI card reads its figure from the same model, so the tile and the panel
// can never disagree.
//
// "Open" = not completed (DataService.isPlanCompleted) and not cancelled.
// UPCOMING = open and not yet over (in progress today, or starting later),
// listed first, soonest first; `count` (the badge and the KPI tile) counts
// only these. Open plans with no date, and plans whose dates have passed but
// were never closed, stay on the list in collapsed secondary groups below —
// they never lead the panel and never inflate the upcoming figure.
//
// DUE, NOT YET PLANNED (dueUnplanned): audits the certificate cycle says are
// owed — the same record the client's cycle card shows (ReportStats.cycleState
// + AuditPlanningDomain.resolveCertificateCycle) — whose recommended window is
// open or opens within DUE_HORIZON_DAYS, with no plan for that client, scheme
// and audit type near the due date and no audit already on record. They are
// listed in their own group and never counted as upcoming (nothing is booked).
//
// Dates are LOCAL calendar days as 'YYYY-MM-DD' strings (plans store a date
// column), compared as strings — never as instants, which mis-sort the first
// or last day east of UTC.
//
// CONTRACT
//   UpcomingAudits.build(plans, {today, auditors, isCompleted}) -> {today, items, count, buckets, counts}
//   UpcomingAudits.monthGrid(year, month0, items, today)        -> {label, weeks:[{days, segments, laneCount}]}
//   UpcomingAudits.panelHtml(model)  -> the dashboard card (list or calendar, per the viewer's saved choice)
//   UpcomingAudits.showList / showCalendar / prevMonth / nextMonth / thisMonth / scrollToPanel
//     (data-action="UpcomingAudits_showList" etc. — event-delegator's Obj_method form)

(function (global) {
    'use strict';

    const VIEW_KEY = 'audit360.dashboard.upcomingView';
    const PANEL_ID = 'dashboard-upcoming-audits';
    const MAX_SPAN_DAYS = 62;   // a mistyped end date must not paint months of calendar
    const MAX_LANES = 3;        // audits shown per calendar day before "+N more"
    const DUE_HORIZON_DAYS = 90; // list a cycle audit once its window opens within this
    const PLAN_MATCH_DAYS = 183; // a plan this close to the due date covers it (milestones are 12 months apart)
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
    const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Upcoming buckets first (soonest first); secondary ones after, collapsed.
    const BUCKETS = [
        { key: 'now', label: 'In progress / today' },
        { key: 'week', label: 'Next 7 days' },
        { key: 'month', label: 'Next 30 days' },
        { key: 'later', label: 'Later' },
        { key: 'unscheduled', label: 'Date not set', secondary: true },
        { key: 'overdue', label: 'Dates passed — not closed', secondary: true }
    ];
    const UPCOMING_KEYS = BUCKETS.filter(b => !b.secondary).map(b => b.key);
    const BUCKET_ORDER = BUCKETS.reduce((acc, b, i) => { acc[b.key] = i; return acc; }, {});

    const TYPES = [
        { key: 'stage1', label: 'Stage 1' },
        { key: 'stage2', label: 'Stage 2' },
        { key: 'surveillance', label: 'Surveillance' },
        { key: 'recert', label: 'Recertification' },
        { key: 'other', label: 'Other' }
    ];

    // ── Dates ─────────────────────────────────────────────────────────

    function pad(n) { return String(n).padStart(2, '0'); }
    function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

    function toDay(v) {
        if (v == null || v === '') return null;
        if (v instanceof Date) return isNaN(v.getTime()) ? null : isoOf(v);
        const s = String(v).trim();
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (m) {
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            return d.getMonth() === Number(m[2]) - 1 ? `${m[1]}-${m[2]}-${m[3]}` : null;
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : isoOf(d);
    }

    function parseDay(iso) {
        const p = iso.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function addDays(iso, n) {
        const d = parseDay(iso);
        d.setDate(d.getDate() + n);
        return isoOf(d);
    }

    // Whole days from a to b (b - a). Rounded so a DST change can't make it 0.96.
    function diffDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }

    function formatRange(start, end) {
        if (!start) return 'Date not set';
        const s = parseDay(start);
        const e = parseDay(end || start);
        const sd = `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
        if (start === (end || start)) return `${sd} ${s.getFullYear()}`;
        if (s.getFullYear() !== e.getFullYear()) return `${sd} ${s.getFullYear()} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        if (s.getMonth() !== e.getMonth()) return `${sd} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
        return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()}`;
    }

    // ── Plan normalisation ────────────────────────────────────────────

    function defaultIsCompleted(plan) {
        return !!plan && (plan.status === 'Completed' || plan.status === 'Closed');
    }

    function isCancelled(plan) { return /cancel/i.test(String((plan && plan.status) || '')); }

    function typeKey(auditType) {
        const t = String(auditType || '').toLowerCase();
        if (/stage\s*-?\s*1|stage\s*one/.test(t)) return 'stage1';
        if (/stage\s*-?\s*2|stage\s*two/.test(t)) return 'stage2';
        if (/surveil/.test(t)) return 'surveillance';
        if (/re-?\s*cert/.test(t)) return 'recert';
        return 'other';
    }

    function auditorName(ref, auditors) {
        if (ref == null || ref === '') return '';
        if (typeof ref === 'object') return String(ref.name || '').trim();
        const hit = (auditors || []).find(a => a && a.id != null && String(a.id) === String(ref));
        return hit ? String(hit.name || '').trim() : String(ref).trim();
    }

    function leadOf(plan, auditors) {
        return auditorName(plan.leadAuditor, auditors)
            || auditorName(Array.isArray(plan.team) ? plan.team[0] : '', auditors)
            || auditorName(Array.isArray(plan.auditors) ? plan.auditors[0] : '', auditors);
    }

    function standardsOf(plan) {
        const raw = Array.isArray(plan.standards) && plan.standards.length
            ? plan.standards
            : String(plan.standard || '').split(',');
        const out = [];
        raw.forEach(s => {
            const name = String(s && typeof s === 'object' ? (s.name || s.code || '') : (s == null ? '' : s)).trim();
            if (name && !out.includes(name)) out.push(name);
        });
        return out;
    }

    function normalizePlan(plan, auditors) {
        const start = toDay(plan.date || plan.startDate || plan.start_date);
        let end = start ? toDay(plan.endDate || plan.end_date) : null;
        if (start && (!end || end < start)) end = start;
        if (start && diffDays(start, end) > MAX_SPAN_DAYS) end = addDays(start, MAX_SPAN_DAYS);
        const auditType = String(plan.auditType || plan.type || (plan.certificationCycle && plan.certificationCycle.auditType) || '').trim();
        return {
            id: plan.id,
            client: String(plan.client || plan.clientName || 'Unnamed client').trim(),
            clientId: plan.clientId == null ? null : plan.clientId,
            standards: standardsOf(plan),
            auditType: auditType || 'Audit',
            typeKey: typeKey(auditType),
            start,
            end,
            lead: leadOf(plan, auditors),
            status: String(plan.status || 'Planned').trim()
        };
    }

    function bucketOf(item, today) {
        if (!item.start) return 'unscheduled';
        if (item.end < today) return 'overdue';
        if (item.start <= today) return 'now';
        const ahead = diffDays(today, item.start);
        if (ahead <= 7) return 'week';
        if (ahead <= 30) return 'month';
        return 'later';
    }

    function relativeLabel(item, today) {
        if (!item.start) return 'Date not set';
        if (item.end < today) {
            const n = diffDays(item.end, today);
            return `Ended ${n} day${n === 1 ? '' : 's'} ago`;
        }
        if (item.start <= today) {
            const len = diffDays(item.start, item.end) + 1;
            if (len === 1) return 'Today';
            return `Day ${diffDays(item.start, today) + 1} of ${len}`;
        }
        const n = diffDays(today, item.start);
        return n === 1 ? 'Tomorrow' : `In ${n} days`;
    }

    function compareItems(a, b) {
        const bo = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
        if (bo) return bo;
        // Passed-but-open: most recently ended first — the freshest is the
        // one most likely still to be closed out.
        if (a.bucket === 'overdue' && a.end !== b.end) return a.end > b.end ? -1 : 1;
        if (a.start !== b.start) return a.start < b.start ? -1 : 1;
        if (a.end !== b.end) return a.end < b.end ? -1 : 1;
        return a.client.localeCompare(b.client);
    }

    /**
     * The open audits the viewer can see, grouped: upcoming first (soonest
     * first), then undated, then dates-passed. `count` is the UPCOMING figure
     * only; `openCount` is every open plan. `plans` must already be
     * role-scoped (getVisiblePlans) — this never widens it.
     */
    function build(plans, opts) {
        const o = opts || {};
        const today = toDay(o.today || new Date());
        const isCompleted = typeof o.isCompleted === 'function' ? o.isCompleted : defaultIsCompleted;
        const items = (plans || [])
            .filter(p => p && !isCancelled(p) && !isCompleted(p))
            .map(p => {
                const it = normalizePlan(p, o.auditors);
                it.bucket = bucketOf(it, today);
                it.relative = relativeLabel(it, today);
                return it;
            })
            .sort(compareItems);
        const counts = {};
        BUCKETS.forEach(b => { counts[b.key] = 0; });
        items.forEach(it => { counts[it.bucket]++; });
        const buckets = BUCKETS
            .filter(b => counts[b.key] > 0)
            .map(b => ({ key: b.key, label: b.label, secondary: !!b.secondary, items: items.filter(it => it.bucket === b.key) }));
        const count = UPCOMING_KEYS.reduce((s, k) => s + counts[k], 0);
        const due = Array.isArray(o.due) ? o.due : [];
        return { today, items, count, openCount: items.length, buckets, counts, due };
    }

    // ── Due by certificate cycle, not yet planned ────────────────────

    const LIVE_CERT = cert => !!cert && !!String(cert.standard || '').trim()
        && !/withdrawn|expired|suspended|cancel/i.test(String(cert.status || ''))
        && !!toDay(cert.initialDate || cert.currentIssue || cert.issueDate);
    const INACTIVE_CLIENT = client => /withdrawn|suspend|inactive|cancel|terminated/i.test(String((client && client.status) || ''));

    function milestoneKey(auditType) {
        const t = String(auditType || '');
        if (/re-?\s*cert/i.test(t)) return 'recert';
        if (/surveillance\s*2/i.test(t)) return 's2';
        if (/surveillance\s*1/i.test(t)) return 's1';
        return null;
    }

    // The certificate the client's cycle card shows for each standard: the
    // Active one, else the most recently issued.
    function cardCertificates(client) {
        const certs = (Array.isArray(client.certificates) ? client.certificates : []).filter(LIVE_CERT);
        const byStd = new Map();
        certs.forEach(c => {
            const key = String(c.standard).trim().toLowerCase();
            const prev = byStd.get(key);
            const issued = x => toDay(x.currentIssue || x.initialDate || x.issueDate) || '';
            if (!prev
                || (c.status === 'Active' && prev.status !== 'Active')
                || ((c.status === 'Active') === (prev.status === 'Active') && issued(c) > issued(prev))) byStd.set(key, c);
        });
        return [...byStd.values()];
    }

    /**
     * Audits the certificate cycle says are owed soon with nothing planned.
     * deps: { today, cycleState, resolveCycle, belongsTo, coversStandard,
     *         reports, settings, horizonDays }
     * `clients` must already be role-scoped; `plans` should be ALL plans, so
     * a plan someone else made still counts as planned.
     */
    function dueUnplanned(clients, plans, deps) {
        const d = deps || {};
        if (typeof d.cycleState !== 'function' || typeof d.resolveCycle !== 'function') return [];
        const today = toDay(d.today || new Date());
        const todayDate = parseDay(today);
        const horizon = Number.isFinite(d.horizonDays) ? d.horizonDays : DUE_HORIZON_DAYS;
        const belongsTo = typeof d.belongsTo === 'function' ? d.belongsTo
            : (rec, c) => (rec.clientId != null && c.id != null ? String(rec.clientId) === String(c.id) : String(rec.client || '').trim().toLowerCase() === String(c.name || '').trim().toLowerCase());
        const covers = typeof d.coversStandard === 'function' ? d.coversStandard : () => true;
        const allPlans = (plans || []).filter(Boolean);
        const reports = d.reports || [];
        const found = [];

        (clients || []).forEach(client => {
            if (!client || INACTIVE_CLIENT(client)) return;
            cardCertificates(client).forEach((cert, index) => {
                let cs = null;
                let rec = null;
                try {
                    cs = d.cycleState({ client, standard: cert.standard, certificate: cert, allReports: reports, allPlans, today: todayDate });
                    rec = d.resolveCycle({ client, certificate: cert, index, now: todayDate, settings: d.settings || {}, cycleState: cs, allReports: reports, allPlans });
                } catch (_err) {
                    return; // one bad certificate record must not hide the rest
                }
                if (!rec || rec.complete || !rec.recommendedWindowStart || !rec.recommendedWindowEnd) return;
                const key = milestoneKey(rec.auditType);
                if (key && cs && cs.completed && cs.completed[key]) return; // already on record
                const windowStart = toDay(rec.recommendedWindowStart);
                const windowEnd = toDay(rec.recommendedWindowEnd);
                const due = toDay(rec.targetDate) || windowStart;
                if (!windowStart || !windowEnd || windowEnd < today) return; // window closed: not "coming up"
                if (diffDays(today, windowStart < due ? windowStart : due) > horizon) return;
                const family = typeKey(rec.auditType);
                const planned = allPlans.some(p => !isCancelled(p)
                    && belongsTo(p, client) && covers(p, cert.standard)
                    && typeKey(p.auditType || p.type) === family
                    && (() => { const pd = toDay(p.date || p.startDate || p.start_date); return !!pd && Math.abs(diffDays(due, pd)) <= PLAN_MATCH_DAYS; })());
                if (planned) return;
                found.push({
                    clientId: client.id == null ? null : client.id,
                    client: String(client.name || 'Unnamed client').trim(),
                    standards: [String(cert.standard).trim()],
                    auditType: rec.auditType, typeKey: family,
                    due, windowStart, windowEnd,
                    override: !!rec.override
                });
            });
        });

        // An integrated client owes one audit for certificates on the same cycle.
        const merged = new Map();
        found.forEach(it => {
            const k = [it.clientId == null ? it.client.toLowerCase() : it.clientId, it.auditType, it.windowStart, it.windowEnd].join('|');
            const prev = merged.get(k);
            if (!prev) { merged.set(k, it); return; }
            it.standards.forEach(s => { if (!prev.standards.includes(s)) prev.standards.push(s); });
            if (it.due < prev.due) prev.due = it.due;
        });
        return [...merged.values()].map(it => Object.assign(it, {
            bucket: 'due',
            windowOpen: it.windowStart <= today,
            relative: dueLabel(it, today)
        })).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.client.localeCompare(b.client)));
    }

    function dueLabel(it, today) {
        if (it.due === today) return 'Due today';
        if (it.due > today) {
            const n = diffDays(today, it.due);
            return n === 1 ? 'Due tomorrow' : `Due in ${n} days`;
        }
        const left = diffDays(today, it.windowEnd);
        return `Window closes ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`}`;
    }

    // ── Month grid ───────────────────────────────────────────────────

    /**
     * Monday-first weeks covering the month. Each week carries its audits as
     * segments (col 0-6, span) on stacked lanes so a multi-day audit draws as
     * one bar, split only where it crosses a week boundary.
     */
    function monthGrid(year, month0, items, today) {
        const first = new Date(year, month0, 1);
        const lastIso = isoOf(new Date(year, month0 + 1, 0));
        const offset = (first.getDay() + 6) % 7;
        let cursor = addDays(isoOf(first), -offset);
        const scheduled = (items || []).filter(it => it.start);
        const weeks = [];
        while (cursor <= lastIso) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                const iso = addDays(cursor, i);
                const d = parseDay(iso);
                days.push({ iso, day: d.getDate(), inMonth: d.getMonth() === month0, isToday: iso === today, isWeekend: i >= 5 });
            }
            const weekStart = days[0].iso;
            const weekEnd = days[6].iso;
            const segments = scheduled
                .filter(it => it.start <= weekEnd && it.end >= weekStart)
                .map(it => {
                    const s = it.start < weekStart ? weekStart : it.start;
                    const e = it.end > weekEnd ? weekEnd : it.end;
                    return {
                        item: it,
                        col: diffDays(weekStart, s),
                        span: diffDays(s, e) + 1,
                        continuesBefore: it.start < weekStart,
                        continuesAfter: it.end > weekEnd
                    };
                })
                .sort((a, b) => (a.col - b.col) || (b.span - a.span) || a.item.client.localeCompare(b.item.client));
            const laneEnds = [];
            segments.forEach(seg => {
                let lane = laneEnds.findIndex(end => end < seg.col);
                if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
                laneEnds[lane] = seg.col + seg.span - 1;
                seg.lane = lane;
            });
            weeks.push({ days, segments, laneCount: laneEnds.length });
            cursor = addDays(weekEnd, 1);
        }
        const monthStart = isoOf(first);
        const inMonth = scheduled.filter(it => it.start <= lastIso && it.end >= monthStart).length;
        return { year, month: month0, label: `${MONTHS[month0]} ${year}`, weeks, count: inMonth };
    }

    // ── Rendering ────────────────────────────────────────────────────

    function esc(v) {
        const U = global.UTILS;
        if (U && typeof U.escapeHtml === 'function') return U.escapeHtml(v);
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
    }

    function slug(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

    function readView() {
        try {
            return global.localStorage && global.localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
        } catch (_err) {
            return 'list';
        }
    }

    function saveView(view) {
        try {
            if (global.localStorage) global.localStorage.setItem(VIEW_KEY, view);
        } catch (_err) {
            // Storage blocked (private window, policy): the choice lasts this page only.
        }
    }

    const ui = { model: null, view: 'list', year: 0, month: 0 };

    function rowHtml(it) {
        const day = it.start ? String(parseDay(it.start).getDate()) : 'TBC';
        const mon = it.start ? MONTHS_SHORT[parseDay(it.start).getMonth()] : '';
        const standards = it.standards.map(s => `<span class="ua-chip">${esc(s)}</span>`).join('');
        return `
            <button type="button" class="ua-row ua-type-${it.typeKey} ua-bucket-${it.bucket}" data-action="viewAuditPlan" data-id="${esc(it.id)}" aria-label="Open audit plan: ${esc(it.client)}, ${esc(it.auditType)}, ${esc(formatRange(it.start, it.end))}">
                <span class="ua-date"><span class="ua-date-day">${esc(day)}</span><span class="ua-date-mon">${esc(mon)}</span></span>
                <span class="ua-main">
                    <span class="ua-client">${esc(it.client)}</span>
                    <span class="ua-meta"><span class="ua-type">${esc(it.auditType)}</span>${standards}</span>
                </span>
                <span class="ua-side">
                    <span class="ua-when">${esc(it.relative)}</span>
                    <span class="ua-range">${esc(formatRange(it.start, it.end))}</span>
                    <span class="ua-lead"><i class="fa-solid fa-user-tie" aria-hidden="true"></i> ${it.lead ? esc(it.lead) : 'Lead not assigned'}</span>
                    <span class="status-badge status-${slug(it.status)}">${esc(it.status)}</span>
                </span>
            </button>`;
    }

    // A cycle audit with nothing booked: the row starts a plan for the client
    // (the planner derives the audit type and window from the same cycle).
    function dueRowHtml(it) {
        const d = parseDay(it.due);
        const standards = it.standards.map(s => `<span class="ua-chip">${esc(s)}</span>`).join('');
        const windowText = `Window ${formatRange(it.windowStart, it.windowEnd)}`;
        return `
            <button type="button" class="ua-row ua-row-due ua-type-${it.typeKey} ua-bucket-due" data-action="renderCreateAuditPlanForm" data-id="${esc(it.client)}" aria-label="Plan ${esc(it.auditType)} for ${esc(it.client)}, ${esc(it.relative)}, ${esc(windowText)}">
                <span class="ua-date"><span class="ua-date-day">${esc(String(d.getDate()))}</span><span class="ua-date-mon">${esc(MONTHS_SHORT[d.getMonth()])}</span></span>
                <span class="ua-main">
                    <span class="ua-client">${esc(it.client)}</span>
                    <span class="ua-meta"><span class="ua-type">${esc(it.auditType)}</span>${standards}</span>
                </span>
                <span class="ua-side">
                    <span class="ua-when">${esc(it.relative)}</span>
                    <span class="ua-range">${esc(windowText)}</span>
                    <span class="ua-lead"><i class="fa-solid fa-plus" aria-hidden="true"></i> Plan audit</span>
                    <span class="status-badge status-not-planned">Not planned</span>
                </span>
            </button>`;
    }

    function dueGroupHtml(model) {
        const due = model.due || [];
        if (!due.length) return '';
        return `
            <div class="ua-group ua-group-due">
                <div class="ua-group-title">Due by certificate cycle — not planned <span>${due.length}</span></div>
                ${due.map(dueRowHtml).join('')}
            </div>`;
    }

    function listHtml(model) {
        const primary = model.buckets.filter(b => !b.secondary);
        const secondary = model.buckets.filter(b => b.secondary);
        const dueGroup = dueGroupHtml(model);
        const empty = model.count ? '' : `
                <div class="ua-empty">
                    <i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
                    <p>No upcoming audits are scheduled.</p>
                    <button type="button" class="btn btn-sm btn-primary" data-action="renderModule" data-id="audit-planning">Plan an audit</button>
                </div>`;
        if (!primary.length && !secondary.length && !dueGroup) return empty;
        const groups = primary.map(b => `
            <div class="ua-group">
                <div class="ua-group-title">${esc(b.label)} <span>${b.items.length}</span></div>
                ${b.items.map(rowHtml).join('')}
            </div>`).join('');
        // Collapsed by default: these are housekeeping, not what is coming up.
        const extra = secondary.map(b => `
            <details class="ua-group ua-secondary ua-secondary-${b.key}">
                <summary class="ua-group-title">${esc(b.label)} <span>${b.items.length}</span></summary>
                ${b.items.map(rowHtml).join('')}
            </details>`).join('');
        return `<div class="ua-list">${empty}${groups}${dueGroup}${extra}</div>`;
    }

    function calendarHtml(model) {
        const grid = monthGrid(ui.year, ui.month, model.items, model.today);
        const unscheduled = model.counts.unscheduled;
        const dueCount = (model.due || []).length;
        const weeks = grid.weeks.map(w => {
            const lanes = Math.min(w.laneCount, MAX_LANES);
            const hidden = [0, 0, 0, 0, 0, 0, 0];
            w.segments.filter(s => s.lane >= MAX_LANES).forEach(s => {
                for (let c = s.col; c < s.col + s.span; c++) hidden[c]++;
            });
            const hasMore = hidden.some(n => n > 0);
            const rows = `1.75rem${lanes ? ` repeat(${lanes}, 1.45rem)` : ''}${hasMore ? ' 1.1rem' : ''} minmax(0.75rem, 1fr)`;
            const days = w.days.map((d, c) => `
                <div class="ua-day${d.inMonth ? '' : ' ua-out'}${d.isToday ? ' ua-today' : ''}${d.isWeekend ? ' ua-weekend' : ''}" style="grid-column: ${c + 1}; grid-row: 1 / -1;">
                    ${d.isToday
        ? `<span class="ua-daynum theme-keep-colors" aria-current="date" title="Today">${d.day}</span>`
        : `<span class="ua-daynum">${d.day}</span>`}
                </div>`).join('');
            const segs = w.segments.filter(s => s.lane < MAX_LANES).map(s => {
                const it = s.item;
                const title = `${it.client} — ${it.auditType} — ${formatRange(it.start, it.end)}${it.lead ? ` — Lead: ${it.lead}` : ''} — ${it.status}`;
                return `<button type="button" class="ua-seg ua-type-${it.typeKey}${s.continuesBefore ? ' ua-cont-l' : ''}${s.continuesAfter ? ' ua-cont-r' : ''}" style="grid-column: ${s.col + 1} / span ${s.span}; grid-row: ${s.lane + 2};" data-action="viewAuditPlan" data-id="${esc(it.id)}" title="${esc(title)}" aria-label="Open audit plan: ${esc(title)}"><span>${esc(it.client)}</span><small>${esc(it.auditType)}</small></button>`;
            }).join('');
            const more = hidden.map((n, c) => n ? `<button type="button" class="ua-more" style="grid-column: ${c + 1}; grid-row: ${lanes + 2};" data-action="UpcomingAudits_showList">+${n} more</button>` : '').join('');
            return `<div class="ua-week" style="grid-template-rows: ${rows};">${days}${segs}${more}</div>`;
        }).join('');
        const legend = TYPES.map(t => `<span class="ua-legend-item"><span class="ua-swatch ua-type-${t.key}"></span>${t.label}</span>`).join('');
        return `
            <div class="ua-cal-nav">
                <button type="button" class="btn btn-sm btn-secondary" data-action="UpcomingAudits_prevMonth" aria-label="Previous month"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                <div class="ua-cal-label" aria-live="polite">${esc(grid.label)} <span>${grid.count} audit${grid.count === 1 ? '' : 's'}</span></div>
                <button type="button" class="btn btn-sm btn-secondary" data-action="UpcomingAudits_nextMonth" aria-label="Next month"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
                <button type="button" class="btn btn-sm btn-secondary" data-action="UpcomingAudits_thisMonth">Today</button>
            </div>
            <div class="ua-cal" aria-label="${esc(grid.label)} audit calendar">
                <div class="ua-cal-dow">${WEEKDAYS.map(d => `<span>${d}</span>`).join('')}</div>
                ${weeks}
            </div>
            <div class="ua-legend">${legend}${unscheduled ? `<button type="button" class="ua-more ua-legend-note" data-action="UpcomingAudits_showList">${unscheduled} without a date — see list</button>` : ''}${dueCount ? `<button type="button" class="ua-more ua-legend-note" data-action="UpcomingAudits_showList">${dueCount} due by cycle, not planned — see list</button>` : ''}</div>`;
    }

    function innerHtml() {
        const model = ui.model;
        const isCal = ui.view === 'calendar';
        return `
            <div class="ua-head">
                <h3 id="${PANEL_ID}-title" tabindex="-1"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i>Upcoming Audits <span class="ua-count">${model.count}</span></h3>
                <div class="ua-toggle" role="group" aria-label="Upcoming audits view">
                    <button type="button" class="${isCal ? '' : 'active theme-keep-colors'}" aria-pressed="${!isCal}" data-action="UpcomingAudits_showList"><i class="fa-solid fa-list" aria-hidden="true"></i> List</button>
                    <button type="button" class="${isCal ? 'active theme-keep-colors' : ''}" aria-pressed="${isCal}" data-action="UpcomingAudits_showCalendar"><i class="fa-solid fa-calendar" aria-hidden="true"></i> Calendar</button>
                </div>
            </div>
            ${isCal ? calendarHtml(model) : listHtml(model)}`;
    }

    function panelHtml(model) {
        ui.model = model;
        ui.view = readView();
        const t = parseDay(model.today);
        ui.year = t.getFullYear();
        ui.month = t.getMonth();
        return `<section class="card ua-panel" id="${PANEL_ID}" aria-labelledby="${PANEL_ID}-title">${innerHtml()}</section>`;
    }

    function refresh() {
        const el = global.document && global.document.getElementById(PANEL_ID);
        if (el && ui.model) el.innerHTML = innerHtml();
    }

    function setView(view) {
        ui.view = view;
        saveView(view);
        refresh();
    }

    function shiftMonth(delta) {
        const d = new Date(ui.year, ui.month + delta, 1);
        ui.year = d.getFullYear();
        ui.month = d.getMonth();
        refresh();
    }

    function thisMonth() {
        if (!ui.model) return;
        const t = parseDay(ui.model.today);
        ui.year = t.getFullYear();
        ui.month = t.getMonth();
        refresh();
    }

    function scrollToPanel() {
        const el = global.document && global.document.getElementById(PANEL_ID);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const title = global.document.getElementById(`${PANEL_ID}-title`);
        if (title) title.focus({ preventScroll: true });
    }

    const API = {
        PANEL_ID, VIEW_KEY, MAX_LANES, DUE_HORIZON_DAYS,
        toDay, addDays, diffDays, formatRange, typeKey, normalizePlan, bucketOf, relativeLabel,
        build, dueUnplanned, monthGrid, panelHtml,
        showList: () => setView('list'),
        showCalendar: () => setView('calendar'),
        prevMonth: () => shiftMonth(-1),
        nextMonth: () => shiftMonth(1),
        thisMonth,
        scrollToPanel
    };
    global.UpcomingAudits = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

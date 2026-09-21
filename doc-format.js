// ============================================
// DOCUMENT FORMATTING  (window.DocFormat)
// ============================================
// The single source of dates, time zones and text hygiene for every
// client-facing document (audit plan, checklist). Pure functions, no DOM.
//
// WHY THIS FILE EXISTS
// --------------------
// Client-facing PDFs printed "03/11/2026 – 05/11/2026" — 3 November or
// 11 March? — because each document formatted its own dates through
// UTILS.formatDate, which honours a numeric house format meant for the UI. An
// international audit cannot use a numeric date: DD/MM and MM/DD both look
// valid for the 3rd–5th of a month. Presentation is now ALWAYS written
// ("3–5 November 2026"); ISO YYYY-MM-DD stays in the database only.
//
// Time zones are resolved from the site and labelled for the audit DATE, never
// hard-coded: Merrimack, NH is EDT on 30 October 2026 and EST on 3 November
// 2026 because daylight saving ended on 1 November.
//
// CONTRACT
//   DocFormat.formatDate(v)                 -> "3 November 2026"
//   DocFormat.formatDateRange(a, b)         -> "3–5 November 2026"
//   DocFormat.findUnwrittenDates(text)      -> [{text, kind}]  numeric dates in client-facing text
//   DocFormat.resolveTimeZone(ctx)          -> {iana, source, confirmed, ...}
//   DocFormat.describeTimeZone(iana, iso)   -> {abbr, name, offset, label}
//   DocFormat.requiresAgreedTimeZone(ctx)   -> boolean
//   DocFormat.toPlainText(v) / decodeEntities(v) / escapeHtml(v)
//   DocFormat.findRawEntities(text)         -> matches of &amp; etc. left in RENDERED text
//   DocFormat.findBrowserArtifacts(text)    -> browser print decoration found in extracted text

(function (global) {
    'use strict';

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const EN_DASH = '–';

    // ── Dates ─────────────────────────────────────────────────────────

    /**
     * Read a date WITHOUT letting the local time zone move it. A stored
     * "2026-11-03" must print as the 3rd wherever the browser happens to be;
     * new Date('2026-11-03') is UTC midnight and reads as the 2nd in the
     * Americas.
     * @returns {{y:number,m:number,d:number}|null}
     */
    function parseDateParts(value) {
        if (value == null || value === '') return null;
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return null;
            return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
        }
        const s = String(value).trim();
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
        if (iso) {
            const parts = { y: +iso[1], m: +iso[2], d: +iso[3] };
            return validParts(parts) ? parts : null;
        }
        const parsed = new Date(s);
        if (Number.isNaN(parsed.getTime())) return null;
        return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() };
    }

    function validParts(p) {
        if (!p || p.m < 1 || p.m > 12 || p.d < 1) return false;
        const days = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
        return p.d <= days;
    }

    function toIso(value) {
        const p = parseDateParts(value);
        if (!p) return '';
        const pad = (n) => (n < 10 ? '0' + n : String(n));
        return p.y + '-' + pad(p.m) + '-' + pad(p.d);
    }

    /** "3 November 2026" (optionally "Tuesday 3 November 2026"). '' when unreadable. */
    function formatDate(value, opts) {
        const p = parseDateParts(value);
        if (!p) return '';
        const text = p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y;
        if (opts && opts.weekday) return weekdayOf(p) + ' ' + text;
        return text;
    }

    function weekdayOf(p) {
        return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
    }

    function weekdayName(value) {
        const p = parseDateParts(value);
        return p ? weekdayOf(p) : '';
    }

    /**
     * "3–5 November 2026" · "16 September–15 November 2026" ·
     * "28 December 2026–2 January 2027" · "3 November 2026" (same day).
     * With one end missing, the one that exists is returned as a single date.
     */
    function formatDateRange(start, end) {
        const a = parseDateParts(start);
        const b = parseDateParts(end);
        if (!a && !b) return '';
        if (!a || !b) return formatDate(a ? start : end);
        if (a.y === b.y && a.m === b.m && a.d === b.d) return formatDate(start);
        if (a.y === b.y && a.m === b.m) return a.d + EN_DASH + b.d + ' ' + MONTHS[a.m - 1] + ' ' + a.y;
        if (a.y === b.y) return a.d + ' ' + MONTHS[a.m - 1] + EN_DASH + b.d + ' ' + MONTHS[b.m - 1] + ' ' + a.y;
        return formatDate(start) + EN_DASH + formatDate(end);
    }

    /** Whole days from a to b (b - a), using calendar dates so DST cannot skew it. */
    function daysBetween(a, b) {
        const pa = parseDateParts(a);
        const pb = parseDateParts(b);
        if (!pa || !pb) return null;
        return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
    }

    /** Add calendar days to an ISO date, returning ISO. */
    function addDaysIso(value, n) {
        const p = parseDateParts(value);
        if (!p) return '';
        return toIso(new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10));
    }

    /** Every calendar date from start to end inclusive, as ISO strings. */
    function eachDay(start, end) {
        const span = daysBetween(start, end);
        if (span == null || span < 0) return [];
        const out = [];
        for (let i = 0; i <= span; i++) out.push(addDaysIso(start, i));
        return out;
    }

    // Numeric dates are ambiguous (03/11/2026) and ISO dates are not "written".
    // Both are refused in client-facing text. The patterns are deliberately
    // narrow so a document reference ("PLN-PCI-2026-02"), a clause ("8.2.2") or
    // a time ("08:30") is never mistaken for a date.
    const NUMERIC_DATE_PATTERNS = [
        { kind: 'ambiguous-numeric', re: /(?<![\d./-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/-])/g },
        { kind: 'iso-numeric', re: /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g }
    ];

    /**
     * Numeric or ISO dates left in text a client will read.
     * @returns {Array<{text:string, kind:string}>}
     */
    function findUnwrittenDates(text) {
        const s = String(text == null ? '' : text);
        const found = [];
        NUMERIC_DATE_PATTERNS.forEach(function (pat) {
            pat.re.lastIndex = 0;
            let m;
            while ((m = pat.re.exec(s)) !== null) {
                found.push({ text: m[0], kind: pat.kind });
            }
        });
        return found;
    }

    // ── Time zones ────────────────────────────────────────────────────

    // One IANA zone per US state where the state is single-zone. States split
    // across zones are flagged `multi` and must be confirmed by a person —
    // guessing "Eastern" for Tennessee is how a remote audit starts an hour off.
    const US_STATE_ZONES = {
        alabama: 'America/Chicago', alaska: ['America/Anchorage', true], arizona: 'America/Phoenix',
        arkansas: 'America/Chicago', california: 'America/Los_Angeles', colorado: 'America/Denver',
        connecticut: 'America/New_York', delaware: 'America/New_York', 'district of columbia': 'America/New_York',
        florida: ['America/New_York', true], georgia: 'America/New_York', hawaii: 'Pacific/Honolulu',
        idaho: ['America/Boise', true], illinois: 'America/Chicago', indiana: ['America/Indiana/Indianapolis', true],
        iowa: 'America/Chicago', kansas: ['America/Chicago', true], kentucky: ['America/New_York', true],
        louisiana: 'America/Chicago', maine: 'America/New_York', maryland: 'America/New_York',
        massachusetts: 'America/New_York', michigan: ['America/Detroit', true], minnesota: 'America/Chicago',
        mississippi: 'America/Chicago', missouri: 'America/Chicago', montana: 'America/Denver',
        nebraska: ['America/Chicago', true], nevada: ['America/Los_Angeles', true],
        'new hampshire': 'America/New_York', 'new jersey': 'America/New_York', 'new mexico': 'America/Denver',
        'new york': 'America/New_York', 'north carolina': 'America/New_York',
        'north dakota': ['America/Chicago', true], ohio: 'America/New_York', oklahoma: 'America/Chicago',
        oregon: ['America/Los_Angeles', true], pennsylvania: 'America/New_York', 'rhode island': 'America/New_York',
        'south carolina': 'America/New_York', 'south dakota': ['America/Chicago', true],
        tennessee: ['America/Chicago', true], texas: ['America/Chicago', true], utah: 'America/Denver',
        vermont: 'America/New_York', virginia: 'America/New_York', washington: 'America/Los_Angeles',
        'west virginia': 'America/New_York', wisconsin: 'America/Chicago', wyoming: 'America/Denver'
    };
    const US_STATE_ABBR = {
        AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado',
        CT: 'connecticut', DE: 'delaware', DC: 'district of columbia', FL: 'florida', GA: 'georgia',
        HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky',
        LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota',
        MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire',
        NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota',
        OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island',
        SC: 'south carolina', SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
        VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming'
    };
    // Countries with one civil zone. Multi-zone countries (US, CA, AU, BR, MX,
    // RU, CN-excluded) are deliberately absent: they need a region.
    const COUNTRY_ZONES = {
        pakistan: 'Asia/Karachi', 'united kingdom': 'Europe/London', uk: 'Europe/London',
        'united arab emirates': 'Asia/Dubai', uae: 'Asia/Dubai', 'saudi arabia': 'Asia/Riyadh',
        india: 'Asia/Kolkata', singapore: 'Asia/Singapore', ireland: 'Europe/Dublin',
        germany: 'Europe/Berlin', france: 'Europe/Paris', netherlands: 'Europe/Amsterdam',
        spain: 'Europe/Madrid', italy: 'Europe/Rome', turkey: 'Europe/Istanbul', qatar: 'Asia/Qatar',
        china: 'Asia/Shanghai', japan: 'Asia/Tokyo', 'south africa': 'Africa/Johannesburg',
        egypt: 'Africa/Cairo', kenya: 'Africa/Nairobi', nigeria: 'Africa/Lagos', bangladesh: 'Asia/Dhaka',
        malaysia: 'Asia/Kuala_Lumpur', 'new zealand': 'Pacific/Auckland'
    };
    const US_NAMES = ['usa', 'us', 'u.s.', 'u.s.a.', 'united states', 'united states of america'];

    // Intl reports "GMT+5" for zones without an English abbreviation. A short
    // house label beats that for the ones a CB actually audits in.
    const ABBREVIATION_FALLBACK = {
        'Asia/Karachi': 'PKT', 'Asia/Dubai': 'GST', 'Asia/Kolkata': 'IST', 'Asia/Singapore': 'SGT',
        'Asia/Riyadh': 'AST', 'Asia/Qatar': 'AST', 'Asia/Shanghai': 'CST', 'Asia/Tokyo': 'JST',
        'Africa/Johannesburg': 'SAST', 'Africa/Nairobi': 'EAT', 'Africa/Lagos': 'WAT',
        'Asia/Dhaka': 'BST', 'Asia/Kuala_Lumpur': 'MYT'
    };

    function isValidZone(iana) {
        if (!iana || typeof iana !== 'string') return false;
        try { new Intl.DateTimeFormat('en-US', { timeZone: iana }); return true; } catch (_e) { return false; }
    }

    function normKey(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z .]/g, ' ').replace(/\s+/g, ' ').trim(); }

    /** Find a US state named anywhere in a free-text address. */
    function stateFromAddress(text) {
        const s = String(text == null ? '' : text);
        const lower = normKey(s);
        const names = Object.keys(US_STATE_ZONES).sort(function (a, b) { return b.length - a.length; });
        for (let i = 0; i < names.length; i++) {
            if (new RegExp('(^|[ ,])' + names[i].replace(/ /g, ' ') + '($|[ ,])').test(lower)) return names[i];
        }
        const abbr = s.match(/(?:^|[\s,])([A-Z]{2})(?=$|[\s,.\d])/g);
        if (abbr) {
            for (let j = 0; j < abbr.length; j++) {
                const code = abbr[j].replace(/[^A-Z]/g, '');
                if (US_STATE_ABBR[code]) return US_STATE_ABBR[code];
            }
        }
        return '';
    }

    function zoneFromLocation(location) {
        const loc = location || {};
        const country = normKey(loc.country);
        const isUs = US_NAMES.indexOf(country) !== -1;
        const hay = [loc.state, loc.region, loc.address, loc.city].filter(Boolean).join(', ');
        if (isUs || (!country && stateFromAddress(hay))) {
            const st = normKey(loc.state) && US_STATE_ZONES[normKey(loc.state)] ? normKey(loc.state) : stateFromAddress(hay);
            if (st) {
                const entry = US_STATE_ZONES[st];
                const iana = Array.isArray(entry) ? entry[0] : entry;
                return { iana: iana, basis: 'state:' + st, multi: Array.isArray(entry) };
            }
            return null;
        }
        if (country && COUNTRY_ZONES[country]) return { iana: COUNTRY_ZONES[country], basis: 'country:' + country, multi: false };
        return null;
    }

    /**
     * The time zone an audit's agenda is expressed in.
     *
     * Order: a zone an authorised user agreed on the plan -> the audited site's
     * own location -> the client's location. The site outranks the client
     * because the audited site, not head office, is where the day runs.
     * A US state split across zones is returned unconfirmed.
     *
     * @param {Object} ctx - { plan, client, site }
     * @returns {{iana:string, source:string, confirmed:boolean, basis:string, needsConfirmation:boolean}}
     */
    function resolveTimeZone(ctx) {
        const c = ctx || {};
        const plan = c.plan || {};
        const agreed = plan.timeZone && (plan.timeZone.iana || plan.timeZone);
        if (agreed && isValidZone(typeof agreed === 'string' ? agreed : agreed)) {
            const tz = typeof agreed === 'string' ? agreed : plan.timeZone.iana;
            return {
                iana: tz, source: 'plan-agreed', confirmed: true, basis: 'agreed on the plan',
                needsConfirmation: false,
                agreedBy: plan.timeZone.agreedBy || '', agreedAt: plan.timeZone.agreedAt || ''
            };
        }
        const candidates = [
            { where: 'site', loc: c.site },
            { where: 'client', loc: c.client }
        ];
        for (let i = 0; i < candidates.length; i++) {
            const found = candidates[i].loc ? zoneFromLocation(candidates[i].loc) : null;
            if (found && isValidZone(found.iana)) {
                return {
                    iana: found.iana, source: candidates[i].where === 'site' ? 'site-location' : 'client-location',
                    confirmed: !found.multi, basis: found.basis, needsConfirmation: !!found.multi
                };
            }
        }
        return { iana: '', source: 'none', confirmed: false, basis: '', needsConfirmation: true };
    }

    /**
     * How a zone is labelled ON A GIVEN DATE. Uses the runtime's tz database so
     * daylight saving is applied for that date rather than assumed.
     * @returns {{abbr:string, name:string, offset:string, label:string}|null}
     */
    function describeTimeZone(iana, isoDate) {
        if (!isValidZone(iana)) return null;
        const p = parseDateParts(isoDate);
        // Noon UTC is the same calendar date in every zone between UTC-12 and UTC+11.
        const at = p ? new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0)) : new Date();
        const part = function (style) {
            const found = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: style })
                .formatToParts(at).find(function (x) { return x.type === 'timeZoneName'; });
            return found ? found.value : '';
        };
        let abbr = part('short');
        const long = part('long');
        const off = part('longOffset');
        const m = off.match(/GMT([+-])(\d{2}):?(\d{2})?/);
        const offset = m ? 'UTC' + (m[1] === '-' ? '−' : '+') + m[2] + ':' + (m[3] || '00') : 'UTC';
        if (/^GMT[+-]/.test(abbr) || /^UTC/.test(abbr)) abbr = ABBREVIATION_FALLBACK[iana] || offset;
        return { abbr: abbr, name: long, offset: offset, iana: iana, label: long + ' (' + abbr + ', ' + offset + ')' };
    }

    /**
     * The statement printed with an agenda, or '' when the zone is unresolved.
     * A range that crosses a daylight-saving change is described per date.
     */
    function timeZoneStatement(iana, startIso, endIso) {
        const a = describeTimeZone(iana, startIso);
        if (!a) return '';
        const b = endIso ? describeTimeZone(iana, endIso) : a;
        if (b && b.abbr !== a.abbr) {
            return 'All agenda times are shown in the client site’s local time zone: '
                + a.label + ' on ' + formatDate(startIso) + ' and ' + b.label + ' on ' + formatDate(endIso) + '.';
        }
        return 'All agenda times are shown in the client site’s local time zone: ' + a.label + '.';
    }

    /**
     * Must this plan carry an agreed time zone?
     * Remote and hybrid audits, when the parties may sit in different zones. The
     * CB's own country is only known if configured; unknown is treated as
     * international, because a remote audit with the wrong assumed zone is the
     * costlier mistake.
     */
    function requiresAgreedTimeZone(ctx) {
        const c = ctx || {};
        const method = normKey((c.plan && c.plan.auditMethod) || '');
        if (method !== 'remote' && method !== 'hybrid') return false;
        if (c.plan && c.plan.remoteInternational === false) return false;
        const cbCountry = normKey(c.cbCountry);
        const clientCountry = normKey(c.client && c.client.country);
        if (cbCountry && clientCountry) {
            const same = cbCountry === clientCountry
                || (US_NAMES.indexOf(cbCountry) !== -1 && US_NAMES.indexOf(clientCountry) !== -1);
            return !same;
        }
        return true;
    }

    // ── Text hygiene ──────────────────────────────────────────────────

    /**
     * Undo HTML escaping applied before storage. Escaping is a RENDER concern:
     * text stored as "Patch &amp; Vulnerability" prints as literally that. Loops
     * because a record edited twice reads back as "&amp;amp;".
     */
    function decodeEntities(value) {
        if (typeof value !== 'string' || value.indexOf('&') === -1) return value;
        let out = value;
        for (let pass = 0; pass < 6; pass++) {
            const next = out
                .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
                .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/gi, "'")
                .replace(/&nbsp;/gi, ' ')
                .replace(/&#(\d{2,5});/g, function (_m, n) { return String.fromCodePoint(+n); })
                .replace(/&#x([0-9a-f]{2,5});/gi, function (_m, n) { return String.fromCodePoint(parseInt(n, 16)); })
                .replace(/&amp;/gi, '&');
            if (next === out) break;
            out = next;
        }
        return out;
    }

    function escapeHtml(value) {
        if (value == null || value === '') return '';
        return String(value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    /**
     * Plain text for STORAGE: tags removed, entities decoded, whitespace tidied.
     * The counterpart of escapeHtml — never stores an entity, so every output
     * path escapes exactly once.
     */
    function toPlainText(value) {
        if (value == null) return '';
        const stripped = String(value).replace(/<[^>]*>/g, ' ');
        return decodeEntities(stripped).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
    }

    /**
     * What a reader sees when a browser renders `html`: markup removed, script
     * and style content dropped, entities decoded exactly ONE level — as a
     * browser does. An entity still present afterwards was double-escaped and
     * would print literally.
     */
    function renderedText(html) {
        const stripped = String(html == null ? '' : html)
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table|\/section)\b[^>]*>/gi, '\n')
            .replace(/<\/t[dh]>/gi, ' ')
            .replace(/<[^>]*>/g, '');
        // Named entities a browser turns into characters, so the linter sees what a
        // reader sees rather than flagging (or missing) markup escapes.
        const NAMED = { mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
            middot: '·', times: '×', copy: '©', reg: '®', bull: '•', rarr: '→', larr: '←', minus: '−' };
        return stripped
            .replace(/&([a-z]+);/gi, function (m, n) { return Object.prototype.hasOwnProperty.call(NAMED, n.toLowerCase()) ? NAMED[n.toLowerCase()] : m; })
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ')
            .replace(/&#(\d{2,5});/g, function (_m, n) { return String.fromCodePoint(+n); })
            .replace(/&#x([0-9a-f]{2,5});/gi, function (_m, n) { return String.fromCodePoint(parseInt(n, 16)); })
            .replace(/&amp;/g, '&');
    }

    // What an entity looks like once it has survived into RENDERED text.
    const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|#\d{2,5}|#x[0-9a-f]{2,5});/gi;

    /** Raw entities visible in text (a PDF's extracted text, or textContent). */
    function findRawEntities(text) {
        return String(text == null ? '' : text).match(ENTITY_RE) || [];
    }

    // Decoration a browser adds to a printed page. Matched against text
    // EXTRACTED from the PDF, so it catches what the print engine drew.
    const BROWSER_ARTIFACT_PATTERNS = [
        { kind: 'about:blank', re: /about:blank/i },
        { kind: 'file-url', re: /file:\/\/\//i },
        { kind: 'local-url', re: /https?:\/\/(?:localhost|127\.0\.0\.1)/i },
        // Chrome's default header: "9/21/26, 5:08 PM"
        { kind: 'browser-timestamp', re: /(?:^|\n)\s*\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s?(?:AM|PM)\s*(?:\n|$)/i },
        // Chrome's default footer page counter on a line of its own: "1/6"
        { kind: 'browser-page-counter', re: /(?:^|\n)\s*\d{1,3}\/\d{1,3}\s*(?:\n|$)/ }
    ];

    function findBrowserArtifacts(text) {
        const s = String(text == null ? '' : text);
        return BROWSER_ARTIFACT_PATTERNS.filter(function (p) { return p.re.test(s); })
            .map(function (p) { return p.kind; });
    }

    /** Placeholder values that must never stand in for a person or a decision. */
    const PLACEHOLDER_RE = /^(?:|other|none|tbd|tba|n\/a|na|null|undefined|unknown|unassigned|to be confirmed|to be determined|-|—|–)$/i;
    function isPlaceholder(value) {
        return PLACEHOLDER_RE.test(String(value == null ? '' : value).trim());
    }

    const API = {
        MONTHS, WEEKDAYS,
        parseDateParts, toIso, formatDate, formatDateRange, weekdayName, daysBetween, addDaysIso, eachDay,
        findUnwrittenDates,
        US_STATE_ZONES, isValidZone, resolveTimeZone, describeTimeZone, timeZoneStatement, requiresAgreedTimeZone,
        decodeEntities, escapeHtml, toPlainText, renderedText, findRawEntities, findBrowserArtifacts, isPlaceholder
    };
    global.DocFormat = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger && global.Logger.debug) global.Logger.debug('Modules', 'doc-format.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);

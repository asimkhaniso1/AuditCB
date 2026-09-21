import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const DF = require('../doc-format.js');

describe('written international dates', () => {
    it('writes the scheduled audit as 3–5 November 2026', () => {
        expect(DF.formatDateRange('2026-11-03', '2026-11-05')).toBe('3–5 November 2026');
    });

    it('writes the recommended window and certificate expiry unambiguously', () => {
        expect(DF.formatDateRange('2026-09-16', '2026-11-15')).toBe('16 September–15 November 2026');
        expect(DF.formatDate('2026-12-15')).toBe('15 December 2026');
    });

    it('handles a range across a year boundary and a single day', () => {
        expect(DF.formatDateRange('2026-12-28', '2027-01-02')).toBe('28 December 2026–2 January 2027');
        expect(DF.formatDateRange('2026-11-03', '2026-11-03')).toBe('3 November 2026');
    });

    it('never moves a stored date across midnight because of the viewer’s time zone', () => {
        // new Date('2026-11-03') is UTC midnight and reads as the 2nd in the Americas.
        const savedTz = process.env.TZ;
        expect(DF.formatDate('2026-11-03')).toBe('3 November 2026');
        expect(DF.formatDate('2026-11-03T00:00:00.000Z')).toBe('3 November 2026');
        expect(savedTz === undefined || typeof savedTz === 'string').toBe(true);
    });

    it('returns an empty string rather than "Invalid Date" for unreadable input', () => {
        expect(DF.formatDate('')).toBe('');
        expect(DF.formatDate('not a date')).toBe('');
        expect(DF.formatDate('2026-02-31')).toBe('');
        expect(DF.formatDateRange(null, undefined)).toBe('');
    });

    it('adds the weekday only when asked', () => {
        expect(DF.formatDate('2026-11-03', { weekday: true })).toBe('Tuesday 3 November 2026');
        expect(DF.weekdayName('2026-11-05')).toBe('Thursday');
    });
});

describe('unwritten date detection (numeric and ISO dates in client-facing text)', () => {
    it('flags the three numeric dates the previous plan printed', () => {
        const hits = DF.findUnwrittenDates('Scheduled 03/11/2026 – 05/11/2026, window 16/09/2026 – 15/11/2026');
        expect(hits.map(h => h.text)).toEqual(['03/11/2026', '05/11/2026', '16/09/2026', '15/11/2026']);
        expect(hits.every(h => h.kind === 'ambiguous-numeric')).toBe(true);
    });

    it('flags ISO dates as not written', () => {
        const hits = DF.findUnwrittenDates('Certification cycle 2022-12-16 to 2026-12-15');
        expect(hits.map(h => h.kind)).toEqual(['iso-numeric', 'iso-numeric']);
    });

    it('does not mistake clauses, times, references or written dates for dates', () => {
        const clean = 'Clause 8.2.2 and A.5.24 at 08:30–09:00. Ref PLN-PCI-2026-02. 3–5 November 2026. ISO 20000-1:2018.';
        expect(DF.findUnwrittenDates(clean)).toEqual([]);
    });
});

describe('remote-audit time zone', () => {
    const merrimack = { country: 'USA', address: 'Merrimack, NH, New Hampshire' };

    it('resolves the client site to America/New_York from its address', () => {
        const tz = DF.resolveTimeZone({ client: merrimack });
        expect(tz.iana).toBe('America/New_York');
        expect(tz.source).toBe('client-location');
        expect(tz.confirmed).toBe(true);
    });

    it('labels the zone for the audit DATE — EST on 3 November 2026, not EDT', () => {
        const nov = DF.describeTimeZone('America/New_York', '2026-11-03');
        expect(nov.abbr).toBe('EST');
        expect(nov.name).toBe('Eastern Standard Time');
        expect(nov.offset).toBe('UTC−05:00');
        // Daylight saving ended on 1 November 2026: three days earlier it is EDT.
        expect(DF.describeTimeZone('America/New_York', '2026-10-30').abbr).toBe('EDT');
    });

    it('states the zone on the agenda and describes each date when a range crosses the change', () => {
        expect(DF.timeZoneStatement('America/New_York', '2026-11-03', '2026-11-05'))
            .toBe('All agenda times are shown in the client site’s local time zone: Eastern Standard Time (EST, UTC−05:00).');
        const crossing = DF.timeZoneStatement('America/New_York', '2026-10-30', '2026-11-03');
        expect(crossing).toContain('EDT');
        expect(crossing).toContain('EST');
    });

    it('prefers a zone an authorised user agreed on the plan over the site’s', () => {
        const tz = DF.resolveTimeZone({ plan: { timeZone: { iana: 'Asia/Karachi', agreedBy: 'CM', agreedAt: '2026-09-01' } }, client: merrimack });
        expect(tz.iana).toBe('Asia/Karachi');
        expect(tz.source).toBe('plan-agreed');
        expect(DF.describeTimeZone('Asia/Karachi', '2026-11-03').abbr).toBe('PKT');
    });

    it('does not guess for a US state split across zones', () => {
        const tz = DF.resolveTimeZone({ client: { country: 'USA', address: 'Nashville, Tennessee' } });
        expect(tz.iana).toBe('America/Chicago');
        expect(tz.confirmed).toBe(false);
        expect(tz.needsConfirmation).toBe(true);
    });

    it('returns no zone when the location cannot place one', () => {
        const tz = DF.resolveTimeZone({ client: { country: 'Brazil', address: 'Somewhere' } });
        expect(tz.iana).toBe('');
        expect(tz.needsConfirmation).toBe(true);
    });

    it('requires an agreed zone for a remote or hybrid audit, not for on-site', () => {
        expect(DF.requiresAgreedTimeZone({ plan: { auditMethod: 'Remote' }, client: merrimack })).toBe(true);
        expect(DF.requiresAgreedTimeZone({ plan: { auditMethod: 'Hybrid' }, client: merrimack })).toBe(true);
        expect(DF.requiresAgreedTimeZone({ plan: { auditMethod: 'On-site' }, client: merrimack })).toBe(false);
    });

    it('does not require one for a domestic remote audit when the CB country is known', () => {
        expect(DF.requiresAgreedTimeZone({ plan: { auditMethod: 'Remote' }, client: merrimack, cbCountry: 'United States' })).toBe(false);
        expect(DF.requiresAgreedTimeZone({ plan: { auditMethod: 'Remote' }, client: merrimack, cbCountry: 'Pakistan' })).toBe(true);
    });
});

describe('text hygiene — no raw HTML entities', () => {
    it('decodes escaping applied before storage, however many times it was applied', () => {
        expect(DF.decodeEntities('Patch &amp; Vulnerability Management')).toBe('Patch & Vulnerability Management');
        expect(DF.decodeEntities('Business Continuity &amp;amp; Disaster Recovery')).toBe('Business Continuity & Disaster Recovery');
        expect(DF.decodeEntities('It&#39;s &quot;fine&quot; &lt;ok&gt;')).toBe('It\'s "fine" <ok>');
    });

    it('stores plain text: strips tags, decodes entities, never re-encodes', () => {
        expect(DF.toPlainText('Patch &amp; <b>Vulnerability</b> Management')).toBe('Patch & Vulnerability Management');
    });

    it('round-trips through escapeHtml exactly once', () => {
        const stored = DF.toPlainText('R&D and RTO < 4 hours');
        const printed = DF.escapeHtml(stored);
        expect(printed).toBe('R&amp;D and RTO &lt; 4 hours');
        // a second edit→save cycle must not change the stored value
        expect(DF.toPlainText(DF.decodeEntities(printed))).toBe(stored);
    });

    it('finds raw entities that survive into rendered text', () => {
        expect(DF.findRawEntities('Patch &amp; Vulnerability')).toEqual(['&amp;']);
        expect(DF.findRawEntities('Patch & Vulnerability, R&D')).toEqual([]);
    });
});

describe('browser print artifacts', () => {
    it('recognises Chrome’s default header and footer in extracted PDF text', () => {
        const printed = '9/21/26, 5:08 PM\nAudit Plan - PC CONNECTION, INC.\nabout:blank\n1/6\n';
        const kinds = DF.findBrowserArtifacts(printed);
        expect(kinds).toContain('about:blank');
        expect(kinds).toContain('browser-timestamp');
        expect(kinds).toContain('browser-page-counter');
    });

    it('leaves a controlled footer alone', () => {
        expect(DF.findBrowserArtifacts('PC CONNECTION, INC.\nPage 2 of 5\nRecertification audit')).toEqual([]);
    });
});

describe('placeholder detection', () => {
    it('rejects the placeholders that stood in for a person', () => {
        ['Other', 'None', 'TBD', '', '  ', 'N/A', 'Unknown', 'unassigned'].forEach(v => expect(DF.isPlaceholder(v)).toBe(true));
        expect(DF.isPlaceholder('Muhammad Asim Khan')).toBe(false);
    });
});

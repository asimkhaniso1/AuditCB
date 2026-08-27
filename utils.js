// ============================================
// UTILITY FUNCTIONS MODULE (ESM-ready)
// ============================================
// Structured as a standalone const + window export.

// Edition year per standard number, so a label written without one ("ISO 9001",
// "ISO 9001-Quality Management") resolves to the name the app offers as a chip.
const STANDARD_EDITIONS = {
    '9001': '2015', '14001': '2015', '45001': '2018', '27001': '2022', '22000': '2018',
    '13485': '2016', '50001': '2018', '20000-1': '2018', '22301': '2019', '27701': '2019',
    '17021-1': '2015', '37001': '2016', '41001': '2018', '55001': '2014', '28000': '2022',
    '39001': '2012', '42001': '2023', '15189': '2022', '18788': '2015', '29001': '2020'
};
const STANDARD_ALIASES = [
    [/^ce[\s-]*marking/i, 'CE-Marking'],
    [/^c?gmp\b/i, 'GMP'],
    [/^rohs\b/i, 'RoHS'],
    [/^halal\b/i, 'Halal'],
    [/^haccp\b/i, 'HACCP'],
    [/^reach\b/i, 'REACH SVHC'],
    [/^kosher\b/i, 'Kosher']
];

const UTILS = {
    // The house spelling of a standard. Accepts what any source happens to write
    // — a registry label ("ISO 9001-Quality Management"), a bare number
    // ("ISO 9001"), a slashed body ("ISO/IEC 27001:2022") — and returns the
    // canonical name ("ISO 9001:2015"). Anything unrecognised comes back
    // whitespace-normalised so custom entries survive untouched.
    canonicalStandard: function (label) {
        const raw = String(label == null ? '' : label).replace(/\s+/g, ' ').trim();
        if (!raw) return '';
        const iso = raw.match(/^ISO(?:\/IEC)?\s*(\d+(?:-\d+)?)(?:\s*:\s*(\d{4}))?/i);
        if (iso) {
            const num = iso[1];
            const year = iso[2] || STANDARD_EDITIONS[num];
            return year ? 'ISO ' + num + ':' + year : 'ISO ' + num;
        }
        for (let i = 0; i < STANDARD_ALIASES.length; i++) {
            if (STANDARD_ALIASES[i][0].test(raw)) return STANDARD_ALIASES[i][1];
        }
        return raw;
    },

    // Split a stored standards string ("ISO 9001:2015, ISO 14001-Environment
    // Mgmt.") into canonical names.
    parseStandards: function (stored) {
        return String(stored == null ? '' : stored)
            .split(',')
            .map(function (s) { return UTILS.canonicalStandard(s); })
            .filter(Boolean);
    },

    // Should this picker option show as selected? Compares canonically, so a
    // client carrying a raw registry label still ticks the matching chip.
    isStandardSelected: function (stored, option) {
        const want = UTILS.canonicalStandard(option);
        if (!want) return false;
        return UTILS.parseStandards(stored).indexOf(want) !== -1;
    },

    escapeHtml: function (unsafe) {
        if (!unsafe) return '';
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    formatDate: function (dateStr, specificFormat) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        const format = specificFormat || (window.state && window.state.cbSettings && window.state.cbSettings.dateFormat) || 'YYYY-MM-DD';

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const pad = (n) => n < 10 ? '0' + n : n;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        switch (format) {
            case 'DD-MMM-YYYY':
                return `${pad(day)}-${monthNames[month - 1]}-${year}`;
            case 'MM/DD/YYYY':
                return `${pad(month)}/${pad(day)}/${year}`;
            case 'DD/MM/YYYY':
                return `${pad(day)}/${pad(month)}/${year}`;
            case 'YYYY-MM-DD':
            default:
                return `${year}-${pad(month)}-${pad(day)}`;
        }
    },

    generateId: function () {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Generate a human-readable plan reference.
     * Format: PLN-{ClientInitials}-{YYYY}-{NN}
     */
    getPlanRef: function (planOrId) {
        const plans = (window.state && window.state.auditPlans) || [];
        let plan = planOrId;
        if (typeof planOrId === 'string') {
            plan = plans.find(function (p) { return String(p.id) === String(planOrId); });
        }
        if (!plan) {
            let rawId = typeof planOrId === 'string' ? planOrId : (planOrId && planOrId.id ? planOrId.id : '');
            return 'PLN-' + (rawId ? rawId.substring(0, 8) : '???');
        }

        let clientName = plan.client || '';
        let initials = clientName
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(/\s+/)
            .filter(Boolean)
            .map(function (w) { return w[0].toUpperCase(); })
            .join('')
            .substring(0, 3);
        if (!initials) initials = 'XX';

        let year = '';
        if (plan.date) {
            let d = new Date(plan.date);
            year = !isNaN(d.getTime()) ? String(d.getFullYear()) : plan.date.substring(0, 4);
        } else {
            year = String(new Date().getFullYear());
        }

        let samePlans = plans
            .filter(function (p) {
                return p.client === plan.client &&
                    p.date && p.date.substring(0, 4) === year;
            })
            .sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)); });
        let idx = samePlans.findIndex(function (p) { return String(p.id) === String(plan.id); });
        let seq = (idx >= 0 ? idx + 1 : samePlans.length + 1);
        let seqStr = seq < 10 ? '0' + seq : String(seq);

        return 'PLN-' + initials + '-' + year + '-' + seqStr;
    }
};

// Window export (used by all existing code)
window.UTILS = UTILS;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UTILS;
}

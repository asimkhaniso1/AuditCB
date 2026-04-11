// ============================================
// UTILITY FUNCTIONS MODULE (ESM-ready)
// ============================================
// Structured as a standalone const + window export.

const UTILS = {
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

window.UTILS = {
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
        if (isNaN(date.getTime())) return dateStr; // Return original if invalid

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
    }
};

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

    formatDate: function (dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString();
    },

    generateId: function () {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }
};

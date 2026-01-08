// ============================================
// AUDIT TRAIL MODULE
// ============================================
// Tracks user actions for compliance and debugging

const AuditTrail = {
    logs: [],
    maxLogs: 1000,
    storageKey: 'auditcb_audit_trail',

    /**
     * Initialize audit trail
     */
    init: function () {
        // Load from localStorage
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.logs = JSON.parse(saved);
            } catch (e) {
                this.logs = [];
            }
        }

        Logger.info('AuditTrail initialized with', this.logs.length, 'entries');
    },

    /**
     * Log an action
     * @param {string} action - Action type (login, logout, create, edit, delete, view, approve, reject)
     * @param {string} resource - Resource type (user, client, audit, report, checklist, etc.)
     * @param {object} details - Additional details
     */
    log: function (action, resource, details = {}) {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            resource: resource,
            resourceId: details.id || null,
            resourceName: details.name || null,
            user: {
                id: window.state?.currentUser?.id || null,
                name: window.state?.currentUser?.name || 'System',
                role: window.state?.currentUser?.role || 'System'
            },
            details: details.extra || null,
            ip: null, // Would need server-side for real IP
            userAgent: navigator.userAgent.substring(0, 100)
        };

        // Add to beginning
        this.logs.unshift(entry);

        // Trim to max
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        this.save();

        // Cloud Sync (Centralized Logging)
        this.syncToCloud(entry);

        Logger.info(`[AuditTrail] ${entry.user.name} ${action} ${resource}`, details.name || details.id || '');

        return entry;
    },

    /**
     * Sync log entry to Supabase
     */
    syncToCloud: async function (entry) {
        if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) return;

        try {
            // Map to DB schema
            const dbEntry = {
                // id: let DB generate UUID or serial if needed, but we can try sending our ID
                // actually DB has gen_random_uuid() default if text, or BIGSERIAL if int.
                // Best to let DB handle ID or use UUID. 
                // Our local ID is timestamp (int). DB ID might be UUID (text).
                // Let's omit ID and let DB generate it.
                user_email: entry.user.email || entry.user.name, // Fallback
                action: entry.action,
                entity: entry.resource, // Matches 'entity' column in DB
                entity_id: String(entry.resourceId || ''),
                details: {
                    resourceName: entry.resourceName,
                    ...entry.details,
                    ip: entry.ip,
                    userAgent: entry.userAgent
                },
                timestamp: entry.timestamp // Matches 'timestamp' column in DB
            };

            const { error } = await window.SupabaseClient.client
                .from('audit_log')
                .insert(dbEntry);

            if (error) {
                // Determine if table missing or permissions issue
                console.warn('[AuditTrail] Cloud sync error:', error.message);
            }
        } catch (err) {
            // Silent fail for offline
            // console.debug('[AuditTrail] Offline, log saved locally only');
        }
    },

    /**
     * Save to localStorage
     */
    save: function () {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
        } catch (e) {
            Logger.warn('Failed to save audit trail:', e);
        }
    },

    /**
     * Get filtered logs
     */
    getLogs: function (filters = {}) {
        let result = [...this.logs];

        if (filters.action) {
            result = result.filter(l => l.action === filters.action);
        }

        if (filters.resource) {
            result = result.filter(l => l.resource === filters.resource);
        }

        if (filters.userId) {
            result = result.filter(l => l.user.id === filters.userId);
        }

        if (filters.startDate) {
            const start = new Date(filters.startDate);
            result = result.filter(l => new Date(l.timestamp) >= start);
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate);
            result = result.filter(l => new Date(l.timestamp) <= end);
        }

        return result;
    },

    /**
     * Clear all logs (admin only)
     */
    clear: function () {
        if (window.state?.currentUser?.role !== 'Admin') {
            window.showNotification('Only administrators can clear audit logs', 'warning');
            return false;
        }

        this.logs = [];
        this.save();
        Logger.info('Audit trail cleared by', window.state.currentUser.name);
        return true;
    },

    /**
     * Export logs as CSV
     */
    exportCSV: function () {
        const headers = ['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Resource ID', 'Resource Name', 'Details'];
        const rows = this.logs.map(l => [
            l.timestamp,
            l.user.name,
            l.user.role,
            l.action,
            l.resource,
            l.resourceId || '',
            l.resourceName || '',
            l.details ? JSON.stringify(l.details) : ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${(cell + '').replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        window.showNotification('Audit trail exported', 'success');
    },

    /**
     * Get action icon and color
     */
    getActionStyle: function (action) {
        const styles = {
            login: { icon: 'fa-right-to-bracket', color: '#3b82f6' },
            logout: { icon: 'fa-right-from-bracket', color: '#64748b' },
            create: { icon: 'fa-plus', color: '#22c55e' },
            edit: { icon: 'fa-edit', color: '#f59e0b' },
            delete: { icon: 'fa-trash', color: '#ef4444' },
            view: { icon: 'fa-eye', color: '#8b5cf6' },
            approve: { icon: 'fa-check-circle', color: '#10b981' },
            reject: { icon: 'fa-times-circle', color: '#ef4444' },
            download: { icon: 'fa-download', color: '#06b6d4' },
            sync: { icon: 'fa-sync', color: '#3b82f6' }
        };
        return styles[action] || { icon: 'fa-circle', color: '#64748b' };
    },

    /**
     * Format timestamp for display
     */
    formatTime: function (timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};

// ============================================
// HELPER FUNCTIONS FOR COMMON ACTIONS
// ============================================

window.auditLog = function (action, resource, details = {}) {
    return AuditTrail.log(action, resource, details);
};

// Export
window.AuditTrail = AuditTrail;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuditTrail.init());
} else {
    AuditTrail.init();
}

Logger.info('AuditTrail module loaded');

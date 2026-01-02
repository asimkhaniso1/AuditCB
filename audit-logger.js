// ============================================
// AUDIT LOGGING SYSTEM
// ============================================
// ISO 17021-1 compliant audit trail for all data changes

const AuditLogger = {

    /**
     * Initialize audit log in state
     */
    init: function () {
        if (!window.state.auditLog) {
            window.state.auditLog = [];
            Logger.info('Audit log initialized');
        }

        // Setup auto-cleanup (keep last 1000 entries)
        this.setupAutoCleanup();
    },

    /**
     * Log an action
     * @param {string} action - 'create', 'update', 'delete', 'view', 'export'
     * @param {string} entity - 'client', 'auditor', 'audit_plan', 'report', etc.
     * @param {string|number} entityId - ID of the entity
     * @param {Object} changes - Object describing changes {field: {old: x, new: y}}
     * @param {Object} metadata - Additional metadata
     */
    log: function (action, entity, entityId, changes = {}, metadata = {}) {
        try {
            const entry = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                action,
                entity,
                entityId: entityId?.toString() || null,
                userId: window.state?.currentUser?.id || null,
                userName: window.state?.currentUser?.name || 'Unknown',
                userRole: window.state?.currentUser?.role || 'Unknown',
                changes,
                metadata,
                ipAddress: null, // Would need backend to get real IP
                userAgent: navigator.userAgent
            };

            // Add to log
            if (!window.state.auditLog) {
                window.state.auditLog = [];
            }
            window.state.auditLog.push(entry);

            // Save state
            if (window.saveData) {
                window.saveData();
            }

            // Log to console in debug mode
            Logger.debug('Audit log entry:', entry);

            // Send to Supabase if available
            this.sendToSupabase(entry);

            return entry;
        } catch (error) {
            Logger.error('Failed to create audit log entry:', error);
            return null;
        }
    },

    /**
     * Log create action
     */
    logCreate: function (entity, entityId, data) {
        return this.log('create', entity, entityId, { created: data }, {
            summary: `Created ${entity} #${entityId}`
        });
    },

    /**
     * Log update action
     */
    logUpdate: function (entity, entityId, oldData, newData) {
        const changes = this.detectChanges(oldData, newData);
        return this.log('update', entity, entityId, changes, {
            summary: `Updated ${entity} #${entityId}`,
            fieldsChanged: Object.keys(changes).length
        });
    },

    /**
     * Log delete action
     */
    logDelete: function (entity, entityId, data) {
        return this.log('delete', entity, entityId, { deleted: data }, {
            summary: `Deleted ${entity} #${entityId}`
        });
    },

    /**
     * Log view action (for sensitive data)
     */
    logView: function (entity, entityId) {
        return this.log('view', entity, entityId, {}, {
            summary: `Viewed ${entity} #${entityId}`
        });
    },

    /**
     * Log export action
     */
    logExport: function (entity, format, count) {
        return this.log('export', entity, null, {}, {
            summary: `Exported ${count} ${entity} records as ${format}`,
            format,
            count
        });
    },

    /**
     * Log login action
     */
    logLogin: function (success, username) {
        return this.log('login', 'user', username, {}, {
            summary: success ? 'Login successful' : 'Login failed',
            success
        });
    },

    /**
     * Log logout action
     */
    logLogout: function () {
        return this.log('logout', 'user', window.state?.currentUser?.id, {}, {
            summary: 'User logged out'
        });
    },

    /**
     * Detect changes between old and new data
     */
    detectChanges: function (oldData, newData) {
        const changes = {};

        // Get all unique keys
        const allKeys = new Set([
            ...Object.keys(oldData || {}),
            ...Object.keys(newData || {})
        ]);

        for (const key of allKeys) {
            const oldValue = oldData?.[key];
            const newValue = newData?.[key];

            // Skip if values are the same
            if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
                continue;
            }

            // Skip functions and complex objects
            if (typeof oldValue === 'function' || typeof newValue === 'function') {
                continue;
            }

            changes[key] = {
                old: oldValue,
                new: newValue
            };
        }

        return changes;
    },

    /**
     * Generate unique ID for log entry
     */
    generateId: function () {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Get audit log entries
     */
    getLog: function (filters = {}) {
        const log = window.state.auditLog || [];

        let filtered = log;

        // Filter by entity
        if (filters.entity) {
            filtered = filtered.filter(entry => entry.entity === filters.entity);
        }

        // Filter by entity ID
        if (filters.entityId) {
            filtered = filtered.filter(entry => entry.entityId === filters.entityId?.toString());
        }

        // Filter by action
        if (filters.action) {
            filtered = filtered.filter(entry => entry.action === filters.action);
        }

        // Filter by user
        if (filters.userId) {
            filtered = filtered.filter(entry => entry.userId === filters.userId);
        }

        // Filter by date range
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            filtered = filtered.filter(entry => new Date(entry.timestamp) >= start);
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate);
            filtered = filtered.filter(entry => new Date(entry.timestamp) <= end);
        }

        // Sort by timestamp (newest first)
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit results
        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    },

    /**
     * Get audit log for specific entity
     */
    getEntityLog: function (entity, entityId, limit = 50) {
        return this.getLog({ entity, entityId, limit });
    },

    /**
     * Get recent activity
     */
    getRecentActivity: function (limit = 20) {
        return this.getLog({ limit });
    },

    /**
     * Get user activity
     */
    getUserActivity: function (userId, limit = 50) {
        return this.getLog({ userId, limit });
    },

    /**
     * Export audit log
     */
    exportLog: function (filters = {}, format = 'json') {
        const log = this.getLog(filters);

        if (format === 'json') {
            return JSON.stringify(log, null, 2);
        }

        if (format === 'csv') {
            return this.convertToCSV(log);
        }

        return log;
    },

    /**
     * Convert log to CSV
     */
    convertToCSV: function (log) {
        if (log.length === 0) return '';

        const headers = ['Timestamp', 'Action', 'Entity', 'Entity ID', 'User', 'Role', 'Summary'];
        const rows = log.map(entry => [
            entry.timestamp,
            entry.action,
            entry.entity,
            entry.entityId || '',
            entry.userName,
            entry.userRole,
            entry.metadata?.summary || ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csv;
    },

    /**
     * Setup automatic cleanup
     */
    setupAutoCleanup: function () {
        // Clean up old entries every hour
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000); // 1 hour
    },

    /**
     * Cleanup old audit log entries
     */
    cleanup: function (maxEntries = 1000) {
        if (!window.state.auditLog) return;

        const log = window.state.auditLog;

        if (log.length > maxEntries) {
            // Keep only the most recent entries
            window.state.auditLog = log.slice(-maxEntries);

            Logger.info(`Audit log cleaned up: ${log.length - maxEntries} old entries removed`);

            if (window.saveData) {
                window.saveData();
            }
        }
    },

    /**
     * Send audit log to Supabase
     */
    sendToSupabase: async function (entry) {
        if (!window.SupabaseClient?.isInitialized) {
            return;
        }

        try {
            // Transform camelCase to snake_case for database
            const dbEntry = {
                id: entry.id,
                timestamp: entry.timestamp,
                action: entry.action,
                entity: entry.entity,
                entity_id: entry.entityId, // camelCase → snake_case
                user_id: entry.userId,     // camelCase → snake_case
                user_name: entry.userName, // camelCase → snake_case
                user_role: entry.userRole, // camelCase → snake_case
                changes: entry.changes,
                metadata: entry.metadata
            };

            await window.SupabaseClient.db.insert('audit_log', dbEntry);
            Logger.debug('Audit log sent to Supabase');
        } catch (error) {
            Logger.warn('Failed to send audit log to Supabase:', error);
            // Don't throw - local log is still saved
        }
    },

    /**
     * Generate audit report
     */
    generateReport: function (filters = {}) {
        const log = this.getLog(filters);

        const report = {
            generatedAt: new Date().toISOString(),
            generatedBy: window.state?.currentUser?.name || 'Unknown',
            filters,
            totalEntries: log.length,
            summary: {
                byAction: this.groupBy(log, 'action'),
                byEntity: this.groupBy(log, 'entity'),
                byUser: this.groupBy(log, 'userName'),
                byDate: this.groupByDate(log)
            },
            entries: log
        };

        return report;
    },

    /**
     * Group log entries by field
     */
    groupBy: function (log, field) {
        const grouped = {};

        log.forEach(entry => {
            const key = entry[field] || 'Unknown';
            if (!grouped[key]) {
                grouped[key] = 0;
            }
            grouped[key]++;
        });

        return grouped;
    },

    /**
     * Group log entries by date
     */
    groupByDate: function (log) {
        const grouped = {};

        log.forEach(entry => {
            const date = entry.timestamp.split('T')[0]; // Get date part only
            if (!grouped[date]) {
                grouped[date] = 0;
            }
            grouped[date]++;
        });

        return grouped;
    },

    /**
     * Clear audit log (admin only)
     */
    clearLog: function () {
        if (!AuthManager.hasRole('Admin')) {
            Logger.warn('Only admins can clear audit log');
            return false;
        }

        if (!confirm('Are you sure you want to clear the entire audit log? This cannot be undone.')) {
            return false;
        }

        // Log the clear action first
        this.log('clear_log', 'audit_log', null, {}, {
            summary: 'Audit log cleared',
            entriesCleared: window.state.auditLog?.length || 0
        });

        // Clear the log
        window.state.auditLog = [];

        if (window.saveData) {
            window.saveData();
        }

        Logger.warn('Audit log cleared by admin');
        return true;
    }
};

// Export to window
window.AuditLogger = AuditLogger;

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuditLogger.init());
} else {
    AuditLogger.init();
}

Logger.info('AuditLogger module loaded');

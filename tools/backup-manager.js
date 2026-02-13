// ============================================
// AUTOMATIC BACKUP SYSTEM
// ============================================
// Automatic backups to prevent data loss

const BackupManager = {

    BACKUP_KEY_PREFIX: 'auditCB360State_backup_',
    MAX_BACKUPS: 5,
    BACKUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    backupTimer: null,

    /**
     * Initialize backup system
     */
    init: function () {
        Logger.info('Initializing BackupManager...');

        // Create initial backup
        this.createBackup('init');

        // Setup automatic backups
        this.enableAutoBackup();

        // Setup visibility change handler (backup before tab close)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.createBackup('visibility_change');
            }
        });

        // Setup beforeunload handler
        window.addEventListener('beforeunload', () => {
            this.createBackup('before_unload');
        });

        Logger.info('BackupManager initialized');
    },

    /**
     * Create a backup
     */
    createBackup: function (reason = 'manual') {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                version: window.state?.version || DATA_VERSION,
                reason,
                data: window.state,
                user: window.state?.currentUser?.name || 'Unknown',
                size: 0
            };

            const backupJSON = JSON.stringify(backup);
            backup.size = new Blob([backupJSON]).size;

            const backupKey = this.BACKUP_KEY_PREFIX + Date.now();

            // Save to localStorage
            try {
                localStorage.setItem(backupKey, backupJSON);
                Logger.info(`Backup created: ${backupKey} (${(backup.size / 1024).toFixed(2)}KB)`);
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    Logger.warn('Storage quota exceeded, cleaning old backups...');
                    this.cleanOldBackups(1); // Keep only 1 backup
                    // Try again
                    localStorage.setItem(backupKey, backupJSON);
                } else {
                    throw error;
                }
            }

            // Clean old backups
            this.cleanOldBackups();

            // Log backup creation
            if (window.AuditLogger) {
                AuditLogger.log('backup', 'system', null, {}, {
                    summary: `Backup created (${reason})`,
                    size: backup.size,
                    backupKey
                });
            }

            return backupKey;
        } catch (error) {
            Logger.error('Failed to create backup:', error);
            return null;
        }
    },

    /**
     * List all backups
     */
    listBackups: function () {
        const backups = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.BACKUP_KEY_PREFIX)) {
                try {
                    const backupData = localStorage.getItem(key);
                    const backup = JSON.parse(backupData);

                    backups.push({
                        key,
                        timestamp: backup.timestamp,
                        reason: backup.reason,
                        user: backup.user,
                        size: backup.size,
                        version: backup.version
                    });
                } catch (error) {
                    Logger.warn(`Invalid backup: ${key}`);
                }
            }
        }

        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return backups;
    },

    /**
     * Restore from backup
     */
    restoreBackup: function (backupKey) {
        try {
            if (!confirm('Are you sure you want to restore from this backup? Current data will be replaced.')) {
                return false;
            }

            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup not found');
            }

            const backup = JSON.parse(backupData);

            // Create a backup of current state before restoring
            this.createBackup('before_restore');

            // Restore the data
            window.state = backup.data;

            // Save to main storage
            if (window.saveData) {
                window.saveData();
            }

            Logger.info(`Restored from backup: ${backupKey}`);
            window.showNotification('Data restored from backup successfully!', 'success');

            // Log restore action
            if (window.AuditLogger) {
                AuditLogger.log('restore', 'system', null, {}, {
                    summary: 'Restored from backup',
                    backupKey,
                    backupTimestamp: backup.timestamp
                });
            }

            // Reload page to ensure clean state
            setTimeout(() => {
                location.reload();
            }, 1000);

            return true;
        } catch (error) {
            Logger.error('Failed to restore backup:', error);
            window.showNotification('Failed to restore backup: ' + error.message, 'error');
            return false;
        }
    },

    /**
     * Delete a backup
     */
    deleteBackup: function (backupKey) {
        try {
            if (!confirm('Are you sure you want to delete this backup?')) {
                return false;
            }

            localStorage.removeItem(backupKey);
            Logger.info(`Backup deleted: ${backupKey}`);
            window.showNotification('Backup deleted', 'info');

            return true;
        } catch (error) {
            Logger.error('Failed to delete backup:', error);
            return false;
        }
    },

    /**
     * Clean old backups (keep only MAX_BACKUPS)
     */
    cleanOldBackups: function (maxToKeep = this.MAX_BACKUPS) {
        const backups = this.listBackups();

        if (backups.length > maxToKeep) {
            const toDelete = backups.slice(maxToKeep);

            toDelete.forEach(backup => {
                localStorage.removeItem(backup.key);
                Logger.debug(`Old backup removed: ${backup.key}`);
            });

            Logger.info(`Cleaned ${toDelete.length} old backups`);
        }
    },

    /**
     * Enable automatic backups
     */
    enableAutoBackup: function (intervalMs = this.BACKUP_INTERVAL) {
        // Clear existing timer
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }

        // Setup new timer
        this.backupTimer = setInterval(() => {
            this.createBackup('auto');
        }, intervalMs);

        Logger.info(`Auto-backup enabled (every ${intervalMs / 1000 / 60} minutes)`);
    },

    /**
     * Disable automatic backups
     */
    disableAutoBackup: function () {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            Logger.info('Auto-backup disabled');
        }
    },

    /**
     * Export backup to file
     */
    exportBackup: function (backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup not found');
            }

            const backup = JSON.parse(backupData);
            const filename = `auditcb360_backup_${backup.timestamp.replace(/:/g, '-')}.json`;

            // Create download link
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();

            URL.revokeObjectURL(url);

            Logger.info(`Backup exported: ${filename}`);
            window.showNotification('Backup exported successfully', 'success');

            return true;
        } catch (error) {
            Logger.error('Failed to export backup:', error);
            window.showNotification('Failed to export backup', 'error');
            return false;
        }
    },

    /**
     * Import backup from file
     */
    importBackup: function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const backupData = e.target.result;
                    const backup = JSON.parse(backupData);

                    // Validate backup structure
                    if (!backup.data || !backup.timestamp) {
                        throw new Error('Invalid backup file format');
                    }

                    // Save as new backup
                    const backupKey = this.BACKUP_KEY_PREFIX + Date.now();
                    localStorage.setItem(backupKey, backupData);

                    Logger.info(`Backup imported: ${backupKey}`);
                    window.showNotification('Backup imported successfully. You can now restore it.', 'success');

                    resolve(backupKey);
                } catch (error) {
                    Logger.error('Failed to import backup:', error);
                    window.showNotification('Failed to import backup: ' + error.message, 'error');
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    },

    /**
     * Get backup statistics
     */
    getStats: function () {
        const backups = this.listBackups();
        const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);

        return {
            count: backups.length,
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            oldest: backups[backups.length - 1]?.timestamp || null,
            newest: backups[0]?.timestamp || null,
            autoBackupEnabled: !!this.backupTimer
        };
    },

    /**
     * Show backup manager UI
     */
    showBackupManager: function () {
        const backups = this.listBackups();
        const stats = this.getStats();

        const html = `
            <div class="backup-manager">
                <h3><i class="fa-solid fa-database"></i> Backup Manager</h3>
                
                <div class="backup-stats" style="background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                    <strong>Statistics:</strong><br>
                    Total Backups: ${stats.count}<br>
                    Total Size: ${stats.totalSizeMB} MB<br>
                    Auto-Backup: ${stats.autoBackupEnabled ? '✅ Enabled' : '❌ Disabled'}
                </div>

                <div style="margin-bottom: 1rem;">
                    <button onclick="BackupManager.createBackup('manual')" class="btn btn-primary">
                        <i class="fa-solid fa-plus"></i> Create Backup Now
                    </button>
                    <button onclick="document.getElementById('import-backup-file').click()" class="btn btn-secondary">
                        <i class="fa-solid fa-upload"></i> Import Backup
                    </button>
                    <input type="file" id="import-backup-file" accept=".json" style="display: none;" 
                           onchange="BackupManager.importBackup(this.files[0]).then(() => BackupManager.showBackupManager())">
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Reason</th>
                            <th>User</th>
                            <th>Size</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${backups.map(backup => `
                            <tr>
                                <td>${new Date(backup.timestamp).toLocaleString()}</td>
                                <td>${backup.reason}</td>
                                <td>${backup.user}</td>
                                <td>${(backup.size / 1024).toFixed(2)} KB</td>
                                <td>
                                    <button onclick="BackupManager.restoreBackup('${backup.key}')" 
                                            class="btn btn-sm btn-success" title="Restore">
                                        <i class="fa-solid fa-undo"></i>
                                    </button>
                                    <button onclick="BackupManager.exportBackup('${backup.key}')" 
                                            class="btn btn-sm btn-primary" title="Export">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                    <button onclick="BackupManager.deleteBackup('${backup.key}'); BackupManager.showBackupManager();" 
                                            class="btn btn-sm btn-danger" title="Delete">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${backups.length === 0 ? '<p style="text-align: center; color: #666;">No backups found</p>' : ''}
            </div>
        `;

        // Show in modal
        if (window.openModal) {
            window.openModal('Backup Manager', html, null, null);
        } else {
            // Fallback: show in content area
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                SafeDOM.setHTML(contentArea, html);
            }
        }
    }
};

// Export to window
window.BackupManager = BackupManager;

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BackupManager.init());
} else {
    BackupManager.init();
}

Logger.info('BackupManager module loaded');

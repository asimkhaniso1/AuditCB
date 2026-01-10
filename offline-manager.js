// ============================================
// OFFLINE MANAGER MODULE
// ============================================
// Handles network state, sync queue, and offline data storage

const OfflineManager = {
    isOnline: navigator.onLine,
    syncQueue: [],
    storageKey: 'auditcb_sync_queue',

    /**
     * Initialize offline manager
     */
    init: function () {
        // Load sync queue
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.syncQueue = JSON.parse(saved);
            } catch (e) {
                this.syncQueue = [];
            }
        }

        // Listen for network changes
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        // Initial check
        this.handleNetworkChange(navigator.onLine);

        Logger.info('OfflineManager initialized. Queue size:', this.syncQueue.length);
    },

    /**
     * Handle network state changes
     */
    handleNetworkChange: function (online) {
        this.isOnline = online;

        // Update UI identifier
        this.updateIndicator();

        if (online) {
            window.showNotification('You are back online. Syncing data...', 'success');
            this.processSyncQueue();
        } else {
            window.showNotification('You are offline. Changes will be saved locally.', 'warning');
        }
    },

    /**
     * Update visual indicator in header
     */
    updateIndicator: function () {
        const header = document.querySelector('.top-bar');
        if (!header) return;

        let indicator = document.getElementById('network-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'network-indicator';
            indicator.style.marginRight = '10px';
            indicator.style.fontSize = '0.8rem';
            indicator.style.fontWeight = 'bold';
            indicator.style.padding = '4px 8px';
            indicator.style.borderRadius = '4px';

            // Insert before user profile
            const profile = header.querySelector('.user-profile');
            if (profile && profile.parentNode) {
                profile.parentNode.insertBefore(indicator, profile);
            } else if (header) {
                header.appendChild(indicator);
            }
        }

        if (this.isOnline) {
            indicator.textContent = 'ONLINE';
            indicator.style.backgroundColor = '#dcfce7';
            indicator.style.color = '#166534';
            indicator.style.display = 'none'; // Hide when online to reduce clutter
        } else {
            indicator.textContent = 'OFFLINE';
            indicator.style.backgroundColor = '#fee2e2';
            indicator.style.color = '#991b1b';
            indicator.style.display = 'block';
        }
    },

    /**
     * Add action to sync queue
     */
    queueAction: function (action, data) {
        const item = {
            id: Date.now(),
            action: action,
            data: data,
            timestamp: new Date().toISOString()
        };

        this.syncQueue.push(item);
        this.saveQueue();

        // Try to process immediately if online
        if (this.isOnline) {
            this.processSyncQueue();
        }

        return item;
    },

    /**
     * Save queue to localStorage
     */
    saveQueue: function () {
        localStorage.setItem(this.storageKey, JSON.stringify(this.syncQueue));

        // Also update backup
        if (window.BackupManager) {
            window.BackupManager.createBackup('auto-offline-queue');
        }
    },

    /**
     * Process logic for syncing data to cloud/backend
     * Integrates with Supabase for persistent storage
     */
    processSyncQueue: async function () {
        if (this.syncQueue.length === 0) return;

        Logger.info('OfflineManager', 'Processing sync queue...', this.syncQueue.length, 'items');

        const remaining = [];
        let successCount = 0;

        for (const item of this.syncQueue) {
            try {
                // Process based on action type
                const success = await this.processAction(item);

                if (success) {
                    successCount++;
                    Logger.info('OfflineManager', 'Synced item:', item.action);

                    // Log to audit trail
                    if (window.AuditTrail) {
                        window.AuditTrail.log('sync', 'system', { action: item.action, id: item.id });
                    }
                } else {
                    remaining.push(item); // Keep in queue if failed
                }

            } catch (error) {
                Logger.error('OfflineManager', 'Sync failed for item:', item.action, error);
                remaining.push(item); // Keep in queue if failed
            }
        }

        this.syncQueue = remaining;
        this.saveQueue();

        if (this.syncQueue.length === 0) {
            window.showNotification(`All ${successCount} offline changes synced successfully`, 'success');
        } else {
            window.showNotification(`Synced ${successCount} items. ${this.syncQueue.length} remaining.`, 'warning');
        }
    },

    /**
     * Process individual sync action based on type
     * @param {Object} item - The queued action item
     * @returns {boolean} - True if sync was successful
     */
    processAction: async function (item) {
        const supabase = window.SupabaseClient || window.supabase;

        // If Supabase is not configured, simulate success (data is in localStorage)
        if (!supabase || !supabase.isConfigured || !supabase.isConfigured()) {
            Logger.warn('OfflineManager', 'Supabase not configured. Marking as synced (local only).');
            await new Promise(r => setTimeout(r, 200)); // Simulate delay
            return true;
        }

        switch (item.action) {
            case 'SAVE_CHECKLIST':
                // Sync audit report checklist progress
                return await this.syncChecklistProgress(supabase, item.data);

            case 'CREATE_NCR':
                // Sync new NCR to cloud
                return await this.syncNCR(supabase, item.data);

            case 'SAVE_MEETINGS':
                // Sync meeting records
                return await this.syncMeetingRecords(supabase, item.data);

            case 'SAVE_CHECKLIST_TEMPLATE':
                // Sync checklist template
                return await this.syncChecklistTemplate(supabase, item.data);

            default:
                Logger.warn('OfflineManager', 'Unknown action type:', item.action);
                return true; // Mark as synced to remove from queue
        }
    },

    /**
     * Sync checklist progress to Supabase
     */
    syncChecklistProgress: async function (supabase, data) {
        try {
            if (supabase.upsertAuditReport) {
                await supabase.upsertAuditReport(data.reportId, {
                    checklistProgress: data.checklistProgress
                });
            }
            return true;
        } catch (error) {
            Logger.error('OfflineManager', 'syncChecklistProgress failed', error);
            return false;
        }
    },

    /**
     * Sync NCR to Supabase
     */
    syncNCR: async function (supabase, data) {
        try {
            if (supabase.createNCR) {
                await supabase.createNCR(data.reportId, data.ncr);
            }
            return true;
        } catch (error) {
            Logger.error('OfflineManager', 'syncNCR failed', error);
            return false;
        }
    },

    /**
     * Sync meeting records to Supabase
     */
    syncMeetingRecords: async function (supabase, data) {
        try {
            if (supabase.upsertAuditReport) {
                await supabase.upsertAuditReport(data.reportId, {
                    openingMeeting: data.openingMeeting,
                    closingMeeting: data.closingMeeting
                });
            }
            return true;
        } catch (error) {
            Logger.error('OfflineManager', 'syncMeetingRecords failed', error);
            return false;
        }
    },

    /**
     * Sync checklist template to Supabase
     */
    syncChecklistTemplate: async function (supabase, data) {
        try {
            if (supabase.upsertChecklist) {
                await supabase.upsertChecklist(data.checklistId, {
                    name: data.name,
                    standard: data.standard,
                    clauses: data.clauses
                });
            }
            return true;
        } catch (error) {
            Logger.error('OfflineManager', 'syncChecklistTemplate failed', error);
            return false;
        }
    }
};

// Registered SW Helper - DISABLED to prevent caching issues
// Service worker was caching old JavaScript files with demo data
window.registerServiceWorker = function () {
    // DISABLED: Service worker registration
    // The service worker was caching old script.js with demo data
    console.log('[OfflineManager] Service Worker registration DISABLED for real-time mode');

    // Unregister any existing service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
                console.log('[OfflineManager] Unregistered existing service worker');
            }
        });
    }
};

// Export
window.OfflineManager = OfflineManager;

// Initialize - but DON'T register service worker
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        OfflineManager.init();
        // DISABLED: window.registerServiceWorker();
        window.registerServiceWorker(); // Now just unregisters existing SWs
    });
} else {
    OfflineManager.init();
    // DISABLED: window.registerServiceWorker();
    window.registerServiceWorker(); // Now just unregisters existing SWs
}


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
     * (Simulated for now, would connect to Supabase/API)
     */
    processSyncQueue: async function () {
        if (this.syncQueue.length === 0) return;

        Logger.info('Processing sync queue...', this.syncQueue.length, 'items');

        const remaining = [];

        for (const item of this.syncQueue) {
            try {
                // Simulate network latency
                await new Promise(r => setTimeout(r, 500));

                // Here we would call actual backend APIs
                // For now, we assume local state (window.state) is already updated by the app
                // and we just need to "push" to cloud

                if (window.supabase) {
                    // example: await window.supabase.from('audit_actions').insert(item);
                }

                Logger.info('Synced item:', item.action);

                // Log to audit trail
                if (window.AuditTrail) {
                    window.AuditTrail.log('sync', 'system', { action: item.action, id: item.id });
                }

            } catch (error) {
                console.error('Sync failed for item:', item, error);
                remaining.push(item); // Keep in queue if failed
            }
        }

        this.syncQueue = remaining;
        this.saveQueue();

        if (this.syncQueue.length === 0) {
            window.showNotification('All offline changes synced successfully', 'success');
        } else {
            window.showNotification(`Synced some items. ${this.syncQueue.length} remaining.`, 'warning');
        }
    }
};

// Registered SW Helper
window.registerServiceWorker = function () {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.error('ServiceWorker registration failed: ', err);
                });
        });
    }
};

// Export
window.OfflineManager = OfflineManager;

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        OfflineManager.init();
        window.registerServiceWorker();
    });
} else {
    OfflineManager.init();
    window.registerServiceWorker();
}

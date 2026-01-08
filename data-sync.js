
// ============================================
// DATA SYNC MODULE (Cloud Save)
// ============================================
// Synchronizes local state with Supabase Storage
// Serves as a bridge until full relational DB migration

const DataSync = {
    syncTimeout: null,
    isSyncing: false,
    lastSyncTime: null,

    /**
     * Initialize Data Sync
     */
    init: function () {
        // Hook into the global saveData function
        const originalSaveData = window.saveData;

        window.saveData = function () {
            // 1. Run original local save
            if (originalSaveData) {
                originalSaveData();
            }

            // 2. Trigger Cloud Sync
            DataSync.triggerCloudSync();
        };

        Logger.info('DataSync initialized: Hooked into saveData()');

        // Attempt initial load if local data is empty or stale?
        // For now, we trust local first, but we could add a "Restore from Cloud" button later.
    },

    /**
     * Trigger Cloud Sync (Debounced)
     */
    triggerCloudSync: function () {
        if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) {
            return; // Supabase not ready, skip
        }

        if (!window.state.currentUser) {
            return; // No user, don't sync
        }

        clearTimeout(this.syncTimeout);

        // Debounce for 5 seconds to avoid constant uploads during typing
        this.syncTimeout = setTimeout(() => {
            this.uploadStateToCloud();
        }, 5000);
    },

    /**
     * Upload current state to Supabase Storage
     */
    uploadStateToCloud: async function () {
        if (this.isSyncing) return;

        try {
            this.isSyncing = true;
            updateSyncStatus('Syncing...', 'info');

            const userId = window.state.currentUser.id;
            // Sanitize file path
            const safeUserId = String(userId).replace(/[^a-z0-9-]/gi, '_');
            const path = `user_data/${safeUserId}/latest_state.json`;
            const timestamp = new Date().toISOString();

            // Prepare payload (exclude session-specific or volatile data if needed)
            const payload = {
                ...window.state,
                _syncedAt: timestamp
            };

            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

            // Upload to 'app-backups' bucket (assuming it exists, or 'audit-reports' if not)
            // Ideally we should have a dedicate bucket. using 'audit-reports' as a fallback? 
            // Better to try a dedicated one or generic 'backups'.
            // Based on SupabaseClient methods, we can pass the bucket name.

            // Let's assume 'app-backups' bucket exists or we user 'audit-reports' as a temporary holder if needed.
            // But 'audit-reports' is public. We want this PRIVATE.
            // Using 'audit-reports' is risky for PII. 
            // We'll try 'app-data' bucket. If it fails, we log it.

            const bucketName = 'app-data';

            const { data, error } = await window.SupabaseClient.client.storage
                .from(bucketName)
                .upload(path, blob, {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) throw error;

            this.lastSyncTime = timestamp;
            updateSyncStatus('Cloud Saved', 'success');
            Logger.info(`State synced to cloud: ${path}`);

        } catch (error) {
            Logger.warn('Cloud sync failed:', error);
            // Don't show error notification to user for background sync failure
            // just update the status indicator if we had one
            updateSyncStatus('Sync Failed', 'error');
        } finally {
            this.isSyncing = false;
        }
    },

    /**
     * Manual Restore from Cloud
     */
    restoreFromCloud: async function () {
        if (!window.SupabaseClient?.isInitialized || !window.state.currentUser) {
            window.showNotification('Supabase not connected', 'error');
            return;
        }

        if (!confirm('This will overwrite your local data with the latest cloud backup. Continue?')) {
            return;
        }

        try {
            window.showNotification('Downloading cloud data...', 'info');
            const userId = window.state.currentUser.id;
            // Sanitize file path
            const safeUserId = String(userId).replace(/[^a-z0-9-]/gi, '_');
            const path = `user_data/${safeUserId}/latest_state.json`;
            const bucketName = 'app-data';

            const { data, error } = await window.SupabaseClient.client.storage
                .from(bucketName)
                .download(path);

            if (error) throw error;

            const text = await data.text();
            const cloudState = JSON.parse(text);

            // Validate version
            if (cloudState.version !== window.state.version) {
                Logger.warn('Cloud data version mismatch');
            }

            // Restore
            window.state = cloudState;
            window.saveData(); // Save to local

            window.showNotification('Data restored from cloud!', 'success');
            setTimeout(() => location.reload(), 1000); // Reload to refresh UI

        } catch (error) {
            console.error(error);
            window.showNotification('Failed to restore data: ' + error.message, 'error');
        }
    }
};

// UI Helper for Sync Status
function updateSyncStatus(msg, type) {
    // We could add a status indicator to the UI header if it existed
    const indicator = document.getElementById('cloud-sync-status');
    if (indicator) {
        let icon = 'fa-cloud';
        let color = '#64748b'; // default grey

        if (type === 'syncing') { icon = 'fa-rotate fa-spin'; color = '#3b82f6'; }
        if (type === 'success') { icon = 'fa-cloud-check'; color = '#10b981'; }
        if (type === 'error') { icon = 'fa-cloud-xmark'; color = '#ef4444'; }

        indicator.innerHTML = `<i class="fa-solid ${icon}" style="color: ${color}"></i>`;
        indicator.title = msg;
    }
}

// Export
window.DataSync = DataSync;

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DataSync.init());
} else {
    DataSync.init();
}

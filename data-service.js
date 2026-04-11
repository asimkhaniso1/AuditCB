// ============================================
// DATA SERVICE - Centralized Supabase Sync Layer
// ============================================
// Eliminates duplicated sync patterns across 35+ files.
// All state mutations + Supabase sync go through here.

(function () {
    'use strict';

    const LOG_TAG = 'DataService';

    function log(msg, data) {
        if (window.Logger) window.Logger.debug(LOG_TAG, msg, data);
    }

    function warn(msg, err) {
        if (window.Logger) window.Logger.warn(LOG_TAG, msg, err);
        else console.warn(`[${LOG_TAG}] ${msg}`, err);
    }

    /**
     * Check if Supabase is ready for sync operations.
     */
    function isSupabaseReady() {
        return !!(window.SupabaseClient && window.SupabaseClient.isInitialized);
    }

    /**
     * Core sync helper. Saves local state, then syncs to Supabase.
     * @param {string} entity - Entity name for logging (e.g. 'client', 'auditReport')
     * @param {Function} syncFn - Async function that performs the Supabase call
     * @param {Object} [options]
     * @param {boolean} [options.saveLocal=true] - Whether to call window.saveData()
     * @param {boolean} [options.silent=false] - Suppress error notifications
     * @returns {Promise<boolean>} true if sync succeeded or was skipped (offline)
     */
    async function syncToCloud(entity, syncFn, options = {}) {
        const { saveLocal = true, silent = false } = options;

        if (saveLocal) {
            window.saveData();
        }

        if (!isSupabaseReady()) {
            log(`${entity}: Supabase not ready, saved locally only`);
            return false;
        }

        try {
            await syncFn();
            log(`${entity}: synced to cloud`);
            return true;
        } catch (err) {
            warn(`${entity}: cloud sync failed`, err);
            if (!silent && window.showNotification) {
                window.showNotification(`Saved locally. Cloud sync failed for ${entity}.`, 'warning');
            }
            return false;
        }
    }

    // ---- Entity-specific helpers ----

    /**
     * Save and sync a client object.
     */
    function syncClient(client, options = {}) {
        return syncToCloud('client', () =>
            window.SupabaseClient.upsertClient(client),
            options
        );
    }

    /**
     * Save and sync an audit report (partial or full).
     */
    function syncAuditReport(reportId, data, options = {}) {
        return syncToCloud('auditReport', () =>
            window.SupabaseClient.upsertAuditReport(reportId, data),
            options
        );
    }

    /**
     * Save and sync a certificate.
     */
    function syncCertificate(cert, options = {}) {
        return syncToCloud('certificate', () =>
            window.SupabaseClient.upsertCertificate(cert),
            options
        );
    }

    /**
     * Delete a certificate from cloud.
     */
    function deleteCertificate(certId, options = {}) {
        return syncToCloud('certificate:delete', () =>
            window.SupabaseClient.deleteCertificate(certId),
            { ...options, saveLocal: false }
        );
    }

    /**
     * Sync settings to cloud.
     */
    function syncSettings(options = {}) {
        return syncToCloud('settings', () =>
            window.SupabaseClient.syncSettingsToSupabase(),
            options
        );
    }

    /**
     * Sync checklists to cloud.
     */
    function syncChecklists(options = {}) {
        return syncToCloud('checklists', () =>
            window.SupabaseClient.syncChecklistsToSupabase(),
            options
        );
    }

    /**
     * Sync auditor assignments to cloud.
     */
    function syncAuditorAssignments(options = {}) {
        return syncToCloud('auditorAssignments', () =>
            window.SupabaseClient.syncAuditorAssignmentsToSupabase(),
            options
        );
    }

    /**
     * Delete an auditor assignment from cloud.
     * @param {string} auditorId
     * @param {string} clientId
     */
    function deleteAuditorAssignment(auditorId, clientId, options = {}) {
        return syncToCloud('auditorAssignment:delete', () =>
            window.SupabaseClient.deleteAuditorAssignment(auditorId, clientId),
            { ...options, saveLocal: false }
        );
    }

    /**
     * Generic table operation via Supabase .from() proxy.
     * Use for entities without dedicated upsert methods.
     */
    function tableInsert(table, data, options = {}) {
        return syncToCloud(`${table}:insert`, () =>
            window.SupabaseClient.client.from(table).insert(data),
            options
        );
    }

    function tableUpdate(table, data, match, options = {}) {
        return syncToCloud(`${table}:update`, () =>
            window.SupabaseClient.client.from(table).update(data).match(match),
            options
        );
    }

    function tableDelete(table, match, options = {}) {
        return syncToCloud(`${table}:delete`, () =>
            window.SupabaseClient.client.from(table).delete().match(match),
            { ...options, saveLocal: false }
        );
    }

    // ---- Convenience: find entity in state ----

    function findClient(clientId) {
        return (window.state.clients || []).find(c => String(c.id) === String(clientId));
    }

    function findAuditReport(reportId) {
        return (window.state.auditReports || []).find(r => String(r.id) === String(reportId));
    }

    function findAuditPlan(planId) {
        return (window.state.auditPlans || []).find(p => String(p.id) === String(planId));
    }

    // ---- Modal helper ----

    /**
     * Open the shared modal with a title, HTML body, and save handler.
     * Eliminates the repeated 5-line modal setup boilerplate.
     * @param {string} title - Modal title text
     * @param {string} bodyHtml - HTML content for modal body
     * @param {Function} [onSave] - Save button click handler (omit to hide save button)
     */
    function openFormModal(title, bodyHtml, onSave) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = bodyHtml;
        if (modalSave) {
            if (onSave) {
                modalSave.style.display = '';
                modalSave.onclick = onSave;
            } else {
                modalSave.style.display = 'none';
            }
        }
        if (window.openModal) window.openModal();
    }

    // ---- Confirm action helper ----

    /**
     * Replace browser's blocking confirm() with a styled modal.
     * @param {string} message - Confirmation message to display
     * @param {Function} onConfirm - Callback executed when user confirms
     */
    function confirmAction(message, onConfirm) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        if (modalTitle) modalTitle.textContent = 'Confirm Action';
        if (modalBody) modalBody.innerHTML = '<div style="padding: 1rem; text-align: center;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--warning-color); margin-bottom: 1rem;"></i><p style="font-size: 1rem; margin: 0;">' + (window.UTILS ? window.UTILS.escapeHtml(message) : message) + '</p></div>';
        if (modalSave) {
            modalSave.textContent = 'Confirm';
            modalSave.style.display = '';
            modalSave.className = 'btn btn-danger';
            modalSave.onclick = () => {
                if (window.closeModal) window.closeModal();
                modalSave.textContent = 'Save';
                modalSave.className = 'btn btn-primary';
                onConfirm();
            };
        }
        if (window.openModal) window.openModal();
    }

    // ---- Export ----

    window.DataService = {
        isSupabaseReady,
        syncToCloud,

        // Entity sync
        syncClient,
        syncAuditReport,
        syncCertificate,
        deleteCertificate,
        syncSettings,
        syncChecklists,
        syncAuditorAssignments,
        deleteAuditorAssignment,

        // Generic table operations
        tableInsert,
        tableUpdate,
        tableDelete,

        // UI helpers
        openFormModal,
        confirmAction,

        // State lookups
        findClient,
        findAuditReport,
        findAuditPlan
    };

    log('DataService initialized');
})();

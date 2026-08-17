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
        if (clientId == null) return undefined;
        return (window.state.clients || []).find(c => String(c.id) === String(clientId));
    }

    // Resolve the client a report belongs to, using every identifier the report
    // and its plan carry. A plain `clients.find(c => c.id === report.clientId)`
    // silently yields undefined for reports saved without a clientId — and an
    // unresolved client has no certificates, which made the integrity validator
    // report "no certificate on file" for clients that plainly have one.
    function resolveReportClient(report, auditPlan) {
        if (!report && !auditPlan) return undefined;
        const clients = (window.state && window.state.clients) || [];
        const ids = [report && report.clientId, auditPlan && auditPlan.clientId].filter(v => v != null);
        const byId = clients.find(c => ids.some(id => String(c.id) === String(id)));
        if (byId) return byId;
        const names = [report && report.client, report && report.clientName,
            auditPlan && auditPlan.client, auditPlan && auditPlan.clientName]
            .map(v => String(v == null ? '' : v).trim().toLowerCase()).filter(Boolean);
        return clients.find(c => names.includes(String(c.name || '').trim().toLowerCase()));
    }

    function findAuditReport(reportId) {
        return (window.state.auditReports || []).find(r => String(r.id) === String(reportId));
    }

    function findAuditPlan(planId) {
        return (window.state.auditPlans || []).find(p => String(p.id) === String(planId));
    }

    // ---- Audit-plan completion (single source of truth) ----

    /**
     * Whether an audit plan represents a finished/closed audit.
     * Every dashboard card, client-overview stat and audit-plans "programme"
     * table needs to agree on this, so route them all through here instead of
     * re-inlining `plan.status === 'Completed'` in each view (which is how the
     * dashboard's Completed count and the programme table's Status column
     * used to drift apart).
     */
    function isPlanCompleted(plan) {
        return !!plan && (plan.status === 'Completed' || plan.status === 'Closed');
    }

    /**
     * Canonical completion stats for a set of audit plans. Used by both the
     * global dashboard and the per-client Overview/Audit-Plans views so the
     * "Completed" figure is computed once and read everywhere, rather than
     * separately re-derived per screen.
     */
    function getPlanCompletionStats(plans) {
        const list = plans || [];
        const total = list.length;
        const completed = list.filter(isPlanCompleted).length;
        return {
            total,
            completed,
            upcoming: total - completed,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    // ---- Address consistency check ----

    // Common street-suffix normalizations so "123 Main Drive" and "123 Main Dr"
    // don't false-positive as an inconsistency.
    const STREET_SUFFIX_MAP = [
        [/\bstreet\b/gi, 'st'],
        [/\bdrive\b/gi, 'dr'],
        [/\bavenue\b/gi, 'ave'],
        [/\bboulevard\b/gi, 'blvd'],
        [/\broad\b/gi, 'rd'],
        [/\blane\b/gi, 'ln'],
        [/\bhighway\b/gi, 'hwy'],
        [/\bsuite\b/gi, 'ste'],
        [/\bbuilding\b/gi, 'bldg'],
        [/\bfloor\b/gi, 'fl'],
        [/\bapartment\b/gi, 'apt'],
        [/\bnorth\b/gi, 'n'],
        [/\bsouth\b/gi, 's'],
        [/\beast\b/gi, 'e'],
        [/\bwest\b/gi, 'w']
    ];

    function normalizeAddressText(raw) {
        let s = String(raw == null ? '' : raw).toLowerCase().trim();
        if (!s) return '';
        STREET_SUFFIX_MAP.forEach(([re, replacement]) => { s = s.replace(re, replacement); });
        s = s.replace(/[.,#]/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    /**
     * Compare the client's master site address against any address-like strings
     * recorded on the audit plan, report, and certificate. The client's primary
     * site (client.sites[0]) is treated as the authoritative record — everything
     * else is compared against it. Tolerant of trim/case/punctuation and common
     * street-suffix abbreviations ("Drive" vs "Dr").
     *
     * Certificates (see certifications-module.js) carry no dedicated
     * address/location field of their own — the closest recorded site data is
     * the `sitesCovered[]` snapshot captured from client.sites at issuance time
     * (each entry has the same {address, city, ...} shape as a client site).
     * `certificate.address`/`certificate.siteAddress` are also honored for any
     * legacy/manually-entered records that do carry them directly. When a
     * certificate has neither, client.sites[0] alone remains authoritative —
     * there is nothing certificate-side to compare.
     *
     * A full CITY-level mismatch between the audit plan location and the site
     * master (the plan's location string doesn't reference the master's city
     * at all — not just a street-format difference like "Dr" vs "Drive") is
     * reported as its own distinct issue (`code: 'city_mismatch'`) carrying all
     * three recorded values (site master / plan / report), in place of the
     * generic per-field issue for that candidate.
     *
     * @returns {Array<{field, valueA, valueB, message, code?, siteMaster?, plan?, report?}>}
     *   empty when insufficient data
     */
    function checkAddressConsistency({ client, auditPlan, report, certificate } = {}) {
        const issues = [];
        const site = client && Array.isArray(client.sites) && client.sites[0];
        if (!site) return issues;

        const masterAddress = [site.address, site.city].filter(Boolean).join(', ');
        const normMaster = normalizeAddressText(masterAddress);
        if (!normMaster) return issues;
        const normMasterCity = normalizeAddressText(site.city);

        const reportLocationValue = report && (report.location || report.siteAddress || report.auditLocation);

        const certSite = certificate && Array.isArray(certificate.sitesCovered) && certificate.sitesCovered[0];
        const certSiteValue = certSite ? [certSite.address, certSite.city].filter(Boolean).join(', ') : null;

        const candidates = [
            { field: 'auditPlan.location', value: auditPlan && (auditPlan.location || auditPlan.siteAddress) },
            { field: 'auditPlan.address', value: auditPlan && auditPlan.address },
            { field: 'report.location', value: reportLocationValue },
            { field: 'certificate.address', value: certificate && (certificate.address || certificate.siteAddress) },
            { field: 'certificate.sitesCovered', value: certSiteValue }
        ];

        candidates.forEach(({ field, value }) => {
            if (!value) return;
            const normValue = normalizeAddressText(value);
            if (!normValue) return;
            // Substring match either direction tolerates partial address strings
            // (e.g. a report location field that only stores the city).
            if (normMaster.includes(normValue) || normValue.includes(normMaster)) return;

            if (field === 'auditPlan.location' && normMasterCity && !normValue.includes(normMasterCity)) {
                issues.push({
                    field,
                    code: 'city_mismatch',
                    valueA: masterAddress,
                    valueB: value,
                    siteMaster: masterAddress,
                    plan: value,
                    report: reportLocationValue || null,
                    message: `City-level address mismatch: the master client site record places this client in "${site.city}", but the audit plan location does not reference that city. Site master: "${masterAddress}" · Audit plan: "${value}" · Report: "${reportLocationValue || '(not recorded)'}".`
                });
                return;
            }

            issues.push({
                field,
                valueA: masterAddress,
                valueB: value,
                message: `Address on ${field} ("${value}") does not match the master client site record ("${masterAddress}").`
            });
        });

        return issues;
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

        // Master-data consistency
        checkAddressConsistency,

        // State lookups
        findClient,
        resolveReportClient,
        findAuditReport,
        findAuditPlan,

        // Audit-plan completion (single source of truth)
        isPlanCompleted,
        getPlanCompletionStats
    };

    log('DataService initialized');
})();

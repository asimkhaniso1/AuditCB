// ============================================
// AUDITCB NAMESPACE - Global Namespace Cleanup
// ============================================
// This file creates a single global AuditCB object to reduce namespace pollution
// Load this BEFORE all other modules

(function () {
    'use strict';

    // Create single global namespace
    window.AuditCB = window.AuditCB || {};

    // ============================================
    // CORE MODULES
    // ============================================

    window.AuditCB.Clients = {
        // Populated by clients-module.js
    };

    window.AuditCB.Plans = {
        // Populated by planning-module.js
    };

    window.AuditCB.Execution = {
        // Populated by execution-module.js
    };

    window.AuditCB.Reporting = {
        // Populated by reporting-module.js
    };

    window.AuditCB.Auditors = {
        // Populated by auditor-form-module.js
    };

    window.AuditCB.Settings = {
        // Populated by settings-module.js
    };

    window.AuditCB.Checklists = {
        // Populated by checklist-module.js
    };

    window.AuditCB.Advanced = {
        // Populated by advanced-modules.js
    };

    window.AuditCB.Governance = {
        // Appeals, Complaints, Impartiality
    };

    window.AuditCB.NCR = {
        // NCR/CAPA module
    };

    window.AuditCB.ManagementReview = {
        // Management review module
    };

    window.AuditCB.Certifications = {
        // Certification decisions module
    };

    // ============================================
    // UTILITIES & SERVICES
    // ============================================

    window.AuditCB.Utils = window.UTILS || {
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

    window.AuditCB.State = window.state || {};
    window.AuditCB.Constants = window.CONSTANTS || {};

    window.AuditCB.Services = {
        AI: window.AI_SERVICE || null,
        Supabase: window.SupabaseClient || null,
        Offline: window.OfflineManager || null
    };

    // ============================================
    // NAVIGATION
    // ============================================

    window.AuditCB.Navigation = {
        navigateTo: function (view, params) {
            window.location.hash = params ? `${view}/${params}` : view;
        },
        goBack: function () {
            window.history.back();
        }
    };

    // ============================================
    // COMMON UI FUNCTIONS
    // ============================================

    window.AuditCB.UI = {
        showNotification: window.showNotification || function (message, type) {
            console.log(`[${type}] ${message}`);
        },

        openModal: window.openModal || function () {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'block';
        },

        closeModal: window.closeModal || function () {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'none';
        },

        renderContentArea: function (html) {
            if (window.contentArea) {
                window.contentArea.innerHTML = html;
            }
        }
    };

    // ============================================
    // BACKWARD COMPATIBILITY
    // ============================================
    // Temporary aliases for gradual migration
    // Remove these after updating all function calls

    window.AuditCB._deprecationWarnings = new Set();

    window.AuditCB._createDeprecatedAlias = function (oldName, newRef, moduleName) {
        Object.defineProperty(window, oldName, {
            get: function () {
                // Only warn once per function
                if (!window.AuditCB._deprecationWarnings.has(oldName)) {
                    console.warn(
                        `⚠️ DEPRECATED: window.${oldName} is deprecated. ` +
                        `Use AuditCB.${moduleName}.${oldName.replace('render', '')} instead.`
                    );
                    window.AuditCB._deprecationWarnings.add(oldName);
                }
                return newRef;
            },
            configurable: true
        });
    };

    // ============================================
    // HELPER METHODS
    // ============================================

    window.AuditCB.version = '1.0.0';

    window.AuditCB.debug = function () {
        console.log('AuditCB Namespace Info:');
        console.log('- Version:', window.AuditCB.version);
        console.log('- Modules loaded:', Object.keys(window.AuditCB).filter(k =>
            typeof window.AuditCB[k] === 'object' &&
            !['Utils', 'State', 'Constants', 'Services'].includes(k)
        ));
        console.log('- Deprecated warnings:', window.AuditCB._deprecationWarnings.size);
    };

    console.log('✅ AuditCB Namespace initialized');

})();

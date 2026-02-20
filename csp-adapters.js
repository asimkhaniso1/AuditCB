/**
 * csp-adapters.js — Adapter functions for CSP inline handler migration.
 * 
 * These wrap complex multi-statement inline handlers that were migrated
 * from onclick/onchange to data-action/data-action-change attributes.
 * Each function is exposed on window so the event-delegator can call it.
 */

(function () {
    'use strict';

    // ─── Toggle display of an element by ID ─────────────────────────
    window.toggleDisplay = function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };

    // ─── Toggle original notes with text update ─────────────────────
    window.toggleOrigNotes = function (id) {
        var el = document.getElementById('orig-note-' + id);
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
        // Find the calling button's span and update text
        var btn = document.querySelector('[data-action="toggleOrigNotes"][data-id="' + id + '"]');
        if (btn) {
            var span = btn.querySelector('span');
            if (span) span.textContent = el.style.display === 'none' ? 'View Original Notes' : 'Hide Original Notes';
        }
    };

    // ─── View evidence image (fallback to data-id src) ──────────────
    window.viewEvidenceImageByUrlSelf = function (el) {
        var src = el.src || el.dataset.id || '';
        if (window.viewEvidenceImageByUrl) window.viewEvidenceImageByUrl(src);
    };

    // ─── Click a tab by data-tab value ──────────────────────────────
    window.clickTab = function (tabName) {
        var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
        if (btn) btn.click();
    };

    // ─── Set report recommendation ──────────────────────────────────
    window.setReportRecommendation = function (el, dataset) {
        var reportId = dataset.id;
        if (!window.state || !window.state.auditReports) return;
        var report = window.state.auditReports.find(function (r) { return String(r.id) === String(reportId); });
        if (report) {
            report.recommendation = el.value;
            if (window.saveData) window.saveData();
        }
    };

    // ─── Set gallery main image src ─────────────────────────────────
    window.setGalleryMainSrc = function (el) {
        var main = document.getElementById('ev-gallery-main');
        if (main && el.src) main.src = el.src;
    };

    // ─── Toggle element visibility based on select value ────────────
    window.toggleElementIfValue = function (el, dataset) {
        var targetId = dataset.id;
        var triggerValue = dataset.arg1;
        var targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.style.display = el.value === triggerValue ? 'block' : 'none';
        }
    };

    // ─── Checklist accordion toggle with icon ───────────────────────
    window.toggleAccordion = function (el) {
        var next = el.nextElementSibling;
        if (!next) return;
        next.style.display = next.style.display === 'none' ? 'block' : 'none';
        var icon = el.querySelector('.accordion-icon');
        if (icon) icon.style.transform = next.style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)';
    };

    window.toggleSubAccordion = function (el) {
        var next = el.nextElementSibling;
        if (!next) return;
        next.style.display = next.style.display === 'none' ? 'block' : 'none';
        var icon = el.querySelector('.sub-icon');
        if (icon) icon.style.transform = next.style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)';
    };

    // ─── Checkbox toggle styling ────────────────────────────────────
    window.toggleCheckboxStyle = function (el) {
        var parent = el.parentElement;
        var label = el.nextElementSibling;
        if (parent) parent.classList.toggle('active', el.checked);
        if (label) {
            label.style.borderColor = el.checked ? '#3b82f6' : '#cbd5e1';
            label.style.color = el.checked ? '#2563eb' : '#64748b';
        }
    };

    // ─── Format date and update previous sibling ────────────────────
    window.formatDatePrev = function (el) {
        if (!el.value) return;
        var formatted = new Date(el.value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        var prev = el.previousElementSibling;
        if (prev) {
            prev.value = formatted;
            prev.dispatchEvent(new Event('change'));
        }
    };

    // ─── Update cert field + auto-fill expiry ───────────────────────
    window.updateCertFieldAndExpiry = function (el, dataset) {
        var clientId = dataset.arg1;
        var index = dataset.arg2;
        var field = dataset.arg3;
        if (window.updateCertField) window.updateCertField(clientId, index, field, el.value);
        if (window.autoFillExpiry) window.autoFillExpiry(el);
    };

    // ─── Finalize org setup ─────────────────────────────────────────
    window.finalizeOrgSetup = function (clientId) {
        if (window.showNotification) window.showNotification('Organization setup finalized successfully!', 'success');
        if (window.switchClientDetailTab) window.switchClientDetailTab(clientId, 'scopes');
    };

    // ─── NCR toggle closed CAPAs ────────────────────────────────────
    window.toggleClosedCAPAs = function (el) {
        if (window.state) window.state.showClosedCAPAs = el.checked;
        if (typeof renderNCRCAPAModuleContent === 'function') {
            renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        } else if (window.renderNCRCAPAModuleContent) {
            window.renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        }
    };

    // ─── Planning module: toggle client docs body ───────────────────
    window.toggleClientDocsBody = function (el) {
        var card = el.closest('.card');
        if (!card) return;
        var body = card.querySelector('.client-docs-body');
        var arrow = el.querySelector('.doc-arrow');
        if (body) {
            if (body.style.display === 'none') {
                body.style.display = 'block';
                if (arrow) arrow.style.transform = 'rotate(90deg)';
            } else {
                body.style.display = 'none';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        }
    };

    // ─── Navigate to auditor detail ─────────────────────────────────
    window.navigateToAuditorDetail = function (id) {
        if (window.state) window.state.currentModule = 'auditors';
        if (window.renderAuditors) window.renderAuditors();
        setTimeout(function () {
            if (window.renderAuditorDetail) window.renderAuditorDetail(id);
        }, 100);
    };

    // ─── Clear activity logs with confirmation ──────────────────────
    window.clearActivityLogs = function () {
        if (confirm('Clear all activity logs?')) {
            if (window.AuditTrail && window.AuditTrail.clear) window.AuditTrail.clear();
            if (window.switchSettingsSubTab) window.switchSettingsSubTab('system', 'activity-log');
        }
    };

    // ─── Update skill value display ─────────────────────────────────
    window.updateSkillValue = function (el) {
        // Find the corresponding skill-val element
        var selectId = el.id; // e.g. "skill-ethical"
        var valId = selectId.replace('skill-', 'skill-val-');
        var valEl = document.getElementById(valId);
        if (valEl) {
            valEl.textContent = el.value === 'excellent' ? '5/5' : el.value === 'good' ? '4/5' : '3/5';
        }
    };

    // ─── Copy certification embed code ──────────────────────────────
    window.copyCertEmbed = function (el) {
        // Find the closest embed code container and copy its text
        var container = el.closest('.embed-code-container') || el.parentElement;
        var codeEl = container ? container.querySelector('code, pre, textarea') : null;
        var text = codeEl ? (codeEl.textContent || codeEl.value) : '';
        if (text) {
            navigator.clipboard.writeText(text).then(function () {
                if (window.showNotification) window.showNotification('Copied to clipboard!', 'success');
            });
        }
    };

    // ─── File upload validation + name auto-fill ──────────────────────
    window.handleDocFileChange = function (el) {
        if (!el.files || !el.files[0]) return;
        var file = el.files[0];
        if (file.size > 5242880) {
            alert('File is too large! Max limit is 5MB.');
            el.value = '';
            var nameField = document.getElementById('doc-name');
            if (nameField) nameField.value = '';
            return;
        }
        // Auto-fill the doc name field if empty or always (depending on context)
        var nameField = document.getElementById('doc-name');
        if (nameField && !nameField.value) {
            nameField.value = file.name;
        }
    };

    // ─── File upload validation (always sets name) ──────────────────
    window.handleDocFileChangeAlways = function (el) {
        if (!el.files || !el.files[0]) return;
        var file = el.files[0];
        if (file.size > 5242880) {
            alert('File is too large! Max limit is 5MB.');
            el.value = '';
            var nameField = document.getElementById('doc-name');
            if (nameField) nameField.value = '';
            return;
        }
        var nameField = document.getElementById('doc-name');
        if (nameField) nameField.value = file.name;
    };

    // ─── switchSettingsMainTab adapter (passes 'this' context) ──────
    // The original called switchSettingsMainTab('tab-id', this) where 'this' = button
    var origSwitchSettingsMainTab = null;
    window.addEventListener('DOMContentLoaded', function () {
        origSwitchSettingsMainTab = window.switchSettingsMainTab;
    });

    // Override for event-delegator compatibility
    var _origSwitchSettingsMainTabBound = false;
    function ensureSwitchSettingsMainTabWrapped() {
        if (_origSwitchSettingsMainTabBound) return;
        var orig = window.switchSettingsMainTab;
        if (typeof orig === 'function') {
            _origSwitchSettingsMainTabBound = true;
            // The event delegator calls fn(id) but original expects fn(id, buttonEl)
            // We keep the original function — the event delegator passes (el, dataset, e) when no args, 
            // or (id) when data-id is present. We just let it work as-is.
        }
    }

    // ─── switchCertTab adapter ──────────────────────────────────────
    // Original: switchCertTab(this, 'tab-id') — button as first arg
    // Delegator calls: switchCertTab('tab-id') — just the ID
    // We need to find the button ourselves
    var _origSwitchCertTab = null;
    Object.defineProperty(window, 'switchCertTab', {
        configurable: true,
        get: function () { return _origSwitchCertTab; },
        set: function (fn) {
            _origSwitchCertTab = function (idOrEl, maybeId) {
                if (typeof idOrEl === 'string' && !maybeId) {
                    // Called by event delegator with just the tab ID
                    var btn = document.querySelector('[data-action="switchCertTab"][data-id="' + idOrEl + '"]');
                    fn.call(null, btn || idOrEl, idOrEl);
                } else {
                    fn.call(null, idOrEl, maybeId);
                }
            };
        }
    });

})();

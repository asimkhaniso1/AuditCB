/**
 * csp-boot.js — Early-boot scripts externalized from index.html for CSP compliance.
 * This file MUST load before any other app scripts (placed in <head>).
 *
 * Contents:
 *  1. Emergency DOMPurify / Sanitizer / UTILS fallbacks
 *  2. Cache-busting / Service Worker purge (v19.0)
 *  3. PDF.js worker config
 */

(function () {
    'use strict';

    // ─── 1. Emergency Fallbacks ────────────────────────────────────
    // Ensure critical security objects exist even if CDNs fail

    if (typeof window.DOMPurify === 'undefined') {
        console.warn('⚠️ DOMPurify missing - Initializing EMERGENCY fallbacks');
        window.DOMPurify = {
            sanitize: function (dirty) { return dirty; },
            isEmergency: true
        };
    }

    // Initialize Sanitizer shell immediately to prevent ReferenceErrors during early boot
    window.Sanitizer = window.Sanitizer || {
        sanitizeHTML: function (d) { return window.DOMPurify ? window.DOMPurify.sanitize(d) : d; },
        sanitizeText: function (d) { return d; },
        sanitizeURL: function (d) { return d; },
        escapeHTML: function (d) { return d; },
        _placeholder: true
    };

    // UTILS Fallback: Ensure basic escaping exists if utils.js fails
    window.UTILS = window.UTILS || {
        escapeHtml: function (s) {
            if (!s) return '';
            return String(s).replace(/[&<>"']/g, function (m) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
            });
        }
    };

    // ─── 2. Cache-Busting / Service Worker Purge (v19.0) ───────────
    var APP_VERSION = '19.0';

    // Purge Cache API (Breaking the most stubborn level of caching)
    if ('caches' in window) {
        caches.keys().then(function (names) {
            for (var i = 0; i < names.length; i++) {
                caches.delete(names[i]);
            }
        });
    }

    // Unregister all Service Workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (var i = 0; i < registrations.length; i++) {
                registrations[i].unregister();
            }
        });
    }

    // Force Reload logic
    if (window.location.search.indexOf('v=' + APP_VERSION) === -1 && !localStorage.getItem('v' + APP_VERSION + '_reloaded')) {
        localStorage.setItem('v' + APP_VERSION + '_reloaded', 'true');
        window.location.href = window.location.pathname + '?v=' + APP_VERSION + '&purge=' + Date.now() + window.location.hash;
    } else if (window.location.search) {
        // Clean up URL after purge - remove query params
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
})();

// ─── 3. PDF.js Worker Configuration ───────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

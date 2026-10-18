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

    // Shared escape used by every emergency fallback below — never pass dirty
    // HTML through unchanged just because a CDN failed to load.
    function emergencyEscape(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    if (typeof window.DOMPurify === 'undefined') {
        console.warn('⚠️ DOMPurify missing - Initializing EMERGENCY fallbacks');
        window.DOMPurify = {
            sanitize: function (dirty) { return emergencyEscape(dirty); },
            isEmergency: true
        };
    }

    // Initialize Sanitizer shell immediately to prevent ReferenceErrors during early boot
    window.Sanitizer = window.Sanitizer || {
        sanitizeHTML: function (d) { return window.DOMPurify ? window.DOMPurify.sanitize(d) : emergencyEscape(d); },
        sanitizeText: function (d) { return emergencyEscape(d); },
        sanitizeURL: function (d) { return d; },
        escapeHTML: function (d) { return emergencyEscape(d); },
        _placeholder: true
    };

    // UTILS Fallback: Ensure basic escaping exists if utils.js fails
    window.UTILS = window.UTILS || {
        escapeHtml: emergencyEscape
    };

    // ─── 2. Cache-Busting / Service Worker Purge (v19.0) ───────────
    var APP_VERSION = '19.0';

    // No forced reload: build.js content-hashes every JS/CSS URL (?h=<md5>)
    // and index.html is served no-cache, so a fresh page load already gets
    // fresh assets. The old "?v=&purge=" redirect made every first-time or
    // private-window visitor download the whole app twice.
    //
    // One-time (per APP_VERSION) cleanup of what older builds left behind: a
    // registered service worker and its Cache API entries. Runs once, not on
    // every load. The flag key is the one the old reload logic set, so
    // browsers that already purged for this version skip it.
    var CLEANUP_KEY = 'v' + APP_VERSION + '_reloaded';
    var cleanedUp = true;
    try { cleanedUp = !!localStorage.getItem(CLEANUP_KEY); } catch (_e) { /* storage blocked: skip */ }
    if (!cleanedUp) {
        try { localStorage.setItem(CLEANUP_KEY, 'true'); } catch (_e) { /* ignore */ }

        if ('caches' in window) {
            caches.keys().then(function (names) {
                for (var i = 0; i < names.length; i++) {
                    caches.delete(names[i]);
                }
            }).catch(function () { /* ignore */ });
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister();
                }
            }).catch(function () { /* ignore */ });
        }
    }

    // A stale bookmark / shared link from the old redirect (?v=19.0&purge=…):
    // drop just those two params, in place, without navigating.
    if (/[?&](v|purge)=/.test(window.location.search)) {
        var kept = window.location.search.replace(/^\?/, '').split('&').filter(function (p) {
            return p && !/^(v|purge)=/.test(p);
        });
        window.history.replaceState(null, '', window.location.pathname + (kept.length ? '?' + kept.join('&') : '') + window.location.hash);
    }
})();

// ─── 3. CDN Fallbacks ────────────────────────────────────────────
// Check after DOM loads whether CDN scripts loaded; inject fallbacks if not.
// (PDF.js now loads on first use via lib-loader.js; settings-kb.js's
// ensurePdfWorker sets up its worker then.)
document.addEventListener('DOMContentLoaded', function () {

    // DOMPurify CDN fallback: if cdnjs failed, try unpkg
    if (typeof DOMPurify === 'undefined' || window.DOMPurify.isEmergency) {
        var dpScript = document.createElement('script');
        dpScript.src = 'https://unpkg.com/dompurify@3.0.6/dist/purify.min.js';
        document.head.appendChild(dpScript);
    }

    // Chart.js CDN fallback: if jsdelivr failed, try cdnjs
    if (typeof Chart === 'undefined') {
        var cjScript = document.createElement('script');
        cjScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        document.head.appendChild(cjScript);
    }
});

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMPurify;
}

/**
 * event-delegator.js — Centralized event delegation for CSP compliance.
 * 
 * Replaces inline event handlers (onclick, onchange, oninput, onsubmit)
 * with a single delegated listener per event type. Elements use data attributes:
 *
 *   data-action="functionName"        → calls window[functionName](el, dataset, event)
 *   data-hash="dashboard"             → sets window.location.hash = value
 *   data-action-change="functionName" → onchange delegation
 *   data-action-input="functionName"  → oninput delegation
 *
 * Loaded before modules so delegation is ready when DOM renders.
 */

(function () {
    'use strict';

    /**
     * Extract positional arguments from data-id / data-arg1..data-argN attributes.
     * Returns array of args if found, empty array if none.
     */
    function extractArgs(el) {
        // Check for data-arg1, data-arg2, ... (multi-arg pattern)
        var args = [];
        for (var i = 1; i <= 10; i++) {
            var val = el.getAttribute('data-arg' + i);
            if (val === null) break;
            args.push(val);
        }
        if (args.length > 0) return args;

        // Check for data-id (single-arg pattern)
        var id = el.getAttribute('data-id');
        if (id !== null) return [id];

        return [];
    }

    // ─── Click Delegation ────────────────────────────────────────────
    document.addEventListener('click', function (e) {
        // 1. data-hash: simple hash navigation
        var hashTarget = e.target.closest('[data-hash]');
        if (hashTarget) {
            e.preventDefault();
            window.location.hash = hashTarget.dataset.hash;
            return;
        }

        // 2. data-action: call a window function
        var actionTarget = e.target.closest('[data-action]');
        if (actionTarget) {
            var action = actionTarget.dataset.action;
            var fn = window[action];
            if (typeof fn === 'function') {
                // Build argument list from data-* attributes
                var args = extractArgs(actionTarget);
                if (args.length > 0) {
                    fn.apply(null, args);
                } else {
                    // No args — pass element context (for toggleNavGroup-like handlers)
                    fn.call(actionTarget, actionTarget, actionTarget.dataset, e);
                }
            } else if (window.Logger) {
                window.Logger.warn('EventDelegator', 'Unknown action: ' + action);
            }
            return;
        }
    });

    // ─── Change Delegation ───────────────────────────────────────────
    document.addEventListener('change', function (e) {
        var target = e.target.closest('[data-action-change]');
        if (!target) return;
        var action = target.dataset.actionChange;
        var fn = window[action];
        if (typeof fn === 'function') {
            fn.call(target, target, target.dataset, e);
        }
    });

    // ─── Input Delegation ────────────────────────────────────────────
    document.addEventListener('input', function (e) {
        var target = e.target.closest('[data-action-input]');
        if (!target) return;
        var action = target.dataset.actionInput;
        var fn = window[action];
        if (typeof fn === 'function') {
            fn.call(target, target, target.dataset, e);
        }
    });

    // ─── Submit Delegation ───────────────────────────────────────────
    document.addEventListener('submit', function (e) {
        var form = e.target.closest('[data-action-submit]');
        if (!form) return;
        e.preventDefault();
        var action = form.dataset.actionSubmit;
        var fn = window[action];
        if (typeof fn === 'function') {
            fn.call(form, form, form.dataset, e);
        }
    });

})();

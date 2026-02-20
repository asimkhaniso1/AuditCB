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
        var args = [];
        for (var i = 1; i <= 10; i++) {
            var val = el.getAttribute('data-arg' + i);
            if (val === null) break;
            args.push(val);
        }
        if (args.length > 0) return args;
        var id = el.getAttribute('data-id');
        if (id !== null) return [id];
        return [];
    }

    // ─── Built-in helper actions ───────────────────────────────────────
    // These are simple DOM operations that don't warrant separate global functions.
    var builtins = {
        // Element manipulation
        clickElement: function (_t, id) { var el = document.getElementById(id); if (el) el.click(); },
        removeElement: function (_t, id) { var el = document.getElementById(id); if (el) el.remove(); },
        removeSelf: function (t) { if (t) t.remove(); },

        // Toggle classes on siblings / parents
        toggleNextCollapsed: function (t) { if (t.nextElementSibling) t.nextElementSibling.classList.toggle('collapsed'); },
        toggleNextHidden: function (t) { if (t.nextElementSibling) t.nextElementSibling.classList.toggle('hidden'); },
        toggleCardItems: function (t) {
            var card = t.closest('.card');
            if (card) { var list = card.querySelector('.items-list'); if (list) list.classList.toggle('hidden'); }
        },
        toggleHidden: function (_t, id) { var el = document.getElementById(id); if (el) el.classList.toggle('hidden'); },

        // Parent removal / hiding
        hideGrandparent: function (t) { if (t.parentElement && t.parentElement.parentElement) t.parentElement.parentElement.style.display = 'none'; },
        removeGrandparent: function (t) { if (t.parentElement && t.parentElement.parentElement) t.parentElement.parentElement.remove(); },
        removeClosestTR: function (t) { var tr = t.closest('tr'); if (tr) tr.remove(); },
        stopProp: function () { /* only stop propagation, handled in delegation */ },

        // Clipboard
        copyToClipboard: function (_t, text, msg) {
            navigator.clipboard.writeText(text).then(function () {
                if (window.showNotification) window.showNotification(msg || 'Copied!', 'success');
            });
        },
        copyToClipboardSelf: function (t, msg) {
            var text = t.textContent || t.innerText || '';
            navigator.clipboard.writeText(text).then(function () {
                if (window.showNotification) window.showNotification(msg || 'Copied!', 'success');
            });
        },

        // Geolocation
        getGeolocation: function (_t, targetId) {
            navigator.geolocation.getCurrentPosition(function (pos) {
                var el = document.getElementById(targetId);
                if (el) el.value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
            });
        },

        // Hash + tab click combo
        hashThenClickTab: function (_t, hash, tabName) {
            window.location.hash = hash;
            setTimeout(function () {
                var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
                if (btn) btn.click();
            }, 300);
        },

        // Password utilities
        generatePassword: function (_t, id) {
            var el = document.getElementById(id);
            if (el && window.PasswordUtils) el.value = window.PasswordUtils.generateSecurePassword();
        },
        togglePasswordVisibility: function (_t, id) {
            var el = document.getElementById(id);
            if (el) el.type = el.type === 'password' ? 'text' : 'password';
        },

        // Report section expand/collapse all
        expandAllSections: function () { document.querySelectorAll('.rp-sec-body').forEach(function (b) { b.classList.remove('collapsed'); }); },
        collapseAllSections: function () { document.querySelectorAll('.rp-sec-body').forEach(function (b) { b.classList.add('collapsed'); }); },

        // Open image in new tab
        openImageInNewTab: function (t) { if (t.src) window.open(t.src, '_blank'); },
    };

    // ─── Object-method dispatch ──────────────────────────────────────
    // Actions like "DataMigration_migrateToSupabase" → DataMigration.migrateToSupabase()
    function tryObjectMethod(action, target, args) {
        var parts = action.split('_');
        if (parts.length < 2) return false;
        var obj = window[parts[0]];
        var method = parts.slice(1).join('_');
        if (obj && typeof obj[method] === 'function') {
            if (args.length > 0) {
                obj[method].apply(obj, args);
            } else {
                obj[method].call(obj, target);
            }
            return true;
        }
        return false;
    }

    // ─── Click Delegation ────────────────────────────────────────────
    document.addEventListener('click', function (e) {
        // 1. data-hash: simple hash navigation
        var hashTarget = e.target.closest('[data-hash]');
        if (hashTarget) {
            if (hashTarget.dataset.stopProp === 'true') e.stopPropagation();
            e.preventDefault();
            window.location.hash = hashTarget.dataset.hash;
            return;
        }

        // 2. data-action: call a built-in, window function, or object method
        var actionTarget = e.target.closest('[data-action]');
        if (actionTarget) {
            var action = actionTarget.dataset.action;
            if (actionTarget.dataset.stopProp === 'true') e.stopPropagation();

            // Check built-in actions first
            if (builtins[action]) {
                var args = extractArgs(actionTarget);
                // Builtins always receive (target, ...args)
                builtins[action].apply(null, [actionTarget].concat(args));
                return;
            }

            // Check window function
            var fn = window[action];
            if (typeof fn === 'function') {
                // Check for data-json (structured object data)
                var jsonStr = actionTarget.getAttribute('data-json');
                if (jsonStr) {
                    try {
                        var jsonData = JSON.parse(jsonStr.replace(/&#39;/g, "'"));
                        var type = actionTarget.dataset.arg1 || '';
                        fn.call(null, type, jsonData);
                    } catch (err) {
                        console.warn('EventDelegator: data-json parse error', err);
                    }
                    return;
                }
                var args2 = extractArgs(actionTarget);
                if (args2.length > 0) {
                    fn.apply(null, args2);
                } else {
                    fn.call(actionTarget, actionTarget, actionTarget.dataset, e);
                }
                return;
            }

            // Check object.method pattern (e.g. DataMigration_migrateToSupabase)
            var args3 = extractArgs(actionTarget);
            if (tryObjectMethod(action, actionTarget, args3)) return;

            if (window.Logger) {
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
            // Support file upload: data-file="true" passes files[0]
            if (target.dataset.file === 'true' && target.files && target.files[0]) {
                var args = extractArgs(target);
                args.push(target.files[0]);
                fn.apply(null, args);
            } else {
                fn.call(target, target, target.dataset, e);
            }
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

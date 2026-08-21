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
        let args = [];
        for (var i = 1; i <= 10; i++) {
            let val = el.getAttribute('data-arg' + i);
            if (val === null) break;
            args.push(val);
        }
        if (args.length > 0) return args;
        let id = el.getAttribute('data-id');
        if (id !== null) return [id];
        return [];
    }

    // ─── Built-in helper actions ───────────────────────────────────────
    // These are simple DOM operations that don't warrant separate global functions.
    let builtins = {
        // Element manipulation
        clickElement: function (_t, id) { var el = document.getElementById(id); if (el) el.click(); },
        removeElement: function (_t, id) { var el = document.getElementById(id); if (el) el.remove(); },
        removeSelf: function (t) { if (t) t.remove(); },

        // Toggle classes on siblings / parents
        toggleNextCollapsed: function (t) { if (t.nextElementSibling) t.nextElementSibling.classList.toggle('collapsed'); },
        toggleNextHidden: function (t) { if (t.nextElementSibling) t.nextElementSibling.classList.toggle('hidden'); },
        toggleCardItems: function (t) {
            let card = t.closest('.card');
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
            let text = t.textContent || t.innerText || '';
            navigator.clipboard.writeText(text).then(function () {
                if (window.showNotification) window.showNotification(msg || 'Copied!', 'success');
            });
        },

        // Geolocation
        getGeolocation: function (_t, targetId) {
            navigator.geolocation.getCurrentPosition(function (pos) {
                let el = document.getElementById(targetId);
                if (el) el.value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
            });
        },

        // Hash + tab click combo
        hashThenClickTab: function (_t, hash, tabName) {
            window.location.hash = hash;
            setTimeout(function () {
                let btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
                if (btn) btn.click();
            }, 300);
        },

        // Password utilities
        generatePassword: function (_t, id) {
            let el = document.getElementById(id);
            if (el && window.PasswordUtils) el.value = window.PasswordUtils.generateSecurePassword();
        },
        togglePasswordVisibility: function (_t, id) {
            let el = document.getElementById(id);
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
        let parts = action.split('_');
        if (parts.length < 2) return false;
        let obj = window[parts[0]];
        let method = parts.slice(1).join('_');
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
        let hashTarget = e.target.closest('[data-hash]');
        if (hashTarget) {
            if (hashTarget.dataset.stopProp === 'true') e.stopPropagation();
            e.preventDefault();
            window.location.hash = hashTarget.dataset.hash;
            return;
        }

        // 2. data-action: call a built-in, window function, or object method
        let actionTarget = e.target.closest('[data-action]');
        if (actionTarget) {
            let action = actionTarget.dataset.action;
            if (actionTarget.dataset.stopProp === 'true') e.stopPropagation();

            // An <a href="#"> that carries an action would run the action and
            // then navigate to '#', and that hash change re-renders the router
            // straight back to the default view — so the action looks like it
            // did nothing. Only placeholder hrefs are suppressed; a real link
            // still navigates.
            if (actionTarget.tagName === 'A') {
                let href = actionTarget.getAttribute('href');
                if (href === '#' || href === '' || href === null || /^javascript:/i.test(href)) {
                    e.preventDefault();
                }
            }

            // Check built-in actions first
            if (builtins[action]) {
                let args = extractArgs(actionTarget);
                // Builtins always receive (target, ...args)
                builtins[action].apply(null, [actionTarget].concat(args));
                return;
            }

            // Check window function
            let fn = window[action];
            if (typeof fn === 'function') {
                // Check for data-json (structured object data)
                let jsonStr = actionTarget.getAttribute('data-json');
                if (jsonStr) {
                    try {
                        let jsonData = JSON.parse(jsonStr.replace(/&#39;/g, "'"));
                        let type = actionTarget.dataset.arg1 || '';
                        fn.call(null, type, jsonData);
                    } catch (err) {
                        console.warn('EventDelegator: data-json parse error', err);
                    }
                    return;
                }
                let args2 = extractArgs(actionTarget);
                // Resolve the same 'this' / 'this.value' placeholders the change
                // handler supports. Without this, data-arg2="this" arrived as the
                // literal string and handlers expecting the element threw — the
                // NCR & CAPA tabs (OFI/OBS, CAPA Tracker, Verification, Analytics)
                // all failed on "this".classList.add. 19 call sites use it.
                args2 = args2.map(function (a) {
                    if (a === 'this.value') return actionTarget.value;
                    if (a === 'this.checked') return actionTarget.checked;
                    if (a === 'this') return actionTarget;
                    return a;
                });
                if (args2.length > 0) {
                    fn.apply(null, args2);
                } else {
                    fn.call(actionTarget, actionTarget, actionTarget.dataset, e);
                }
                return;
            }

            // Check object.method pattern (e.g. DataMigration_migrateToSupabase)
            let args3 = extractArgs(actionTarget);
            if (tryObjectMethod(action, actionTarget, args3)) return;

            if (window.Logger) {
                window.Logger.warn('EventDelegator', 'Unknown action: ' + action + ' — will retry in 500ms (deferred script may still be loading)');
            }
            // Retry once after delay — deferred scripts may not have loaded yet
            setTimeout(function() {
                let retryFn = window[action];
                if (typeof retryFn === 'function') {
                    let retryArgs = extractArgs(actionTarget);
                    if (retryArgs.length > 0) {
                        retryFn.apply(null, retryArgs);
                    } else {
                        retryFn.call(actionTarget, actionTarget, actionTarget.dataset, e);
                    }
                } else if (tryObjectMethod(action, actionTarget, extractArgs(actionTarget))) {
                    // resolved via object.method pattern
                } else {
                    if (window.Logger) window.Logger.error('EventDelegator', 'Action still not found after retry: ' + action);
                }
            }, 500);
            return;
        }
    });

    // ─── Change Delegation ───────────────────────────────────────────
    document.addEventListener('change', function (e) {
        let target = e.target.closest('[data-action-change]');
        if (!target) return;
        let action = target.dataset.actionChange;
        let fn = window[action];
        if (typeof fn === 'function') {
            // Support file upload: data-file="true" passes files[0]
            if (target.dataset.file === 'true' && target.files && target.files[0]) {
                let args = extractArgs(target);
                args.push(target.files[0]);
                fn.apply(null, args);
            } else {
                // Extract positional args like click handler does
                let args = extractArgs(target);
                if (args.length > 0) {
                    // Resolve 'this' / 'this.value' / 'this.checked' placeholders to the
                    // element / its value / its checked state — same resolution the click
                    // delegator already applies (see its comment above). Without
                    // 'this.checked' here, a checkbox's data-arg="this.checked" arrived as
                    // the literal string "this.checked", which is neither true/'true'/'on'
                    // nor falsy, so a handler comparing it against those always read it as
                    // unchecked (e.g. the checklist Gap Analysis screen's "Show only gaps"
                    // and per-standard checkboxes never registered a checked state).
                    args = args.map(function (a) {
                        if (a === 'this.value') return target.value;
                        if (a === 'this.checked') return target.checked;
                        if (a === 'this') return target;
                        return a;
                    });
                    fn.apply(null, args);
                } else {
                    fn.call(target, target, target.dataset, e);
                }
            }
        }
    });

    // ─── Blur Delegation ─────────────────────────────────────────────
    // Uses focusout, which bubbles; blur does not, so document-level
    // delegation cannot see it. 'this.innerText' is resolved alongside the
    // value/checked placeholders because the field that needs this is a
    // contenteditable, which has no .value at all.
    document.addEventListener('focusout', function (e) {
        let target = e.target.closest && e.target.closest('[data-action-blur]');
        if (!target) return;
        let action = target.dataset.actionBlur;
        let fn = window[action];
        if (typeof fn !== 'function') {
            if (window.Logger) window.Logger.error('EventDelegator', 'Blur action not found: ' + action);
            return;
        }
        let args = extractArgs(target);
        if (args.length > 0) {
            args = args.map(function (a) {
                if (a === 'this.value') return target.value;
                if (a === 'this.innerText') return target.innerText;
                if (a === 'this.checked') return target.checked;
                if (a === 'this') return target;
                return a;
            });
            fn.apply(null, args);
        } else {
            fn.call(target, target, target.dataset, e);
        }
    });

    // ─── Input Delegation ────────────────────────────────────────────
    document.addEventListener('input', function (e) {
        let target = e.target.closest('[data-action-input]');
        if (!target) return;
        let action = target.dataset.actionInput;
        let fn = window[action];
        if (typeof fn === 'function') {
            fn.call(target, target, target.dataset, e);
        }
    });

    // ─── Submit Delegation ───────────────────────────────────────────
    document.addEventListener('submit', function (e) {
        let form = e.target.closest('[data-action-submit]');
        if (!form) return;
        e.preventDefault();
        let action = form.dataset.actionSubmit;
        let fn = window[action];
        if (typeof fn === 'function') {
            fn.call(form, form, form.dataset, e);
        }
    });

})();

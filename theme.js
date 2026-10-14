// ============================================
// THEME SWITCHER — light / dark (ESM-ready)
// ============================================
// Loaded synchronously in <head>, before the page paints, so a saved dark
// preference never flashes white first. The choice is explicit and stored per
// browser; the app never follows the OS setting on its own (see theme.css).
//
// The header button calls window.toggleTheme through the event delegator
// (data-action="toggleTheme"), the same way every other control is wired.

(function (global) {
    'use strict';

    const STORAGE_KEY = 'audit360.theme';
    const THEMES = ['light', 'dark'];

    function root() {
        return global.document ? global.document.documentElement : null;
    }

    // Storage can be unavailable (private windows, blocked site data); the
    // theme then simply falls back to light for the session.
    function read() {
        try {
            const stored = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
            return THEMES.includes(stored) ? stored : 'light';
        } catch (_e) {
            return 'light';
        }
    }

    function save(theme) {
        try {
            if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, theme);
        } catch (_e) { /* preference just won't persist */ }
    }

    function current() {
        const el = root();
        return el && el.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    // Keep the header button honest about what it will do next.
    function syncToggle(theme) {
        const btn = global.document && global.document.getElementById('theme-toggle');
        if (!btn) return;
        const dark = theme === 'dark';
        const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
        btn.setAttribute('aria-pressed', String(dark));
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        const icon = btn.querySelector('i');
        if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    function apply(theme) {
        const next = THEMES.includes(theme) ? theme : 'light';
        const el = root();
        if (el) el.setAttribute('data-theme', next);
        syncToggle(next);
        return next;
    }

    function set(theme) {
        const next = apply(theme);
        save(next);
        return next;
    }

    function toggle() {
        return set(current() === 'dark' ? 'light' : 'dark');
    }

    // Apply before first paint.
    apply(read());

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', () => syncToggle(current()));
        } else {
            syncToggle(current());
        }
    }

    // A change made in another tab of the app follows here too.
    if (global.addEventListener) {
        global.addEventListener('storage', (event) => {
            if (event.key === STORAGE_KEY) apply(event.newValue);
        });
    }

    const ThemeSwitcher = { STORAGE_KEY, THEMES, read, apply, set, toggle, current };
    global.ThemeSwitcher = ThemeSwitcher;
    global.toggleTheme = toggle;

    if (typeof module !== 'undefined' && module.exports) module.exports = ThemeSwitcher;
})(typeof window !== 'undefined' ? window : globalThis);

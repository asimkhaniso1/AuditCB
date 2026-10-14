import { describe, it, expect, beforeEach } from 'vitest';

// theme.js runs as a <head> script: it applies the saved theme the moment it
// loads, before the page paints. Each test re-evaluates it against a prepared
// document and storage, the way a fresh page load would.
const fs = await import('fs');
const path = await import('path');
const THEME_JS = fs.readFileSync(path.resolve('./theme.js'), 'utf8');
const THEME_CSS = fs.readFileSync(path.resolve('./theme.css'), 'utf8');
const KEY = 'audit360.theme';

function load() {
    // eslint-disable-next-line no-new-func
    new Function('module', THEME_JS)(undefined);
    return window.ThemeSwitcher;
}

function mountToggle() {
    document.body.innerHTML = `
        <button id="theme-toggle" type="button" data-action="toggleTheme"
            aria-pressed="false" aria-label="Switch to dark mode" title="Switch to dark mode">
            <i class="fa-solid fa-moon"></i>
        </button>`;
    return document.getElementById('theme-toggle');
}

beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '';
});

describe('theme switcher', () => {
    it('opens in light mode when nothing has been chosen', () => {
        const theme = load();
        expect(theme.current()).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('applies a saved dark choice as soon as it loads, before the page paints', () => {
        window.localStorage.setItem(KEY, 'dark');
        load();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('never follows the operating system on its own', () => {
        // Explicit toggle only: with no stored choice it is light, whatever the OS says.
        window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
        expect(load().current()).toBe('light');
    });

    it('ignores a stored value it does not recognise', () => {
        window.localStorage.setItem(KEY, 'sepia');
        expect(load().current()).toBe('light');
    });

    it('toggles, remembers the choice, and keeps the button honest', () => {
        const button = mountToggle();
        const theme = load();

        expect(theme.toggle()).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(window.localStorage.getItem(KEY)).toBe('dark');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
        expect(button.querySelector('i').className).toBe('fa-solid fa-sun');

        expect(theme.toggle()).toBe('light');
        expect(window.localStorage.getItem(KEY)).toBe('light');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.querySelector('i').className).toBe('fa-solid fa-moon');
    });

    it('is reachable by the event delegator as window.toggleTheme', () => {
        load();
        expect(typeof window.toggleTheme).toBe('function');
        window.toggleTheme();
        expect(window.ThemeSwitcher.current()).toBe('dark');
    });

    it('keeps working when storage is blocked', () => {
        const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() { throw new Error('SecurityError: storage disabled'); }
        });
        try {
            const theme = load();
            expect(theme.current()).toBe('light');
            expect(() => theme.toggle()).not.toThrow();
            expect(theme.current()).toBe('dark');
        } finally {
            Object.defineProperty(window, 'localStorage', original);
        }
    });

    it('follows a change made in another tab', () => {
        load();
        window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'dark' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: 'light' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
});

describe('theme.css contract', () => {
    it('confines the dark theme to the screen, so print and PDF stay light', () => {
        const screenBlock = THEME_CSS.indexOf('@media screen {');
        expect(screenBlock).toBeGreaterThan(-1);
        // Every dark-theme rule sits after the screen block opens …
        const firstDarkRule = THEME_CSS.indexOf('html[data-theme="dark"]');
        expect(firstDarkRule).toBeGreaterThan(screenBlock);
        // … and none is written into a print block.
        expect(THEME_CSS).not.toMatch(/@media print[^{]*\{[^}]*data-theme/);
    });

    it('restores media by exactly undoing the page filter', () => {
        // invert and hue-rotate(180deg) are their own inverse; contrast must be
        // the reciprocal, or every logo and photo shifts in brightness.
        const page = THEME_CSS.match(/filter:\s*invert\(1\)\s*hue-rotate\(180deg\)\s*contrast\(([\d.]+)\);\s*\}/);
        const restores = [...THEME_CSS.matchAll(/filter:\s*invert\(1\)\s*hue-rotate\(180deg\)\s*contrast\(([\d.]+)\)/g)].map(m => Number(m[1]));
        expect(page).not.toBeNull();
        const pageContrast = Number(page[1]);
        const restore = restores.find(c => c > 1);
        expect(restore).toBeDefined();
        expect(pageContrast * restore).toBeCloseTo(1, 2);
    });

    it('restores only the outermost element, so nothing is flipped twice', () => {
        expect(THEME_CSS).toMatch(/:not\(:is\([\s\S]*?\)\s*\*\)/);
    });
});

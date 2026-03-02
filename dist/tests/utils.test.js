import { describe, it, expect } from 'vitest';

// Load utils module
globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./utils.js'), 'utf8');
eval(src);

describe('UTILS', () => {
    it('should be defined on window', () => {
        expect(window.UTILS).toBeDefined();
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(window.UTILS.escapeHtml('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
            );
        });

        it('should escape ampersands', () => {
            expect(window.UTILS.escapeHtml('A & B')).toBe('A &amp; B');
        });

        it('should handle empty strings', () => {
            expect(window.UTILS.escapeHtml('')).toBe('');
        });

        it('should handle null/undefined gracefully', () => {
            expect(window.UTILS.escapeHtml(null)).toBe('');
            expect(window.UTILS.escapeHtml(undefined)).toBe('');
        });
    });

    describe('formatDate', () => {
        it('should format a date string', () => {
            const result = window.UTILS.formatDate('2024-01-15');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle empty/null input', () => {
            const result = window.UTILS.formatDate('');
            expect(typeof result).toBe('string');
        });
    });
});

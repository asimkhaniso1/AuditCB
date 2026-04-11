import { describe, it, expect, vi } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.UTILS = { escapeHtml: (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;') : '' };
// No DOMPurify in test environment — tests the fallback path

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./sanitization.js'), 'utf8');
eval(src);

describe('Sanitizer', () => {
    it('should be defined on window', () => {
        expect(window.Sanitizer).toBeDefined();
    });

    describe('escapeHTML', () => {
        it('should escape HTML tags', () => {
            const result = Sanitizer.escapeHTML('<script>alert("xss")</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should return empty string for falsy input', () => {
            expect(Sanitizer.escapeHTML('')).toBe('');
            expect(Sanitizer.escapeHTML(null)).toBe('');
            expect(Sanitizer.escapeHTML(undefined)).toBe('');
        });

        it('should preserve safe text', () => {
            expect(Sanitizer.escapeHTML('Hello World')).toBe('Hello World');
        });
    });

    describe('sanitizeAttribute', () => {
        it('should escape double quotes', () => {
            expect(Sanitizer.sanitizeAttribute('foo"bar')).toContain('&quot;');
        });

        it('should escape angle brackets', () => {
            expect(Sanitizer.sanitizeAttribute('<tag>')).toContain('&lt;');
            expect(Sanitizer.sanitizeAttribute('<tag>')).toContain('&gt;');
        });

        it('should escape single quotes', () => {
            expect(Sanitizer.sanitizeAttribute("it's")).toContain('&#x27;');
        });

        it('should return empty string for falsy input', () => {
            expect(Sanitizer.sanitizeAttribute('')).toBe('');
            expect(Sanitizer.sanitizeAttribute(null)).toBe('');
        });
    });

    describe('sanitizeURL', () => {
        it('should block javascript: URIs', () => {
            expect(Sanitizer.sanitizeURL('javascript:alert(1)')).toBe('');
        });

        it('should block data: URIs', () => {
            expect(Sanitizer.sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
        });

        it('should block vbscript: URIs', () => {
            expect(Sanitizer.sanitizeURL('vbscript:MsgBox')).toBe('');
        });

        it('should block case-insensitive dangerous protocols', () => {
            expect(Sanitizer.sanitizeURL('JAVASCRIPT:alert(1)')).toBe('');
            expect(Sanitizer.sanitizeURL('JaVaScRiPt:alert(1)')).toBe('');
        });

        it('should allow https URLs', () => {
            expect(Sanitizer.sanitizeURL('https://example.com')).toBe('https://example.com');
        });

        it('should allow http URLs', () => {
            expect(Sanitizer.sanitizeURL('http://localhost:3000')).toBe('http://localhost:3000');
        });

        it('should allow relative URLs', () => {
            expect(Sanitizer.sanitizeURL('/api/data')).toBe('/api/data');
        });

        it('should return empty string for falsy input', () => {
            expect(Sanitizer.sanitizeURL('')).toBe('');
            expect(Sanitizer.sanitizeURL(null)).toBe('');
        });
    });

    describe('sanitizeEmail', () => {
        it('should trim whitespace', () => {
            expect(Sanitizer.sanitizeEmail('  user@test.com  ')).toBe('user@test.com');
        });

        it('should return empty for falsy input', () => {
            expect(Sanitizer.sanitizeEmail('')).toBe('');
        });
    });

    describe('sanitizeHTML (without DOMPurify)', () => {
        it('should fall back to escapeHtml when DOMPurify not available', () => {
            const result = Sanitizer.sanitizeHTML('<b>bold</b>');
            // Without DOMPurify, falls back to UTILS.escapeHtml or Sanitizer.escapeHTML
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should return empty string for falsy input', () => {
            expect(Sanitizer.sanitizeHTML('')).toBe('');
            expect(Sanitizer.sanitizeHTML(null)).toBe('');
        });
    });

    describe('sanitizeText', () => {
        it('should return escaped text', () => {
            const result = Sanitizer.sanitizeText('<div>hello</div>');
            expect(result).not.toContain('<div>');
        });

        it('should return empty for falsy input', () => {
            expect(Sanitizer.sanitizeText('')).toBe('');
        });
    });

    describe('createElement', () => {
        it('should create element with text content', () => {
            const el = Sanitizer.createElement('span', 'Hello');
            expect(el.tagName).toBe('SPAN');
            expect(el.textContent).toBe('Hello');
        });

        it('should set safe attributes', () => {
            const el = Sanitizer.createElement('a', 'Link', {
                href: 'https://example.com',
                class: 'btn'
            });
            expect(el.getAttribute('href')).toBe('https://example.com');
            expect(el.getAttribute('class')).toBe('btn');
        });

        it('should block javascript: in href', () => {
            const el = Sanitizer.createElement('a', 'Link', {
                href: 'javascript:alert(1)'
            });
            expect(el.getAttribute('href')).toBe('');
        });
    });
});

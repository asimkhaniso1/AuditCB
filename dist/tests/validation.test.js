import { describe, it, expect, vi } from 'vitest';

// Load Validator module
globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const fs = await import('fs');
const path = await import('path');
const src = fs.readFileSync(path.resolve('./validation.js'), 'utf8');
eval(src);

describe('Validator', () => {
    describe('required', () => {
        it('should reject empty strings', () => {
            expect(window.Validator.required('').valid).toBe(false);
        });

        it('should reject null', () => {
            expect(window.Validator.required(null).valid).toBe(false);
        });

        it('should reject undefined', () => {
            expect(window.Validator.required(undefined).valid).toBe(false);
        });

        it('should accept non-empty strings', () => {
            expect(window.Validator.required('hello').valid).toBe(true);
        });

        it('should include field name in error', () => {
            const result = window.Validator.required('', 'Company Name');
            expect(result.error).toContain('Company Name');
        });
    });

    describe('email', () => {
        it('should accept valid emails', () => {
            expect(window.Validator.email('user@example.com').valid).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(window.Validator.email('not-an-email').valid).toBe(false);
            expect(window.Validator.email('missing@').valid).toBe(false);
            expect(window.Validator.email('@nodomain.com').valid).toBe(false);
        });
    });

    describe('date', () => {
        it('should accept YYYY-MM-DD format', () => {
            expect(window.Validator.date('2024-01-15').valid).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(window.Validator.date('15-01-2024').valid).toBe(false);
            expect(window.Validator.date('not-a-date').valid).toBe(false);
        });
    });

    describe('length', () => {
        it('should enforce minimum length', () => {
            expect(window.Validator.length('ab', 3, 10).valid).toBe(false);
            expect(window.Validator.length('abc', 3, 10).valid).toBe(true);
        });

        it('should enforce maximum length', () => {
            expect(window.Validator.length('too long string', 1, 5).valid).toBe(false);
        });
    });

    describe('number', () => {
        it('should accept valid numbers', () => {
            expect(window.Validator.number('42').valid).toBe(true);
            expect(window.Validator.number('3.14').valid).toBe(true);
        });

        it('should reject non-numbers', () => {
            expect(window.Validator.number('abc').valid).toBe(false);
        });
    });

    describe('range', () => {
        it('should accept values within range', () => {
            expect(window.Validator.range('5', 1, 10).valid).toBe(true);
        });

        it('should reject values outside range', () => {
            expect(window.Validator.range('15', 1, 10).valid).toBe(false);
            expect(window.Validator.range('0', 1, 10).valid).toBe(false);
        });
    });

    describe('noHtmlTags', () => {
        it('should accept plain text', () => {
            expect(window.Validator.noHtmlTags('Hello world').valid).toBe(true);
        });

        it('should reject script tags', () => {
            expect(window.Validator.noHtmlTags('<script>alert("xss")</script>').valid).toBe(false);
        });

        it('should reject iframe tags', () => {
            expect(window.Validator.noHtmlTags('<iframe src="evil.com">').valid).toBe(false);
        });

        it('should reject javascript: URLs', () => {
            expect(window.Validator.noHtmlTags('javascript:void(0)').valid).toBe(false);
        });
    });

    describe('inList', () => {
        it('should accept values in list', () => {
            expect(window.Validator.inList('Draft', ['Draft', 'Published']).valid).toBe(true);
        });

        it('should reject values not in list', () => {
            expect(window.Validator.inList('Invalid', ['Draft', 'Published']).valid).toBe(false);
        });
    });

    describe('validateForm', () => {
        it('should validate multiple fields', () => {
            const formData = { name: 'John', email: 'john@test.com' };
            const rules = {
                name: [{ rule: 'required' }],
                email: [{ rule: 'required' }, { rule: 'email' }]
            };
            const result = window.Validator.validateForm(formData, rules);
            expect(result.valid).toBe(true);
            expect(Object.keys(result.errors)).toHaveLength(0);
        });

        it('should return errors for invalid data', () => {
            const formData = { name: '', email: 'bad-email' };
            const rules = {
                name: [{ rule: 'required' }],
                email: [{ rule: 'required' }, { rule: 'email' }]
            };
            const result = window.Validator.validateForm(formData, rules);
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
            expect(result.errors.email).toBeDefined();
        });

        it('should stop at first error per field', () => {
            const formData = { email: '' };
            const rules = {
                email: [{ rule: 'required' }, { rule: 'email' }]
            };
            const result = window.Validator.validateForm(formData, rules);
            // Should fail on 'required', not reach 'email' check
            expect(result.errors.email).toContain('required');
        });
    });
});

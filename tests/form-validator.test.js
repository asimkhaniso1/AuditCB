import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup window globals
globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.showNotification = vi.fn();

// Mock Sanitizer (used by validateAndSanitize)
window.Sanitizer = {
    sanitizeFormData: vi.fn((data) => ({ ...data }))
};

// Load Validator first (dependency of FormValidator)
const fs = await import('fs');
const path = await import('path');
const validatorSrc = fs.readFileSync(path.resolve('./validation.js'), 'utf8');
eval(validatorSrc);

// Load FormValidator
const src = fs.readFileSync(path.resolve('./form-validator.js'), 'utf8');
eval(src);

describe('FormValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateClient', () => {
        const validClient = {
            name: 'Acme Corp',
            standard: 'ISO 14001:2015',
            status: 'Active',
            website: 'https://acme.com',
            employees: '50'
        };

        it('should accept valid client data', () => {
            const result = window.FormValidator.validateClient(validClient);
            expect(result.valid).toBe(true);
        });

        it('should reject missing client name', () => {
            const result = window.FormValidator.validateClient({ ...validClient, name: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
        });

        it('should reject invalid status', () => {
            const result = window.FormValidator.validateClient({ ...validClient, status: 'Invalid' });
            expect(result.valid).toBe(false);
            expect(result.errors.status).toBeDefined();
        });

        it('should reject HTML in client name', () => {
            const result = window.FormValidator.validateClient({ ...validClient, name: '<script>alert("xss")</script>' });
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
        });

        it('should reject name shorter than 2 characters', () => {
            const result = window.FormValidator.validateClient({ ...validClient, name: 'A' });
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
        });
    });

    describe('validateAuditor', () => {
        const validAuditor = {
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '+1234567890',
            role: 'Lead Auditor',
            experience: '10',
            manDayRate: '500'
        };

        it('should accept valid auditor data', () => {
            const result = window.FormValidator.validateAuditor(validAuditor);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = window.FormValidator.validateAuditor({ ...validAuditor, email: 'not-an-email' });
            expect(result.valid).toBe(false);
            expect(result.errors.email).toBeDefined();
        });

        it('should reject invalid role', () => {
            const result = window.FormValidator.validateAuditor({ ...validAuditor, role: 'Manager' });
            expect(result.valid).toBe(false);
            expect(result.errors.role).toBeDefined();
        });

        it('should reject experience out of range', () => {
            const result = window.FormValidator.validateAuditor({ ...validAuditor, experience: '55' });
            expect(result.valid).toBe(false);
            expect(result.errors.experience).toBeDefined();
        });
    });

    describe('validateContact', () => {
        it('should accept valid contact data', () => {
            const result = window.FormValidator.validateContact({
                name: 'John Smith',
                designation: 'QA Manager',
                email: 'john@example.com',
                phone: '+1234567890'
            });
            expect(result.valid).toBe(true);
        });

        it('should reject missing required fields', () => {
            const result = window.FormValidator.validateContact({
                name: '',
                designation: '',
                email: '',
                phone: ''
            });
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
            expect(result.errors.designation).toBeDefined();
            expect(result.errors.email).toBeDefined();
            expect(result.errors.phone).toBeDefined();
        });
    });

    describe('validateSite', () => {
        const validSite = {
            name: 'Main Office',
            address: '123 Business Rd',
            city: 'Dubai',
            country: 'UAE',
            employees: '25'
        };

        it('should accept valid site data', () => {
            const result = window.FormValidator.validateSite(validSite);
            expect(result.valid).toBe(true);
        });

        it('should reject missing site name', () => {
            const result = window.FormValidator.validateSite({ ...validSite, name: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.name).toBeDefined();
        });
    });

    describe('validateNCR', () => {
        it('should accept valid NCR data', () => {
            const result = window.FormValidator.validateNCR({
                type: 'major',
                clause: '4.1',
                description: 'Organization did not define external and internal issues',
                evidence: 'No evidence of context analysis document found'
            });
            expect(result.valid).toBe(true);
        });

        it('should reject invalid NCR type', () => {
            const result = window.FormValidator.validateNCR({
                type: 'critical',
                clause: '4.1',
                description: 'A valid description here for testing',
                evidence: 'A valid evidence string here for testing'
            });
            expect(result.valid).toBe(false);
            expect(result.errors.type).toBeDefined();
        });

        it('should reject short description', () => {
            const result = window.FormValidator.validateNCR({
                type: 'minor',
                clause: '4.1',
                description: 'Short',
                evidence: 'A valid evidence string here for testing'
            });
            expect(result.valid).toBe(false);
            expect(result.errors.description).toBeDefined();
        });
    });

    describe('validateAuditPlan', () => {
        const validPlan = {
            client: 'Acme Corp',
            standard: 'ISO 14001:2015',
            date: '2025-06-15',
            manDays: '3',
            cost: '5000',
            objectives: 'Verify compliance with quality management requirements',
            scope: 'All departments within the main office location'
        };

        it('should accept valid audit plan data', () => {
            const result = window.FormValidator.validateAuditPlan(validPlan);
            expect(result.valid).toBe(true);
        });

        it('should reject missing client', () => {
            const result = window.FormValidator.validateAuditPlan({ ...validPlan, client: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.client).toBeDefined();
        });

        it('should reject man-days out of range', () => {
            const result = window.FormValidator.validateAuditPlan({ ...validPlan, manDays: '200' });
            expect(result.valid).toBe(false);
            expect(result.errors.manDays).toBeDefined();
        });
    });

    describe('validateFile', () => {
        it('should accept a valid PDF file', () => {
            const file = { name: 'report.pdf', size: 1024 * 1024, type: 'application/pdf' };
            const result = window.FormValidator.validateFile(file);
            expect(result.valid).toBe(true);
        });

        it('should reject when no file is provided', () => {
            const result = window.FormValidator.validateFile(null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('No file selected');
        });

        it('should reject files exceeding max size', () => {
            const file = { name: 'large.pdf', size: 20 * 1024 * 1024, type: 'application/pdf' };
            const result = window.FormValidator.validateFile(file);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('size');
        });

        it('should reject disallowed file types', () => {
            const file = { name: 'script.exe', size: 1024, type: 'application/x-msdownload' };
            const result = window.FormValidator.validateFile(file);
            expect(result.valid).toBe(false);
        });

        it('should respect custom options', () => {
            const file = { name: 'data.csv', size: 500, type: 'text/csv' };
            const result = window.FormValidator.validateFile(file, {
                allowedTypes: ['text/csv'],
                allowedExtensions: ['.csv']
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('validateDateRange', () => {
        it('should accept valid date range', () => {
            const result = window.FormValidator.validateDateRange('2025-01-01', '2025-12-31');
            expect(result.valid).toBe(true);
        });

        it('should reject when start is after end', () => {
            const result = window.FormValidator.validateDateRange('2025-12-31', '2025-01-01');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('before');
        });

        it('should reject invalid start date', () => {
            const result = window.FormValidator.validateDateRange('not-a-date', '2025-12-31');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Start date');
        });

        it('should reject invalid end date', () => {
            const result = window.FormValidator.validateDateRange('2025-01-01', 'not-a-date');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('End date');
        });
    });

    describe('validateArray', () => {
        it('should accept valid array with passing validator', () => {
            const items = [{ name: 'Item1' }, { name: 'Item2' }];
            const validator = () => ({ valid: true, errors: {} });
            const result = window.FormValidator.validateArray(items, validator);
            expect(result.valid).toBe(true);
        });

        it('should reject non-array input', () => {
            const result = window.FormValidator.validateArray('not-array', () => ({ valid: true }));
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('array');
        });

        it('should enforce minimum items', () => {
            const result = window.FormValidator.validateArray([], () => ({ valid: true }), 1);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('1');
        });

        it('should enforce maximum items', () => {
            const items = [1, 2, 3];
            const result = window.FormValidator.validateArray(items, () => ({ valid: true }), 0, 2);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('2');
        });

        it('should collect per-item validation errors', () => {
            const items = [{ name: '' }];
            const validator = () => ({ valid: false, errors: { name: 'Name is required' } });
            const result = window.FormValidator.validateArray(items, validator);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Item 1');
        });
    });

    describe('validateAndSanitize', () => {
        it('should return sanitized data when valid', () => {
            const formData = {
                name: 'Test Site',
                address: '123 Main St',
                city: 'Dubai',
                country: 'UAE',
                employees: '10'
            };
            const result = window.FormValidator.validateAndSanitize(formData, 'validateSite', ['name', 'address']);
            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
            expect(window.Sanitizer.sanitizeFormData).toHaveBeenCalled();
        });

        it('should return errors when invalid', () => {
            const formData = { name: '', address: '', city: '', country: '', employees: '10' };
            const result = window.FormValidator.validateAndSanitize(formData, 'validateSite');
            expect(result.valid).toBe(false);
            expect(result.data).toBeNull();
            expect(window.Logger.warn).toHaveBeenCalled();
        });
    });

    describe('showErrors', () => {
        it('should call showNotification with joined errors', () => {
            const errors = { name: 'Name is required', email: 'Email is invalid' };
            window.FormValidator.showErrors(errors);
            expect(window.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('Name is required'),
                'error'
            );
        });
    });
});

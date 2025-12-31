// ============================================
// FORM VALIDATION WRAPPER
// ============================================
// High-level validation helpers for common forms

const FormValidator = {

    /**
     * Validate client form data
     */
    validateClient: function (formData) {
        const rules = {
            name: [
                { rule: 'required', fieldName: 'Client Name' },
                { rule: 'length', min: 2, max: 200, fieldName: 'Client Name' },
                { rule: 'noHtmlTags', fieldName: 'Client Name' }
            ],
            standard: [
                { rule: 'required', fieldName: 'Standard' },
                { rule: 'isoStandard', fieldName: 'Standard' }
            ],
            status: [
                { rule: 'required', fieldName: 'Status' },
                { rule: 'inList', allowed: ['Active', 'Suspended', 'Withdrawn'], fieldName: 'Status' }
            ],
            website: [
                { rule: 'url', fieldName: 'Website' }
            ],
            employees: [
                { rule: 'number', fieldName: 'Employees' },
                { rule: 'range', min: 1, max: 1000000, fieldName: 'Employees' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate auditor form data
     */
    validateAuditor: function (formData) {
        const rules = {
            name: [
                { rule: 'required', fieldName: 'Auditor Name' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Auditor Name' },
                { rule: 'noHtmlTags', fieldName: 'Auditor Name' }
            ],
            email: [
                { rule: 'required', fieldName: 'Email' },
                { rule: 'email', fieldName: 'Email' }
            ],
            phone: [
                { rule: 'phone', fieldName: 'Phone' }
            ],
            role: [
                { rule: 'required', fieldName: 'Role' },
                { rule: 'inList', allowed: ['Lead Auditor', 'Auditor', 'Technical Expert'], fieldName: 'Role' }
            ],
            experience: [
                { rule: 'number', fieldName: 'Experience' },
                { rule: 'range', min: 0, max: 50, fieldName: 'Experience' }
            ],
            manDayRate: [
                { rule: 'number', fieldName: 'Man-Day Rate' },
                { rule: 'range', min: 0, max: 10000, fieldName: 'Man-Day Rate' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate audit plan form data
     */
    validateAuditPlan: function (formData) {
        const rules = {
            client: [
                { rule: 'required', fieldName: 'Client' }
            ],
            standard: [
                { rule: 'required', fieldName: 'Standard' },
                { rule: 'isoStandard', fieldName: 'Standard' }
            ],
            date: [
                { rule: 'required', fieldName: 'Audit Date' },
                { rule: 'date', fieldName: 'Audit Date' }
            ],
            manDays: [
                { rule: 'required', fieldName: 'Man-Days' },
                { rule: 'number', fieldName: 'Man-Days' },
                { rule: 'range', min: 0.5, max: 100, fieldName: 'Man-Days' }
            ],
            cost: [
                { rule: 'number', fieldName: 'Cost' },
                { rule: 'range', min: 0, max: 1000000, fieldName: 'Cost' }
            ],
            objectives: [
                { rule: 'required', fieldName: 'Objectives' },
                { rule: 'length', min: 10, max: 1000, fieldName: 'Objectives' }
            ],
            scope: [
                { rule: 'required', fieldName: 'Scope' },
                { rule: 'length', min: 10, max: 1000, fieldName: 'Scope' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate NCR form data
     */
    validateNCR: function (formData) {
        const rules = {
            type: [
                { rule: 'required', fieldName: 'NCR Type' },
                { rule: 'inList', allowed: ['major', 'minor', 'observation'], fieldName: 'NCR Type' }
            ],
            clause: [
                { rule: 'required', fieldName: 'Clause' },
                { rule: 'length', min: 1, max: 20, fieldName: 'Clause' }
            ],
            description: [
                { rule: 'required', fieldName: 'Description' },
                { rule: 'length', min: 10, max: 2000, fieldName: 'Description' }
            ],
            evidence: [
                { rule: 'required', fieldName: 'Evidence' },
                { rule: 'length', min: 10, max: 2000, fieldName: 'Evidence' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate contact form data
     */
    validateContact: function (formData) {
        const rules = {
            name: [
                { rule: 'required', fieldName: 'Contact Name' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Contact Name' },
                { rule: 'noHtmlTags', fieldName: 'Contact Name' }
            ],
            designation: [
                { rule: 'required', fieldName: 'Designation' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Designation' }
            ],
            email: [
                { rule: 'required', fieldName: 'Email' },
                { rule: 'email', fieldName: 'Email' }
            ],
            phone: [
                { rule: 'required', fieldName: 'Phone' },
                { rule: 'phone', fieldName: 'Phone' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate site form data
     */
    validateSite: function (formData) {
        const rules = {
            name: [
                { rule: 'required', fieldName: 'Site Name' },
                { rule: 'length', min: 2, max: 200, fieldName: 'Site Name' }
            ],
            address: [
                { rule: 'required', fieldName: 'Address' },
                { rule: 'length', min: 5, max: 500, fieldName: 'Address' }
            ],
            city: [
                { rule: 'required', fieldName: 'City' },
                { rule: 'length', min: 2, max: 100, fieldName: 'City' }
            ],
            country: [
                { rule: 'required', fieldName: 'Country' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Country' }
            ],
            employees: [
                { rule: 'number', fieldName: 'Employees' },
                { rule: 'range', min: 1, max: 100000, fieldName: 'Employees' }
            ]
        };

        return Validator.validateForm(formData, rules);
    },

    /**
     * Validate and sanitize form data in one step
     */
    validateAndSanitize: function (formData, validatorName, textFields = [], htmlFields = []) {
        // Validate first
        const validation = this[validatorName](formData);

        if (!validation.valid) {
            Logger.warn('Validation failed:', validation.errors);
            return {
                valid: false,
                errors: validation.errors,
                data: null
            };
        }

        // Sanitize if validation passed
        const sanitized = Sanitizer.sanitizeFormData(formData, textFields, htmlFields);

        return {
            valid: true,
            errors: {},
            data: sanitized
        };
    },

    /**
     * Show validation errors to user
     */
    showErrors: function (errors) {
        const errorMessages = Object.values(errors).join('\n');
        window.showNotification(errorMessages, 'error');
    },

    /**
     * Validate file upload
     */
    validateFile: function (file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB default
            allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx']
        } = options;

        const errors = [];

        // Check file exists
        if (!file) {
            errors.push('No file selected');
            return { valid: false, errors };
        }

        // Check file size
        if (file.size > maxSize) {
            errors.push(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            errors.push(`File type must be one of: ${allowedExtensions.join(', ')}`);
        }

        // Check file extension
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
            errors.push(`File extension must be one of: ${allowedExtensions.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Validate date range
     */
    validateDateRange: function (startDate, endDate, fieldName = 'Date Range') {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime())) {
            return { valid: false, error: 'Start date is invalid' };
        }

        if (isNaN(end.getTime())) {
            return { valid: false, error: 'End date is invalid' };
        }

        if (start > end) {
            return { valid: false, error: `${fieldName}: Start date must be before end date` };
        }

        return { valid: true };
    },

    /**
     * Validate array of items
     */
    validateArray: function (items, validator, minItems = 0, maxItems = 1000) {
        if (!Array.isArray(items)) {
            return { valid: false, errors: ['Must be an array'] };
        }

        if (items.length < minItems) {
            return { valid: false, errors: [`At least ${minItems} items required`] };
        }

        if (items.length > maxItems) {
            return { valid: false, errors: [`Maximum ${maxItems} items allowed`] };
        }

        const errors = [];
        items.forEach((item, index) => {
            const result = validator(item);
            if (!result.valid) {
                errors.push(`Item ${index + 1}: ${Object.values(result.errors).join(', ')}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// Export to window
window.FormValidator = FormValidator;

Logger.info('FormValidator module loaded');

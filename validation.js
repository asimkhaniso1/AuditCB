// ============================================
// VALIDATION UTILITY MODULE (ESM-ready)
// ============================================
// Comprehensive form validation for AuditCB360
// Prevents XSS, injection, and data integrity issues

const Validator = {

    // ============================================
    // CORE VALIDATORS
    // ============================================

    /**
     * Check if value is not empty
     */
    required: (value, fieldName = 'Field') => {
        if (value === null || value === undefined || value.toString().trim() === '') {
            return { valid: false, error: `${fieldName} is required` };
        }
        return { valid: true };
    },

    /**
     * Validate email format
     */
    email: (value, fieldName = 'Email') => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { valid: false, error: `${fieldName} must be a valid email address` };
        }
        return { valid: true };
    },

    /**
     * Validate phone number (flexible international format)
     */
    phone: (value, fieldName = 'Phone') => {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
        if (!phoneRegex.test(value.replace(/\s/g, ''))) {
            return { valid: false, error: `${fieldName} must be a valid phone number` };
        }
        return { valid: true };
    },

    /**
     * Validate URL format
     */
    url: (value, fieldName = 'URL') => {
        try {
            new URL(value);
            return { valid: true };
        } catch {
            return { valid: false, error: `${fieldName} must be a valid URL` };
        }
    },

    /**
     * Validate date format (YYYY-MM-DD)
     */
    date: (value, fieldName = 'Date') => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
            return { valid: false, error: `${fieldName} must be in YYYY-MM-DD format` };
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return { valid: false, error: `${fieldName} is not a valid date` };
        }
        return { valid: true };
    },

    /**
     * Validate ISO standard format (e.g., ISO 9001:2015)
     */
    isoStandard: (value, fieldName = 'ISO Standard') => {
        const isoRegex = /^ISO\s\d{5}(:\d{4})?$/i;
        if (!isoRegex.test(value)) {
            return { valid: false, error: `${fieldName} must be in format: ISO 9001:2015` };
        }
        return { valid: true };
    },

    /**
     * Canonical pseudo-clause tag pattern — identifies internal tracking
     * references (FOCUS/SURV/ORG/DOC tags) that are sometimes typed into a
     * "clause" field but are NOT real standard clause references.
     * This is the canonical copy; it is currently duplicated locally as
     * NCR_PSEUDO_CLAUSE_PATTERN in execution-module-v2.js and as
     * FOCUS_CLAUSE_RE in report-integrity.js (not changed by this module —
     * those files may adopt Validator.PSEUDO_CLAUSE_RE in a future pass).
     */
    PSEUDO_CLAUSE_RE: /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i,

    /**
     * Shape of a real standard clause reference, e.g. '4.1', '9.2', '8.2.2',
     * '10.3.1', 'A.8.13', '9.6.2 (a)' (ISO/IEC 17021-1 style lettered
     * sub-item suffix). Intentionally permissive about which standard —
     * just requires the "clause-shaped" structure (optional single-letter
     * annex prefix + dotted numeric path + optional lettered suffix).
     */
    CLAUSE_REF_RE: /^[A-Za-z]?\.?\d+(?:\.\d+)*(?:\s*\([a-zA-Z0-9]+\))?$/,

    /**
     * True when value looks like a real standard clause reference: not
     * empty, not an internal pseudo tag (FOCUS/SURV/ORG/DOC), and not free
     * prose. False for anything else, including non-string/nullish input.
     */
    isClauseRef: (value) => {
        const v = (value === null || value === undefined) ? '' : String(value).trim();
        if (!v) return false;
        if (Validator.PSEUDO_CLAUSE_RE.test(v)) return false;
        return Validator.CLAUSE_REF_RE.test(v);
    },

    /**
     * Validate a clause reference field (e.g. checklist item "Clause #")
     */
    clauseRef: (value, fieldName = 'Clause') => {
        if (!Validator.isClauseRef(value)) {
            return { valid: false, error: `${fieldName} must be a real standard clause reference (e.g. 9.2, 8.2.2, A.8.13) — internal tags like FOCUS/SURV/ORG/DOC are not valid criteria` };
        }
        return { valid: true };
    },

    /**
     * Validate string length
     */
    length: (value, min, max, fieldName = 'Field') => {
        const len = value.toString().length;
        if (len < min) {
            return { valid: false, error: `${fieldName} must be at least ${min} characters` };
        }
        if (max && len > max) {
            return { valid: false, error: `${fieldName} must not exceed ${max} characters` };
        }
        return { valid: true };
    },

    /**
     * Validate numeric value
     */
    number: (value, fieldName = 'Number') => {
        if (isNaN(parseFloat(value))) {
            return { valid: false, error: `${fieldName} must be a valid number` };
        }
        return { valid: true };
    },

    /**
     * Validate number range
     */
    range: (value, min, max, fieldName = 'Value') => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return { valid: false, error: `${fieldName} must be a number` };
        }
        if (num < min || num > max) {
            return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
        }
        return { valid: true };
    },

    /**
     * Validate against allowed values
     */
    inList: (value, allowedValues, fieldName = 'Value') => {
        if (!allowedValues.includes(value)) {
            return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
        }
        return { valid: true };
    },

    /**
     * Validate no dangerous HTML/Script tags
     */
    noHtmlTags: (value, fieldName = 'Field') => {
        const htmlRegex = /<\s*script|<\s*iframe|<\s*object|<\s*embed|javascript:/i;
        if (htmlRegex.test(value)) {
            return { valid: false, error: `${fieldName} contains prohibited content` };
        }
        return { valid: true };
    },

    /**
     * Validate alphanumeric only (+ spaces, hyphens, underscores)
     */
    alphanumeric: (value, fieldName = 'Field') => {
        const alphaRegex = /^[a-zA-Z0-9\s\-_]+$/;
        if (!alphaRegex.test(value)) {
            return { valid: false, error: `${fieldName} must contain only letters, numbers, spaces, hyphens, and underscores` };
        }
        return { valid: true };
    },

    // ============================================
    // FORM VALIDATION ENGINE
    // ============================================

    /**
     * Validate an entire form based on rules
     * @param {Object} formData - Key-value pairs of form data
     * @param {Object} rules - Validation rules per field
     * @returns {Object} { valid: boolean, errors: {} }
     * 
     * Example:
     * const rules = {
     *   email: [{ rule: 'required' }, { rule: 'email' }],
     *   name: [{ rule: 'required' }, { rule: 'length', min: 2, max: 50 }]
     * };
     * const result = Validator.validateForm(formData, rules);
     */
    validateForm: (formData, rules) => {
        const errors = {};
        let isValid = true;

        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = formData[field];

            for (const ruleConfig of fieldRules) {
                const { rule, ...params } = ruleConfig;
                const fieldName = ruleConfig.fieldName || field;

                let result;

                switch (rule) {
                    case 'required':
                        result = Validator.required(value, fieldName);
                        break;
                    case 'email':
                        result = Validator.email(value, fieldName);
                        break;
                    case 'phone':
                        result = Validator.phone(value, fieldName);
                        break;
                    case 'url':
                        result = Validator.url(value, fieldName);
                        break;
                    case 'date':
                        result = Validator.date(value, fieldName);
                        break;
                    case 'isoStandard':
                        result = Validator.isoStandard(value, fieldName);
                        break;
                    case 'clauseRef':
                        result = Validator.clauseRef(value, fieldName);
                        break;
                    case 'length':
                        result = Validator.length(value, params.min, params.max, fieldName);
                        break;
                    case 'number':
                        result = Validator.number(value, fieldName);
                        break;
                    case 'range':
                        result = Validator.range(value, params.min, params.max, fieldName);
                        break;
                    case 'inList':
                        result = Validator.inList(value, params.allowed, fieldName);
                        break;
                    case 'noHtmlTags':
                        result = Validator.noHtmlTags(value, fieldName);
                        break;
                    case 'alphanumeric':
                        result = Validator.alphanumeric(value, fieldName);
                        break;
                    case 'custom':
                        result = params.validator(value, fieldName);
                        break;
                    default:
                        console.warn(`Unknown validation rule: ${rule}`);
                        result = { valid: true };
                }

                if (!result.valid) {
                    errors[field] = result.error;
                    isValid = false;
                    break; // Stop at first error for this field
                }
            }
        }

        return { valid: isValid, errors };
    },

    /**
     * Validate form by DOM element IDs
     * @param {Object} fieldIds - Map of field names to element IDs
     * @param {Object} rules - Validation rules
     * @returns {Object} { valid: boolean, errors: {}, formData: {} }
     */
    validateFormElements: (fieldIds, rules) => {
        const formData = {};

        // Collect form data from DOM
        for (const [field, elementId] of Object.entries(fieldIds)) {
            const element = document.getElementById(elementId);
            if (element) {
                formData[field] = element.value;
            }
        }

        // Validate
        const result = Validator.validateForm(formData, rules);

        return {
            ...result,
            formData
        };
    },

    /**
     * Display errors on form fields
     * @param {Object} errors - Error object from validateForm
     * @param {Object} fieldIds - Map of field names to element IDs
     */
    displayErrors: (errors, fieldIds) => {
        // Clear previous errors
        Validator.clearErrors(fieldIds);

        // Show new errors
        for (const [field, message] of Object.entries(errors)) {
            const elementId = fieldIds[field];
            const element = document.getElementById(elementId);

            if (element) {
                // Add error class
                element.classList.add('input-error');

                // Create error message element
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                errorDiv.id = `${elementId}-error`;

                // Insert after input
                element.parentNode.insertBefore(errorDiv, element.nextSibling);
            }
        }
    },

    /**
     * Clear all error displays
     */
    clearErrors: (fieldIds) => {
        for (const elementId of Object.values(fieldIds)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.remove('input-error');
                const errorMsg = document.getElementById(`${elementId}-error`);
                if (errorMsg) {
                    errorMsg.remove();
                }
            }
        }
    }
};

// Window export (used by all existing code)
window.Validator = Validator;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
}

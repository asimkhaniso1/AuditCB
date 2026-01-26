// ============================================
// SANITIZATION UTILITY MODULE
// ============================================
// XSS Prevention using DOMPurify
// Wrapper for consistent sanitization across app

const Sanitizer = {

    /**
     * Sanitize HTML string to prevent XSS
     * @param {string} dirty - Unsanitized HTML
     * @param {Object} config - DOMPurify config (optional)
     * @returns {string} - Sanitized HTML safe for innerHTML
     */
    sanitizeHTML: (dirty, config = {}) => {
        if (!dirty) return '';

        // Safely check for DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.warn('DOMPurify not found. Using UTILS.escapeHtml fallback.');
            return window.UTILS ? window.UTILS.escapeHtml(dirty) : String(dirty).replace(/[&<>"']/g, "");
        }

        // Default config: Allow common formatting but block scripts
        const defaultConfig = {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div'],
            ALLOWED_ATTR: ['href', 'title', 'target', 'class', 'style'],
            ALLOW_DATA_ATTR: false,
            ...config
        };

        return (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(dirty, defaultConfig) : dirty;
    },

    /**
     * Sanitize plain text (strips ALL HTML)
     * Use for user-generated content that should be text-only
     * @param {string} dirty - Unsanitized input
     * @returns {string} - Plain text with HTML entities escaped
     */
    sanitizeText: (dirty) => {
        if (!dirty) return '';

        if (typeof DOMPurify === 'undefined') {
            return Sanitizer.escapeHTML(dirty);
        }

        // Strip all HTML tags
        const clean = (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize)
            ? DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
            : dirty;

        // Additional escaping for safety
        return Sanitizer.escapeHTML(clean);
    },

    /**
     * Manually escape HTML entities
     * Equivalent to textContent but returns string
     * @param {string} text - Text to escape
     * @returns {string} - HTML-escaped text
     */
    escapeHTML: (text) => {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Sanitize for use in HTML attributes
     * @param {string} value - Attribute value
     * @returns {string} - Safe attribute value
     */
    sanitizeAttribute: (value) => {
        if (!value) return '';

        return value
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Sanitize URL to prevent javascript: and data: URIs
     * @param {string} url - URL to sanitize
     * @returns {string} - Safe URL or empty string
     */
    sanitizeURL: (url) => {
        if (!url) return '';

        // Block dangerous protocols
        const dangerous = /^(javascript|data|vbscript):/i;
        if (dangerous.test(url.trim())) {
            console.warn('Blocked dangerous URL:', url);
            return '';
        }

        if (typeof DOMPurify === 'undefined') return url;
        return (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize)
            ? DOMPurify.sanitize(url, { ALLOWED_TAGS: [] })
            : url;
    },

    // Alias for lowercase 'url' (compatibility)
    sanitizeUrl: function (url) {
        return this.sanitizeURL(url);
    },

    /**
     * Sanitize email address
     * @param {string} email - Email to sanitize
     * @returns {string} - Safe email or empty string
     */
    sanitizeEmail: (email) => {
        if (!email) return '';

        if (typeof DOMPurify === 'undefined') {
            return Sanitizer.escapeHTML(email.trim());
        }

        // Basic email sanitization - strip HTML and validate format loosely
        const clean = (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize)
            ? DOMPurify.sanitize(email, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
            : email.trim();

        // Accept anything that looks vaguely like an email
        // Real validation should happen server-side
        return clean;
    },

    /**
     * Create safe DOM element with text content
     * Preferred over innerHTML for user content
     * @param {string} tagName - Element tag (e.g., 'div', 'span')
     * @param {string} textContent - Text content
     * @param {Object} attributes - Optional attributes
     * @returns {HTMLElement} - Safe DOM element
     */
    createElement: (tagName, textContent = '', attributes = {}) => {
        const element = document.createElement(tagName);
        element.textContent = textContent; // Auto-escapes

        // Apply attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'href') {
                element.setAttribute(key, Sanitizer.sanitizeURL(value));
            } else if (key === 'style' || key === 'class') {
                element.setAttribute(key, value); // These are safe
            } else {
                element.setAttribute(key, Sanitizer.sanitizeAttribute(value));
            }
        }

        return element;
    },

    /**
     * Safely set innerHTML with sanitization
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content
     * @param {Object} config - DOMPurify config
     */
    setInnerHTML: (element, html, config = {}) => {
        if (!element) return;
        element.innerHTML = Sanitizer.sanitizeHTML(html, config);
    },

    /**
     * Safely append user content as text
     * @param {HTMLElement} parent - Parent element
     * @param {string} tagName - Child element tag
     * @param {string} content - User content
     * @returns {HTMLElement} - Created element
     */
    appendTextElement: (parent, tagName, content) => {
        const element = Sanitizer.createElement(tagName, content);
        parent.appendChild(element);
        return element;
    },

    /**
     * Sanitize form data object
     * @param {Object} formData - Form data object
     * @param {Array} textFields - Fields to treat as plain text (no HTML)
     * @param {Array} htmlFields - Fields that can contain limited HTML
     * @returns {Object} - Sanitized form data
     */
    sanitizeFormData: (formData, textFields = [], htmlFields = []) => {
        const sanitized = {};

        for (const [key, value] of Object.entries(formData)) {
            if (textFields.includes(key)) {
                sanitized[key] = Sanitizer.sanitizeText(value);
            } else if (htmlFields.includes(key)) {
                sanitized[key] = Sanitizer.sanitizeHTML(value);
            } else {
                // Default: treat as text
                sanitized[key] = Sanitizer.sanitizeText(value);
            }
        }

        return sanitized;
    },

    /**
     * Build safe HTML template for auditor/client data
     * Automatically escapes user-provided fields
     * @param {Object} data - Data object
     * @param {Array} unsafeFields - Fields containing user input
     * @returns {Object} - Data with escaped fields
     */
    prepareTemplateData: (data, unsafeFields = []) => {
        const prepared = { ...data };

        for (const field of unsafeFields) {
            if (prepared[field]) {
                prepared[field] = Sanitizer.escapeHTML(prepared[field]);
            }
        }

        return prepared;
    }
};

// Add CSS for error styling
if (!document.getElementById('validation-styles')) {
    const style = document.createElement('style');
    style.id = 'validation-styles';
    style.textContent = `
        .input-error {
            border: 2px solid #dc2626 !important;
            background: #fef2f2 !important;
        }
        
        .error-message {
            color: #dc2626;
            font-size: 0.85rem;
            margin-top: 0.25rem;
            display: block;
        }
        
        input.input-error:focus,
        textarea.input-error:focus,
        select.input-error:focus {
            outline: 2px solid #dc2626;
            outline-offset: 2px;
        }
    `;
    document.head.appendChild(style);
}

// Export to window
window.Sanitizer = Sanitizer;

// ============================================
// SAFE DOM UTILITIES
// ============================================
// Safe DOM manipulation helpers to prevent XSS

const SafeDOM = {

    /**
     * Safely set innerHTML with automatic sanitization
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content
     * @param {Object} config - DOMPurify config
     */
    setHTML: function (element, html, config = {}) {
        if (!element) {
            Logger.warn('SafeDOM.setHTML: element is null');
            return;
        }

        if (!html) {
            element.innerHTML = '';
            return;
        }

        // Use Sanitizer if available
        if (window.Sanitizer && typeof window.Sanitizer.sanitizeHTML === 'function') {
            element.innerHTML = window.Sanitizer.sanitizeHTML(html, config);
        } else if (typeof window.DOMPurify !== 'undefined' && window.DOMPurify.sanitize) {
            // Fallback to DOMPurify directly
            element.innerHTML = window.DOMPurify.sanitize(html, config);
        } else {
            // Last resort - log warning and use textContent
            Logger.error('SafeDOM: No sanitizer available! Using textContent instead.');
            element.textContent = html;
        }
    },

    /**
     * Safely set text content (always safe)
     * @param {HTMLElement} element 
     * @param {string} text 
     */
    setText: function (element, text) {
        if (!element) {
            Logger.warn('SafeDOM.setText: element is null');
            return;
        }
        element.textContent = text || '';
    },

    /**
     * Create element with safe content
     * @param {string} tagName 
     * @param {string} content 
     * @param {Object} attributes 
     * @param {boolean} isHTML - If true, content is HTML; if false, plain text
     */
    createElement: function (tagName, content = '', attributes = {}, isHTML = false) {
        const element = document.createElement(tagName);

        // Set content
        if (isHTML) {
            this.setHTML(element, content);
        } else {
            this.setText(element, content);
        }

        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            this.setAttribute(element, key, value);
        }

        return element;
    },

    /**
     * Safely set attribute
     * @param {HTMLElement} element 
     * @param {string} name 
     * @param {string} value 
     */
    setAttribute: function (element, name, value) {
        if (!element) return;

        // Sanitize based on attribute type
        if (name === 'href' || name === 'src') {
            const safeValue = window.Sanitizer?.sanitizeURL(value) || value;
            element.setAttribute(name, safeValue);
        } else if (name === 'onclick' || name.startsWith('on')) {
            // Never set event handlers via attributes
            Logger.warn('SafeDOM: Attempted to set event handler via attribute. Use addEventListener instead.');
        } else {
            element.setAttribute(name, value);
        }
    },

    /**
     * Safely append HTML to element
     * @param {HTMLElement} parent 
     * @param {string} html 
     */
    appendHTML: function (parent, html) {
        if (!parent) return;

        const temp = document.createElement('div');
        this.setHTML(temp, html);

        while (temp.firstChild) {
            parent.appendChild(temp.firstChild);
        }
    },

    /**
     * Safely prepend HTML to element
     * @param {HTMLElement} parent 
     * @param {string} html 
     */
    prependHTML: function (parent, html) {
        if (!parent) return;

        const temp = document.createElement('div');
        this.setHTML(temp, html);

        while (temp.lastChild) {
            parent.insertBefore(temp.lastChild, parent.firstChild);
        }
    },

    /**
     * Clear element content safely
     * @param {HTMLElement} element 
     */
    clear: function (element) {
        if (!element) return;

        // Remove all children
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },

    /**
     * Replace element content safely
     * @param {HTMLElement} element 
     * @param {string} html 
     */
    replace: function (element, html) {
        if (!element) return;

        this.clear(element);
        this.setHTML(element, html);
    },

    /**
     * Create safe button with event handler
     * @param {string} text 
     * @param {Function} onClick 
     * @param {string} className 
     */
    createButton: function (text, onClick, className = 'btn btn-primary') {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;

        if (typeof onClick === 'function') {
            button.addEventListener('click', onClick);
        }

        return button;
    },

    /**
     * Create safe link
     * @param {string} text 
     * @param {string} href 
     * @param {Object} attributes 
     */
    createLink: function (text, href, attributes = {}) {
        const link = document.createElement('a');
        link.textContent = text;

        // Sanitize URL
        const safeHref = window.Sanitizer?.sanitizeURL(href) || href;
        link.href = safeHref;

        // Set additional attributes
        for (const [key, value] of Object.entries(attributes)) {
            if (key !== 'href') {
                link.setAttribute(key, value);
            }
        }

        return link;
    },

    /**
     * Safely update element by ID
     * @param {string} elementId 
     * @param {string} html 
     */
    updateById: function (elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            this.setHTML(element, html);
        } else {
            Logger.warn(`SafeDOM.updateById: Element not found: ${elementId}`);
        }
    },

    /**
     * Safely update element text by ID
     * @param {string} elementId 
     * @param {string} text 
     */
    updateTextById: function (elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            this.setText(element, text);
        } else {
            Logger.warn(`SafeDOM.updateTextById: Element not found: ${elementId}`);
        }
    },

    /**
     * Create table row from data
     * @param {Array} cells - Array of {content, isHTML, className}
     */
    createTableRow: function (cells) {
        const row = document.createElement('tr');

        cells.forEach(cell => {
            const td = document.createElement('td');

            if (cell.className) {
                td.className = cell.className;
            }

            if (cell.isHTML) {
                this.setHTML(td, cell.content);
            } else {
                this.setText(td, cell.content);
            }

            row.appendChild(td);
        });

        return row;
    },

    /**
     * Build safe template with data
     * @param {string} template - Template string with {{placeholders}}
     * @param {Object} data - Data object
     * @param {Array} htmlFields - Fields that contain HTML (will be sanitized)
     */
    buildTemplate: function (template, data, htmlFields = []) {
        let result = template;

        for (const [key, value] of Object.entries(data)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');

            let safeValue;
            if (htmlFields.includes(key)) {
                // Sanitize HTML fields
                safeValue = window.Sanitizer?.sanitizeHTML(value) || value;
            } else {
                // Escape text fields
                safeValue = window.Sanitizer?.escapeHTML(value) || this.escapeHTML(value);
            }

            result = result.replace(placeholder, safeValue);
        }

        return result;
    },

    /**
     * Fallback HTML escape if Sanitizer not available
     */
    escapeHTML: function (text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Add event listener with error handling
     * @param {HTMLElement} element 
     * @param {string} event 
     * @param {Function} handler 
     * @param {Object} options 
     */
    on: function (element, event, handler, options = {}) {
        if (!element || !handler) return;

        const safeHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                ErrorHandler.handle(error, `Event: ${event}`);
            }
        };

        element.addEventListener(event, safeHandler, options);
    },

    /**
     * Delegate event listener
     * @param {HTMLElement} parent 
     * @param {string} selector 
     * @param {string} event 
     * @param {Function} handler 
     */
    delegate: function (parent, selector, event, handler) {
        if (!parent || !handler) return;

        parent.addEventListener(event, (e) => {
            const target = e.target.closest(selector);
            if (target) {
                try {
                    handler.call(target, e);
                } catch (error) {
                    ErrorHandler.handle(error, `Delegated Event: ${event}`);
                }
            }
        });
    }
};

// Export to window
window.SafeDOM = SafeDOM;

Logger.info('SafeDOM utilities loaded');

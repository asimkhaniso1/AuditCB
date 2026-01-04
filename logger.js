/**
 * AuditCB360 Logger Utility
 * Handles application logging with debug mode support and log levels.
 * Replaces direct console.log calls to prevent info leakage in production.
 */

window.DEBUG_MODE = true; // Set to false in production

window.Logger = {
    /**
     * Log debug information (only if DEBUG_MODE is true)
     * @param {string} module - The module name (e.g., 'Planning')
     * @param {string} message - The message to log
     * @param {any} data - Optional data to log
     */
    debug: (module, message, data = null) => {
        if (window.DEBUG_MODE) {
            const timestamp = new Date().toLocaleTimeString();
            const prefix = `[${timestamp}] [DEBUG] [${module}]`;
            if (data) {
                console.log(`${prefix} ${message}`, data);
            } else {
                console.log(`${prefix} ${message}`);
            }
        }
    },

    /**
     * Log informational messages
     * @param {string} module - The module name
     * @param {string} message - The message
     */
    info: (module, message) => {
        const timestamp = new Date().toLocaleTimeString();
        console.info(`[${timestamp}] [INFO] [${module}] ${message}`);
    },

    /**
     * Log warnings
     * @param {string} module - The module name
     * @param {string} message - The warning message
     */
    warn: (module, message) => {
        const timestamp = new Date().toLocaleTimeString();
        console.warn(`[${timestamp}] [WARN] [${module}] ${message}`);
    },

    /**
     * Log errors
     * @param {string} module - The module name
     * @param {string} message - The error message
     * @param {Error|any} error - The error object
     */
    error: (module, message, error = null) => {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[${timestamp}] [ERROR] [${module}] ${message}`, error || '');

        // Optionally integrate with ErrorHandler if available
        if (window.ErrorHandler && typeof window.ErrorHandler.log === 'function') {
            window.ErrorHandler.log(error, module);
        }
    }
};

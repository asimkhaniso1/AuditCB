/**
 * AuditCB360 Logger Utility
 * Handles application logging with debug mode support and log levels.
 * Replaces direct console.log calls to prevent info leakage in production.
 * 
 * Supports both:
 *   Logger.info('message')           - Simple message
 *   Logger.info('module', 'message') - Module-prefixed message
 */

window.DEBUG_MODE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

window.Logger = {
    /**
     * Log debug information (only if DEBUG_MODE is true)
     * @param {...any} args - Either (message) or (module, message, data)
     */
    debug: (...args) => {
        if (!window.DEBUG_MODE) return;
        const timestamp = new Date().toLocaleTimeString();

        if (args.length === 1) {
            console.log(`[${timestamp}] [DEBUG]`, args[0]);
        } else if (args.length === 2) {
            console.log(`[${timestamp}] [DEBUG] [${args[0]}]`, args[1]);
        } else {
            console.log(`[${timestamp}] [DEBUG] [${args[0]}]`, args[1], args[2]);
        }
    },

    /**
     * Log informational messages
     * @param {...any} args - Either (message) or (module, message)
     */
    info: (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        if (args.length === 1) {
            console.info(`[${timestamp}] [INFO]`, args[0]);
        } else {
            console.info(`[${timestamp}] [INFO] [${args[0]}]`, args[1]);
        }
    },

    /**
     * Log warnings
     * @param {...any} args - Either (message) or (module, message)
     */
    warn: (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        if (args.length === 1) {
            console.warn(`[${timestamp}] [WARN]`, args[0]);
        } else {
            console.warn(`[${timestamp}] [WARN] [${args[0]}]`, args[1]);
        }
    },

    /**
     * Log errors
     * @param {...any} args - Either (message) or (module, message) or (module, message, error)
     */
    error: (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        if (args.length === 1) {
            console.error(`[${timestamp}] [ERROR]`, args[0]);
        } else if (args.length === 2) {
            console.error(`[${timestamp}] [ERROR] [${args[0]}]`, args[1]);
        } else {
            console.error(`[${timestamp}] [ERROR] [${args[0]}]`, args[1], args[2]);
        }

        // Optionally integrate with ErrorHandler if available
        const error = args.length >= 3 ? args[2] : (args.length === 1 ? args[0] : null);
        const module = args.length >= 2 ? args[0] : 'Unknown';
        if (error && window.ErrorHandler && typeof window.ErrorHandler.log === 'function') {
            window.ErrorHandler.log(error, module);
        }
    },

    /**
     * Log raw message without timestamp (for compatibility)
     * @param {...any} args - Any arguments
     */
    log: (...args) => {
        if (window.DEBUG_MODE) {
            console.log(...args);
        }
    }
};

// Ensure Logger is available immediately
if (window.DEBUG_MODE) console.log('[Logger] AuditCB360 Logger initialized (debug mode)');

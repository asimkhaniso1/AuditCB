// ============================================
// LOGGER UTILITY MODULE
// ============================================
// Centralized logging with production safety

const Logger = {
    // Debug mode - set to false in production
    DEBUG_MODE: true, // TODO: Set to false for production deployment

    /**
     * Debug logging - only shows in development
     */
    debug: function (message, ...args) {
        if (this.DEBUG_MODE) {
            console.log('[DEBUG]', message, ...args);
        }
    },

    /**
     * Info logging - general information
     */
    info: function (message, ...args) {
        if (this.DEBUG_MODE) {
            console.info('[INFO]', message, ...args);
        }
    },

    /**
     * Warning logging - always shown
     */
    warn: function (message, ...args) {
        console.warn('[WARN]', message, ...args);
    },

    /**
     * Error logging - always shown
     */
    error: function (message, ...args) {
        console.error('[ERROR]', message, ...args);

        // In production, could send to error tracking service
        if (!this.DEBUG_MODE) {
            this.reportToMonitoring(message, args);
        }
    },

    /**
     * Report errors to monitoring service (placeholder)
     */
    reportToMonitoring: function (message, args) {
        // TODO: Integrate with error monitoring service (Sentry, LogRocket, etc.)
        // Example:
        // Sentry.captureException(new Error(message), { extra: args });
    },

    /**
     * Performance timing
     */
    time: function (label) {
        if (this.DEBUG_MODE) {
            console.time(label);
        }
    },

    timeEnd: function (label) {
        if (this.DEBUG_MODE) {
            console.timeEnd(label);
        }
    },

    /**
     * Group logging
     */
    group: function (label) {
        if (this.DEBUG_MODE) {
            console.group(label);
        }
    },

    groupEnd: function () {
        if (this.DEBUG_MODE) {
            console.groupEnd();
        }
    },

    /**
     * Table logging for arrays/objects
     */
    table: function (data) {
        if (this.DEBUG_MODE) {
            console.table(data);
        }
    }
};

// Export to window
window.Logger = Logger;

// Production mode detection
if (window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.includes('192.168')) {
    Logger.DEBUG_MODE = false;
    Logger.info('Logger initialized in PRODUCTION mode - debug logs disabled');
} else {
    Logger.info('Logger initialized in DEVELOPMENT mode - all logs enabled');
}

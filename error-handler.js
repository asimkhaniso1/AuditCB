// ============================================
// ERROR HANDLER UTILITY MODULE
// ============================================
// Centralized error handling with user-friendly messages

const ErrorHandler = {

    /**
     * Handle errors with context and user-friendly messages
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @param {boolean} showToUser - Whether to show notification to user
     */
    handle: function (error, context = 'Unknown', showToUser = true) {
        // Log for debugging
        Logger.error(`[${context}]`, error);

        // Show user-friendly message
        if (showToUser && window.showNotification) {
            const userMessage = this.getUserMessage(error, context);
            window.showNotification(userMessage, 'error');
        }

        // Attempt recovery if possible
        this.attemptRecovery(error, context);

        // Report to monitoring (in production)
        this.reportError(error, context);

        return false; // Indicate error was handled
    },

    /**
     * Get user-friendly error message
     */
    getUserMessage: function (error, context) {
        // Handle null/undefined error
        if (!error) {
            return `An error occurred in ${context}. Please try again.`;
        }

        const errorMessages = {
            'QuotaExceededError': 'Storage is full. Please export and clear old data to continue.',
            'NetworkError': 'Connection lost. Please check your internet connection.',
            'TypeError': 'An unexpected error occurred. Please refresh the page.',
            'ValidationError': 'Please check your input and try again.',
            'AuthenticationError': 'Please log in again to continue.',
            'PermissionError': 'You do not have permission to perform this action.',
            'NotFoundError': 'The requested item was not found.',
            'DuplicateError': 'This item already exists.',
        };

        // Check for specific error types
        if (error?.name && errorMessages[error.name]) {
            return errorMessages[error.name];
        }

        // Check for quota exceeded
        if (error.name === 'QuotaExceededError' ||
            error.message?.includes('quota') ||
            error.message?.includes('storage')) {
            return errorMessages['QuotaExceededError'];
        }

        // Context-specific messages
        const contextMessages = {
            'save': 'Failed to save changes. Please try again.',
            'load': 'Failed to load data. Please refresh the page.',
            'delete': 'Failed to delete item. Please try again.',
            'export': 'Failed to export data. Please try again.',
            'import': 'Failed to import data. Please check the file format.',
            'validation': 'Please check your input and try again.',
        };

        if (contextMessages[context.toLowerCase()]) {
            return contextMessages[context.toLowerCase()];
        }

        // Default message
        return `An error occurred in ${context}. Please try again or contact support.`;
    },

    /**
     * Attempt to recover from error
     */
    attemptRecovery: function (error, context) {
        try {
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                Logger.warn('Attempting storage cleanup...');
                this.cleanupStorage();
                return;
            }

            // Handle network errors
            if (error.name === 'NetworkError') {
                Logger.warn('Network error detected, will retry when online');
                this.setupRetryOnOnline(context);
                return;
            }

            // Handle state corruption
            if (context === 'load' && error.name === 'SyntaxError') {
                Logger.warn('State corruption detected, attempting recovery from backup');
                this.recoverFromBackup();
                return;
            }
        } catch (recoveryError) {
            Logger.error('Recovery failed:', recoveryError);
        }
    },

    /**
     * Cleanup storage to free space
     */
    cleanupStorage: function () {
        try {
            // Remove old audit logs (keep last 100)
            if (window.state?.auditLog?.length > 100) {
                window.state.auditLog = window.state.auditLog.slice(-100);
                Logger.info('Cleaned up old audit logs');
            }

            // Prompt user to export old data
            if (window.showNotification) {
                window.showNotification(
                    'Storage is nearly full. Please export old audit reports and clear them.',
                    'warning'
                );
            }
        } catch (e) {
            Logger.error('Cleanup failed:', e);
        }
    },

    /**
     * Setup retry when connection is restored
     */
    setupRetryOnOnline: function (context) {
        const retryHandler = () => {
            Logger.info('Connection restored, retrying operation');
            window.showNotification('Connection restored!', 'success');
            window.removeEventListener('online', retryHandler);
        };

        window.addEventListener('online', retryHandler);
    },

    /**
     * Recover from backup
     */
    recoverFromBackup: function () {
        try {
            // Check for backup in localStorage
            const backupKeys = Object.keys(localStorage).filter(k => k.startsWith('auditCB360State_backup_'));

            if (backupKeys.length > 0) {
                // Get most recent backup
                const latestBackup = backupKeys.sort().pop();
                const backupData = localStorage.getItem(latestBackup);

                if (backupData) {
                    localStorage.setItem('auditCB360State', backupData);
                    Logger.info('Recovered from backup:', latestBackup);
                    window.showNotification('Data recovered from backup. Please refresh the page.', 'success');
                    return true;
                }
            }

            Logger.warn('No backup found for recovery');
            return false;
        } catch (e) {
            Logger.error('Backup recovery failed:', e);
            return false;
        }
    },

    /**
     * Report error to monitoring service
     */
    reportError: function (error, context) {
        if (!Logger.DEBUG_MODE) {
            // TODO: Integrate with error monitoring service
            // Example: Sentry.captureException(error, { tags: { context } });
            Logger.debug('Would report to monitoring:', error, context);
        }
    },

    /**
     * Validate operation before execution
     */
    validateOperation: function (operation, requirements = {}) {
        const errors = [];

        // Check authentication
        if (requirements.requireAuth && !window.state?.currentUser) {
            errors.push('User must be authenticated');
        }

        // Check permissions
        if (requirements.requiredRole) {
            const userRole = window.state?.currentUser?.role;
            const allowedRoles = Array.isArray(requirements.requiredRole)
                ? requirements.requiredRole
                : [requirements.requiredRole];

            if (!allowedRoles.includes(userRole)) {
                errors.push(`Operation requires one of: ${allowedRoles.join(', ')}`);
            }
        }

        // Check data availability
        if (requirements.requireData) {
            for (const dataKey of requirements.requireData) {
                if (!window.state?.[dataKey]) {
                    errors.push(`Required data missing: ${dataKey}`);
                }
            }
        }

        if (errors.length > 0) {
            const error = new Error(errors.join('; '));
            error.name = 'ValidationError';
            throw error;
        }

        return true;
    },

    /**
     * Safe async operation wrapper
     */
    safeAsync: async function (asyncFn, context, fallbackValue = null) {
        try {
            return await asyncFn();
        } catch (error) {
            this.handle(error, context);
            return fallbackValue;
        }
    },

    /**
     * Safe sync operation wrapper
     */
    safeSync: function (syncFn, context, fallbackValue = null) {
        try {
            return syncFn();
        } catch (error) {
            this.handle(error, context);
            return fallbackValue;
        }
    }
};

// Export to window
window.ErrorHandler = ErrorHandler;

// Setup global error handlers
window.addEventListener('error', (event) => {
    ErrorHandler.handle(event.error, 'Global Error', true);
});

window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    ErrorHandler.handle(error, 'Unhandled Promise', true);
});

Logger.info('ErrorHandler initialized with global error catching');

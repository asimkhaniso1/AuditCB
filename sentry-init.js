// ============================================
// SENTRY ERROR MONITORING INITIALIZATION
// ============================================
// Initializes Sentry for error tracking and performance monitoring.
// DSN is injected via environment variable (window.__SENTRY_DSN__).
// If no DSN is provided, Sentry is not loaded and the app runs normally.

(function () {
    'use strict';

    const DSN = window.__SENTRY_DSN__ || '';

    if (!DSN) {
        if (window.Logger) {
            Logger.debug('Sentry DSN not configured — error monitoring disabled.');
        }
        // Provide a no-op Sentry global so calls in error-handler.js don't throw
        window.Sentry = {
            captureException: function () {},
            captureMessage: function () {},
            setUser: function () {},
            setContext: function () {},
            setTag: function () {},
            addBreadcrumb: function () {},
            init: function () {}
        };
        return;
    }

    // Initialize Sentry SDK (loaded via CDN in index.html)
    if (typeof Sentry !== 'undefined' && Sentry.init) {
        Sentry.init({
            dsn: DSN,
            environment: window.location.hostname === 'localhost' ? 'development' : 'production',
            release: 'auditcb360@21.0',

            // Performance monitoring
            tracesSampleRate: 0.1, // 10% of transactions
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0.5, // 50% of error sessions

            // Reduce noise
            ignoreErrors: [
                'ResizeObserver loop',
                'Non-Error promise rejection',
                'Network request failed',
                'Load failed',
                'Failed to fetch'
            ],

            // Breadcrumb config
            maxBreadcrumbs: 50,

            beforeSend(event) {
                // Scrub sensitive data
                if (event.request && event.request.headers) {
                    delete event.request.headers['Authorization'];
                    delete event.request.headers['Cookie'];
                }
                // Don't send in development unless explicitly enabled
                if (window.location.hostname === 'localhost' && !window.__SENTRY_DEV__) {
                    return null;
                }
                return event;
            }
        });

        // Set user context when available
        if (window.state && window.state.currentUser) {
            Sentry.setUser({
                email: window.state.currentUser.email,
                username: window.state.currentUser.name
            });
        }

        if (window.Logger) {
            Logger.info('Sentry error monitoring initialized.');
        }
    } else {
        if (window.Logger) {
            Logger.warn('Sentry SDK not loaded — CDN may be unreachable.');
        }
        // Provide no-op fallback
        window.Sentry = {
            captureException: function () {},
            captureMessage: function () {},
            setUser: function () {},
            setContext: function () {},
            setTag: function () {},
            addBreadcrumb: function () {},
            init: function () {}
        };
    }
})();

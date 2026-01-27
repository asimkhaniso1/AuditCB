// ============================================
// DIAGNOSTIC: INTERCEPT SHOW NOTIFICATION
// Run this to find the source of error messages
// ============================================

(function diagnosticIntercept() {
    const originalShowNotification = window.showNotification;

    window.showNotification = function (message, type) {
        console.group('%c🔔 NOTIFICATION INTERCEPTED', 'color: #f59e0b; font-weight: bold;');
        console.log('Message:', message);
        console.log('Type:', type);
        console.log('Stack Trace:', new Error().stack);
        console.groupEnd();

        if (originalShowNotification) {
            originalShowNotification(message, type);
        }
    };

    console.log('✅ Notification interceptor active. Trigger the error to see the stack trace.');

    // Also check for hidden scripts
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline');
    console.log('📦 Loaded Scripts:', scripts);

    // Check state clients
    console.log('📊 State Clients:', window.state?.clients);
})();

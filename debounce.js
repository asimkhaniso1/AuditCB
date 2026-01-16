// ============================================
// DEBOUNCE UTILITY
// ============================================
// Prevents excessive function calls during rapid events (like typing)

(function () {
    'use strict';

    /**
     * Debounce function - delays function execution until after wait time
     * @param {Function} func - Function to debounce
     * @param {number} wait - Milliseconds to wait (default: 300ms)
     * @returns {Function} - Debounced function
     */
    window.debounce = function (func, wait = 300) {
        let timeout;

        return function executedFunction(...args) {
            const context = this;

            const later = () => {
                clearTimeout(timeout);
                func.apply(context, args);
            };

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    /**
     * Throttle function - limits function execution to once per time period
     * @param {Function} func - Function to throttle
     * @param {number} limit - Milliseconds between calls (default: 300ms)
     * @returns {Function} - Throttled function
     */
    window.throttle = function (func, limit = 300) {
        let inThrottle;

        return function (...args) {
            const context = this;

            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    console.log('✅ Debounce/Throttle utilities loaded');

})();

// ============================================
// DEBOUNCE & THROTTLE UTILITY (ESM-ready)
// ============================================
// Prevents excessive function calls during rapid events (like typing)

/**
 * Debounce function - delays function execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait (default: 300ms)
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300) {
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
}

/**
 * Throttle function - limits function execution to once per time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls (default: 300ms)
 * @returns {Function} - Throttled function
 */
function throttle(func, limit = 300) {
    let inThrottle;

    return function (...args) {
        const context = this;

        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Window exports (used by all existing code)
window.debounce = debounce;
window.throttle = throttle;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, throttle };
}

// ============================================
// EVENT MANAGER - Prevent Memory Leaks
// ============================================
// Utility to manage event listeners and prevent memory leaks

(function () {
    'use strict';

    window.EventManager = {
        // Store all active listeners
        listeners: new Map(),

        /**
         * Add an event listener with automatic cleanup
         * @param {Element} element - DOM element
         * @param {string} event - Event name (e.g., 'click', 'input')
         * @param {Function} handler - Event handler function
         * @param {string} key - Unique key for this listener
         */
        add(element, event, handler, key) {
            if (!element) {
                console.warn('[EventManager] Element not found for key:', key);
                return;
            }

            // Remove existing listener with same key first
            this.remove(key);

            // Add new listener
            element.addEventListener(event, handler);

            // Store reference for cleanup
            this.listeners.set(key, {
                element,
                event,
                handler
            });

            return handler;
        },

        /**
         * Remove a specific listener by key
         * @param {string} key - Unique key of listener to remove
         */
        remove(key) {
            const listener = this.listeners.get(key);
            if (listener) {
                listener.element.removeEventListener(listener.event, listener.handler);
                this.listeners.delete(key);
            }
        },

        /**
         * Remove all listeners (call before navigation)
         */
        cleanup() {
            this.listeners.forEach((listener, key) => {
                this.remove(key);
            });
            console.log('[EventManager] Cleaned up', this.listeners.size, 'listeners');
        },

        /**
         * Get number of active listeners (for debugging)
         */
        count() {
            return this.listeners.size;
        },

        /**
         * List all active listener keys (for debugging)
         */
        debug() {
            console.log('[EventManager] Active listeners:');
            this.listeners.forEach((listener, key) => {
                console.log(`  - ${key}: ${listener.event} on`, listener.element);
            });
            return Array.from(this.listeners.keys());
        }
    };

    // Cleanup on navigation
    window.addEventListener('hashchange', () => {
        window.EventManager.cleanup();
    });

    console.log('✅ EventManager initialized');

})();

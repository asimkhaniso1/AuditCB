// ============================================
// API CACHE MANAGER
// Optimizes Supabase calls with intelligent caching
// ============================================

window.ApiCache = (function () {
    const cache = new Map();
    const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
    const pendingRequests = new Map(); // Prevent duplicate concurrent requests

    /**
     * Get cached data or fetch fresh
     * @param {string} key - Unique cache key
     * @param {Function} fetchFn - Async function to fetch data if cache miss
     * @param {number} ttl - Time to live in ms (default 5 min)
     */
    async function getOrFetch(key, fetchFn, ttl = DEFAULT_TTL) {
        // Check cache first
        const cached = cache.get(key);
        if (cached && Date.now() < cached.expiry) {
            console.log(`[Cache] HIT: ${key}`);
            return cached.data;
        }

        // Check if request is already pending (prevent duplicate calls)
        if (pendingRequests.has(key)) {
            console.log(`[Cache] PENDING: ${key} - waiting for existing request`);
            return pendingRequests.get(key);
        }

        // Fetch fresh data
        console.log(`[Cache] MISS: ${key} - fetching...`);
        const promise = fetchFn().then(data => {
            cache.set(key, {
                data: data,
                expiry: Date.now() + ttl,
                fetchedAt: new Date().toISOString()
            });
            pendingRequests.delete(key);
            return data;
        }).catch(err => {
            pendingRequests.delete(key);
            throw err;
        });

        pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * Invalidate specific cache key
     */
    function invalidate(key) {
        if (cache.has(key)) {
            cache.delete(key);
            console.log(`[Cache] INVALIDATED: ${key}`);
        }
    }

    /**
     * Invalidate all keys matching a pattern
     */
    function invalidatePattern(pattern) {
        let count = 0;
        for (const key of cache.keys()) {
            if (key.includes(pattern)) {
                cache.delete(key);
                count++;
            }
        }
        console.log(`[Cache] INVALIDATED ${count} keys matching: ${pattern}`);
    }

    /**
     * Clear entire cache
     */
    function clear() {
        cache.clear();
        console.log('[Cache] CLEARED all entries');
    }

    /**
     * Get cache statistics
     */
    function getStats() {
        const entries = [];
        for (const [key, value] of cache.entries()) {
            entries.push({
                key,
                fetchedAt: value.fetchedAt,
                expiresIn: Math.round((value.expiry - Date.now()) / 1000) + 's',
                isExpired: Date.now() >= value.expiry
            });
        }
        return {
            totalEntries: cache.size,
            pendingRequests: pendingRequests.size,
            entries
        };
    }

    // Expose for debugging
    window._cacheStats = getStats;

    return {
        getOrFetch,
        invalidate,
        invalidatePattern,
        clear,
        getStats
    };
})();

// ============================================
// CACHED DATA HELPERS
// Common data fetching with automatic caching
// ============================================

window.CachedData = {
    /**
     * Get all clients (cached)
     */
    async getClients(forceRefresh = false) {
        if (forceRefresh) {
            window.ApiCache.invalidate('clients');
        }
        return window.ApiCache.getOrFetch('clients', async () => {
            // If using Supabase
            if (window.SupabaseClient?.isConnected()) {
                const { data, error } = await window.SupabaseClient.fetchClients();
                if (!error && data) return data;
            }
            // Fall back to local state
            return window.state.clients || [];
        });
    },

    /**
     * Get all auditors (cached)
     */
    async getAuditors(forceRefresh = false) {
        if (forceRefresh) {
            window.ApiCache.invalidate('auditors');
        }
        return window.ApiCache.getOrFetch('auditors', async () => {
            if (window.SupabaseClient?.isConnected()) {
                const { data, error } = await window.SupabaseClient.fetchAuditors();
                if (!error && data) return data;
            }
            return window.state.auditors || [];
        });
    },

    /**
     * Get all audit plans (cached)
     */
    async getAuditPlans(forceRefresh = false) {
        if (forceRefresh) {
            window.ApiCache.invalidate('auditPlans');
        }
        return window.ApiCache.getOrFetch('auditPlans', async () => {
            if (window.SupabaseClient?.isConnected()) {
                const { data, error } = await window.SupabaseClient.fetchAuditPlans();
                if (!error && data) return data;
            }
            return window.state.auditPlans || [];
        });
    },

    /**
     * Get client by ID (cached)
     */
    async getClientById(clientId, forceRefresh = false) {
        const cacheKey = `client_${clientId}`;
        if (forceRefresh) {
            window.ApiCache.invalidate(cacheKey);
        }
        return window.ApiCache.getOrFetch(cacheKey, async () => {
            // Try local state first (faster)
            const local = window.state.clients?.find(c => c.id === clientId);
            if (local) return local;

            // Try Supabase if connected
            if (window.SupabaseClient?.isConnected()) {
                const { data, error } = await window.SupabaseClient.fetchClientById(clientId);
                if (!error && data) return data;
            }
            return null;
        }, 2 * 60 * 1000); // 2 minute TTL for individual items
    },

    /**
     * Invalidate client cache (call after mutations)
     */
    invalidateClients() {
        window.ApiCache.invalidatePattern('client');
    },

    /**
     * Invalidate auditor cache (call after mutations)
     */
    invalidateAuditors() {
        window.ApiCache.invalidatePattern('auditor');
    },

    /**
     * Invalidate audit plan cache
     */
    invalidateAuditPlans() {
        window.ApiCache.invalidatePattern('audit');
    }
};

console.log('[ApiCache] Module loaded - use window._cacheStats() to view cache');

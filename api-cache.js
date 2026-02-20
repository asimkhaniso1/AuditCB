// ============================================
// API CACHE MANAGER
// Optimizes Supabase calls with intelligent caching
// ============================================

window.ApiCache = (function () {
    const cache = new Map();
    const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
    const pendingRequests = new Map(); // Prevent duplicate concurrent requests
    const STORAGE_PREFIX = 'auditcb_cache_'; // Prefix for localStorage keys

    /**
     * Load from localStorage
     */
    function loadFromStorage(key) {
        try {
            const item = localStorage.getItem(STORAGE_PREFIX + key);
            if (!item) return null;
            return JSON.parse(item);
        } catch (e) {
            console.warn('[Cache] Failed to load from storage', e);
            return null;
        }
    }

    /**
     * Save to localStorage
     */
    function saveToStorage(key, value) {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn('[Cache] Failed to save to storage', e);
        }
    }

    /**
     * Clear specific key from storage
     */
    function removeFromStorage(key) {
        try {
            localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (e) {
            console.warn('[Cache] Failed to remove from storage', e);
        }
    }

    /**
     * Core Fetch & Cache Logic
     */
    async function fetchAndCache(key, fetchFn, ttl) {
        // Check if request is already pending
        if (pendingRequests.has(key)) {
            return pendingRequests.get(key);
        }


        try {
            const promise = fetchFn().then(data => {
                const cacheEntry = {
                    data: data,
                    expiry: Date.now() + ttl,
                    fetchedAt: new Date().toISOString()
                };

                // Update Memory
                cache.set(key, cacheEntry);
                // Update Storage
                saveToStorage(key, cacheEntry);

                pendingRequests.delete(key);
                return data;
            });

            pendingRequests.set(key, promise);
            return await promise;
        } catch (err) {
            pendingRequests.delete(key);
            console.error(`[Cache] FETCH FAILED: ${key}`, err);
            throw err;
        }
    }

    /**
     * Get cached data or fetch fresh (Stale-While-Revalidate)
     * @param {string} key - Unique cache key
     * @param {Function} fetchFn - Async function to fetch data if cache miss
     * @param {number} ttl - Time to live in ms (default 5 min)
     */
    async function getOrFetch(key, fetchFn, ttl = DEFAULT_TTL) {
        // 1. Check Memory Cache
        let cached = cache.get(key);

        // 2. Check Persistent Storage if memory miss
        if (!cached) {
            cached = loadFromStorage(key);
            if (cached) {
                cache.set(key, cached); // Hydrate memory
            }
        }

        const now = Date.now();
        const isExpired = cached ? now > cached.expiry : true;

        // 3. HIT (Valid) -> Return immediately
        if (cached && !isExpired) {
            return cached.data;
        }

        // 4. STALE (Expired but exists) -> Return stale, update in background
        if (cached && isExpired) {
            // Trigger background update (no await)
            fetchAndCache(key, fetchFn, ttl).catch(e => {
                console.warn(`[Cache] Background update failed for ${key}`, e);
            });
            return cached.data;
        }

        // 5. MISS (No data) -> Must wait for fetch
        // If fetch fails, we have no data to return, so we throw
        return fetchAndCache(key, fetchFn, ttl);
    }

    /**
     * Invalidate specific cache key
     */
    function invalidate(key) {
        cache.delete(key);
        removeFromStorage(key);
    }

    /**
     * Invalidate all keys matching a pattern
     */
    function invalidatePattern(pattern) {
        // Memory
        for (const key of cache.keys()) {
            if (key.includes(pattern)) {
                cache.delete(key);
                removeFromStorage(key);
            }
        }

        // Storage cleanup (in case memory is out of sync)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX) && key.includes(pattern)) {
                localStorage.removeItem(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    function clear() {
        cache.clear();
        // Clear only our keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    /**
     * Get cache statistics
     */
    function getStats() {
        const entries = [];
        // Check both memory and storage for stats
        const allKeys = new Set([...cache.keys()]);

        // Add keys from storage that might not be in memory
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                allKeys.add(key.replace(STORAGE_PREFIX, ''));
            }
        }

        for (const key of allKeys) {
            // Prefer memory, then storage
            let val = cache.get(key) || loadFromStorage(key);
            if (val) {
                entries.push({
                    key,
                    source: cache.has(key) ? 'Memory' : 'Disk',
                    fetchedAt: val.fetchedAt,
                    expiresIn: Math.round((val.expiry - Date.now()) / 1000) + 's',
                    isExpired: Date.now() >= val.expiry
                });
            }
        }

        return {
            totalEntries: allKeys.size,
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


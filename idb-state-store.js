// ============================================
// INDEXEDDB STATE STORE
// ============================================
// Replaces localStorage for app state persistence.
// IndexedDB has no practical size limit (typically 50%+ of disk),
// eliminating the 5MB localStorage ceiling that breaks at 500 clients.
//
// API:
//   StateStore.init()         → Opens the database (call once on startup)
//   StateStore.save(obj)      → Writes state to IndexedDB
//   StateStore.load()         → Returns stored state object (or null)
//   StateStore.clear()        → Wipes stored state (for logout/reset)
//   StateStore.isReady        → Boolean, true when DB is open
//
// Falls back to localStorage if IndexedDB is unavailable.

const StateStore = {

    DB_NAME: 'auditCB360',
    DB_VERSION: 1,
    STORE_NAME: 'appState',
    STATE_KEY: 'current',          // Single key for the whole state blob
    LS_KEY: 'auditCB360State',    // localStorage fallback key (existing)

    _db: null,
    isReady: false,
    _useLocalStorage: false,       // true if IndexedDB is not available

    /**
     * Open (or create) the IndexedDB database.
     * Resolves when the DB is ready for read/write.
     * @returns {Promise<void>}
     */
    init: function () {
        return new Promise((resolve, reject) => {
            // Feature detection
            if (!window.indexedDB) {
                console.warn('[StateStore] IndexedDB not available, falling back to localStorage');
                this._useLocalStorage = true;
                this.isReady = true;
                resolve();
                return;
            }

            try {
                const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

                req.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    // Create the object store if it doesn't exist
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        db.createObjectStore(this.STORE_NAME);
                        console.log('[StateStore] Created object store:', this.STORE_NAME);
                    }
                };

                req.onsuccess = (event) => {
                    this._db = event.target.result;
                    this.isReady = true;
                    console.log('[StateStore] IndexedDB ready');

                    // Handle unexpected close (e.g., browser clearing storage)
                    this._db.onclose = () => {
                        console.warn('[StateStore] Database closed unexpectedly');
                        this._db = null;
                        this.isReady = false;
                    };

                    resolve();
                };

                req.onerror = (event) => {
                    console.warn('[StateStore] IndexedDB open failed, falling back to localStorage:', event.target.error);
                    this._useLocalStorage = true;
                    this.isReady = true;
                    resolve(); // Don't reject — graceful fallback
                };

                req.onblocked = () => {
                    console.warn('[StateStore] IndexedDB blocked (another tab may have an older version open)');
                    this._useLocalStorage = true;
                    this.isReady = true;
                    resolve();
                };
            } catch (err) {
                console.warn('[StateStore] IndexedDB init error, falling back to localStorage:', err);
                this._useLocalStorage = true;
                this.isReady = true;
                resolve();
            }
        });
    },

    /**
     * Save the state object to IndexedDB (or localStorage fallback).
     * Uses a JSON replacer to strip base64 evidence images during serialization.
     * @param {Object} stateObj - The state object to persist
     * @returns {Promise<void>}
     */
    save: function (stateObj) {
        // JSON replacer that strips base64 evidence (same logic as old saveState)
        const replacer = (key, value) => {
            if (key === 'evidenceImage' && typeof value === 'string' && value.startsWith('data:')) {
                return '';
            }
            if (key === 'evidenceImages' && Array.isArray(value)) {
                return value.filter(u => u && !u.startsWith('data:'));
            }
            return value;
        };

        const stateJSON = JSON.stringify(stateObj, replacer);

        // localStorage fallback
        if (this._useLocalStorage || !this._db) {
            return new Promise((resolve) => {
                try {
                    localStorage.setItem(this.LS_KEY, stateJSON);
                } catch (quotaErr) {
                    console.warn('[StateStore] localStorage quota exceeded. State kept in memory only.');
                }
                resolve();
            });
        }

        // IndexedDB write
        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                store.put(stateJSON, this.STATE_KEY);

                tx.oncomplete = () => {
                    const sizeKB = Math.round(stateJSON.length / 1024);
                    console.log(`[StateStore] Saved ${sizeKB}KB to IndexedDB`);
                    resolve();
                };

                tx.onerror = (event) => {
                    console.warn('[StateStore] IndexedDB write failed, trying localStorage:', event.target.error);
                    // Fallback to localStorage on write failure
                    try {
                        localStorage.setItem(this.LS_KEY, stateJSON);
                    } catch (quotaErr) {
                        console.warn('[StateStore] localStorage fallback also failed. State in memory only.');
                    }
                    resolve(); // Don't reject — best effort
                };
            } catch (err) {
                console.warn('[StateStore] Transaction error:', err);
                resolve();
            }
        });
    },

    /**
     * Load state from IndexedDB (or localStorage fallback).
     * @returns {Promise<Object|null>} Parsed state object, or null if nothing stored
     */
    load: function () {
        // localStorage fallback
        if (this._useLocalStorage || !this._db) {
            return new Promise((resolve) => {
                try {
                    const saved = localStorage.getItem(this.LS_KEY);
                    resolve(saved ? JSON.parse(saved) : null);
                } catch (err) {
                    console.warn('[StateStore] localStorage load failed:', err);
                    resolve(null);
                }
            });
        }

        // IndexedDB read
        return new Promise((resolve, reject) => {
            try {
                const tx = this._db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);
                const req = store.get(this.STATE_KEY);

                req.onsuccess = () => {
                    if (req.result) {
                        try {
                            const parsed = JSON.parse(req.result);
                            const sizeKB = Math.round(req.result.length / 1024);
                            console.log(`[StateStore] Loaded ${sizeKB}KB from IndexedDB`);
                            resolve(parsed);
                        } catch (parseErr) {
                            console.warn('[StateStore] Corrupt data in IndexedDB:', parseErr);
                            resolve(null);
                        }
                    } else {
                        // Nothing in IndexedDB — try localStorage (migration path)
                        console.log('[StateStore] No data in IndexedDB, checking localStorage for migration...');
                        try {
                            const lsSaved = localStorage.getItem(this.LS_KEY);
                            if (lsSaved) {
                                const parsed = JSON.parse(lsSaved);
                                console.log('[StateStore] Migrated data from localStorage to IndexedDB');
                                // Save to IndexedDB for next time
                                this.save(parsed).catch(() => { });
                                // Clean up localStorage to free space
                                try { localStorage.removeItem(this.LS_KEY); } catch (e) { }
                                resolve(parsed);
                            } else {
                                resolve(null);
                            }
                        } catch (lsErr) {
                            console.warn('[StateStore] localStorage migration failed:', lsErr);
                            resolve(null);
                        }
                    }
                };

                req.onerror = (event) => {
                    console.warn('[StateStore] IndexedDB read failed:', event.target.error);
                    // Fallback to localStorage
                    try {
                        const saved = localStorage.getItem(this.LS_KEY);
                        resolve(saved ? JSON.parse(saved) : null);
                    } catch (err) {
                        resolve(null);
                    }
                };
            } catch (err) {
                console.warn('[StateStore] Transaction error on load:', err);
                resolve(null);
            }
        });
    },

    /**
     * Clear all stored state (used on logout or data reset).
     * @returns {Promise<void>}
     */
    clear: function () {
        // Always clear localStorage too (migration cleanup)
        try { localStorage.removeItem(this.LS_KEY); } catch (e) { }

        if (this._useLocalStorage || !this._db) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            try {
                const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                store.delete(this.STATE_KEY);
                tx.oncomplete = () => {
                    console.log('[StateStore] Cleared IndexedDB state');
                    resolve();
                };
                tx.onerror = () => resolve();
            } catch (err) {
                console.warn('[StateStore] Clear error:', err);
                resolve();
            }
        });
    }
};

// Export globally
window.StateStore = StateStore;

console.log('[StateStore] Module loaded');

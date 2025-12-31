// ============================================
// SUPABASE INTEGRATION MODULE
// ============================================
// Handles Supabase authentication and database operations

const SupabaseClient = {
    client: null,
    isInitialized: false,

    /**
     * Initialize Supabase client
     * NOTE: Add your Supabase credentials to .env or settings
     */
    init: function () {
        try {
            // Get Supabase credentials from settings or environment
            const supabaseUrl = window.state?.settings?.supabaseUrl ||
                localStorage.getItem('supabase_url') ||
                'YOUR_SUPABASE_URL'; // TODO: Set this in settings

            const supabaseKey = window.state?.settings?.supabaseAnonKey ||
                localStorage.getItem('supabase_anon_key') ||
                'YOUR_SUPABASE_ANON_KEY'; // TODO: Set this in settings

            if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
                Logger.warn('Supabase credentials not configured. Using localStorage fallback.');
                this.isInitialized = false;
                return false;
            }

            // Initialize Supabase client
            this.client = supabase.createClient(supabaseUrl, supabaseKey);
            this.isInitialized = true;

            Logger.info('Supabase client initialized successfully');

            // Setup auth state listener
            this.setupAuthListener();

            return true;
        } catch (error) {
            Logger.error('Failed to initialize Supabase:', error);
            this.isInitialized = false;
            return false;
        }
    },

    /**
     * Setup authentication state listener
     */
    setupAuthListener: function () {
        if (!this.client) return;

        this.client.auth.onAuthStateChange((event, session) => {
            Logger.info('Auth state changed:', event);

            if (event === 'SIGNED_IN' && session) {
                this.handleSignIn(session);
            } else if (event === 'SIGNED_OUT') {
                this.handleSignOut();
            } else if (event === 'TOKEN_REFRESHED') {
                Logger.info('Token refreshed');
            }
        });
    },

    /**
     * Handle sign in
     */
    handleSignIn: function (session) {
        const user = session.user;

        // Update app state with user info
        window.state.currentUser = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            role: user.user_metadata?.role || 'Auditor',
            permissions: user.user_metadata?.permissions || ['view_assigned']
        };

        Logger.info('User signed in:', window.state.currentUser.email);

        // Redirect to dashboard if on login page
        if (window.location.hash === '' || window.location.hash === '#login') {
            window.location.hash = 'dashboard';
            window.renderModule('dashboard');
        }
    },

    /**
     * Handle sign out
     */
    handleSignOut: function () {
        window.state.currentUser = null;
        Logger.info('User signed out');

        // Redirect to login
        window.location.hash = 'login';
        if (window.AuthManager) {
            window.AuthManager.showLoginScreen();
        }
    },

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized, using demo auth');
            return null;
        }

        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            Logger.info('Sign in successful');
            return data;
        } catch (error) {
            Logger.error('Sign in failed:', error);
            throw error;
        }
    },

    /**
     * Sign up new user
     */
    async signUp(email, password, metadata = {}) {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return null;
        }

        try {
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    data: metadata // user_metadata
                }
            });

            if (error) throw error;

            Logger.info('Sign up successful');
            return data;
        } catch (error) {
            Logger.error('Sign up failed:', error);
            throw error;
        }
    },

    /**
     * Sign out
     */
    async signOut() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return;
        }

        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;

            Logger.info('Sign out successful');
        } catch (error) {
            Logger.error('Sign out failed:', error);
            throw error;
        }
    },

    /**
     * Get current session
     */
    async getSession() {
        if (!this.isInitialized) return null;

        try {
            const { data, error } = await this.client.auth.getSession();
            if (error) throw error;
            return data.session;
        } catch (error) {
            Logger.error('Get session failed:', error);
            return null;
        }
    },

    /**
     * Get current user
     */
    async getUser() {
        if (!this.isInitialized) return null;

        try {
            const { data, error } = await this.client.auth.getUser();
            if (error) throw error;
            return data.user;
        } catch (error) {
            Logger.error('Get user failed:', error);
            return null;
        }
    },

    /**
     * Database operations
     */
    db: {
        /**
         * Insert data
         */
        insert: async function (table, data) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                const { data: result, error } = await SupabaseClient.client
                    .from(table)
                    .insert(data)
                    .select();

                if (error) throw error;
                return result;
            } catch (error) {
                Logger.error(`Insert to ${table} failed:`, error);
                throw error;
            }
        },

        /**
         * Update data
         */
        update: async function (table, id, data) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                const { data: result, error } = await SupabaseClient.client
                    .from(table)
                    .update(data)
                    .eq('id', id)
                    .select();

                if (error) throw error;
                return result;
            } catch (error) {
                Logger.error(`Update ${table} failed:`, error);
                throw error;
            }
        },

        /**
         * Delete data
         */
        delete: async function (table, id) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                const { error } = await SupabaseClient.client
                    .from(table)
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return true;
            } catch (error) {
                Logger.error(`Delete from ${table} failed:`, error);
                throw error;
            }
        },

        /**
         * Select data
         */
        select: async function (table, filters = {}) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                let query = SupabaseClient.client.from(table).select('*');

                // Apply filters
                for (const [key, value] of Object.entries(filters)) {
                    query = query.eq(key, value);
                }

                const { data, error } = await query;
                if (error) throw error;
                return data;
            } catch (error) {
                Logger.error(`Select from ${table} failed:`, error);
                throw error;
            }
        },

        /**
         * Get single record by ID
         */
        getById: async function (table, id) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                const { data, error } = await SupabaseClient.client
                    .from(table)
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                Logger.error(`Get from ${table} failed:`, error);
                throw error;
            }
        }
    },

    /**
     * Storage operations
     */
    storage: {
        /**
         * Upload file
         */
        upload: async function (bucket, path, file) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return null;
            }

            try {
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .upload(path, file);

                if (error) throw error;
                return data;
            } catch (error) {
                Logger.error('File upload failed:', error);
                throw error;
            }
        },

        /**
         * Download file
         */
        download: async function (bucket, path) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return null;
            }

            try {
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .download(path);

                if (error) throw error;
                return data;
            } catch (error) {
                Logger.error('File download failed:', error);
                throw error;
            }
        },

        /**
         * Get public URL
         */
        getPublicUrl: function (bucket, path) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return null;
            }

            const { data } = SupabaseClient.client.storage
                .from(bucket)
                .getPublicUrl(path);

            return data.publicUrl;
        }
    }
};

// Export to window
window.SupabaseClient = SupabaseClient;

// Auto-initialize if Supabase is available
if (typeof supabase !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SupabaseClient.init());
    } else {
        SupabaseClient.init();
    }
} else {
    Logger.warn('Supabase library not loaded. Using localStorage fallback.');
}

Logger.info('SupabaseClient module loaded');

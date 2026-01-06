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
            // Get Supabase credentials from SupabaseConfig module
            const supabaseUrl = window.SupabaseConfig?.getUrl();
            const supabaseKey = window.SupabaseConfig?.getAnonKey();

            if (!supabaseUrl || !supabaseKey) {
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
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;
                Logger.info('File uploaded:', path);
                return data;
            } catch (error) {
                Logger.error('File upload failed:', error);
                throw error;
            }
        },

        /**
         * Upload audit image
         * @param {File} file - The image file
         * @param {string} context - Context (e.g., 'client-logo', 'ncr-evidence', 'checklist')
         * @param {string} entityId - Related entity ID
         * @returns {object} { url, path } or null
         */
        uploadAuditImage: async function (file, context, entityId) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using base64 fallback');
                return null;
            }

            try {
                // Generate unique filename
                const timestamp = Date.now();
                const ext = file.name.split('.').pop().toLowerCase();
                const filename = `${context}_${entityId}_${timestamp}.${ext}`;
                const path = `${context}/${filename}`;

                // Upload to audit-images bucket
                const { data, error } = await SupabaseClient.client.storage
                    .from('audit-images')
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                // Get signed URL for the image
                const url = await this.getSignedUrl('audit-images', path);

                Logger.info('Audit image uploaded:', path);
                return { url, path };
            } catch (error) {
                Logger.error('Audit image upload failed:', error);
                return null;
            }
        },

        /**
         * Upload audit report (PDF)
         * @param {Blob|File} pdfBlob - The PDF file/blob
         * @param {string} reportType - Type of report (e.g., 'audit-report', 'ncr-report', 'certificate')
         * @param {string} clientName - Client name for filename
         * @param {string} reportId - Report ID
         * @returns {object} { url, path } or null
         */
        uploadAuditReport: async function (pdfBlob, reportType, clientName, reportId) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, report saved locally only');
                return null;
            }

            try {
                // Generate unique filename
                const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                const filename = `${reportType}_${sanitizedClientName}_${reportId}_${timestamp}.pdf`;
                const path = `${reportType}/${filename}`;

                // Upload to audit-reports bucket
                const { data, error } = await SupabaseClient.client.storage
                    .from('audit-reports')
                    .upload(path, pdfBlob, {
                        contentType: 'application/pdf',
                        cacheControl: '31536000', // 1 year cache for reports
                        upsert: true
                    });

                if (error) throw error;

                // Get signed URL for the report (long expiry for reports)
                const url = await this.getSignedUrl('audit-reports', path, 86400 * 30); // 30 days

                Logger.info('Audit report uploaded:', path);

                // Log to audit trail
                if (window.AuditLogger) {
                    AuditLogger.log('upload', 'report', reportId, {}, {
                        summary: `Uploaded ${reportType} for ${clientName}`,
                        path,
                        size: pdfBlob.size
                    });
                }

                return { url, path, filename };
            } catch (error) {
                Logger.error('Audit report upload failed:', error);
                return null;
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
        },

        /**
         * Get signed URL (for private buckets)
         */
        getSignedUrl: async function (bucket, path, expiresIn = 3600) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return null;
            }

            try {
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .createSignedUrl(path, expiresIn);

                if (error) throw error;
                return data.signedUrl;
            } catch (error) {
                Logger.error('Get signed URL failed:', error);
                return null;
            }
        },

        /**
         * Delete file
         */
        deleteFile: async function (bucket, path) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return false;
            }

            try {
                const { error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .remove([path]);

                if (error) throw error;
                Logger.info('File deleted:', path);
                return true;
            } catch (error) {
                Logger.error('File delete failed:', error);
                return false;
            }
        },

        /**
         * List files in a bucket path
         */
        listFiles: async function (bucket, folder = '') {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return [];
            }

            try {
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .list(folder);

                if (error) throw error;
                return data;
            } catch (error) {
                Logger.error('List files failed:', error);
                return [];
            }
        }
    },

    // ============================================
    // USER PROFILE SYNC METHODS
    // ============================================

    /**
     * Upsert a user profile to Supabase
     */
    async upsertUserProfile(user) {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized for user sync');
            return null;
        }

        try {
            // Generate UUID from user ID or create new one
            let userId;
            if (user.id && typeof user.id === 'string' && user.id.includes('-')) {
                // Already a UUID
                userId = user.id;
            } else {
                // Generate deterministic UUID from email
                userId = crypto.randomUUID();
            }

            const profileData = {
                id: userId,
                email: user.email,
                full_name: user.name,
                role: user.role,
                avatar_url: user.avatar || null,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('profiles')
                .upsert(profileData, { onConflict: 'email' })
                .select()
                .single();

            if (error) throw error;

            Logger.info('User profile synced:', user.email);
            return data;
        } catch (error) {
            Logger.error('Failed to upsert user profile:', error);
            throw error;
        }
    },

    /**
     * Fetch all user profiles from Supabase
     */
    async fetchUserProfiles() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return [];
        }

        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;

            Logger.info('Fetched user profiles:', data?.length || 0);
            return data || [];
        } catch (error) {
            Logger.error('Failed to fetch user profiles:', error);
            return [];
        }
    },

    /**
     * Sync all local users to Supabase
     */
    async syncUsersToSupabase(users) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        const results = { success: 0, failed: 0, errors: [] };

        for (const user of users) {
            try {
                await this.upsertUserProfile(user);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({ email: user.email, error: error.message });
            }
        }

        Logger.info(`User sync complete: ${results.success} synced, ${results.failed} failed`);
        return results;
    },

    /**
     * Pull users from Supabase and merge with local
     */
    async syncUsersFromSupabase() {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        const profiles = await this.fetchUserProfiles();

        if (!profiles.length) {
            return { added: 0, updated: 0 };
        }

        const localUsers = window.state.users || [];
        let added = 0, updated = 0;

        profiles.forEach(profile => {
            const existing = localUsers.find(u => u.email === profile.email);
            if (existing) {
                // Update existing
                existing.name = profile.full_name;
                existing.role = profile.role;
                existing.avatar = profile.avatar_url;
                updated++;
            } else {
                // Add new
                localUsers.push({
                    id: profile.id,
                    email: profile.email,
                    name: profile.full_name,
                    role: profile.role,
                    status: 'Active',
                    avatar: profile.avatar_url
                });
                added++;
            }
        });

        window.state.users = localUsers;
        window.saveData();

        Logger.info(`Synced from Supabase: ${added} added, ${updated} updated`);
        return { added, updated };
    },

    /**
     * Send password reset email via Supabase Auth
     */
    async sendPasswordResetEmail(email) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/#reset-password'
            });

            if (error) throw error;

            Logger.info('Password reset email sent to:', email);
            return true;
        } catch (error) {
            Logger.error('Failed to send password reset email:', error);
            throw error;
        }
    },

    /**
     * Sync clients to Supabase
     */
    async syncClientsToSupabase(clients) {
        if (!this.isInitialized || !clients?.length) return;

        try {
            for (const client of clients) {
                const clientData = {
                    id: client.id,
                    name: client.name,
                    standard: client.standard,
                    status: client.status,
                    type: client.type,
                    website: client.website || null,
                    employees: client.employees || 0,
                    shifts: client.shifts || 'No',
                    industry: client.industry || null,
                    contacts: client.contacts || [],
                    sites: client.sites || [],
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('clients')
                    .upsert(clientData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${clients.length} clients to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync clients:', error);
            throw error;
        }
    },

    /**
     * Sync auditors to Supabase
     */
    async syncAuditorsToSupabase(auditors) {
        if (!this.isInitialized || !auditors?.length) return;

        try {
            for (const auditor of auditors) {
                const auditorData = {
                    id: auditor.id,
                    name: auditor.name,
                    role: auditor.role,
                    email: auditor.email || null,
                    phone: auditor.phone || null,
                    location: auditor.location || null,
                    experience: auditor.experience || 0,
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('auditors')
                    .upsert(auditorData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${auditors.length} auditors to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync auditors:', error);
            throw error;
        }
    },

    /**
     * Fetch clients from Supabase and merge with local state
     */
    async syncClientsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('clients')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localClients = window.state.clients || [];
            let added = 0, updated = 0;

            data.forEach(client => {
                const existing = localClients.find(c => c.id === client.id);
                if (existing) {
                    // Update existing
                    Object.assign(existing, client);
                    updated++;
                } else {
                    // Add new
                    localClients.push(client);
                    added++;
                }
            });

            window.state.clients = localClients;
            window.saveState();
            Logger.info(`Synced clients from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch clients from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Fetch auditors from Supabase and merge with local state
     */
    async syncAuditorsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('auditors')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localAuditors = window.state.auditors || [];
            let added = 0, updated = 0;

            data.forEach(auditor => {
                const existing = localAuditors.find(a => a.id === auditor.id);
                if (existing) {
                    // Update existing
                    Object.assign(existing, auditor);
                    updated++;
                } else {
                    // Add new
                    localAuditors.push(auditor);
                    added++;
                }
            });

            window.state.auditors = localAuditors;
            window.saveState();
            Logger.info(`Synced auditors from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch auditors from Supabase:', error);
            return { added: 0, updated: 0 };
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

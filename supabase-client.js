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
    handleSignIn: async function (session) {
        const user = session.user;

        // Determine role based on email if not set in metadata
        let userRole = user.user_metadata?.role;
        let userPermissions = user.user_metadata?.permissions;

        // Check if admin email (configured in settings or user management)
        const cbEmail = window.state?.cbSettings?.cbEmail?.toLowerCase() || '';
        const adminUsers = (window.state?.users || [])
            .filter(u => u.role === 'Admin')
            .map(u => u.email?.toLowerCase());

        // Include CB email as admin if configured
        if (cbEmail) adminUsers.push(cbEmail);

        if (adminUsers.includes(user.email.toLowerCase())) {
            userRole = 'Admin';
            userPermissions = ['all'];
        } else if (!userRole) {
            // Default to Auditor if no role set
            userRole = 'Auditor';
            userPermissions = ['view_assigned'];
        }

        // Update app state with user info
        window.state.currentUser = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            role: userRole,
            permissions: userPermissions
        };

        Logger.info('User signed in:', window.state.currentUser.email, 'Initial Role:', userRole);

        // 🆕 Load user's data from Supabase (always, for cross-window sync)
        try {
            Logger.info('Loading user data from Supabase...');
            await this.loadUserDataFromCloud();
            Logger.info('User data loaded successfully from cloud');

            // Now update role from user management system
            const managedUser = window.state?.users?.find(u =>
                u.email?.toLowerCase() === window.state.currentUser.email.toLowerCase()
            );

            if (managedUser && managedUser.role) {
                window.state.currentUser.role = managedUser.role;
                window.state.currentUser.name = managedUser.name || window.state.currentUser.name;

                // Update permissions based on role
                const rolePermissions = {
                    'Admin': ['all'],
                    'Certification Manager': ['view_all', 'edit_clients', 'approve_reports', 'manage_auditors'],
                    'Lead Auditor': ['view_assigned', 'edit_reports', 'create_ncr'],
                    'Auditor': ['view_assigned']
                };
                window.state.currentUser.permissions = rolePermissions[managedUser.role] || ['view_assigned'];
                Logger.info('Role updated from user management:', managedUser.role);
            }

            // CRITICAL: Re-render dashboard to show fresh data from database
            if (window.location.hash === '#dashboard' && window.renderModule) {
                Logger.info('Re-rendering dashboard with fresh data...');
                window.renderModule('dashboard');
            }
        } catch (error) {
            Logger.warn('Failed to load cloud data, using local data:', error.message);
        }

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
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {object} metadata - User metadata (full_name, role, etc.)
     * @param {object} options - Additional signup options (emailRedirectTo, etc.)
     */
    async signUp(email, password, metadata = {}, options = {}) {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return null;
        }

        try {
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    data: metadata, // user_metadata
                    ...options // Spread additional options (emailRedirectTo, etc.)
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
     * Fluent API Proxy for Database
     * Allows: window.SupabaseClient.from('table').select()...
     */
    from(table) {
        if (!this.client) {
            Logger.error('Supabase client not initialized');
            throw new Error('Supabase not initialized');
        }
        return this.client.from(table);
    },

    /**
     * Direct Database Proxies
     * Compatibility for window.SupabaseClient.update('table', id, data)
     */
    async insert(table, data) {
        return this.db.insert(table, data);
    },

    async update(table, idOrData, data) {
        // Support both (table, id, data) and (table, {id, ...data})
        if (data === undefined && typeof idOrData === 'object') {
            const id = idOrData.id;
            return this.db.update(table, id, idOrData);
        }
        return this.db.update(table, idOrData, data);
    },

    async delete(table, id) {
        return this.db.delete(table, id);
    },

    async select(table, filters) {
        return this.db.select(table, filters);
    },

    /**
     * Load all user data from Supabase cloud
     * Called automatically on sign-in to sync data across devices
     */
    async loadUserDataFromCloud() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized, skipping cloud data load');
            return;
        }

        try {
            //  CRITICAL: Disable sync during initial data load
            // This prevents saveData() calls within sync methods from uploading to cloud
            window._dataFullyLoaded = false;

            Logger.info('Loading user data from Supabase cloud...');

            // Sync all data entities from Supabase
            const results = {
                clients: { added: 0, updated: 0 },
                auditors: { added: 0, updated: 0 },
                users: { added: 0, updated: 0 },
                settings: false,
                documents: { added: 0, updated: 0 },
                auditorAssignments: { added: 0, updated: 0 }
            };

            // 1. Load basic entities
            try { results.clients = await this.syncClientsFromSupabase(); } catch (e) {
                Logger.warn('Clients sync failed:', e);
                window.showNotification('Failed to sync clients from cloud. Using local data.', 'warning');
            }
            try { results.auditors = await this.syncAuditorsFromSupabase(); } catch (e) {
                Logger.warn('Auditors sync failed:', e);
                window.showNotification('Failed to sync auditors from cloud. Using local data.', 'warning');
            }
            try { results.users = await this.syncUsersFromSupabase(); } catch (e) {
                Logger.warn('Users sync failed:', e);
            }

            // 2. Load Settings & Knowledge Base (CRITICAL for the reported issue)
            try {
                const settingsResult = await this.syncSettingsFromSupabase();
                results.settings = settingsResult.updated;
            } catch (e) { Logger.warn('Settings sync failed:', e); }

            // 3. Load Documents (Includes Knowledge Base files)
            try { results.documents = await this.syncDocumentsFromSupabase(); } catch (e) { Logger.warn('Documents sync failed:', e); }

            // 4. Load Auditor Assignments
            try {
                results.auditorAssignments = await this.syncAuditorAssignmentsFromSupabase();
                Logger.info('Auditor assignments synced:', results.auditorAssignments);
            } catch (e) {
                Logger.warn('Auditor assignments sync failed:', e);
            }

            // 5. Load Operational data
            try { await this.syncAuditPlansFromSupabase(); } catch (e) {
                Logger.warn('Audit Plans sync failed:', e);
                window.showNotification('Failed to sync audit plans. Working offline.', 'warning');
            }
            try { await this.syncAuditReportsFromSupabase(); } catch (e) {
                Logger.warn('Audit Reports sync failed:', e);
                window.showNotification('Failed to sync audit reports. Working offline.', 'warning');
            }
            try { await this.syncChecklistsFromSupabase(); } catch (e) {
                Logger.warn('Checklists sync failed:', e);
            }
            try { await this.syncCertificationDecisionsFromSupabase(); } catch (e) {
                Logger.warn('Certification Decisions sync failed:', e);
            }

            // 6. HYDRATION: Link Certifications to Clients
            // This ensures that when we load clients, they have their certificates attached
            if (window.state.clients && window.state.certifications) {
                let hydrationCount = 0;
                window.state.clients.forEach(client => {
                    // Find certs matching this client Name or ID
                    // certification_decisions.client is usually the Client Name
                    const clientCerts = window.state.certifications.filter(c =>
                        c.client === client.name || String(c.client) === String(client.id)
                    );

                    if (clientCerts.length > 0) {
                        client.certificates = clientCerts;
                        hydrationCount++;
                    }
                });
                Logger.info(`Hydrated certificates for ${hydrationCount} clients`);
            }

            // CRITICAL: Save to localStorage directly (don't call saveData - it triggers upload!)
            localStorage.setItem('auditCB360State', JSON.stringify(window.state));

            // Mark that data is fully loaded from cloud
            window._dataFullyLoaded = true;

            Logger.info('Cloud data load complete:', results);
            return results;
        } catch (error) {
            Logger.error('Failed to load user data from cloud:', error);
            window.showNotification('Failed to connect to cloud database. Working offline.', 'error');
            throw error;
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
         * Upsert data
         */
        upsert: async function (table, data) {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized, using localStorage');
                return null;
            }

            try {
                const { data: result, error } = await SupabaseClient.client
                    .from(table)
                    .upsert(data)
                    .select();

                if (error) throw error;
                return result;
            } catch (error) {
                Logger.error(`Upsert to ${table} failed:`, error);
                throw error;
            }
        },

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
         * Upload generic file (PDF, Doc, Image)
         * @param {File|Blob} file - The file to upload
         * @param {string} bucket - Target bucket name
         * @param {string} folder - Target folder/prefix
         * @param {string} entityId - Related entity ID (optional)
         * @returns {object} { url, path, fileName } or null
         */
        uploadGenericFile: async function (file, bucket, folder, entityId = '') {
            if (!SupabaseClient.isInitialized) {
                Logger.warn('Supabase not initialized');
                return null;
            }

            try {
                // Generate unique filename
                const timestamp = Date.now();
                const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'unnamed_file';
                const prefix = entityId ? `${entityId}_` : '';
                const filename = `${prefix}${timestamp}_${cleanFileName}`;
                const path = folder ? `${folder}/${filename}` : filename;

                // Upload
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                // Get URL (use public if bucket is public, signed otherwise)
                // For now, we'll try to get a signed URL by default for security
                const url = await this.getSignedUrl(bucket, path);

                Logger.info(`File uploaded to ${bucket}:`, path);
                return { url, path, fileName: file.name || filename };
            } catch (error) {
                Logger.error('File upload failed:', error);
                return null;
            }
        },

        /**
         * Upload audit image
         * @param {File} file - The image file
         * @param {string} context - Context (e.g., 'client-logo', 'ncr-evidence', 'checklist')
         * @param {string} entityId - Related entity ID
         * @returns {object} { url, path } or null
         */
        /**
         * Upload client logo
         * @param {File} file - The image file
         * @param {string} clientId - Client ID
         * @returns {object} { url, path } or null
         */
        uploadClientLogo: async function (file, clientId) {
            if (!SupabaseClient.isInitialized) return null;

            // Use 'public' bucket if available or 'audit-images'
            // We'll use 'audit-images/client-logos'
            const bucket = 'audit-images';
            const timestamp = Date.now();
            const cleanFileName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'logo';
            const path = `client-logos/${clientId}_${timestamp}_${cleanFileName}`;

            try {
                const { data, error } = await SupabaseClient.client.storage
                    .from(bucket)
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                // Try to get Public URL first (preferred for logos)
                const { data: publicUrlData } = SupabaseClient.client.storage
                    .from(bucket)
                    .getPublicUrl(path);

                if (publicUrlData && publicUrlData.publicUrl) {
                    Logger.info('Client logo uploaded (public):', publicUrlData.publicUrl);
                    return { url: publicUrlData.publicUrl, path };
                }

                // Fallback to signed URL if public fails (though publicUrl usually returns something)
                const signedUrl = await this.getSignedUrl(bucket, path, 86400 * 365); // 1 year
                return { url: signedUrl, path };
            } catch (error) {
                Logger.error('Client logo upload failed:', error);
                return null;
            }
        },

        uploadAuditImage: async function (file, context, entityId) {
            return this.uploadGenericFile(file, 'audit-images', context, entityId);
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
     // Send password reset email via Supabase Auth
    sendPasswordResetEmail: async function (email) {
        try {
            if (!this.client) {
                throw new Error('Supabase client not initialized');
            }

            const { error } = await this.client.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#password-reset`
            });

            if (error) throw error;

            Logger.info('Password reset email sent to:', email);
            return { success: true };
        } catch (error) {
            Logger.error('Failed to send password reset email:', error);
            throw error;
        }
    },

    // Update user password (Admin function - requires Supabase Admin API or Service Role)
    // This is a workaround using password reset for now
    updateUserPassword: async function (email, newPassword) {
        try {
            if (!this.client) {
                throw new Error('Supabase client not initialized');
            }

            // Note: Updating another user's password requires Supabase Admin API
            // This implementation uses the current session to update password
            // For a production app, you'd need a backend endpoint with service role key
            
            Logger.warn('Password update for users other than current user requires backend implementation');
            
            // Check if we're updating the current user
            const { data: { user } } = await this.client.auth.getUser();
            
            if (user && user.email === email) {
                // Updating current user - this works
                const { error } = await this.client.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                Logger.info('Password updated successfully for:', email);
                return { success: true };
            } else {
                // Updating another user - send password reset instead
                Logger.info('Sending password reset email to:', email);
                return await this.sendPasswordResetEmail(email);
            }
        } catch (error) {
            Logger.error('Failed to update password:', error);
            throw error;
        }
    },

    /**
     * Upsert a single client to Supabase
     * Handles both Insert (New) and Update (Edit/Add Site/etc)
     */
    async upsertClient(client) {
        if (!this.isInitialized) return;

        try {
            const clientData = {
                id: String(client.id), // Ensure id is a string for TEXT column
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
                departments: client.departments || [],
                designations: client.designations || [],
                goods_services: client.goodsServices || [],
                key_processes: client.keyProcesses || [],
                // Derived fields if not present
                contact_person: client.contactPerson || (client.contacts?.[0]?.name) || null,
                logo_url: client.logoUrl || null,
                // Use current user ID from app state
                created_by: client.createdBy || window.state?.currentUser?.id || null,
                updated_at: new Date().toISOString()
                // data: REMOVED - might not exist, using individual columns instead
            };

            console.log('[upsertClient] Sending payload:', JSON.stringify(clientData, null, 2));

            const { data, error } = await this.client
                .from('clients')
                .upsert(clientData, { onConflict: 'id' })
                .select();

            if (error) {
                console.error('[upsertClient] Supabase Error:', error);
                throw error;
            }
            Logger.info('Client saved to Supabase:', client.name);
            return data;
        } catch (error) {
            Logger.error('Failed to save client:', error);
            throw error; // Re-throw to let caller handle it
        }
    },

    /**
     * Sync clients to Supabase
     */
    async syncClientsToSupabase(clients) {
        if (!this.isInitialized) return;

        try {
            // CRITICAL: Delete ALL clients first, then insert current list
            // Upsert won't remove deleted clients from database
            Logger.info('Replacing all clients in database...');

            // DELETED 2026-01-27: This was causing mass data loss when local state was empty or stale.
            // Using a safe upsert-only approach instead.
            // await this.client
            //     .from('clients')
            //     .delete()
            //     .gte('id', 0); // Delete all (id >= 0 matches everything)

            // Insert current clients if any
            if (clients?.length > 0) {
                const clientsData = clients.map(client => ({
                    id: String(client.id),
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
                    departments: client.departments || [],
                    designations: client.designations || [],
                    goods_services: client.goodsServices || [],
                    key_processes: client.keyProcesses || [],
                    contact_person: client.contactPerson || null,
                    next_audit: client.nextAudit || null,
                    last_audit: client.lastAudit || null,
                    updated_at: new Date().toISOString()
                }));

                const { error } = await this.client
                    .from('clients')
                    .upsert(clientsData);

                if (error) throw error;
            }

            Logger.info(`✅ Database updated: ${clients?.length || 0} clients`);
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
                    standards: auditor.standards || [],
                    expertise: auditor.domainExpertise || auditor.expertise || [],
                    industries: auditor.industries || [],
                    man_day_rate: auditor.manDayRate || 0,
                    education: auditor.education || null,
                    rating: auditor.customerRating || 0,
                    status: auditor.status || 'Active',
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
                const mappedClient = {
                    id: client.id,
                    name: client.name,
                    standard: client.standard,
                    status: client.status,
                    type: client.type,
                    website: client.website,
                    employees: client.employees,
                    shifts: client.shifts,
                    industry: client.industry,
                    contacts: client.contacts || [],
                    sites: client.sites || [],
                    departments: client.departments || [],
                    designations: client.designations || [],
                    goodsServices: client.goods_services || [],
                    keyProcesses: client.key_processes || [],
                    contactPerson: client.contact_person,
                    nextAudit: client.next_audit,
                    lastAudit: client.last_audit,
                    updatedAt: client.updated_at,
                    logoUrl: client.logo_url
                };

                const existing = localClients.find(c => String(c.id) === String(client.id));
                if (existing) {
                    // Update existing
                    Object.assign(existing, mappedClient);
                    updated++;
                } else {
                    // Add new
                    localClients.push(mappedClient);
                    added++;
                }
            });

            window.state.clients = localClients;
            window.saveState();
            Logger.info(`Synced clients from Supabase: ${added} added, ${updated} updated`);

            // CRITICAL: Refresh the client sidebar after syncing
            if (typeof window.populateClientSidebar === 'function') {
                window.populateClientSidebar();
                Logger.info('Client sidebar refreshed after sync');
            }

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
                const existing = localAuditors.find(a => String(a.id) === String(auditor.id));
                if (existing) {
                    // Update existing
                    Object.assign(existing, auditor);
                    updated++;
                } else {
                    // Add new
                    const newAuditor = {
                        id: auditor.id,
                        name: auditor.name,
                        role: auditor.role,
                        email: auditor.email,
                        phone: auditor.phone,
                        location: auditor.location,
                        experience: auditor.experience,
                        standards: auditor.standards || [],
                        domainExpertise: auditor.expertise || [],
                        industries: auditor.industries || [],
                        manDayRate: auditor.man_day_rate,
                        education: auditor.education,
                        customerRating: auditor.rating,
                        status: auditor.status
                    };
                    localAuditors.push(newAuditor);
                    added++;
                }
            });

            // Link auditors to users (to get UUID)
            const users = window.state.users || [];
            localAuditors.forEach(auditor => {
                if (auditor.email) {
                    const user = users.find(u => u.email?.toLowerCase() === auditor.email.toLowerCase());
                    if (user) {
                        auditor.userId = user.id || user.supabaseId;
                        // console.log(`Linked auditor ${auditor.name} to user ${auditor.userId}`);
                    }
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
    },

    /**
     * Sync auditor assignments to Supabase
     */
    async syncAuditorAssignmentsToSupabase(assignments) {
        if (!this.isInitialized || !assignments?.length) {
            Logger.warn('Supabase not initialized or no assignments to sync');
            return;
        }

        try {
            Logger.info(`[syncAuditorAssignmentsToSupabase] Syncing ${assignments.length} assignments...`);

            for (const assignment of assignments) {
                const data = {
                    id: assignment.id || Date.now(), // Include the ID field
                    auditor_id: String(assignment.auditorId),
                    user_id: assignment.userId || null, // Sync user_id (UUID)
                    client_id: String(assignment.clientId),
                    role: assignment.role || 'Auditor',
                    assigned_by: assignment.assignedBy || 'System',
                    assigned_at: assignment.assignedAt || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                Logger.info('[syncAuditorAssignmentsToSupabase] Upserting assignment:', data);

                const { data: result, error } = await this.client
                    .from('auditor_assignments')
                    .upsert(data, { onConflict: 'id' }); // Use id as conflict resolution

                if (error) {
                    Logger.error('[syncAuditorAssignmentsToSupabase] Upsert failed:', error);
                    throw error;
                }

                Logger.info('[syncAuditorAssignmentsToSupabase] Assignment synced successfully:', result);
            }
            Logger.info(`✓ Synced ${assignments.length} assignments to Supabase`);
        } catch (error) {
            Logger.error('[syncAuditorAssignmentsToSupabase] Failed to sync assignments:', error);
            console.error('Full error details:', error);
            throw error;
        }
    },

    /**
     * Fetch auditor assignments from Supabase
     */
    async syncAuditorAssignmentsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('auditor_assignments')
                .select('*');

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localAssignments = window.state.auditorAssignments || [];
            let added = 0, updated = 0;

            data.forEach(remote => {
                const existing = localAssignments.find(l =>
                    String(l.auditorId) === String(remote.auditor_id) && String(l.clientId) === String(remote.client_id)
                );

                const mapped = {
                    id: remote.id, // Include the ID field
                    auditorId: String(remote.auditor_id),
                    userId: remote.user_id, // Read user_id (UUID)
                    clientId: String(remote.client_id),
                    role: remote.role || 'Auditor',
                    assignedBy: remote.assigned_by,
                    assignedAt: remote.assigned_at
                };

                if (existing) {
                    Object.assign(existing, mapped);
                    updated++;
                } else {
                    localAssignments.push(mapped);
                    added++;
                }
            });

            window.state.auditorAssignments = localAssignments;
            window.saveData();
            Logger.info(`Synced assignments from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch assignments from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Delete auditor assignment
     */
    async deleteAuditorAssignment(auditorId, clientId) {
        if (!this.isInitialized) return null;

        try {
            const { error } = await this.client
                .from('auditor_assignments')
                .delete()
                .match({ auditor_id: auditorId, client_id: clientId });

            if (error) throw error;
            Logger.info(`Deleted assignment for auditor ${auditorId} and client ${clientId}`);
            return true;
        } catch (error) {
            Logger.error('Failed to delete assignment:', error);
            throw error;
        }
    },

    /**
     * Sync audit plans to Supabase
     */
    async syncAuditPlansToSupabase(auditPlans) {
        if (!this.isInitialized || !auditPlans?.length) return;

        try {
            for (const plan of auditPlans) {
                // Ensure proper types for all fields
                const auditorIds = Array.isArray(plan.auditors)
                    ? plan.auditors.map(a => String(a))
                    : [];
                const auditTeam = Array.isArray(plan.auditTeam)
                    ? plan.auditTeam.map(t => typeof t === 'object' ? String(t.id || t.name || t) : String(t))
                    : [];
                const selectedChecklists = Array.isArray(plan.selectedChecklists)
                    ? plan.selectedChecklists
                    : [];

                const planData = {
                    id: String(plan.id),
                    client_name: plan.client || plan.clientName || null,
                    client_id: plan.clientId ? String(plan.clientId) : null,
                    standard: plan.standard || null,
                    date: plan.date || null,
                    auditor_ids: auditorIds,
                    status: plan.status || 'Planned',
                    objectives: plan.objectives || null,
                    scope: plan.scope || null,
                    man_days: Number(plan.manDays) || 0,
                    selected_checklists: selectedChecklists,
                    start_date: plan.date || plan.startDate || null,
                    end_date: plan.endDate || plan.date || null,
                    lead_auditor: plan.leadAuditor || null,
                    audit_team: auditTeam,
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('audit_plans')
                    .upsert(planData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${auditPlans.length} audit plans to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync audit plans:', error);
            throw error;
        }
    },

    /**
     * Sync audit reports to Supabase
     */
    async syncAuditReportsToSupabase(auditReports) {
        if (!this.isInitialized || !auditReports?.length) return;

        try {
            for (const report of auditReports) {
                // Ensure proper types for all fields
                const ncrs = Array.isArray(report.ncrs) ? report.ncrs : [];

                const reportData = {
                    id: String(report.id),
                    client_id: report.clientId ? String(report.clientId) : null,
                    date: report.date || null,
                    status: report.status || 'Draft',
                    findings: Number(report.findings) || 0,
                    conclusion: report.conclusion || null,
                    recommendation: report.recommendation || null,
                    ncrs: ncrs,
                    audit_type: report.auditType || null,
                    lead_auditor: report.leadAuditor || null,
                    audit_plan_id: report.auditPlanId ? String(report.auditPlanId) : null,
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('audit_reports')
                    .upsert(reportData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${auditReports.length} audit reports to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync audit reports:', error);
            throw error;
        }
    },

    /**
     * Fetch audit plans from Supabase
     */
    async syncAuditPlansFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('audit_plans')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localPlans = window.state.auditPlans || [];
            let added = 0, updated = 0;

            data.forEach(plan => {
                // Map snake_case DB fields to camelCase app fields
                const fullData = plan.data || {};

                const mappedPlan = {
                    id: plan.id,
                    client: plan.client_name || plan.client,  // Map client_name to client
                    clientName: plan.client_name,
                    clientId: plan.client_id,
                    date: plan.date,
                    status: plan.status,
                    auditType: plan.audit_type,
                    standard: plan.standard,
                    scope: plan.scope,
                    objectives: plan.objectives,
                    manDays: plan.man_days,
                    auditors: plan.auditor_ids || [],  // Map auditor_ids to auditors
                    // CRITICAL: Load checklist configuration
                    checklistIds: plan.selected_checklists || fullData.checklistIds || [],
                    selectedChecklists: plan.selected_checklists || [],
                    checklistConfig: plan.checklist_config || fullData.checklistConfig || [],
                    startDate: plan.start_date,
                    endDate: plan.end_date,
                    leadAuditor: plan.lead_auditor,
                    auditTeam: plan.audit_team || [],
                    // Preserve other fields from data column
                    ...fullData,
                    // Ensure core fields use DB values
                    id: plan.id,
                    status: plan.status
                };

                const existing = localPlans.find(p => String(p.id) === String(plan.id));
                if (existing) {
                    Object.assign(existing, mappedPlan);
                    updated++;
                } else {
                    localPlans.push(mappedPlan);
                    added++;
                }
            });

            window.state.auditPlans = localPlans;
            window.saveState();
            Logger.info(`Synced audit plans from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch audit plans from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Fetch audit reports from Supabase
     */
    async syncAuditReportsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('audit_reports')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localReports = window.state.auditReports || [];
            let added = 0, updated = 0;

            data.forEach(report => {
                // Map snake_case DB fields to camelCase app fields
                // Use 'data' field as base if available (contains full report object)
                const fullData = report.data || {};

                const mappedReport = {
                    id: report.id,
                    planId: report.plan_id || report.audit_plan_id,
                    clientId: report.client_id,
                    client: report.client_name || fullData.client,  // DB uses client_name
                    date: report.date || report.audit_date,
                    status: report.status,
                    auditType: report.audit_type || report.auditType,
                    leadAuditor: report.lead_auditor || report.leadAuditor,
                    findings: report.findings || report.findings_count || 0,
                    conformities: report.conformities || 0,
                    conclusion: report.conclusion,
                    recommendation: report.recommendation,
                    // Load execution data from BOTH possible column names
                    checklistProgress: report.checklist_progress || report.checklist_data || fullData.checklistProgress || [],
                    customItems: report.custom_items || fullData.customItems || [],
                    openingMeeting: report.opening_meeting || fullData.openingMeeting || {},
                    closingMeeting: report.closing_meeting || fullData.closingMeeting || {},
                    ncrs: report.ncrs || fullData.ncrs || [],
                    // Preserve any other fields from the full data object
                    ...fullData,
                    // Ensure core fields use DB values
                    id: report.id,
                    client: report.client_name || fullData.client,
                    status: report.status
                };

                const existing = localReports.find(r => String(r.id) === String(report.id));
                if (existing) {
                    Object.assign(existing, mappedReport);
                    updated++;
                } else {
                    localReports.push(mappedReport);
                    added++;
                }
            });

            window.state.auditReports = localReports;
            Logger.info(`Synced audit reports from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch audit reports from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Sync checklists to Supabase
     */
    async syncChecklistsToSupabase(checklists) {
        if (!this.isInitialized || !checklists?.length) return;

        try {
            for (const checklist of checklists) {
                const checklistData = {
                    id: checklist.id,
                    name: checklist.name,
                    standard: checklist.standard,
                    type: checklist.type || 'global',
                    audit_type: checklist.auditType || null,
                    audit_scope: checklist.auditScope || null,
                    created_by: checklist.createdBy || null,
                    clauses: checklist.clauses || [],
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('checklists')
                    .upsert(checklistData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${checklists.length} checklists to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync checklists:', error);
            throw error;
        }
    },

    /**
     * Fetch checklists from Supabase
     */
    async syncChecklistsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('checklists')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localChecklists = window.state.checklists || [];
            let added = 0, updated = 0;

            data.forEach(checklist => {
                const existing = localChecklists.find(c => c.id === checklist.id);
                if (existing) {
                    // Update existing - map Supabase fields back to app fields
                    existing.name = checklist.name;
                    existing.standard = checklist.standard;
                    existing.type = checklist.type;
                    existing.auditType = checklist.audit_type;
                    existing.auditScope = checklist.audit_scope;
                    existing.createdBy = checklist.created_by;
                    existing.clauses = checklist.clauses;
                    updated++;
                } else {
                    // Add new - map Supabase fields to app fields
                    localChecklists.push({
                        id: checklist.id,
                        name: checklist.name,
                        standard: checklist.standard,
                        type: checklist.type,
                        auditType: checklist.audit_type,
                        auditScope: checklist.audit_scope,
                        createdBy: checklist.created_by,
                        clauses: checklist.clauses,
                        createdAt: checklist.created_at,
                        updatedAt: checklist.updated_at
                    });
                    added++;
                }
            });

            window.state.checklists = localChecklists;
            window.saveState();
            Logger.info(`Synced checklists from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch checklists from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Sync settings to Supabase
     */
    /**
     * Sync settings to Supabase
     */
    async syncSettingsToSupabase(settings) {
        if (!this.isInitialized) return;

        try {
            // Merge existing state with provided settings
            const standards = settings?.standards || window.state.settings?.standards || [];
            const roles = settings?.roles || window.state.settings?.roles || [];
            const isAdmin = settings?.isAdmin || window.state.settings?.isAdmin || false;

            // PREPARATION: Dynamically find the ID
            // We cannot hardcode '1' because the DB uses UUIDs.
            let settingsId = window.state.settingsId; // Cache ID locally

            if (!settingsId) {
                // Try to find ANY existing row
                const { data: existing } = await this.client
                    .from('settings')
                    .select('id')
                    .limit(1)
                    .maybeSingle();

                if (existing) {
                    settingsId = existing.id;
                }
                // If not found, we let the DB generate one on insert
            }

            const settingsData = {
                // If we have an ID, update it. If not, don't send ID so DB generates UUID.
                ...(settingsId ? { id: settingsId } : {}),
                standards: standards,
                roles: roles,
                is_admin: isAdmin,
                cb_settings: window.state.cbSettings || {},
                organization: window.state.orgStructure || [],
                policies: window.state.cbPolicies || {},
                knowledge_base: window.state.knowledgeBase || {},
                updated_at: new Date().toISOString()
            };

            console.log('[DEBUG] Syncing Settings to Supabase:', settingsData);

            // Use UPSERT with ID if available, otherwise INSERT
            const { data, error } = await this.client
                .from('settings')
                .upsert(settingsData)
                .select()
                .single();

            if (error) {
                console.error('[DEBUG] Supabase Settings Sync Error:', error.message);
                throw error;
            }

            // Cache the ID for next time
            if (data && data.id) {
                window.state.settingsId = data.id;
            }

            Logger.info('Synced settings to Supabase');
        } catch (error) {
            Logger.error('Failed to sync settings:', error);
            throw error;
        }
    },

    /**
     * Fetch settings from Supabase
     */
    async syncSettingsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { updated: false };
        }

        try {
            // GET SINGLETON ROW (Limit 1) regardless of ID
            const { data, error } = await this.client
                .from('settings')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Store the real ID for updates
                window.state.settingsId = data.id;

                // Update basic settings
                window.state.settings = {
                    standards: data.standards || [],
                    roles: data.roles || [],
                    isAdmin: data.is_admin || false
                };

                // Update CB Configuration
                if (data.cb_settings) window.state.cbSettings = data.cb_settings;
                if (data.organization) window.state.orgStructure = data.organization;
                if (data.policies) window.state.cbPolicies = data.policies;
                if (data.knowledge_base) window.state.knowledgeBase = data.knowledge_base;

                window.saveState();
                Logger.info('Synced settings from Supabase (Singleton)');
                return { updated: true };
            }

            return { updated: false };
        } catch (error) {
            Logger.error('Failed to fetch settings from Supabase:', error);
            return { updated: false };
        }
    },

    /**
     * Sync documents to Supabase
     */
    async syncDocumentsToSupabase(documents) {
        if (!this.isInitialized || !documents?.length) return;

        try {
            for (const doc of documents) {
                const docData = {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type || null,
                    url: doc.url || null,
                    uploaded_by: doc.uploadedBy || null,
                    uploaded_at: doc.uploadedAt || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('documents')
                    .upsert(docData, { onConflict: 'id' });
            }
            Logger.info(`Synced ${documents.length} documents to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync documents:', error);
            throw error;
        }
    },

    /**
     * Fetch documents from Supabase
     */
    async syncDocumentsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('documents')
                .select('*')
                .order('uploaded_at', { ascending: false });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            const localDocs = window.state.documents || [];
            let added = 0, updated = 0;

            data.forEach(doc => {
                const existing = localDocs.find(d => String(d.id) === String(doc.id));
                const mappedDoc = {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    url: doc.url,
                    storagePath: doc.storage_path,
                    folder: doc.folder,
                    fileSize: doc.file_size,
                    uploadedBy: doc.uploaded_by,
                    uploadedAt: doc.uploaded_at,
                    uploadDate: doc.uploaded_at ? new Date(doc.uploaded_at).toISOString().split('T')[0] : null
                };

                if (existing) {
                    Object.assign(existing, mappedDoc);
                    updated++;
                } else {
                    localDocs.push(mappedDoc);
                    added++;
                }

                // AUTO-POPULATE KNOWLEDGE BASE
                // If the document is in a KB folder, ensure it's in the KB state
                const kbFolders = ['standard', 'sop', 'policy', 'marketing'];
                if (doc.folder && kbFolders.includes(doc.folder)) {
                    if (!window.state.knowledgeBase) {
                        window.state.knowledgeBase = { standards: [], sops: [], policies: [], marketing: [] };
                    }

                    const kb = window.state.knowledgeBase;
                    let collection;
                    if (doc.folder === 'standard') collection = kb.standards;
                    else if (doc.folder === 'sop') collection = kb.sops;
                    else if (doc.folder === 'policy') collection = kb.policies;
                    else if (doc.folder === 'marketing') collection = kb.marketing;

                    if (collection) {
                        const docId = String(doc.id);
                        const inKB = collection.some(k => String(k.id) === docId || k.cloudPath === doc.storage_path);

                        if (!inKB) {
                            collection.push({
                                id: doc.id,
                                name: doc.name,
                                fileName: doc.name, // Fallback to name
                                uploadDate: mappedDoc.uploadDate,
                                status: 'pending', // Needs analysis
                                fileSize: doc.file_size,
                                cloudUrl: doc.url,
                                cloudPath: doc.storage_path,
                                clauses: []
                            });
                            Logger.info(`Auto-added document to Knowledge Base: ${doc.name}`);
                        }
                    }
                }
            });

            window.state.documents = localDocs;
            window.saveState();
            Logger.info(`Synced documents from Supabase: ${added} added, ${updated} updated`);
            return { added, updated };
        } catch (error) {
            Logger.error('Failed to fetch documents from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Sync certification decisions to Supabase
     */
    async syncCertificationDecisionsToSupabase(decisions) {
        if (!this.isInitialized || !decisions?.length) return;

        try {
            for (const decision of decisions) {
                const decisionData = {
                    client: decision.client,
                    standard: decision.standard,
                    date: decision.date,
                    decision: decision.decision,
                    updated_at: new Date().toISOString()
                };

                await this.client
                    .from('certification_decisions')
                    .upsert(decisionData, { onConflict: 'client,standard,date' });
            }
            Logger.info(`Synced ${decisions.length} certification decisions to Supabase`);
        } catch (error) {
            Logger.error('Failed to sync certification decisions:', error);
            throw error;
        }
    },

    /**
     * Fetch certification decisions from Supabase and map to Certificates
     */
    async syncCertificationDecisionsFromSupabase() {
        if (!this.isInitialized) {
            Logger.warn('Supabase not initialized');
            return { added: 0, updated: 0 };
        }

        try {
            const { data, error } = await this.client
                .from('certification_decisions')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (!data || !data.length) {
                return { added: 0, updated: 0 };
            }

            // ONE SOURCE OF TRUTH: Map these decisions to window.state.certifications
            // If they have an 'id', 'issue_date', etc, they are treated as Issued Certificates
            const localCerts = data.filter(d => d.id && d.status).map(c => ({
                id: c.id,
                client: c.client,
                standard: c.standard,
                issueDate: c.issue_date,
                expiryDate: c.expiry_date,
                status: c.status,
                scope: c.scope,
                history: c.history || [],
                decisionRecord: c.decision_record || {}
            }));

            // Also keep the raw decisions for other uses if needed
            window.state.certificationDecisions = data;

            // Overwrite local certifications with Cloud Truth
            if (localCerts.length > 0) {
                window.state.certifications = localCerts;
            }

            window.saveState();
            Logger.info(`Synced ${data.length} certification decisions (Mapped ${localCerts.length} active certs)`);
            return { added: 0, updated: data.length };
        } catch (error) {
            Logger.error('Failed to fetch certification decisions:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Upsert certificate (actually writes to certification_decisions)
     */
    async upsertCertificate(cert) {
        if (!this.isInitialized) return;

        try {
            const payload = {
                id: cert.id,
                client: cert.client,
                standard: cert.standard,
                issue_date: cert.issueDate,
                expiry_date: cert.expiryDate,
                status: cert.status,
                scope: cert.scope,
                history: cert.history,
                decision_record: cert.decisionRecord,
                // Ensure legacy fields required by constraint are present if needed
                date: cert.history?.[0]?.date || new Date().toISOString().split('T')[0],
                decision: 'Certified',
                updated_at: new Date().toISOString()
            };

            const { error } = await this.client
                .from('certification_decisions')
                .upsert(payload)
                .select();

            if (error) throw error;
            Logger.info('Certificate synced to certification_decisions:', cert.id);
        } catch (error) {
            Logger.error('Failed to sync certificate:', error);
            throw error;
        }
    },

    /**
     * Delete certificate
     */
    async deleteCertificate(certId) {
        if (!this.isInitialized) return;

        try {
            const { error } = await this.client
                .from('certification_decisions')
                .delete()
                .eq('id', certId);

            if (error) throw error;
            Logger.info('Certificate deleted from certification_decisions:', certId);
        } catch (error) {
            Logger.error('Failed to delete certificate:', error);
            throw error;
        }
    },

    /**
     * Upload file to Supabase Storage
     * @param {string} folder - Optional folder path (e.g., 'audit-reports', 'certificates')
     * @returns {Promise<{url: string, path: string}>}
     */
    async uploadFile(file, folder = 'documents') {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            // Generate unique filename
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${folder}/${timestamp}_${sanitizedName}`;

            // Upload file to storage bucket
            const { data, error } = await this.client.storage
                .from('documents') // Using existing bucket (lowercase)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.client.storage
                .from('documents')
                .getPublicUrl(filePath);

            Logger.info('File uploaded successfully:', filePath);

            return {
                path: data.path,
                url: urlData.publicUrl,
                name: file.name,
                size: file.size,
                type: file.type
            };
        } catch (error) {
            Logger.error('Failed to upload file:', error);
            throw error;
        }
    },

    /**
     * Download file from Supabase Storage
     * @param {string} filePath - Path to the file in storage
     * @returns {Promise<Blob>}
     */
    async downloadFile(filePath) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data, error } = await this.client.storage
                .from('Documents')
                .download(filePath);

            if (error) throw error;

            Logger.info('File downloaded successfully:', filePath);
            return data;
        } catch (error) {
            Logger.error('Failed to download file:', error);
            throw error;
        }
    },

    /**
     * Delete file from Supabase Storage
     * @param {string} filePath - Path to the file in storage
     */
    async deleteFile(filePath) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { error } = await this.client.storage
                .from('Documents')
                .remove([filePath]);

            if (error) throw error;

            Logger.info('File deleted successfully:', filePath);
            return true;
        } catch (error) {
            Logger.error('Failed to delete file:', error);
            throw error;
        }
    },

    /**
     * List files in a folder
     * @param {string} folder - Folder path
     * @returns {Promise<Array>}
     */
    async listFiles(folder = '') {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data, error } = await this.client.storage
                .from('Documents')
                .list(folder, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            Logger.info(`Listed ${data.length} files in folder: ${folder}`);
            return data;
        } catch (error) {
            Logger.error('Failed to list files:', error);
            throw error;
        }
    },

    /**
     * Upload document and save metadata
     * @param {File} file - The file to upload
     * @param {Object} metadata - Additional metadata (name, type, etc.)
     * @returns {Promise<Object>}
     */
    async uploadDocument(file, metadata = {}) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            // Upload file to storage
            const uploadResult = await this.uploadFile(file, metadata.folder || 'documents');

            // Save document metadata to database
            const docData = {
                id: Date.now(), // Simple ID generation
                name: metadata.name || file.name,
                type: file.type,
                url: uploadResult.url,
                storage_path: uploadResult.path,
                file_size: file.size,
                uploaded_by: metadata.uploadedBy || window.state?.currentUser?.email || 'Unknown',
                uploaded_at: new Date().toISOString(),
                folder: metadata.folder || 'documents',
                description: metadata.description || null
            };

            const { data, error } = await this.client
                .from('documents')
                .insert(docData)
                .select()
                .single();

            if (error) throw error;

            // Add to local state
            if (!window.state.documents) window.state.documents = [];
            window.state.documents.push({
                id: data.id,
                name: data.name,
                type: data.type,
                url: data.url,
                storagePath: data.storage_path,
                fileSize: data.file_size,
                uploadedBy: data.uploaded_by,
                uploadedAt: data.uploaded_at,
                folder: data.folder,
                description: data.description
            });
            window.saveState();

            Logger.info('Document uploaded and saved:', data.name);
            return data;
        } catch (error) {
            Logger.error('Failed to upload document:', error);
            throw error;
        }
    },

    /**
     * Delete document and its file
     * @param {number} documentId - Document ID
     */
    async deleteDocument(documentId) {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized');
        }

        try {
            // Get document metadata
            const { data: doc, error: fetchError } = await this.client
                .from('documents')
                .select('storage_path')
                .eq('id', documentId)
                .single();

            if (fetchError) throw fetchError;

            // Delete file from storage
            if (doc.storage_path) {
                await this.deleteFile(doc.storage_path);
            }

            // Delete document metadata
            const { error: deleteError } = await this.client
                .from('documents')
                .delete()
                .eq('id', documentId);

            if (deleteError) throw deleteError;

            // Remove from local state
            if (window.state.documents) {
                window.state.documents = window.state.documents.filter(d => d.id !== documentId);
                window.saveState();
            }

            Logger.info('Document deleted:', documentId);
            return true;
        } catch (error) {
            Logger.error('Failed to delete document:', error);
            throw error;
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

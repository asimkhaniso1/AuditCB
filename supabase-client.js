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
    },

    /**
     * Sync audit plans to Supabase
     */
    async syncAuditPlansToSupabase(auditPlans) {
        if (!this.isInitialized || !auditPlans?.length) return;

        try {
            for (const plan of auditPlans) {
                const planData = {
                    id: plan.id,
                    client: plan.client,
                    standard: plan.standard,
                    date: plan.date,
                    cost: plan.cost || 0,
                    auditors: plan.auditors || [],
                    status: plan.status || 'Planned',
                    objectives: plan.objectives || null,
                    scope: plan.scope || null,
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
                const reportData = {
                    id: report.id,
                    client: report.client,
                    date: report.date,
                    status: report.status || 'Draft',
                    findings: report.findings || 0,
                    conclusion: report.conclusion || null,
                    recommendation: report.recommendation || null,
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
                const existing = localPlans.find(p => p.id === plan.id);
                if (existing) {
                    Object.assign(existing, plan);
                    updated++;
                } else {
                    localPlans.push(plan);
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
                const existing = localReports.find(r => r.id === report.id);
                if (existing) {
                    Object.assign(existing, report);
                    updated++;
                } else {
                    localReports.push(report);
                    added++;
                }
            });

            window.state.auditReports = localReports;
            window.saveState();
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
    async syncSettingsToSupabase(settings) {
        if (!this.isInitialized || !settings) return;

        try {
            const settingsData = {
                id: 1, // Single settings record
                standards: settings.standards || [],
                roles: settings.roles || [],
                is_admin: settings.isAdmin || false,
                updated_at: new Date().toISOString()
            };

            await this.client
                .from('settings')
                .upsert(settingsData, { onConflict: 'id' });

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
            const { data, error } = await this.client
                .from('settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error

            if (data) {
                window.state.settings = {
                    standards: data.standards || [],
                    roles: data.roles || [],
                    isAdmin: data.is_admin || false
                };
                window.saveState();
                Logger.info('Synced settings from Supabase');
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
                const existing = localDocs.find(d => d.id === doc.id);
                if (existing) {
                    Object.assign(existing, {
                        name: doc.name,
                        type: doc.type,
                        url: doc.url,
                        uploadedBy: doc.uploaded_by,
                        uploadedAt: doc.uploaded_at
                    });
                    updated++;
                } else {
                    localDocs.push({
                        id: doc.id,
                        name: doc.name,
                        type: doc.type,
                        url: doc.url,
                        uploadedBy: doc.uploaded_by,
                        uploadedAt: doc.uploaded_at
                    });
                    added++;
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
     * Fetch certification decisions from Supabase
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

            window.state.certificationDecisions = data;
            window.saveState();
            Logger.info(`Synced ${data.length} certification decisions from Supabase`);
            return { added: 0, updated: data.length };
        } catch (error) {
            Logger.error('Failed to fetch certification decisions from Supabase:', error);
            return { added: 0, updated: 0 };
        }
    },

    /**
     * Upload file to Supabase Storage
     * @param {File} file - The file to upload
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
                .from('audit-files') // Bucket name
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.client.storage
                .from('audit-files')
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
                .from('audit-files')
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
                .from('audit-files')
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
                .from('audit-files')
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

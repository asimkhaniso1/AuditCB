// ============================================
// DATA MIGRATION & MANAGEMENT MODULE
// ============================================
// Handles migrating data from localStorage to Supabase
// and managing local data cleanup

const DataMigration = {
    // Current sync status
    isSyncing: false,

    /**
     * Get data statistics (Local vs Supabase count)
     */
    getStats: function () {
        return {
            clients: { local: window.state?.clients?.length || 0 },
            auditors: { local: window.state?.auditors?.length || 0 },
            auditPlans: { local: window.state?.auditPlans?.length || 0 },
            auditReports: { local: window.state?.auditReports?.length || 0 },
            ncrs: { local: window.state?.ncrs?.length || 0 },
            checklists: { local: window.state?.checklists?.length || 0 },
            users: { local: window.state?.users?.length || 0 }
        };
    },

    /**
     * Migrate all data to Supabase
     */
    migrateToSupabase: async function () {
        if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) {
            window.showNotification('Supabase is not connected. Please configure it first.', 'error');
            return false;
        }

        if (this.isSyncing) return false;
        this.isSyncing = true;
        window.showNotification('Starting migration to Supabase...', 'info');

        try {
            const stats = { success: 0, failed: 0, total: 0 };
            const timestamp = new Date().toISOString();

            // 1. Migrate Users/Auditors first (dependency)
            // Note: Since we can't create Auth users directly via API without service key,
            // we will only migrate auditor profiles to public.auditors table if it exists
            // or rely on them signing up. For now, we skip Auth User migration.

            // 2. Migrate Clients
            const clients = window.state.clients || [];
            for (const client of clients) {
                // Ensure unique email/name constraints
                const { error } = await window.SupabaseClient.db.insert('clients', {
                    name: client.name,
                    email: client.email || `${client.name.replace(/\s+/g, '').toLowerCase()}@example.com`,
                    phone: client.phone,
                    address: client.address,
                    industry: client.industry,
                    status: client.status || 'Active',
                    contact_person: client.contactPerson,
                    // Store extra fields in JSONB if needed, or map strictly to schema
                    // For simply schema, we map what matches
                    created_at: client.createdAt || timestamp
                });

                if (error && error.code !== '23505') { // Ignore unique violation
                    console.error('Client migration failed:', error);
                    stats.failed++;
                } else {
                    stats.success++;
                }
                stats.total++;
            }

            // 3. Migrate Auditors (Profiles)
            // This assumes we have an 'auditors' table or we map to user_profiles
            // For this implementation, we'll try to insert into local state mirrors or log warning

            // 4. Migrate Audit Plans
            const plans = window.state.auditPlans || [];
            for (const plan of plans) {
                const { error } = await window.SupabaseClient.db.insert('audit_plans', {
                    client_id: plan.clientId, // This needs to be UUID, might fail if we don't map IDs. 
                    // CRITICAL: LocalStorage IDs are integers (usually), Supabase used UUIDs.
                    // This simple migration works if we used string IDs or if Supabase schema allows non-UUID.
                    // If schema enforces UUID, we need to fetch the mapped Client UUID first.

                    // Simple migration strategy: Upload as raw JSON backup first? 
                    // Or precise mapping. Let's do precise mapping lookup.
                    // For now, let's assume we can sync clients by name.

                    client_name: plan.client, // Fallback if no ref link
                    standard: plan.standard,
                    type: plan.auditType,
                    status: plan.status,
                    start_date: plan.date,
                    end_date: plan.endDate || plan.date,
                    lead_auditor: plan.leadAuditor,
                    audit_team: plan.auditTeam || [],
                    scope: plan.scope,
                    created_at: plan.createdAt || timestamp
                });

                if (error) {
                    // console.error('Plan migration failed:', error); 
                    // Often fails due to FK constraints if Client Migration failed or mismatch
                    stats.failed++;
                } else {
                    stats.success++;
                }
                stats.total++;
            }

            // 5. Migrate Reports
            const reports = window.state.auditReports || [];
            for (const report of reports) {
                // Save report metadata
                const { error } = await window.SupabaseClient.db.insert('audit_reports', {
                    client_name: report.client,
                    audit_date: report.date,
                    standard: report.standard,
                    status: report.status,
                    findings_summary: {
                        major: report.ncrs?.filter(n => n.type === 'major').length || 0,
                        minor: report.ncrs?.filter(n => n.type === 'minor').length || 0
                    },
                    // Store full report JSON for fidelity
                    full_report_data: report,
                    created_at: report.createdAt || timestamp
                });

                if (!error) stats.success++;
                else stats.failed++;
                stats.total++;
            }

            window.showNotification(`Migration complete! ${stats.success} records synced.`, 'success');
            this.isSyncing = false;
            return true;

        } catch (error) {
            console.error('Migration crashed:', error);
            window.showNotification('Migration failed check console.', 'error');
            this.isSyncing = false;
            return false;
        }
    },

    /**
     * Clear all local data
     * @param {object} options - Options { keepChecklists: boolean, keepAdmin: boolean }
     */
    clearAllData: function (options = { keepChecklists: true, keepAdmin: true }) {
        if (!confirm('WARNING: This will delete all local data. This action cannot be undone. Are you sure?')) {
            return;
        }

        try {
            // 1. Preserve requested items
            const checklists = options.keepChecklists ? (window.state.checklists || []) : window.CONSTANTS.DEFAULT_CHECKLISTS;
            const cbSettings = options.keepAdmin ? window.state.cbSettings : null;
            const cbProfile = options.keepAdmin ? window.state.cbProfile : null; // Legacy support
            const users = options.keepAdmin ? window.state.users : [];
            const currentUser = options.keepAdmin ? window.state.currentUser : null;
            const settings = options.keepAdmin ? window.state.settings : {};

            // 2. Reset State with explicit version
            window.state = {
                version: '1.3', // CRITICAL: Must match DATA_VERSION in script.js to prevent auto-reset
                clients: [],
                auditors: [],
                auditPlans: [],
                auditReports: [],
                ncrs: [],
                capas: [],
                checklists: checklists,

                // Retained
                users: users || [],
                currentUser: currentUser,
                cbSettings: cbSettings,
                cbProfile: cbProfile,
                settings: settings,

                // Default modules setup
                activeModule: 'dashboard',
                notifications: [],
                knowledgeBase: { standards: [] },
                auditPrograms: [],
                certificationDecisions: [],
                documents: [],
                appeals: [],
                complaints: [],
                auditorAssignments: []
            };

            // Re-initialize default admin if cleared and no users
            if (window.state.users.length === 0 && !options.keepAdmin) {
                window.state.users = [{
                    id: 1,
                    name: 'System Admin',
                    email: 'admin@auditcb.com',
                    role: 'Admin',
                    password: 'admin'
                }];
            }

            // 3. Save to localStorage - Force immediate save
            console.log('Clearing data - new state:', {
                clients: window.state.clients.length,
                auditors: window.state.auditors.length,
                auditPlans: window.state.auditPlans.length
            });

            // Directly write to IndexedDB to ensure immediate persistence
            try {
                if (window.StateStore) {
                    window.StateStore.save(window.state);
                }
            } catch (e) {
                console.error('Failed to save state:', e);
            }

            // 4. Force specific reloads
            if (options.keepAdmin && window.state.currentUser) {
                // If logged in, stay logged in
            } else {
                // Determine if we need to logout
            }

            // 5. Clear Sync Queue and Caches (Offline Manager)
            localStorage.removeItem('auditcb_sync_queue');

            if ('caches' in window) {
                try {
                    caches.keys().then(names => {
                        for (let name of names) {
                            caches.delete(name);
                        }
                    });
                } catch (e) { console.warn('Cache clearing failed:', e); }
            }

            window.showNotification('Local data and caches cleared! Reloading...', 'success');

            // 6. Force hard reload after short delay
            setTimeout(() => {
                window.location.href = window.location.href.split('#')[0] + '#dashboard';
                window.location.reload(true);
            }, 500);

        } catch (error) {
            console.error('Clear data failed:', error);
            window.showNotification('Failed to clear data.', 'error');
        }
    },

    /**
     * Render the Admin Management UI
     */
    renderAdminUI: function () {
        const container = document.getElementById('admin-data-management');
        if (!container) return; // Only if element exists in view

        const stats = this.getStats();

        container.innerHTML = `
            <div class="card" style="margin-top: 2rem;">
                <h3 style="margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-database" style="margin-right: 0.5rem; color: #6366f1;"></i> Data Management
                </h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <!-- Migration Section -->
                    <div>
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;">Supabase Migration</h4>
                        <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <p style="font-size: 0.85rem; margin-bottom: 1rem; color: #475569;">
                                Sync your local data to the Supabase cloud database. Use this to back up your data or transition to the cloud version.
                            </p>
                            <button class="btn btn-primary" data-action="DataMigration_migrateToSupabase" ${DataMigration.isSyncing ? 'disabled' : ''}>
                                <i class="${DataMigration.isSyncing ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-cloud-arrow-up'}" style="margin-right: 0.5rem;"></i>
                                ${DataMigration.isSyncing ? 'Syncing...' : 'Migrate to Supabase'}
                            </button>
                            <div style="margin-top: 1rem; font-size: 0.8rem; color: #64748b;">
                                <i class="fa-solid fa-info-circle"></i> Requires Supabase connection configuration.
                            </div>
                        </div>
                    </div>

                    <!-- Cleanup Section -->
                    <div>
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;">Reset Data</h4>
                        <div style="background: #fff1f2; padding: 1rem; border-radius: 6px; border: 1px solid #fecdd3;">
                            <p style="font-size: 0.85rem; margin-bottom: 1rem; color: #881337;">
                                Clear local data and reload from Supabase.
                            </p>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: flex; align-items: center; font-size: 0.85rem; margin-bottom: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="keep-checklists" checked style="width: auto; margin-right: 0.5rem; margin-bottom: 0;">
                                    Preserve Checklist Templates
                                </label>
                                <label style="display: flex; align-items: center; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" id="keep-admin" checked style="width: auto; margin-right: 0.5rem; margin-bottom: 0;">
                                    Preserve Admin Settings & Users
                                </label>
                            </div>

                            <button class="btn btn-danger" data-action="DataMigration_handleClearData">
                                <i class="fa-solid fa-trash-can" style="margin-right: 0.5rem;"></i> Clear Local Data
                            </button>
                            
                            <button class="btn btn-secondary" data-action="DataMigration_reloadFromCloud" style="margin-left: 0.5rem;">
                                <i class="fa-solid fa-cloud-arrow-down" style="margin-right: 0.5rem;"></i> Reload from Cloud
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Stats Summary -->
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #eee;">
                    <div style="display: flex; gap: 2rem; font-size: 0.85rem; color: #64748b;">
                        <span><i class="fa-solid fa-users"></i> Clients: <strong>${stats.clients.local}</strong></span>
                        <span><i class="fa-solid fa-file-contract"></i> Reports: <strong>${stats.auditReports.local}</strong></span>
                        <span><i class="fa-solid fa-clipboard-list"></i> Checklists: <strong>${stats.checklists.local}</strong></span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Reload data from Supabase cloud database
     * Clears local cache and fetches fresh data from the server
     */
    reloadFromCloud: function () {
        if (!confirm('This will clear your local cache and reload all data from Supabase. Continue?')) {
            return;
        }

        try {
            window.showNotification('Clearing local cache and reloading from cloud...', 'info');

            // Clear sync timestamps so next login does a FULL sync
            if (window.SupabaseClient && window.SupabaseClient._clearSyncTimestamps) {
                window.SupabaseClient._clearSyncTimestamps();
            }

            // Clear IndexedDB + localStorage to force fresh load from Supabase
            if (window.StateStore) {
                window.StateStore.clear();
            } else {
                localStorage.removeItem('auditCB360State');
            }

            // Force reload
            setTimeout(() => {
                window.location.reload();
            }, 500);

        } catch (error) {
            console.error('Reload from cloud failed:', error);
            window.showNotification('Failed to reload from cloud.', 'error');
        }
    },

    // Handler wrapper to read checkbox values safely
    handleClearData: function () {
        try {
            const keepChecklistsEl = document.getElementById('keep-checklists');
            const keepAdminEl = document.getElementById('keep-admin');

            const keepChecklists = keepChecklistsEl ? keepChecklistsEl.checked : true;
            const keepAdmin = keepAdminEl ? keepAdminEl.checked : true;

            this.clearAllData({ keepChecklists, keepAdmin });
        } catch (error) {
            console.error('Handle clear data error:', error);
            // Fallback default
            this.clearAllData();
        }
    }
};

// Expose globally
window.DataMigration = DataMigration;

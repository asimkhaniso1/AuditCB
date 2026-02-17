// ============================================
// AUDITCB360 - MAIN APPLICATION SCRIPT
// ============================================

const DATA_VERSION = '1.4'; // Increment to force state reset

// 🔍 VERSION CHECK - Verify code deployment
console.log('%c🚀 AuditCB360 Loaded', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('Version:', DATA_VERSION, '| Demo Data Removed: 2026-01-10 18:32 UTC');
if (typeof window !== 'undefined') {
    window.AUDITCB_VERSION = '2026-01-10-NO-DEMO-DATA';
}

// Application State
const state = {
    version: DATA_VERSION,
    // Current User Context (Populated after authentication)
    currentUser: null,
    currentModule: 'dashboard',
    // Data loads from Supabase database after authentication
    clients: [],
    auditors: [],
    auditPrograms: [],
    auditPlans: [],
    auditReports: [],
    certificationDecisions: [],
    documents: [],
    checklists: [],
    // ISO 17021-1 Compliance: Appeals & Complaints Register
    appeals: [],
    complaints: [],
    settings: {
        standards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'],
        roles: ['Lead Auditor', 'Auditor', 'Technical Expert'],
        isAdmin: true  // Toggle for admin privileges (simulated)
    },
    // Auditor-Client Assignments for role-based filtering
    auditorAssignments: []
};

// Global Exports for Modules
window.state = state;
// State initialized successfully
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;

// ============================================
// ROLE-BASED FILTERING UTILITIES
// ============================================
// Auditors only see assigned clients/plans/reports
// Cert Managers and Admins see everything

/**
 * Get clients visible to the current user based on role and assignments
 * @returns {Array} Filtered client array
 */
function getVisibleClients() {
    const user = window.state.currentUser;
    const allClients = window.state.clients || [];

    if (!user) return allClients; // No user = show all (demo mode)

    // Roles that see ALL clients (management roles)
    // defined in lowercase for case-insensitive comparison
    const fullAccessRoles = ['admin', 'certification manager', 'super admin'];

    // Roles that only see ASSIGNED clients (auditor roles)
    const filteredRoles = ['lead auditor', 'auditor', 'technical expert'];

    const userRole = (user.role || '').toLowerCase();

    // CRITICAL FIX: Force Admin access for main account regardless of role sync status
    if (user.email === 'info@companycertification.com' || userRole === 'admin' || fullAccessRoles.includes(userRole)) {
        return allClients;
    }

    // Auditors (Lead Auditor, Auditor, Technical Expert) see only assigned clients
    if (filteredRoles.includes(userRole)) {
        // Get assignments for this user (using user ID directly)
        const assignments = window.state.auditorAssignments || [];
        const assignedClientIds = assignments
            .filter(a => String(a.auditorId) === String(user.id))
            .map(a => String(a.clientId));

        // If no assignments, return empty array (no clients visible)
        if (assignedClientIds.length === 0) {
            console.info(`User ${user.name} (${user.role}) has no client assignments`);
            return [];
        }

        // Filter clients based on assignments
        return allClients.filter(client => assignedClientIds.includes(String(client.id)));
    }

    // Client Role sees ONLY their own organization
    if (user.role === 'Client') {
        // In a real app, user would be linked to client ID.
        // For demo, we match by name or assume single client context if implemented?
        // Simplistic check: if user.name matches client name or contact
        return allClients.filter(c => c.name === user.name || c.contacts.some(contact => contact.email === user.email));
    }

    return []; // Default: no access
}

/**
 * Get audit plans visible to the current user
 * Plans are visible if:
 * 1. Client is currently assigned to the auditor, OR
 * 2. Auditor was on the audit team (historical records retained)
 * @returns {Array} Filtered audit plans
 */
function getVisiblePlans() {
    const user = window.state.currentUser;
    const allPlans = window.state.auditPlans || [];

    if (!user) return allPlans;

    // Admin and Cert Manager see all
    if (user.role === 'Admin' || user.role === 'Certification Manager') {
        return allPlans;
    }

    // Find auditor profile for the current user
    const auditor = window.state.auditors.find(a =>
        String(a.email || '').toLowerCase() === String(user.email || '').toLowerCase() ||
        String(a.name || '').toLowerCase() === String(user.name || '').toLowerCase()
    );

    // Get visible client IDs for current assignments
    const visibleClients = getVisibleClients();
    const visibleClientIds = visibleClients.map(c => String(c.id));

    return allPlans.filter(p => {
        // Show if client is currently assigned
        if (p.clientId && visibleClientIds.includes(String(p.clientId))) return true;

        // Fallback to name if clientId missing (for legacy data)
        const visibleClientNames = visibleClients.map(c => c.name);
        if (visibleClientNames.includes(p.client)) return true;

        // Also show if auditor was on the team (historical records)
        if (auditor && p.team && Array.isArray(p.team)) {
            if (p.team.includes(auditor.name)) return true;
        }
        if (auditor && p.auditors && Array.isArray(p.auditors)) {
            if (p.auditors.map(id => String(id)).includes(String(auditor.id))) return true;
        }

        return false;
    });
}

/**
 * Get audit reports visible to the current user
 * Reports are visible if:
 * 1. Client is currently assigned to the auditor, OR
 * 2. Auditor was part of the audit (historical records retained)
 * @returns {Array} Filtered audit reports
 */
function getVisibleReports() {
    const user = window.state.currentUser;
    const allReports = window.state.auditReports || [];

    if (!user) return allReports;

    // Admin and Cert Manager see all
    if (user.role === 'Admin' || user.role === 'Certification Manager') {
        return allReports;
    }

    // Find auditor profile for the current user
    const auditor = window.state.auditors.find(a =>
        String(a.email || '').toLowerCase() === String(user.email || '').toLowerCase() ||
        String(a.name || '').toLowerCase() === String(user.name || '').toLowerCase()
    );

    // Get visible client IDs for current assignments
    const visibleClients = getVisibleClients();
    const visibleClientIds = visibleClients.map(c => String(c.id));

    // Get visible plans to check team membership
    const allPlans = window.state.auditPlans || [];

    return allReports.filter(r => {
        // Show if client is currently assigned
        if (r.clientId && visibleClientIds.includes(String(r.clientId))) return true;

        // Fallback to name if clientId missing
        const visibleClientNames = visibleClients.map(c => c.name);
        if (visibleClientNames.includes(r.client)) return true;

        // Also show if auditor was on the plan's team (historical records)
        if (auditor && r.planId) {
            const plan = allPlans.find(p => String(p.id) === String(r.planId));
            if (plan) {
                if (plan.team && Array.isArray(plan.team) && plan.team.includes(auditor.name)) return true;
                if (plan.auditors && Array.isArray(plan.auditors) && plan.auditors.map(id => String(id)).includes(String(auditor.id))) return true;
            }
        }

        // Check if auditor created or is assigned to the report
        if (auditor && r.leadAuditor === auditor.name) return true;

        return false;
    });
}

// Export filter utilities globally
window.getVisibleClients = getVisibleClients;
window.getVisiblePlans = getVisiblePlans;
window.getVisibleReports = getVisibleReports;

// Global Error Handling
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
    if (window.showNotification) {
        window.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    if (window.showNotification) {
        window.showNotification('Operation failed. Check console for details.', 'error');
    }
});

// State Management with Performance Optimizations
let saveTimeout;
let lastSaveSize = 0;

function saveState() {
    // Debounce saves to prevent excessive localStorage writes
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const stateJSON = JSON.stringify(state);
            const sizeInMB = new Blob([stateJSON]).size / 1024 / 1024;
            lastSaveSize = sizeInMB;

            // Check storage quota (warn at 4.5MB, 90% of typical 5MB limit)
            if (sizeInMB > 4.5) {
                console.warn(`Storage usage high: ${sizeInMB.toFixed(2)}MB / 5MB`);
                window.showNotification(
                    `Storage usage: ${sizeInMB.toFixed(2)}MB. Consider exporting old data.`,
                    'warning'
                );
            }

            localStorage.setItem('auditCB360State', stateJSON);

            // DISABLED 2026-01-12: Auto-sync causes DELETE ALL + INSERT ALL on every save
            // This was the root cause of "deleted data reappearing" bug
            // Direct database operations (per-record insert/update/delete) are used instead
            /*
            if (window.SupabaseClient?.isInitialized && state.currentUser) {
                try {
                    // Sync all data types to Supabase (non-blocking)
                    window.SupabaseClient.syncUsersToSupabase(state.users || [])
                        .catch(e => console.warn('User sync failed:', e));

                    window.SupabaseClient.syncClientsToSupabase(state.clients || [])
                        .catch(e => console.warn('Client sync failed:', e));

                    window.SupabaseClient.syncAuditorsToSupabase(state.auditors || [])
                        .catch(e => console.warn('Auditor sync failed:', e));

                    window.SupabaseClient.syncAuditPlansToSupabase(state.auditPlans || [])
                        .catch(e => console.warn('Audit plan sync failed:', e));

                    window.SupabaseClient.syncAuditReportsToSupabase(state.auditReports || [])
                        .catch(e => console.warn('Audit report sync failed:', e));

                    window.SupabaseClient.syncChecklistsToSupabase(state.checklists || [])
                        .catch(e => console.warn('Checklist sync failed:', e));

                    // NOTE: Settings sync is intentionally NOT automatic
                    // Settings should only sync when user explicitly clicks Save in Settings UI
                    // This prevents default values from overwriting user's saved data
                    // window.SupabaseClient.syncSettingsToSupabase(state.settings)
                    //     .catch(e => console.warn('Settings sync failed:', e));

                    window.SupabaseClient.syncDocumentsToSupabase(state.documents || [])
                        .catch(e => console.warn('Document sync failed:', e));

                    window.SupabaseClient.syncCertificationDecisionsToSupabase(state.certificationDecisions || [])
                        .catch(e => console.warn('Certification decision sync failed:', e));
                } catch (syncError) {
                    console.warn('Supabase sync error:', syncError);
                }
            }
            */
        } catch (e) {
            console.error('Save failed:', e);
            if (e.name === 'QuotaExceededError') {
                window.showNotification(
                    'Storage limit exceeded! Please export and clear old data.',
                    'error'
                );
            } else {
                console.warn('LocalStorage not available:', e);
            }
        }
    }, 500); // Wait 500ms before saving
}

// Get current storage usage
function getStorageStats() {
    return {
        sizeMB: lastSaveSize,
        percent: (lastSaveSize / 5) * 100,
        itemCount: {
            clients: state.clients?.length || 0,
            auditors: state.auditors?.length || 0,
            auditPlans: state.auditPlans?.length || 0,
            auditReports: state.auditReports?.length || 0,
            checklists: state.checklists?.length || 0
        }
    };
}

window.getStorageStats = getStorageStats;

function loadState() {
    try {
        const saved = localStorage.getItem('auditCB360State');
        if (saved) {
            const data = JSON.parse(saved);
            // Check version compatibility
            if (data.version === DATA_VERSION) {
                Object.assign(state, data);

                // SAFETY: Ensure currentUser is initialized from authentication
                if (!state.currentUser) {
                    // No saved user - require authentication
                    window.Logger.warn('Core', 'No authenticated user found. Login required.');
                    state.currentUser = null;
                }
            } else {
                window.Logger.warn('Core', `Version mismatch (Store: ${data.version}, App: ${DATA_VERSION}). Resetting to defaults.`);
                // Do not load saved data, keep strictly default mock data
                // We'll save the new default state naturally on next edit
            }
        }

        // Migrate checklists to hierarchical format if needed
        migrateChecklistsToHierarchy();
    } catch (e) {
        console.warn('LocalStorage not available:', e);
    }
}

// Migrate old flat checklists to hierarchical format (no default injection)
function migrateChecklistsToHierarchy() {
    if (!state.checklists || state.checklists.length === 0) {
        return; // No checklists to migrate
    }

    let needsUpdate = false;

    state.checklists = state.checklists.map(checklist => {
        // If already hierarchical, keep it
        if (checklist.clauses && checklist.clauses.length > 0) {
            return checklist;
        }

        // For custom checklists with flat items, convert to simple hierarchy
        if (checklist.items && checklist.items.length > 0 && !checklist.clauses) {
            needsUpdate = true;
            const clauseGroups = {};

            checklist.items.forEach(item => {
                const mainNum = (item.clause || '').split('.')[0] || 'General';
                if (!clauseGroups[mainNum]) {
                    clauseGroups[mainNum] = {
                        mainClause: mainNum,
                        title: mainNum === 'General' ? 'General Requirements' : `Clause ${mainNum}`,
                        subClauses: []
                    };
                }
                clauseGroups[mainNum].subClauses.push({
                    clause: item.clause || '',
                    requirement: item.requirement || ''
                });
            });

            return {
                ...checklist,
                clauses: Object.values(clauseGroups)
            };
        }

        return checklist;
    });

    if (needsUpdate) {
        saveState();
        window.Logger.info('Core', 'Checklists migrated to hierarchical format');
    }
}



loadState();

// Helper functions (Safe ID Generation)
function getNextId(collection) {
    if (!state[collection]) return 1;
    const items = state[collection];
    return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
}

function addRecord(collection, data) {
    const newRecord = { id: getNextId(collection), ...data };
    state[collection].push(newRecord);
    saveState();
    return newRecord;
}

function updateRecord(collection, id, data) {
    const index = state[collection].findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
        state[collection][index] = { ...state[collection][index], ...data };
        saveState();
        return state[collection][index];
    }
    return null;
}

function deleteRecord(collection, id) {
    const index = state[collection].findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
        state[collection].splice(index, 1);
        saveState();
        return true;
    }
    return false;
}

// DOM Elements
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
// Capture global sidebar content early to ensure it can be restored
const navListElement = document.querySelector('.main-nav ul');
const globalSidebarHTML = navListElement ? navListElement.innerHTML : '';

// Export important items to window for modules to access
window.state = state;
window.contentArea = contentArea;
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;
window.globalSidebarHTML = globalSidebarHTML;

// Navigation Handler (using delegation at document level for maximum robustness)
document.addEventListener('click', (e) => {
    const item = e.target.closest('li[data-module]');
    if (item) {
        const moduleName = item.getAttribute('data-module');
        if (moduleName === 'dashboard') {
            // Clean URL — remove hash entirely
            history.pushState(null, '', window.location.pathname);
            handleRouteChange();
        } else {
            window.location.hash = moduleName;
        }
    }
});

// Hash-based Routing
function handleRouteChange() {
    const hash = window.location.hash.substring(1); // Remove #
    const [baseHash, queryString] = hash.split('?');

    // Check if we are leaving a client workspace
    if (!baseHash.startsWith('client/') && window.state && window.state.activeClientId) {
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    }

    if (!baseHash || baseHash === 'dashboard') {
        renderModule('dashboard', false);
        updateActiveNavItem('dashboard');
    } else if (hash.startsWith('client/')) {
        const parts = hash.split('/');
        const clientId = parts[1]; // KEEP AS STRING for Snowflake ID robustness
        const subModule = parts[2] || 'overview';
        if (typeof window.selectClient === 'function') {
            // If already in client workspace, just switch tab
            if (String(window.state.activeClientId) === String(clientId)) {
                window.renderClientModule(clientId, subModule);
            } else {
                window.selectClient(clientId);
                window.renderClientModule(clientId, subModule);
            }
        } else {
            // Fallback if client-workspace script not loaded
            renderModule('clients', false);
        }
    } else {
        renderModule(baseHash, false);
        updateActiveNavItem(baseHash);
    }
}

function updateActiveNavItem(moduleName) {
    const currentNavItems = document.querySelectorAll('.main-nav li');
    currentNavItems.forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('data-module') === moduleName);
    });
}

window.addEventListener('hashchange', handleRouteChange);

// Module Loader
const loadedModules = new Set();

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (loadedModules.has(src)) {
            resolve();
            return;
        }
        const script = document.createElement('script');

        // Handle file protocol (avoid query params for local files if strict)
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            script.src = src;
        } else {
            // Add timestamp to prevent caching issues on web servers
            script.src = `${src}?v=${window.appTimestamp || (window.appTimestamp = Date.now())}`;
        }

        script.onload = () => {
            loadedModules.add(src);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            reject(new Error(`Failed to load ${src}`));
        };
        document.body.appendChild(script);
    });
}

// Render Functions
async function renderModule(moduleName, syncHash = true) {
    // If we want to sync the hash and it's different, update it and return
    // handleRouteChange will then call renderModule(moduleName, false)
    if (syncHash && window.location.hash !== '#' + moduleName) {
        window.location.hash = moduleName;
        return;
    }

    // Parse Query Params
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);

    // Update Title
    const titleMap = {
        'dashboard': 'Dashboard',
        'clients': 'Client Management',
        'client-form': 'Client Form',
        'auditors': 'Auditor Management',
        'auditor-form': 'Auditor Form',
        'audit-programs': 'Audit Programs',
        'audit-planning': 'Audit Planning',
        'checklists': 'Checklist Library',
        'manday-calculator': 'Man-Day Calculator',
        'multisite-sampling': 'Multi-Site Sampling Calculator',
        'audit-execution': 'Audit Execution',
        'audit-reporting': 'Audit Reporting Dashboard',
        'certification': 'Certification Decisions',
        'documents': 'Document Management',
        'impartiality': 'Impartiality Committee',
        'management-review': 'Management Review',
        'internal-audit': 'Internal Audit',
        'settings': 'Settings'
    };

    pageTitle.textContent = titleMap[moduleName] || 'Dashboard';

    // Show Loading State
    contentArea.innerHTML = '<div class="fade-in" style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary-color);"></i></div>';

    try {
        // Scripts are now pre-loaded in index.html, no need for dynamic loading

        // Render Specific Content
        switch (moduleName) {
            case 'auth/callback':
                // Handle Supabase Auth Callback
                console.log('Processing auth callback...', window.location.hash);

                contentArea.innerHTML = `
                    <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh;">
                        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 2rem;"></i>
                        <h2>Verifying Information...</h2>
                        <p style="color: var(--text-secondary);">Please wait while we log you in securely.</p>
                    </div>
                `;

                // Allow Supabase client to process the hash (it does this automatically on load/hashchange)
                // We just need to give it a moment to set the session
                setTimeout(async () => {
                    const { data: { session } } = await window.SupabaseClient.client.auth.getSession();

                    if (session) {
                        console.log('Session established via link', session.user);
                        window.showNotification('Welcome! You are now logged in.', 'success');
                        window.location.hash = 'dashboard';
                    } else {
                        console.warn('No session found after callback delay');
                        // Stay on dashboard or go to login if it exists
                        window.location.hash = 'dashboard';
                        window.showNotification('Login verification failed. Please try again.', 'error');
                    }
                }, 2000);
                break;

            case 'dashboard':
                if (typeof renderDashboardEnhanced === 'function') {
                    renderDashboardEnhanced();
                } else {
                    renderDashboard();
                }
                break;
            case 'clients':
                if (typeof renderClientsEnhanced === 'function') {
                    renderClientsEnhanced();
                } else {
                    renderClients();
                }
                break;
            case 'client-form':
                const clientId = urlParams.get('id');
                if (typeof window.renderClientForm === 'function') {
                    window.renderClientForm(clientId);
                } else {
                    contentArea.innerHTML = '<div class="alert alert-danger">Client Form module not loaded</div>';
                }
                break;
            case 'auditors':
                if (typeof renderAuditorsEnhanced === 'function') {
                    renderAuditorsEnhanced();
                } else {
                    renderAuditors();
                }
                break;
            case 'auditor-form':
                const auditorId = urlParams.get('id');
                if (typeof window.renderAuditorForm === 'function') {
                    window.renderAuditorForm(auditorId);
                } else {
                    contentArea.innerHTML = '<div class="alert alert-danger">Auditor Form module not loaded</div>';
                }
                break;
            case 'audit-programs':
                if (typeof renderAuditProgramsEnhanced === 'function') {
                    renderAuditProgramsEnhanced();
                } else {
                    renderAuditPrograms();
                }
                break;
            case 'audit-planning':
                if (typeof renderAuditPlanningEnhanced === 'function') {
                    renderAuditPlanningEnhanced();
                } else {
                    renderAuditPlanning();
                }
                break;
            case 'audit-execution':
                if (typeof renderAuditExecutionEnhanced === 'function') {
                    renderAuditExecutionEnhanced();
                } else {
                    renderAuditExecution();
                }
                break;
            case 'audit-reporting':
                if (typeof renderReportingModule === 'function') {
                    renderReportingModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'certification':
                if (typeof renderCertificationModule === 'function') {
                    renderCertificationModule();
                } else {
                    contentArea.innerHTML = '<div class="alert alert-info">Certification module under construction</div>';
                }
                break;
            case 'appeals-complaints':
                if (typeof renderAppealsComplaintsModule === 'function') {
                    renderAppealsComplaintsModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'impartiality':
                if (typeof renderImpartialityModule === 'function') {
                    renderImpartialityModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'ncr-capa':
                if (typeof renderNCRCAPAModule === 'function') {
                    renderNCRCAPAModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'management-review':
                if (typeof renderManagementReviewModule === 'function') {
                    renderManagementReviewModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'internal-audit':
                if (typeof renderInternalAuditModule === 'function') {
                    renderInternalAuditModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'manday-calculator':
                if (typeof renderManDayCalculator === 'function') {
                    renderManDayCalculator();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'multisite-sampling':
                if (typeof renderMultiSiteSamplingCalculator === 'function') {
                    renderMultiSiteSamplingCalculator();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'documents':
                if (typeof renderDocumentsEnhanced === 'function') {
                    renderDocumentsEnhanced();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'checklists':
                if (typeof renderChecklistLibrary === 'function') {
                    renderChecklistLibrary();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'certificates':
                await loadScript('certificate-module.js');
                if (typeof renderCertificates === 'function') {
                    renderCertificates();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'record-retention':
                if (typeof renderRecordRetentionModule === 'function') {
                    renderRecordRetentionModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'settings':
                // Restrict Settings access to Admin and Certification Manager only
                const settingsRole = window.state.currentUser?.role;
                const canAccessSettings = settingsRole === 'Admin' || settingsRole === 'Certification Manager';

                if (!canAccessSettings) {
                    contentArea.innerHTML = `
                        <div class="fade-in" style="text-align: center; padding: 3rem;">
                            <i class="fa-solid fa-lock" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                            <h3>Access Restricted</h3>
                            <p style="color: var(--text-secondary);">Settings are only accessible to Admins and Certification Managers.</p>
                            <button class="btn btn-primary" onclick="window.location.hash = 'dashboard'">
                                <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Return to Dashboard
                            </button>
                        </div>
                    `;
                } else if (typeof renderSettings === 'function') {
                    renderSettings();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            default:
                // Handle dynamic routes like client/123
                if (moduleName.startsWith('client/')) {
                    const parts = moduleName.split('/');
                    const clientId = parts[1];
                    const subView = parts[2] || 'overview';

                    if (typeof window.loadClientDetails === 'function') {
                        // Ensure we pass string ID (as per UUID/Text ID fix)
                        window.loadClientDetails(String(clientId), subView);
                    } else {
                        console.error('loadClientDetails function is missing');
                        contentArea.innerHTML = '<div class="alert alert-danger">Client Details module not loaded. <br>Please refresh the page.</div>';
                    }
                } else {
                    renderPlaceholder(moduleName);
                }
        }
    } catch (error) {
        console.error('Error loading module:', error);
        contentArea.innerHTML = `
            <div class="fade-in" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h3>Error Loading Module</h3>
                <p style="color: var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="renderModule('${moduleName}')">
                    <i class="fa-solid fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderDashboard() {
    // Audit Compliance Alerts
    const alerts = [];
    (state.auditors || []).forEach(aud => {
        const evals = aud.evaluations || {};
        const nextDue = evals.nextWitnessAuditDue;
        const isFirstTime = evals.firstTimeAuditor;
        const witnessAudits = evals.witnessAudits || [];

        if (isFirstTime && witnessAudits.length === 0) {
            alerts.push({ type: 'First Time', msg: `${aud.name} - Witness Required`, id: aud.id, severity: 'high' });
        } else if (nextDue && new Date(nextDue) < new Date()) {
            alerts.push({ type: 'Overdue', msg: `${aud.name} - Overdue`, id: aud.id, severity: 'critical' });
        }
    });

    // Pre-Audit metrics
    const allPlans = state.auditPlans || [];
    const plansWithPreAudit = allPlans.filter(p => p.preAudit);
    const completedPreAudits = plansWithPreAudit.filter(p => p.preAudit?.status === 'Complete').length;
    const readyCount = plansWithPreAudit.filter(p => p.preAudit?.readinessDecision === 'Ready').length;
    const conditionalCount = plansWithPreAudit.filter(p => p.preAudit?.readinessDecision === 'Conditional').length;
    const notReadyCount = plansWithPreAudit.filter(p => p.preAudit?.readinessDecision === 'Not Ready').length;
    const pendingCount = plansWithPreAudit.filter(p => !p.preAudit?.status || p.preAudit?.status === 'Not Started' || p.preAudit?.status === 'In Progress').length;
    const completionRate = allPlans.length > 0 ? Math.round((completedPreAudits / allPlans.length) * 100) : 0;

    const dashboardHTML = `
        <div class="dashboard-grid fade-in">
            <div class="card stat-card">
                <h3>Total Clients</h3>
                <p class="stat-value">${state.clients.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Active Auditors</h3>
                <p class="stat-value">${state.auditors.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Pending Audits</h3>
                <p class="stat-value">3</p>
            </div>
            <div class="card stat-card">
                <h3>Certificates Issued</h3>
                <p class="stat-value">12</p>
            </div>
        </div>
        
        <!-- Pre-Audit Metrics Card -->
        <div class="card fade-in" style="margin-top: 2rem; border-top: 3px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-file-magnifying-glass" style="color: #8b5cf6;"></i>
                        Pre-Audit (Stage 1) Status
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.25rem 0 0 0;">ISO 17021-1 Document Review & Readiness Assessment</p>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #8b5cf6;">${completedPreAudits}/${allPlans.length}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Completed</div>
                    <div style="margin-top: 0.5rem; padding: 4px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                        ${completionRate}% Rate
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                <div style="text-align: center; padding: 1rem; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${readyCount}</div>
                    <div style="font-size: 0.85rem; color: #15803d; margin-top: 0.25rem;">
                        <i class="fa-solid fa-check-circle"></i> Ready
                    </div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${conditionalCount}</div>
                    <div style="font-size: 0.85rem; color: #b45309; margin-top: 0.25rem;">
                        <i class="fa-solid fa-exclamation-triangle"></i> Conditional
                    </div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${notReadyCount}</div>
                    <div style="font-size: 0.85rem; color: #b91c1c; margin-top: 0.25rem;">
                        <i class="fa-solid fa-times-circle"></i> Not Ready
                    </div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #64748b;">${pendingCount}</div>
                    <div style="font-size: 0.85rem; color: #475569; margin-top: 0.25rem;">
                        <i class="fa-solid fa-clock"></i> Pending
                    </div>
                </div>
            </div>
            
            ${pendingCount > 0 ? `
                <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <div style="font-size: 0.85rem; color: #92400e;">
                        <i class="fa-solid fa-info-circle"></i> 
                        <strong>${pendingCount}</strong> audit plan${pendingCount !== 1 ? 's' : ''} pending Pre-Audit review
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-top: 2rem;">
            <div class="card fade-in">
                <h3>Recent Activity</h3>
                <p style="color: var(--text-secondary); margin-top: 1rem;">No recent activity to show.</p>
            </div>

            <div class="card fade-in">
                <h3><i class="fa-solid fa-bell" style="color: #f59e0b; margin-right: 0.5rem;"></i>Compliance Alerts</h3>
                ${alerts.length > 0 ? `
                    <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${alerts.map(alert => `
                            <div style="padding: 0.75rem; border-radius: 6px; background: ${alert.severity === 'critical' ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${alert.severity === 'critical' ? '#dc2626' : '#d97706'}; cursor: pointer;" onclick="state.currentModule = 'auditors'; renderAuditors(); setTimeout(() => renderAuditorDetail(${alert.id}), 100);">
                                <div style="font-weight: 600; font-size: 0.9rem; color: ${alert.severity === 'critical' ? '#991b1b' : '#92400e'};">${alert.type}</div>
                                <div style="font-size: 0.85rem; color: ${alert.severity === 'critical' ? '#7f1d1d' : '#78350f'};">${alert.msg}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p style="color: var(--text-secondary); margin-top: 1rem; font-size: 0.9rem;">
                        <i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 0.5rem;"></i>All compliance checks passed.
                    </p>
                `}
            </div>
        </div>
    `;
    contentArea.innerHTML = dashboardHTML;
}

function renderClients() {
    contentArea.innerHTML = '<p>Loading Clients...</p>';
}

function renderAuditors() {
    contentArea.innerHTML = '<p>Loading Auditors...</p>';
}

function renderAuditPrograms() {
    contentArea.innerHTML = '<p>Loading Audit Programs...</p>';
}

function renderAuditPlanning() {
    contentArea.innerHTML = '<p>Loading Audit Planning...</p>';
}

function renderAuditExecution() {
    contentArea.innerHTML = '<p>Loading Audit Execution...</p>';
}

function renderCertification() {
    const rows = (state.certificationDecisions || []).map(decision => `
        <tr>
            <td>${window.UTILS.escapeHtml(decision.client)}</td>
            <td>${window.UTILS.escapeHtml(decision.standard)}</td>
            <td>${window.UTILS.escapeHtml(decision.date)}</td>
            <td><span class="status-badge status-${window.UTILS.escapeHtml(decision.decision || '').toLowerCase().replace(' ', '-')}">${window.UTILS.escapeHtml(decision.decision)}</span></td>
            <td>
                <button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-file-certificate"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Standard</th>
                            <th>Decision Date</th>
                            <th>Decision</th>
                            <th>Certificate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    contentArea.innerHTML = html;
}

function renderPlaceholder(moduleName) {
    contentArea.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: 3rem;">
            <i class="fa-solid fa-person-digging" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
            <h3>${moduleName.replace('-', ' ').toUpperCase()} Module</h3>
            <p style="color: var(--text-secondary);">This module is currently under development.</p>
        </div>
    `;
}

// Notification Helper - Theme Aware
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'fade-in';

    // Theme-aware colors
    const colors = {
        success: { bg: '#059669', border: '#10b981', icon: 'fa-check-circle' },
        error: { bg: '#dc2626', border: '#ef4444', icon: 'fa-times-circle' },
        warning: { bg: '#d97706', border: '#f59e0b', icon: 'fa-exclamation-triangle' },
        info: { bg: '#2563eb', border: '#3b82f6', icon: 'fa-info-circle' }
    };
    const style = colors[type] || colors.success;

    notification.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${style.bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px ${style.border};
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;

    notification.innerHTML = `
        <i class="fa-solid ${style.icon}" style="font-size: 1.25rem;"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal Helpers
function openModal(title, body, onSave) {
    if (title) {
        document.getElementById('modal-title').textContent = title;
    }
    if (body) {
        document.getElementById('modal-body').innerHTML = body;
    }
    if (onSave) {
        const saveBtn = document.getElementById('modal-save');
        saveBtn.onclick = onSave;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    // Reset modal content
    document.getElementById('modal-title').textContent = 'Modal Title';
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-save').onclick = null;
    document.getElementById('modal-save').textContent = 'Save'; // Reset button text
    document.getElementById('modal-save').style.display = ''; // Reset visibility for next modal
}

// Export to window for global access
window.openModal = openModal;
window.closeModal = closeModal;

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
        closeModal();
    }
});

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

function toggleMobileMenu() {
    sidebar.classList.toggle('mobile-open');
    mobileOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
}

// Close mobile menu when navigation item is clicked (Delegation at document level)
document.addEventListener('click', (e) => {
    if (e.target.closest('li[role="button"]')) {
        closeMobileMenu();
    }
});

// Keyboard Navigation Support (Delegation at document level)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('li[role="button"]');
        if (item) {
            e.preventDefault();
            item.click();
        }
    }
});

// ESC key to close mobile menu and modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeMobileMenu();
        if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
            closeModal();
        }
    }
});

// Export helper function for use in modules
window.saveData = saveState;

// Lazy-loading modal wrapper functions
// These load modules on demand when create/add buttons are clicked
const modalFunctionCache = {};

async function lazyLoadModal(modulePath, functionName) {
    // Load the module if not already loaded
    try {
        await loadScript(modulePath);

        // Retry finding the function for up to 1 second
        let retries = 10;
        while (retries > 0) {
            if (typeof window[functionName] === 'function') {
                window[functionName]();
                return;
            }
            await new Promise(r => setTimeout(r, 100)); // Wait 100ms
            retries--;
        }

        console.error(`Function ${functionName} not found after loading ${modulePath}`);
        showNotification(`Error loading ${functionName}. Please refresh the page.`, 'error');
    } catch (error) {
        console.error(`Error loading module ${modulePath}:`, error);
        showNotification(`Failed to load module: ${error.message}`, 'error');
    }
}

// Initial Render
// User Profile / Role Switcher - positioned at bottom of left sidebar
function renderRoleSwitcher() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Remove existing container if present
    const existing = document.getElementById('role-switcher-container');
    if (existing) existing.remove();

    // Require proper authentication - no demo user fallback
    if (!state.currentUser) {
        console.warn('No authenticated user - redirecting to login');
        window.location.hash = 'login';
        return;
    }

    const switcher = document.createElement('div');
    switcher.id = 'role-switcher-container';
    switcher.style.cssText = 'padding: 1rem; border-top: 1px solid var(--border-color); margin-top: auto;';

    // Check if this is a real authenticated user (from Supabase)
    const isRealUser = state.currentUser && !state.currentUser.isDemo && state.currentUser.email;

    if (isRealUser) {
        // User is logged in - don't render anything in sidebar (profile/logout is in header)
        return;
    } else {
        // Show Login Button for production
        switcher.innerHTML = `
            <div style="padding: 0.5rem 0;">
                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">Please login to access the system.</p>
                <button onclick="window.renderLoginModal()" class="btn btn-sm btn-primary" style="width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem;"></i> Login
                </button>
            </div>
        `;
    }
    sidebar.appendChild(switcher);
}

// Render Login Modal
window.renderLoginModal = function () {
    const modalHtml = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="width: 64px; height: 64px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.75rem;">
                <i class="fa-solid fa-shield-halved"></i>
            </div>
            <h3 style="margin: 0; color: #1e293b;">Admin Login</h3>
            <p style="color: #64748b; margin-top: 0.5rem;">Secure Access Portal</p>
        </div>
        <form onsubmit="event.preventDefault(); window.loginUser(this);">
            <div class="form-group" style="margin-bottom: 1rem;">
                <label>Email</label>
                <input type="email" name="email" class="form-control" placeholder="admin@auditcb.com" required>
            </div>
             <div class="form-group" style="margin-bottom: 1.5rem;">
                <label>Password</label>
                <input type="password" name="password" class="form-control" placeholder="••••••" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem; font-size: 1rem;">
                Sign In
            </button>
        </form>
    `;

    // Use existing modal infrastructure if available, or simple sweetalert/custom
    // Assuming simple-modal structure exists in index.html (modal-container)
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer'); // Usually has buttons

    if (modalTitle && modalBody) {
        modalTitle.textContent = '';
        modalBody.innerHTML = modalHtml;
        if (modalFooter) modalFooter.style.display = 'none'; // Hide default buttons
        window.openModal();
    } else {
        // Fallback
        alert('Login Modal Error: UI not found');
    }
};

// Handle Login Logic
window.loginUser = function (form) {
    const email = form.email.value;
    const password = form.password.value;

    // 1. Check against local users (Admin)
    const users = window.state.users || [];
    // Ensure default admin exists if list is empty (fallback)
    if (users.length === 0) {
        users.push({
            id: 1,
            name: 'System Admin',
            email: 'info@companycertification.com',
            role: 'Admin',
            password: 'admin' // Simple plain text for prototype
        });
        window.state.users = users;
    }

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

    if (user) {
        window.state.currentUser = user;
        window.saveData();
        window.showNotification('Login Successful', 'success');
        window.closeModal();
        window.renderRoleSwitcher(); // Re-render sidebar
        window.location.reload(); // Reload to apply full permissions
    } else {
        window.showNotification('Invalid email or password', 'error');
    }
};

// Exit demo mode and set as real Admin user
window.exitDemoMode = function () {
    state.currentUser = {
        name: 'Admin User',
        email: 'admin@companycertification.com',
        role: 'Admin',
        isDemo: false
    };
    saveState();
    renderRoleSwitcher();
    updateNavigationForRole('Admin');
    window.showNotification('Logged in as Admin. Demo mode disabled.', 'success');
    handleRouteChange();
};

// Logout user
// Note: logoutUser defined later (~L1721) with proper dropdown close + login overlay

window.switchUserRole = function (role) {
    if (!state.currentUser) {
        window.Logger.warn('Cannot switch role - no authenticated user');
        window.showNotification('Please log in first', 'error');
        return;
    }

    state.currentUser.role = role;

    // Update navigation visibility based on role
    updateNavigationForRole(role);

    window.showNotification(`Switched role to: ${role}`, 'info');
    // Re-render current module to reflect permissions
    const hash = window.location.hash.substring(1) || 'dashboard';
    handleRouteChange();
};

// Update navigation items visibility based on user role
function updateNavigationForRole(role) {
    const auditorRoles = ['Auditor', 'Lead Auditor'];
    const isAuditor = auditorRoles.includes(role);

    // Hide Settings for Auditors
    const settingsNav = document.querySelector('li[data-module="settings"]');
    if (settingsNav) {
        settingsNav.style.display = isAuditor ? 'none' : '';
    }

    // Hide Governance group for Auditors (optional but good for cleaner UX)
    const governanceHeader = document.querySelector('.nav-group-header');
    const governanceContent = governanceHeader?.nextElementSibling;
    if (governanceHeader && governanceContent) {
        governanceHeader.style.display = isAuditor ? 'none' : '';
        governanceContent.style.display = isAuditor ? 'none' : '';
    }
}
window.updateNavigationForRole = updateNavigationForRole;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (not demo mode)
    const isLoggedIn = state.currentUser && !state.currentUser.isDemo && state.currentUser.email;

    if (!isLoggedIn) {
        // Show fullscreen login overlay
        showLoginOverlay();
        return; // Don't proceed with app initialization
    }

    // User is logged in - proceed normally
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.classList.remove('auth-pending');
        appContainer.classList.add('auth-ready');
    }

    renderRoleSwitcher();
    updateCBLogoDisplay();
    if (state.currentUser?.role) {
        updateNavigationForRole(state.currentUser.role);
    }
    if (window.location.hash) {
        handleRouteChange();
    } else {
        window.location.hash = 'dashboard';
    }
});

// Fullscreen Login Overlay
function showLoginOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    overlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 3rem; width: 400px; max-width: 90vw; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);">
                    <i class="fa-solid fa-shield-halved"></i>
                </div>
                <h2 style="margin: 0; color: #1e293b; font-size: 1.75rem; font-weight: 700;">AuditCB360</h2>
                <p style="color: #64748b; margin-top: 0.5rem;">ISO Certification Body Management</p>
            </div>
            
            <form id="login-form" onsubmit="event.preventDefault(); window.handleLoginSubmit(this);">
                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; font-size: 0.9rem;">Email Address</label>
                    <input type="email" name="email" placeholder="info@companycertification.com" required 
                        style="width: 100%; padding: 0.875rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; transition: all 0.2s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';"
                        onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none';">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; font-size: 0.9rem;">Password</label>
                    <input type="password" name="password" placeholder="••••••••" required
                        style="width: 100%; padding: 0.875rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; transition: all 0.2s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';"
                        onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none';">
                </div>
                
                <button type="submit" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);"
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 10px -1px rgba(37, 99, 235, 0.4)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(37, 99, 235, 0.3)';">
                    <i class="fa-solid fa-right-to-bracket" style="margin-right: 0.5rem;"></i>
                    Sign In
                </button>
            </form>
            
            <div style="text-align: center; margin-top: 1rem;">
                <a href="#" onclick="event.preventDefault(); window.showForgotPassword();" 
                   style="color: #3b82f6; text-decoration: none; font-size: 0.9rem; font-weight: 500;">
                    <i class="fa-solid fa-key" style="margin-right: 0.25rem;"></i>
                    Forgot Password?
                </a>
            </div>
            
            <p style="text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 2rem;">
                Secure access for authorized personnel only
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
}

// Handle Login Form Submission
window.handleLoginSubmit = async function (form) {
    const email = form.email.value;
    const password = form.password.value;

    let user = null;

    // Try Supabase Auth first
    if (window.SupabaseClient?.isInitialized) {
        try {
            const authResult = await window.SupabaseClient.signIn(email, password);
            if (authResult?.user) {
                // Supabase auth successful
                user = {
                    id: authResult.user.id,
                    email: authResult.user.email,
                    name: authResult.user.user_metadata?.full_name || authResult.user.email.split('@')[0],
                    role: authResult.user.user_metadata?.role || 'Admin',
                    supabaseAuth: true
                };
                console.log('✅ Supabase Auth login successful');
            }
        } catch (authError) {
            console.warn('Supabase Auth failed, trying local auth:', authError.message);
        }
    }

    // Fallback to local auth if Supabase auth failed
    if (!user) {
        // Ensure default admin exists
        if (!window.state.users || window.state.users.length === 0) {
            window.state.users = [{
                id: 1,
                name: 'System Admin',
                email: 'info@companycertification.com',
                role: 'Admin',
                password: 'admin'
            }];
        }

        // Try local user verification
        for (const u of window.state.users) {
            if (u.email.toLowerCase() === email.toLowerCase()) {
                if (u.password_hash) {
                    const isValid = await window.PasswordUtils.verifyPassword(password, u.password_hash);
                    if (isValid) {
                        user = u;
                        break;
                    }
                } else if (u.password) {
                    if (u.password === password) {
                        user = u;
                        u.password_hash = await window.PasswordUtils.hashPassword(password);
                        delete u.password;
                        window.saveData();
                        break;
                    }
                }
            }
        }
    }

    if (user) {
        // Login successful
        window.state.currentUser = {
            ...user,
            isDemo: false
        };
        window.saveData();

        // Remove overlay and initialize app
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.remove();

        // Show app container
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.classList.remove('auth-pending');
            appContainer.classList.add('auth-ready');
        }

        // Initialize the app
        renderRoleSwitcher();
        updateCBLogoDisplay();
        updateNavigationForRole(user.role);
        window.location.hash = 'dashboard';
        handleRouteChange();

        // Auto-sync from Supabase if configured
        // Auto-sync from Supabase if configured
        if (window.SupabaseClient?.isInitialized) {
            try {
                // Sync users from Supabase
                window.SupabaseClient.syncUsersFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced users from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase user sync failed:', err));

                // Sync clients from Supabase
                window.SupabaseClient.syncClientsFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced clients from Supabase: ${result.added} added, ${result.updated} updated`);
                        if (window.renderDashboard) window.renderDashboard();
                        if (window.renderClientsModule) window.renderClientsModule();
                    }
                }).catch(err => console.warn('Supabase client sync failed:', err));

                // Sync auditors from Supabase
                window.SupabaseClient.syncAuditorsFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced auditors from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase auditor sync failed:', err));

                // Sync auditor assignments from Supabase
                window.SupabaseClient.syncAuditorAssignmentsFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced auditor assignments from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase auditor assignments sync failed:', err));

                // Sync audit plans from Supabase
                window.SupabaseClient.syncAuditPlansFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced audit plans from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase audit plan sync failed:', err));

                // Sync audit reports from Supabase
                window.SupabaseClient.syncAuditReportsFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced audit reports from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase audit report sync failed:', err));

                // Sync checklists from Supabase — clear local stale data first
                window.state.checklists = [];
                window.SupabaseClient.syncChecklistsFromSupabase().then(result => {
                    console.log(`Synced checklists from Supabase: ${result?.added || 0} added, ${result?.updated || 0} updated, total: ${window.state.checklists.length}`);
                    // Always re-render after sync since cloud replaces local data
                    if (window.renderChecklistLibrary) window.renderChecklistLibrary();
                    if (window.location.hash === '#planning' && window.renderPlanningModule) window.renderPlanningModule();
                }).catch(err => console.warn('Supabase checklist sync failed:', err));

                // Sync settings from Supabase
                window.SupabaseClient.syncSettingsFromSupabase().then(result => {
                    if (result?.updated) {
                        console.log('Synced settings from Supabase');
                        if (window.location.hash === '#settings' && window.renderSettings) {
                            window.renderSettings();
                        }
                    }
                }).catch(err => console.warn('Supabase settings sync failed:', err));

                // Sync documents from Supabase
                window.SupabaseClient.syncDocumentsFromSupabase().then(result => {
                    if (result?.added > 0 || result?.updated > 0) {
                        console.log(`Synced documents from Supabase: ${result.added} added, ${result.updated} updated`);
                    }
                }).catch(err => console.warn('Supabase document sync failed:', err));

                // Sync certification decisions from Supabase
                window.SupabaseClient.syncCertificationDecisionsFromSupabase().then(result => {
                    if (result?.updated > 0) {
                        console.log(`Synced ${result.updated} certification decisions from Supabase`);
                    }
                }).catch(err => console.warn('Supabase certification decision sync failed:', err));

            } catch (e) {
                console.warn('Supabase sync error:', e);
            }
        } // END COMMENTED OUT AUTO-SYNC

        window.showNotification(`Welcome, ${user.name}!`, 'success');
    } else {
        window.showNotification('Invalid email or password', 'error');
    }
};

// Show Forgot Password Dialog
window.showForgotPassword = function () {
    const email = prompt('Enter your email address to reset your password:');

    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showNotification('Please enter a valid email address', 'error');
        return;
    }

    // Check if user exists
    const user = window.state.users?.find(u => u.email === email);
    if (!user) {
        window.showNotification('No account found with that email address', 'error');
        return;
    }

    // If Supabase is configured, use Supabase password reset
    if (window.SupabaseClient?.isInitialized) {
        window.SupabaseClient.sendPasswordResetEmail(email)
            .then(() => {
                window.showNotification('Password reset email sent! Check your inbox.', 'success');
            })
            .catch(err => {
                console.error('Password reset failed:', err);
                window.showNotification('Failed to send reset email. Please contact admin.', 'error');
            });
    } else {
        // Local mode - show password to admin
        if (confirm(`Local mode: Contact your administrator.\n\nAdmin: Would you like to reset this user's password?`)) {
            const newPassword = prompt('Enter new password for ' + email + ':');
            if (newPassword && newPassword.length >= 6) {
                window.PasswordUtils.hashPassword(newPassword).then(hash => {
                    user.password_hash = hash;
                    delete user.password;
                    window.saveData();
                    window.showNotification('Password reset successfully!', 'success');
                });
            } else {
                window.showNotification('Password must be at least 6 characters', 'error');
            }
        }
    }
};


// Update CB Logo in Sidebar Header
function updateCBLogoDisplay() {
    try {
        const logoContainer = document.getElementById('cb-logo-display');
        if (!logoContainer) return;

        // Use maximum defensiveness
        const settings = (window.state && window.state.cbSettings) ? window.state.cbSettings : {};
        const logoUrl = settings.logoUrl || '';
        const cbName = settings.cbName || 'AuditCB360';

        if (logoUrl && (logoUrl.startsWith('data:') || logoUrl.startsWith('http'))) {
            // Replace entire header with just the logo
            logoContainer.innerHTML = `<img src="${logoUrl}" style="max-height: 40px; max-width: 180px; object-fit: contain;" alt="${window.UTILS?.escapeHtml(cbName) || 'Logo'}">`;
        } else {
            // Default: icon + text
            logoContainer.innerHTML = `<i class="fa-solid fa-certificate"></i><h1>${window.UTILS?.escapeHtml(cbName) || 'AuditCB360'}</h1>`;
        }
    } catch (e) {
        console.warn('[SILENT ERROR] updateCBLogoDisplay failed:', e.message);
    }
}
window.updateCBLogoDisplay = updateCBLogoDisplay;

// Client Sidebar Toggle
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const clientSidebar = document.getElementById('client-sidebar');

if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
        clientSidebar.classList.toggle('collapsed');
        const isCollapsed = clientSidebar.classList.contains('collapsed');
        sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });
}

// Side Bar Group Toggle
window.toggleNavGroup = function (header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.group-arrow');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        content.classList.remove('collapsed');
        arrow.classList.remove('fa-chevron-down');
        arrow.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        content.classList.add('collapsed');
        arrow.classList.remove('fa-chevron-up');
        arrow.classList.add('fa-chevron-down');
    }
};

// Toggle User Dropdown Menu in Header
window.toggleUserMenu = function () {
    console.log('[DEBUG] toggleUserMenu called');
    const dropdown = document.getElementById('user-dropdown-menu');
    console.log('[DEBUG] dropdown element:', dropdown);
    if (!dropdown) {
        console.error('[DEBUG] Dropdown element not found!');
        return;
    }

    const isVisible = dropdown.style.display !== 'none';
    dropdown.style.display = isVisible ? 'none' : 'block';
    console.log('[DEBUG] Dropdown toggled to:', dropdown.style.display);

    // Update user info in dropdown
    if (!isVisible && window.state?.currentUser) {
        const nameEl = document.getElementById('header-user-name');
        const infoEl = document.getElementById('dropdown-user-info');
        if (nameEl) nameEl.textContent = window.state.currentUser.name || 'User';
        if (infoEl) {
            infoEl.innerHTML = `
        <div style="font-weight: 600; color: var(--text-color);">${window.state.currentUser.name || 'User'}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">${window.state.currentUser.role || 'Role'}</div>
    `;
        }
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('user-dropdown-menu');
    const profile = document.getElementById('header-user-profile');
    if (dropdown && profile && !profile.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Logout User
window.logoutUser = function () {
    console.log('[DEBUG] logoutUser called');
    if (confirm('Are you sure you want to logout?')) {
        console.log('[DEBUG] User confirmed logout');

        // Clear current user completely
        window.state.currentUser = null;
        window.saveData();

        // Close dropdown
        const dropdown = document.getElementById('user-dropdown-menu');
        if (dropdown) dropdown.style.display = 'none';

        // Show login overlay
        showLoginOverlay();

        window.showNotification('Logged out successfully', 'info');
        console.log('[DEBUG] Login overlay shown');
    } else {
        console.log('[DEBUG] User cancelled logout');
    }
};

// GLOBAL EXPORTS
window.saveState = saveState;
window.saveData = saveState;

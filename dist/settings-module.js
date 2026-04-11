// ============================================
// SETTINGS MODULE - CB CONFIGURATION (ESM-ready)
// ============================================

// Initialize CB settings if not present
if (!window.state.cbSettings) {
    window.state.cbSettings = {
        // CB Profile & Branding
        cbName: 'AuditCB360 Certification Body',
        cbAddress: '123 Quality Street, ISO City, 9001',
        cbPhone: '+1-555-AUDIT',
        cbEmail: '', // Configure in Settings > CB Profile
        cbWebsite: 'https://audit.companycertification.com',
        cbTagline: 'Committed to Excellence in Certification',
        logoUrl: '',
        primaryColor: '#0284c7',
        secondaryColor: '#7c3aed',

        // Accreditation
        accreditationBody: 'ANAB',
        accreditationNumber: 'AB-2024-001',
        accreditationExpiry: '2026-12-31',
        standardsOffered: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022'],
        geographicScope: ['United States', 'Canada', 'Mexico'],
        availableStandards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 50001:2018', 'ISO 22000:2018', 'ISO 13485:2016'],
        iafMlaStatus: true,

        // Quality Policy
        qualityPolicy: 'We are committed to providing impartial, competent, and consistent certification services that meet the requirements of ISO 17021-1 and exceed our clients\' expectations.',
        qualityObjectives: [
            { objective: 'Client Satisfaction', target: '95%', actual: '97%' },
            { objective: 'Audit On-Time Rate', target: '98%', actual: '99%' },
            { objective: 'NCR Closure Within 90 Days', target: '100%', actual: '95%' }
        ],
        msScope: 'Certification services for management systems across all accredited standards and geographic regions',
        policyLastReviewed: '2024-01-15',
        policyApprovedBy: 'CEO',

        // System Defaults
        certificateNumberFormat: 'CB-{YEAR}-{SEQ}',
        dateFormat: 'DD/MM/YYYY',
        defaultStage1Duration: 1,
        defaultStage2Duration: 2,
        manDayCalculationMode: 'ISO 17021',
        notificationLeadTime: 14,
        sessionTimeout: 30,
        currency: 'USD'
    };
}

// Initialize organization structure
if (!window.state.orgStructure) {
    window.state.orgStructure = [
        { id: 1, title: 'Chief Executive Officer', department: 'Executive', reportsTo: null },
        { id: 2, title: 'Quality Manager', department: 'Quality', reportsTo: 'CEO' },
        { id: 3, title: 'Certification Manager', department: 'Operations', reportsTo: 'CEO' },
        { id: 4, title: 'Lead Auditor', department: 'Operations', reportsTo: 'Certification Manager' },
        { id: 5, title: 'Auditor', department: 'Operations', reportsTo: 'Lead Auditor' }
    ];
}

// Initialize role permissions
if (!window.state.rolePermissions) {
    window.state.rolePermissions = {
        'Admin': { dashboard: 'full', clients: 'full', auditors: 'full', audits: 'full', certs: 'full', reports: 'full', settings: 'full' },
        'Cert Manager': { dashboard: 'view', clients: 'full', auditors: 'view', audits: 'full', certs: 'full', reports: 'full', settings: 'none' },
        'Lead Auditor': { dashboard: 'view', clients: 'partial', auditors: 'view', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Auditor': { dashboard: 'view', clients: 'none', auditors: 'none', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Client': { dashboard: 'none', clients: 'own', auditors: 'none', audits: 'own', certs: 'own', reports: 'own', settings: 'none' }
    };
}

// Initialize CB Policies (NCR Criteria, Certification Decisions, etc.)
if (!window.state.cbPolicies) {
    window.state.cbPolicies = {
        ncrCriteria: {
            major: [
                'Complete absence of a required process or procedure',
                'Systematic failure affecting product/service conformity',
                'Breakdown of the management system or major element',
                'A minor NC from previous audit not corrected within agreed timeframe',
                'Significant risk to health, safety, or environment',
                'Fraudulent or misleading records or data'
            ],
            minor: [
                'Isolated lapse in following a documented procedure',
                'Single instance of incomplete documentation',
                'Minor gap in record keeping that does not affect system effectiveness',
                'Opportunity to strengthen existing controls identified'
            ],
            observation: [
                'Potential for improvement identified',
                'Emerging risk that may become NC if not addressed',
                'Best practice recommendation',
                'Clarification or enhancement of existing practice'
            ]
        },
        certDecisionRules: {
            grant: 'No Major NCs; all Minor NCs have acceptable corrective action plans',
            deny: 'Unresolved Major NCs; multiple critical system failures',
            suspend: 'Major NC identified during surveillance; client request; failure to permit audits',
            withdraw: 'Continued suspension beyond 6 months; fraudulent use of certificate; client request',
            reduce: 'Scope reduction when part of system no longer meets requirements',
            expand: 'Successful audit of additional scope areas'
        },
        capaTimelines: {
            majorCorrection: 90,
            minorCorrection: 30,
            observationResponse: 0,
            capaVerification: 'Before next surveillance or within 90 days'
        },
        auditFrequency: {
            surveillance: '12 months (max)',
            recertification: '36 months',
            transferAudit: 'Before transfer completion'
        },
        competenceCriteria: {
            leadAuditor: '5 audits as auditor + lead auditor course + witness audit',
            auditor: 'Sector knowledge + auditor course + 4 shadow audits',
            technicalExpert: 'Sector expertise but no ISO 17021 auditor qualification required'
        }
    };
}

function renderSettings() {
    // Track current main tab and sub-tab
    if (!window.state.settingsMainTab) window.state.settingsMainTab = 'cb-profile';
    if (!window.state.settingsSubTab) window.state.settingsSubTab = 'profile';

    // Trigger Supabase settings sync in background (will re-render when complete)
    if (window.SupabaseClient?.isInitialized && window.SupabaseClient.syncSettingsFromSupabase) {
        window.SupabaseClient.syncSettingsFromSupabase().then(result => {
            if (result.updated) {
                // Update form fields with loaded data without full re-render (avoid loop)
                updateSettingsFormFields();
            }
        }).catch(err => console.warn('Settings sync error:', err));
    }

    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <!-- Main Tabs (4 categories) -->
                <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 0; padding-bottom: 0;">
                    <button class="tab-btn ${window.state.settingsMainTab === 'cb-profile' ? 'active' : ''}" data-action="switchSettingsMainTab" data-id="cb-profile">
                        <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i>CB Profile
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'organization' ? 'active' : ''}" data-action="switchSettingsMainTab" data-arg1="organization" data-arg2="this" aria-label="Team">
                        <i class="fa-solid fa-users" style="margin-right: 0.5rem;"></i>Organization
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'policies' ? 'active' : ''}" data-action="switchSettingsMainTab" data-arg1="policies" data-arg2="this">
                        <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem;"></i>Policies
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'knowledge' ? 'active' : ''}" data-action="switchSettingsMainTab" data-arg1="knowledge" data-arg2="this" aria-label="AI analysis">
                        <i class="fa-solid fa-brain" style="margin-right: 0.5rem;"></i>Knowledge Base
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'users' ? 'active' : ''}" data-action="switchSettingsMainTab" data-arg1="users" data-arg2="this">
                        <i class="fa-solid fa-users-cog" style="margin-right: 0.5rem;"></i>Users
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'system' ? 'active' : ''}" data-action="switchSettingsMainTab" data-arg1="system" data-arg2="this" aria-label="Settings">
                        <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i>System
                    </button>
                </div>

                <!-- Sub-tabs bar -->
                <div id="settings-subtabs" style="background: #f8fafc; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
                    ${getSettingsSubTabs(window.state.settingsMainTab)}
                </div>

                <div id="settings-content" style="padding: 1.5rem;">
                    ${getSettingsContent(window.state.settingsMainTab, window.state.settingsSubTab)}
                </div>
            </div>
        </div>
    `;
    window.contentArea.innerHTML = html;
}

// Get sub-tabs for a main tab
function getSettingsSubTabs(mainTab) {
    const subTabs = {
        'cb-profile': [
            { id: 'profile', label: 'Profile & Logo', icon: 'fa-id-card' },
            { id: 'accreditation', label: 'Accreditation', icon: 'fa-certificate' }
        ],
        'organization': [
            { id: 'structure', label: 'Structure', icon: 'fa-sitemap' },
            { id: 'permissions', label: 'Permissions', icon: 'fa-user-shield' }
        ],
        'policies': [
            { id: 'quality', label: 'Quality Policy', icon: 'fa-star' },
            { id: 'cbpolicies', label: 'CB Policies', icon: 'fa-gavel' },
            { id: 'retention', label: 'Retention', icon: 'fa-archive' }
        ],
        'users': [
            { id: 'management', label: 'User Management', icon: 'fa-users-cog' }
        ],
        'knowledge': [
            { id: 'kb', label: 'Knowledge Base', icon: 'fa-brain' }
        ],
        'system': [
            { id: 'defaults', label: 'Defaults', icon: 'fa-sliders' },
            { id: 'supabase', label: 'Supabase', icon: 'fa-cloud' },
            { id: 'data', label: 'Data Management', icon: 'fa-database' },
            { id: 'usage', label: 'Usage Analytics', icon: 'fa-chart-line' },
            { id: 'activity-log', label: 'Activity Log', icon: 'fa-history' }
        ]
    };

    const tabs = subTabs[mainTab] || [];
    const currentSubTab = window.state.settingsSubTab;

    return tabs.map(tab => `
        <button class="btn btn-sm ${currentSubTab === tab.id ? 'btn-primary' : 'btn-outline-secondary'}" 
            style="margin-right: 0.5rem;" 
            data-action="switchSettingsSubTab" data-arg1="${mainTab}" data-arg2="${tab.id}">
            <i class="fa-solid ${tab.icon}" style="margin-right: 0.25rem;"></i>${tab.label}
        </button>
    `).join('');
}

// Get content for a specific sub-tab
function getSettingsContent(mainTab, subTab) {
    const contentMap = {
        'cb-profile': {
            'profile': () => getCBProfileHTML(),
            'accreditation': () => getAccreditationHTML()
        },
        'organization': {
            'structure': () => getOrganizationHTML(),
            'permissions': () => getPermissionsHTML()
        },
        'policies': {
            'quality': () => getQualityPolicyHTML(),
            'cbpolicies': () => getCBPoliciesHTML(),
            'retention': () => getRetentionHTML()
        },
        'users': {
            'management': () => getUsersHTML()
        },
        'knowledge': {
            'kb': () => getKnowledgeBaseHTML()
        },
        'system': {
            'defaults': () => getDefaultsHTML(),
            'supabase': () => {
                return `
                    <div class="fade-in">
                        <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
                            <i class="fa-solid fa-cloud"></i> Connection Diagnostics
                        </h3>
                        <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                            <p style="margin-bottom: 1rem;">Use this tool to identify why data is not saving.</p>
                            <button class="btn btn-primary" data-action="runSupabaseDiagnostics">
                                <i class="fa-solid fa-stethoscope" style="margin-right: 0.5rem;"></i> Run Diagnostics
                            </button>
                            <div id="diagnostics-output" style="margin-top: 1.5rem; background: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 6px; font-family: monospace; display: none; white-space: pre-wrap;"></div>
                        </div>
                    </div>
                `;
            },
            'data': () => {
                setTimeout(() => {
                    if (window.DataMigration && typeof window.DataMigration.renderAdminUI === 'function') {
                        window.DataMigration.renderAdminUI();
                    } else {
                        const dm = document.getElementById('admin-data-management');
                        if (dm) dm.innerHTML = '<div class="alert alert-warning">Data Migration module not loaded.</div>';
                    }
                }, 50);
                return '<div id="admin-data-management"></div>';
            },
            'usage': () => getUsageAnalyticsHTML(),
            'activity-log': () => getActivityLogHTML()
        }
    };

    const mainContent = contentMap[mainTab];
    if (mainContent && mainContent[subTab]) {
        return mainContent[subTab]();
    }

    // Default to first sub-tab of the main tab
    const firstSubTab = Object.keys(contentMap[mainTab] || {})[0];
    if (firstSubTab && contentMap[mainTab][firstSubTab]) {
        window.state.settingsSubTab = firstSubTab;
        return contentMap[mainTab][firstSubTab]();
    }

    return getCBProfileHTML();
}

// Switch main tab
window.switchSettingsMainTab = function (mainTab, _btnElement) {
    window.state.settingsMainTab = mainTab;

    // Set default sub-tab for the main tab
    const defaultSubTabs = {
        'cb-profile': 'profile',
        'organization': 'structure',
        'policies': 'quality',
        'system': 'users' // Default to users for admin access
    };
    window.state.settingsSubTab = defaultSubTabs[mainTab] || 'profile';

    renderSettings();
};

// Switch sub-tab
window.switchSettingsSubTab = function (mainTab, subTab) {
    window.state.settingsMainTab = mainTab;
    window.state.settingsSubTab = subTab;

    // Update sub-tabs
    document.getElementById('settings-subtabs').innerHTML = getSettingsSubTabs(mainTab);

    // Update content
    document.getElementById('settings-content').innerHTML = getSettingsContent(mainTab, subTab);

    // Load async data for specific tabs
    if (subTab === 'usage' && typeof window.loadSupabaseStats === 'function') {
        setTimeout(() => window.loadSupabaseStats(), 100);
    }
};


window.runSupabaseDiagnostics = async function () {
    const output = document.getElementById('diagnostics-output');
    if (!output) return;

    output.style.display = 'block';
    output.innerHTML = 'Starting diagnostics Check...\n';

    const log = (msg, type = 'info') => {
        const color = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#e2e8f0';
        output.innerHTML += `<div style="color: ${color}; margin-bottom: 4px;">[${type.toUpperCase()}] ${msg}</div>`;
    };

    if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) {
        log('Supabase Client NOT initialized.', 'error');
        return;
    }

    try {
        log('Testing "clients" table insert...');
        const testId = 'diag-' + Date.now();
        const testClient = {
            id: testId,
            name: 'Diagnostic Test',
            status: 'Active',
            contact_person: 'Test Person',
            updated_at: new Date().toISOString()
        };

        const { error } = await window.SupabaseClient.client
            .from('clients')
            .upsert(testClient);

        if (error) {
            log(`Insert Failed: ${error.message}`, 'error');
            if (error.details) log(`Details: ${error.details}`, 'error');
            if (error.hint) log(`Hint: ${error.hint}`, 'error');

            if (error.status === 400 || error.code === '400') {
                log('ROOT CAUSE: Database Schema Mismatch (Missing Columns).', 'error');
                log('SOLUTION: Run FIX_SCHEMA_SNAKE_CASE.sql in Supabase.', 'success');
            }
        } else {
            log('Clients table insert SUCCESS! Schema is correct.', 'success');
            // Cleanup
            await window.SupabaseClient.client.from('clients').delete().eq('id', testId);
        }

    } catch (e) {
        log(`Exception: ${e.message}`, 'error');
    }
};

// Legacy function for compatibility
function switchSettingsTab(tabName, _btnElement) {
    // Map old tab names to new structure
    const mapping = {
        'profile': { main: 'cb-profile', sub: 'profile' },
        'accreditation': { main: 'cb-profile', sub: 'accreditation' },
        'organization': { main: 'organization', sub: 'structure' },
        'permissions': { main: 'organization', sub: 'permissions' },
        'policy': { main: 'policies', sub: 'quality' },
        'cbpolicies': { main: 'policies', sub: 'cbpolicies' },
        'retention': { main: 'policies', sub: 'retention' },
        'defaults': { main: 'system', sub: 'defaults' },
        'data-management': { main: 'system', sub: 'data' },
        'knowledgebase': { main: 'system', sub: 'knowledge' }
    };

    const mapped = mapping[tabName];
    if (mapped) {
        window.state.settingsMainTab = mapped.main;
        window.state.settingsSubTab = mapped.sub;
        renderSettings();
    }
}

// ============================================
// TAB 1: CB PROFILE & BRANDING
// ============================================

function getCBProfileHTML() {
    const settings = window.state.cbSettings || {};

    // Ensure default values exist for color pickers
    if (!settings.primaryColor) settings.primaryColor = '#4f46e5';
    if (!settings.secondaryColor) settings.secondaryColor = '#64748b';

    // Ensure cbSites exists in state to prevent "Office location not found" errors
    if (!settings.cbSites || !Array.isArray(settings.cbSites) || settings.cbSites.length === 0) {
        settings.cbSites = [{
            name: 'Head Office',
            address: settings.cbAddress || '',
            city: '',
            country: '',
            phone: settings.cbPhone || ''
        }];
        // Note: We don't call properties saveData() here to avoid recursive loops, 
        // but it will be saved next time user clicks Save.
    }

    const sites = settings.cbSites;
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i>
                CB Profile & Branding
            </h3>
            <form id="profile-form" data-action-submit="saveCBProfile">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>Certification Body Name <span style="color: var(--danger-color);">*</span></label>
                        <input type="text" class="form-control" id="cb-name" value="${window.UTILS.escapeHtml(settings.cbName)}" required>
                    </div>
                    <div class="form-group">
                        <label>Tagline</label>
                        <input type="text" class="form-control" id="cb-tagline" value="${window.UTILS.escapeHtml(settings.cbTagline)}">
                    </div>
                    <div class="form-group">
                        <label>Email <span style="color: var(--danger-color);">*</span></label>
                        <input type="email" class="form-control" id="cb-email" value="${window.UTILS.escapeHtml(settings.cbEmail)}" required>
                    </div>
                    <div class="form-group">
                        <label>Website</label>
                        <input type="url" class="form-control" id="cb-website" value="${window.UTILS.escapeHtml(settings.cbWebsite)}">
                    </div>
                </div>
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1;">Logo</h4>
                <div style="display: flex; gap: 1.5rem; align-items: start;">
                    <div style="flex: 1;">
                        <div class="form-group">
                            <label>Logo URL</label>
                            <input type="text" class="form-control" id="cb-logo" value="${window.UTILS.escapeHtml(settings.logoUrl || '')}" placeholder="https://...">
                        </div>
                        <div class="form-group">
                            <label>Or Upload Logo</label>
                            <input type="file" class="form-control" id="logo-upload" accept="image/*" data-action-change="handleLogoUpload" data-id="this">
                            <small style="color: var(--text-secondary);">Max 2MB, PNG/JPG/SVG</small>
                        </div>
                    </div>
                    <div id="cb-logo-preview-container" style="width: 150px; height: 150px; border: 2px dashed var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f8fafc;">
                        ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : '<i class="fa-solid fa-image" style="font-size: 3rem; color: var(--text-secondary);"></i>'}
                    </div>
                </div>
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1;">Office Locations</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Office Name</th>
                                <th>Address</th>
                                <th>City</th>
                                <th>Country</th>
                                <th>Phone</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="cb-sites-tbody">
                            ${sites.map((site, idx) => `
                                <tr>
                                    <td>${window.UTILS.escapeHtml(site.name)}</td>
                                    <td>${window.UTILS.escapeHtml(site.address)}</td>
                                    <td>${window.UTILS.escapeHtml(site.city || '')}</td>
                                    <td>${window.UTILS.escapeHtml(site.country || '')}</td>
                                    <td>${window.UTILS.escapeHtml(site.phone || '')}</td>
                                    <td>
                                        <button type="button" class="btn btn-sm btn-icon" data-action="editCBSite" data-id="${idx}" title="Edit" aria-label="Edit">
                                            <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                        </button>
                                        ${sites.length > 1 ? `
                                            <button type="button" class="btn btn-sm btn-icon" data-action="deleteCBSite" data-id="${idx}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-secondary" data-action="addCBSite" style="margin-top: 0.5rem;" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    Add Office Location
                </button>
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1;">Brand Colors</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 500px;">
                    <div class="form-group">
                        <label>Primary Color</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="color" id="primary-color" value="${settings.primaryColor}" style="width: 60px; height: 40px; border: 1px solid var(--border-color); border-radius: 4px;">
                            <input type="text" class="form-control" value="${settings.primaryColor}" readonly style="flex: 1;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Secondary Color</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="color" id="secondary-color" value="${settings.secondaryColor}" style="width: 60px; height: 40px; border: 1px solid var(--border-color); border-radius: 4px;">
                            <input type="text" class="form-control" value="${settings.secondaryColor}" readonly style="flex: 1;">
                        </div>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;" aria-label="Save">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Profile
                </button>
            </form>
        </div>
    `;
}

window.saveCBProfile = function () {
    try {
        const settings = window.state.cbSettings;

        // Only access elements that exist in the form
        const cbName = document.getElementById('cb-name');
        const cbTagline = document.getElementById('cb-tagline');
        const cbEmail = document.getElementById('cb-email');
        const cbWebsite = document.getElementById('cb-website');
        const cbLogo = document.getElementById('cb-logo');
        const primaryColor = document.getElementById('primary-color');
        const secondaryColor = document.getElementById('secondary-color');

        if (cbName) settings.cbName = cbName.value;
        if (cbTagline) settings.cbTagline = cbTagline.value;
        if (cbEmail) settings.cbEmail = cbEmail.value;
        if (cbWebsite) settings.cbWebsite = cbWebsite.value;
        if (cbLogo) settings.logoUrl = cbLogo.value;
        if (primaryColor) settings.primaryColor = primaryColor.value;
        if (secondaryColor) settings.secondaryColor = secondaryColor.value;

        window.saveData();

        // Sync settings to Supabase
        window.DataService.syncSettings({ saveLocal: false });

        window.showNotification('CB Profile saved successfully', 'success');

        // Update sidebar header logo
        if (window.updateCBLogoDisplay) window.updateCBLogoDisplay();
    } catch (error) {
        console.error('Error saving CB Profile:', error);
        window.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    }
};

// Helper function to update form fields from state (after Supabase sync)
function updateSettingsFormFields() {
    const settings = window.state.cbSettings;
    if (!settings) return;

    const cbName = document.getElementById('cb-name');
    const cbTagline = document.getElementById('cb-tagline');
    const cbEmail = document.getElementById('cb-email');
    const cbWebsite = document.getElementById('cb-website');
    const cbLogo = document.getElementById('cb-logo');
    const primaryColor = document.getElementById('primary-color');
    const secondaryColor = document.getElementById('secondary-color');

    if (cbName && settings.cbName) cbName.value = settings.cbName;
    if (cbTagline && settings.cbTagline) cbTagline.value = settings.cbTagline;
    if (cbEmail && settings.cbEmail) cbEmail.value = settings.cbEmail;
    if (cbWebsite && settings.cbWebsite) cbWebsite.value = settings.cbWebsite;
    if (cbLogo && settings.logoUrl) cbLogo.value = settings.logoUrl;
    if (primaryColor && settings.primaryColor) primaryColor.value = settings.primaryColor;
    if (secondaryColor && settings.secondaryColor) secondaryColor.value = settings.secondaryColor;

    // Update logo preview
    const logoPreview = document.querySelector('.logo-preview img');
    if (logoPreview && settings.logoUrl) {
        logoPreview.src = settings.logoUrl;
    }

    // Ensure cbSites exists in state (Supabase might not have them)
    if (!settings.cbSites || !Array.isArray(settings.cbSites) || settings.cbSites.length === 0) {
        settings.cbSites = [{
            name: 'Head Office',
            address: settings.cbAddress || '',
            city: '',
            country: '',
            phone: ''
        }];
    }

    // Re-render Office Locations Table
    const tbody = document.getElementById('cb-sites-tbody');
    if (tbody) {
        tbody.innerHTML = settings.cbSites.map((site, idx) => `
            <tr>
                <td>${window.UTILS.escapeHtml(site.name)}</td>
                <td>${window.UTILS.escapeHtml(site.address)}</td>
                <td>${window.UTILS.escapeHtml(site.city || '')}</td>
                <td>${window.UTILS.escapeHtml(site.country || '')}</td>
                <td>${window.UTILS.escapeHtml(site.phone || '')}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-icon" data-action="editCBSite" data-id="${idx}" title="Edit" aria-label="Edit">
                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                    </button>
                    ${settings.cbSites.length > 1 ? `
                        <button type="button" class="btn btn-sm btn-icon" data-action="deleteCBSite" data-id="${idx}" title="Delete" aria-label="Delete">
                            <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

}

window.handleLogoUpload = function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            window.showNotification('File is too large. Max size is 2MB.', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;

            // Update URL input (which is used by saveCBProfile)
            const urlInput = document.getElementById('cb-logo');
            if (urlInput) urlInput.value = dataUrl;

            // Update Preview
            const container = document.getElementById('cb-logo-preview-container');
            if (container) {
                container.innerHTML = `<img src="${dataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            }
        };
        reader.readAsDataURL(file);
    }
};

// ============================================
// TAB 2: ACCREDITATION & SCOPE
// ============================================

function getAccreditationHTML() {
    const settings = window.state.cbSettings || {};
    const standardsOffered = settings.standardsOffered || [];
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-certificate" style="margin-right: 0.5rem;"></i>
                Accreditation & Scope
            </h3>
            <form id="accreditation-form" data-action-submit="saveAccreditation">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>Accreditation Body</label>
                        <input type="text" class="form-control" id="ab-name" value="${window.UTILS.escapeHtml(settings.accreditationBody)}">
                    </div>
                    <div class="form-group">
                        <label>Accreditation Number</label>
                        <input type="text" class="form-control" id="ab-number" value="${window.UTILS.escapeHtml(settings.accreditationNumber)}">
                    </div>
                    <div class="form-group">
                        <label>Accreditation Expiry</label>
                        <input type="date" class="form-control" id="ab-expiry" value="${(settings.accreditationExpiry && settings.accreditationExpiry !== 'undefined') ? settings.accreditationExpiry : ''}">
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="iaf-mla" ${settings.iafMlaStatus ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>IAF MLA Signatory</span>
                        </label>
                    </div>
                </div>
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1; display: flex; align-items: center; justify-content: space-between;">
                    Standards Masterlist
                    <button class="btn btn-sm btn-secondary" data-action="addStandardToMasterlist" title="Add new standard to masterlist" aria-label="Add">
                        <i class="fa-solid fa-plus"></i> Add New
                    </button>
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem;">
                    ${(settings.availableStandards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 50001:2018', 'ISO 22000:2018']).map(std => `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0; flex: 1;">
                            <input type="checkbox" class="standard-checkbox" value="${std}" ${standardsOffered.includes(std) ? 'checked' : ''}>
                                <span style="font-size: 0.9rem;">${std}</span>
                            </label>
                            <button type="button" class="btn btn-sm btn-icon" data-action="deleteStandardFromMasterlist" data-id="${std}" title="Remove from Masterlist" style="color: #cbd5e1; padding: 0;" aria-label="Close">
                                <i class="fa-solid fa-times hover-danger"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <style>
                    .hover-danger:hover { color: var(--danger-color) !important; }
                </style>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;" aria-label="Save">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Accreditation
                </button>
            </form>
        </div>
    `;
}

// Note: saveAccreditation defined in sanitized save functions section (~line 2603)

window.addStandardToMasterlist = function () {
    document.getElementById('modal-title').textContent = 'Add New Standard';
    document.getElementById('modal-body').innerHTML = `
        <form id="add-standard-form">
            <div class="form-group">
                <label>Standard Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="new-standard-name" placeholder="e.g., ISO 13485:2016" required>
            </div>
            <div class="alert alert-info" style="margin-top: 1rem; padding: 0.75rem; background: #e0f2fe; color: #0284c7; border-radius: 4px; border: 1px solid #bae6fd;">
                <i class="fa-solid fa-info-circle"></i> This will add the standard to the masterlist. You can then select it as "Offered" in the accreditation settings.
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const std = document.getElementById('new-standard-name').value;

        if (!std || !std.trim()) {
            window.showNotification('Please enter a standard name', 'error');
            return;
        }

        const settings = window.state.cbSettings;
        if (!settings.availableStandards) {
            settings.availableStandards = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 50001:2018', 'ISO 22000:2018'];
        }

        const cleanStd = std.trim();
        if (!settings.availableStandards.includes(cleanStd)) {
            settings.availableStandards.push(cleanStd);
            window.saveData();

            if (window.SupabaseClient?.isInitialized) {
                await window.DataService.syncSettings({ saveLocal: false, silent: true });
            }

            window.closeModal();
            switchSettingsTab('accreditation', document.querySelectorAll('.tab-btn')[3]);
            window.showNotification('Standard added to masterlist', 'success');
        } else {
            window.showNotification('Standard already exists', 'warning');
        }
    };

    window.openModal();
};

window.deleteStandardFromMasterlist = function (std) {
    if (confirm(`Are you sure you want to remove ${std} from the masterlist?`)) {
        const settings = window.state.cbSettings;
        settings.availableStandards = settings.availableStandards.filter(s => s !== std);
        settings.standardsOffered = settings.standardsOffered.filter(s => s !== std);

        window.saveData();
        switchSettingsTab('accreditation', document.querySelectorAll('.tab-btn')[3]);
        window.showNotification('Standard removed', 'success');
    }
};

// ============================================
// TAB 3: ORGANIZATION STRUCTURE
// ============================================

function getOrganizationHTML() {
    const orgStructure = window.state.orgStructure || [];
    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color);">
                    <i class="fa-solid fa-sitemap" style="margin-right: 0.5rem;"></i>
                    Organization Structure
                </h3>
                ${window.state.currentUser?.role === 'Admin' ? `
                <button class="btn btn-primary" data-action="addGlobalDesignation" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    Add Designation
                </button>
                ` : ''}
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Department</th>
                            <th>Reports To</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orgStructure.map(pos => `
                            <tr>
                                <td><strong>${window.UTILS.escapeHtml(pos.title)}</strong></td>
                                <td>${window.UTILS.escapeHtml(pos.department)}</td>
                                <td>${pos.reportsTo ? window.UTILS.escapeHtml(pos.reportsTo) : '<em>Top Level</em>'}</td>
                                <td>
                                    ${window.state.currentUser?.role === 'Admin' ? `
                                    <button class="btn btn-sm btn-icon" data-action="editGlobalDesignation" data-id="${pos.id}" title="Edit" aria-label="Edit">
                                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" data-action="deleteGlobalDesignation" data-id="${pos.id}" title="Delete" aria-label="Delete">
                                        <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                    </button>
                                    ` : '<span style="color:var(--text-secondary); font-size:0.8rem;">View Only</span>'}
                                </td>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.addGlobalDesignation = function () {
    document.getElementById('modal-title').textContent = 'Add Designation';
    document.getElementById('modal-body').innerHTML = `
    <form id="designation-form">
            <div class="form-group">
                <label>Title <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="designation-title" required>
            </div>
            <div class="form-group">
                <label>Department</label>
                <input type="text" class="form-control" id="designation-dept">
            </div>
            <div class="form-group">
                <label>Reports To</label>
                <input type="text" class="form-control" id="designation-reports">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = async () => {
        const title = document.getElementById('designation-title').value.trim();
        if (!title) return;

        window.state.orgStructure.push({
            id: Date.now(),
            title: window.Sanitizer.sanitizeText(title),
            department: window.Sanitizer.sanitizeText(document.getElementById('designation-dept').value.trim()),
            reportsTo: window.Sanitizer.sanitizeText(document.getElementById('designation-reports').value.trim()) || null
        });

        window.saveData();

        if (window.SupabaseClient?.isInitialized) {
            await window.DataService.syncSettings({ saveLocal: false, silent: true });
        }

        window.closeModal();
        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation added', 'success');
    };

    window.openModal();
};

window.editGlobalDesignation = function (id) {
    const designation = window.state.orgStructure.find(p => p.id === id);
    if (!designation) return;

    document.getElementById('modal-title').textContent = 'Edit Designation';
    document.getElementById('modal-body').innerHTML = `
    <form id="designation-form">
            <div class="form-group">
                <label>Title <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="designation-title" value="${window.UTILS.escapeHtml(designation.title)}" required>
            </div>
            <div class="form-group">
                <label>Department</label>
                <input type="text" class="form-control" id="designation-dept" value="${window.UTILS.escapeHtml(designation.department || '')}">
            </div>
            <div class="form-group">
                <label>Reports To</label>
                <input type="text" class="form-control" id="designation-reports" value="${window.UTILS.escapeHtml(designation.reportsTo || '')}">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = async () => {
        const title = document.getElementById('designation-title').value.trim();
        if (!title) return;

        designation.title = window.Sanitizer.sanitizeText(title);
        designation.department = window.Sanitizer.sanitizeText(document.getElementById('designation-dept').value.trim());
        designation.reportsTo = window.Sanitizer.sanitizeText(document.getElementById('designation-reports').value.trim()) || null;

        window.saveData();
        window.closeModal();
        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation updated', 'success');
    };

    window.openModal();
};

window.deleteGlobalDesignation = async function (id) {
    if (confirm('Delete this designation?')) {
        window.state.orgStructure = window.state.orgStructure.filter(p => p.id !== id);
        window.saveData();

        if (window.SupabaseClient?.isInitialized) {
            await window.DataService.syncSettings({ saveLocal: false, silent: true });
        }

        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation deleted', 'success');
    }
};

// ============================================
// TAB 3b: USER MANAGEMENT
// => Extracted to settings-users.js
// ============================================
// ============================================
// TAB 4: ROLE PERMISSIONS
// ============================================


function getPermissionsHTML() {
    const permissions = window.state.rolePermissions;
    const modules = ['dashboard', 'clients', 'auditors', 'audits', 'certs', 'reports', 'settings'];
    const roles = Object.keys(permissions);

    const config = {
        'full': { color: '#059669', icon: 'fa-check-circle', label: 'Full Access' },
        'partial': { color: '#0ea5e9', icon: 'fa-circle-half-stroke', label: 'Partial / Limited Edit' },
        'view': { color: '#f59e0b', icon: 'fa-eye', label: 'View Only' },
        'assigned': { color: '#0284c7', icon: 'fa-clipboard-user', label: 'Assigned Only' },
        'own': { color: '#8b5cf6', icon: 'fa-user', label: 'Own Data' },
        'none': { color: '#64748b', icon: 'fa-ban', label: 'No Access' }
    };

    return `
        <div class="fade-in">
            <style>
                .perm-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    min-width: 95px;
                    justify-content: left;
                    user-select: none;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .perm-badge:hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                .perm-badge:active {
                    transform: translateY(0);
                    filter: brightness(0.95);
                }
                .perm-cell {
                    text-align: center;
                    padding: 8px 12px !important;
                    vertical-align: middle;
                }
                .role-row {
                    transition: background-color 0.2s;
                }
                .role-row:hover {
                    background-color: #f8fafc;
                }
                .legend-item {
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    font-size: 0.85rem; 
                    color: #475569; 
                    background: white; 
                    padding: 6px 10px; 
                    border-radius: 8px; 
                    border: 1px solid #e2e8f0;
                }
            </style>

            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-user-shield" style="margin-right: 0.5rem;"></i>
                User Role Permissions
            </h3>
            
            <div class="table-container" style="overflow: visible; background: transparent; border: none; box-shadow: none;">
                <table style="border-collapse: separate; border-spacing: 0 6px; width: 100%;">
                    <thead>
                        <tr>
                            <th style="background: transparent; border: none; font-size: 0.95rem; color: var(--text-secondary); font-weight: 600; padding: 0 12px 8px;">Role</th>
                            ${modules.map(m => `<th style="text-transform: capitalize; text-align: center; background: transparent; border: none; font-size: 0.9rem; color: var(--text-secondary); font-weight: 600; padding: 0 12px 8px;">${m}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${roles.map(role => `
                            <tr class="role-row" style="background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-radius: 12px;">
                                <td style="font-weight: 600; color: #334155; border-radius: 8px 0 0 8px; padding: 12px 16px; border: 1px solid #f1f5f9; border-right: none;">${role}</td>
                                ${modules.map((module, idx) => {
        const perm = permissions[role][module];
        const style = config[perm] || config['none'];
        const isLast = idx === modules.length - 1;
        return `<td class="perm-cell" style="border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; ${isLast ? 'border-right: 1px solid #f1f5f9; border-radius: 0 8px 8px 0;' : ''}">
                                        <span class="perm-badge" 
                                            data-action="cyclePermission" data-arg1="${role}" data-arg2="${module}" 
                                            style="background: ${style.color};"
                                            title="Current: ${style.label}\nClick to cycle permission">
                                            <i class="fa-solid ${style.icon}" style="width: 16px; text-align: center;"></i>
                                            ${perm.charAt(0).toUpperCase() + perm.slice(1)}
                                        </span>
                                    </td>`;
    }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; font-size: 0.95rem; color: #475569; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-circle-info" style="color: var(--primary-color);"></i>
                        Permission Levels Legend
                    </h4>
                    <button class="btn btn-sm btn-outline-danger" data-action="resetPermissions" aria-label="Undo">
                        <i class="fa-solid fa-rotate-left" style="margin-right: 0.5rem;"></i> Reset Defaults
                    </button>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                    ${Object.entries(config).map(([key, value]) => `
                        <div class="legend-item">
                            <span style="width: 20px; height: 20px; border-radius: 50%; background: ${value.color}; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.65rem;">
                                <i class="fa-solid ${value.icon}"></i>
                            </span>
                            <span><strong style="text-transform: capitalize;">${key}:</strong> ${value.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

window.resetPermissions = function () {
    if (!confirm('Are you sure you want to reset all role permissions to their system defaults? This cannot be undone.')) return;

    window.state.rolePermissions = {
        'Admin': { dashboard: 'full', clients: 'full', auditors: 'full', audits: 'full', certs: 'full', reports: 'full', settings: 'full' },
        'Cert Manager': { dashboard: 'view', clients: 'full', auditors: 'view', audits: 'full', certs: 'full', reports: 'full', settings: 'none' },
        'Lead Auditor': { dashboard: 'view', clients: 'partial', auditors: 'view', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Auditor': { dashboard: 'view', clients: 'none', auditors: 'none', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Client': { dashboard: 'none', clients: 'own', auditors: 'none', audits: 'own', certs: 'own', reports: 'own', settings: 'none' }
    };
    window.saveData();
    switchSettingsTab('permissions', document.querySelectorAll('.tab-btn')[3]);
    window.showNotification('Role permissions reset to defaults', 'success');
};





// ============================================
// TAB 5: RECORD RETENTION (Moved from separate module)
// ============================================

function getRetentionHTML() {
    const retentionPolicies = window.state.retentionPolicies || [
        { id: 1, type: 'Audit Reports', period: '6 years', basis: 'ISO 17021-1' },
        { id: 2, type: 'Certificates', period: '10 years', basis: 'Accreditation Requirements' },
        { id: 3, type: 'NCR Evidence', period: '6 years', basis: 'ISO 17021-1' },
        { id: 4, type: 'Training Records', period: '10 years', basis: 'HR Policy' },
        { id: 5, type: 'Impartiality Records', period: '5 years', basis: 'ISO 17021-1' },
        { id: 6, type: 'Management Review Minutes', period: '5 years', basis: 'ISO 17021-1' }
    ];

    // Ensure policies are saved to state
    if (!window.state.retentionPolicies) {
        window.state.retentionPolicies = retentionPolicies;
        window.saveData();
    }

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-archive" style="margin-right: 0.5rem;"></i>
                    Record Retention Policy
                </h3>
                <button class="btn btn-primary" data-action="addRetentionPolicy" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    Add Policy
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Record Type</th>
                            <th>Retention Period</th>
                            <th>Legal Basis</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${retentionPolicies.map(policy => `
                            <tr>
                                <td><strong>${window.UTILS.escapeHtml(policy.type)}</strong></td>
                                <td><span class="badge bg-blue">${window.UTILS.escapeHtml(policy.period)}</span></td>
                                <td>${window.UTILS.escapeHtml(policy.basis)}</td>
                                <td>
                                    <button class="btn btn-sm btn-icon" data-action="editRetentionPolicy" data-id="${policy.id}" title="Edit" aria-label="Edit">
                                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" data-action="deleteRetentionPolicy" data-id="${policy.id}" title="Delete" aria-label="Delete">
                                        <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                <small style="color: #0369a1;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    ISO 17021-1 Clause 8.4 requires retention of records for at least one certification cycle (typically 3 years) or as required by law.
                </small>
            </div>
        </div>
    `;
}

// ============================================
// TAB 6: QUALITY POLICY & OBJECTIVES
// ============================================

function getQualityPolicyHTML() {
    const settings = window.state.cbSettings || {};
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem;"></i>
                Quality Policy & Objectives (ISO 17021 Clause 8.1)
            </h3>
            
            <form id="policy-form" data-action-submit="saveQualityPolicy">
                <div class="form-group">
                    <label>Quality Policy Statement</label>
                    <textarea class="form-control" id="quality-policy" rows="4">${window.UTILS.escapeHtml(settings.qualityPolicy)}</textarea>
                </div>
                
                <div class="form-group">
                    <label>Scope of Management System</label>
                    <textarea class="form-control" id="ms-scope" rows="2">${window.UTILS.escapeHtml(settings.msScope)}</textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>Last Reviewed</label>
                        <input type="date" class="form-control" id="policy-reviewed" value="${(settings.policyLastReviewed && settings.policyLastReviewed !== 'undefined') ? settings.policyLastReviewed : ''}">
                    </div>
                    <div class="form-group">
                        <label>Approved By</label>
                        <input type="text" class="form-control" id="policy-approved" value="${window.UTILS.escapeHtml(settings.policyApprovedBy)}">
                    </div>
                </div>
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1;">Quality Objectives</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Objective</th>
                                <th>Target</th>
                                <th>Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(settings.qualityObjectives || []).map((obj, _idx) => `
                                <tr>
                                    <td>${window.UTILS.escapeHtml(obj.objective)}</td>
                                    <td><span class="badge bg-orange">${window.UTILS.escapeHtml(obj.target)}</span></td>
                                    <td><span class="badge bg-green">${window.UTILS.escapeHtml(obj.actual)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;" aria-label="Save">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Policy
                </button>
            </form>
        </div>
    `;
}

// Note: saveQualityPolicy defined in sanitized save functions section (~line 2621)

// ============================================
// TAB 7: SYSTEM DEFAULTS
// ============================================

function getDefaultsHTML() {
    const settings = window.state.cbSettings;
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-sliders" style="margin-right: 0.5rem;"></i>
                System Defaults
            </h3>
            
            <form id="defaults-form" data-action-submit="saveDefaults">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label>Certificate Number Format</label>
                        <input type="text" class="form-control" id="cert-format" value="${window.UTILS.escapeHtml(settings.certificateNumberFormat)}">
                        <small style="color: var(--text-secondary);">Use {YEAR}, {SEQ}, {STANDARD}</small>
                    </div>
                    <div class="form-group">
                        <label>Date Format</label>
                        <select class="form-control" id="date-format">
                            <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                            <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY" ${settings.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Default Stage 1 Duration (days)</label>
                        <input type="number" class="form-control" id="stage1-duration" value="${settings.defaultStage1Duration}" min="1">
                    </div>
                    <div class="form-group">
                        <label>Default Stage 2 Duration (days)</label>
                        <input type="number" class="form-control" id="stage2-duration" value="${settings.defaultStage2Duration}" min="1">
                    </div>
                    <div class="form-group">
                        <label>Notification Lead Time (days)</label>
                        <input type="number" class="form-control" id="notification-lead" value="${settings.notificationLeadTime}" min="1">
                    </div>
                    <div class="form-group">
                        <label>Session Timeout (minutes)</label>
                        <input type="number" class="form-control" id="session-timeout" value="${settings.sessionTimeout}" min="5">
                    </div>
                    <div class="form-group">
                        <label>Currency</label>
                        <select class="form-control" id="currency">
                            <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                            <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Man-Day Calculation</label>
                        <select class="form-control" id="manday-mode">
                            <option value="ISO 17021" ${settings.manDayCalculationMode === 'ISO 17021' ? 'selected' : ''}>ISO 17021</option>
                            <option value="Custom" ${settings.manDayCalculationMode === 'Custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;" aria-label="Save">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Defaults
                </button>
            </form>
        </div>
    `;
}

// Note: saveDefaults defined in sanitized save functions section (~line 2637)

// ============================================
// TAB 8: DATA BACKUP & MANAGEMENT
// ============================================

// eslint-disable-next-line no-unused-vars
function getDataManagementHTML() {
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-database" style="margin-right: 0.5rem;"></i>
                Data Backup & Management
            </h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                        <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i> Backup Data
                    </h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                        Download a complete backup of your application data as JSON.
                    </p>
                    <button class="btn btn-primary" data-action="backupData" aria-label="Download">
                        <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i>
                        Download Backup
                    </button>
                </div>

                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--danger-color);">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i> Restore Data
                    </h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                        Upload a backup file to restore data. 
                        <strong style="color: var(--danger-color);">Warning: Replaces all current data.</strong>
                    </p>
                    <input type="file" id="restore-file" accept=".json" style="display: none;" data-action-change="restoreData" data-id="this">
                    <button class="btn btn-secondary" data-action="clickElement" data-id="restore-file" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>
                        Select Backup File
                    </button>
                </div>
            </div>

            <div style="margin-top: 2rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border-left: 4px solid var(--primary-color);">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i> Data Privacy
                </h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                    All data is stored locally in your browser (LocalStorage). Clearing browser cache will delete this data unless backed up.
                </p>
            </div>
        </div>
    `;
}

// ============================================
// TAB 9: CB POLICIES & CRITERIA (ISO 17021 Clause 9.9)
// ============================================

function getCBPoliciesHTML() {
    const policies = window.state.cbPolicies;

    // Safety check: Ensure ncrCriteria exists
    if (!policies.ncrCriteria) {
        policies.ncrCriteria = {
            major: [
                'Complete absence of a required process or procedure',
                'Systematic failure affecting product/service conformity',
                'Breakdown of the management system or major element',
                'A minor NC from previous audit not corrected within agreed timeframe',
                'Significant risk to health, safety, or environment',
                'Fraudulent or misleading records or data'
            ],
            minor: [
                'Isolated lapse in following a documented procedure',
                'Single instance of incomplete documentation',
                'Minor gap in record keeping that does not affect system effectiveness',
                'Opportunity to strengthen existing controls identified'
            ],
            observation: [
                'Potential for improvement identified',
                'Emerging risk that may become NC if not addressed',
                'Best practice recommendation',
                'Clarification or enhancement of existing practice'
            ]
        };
    }

    // Safety check: Ensure certDecisionRules exists
    if (!policies.certDecisionRules) {
        policies.certDecisionRules = {
            grant: 'No Major NCs; all Minor NCs have acceptable corrective action plans',
            deny: 'Unresolved Major NCs; multiple critical system failures',
            suspend: 'Major NC identified during surveillance; client request; failure to permit audits',
            withdraw: 'Continued suspension beyond 6 months; fraudulent use of certificate; client request',
            reduce: 'Scope reduction when part of system no longer meets requirements',
            expand: 'Successful audit of additional scope areas'
        };
    }

    // Safety check: Ensure capaTimelines exists
    if (!policies.capaTimelines) {
        policies.capaTimelines = {
            majorCorrection: 90,
            minorCorrection: 30,
            observationResponse: 0,
            capaVerification: 'Before next surveillance or within 90 days'
        };
    }

    // Safety check: Ensure auditFrequency exists
    if (!policies.auditFrequency) {
        policies.auditFrequency = {
            surveillance: '12 months (max)',
            recertification: '36 months',
            transferAudit: 'Before transfer completion'
        };
    }

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-gavel" style="margin-right: 0.5rem;"></i>
                CB Policies & Criteria
            </h3>
            
            <!-- NCR Classification -->
            <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; color: #dc2626;">
                    <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                    NCR Classification Criteria (ISO 17021 Clause 9.9)
                </h4>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <!-- Major NC -->
                    <div style="background: #fef2f2; border-radius: 8px; padding: 1rem; border-left: 4px solid #dc2626;">
                        <h5 style="color: #dc2626; margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-circle-xmark"></i> Major NC
                        </h5>
                        <ul style="font-size: 0.85rem; padding-left: 1.2rem; margin: 0;">
                            ${policies.ncrCriteria.major.map(c => `<li style="margin-bottom: 0.3rem;">${window.UTILS.escapeHtml(c)}</li>`).join('')}
                        </ul>
                        <button class="btn btn-sm" data-action="editNCRCriteria" data-id="major" style="margin-top: 0.5rem; font-size: 0.75rem;" aria-label="Edit">
                            <i class="fa-solid fa-edit"></i> Edit
                        </button>
                    </div>
                    
                    <!-- Minor NC -->
                    <div style="background: #fffbeb; border-radius: 8px; padding: 1rem; border-left: 4px solid #f59e0b;">
                        <h5 style="color: #d97706; margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-circle-exclamation"></i> Minor NC
                        </h5>
                        <ul style="font-size: 0.85rem; padding-left: 1.2rem; margin: 0;">
                            ${policies.ncrCriteria.minor.map(c => `<li style="margin-bottom: 0.3rem;">${window.UTILS.escapeHtml(c)}</li>`).join('')}
                        </ul>
                        <button class="btn btn-sm" data-action="editNCRCriteria" data-id="minor" style="margin-top: 0.5rem; font-size: 0.75rem;" aria-label="Edit">
                            <i class="fa-solid fa-edit"></i> Edit
                        </button>
                    </div>
                    
                    <!-- Observation -->
                    <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; border-left: 4px solid #3b82f6;">
                        <h5 style="color: #1d4ed8; margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-lightbulb"></i> Observation/OFI
                        </h5>
                        <ul style="font-size: 0.85rem; padding-left: 1.2rem; margin: 0;">
                            ${policies.ncrCriteria.observation.map(c => `<li style="margin-bottom: 0.3rem;">${window.UTILS.escapeHtml(c)}</li>`).join('')}
                        </ul>
                        <button class="btn btn-sm" data-action="editNCRCriteria" data-id="observation" style="margin-top: 0.5rem; font-size: 0.75rem;" aria-label="Edit">
                            <i class="fa-solid fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Certification Decisions -->
            <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; color: #059669;">
                    <i class="fa-solid fa-stamp" style="margin-right: 0.5rem;"></i>
                    Certification Decision Rules
                </h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Decision</th>
                                <th>Criteria</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(policies.certDecisionRules).map(([key, value]) => `
                                <tr>
                                    <td><span class="badge" style="background: ${key === 'grant' || key === 'expand' ? '#059669' : key === 'deny' || key === 'withdraw' ? '#dc2626' : '#f59e0b'}; color: white; text-transform: capitalize;">${key}</span></td>
                                    <td>${window.UTILS.escapeHtml(value)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-icon" data-action="editCertDecision" data-id="${key}" title="Edit" aria-label="Edit">
                                            <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- CAPA Timelines & Audit Frequency -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: #7c3aed;">
                        <i class="fa-solid fa-clock" style="margin-right: 0.5rem;"></i>
                        CAPA Timelines
                    </h4>
                    <div class="form-group">
                        <label>Major NC Correction (days)</label>
                        <input type="number" class="form-control" id="capa-major" value="${policies.capaTimelines.majorCorrection}">
                    </div>
                    <div class="form-group">
                        <label>Minor NC Correction (days)</label>
                        <input type="number" class="form-control" id="capa-minor" value="${policies.capaTimelines.minorCorrection}">
                    </div>
                    <div class="form-group">
                        <label>Verification Timing</label>
                        <input type="text" class="form-control" id="capa-verify" value="${window.UTILS.escapeHtml(policies.capaTimelines.capaVerification)}">
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="saveCAPATimelines" aria-label="Save">
                        <i class="fa-solid fa-save"></i> Save Timelines
                    </button>
                </div>
                
                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: #0284c7;">
                        <i class="fa-solid fa-calendar-days" style="margin-right: 0.5rem;"></i>
                        Audit Frequency
                    </h4>
                    <div class="form-group">
                        <label>Surveillance Interval</label>
                        <input type="text" class="form-control" id="freq-surv" value="${window.UTILS.escapeHtml(policies.auditFrequency.surveillance)}">
                    </div>
                    <div class="form-group">
                        <label>Recertification Cycle</label>
                        <input type="text" class="form-control" id="freq-recert" value="${window.UTILS.escapeHtml(policies.auditFrequency.recertification)}">
                    </div>
                    <div class="form-group">
                        <label>Transfer Audit Timing</label>
                        <input type="text" class="form-control" id="freq-transfer" value="${window.UTILS.escapeHtml(policies.auditFrequency.transferAudit)}">
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="saveAuditFrequency" aria-label="Save">
                        <i class="fa-solid fa-save"></i> Save Frequency
                    </button>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #059669; border-radius: 4px;">
                <small style="color: #065f46;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    <strong>ISO 17021-1 Compliance:</strong> These policies define your CB's criteria for audit findings classification (Clause 9.9) and certification decisions (Clause 9.7).
                </small>
            </div>
        </div>
    `;
}

function backupData() {
    try {
        const dataStr = JSON.stringify(window.state, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `auditcb360_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        window.showNotification('Backup downloaded successfully', 'success');
    } catch (_error) {
        window.showNotification('Failed to create backup', 'error');
    }
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.clients || !data.auditors) {
                throw new Error('Invalid backup file format');
            }
            if (confirm('Are you sure you want to restore this data? Current data will be lost.')) {
                Object.assign(window.state, data);
                window.saveData();
                window.showNotification('Data restored successfully. Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            }
        } catch (_error) {
            window.showNotification('Failed to restore data: Invalid file', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}



window.addCBSite = function () {
    document.getElementById('modal-title').textContent = 'Add Office Location';
    document.getElementById('modal-body').innerHTML = `
        <form id="cb-site-form">
            <div class="form-group">
                <label>Office Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-name" placeholder="e.g., Regional Office" required>
            </div>
            <div class="form-group">
                <label>Address <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-address" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>City</label>
                    <input type="text" class="form-control" id="site-city">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" class="form-control" id="site-country">
                </div>
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" class="form-control" id="site-phone">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = async () => {
        const name = document.getElementById('site-name').value.trim();
        const address = document.getElementById('site-address').value.trim();

        if (!name || !address) {
            window.showNotification('Please fill required fields', 'error');
            return;
        }

        // Ensure cbSettings exists
        if (!window.state.cbSettings) {
            window.state.cbSettings = {};
        }
        if (!window.state.cbSettings.cbSites) {
            window.state.cbSettings.cbSites = [];
        }

        window.state.cbSettings.cbSites.push({
            name: window.Sanitizer.sanitizeText(name),
            address: window.Sanitizer.sanitizeText(address),
            city: window.Sanitizer.sanitizeText(document.getElementById('site-city').value.trim()),
            country: window.Sanitizer.sanitizeText(document.getElementById('site-country').value.trim()),
            phone: window.Sanitizer.sanitizeText(document.getElementById('site-phone').value.trim())
        });

        window.saveData();

        if (window.SupabaseClient?.isInitialized) {
            await window.DataService.syncSettings({ saveLocal: false, silent: true });
        }

        window.closeModal();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location added', 'success');
    };

    window.openModal();
};

window.editCBSite = function (idx) {
    // Ensure cbSettings exists
    if (!window.state.cbSettings) {
        window.state.cbSettings = { cbSites: [] };
    }
    if (!window.state.cbSettings.cbSites) {
        window.state.cbSettings.cbSites = [];
    }

    const sites = window.state.cbSettings.cbSites;
    const site = sites[idx];

    if (!site) {
        window.showNotification('Office location not found', 'error');
        return;
    }

    document.getElementById('modal-title').textContent = 'Edit Office Location';
    document.getElementById('modal-body').innerHTML = `
        <form id="cb-site-form">
            <div class="form-group">
                <label>Office Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-name" value="${window.UTILS.escapeHtml(site.name)}" required>
            </div>
            <div class="form-group">
                <label>Address <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-address" value="${window.UTILS.escapeHtml(site.address)}" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>City</label>
                    <input type="text" class="form-control" id="site-city" value="${window.UTILS.escapeHtml(site.city || '')}">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" class="form-control" id="site-country" value="${window.UTILS.escapeHtml(site.country || '')}">
                </div>
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="tel" class="form-control" id="site-phone" value="${window.UTILS.escapeHtml(site.phone || '')}">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = async () => {
        // Update the site directly in state
        window.state.cbSettings.cbSites[idx] = {
            name: window.Sanitizer.sanitizeText(document.getElementById('site-name').value.trim()),
            address: window.Sanitizer.sanitizeText(document.getElementById('site-address').value.trim()),
            city: window.Sanitizer.sanitizeText(document.getElementById('site-city').value.trim()),
            country: window.Sanitizer.sanitizeText(document.getElementById('site-country').value.trim()),
            phone: window.Sanitizer.sanitizeText(document.getElementById('site-phone').value.trim())
        };

        window.saveData();

        if (window.SupabaseClient?.isInitialized) {
            await window.DataService.syncSettings({ saveLocal: false, silent: true });
        }

        window.closeModal();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location updated', 'success');
    };

    window.openModal();
};

window.deleteCBSite = async function (idx) {
    if (confirm('Delete this office location?')) {
        window.state.cbSettings.cbSites.splice(idx, 1);
        window.saveData();

        if (window.SupabaseClient?.isInitialized) {
            await window.DataService.syncSettings({ saveLocal: false, silent: true });
        }

        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location deleted', 'success');
    }
};

// ============================================
// SAVE FUNCTIONS WITH SANITIZATION
// ============================================

// Note: saveCBProfile is defined earlier in the file (around line 290)
// Removed duplicate definition that was overriding the fixed version

window.saveAccreditation = async function () {
    const settings = window.state.cbSettings;
    settings.accreditationBody = window.Sanitizer.sanitizeText(document.getElementById('ab-name').value);
    settings.accreditationNumber = window.Sanitizer.sanitizeText(document.getElementById('ab-number').value);
    settings.accreditationExpiry = document.getElementById('ab-expiry').value;
    settings.iafMlaStatus = document.getElementById('iaf-mla').checked;

    settings.standardsOffered = Array.from(document.querySelectorAll('.standard-checkbox:checked')).map(cb => window.Sanitizer.sanitizeText(cb.value));

    window.saveData();

    if (window.SupabaseClient?.isInitialized) {
        await window.DataService.syncSettings({ saveLocal: false, silent: true });
    }

    window.showNotification('Accreditation settings saved', 'success');
};

window.saveQualityPolicy = async function () {
    const settings = window.state.cbSettings;
    settings.qualityPolicy = window.Sanitizer.sanitizeText(document.getElementById('quality-policy').value);
    settings.msScope = window.Sanitizer.sanitizeText(document.getElementById('ms-scope').value);
    settings.policyLastReviewed = document.getElementById('policy-reviewed').value;
    settings.policyApprovedBy = window.Sanitizer.sanitizeText(document.getElementById('policy-approved').value);

    window.saveData();

    if (window.SupabaseClient?.isInitialized) {
        await window.DataService.syncSettings({ saveLocal: false, silent: true });
    }

    window.showNotification('Quality Policy saved', 'success');
};

window.saveDefaults = function () {
    const settings = window.state.cbSettings;
    settings.certificateNumberFormat = window.Sanitizer.sanitizeText(document.getElementById('cert-format').value);
    settings.dateFormat = document.getElementById('date-format').value;
    settings.defaultStage1Duration = parseInt(document.getElementById('stage1-duration', 10).value, 10);
    settings.defaultStage2Duration = parseInt(document.getElementById('stage2-duration', 10).value, 10);
    settings.notificationLeadTime = parseInt(document.getElementById('notification-lead', 10).value, 10);
    settings.sessionTimeout = parseInt(document.getElementById('session-timeout', 10).value, 10);
    settings.currency = document.getElementById('currency').value;
    settings.manDayCalculationMode = document.getElementById('manday-mode').value;

    window.saveData();
    window.showNotification('System defaults saved', 'success');
};

// ============================================
// PERMISSIONS HELPER FUNCTIONS
// ============================================

window.cyclePermission = function (role, module) {
    const permissionLevels = ['none', 'view', 'assigned', 'own', 'partial', 'full'];
    const currentPerm = window.state.rolePermissions[role][module];
    const currentIndex = permissionLevels.indexOf(currentPerm);
    const nextIndex = (currentIndex + 1) % permissionLevels.length;

    window.state.rolePermissions[role][module] = permissionLevels[nextIndex];
    window.saveData();
    switchSettingsTab('permissions', document.querySelectorAll('.tab-btn')[3]);
    window.showNotification(`${role} ${module} permission changed to ${permissionLevels[nextIndex]}`, 'success');
};

// ============================================
// RETENTION POLICY HELPER FUNCTIONS
// ============================================

window.addRetentionPolicy = function () {
    document.getElementById('modal-title').textContent = 'Add Retention Policy';
    document.getElementById('modal-body').innerHTML = `
        <form id="retention-form">
            <div class="form-group">
                <label>Record Type <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-type" placeholder="e.g., Contract Documents" required>
            </div>
            <div class="form-group">
                <label>Retention Period <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-period" placeholder="e.g., 7 years" required>
            </div>
            <div class="form-group">
                <label>Legal Basis <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-basis" placeholder="e.g., Commercial Law" required>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const type = document.getElementById('retention-type').value.trim();
        const period = document.getElementById('retention-period').value.trim();
        const basis = document.getElementById('retention-basis').value.trim();

        if (!type || !period || !basis) {
            window.showNotification('Please fill all required fields', 'error');
            return;
        }

        if (!window.state.retentionPolicies) {
            window.state.retentionPolicies = [];
        }

        const newId = Math.max(...window.state.retentionPolicies.map(p => p.id || 0), 0) + 1;

        window.state.retentionPolicies.push({
            id: newId,
            type: window.Sanitizer.sanitizeText(type),
            period: window.Sanitizer.sanitizeText(period),
            basis: window.Sanitizer.sanitizeText(basis)
        });

        window.saveData();
        window.closeModal();
        switchSettingsTab('retention', document.querySelectorAll('.tab-btn')[4]);
        window.showNotification('Retention policy added', 'success');
    };

    window.openModal();
};

window.editRetentionPolicy = function (policyId) {
    const policy = window.state.retentionPolicies.find(p => p.id === policyId);
    if (!policy) return;

    document.getElementById('modal-title').textContent = 'Edit Retention Policy';
    document.getElementById('modal-body').innerHTML = `
        <form id="retention-form">
            <div class="form-group">
                <label>Record Type <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-type" value="${window.UTILS.escapeHtml(policy.type)}" required>
            </div>
            <div class="form-group">
                <label>Retention Period <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-period" value="${window.UTILS.escapeHtml(policy.period)}" required>
            </div>
            <div class="form-group">
                <label>Legal Basis <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="retention-basis" value="${window.UTILS.escapeHtml(policy.basis)}" required>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        policy.type = window.Sanitizer.sanitizeText(document.getElementById('retention-type').value.trim());
        policy.period = window.Sanitizer.sanitizeText(document.getElementById('retention-period').value.trim());
        policy.basis = window.Sanitizer.sanitizeText(document.getElementById('retention-basis').value.trim());

        window.saveData();
        window.closeModal();
        switchSettingsTab('retention', document.querySelectorAll('.tab-btn')[4]);
        window.showNotification('Retention policy updated', 'success');
    };

    window.openModal();
};

window.deleteRetentionPolicy = function (policyId) {
    if (confirm('Delete this retention policy?')) {
        window.state.retentionPolicies = window.state.retentionPolicies.filter(p => p.id !== policyId);
        window.saveData();
        switchSettingsTab('retention', document.querySelectorAll('.tab-btn')[4]);
        window.showNotification('Retention policy deleted', 'success');
    }
};

// ============================================
// CB POLICIES HELPER FUNCTIONS
// ============================================

// Note: cyclePermission, addRetentionPolicy, editRetentionPolicy, deleteRetentionPolicy
// are defined above (~L2613-2725) with proper sanitization. Old restored block removed.
window.editNCRCriteria = function (type) {
    const criteria = window.state.cbPolicies.ncrCriteria[type];
    const labels = { major: 'Major NC', minor: 'Minor NC', observation: 'Observation/OFI' };

    document.getElementById('modal-title').textContent = `Edit ${labels[type]} Criteria`;
    document.getElementById('modal-body').innerHTML = `
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Enter each criteria on a new line:</p>
        <textarea class="form-control" id="ncr-criteria-text" rows="8" style="font-size: 0.9rem;">${criteria.join('\n')}</textarea>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const lines = document.getElementById('ncr-criteria-text').value.split('\n').filter(l => l.trim());
        window.state.cbPolicies.ncrCriteria[type] = lines.map(l => window.Sanitizer.sanitizeText(l.trim()));
        window.saveData();
        window.closeModal();
        switchSettingsTab('cbpolicies', document.querySelectorAll('.tab-btn')[7]);
        window.showNotification(`${labels[type]} criteria updated`, 'success');
    };

    window.openModal();
};

window.editCertDecision = function (decision) {
    const value = window.state.cbPolicies.certDecisionRules[decision];

    document.getElementById('modal-title').textContent = `Edit "${decision}" Decision Rule`;
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Criteria for "${decision}" decision:</label>
            <textarea class="form-control" id="cert-decision-text" rows="4">${window.UTILS.escapeHtml(value)}</textarea>
        </div>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        window.state.cbPolicies.certDecisionRules[decision] = window.Sanitizer.sanitizeText(document.getElementById('cert-decision-text').value.trim());
        window.saveData();
        window.closeModal();
        switchSettingsTab('cbpolicies', document.querySelectorAll('.tab-btn')[7]);
        window.showNotification('Certification decision rule updated', 'success');
    };

    window.openModal();
};

window.saveCAPATimelines = function () {
    window.state.cbPolicies.capaTimelines.majorCorrection = parseInt(document.getElementById('capa-major', 10).value, 10) || 90;
    window.state.cbPolicies.capaTimelines.minorCorrection = parseInt(document.getElementById('capa-minor', 10).value, 10) || 30;
    window.state.cbPolicies.capaTimelines.capaVerification = window.Sanitizer.sanitizeText(document.getElementById('capa-verify').value);
    window.saveData();
    window.showNotification('CAPA timelines saved', 'success');
};

window.saveAuditFrequency = function () {
    window.state.cbPolicies.auditFrequency.surveillance = window.Sanitizer.sanitizeText(document.getElementById('freq-surv').value);
    window.state.cbPolicies.auditFrequency.recertification = window.Sanitizer.sanitizeText(document.getElementById('freq-recert').value);
    window.state.cbPolicies.auditFrequency.transferAudit = window.Sanitizer.sanitizeText(document.getElementById('freq-transfer').value);
    window.saveData();
    window.showNotification('Audit frequency saved', 'success');
};

// Export functions
window.renderSettings = renderSettings;
window.switchSettingsTab = switchSettingsTab;
window.backupData = backupData;
window.restoreData = restoreData;


// ============================================
// KNOWLEDGE BASE MODULE
// => Extracted to settings-kb.js
// ============================================


// ============================================
// TAB: AUDITOR-CLIENT ASSIGNMENTS
// ============================================
// Manage which auditors are assigned to which clients
// Auditors only see clients they are assigned to

// eslint-disable-next-line no-unused-vars
function getAssignmentsHTML() {
    const assignments = window.state.auditorAssignments || [];
    const auditors = window.state.auditors || [];
    const clients = window.state.clients || [];

    // Build assignment matrix
    const auditorAssignmentMap = {};
    auditors.forEach(a => {
        auditorAssignmentMap[a.id] = {
            auditor: a,
            assignedClients: assignments
                .filter(asn => asn.auditorId === a.id)
                .map(asn => clients.find(c => c.id === asn.clientId))
                .filter(c => c)
        };
    });

    return `
            <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="color: var(--primary-color); margin: 0;">
                        <i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i>
                        Auditor-Client Assignments
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                        Assign auditors to specific clients. Auditors will only see their assigned clients in the dashboard, planning, and reports.
                    </p>
                </div>
                <button class="btn btn-primary" data-action="openAddAssignmentModal" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    New Assignment
                </button>
            </div>

            <!--Info Box-- >
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 1rem; align-items: start;">
                    <i class="fa-solid fa-info-circle" style="font-size: 1.25rem; color: #2563eb; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: #1e40af;">Role-Based Visibility</strong>
                        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem; color: #1e40af; font-size: 0.9rem;">
                            <li><strong>Admins & Cert Managers:</strong> See all clients, plans, and reports.</li>
                            <li><strong>Lead Auditors & Auditors:</strong> Only see clients they are assigned to.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!--Assignment Cards by Auditor-- >
            <div style="display: grid; gap: 1.5rem;">
                ${auditors.map(auditor => {
        const data = auditorAssignmentMap[auditor.id];
        const assignedClients = data.assignedClients || [];

        return `
                        <div class="card" style="margin: 0; padding: 1.5rem; border-left: 4px solid ${auditor.role === 'Lead Auditor' ? '#0ea5e9' : '#6366f1'};">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 48px; height: 48px; border-radius: 50%; background: ${auditor.role === 'Lead Auditor' ? '#e0f2fe' : '#eef2ff'}; color: ${auditor.role === 'Lead Auditor' ? '#0284c7' : '#4f46e5'}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                                        <i class="fa-solid fa-user-tie"></i>
                                    </div>
                                    <div>
                                        <strong style="font-size: 1.1rem;">${window.UTILS.escapeHtml(auditor.name)}</strong>
                                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                            <span class="badge" style="background: ${auditor.role === 'Lead Auditor' ? '#e0f2fe' : '#f1f5f9'}; color: ${auditor.role === 'Lead Auditor' ? '#0284c7' : '#64748b'}; margin-right: 0.5rem;">${window.UTILS.escapeHtml(auditor.role)}</span>
                                            ${auditor.email || ''}
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                    <strong>${assignedClients.length}</strong> client${assignedClients.length !== 1 ? 's' : ''} assigned
                                </div>
                            </div>
                            
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 40px;">
                                ${assignedClients.length > 0 ? assignedClients.map(client => `
                                    <span style="display: inline-flex; align-items: center; gap: 0.5rem; background: #f1f5f9; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem;">
                                        <i class="fa-solid fa-building" style="color: var(--text-secondary);"></i>
                                        ${window.UTILS.escapeHtml(client.name)}
                                        <button data-action="removeAssignment" data-arg1="${auditor.id}" data-arg2="${client.id}" style="background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0 0 0 4px;" title="Remove assignment" aria-label="Remove">
                                            <i class="fa-solid fa-times-circle" style="font-size: 0.9rem;"></i>
                                        </button>
                                    </span>
                                `).join('') : `
                                    <span style="color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 6px 0;">
                                        <i class="fa-solid fa-circle-exclamation" style="margin-right: 0.5rem;"></i>
                                        No clients assigned - auditor won't see any client data
                                    </span>
                                `}
                                <button data-action="openQuickAssignModal" data-arg1="${auditor.id}" data-arg2="${window.UTILS.escapeHtml(auditor.name)}" 
                                    style="background: #e0f2fe; border: 1px dashed #0284c7; color: #0284c7; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 0.85rem;" aria-label="Add">
                                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Client
                                </button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>

            <!--Summary Stats-- >
            <div style="margin-top: 2rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #16a34a;">${auditors.length}</div>
                    <div style="font-size: 0.85rem; color: #166534;">Total Auditors</div>
                </div>
                <div style="background: #eff6ff; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #2563eb;">${clients.length}</div>
                    <div style="font-size: 0.85rem; color: #1e40af;">Total Clients</div>
                </div>
                <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #d97706;">${assignments.length}</div>
                    <div style="font-size: 0.85rem; color: #92400e;">Active Assignments</div>
                </div>
            </div>
        </div>
            `;
}

// Add new assignment modal
window.openAddAssignmentModal = function () {
    const auditors = window.state.auditors || [];
    const clients = window.state.clients || [];

    document.getElementById('modal-title').textContent = 'Create New Assignment';
    document.getElementById('modal-body').innerHTML = `
            < form id = "assignment-form" >
            <div class="form-group">
                <label>Auditor <span style="color: var(--danger-color);">*</span></label>
                <select id="assign-auditor" class="form-control" required>
                    <option value="">-- Select Auditor --</option>
                    ${auditors.map(a => `<option value="${a.id}">${window.UTILS.escapeHtml(a.name)} (${a.role})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Client <span style="color: var(--danger-color);">*</span></label>
                <select id="assign-client" class="form-control" required>
                    <option value="">-- Select Client --</option>
                    ${clients.map(c => `<option value="${c.id}">${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Notes (optional)</label>
                <textarea id="assign-notes" class="form-control" rows="2" placeholder="Any notes about this assignment..."></textarea>
            </div>
        </form >
            `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = saveAssignment;
    window.openModal();
};

// Quick assign modal (for a specific auditor)
window.openQuickAssignModal = function (auditorId, auditorName) {
    const clients = window.state.clients || [];
    const assignments = window.state.auditorAssignments || [];
    const assignedClientIds = assignments.filter(a => a.auditorId === auditorId).map(a => a.clientId);
    const unassignedClients = clients.filter(c => !assignedClientIds.includes(c.id));

    if (unassignedClients.length === 0) {
        window.showNotification('All clients are already assigned to this auditor.', 'info');
        return;
    }

    document.getElementById('modal-title').textContent = `Assign Client to ${auditorName} `;
    document.getElementById('modal-body').innerHTML = `
            < input type = "hidden" id = "assign-auditor" value = "${auditorId}" >
                <div class="form-group">
                    <label>Select Client to Assign</label>
                    <select id="assign-client" class="form-control" required>
                        <option value="">-- Select Client --</option>
                        ${unassignedClients.map(c => `<option value="${c.id}">${window.UTILS.escapeHtml(c.name)} (${c.industry || 'N/A'})</option>`).join('')}
                    </select>
                </div>
        `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = saveAssignment;
    window.openModal();
};

// Save assignment
async function saveAssignment() {
    const auditorId = parseInt(document.getElementById('assign-auditor', 10).value);
    const clientId = parseInt(document.getElementById('assign-client', 10).value);
    const notes = document.getElementById('assign-notes')?.value || '';

    if (!auditorId || !clientId) {
        window.showNotification('Please select both an auditor and a client.', 'error');
        return;
    }

    // Initialize if not exists
    if (!window.state.auditorAssignments) {
        window.state.auditorAssignments = [];
    }

    // Check if assignment already exists
    const exists = window.state.auditorAssignments.find(a => a.auditorId === auditorId && a.clientId === clientId);
    if (exists) {
        window.showNotification('This assignment already exists.', 'warning');
        window.closeModal();
        return;
    }

    // Add new assignment
    window.state.auditorAssignments.push({
        auditorId: auditorId,
        clientId: clientId,
        assignedBy: window.state.currentUser?.name || 'System',
        assignedAt: new Date().toISOString(),
        notes: notes
    });

    await window.DataService.syncAuditorAssignments();

    window.closeModal();
    switchSettingsTab('assignments', document.querySelector('.tab-btn[onclick*="assignments"]'));
    window.showNotification('Assignment created successfully!', 'success');
}

// ============================================
// ACTIVITY LOG TAB
// ============================================

function getActivityLogHTML() {
    const logs = window.AuditTrail?.getLogs() || [];
    const recentLogs = logs.slice(0, 50);

    return `
            <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-history" style="margin-right: 0.5rem;"></i>
                    Activity Log
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline-secondary btn-sm" data-action="AuditTrail_exportCSV" aria-label="Download">
                        <i class="fa-solid fa-download" style="margin-right: 0.25rem;"></i>Export CSV
                    </button>
                    ${window.state.currentUser?.role === 'Admin' ? `
                    <button class="btn btn-outline-danger btn-sm" data-action="clearActivityLogs" aria-label="Delete">
                        <i class="fa-solid fa-trash" style="margin-right: 0.25rem;"></i>Clear Logs
                    </button>
                    ` : ''}
                </div>
            </div>

            <div class="card" style="max-height: 600px; overflow-y: auto;">
                ${recentLogs.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 0;">
                        ${recentLogs.map(log => {
        const style = window.AuditTrail?.getActionStyle(log.action) || { icon: 'fa-circle', color: '#64748b' };
        return `
                            <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: start; gap: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${style.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i class="fa-solid ${style.icon}" style="color: white; font-size: 0.8rem;"></i>
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">
                                        <strong>${window.UTILS.escapeHtml(log.user.name)}</strong>
                                        <span style="color: var(--text-secondary);"> ${log.action}</span>
                                        <span style="color: var(--primary-color);"> ${log.resource}</span>
                                        ${log.resourceName ? ` - ${window.UTILS.escapeHtml(log.resourceName)}` : ''}
                                    </p>
                                    <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #94a3b8;">
                                        ${window.AuditTrail?.formatTime(log.timestamp) || log.timestamp}
                                        ${log.user.role ? ` • ${log.user.role}` : ''}
                                    </p>
                                </div>
                            </div>
                        `;
    }).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-inbox" style="font-size: 2.5rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
                        <p style="margin: 0;">No activity logs yet.</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem;">Actions like login, create, edit, and delete will appear here.</p>
                    </div>
                `}
            </div>
        </div>
            `;
}

// Remove assignment
window.removeAssignment = async function (auditorId, clientId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    const client = window.state.clients.find(c => c.id === clientId);

    const confirmMsg = `Remove "${client?.name || 'client'}" from ${auditor?.name || 'auditor'} 's assignments?

        Note: All audit history, records, and reports involving this auditor will be RETAINED.The auditor will still have access to past audits they participated in.

This only removes future access to new client data.`;

    if (confirm(confirmMsg)) {
        // Use loose equality (===) to handle type mismatches (string vs number)
        window.state.auditorAssignments = window.state.auditorAssignments.filter(
            a => !(a.auditorId === auditorId && a.clientId === clientId)
        );
        window.saveData();
        await window.DataService.deleteAuditorAssignment(auditorId, clientId);

        switchSettingsTab('assignments', document.querySelector('.tab-btn[onclick*="assignments"]'));
        window.showNotification('Assignment removed. Historical audit records retained.', 'success');
    }
};

// ============================================
// USAGE ANALYTICS TAB - COMPREHENSIVE COST MONITORING
// ============================================

function _computePlatformMetrics() {
    const clients = window.state.clients || [];
    const reports = window.state.auditReports || [];
    const plans = window.state.auditPlans || [];
    const checklists = window.state.checklists || [];
    const ncrs = window.state.ncrs || [];
    const auditors = window.state.auditors || [];
    const tracker = window.APIUsageTracker;
    const aiCost = tracker ? tracker.getSummary().totalEstimatedCost : 0;

    // Estimate DB size: ~each JSON record averages these sizes
    const dbSizeKB = (clients.length * 5) + (plans.length * 10) + (reports.length * 50) + (checklists.length * 30) + (ncrs.length * 5) + (auditors.length * 3);
    const dbSizeMB = (dbSizeKB / 1024).toFixed(2);

    // Determine current tier
    let currentTier = 'Free';
    let tierCostMonth = 0;
    if (dbSizeKB > 512000 || clients.length > 500) { currentTier = 'Team'; tierCostMonth = 599; }
    else if (dbSizeKB > 51200 || clients.length > 50) { currentTier = 'Pro'; tierCostMonth = 25; }

    const totalMonthly = tierCostMonth + (aiCost / Math.max(1, Math.ceil((new Date() - new Date(2026, 0, 1)) / (1000 * 60 * 60 * 24 * 30))));
    const totalAnnual = tierCostMonth * 12 + aiCost;
    const costPerClient = clients.length > 0 ? (totalAnnual / clients.length).toFixed(2) : '0.00';

    // Per-client metrics
    const perClient = clients.map(c => {
        const cId = String(c.id);
        const cReports = reports.filter(r => String(r.client) === cId || String(r.clientId) === cId);
        const cPlans = plans.filter(p => String(p.client) === cId || String(p.clientId) === cId);
        const cNcrs = ncrs.filter(n => String(n.clientId) === cId);
        const progressItems = cReports.reduce((sum, r) => sum + (r.checklistProgress?.length || 0), 0);
        const evidenceCount = cReports.reduce((sum, r) => {
            return sum + (r.checklistProgress || []).reduce((s, p) => s + (p.evidenceImages?.length || (p.evidenceImage ? 1 : 0)), 0);
        }, 0);
        const estStorageKB = (cReports.length * 50) + (cPlans.length * 10) + (cNcrs.length * 5) + (evidenceCount * 500);
        return {
            name: c.name, id: c.id, industry: c.industry || '-',
            audits: cReports.length, plans: cPlans.length, ncrs: cNcrs.length,
            progressItems, evidenceCount,
            storageMB: (estStorageKB / 1024).toFixed(2),
            estCost: clients.length > 0 ? (totalAnnual / clients.length).toFixed(2) : '0.00'
        };
    }).sort((a, b) => b.audits - a.audits);

    // Per-standard metrics
    const byStandard = {};
    plans.forEach(p => {
        const std = p.standard || p.certificationStandard || 'Unknown';
        if (!byStandard[std]) byStandard[std] = { audits: 0, clients: new Set(), checklists: 0, ncrs: 0, avgItems: [] };
        byStandard[std].audits++;
        if (p.client || p.clientId) byStandard[std].clients.add(String(p.client || p.clientId));
    });
    reports.forEach(r => {
        const plan = plans.find(p => String(p.id) === String(r.planId));
        if (plan) {
            const std = plan.standard || plan.certificationStandard || 'Unknown';
            if (byStandard[std]) {
                byStandard[std].ncrs += (r.checklistProgress || []).filter(p => p.status === 'nc').length;
                byStandard[std].avgItems.push(r.checklistProgress?.length || 0);
            }
        }
    });
    const standards = Object.entries(byStandard).map(([name, d]) => ({
        name, audits: d.audits, clients: d.clients.size, ncrs: d.ncrs,
        avgItems: d.avgItems.length > 0 ? Math.round(d.avgItems.reduce((a, b) => a + b, 0) / d.avgItems.length) : 0,
        estCostPerAudit: d.avgItems.length > 0 ? ((d.avgItems.reduce((a, b) => a + b, 0) / d.avgItems.length) * 0.0001).toFixed(4) : '0.05'
    })).sort((a, b) => b.audits - a.audits);

    return { clients, reports, plans, checklists, ncrs, auditors, aiCost, dbSizeMB, dbSizeKB, currentTier, tierCostMonth, totalMonthly, totalAnnual, costPerClient, perClient, standards };
}

function _tierBar(used, limit, label, unit = 'MB') {
    const pct = Math.min(100, (used / limit * 100)).toFixed(1);
    const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
    return `
        <div style="margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                <span style="color: #475569;">${label}</span>
                <span style="font-weight: 600; color: ${color};">${typeof used === 'number' ? used.toFixed(1) : used} / ${limit} ${unit} (${pct}%)</span>
            </div>
            <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 4px; transition: width 0.5s;"></div>
            </div>
        </div>`;
}

function getUsageAnalyticsHTML() {
    const tracker = window.APIUsageTracker;
    if (!tracker) {
        return `<div class="fade-in"><div class="alert alert-warning"><i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>API Usage Tracker module not loaded. Please refresh.</div></div>`;
    }

    const m = _computePlatformMetrics();
    const summary = tracker.getSummary();
    const todayUsage = tracker.getUsageByPeriod('today');
    const monthUsage = tracker.getUsageByPeriod('month');
    const features = Object.entries(summary.byFeature || {});

    return `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                    Platform Cost & Usage Analytics
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline-secondary btn-sm" data-action="APIUsageTracker_exportData" aria-label="Download">
                        <i class="fa-solid fa-download" style="margin-right: 0.25rem;"></i>Export
                    </button>
                    <button class="btn btn-outline-danger btn-sm" data-action="resetUsageData" aria-label="Delete">
                        <i class="fa-solid fa-trash" style="margin-right: 0.25rem;"></i>Reset
                    </button>
                </div>
            </div>

            <!-- ===================== SECTION 1: PLATFORM COST OVERVIEW ===================== -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f766e 100%); color: white; padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <i class="fa-solid fa-coins" style="font-size: 1.25rem;"></i>
                    <strong style="font-size: 1.1rem;">Total Platform Cost Overview</strong>
                    <span style="background: rgba(255,255,255,0.15); padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; margin-left: 0.5rem;">
                        ${m.currentTier} Tier
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
                    <div style="background: rgba(255,255,255,0.08); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 0.75rem; opacity: 0.7;">Supabase</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">$${m.tierCostMonth}</div>
                        <div style="font-size: 0.7rem; opacity: 0.6;">/month</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 0.75rem; opacity: 0.7;">AI (Gemini)</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${tracker.formatCost(m.aiCost)}</div>
                        <div style="font-size: 0.7rem; opacity: 0.6;">all-time</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="font-size: 0.75rem; opacity: 0.7;">Hosting (Vercel)</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">$0</div>
                        <div style="font-size: 0.7rem; opacity: 0.6;">Free tier</div>
                    </div>
                    <div style="background: rgba(16,185,129,0.2); padding: 1rem; border-radius: 12px; text-align: center; border: 1px solid rgba(16,185,129,0.4);">
                        <div style="font-size: 0.75rem; opacity: 0.7;">Annual Total</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #6ee7b7;">$${m.totalAnnual.toFixed(0)}</div>
                        <div style="font-size: 0.7rem; opacity: 0.6;">$${m.costPerClient}/client</div>
                    </div>
                </div>

                <!-- Tier Usage Bars -->
                <div style="margin-top: 1.25rem; background: rgba(255,255,255,0.06); padding: 1rem; border-radius: 10px;">
                    ${_tierBar(parseFloat(m.dbSizeMB), m.currentTier === 'Free' ? 500 : (m.currentTier === 'Pro' ? 8192 : 65536), 'Database', 'MB')}
                    ${_tierBar(m.clients.length, m.currentTier === 'Free' ? 50 : (m.currentTier === 'Pro' ? 2000 : 10000), 'Clients', '')}
                    ${_tierBar(m.reports.length, m.currentTier === 'Free' ? 100 : (m.currentTier === 'Pro' ? 5000 : 50000), 'Audit Reports', '')}
                </div>
            </div>

            <!-- ===================== SECTION 2: AI API USAGE ===================== -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-robot" style="margin-right: 0.5rem; color: #7c3aed;"></i>
                    AI API Usage
                    <span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.7rem; margin-left: 0.5rem;">Gemini 2.0 Flash</span>
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.75rem; font-weight: bold; color: var(--primary-color);">${summary.totalCalls}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">API Calls</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Today: ${todayUsage.calls}</div>
                    </div>
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.75rem; font-weight: bold; color: #7c3aed;">${tracker.formatTokens(summary.totalTokens)}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">Tokens</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">In: ${tracker.formatTokens(summary.totalInputTokens)} / Out: ${tracker.formatTokens(summary.totalOutputTokens)}</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.75rem; font-weight: bold; color: #059669;">${tracker.formatCost(summary.totalEstimatedCost)}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">Est. Cost</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">This Month: ${tracker.formatCost(monthUsage.cost)}</div>
                    </div>
                </div>
                ${features.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead><tr><th>Feature</th><th style="text-align:center;">Calls</th><th style="text-align:center;">Input</th><th style="text-align:center;">Output</th><th style="text-align:right;">Cost</th></tr></thead>
                            <tbody>${features.map(([f, d]) => `
                                <tr>
                                    <td><span class="badge" style="background:#e0f2fe;color:#0284c7;">${tracker.getFeatureDisplayName(f)}</span></td>
                                    <td style="text-align:center;font-weight:600;">${d.calls}</td>
                                    <td style="text-align:center;">${tracker.formatTokens(d.inputTokens)}</td>
                                    <td style="text-align:center;">${tracker.formatTokens(d.outputTokens)}</td>
                                    <td style="text-align:right;color:#059669;font-weight:600;">${tracker.formatCost(d.cost)}</td>
                                </tr>`).join('')}
                            </tbody>
                            <tfoot><tr style="background:#f8fafc;font-weight:bold;">
                                <td>Total</td><td style="text-align:center;">${summary.totalCalls}</td>
                                <td style="text-align:center;">${tracker.formatTokens(summary.totalInputTokens)}</td>
                                <td style="text-align:center;">${tracker.formatTokens(summary.totalOutputTokens)}</td>
                                <td style="text-align:right;color:#059669;">${tracker.formatCost(summary.totalEstimatedCost)}</td>
                            </tr></tfoot>
                        </table>
                    </div>
                ` : `<div style="text-align:center;padding:1.5rem;color:var(--text-secondary);"><i class="fa-solid fa-chart-pie" style="font-size:1.5rem;margin-bottom:0.5rem;color:#cbd5e1;"></i><p style="margin:0;">No AI usage yet. Use features like KB Analysis or NCR Auto-Map to start tracking.</p></div>`}
            </div>

            <!-- ===================== SECTION 3: PER-CLIENT COST BREAKDOWN ===================== -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-building" style="margin-right: 0.5rem; color: #0ea5e9;"></i>
                    Cost Per Client
                    <span style="background: #e0f2fe; color: #0284c7; padding: 2px 10px; border-radius: 12px; font-size: 0.7rem; margin-left: 0.5rem;">${m.perClient.length} clients</span>
                </h4>
                ${m.perClient.length > 0 ? `
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table>
                            <thead style="position: sticky; top: 0; background: #f8fafc;">
                                <tr>
                                    <th>Client</th>
                                    <th style="text-align:center;">Audits</th>
                                    <th style="text-align:center;">NCRs</th>
                                    <th style="text-align:center;">Checklist Items</th>
                                    <th style="text-align:center;">Evidence</th>
                                    <th style="text-align:right;">Est. Storage</th>
                                    <th style="text-align:right;">Est. Cost/yr</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${m.perClient.map(c => `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 500;">${window.UTILS.escapeHtml(c.name)}</div>
                                            <div style="font-size: 0.75rem; color: #94a3b8;">${window.UTILS.escapeHtml(c.industry)}</div>
                                        </td>
                                        <td style="text-align:center;"><span class="badge" style="background:${c.audits > 0 ? '#dcfce7' : '#f1f5f9'};color:${c.audits > 0 ? '#166534' : '#94a3b8'};">${c.audits}</span></td>
                                        <td style="text-align:center;"><span class="badge" style="background:${c.ncrs > 0 ? '#fef2f2' : '#f1f5f9'};color:${c.ncrs > 0 ? '#991b1b' : '#94a3b8'};">${c.ncrs}</span></td>
                                        <td style="text-align:center;">${c.progressItems}</td>
                                        <td style="text-align:center;">${c.evidenceCount} <span style="color:#94a3b8;font-size:0.75rem;">files</span></td>
                                        <td style="text-align:right;font-weight:500;">${c.storageMB} MB</td>
                                        <td style="text-align:right;font-weight:600;color:#059669;">$${c.estCost}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="background: #f0fdf4; font-weight: bold;">
                                    <td>Total (${m.perClient.length} clients)</td>
                                    <td style="text-align:center;">${m.reports.length}</td>
                                    <td style="text-align:center;">${m.perClient.reduce((s, c) => s + c.ncrs, 0)}</td>
                                    <td style="text-align:center;">${m.perClient.reduce((s, c) => s + c.progressItems, 0)}</td>
                                    <td style="text-align:center;">${m.perClient.reduce((s, c) => s + c.evidenceCount, 0)}</td>
                                    <td style="text-align:right;">${m.perClient.reduce((s, c) => s + parseFloat(c.storageMB), 0).toFixed(2)} MB</td>
                                    <td style="text-align:right;color:#059669;">$${m.totalAnnual.toFixed(0)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ` : `<p style="text-align:center;color:var(--text-secondary);padding:1rem;">No clients yet.</p>`}
            </div>

            <!-- ===================== SECTION 4: PER-STANDARD COST ANALYSIS ===================== -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-certificate" style="margin-right: 0.5rem; color: #d97706;"></i>
                    Cost Per Standard
                </h4>
                ${m.standards.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead><tr>
                                <th>Standard</th>
                                <th style="text-align:center;">Audits</th>
                                <th style="text-align:center;">Clients</th>
                                <th style="text-align:center;">Avg Items</th>
                                <th style="text-align:center;">NCRs Found</th>
                                <th style="text-align:right;">Est. AI Cost/Audit</th>
                            </tr></thead>
                            <tbody>
                                ${m.standards.map(s => `
                                    <tr>
                                        <td><span class="badge" style="background:#fef3c7;color:#92400e;">${window.UTILS.escapeHtml(s.name)}</span></td>
                                        <td style="text-align:center;font-weight:600;">${s.audits}</td>
                                        <td style="text-align:center;">${s.clients}</td>
                                        <td style="text-align:center;">${s.avgItems}</td>
                                        <td style="text-align:center;"><span style="color:${s.ncrs > 0 ? '#dc2626' : '#94a3b8'};font-weight:${s.ncrs > 0 ? '600' : '400'};">${s.ncrs}</span></td>
                                        <td style="text-align:right;color:#059669;font-weight:600;">~$${s.estCostPerAudit}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<p style="text-align:center;color:var(--text-secondary);padding:1rem;">No audit plans with standards found.</p>`}
            </div>

            <!-- ===================== SECTION 5: SCALABILITY PROJECTIONS ===================== -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-rocket" style="margin-right: 0.5rem; color: #7c3aed;"></i>
                    Scalability & Cost Projections
                </h4>
                <div class="table-container">
                    <table>
                        <thead><tr>
                            <th>Scale</th><th style="text-align:center;">Supabase Tier</th>
                            <th style="text-align:right;">Platform/mo</th><th style="text-align:right;">AI/mo</th>
                            <th style="text-align:right;">Annual Total</th><th style="text-align:right;">Per Client/yr</th>
                        </tr></thead>
                        <tbody>
                            ${[
            { clients: 10, tier: 'Free', cost: 0 },
            { clients: 50, tier: 'Free', cost: 0 },
            { clients: 100, tier: 'Pro', cost: 25 },
            { clients: 250, tier: 'Pro', cost: 25 },
            { clients: 500, tier: 'Pro', cost: 25 },
            { clients: 1000, tier: 'Pro+', cost: 50 },
            { clients: 2000, tier: 'Team', cost: 599 }
        ].map(s => {
            const aiMo = s.clients * 3 * 3.5 * 3000 / 1000000 * 0.18 / 12;
            const annual = (s.cost * 12) + (aiMo * 12);
            const perClient = (annual / s.clients).toFixed(2);
            const isCurrent = s.clients <= m.clients.length * 2 && s.clients >= m.clients.length;
            return `
                                    <tr style="${isCurrent ? 'background: #f0fdf4; font-weight: 500;' : ''}">
                                        <td style="font-weight: 600;">${s.clients} clients
                                            ${isCurrent ? '<span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:8px;font-size:0.65rem;margin-left:4px;">YOU</span>' : ''}
                                        </td>
                                        <td style="text-align:center;">
                                            <span class="badge" style="background:${s.tier === 'Free' ? '#dcfce7' : s.tier === 'Team' ? '#fef2f2' : '#e0f2fe'};color:${s.tier === 'Free' ? '#166534' : s.tier === 'Team' ? '#991b1b' : '#0369a1'};">${s.tier}</span>
                                        </td>
                                        <td style="text-align:right;">$${s.cost}</td>
                                        <td style="text-align:right;color:#7c3aed;">$${aiMo.toFixed(2)}</td>
                                        <td style="text-align:right;font-weight: 600;color:#059669;">$${annual.toFixed(0)}</td>
                                        <td style="text-align:right;font-weight: 600;">$${perClient}</td>
                                    </tr>`;
        }).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 0.75rem; padding: 0.5rem; background: #eff6ff; border-radius: 6px; font-size: 0.75rem; color: #1e40af;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 4px;"></i>
                    Projections assume ~3 audits/client/year, 3.5 AI calls/audit, 3K tokens/call. Actual costs may vary.
                </div>
            </div>

            <!-- ===================== SECTION 6: SUPABASE DB & STORAGE ===================== -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-database" style="margin-right: 0.5rem; color: #10b981;"></i>
                    Supabase Database & Storage
                </h4>
                <div id="supabase-stats-container">
                    <div style="text-align:center;padding:1.5rem;color:var(--text-secondary);">
                        <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;"></i>Loading Supabase statistics...
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Load Supabase stats asynchronously after render
window.loadSupabaseStats = async function () {
    const container = document.getElementById('supabase-stats-container');
    if (!container) return;

    const tracker = window.APIUsageTracker;
    if (!tracker || typeof tracker.getSupabaseStats !== 'function') {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Supabase stats not available.</p>';
        return;
    }

    try {
        const stats = await tracker.getSupabaseStats();

        if (!stats.connected) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">
                    <i class="fa-solid fa-unlink" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #f59e0b;"></i>
                    <p style="margin: 0;">Supabase not connected. Configure in Settings > Supabase tab.</p>
                </div>
            `;
            return;
        }

        const tableEntries = Object.entries(stats.tables);
        const tableRows = tableEntries.map(([name, count]) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                <span style="font-size: 0.85rem; color: #475569;"><i class="fa-solid fa-table" style="width: 16px; color: var(--primary-color); margin-right: 6px;"></i>${name}</span>
                <span style="font-weight: 600; color: #1e293b;">${count} rows</span>
            </div>
        `).join('');

        const bucketRows = stats.storage.buckets.length > 0 ? stats.storage.buckets.map(b => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                <span style="font-size: 0.85rem; color: #475569;"><i class="fa-solid fa-hard-drive" style="width: 16px; color: #8b5cf6; margin-right: 6px;"></i>${b.name}</span>
                <span style="font-size: 0.85rem;">${b.files} files • <strong>${b.sizeMB} MB</strong></span>
            </div>
        `).join('') : '<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 0.5rem;">No storage buckets found</p>';

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div>
                    <h5 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #64748b;">Database Tables</h5>
                    ${tableRows || '<p style="color: var(--text-secondary);">No tables found</p>'}
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 600; color: var(--primary-color); border-top: 2px solid #e2e8f0; margin-top: 4px;">
                        <span>Total Rows</span>
                        <span>${tableEntries.reduce((s, [, c]) => s + c, 0)}</span>
                    </div>
                </div>
                <div>
                    <h5 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #64748b;">Storage Buckets</h5>
                    ${bucketRows}
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 600; color: #8b5cf6; border-top: 2px solid #e2e8f0; margin-top: 4px;">
                        <span>Total Storage</span>
                        <span>${stats.storage.totalFiles} files • ${stats.storage.totalSizeMB} MB</span>
                    </div>
                    <div style="margin-top: 0.75rem; padding: 0.5rem; background: #f0fdf4; border-radius: 6px; font-size: 0.75rem; color: #166534;">
                        <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i>
                        Supabase Free Tier: 500 MB database • 1 GB storage • 2 GB bandwidth/month
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load Supabase stats:', err);
        container.innerHTML = '<p style="color: var(--danger-color); text-align: center;">Failed to load Supabase statistics.</p>';
    }
}

// Reset usage data with confirmation
window.resetUsageData = function () {
    if (confirm('Are you sure you want to reset all API usage data? This action cannot be undone.')) {
        if (window.APIUsageTracker) {
            window.APIUsageTracker.resetUsageData();
            window.showNotification('Usage data reset successfully', 'success');
            // Refresh the tab
            switchSettingsSubTab('system', 'usage');
        }
    }
};

// Re-sync Knowledge Base from Cloud
window.reSyncKnowledgeBase = async function () {
    if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) {
        window.showNotification('Supabase not initialized', 'error');
        return;
    }

    try {
        window.showNotification('Refreshing documents from cloud...', 'info');

        // This will call syncDocumentsFromSupabase which now includes KB auto-population logic
        const result = await window.SupabaseClient.syncDocumentsFromSupabase();

        // Force refresh UI
        if (typeof switchSettingsSubTab === 'function') {
            switchSettingsSubTab('knowledge', 'kb');
        } else {
            renderSettings();
        }

        if (result.added > 0 || result.updated > 0) {
            window.showNotification(`Found ${result.added} new documents in cloud.`, 'success');
        } else {
            window.showNotification('Knowledge Base is up to date.', 'info');
        }
    } catch (e) {
        console.error('KB Re-sync failed:', e);
        window.showNotification('Refresh failed. Please check connection.', 'error');
    }
};

// Test AI Connection Diagnostic
window.testAIConnection = async function () {
    const resultDiv = document.getElementById('ai-diagnostic-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing connection to Gemini API...';

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'list'
            })
        });

        const status = response.status;
        let data;
        try {
            data = await response.json();
        } catch (_e) {
            data = { error: 'Could not parse JSON response' };
        }

        if (response.ok) {
            resultDiv.innerHTML = `<span style="color: green; font-weight: bold;">✅ Success (Status ${parseInt(status, 10) || 0})</span><br>Response: <pre>${window.UTILS.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        } else {
            resultDiv.innerHTML = `<span style="color: red; font-weight: bold;">❌ Failed (Status ${parseInt(status, 10) || 0})</span><br>Error: <pre>${window.UTILS.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<span style="color: red; font-weight: bold;">❌ Network Error</span><br>${window.UTILS.escapeHtml(error.message)}`;
    }
};

Logger.info('Settings module extensions loaded');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { switchSettingsMainTab, switchSettingsSubTab, saveCBProfile, handleLogoUpload, addStandardToMasterlist, deleteStandardFromMasterlist, addGlobalDesignation, editGlobalDesignation, resetPermissions, addCBSite, editCBSite, saveDefaults, cyclePermission, addRetentionPolicy, editRetentionPolicy, deleteRetentionPolicy, editNCRCriteria, editCertDecision, saveCAPATimelines, saveAuditFrequency, renderSettings, switchSettingsTab, backupData, restoreData, openAddAssignmentModal, openQuickAssignModal, resetUsageData };
}

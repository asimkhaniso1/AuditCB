// ============================================
// SETTINGS MODULE - CB CONFIGURATION
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
        dateFormat: 'YYYY-MM-DD',
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
                console.log('[Settings] Supabase data loaded, refreshing form...');
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
                    <button class="tab-btn ${window.state.settingsMainTab === 'cb-profile' ? 'active' : ''}" onclick="switchSettingsMainTab('cb-profile', this)">
                        <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i>CB Profile
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'organization' ? 'active' : ''}" onclick="switchSettingsMainTab('organization', this)">
                        <i class="fa-solid fa-users" style="margin-right: 0.5rem;"></i>Organization
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'policies' ? 'active' : ''}" onclick="switchSettingsMainTab('policies', this)">
                        <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem;"></i>Policies
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'knowledge' ? 'active' : ''}" onclick="switchSettingsMainTab('knowledge', this)">
                        <i class="fa-solid fa-brain" style="margin-right: 0.5rem;"></i>Knowledge Base
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'users' ? 'active' : ''}" onclick="switchSettingsMainTab('users', this)">
                        <i class="fa-solid fa-users-cog" style="margin-right: 0.5rem;"></i>Users
                    </button>
                    <button class="tab-btn ${window.state.settingsMainTab === 'system' ? 'active' : ''}" onclick="switchSettingsMainTab('system', this)">
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
            onclick="switchSettingsSubTab('${mainTab}', '${tab.id}')">
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
                            <button class="btn btn-primary" onclick="window.runSupabaseDiagnostics()">
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
window.switchSettingsMainTab = function (mainTab, btnElement) {
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
            next_audit: null,
            last_audit: null,
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
function switchSettingsTab(tabName, btnElement) {
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
    const settings = window.state.cbSettings;

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
            <form id="profile-form" onsubmit="event.preventDefault(); saveCBProfile();">
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
                            <input type="file" class="form-control" id="logo-upload" accept="image/*" onchange="handleLogoUpload(this)">
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
                                        <button type="button" class="btn btn-sm btn-icon" onclick="window.editCBSite(${idx})" title="Edit">
                                            <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                        </button>
                                        ${sites.length > 1 ? `
                                            <button type="button" class="btn btn-sm btn-icon" onclick="window.deleteCBSite(${idx})" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-secondary" onclick="window.addCBSite()" style="margin-top: 0.5rem;">
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
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">
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

        // Explicitly sync settings to Supabase when user saves
        if (window.SupabaseClient?.isInitialized) {
            window.SupabaseClient.syncSettingsToSupabase(window.state.settings)
                .then(() => console.log('[Settings] Synced to Supabase'))
                .catch(e => console.warn('Settings Supabase sync failed:', e));
        }

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
                    <button type="button" class="btn btn-sm btn-icon" onclick="window.editCBSite(${idx})" title="Edit">
                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                    </button>
                    ${settings.cbSites.length > 1 ? `
                        <button type="button" class="btn btn-sm btn-icon" onclick="window.deleteCBSite(${idx})" title="Delete">
                            <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    console.log('[Settings] Form fields and tables updated with Supabase data');
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
            <form id="accreditation-form" onsubmit="event.preventDefault(); saveAccreditation();">
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
                        <input type="date" class="form-control" id="ab-expiry" value="${settings.accreditationExpiry}">
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
                    <button class="btn btn-sm btn-secondary" onclick="addStandardToMasterlist()" title="Add new standard to masterlist">
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
                            <button type="button" class="btn btn-sm btn-icon" onclick="deleteStandardFromMasterlist('${std}')" title="Remove from Masterlist" style="color: #cbd5e1; padding: 0;">
                                <i class="fa-solid fa-times hover-danger"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <style>
                    .hover-danger:hover { color: var(--danger-color) !important; }
                </style>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Accreditation
                </button>
            </form>
        </div>
    `;
}

window.saveAccreditation = async function () {
    const settings = window.state.cbSettings;
    settings.accreditationBody = document.getElementById('ab-name').value;
    settings.accreditationNumber = document.getElementById('ab-number').value;
    settings.accreditationExpiry = document.getElementById('ab-expiry').value;
    settings.iafMlaStatus = document.getElementById('iaf-mla').checked;

    settings.standardsOffered = Array.from(document.querySelectorAll('.standard-checkbox:checked')).map(cb => cb.value);

    window.saveData();

    if (window.SupabaseClient?.isInitialized) {
        try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
    }

    window.showNotification('Accreditation settings saved', 'success');
};

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
                try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
                <button class="btn btn-primary" onclick="addGlobalDesignation()">
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
                                    <button class="btn btn-sm btn-icon" onclick="editGlobalDesignation(${pos.id})" title="Edit">
                                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" onclick="deleteGlobalDesignation(${pos.id})" title="Delete">
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
            try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
            try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
        }

        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation deleted', 'success');
    }
};

// ============================================
// TAB 3b: USER MANAGEMENT
// ============================================

function getUsersHTML() {
    // No demo users - users must come from Supabase or be added manually
    const users = window.state.users || [];

    return `
    <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-users-cog" style="margin-right: 0.5rem;"></i>
                    User Management
                </h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                    <button class="btn btn-outline-secondary btn-sm" onclick="syncUsersFromCloud()" title="Pull users from Supabase">
                        <i class="fa-solid fa-cloud-arrow-down" style="margin-right: 0.25rem;"></i>Sync from Cloud
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="syncUsersToCloud()" title="Push users to Supabase">
                        <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.25rem;"></i>Sync to Cloud
                    </button>
                    <button class="btn btn-outline-primary" onclick="openInviteUserModal()">
                        <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i>Invite User
                    </button>
                    <button class="btn btn-primary" onclick="openAddUserModal()">
                        <i class="fa-solid fa-user-plus"></i> Add User
                    </button>
                    <button class="btn btn-secondary" onclick="window.cleanupDemoUsers()" title="Remove local-only demo users">
                        <i class="fa-solid fa-broom"></i> Clean Demo Users
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div id="users-list-container" class="table-container">
                ${renderUsersList(users)}
            </div>
        </div>
    `;
}

// Clean up demo users (keep only Supabase authenticated users)
window.cleanupDemoUsers = async function () {
    try {
        // Real Supabase user emails (from auth.users table)
        const realSupabaseEmails = [
            'asimkhaniso@gmail.com',
            'info@companycertification.com'
        ];

        const currentUsers = window.state?.users || [];

        // Filter users
        const realUsers = currentUsers.filter(user =>
            realSupabaseEmails.includes(user.email)
        );

        const demoUsers = currentUsers.filter(user =>
            !realSupabaseEmails.includes(user.email)
        );

        if (demoUsers.length === 0) {
            window.showNotification('No demo users found to clean up', 'info');
            return;
        }

        // Show confirmation dialog
        const userList = demoUsers.map(u =>
            `  • ${u.name} (${u.email || 'no email'})`
        ).join('\n');

        const confirmed = confirm(
            `Remove ${demoUsers.length} demo user(s)?\n\n` +
            `Demo users to remove:\n${userList}\n\n` +
            `Keeping ${realUsers.length} real Supabase users`
        );

        if (!confirmed) {
            return;
        }

        // Update state
        window.state.users = realUsers;
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.showNotification(
            `Removed ${demoUsers.length} demo users. ${realUsers.length} real users remaining.`,
            'success'
        );

        Logger.info('Demo users cleaned up:', {
            removed: demoUsers.length,
            remaining: realUsers.length
        });

    } catch (error) {
        Logger.error('Failed to cleanup demo users:', error);
        window.showNotification('Cleanup failed: ' + error.message, 'error');
    }
};

function renderUsersList(users) {
    if (users.length === 0) {
        return `<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No users found.</div>`;
    }

    return `
    <table>
            <thead>
                <tr>
                    <th style="width: 50px;"></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr style="opacity: ${user.status === 'Inactive' ? '0.6' : '1'};">
                        <td>
                            <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}" 
                                 style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                        </td>
                        <td>
                            <strong>${window.UTILS.escapeHtml(user.name)}</strong>
                            ${user.isLocal && !user.supabaseId ? '<span style="font-size:0.65rem; color:#94a3b8; margin-left:4px; background:#f1f5f9; padding:1px 4px; border-radius:3px;" title="Created locally, not synced to Supabase">(local)</span>' : ''}
                        </td>
                        <td>${window.UTILS.escapeHtml(user.email)}</td>
                        <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${window.UTILS.escapeHtml(user.role)}</span></td>
                        <td>
                            <span class="badge" style="background: ${user.status === 'Active' ? '#dcfce7' : user.status === 'Pending' ? '#fef3c7' : '#f1f5f9'}; color: ${user.status === 'Active' ? '#166534' : user.status === 'Pending' ? '#d97706' : '#64748b'};">
                                ${user.status}
                            </span>
                        </td>
                        <td>
                            ${user.status === 'Pending' && window.state.currentUser?.role === 'Admin' ? `
                            <button class="btn btn-sm btn-success" onclick="approveUser('${user.id}')" title="Approve User" style="margin-right: 0.25rem;">
                                <i class="fa-solid fa-check"></i> Approve
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" onclick="editUser('${user.id}')" title="Edit">
                                <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" onclick="toggleUserStatus('${user.id}')" title="${user.status === 'Active' ? 'Deactivate' : 'Activate'}">
                                <i class="fa-solid ${user.status === 'Active' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${user.status === 'Active' ? '#16a34a' : '#cbd5e1'}; font-size: 1.2rem;"></i>
                            </button>
                            ` : ''}
                            ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                            <button class="btn btn-sm btn-icon" onclick="sendPasswordReset('${user.email}')" title="Send Password Reset">
                                <i class="fa-solid fa-key" style="color: #f59e0b;"></i>
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

window.openAddUserModal = function (userId = null) {
    const isEdit = !!userId;
    let user = {};
    if (isEdit) {
        user = window.state.users.find(u => String(u.id) === String(userId)) || {};
    }

    document.getElementById('modal-title').textContent = isEdit ? 'Edit User' : 'Add New User';
    document.getElementById('modal-body').innerHTML = `
    <form id="user-form">
            <div class="form-group">
                <label>Full Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="user-name" value="${user.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Email Address <span style="color: var(--danger-color);">*</span></label>
                <input type="email" class="form-control" id="user-email" value="${user.email || ''}" required ${isEdit && window.state.currentUser?.role !== 'Admin' ? 'disabled' : ''}>
                ${isEdit && window.state.currentUser?.role !== 'Admin' ? '<small style="color: var(--text-secondary);">Email cannot be changed. Contact an Admin.</small>' : ''}
            </div>
            <div class="form-group">
                <label>Role <span style="color: var(--danger-color);">*</span></label>
                ${(window.state.currentUser?.role === 'Admin' || window.state.currentUser?.role === 'Certification Manager') ? `
                <select id="user-role" class="form-control" required>
                    <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Certification Manager" ${user.role === 'Certification Manager' ? 'selected' : ''}>Certification Manager</option>
                    <option value="Lead Auditor" ${user.role === 'Lead Auditor' ? 'selected' : ''}>Lead Auditor</option>
                    <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    <option value="Technical Expert" ${user.role === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                </select>
                ` : `
                <input type="text" class="form-control" id="user-role-display" value="${user.role || 'Auditor'}" readonly style="background: #f1f5f9;">
                <input type="hidden" id="user-role" value="${user.role || 'Auditor'}">
                <small style="color: var(--text-secondary);"><i class="fa-solid fa-lock"></i> Only administrators can assign roles.</small>
                `}
            </div>
            ${!isEdit ? `
            <div class="form-group">
                <label>Temporary Password <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="user-password" value="Welcome123!" readonly style="background: #f8fafc;">
                <small style="color: var(--text-secondary);">Default password for new users.</small>
            </div>
            ` : `
            <div class="form-group">
                <label>Reset Password</label>
                <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                    <input type="password" class="form-control" id="user-new-password" placeholder="Leave blank to keep current password">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('user-new-password').type = document.getElementById('user-new-password').type === 'password' ? 'text' : 'password'">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="color: var(--text-secondary);">Enter new password only if you want to change it.</small>
            </div>
            `}
        </form>
    `;

    document.getElementById('modal-save').onclick = () => {
        saveUser(userId);
    };

    window.openModal();
};

window.saveUser = async function (userId) {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const role = document.getElementById('user-role').value;

    if (!name || (!userId && !email)) {
        window.showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Email validation for new users
    if (!userId) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            window.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Check for duplicate email (case-insensitive)
        const existingUser = window.state.users?.find(u =>
            u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingUser) {
            window.showNotification('A user with this email already exists', 'warning');
            return;
        }
    }

    if (userId) {
        // Update existing user
        const user = window.state.users.find(u => u.id === userId);
        if (user) {
            const oldEmail = user.email;
            user.name = name;
            user.role = role;

            // Admin can update email
            if (window.state.currentUser?.role === 'Admin' && email) {
                user.email = email;
            }

            if (!user.avatar) {
                user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            }

            // Handle password update if provided
            const newPassword = document.getElementById('user-new-password')?.value;

            // Update in Supabase profiles table if available
            if (window.SupabaseClient?.isInitialized) {
                try {
                    // Update profiles table
                    const profileData = {
                        full_name: name,
                        role: role,
                        email: email,
                        avatar_url: user.avatar
                    };

                    const { error: profileError } = await window.SupabaseClient.client
                        .from('profiles')
                        .update(profileData)
                        .eq('email', oldEmail);

                    if (profileError) {
                        console.warn('Profile update warning:', profileError);
                    }

                    // Handle password if provided
                    if (newPassword && newPassword.trim()) {
                        await window.SupabaseClient.updateUserPassword(email, newPassword.trim());
                        window.showNotification('User and password updated successfully', 'success');
                    } else {
                        window.showNotification('User updated successfully', 'success');
                    }
                } catch (error) {
                    Logger.error('Supabase update failed:', error);
                    window.showNotification('User updated locally (cloud sync failed)', 'warning');
                }
            } else {
                // No Supabase - just local update
                if (newPassword && newPassword.trim()) {
                    window.showNotification('User updated (password change requires Supabase)', 'info');
                } else {
                    window.showNotification('User updated successfully', 'success');
                }
            }
        }
    } else {
        // Create new user
        const newUser = {
            id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: name,
            email: email,
            role: role,
            status: 'Active',
            isLocal: true, // Mark as locally created (not from Supabase auth)
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        };

        // Add to Supabase if available
        if (window.SupabaseClient?.isInitialized) {
            try {
                // Create in profiles table
                const { error: profileError } = await window.SupabaseClient.client
                    .from('profiles')
                    .insert([{
                        email: email,
                        full_name: name,
                        role: role,
                        avatar_url: newUser.avatar
                    }]);

                if (profileError) {
                    console.warn('Profile creation warning:', profileError);
                }

                window.showNotification('User created successfully', 'success');
            } catch (error) {
                Logger.error('Supabase user creation failed:', error);
                window.showNotification('User created locally (cloud sync pending)', 'warning');
            }
        } else {
            window.showNotification('User created successfully', 'success');
        }

        window.state.users.push(newUser);
    }

    window.saveData();
    window.closeModal();
    // Refresh list
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
};

window.editUser = function (userId) {
    window.openAddUserModal(userId);
};

window.toggleUserStatus = function (userId) {
    const user = window.state.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    if (user.id === 1 || user.role === 'Admin') {
        // Prevent disabling the main admin for safety in this demo
        if (user.email === 'admin@companycertification.com') {
            window.showNotification('Cannot disable the main Administrator', 'warning');
            return;
        }
    }

    user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    window.saveData();
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    window.showNotification(`User ${user.status === 'Active' ? 'activated' : 'deactivated'}`, 'info');
};

// Approve pending user account (Admin only)
window.approveUser = function (userId) {
    if (window.state.currentUser?.role !== 'Admin') {
        window.showNotification('Only administrators can approve user accounts', 'warning');
        return;
    }

    const user = window.state.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    if (user.status !== 'Pending') {
        window.showNotification('User is not pending approval', 'info');
        return;
    }

    user.status = 'Active';
    window.saveData();
    document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    window.showNotification(`User ${user.name} has been approved and activated`, 'success');
};

// Sync users from Supabase (Cloud -> Local)
window.syncUsersFromCloud = async function () {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase not configured. Go to System > Defaults to set up.', 'warning');
            return;
        }
        window.showNotification('Syncing users from cloud...', 'info');
        const result = await window.SupabaseClient.syncUsersFromSupabase();
        window.showNotification(`Sync complete: ${result.added} added, ${result.updated} updated`, 'success');
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);
    } catch (error) {
        window.showNotification('Failed to sync: ' + error.message, 'error');
    }
};

// Sync users to Supabase (Local -> Cloud)
window.syncUsersToCloud = async function () {
    try {
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase not configured. Go to System > Defaults to set up.', 'warning');
            return;
        }
        window.showNotification('Syncing users to cloud...', 'info');
        const result = await window.SupabaseClient.syncUsersToSupabase(window.state.users || []);
        window.showNotification(`Sync complete: ${result.success} synced, ${result.failed} failed`, 'success');
    } catch (error) {
        window.showNotification('Failed to sync: ' + error.message, 'error');
    }
};

// Send password reset email
window.sendPasswordReset = async function (email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;

    try {
        // Check if Supabase is initialized
        if (!window.SupabaseClient?.isInitialized) {
            window.showNotification('Supabase is not configured. Please configure in System Settings.', 'error');
            return;
        }

        // Check if the method exists
        if (typeof window.SupabaseClient.sendPasswordResetEmail !== 'function') {
            window.showNotification('Password reset feature is not available. Please update the application.', 'error');
            Logger.error('sendPasswordResetEmail method not found on SupabaseClient');
            return;
        }

        window.showNotification('Sending password reset email...', 'info');

        await window.SupabaseClient.sendPasswordResetEmail(email);

        window.showNotification(`Password reset email sent to ${email}`, 'success');
        Logger.info('Password reset email sent to:', email);
    } catch (error) {
        Logger.error('Password reset failed:', error);
        window.showNotification('Failed to send reset email: ' + error.message, 'error');
    }
};


// Invite user (create with email invitation)
window.inviteUser = async function () {
    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;

    if (!email) {
        window.showNotification('Please enter an email address', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        window.showNotification('Please enter a valid email address', 'error');
        return;
    }

    // Check if user already exists
    const existingUser = window.state.users?.find(u => u.email === email);
    if (existingUser) {
        window.showNotification('A user with this email already exists', 'warning');
        return;
    }

    try {
        window.showNotification('Creating user and sending invitation...', 'info');

        if (!window.SupabaseClient?.isInitialized) {
            throw new Error('Supabase is not configured. Please set up Supabase in System Settings.');
        }

        // Use Supabase's signUp with email confirmation
        const tempPassword = 'TempPass' + Math.random().toString(36).substring(2, 15) + '!';
        const fullName = email.split('@')[0]; // Use email username as temporary name

        const { data: authData, error: signUpError } = await window.SupabaseClient.client.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                },
                emailRedirectTo: `${window.location.origin}/#auth/callback`
            }
        });

        if (signUpError) {
            throw signUpError;
        }

        Logger.info('Auth user created:', authData.user.id);

        // Create profile entry
        const { error: profileError } = await window.SupabaseClient.client
            .from('profiles')
            .upsert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
            }], {
                onConflict: 'id'
            });

        if (profileError) {
            Logger.warn('Profile creation warning:', profileError.message);
            // Continue anyway - profile might be created by database trigger
        }

        // Add to local state
        const newUser = {
            id: authData.user.id,
            name: fullName,
            email: email,
            role: role,
            status: 'Pending', //Will be 'Active' after email confirmation
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
        };

        window.state.users.push(newUser);
        window.saveData();

        // Refresh UI
        document.getElementById('users-list-container').innerHTML = renderUsersList(window.state.users);

        window.closeModal();

        // Send invitation email
        if (window.EmailService?.isAvailable()) {
            const confirmationUrl = authData.user.confirmation_url ||
                `${window.location.origin}/#auth/confirm?token=${authData.user.id}`;

            const emailResult = await window.EmailService.sendUserInvitation(
                email,
                fullName,
                role,
                confirmationUrl
            );

            if (emailResult.success) {
                window.showNotification(
                    `User created! Invitation email sent to ${email}.`,
                    'success'
                );
            } else {
                window.showNotification(
                    `User created but email failed to send. Please contact ${email} manually.`,
                    'warning'
                );
            }
        } else {
            window.showNotification(
                `User created! A confirmation email has been sent to ${email}.`,
                'success'
            );
        }

        Logger.info('User invited successfully:', newUser);

    } catch (error) {
        Logger.error('Failed to invite user:', error);

        let errorMessage = 'Failed to send invitation: ' + error.message;

        // Provide helpful error messages
        if (error.message.includes('already registered')) {
            errorMessage = 'This email is already registered. User may already have an account.';
        } else if (error.message.includes('email')) {
            errorMessage = 'Email configuration error. Please configure Supabase email settings.';
        }

        window.showNotification(errorMessage, 'error');
    }
};


// Open invite user modal
window.openInviteUserModal = function () {
    document.getElementById('modal-title').textContent = 'Invite User';
    document.getElementById('modal-body').innerHTML = `
        <form id="invite-form" onsubmit="event.preventDefault(); inviteUser();">
            <div class="form-group">
                <label>Email Address <span style="color: var(--danger-color);">*</span></label>
                <input type="email" class="form-control" id="invite-email" placeholder="user@example.com" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="invite-role">
                    <option value="Auditor">Auditor</option>
                    <option value="Lead Auditor">Lead Auditor</option>
                    <option value="Technical Expert">Technical Expert</option>
                    <option value="Certification Manager">Certification Manager</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
            <div class="alert alert-info" style="margin-top: 1rem;">
                <i class="fa-solid fa-info-circle"></i>
                An invitation email will be sent to the user to set up their account.
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').textContent = 'Send Invitation';
    document.getElementById('modal-save').onclick = () => {
        window.inviteUser();
    };
    window.openModal();
};

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
                                            onclick="cyclePermission('${role}', '${module}')" 
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
                    <button class="btn btn-sm btn-outline-danger" onclick="resetPermissions()">
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
                <button class="btn btn-primary" onclick="addRetentionPolicy()">
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
                                    <button class="btn btn-sm btn-icon" onclick="editRetentionPolicy(${policy.id})" title="Edit">
                                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" onclick="deleteRetentionPolicy(${policy.id})" title="Delete">
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
            
            <form id="policy-form" onsubmit="event.preventDefault(); saveQualityPolicy();">
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
                        <input type="date" class="form-control" id="policy-reviewed" value="${settings.policyLastReviewed}">
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
                            ${(settings.qualityObjectives || []).map((obj, idx) => `
                                <tr>
                                    <td>${window.UTILS.escapeHtml(obj.objective)}</td>
                                    <td><span class="badge bg-orange">${window.UTILS.escapeHtml(obj.target)}</span></td>
                                    <td><span class="badge bg-green">${window.UTILS.escapeHtml(obj.actual)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Policy
                </button>
            </form>
        </div>
    `;
}

window.saveQualityPolicy = async function () {
    const settings = window.state.cbSettings;
    settings.qualityPolicy = document.getElementById('quality-policy').value;
    settings.msScope = document.getElementById('ms-scope').value;
    settings.policyLastReviewed = document.getElementById('policy-reviewed').value;
    settings.policyApprovedBy = document.getElementById('policy-approved').value;

    window.saveData();

    if (window.SupabaseClient?.isInitialized) {
        try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
    }

    window.showNotification('Quality Policy saved', 'success');
};

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
            
            <form id="defaults-form" onsubmit="event.preventDefault(); saveDefaults();">
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
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Defaults
                </button>
            </form>
        </div>
    `;
}

window.saveDefaults = function () {
    const settings = window.state.cbSettings;
    settings.certificateNumberFormat = document.getElementById('cert-format').value;
    settings.dateFormat = document.getElementById('date-format').value;
    settings.defaultStage1Duration = parseInt(document.getElementById('stage1-duration').value);
    settings.defaultStage2Duration = parseInt(document.getElementById('stage2-duration').value);
    settings.notificationLeadTime = parseInt(document.getElementById('notification-lead').value);
    settings.sessionTimeout = parseInt(document.getElementById('session-timeout').value);
    settings.currency = document.getElementById('currency').value;
    settings.manDayCalculationMode = document.getElementById('manday-mode').value;

    window.saveData();
    window.showNotification('System defaults saved', 'success');
};

// ============================================
// TAB 8: DATA BACKUP & MANAGEMENT
// ============================================

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
                    <button class="btn btn-primary" onclick="backupData()">
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
                    <input type="file" id="restore-file" accept=".json" style="display: none;" onchange="restoreData(this)">
                    <button class="btn btn-secondary" onclick="document.getElementById('restore-file').click()">
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
                        <button class="btn btn-sm" onclick="editNCRCriteria('major')" style="margin-top: 0.5rem; font-size: 0.75rem;">
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
                        <button class="btn btn-sm" onclick="editNCRCriteria('minor')" style="margin-top: 0.5rem; font-size: 0.75rem;">
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
                        <button class="btn btn-sm" onclick="editNCRCriteria('observation')" style="margin-top: 0.5rem; font-size: 0.75rem;">
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
                                        <button class="btn btn-sm btn-icon" onclick="editCertDecision('${key}')" title="Edit">
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
                    <button class="btn btn-primary btn-sm" onclick="saveCAPATimelines()">
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
                    <button class="btn btn-primary btn-sm" onclick="saveAuditFrequency()">
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
    } catch (error) {
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
        } catch (error) {
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
            try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
            try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
            try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
        try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
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
        try { await window.SupabaseClient.syncSettingsToSupabase(window.state.settings); } catch (e) { console.warn(e); }
    }

    window.showNotification('Quality Policy saved', 'success');
};

window.saveDefaults = function () {
    const settings = window.state.cbSettings;
    settings.certificateNumberFormat = window.Sanitizer.sanitizeText(document.getElementById('cert-format').value);
    settings.dateFormat = document.getElementById('date-format').value;
    settings.defaultStage1Duration = parseInt(document.getElementById('stage1-duration').value);
    settings.defaultStage2Duration = parseInt(document.getElementById('stage2-duration').value);
    settings.notificationLeadTime = parseInt(document.getElementById('notification-lead').value);
    settings.sessionTimeout = parseInt(document.getElementById('session-timeout').value);
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

// ===================================
// MISSING HELPER FUNCTIONS (Restored)
// ===================================

window.cyclePermission = function (role, module) {
    const levels = ['none', 'view', 'assigned', 'own', 'full'];
    const current = window.state.rolePermissions[role][module] || 'none';
    let nextIndex = levels.indexOf(current) + 1;
    if (nextIndex >= levels.length) nextIndex = 0;

    window.state.rolePermissions[role][module] = levels[nextIndex];
    window.saveData();
    document.getElementById('settings-content').innerHTML = getPermissionsHTML();
};

window.addRetentionPolicy = function () {
    document.getElementById('modal-title').textContent = 'Add Retention Policy';
    document.getElementById('modal-body').innerHTML = `
        <form id="retention-form">
            <div class="form-group">
                <label>Record Type <span style="color:red">*</span></label>
                <input type="text" class="form-control" id="ret-type" required>
            </div>
            <div class="form-group">
                <label>Retention Period <span style="color:red">*</span></label>
                <input type="text" class="form-control" id="ret-period" placeholder="e.g. 5 years" required>
            </div>
            <div class="form-group">
                <label>Basis / Reference</label>
                <input type="text" class="form-control" id="ret-basis" placeholder="e.g. ISO 17021-1">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = () => {
        const type = document.getElementById('ret-type').value.trim();
        const period = document.getElementById('ret-period').value.trim();
        const basis = document.getElementById('ret-basis').value.trim();

        if (!type || !period) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        if (!window.state.retentionPolicies) window.state.retentionPolicies = [];
        window.state.retentionPolicies.push({ type, period, basis });
        window.saveData();
        window.closeModal();
        document.getElementById('settings-content').innerHTML = getRetentionHTML();
        window.showNotification('Policy added', 'success');
    };

    window.openModal();
};

window.editRetentionPolicy = function (index) {
    const policy = window.state.retentionPolicies[index];
    document.getElementById('modal-title').textContent = 'Edit Retention Policy';
    document.getElementById('modal-body').innerHTML = `
        <form id="retention-form">
            <div class="form-group">
                <label>Record Type <span style="color:red">*</span></label>
                <input type="text" class="form-control" id="ret-type" value="${window.UTILS.escapeHtml(policy.type)}" required>
            </div>
            <div class="form-group">
                <label>Retention Period <span style="color:red">*</span></label>
                <input type="text" class="form-control" id="ret-period" value="${window.UTILS.escapeHtml(policy.period)}" required>
            </div>
            <div class="form-group">
                <label>Basis / Reference</label>
                <input type="text" class="form-control" id="ret-basis" value="${window.UTILS.escapeHtml(policy.basis)}">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = () => {
        const type = document.getElementById('ret-type').value.trim();
        const period = document.getElementById('ret-period').value.trim();
        const basis = document.getElementById('ret-basis').value.trim();

        if (!type || !period) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        window.state.retentionPolicies[index] = { type, period, basis };
        window.saveData();
        window.closeModal();
        document.getElementById('settings-content').innerHTML = getRetentionHTML();
        window.showNotification('Policy updated', 'success');
    };

    window.openModal();
};

window.deleteRetentionPolicy = function (index) {
    if (confirm('Are you sure you want to delete this policy?')) {
        window.state.retentionPolicies.splice(index, 1);
        window.saveData();
        document.getElementById('settings-content').innerHTML = getRetentionHTML();
        window.showNotification('Policy deleted', 'success');
    }
};

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
    window.state.cbPolicies.capaTimelines.majorCorrection = parseInt(document.getElementById('capa-major').value) || 90;
    window.state.cbPolicies.capaTimelines.minorCorrection = parseInt(document.getElementById('capa-minor').value) || 30;
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
// ============================================

// Initialize Knowledge Base state
if (!window.state.knowledgeBase) {
    window.state.knowledgeBase = {
        standards: [],  // { id, name, fileName, uploadDate, status }
        sops: [],
        policies: []
    };
}

function getKnowledgeBaseHTML() {
    const kb = window.state.knowledgeBase;
    kb.standards = kb.standards || [];
    kb.sops = kb.sops || [];
    kb.policies = kb.policies || [];
    kb.marketing = kb.marketing || [];

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; color: var(--primary-color);">
                    <i class="fa-solid fa-brain" style="margin-right: 0.5rem;"></i>
                    Knowledge Base
                </h3>
                <button class="btn btn-sm" onclick="window.reSyncKnowledgeBase()" title="Pull latest documents from cloud">
                    <i class="fa-solid fa-sync"></i> Re-sync Cloud Data
                </button>
            </div>
            
            <!-- AI Diagnostics (Added for debugging) -->
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h5 style="margin: 0; color: #475569;"><i class="fa-solid fa-stethoscope"></i> AI Connection Diagnostics</h5>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.testAIConnection()">
                        Test API Connection
                    </button>
                </div>
                <div id="ai-diagnostic-result" style="margin-top: 10px; font-family: monospace; font-size: 0.85rem; display: none; padding: 10px; background: #e2e8f0; border-radius: 4px;"></div>
            </div>

            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-solid fa-lightbulb" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>AI-Powered Standards Reference</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">
                            Upload ISO Standards, SOPs, and Policies. AI will reference them when generating NCR findings and audit reports.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Standards Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #0369a1;">
                        <i class="fa-solid fa-book" style="margin-right: 0.5rem;"></i>
                        ISO Standards
                    </h4>
                    <button class="btn btn-primary btn-sm" onclick="window.uploadKnowledgeDoc('standard')">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload Standard
                    </button>
                </div>
                
                ${kb.standards.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.standards.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName)}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} clauses indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" onclick="window.analyzeStandard('${doc.id}')">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze Now
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" onclick="window.viewKBAnalysis('${doc.id}')" title="View Analysis">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" onclick="window.deleteKnowledgeDoc('standard', '${doc.id}')" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-book" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No ISO standards uploaded. Click "Upload Standard" to add.</p>
                    </div>
                `}
            </div>
            
            <!-- SOPs Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #059669;">
                        <i class="fa-solid fa-file-lines" style="margin-right: 0.5rem;"></i>
                        Standard Operating Procedures
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #059669; border-color: #059669;" onclick="window.uploadKnowledgeDoc('sop')">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload SOP
                    </button>
                </div>
                
                ${kb.sops.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.sops.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" onclick="window.analyzeDocument('sop', '${doc.id}')">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" onclick="window.viewKBAnalysis('${doc.id}')" title="View Analysis">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" onclick="window.deleteKnowledgeDoc('sop', '${doc.id}')" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-file-lines" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No SOPs uploaded. Click "Upload SOP" to add.</p>
                    </div>
                `}
            </div>
            
            <!-- Policies Section -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #7c3aed;">
                        <i class="fa-solid fa-shield" style="margin-right: 0.5rem;"></i>
                        CB Policies
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #7c3aed; border-color: #7c3aed;" onclick="window.uploadKnowledgeDoc('policy')">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload Policy
                    </button>
                </div>
                
                ${kb.policies.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.policies.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" onclick="window.analyzeDocument('policy', '${doc.id}')">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" onclick="window.viewKBAnalysis('${doc.id}')" title="View Analysis">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" onclick="window.deleteKnowledgeDoc('policy', '${doc.id}')" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-shield" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No policies uploaded. Click "Upload Policy" to add.</p>
                    </div>
                `}
            </div>

            <!-- Marketing Section -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: #db2777;">
                        <i class="fa-solid fa-bullhorn" style="margin-right: 0.5rem;"></i>
                        Company Brochure & Marketing
                    </h4>
                    <button class="btn btn-primary btn-sm" style="background: #db2777; border-color: #db2777;" onclick="window.uploadKnowledgeDoc('marketing')">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i>Upload
                    </button>
                </div>
                
                ${kb.marketing.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${kb.marketing.map(doc => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(doc.name)}</strong></td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.fileName || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(doc.uploadDate)}</td>
                                        <td>
                                            ${doc.status === 'ready' ? `
                                                <span class="badge" style="background: #10b981; color: white;">
                                                    <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i>Ready
                                                </span>
                                                ${doc.clauses && doc.clauses.length > 0 ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${doc.clauses.length} sections indexed</div>` : ''}
                                            ` : doc.status === 'processing' ? `
                                                <span class="badge" style="background: #3b82f6; color: white;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i>Analyzing...
                                                </span>
                                            ` : `
                                                <div>
                                                    <span class="badge" style="background: #f59e0b; color: white;">
                                                        <i class="fa-solid fa-clock" style="margin-right: 4px;"></i>Waiting
                                                    </span>
                                                    <button class="btn btn-sm" style="margin-left: 8px; font-size: 0.75rem;" onclick="window.analyzeDocument('marketing', '${doc.id}')">
                                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze
                                                    </button>
                                                </div>
                                            `}
                                        </td>
                                        <td>
                                            ${doc.status === 'ready' && doc.clauses && doc.clauses.length > 0 ? `
                                                <button class="btn btn-sm btn-icon" onclick="window.viewKBAnalysis('${doc.id}')" title="View Analysis">
                                                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-icon" onclick="window.deleteKnowledgeDoc('marketing', '${doc.id}')" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">
                        <i class="fa-solid fa-bullhorn" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No marketing materials uploaded. Click "Upload" to add.</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Upload Knowledge Document Modal
window.uploadKnowledgeDoc = function (type) {
    const typeLabel = type === 'standard' ? 'ISO Standard' : type === 'sop' ? 'SOP' : type === 'policy' ? 'Policy' : 'Marketing Material';

    document.getElementById('modal-title').textContent = `Upload ${typeLabel}`;
    document.getElementById('modal-body').innerHTML = `
        <form id="upload-kb-form">
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="kb-doc-name" placeholder="e.g., ISO 9001:2015" required>
            </div>
            <div class="form-group">
                <label>Select PDF File <span style="color: var(--danger-color);">*</span></label>
                <input type="file" class="form-control" id="kb-doc-file" accept=".pdf,.docx,.doc" required>
                <small style="color: var(--text-secondary);">Supported: PDF, DOCX (Max 10MB)</small>
            </div>
            <div style="background: #e0f2fe; padding: 1rem; border-radius: 6px; margin-top: 1rem;">
                <i class="fa-solid fa-info-circle" style="color: #0284c7; margin-right: 0.5rem;"></i>
                <span style="color: #0284c7; font-size: 0.9rem;">
                    Document will be processed and indexed for AI reference. This may take a few seconds.
                </span>
            </div>
        </form>
    `;


    const saveBtn = document.getElementById('modal-save');
    saveBtn.textContent = 'Upload';
    saveBtn.style.display = 'inline-block';

    saveBtn.onclick = async () => {
        const name = document.getElementById('kb-doc-name').value.trim();
        const fileInput = document.getElementById('kb-doc-file');

        if (!name || !fileInput.files[0]) {
            window.showNotification('Please fill all required fields', 'error');
            return;
        }

        // Show processing state
        const originalBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Processing File...';
        saveBtn.disabled = true;

        const file = fileInput.files[0];
        let extractedText = null;
        let docId = null;
        let cloudUrl = null;
        let cloudPath = null;

        // Extract text for analysis
        try {
            extractedText = await window.extractTextFromFile(file);
        } catch (err) {
            console.warn('Could not extract text:', err);
        }

        // Upload Document via standard client (Handles Storage + DB Metadata)
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                const uploadResult = await window.SupabaseClient.uploadDocument(file, {
                    name: name,
                    folder: type,
                    uploadedBy: window.state.currentUser?.email
                });

                cloudUrl = uploadResult.url;
                cloudPath = uploadResult.storage_path; // Correct property name from DB
                docId = uploadResult.id;
            } catch (uploadErr) {
                console.error('Failed to upload document to cloud:', uploadErr);
                window.showNotification('File saved locally (cloud upload failed)', 'warning');
                docId = Date.now();
            }
        } else {
            docId = Date.now();
        }

        const kb = window.state.knowledgeBase;
        const collection = type === 'standard' ? kb.standards : type === 'sop' ? kb.sops : type === 'policy' ? kb.policies : kb.marketing;

        // Create document entry with pending status
        const newDoc = {
            id: docId,
            name: name,
            fileName: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'pending',
            fileSize: file.size,
            extractedText: extractedText, // Save content for AI
            cloudUrl,  // Store cloud URL
            cloudPath, // Store cloud path
            clauses: []
        };

        collection.push(newDoc);
        window.saveData();
        window.closeModal();

        // Show upload notification
        const statusMsg = cloudUrl ? '(uploaded to cloud)' : '(saved locally)';
        window.showNotification(`${typeLabel} uploaded ${statusMsg}. Click "Analyze" to index sections.`, 'info');

        // Re-render the tab
        if (typeof switchSettingsSubTab === 'function') {
            switchSettingsSubTab('knowledge', 'kb');
        } else {
            renderSettings();
        }

        // Sync metadata to settings table
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
            } catch (e) {
                console.warn('Metadata sync failed:', e);
            }
        }
    };

    window.openModal();
};

// Analyze standard function (triggered by "Analyze Now" button)
window.analyzeStandard = async function (docId) {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id == docId);
    if (!doc) {
        window.showNotification('Standard not found', 'error');
        return;
    }

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    window.showNotification(`Analyzing ${doc.name}...`, 'info');

    // Extract clauses
    await extractStandardClauses(doc, doc.name);

    // Re-render
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    if (doc.status === 'ready') {
        window.showNotification(`${doc.name} analysis complete! ${doc.clauses ? doc.clauses.length : 0} clauses indexed.`, 'success');
    } else {
        window.showNotification(`Analysis complete. Using fallback clause data.`, 'info');
    }

    // Sync metadata
    if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
        try {
            await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
        } catch (e) {
            console.warn('Metadata sync failed:', e);
        }
    }
};

// Re-analyze a standard (for deeper extraction)
window.reanalyzeStandard = async function (docId) {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id == docId);
    if (!doc) {
        window.showNotification('Standard not found', 'error');
        return;
    }

    // Clear existing clauses and re-analyze
    doc.clauses = [];
    doc.status = 'pending';
    window.saveData();
    window.closeModal();

    // Trigger re-analysis
    await window.analyzeStandard(docId);
};
// Analyze SOP or Policy document - uses instant template (AI optional)
window.analyzeDocument = async function (type, docId) {
    const kb = window.state.knowledgeBase;
    const collection = type === 'sop' ? kb.sops : type === 'policy' ? kb.policies : kb.marketing;
    const doc = collection.find(d => d.id == docId);
    if (!doc) {
        window.showNotification('Document not found', 'error');
        return;
    }

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }

    window.showNotification(`Analyzing ${doc.name}...`, 'info');

    // Try AI Analysis if text is available
    if (doc.extractedText) {
        try {
            await window.analyzeCustomDocWithAI(doc, type);
            return; // Success
        } catch (e) {
            console.error('AI Analysis failed, using template fallback', e);
            window.showNotification('AI Analysis failed, using template.', 'warning');
        }
    }

    // Use instant template-based sections (Fallback)
    const fallbackSections = type === 'sop' ? [
        { clause: "1", title: "Purpose", requirement: "States the purpose and objectives of the SOP." },
        { clause: "2", title: "Scope", requirement: "Defines the scope and applicability of the procedure." },
        { clause: "3", title: "Responsibilities", requirement: "Identifies roles and responsibilities of personnel." },
        { clause: "4", title: "Procedure", requirement: "Step-by-step instructions for carrying out the process." },
        { clause: "5", title: "Records", requirement: "Documents and records to be maintained." },
        { clause: "6", title: "References", requirement: "Related documents and standards referenced." },
        { clause: "7", title: "Revision History", requirement: "Version control and change history." }
    ] : type === 'policy' ? [
        { clause: "1", title: "Purpose", requirement: "States why this policy exists and its objectives." },
        { clause: "2", title: "Scope", requirement: "Defines who and what the policy applies to." },
        { clause: "3", title: "Policy Statement", requirement: "The main policy declarations and commitments." },
        { clause: "4", title: "Definitions", requirement: "Key terms and their meanings." },
        { clause: "5", title: "Responsibilities", requirement: "Roles responsible for implementing the policy." },
        { clause: "6", title: "Compliance", requirement: "Requirements for compliance and enforcement." },
        { clause: "7", title: "Related Documents", requirement: "Associated policies, procedures, and references." }
    ] : [
        // Marketing/Brochure Default Sections
        { clause: "1", title: "Company Overview", requirement: "Mission, vision, core values, and history." },
        { clause: "2", title: "Services & Products", requirement: "Detailed description of offerings and capabilities." },
        { clause: "3", title: "Key Differentiators", requirement: "Unique selling points and competitive advantages." },
        { clause: "4", title: "Market Presence", requirement: "Target audience, geography, and industries served." },
        { clause: "5", title: "Certifications", requirement: "ISO certifications and other accreditations held." },
        { clause: "6", title: "Team & Expertise", requirement: "Key personnel and technical expertise." },
        { clause: "7", title: "Contact Information", requirement: "Office locations and support channels." },
        { clause: "8", title: "Case Studies & Safety Record", requirement: "Relevant past projects and safety performance statistics." }
    ];

    doc.clauses = fallbackSections;
    doc.status = 'ready';
    window.saveData();

    // Small delay for visual feedback
    setTimeout(async () => {
        switchSettingsTab('knowledgebase', document.querySelector('.tab-btn:last-child'));
        window.showNotification(`${doc.name} analyzed! ${doc.clauses.length} sections indexed.`, 'success');

        // Sync metadata
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
            } catch (e) {
                console.warn('Metadata sync failed:', e);
            }
        }
    }, 300);
};


// One-time clause extraction from standard
async function extractStandardClauses(doc, standardName) {
    // Detect standard type based on the name
    const stdLower = standardName.toLowerCase();
    let systemTerm, abbr;

    if (stdLower.includes('9001')) {
        systemTerm = 'Quality Management System (QMS)';
        abbr = 'QMS';
    } else if (stdLower.includes('14001')) {
        systemTerm = 'Environmental Management System (EMS)';
        abbr = 'EMS';
    } else if (stdLower.includes('45001')) {
        systemTerm = 'Occupational Health and Safety Management System';
        abbr = 'OH&S MS';
    } else if (stdLower.includes('27001')) {
        systemTerm = 'Information Security Management System (ISMS)';
        abbr = 'ISMS';
    } else if (stdLower.includes('22000')) {
        systemTerm = 'Food Safety Management System (FSMS)';
        abbr = 'FSMS';
    } else if (stdLower.includes('50001')) {
        systemTerm = 'Energy Management System (EnMS)';
        abbr = 'EnMS';
    } else if (stdLower.includes('13485')) {
        systemTerm = 'Medical Devices Quality Management System';
        abbr = 'MD-QMS';
    } else {
        systemTerm = 'Management System';
        abbr = 'MS';
    }

    console.log(`[KB Analysis] Starting AI extraction for: ${standardName} (${abbr})`);

    // Fix: Define docContent from the document object
    const docContent = doc.extractedText || '';

    if (!docContent || docContent.length < 100) {
        console.warn('[KB Analysis] Document text appears empty or too short. PDF text extraction might have failed.');
        window.showNotification('Warning: PDF text extraction returned little or no text. AI might fail.', 'warning');
    }

    try {
        // Build comprehensive extraction prompt
        const prompt = `You are an expert Lead Auditor for ISO standards. Your task is to extract every single audit requirement from the provided text for the standard "${standardName}".
        
        CRITICAL INSTRUCTIONS:
        1. This is a ${systemTerm}. TERMINOLOGY: Use "${abbr}" (e.g., "${abbr} policy", "effectiveness of the ${abbr}").
        2. SCOPE: Extract ALL requirements from Clause 4 through Clause 10. Do NOT skip any sub-clauses.
        3. COMPLETENESS: I need the FULL list. Do not summarize. Do not truncate. If there are 150 requirements, list all 150.
        4. FORMAT: Return a valid JSON array of objects.
        
        Source Text:
        ${docContent}
        
        Required JSON Structure:
        [
          {
            "clause": "4.1",
            "title": "Understanding the organization and its context",
            "requirement": "The organization shall determine external and internal issues...",
            "subRequirements": ["a) issue one", "b) issue two"]
          }
        ]
        
        Return ONLY valid JSON. No markdown formatting.`;

        console.log(`[KB Analysis] Calling AI API...`);

        // Direct fetch to proxy
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        console.log(`[KB Analysis] API Response Status: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            const text = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            console.log(`[KB Analysis] AI Response received, length: ${text.length} chars`);

            // Parse JSON from response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const newClauses = JSON.parse(jsonMatch[0]);
                doc.clauses = newClauses;
                doc.status = 'ready';
                doc.lastAnalyzed = new Date().toISOString().split('T')[0];
                window.saveData();
                console.log(`✅ [KB Analysis] SUCCESS! Extracted ${doc.clauses.length} clauses from ${standardName} via AI`);
                return;
            } else {
                console.warn(`[KB Analysis] No JSON array found in AI response`);
            }
        } else {
            const errorText = await response.text();
            console.error(`[KB Analysis] API Error: ${response.status} - ${errorText}`);
            window.showNotification(`AI Extraction Failed: ${response.status} - ${errorText.substring(0, 50)}`, 'error');
        }
    } catch (error) {
        console.error('[KB Analysis] Exception during AI extraction:', error);
        window.showNotification(`AI Error: ${error.message}`, 'error');
    }

    // Fallback: Use built-in clauses if API fails
    window.showNotification('Switching to offline fallback mode...', 'warning');
    console.warn(`⚠️ [KB Analysis] Falling back to built-in database for ${standardName}`);
    doc.clauses = getBuiltInClauses(standardName);
    doc.status = 'ready';
    doc.lastAnalyzed = new Date().toISOString().split('T')[0];
    window.saveData();
    console.log(`[KB Analysis] Fallback complete: ${doc.clauses.length} clauses loaded`);
}

// Built-in clause database for common standards (fallback) - COMPREHENSIVE with sub-clauses and bullet points
function getBuiltInClauses(standardName) {
    const iso9001Clauses = [
        // Clause 4 - Context of the organization
        { clause: "4.1", title: "Understanding the organization and its context", requirement: "The organization shall determine external and internal issues that are relevant to its purpose and strategic direction and that affect its ability to achieve the intended results of its QMS." },
        {
            clause: "4.2",
            title: "Understanding the needs and expectations of interested parties",
            requirement: "The organization shall determine the interested parties and their relevant requirements.",
            subRequirements: [
                "a) the interested parties that are relevant to the QMS",
                "b) the requirements of these interested parties that are relevant to the QMS",
                "c) which of these requirements will be addressed through the QMS"
            ]
        },
        {
            clause: "4.3",
            title: "Determining the scope of the quality management system",
            requirement: "The organization shall determine the boundaries and applicability of the QMS to establish its scope, considering:",
            subRequirements: [
                "a) the external and internal issues referred to in 4.1",
                "b) the requirements of relevant interested parties referred to in 4.2",
                "c) the products and services of the organization"
            ]
        },
        { clause: "4.4", title: "Quality management system and its processes", requirement: "The organization shall establish, implement, maintain and continually improve a QMS, including the processes needed and their interactions." },
        {
            clause: "4.4.1",
            title: "QMS processes - Requirements",
            requirement: "The organization shall determine the processes needed for the QMS and shall:",
            subRequirements: [
                "a) determine the inputs required and the outputs expected from these processes",
                "b) determine the sequence and interaction of these processes",
                "c) determine and apply the criteria and methods needed to ensure effective operation and control",
                "d) determine the resources needed for these processes and ensure their availability",
                "e) assign the responsibilities and authorities for these processes",
                "f) address the risks and opportunities as determined in accordance with 6.1",
                "g) evaluate these processes and implement any changes needed to ensure they achieve intended results",
                "h) improve the processes and the QMS"
            ]
        },
        {
            clause: "4.4.2",
            title: "QMS processes - Documentation",
            requirement: "To the extent necessary, the organization shall:",
            subRequirements: [
                "a) maintain documented information to support the operation of its processes",
                "b) retain documented information to have confidence that the processes are being carried out as planned"
            ]
        },

        // Clause 5 - Leadership
        { clause: "5.1", title: "Leadership and commitment", requirement: "Top management shall demonstrate leadership and commitment with respect to the quality management system." },
        {
            clause: "5.1.1",
            title: "Leadership and commitment - General",
            requirement: "Top management shall demonstrate leadership and commitment with respect to the QMS by:",
            subRequirements: [
                "a) taking accountability for the effectiveness of the QMS",
                "b) ensuring that the quality policy and quality objectives are established and compatible with strategic direction",
                "c) ensuring the integration of the QMS requirements into the organization's business processes",
                "d) promoting the use of the process approach and risk-based thinking",
                "e) ensuring that the resources needed for the QMS are available",
                "f) communicating the importance of effective quality management and conforming to the QMS requirements",
                "g) ensuring that the QMS achieves its intended results",
                "h) engaging, directing and supporting persons to contribute to the effectiveness of the QMS",
                "i) promoting improvement",
                "j) supporting other relevant management roles to demonstrate their leadership"
            ]
        },
        {
            clause: "5.1.2",
            title: "Customer focus",
            requirement: "Top management shall demonstrate leadership and commitment with respect to customer focus by ensuring that:",
            subRequirements: [
                "a) customer and applicable statutory and regulatory requirements are determined, understood and consistently met",
                "b) the risks and opportunities that can affect conformity of products and services and ability to enhance customer satisfaction are determined and addressed",
                "c) the focus on enhancing customer satisfaction is maintained"
            ]
        },
        { clause: "5.2", title: "Policy", requirement: "Top management shall establish, implement and maintain a quality policy." },
        {
            clause: "5.2.1",
            title: "Establishing the quality policy",
            requirement: "The quality policy shall:",
            subRequirements: [
                "a) be appropriate to the purpose and context of the organization and supports its strategic direction",
                "b) provide a framework for setting quality objectives",
                "c) include a commitment to satisfy applicable requirements",
                "d) include a commitment to continual improvement of the QMS"
            ]
        },
        {
            clause: "5.2.2",
            title: "Communicating the quality policy",
            requirement: "The quality policy shall:",
            subRequirements: [
                "a) be available and be maintained as documented information",
                "b) be communicated, understood and applied within the organization",
                "c) be available to relevant interested parties, as appropriate"
            ]
        },
        {
            clause: "5.3",
            title: "Organizational roles, responsibilities and authorities",
            requirement: "Top management shall ensure that the responsibilities and authorities for relevant roles are assigned, communicated and understood. Top management shall assign responsibility and authority for:",
            subRequirements: [
                "a) ensuring that the QMS conforms to the requirements of ISO 9001",
                "b) ensuring that the processes are delivering their intended outputs",
                "c) reporting on the performance of the QMS and on opportunities for improvement, in particular to top management",
                "d) ensuring the promotion of customer focus throughout the organization",
                "e) ensuring that the integrity of the QMS is maintained when changes to the QMS are planned and implemented"
            ]
        },

        // Clause 6 - Planning
        {
            clause: "6.1",
            title: "Actions to address risks and opportunities",
            requirement: "When planning for the QMS, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed to:",
            subRequirements: [
                "a) give assurance that the QMS can achieve its intended results",
                "b) enhance desirable effects",
                "c) prevent, or reduce, undesired effects",
                "d) achieve improvement"
            ]
        },
        {
            clause: "6.1.1",
            title: "Planning - Risks and opportunities",
            requirement: "The organization shall plan:",
            subRequirements: [
                "a) actions to address these risks and opportunities",
                "b) how to integrate and implement the actions into its QMS processes",
                "c) evaluate the effectiveness of these actions"
            ]
        },
        { clause: "6.1.2", title: "Planning - Objectives of actions", requirement: "Actions taken to address risks and opportunities shall be proportionate to the potential impact on the conformity of products and services." },
        { clause: "6.2", title: "Quality objectives and planning to achieve them", requirement: "The organization shall establish quality objectives at relevant functions, levels and processes needed for the QMS." },
        {
            clause: "6.2.1",
            title: "Quality objectives - Requirements",
            requirement: "The quality objectives shall:",
            subRequirements: [
                "a) be consistent with the quality policy",
                "b) be measurable",
                "c) take into account applicable requirements",
                "d) be relevant to conformity of products and services and to enhancement of customer satisfaction",
                "e) be monitored",
                "f) be communicated",
                "g) be updated as appropriate"
            ]
        },
        { clause: "6.2.2", title: "Planning to achieve objectives", requirement: "When planning how to achieve quality objectives, the organization shall determine what will be done, what resources will be required, who will be responsible, when it will be completed, and how results will be evaluated." },
        { clause: "6.3", title: "Planning of changes", requirement: "When the organization determines the need for changes to the QMS, changes shall be carried out in a planned manner considering the purpose, consequences, integrity and availability of resources." },

        // Clause 7 - Support
        { clause: "7.1", title: "Resources", requirement: "The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the QMS." },
        { clause: "7.1.1", title: "General - Resources", requirement: "The organization shall consider the capabilities of and constraints on existing internal resources and what needs to be obtained from external providers." },
        { clause: "7.1.2", title: "People", requirement: "The organization shall determine and provide the persons necessary for the effective implementation of its QMS and for the operation and control of its processes." },
        { clause: "7.1.3", title: "Infrastructure", requirement: "The organization shall determine, provide and maintain the infrastructure necessary for the operation of its processes and to achieve conformity of products and services." },
        { clause: "7.1.4", title: "Environment for the operation of processes", requirement: "The organization shall determine, provide and maintain the environment necessary for the operation of its processes and to achieve conformity of products and services." },
        { clause: "7.1.5", title: "Monitoring and measuring resources", requirement: "The organization shall determine and provide the resources needed to ensure valid and reliable results when monitoring or measuring is used to verify the conformity of products and services." },
        { clause: "7.1.5.1", title: "Monitoring and measuring resources - General", requirement: "Resources shall be suitable for the specific type of monitoring and measurement activities, and maintained to ensure continued fitness for purpose." },
        { clause: "7.1.5.2", title: "Measurement traceability", requirement: "When measurement traceability is a requirement, measuring equipment shall be calibrated or verified at specified intervals against standards traceable to international or national measurement standards." },
        { clause: "7.1.6", title: "Organizational knowledge", requirement: "The organization shall determine the knowledge necessary for the operation of its processes and to achieve conformity of products and services. This knowledge shall be maintained and made available." },
        { clause: "7.2", title: "Competence", requirement: "The organization shall determine necessary competence of persons doing work under its control that affects QMS performance and effectiveness, ensure these persons are competent on the basis of appropriate education, training, or experience, take actions to acquire the necessary competence, and retain appropriate documented information." },
        { clause: "7.3", title: "Awareness", requirement: "The organization shall ensure that persons doing work under its control are aware of the quality policy, relevant quality objectives, their contribution to the effectiveness of the QMS, and implications of not conforming with QMS requirements." },
        { clause: "7.4", title: "Communication", requirement: "The organization shall determine the internal and external communications relevant to the QMS, including what it will communicate, when to communicate, with whom to communicate, how to communicate, and who communicates." },
        { clause: "7.5", title: "Documented information", requirement: "The organization's QMS shall include documented information required by ISO 9001 and documented information determined necessary for the effectiveness of the QMS." },
        { clause: "7.5.1", title: "Documented information - General", requirement: "The extent of documented information can differ due to the size of organization, type of activities, processes, products and services, complexity of processes, and competence of persons." },
        { clause: "7.5.2", title: "Creating and updating", requirement: "When creating and updating documented information, the organization shall ensure appropriate identification and description, format, media, and review and approval for suitability and adequacy." },
        { clause: "7.5.3", title: "Control of documented information", requirement: "Documented information shall be controlled to ensure it is available and suitable for use where and when needed, and adequately protected from loss of confidentiality, improper use, or loss of integrity." },
        { clause: "7.5.3.1", title: "Control of documented information - Actions", requirement: "Activities shall include distribution, access, retrieval and use, storage and preservation, control of changes, retention and disposition." },
        { clause: "7.5.3.2", title: "External origin documented information", requirement: "Documented information of external origin necessary for QMS planning and operation shall be identified and controlled." },

        // Clause 8 - Operation
        { clause: "8.1", title: "Operational planning and control", requirement: "The organization shall plan, implement and control the processes needed to meet requirements for provision of products and services and to implement the actions determined in Clause 6." },
        { clause: "8.2", title: "Requirements for products and services", requirement: "The organization shall implement a process for communicating with customers and determining requirements for products and services." },
        { clause: "8.2.1", title: "Customer communication", requirement: "Communication with customers shall include providing information relating to products and services, handling enquiries, contracts or orders including changes, obtaining customer feedback including complaints, and handling or controlling customer property." },
        { clause: "8.2.2", title: "Determining the requirements for products and services", requirement: "When determining requirements for products and services to be offered, the organization shall ensure requirements are defined including applicable statutory and regulatory requirements, and it can meet the claims for products and services it offers." },
        { clause: "8.2.3", title: "Review of requirements for products and services", requirement: "The organization shall ensure it has ability to meet requirements for products and services to be offered to customers, including requirements specified by the customer, requirements not stated by the customer but necessary for intended use, statutory and regulatory requirements, and contract or order requirements differing from those previously expressed." },
        { clause: "8.2.3.1", title: "Review of requirements - Conduct", requirement: "The review shall be conducted before the organization commits to supplying products and services to a customer." },
        { clause: "8.2.3.2", title: "Review of requirements - Documented information", requirement: "The organization shall retain documented information on the results of the review and any new requirements for products and services." },
        { clause: "8.2.4", title: "Changes to requirements for products and services", requirement: "The organization shall ensure relevant documented information is amended and relevant persons are made aware of the changed requirements when requirements change." },
        { clause: "8.3", title: "Design and development of products and services", requirement: "The organization shall establish, implement and maintain a design and development process that is appropriate to ensure the subsequent provision of products and services." },
        { clause: "8.3.1", title: "Design and development - General", requirement: "When requirements are not already established or not defined by the customer, the organization shall establish a process for design and development." },
        { clause: "8.3.2", title: "Design and development planning", requirement: "In determining the stages and controls for design and development, the organization shall consider the nature, duration and complexity, required process stages, required verification and validation activities, responsibilities and authorities, internal and external resource needs, control of interfaces, involvement of customers and users, requirements for subsequent provision, and level of control expected by customers and other relevant interested parties." },
        { clause: "8.3.3", title: "Design and development inputs", requirement: "The organization shall determine the requirements essential for the specific types of products and services to be designed and developed, including functional and performance requirements, information derived from previous similar design and development activities, statutory and regulatory requirements, and standards or codes of practice the organization has committed to implement." },
        { clause: "8.3.4", title: "Design and development controls", requirement: "The organization shall apply controls to the design and development process to ensure results to be achieved are defined, reviews are conducted as planned, verification is conducted to ensure outputs meet input requirements, and validation is conducted to ensure products and services meet requirements for specified application or intended use." },
        { clause: "8.3.5", title: "Design and development outputs", requirement: "The organization shall ensure design and development outputs meet the input requirements, are adequate for the subsequent processes for provision of products and services, include or reference monitoring and measuring requirements and acceptance criteria, and specify characteristics essential for intended purpose and safe and proper provision." },
        { clause: "8.3.6", title: "Design and development changes", requirement: "The organization shall identify, review and control changes made during or after the design and development of products and services to the extent necessary to ensure there is no adverse impact on conformity to requirements." },
        { clause: "8.4", title: "Control of externally provided processes, products and services", requirement: "The organization shall ensure that externally provided processes, products and services conform to requirements." },
        { clause: "8.4.1", title: "External provision - General", requirement: "The organization shall determine the controls to be applied to externally provided processes, products and services when products and services from external providers are intended for incorporation, are provided directly to customers, or a process or part of a process is provided by an external provider." },
        { clause: "8.4.2", title: "Type and extent of control", requirement: "The organization shall ensure externally provided processes remain within the control of its QMS, define controls it intends to apply to an external provider and those it intends to apply to the resulting output, and take into consideration the potential impact on the organization's ability to consistently meet customer and applicable statutory and regulatory requirements." },
        { clause: "8.4.3", title: "Information for external providers", requirement: "The organization shall communicate to external providers its requirements for the processes, products and services to be provided, approval methods, competence and qualification requirements, interactions with the organization's QMS, control and monitoring of performance, and verification or validation activities." },
        { clause: "8.5", title: "Production and service provision", requirement: "The organization shall implement production and service provision under controlled conditions." },
        { clause: "8.5.1", title: "Control of production and service provision", requirement: "Controlled conditions shall include: availability of documented information, availability of suitable monitoring and measuring resources, implementation of monitoring and measurement activities, use of suitable infrastructure, appointment of competent persons, validation of ability to achieve planned results for special processes, implementation of actions to prevent human error, and implementation of release, delivery and post-delivery activities." },
        { clause: "8.5.2", title: "Identification and traceability", requirement: "The organization shall use suitable means to identify outputs when necessary to ensure conformity of products and services. The organization shall identify the status of outputs with respect to monitoring and measurement requirements. The organization shall control the unique identification of the outputs when traceability is a requirement and shall retain documented information necessary to enable traceability." },
        { clause: "8.5.3", title: "Property belonging to customers or external providers", requirement: "The organization shall exercise care with property belonging to customers or external providers while it is under the organization's control or being used. It shall identify, verify, protect and safeguard property, and report to the owner if property is lost, damaged or otherwise found to be unsuitable for use." },
        { clause: "8.5.4", title: "Preservation", requirement: "The organization shall preserve the outputs during production and service provision, to the extent necessary to ensure conformity to requirements. Preservation can include identification, handling, contamination control, packaging, storage, transmission or transportation, and protection." },
        { clause: "8.5.5", title: "Post-delivery activities", requirement: "The organization shall meet requirements for post-delivery activities associated with the products and services. The organization shall consider statutory and regulatory requirements, potential undesired consequences, nature, use and intended lifetime, customer requirements, and customer feedback." },
        { clause: "8.5.6", title: "Control of changes", requirement: "The organization shall review and control changes for production or service provision, to the extent necessary to ensure continuing conformity with requirements. The organization shall retain documented information describing the results of the review of changes, the person(s) authorizing the change, and any necessary actions arising from the review." },
        { clause: "8.6", title: "Release of products and services", requirement: "The organization shall implement planned arrangements at appropriate stages to verify that product and service requirements have been met. Release of products and services shall not proceed until planned arrangements have been satisfactorily completed, unless otherwise approved by a relevant authority and, as applicable, by the customer. The organization shall retain documented information on the release of products and services, including evidence of conformity with acceptance criteria and traceability to the person(s) authorizing the release." },
        { clause: "8.7", title: "Control of nonconforming outputs", requirement: "The organization shall ensure that outputs that do not conform to their requirements are identified and controlled to prevent their unintended use or delivery." },
        { clause: "8.7.1", title: "Nonconforming outputs - Actions", requirement: "The organization shall take appropriate action based on the nature of the nonconformity and its effect on the conformity of products and services. This shall also apply to nonconforming products and services detected after delivery of products, during or after the provision of services." },
        { clause: "8.7.2", title: "Nonconforming outputs - Documented information", requirement: "The organization shall retain documented information that describes the nonconformity, describes the actions taken, describes any concessions obtained, and identifies the authority deciding the action in respect of the nonconformity." },

        // Clause 9 - Performance evaluation
        { clause: "9.1", title: "Monitoring, measurement, analysis and evaluation", requirement: "The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation, when to monitor and measure, when to analyse and evaluate results." },
        { clause: "9.1.1", title: "Monitoring, measurement - General", requirement: "The organization shall evaluate the performance and the effectiveness of the QMS. The organization shall retain appropriate documented information as evidence of the results." },
        { clause: "9.1.2", title: "Customer satisfaction", requirement: "The organization shall monitor customers' perceptions of the degree to which their needs and expectations have been fulfilled. The organization shall determine the methods for obtaining, monitoring and reviewing this information." },
        { clause: "9.1.3", title: "Analysis and evaluation", requirement: "The organization shall analyse and evaluate appropriate data and information arising from monitoring and measurement. The results of analysis shall be used to evaluate conformity of products and services, degree of customer satisfaction, performance and effectiveness of the QMS, if planning has been implemented effectively, effectiveness of actions taken to address risks and opportunities, performance of external providers, and need for improvements to the QMS." },
        { clause: "9.2", title: "Internal audit", requirement: "The organization shall conduct internal audits at planned intervals to provide information on whether the QMS conforms to the organization's own requirements and ISO 9001, and is effectively implemented and maintained." },
        { clause: "9.2.1", title: "Internal audit - Requirements", requirement: "The organization shall plan, establish, implement and maintain an audit programme including the frequency, methods, responsibilities, planning requirements and reporting. The audit programme shall take into consideration the importance of the processes concerned, changes affecting the organization, and the results of previous audits." },
        { clause: "9.2.2", title: "Internal audit - Conduct", requirement: "The organization shall define the audit criteria and scope for each audit, select auditors and conduct audits to ensure objectivity and impartiality of the audit process, ensure results are reported to relevant management, take appropriate correction and corrective actions without undue delay, and retain documented information as evidence of the implementation of the audit programme and the audit results." },
        { clause: "9.3", title: "Management review", requirement: "Top management shall review the organization's QMS, at planned intervals, to ensure its continuing suitability, adequacy, effectiveness and alignment with the strategic direction of the organization." },
        { clause: "9.3.1", title: "Management review - General", requirement: "The management review shall be planned and carried out taking into consideration the status of actions from previous management reviews, changes in external and internal issues, information on the performance and effectiveness of the QMS." },
        { clause: "9.3.2", title: "Management review inputs", requirement: "The management review shall be planned and carried out taking into consideration customer satisfaction and feedback, the extent to which quality objectives have been met, process performance and conformity of products and services, nonconformities and corrective actions, monitoring and measurement results, audit results, performance of external providers, adequacy of resources, effectiveness of actions taken to address risks and opportunities, and opportunities for improvement." },
        { clause: "9.3.3", title: "Management review outputs", requirement: "The outputs of the management review shall include decisions and actions related to opportunities for improvement, any need for changes to the QMS, and resource needs. The organization shall retain documented information as evidence of the results of management reviews." },

        // Clause 10 - Improvement
        { clause: "10.1", title: "General - Improvement", requirement: "The organization shall determine and select opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction." },
        { clause: "10.2", title: "Nonconformity and corrective action", requirement: "When a nonconformity occurs, including any arising from complaints, the organization shall react to the nonconformity and take action to control and correct it and deal with the consequences." },
        { clause: "10.2.1", title: "Nonconformity and corrective action - Requirements", requirement: "The organization shall evaluate the need for action to eliminate the cause(s) of the nonconformity to prevent recurrence or occurrence elsewhere, by reviewing and analysing the nonconformity, determining the causes, determining if similar nonconformities exist or could potentially occur, implementing any action needed, reviewing the effectiveness of any corrective action taken, updating risks and opportunities determined during planning if necessary, and making changes to the QMS if necessary." },
        { clause: "10.2.2", title: "Nonconformity and corrective action - Documented information", requirement: "The organization shall retain documented information as evidence of the nature of the nonconformities and any subsequent actions taken, and the results of any corrective action." },
        { clause: "10.3", title: "Continual improvement", requirement: "The organization shall continually improve the suitability, adequacy and effectiveness of the quality management system. The organization shall consider the results of analysis and evaluation, and the outputs from management review, to determine if there are needs or opportunities that shall be addressed as part of continual improvement." }
    ];

    // ISO 14001 Environmental Management System clauses (Unique sections)
    if (standardName.includes('14001')) {
        const iso14001Specific = [
            { clause: "6.1.2", title: "Environmental aspects", requirement: "The organization shall determine the environmental aspects of its activities, products and services that it can control and those that it can influence, and their associated environmental impacts, considering a life cycle perspective." },
            { clause: "6.1.3", title: "Compliance obligations", requirement: "The organization shall determine and have access to the compliance obligations related to its environmental aspects." },
            { clause: "8.2", title: "Emergency preparedness and response", requirement: "The organization shall establish, implement and maintain the processes needed to prepare for and respond to potential emergency situations." }
        ];

        return iso9001Clauses.map(c => {
            const specific = iso14001Specific.find(s => s.clause === c.clause);
            if (specific) return specific;

            const mapped = {
                ...c,
                title: c.title.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace('customer', 'interested party'),
                requirement: c.requirement.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace(/customer(?!s)/gi, 'interested party')
            };

            if (mapped.subRequirements) {
                mapped.subRequirements = mapped.subRequirements.map(s =>
                    s.replace(/quality/gi, 'environmental').replace(/QMS/g, 'EMS').replace(/customer(?!s)/gi, 'interested party')
                );
            }

            return mapped;
        });
    }

    // ISO 45001 Occupational Health and Safety clauses (Unique sections)
    if (standardName.includes('45001')) {
        const iso45001Specific = [
            { clause: "5.4", title: "Consultation and participation of workers", requirement: "The organization shall establish, implement and maintain a process for consultation and participation of workers at all applicable levels and functions." },
            { clause: "6.1.2", title: "Hazard identification and assessment of risks and opportunities", requirement: "The organization shall establish, implement and maintain a process for hazard identification that is ongoing and proactive." },
            { clause: "8.1.2", title: "Eliminating hazards and reducing OH&S risks", requirement: "The organization shall establish, implement and maintain a process for the elimination of hazards and reduction of OH&S risks using the hierarchy of controls." }
        ];

        return iso9001Clauses.map(c => {
            const specific = iso45001Specific.find(s => s.clause === c.clause);
            if (specific) return specific;

            const mapped = {
                ...c,
                title: c.title.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S MS').replace('customer', 'worker'),
                requirement: c.requirement.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S management system').replace(/customer(?!s)/gi, 'worker')
            };

            if (mapped.subRequirements) {
                mapped.subRequirements = mapped.subRequirements.map(s =>
                    s.replace(/quality/gi, 'OH&S').replace(/QMS/g, 'OH&S management system').replace(/customer(?!s)/gi, 'worker')
                );
            }

            return mapped;
        });
    }

    if (standardName.includes('9001')) return iso9001Clauses;

    return iso9001Clauses; // Default fallback
}

// Lookup clause text from Knowledge Base (for NCR generation)
window.lookupClauseText = function (standardName, clauseNumber) {
    const kb = window.state.knowledgeBase || { standards: [] };
    const standard = kb.standards.find(s =>
        s.name.toLowerCase().includes(standardName.toLowerCase().replace('iso ', ''))
    );

    if (!standard || !standard.clauses) return null;

    const clause = standard.clauses.find(c =>
        c.clause === clauseNumber || c.clause.startsWith(clauseNumber)
    );

    return clause ? `${clause.title}: ${clause.requirement} ` : null;
};

// Update Knowledge Base Section Content (Manual Edit)
window.updateKBSection = function (docId, clauseId, newContent) {
    const kb = window.state.knowledgeBase;
    let doc = kb.standards.find(d => d.id == docId) ||
        kb.sops.find(d => d.id == docId) ||
        kb.policies.find(d => d.id == docId) ||
        kb.marketing.find(d => d.id == docId);

    if (doc && doc.clauses) {
        const clause = doc.clauses.find(c => c.clause === clauseId);
        if (clause) {
            clause.requirement = newContent;
            window.saveData();
            // Optional: Notification? unique notification might be annoying on every blur.
            // Maybe show a small toast or just save silently.
            console.log('Section updated:', clauseId);
        }
    }
};

// Helper: Extract text from file (PDF/Text)
window.extractTextFromFile = async function (file) {
    // Check if PDF.js is loaded
    if (file.type === 'application/pdf' && (typeof pdfjsLib === 'undefined')) {
        console.warn('PDF.js library not loaded. Skipping text extraction.');
        return null; // Graceful degradation
    }

    const extractionPromise = async () => {
        try {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                const maxPages = Math.min(pdf.numPages, 10);
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                return fullText;
            } else if (file.type.startsWith('text/')) {
                return await file.text();
            }
        } catch (e) {
            console.error('Text extraction extraction error:', e);
            throw e;
        }
        return null;
    };

    // Race against 4-second timeout to prevent UI freeze
    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
        console.warn('Text extraction timed out - skipping');
        resolve(null);
    }, 4000));

    try {
        return await Promise.race([extractionPromise(), timeoutPromise]);
    } catch (e) {
        return null;
    }
};

// Analyze Custom Document with AI
window.analyzeCustomDocWithAI = async function (doc, type) {
    const typeLabel = type === 'sop' ? 'Standard Operating Procedure' : type === 'policy' ? 'Policy' : 'Company Profile/Marketing';
    const context = doc.extractedText.substring(0, 15000); // Limit context size

    const prompt = `You are a QA Auditor.Analyze this ${typeLabel} text and extract key sections.
    Return a JSON array: [{ "clause": "1", "title": "Section Title", "requirement": "Summary of content..." }].
        Extract 6 - 10 key sections like Purpose, Scope, Responsibilities, or Company Overview, Products, etc.
    Keep summaries concise.

        Text:
    ${context}
    
    Return ONLY JSON.`;

    try {
        const response = await AI_SERVICE.callProxyAPI(prompt);
        let validJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const tabs = JSON.parse(validJson);

        doc.clauses = tabs;
        doc.status = 'ready';
        window.saveData();

        // Refresh UI
        if (typeof switchSettingsSubTab === 'function') {
            switchSettingsSubTab('knowledge', 'kb');
        } else {
            renderSettings();
        }
        window.showNotification(`${doc.name} analyzed with AI!`, 'success');
        return true;
    } catch (e) {
        console.error('AI Parse Error', e);
        throw e;
    }
};

// Handle Re-analyze / Reset Action
window.handleReanalyze = function (docId, docType) {
    if (docType === 'standard') {
        window.reanalyzeStandard(docId);
    } else {
        // Reset analysis (uses template)
        window.analyzeDocument(docType, docId);
        window.closeModal();
    }
};

// Delete Knowledge Document
window.deleteKnowledgeDoc = async function (type, id) {
    if (!confirm('Are you sure you want to delete this document from the Knowledge Base?')) return;

    const kb = window.state.knowledgeBase;
    let doc = null;

    // Find the document
    if (type === 'standard') {
        doc = kb.standards.find(d => d.id == id);
        kb.standards = kb.standards.filter(d => d.id != id);
    } else if (type === 'sop') {
        doc = kb.sops.find(d => d.id == id);
        kb.sops = kb.sops.filter(d => d.id != id);
    } else if (type === 'policy') {
        doc = kb.policies.find(d => d.id == id);
        kb.policies = kb.policies.filter(d => d.id != id);
    } else {
        doc = kb.marketing.find(d => d.id == id);
        kb.marketing = kb.marketing.filter(d => d.id != id);
    }

    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }
    window.showNotification('Document removed from Knowledge Base', 'success');

    // Delete from Supabase (storage + database)
    if (window.SupabaseClient && window.SupabaseClient.isInitialized && doc) {
        try {
            // Delete from storage if cloudPath exists
            if (doc.cloudPath) {
                console.log('[Delete] Attempting to delete from storage:', doc.cloudPath);
                const { data, error } = await window.SupabaseClient.client.storage
                    .from('documents')
                    .remove([doc.cloudPath]);
                if (error) {
                    console.error('[Delete] Storage deletion error:', error);
                } else {
                    console.log('[Delete] Successfully deleted file from storage:', doc.cloudPath, data);
                }
            } else {
                console.warn('[Delete] No cloudPath found for document:', doc);
            }

            // Delete from documents table
            await window.SupabaseClient.client
                .from('documents')
                .delete()
                .eq('id', id);
            console.log('Deleted document metadata from database:', id);

            // Sync settings (KB metadata)
            await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
        } catch (e) {
            console.error('Cloud deletion failed:', e);
            window.showNotification('Document deleted locally, but cloud sync failed', 'warning');
        }
    }
};

// ============================================
// VIEW KNOWLEDGE BASE ANALYSIS
// Shows extracted clauses and NCR references
// ============================================
window.viewKBAnalysis = function (docId) {
    const kb = window.state.knowledgeBase;

    // Search across all collections
    let doc = kb.standards.find(d => d.id == docId);
    let docType = 'standard';
    if (!doc) {
        doc = kb.sops.find(d => d.id == docId);
        docType = 'sop';
    }
    if (!doc) {
        doc = kb.policies.find(d => d.id == docId);
        docType = 'policy';
    }
    if (!doc) {
        doc = kb.marketing.find(d => d.id == docId);
        docType = 'marketing';
    }
    if (!doc) {
        window.showNotification('Document not found', 'error');
        return;
    }

    const clauses = doc.clauses || [];

    // Find NCRs that reference this standard
    const auditReports = window.state.auditReports || [];
    const referencedNCRs = [];

    auditReports.forEach(report => {
        const ncrs = report.ncrs || [];
        ncrs.forEach(ncr => {
            // Check if NCR references this standard
            if (ncr.standard && doc.name.toLowerCase().includes(ncr.standard.toLowerCase().replace('iso ', ''))) {
                referencedNCRs.push({
                    reportId: report.id,
                    clientName: report.clientName,
                    ncrId: ncr.id,
                    clause: ncr.clause,
                    finding: ncr.finding,
                    severity: ncr.type || ncr.severity
                });
            }
        });
    });

    document.getElementById('modal-title').textContent = `Analysis: ${doc.name}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem;">
            <!-- Analysis Status -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f0fdf4; border-radius: 8px; margin-bottom: 1rem;">
                <div>
                    <strong style="color: #166534;"><i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i>Analysis Complete</strong>
                    <div style="font-size: 0.85rem; color: #166534; margin-top: 0.25rem;">
                        ${clauses.length} ${docType === 'standard' ? 'clauses' : 'sections'} extracted • Uploaded ${doc.uploadDate}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-secondary" onclick="window.handleReanalyze('${doc.id}', '${docType}')" title="${docType === 'standard' ? 'Re-analyze with AI' : 'Reset Analysis Template'}">
                        <i class="fa-solid fa-rotate" style="margin-right: 0.25rem;"></i>${docType === 'standard' ? 'Re-analyze' : 'Reset'}
                    </button>
                    ${docType === 'standard' ? `<span class="badge" style="background: #dcfce7; color: #166534;">Ready for NCR</span>` : ''}
                </div>
            </div>
            
            <!-- NCR References (Standards Only) -->
            ${docType === 'standard' ? (referencedNCRs.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: #7c3aed;">
                        <i class="fa-solid fa-link" style="margin-right: 0.5rem;"></i>NCR References (${referencedNCRs.length})
                    </h4>
                    <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                        <table style="width: 100%; font-size: 0.85rem;">
                            <thead style="position: sticky; top: 0; background: #f8fafc;">
                                <tr>
                                    <th style="padding: 0.5rem;">Client</th>
                                    <th style="padding: 0.5rem;">Clause</th>
                                    <th style="padding: 0.5rem;">Finding</th>
                                    <th style="padding: 0.5rem;">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${referencedNCRs.map(ncr => `
                                    <tr>
                                        <td style="padding: 0.5rem;">${window.UTILS.escapeHtml(ncr.clientName || '-')}</td>
                                        <td style="padding: 0.5rem;"><span class="badge bg-blue">${window.UTILS.escapeHtml(ncr.clause || '-')}</span></td>
                                        <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UTILS.escapeHtml(ncr.finding || '-')}">${window.UTILS.escapeHtml(ncr.finding || '-')}</td>
                                        <td style="padding: 0.5rem;"><span class="badge" style="background: ${ncr.severity === 'Major' ? '#fee2e2' : '#fef3c7'}; color: ${ncr.severity === 'Major' ? '#991b1b' : '#92400e'};">${window.UTILS.escapeHtml(ncr.severity || 'NC')}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    No NCRs have referenced this standard yet. Clauses will be used when generating new NCR findings.
                </div>
            `) : ''}
            
            <!-- Extracted Sections -->
            <h4 style="margin: 0 0 0.75rem 0; color: #0369a1;">
                <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i>${docType === 'standard' ? 'Extracted Clauses' : 'Document Sections'} (${clauses.length})
            </h4>
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                <table style="width: 100%; font-size: 0.85rem;">
                    <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
                        <tr>
                            <th style="padding: 0.5rem; width: 70px;">${docType === 'standard' ? 'Clause' : 'Section'}</th>
                            <th style="padding: 0.5rem; width: 25%;">Title</th>
                            <th style="padding: 0.5rem;">Description / Content</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clauses.map(c => `
                            <tr style="vertical-align: top;">
                                <td style="padding: 0.5rem;"><span class="badge bg-blue">${window.UTILS.escapeHtml(c.clause)}</span></td>
                                <td style="padding: 0.5rem; font-weight: 500;">${window.UTILS.escapeHtml(c.title)}</td>
                                <td style="padding: 0.5rem; color: var(--text-secondary);">
                                    <div contenteditable="true" 
                                         onblur="window.updateKBSection('${doc.id}', '${c.clause}', this.innerText)" 
                                         title="Click to edit content"
                                         style="padding: 4px; border: 1px dashed transparent; border-radius: 4px; transition: all 0.2s; cursor: text;" 
                                         onfocus="this.style.borderColor='#3b82f6'; this.style.backgroundColor='#eff6ff'; this.style.color='#1e293b';"
                                         onmouseover="this.style.borderColor='#cbd5e1';" 
                                         onmouseout="if(document.activeElement !== this) this.style.borderColor='transparent';">
                                        ${window.UTILS.escapeHtml(c.requirement)}
                                    </div>
                                    ${c.subRequirements && c.subRequirements.length > 0 ? `
                                        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem; color: #374151;">
                                            ${c.subRequirements.map(sub => `
                                                <li style="margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(sub)}</li>
                                            `).join('')}
                                        </ul>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- How it's used -->
            <div style="margin-top: 1rem; padding: 0.75rem; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <strong style="color: #1e40af;">How this is used:</strong>
                <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; font-size: 0.85rem; color: #1e40af;">
                    ${docType === 'standard' ? `
                        <li>When creating NCRs, AI references these clauses to suggest findings</li>
                        <li>Clause requirements are included in NCR descriptions</li>
                        <li>Helps ensure audit findings align with standard requirements</li>
                    ` : docType === 'marketing' ? `
                        <li>Provides organizational context for Audit Planning</li>
                        <li>Used to brief auditors on company products, services, and market</li>
                        <li>Helps tailor audit questions to the organization's context</li>
                    ` : `
                        <li>References for confirming process compliance</li>
                        <li>Used to cross-check specific procedure steps</li>
                        <li>Ensures audit evidence aligns with internal controls</li>
                    `}
                </ul>
            </div>
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

// Re-analyze standard with AI for more detailed extraction
window.reanalyzeStandard = async function (docId) {
    const kb = window.state.knowledgeBase;
    const doc = kb.standards.find(d => d.id == docId);
    if (!doc) {
        console.warn('Document not found for re-analysis:', docId);
        return;
    }

    const isEMS = doc.name.toLowerCase().includes('14001');
    const isOHS = doc.name.toLowerCase().includes('45001');
    const systemTerm = isEMS ? 'Environmental Management System (EMS)' : isOHS ? 'OH&S Management System' : 'Quality Management System (QMS)';
    const abbr = isEMS ? 'EMS' : isOHS ? 'OH&S MS' : 'QMS';

    // Close the current modal
    window.closeModal();

    // Show processing notification
    window.showNotification(`Re-analyzing ${doc.name} for detailed clauses...`, 'info');

    // Update status to processing
    doc.status = 'processing';
    window.saveData();
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    }

    try {
        // Enhanced prompt with context-aware examples
        const prompt = `You are an ISO standards expert. For the standard "${doc.name}", provide a COMPREHENSIVE JSON array of ALL clauses and sub-clauses with their requirement text.
        
        This is an ${systemTerm} standard. Ensure requirements refer to "${abbr}" and not "QMS".

For each clause, include:
- "clause": The clause number (e.g., "4.4.1", "5.1.1")
- "title": The official clause title
- "requirement": The main requirement statement
- "subRequirements": An array of the specific bullet points (a, b, c, d, etc.)

Example format:
[
  {
    "clause": "5.1.1",
    "title": "Leadership and commitment - General",
    "requirement": "Top management shall demonstrate leadership and commitment...",
    "subRequirements": ["a) ...", "b) ..."]
  }
]

Return ONLY the JSON array.`;

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (response.ok) {
            const data = await response.json();
            const text = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse JSON from response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const newClauses = JSON.parse(jsonMatch[0]);
                doc.clauses = newClauses;
                doc.status = 'ready';
                doc.lastAnalyzed = new Date().toISOString().split('T')[0];
                window.saveData();

                window.showNotification(`Re-analysis complete! ${newClauses.length} clauses extracted.`, 'success');

                // Re-render and open the analysis view
                if (typeof switchSettingsSubTab === 'function') {
                    switchSettingsSubTab('knowledge', 'kb');
                }
                setTimeout(() => window.viewKBAnalysis(docId), 500);
                return;
            }
        }
    } catch (error) {
        console.error('Re-analysis error:', error);
    }

    // Fallback if AI fails - use built-in detailed clauses
    doc.clauses = getBuiltInClauses(doc.name);
    doc.status = 'ready';
    doc.lastAnalyzed = new Date().toISOString().split('T')[0];
    window.saveData();

    window.showNotification(`Re-analysis complete using built-in clause database (${doc.clauses.length} clauses).`, 'info');
    if (typeof switchSettingsSubTab === 'function') {
        switchSettingsSubTab('knowledge', 'kb');
    } else {
        renderSettings();
    }
    setTimeout(() => window.viewKBAnalysis(docId), 500);
};

// ============================================
// TAB: AUDITOR-CLIENT ASSIGNMENTS
// ============================================
// Manage which auditors are assigned to which clients
// Auditors only see clients they are assigned to

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
                <button class="btn btn-primary" onclick="openAddAssignmentModal()">
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
                                        <button onclick="removeAssignment(${auditor.id}, ${client.id})" style="background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0 0 0 4px;" title="Remove assignment">
                                            <i class="fa-solid fa-times-circle" style="font-size: 0.9rem;"></i>
                                        </button>
                                    </span>
                                `).join('') : `
                                    <span style="color: #94a3b8; font-style: italic; font-size: 0.85rem; padding: 6px 0;">
                                        <i class="fa-solid fa-circle-exclamation" style="margin-right: 0.5rem;"></i>
                                        No clients assigned - auditor won't see any client data
                                    </span>
                                `}
                                <button onclick="openQuickAssignModal(${auditor.id}, '${window.UTILS.escapeHtml(auditor.name)}')" 
                                    style="background: #e0f2fe; border: 1px dashed #0284c7; color: #0284c7; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 0.85rem;">
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
    const auditorId = parseInt(document.getElementById('assign-auditor').value);
    const clientId = parseInt(document.getElementById('assign-client').value);
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

    window.saveData();

    // Sync with Supabase
    if (window.SupabaseClient?.isInitialized) {
        try {
            await window.SupabaseClient.syncAuditorAssignmentsToSupabase(window.state.auditorAssignments);
        } catch (error) {
            console.error('Failed to sync assignments to Supabase:', error);
            window.showNotification('Assignment saved locally, but cloud sync failed.', 'warning');
        }
    }

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
                    <button class="btn btn-outline-secondary btn-sm" onclick="window.AuditTrail?.exportCSV()">
                        <i class="fa-solid fa-download" style="margin-right: 0.25rem;"></i>Export CSV
                    </button>
                    ${window.state.currentUser?.role === 'Admin' ? `
                    <button class="btn btn-outline-danger btn-sm" onclick="if(confirm('Clear all activity logs?')) { window.AuditTrail?.clear(); window.switchSettingsSubTab('system', 'activity-log'); }">
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
    const auditor = window.state.auditors.find(a => a.id == auditorId);
    const client = window.state.clients.find(c => c.id == clientId);

    const confirmMsg = `Remove "${client?.name || 'client'}" from ${auditor?.name || 'auditor'} 's assignments?

        Note: All audit history, records, and reports involving this auditor will be RETAINED.The auditor will still have access to past audits they participated in.

This only removes future access to new client data.`;

    if (confirm(confirmMsg)) {
        // Use loose equality (==) to handle type mismatches (string vs number)
        window.state.auditorAssignments = window.state.auditorAssignments.filter(
            a => !(a.auditorId == auditorId && a.clientId == clientId)
        );
        window.saveData();

        // Sync delete to Supabase
        if (window.SupabaseClient?.isInitialized) {
            try {
                await window.SupabaseClient.deleteAuditorAssignment(auditorId, clientId);
            } catch (error) {
                console.error('Failed to remove assignment from Supabase:', error);
                window.showNotification('Assignment removed locally, but cloud sync failed.', 'warning');
            }
        }

        switchSettingsTab('assignments', document.querySelector('.tab-btn[onclick*="assignments"]'));
        window.showNotification('Assignment removed. Historical audit records retained.', 'success');
    }
};

// ============================================
// USAGE ANALYTICS TAB - API COST MONITORING
// ============================================

function getUsageAnalyticsHTML() {
    // Get usage data from tracker
    const tracker = window.APIUsageTracker;
    if (!tracker) {
        return `
            <div class="fade-in">
                <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                    <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                    Usage Analytics
                </h3>
                <div class="alert alert-warning">
                    <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                    API Usage Tracker module not loaded. Please refresh the page.
                </div>
            </div>
            `;
    }

    const summary = tracker.getSummary();
    const todayUsage = tracker.getUsageByPeriod('today');
    const monthUsage = tracker.getUsageByPeriod('month');
    const features = Object.entries(summary.byFeature || {});

    return `
            <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                    API Usage Analytics
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline-secondary btn-sm" onclick="window.APIUsageTracker.exportData()">
                        <i class="fa-solid fa-download" style="margin-right: 0.25rem;"></i>Export
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="resetUsageData()">
                        <i class="fa-solid fa-trash" style="margin-right: 0.25rem;"></i>Reset
                    </button>
                </div>
            </div>

            <!--Pricing Info Banner-- >
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <i class="fa-solid fa-circle-info" style="font-size: 1.5rem;"></i>
                    <div>
                        <strong>Gemini 1.5 Flash Pricing</strong>
                        <div style="font-size: 0.85rem; opacity: 0.9;">
                            Input: $0.075/1M tokens • Output: $0.30/1M tokens
                        </div>
                    </div>
                </div>
            </div>

            <!--Summary Cards-- >
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Calls -->
                <div class="card" style="padding: 1.25rem; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                        ${summary.totalCalls}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Total API Calls</div>
                    <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
                        Today: ${todayUsage.calls}
                    </div>
                </div>

                <!-- Total Tokens -->
                <div class="card" style="padding: 1.25rem; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #7c3aed;">
                        ${tracker.formatTokens(summary.totalTokens)}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Tokens</div>
                    <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
                        In: ${tracker.formatTokens(summary.totalInputTokens)} / Out: ${tracker.formatTokens(summary.totalOutputTokens)}
                    </div>
                </div>

                <!-- Estimated Cost -->
                <div class="card" style="padding: 1.25rem; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: #059669;">
                        ${tracker.formatCost(summary.totalEstimatedCost)}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Est. Cost</div>
                    <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
                        This Month: ${tracker.formatCost(monthUsage.cost)}
                    </div>
                </div>

                <!-- Tracking Since -->
                <div class="card" style="padding: 1.25rem; border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 1.25rem; font-weight: bold; color: #374151;">
                        ${summary.createdAt ? new Date(summary.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Tracking Since</div>
                    <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">
                        ${summary.createdAt ? Math.ceil((new Date() - new Date(summary.createdAt)) / (1000 * 60 * 60 * 24)) : 0} days
                    </div>
                </div>
            </div>

            <!--Usage by Feature-- >
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-layer-group" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                    Usage by Feature
                </h4>
                ${features.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th style="text-align: center;">Calls</th>
                                    <th style="text-align: center;">Input Tokens</th>
                                    <th style="text-align: center;">Output Tokens</th>
                                    <th style="text-align: right;">Est. Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${features.map(([feature, data]) => `
                                    <tr>
                                        <td>
                                            <span class="badge" style="background: #e0f2fe; color: #0284c7;">
                                                ${tracker.getFeatureDisplayName(feature)}
                                            </span>
                                        </td>
                                        <td style="text-align: center; font-weight: bold;">${data.calls}</td>
                                        <td style="text-align: center;">${tracker.formatTokens(data.inputTokens)}</td>
                                        <td style="text-align: center;">${tracker.formatTokens(data.outputTokens)}</td>
                                        <td style="text-align: right; color: #059669; font-weight: bold;">${tracker.formatCost(data.cost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="background: #f8fafc; font-weight: bold;">
                                    <td>Total</td>
                                    <td style="text-align: center;">${summary.totalCalls}</td>
                                    <td style="text-align: center;">${tracker.formatTokens(summary.totalInputTokens)}</td>
                                    <td style="text-align: center;">${tracker.formatTokens(summary.totalOutputTokens)}</td>
                                    <td style="text-align: right; color: #059669;">${tracker.formatCost(summary.totalEstimatedCost)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-chart-pie" style="font-size: 2rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
                        <p style="margin: 0;">No API usage recorded yet.</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem;">Use AI features like Agenda Generation or NCR Analysis to start tracking.</p>
                    </div>
                `}
            </div>

            <!--Cost Projection-- >
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color);">
                <h4 style="margin: 0 0 1rem 0; color: #374151;">
                    <i class="fa-solid fa-calculator" style="margin-right: 0.5rem; color: #7c3aed;"></i>
                    Monthly Cost Projection
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                    ${[50, 100, 200, 500].map(audits => {
        // Estimate ~3.5 API calls per audit, ~3000 tokens per call
        const estimatedCalls = audits * 3.5;
        const estimatedTokens = estimatedCalls * 3000;
        const inputCost = (estimatedTokens * 0.6 / 1000000) * 0.075;
        const outputCost = (estimatedTokens * 0.4 / 1000000) * 0.30;
        const totalCost = inputCost + outputCost;
        return `
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #374151;">${audits}</div>
                                <div style="font-size: 0.8rem; color: #6b7280;">audits/month</div>
                                <div style="font-size: 1.1rem; font-weight: bold; color: #059669; margin-top: 0.5rem;">
                                    ~${tracker.formatCost(totalCost)}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
                <p style="margin: 1rem 0 0 0; font-size: 0.8rem; color: #6b7280; text-align: center;">
                    * Projections based on average of 3.5 AI calls per audit with ~3,000 tokens each
                </p>
            </div>
        </div>
            `;
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
        } catch (e) {
            data = { error: 'Could not parse JSON response' };
        }

        if (response.ok) {
            resultDiv.innerHTML = `< span style = "color: green; font-weight: bold;" >✅ Success(Status ${status})</span > <br>Response: ${JSON.stringify(data, null, 2)}`;
        } else {
            resultDiv.innerHTML = `<span style="color: red; font-weight: bold;">❌ Failed (Status ${status})</span><br>Error: ${JSON.stringify(data, null, 2)}`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<span style="color: red; font-weight: bold;">❌ Network Error</span><br>${error.message}`;
    }
};

Logger.info('Settings module extensions loaded');


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
        cbEmail: 'info@auditcb360.com',
        cbWebsite: 'https://auditcb360.com',
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
        'Lead Auditor': { dashboard: 'view', clients: 'view', auditors: 'view', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Auditor': { dashboard: 'view', clients: 'none', auditors: 'none', audits: 'assigned', certs: 'none', reports: 'own', settings: 'none' },
        'Client': { dashboard: 'none', clients: 'own', auditors: 'none', audits: 'own', certs: 'own', reports: 'own', settings: 'none' }
    };
}

function renderSettings() {
    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <div class="tab-container" style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem; overflow-x: auto; white-space: nowrap;">
                    <button class="tab-btn active" onclick="switchSettingsTab('profile', this)">CB Profile</button>
                    <button class="tab-btn" onclick="switchSettingsTab('accreditation', this)">Accreditation</button>
                    <button class="tab-btn" onclick="switchSettingsTab('organization', this)">Organization</button>
                    <button class="tab-btn" onclick="switchSettingsTab('permissions', this)">Permissions</button>
                    <button class="tab-btn" onclick="switchSettingsTab('retention', this)">Retention</button>
                    <button class="tab-btn" onclick="switchSettingsTab('policy', this)">Quality Policy</button>
                    <button class="tab-btn" onclick="switchSettingsTab('defaults', this)">Defaults</button>
                    <button class="tab-btn" onclick="switchSettingsTab('data', this)">Data Backup</button>
                </div>

                <div id="settings-content">
                    ${getCBProfileHTML()}
                </div>
            </div>
        </div>
    `;
    window.contentArea.innerHTML = html;
}

function switchSettingsTab(tabName, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    const container = document.getElementById('settings-content');
    switch (tabName) {
        case 'profile': container.innerHTML = getCBProfileHTML(); break;
        case 'accreditation': container.innerHTML = getAccreditationHTML(); break;
        case 'organization': container.innerHTML = getOrganizationHTML(); break;
        case 'permissions': container.innerHTML = getPermissionsHTML(); break;
        case 'retention': container.innerHTML = getRetentionHTML(); break;
        case 'policy': container.innerHTML = getQualityPolicyHTML(); break;
        case 'defaults': container.innerHTML = getDefaultsHTML(); break;
        case 'data': container.innerHTML = getDataManagementHTML(); break;
    }
}

// ============================================
// TAB 1: CB PROFILE & BRANDING
// ============================================

function getCBProfileHTML() {
    const settings = window.state.cbSettings;
    const sites = settings.cbSites || [{ name: 'Head Office', address: settings.cbAddress, city: '', country: '', phone: settings.cbPhone }];

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
                    <div style="width: 150px; height: 150px; border: 2px dashed var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f8fafc;">
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
                                        <button type="button" class="btn btn-sm btn-icon" onclick="editCBSite(${idx})" title="Edit">
                                            <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                        </button>
                                        ${sites.length > 1 ? `
                                            <button type="button" class="btn btn-sm btn-icon" onclick="deleteCBSite(${idx})" title="Delete">
                                                <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-secondary" onclick="addCBSite()" style="margin-top: 0.5rem;">
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
    const settings = window.state.cbSettings;
    settings.cbName = document.getElementById('cb-name').value;
    settings.cbTagline = document.getElementById('cb-tagline').value;
    settings.cbEmail = document.getElementById('cb-email').value;
    settings.cbPhone = document.getElementById('cb-phone').value;
    settings.cbWebsite = document.getElementById('cb-website').value;
    settings.cbAddress = document.getElementById('cb-address').value;
    settings.logoUrl = document.getElementById('cb-logo').value;
    settings.primaryColor = document.getElementById('primary-color').value;
    settings.secondaryColor = document.getElementById('secondary-color').value;

    window.saveData();
    window.showNotification('CB Profile saved successfully', 'success');
};

// ============================================
// TAB 2: ACCREDITATION & SCOPE
// ============================================

function getAccreditationHTML() {
    const settings = window.state.cbSettings;
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
                
                <h4 style="margin: 2rem 0 1rem; color: #0369a1;">Standards Offered</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
                    ${['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 50001:2018', 'ISO 22000:2018'].map(std => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" class="standard-checkbox" value="${std}" ${settings.standardsOffered.includes(std) ? 'checked' : ''}>
                            <span>${std}</span>
                        </label>
                    `).join('')}
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                    Save Accreditation
                </button>
            </form>
        </div>
    `;
}

window.saveAccreditation = function () {
    const settings = window.state.cbSettings;
    settings.accreditationBody = document.getElementById('ab-name').value;
    settings.accreditationNumber = document.getElementById('ab-number').value;
    settings.accreditationExpiry = document.getElementById('ab-expiry').value;
    settings.iafMlaStatus = document.getElementById('iaf-mla').checked;

    settings.standardsOffered = Array.from(document.querySelectorAll('.standard-checkbox:checked')).map(cb => cb.value);

    window.saveData();
    window.showNotification('Accreditation settings saved', 'success');
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
                <button class="btn btn-primary" onclick="addDesignation()">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    Add Designation
                </button>
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
                                    <button class="btn btn-sm btn-icon" onclick="editDesignation(${pos.id})" title="Edit">
                                        <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" onclick="deleteDesignation(${pos.id})" title="Delete">
                                        <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.addDesignation = function () {
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
    document.getElementById('modal-save').onclick = () => {
        const title = document.getElementById('designation-title').value.trim();
        if (!title) return;

        window.state.orgStructure.push({
            id: Date.now(),
            title: window.Sanitizer.sanitizeText(title),
            department: window.Sanitizer.sanitizeText(document.getElementById('designation-dept').value.trim()),
            reportsTo: window.Sanitizer.sanitizeText(document.getElementById('designation-reports').value.trim()) || null
        });

        window.saveData();
        window.closeModal();
        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation added', 'success');
    };

    window.openModal();
};

window.deleteDesignation = function (id) {
    if (confirm('Delete this designation?')) {
        window.state.orgStructure = window.state.orgStructure.filter(p => p.id !== id);
        window.saveData();
        switchSettingsTab('organization', document.querySelector('.tab-btn:nth-child(3)'));
        window.showNotification('Designation deleted', 'success');
    }
};

// ============================================
// TAB 4: ROLE PERMISSIONS
// ============================================

function getPermissionsHTML() {
    const permissions = window.state.rolePermissions;
    const modules = ['dashboard', 'clients', 'auditors', 'audits', 'certs', 'reports', 'settings'];
    const roles = Object.keys(permissions);

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-shield-halved" style="margin-right: 0.5rem;"></i>
                User Role Permissions
            </h3>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Role</th>
                            ${modules.map(m => `<th style="text-transform: capitalize;">${m}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${roles.map(role => `
                            <tr>
                                <td><strong>${role}</strong></td>
                                ${modules.map(module => {
        const perm = permissions[role][module];
        const color = perm === 'full' ? 'green' : perm === 'view' || perm === 'assigned' || perm === 'own' ? 'orange' : 'gray';
        return `<td><span class="badge" style="background: ${color}; color: white;">${perm}</span></td>`;
    }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #059669; border-radius: 4px;">
                <small style="color: #065f46;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    <strong>Permission Levels:</strong> full = all actions, view = read-only, assigned = own assigned items, own = own data only, none = no access
                </small>
            </div>
        </div>
    `;
}

// ============================================
// TAB 5: RECORD RETENTION (Moved from separate module)
// ============================================

function getRetentionHTML() {
    const retentionPolicies = window.state.retentionPolicies || [
        { type: 'Audit Reports', period: '6 years', basis: 'ISO 17021-1' },
        { type: 'Certificates', period: '10 years', basis: 'Accreditation Requirements' },
        { type: 'NCR Evidence', period: '6 years', basis: 'ISO 17021-1' },
        { type: 'Training Records', period: '10 years', basis: 'HR Policy' },
        { type: 'Impartiality Records', period: '5 years', basis: 'ISO 17021-1' },
        { type: 'Management Review Minutes', period: '5 years', basis: 'ISO 17021-1' }
    ];

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-archive" style="margin-right: 0.5rem;"></i>
                Record Retention Policy
            </h3>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Record Type</th>
                            <th>Retention Period</th>
                            <th>Legal Basis</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${retentionPolicies.map(policy => `
                            <tr>
                                <td><strong>${window.UTILS.escapeHtml(policy.type)}</strong></td>
                                <td><span class="badge bg-blue">${window.UTILS.escapeHtml(policy.period)}</span></td>
                                <td>${window.UTILS.escapeHtml(policy.basis)}</td>
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
    const settings = window.state.cbSettings;
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
                            ${settings.qualityObjectives.map((obj, idx) => `
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

window.saveQualityPolicy = function () {
    const settings = window.state.cbSettings;
    settings.qualityPolicy = document.getElementById('quality-policy').value;
    settings.msScope = document.getElementById('ms-scope').value;
    settings.policyLastReviewed = document.getElementById('policy-reviewed').value;
    settings.policyApprovedBy = document.getElementById('policy-approved').value;

    window.saveData();
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

// ============================================
// CB PROFILE HELPER FUNCTIONS
// ============================================

window.handleLogoUpload = function (input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        window.showNotification('Logo file too large. Max 2MB', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        window.state.cbSettings.logoUrl = e.target.result;
        document.getElementById('cb-logo').value = 'Data URL (uploaded)';
        window.saveData();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Logo uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
};

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
    document.getElementById('modal-save').onclick = () => {
        const name = document.getElementById('site-name').value.trim();
        const address = document.getElementById('site-address').value.trim();

        if (!name || !address) {
            window.showNotification('Please fill required fields', 'error');
            return;
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
        window.closeModal();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location added', 'success');
    };

    window.openModal();
};

window.editCBSite = function (idx) {
    const sites = window.state.cbSettings.cbSites || [];
    const site = sites[idx];

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
    document.getElementById('modal-save').onclick = () => {
        sites[idx] = {
            name: window.Sanitizer.sanitizeText(document.getElementById('site-name').value.trim()),
            address: window.Sanitizer.sanitizeText(document.getElementById('site-address').value.trim()),
            city: window.Sanitizer.sanitizeText(document.getElementById('site-city').value.trim()),
            country: window.Sanitizer.sanitizeText(document.getElementById('site-country').value.trim()),
            phone: window.Sanitizer.sanitizeText(document.getElementById('site-phone').value.trim())
        };

        window.saveData();
        window.closeModal();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location updated', 'success');
    };

    window.openModal();
};

window.deleteCBSite = function (idx) {
    if (confirm('Delete this office location?')) {
        window.state.cbSettings.cbSites.splice(idx, 1);
        window.saveData();
        switchSettingsTab('profile', document.querySelector('.tab-btn:first-child'));
        window.showNotification('Office location deleted', 'success');
    }
};

// ============================================
// SAVE FUNCTIONS WITH SANITIZATION
// ============================================

window.saveCBProfile = function () {
    const settings = window.state.cbSettings;
    settings.cbName = window.Sanitizer.sanitizeText(document.getElementById('cb-name').value);
    settings.cbTagline = window.Sanitizer.sanitizeText(document.getElementById('cb-tagline').value);
    settings.cbEmail = window.Sanitizer.sanitizeEmail(document.getElementById('cb-email').value);
    settings.cbPhone = window.Sanitizer.sanitizeText(document.getElementById('cb-phone').value);
    settings.cbWebsite = window.Sanitizer.sanitizeUrl(document.getElementById('cb-website').value);
    settings.cbAddress = window.Sanitizer.sanitizeText(document.getElementById('cb-address').value);
    settings.logoUrl = window.Sanitizer.sanitizeUrl(document.getElementById('cb-logo').value);
    settings.primaryColor = window.Sanitizer.sanitizeText(document.getElementById('primary-color').value);
    settings.secondaryColor = window.Sanitizer.sanitizeText(document.getElementById('secondary-color').value);

    window.saveData();
    window.showNotification('CB Profile saved successfully', 'success');
};

window.saveAccreditation = function () {
    const settings = window.state.cbSettings;
    settings.accreditationBody = window.Sanitizer.sanitizeText(document.getElementById('ab-name').value);
    settings.accreditationNumber = window.Sanitizer.sanitizeText(document.getElementById('ab-number').value);
    settings.accreditationExpiry = document.getElementById('ab-expiry').value;
    settings.iafMlaStatus = document.getElementById('iaf-mla').checked;

    settings.standardsOffered = Array.from(document.querySelectorAll('.standard-checkbox:checked')).map(cb => window.Sanitizer.sanitizeText(cb.value));

    window.saveData();
    window.showNotification('Accreditation settings saved', 'success');
};

window.saveQualityPolicy = function () {
    const settings = window.state.cbSettings;
    settings.qualityPolicy = window.Sanitizer.sanitizeText(document.getElementById('quality-policy').value);
    settings.msScope = window.Sanitizer.sanitizeText(document.getElementById('ms-scope').value);
    settings.policyLastReviewed = document.getElementById('policy-reviewed').value;
    settings.policyApprovedBy = window.Sanitizer.sanitizeText(document.getElementById('policy-approved').value);

    window.saveData();
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

// Export functions
window.renderSettings = renderSettings;
window.switchSettingsTab = switchSettingsTab;
window.backupData = backupData;
window.restoreData = restoreData;

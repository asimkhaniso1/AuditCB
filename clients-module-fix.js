/**
 * CLIENT MODULE FIXES - v5 (Complete with HTML Generators)
 * Exposes ALL functions to global scope that were accidentally privately scoped in clients-module.js
 * INCLUDES HTML Generators to ensure they bind to the global functions.
 */
console.log('[DEBUG] clients-module-fix.js loading...');

// ============================================
// 1. ORIGINAL FIXES (HTML GENERATORS - ORG SETUP)
// ============================================

window.getClientOrgSetupHTML = function (client) {
    if (!client._wizardStep) client._wizardStep = 1;
    const currentStep = client._wizardStep;

    const steps = [
        { id: 1, title: 'Org Context', icon: 'fa-building', color: '#6366f1' },
        { id: 2, title: 'Sites', icon: 'fa-map-location-dot', color: '#ec4899' },
        { id: 3, title: 'Departments', icon: 'fa-sitemap', color: '#8b5cf6' },
        { id: 4, title: 'Designations', icon: 'fa-id-badge', color: '#84cc16' },
        { id: 5, title: 'Personnel', icon: 'fa-address-book', color: '#10b981' },
        { id: 6, title: 'Goods/Services', icon: 'fa-boxes-stacked', color: '#f59e0b' },
        { id: 7, title: 'Key Processes', icon: 'fa-diagram-project', color: '#06b6d4' }
    ];

    const progressWidth = ((currentStep - 1) / (steps.length - 1)) * 100;

    return `
<div class="wizard-container fade-in" style="background: #fff; border-radius: 12px; overflow: hidden;">
    <div style="background: #f8fafc; padding: 2rem; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; position: relative; max-width: 800px; margin-left: auto; margin-right: auto;">
            <div style="position: absolute; top: 20px; left: 0; right: 0; height: 4px; background: #e2e8f0; z-index: 1;"></div>
            <div style="position: absolute; top: 20px; left: 0; width: ${progressWidth}%; height: 4px; background: var(--primary-color); z-index: 2; transition: width 0.3s ease;"></div>
            ${steps.map(step => `
                <div class="wizard-step ${step.id <= currentStep ? 'active' : ''}" 
                     style="z-index: 3; position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;"
                     onclick="window.setSetupWizardStep(${client.id}, ${step.id})">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${step.id <= currentStep ? step.color : '#fff'}; border: 2px solid ${step.id <= currentStep ? step.color : '#e2e8f0'}; color: ${step.id <= currentStep ? '#fff' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; transition: all 0.2s; box-shadow: ${step.id === currentStep ? '0 0 0 4px rgba(99, 102, 241, 0.2)' : 'none'};">
                        <i class="fa-solid ${step.icon}"></i>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${step.id === currentStep ? '#1e293b' : '#94a3b8'};">${step.title}</span>
                </div>
            `).join('')}
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0; color: #1e293b;">${steps[currentStep - 1].title}</h2>
            <p style="color: #64748b; margin: 0.5rem 0 0 0;">Step ${currentStep} of ${steps.length}</p>
        </div>
    </div>
    <div id="wizard-content" style="padding: 2rem;">
        ${window.getClientOrgSetupHTML.renderWizardStep(client, currentStep)}
    </div>
    <div style="padding: 1.5rem 2rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between;">
        <button class="btn btn-secondary" ${currentStep === 1 ? 'disabled' : ''} onclick="window.setSetupWizardStep(${client.id}, ${currentStep - 1})">
            <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Previous
        </button>
        <button class="btn btn-primary" onclick="window.setSetupWizardStep(${client.id}, ${currentStep < 7 ? currentStep + 1 : 1})">
            ${currentStep < 7 ? 'Next Step <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>' : 'Finish <i class="fa-solid fa-check" style="margin-left: 0.5rem;"></i>'}
        </button>
    </div>
</div>`;
};

window.getClientOrgSetupHTML.renderWizardStep = function (client, step) {
    switch (step) {
        case 1: return window.getClientProfileHTML(client);
        case 2: return window.getClientSitesHTML(client);
        case 3: return window.getClientDepartmentsHTML(client);
        case 4: return window.getClientDesignationsHTML(client);
        case 5: return window.getClientContactsHTML(client);
        case 6: return window.getClientGoodsServicesHTML(client);
        case 7: return window.getClientKeyProcessesHTML(client);
        default: return '';
    }
};

window.setSetupWizardStep = function (clientId, step) {
    if (step < 1 || step > 7) return;
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client) {
        client._wizardStep = step;
        const tabContent = document.getElementById('tab-content');
        if (tabContent) {
            tabContent.innerHTML = window.getClientOrgSetupHTML(client);
            if (window.saveData) window.saveData();
        }
    }
};

window.getClientCertificatesHTML = function (client) {
    const certs = client.certificates || [];
    const allStandards = new Set();
    if (client.standard) client.standard.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
    if (client.sites) {
        client.sites.forEach(site => {
            if (site.standards) site.standards.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
        });
    }

    if (certs.length === 0 && allStandards.size > 0) {
        return `
    <div class="fade-in" style="text-align: center; padding: 3rem;">
        <i class="fa-solid fa-certificate" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
        <h3>Initialize Certification Records</h3>
        <button class="btn btn-primary" onclick="window.generateCertificatesFromStandards(${client.id})">Generate Records</button>
    </div>`;
    }

    return `
<div class="fade-in">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--primary-color); margin: 0;"><i class="fa-solid fa-certificate"></i> Certification Scopes & History</h3>
        <button class="btn btn-secondary btn-sm" onclick="window.generateCertificatesFromStandards(${client.id})"><i class="fa-solid fa-sync"></i> Sync Standards</button>
    </div>
    ${certs.map((cert, index) => {
        const relevantSites = (client.sites || []).filter(s => (s.standards && s.standards.includes(cert.standard)) || (!s.standards && client.standard && client.standard.includes(cert.standard)));
        return `
        <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <div>
                    <span class="badge" style="background: var(--primary-color); color: white;">${cert.standard}</span>
                    <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem;">
                        Cert #: <input type="text" value="${cert.certificateNo || ''}" style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 4px; width: 150px;" onchange="window.updateCertField(${client.id}, ${index}, 'certificateNo', this.value)">
                    </div>
                </div>
                <div style="text-align: right;">
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem;" onclick="window.viewCertRevisionHistory(${client.id}, ${index})">History</button>
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; color: var(--danger-color); border-color: var(--danger-color);" onclick="window.deleteCertificationScope(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: var(--primary-color);">Site-Specific Scopes</h4>
                ${relevantSites.map(site => {
            const siteScope = (cert.siteScopes && cert.siteScopes[site.name]) ? cert.siteScopes[site.name] : (cert.scope || '');
            return `<div style="margin-bottom: 0.5rem;"><strong>${site.name}:</strong><br><textarea class="form-control" rows="2" onchange="window.updateSiteScope(${client.id}, ${index}, '${site.name}', this.value)">${siteScope}</textarea></div>`;
        }).join('')}
            </div>
            <div style="margin-top: 1rem; text-align: right;">
                 <button class="btn btn-primary" onclick="window.saveCertificateDetails(${client.id})">Save Changes</button>
            </div>
        </div>`;
    }).join('')}
</div>`;
};

window.generateCertificatesFromStandards = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    const allStandards = new Set();
    if (client.standard) client.standard.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
    if (client.sites) client.sites.forEach(site => { if (site.standards) site.standards.split(',').map(s => s.trim()).forEach(s => allStandards.add(s)); });
    if (!client.certificates) client.certificates = [];
    allStandards.forEach(std => {
        if (!client.certificates.find(c => c.standard === std)) {
            client.certificates.push({ id: 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 10000), standard: std, certificateNo: '', status: 'Active', revision: '00', scope: client.scope || '', siteScopes: {} });
        }
    });
    if (window.saveData) window.saveData();
    if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
    if (window.renderClientDetail) renderClientDetail(clientId);
    setTimeout(() => document.querySelector('.tab-btn[data-tab="scopes"]')?.click(), 100);
    if (window.showNotification) window.showNotification('Certificate records generated');
};
window.updateCertField = function (clientId, certIndex, field, value) { const client = window.state.clients.find(c => String(c.id) === String(clientId)); if (client) client.certificates[certIndex][field] = value; };
window.updateSiteScope = function (clientId, certIndex, siteName, value) { const client = window.state.clients.find(c => String(c.id) === String(clientId)); if (client) { if (!client.certificates[certIndex].siteScopes) client.certificates[certIndex].siteScopes = {}; client.certificates[certIndex].siteScopes[siteName] = value; } };
window.saveCertificateDetails = function (clientId) { if (window.saveData) window.saveData(); if (window.showNotification) window.showNotification('Saved', 'success'); };
window.getClientSettingsHTML = function (client) { return `<div class="fade-in"><h3>Client Settings</h3><button class="btn btn-danger" onclick="window.deleteClient('${client.id}')">Delete Client</button></div>`; };

// ============================================
// 2. HTML GENERATORS (EXTRACTED)
// ============================================

window.getClientSitesHTML = function (client) {
    // Redefined to use global window.addSite/editSite
    return `
    <!--Sites / Locations-->
    <div class="card" style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-map-location-dot" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Sites & Locations</h3>
            ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadSites(${client.id})">
                        <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.addSite(${client.id})">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Site
                    </button>
                </div>
                ` : ''}
        </div>
        ${(client.sites && client.sites.length > 0) ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Site Name</th><th>Standards</th><th>Address</th><th>City</th><th>Employees</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            ${client.sites.map((s, index) => `
                                <tr>
                                    <td style="font-weight: 500;">${window.UTILS.escapeHtml(s.name)}</td>
                                    <td><span style="font-size: 0.85rem; color: var(--primary-color); background: #eff6ff; padding: 2px 6px; border-radius: 4px;">${window.UTILS.escapeHtml(s.standards || 'Inherited')}</span></td>
                                    <td>${window.UTILS.escapeHtml(s.address || '-')}</td>
                                    <td>${window.UTILS.escapeHtml(s.city || '-')}</td>
                                    <td>${s.employees || '-'}</td>
                                    <td>
                                        ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                                        <div style="display: flex; gap: 0.25rem;">
                                            <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editSite(${client.id}, ${index})">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteSite(${client.id}, ${index})">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 2rem; background: #f8fafc;">
                    <p style="color: var(--text-secondary); margin: 0;">No sites added yet.</p>
                </div>
            `}
    </div>`;
};

window.getClientProfileHTML = function (client) {
    const profile = client.profile || '';
    const lastUpdated = client.profileUpdated ? new Date(client.profileUpdated).toLocaleString() : 'Never';
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div><h3 style="margin: 0;">Organization Context</h3><p>Last updated: ${lastUpdated}</p></div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.editCompanyProfile(${client.id})">Edit Manually</button>
                <button class="btn btn-sm" onclick="window.generateCompanyProfile(${client.id})">AI Generate</button>
            </div>
        </div>
        ${profile ? `<div style="background: #f8fafc; padding: 1.5rem; white-space: pre-wrap;">${window.UTILS.escapeHtml(profile)}</div>` : `<div style="text-align: center; padding: 2rem;">No profile.</div>`}
    </div>`;
};

window.getClientContactsHTML = function (client) {
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-address-book" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Contact Persons</h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addContactPerson(${client.id})">Add</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadContacts(${client.id})">Bulk Upload</button>
            </div>
        </div>
        ${(client.contacts && client.contacts.length > 0) ? `
            <div class="table-container">
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Actions</th></tr></thead>
                    <tbody>${client.contacts.map((c, index) => `
                        <tr>
                            <td>${window.UTILS.escapeHtml(c.name)}</td>
                            <td>${window.UTILS.escapeHtml(c.email || '-')}</td>
                            <td><button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteContact(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button></td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>` : `<p style="text-align: center;">No contacts added.</p>`}
    </div>`;
};

window.getClientDepartmentsHTML = function (client) {
    const departments = client.departments || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-sitemap" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Departments</h3>
            <div style="display: flex; gap: 0.5rem;">
                 <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDepartments(${client.id})">Bulk Upload</button>
                 <button class="btn btn-sm btn-secondary" onclick="window.addDepartment(${client.id})">Add Department</button>
            </div>
        </div>
        ${departments.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead><tr><th>Department Name</th><th>Head</th><th>Actions</th></tr></thead>
                    <tbody>${departments.map((dept, index) => `
                        <tr>
                            <td>${window.UTILS.escapeHtml(dept.name)}</td>
                            <td>${window.UTILS.escapeHtml(dept.head || '-')}</td>
                            <td><button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteDepartment(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button></td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>` : `<div style="text-align: center; padding: 2rem;">No departments.</div>`}
    </div>`;
};

window.getClientGoodsServicesHTML = function (client) {
    const items = client.goodsServices || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">Goods & Services</h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addGoodsService(${client.id})">Add</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadGoodsServices(${client.id})">Bulk Upload</button>
            </div>
        </div>
        ${items.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead><tr><th>Name</th><th>Category</th><th>Actions</th></tr></thead>
                    <tbody>${items.map((item, index) => `
                        <tr>
                            <td>${window.UTILS.escapeHtml(item.name)}</td>
                            <td>${window.UTILS.escapeHtml(item.category)}</td>
                            <td><button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteGoodsService(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button></td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>` : `<div style="text-align: center;">No items.</div>`}
    </div>`;
};

window.getClientKeyProcessesHTML = function (client) {
    const processes = client.keyProcesses || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">Key Processes</h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addKeyProcess(${client.id})">Add</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadKeyProcesses(${client.id})">Bulk Upload</button>
            </div>
        </div>
        ${processes.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead><tr><th>Name</th><th>Category</th><th>Actions</th></tr></thead>
                    <tbody>${processes.map((proc, index) => `
                        <tr>
                            <td>${window.UTILS.escapeHtml(proc.name)}</td>
                            <td>${window.UTILS.escapeHtml(proc.category)}</td>
                            <td><button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteKeyProcess(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button></td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>` : `<div style="text-align: center;">No processes.</div>`}
    </div>`;
};

window.getClientDesignationsHTML = function (client) {
    const designations = client.designations || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">Designations</h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addClientDesignation(${client.id})">Add</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDesignations(${client.id})">Bulk Upload</button>
            </div>
        </div>
        ${designations.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                ${designations.map((des, index) => `
                    <div style="padding: 0.5rem 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 20px;">
                        <span>${window.UTILS.escapeHtml(des.title)}</span>
                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color); margin-left: 0.5rem;" onclick="window.deleteClientDesignation(${client.id}, ${index})"><i class="fa-solid fa-times"></i></button>
                    </div>`).join('')}
            </div>` : `<div style="text-align: center;">No designations.</div>`}
    </div>`;
};

window.getClientAuditTeamHTML = function (client) {
    const assignments = window.state.auditorAssignments || [];
    const auditors = window.state.auditors || [];
    const assignedAuditorIds = assignments
        .filter(a => String(a.clientId) === String(client.id))
        .map(a => String(a.auditorId));
    const assignedAuditors = auditors.filter(a => assignedAuditorIds.includes(String(a.id)));

    return `
    <div class="card" id="client-audit-team-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-user-shield" style="margin-right: 0.5rem; color: #0ea5e9;"></i>Audit Team</h3>
             <button class="btn btn-primary" onclick="window.openClientAuditorAssignmentModal(${client.id}, '${window.UTILS.escapeHtml(client.name)}')">
                <i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i> Assign Auditor
            </button>
        </div>
        ${assignedAuditors.length > 0 ? `
            <div style="display: grid; gap: 1rem;">
                ${assignedAuditors.map(auditor => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <div>
                            <div style="font-weight: 600;">${window.UTILS.escapeHtml(auditor.name)}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">${window.UTILS.escapeHtml(auditor.role || 'Auditor')}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.removeClientAuditorAssignment(${client.id}, ${auditor.id})"><i class="fa-solid fa-user-minus"></i> Remove</button>
                    </div>`).join('')}
            </div>` : `<div style="text-align: center; padding: 2rem;"><p>No auditors assigned.</p></div>`}
    </div>`;
};


// ============================================
// 3. CRUD FUNCTIONS (SITES)
// ============================================

window.addSite = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Site', `
        <form id="site-form">
            <div class="form-group"><label>Site Name *</label><input type="text" id="site-name" class="form-control" required></div>
            <div class="form-group"><label>Address</label><input type="text" id="site-address" class="form-control"></div>
            <div class="form-group"><label>City</label><input type="text" id="site-city" class="form-control"></div>
            <div class="form-group"><label>Country</label><input type="text" id="site-country" class="form-control"></div>
            <div class="form-group"><label>Employees</label><input type="number" id="site-employees" class="form-control"></div>
        </form>`, () => {
        const name = document.getElementById('site-name').value;
        if (name) {
            if (!client.sites) client.sites = [];
            client.sites.push({
                name,
                address: document.getElementById('site-address').value,
                city: document.getElementById('site-city').value,
                country: document.getElementById('site-country').value
            });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            if (window.renderClientDetail) renderClientDetail(clientId);
            if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 2);
            window.showNotification('Site added');
        }
    });
};

window.bulkUploadSites = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Upload Sites', `
        <div style="margin-bottom: 1rem;"><p style="color: grey;">Format: Name, Address, City</p></div>
        <textarea id="bulk-data" rows="5" class="form-control" placeholder="Factory 1, 123 Main St, New York"></textarea>
        `, () => {
        const data = document.getElementById('bulk-data').value;
        if (!data) return;
        const lines = data.split('\n');
        if (!client.sites) client.sites = [];
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts[0]) client.sites.push({ name: parts[0].trim(), address: parts[1]?.trim() || '', city: parts[2]?.trim() || '' });
        });
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal();
        window.setSetupWizardStep(clientId, 2);
        window.showNotification('Sites uploaded');
    });
};

window.deleteSite = function (clientId, index) {
    if (!confirm('Delete?')) return;
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.sites) { client.sites.splice(index, 1); window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client); renderClientDetail(clientId); window.showNotification('Deleted'); }
};

// ============================================
// 4. CRUD FUNCTIONS (DEPARTMENTS)
// ============================================

window.addDepartment = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Department',
        `<form><div class="form-group"><label>Name *</label><input type="text" id="dept-name" class="form-control"></div>
         <div class="form-group"><label>Head</label><input type="text" id="dept-head" class="form-control"></div></form>`,
        () => {
            const name = document.getElementById('dept-name').value;
            if (name) {
                if (!client.departments) client.departments = [];
                client.departments.push({ name, head: document.getElementById('dept-head').value });
                window.saveData();
                if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
                window.closeModal();
                if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 3);
                else renderClientDetail(clientId);
                window.showNotification('Department added');
            }
        });
};

window.deleteDepartment = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.departments && confirm('Delete?')) {
        client.departments.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        renderClientDetail(clientId);
        window.showNotification('Department deleted');
    }
};
window.bulkUploadDepartments = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Upload Departments', `<textarea id="bulk-dept" rows="5" class="form-control" placeholder="Name, Head"></textarea>`, () => {
        const lines = document.getElementById('bulk-dept').value.split('\n');
        if (!client.departments) client.departments = [];
        lines.forEach(l => { const p = l.split(','); if (p[0]) client.departments.push({ name: p[0].trim(), head: p[1]?.trim() || '' }); });
        window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal(); window.setSetupWizardStep(clientId, 3);
    });
};

// ============================================
// 5. CRUD FUNCTIONS (CONTACTS)
// ============================================

window.addContactPerson = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Contact', `
        <form><div class="form-group"><label>Name *</label><input id="contact-name" class="form-control"></div><div class="form-group"><label>Email</label><input id="contact-email" class="form-control"></div></form>`, () => {
        const name = document.getElementById('contact-name').value;
        if (name) {
            if (!client.contacts) client.contacts = [];
            client.contacts.push({ name, email: document.getElementById('contact-email').value });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.showNotification('Contact added');
            if (window.renderClientDetail) renderClientDetail(clientId);
        }
    });
};
window.deleteContact = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.contacts && confirm('Delete?')) {
        client.contacts.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        renderClientDetail(clientId);
    }
};
window.bulkUploadContacts = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Contacts', `<textarea id="bulk-cont" rows="5" class="form-control" placeholder="Name, Email"></textarea>`, () => {
        const lines = document.getElementById('bulk-cont').value.split('\n');
        if (!client.contacts) client.contacts = [];
        lines.forEach(l => { const p = l.split(','); if (p[0]) client.contacts.push({ name: p[0].trim(), email: p[1]?.trim() || '' }); });
        window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal(); if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 5); else renderClientDetail(clientId);
    });
};

// ============================================
// 6. CRUD FUNCTIONS (DESIGNATIONS)
// ============================================

window.addClientDesignation = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Designation', `<form><div class="form-group"><label>Title *</label><input id="des-title" class="form-control"></div></form>`, () => {
        const title = document.getElementById('des-title').value;
        if (title) {
            if (!client.designations) client.designations = [];
            client.designations.push({ title });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 4);
            window.showNotification('Designation added');
        }
    });
};
window.deleteClientDesignation = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.designations && confirm('Delete?')) {
        client.designations.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.setSetupWizardStep(clientId, 4);
    }
};
window.bulkUploadDesignations = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Designations', `<textarea id="bulk-des" rows="5" class="form-control" placeholder="Title"></textarea>`, () => {
        const lines = document.getElementById('bulk-des').value.split('\n');
        if (!client.designations) client.designations = [];
        lines.forEach(l => { if (l.trim()) client.designations.push({ title: l.trim() }); });
        window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal(); window.setSetupWizardStep(clientId, 4);
    });
};

// ============================================
// 7. GOODS & PROCESSES
// ============================================
window.addGoodsService = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Goods/Service', `<form><div class="form-group"><label>Name</label><input id="goods-name" class="form-control"></div><div class="form-group"><label>Category</label><select id="goods-cat" class="form-control"><option>Product</option><option>Service</option></select></div></form>`, () => {
        const name = document.getElementById('goods-name').value;
        if (name) {
            if (!client.goodsServices) client.goodsServices = [];
            client.goodsServices.push({ name, category: document.getElementById('goods-cat').value });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 6);
            window.showNotification('Added');
        }
    });
};
window.deleteGoodsService = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.goodsServices) {
        client.goodsServices.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.setSetupWizardStep(clientId, 6);
    }
};
window.bulkUploadGoodsServices = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Goods', `<textarea id="bulk-goods" rows="5" class="form-control" placeholder="Name, Category"></textarea>`, () => {
        const lines = document.getElementById('bulk-goods').value.split('\n');
        if (!client.goodsServices) client.goodsServices = [];
        lines.forEach(l => { const p = l.split(','); if (p[0]) client.goodsServices.push({ name: p[0].trim(), category: p[1]?.trim() || 'Product' }); });
        window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal(); window.setSetupWizardStep(clientId, 6);
    });
};

window.addKeyProcess = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Add Process', `<form><div class="form-group"><label>Name</label><input id="proc-name" class="form-control"></div><div class="form-group"><label>Category</label><select id="proc-cat" class="form-control"><option>Core</option><option>Support</option></select></div></form>`, () => {
        const name = document.getElementById('proc-name').value;
        if (name) {
            if (!client.keyProcesses) client.keyProcesses = [];
            client.keyProcesses.push({ name, category: document.getElementById('proc-cat').value });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 7);
            window.showNotification('Added');
        }
    });
};
window.deleteKeyProcess = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.keyProcesses) {
        client.keyProcesses.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.setSetupWizardStep(clientId, 7);
    }
};
window.bulkUploadKeyProcesses = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Processes', `<textarea id="bulk-proc" rows="5" class="form-control" placeholder="Name, Category"></textarea>`, () => {
        const lines = document.getElementById('bulk-proc').value.split('\n');
        if (!client.keyProcesses) client.keyProcesses = [];
        lines.forEach(l => { const p = l.split(','); if (p[0]) client.keyProcesses.push({ name: p[0].trim(), category: p[1]?.trim() || 'Core' }); });
        window.saveData(); if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal(); window.setSetupWizardStep(clientId, 7);
    });
};

// ============================================
// 8. AUDITOR ASSIGNMENT
// ============================================

window.openClientAuditorAssignmentModal = function (clientId, clientName) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!window.state.auditors) { window.showNotification('No auditors loaded', 'error'); return; }

    window.openModal(`Assign Auditor to ${clientName}`, `
        <div class="form-group"><label>Select Auditor</label>
        <select id="assign-auditor" class="form-control">
            <option value="">-- Select --</option>
            ${window.state.auditors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select></div>`, () => {
        const auditorId = document.getElementById('assign-auditor').value;
        if (auditorId) {
            if (!window.state.auditorAssignments) window.state.auditorAssignments = [];
            window.state.auditorAssignments.push({
                id: Date.now(),
                clientId: String(clientId),
                auditorId: String(auditorId),
                assignedAt: new Date().toISOString()
            });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.syncAuditorAssignmentsToSupabase(window.state.auditorAssignments);
            window.closeModal();
            if (window.renderClientDetail) renderClientDetail(clientId);
            if (document.getElementById('client-audit-team-container')) {
                // Force refresh of audit team tab if visible
                document.getElementById('client-audit-team-container').innerHTML = 'Refreshing...';
                setTimeout(() => document.querySelector('.tab-btn[data-tab="audit_team"]')?.click(), 100);
            }
            window.showNotification('Auditor assigned');
        }
    });
};

window.removeClientAuditorAssignment = function (clientId, auditorId) {
    if (!confirm('Remove assignment?')) return;
    window.state.auditorAssignments = (window.state.auditorAssignments || []).filter(a => !(String(a.clientId) === String(clientId) && String(a.auditorId) === String(auditorId)));
    window.saveData();
    if (window.SupabaseClient?.isInitialized) window.SupabaseClient.deleteAuditorAssignment(auditorId, clientId);
    if (window.renderClientDetail) renderClientDetail(clientId);
    window.showNotification('Removed');
};

console.log('[DEBUG] clients-module-fix.js loaded successfully with HTML generators.');

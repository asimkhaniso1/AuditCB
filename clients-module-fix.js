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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; font-size: 1rem; color: var(--primary-color);">Site-Specific Scopes</h4>
                    <button class="btn btn-sm" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer;" onclick="window.aiGenerateScope('${client.id}', ${index})">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> AI Gen Scope
                    </button>
                </div>
                ${relevantSites.map(site => {
            const siteScope = (cert.siteScopes && cert.siteScopes[site.name]) ? cert.siteScopes[site.name] : (cert.scope || '');
            return `<div style="margin-bottom: 0.5rem;"><strong>${site.name}:</strong><br><textarea class="form-control" rows="2" onchange="window.updateSiteScope(${client.id}, ${index}, '${site.name}', this.value)">${siteScope}</textarea></div>`;
        }).join('')}
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                 <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.8rem;">Initial Date</label>
                        <input type="date" class="form-control" value="${cert.initialDate || ''}" onchange="window.updateCertField(${client.id}, ${index}, 'initialDate', this.value)">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Current Issue</label>
                        <input type="date" class="form-control" value="${cert.currentIssue || ''}" onchange="window.updateCertField(${client.id}, ${index}, 'currentIssue', this.value)">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Expiry Date</label>
                        <input type="date" class="form-control" value="${cert.expiryDate || ''}" onchange="window.updateCertField(${client.id}, ${index}, 'expiryDate', this.value)">
                    </div>
                 </div>
                 <div style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" onclick="window.saveCertificateDetails(${client.id})">
                        <i class="fa-solid fa-save"></i> Save Changes
                    </button>
                 </div>
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
window.getClientSettingsHTML = function (client) {
    return `
    <div class="fade-in">
        <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
            <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i> Client Settings
        </h3>
        <div class="card" style="border-left: 4px solid var(--danger-color);">
            <h4 class="text-danger" style="margin-top: 0;">Danger Zone</h4>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff1f2; border-radius: 8px;">
                    <div>
                        <strong style="color: #991b1b;">Archive Client</strong>
                        <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Move to archives. Data is preserved but hidden from active lists.</p>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveClient('${client.id}')">
                        <i class="fa-solid fa-box-archive"></i> Archive
                    </button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fee2e2; border-radius: 8px;">
                    <div>
                        <strong style="color: #dc2626;">Delete Client</strong>
                        <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Permanently remove this client and ALL data. Cannot be undone.</p>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="window.deleteClient('${client.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
        <div class="card" style="margin-top: 1.5rem;">
            <h4>Information</h4>
            <div style="padding: 1rem; background: #f8fafc; border-radius: 6px;">
                <p style="margin-bottom: 0.5rem; font-size: 0.9rem;"><strong>Client ID:</strong> <code>${client.id}</code></p>
                <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${client.id}').then(() => window.showNotification('ID Copied', 'success'))">
                    <i class="fa-solid fa-copy"></i> Copy ID
                </button>
            </div>
        </div>
    </div>`;
};

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
                                        ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
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
    function formatProfileText(text) {
        if (!text) return '';
        var esc = (window.UTILS && window.UTILS.escapeHtml) ? window.UTILS.escapeHtml(text) : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var lines = esc.split('\n');
        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) { html += '<div style="height:0.5rem"></div>'; continue; }
            if (line.match(/^---\s*.+\s*---$/)) {
                html += '<div style="margin-top:1rem;margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:2px solid #e2e8f0"><strong style="color:#1e40af;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.5px">' + line.replace(/---/g, '').trim() + '</strong></div>';
            } else if (line.match(/^(Company Overview|Industry and Market|Products\/Services|Organizational Structure|Operational Locations|Management System|Key Processes|Context for Audit)/i)) {
                html += '<div style="margin-top:1rem;margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:2px solid #e2e8f0"><strong style="color:#1e40af;font-size:0.95rem">' + line + '</strong></div>';
            } else if (line.startsWith('- ')) {
                html += '<div style="padding:0.2rem 0 0.2rem 1.2rem;position:relative"><span style="position:absolute;left:0.4rem;color:#3b82f6">&#8226;</span>' + line.substring(2) + '</div>';
            } else if (line.match(/^(Industry|Website|Standards|Total Employees):/)) {
                var p = line.split(':'); var lbl = p[0]; var v = p.slice(1).join(':').trim();
                html += '<div style="padding:0.3rem 0"><span style="font-weight:600;color:#475569">' + lbl + ':</span> ' + v + '</div>';
            } else if (line.match(/^.+ - (Company|Organization)/)) {
                html += '<h4 style="margin:0 0 0.8rem 0;color:#0f172a;font-size:1.1rem;font-weight:700">' + line + '</h4>';
            } else {
                html += '<p style="margin:0.3rem 0;line-height:1.6;color:#334155">' + line + '</p>';
            }
        }
        return html;
    }
    return `
    <div class="card" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center">
            <div>
                <h3 style="margin:0;color:white;font-size:1.1rem"><i class="fa-solid fa-building" style="margin-right:0.5rem"></i>Organization Context</h3>
                <p style="margin:0.3rem 0 0 0;color:rgba(255,255,255,0.8);font-size:0.8rem">Last updated: ${lastUpdated}</p>
            </div>
            <div style="display:flex;gap:0.5rem">
                <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);font-size:0.8rem" onclick="window.editCompanyProfile('${client.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;border:none;font-size:0.8rem" onclick="window.generateCompanyProfile('${client.id}')"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Generate</button>
            </div>
        </div>
        <div style="padding:1.5rem">
            ${profile ? formatProfileText(profile) : '<div style="text-align:center;padding:2rem;color:#94a3b8"><i class="fa-solid fa-file-circle-plus" style="font-size:2rem;margin-bottom:0.5rem;display:block"></i>No profile generated yet. Click AI Generate to create one.</div>'}
        </div>
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

// ============================================
// 9. EDIT SITE FUNCTION
// ============================================
window.editSite = function (clientId, siteIndex) {
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') return;
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.sites || !client.sites[siteIndex]) return;
    const site = client.sites[siteIndex];
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    modalTitle.textContent = 'Edit Site Location';
    const stdOptions = ((window.state.cbSettings && window.state.cbSettings.standardsOffered) || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 50001:2018', 'ISO 13485:2016']);
    const stdHtml = stdOptions.map(function (std) {
        var sel = (site.standards || client.standard || '').includes(std) ? 'selected' : '';
        return '<option value="' + std + '" ' + sel + '>' + std + '</option>';
    }).join('');
    modalBody.innerHTML = '<form id="site-form">' +
        '<div class="form-group"><label>Site Name <span style="color:var(--danger-color)">*</span></label>' +
        '<input type="text" class="form-control" id="site-name" value="' + (site.name || '') + '" required></div>' +
        '<div class="form-group"><label>Address</label>' +
        '<input type="text" class="form-control" id="site-address" value="' + (site.address || '') + '"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
        '<div class="form-group"><label>City</label><input type="text" class="form-control" id="site-city" value="' + (site.city || '') + '"></div>' +
        '<div class="form-group"><label>Country</label><input type="text" class="form-control" id="site-country" value="' + (site.country || '') + '"></div>' +
        '</div>' +
        '<div style="border-top:1px solid var(--border-color);margin:1rem 0;padding-top:1rem">' +
        '<div class="form-group"><label>Applicable Standards</label>' +
        '<select class="form-control" id="site-standards" multiple style="height:100px">' + stdHtml + '</select>' +
        '<small style="color:var(--text-secondary)">Hold Ctrl/Cmd to select multiple</small></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
        '<div class="form-group"><label>Employees</label><input type="number" class="form-control" id="site-employees" min="0" value="' + (site.employees || '') + '"></div>' +
        '<div class="form-group"><label>Shift Work?</label><select class="form-control" id="site-shift">' +
        '<option value=""' + (!site.shift ? ' selected' : '') + '>-- Not specified --</option>' +
        '<option value="No"' + (site.shift === 'No' ? ' selected' : '') + '>No</option>' +
        '<option value="Yes"' + (site.shift === 'Yes' ? ' selected' : '') + '>Yes</option></select></div>' +
        '</div></div>' +
        '<div class="form-group"><label>Geotag</label><div style="display:flex;gap:0.5rem">' +
        '<input type="text" class="form-control" id="site-geotag" value="' + (site.geotag || '') + '">' +
        '<button type="button" class="btn btn-secondary" onclick="navigator.geolocation.getCurrentPosition(function(pos){document.getElementById(\'site-geotag\').value=pos.coords.latitude.toFixed(4)+\', \'+pos.coords.longitude.toFixed(4)})">' +
        '<i class="fa-solid fa-location-crosshairs"></i></button></div></div></form>';
    window.openModal();
    modalSave.onclick = function () {
        var name = document.getElementById('site-name').value;
        var address = document.getElementById('site-address').value;
        var city = document.getElementById('site-city').value;
        var country = document.getElementById('site-country').value;
        var geotag = document.getElementById('site-geotag').value;
        var employees = parseInt(document.getElementById('site-employees').value) || null;
        var shift = document.getElementById('site-shift').value || null;
        if (name) {
            var standards = Array.from(document.getElementById('site-standards').selectedOptions).map(function (o) { return o.value }).join(', ');
            client.sites[siteIndex] = Object.assign({}, site, { name: name, address: address, city: city, country: country, geotag: geotag, employees: employees, shift: shift, standards: standards });
            window.saveData();
            if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(function (err) { console.error('Supabase sync failed:', err) });
            }
            window.closeModal();
            if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
            window.showNotification('Site updated successfully');
        } else {
            window.showNotification('Site name is required', 'error');
        }
    };
};

// ============================================
// 9b. CLIENT LOGO UPLOAD
// ============================================
window.handleClientLogoUpload = function (input, clientId) {
    if (!clientId) clientId = window.state.activeClientId;
    var file = input.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
        window.showNotification('Logo too large. Max 1MB', 'error');
        input.value = '';
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
        var client = window.state.clients.find(function (c) { return String(c.id) === String(clientId); });
        if (client) {
            client.logoUrl = e.target.result;
            window.saveData();
            if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(function (err) { console.error('Supabase sync failed:', err); });
            }
            var preview = document.getElementById('edit-client-logo-preview') || document.getElementById('client-logo-preview-img');
            if (preview) {
                if (preview.tagName === 'DIV') {
                    preview.style.display = 'block';
                    preview.style.backgroundImage = 'url(' + e.target.result + ')';
                    preview.style.backgroundSize = 'cover';
                    preview.style.backgroundPosition = 'center';
                } else {
                    preview.innerHTML = '<img src="' + e.target.result + '" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">';
                }
            }
            var placeholder = document.getElementById('client-logo-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            window.showNotification('Logo uploaded', 'success');
        }
    };
    reader.readAsDataURL(file);
};
// ============================================
// 10. GENERATE COMPANY PROFILE (AI-Enhanced)
// ============================================
window.generateCompanyProfile = async function (clientId) {
    var client = window.state.clients.find(function (c) { return String(c.id) === String(clientId); });
    if (!client) return;

    // Save previous version to history
    if (client.profile) {
        if (!client.profileHistory) client.profileHistory = [];
        client.profileHistory.push({ content: client.profile, updatedAt: client.profileUpdated || new Date().toISOString(), updatedBy: 'System', method: 'AI' });
    }

    // Build context data
    var sitesInfo = (client.sites || []).map(function (s) {
        return s.name + (s.city ? ', ' + s.city : '') + (s.country ? ', ' + s.country : '') + (s.employees ? ' (' + s.employees + ' employees)' : '') + (s.standards ? ' [' + s.standards + ']' : '');
    }).join('; ');
    var goodsInfo = (client.goodsServices || []).map(function (g) {
        return (g.name || g) + (g.category ? ' (' + g.category + ')' : '') + (g.description ? ': ' + g.description : '');
    }).join('; ');
    var processInfo = (client.keyProcesses || []).map(function (p) {
        return (p.name || p) + (p.category ? ' [' + p.category + ']' : '') + (p.owner ? ' - ' + p.owner : '');
    }).join('; ');
    var deptInfo = (client.departments || []).map(function (d) {
        return d.name + (d.head ? ' (Head: ' + d.head + ')' : '') + (d.employeeCount ? ' [' + d.employeeCount + ' staff]' : '');
    }).join('; ');

    // Try AI-powered generation first
    if (window.AI_SERVICE && window.AI_SERVICE.callProxyAPI) {
        window.showNotification('AI is generating comprehensive company profile...', 'info');
        try {
            var prompt = 'You are an ISO Certification Body auditor preparing an Organization Context profile for an audit. Write a comprehensive, professional Organization Context / Company Profile based on the following data.' +
                '\n\nCompany: ' + client.name +
                '\nIndustry: ' + (client.industry || 'Not specified') +
                '\nWebsite: ' + (client.website || 'Not provided') +
                '\nTotal Employees: ' + (client.employees || 'Not specified') +
                '\nStandards: ' + (client.standard || 'Not specified') +
                '\nSites/Locations: ' + (sitesInfo || 'None listed') +
                '\nDepartments: ' + (deptInfo || 'None listed') +
                '\nGoods and Services: ' + (goodsInfo || 'None listed') +
                '\nKey Processes: ' + (processInfo || 'None listed') +
                (client.shifts === 'Yes' ? '\nShift Work: Yes' : '') +
                '\n\nInstructions:' +
                '\n1. If website URL is provided, infer additional context about the company (products, services, market position) based on the URL domain and any available info.' +
                '\n2. Include sections: Company Overview, Industry and Market Context, Products/Services Offered, Organizational Structure, Operational Locations, Management System Scope, Key Processes, and Context for Audit.' +
                '\n3. Write in professional audit report language suitable for ISO 17021 certification body documentation.' +
                '\n4. Keep it between 300-500 words.' +
                '\n5. Return ONLY the profile text, no JSON wrapping or markdown formatting.';

            var aiResult = await window.AI_SERVICE.callProxyAPI(prompt);
            var cleanResult = aiResult.replace(/```/g, '').trim();
            client.profile = cleanResult;
            client.profileUpdated = new Date().toISOString();
            window.saveData();
            if (window.SupabaseClient && window.SupabaseClient.isInitialized) window.SupabaseClient.upsertClient(client);
            if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
            if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 1);
            window.showNotification('AI Company profile generated successfully!', 'success');
            return;
        } catch (err) {
            console.warn('AI profile generation failed, falling back to template:', err);
            window.showNotification('AI unavailable, generating from template...', 'warning');
        }
    }

    // Fallback: Template-based generation
    window.showNotification('Generating company profile from template...', 'info');
    var parts = [];
    parts.push(client.name + ' - Organization Context');
    parts.push('\nIndustry: ' + (client.industry || 'Not specified'));
    if (client.website) parts.push('Website: ' + client.website);
    parts.push('\n--- Company Overview ---');
    var empText = client.employees ? ' with approximately ' + client.employees + ' employees' : '';
    var siteText = (client.sites && client.sites.length > 1) ? ' operating across ' + client.sites.length + ' locations' : ' operating from a single location';
    parts.push(client.name + ' is a ' + (client.industry || 'professional') + ' organization' + empText + siteText + '.');
    if (client.standard) parts.push('\nThe organization maintains certification to ' + client.standard + ' standards, demonstrating its commitment to quality, safety and continuous improvement.');
    if (client.sites && client.sites.length > 0) {
        parts.push('\n--- Operational Locations ---');
        client.sites.forEach(function (s) { parts.push('- ' + s.name + (s.city ? ', ' + s.city : '') + (s.country ? ', ' + s.country : '') + (s.employees ? ' (' + s.employees + ' employees)' : '')); });
    }
    if (client.departments && client.departments.length > 0) {
        parts.push('\n--- Key Departments ---');
        client.departments.forEach(function (d) { parts.push('- ' + d.name + (d.head ? ' - Led by ' + d.head : '') + (d.employeeCount ? ' (' + d.employeeCount + ' staff)' : '')); });
    }
    if (goodsInfo) {
        parts.push('\n--- Goods and Services ---');
        (client.goodsServices || []).forEach(function (g) { parts.push('- ' + (g.name || g) + (g.category ? ' [' + g.category + ']' : '') + (g.description ? ': ' + g.description : '')); });
    }
    if (processInfo) {
        parts.push('\n--- Key Processes ---');
        (client.keyProcesses || []).forEach(function (p) { parts.push('- ' + (p.name || p) + (p.category ? ' [' + p.category + ']' : '') + (p.owner ? ' - Owner: ' + p.owner : '')); });
    }
    parts.push('\n--- Context for Audit ---');
    parts.push('This profile provides organizational context for audit planning and execution activities under ISO 17021 requirements.');
    client.profile = parts.join('\n');
    client.profileUpdated = new Date().toISOString();
    window.saveData();
    if (window.SupabaseClient && window.SupabaseClient.isInitialized) window.SupabaseClient.upsertClient(client);
    if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
    if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 1);
    window.showNotification('Company profile generated from template.', 'success');
};

// ============================================
// 11. AI GENERATE SCOPE
// ============================================
window.aiGenerateScope = async function (clientId, certIndex) {
    var client = window.state.clients.find(function (c) { return String(c.id) === String(clientId); });
    if (!client) return;
    var cert = (client.certificates || [])[certIndex];
    if (!cert) { window.showNotification('Certificate not found', 'error'); return; }

    var relevantSites = (client.sites || []).filter(function (s) {
        return (s.standards && s.standards.includes(cert.standard)) || (!s.standards && client.standard && client.standard.includes(cert.standard));
    });
    if (relevantSites.length === 0) { window.showNotification('No sites found for this standard', 'warning'); return; }

    if (!window.AI_SERVICE || !window.AI_SERVICE.callProxyAPI) {
        // Fallback: template-based scope
        relevantSites.forEach(function (site) {
            if (!cert.siteScopes) cert.siteScopes = {};
            var goods = (client.goodsServices || []).map(function (g) { return g.name || g; }).join(', ');
            var processes = (client.keyProcesses || []).map(function (p) { return p.name || p; }).join(', ');
            cert.siteScopes[site.name] = 'The ' + cert.standard + ' management system covering ' + (goods || 'all products and services') + ' through ' + (processes || 'key operational processes') + ' at ' + site.name + (site.city ? ', ' + site.city : '') + '.';
        });
        window.saveData();
        if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
        window.showNotification('Scope generated from template.', 'success');
        return;
    }

    window.showNotification('AI is generating certification scope...', 'info');
    try {
        var siteNames = relevantSites.map(function (s) { return s.name + (s.city ? ', ' + s.city : ''); }).join('; ');
        var goods = (client.goodsServices || []).map(function (g) { return (g.name || g) + (g.description ? ': ' + g.description : ''); }).join('; ');
        var processes = (client.keyProcesses || []).map(function (p) { return p.name || p; }).join('; ');

        var prompt = 'You are an ISO Certification Body auditor. Generate certification scope statements for each site listed below.' +
            '\n\nCompany: ' + client.name +
            '\nStandard: ' + cert.standard +
            '\nIndustry: ' + (client.industry || 'General') +
            '\nWebsite: ' + (client.website || 'Not provided') +
            '\nGoods and Services: ' + (goods || 'Not specified') +
            '\nKey Processes: ' + (processes || 'Not specified') +
            '\nSites: ' + siteNames +
            '\n\nRequirements:' +
            '\n1. Write a concise, professional certification scope statement for EACH site.' +
            '\n2. The scope must describe what activities are covered under the ' + cert.standard + ' certificate at that site.' +
            '\n3. Include relevant goods/services and key processes applicable to each site.' +
            '\n4. Each scope should be 1-3 sentences, professional language suitable for the certificate.' +
            '\n5. Return as raw JSON object with site names as keys and scope text as values.' +
            '\nExample: {"Head Office": "Design, development and...", "Factory": "Manufacturing of..."}' +
            '\nReturn ONLY the JSON, no markdown formatting.';

        var aiResult = await window.AI_SERVICE.callProxyAPI(prompt);
        var cleanResult = aiResult.replace(/```json/g, '').replace(/```/g, '').trim();
        var scopes = JSON.parse(cleanResult);

        if (!cert.siteScopes) cert.siteScopes = {};
        relevantSites.forEach(function (site) {
            var scopeText = scopes[site.name];
            if (!scopeText) {
                var keys = Object.keys(scopes);
                for (var i = 0; i < keys.length; i++) {
                    if (keys[i].toLowerCase().indexOf(site.name.toLowerCase()) >= 0 || site.name.toLowerCase().indexOf(keys[i].toLowerCase()) >= 0) {
                        scopeText = scopes[keys[i]];
                        break;
                    }
                }
            }
            if (scopeText) cert.siteScopes[site.name] = scopeText;
        });

        window.saveData();
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) window.SupabaseClient.upsertClient(client);
        if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
        window.showNotification('AI certification scope generated successfully!', 'success');
    } catch (err) {
        console.error('AI Scope generation error:', err);
        window.showNotification('AI scope generation failed: ' + err.message, 'error');
    }
};

console.log('[DEBUG] clients-module-fix.js loaded successfully with HTML generators.');

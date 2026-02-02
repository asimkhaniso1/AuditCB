/**
 * CLIENT MODULE FIXES - v2 (Expanded)
 * Exposes functions to global scope that were accidentally privately scoped in clients-module.js
 */
console.log('[DEBUG] clients-module-fix.js loading...');

// ============================================
// 1. ORIGINAL FIXES (HTML GENERATORS)
// ============================================

// Client Org Setup HTML
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
        case 1: return window.getClientProfileHTML ? window.getClientProfileHTML(client) : (typeof getClientProfileHTML === 'function' ? getClientProfileHTML(client) : 'Loading...');
        case 2: return window.getClientSitesHTML ? window.getClientSitesHTML(client) : 'Loading...';
        case 3: return window.getClientDepartmentsHTML ? window.getClientDepartmentsHTML(client) : 'Loading...';
        case 4: return window.getClientDesignationsHTML ? window.getClientDesignationsHTML(client) : 'Loading...';
        case 5: return window.getClientContactsHTML ? window.getClientContactsHTML(client) : 'Loading...';
        case 6: return window.getClientGoodsServicesHTML ? window.getClientGoodsServicesHTML(client) : 'Loading...';
        case 7: return window.getClientKeyProcessesHTML ? window.getClientKeyProcessesHTML(client) : 'Loading...';
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

window.getClientSettingsHTML = function (client) {
    return `<div class="fade-in"><h3>Client Settings</h3><button class="btn btn-danger" onclick="window.deleteClient('${client.id}')">Delete Client</button></div>`;
};

// ============================================
// 2. NEW FIXES (CRUD FUNCTIONS from blocked scope)
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
                country: document.getElementById('site-country').value,
                employees: document.getElementById('site-employees').value
            });
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            if (window.renderClientDetail) renderClientDetail(clientId);
            if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 2);
            window.showNotification('Site added');
        } else {
            window.showNotification('Name required', 'error');
        }
    });
};

window.editSite = function (clientId, siteIndex) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.sites) return;
    const site = client.sites[siteIndex];
    window.openModal('Edit Site', `
        <form><div class="form-group"><label>Name *</label><input type="text" id="site-name" value="${site.name}" class="form-control"></div>
        <div class="form-group"><label>Address</label><input type="text" id="site-address" value="${site.address || ''}" class="form-control"></div>
        </form>`, () => {
        const name = document.getElementById('site-name').value;
        if (name) {
            client.sites[siteIndex].name = name;
            client.sites[siteIndex].address = document.getElementById('site-address').value;
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Site updated');
        }
    });
};

window.deleteSite = function (clientId, siteIndex) {
    if (!confirm('Delete site?')) return;
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.sites) {
        client.sites.splice(siteIndex, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        renderClientDetail(clientId);
        window.showNotification('Site deleted');
    }
};

window.addDepartment = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
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
    if (!confirm('Delete department?')) return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.departments) {
        client.departments.splice(index, 1);
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        renderClientDetail(clientId);
        window.showNotification('Department deleted');
    }
};

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

window.uploadCompanyProfileDoc = function (clientId, file) {
    // Simplified stub
    window.showNotification('Upload not fully implemented in fix file', 'info');
};


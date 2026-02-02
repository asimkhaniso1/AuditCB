/**
 * CLIENT MODULE FIXES
 * Exposes functions to global scope that were accidentally privately scoped in clients-module.js
 */

// 1. Client Org Setup HTML
window.getClientOrgSetupHTML = function (client) {
    // Initialize wizard step if not exists
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
    <!-- Wizard Header / Progress -->
    <div style="background: #f8fafc; padding: 2rem; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; position: relative; max-width: 800px; margin-left: auto; margin-right: auto;">
            <!-- Progress Line Background -->
            <div style="position: absolute; top: 20px; left: 0; right: 0; height: 4px; background: #e2e8f0; z-index: 1;"></div>
            <!-- Progress Line Active -->
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

    <!-- Wizard Content -->
    <div id="wizard-content" style="padding: 2rem;">
        ${window.getClientOrgSetupHTML.renderWizardStep(client, currentStep)}
    </div>

    <!-- Wizard Footer -->
    <div style="padding: 1.5rem 2rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between;">
        <button class="btn btn-secondary" ${currentStep === 1 ? 'disabled' : ''} onclick="window.setSetupWizardStep(${client.id}, ${currentStep - 1})">
            <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Previous
        </button>
        <button class="btn btn-primary" onclick="window.setSetupWizardStep(${client.id}, ${currentStep < 7 ? currentStep + 1 : 1})">
            ${currentStep < 7 ? 'Next Step <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>' : 'Finish <i class="fa-solid fa-check" style="margin-left: 0.5rem;"></i>'}
        </button>
    </div>
</div>
`;
};

// Helper to render the specific step content
window.getClientOrgSetupHTML.renderWizardStep = function (client, step) {
    // These functions are assumed to be global (verified in clients-module.js)
    switch (step) {
        case 1: return window.getClientProfileHTML ? window.getClientProfileHTML(client) : (typeof getClientProfileHTML === 'function' ? getClientProfileHTML(client) : 'Error: getClientProfileHTML missing');
        case 2: return window.getClientSitesHTML ? window.getClientSitesHTML(client) : (typeof getClientSitesHTML === 'function' ? getClientSitesHTML(client) : 'Error: getClientSitesHTML missing');
        case 3: return window.getClientDepartmentsHTML ? window.getClientDepartmentsHTML(client) : (typeof getClientDepartmentsHTML === 'function' ? getClientDepartmentsHTML(client) : 'Error: getClientDepartmentsHTML missing');
        case 4: return window.getClientDesignationsHTML ? window.getClientDesignationsHTML(client) : (typeof getClientDesignationsHTML === 'function' ? getClientDesignationsHTML(client) : 'Error: getClientDesignationsHTML missing');
        case 5: return window.getClientContactsHTML ? window.getClientContactsHTML(client) : (typeof getClientContactsHTML === 'function' ? getClientContactsHTML(client) : 'Error: getClientContactsHTML missing');
        case 6: return window.getClientGoodsServicesHTML ? window.getClientGoodsServicesHTML(client) : (typeof getClientGoodsServicesHTML === 'function' ? getClientGoodsServicesHTML(client) : 'Error: getClientGoodsServicesHTML missing');
        case 7: return window.getClientKeyProcessesHTML ? window.getClientKeyProcessesHTML(client) : (typeof getClientKeyProcessesHTML === 'function' ? getClientKeyProcessesHTML(client) : 'Error: getClientKeyProcessesHTML missing');
        default: return window.getClientProfileHTML ? window.getClientProfileHTML(client) : '';
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
            // Re-initialize any components if needed
            if (window.saveData) window.saveData(); // Save step progress
        }
    }
};

// 2. Client Certificates HTML
window.getClientCertificatesHTML = function (client) {
    const certs = client.certificates || [];
    const allStandards = new Set();

    // Collect all standards from client global and sites
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
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            Detected standards: ${Array.from(allStandards).join(', ')}.<br>
            Click below to generate certificate records for these standards to manage scopes and revisions.
        </p>
        <button class="btn btn-primary" onclick="window.generateCertificatesFromStandards(${client.id})">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Records
        </button>
    </div>
`;
    }

    return `
<div class="fade-in">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--primary-color); margin: 0;">
            <i class="fa-solid fa-certificate" style="margin-right: 0.5rem;"></i> Certification Scopes & History
        </h3>
        <button class="btn btn-secondary btn-sm" onclick="window.generateCertificatesFromStandards(${client.id})">
            <i class="fa-solid fa-sync" style="margin-right: 0.25rem;"></i> Sync Standards
        </button>
    </div>
    
    ${certs.map((cert, index) => {
        // Find sites relevant to this standard
        const relevantSites = (client.sites || []).filter(s =>
            (s.standards && s.standards.includes(cert.standard)) ||
            (!s.standards && client.standard && client.standard.includes(cert.standard)) // Fallback if site has no standards defined but client does
        );

        return `
        <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <div>
                    <span class="badge" style="background: var(--primary-color); color: white; font-size: 0.9rem; margin-bottom: 0.5rem;">${cert.standard}</span>
                    <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem;">
                        Cert #: <input type="text" value="${cert.certificateNo || ''}" 
                            style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 4px; width: 150px;"
                            onchange="window.updateCertField(${client.id}, ${index}, 'certificateNo', this.value)">
                    </div>
                </div>
                <div style="text-align: right;">
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; margin-right: 0.5rem;" onclick="window.viewCertRevisionHistory(${client.id}, ${index})" title="View revision history for this certification">
                        <i class="fa-solid fa-history"></i> Revision History
                     </button>
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; color: var(--danger-color); border-color: var(--danger-color);" onclick="window.deleteCertificationScope(${client.id}, ${index})" title="Remove this certification scope">
                        <i class="fa-solid fa-trash"></i>
                     </button>
                     <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Current Rev: <strong>${cert.revision || '00'}</strong>
                     </div>
                </div>
            </div>

            <!-- Site Specific Scopes -->
            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: var(--primary-color);">
                    <i class="fa-solid fa-location-dot"></i> Site-Specific Scopes (Annex)
                </h4>
                ${relevantSites.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 0.5rem; width: 25%;">Site</th>
                            <th style="padding: 0.5rem;">Scope of Activity (For this Standard)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${relevantSites.map(site => {
            const siteScope = (cert.siteScopes && cert.siteScopes[site.name])
                ? cert.siteScopes[site.name]
                : (cert.scope || ''); // Default to global scope if empty
            return `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 0.75rem 0.5rem; vertical-align: top;">
                                    <strong>${site.name}</strong><br>
                                    <span style="font-size: 0.8rem; color: #64748b;">${site.city}, ${site.country}</span>
                                </td>
                                <td style="padding: 0.75rem 0.5rem;">
                                    <textarea class="form-control" rows="2" 
                                        style="font-size: 0.9rem;"
                                        onchange="window.updateSiteScope(${client.id}, ${index}, '${site.name}', this.value)"
                                        placeholder="Define specific scope for this site...">${siteScope}</textarea>
                                </td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                ` : '<p style="font-style: italic; color: #94a3b8;">No sites linked to this standard.</p>'}
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
        </div>
        `;
    }).join('')}
</div>
`;
};

window.generateCertificatesFromStandards = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;

    const allStandards = new Set();
    if (client.standard) client.standard.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
    if (client.sites) {
        client.sites.forEach(site => {
            if (site.standards) site.standards.split(',').map(s => s.trim()).forEach(s => allStandards.add(s));
        });
    }

    if (!client.certificates) client.certificates = [];

    allStandards.forEach(std => {
        if (!client.certificates.find(c => c.standard === std)) {
            client.certificates.push({
                id: 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 10000), // Generate ID
                standard: std,
                certificateNo: '',
                status: 'Active',
                revision: '00',
                scope: client.scope || '', // Default global scope
                siteScopes: {}
            });
        }
    });

    if (window.saveData) window.saveData();
    // Sync to Supabase
    if (window.SupabaseClient?.isInitialized) {
        window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
    }
    if (typeof renderClientDetail === 'function') renderClientDetail(clientId);
    // Switch to scopes tab
    setTimeout(() => {
        document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
    }, 100);
    if (window.showNotification) window.showNotification('Certificate records generated');
};

window.updateCertField = function (clientId, certIndex, field, value) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.certificates && client.certificates[certIndex]) {
        client.certificates[certIndex][field] = value;
    }
};

window.updateSiteScope = function (clientId, certIndex, siteName, value) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (client && client.certificates && client.certificates[certIndex]) {
        if (!client.certificates[certIndex].siteScopes) {
            client.certificates[certIndex].siteScopes = {};
        }
        client.certificates[certIndex].siteScopes[siteName] = value;
    }
};

window.saveCertificateDetails = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;

    // Save locally first
    if (window.saveData) window.saveData();

    // Sync specific certificates to Supabase (certification_decisions table)
    if (window.SupabaseClient?.isInitialized && client.certificates && client.certificates.length > 0) {
        // Just generic notification for now, deep implementation is in certifications-module.js
    }

    if (window.showNotification) window.showNotification('Certification details saved', 'success');
};


// 3. Client Settings HTML
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
                    <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Move this client to archives. Data is preserved but hidden from active lists.</p>
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.archiveClient('${client.id}')">
                    <i class="fa-solid fa-box-archive"></i> Archive
                </button>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fee2e2; border-radius: 8px;">
                <div>
                    <strong style="color: #dc2626;">Delete Client</strong>
                    <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Permanently remove this client and ALL associated data. This cannot be undone.</p>
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
            <p style="margin-bottom: 0.5rem; font-size: 0.9rem;"><strong>Unique Client ID:</strong> <code>${client.id}</code></p>
            <p style="margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary);">This ID is used for linking data in the database.</p>
            <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${client.id}').then(() => window.showNotification('ID Copied', 'success'))">
                <i class="fa-solid fa-copy"></i> Copy ID
            </button>
        </div>
    </div>
</div>
`;
};

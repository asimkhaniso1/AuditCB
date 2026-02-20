/**
 * CLIENT MODULE FIXES - v5 (Complete with HTML Generators)
 * Exposes ALL functions to global scope that were accidentally privately scoped in clients-module.js
 * INCLUDES HTML Generators to ensure they bind to the global functions.
 */
if (window.Logger) Logger.debug('Modules', 'clients-module-fix.js loading...');

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
                     data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${step.id}">
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
        <button class="btn btn-secondary" ${currentStep === 1 ? 'disabled' : ''} data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${currentStep - 1}">
            <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Previous
        </button>
        <button class="btn btn-primary" data-action="setSetupWizardStep" data-arg1="${client.id}" data-arg2="${currentStep < 7 ? currentStep + 1 : 1}">
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
        <button class="btn btn-primary" data-action="generateCertificatesFromStandards" data-id="${client.id}">Generate Records</button>
    </div>`;
    }

    return `
<div class="fade-in">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--primary-color); margin: 0;"><i class="fa-solid fa-certificate"></i> Certification Scopes & History</h3>
        <button class="btn btn-secondary btn-sm" data-action="generateCertificatesFromStandards" data-id="${client.id}"><i class="fa-solid fa-sync"></i> Sync Standards</button>
    </div>
    ${certs.map((cert, index) => {
        const relevantSites = (client.sites || []).filter(s => (s.standards && s.standards.includes(cert.standard)) || (!s.standards && client.standard && client.standard.includes(cert.standard)));
        return `
        <div class="card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-color);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <div>
                    <span class="badge" style="background: var(--primary-color); color: white;">${cert.standard}</span>
                    <div style="font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem;">
                        Cert #: <input type="text" value="${cert.certificateNo || ''}" style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 4px; width: 150px;" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="certificateNo" data-arg4="this.value">
                    </div>
                </div>
                <div style="text-align: right;">
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem;" data-action="viewCertRevisionHistory" data-arg1="${client.id}" data-arg2="${index}">History</button>
                     <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem; color: var(--danger-color); border-color: var(--danger-color);" data-action="deleteCertificationScope" data-arg1="${client.id}" data-arg2="${index}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; font-size: 1rem; color: var(--primary-color);">Site-Specific Scopes</h4>
                    <button class="btn btn-sm" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer;" data-action="aiGenerateScope" data-arg1="${client.id}" data-arg2="${index}">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> AI Gen Scope
                    </button>
                </div>
                ${relevantSites.map(site => {
            const siteScope = (cert.siteScopes && cert.siteScopes[site.name]) ? cert.siteScopes[site.name] : (cert.scope || '');
            return `<div style="margin-bottom: 0.5rem;"><strong>${site.name}:</strong><br><textarea class="form-control" rows="2" data-action-change="updateSiteScope" data-arg1="${client.id}" data-arg2="${index}" data-arg3="${site.name}" data-arg4="this.value">${siteScope}</textarea></div>`;
        }).join('')}
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                 <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.8rem;">Initial Date</label>
                        <input type="date" class="form-control" value="${cert.initialDate || ''}" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="initialDate" data-arg4="this.value">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Current Issue</label>
                        <input type="date" class="form-control" value="${cert.currentIssue || ''}" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="currentIssue" data-arg4="this.value">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Expiry Date</label>
                        <input type="date" class="form-control" value="${cert.expiryDate || ''}" data-action-change="updateCertField" data-arg1="${client.id}" data-arg2="${index}" data-arg3="expiryDate" data-arg4="this.value">
                    </div>
                 </div>
                 <div style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" data-action="saveCertificateDetails" data-id="${client.id}">
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
                    <button class="btn btn-sm btn-outline-secondary" data-action="archiveClient" data-id="${client.id}">
                        <i class="fa-solid fa-box-archive"></i> Archive
                    </button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fee2e2; border-radius: 8px;">
                    <div>
                        <strong style="color: #dc2626;">Delete Client</strong>
                        <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Permanently remove this client and ALL data. Cannot be undone.</p>
                    </div>
                    <button class="btn btn-sm btn-danger" data-action="deleteClient" data-id="${client.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
        <div class="card" style="margin-top: 1.5rem;">
            <h4>Information</h4>
            <div style="padding: 1rem; background: #f8fafc; border-radius: 6px;">
                <p style="margin-bottom: 0.5rem; font-size: 0.9rem;"><strong>Client ID:</strong> <code>${client.id}</code></p>
                <button class="btn btn-sm btn-secondary" data-action="copyToClipboard" data-id="${client.id}" data-arg1="ID Copied">
                    <i class="fa-solid fa-copy"></i> Copy ID
                </button>
            </div>
        </div>
    </div>`;
};

// ============================================
// 2. HTML GENERATORS (EXTRACTED)
// ============================================

// ============================================
// MODERN TABLE STYLE HELPER
// Inspired by SafeDine Inspector — clean tables with
// search, filter, badges, and 4 action icons
// ============================================

const _orgTableStyle = `
    .org-table-wrapper { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .org-table-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; }
    .org-table-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #1e293b; }
    .org-table-header .count-badge { background: #eff6ff; color: #3b82f6; font-size: 0.75rem; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
    .org-table-toolbar { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #fafbfc; align-items: center; flex-wrap: wrap; }
    .org-table-search { flex: 1; min-width: 180px; padding: 0.4rem 0.75rem 0.4rem 2rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E") no-repeat 0.6rem center; outline: none; transition: border-color 0.2s; }
    .org-table-search:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .org-table table { width: 100%; border-collapse: collapse; }
    .org-table th { text-align: left; padding: 0.6rem 1rem; font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .org-table td { padding: 0.75rem 1rem; font-size: 0.875rem; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .org-table tr:hover td { background: #f8fafc; }
    .org-table tr:last-child td { border-bottom: none; }
    .org-table .name-cell { font-weight: 600; color: #1e293b; }
    .org-table .badge-tag { display: inline-block; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 500; margin-right: 4px; margin-bottom: 2px; }
    .org-table .badge-primary { background: #eff6ff; color: #2563eb; }
    .org-table .badge-green { background: #f0fdf4; color: #16a34a; }
    .org-table .badge-amber { background: #fffbeb; color: #d97706; }
    .org-table .badge-gray { background: #f1f5f9; color: #64748b; }
    .org-table .actions-cell { display: flex; gap: 2px; align-items: center; }
    .org-table .action-btn { width: 32px; height: 32px; border: none; background: transparent; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.15s ease; }
    .org-table .action-btn:hover { background: #f1f5f9; }
    .org-table .action-btn.view { color: #3b82f6; }
    .org-table .action-btn.edit { color: #f59e0b; }
    .org-table .action-btn.print { color: #8b5cf6; }
    .org-table .action-btn.delete { color: #ef4444; }
    .org-table .action-btn.view:hover { background: #eff6ff; }
    .org-table .action-btn.edit:hover { background: #fffbeb; }
    .org-table .action-btn.print:hover { background: #f5f3ff; }
    .org-table .action-btn.delete:hover { background: #fef2f2; }
    .org-table-empty { text-align: center; padding: 3rem 2rem; color: #94a3b8; }
    .org-table-empty i { font-size: 2.5rem; margin-bottom: 0.75rem; display: block; opacity: 0.5; }
`;

// Inject styles once
if (!document.getElementById('org-table-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'org-table-styles';
    styleEl.textContent = _orgTableStyle;
    document.head.appendChild(styleEl);
}

// Search filter helper
window._orgTableSearch = function (inputEl, tableId) {
    const filter = inputEl.value.toLowerCase();
    const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
    });
};

// View details helper
window._orgViewItem = function (type, data) {
    const details = Object.entries(data).map(function (e) {
        return '<div style="padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9;"><span style="font-weight: 600; color: #64748b; font-size: 0.8rem; text-transform: uppercase;">' + e[0] + '</span><div style="color: #1e293b; margin-top: 2px;">' + (e[1] || '-') + '</div></div>';
    }).join('');
    window.openModal('View ' + type, '<div style="padding: 0.5rem;">' + details + '</div>');
};

// Print single item helper
window._orgPrintItem = function (type, data) {
    const w = window.open('', '_blank', 'width=600,height=400');
    const rows = Object.entries(data).map(function (e) {
        return '<tr><td style="font-weight:600;padding:8px;border:1px solid #e2e8f0;background:#f8fafc;width:30%">' + e[0] + '</td><td style="padding:8px;border:1px solid #e2e8f0">' + (e[1] || '-') + '</td></tr>';
    }).join('');
    w.document.write('<!DOCTYPE html><html><head><title>' + type + '</title><style>body{font-family:Inter,sans-serif;padding:2rem}h2{color:#1e293b}table{width:100%;border-collapse:collapse;margin-top:1rem}</style></head><body><h2>' + type + ' Details</h2><table>' + rows + '</table></body></html>');
    w.document.close();
    setTimeout(function () { w.print(); }, 300);
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
            var processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            if (line.match(/^\*\*[^*]+\*\*:?$/)) {
                var title = line.replace(/\*\*/g, '').replace(/:$/, '');
                html += '<div style="margin-top:1rem;margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:2px solid #e2e8f0"><strong style="color:#1e40af;font-size:0.95rem">' + title + '</strong></div>';
            } else if (line.match(/^---\s*.+\s*---$/)) {
                html += '<div style="margin-top:1rem;margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:2px solid #e2e8f0"><strong style="color:#1e40af;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.5px">' + line.replace(/---/g, '').trim() + '</strong></div>';
            } else if (line.match(/^(Company Overview|Industry and Market|Products\/Services|Products\/Services Offered|Organizational Structure|Operational Locations|Management System|Key Processes|Context for Audit)/i)) {
                html += '<div style="margin-top:1rem;margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:2px solid #e2e8f0"><strong style="color:#1e40af;font-size:0.95rem">' + processedLine + '</strong></div>';
            } else if (line.match(/^[-*] /)) {
                var bulletText = line.replace(/^[-*]\s+/, '');
                bulletText = bulletText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                html += '<div style="padding:0.2rem 0 0.2rem 1.2rem;position:relative"><span style="position:absolute;left:0.4rem;color:#3b82f6">&#8226;</span>' + bulletText + '</div>';
            } else if (line.match(/^(Industry|Website|Standards|Total Employees):/)) {
                var p = line.split(':'); var lbl = p[0]; var v = p.slice(1).join(':').trim();
                html += '<div style="padding:0.3rem 0"><span style="font-weight:600;color:#475569">' + lbl + ':</span> ' + v + '</div>';
            } else {
                html += '<p style="margin:0.3rem 0;line-height:1.6;color:#334155">' + processedLine + '</p>';
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
                <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);font-size:0.8rem" data-action="editCompanyProfile" data-id="${client.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;border:none;font-size:0.8rem" data-action="generateCompanyProfile" data-id="${client.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Generate</button>
            </div>
        </div>
        <div style="padding:1.5rem">
            ${profile ? formatProfileText(profile) : '<div style="text-align:center;padding:2rem;color:#94a3b8"><i class="fa-solid fa-file-circle-plus" style="font-size:2rem;margin-bottom:0.5rem;display:block"></i>No profile generated yet. Click AI Generate to create one.</div>'}
        </div>
    </div>`;
};

// Helper to safely escape for inline onclick attributes
function _esc(v) { return (v || '-').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

window.getClientSitesHTML = function (client) {
    const isAdmin = window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin';
    const sites = client.sites || [];
    return `
    <div class="org-table-wrapper" style="margin-top: 1.5rem;">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-map-location-dot" style="color: #3b82f6;"></i> Sites & Locations <span class="count-badge">${sites.length}</span></h3>
            ${isAdmin ? `<div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadSites" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background: #3b82f6; color: white; border: none; border-radius: 8px;" data-action="addSite" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add Site</button>
            </div>` : ''}
        </div>
        ${sites.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search sites..." data-action-input="_orgTableSearch" data-id="sites-table">
        </div>
        <div class="org-table">
            <table id="sites-table"><thead><tr>
                <th>Site Name</th><th>Standards</th><th>Address</th><th>City</th><th>Employees</th><th style="width:140px">Actions</th>
            </tr></thead><tbody>${sites.map((s, i) => `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(s.name)}</td>
                <td>${(s.standards || 'Inherited').split(',').map(st => '<span class="badge-tag badge-primary">' + st.trim() + '</span>').join('')}</td>
                <td>${window.UTILS.escapeHtml(s.address || '-')}</td>
                <td>${window.UTILS.escapeHtml(s.city || '-')}${s.country ? ', ' + window.UTILS.escapeHtml(s.country) : ''}</td>
                <td>${s.employees ? '<span class="badge-tag badge-green"><i class="fa-solid fa-users" style="margin-right:3px"></i>' + s.employees + '</span>' : '-'}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Site" data-json='${JSON.stringify({ Name: s.name || '-', Standards: s.standards || '-', Address: s.address || '-', City: s.city || '-', Employees: s.employees || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    ${isAdmin ? `<button class="action-btn edit" title="Edit" data-action="editSite" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>` : ''}
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Site" data-json='${JSON.stringify({ Name: s.name || '-', Address: s.address || '-', City: s.city || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    ${isAdmin ? `<button class="action-btn delete" title="Delete" data-action="deleteSite" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div></td>
            </tr>`).join('')}</tbody></table>
        </div>` : `
        <div class="org-table-empty">
            <i class="fa-solid fa-map-location-dot"></i>
            <p>No sites or locations added yet.</p>
            ${isAdmin ? `<button class="btn btn-sm" style="background:#3b82f6;color:white;border:none;border-radius:8px;margin-top:0.75rem" data-action="addSite" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add First Site</button>` : ''}
        </div>`}
    </div>`;
};

window.getClientContactsHTML = function (client) {
    const contacts = client.contacts || [];
    return `
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-address-book" style="color: #8b5cf6;"></i> Personnel / Contacts <span class="count-badge">${contacts.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadContacts" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#8b5cf6;color:white;border:none;border-radius:8px" data-action="addContactPerson" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        ${contacts.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search contacts..." data-action-input="_orgTableSearch" data-id="contacts-table">
        </div>
        <div class="org-table">
            <table id="contacts-table"><thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Email</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>${contacts.map((c, i) => `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(c.name)}</td>
                <td>${c.designation ? '<span class="badge-tag badge-amber">' + window.UTILS.escapeHtml(c.designation) + '</span>' : '-'}</td>
                <td>${c.department ? '<span class="badge-tag badge-primary">' + window.UTILS.escapeHtml(c.department) + '</span>' : '-'}</td>
                <td>${window.UTILS.escapeHtml(c.email || '-')}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Contact" data-json='${JSON.stringify({ Name: c.name || '-', Designation: c.designation || '-', Department: c.department || '-', Email: c.email || '-', Phone: c.phone || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" data-action="editContact" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Contact" data-json='${JSON.stringify({ Name: c.name || '-', Designation: c.designation || '-', Department: c.department || '-', Email: c.email || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" data-action="deleteContact" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`).join('')}</tbody></table>
        </div>` : '<div class="org-table-empty"><i class="fa-solid fa-address-book"></i><p>No contacts added yet.</p></div>'}
    </div>`;
};

window.getClientDepartmentsHTML = function (client) {
    const departments = client.departments || [];
    const contacts = client.contacts || [];
    return `
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-sitemap" style="color: #f59e0b;"></i> Departments <span class="count-badge">${departments.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadDepartments" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#f59e0b;color:white;border:none;border-radius:8px" data-action="addDepartment" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        ${departments.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search departments..." data-action-input="_orgTableSearch" data-id="depts-table">
        </div>
        <div class="org-table">
            <table id="depts-table"><thead><tr><th>Department Name</th><th>Head</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>${departments.map((dept, i) => {
        const deptHead = dept.head || (contacts.find(c => c.department && c.department.toLowerCase() === dept.name.toLowerCase()) || {}).name || '-';
        return `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(dept.name)}</td>
                <td>${deptHead !== '-' ? '<span class="badge-tag badge-blue">' + window.UTILS.escapeHtml(deptHead) + '</span>' : '-'}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Department" data-json='${JSON.stringify({ Name: dept.name || '-', Head: deptHead || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" data-action="editDepartment" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Department" data-json='${JSON.stringify({ Name: dept.name || '-', Head: deptHead || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" data-action="deleteDepartment" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`;
    }).join('')}</tbody></table>
        </div>` : '<div class="org-table-empty"><i class="fa-solid fa-sitemap"></i><p>No departments added yet.</p></div>'}
    </div>`;
};

window.getClientGoodsServicesHTML = function (client) {
    const items = client.goodsServices || [];
    return `
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-boxes-stacked" style="color: #10b981;"></i> Goods & Services <span class="count-badge">${items.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadGoodsServices" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#10b981;color:white;border:none;border-radius:8px" data-action="addGoodsService" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        ${items.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search goods & services..." data-action-input="_orgTableSearch" data-id="goods-table">
        </div>
        <div class="org-table">
            <table id="goods-table"><thead><tr><th>Name</th><th>Category</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>${items.map((item, i) => `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(item.name)}</td>
                <td><span class="badge-tag badge-green">${window.UTILS.escapeHtml(item.category || '-')}</span></td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Item" data-json='${JSON.stringify({ Name: item.name || '-', Category: item.category || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" data-action="editGoodsService" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Item" data-json='${JSON.stringify({ Name: item.name || '-', Category: item.category || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" data-action="deleteGoodsService" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`).join('')}</tbody></table>
        </div>` : '<div class="org-table-empty"><i class="fa-solid fa-boxes-stacked"></i><p>No goods or services added yet.</p></div>'}
    </div>`;
};

window.getClientKeyProcessesHTML = function (client) {
    const processes = client.keyProcesses || [];
    return `
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-gears" style="color: #6366f1;"></i> Key Processes <span class="count-badge">${processes.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadKeyProcesses" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#6366f1;color:white;border:none;border-radius:8px" data-action="addKeyProcess" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        ${processes.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search processes..." data-action-input="_orgTableSearch" data-id="proc-table">
        </div>
        <div class="org-table">
            <table id="proc-table"><thead><tr><th>Process Name</th><th>Category</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>${processes.map((proc, i) => `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(proc.name)}</td>
                <td><span class="badge-tag badge-amber">${window.UTILS.escapeHtml(proc.category || '-')}</span></td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Process" data-json='${JSON.stringify({ Name: proc.name || '-', Category: proc.category || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" data-action="editKeyProcess" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Process" data-json='${JSON.stringify({ Name: proc.name || '-', Category: proc.category || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" data-action="deleteKeyProcess" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`).join('')}</tbody></table>
        </div>` : '<div class="org-table-empty"><i class="fa-solid fa-gears"></i><p>No key processes added yet.</p></div>'}
    </div>`;
};

window.getClientDesignationsHTML = function (client) {
    const designations = client.designations || [];
    const contacts = client.contacts || [];
    return `
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-id-badge" style="color: #ec4899;"></i> Designations <span class="count-badge">${designations.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadDesignations" data-id="${client.id}"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#ec4899;color:white;border:none;border-radius:8px" data-action="addClientDesignation" data-id="${client.id}"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        ${designations.length > 0 ? `
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search designations..." data-action-input="_orgTableSearch" data-id="desig-table">
        </div>
        <div class="org-table">
            <table id="desig-table"><thead><tr><th>Title</th><th>Department</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>${designations.map((des, i) => {
        const desTitle = des.title || des.name || '';
        const desDept = des.department || (contacts.find(c => c.designation && c.designation.toLowerCase() === desTitle.toLowerCase()) || {}).department || '';
        return `<tr>
                <td class="name-cell">${window.UTILS.escapeHtml(desTitle)}</td>
                <td>${desDept ? '<span class="badge-tag badge-gray">' + window.UTILS.escapeHtml(desDept) + '</span>' : '-'}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" data-action="_orgViewItem" data-arg1="Designation" data-json='${JSON.stringify({ Title: desTitle || '-', Department: desDept || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" data-action="editClientDesignation" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" data-action="_orgPrintItem" data-arg1="Designation" data-json='${JSON.stringify({ Title: desTitle || '-', Department: desDept || '-' }).replace(/'/g, "&#39;")}'><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" data-action="deleteClientDesignation" data-arg1="${client.id}" data-arg2="${i}"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>`;
    }).join('')}</tbody></table>
        </div>` : '<div class="org-table-empty"><i class="fa-solid fa-id-badge"></i><p>No designations added yet.</p></div>'}
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
             <button class="btn btn-primary" data-action="openClientAuditorAssignmentModal" data-arg1="${client.id}" data-arg2="${window.UTILS.escapeHtml(client.name)}">
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
                        <button class="btn btn-sm btn-outline-danger" data-action="removeClientAuditorAssignment" data-arg1="${client.id}" data-arg2="${auditor.id}"><i class="fa-solid fa-user-minus"></i> Remove</button>
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
    const stdOptions = ((window.state.cbSettings && window.state.cbSettings.standardsOffered) || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2022', 'ISO 22000:2018', 'ISO 50001:2018', 'ISO 13485:2016']);
    const stdHtml = stdOptions.map(function (std) {
        var sel = (client.standard || '').includes(std) ? 'selected' : '';
        return '<option value="' + std + '" ' + sel + '>' + std + '</option>';
    }).join('');
    window.openModal('Add Site', `
        <form id="site-form">
            <div class="form-group"><label>Site Name <span style="color:var(--danger-color)">*</span></label><input type="text" id="site-name" class="form-control" required></div>
            <div class="form-group"><label>Address</label><input type="text" id="site-address" class="form-control"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label>City</label><input type="text" id="site-city" class="form-control"></div>
                <div class="form-group"><label>Country</label><input type="text" id="site-country" class="form-control"></div>
            </div>
            <div style="border-top:1px solid var(--border-color);margin:1rem 0;padding-top:1rem">
                <div class="form-group"><label>Applicable Standards</label>
                    <select class="form-control" id="site-standards" multiple style="height:100px">${stdHtml}</select>
                    <small style="color:var(--text-secondary)">Hold Ctrl/Cmd to select multiple</small>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                    <div class="form-group"><label>Employees</label><input type="number" id="site-employees" class="form-control" min="0"></div>
                    <div class="form-group"><label>Shift Work?</label><select class="form-control" id="site-shift">
                        <option value="">-- Not specified --</option><option value="No">No</option><option value="Yes">Yes</option>
                    </select></div>
                </div>
            </div>
        </form>`, () => {
        const name = document.getElementById('site-name').value;
        if (name) {
            if (!client.sites) client.sites = [];
            const standards = Array.from(document.getElementById('site-standards').selectedOptions).map(o => o.value).join(', ');
            const employees = parseInt(document.getElementById('site-employees').value) || null;
            const shift = document.getElementById('site-shift').value || null;
            client.sites.push({
                name,
                address: document.getElementById('site-address').value,
                city: document.getElementById('site-city').value,
                country: document.getElementById('site-country').value,
                employees,
                shift,
                standards
            });
            // Auto-sync: update company-level employees from sum of site employees
            const siteTotal = client.sites.reduce((sum, s) => sum + (parseInt(s.employees) || 0), 0);
            if (siteTotal > 0) client.employees = siteTotal;
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
window.editDepartment = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.departments || !client.departments[index]) return;
    const dept = client.departments[index];
    window.openModal('Edit Department', `
        <form><div class="form-group"><label>Name *</label><input type="text" id="dept-name" class="form-control" value="${(dept.name || '').replace(/"/g, '&quot;')}"></div>
        <div class="form-group"><label>Head</label><input type="text" id="dept-head" class="form-control" value="${(dept.head || '').replace(/"/g, '&quot;')}"></div></form>`, () => {
        const name = document.getElementById('dept-name').value;
        if (name) {
            client.departments[index] = { name, head: document.getElementById('dept-head').value };
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 3);
            else renderClientDetail(clientId);
            window.showNotification('Department updated');
        }
    });
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
    const depts = (client.departments || []).map(d => '<option value="' + (d.name || '').replace(/"/g, '&quot;') + '">' + (d.name || '') + '</option>').join('');
    const desigs = (client.designations || []).map(d => '<option value="' + (d.title || d.name || '').replace(/"/g, '&quot;') + '">' + (d.title || d.name || '') + '</option>').join('');
    window.openModal('Add Contact', `
        <form>
            <div class="form-group"><label>Name *</label><input id="contact-name" class="form-control"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label>Designation</label><select id="contact-designation" class="form-control"><option value="">-- Select --</option>${desigs}</select></div>
                <div class="form-group"><label>Department</label><select id="contact-department" class="form-control"><option value="">-- Select --</option>${depts}</select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label>Email</label><input id="contact-email" class="form-control"></div>
                <div class="form-group"><label>Phone</label><input id="contact-phone" class="form-control"></div>
            </div>
        </form>`, () => {
        const name = document.getElementById('contact-name').value;
        if (name) {
            if (!client.contacts) client.contacts = [];
            client.contacts.push({
                name,
                designation: document.getElementById('contact-designation').value,
                department: document.getElementById('contact-department').value,
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value
            });
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
window.editContact = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.contacts || !client.contacts[index]) return;
    const ct = client.contacts[index];
    const depts = (client.departments || []).map(d => '<option value="' + (d.name || '').replace(/"/g, '&quot;') + '"' + ((ct.department === d.name) ? ' selected' : '') + '>' + (d.name || '') + '</option>').join('');
    const desigs = (client.designations || []).map(d => { const v = d.title || d.name || ''; return '<option value="' + v.replace(/"/g, '&quot;') + '"' + ((ct.designation === v) ? ' selected' : '') + '>' + v + '</option>'; }).join('');
    window.openModal('Edit Contact', `
        <form>
            <div class="form-group"><label>Name *</label><input id="contact-name" class="form-control" value="${(ct.name || '').replace(/"/g, '&quot;')}"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label>Designation</label><select id="contact-designation" class="form-control"><option value="">-- Select --</option>${desigs}</select></div>
                <div class="form-group"><label>Department</label><select id="contact-department" class="form-control"><option value="">-- Select --</option>${depts}</select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="form-group"><label>Email</label><input id="contact-email" class="form-control" value="${(ct.email || '').replace(/"/g, '&quot;')}"></div>
                <div class="form-group"><label>Phone</label><input id="contact-phone" class="form-control" value="${(ct.phone || '').replace(/"/g, '&quot;')}"></div>
            </div>
        </form>`, () => {
        const name = document.getElementById('contact-name').value;
        if (name) {
            client.contacts[index] = {
                name,
                designation: document.getElementById('contact-designation').value,
                department: document.getElementById('contact-department').value,
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value
            };
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 5);
            else renderClientDetail(clientId);
            window.showNotification('Contact updated');
        }
    });
};
window.bulkUploadContacts = function (clientId) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client) return;
    window.openModal('Bulk Contacts', `
        <div style="margin-bottom:1rem"><p style="color:grey;font-size:0.85rem">Format: <strong>Name, Designation, Department, Email</strong></p></div>
        <textarea id="bulk-cont" rows="6" class="form-control" placeholder="Ahmed Khan, Quality Manager, Quality Dept, ahmed@example.com
Sarah Ali, Production Head, Production, sarah@example.com"></textarea>`, () => {
        const lines = document.getElementById('bulk-cont').value.split('\n');
        if (!client.contacts) client.contacts = [];
        lines.forEach(l => {
            const p = l.split(',');
            if (p[0] && p[0].trim()) {
                client.contacts.push({
                    name: p[0].trim(),
                    designation: p[1]?.trim() || '',
                    department: p[2]?.trim() || '',
                    email: p[3]?.trim() || ''
                });
            }
        });
        window.saveData();
        if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
        window.closeModal();
        if (window.setSetupWizardStep) window.setSetupWizardStep(clientId, 5);
        else renderClientDetail(clientId);
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
window.editClientDesignation = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.designations || !client.designations[index]) return;
    const des = client.designations[index];
    window.openModal('Edit Designation', `
        <form><div class="form-group"><label>Title *</label><input id="des-title" class="form-control" value="${(des.title || des.name || '').replace(/"/g, '&quot;')}"></div></form>`, () => {
        const title = document.getElementById('des-title').value;
        if (title) {
            client.designations[index] = { title };
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 4);
            window.showNotification('Designation updated');
        }
    });
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
window.editGoodsService = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.goodsServices || !client.goodsServices[index]) return;
    const item = client.goodsServices[index];
    window.openModal('Edit Goods/Service', `
        <form><div class="form-group"><label>Name *</label><input id="goods-name" class="form-control" value="${(item.name || '').replace(/"/g, '&quot;')}"></div>
        <div class="form-group"><label>Category</label><select id="goods-cat" class="form-control"><option ${item.category === 'Product' ? 'selected' : ''}>Product</option><option ${item.category === 'Service' ? 'selected' : ''}>Service</option></select></div></form>`, () => {
        const name = document.getElementById('goods-name').value;
        if (name) {
            client.goodsServices[index] = { name, category: document.getElementById('goods-cat').value };
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 6);
            window.showNotification('Updated');
        }
    });
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
window.editKeyProcess = function (clientId, index) {
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    if (!client || !client.keyProcesses || !client.keyProcesses[index]) return;
    const proc = client.keyProcesses[index];
    window.openModal('Edit Process', `
        <form><div class="form-group"><label>Name *</label><input id="proc-name" class="form-control" value="${(proc.name || '').replace(/"/g, '&quot;')}"></div>
        <div class="form-group"><label>Category</label><select id="proc-cat" class="form-control"><option ${proc.category === 'Core' ? 'selected' : ''}>Core</option><option ${proc.category === 'Support' ? 'selected' : ''}>Support</option></select></div></form>`, () => {
        const name = document.getElementById('proc-name').value;
        if (name) {
            client.keyProcesses[index] = { name, category: document.getElementById('proc-cat').value };
            window.saveData();
            if (window.SupabaseClient?.isInitialized) window.SupabaseClient.upsertClient(client);
            window.closeModal();
            window.setSetupWizardStep(clientId, 7);
            window.showNotification('Updated');
        }
    });
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
        '<button type="button" class="btn btn-secondary" data-action="getGeolocation" data-id="site-geotag">' +
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

if (window.Logger) Logger.debug('Modules', 'clients-module-fix.js loaded successfully with HTML generators.');

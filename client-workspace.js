// ============================================
// CLIENT WORKSPACE MODULE
// Client-centric navigation and workspace rendering
// ============================================

// Initialize client sidebar on page load
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        populateClientSidebar();
        setupClientSearch();
    }, 500);
});

// Populate the right sidebar with client list
function populateClientSidebar() {
    const clientList = document.getElementById('client-list');
    if (!clientList) return;

    const clients = window.state?.clients || [];

    if (clients.length === 0) {
        clientList.innerHTML = `
            <div style="padding: 2rem 1rem; text-align: center; color: var(--text-secondary);">
                <i class="fa-solid fa-building" style="font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 0.85rem;">No clients yet</p>
            </div>
        `;
        return;
    }

    const activeClientId = window.state.activeClientId;

    clientList.innerHTML = clients.map(client => {
        const initials = client.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const isActive = client.id === activeClientId;
        const status = client.status || 'Active';

        return `
            <div class="client-list-item ${isActive ? 'active' : ''}" data-client-id="${client.id}" onclick="window.selectClient(${client.id})">
                <div class="client-avatar">${initials}</div>
                <div class="client-info">
                    <div class="client-name">${client.name}</div>
                    <div class="client-status">${status}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Setup client search functionality
function setupClientSearch() {
    const searchInput = document.getElementById('client-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.client-list-item');

        items.forEach(item => {
            const name = item.querySelector('.client-name')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });
}

// Select a client and render their workspace
window.selectClient = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Update active state
    window.state.activeClientId = clientId;

    // Update sidebar active states
    document.querySelectorAll('.client-list-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.clientId) === clientId);
    });

    // Clear left sidebar active state
    document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));

    // Render client workspace
    renderClientWorkspace(clientId);
};

// Render the client workspace in main content area
function renderClientWorkspace(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Update page title
    document.getElementById('page-title').textContent = client.name;

    const contentArea = document.getElementById('content-area');

    // Get stats for this client
    const clientPlans = (window.state.auditPlans || []).filter(p => p.client === client.name || p.clientId === clientId);
    const clientReports = (window.state.auditReports || []).filter(r => r.client === client.name || r.clientId === clientId);
    const clientCerts = (window.state.certifications || []).filter(c => c.client === client.name || c.clientId === clientId);
    const openNCs = clientReports.reduce((count, r) => count + ((r.findings || []).filter(f => f.status !== 'Closed').length), 0);

    contentArea.innerHTML = `
        <div class="fade-in">
            <!-- Back Button & Client Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="window.backToDashboard()">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            ${client.name}
                            <span class="status-badge status-${(client.status || 'active').toLowerCase()}" style="font-size: 0.7rem;">${client.status || 'Active'}</span>
                        </h2>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${client.industry || 'Industry not set'} • ${client.city || ''}</p>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="window.openNewAuditPlanModal('${client.name}')">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Audit
                </button>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6; cursor: pointer;" onclick="document.querySelector('[data-workspace-tab=\"plans\"]').click()">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 1.25rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${clientPlans.length}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Audit Plans</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981; cursor: pointer;" onclick="document.querySelector('[data-workspace-tab=\"certs\"]').click()">
                    <i class="fa-solid fa-certificate" style="font-size: 1.25rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${clientCerts.length}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Certificates</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${openNCs > 0 ? '#f59e0b' : '#10b981'}; cursor: pointer;" onclick="document.querySelector('[data-workspace-tab=\"findings\"]').click()">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.25rem; color: ${openNCs > 0 ? '#f59e0b' : '#10b981'}; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${openNCs}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Open NCs</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #8b5cf6; cursor: pointer;" onclick="document.querySelector('[data-workspace-tab=\"compliance\"]').click()">
                    <i class="fa-solid fa-shield-halved" style="font-size: 1.25rem; color: #8b5cf6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${client.compliance?.contract?.signed ? '✓' : '!'}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Compliance</p>
                </div>
            </div>
            
            <!-- Workspace Tabs -->
            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-workspace-tab="overview">Overview</button>
                <button class="tab-btn" data-workspace-tab="cycle">Audit Cycle</button>
                <button class="tab-btn" data-workspace-tab="plans">Plans & Audits</button>
                <button class="tab-btn" data-workspace-tab="findings">Findings</button>
                <button class="tab-btn" data-workspace-tab="certs">Certificates</button>
                <button class="tab-btn" data-workspace-tab="compliance">Compliance</button>
                <button class="tab-btn" data-workspace-tab="docs">Documents</button>
            </div>
            
            <div id="tab-content"></div>
        </div>
    `;

    // Setup tab handlers
    document.querySelectorAll('[data-workspace-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-workspace-tab]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderWorkspaceTab(clientId, e.target.dataset.workspaceTab);
        });
    });

    // Render initial tab
    renderWorkspaceTab(clientId, 'overview');
}

// Render individual workspace tab content
function renderWorkspaceTab(clientId, tabName) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const workspaceContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'overview':
            workspaceContent.innerHTML = renderClientOverview(client);
            break;
        case 'cycle':
            workspaceContent.innerHTML = renderAuditCycleTimeline(client);
            break;
        case 'plans':
            workspaceContent.innerHTML = renderClientPlans(client);
            break;
        case 'findings':
            workspaceContent.innerHTML = renderClientFindings(client);
            break;
        case 'certs':
            workspaceContent.innerHTML = renderClientCertificates(client);
            break;
        case 'compliance':
            // Reuse existing compliance tab rendering from clients-module
            if (typeof renderClientTab === 'function') {
                renderClientTab(client, 'compliance');
                return; // renderClientTab handles it
            }
            workspaceContent.innerHTML = '<p>Compliance tab loading...</p>';
            break;
        case 'docs':
            if (typeof renderClientTab === 'function') {
                renderClientTab(client, 'documents');
                return;
            }
            workspaceContent.innerHTML = '<p>Documents tab loading...</p>';
            break;
    }
}

// Overview tab content
function renderClientOverview(client) {
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div class="card">
                <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-building" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Company Details</h3>
                <div style="display: grid; gap: 0.75rem;">
                    <div><strong>Industry:</strong> ${client.industry || '-'}</div>
                    <div><strong>Location:</strong> ${client.city || '-'}</div>
                    <div><strong>Employees:</strong> ${client.employees || '-'}</div>
                    <div><strong>Scope:</strong> ${client.scope || '-'}</div>
                </div>
            </div>
            <div class="card">
                <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-user" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Primary Contact</h3>
                <div style="display: grid; gap: 0.75rem;">
                    <div><strong>Name:</strong> ${client.contactName || client.contact || '-'}</div>
                    <div><strong>Email:</strong> ${client.email || '-'}</div>
                    <div><strong>Phone:</strong> ${client.phone || '-'}</div>
                </div>
            </div>
        </div>
    `;
}

// Audit cycle timeline
function renderAuditCycleTimeline(client) {
    const certs = (window.state.certifications || []).filter(c => c.client === client.name);
    const latestCert = certs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))[0];

    if (!latestCert) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No certification cycle started yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openNewAuditPlanModal('${client.name}')">
                    Start Stage 1 Audit
                </button>
            </div>
        `;
    }

    const issueDate = new Date(latestCert.issueDate);
    const surv1 = new Date(issueDate); surv1.setFullYear(surv1.getFullYear() + 1);
    const surv2 = new Date(issueDate); surv2.setFullYear(surv2.getFullYear() + 2);
    const expiry = new Date(issueDate); expiry.setFullYear(expiry.getFullYear() + 3);

    return `
        <div class="card">
            <h3 style="margin: 0 0 1.5rem 0;"><i class="fa-solid fa-timeline" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Certification Cycle: ${latestCert.standard || 'ISO'}</h3>
            <div style="display: flex; justify-content: space-between; position: relative; padding: 2rem 0;">
                <div style="position: absolute; top: 50%; left: 5%; right: 5%; height: 4px; background: linear-gradient(90deg, #10b981 0%, #10b981 33%, #3b82f6 33%, #3b82f6 66%, #f59e0b 66%); border-radius: 2px;"></div>
                
                <div style="text-align: center; z-index: 1;">
                    <div style="width: 40px; height: 40px; background: #10b981; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-check"></i></div>
                    <div style="font-weight: 500;">Certification</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${issueDate.toLocaleDateString()}</div>
                </div>
                
                <div style="text-align: center; z-index: 1;">
                    <div style="width: 40px; height: 40px; background: ${new Date() > surv1 ? '#10b981' : '#3b82f6'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-eye"></i></div>
                    <div style="font-weight: 500;">Surveillance 1</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${surv1.toLocaleDateString()}</div>
                </div>
                
                <div style="text-align: center; z-index: 1;">
                    <div style="width: 40px; height: 40px; background: ${new Date() > surv2 ? '#10b981' : '#3b82f6'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-eye"></i></div>
                    <div style="font-weight: 500;">Surveillance 2</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${surv2.toLocaleDateString()}</div>
                </div>
                
                <div style="text-align: center; z-index: 1;">
                    <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-sync"></i></div>
                    <div style="font-weight: 500;">Recertification</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${expiry.toLocaleDateString()}</div>
                </div>
            </div>
        </div>
    `;
}

// Client plans list
function renderClientPlans(client) {
    const plans = (window.state.auditPlans || []).filter(p => p.client === client.name || p.clientId === client.id);

    if (plans.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No audit plans for this client yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openNewAuditPlanModal('${client.name}')">
                    Create First Audit Plan
                </button>
            </div>
        `;
    }

    return `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">Audit Plans</h3>
                <button class="btn btn-sm btn-primary" onclick="window.openNewAuditPlanModal('${client.name}')">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>New Plan
                </button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Standard</th>
                            <th>Status</th>
                            <th>Lead Auditor</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${plans.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => `
                            <tr>
                                <td>${p.date || '-'}</td>
                                <td>${p.type || 'Audit'}</td>
                                <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${p.standard || 'ISO'}</span></td>
                                <td><span class="status-badge status-${(p.status || 'planned').toLowerCase().replace(' ', '-')}">${p.status || 'Planned'}</span></td>
                                <td>${p.lead || '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-icon" onclick="window.viewAuditPlanDetail(${p.id})"><i class="fa-solid fa-eye"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Client findings/NCs
function renderClientFindings(client) {
    const reports = (window.state.auditReports || []).filter(r => r.client === client.name);
    const allFindings = reports.flatMap(r => (r.findings || []).map(f => ({ ...f, reportDate: r.date })));

    if (allFindings.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No findings recorded for this client.</p>
            </div>
        `;
    }

    return `
        <div class="card">
            <h3 style="margin: 0 0 1rem 0;">Findings & Non-Conformities</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Clause</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allFindings.map(f => `
                            <tr>
                                <td>${f.reportDate || '-'}</td>
                                <td>${f.clause || '-'}</td>
                                <td><span class="badge" style="background: ${f.type === 'Major' ? '#fee2e2' : '#fef3c7'}; color: ${f.type === 'Major' ? '#dc2626' : '#d97706'};">${f.type || 'NC'}</span></td>
                                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.description || f.finding || '-'}</td>
                                <td><span class="status-badge status-${(f.status || 'open').toLowerCase()}">${f.status || 'Open'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Client certificates
function renderClientCertificates(client) {
    const certs = (window.state.certifications || []).filter(c => c.client === client.name);

    if (certs.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No certificates issued for this client yet.</p>
            </div>
        `;
    }

    return `
        <div class="card">
            <h3 style="margin: 0 0 1rem 0;">Certificates</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Certificate #</th>
                            <th>Standard</th>
                            <th>Issue Date</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${certs.map(c => `
                            <tr>
                                <td style="font-weight: 500;">${c.certificateNumber || c.id}</td>
                                <td><span class="badge" style="background: #d1fae5; color: #065f46;">${c.standard || 'ISO'}</span></td>
                                <td>${c.issueDate || '-'}</td>
                                <td>${c.expiryDate || '-'}</td>
                                <td><span class="status-badge status-${(c.status || 'valid').toLowerCase()}">${c.status || 'Valid'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Back to dashboard
window.backToDashboard = function () {
    window.state.activeClientId = null;
    document.querySelectorAll('.client-list-item').forEach(item => item.classList.remove('active'));
    document.querySelector('.main-nav li[data-module="dashboard"]')?.classList.add('active');
    window.renderModule('dashboard');
};

// Re-populate sidebar when state changes
window.refreshClientSidebar = populateClientSidebar;

// Export
window.populateClientSidebar = populateClientSidebar;
window.renderClientWorkspace = renderClientWorkspace;

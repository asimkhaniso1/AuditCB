// ============================================
// CLIENT WORKSPACE MODULE
// Client-centric navigation and workspace rendering
// ============================================



// Initialize client sidebar on page load
document.addEventListener('DOMContentLoaded', function () {
    // Reduced timeout for faster loading
    setTimeout(() => {
        populateClientSidebar();
        setupClientSearch();
    }, 100);
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
            <div class="client-list-item ${isActive ? 'active' : ''}" data-client-id="${client.id}" onclick="window.location.hash = 'client/${client.id}/overview'">
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

// ============================================
// NAVIGATION & SIDEBAR SWITCHING
// ============================================

// Select a client and switch to their workspace
window.selectClient = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Update active state
    window.state.activeClientId = clientId;

    // Update right sidebar visual state
    document.querySelectorAll('.client-list-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.clientId) === clientId);
    });

    // Show client settings icon in header
    const settingsBtn = document.getElementById('client-settings-btn');
    if (settingsBtn) settingsBtn.style.display = 'block';

    // SWITCH LEFT SIDEBAR TO CLIENT MENU
    renderClientSidebarMenu(clientId);
};

// Render Client-Specific Layout in Left Sidebar
function renderClientSidebarMenu(clientId) {
    const navList = document.querySelector('.main-nav ul');
    if (!navList) return;

    // Force left sidebar to be visible
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.style.display = 'flex';
        sidebar.style.transform = 'translateX(0)';
        sidebar.style.width = 'var(--sidebar-width)';
        sidebar.style.opacity = '1';
        sidebar.style.pointerEvents = 'auto';
    }

    // Hide right client sidebar when in client workspace
    const clientSidebar = document.querySelector('.client-sidebar');
    if (clientSidebar) {
        clientSidebar.classList.add('hidden');
    }

    // Client Menu Items
    navList.innerHTML = `
        <li style="margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);" onclick="window.location.hash = 'dashboard'">
            <i class="fa-solid fa-arrow-left" style="color: var(--text-secondary);"></i> <span style="font-weight: 500;">Back to Global</span>
        </li>
        
        <li class="active" onclick="window.location.hash = 'client/${clientId}/overview'">
            <i class="fa-solid fa-house"></i> Overview
        </li>
        <li onclick="window.location.hash = 'client/${clientId}/cycle'">
            <i class="fa-solid fa-timeline"></i> Audit Cycle
        </li>

        <!-- Group: Audit Operations -->
        <li class="nav-group-header" onclick="window.toggleNavGroup(this)" role="button" tabindex="0" style="justify-content: space-between;">
            <span style="font-size: 0.9em; font-weight: 600;"><i class="fa-solid fa-clipboard-list"></i> Audit Ops</span>
            <i class="fa-solid fa-chevron-down group-arrow" style="font-size: 0.8rem; margin-right: 0;"></i>
        </li>
        <div class="nav-group-content collapsed" style="overflow: hidden; padding-left: 0.5rem; display: none;">
            <li onclick="window.location.hash = 'client/${clientId}/plans'">
                <i class="fa-solid fa-clipboard-list"></i> Plans & Audits
            </li>
            <li onclick="window.location.hash = 'client/${clientId}/execution'">
                <i class="fa-solid fa-tasks"></i> Execution
            </li>
            <li onclick="window.location.hash = 'client/${clientId}/reporting'">
                <i class="fa-solid fa-file-pen"></i> Reporting
            </li>
        </div>

        <!-- Group: Outcomes -->
        <li class="nav-group-header" onclick="window.toggleNavGroup(this)" role="button" tabindex="0" style="justify-content: space-between;">
             <span style="font-size: 0.9em; font-weight: 600;"><i class="fa-solid fa-check-double"></i> Outcomes</span>
            <i class="fa-solid fa-chevron-down group-arrow" style="font-size: 0.8rem; margin-right: 0;"></i>
        </li>
        <div class="nav-group-content collapsed" style="overflow: hidden; padding-left: 0.5rem; display: none;">
            <li onclick="window.location.hash = 'client/${clientId}/findings'">
                <i class="fa-solid fa-triangle-exclamation"></i> Findings
            </li>
            <li onclick="window.location.hash = 'client/${clientId}/ncr-capa'">
                <i class="fa-solid fa-clipboard-check"></i> NCR & CAPA
            </li>
            <li onclick="window.location.hash = 'client/${clientId}/certs'">
                <i class="fa-solid fa-certificate"></i> Certificates
            </li>
        </div>

        <!-- Group: Records & Compliance -->
        <li class="nav-group-header" onclick="window.toggleNavGroup(this)" role="button" tabindex="0" style="justify-content: space-between;">
             <span style="font-size: 0.9em; font-weight: 600;"><i class="fa-solid fa-box-archive"></i> Records</span>
            <i class="fa-solid fa-chevron-down group-arrow" style="font-size: 0.8rem; margin-right: 0;"></i>
        </li>
        <div class="nav-group-content collapsed" style="overflow: hidden; padding-left: 0.5rem; display: none;">
            <li onclick="window.location.hash = 'client/${clientId}/compliance'">
                <i class="fa-solid fa-shield-halved"></i> Compliance
            </li>
            <li onclick="window.location.hash = 'client/${clientId}/docs'">
                <i class="fa-solid fa-folder-open"></i> Documents
            </li>
        </div>
    `;
}

// Back to Global Dashboard
window.backToDashboard = function () {
    window.state.activeClientId = null;
    window.state.ncrContextClientId = null;

    // Clear right sidebar selection
    document.querySelectorAll('.client-list-item').forEach(item => item.classList.remove('active'));

    // Force sidebar to be visible
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.style.display = 'flex';
        sidebar.style.transform = 'translateX(0)';
        sidebar.style.width = 'var(--sidebar-width)';
        sidebar.style.opacity = '1';
        sidebar.style.pointerEvents = 'auto';
    }

    // Show right client sidebar again
    const clientSidebar = document.querySelector('.client-sidebar');
    if (clientSidebar) {
        clientSidebar.classList.remove('hidden');
    }

    // Hide client settings icon in header
    const settingsBtn = document.getElementById('client-settings-btn');
    if (settingsBtn) settingsBtn.style.display = 'none';

    // RESTORE GLOBAL SIDEBAR MENU
    const navList = document.querySelector('.main-nav ul');
    if (navList && window.globalSidebarHTML) {
        navList.innerHTML = window.globalSidebarHTML;
    }
};

// ============================================
// CONTENT RENDERING
// ============================================

// Main function to render client modules
window.renderClientModule = function (clientId, moduleName) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Update Sidebar Active Class
    const sidebarItems = document.querySelectorAll('.main-nav li');
    sidebarItems.forEach(li => {
        const isMatch = li.getAttribute('onclick')?.includes(`'${moduleName}'`);
        li.classList.toggle('active', !!isMatch);
    });

    // Update Page Title
    document.getElementById('page-title').textContent = `${client.name} - ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;

    const contentArea = document.getElementById('content-area');

    switch (moduleName) {
        case 'overview':
            // Use the full Client Dashboard (same as old client detail page)
            // Hide Account Setup tab - it's accessed via Settings
            if (typeof renderClientDetail === 'function') {
                renderClientDetail(client.id, { showAccountSetup: false });
            } else {
                contentArea.innerHTML = 'Overview not available';
            }
            break;
        case 'cycle':
            contentArea.innerHTML = renderAuditCycleTimeline(client);
            break;
        case 'plans':
            contentArea.innerHTML = renderClientPlans(client);
            break;
        case 'execution':
            contentArea.innerHTML = renderClientExecution(client);
            break;
        case 'reporting':
            contentArea.innerHTML = renderClientReporting(client);
            break;
        case 'findings':
            contentArea.innerHTML = renderClientFindings(client);
            break;
        case 'ncr-capa':
            // We can pass the client ID to the module if needed, or rely on window.state.activeClientId
            if (typeof renderNCRCAPAModule === 'function') {
                renderNCRCAPAModule(client.id);
            } else {
                contentArea.innerHTML = 'Module not loaded';
            }
            break;
        case 'certs':
            contentArea.innerHTML = renderClientCertificates(client);
            break;
        case 'compliance':
            // Reuse existing compliance rendering
            if (typeof renderClientTab === 'function') {
                // We need a container for renderClientTab to write to
                contentArea.innerHTML = '<div id="tab-content"></div>';
                renderClientTab(client, 'compliance');
            } else {
                contentArea.innerHTML = 'Module not loaded';
            }
            break;
        case 'docs':
            if (typeof renderClientTab === 'function') {
                contentArea.innerHTML = '<div id="tab-content"></div>';
                renderClientTab(client, 'documents');
            } else {
                contentArea.innerHTML = 'Module not loaded';
            }
            break;
        case 'settings':
            // Settings shows Account Setup wizard
            if (typeof renderClientDetail === 'function') {
                renderClientDetail(client.id, { showAccountSetup: true, showAnalytics: false });
                // Try to switch to 'client_org' tab if it exists (for managers), otherwise stay on defaults
                setTimeout(() => {
                    const orgTab = document.querySelector('.tab-btn[data-tab="client_org"]');
                    if (orgTab) {
                        orgTab.click();
                    } else {
                        // If no org tab (e.g. auditor), maybe just show info
                        const infoTab = document.querySelector('.tab-btn[data-tab="info"]');
                        if (infoTab) infoTab.click();
                    }
                }, 100);
            } else {
                contentArea.innerHTML = 'Settings not available';
            }
            break;
    }
};

// ... HELPER RENDER FUNCTIONS (Same as before) ...

// Helper function to match client data
function matchesClient(item, client) {
    // Match by clientId if available
    if (item.clientId && client.id && item.clientId === client.id) {
        return true;
    }
    // Match by client name (case-insensitive, trimmed)
    if (item.client && client.name) {
        return item.client.trim().toLowerCase() === client.name.trim().toLowerCase();
    }
    return false;
}

// Overview tab content
function renderClientOverview(client) {
    const clientPlans = (window.state.auditPlans || []).filter(p => matchesClient(p, client));
    const clientCerts = (window.state.certifications || []).filter(c => matchesClient(c, client));
    const clientReports = (window.state.auditReports || []).filter(r => matchesClient(r, client));
    const openNCs = clientReports.reduce((count, r) => count + ((r.ncrs || r.findings || []).filter(f => f.status !== 'Closed' && f.status !== 'closed').length), 0);

    // Calculate additional metrics
    const completedAudits = clientPlans.filter(p => p.status === 'Completed').length;
    const upcomingAudits = clientPlans.filter(p => p.status === 'Planned' || p.status === 'Approved').length;
    const validCerts = clientCerts.filter(c => c.status === 'Valid').length;
    const totalSites = (client.sites || []).length;
    const totalEmployees = client.employees || 0;

    // Organization Data (Placeholder/Extraction)
    const departments = client.departments || ['Operations', 'Quality', 'HR', 'Sales', 'IT']; // Mock if missing
    const designations = [...new Set((client.contacts || []).map(c => c.designation).filter(Boolean))];
    if (designations.length === 0) designations.push('Manager', 'Director', 'Officer');

    return `
        <div class="fade-in">
            <!-- Action Bar -->
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="btn btn-outline-primary" onclick="window.openEditClientModal(${client.id})">
                    <i class="fa-solid fa-pen" style="margin-right: 0.5rem;"></i>Edit Client
                </button>
                <button class="btn btn-outline-primary" onclick="window.openCreatePlanModal('${client.name}')">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Audit Plan
                </button>
            </div>

            <!-- Sub-Tabs Navigation -->
            <div class="tabs" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 1rem;">
                <div class="tab-item active" onclick="window.switchClientOverviewTab(this, 'dashboard', ${client.id})" style="padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid var(--primary-color); color: var(--primary-color); font-weight: 500;">
                    <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>Dashboard
                </div>
                <div class="tab-item" onclick="window.switchClientOverviewTab(this, 'profile')" style="padding: 0.5rem 1rem; cursor: pointer; color: var(--text-secondary);">
                    <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i>Profile
                </div>
                <div class="tab-item" onclick="window.switchClientOverviewTab(this, 'contacts')" style="padding: 0.5rem 1rem; cursor: pointer; color: var(--text-secondary);">
                    <i class="fa-solid fa-users" style="margin-right: 0.5rem;"></i>Contacts
                </div>
                <div class="tab-item" onclick="window.switchClientOverviewTab(this, 'organization')" style="padding: 0.5rem 1rem; cursor: pointer; color: var(--text-secondary);">
                    <i class="fa-solid fa-sitemap" style="margin-right: 0.5rem;"></i>Organization
                </div>
            </div>

            <!-- TAB: DASHBOARD -->
            <div id="tab-dashboard" class="tab-content">
                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6; cursor: pointer;" onclick="window.renderClientModule(${client.id}, 'plans', null)">
                        <i class="fa-solid fa-clipboard-list" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${clientPlans.length}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Audits</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981; cursor: pointer;" onclick="window.renderClientModule(${client.id}, 'certs', null)">
                        <i class="fa-solid fa-certificate" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${clientCerts.length}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Certificates</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${openNCs > 0 ? '#f59e0b' : '#10b981'}; cursor: pointer;" onclick="window.renderClientModule(${client.id}, 'findings', null)">
                        <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.5rem; color: ${openNCs > 0 ? '#f59e0b' : '#10b981'}; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${openNCs}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Open NCs</p>
                    </div>
                     <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #8b5cf6;">
                        <i class="fa-solid fa-users" style="font-size: 1.5rem; color: #8b5cf6; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalEmployees}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Employees</p>
                    </div>
                </div>

                <!-- Dashboard Charts -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="card" style="min-height: 300px;">
                        <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-chart-bar" style="margin-right: 0.5rem; color: var(--primary-color);"></i>NCR Analysis</h3>
                        <div style="position: relative; height: 220px; width: 100%;">
                            <canvas id="ncrTrendChart"></canvas>
                        </div>
                    </div>
                    <div class="card" style="min-height: 300px;">
                        <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-chart-pie" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Performance</h3>
                        <div style="position: relative; height: 220px; width: 100%; display: flex; justify-content: center;">
                            <canvas id="auditPerformanceChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB: PROFILE -->
            <div id="tab-profile" class="tab-content" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                     <!-- Company Details -->
                    <div class="card">
                         <h3 style="margin: 0 0 1rem 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">Company Details</h3>
                        <div style="display: grid; gap: 1rem;">
                            <div style="display: flex; justify-content: space-between;"><strong>Name:</strong> <span>${client.name}</span></div>
                            <div style="display: flex; justify-content: space-between;"><strong>Standard:</strong> <span>${client.standard || '-'}</span></div>
                            <div style="display: flex; justify-content: space-between;"><strong>Industry:</strong> <span>${client.industry || '-'}</span></div>
                            <div style="display: flex; justify-content: space-between;"><strong>Employees:</strong> <span>${totalEmployees}</span></div>
                            <div style="display: flex; justify-content: space-between;"><strong>Website:</strong> <a href="${client.website || '#'}" target="_blank">${client.website || '-'}</a></div>
                            <div style="display: flex; justify-content: space-between;"><strong>Address:</strong> <span style="text-align: right; max-width: 50%;">${client.address || '-'}</span></div>
                        </div>
                    </div>

                    <!-- Sites -->
                    <div class="card">
                         <h3 style="margin: 0 0 1rem 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">Sites (${totalSites})</h3>
                        ${totalSites > 0 ? `
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #f1f5f9; text-align: left;">
                                    <th style="padding: 0.5rem;">Site Name</th>
                                    <th style="padding: 0.5rem;">City</th>
                                    <th style="padding: 0.5rem;">Shift</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${client.sites.map(site => `
                                <tr>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid #f8fafc;">${site.name}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid #f8fafc;">${site.city || '-'}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid #f8fafc;">${site.shift || 'No'}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : '<p style="color: var(--text-secondary); text-align: center;">No sites configured.</p>'}
                    </div>
                </div>
            </div>

            <!-- TAB: CONTACTS -->
            <div id="tab-contacts" class="tab-content" style="display: none;">
                <div class="card">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">Client Contacts</h3>
                        <button class="btn btn-sm btn-primary"><i class="fa-solid fa-plus"></i> Add Contact</button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Designation</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Department</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(client.contacts || []).map(contact => `
                                <tr>
                                    <td style="font-weight: 500;">${contact.name}</td>
                                    <td>${contact.designation || '-'}</td>
                                    <td><a href="mailto:${contact.email}" style="color: var(--primary-color);">${contact.email}</a></td>
                                    <td>${contact.phone || '-'}</td>
                                    <td>${contact.department || '-'}</td>
                                </tr>
                                `).join('') || '<tr><td colspan="5" style="text-align: center;">No contacts found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

             <!-- TAB: ORGANIZATION -->
            <div id="tab-organization" class="tab-content" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="card">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Departments</h3>
                            <button class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <ul style="list-style: none; padding: 0;">
                            ${departments.map(dept => `
                            <li style="padding: 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                <span>${dept}</span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></span>
                            </li>
                            `).join('')}
                        </ul>
                    </div>
                     <div class="card">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Designations</h3>
                            <button class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <ul style="list-style: none; padding: 0;">
                            ${designations.map(desig => `
                            <li style="padding: 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                <span>${desig}</span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></span>
                            </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>

        </div>
    `;
}

// Sub-Tab Switching Logic
window.switchClientOverviewTab = function (element, tabId, clientId) {
    const navItems = element.parentElement.querySelectorAll('.tab-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        item.style.borderBottom = 'none';
        item.style.color = 'var(--text-secondary)';
        item.style.fontWeight = 'normal';
    });
    element.classList.add('active');
    element.style.borderBottom = '2px solid var(--primary-color)';
    element.style.color = 'var(--primary-color)';
    element.style.fontWeight = '500';

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.style.display = 'none'); // Scope this better if multiple instances? No, single view.

    const target = document.getElementById('tab-' + tabId);
    if (target) target.style.display = 'block';

    if (tabId === 'dashboard' && clientId) {
        if (window.initClientDashboardCharts) window.initClientDashboardCharts(clientId);
    }
};

// Audit cycle timeline
function renderAuditCycleTimeline(client) {
    const certs = (window.state.certifications || []).filter(c => matchesClient(c, client));
    const latestCert = certs.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))[0];

    if (!latestCert) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No certification cycle started yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openCreatePlanModal('${client.name}')">
                    Start Stage 1 Audit
                </button>
            </div>
        `;
    }

    const issueDate = new Date(latestCert.issueDate);
    const surv1 = new Date(issueDate); surv1.setFullYear(surv1.getFullYear() + 1);
    const surv2 = new Date(issueDate); surv2.setFullYear(surv2.getFullYear() + 2);
    const expiry = new Date(issueDate); expiry.setFullYear(expiry.getFullYear() + 3);

    const today = new Date();
    let currentStage = "Initial Certification";
    let nextAudit = surv1;
    if (today > surv1) { currentStage = "Surveillance 1"; nextAudit = surv2; }
    if (today > surv2) { currentStage = "Surveillance 2"; nextAudit = expiry; }
    if (today > expiry) { currentStage = "Expired"; nextAudit = null; }

    const daysToNext = nextAudit ? Math.ceil((nextAudit - today) / (1000 * 60 * 60 * 24)) : 0;

    return `
        <div class="fade-in">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-sync" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${currentStage}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Current Cycle Stage</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-calendar-check" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${nextAudit ? nextAudit.toLocaleDateString() : 'N/A'}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Next Scheduled Audit</p>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${daysToNext > 0 ? daysToNext + ' days remaining' : 'Due/Overdue'}</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-hourglass-half" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${expiry.toLocaleDateString()}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Cycle Expiry Date</p>
                </div>
            </div>

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
        </div>
    `;
}

// Client plans list
function renderClientPlans(client) {
    const plans = (window.state.auditPlans || []).filter(p => matchesClient(p, client));

    const totalPlans = plans.length;
    const completedPlans = plans.filter(p => p.status === 'Completed').length;
    const inProgressPlans = plans.filter(p => p.status === 'Approved' || p.status === 'In Progress').length;
    const upcomingPlans = plans.filter(p => p.status === 'Planned').length;

    if (plans.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-clipboard-list" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No audit plans for this client yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openCreatePlanModal('${client.name}')">
                    Create First Audit Plan
                </button>
            </div>
        `;
    }

    return `
        <div class="fade-in">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalPlans}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Plans</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-check-circle" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${completedPlans}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Completed</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-spinner" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${inProgressPlans}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">In Progress</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #8b5cf6;">
                    <i class="fa-solid fa-calendar-alt" style="font-size: 1.5rem; color: #8b5cf6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${upcomingPlans}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Upcoming</p>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Audit Plans</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.openCreatePlanModal('${client.name}')">
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
                                        <button class="btn btn-sm btn-icon" onclick="window.viewAuditPlan(${p.id})"><i class="fa-solid fa-eye"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Client execution/audit reports
function renderClientExecution(client) {
    const reports = (window.state.auditReports || []).filter(r => matchesClient(r, client));

    const totalReports = reports.length;
    const finalizedReports = reports.filter(r => r.status === 'Finalized').length;
    const inProgressReports = reports.filter(r => r.status !== 'Finalized').length;
    const totalFindings = reports.reduce((sum, r) => sum + (r.ncrs || r.findings || []).length, 0);

    if (reports.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-tasks" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No audit execution records for this client yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openCreatePlanModal('${client.name}')">
                    Start First Audit
                </button>
            </div>
        `;
    }

    return `
        <div class="fade-in">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-tasks" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalReports}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Audits</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-file-invoice" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${finalizedReports}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Finalized</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-spinner" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${inProgressReports}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">In Progress</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #ef4444;">
                    <i class="fa-solid fa-search" style="font-size: 1.5rem; color: #ef4444; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalFindings}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Findings</p>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Audit Execution & Reports</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.openCreatePlanModal('${client.name}')">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>New Audit
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Findings</th>
                                <th>Recommendation</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reports.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
        const findingsCount = (r.ncrs || r.findings || []).length;
        const openNCs = (r.ncrs || r.findings || []).filter(f => f.status !== 'Closed' && f.status !== 'closed').length;

        return `
                                <tr>
                                    <td>${r.date || '-'}</td>
                                    <td>${r.type || 'Audit'}</td>
                                    <td><span class="status-badge status-${(r.status || 'draft').toLowerCase().replace(' ', '-')}">${r.status || 'Draft'}</span></td>
                                    <td>
                                        <span class="badge" style="background: ${findingsCount > 0 ? '#fef3c7' : '#e0f2fe'}; color: ${findingsCount > 0 ? '#d97706' : '#0284c7'};">
                                            ${findingsCount} total
                                        </span>
                                        ${openNCs > 0 ? `<span class="badge" style="background: #fee2e2; color: #dc2626; margin-left: 0.25rem;">${openNCs} open</span>` : ''}
                                    </td>
                                    <td>${r.recommendation || '-'}</td>
                                    <td>
                                        <button class="btn btn-sm btn-icon" onclick="window.renderExecutionDetail && window.renderExecutionDetail(${r.id})" title="View Report">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Client reporting - finalized reports
function renderClientReporting(client) {
    const reports = (window.state.auditReports || []).filter(r => matchesClient(r, client) && r.status === 'Finalized');

    // Calculate metrics
    const totalReports = reports.length;
    const recommendedCount = reports.filter(r => r.recommendation?.includes('Recommend')).length;
    const conditionalCount = reports.filter(r => r.recommendation?.includes('Conditional')).length;
    const notRecommendedCount = reports.filter(r => r.recommendation?.includes('Not Recommend')).length;
    const totalFindings = reports.reduce((sum, r) => sum + (r.ncrs || r.findings || []).length, 0);
    const majorFindings = reports.reduce((sum, r) => sum + (r.ncrs || r.findings || []).filter(f => f.type === 'Major').length, 0);

    if (reports.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-file-alt" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No finalized reports for this client yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">Reports will appear here once audits are completed and finalized.</p>
            </div>
        `;
    }

    return `
        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                <i class="fa-solid fa-file-alt" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalReports}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Reports</p>
            </div>
            <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                <i class="fa-solid fa-check-circle" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${recommendedCount}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Recommended</p>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${conditionalCount} conditional</p>
            </div>
            <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${majorFindings > 0 ? '#f59e0b' : '#10b981'};">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.5rem; color: ${majorFindings > 0 ? '#f59e0b' : '#10b981'}; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalFindings}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Findings</p>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${majorFindings} major</p>
            </div>
            ${notRecommendedCount > 0 ? `
            <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #dc2626;">
                <i class="fa-solid fa-times-circle" style="font-size: 1.5rem; color: #dc2626; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${notRecommendedCount}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Not Recommended</p>
            </div>
            ` : ''}
        </div>

        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">Finalized Audit Reports</h3>
                <span class="badge" style="background: #d1fae5; color: #065f46;">${reports.length} Reports</span>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Auditor</th>
                            <th>Findings</th>
                            <th>Recommendation</th>
                            <th>Finalized</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
        const findingsCount = (r.ncrs || r.findings || []).length;
        const finalizedDate = r.finalizedAt ? new Date(r.finalizedAt).toLocaleDateString() : '-';

        return `
                            <tr>
                                <td>${r.date || '-'}</td>
                                <td>${r.type || 'Audit'}</td>
                                <td>${r.auditor || r.lead || '-'}</td>
                                <td>
                                    <span class="badge" style="background: ${findingsCount > 0 ? '#fef3c7' : '#d1fae5'}; color: ${findingsCount > 0 ? '#d97706' : '#065f46'};">
                                        ${findingsCount} ${findingsCount === 1 ? 'finding' : 'findings'}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge" style="background: ${r.recommendation?.includes('Recommend') ? '#d1fae5' : '#fee2e2'}; color: ${r.recommendation?.includes('Recommend') ? '#065f46' : '#dc2626'};">
                                        ${r.recommendation || '-'}
                                    </span>
                                </td>
                                <td>${finalizedDate}</td>
                                <td>
                                    <button class="btn btn-sm btn-icon" onclick="window.renderExecutionDetail && window.renderExecutionDetail(${r.id})" title="View Report">
                                        <i class="fa-solid fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-icon" onclick="window.downloadReport && window.downloadReport(${r.id})" title="Download PDF">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Client findings/NCs
function renderClientFindings(client) {
    const reports = (window.state.auditReports || []).filter(r => matchesClient(r, client));
    const allFindings = reports.flatMap(r => (r.ncrs || r.findings || []).map(f => ({ ...f, reportId: r.id, reportDate: r.date })));

    const totalFindings = allFindings.length;
    const majorNCs = allFindings.filter(f => f.type === 'Major').length;
    const minorNCs = allFindings.filter(f => f.type === 'Minor').length;
    const openNCsCount = allFindings.filter(f => f.status !== 'Closed' && f.status !== 'closed').length;

    if (allFindings.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No findings recorded for this client.</p>
            </div>
        `;
    }

    return `
        <div class="fade-in">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-search" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalFindings}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Findings</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #ef4444;">
                    <i class="fa-solid fa-exclamation-circle" style="font-size: 1.5rem; color: #ef4444; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${majorNCs}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Major NCs</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${minorNCs}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Minor NCs</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${openNCsCount > 0 ? '#ef4444' : '#10b981'};">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; color: ${openNCsCount > 0 ? '#ef4444' : '#10b981'}; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${openNCsCount}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Open NCs</p>
                </div>
            </div>

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
                                <th>Actions</th>
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
                                    <td>
                                        <button class="btn btn-sm btn-icon" onclick="window.renderExecutionDetail && window.renderExecutionDetail(${f.reportId})" title="View Report">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Client certificates
function renderClientCertificates(client) {
    const certs = (window.state.certifications || []).filter(c => matchesClient(c, client));

    const totalCerts = certs.length;
    const validCertsCount = certs.filter(c => c.status === 'Valid').length;

    if (certs.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No certificates issued for this client yet.</p>
            </div>
        `;
    }

    return `
        <div class="fade-in">
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-certificate" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${totalCerts}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Certificates</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-shield-check" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0.25rem 0;">${validCertsCount}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Valid Certificates</p>
                </div>
            </div>

            <!-- Client Context: Goods/Services & Processes (from Org Setup) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 0.75rem 0; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-boxes-stacked" style="color: #f59e0b;"></i> Goods & Services
                    </h4>
                    ${(client.goodsServices && client.goodsServices.length > 0) ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            ${client.goodsServices.map(g => `<span class="badge" style="background: #fef3c7; color: #92400e;">${g.name}</span>`).join('')}
                        </div>
                    ` : `<p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">Not defined - complete Account Setup</p>`}
                </div>
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 0.75rem 0; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-diagram-project" style="color: #06b6d4;"></i> Key Processes
                    </h4>
                    ${(client.keyProcesses && client.keyProcesses.length > 0) ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            ${client.keyProcesses.map(p => `<span class="badge" style="background: ${p.category === 'Core' ? '#d1fae5' : '#e0f2fe'}; color: ${p.category === 'Core' ? '#065f46' : '#0369a1'};">${p.name}</span>`).join('')}
                        </div>
                    ` : `<p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">Not defined - complete Account Setup</p>`}
                </div>
            </div>

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
                                    <td>
                                        <button class="btn btn-sm btn-icon" onclick="alert('Viewing Certificate PDF (Simulated)')" title="View PDF">
                                            <i class="fa-solid fa-file-pdf"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Re-populate sidebar when state changes
window.refreshClientSidebar = populateClientSidebar;

// Export
window.populateClientSidebar = populateClientSidebar;
window.downloadReport = function (reportId) {
    console.log('Downloading report:', reportId);
    window.showNotification('Preparing report download...', 'info');
    setTimeout(() => {
        window.showNotification('Report downloaded successfully (Simulated)', 'success');
    }, 1500);
};

// ============================================
// DASHBOARD CHARTS
// ============================================

// Store chart instances to destroy them before re-rendering
const clientDashboardCharts = {
    ncr: null,
    performance: null
};

window.initClientDashboardCharts = function (clientId) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        // console.warn('Chart.js is not loaded. Skipping chart initialization.');
        return;
    }

    // Client Data
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const reports = window.state.auditReports.filter(r => matchesClient(r, client));

    // ----------------------------
    // 1. NCR Analysis Chart
    // ----------------------------
    const ctxNCR = document.getElementById('ncrTrendChart');
    if (ctxNCR) {
        if (clientDashboardCharts.ncr) {
            clientDashboardCharts.ncr.destroy();
        }

        // Aggregate findings (Mocking a timeline for now, or just aggregating by status)
        const findings = reports.flatMap(r => r.ncrs || []);
        const major = findings.filter(f => f.type === 'major').length;
        const minor = findings.filter(f => f.type === 'minor').length;
        const closed = findings.filter(f => f.status === 'Closed').length;
        const open = findings.length - closed;

        clientDashboardCharts.ncr = new Chart(ctxNCR, {
            type: 'bar',
            data: {
                labels: ['Major', 'Minor', 'Open', 'Closed'],
                datasets: [{
                    label: 'Findings Count',
                    data: [major, minor, open, closed],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',  // Red for Major
                        'rgba(245, 158, 11, 0.8)', // Orange for Minor
                        'rgba(59, 130, 246, 0.8)', // Blue for Open
                        'rgba(16, 185, 129, 0.8)'  // Green for Closed
                    ],
                    borderColor: [
                        'rgb(239, 68, 68)',
                        'rgb(245, 158, 11)',
                        'rgb(59, 130, 246)',
                        'rgb(16, 185, 129)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.raw + ' Findings';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            borderDash: [2, 4],
                            color: '#f1f5f9'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // ----------------------------
    // 2. Audit Performance Chart (Process Conformity)
    // ----------------------------
    const ctxPerf = document.getElementById('auditPerformanceChart');
    if (ctxPerf) {
        if (clientDashboardCharts.performance) {
            clientDashboardCharts.performance.destroy();
        }

        // Mock Calculation: (Total Checkpoints - NCs) / Total Checkpoints * 100
        // Since we don't have total checkpoints easily, we'll mock a "Conformity Score" based on trends
        const totalFindings = reports.reduce((acc, r) => acc + (r.ncrs ? r.ncrs.length : 0), 0);
        // Scores starts at 100, deduct 5 for major, 1 for minor
        let deduction = 0;
        reports.forEach(r => {
            (r.ncrs || []).forEach(n => {
                deduction += (n.type === 'major' ? 5 : 1);
            });
        });

        let score = Math.max(0, 100 - (deduction / (reports.length || 1))); // Average deduction per audit
        score = Math.round(score);

        clientDashboardCharts.performance = new Chart(ctxPerf, {
            type: 'doughnut',
            data: {
                labels: ['Conformity', 'Non-Conformity Gap'],
                datasets: [{
                    data: [score, 100 - score],
                    backgroundColor: [
                        '#10b981', // Green
                        '#f1f5f9'  // Light Grey
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                }
            },
            plugins: [{
                id: 'textCenter',
                beforeDraw: function (chart) {
                    var width = chart.width,
                        height = chart.height,
                        ctx = chart.ctx;

                    ctx.restore();
                    var fontSize = (height / 114).toFixed(2);
                    ctx.font = "bold " + fontSize + "em sans-serif";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#1e293b";

                    var text = score + "%",
                        textX = Math.round((width - ctx.measureText(text).width) / 2),
                        textY = height / 2; // Center

                    ctx.fillText(text, textX, textY);

                    ctx.font = "normal " + (fontSize * 0.3).toFixed(2) + "em sans-serif";
                    ctx.fillStyle = "#64748b";
                    var text2 = "Conformity",
                        text2X = Math.round((width - ctx.measureText(text2).width) / 2),
                        text2Y = height / 2 + 20;

                    ctx.fillText(text2, text2X, text2Y);
                    ctx.save();
                }
            }]
        });
    }
};
// window.renderClientWorkspace export is not needed as selectClient handles it directly via renderClientSidebarMenu loops

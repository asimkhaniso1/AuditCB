// ============================================
// CLIENT WORKSPACE MODULE
// Client-centric navigation and workspace rendering
// ============================================



// Initialize client sidebar on page load
document.addEventListener('DOMContentLoaded', function () {
    // Skip if on login page (no sidebar needed)
    if (window.location.pathname.includes('login') || document.getElementById('login-container')) {
        return;
    }
    // Use retry mechanism to wait for auth and client data
    initClientSidebarWithRetry();
});

// Retry mechanism to wait for currentUser and clients to be loaded
function initClientSidebarWithRetry(retryCount = 0, maxRetries = 100) {
    const hasUser = window.state?.currentUser;
    const hasClients = (window.state?.clients?.length > 0);
    const isDataLoaded = window._dataFullyLoaded;

    // If we have user and clients, OR if data is fully loaded (even with no clients), proceed
    if ((hasUser && hasClients) || (hasUser && isDataLoaded)) {
        console.log('[CLIENT SIDEBAR] Data ready, initializing sidebar', {
            user: hasUser?.email,
            clientsCount: window.state?.clients?.length,
            dataLoaded: isDataLoaded
        });
        populateClientSidebar();
        setupClientSearch();
        return;
    }

    // Keep trying up to maxRetries (100 * 100ms = 10 seconds)
    if (retryCount < maxRetries) {
        // Stop waiting if we are definitely not logged in (and not on login page)
        if (window.AuthManager && !window.AuthManager.getSession() && !hasUser) {
            console.warn('[CLIENT SIDEBAR] No session found, stopping retry loop');
            return;
        }

        setTimeout(() => {
            initClientSidebarWithRetry(retryCount + 1, maxRetries);
        }, 100);
    } else {
        // Final attempt after timeout - render whatever state we have
        console.warn('[CLIENT SIDEBAR] Timeout waiting for data, rendering with current state', {
            hasUser: !!hasUser,
            hasClients: hasClients,
            dataLoaded: isDataLoaded
        });
        populateClientSidebar();
        setupClientSearch();
    }
}

// Populate the right sidebar with client list
function populateClientSidebar() {
    const clientList = document.getElementById('client-list');
    if (!clientList) return;

    const allClients = window.state?.clients || [];
    const currentUser = window.state?.currentUser;

    // DEBUG: Log current state
    console.log('[CLIENT SIDEBAR DEBUG]', {
        allClientsCount: allClients.length,
        currentUser: currentUser,
        hasGetVisibleClients: typeof window.getVisibleClients === 'function'
    });

    // Use RLS-aware client filtering (respects database permissions)
    // This ensures Admins see all clients and Auditors see only assigned ones
    // Fallback to allClients if getVisibleClients is not yet loaded
    let clients = (typeof window.getVisibleClients === 'function') ? window.getVisibleClients() : allClients;

    // DEBUG: Log filtered results
    console.log('[CLIENT SIDEBAR DEBUG] Filtered clients:', clients.length);


    if (clients.length === 0) {
        // DEBUG: Show visible error in sidebar
        const debugInfo = `
            User: ${currentUser?.name}
            Role: ${currentUser?.role}
            Total Clients: ${allClients.length}
            Visible: ${clients.length}
            Fn Loaded: ${typeof window.getVisibleClients === 'function'}
        `;

        clientList.innerHTML = `
            <div style="padding: 2rem 1rem; text-align: center; color: var(--text-secondary);">
                <i class="fa-solid fa-building" style="font-size: 2rem; opacity: 0.5; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 0.85rem;">No clients found</p>
                <div style="margin-top: 1rem; padding: 0.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 0.7rem; text-align: left; font-family: monospace;">
                    <strong>DEBUG INFO:</strong><br>
                    <pre style="white-space: pre-wrap; margin: 0;">${debugInfo}</pre>
                </div>
            </div>
        `;
        console.warn('[CLIENT SIDEBAR] No clients to display', { debugInfo });
        return;
    }

    const activeClientId = window.state.activeClientId;

    clientList.innerHTML = clients.map(client => {
        const safeName = client.name || 'Unknown Client';
        const initials = safeName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const isActive = client.id === activeClientId;
        const status = client.status || 'Active';
        const escapedName = window.UTILS?.escapeHtml ? window.UTILS.escapeHtml(client.name) : client.name;

        return `
            <div class="client-list-item ${isActive ? 'active' : ''}" data-client-id="${client.id}" onclick="window.location.hash = 'client/${client.id}/overview'">
                <div class="client-avatar">${initials}</div>
                <div class="client-info">
                    <div class="client-name">${escapedName}</div>
                    <div class="client-status">${status}</div>
                </div>
            </div>
        `;
    }).join('');

    // Hide "Add Client" button for Auditors and Lead Auditors
    const addClientBtn = document.querySelector('.client-sidebar-footer button');
    if (addClientBtn && currentUser) {
        const canAddClients = currentUser.role === 'Admin' || currentUser.role === 'Certification Manager';
        addClientBtn.style.display = canAddClients ? '' : 'none';
    }
}

// Export for use in other modules
window.populateClientSidebar = populateClientSidebar;

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
    // Use loose equality to handle string/number ID mismatch
    const client = window.state.clients.find(c => c.id == clientId);
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

    // Use loose equality to handle string/number ID mismatch
    const client = window.state.clients.find(c => c.id == clientId);

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

    // Update sidebar header to show client logo (replaces CB branding)
    const logoContainer = document.getElementById('cb-logo-display');
    if (logoContainer && client) {
        if (client.logoUrl) {
            logoContainer.innerHTML = `<img src="${client.logoUrl}" style="max-height: 40px; max-width: 180px; object-fit: contain;" alt="${client.name}">`;
        } else {
            // Show client name as text
            logoContainer.innerHTML = `<i class="fa-solid fa-building" style="color: var(--primary-color);"></i><h1 style="font-size: 1rem;">${client.name.length > 20 ? client.name.substring(0, 20) + '...' : client.name}</h1>`;
        }
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
        <li onclick="window.location.hash = 'client/${clientId}/account-setup'">
            <i class="fa-solid fa-wand-magic-sparkles" style="color: #a21caf;"></i> Account Setup
        </li>

        <!-- Section: Audit Workflow -->
        <li style="padding: 0.5rem 1rem 0.25rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); font-weight: 600; pointer-events: none; margin-top: 0.5rem; border-top: 1px solid var(--border-color);">Audit Workflow</li>
        <li onclick="window.location.hash = 'client/${clientId}/plans'">
            <i class="fa-solid fa-clipboard-list"></i> Plans & Audits
        </li>
        <li onclick="window.location.hash = 'client/${clientId}/execution'">
            <i class="fa-solid fa-tasks"></i> Execution
        </li>

        <li onclick="window.location.hash = 'client/${clientId}/ncr-capa'">
            <i class="fa-solid fa-clipboard-check"></i> NCR & CAPA
        </li>

        <!-- Section: Records -->
        <li style="padding: 0.5rem 1rem 0.25rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); font-weight: 600; pointer-events: none; margin-top: 0.5rem; border-top: 1px solid var(--border-color);">Records & Compliance</li>

        <li onclick="window.location.hash = 'client/${clientId}/compliance'">
            <i class="fa-solid fa-shield-halved"></i> Compliance
        </li>
        <li onclick="window.location.hash = 'client/${clientId}/docs'">
            <i class="fa-solid fa-folder-open"></i> Documents
        </li>
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

    // Restore CB logo in sidebar header
    if (window.updateCBLogoDisplay) window.updateCBLogoDisplay();
};

// ============================================
// CONTENT RENDERING
// ============================================

// Main function to render client modules
window.renderClientModule = function (clientId, moduleName) {
    // Use loose equality to handle string/number ID mismatch
    const client = window.state.clients.find(c => c.id == clientId);
    if (!client) {
        console.error('Client not found for ID:', clientId, 'Available IDs:', window.state.clients.map(c => c.id));
        window.showNotification('Client not found', 'error');
        return;
    }

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
            // Use the modern Client Dashboard with charts and quick actions
            contentArea.innerHTML = renderClientOverview(client);
            // Initialize dashboard charts after DOM is ready
            setTimeout(() => {
                if (typeof initClientDashboardCharts === 'function') {
                    initClientDashboardCharts(client.id);
                }
            }, 100);
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

        case 'findings':
            // Redirect legacy findings route to NCR & CAPA
            window.location.hash = `client/${client.id}/ncr-capa`;
            return;
        case 'ncr-capa':
            // We can pass the client ID to the module if needed, or rely on window.state.activeClientId
            if (typeof renderNCRCAPAModule === 'function') {
                renderNCRCAPAModule(client.id);
            } else {
                contentArea.innerHTML = 'Module not loaded';
            }
            break;
        case 'certs':
            // Redirect legacy certs route to Account Setup → Scopes & Certs
            window.location.hash = `client/${client.id}/account-setup`;
            setTimeout(() => {
                const scopesTab = document.querySelector('.tab-btn[data-tab="scopes"]');
                if (scopesTab) scopesTab.click();
            }, 300);
            return;
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
            console.log('[DEBUG-WORKSPACE] Settings case triggered for client:', client.id);
            if (typeof renderClientDetail === 'function') {
                renderClientDetail(client.id, { showAccountSetup: true, showAnalytics: false });
                setTimeout(() => {
                    const settingsTab = document.querySelector('.tab-btn[data-tab="settings"]');
                    console.log('[DEBUG-WORKSPACE] Settings tab found:', !!settingsTab);
                    if (settingsTab) {
                        settingsTab.click();
                    } else if (typeof renderClientTab === 'function') {
                        console.log('[DEBUG-WORKSPACE] Using renderClientTab fallback for settings');
                        renderClientTab(client, 'settings');
                    }
                }, 200);
            } else {
                console.error('[DEBUG-WORKSPACE] renderClientDetail is not defined');
                contentArea.innerHTML = 'Settings not available (Module error)';
            }
            break;
        case 'account-setup':
            if (typeof renderClientDetail === 'function') {
                renderClientDetail(client.id, { showAccountSetup: true, showAnalytics: false });
                setTimeout(() => {
                    // Render Account Setup directly (tab button removed from tab bar)
                    if (typeof renderClientTab === 'function') {
                        renderClientTab(client, 'client_org');
                    }
                }, 200);
            } else {
                contentArea.innerHTML = 'Module not loaded';
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

// Helper: Get ALL findings from a report (manual NCRs + checklist NCs)
function getAllFindings(report) {
    const manual = (report.ncrs || []).map(n => ({ ...n, source: 'manual' }));
    const checklist = (report.checklistProgress || [])
        .filter(p => p.status === 'nc')
        .map(p => ({
            type: p.ncrType || 'Observation',
            clause: p.clause || 'Checklist Item',
            description: p.ncrDescription || p.comment || '',
            status: p.ncrStatus || 'Open',
            source: 'checklist'
        }));
    return [...manual, ...checklist];
}

// Overview tab content
function renderClientOverview(client) {
    const clientPlans = (window.state.auditPlans || []).filter(p => matchesClient(p, client));
    const clientCerts = (window.state.certifications || []).filter(c => matchesClient(c, client));
    const clientReports = (window.state.auditReports || []).filter(r => matchesClient(r, client));
    const openNCs = clientReports.reduce((count, r) => count + (getAllFindings(r).filter(f => f.status !== 'Closed' && f.status !== 'closed').length), 0);

    // Calculate additional metrics
    const completedAudits = clientPlans.filter(p => p.status === 'Completed').length;
    const upcomingAudits = clientPlans.filter(p => p.status === 'Planned' || p.status === 'Approved').length;
    const validCerts = clientCerts.filter(c => c.status === 'Valid').length;
    const totalSites = (client.sites || []).length;
    const totalEmployees = (client.sites || []).reduce((acc, site) => acc + (parseInt(site.employees) || 0), 0) || client.employees || 0;

    // Organization Data (use client's actual data, no hardcoded defaults)
    const departments = client.departments || [];
    const designations = Array.from(new Set([
        ...(client.designations || []),
        ...(client.contacts || []).map(c => c.designation)
    ].filter(Boolean)));


    return `
        <div class="fade-in">
            <!-- Client Header with Status -->
            <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700;">
                            ${client.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem;">${window.UTILS.escapeHtml(client.name)}</h2>
                            <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem; opacity: 0.9; font-size: 0.9rem;">
                                <span><i class="fa-solid fa-industry" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(client.industry || 'N/A')}</span>
                                <span>•</span>
                                <span><i class="fa-solid fa-certificate" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(client.standard || 'N/A')}</span>
                                <span>•</span>
                                <span><i class="fa-solid fa-map-marker-alt" style="margin-right: 0.25rem;"></i>${totalSites} Site${totalSites !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="background: ${client.status === 'Active' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)'}; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 500;">${window.UTILS.escapeHtml(client.status || 'Active')}</span>
                        <button class="btn" style="background: rgba(255,255,255,0.2); color: white; border: none;" onclick="window.location.hash = 'client/${client.id}/settings'" title="Settings">
                            <i class="fa-solid fa-cog"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Quick Actions Bar -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button class="btn btn-outline-primary" onclick="window.location.hash = 'client/${client.id}/plans'">
                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i>View Audit Plans
                </button>
                <button class="btn btn-primary" onclick="window.renderCreateAuditPlanForm('${window.UTILS.escapeHtml(client.name).replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Audit Plan
                </button>
                <button class="btn btn-outline-primary" onclick="window.location.hash = 'client/${client.id}/execution'">
                    <i class="fa-solid fa-play" style="margin-right: 0.5rem;"></i>Start Execution
                </button>
                <button class="btn btn-outline-primary" onclick="window.location.hash = 'client/${client.id}/ncr-capa'">
                    <i class="fa-solid fa-clipboard-check" style="margin-right: 0.5rem;"></i>Raise NCR
                </button>

            </div>

            <!-- Alerts Section -->
            ${openNCs > 0 || upcomingAudits > 0 ? `
            <div style="margin-bottom: 1.5rem;">
                ${openNCs > 0 ? `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div><i class="fa-solid fa-exclamation-triangle" style="color: #f59e0b; margin-right: 0.5rem;"></i><strong>${openNCs} Open NC${openNCs !== 1 ? 's' : ''}</strong> - Action required</div>
                    <button class="btn btn-sm" style="background: #f59e0b; color: white; border: none;" onclick="window.location.hash = 'client/${client.id}/ncr-capa'">View</button>
                </div>` : ''}
                ${upcomingAudits > 0 ? `
                <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; display: flex; justify-content: space-between; align-items: center;">
                    <div><i class="fa-solid fa-calendar-alt" style="color: #3b82f6; margin-right: 0.5rem;"></i><strong>${upcomingAudits} Upcoming Audit${upcomingAudits !== 1 ? 's' : ''}</strong></div>
                    <button class="btn btn-sm" style="background: #3b82f6; color: white; border: none;" onclick="window.location.hash = 'client/${client.id}/plans'">View</button>
                </div>` : ''}
            </div>` : ''}

            <!-- Stats Cards Row -->
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6; cursor: pointer;" onclick="window.location.hash = 'client/${client.id}/plans'">
                    <i class="fa-solid fa-clipboard-list" style="font-size: 1.25rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0;">${clientPlans.length}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Total Audits</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981; cursor: pointer;" onclick="window.location.hash = 'client/${client.id}/account-setup'; setTimeout(() => document.querySelector('.tab-btn[data-tab=\'scopes\']')?.click(), 300);">
                    <i class="fa-solid fa-certificate" style="font-size: 1.25rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0;">${validCerts}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Valid Certs</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${openNCs > 0 ? '#f59e0b' : '#10b981'}; cursor: pointer;" onclick="window.location.hash = 'client/${client.id}/ncr-capa'">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.25rem; color: ${openNCs > 0 ? '#f59e0b' : '#10b981'}; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0;">${openNCs}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Open NCs</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #8b5cf6;">
                    <i class="fa-solid fa-users" style="font-size: 1.25rem; color: #8b5cf6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0;">${totalEmployees}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Employees</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #ec4899;">
                    <i class="fa-solid fa-check-double" style="font-size: 1.25rem; color: #ec4899; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0;">${completedAudits}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Completed</p>
                </div>
            </div>

            <!-- Certification Cycle Timeline (Embedded) -->
            ${renderCertificationCycleWidget(client)}

            <!-- Main Content: Charts + Sidebar -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Charts Column -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div class="card" style="min-height: 280px;">
                        <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-chart-bar" style="margin-right: 0.5rem; color: var(--primary-color);"></i>NCR Analysis</h3>
                        <div style="position: relative; height: 200px; width: 100%;"><canvas id="ncrTrendChart"></canvas></div>
                    </div>
                    <div class="card" style="min-height: 280px;">
                        <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-chart-pie" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Performance</h3>
                        <div style="position: relative; height: 200px; width: 100%; display: flex; justify-content: center;"><canvas id="auditPerformanceChart"></canvas></div>
                    </div>
                </div>

                <!-- Right Sidebar -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Quick Info Card -->
                    <div class="card">
                        <h4 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-info-circle" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Quick Info</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem;">
                            <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">Next Audit:</span><strong>${(function () { const upcoming = clientPlans.filter(p => p.status === 'Scheduled' || p.status === 'Planned' || p.status === 'Approved').sort((a, b) => new Date(a.date) - new Date(b.date))[0]; return upcoming ? upcoming.date : 'Not scheduled'; })()}</strong></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">Industry:</span><span>${window.UTILS.escapeHtml(client.industry || '-')}</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">Standard:</span><span>${window.UTILS.escapeHtml(client.standard || '-')}</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">Sites:</span><span>${totalSites || 1}</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">Shifts:</span><span>${client.shifts === 'Yes' ? 'Multiple' : 'General'}</span></div>
                        </div>
                    </div>
                    <!-- Recent Reports Card -->
                    <div class="card">
                        <h4 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-file-alt" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Recent Reports</h4>
                        ${clientReports.length > 0 ? `<div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">${clientReports.slice(0, 3).map(r => `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8fafc; border-radius: 6px;"><span>${r.date || 'N/A'}</span><span class="badge" style="background: ${r.status === 'Finalized' ? '#d1fae5' : '#fef3c7'}; color: ${r.status === 'Finalized' ? '#065f46' : '#92400e'}; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${r.status || 'Draft'}</span></div>`).join('')}</div><button class="btn btn-sm btn-outline-primary" style="width: 100%; margin-top: 0.75rem;" onclick="window.location.hash = 'client/${client.id}/execution'">View All</button>` : '<p style="color: var(--text-secondary); text-align: center; margin: 1rem 0; font-size: 0.9rem;">No reports yet</p>'}
                    </div>
                    <!-- Key Contacts Card -->
                    <div class="card">
                        <h4 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-address-book" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Key Contacts</h4>
                        ${(client.contacts || []).length > 0 ? `<div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">${(client.contacts || []).slice(0, 2).map(c => `<div style="padding: 0.5rem; background: #f8fafc; border-radius: 6px;"><div style="font-weight: 500;">${window.UTILS.escapeHtml(c.name || 'N/A')}</div><div style="font-size: 0.8rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(c.designation || c.email || '-')}</div></div>`).join('')}</div>` : '<p style="color: var(--text-secondary); text-align: center; margin: 1rem 0; font-size: 0.9rem;">No contacts added</p>'}
                    </div>
                </div>
            </div>

            <!-- Upcoming Audit Timeline + Obs/OFI Tracker Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Upcoming Audit Timeline -->
                <div class="card">
                    <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-calendar-days" style="margin-right: 0.5rem; color: #6366f1;"></i>Upcoming Audit Timeline</h3>
                    ${(function () {
            const upcoming = clientPlans
                .filter(p => ['Scheduled', 'Planned', 'Approved', 'In Progress'].includes(p.status))
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5);
            if (upcoming.length === 0) return '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No upcoming audits</p>';
            return '<div style="display: flex; flex-direction: column; gap: 0.75rem;">' + upcoming.map((p, i) => {
                const daysUntil = Math.ceil((new Date(p.date) - new Date()) / 86400000);
                const urgency = daysUntil < 0 ? '#ef4444' : daysUntil <= 7 ? '#f59e0b' : daysUntil <= 30 ? '#3b82f6' : '#10b981';
                const label = daysUntil < 0 ? Math.abs(daysUntil) + 'd overdue' : daysUntil === 0 ? 'Today' : daysUntil + 'd away';
                return '<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: 8px; border-left: 3px solid ' + urgency + ';">'
                    + '<div style="min-width: 80px; font-weight: 600; font-size: 0.85rem; color: #1e293b;">' + (p.date || '-') + '</div>'
                    + '<div style="flex: 1;"><div style="font-weight: 500; font-size: 0.85rem;">' + window.UTILS.escapeHtml(p.type || 'Audit') + '</div>'
                    + '<div style="font-size: 0.75rem; color: var(--text-secondary);">' + window.UTILS.escapeHtml(p.standard || '') + '</div></div>'
                    + '<span style="background: ' + urgency + '20; color: ' + urgency + '; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">' + label + '</span>'
                    + '</div>';
            }).join('') + '</div>';
        })()}
                </div>

                <!-- Observation/OFI Tracker -->
                <div class="card" style="min-height: 280px;">
                    <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-eye" style="margin-right: 0.5rem; color: #8b5cf6;"></i>Observation & OFI Tracker</h3>
                    <div style="position: relative; height: 200px; width: 100%;"><canvas id="obsOfiChart"></canvas></div>
                </div>
            </div>

            <!-- Auditor Assignment + CAPA Closure Trend Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Assigned Audit Team -->
                <div class="card">
                    <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-user-tie" style="margin-right: 0.5rem; color: #0ea5e9;"></i>Assigned Audit Team</h3>
                    ${(function () {
            // Gather unique auditors from plans
            const auditorMap = new Map();
            clientPlans.forEach(p => {
                (p.team || []).forEach((name, idx) => {
                    if (!name) return;
                    const existing = auditorMap.get(name);
                    if (!existing) {
                        const auditorObj = (window.state.auditors || []).find(a => a.name === name);
                        auditorMap.set(name, {
                            name,
                            role: idx === 0 ? 'Lead Auditor' : 'Team Member',
                            competencies: auditorObj?.competencies || auditorObj?.qualifications || [],
                            audits: 1
                        });
                    } else {
                        existing.audits++;
                        if (idx === 0) existing.role = 'Lead Auditor';
                    }
                });
            });
            const auditors = [...auditorMap.values()];
            if (auditors.length === 0) return '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No auditors assigned</p>';
            return '<div style="display: flex; flex-direction: column; gap: 0.5rem;">' + auditors.map(a => {
                const isLead = a.role === 'Lead Auditor';
                return '<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: ' + (isLead ? '#f0f9ff' : '#f8fafc') + '; border-radius: 8px; border-left: 3px solid ' + (isLead ? '#0284c7' : '#94a3b8') + ';">'
                    + '<div style="width: 36px; height: 36px; border-radius: 50%; background: ' + (isLead ? 'linear-gradient(135deg,#0284c7,#0369a1)' : 'linear-gradient(135deg,#64748b,#475569)') + '; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">'
                    + a.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() + '</div>'
                    + '<div style="flex: 1;"><div style="font-weight: 500; font-size: 0.85rem;">' + window.UTILS.escapeHtml(a.name) + '</div>'
                    + '<div style="font-size: 0.75rem; color: var(--text-secondary);">' + a.role + ' • ' + a.audits + ' audit' + (a.audits !== 1 ? 's' : '') + '</div></div>'
                    + (isLead ? '<i class="fa-solid fa-star" style="color: #fbbf24; font-size: 0.85rem;" title="Lead Auditor"></i>' : '')
                    + '</div>';
            }).join('') + '</div>';
        })()}
                </div>

                <!-- CAPA Closure Trend -->
                <div class="card" style="min-height: 280px;">
                    <h3 style="margin: 0 0 1rem 0;"><i class="fa-solid fa-chart-line" style="margin-right: 0.5rem; color: #10b981;"></i>CAPA Closure Trend</h3>
                    <div style="position: relative; height: 200px; width: 100%;"><canvas id="capaClosureChart"></canvas></div>
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
                        <button class="btn btn-sm btn-primary" onclick="window.addContactPerson('${client.id}')"><i class="fa-solid fa-plus"></i> Add Contact</button>
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
                            <button class="btn btn-sm btn-outline-primary" onclick="window.addDepartment('${client.id}')"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <ul style="list-style: none; padding: 0;">
                            ${departments.map(dept => `
                            <li style="padding: 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                <span>${typeof dept === 'object' ? (dept.name || 'Unnamed') : dept}</span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></span>
                            </li>
                            `).join('')}
                        </ul>
                    </div>
                     <div class="card">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Designations</h3>
                            <button class="btn btn-sm btn-outline-primary" onclick="window.addClientDesignation('${client.id}')"><i class="fa-solid fa-plus"></i></button>
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

// Compact Certification Cycle Widget for Overview Dashboard
// Render Timeline Widget for EACH active standard
function renderCertificationCycleWidget(client) {
    const certs = client.certificates || [];
    const standards = [...new Set(certs.map(c => c.standard).filter(Boolean))];

    // If no standards/certs, show fallback
    if (standards.length === 0) {
        return `
            <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <i class="fa-solid fa-certificate" style="font-size: 2rem; color: #3b82f6;"></i>
                        <div>
                            <h4 style="margin: 0; color: #1e40af;">Certification Cycle</h4>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #64748b;">No certification cycle started yet</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="window.location.hash = 'client/${client.id}/settings'; setTimeout(() => document.querySelector('.tab-btn[data-tab=\\'scopes\\']')?.click(), 100);" style="white-space: nowrap;">
                        <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i>Set Up Cycle
                    </button>
                </div>
            </div>
        `;
    }

    // Render a card for each standard
    return standards.map(std => {
        // Find best cert for this standard (active > latest)
        const stdCerts = certs.filter(c => c.standard === std);
        const activeCert = stdCerts.find(c => c.status === 'Active') || stdCerts.sort((a, b) => new Date(b.currentIssue || b.initialDate) - new Date(a.currentIssue || a.initialDate))[0];

        if (!activeCert || (!activeCert.initialDate && !activeCert.currentIssue)) return '';

        const issueDate = new Date(activeCert.currentIssue || activeCert.initialDate);
        const surv1 = new Date(issueDate); surv1.setFullYear(surv1.getFullYear() + 1);
        const surv2 = new Date(issueDate); surv2.setFullYear(surv2.getFullYear() + 2);
        const expiry = activeCert.expiryDate ? new Date(activeCert.expiryDate) : (() => {
            const exp = new Date(issueDate);
            exp.setFullYear(exp.getFullYear() + 3);
            return exp;
        })();
        const recertAudit = new Date(expiry);
        recertAudit.setDate(recertAudit.getDate() - 60);

        const today = new Date();
        let currentStage = "Initial Certification";
        let nextAudit = surv1;
        let progress = 0;

        if (today > surv1) { currentStage = "Surveillance 1"; nextAudit = surv2; progress = 33; }
        if (today > surv2) { currentStage = "Surveillance 2"; nextAudit = recertAudit; progress = 66; }
        if (today > recertAudit) { currentStage = "Recertification Due"; nextAudit = expiry; progress = 90; }
        if (today > expiry) { currentStage = "Expired"; nextAudit = null; progress = 100; }

        const daysToNext = nextAudit ? Math.ceil((nextAudit - today) / (1000 * 60 * 60 * 24)) : 0;
        const isUrgent = daysToNext > 0 && daysToNext <= 60;

        return `
            <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, ${today > expiry ? '#fee2e2' : '#f0f9ff'} 0%, ${today > expiry ? '#fecaca' : '#e0f2fe'} 100%); border-left: 4px solid ${today > expiry ? '#dc2626' : '#3b82f6'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                            <i class="fa-solid fa-certificate" style="font-size: 1.5rem; color: #3b82f6;"></i>
                            <div>
                                <h4 style="margin: 0; color: #1e40af;">Certification Cycle - ${std}</h4>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #64748b;">Cert #: ${activeCert.certificateNo || 'Not assigned'} • Rev: ${activeCert.revision || '00'}</p>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div style="background: rgba(255,255,255,0.6); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 0.75rem;">
                            <div style="background: ${today > expiry ? '#dc2626' : progress >= 66 ? '#f59e0b' : '#3b82f6'}; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                        </div>
                        
                        <!-- Current Stage Info -->
                        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Current Stage</div>
                                <div style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-top: 0.25rem;">${currentStage}</div>
                            </div>
                            ${nextAudit ? `
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Next Audit</div>
                                <div style="font-size: 1.1rem; font-weight: 600; color: ${isUrgent ? '#dc2626' : '#1e293b'}; margin-top: 0.25rem;">
                                    ${window.UTILS.formatDate(nextAudit)}
                                    ${isUrgent ? `<span style="font-size: 0.75rem; color: #dc2626; margin-left: 0.5rem;">(${daysToNext} days!)</span>` : ''}
                                </div>
                            </div>

                            ` : ''}
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Expiry Date</div>
                                <div style="font-size: 1.1rem; font-weight: 600; color: ${today > expiry ? '#dc2626' : '#1e293b'}; margin-top: 0.25rem;">${window.UTILS.formatDate(expiry)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Mini Timeline -->
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <div style="text-align: center;">
                            <div style="width: 32px; height: 32px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem;">✓</div>
                            <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">Cert</div>
                        </div>
                        <div style="width: 20px; height: 2px; background: ${today > surv1 ? '#10b981' : '#cbd5e1'};"></div>
                        <div style="text-align: center;">
                            <div style="width: 32px; height: 32px; background: ${today > surv1 ? '#10b981' : '#cbd5e1'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem;">${today > surv1 ? '✓' : '1'}</div>
                            <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">S1</div>
                        </div>
                        <div style="width: 20px; height: 2px; background: ${today > surv2 ? '#10b981' : '#cbd5e1'};"></div>
                        <div style="text-align: center;">
                            <div style="width: 32px; height: 32px; background: ${today > surv2 ? '#10b981' : '#cbd5e1'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem;">${today > surv2 ? '✓' : '2'}</div>
                            <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">S2</div>
                        </div>
                        <div style="width: 20px; height: 2px; background: ${today > recertAudit ? '#f59e0b' : '#cbd5e1'};"></div>
                        <div style="text-align: center;">
                            <div style="width: 32px; height: 32px; background: ${today > recertAudit ? '#f59e0b' : '#cbd5e1'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem;">↻</div>
                            <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.25rem;">Re</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Audit cycle timeline - UNIFIED with Settings → Scopes
function renderAuditCycleTimeline(client) {
    // Use client.certificates from Settings instead of separate certifications array
    const certs = client.certificates || [];

    // Find the certificate with the most recent initialDate or currentIssue
    const latestCert = certs
        .filter(c => c.initialDate || c.currentIssue)
        .sort((a, b) => {
            const dateA = new Date(a.currentIssue || a.initialDate);
            const dateB = new Date(b.currentIssue || b.initialDate);
            return dateB - dateA;
        })[0];

    if (!latestCert || (!latestCert.initialDate && !latestCert.currentIssue)) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-certificate" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No certification cycle started yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Go to Settings → Certification Scopes & History to set the Initial Date.
                </p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.hash = 'client/${client.id}/settings'; setTimeout(() => document.querySelector('.tab-btn[data-tab=\\'scopes\\']')?.click(), 100);">
                    <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i>Go to Settings
                </button>
            </div>
        `;
    }

    // Use currentIssue if available, otherwise initialDate
    const issueDate = new Date(latestCert.currentIssue || latestCert.initialDate);
    const surv1 = new Date(issueDate); surv1.setFullYear(surv1.getFullYear() + 1);
    const surv2 = new Date(issueDate); surv2.setFullYear(surv2.getFullYear() + 2);

    // Calculate expiry date (3 years from issue)
    const expiry = latestCert.expiryDate ? new Date(latestCert.expiryDate) : (() => {
        const exp = new Date(issueDate);
        exp.setFullYear(exp.getFullYear() + 3);
        return exp;
    })();

    // Recertification audit should occur 60 days BEFORE expiry
    const recertAudit = new Date(expiry);
    recertAudit.setDate(recertAudit.getDate() - 60); // 60 days before expiry

    const today = new Date();
    let currentStage = "Initial Certification";
    let nextAudit = surv1;
    if (today > surv1) { currentStage = "Surveillance 1"; nextAudit = surv2; }
    if (today > surv2) { currentStage = "Surveillance 2"; nextAudit = recertAudit; }
    if (today > recertAudit) { currentStage = "Recertification Due"; nextAudit = expiry; }
    if (today > expiry) { currentStage = "Expired"; nextAudit = null; }

    const daysToNext = nextAudit ? Math.ceil((nextAudit - today) / (1000 * 60 * 60 * 24)) : 0;

    return `
        <div class="fade-in">
            <!-- Quick Link to Settings -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;"><i class="fa-solid fa-timeline" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Certification Cycle</h3>
                <button class="btn btn-sm btn-outline-primary" onclick="window.location.hash = 'client/${client.id}/settings'; setTimeout(() => document.querySelector('.tab-btn[data-tab=\\'scopes\\']')?.click(), 100);" title="Edit certification dates in Settings">
                    <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i>Edit Dates
                </button>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-sync" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${currentStage}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Current Cycle Stage</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-calendar-check" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${nextAudit ? window.UTILS.formatDate(nextAudit) : 'N/A'}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Next Scheduled Audit</p>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${daysToNext > 0 ? daysToNext + ' days remaining' : 'Due/Overdue'}</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-hourglass-half" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0;">${window.UTILS.formatDate(expiry)}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Cycle Expiry Date</p>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;"><i class="fa-solid fa-certificate" style="margin-right: 0.5rem; color: var(--primary-color);"></i>${latestCert.standard || 'ISO'}</h3>
                    <div style="text-align: right;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Cert #: <strong>${latestCert.certificateNo || 'Not assigned'}</strong></div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Rev: <strong>${latestCert.revision || '00'}</strong></div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; position: relative; padding: 2rem 0;">
                    <div style="position: absolute; top: 50%; left: 5%; right: 5%; height: 4px; background: linear-gradient(90deg, #10b981 0%, #10b981 25%, #3b82f6 25%, #3b82f6 50%, #3b82f6 50%, #3b82f6 75%, #f59e0b 75%, #f59e0b 90%, #dc2626 90%); border-radius: 2px;"></div>
                    
                    <div style="text-align: center; z-index: 1;">
                        <div style="width: 40px; height: 40px; background: #10b981; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-check"></i></div>
                        <div style="font-weight: 500; font-size: 0.9rem;">Certification</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.formatDate(issueDate)}</div>
                    </div>
                    
                    <div style="text-align: center; z-index: 1;">
                        <div style="width: 40px; height: 40px; background: ${new Date() > surv1 ? '#10b981' : '#3b82f6'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-eye"></i></div>
                        <div style="font-weight: 500; font-size: 0.9rem;">Surv 1</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.formatDate(surv1)}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">Year 1</div>
                    </div>
                    
                    <div style="text-align: center; z-index: 1;">
                        <div style="width: 40px; height: 40px; background: ${new Date() > surv2 ? '#10b981' : '#3b82f6'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-eye"></i></div>
                        <div style="font-weight: 500; font-size: 0.9rem;">Surv 2</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.formatDate(surv2)}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">Year 2</div>
                    </div>
                    
                    <div style="text-align: center; z-index: 1;">
                        <div style="width: 40px; height: 40px; background: ${new Date() > recertAudit ? '#10b981' : '#f59e0b'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-sync"></i></div>
                        <div style="font-weight: 500; font-size: 0.9rem;">Recert Audit</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.formatDate(recertAudit)}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">60 days before</div>
                    </div>
                    
                    <div style="text-align: center; z-index: 1;">
                        <div style="width: 40px; height: 40px; background: ${new Date() > expiry ? '#dc2626' : '#94a3b8'}; border-radius: 50%; margin: 0 auto 0.5rem; display: flex; align-items: center; justify-content: center; color: white;"><i class="fa-solid fa-hourglass-end"></i></div>
                        <div style="font-weight: 500; font-size: 0.9rem;">Expiry</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.formatDate(expiry)}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">Year 3</div>
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
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.renderCreateAuditPlanForm('${client.name}')">
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
                    <button class="btn btn-sm btn-primary" onclick="window.renderCreateAuditPlanForm('${client.name}')">
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
                                    <td><a href="#" onclick="event.preventDefault(); window.viewAuditPlan('${p.id}')" style="color: var(--primary-color); text-decoration: none; font-weight: 500;">${p.date || '-'}</a></td>
                                    <td>${p.type || 'Audit'}</td>
                                    <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${p.standard || 'ISO'}</span></td>
                                    <td><span class="status-badge status-${(p.status || 'planned').toLowerCase().replace(' ', '-')}">${p.status || 'Planned'}</span></td>
                                    <td>${(p.team && p.team[0]) || p.lead || '-'}</td>
                                    <td>
                                        <button class="btn btn-sm btn-icon" onclick="window.viewAuditPlan('${p.id}')"><i class="fa-solid fa-eye"></i></button>
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
    const totalFindings = reports.reduce((sum, r) => sum + getAllFindings(r).length, 0);

    if (reports.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-tasks" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No audit execution records for this client yet.</p>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.renderCreateAuditPlanForm('${client.name}')">
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
                    <button class="btn btn-sm btn-primary" onclick="window.renderCreateAuditPlanForm('${client.name}')">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Plan New Audit
                    </button>
                </div>

                <!-- Scheduled Plans (Ready to Start) -->
                ${(function () {
            const scheduledPlans = (window.state.auditPlans || []).filter(p =>
                (p.client === client.name) &&
                (!p.reportId) &&
                (p.status !== 'Completed')
            );

            if (scheduledPlans.length === 0) return '';

            return `
                    <div style="margin-bottom: 2rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc;">
                        <h4 style="margin-top: 0; color: var(--primary-color);"><i class="fa-solid fa-clock" style="margin-right: 0.5rem;"></i> Scheduled Audits (Ready to Start)</h4>
                        <table class="table" style="margin-bottom: 0;">
                            <thead>
                                <tr>
                                    <th>Ref</th>
                                    <th>Date</th>
                                    <th>Standard</th>
                                    <th>Type</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${scheduledPlans.map(p => `
                                    <tr>
                                        <td><strong>${window.UTILS.getPlanRef(p)}</strong></td>
                                        <td>${p.date}</td>
                                        <td>${p.standard}</td>
                                        <td>${p.type}</td>
                                        <td>
                                            <button class="btn btn-sm btn-success" onclick="window.navigateToAuditExecution('${p.id}')">
                                                <i class="fa-solid fa-play" style="margin-right: 0.25rem;"></i> Start Audit
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    `;
        })()}
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
            const allF = getAllFindings(r);
            const findingsCount = allF.length;
            const openNCs = allF.filter(f => f.status !== 'Closed' && f.status !== 'closed').length;

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
                                        <button class="btn btn-sm btn-icon" onclick="window.renderExecutionDetail && window.renderExecutionDetail('${r.id}')" title="View Report" style="color: var(--primary-color); margin-right: 0.5rem;">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" onclick="window.openEditReportModal && window.openEditReportModal('${r.id}')" title="Edit Report" style="color: #f59e0b; margin-right: 0.5rem;">
                                            <i class="fa-solid fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" onclick="window.deleteAuditReport && window.deleteAuditReport('${r.id}')" title="Delete Report" style="color: var(--danger-color);">
                                            <i class="fa-solid fa-trash"></i>
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

        // Aggregate findings from ALL sources (manual NCRs + checklist NCs)
        const findings = reports.flatMap(r => getAllFindings(r));
        const major = findings.filter(f => (f.type || '').toLowerCase() === 'major').length;
        const minor = findings.filter(f => (f.type || '').toLowerCase() === 'minor').length;
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

        // Calculate real conformity from checklist progress
        let totalItems = 0, conformItems = 0;
        reports.forEach(r => {
            const progress = r.checklistProgress || [];
            if (progress.length > 0) {
                const assessed = progress.filter(p => p.status && p.status !== '');
                totalItems += assessed.length;
                conformItems += assessed.filter(p => p.status === 'conform').length;
            }
        });

        let score = totalItems > 0 ? Math.round((conformItems / totalItems) * 100) : 100;
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

    // ----------------------------
    // 3. Observation & OFI Tracker Chart
    // ----------------------------
    const ctxObs = document.getElementById('obsOfiChart');
    if (ctxObs) {
        if (clientDashboardCharts.obsOfi) {
            clientDashboardCharts.obsOfi.destroy();
        }

        const allFindings = reports.flatMap(r => getAllFindings(r));
        const observations = allFindings.filter(f => (f.type || '').toLowerCase() === 'observation').length;
        const ofis = allFindings.filter(f => (f.type || '').toLowerCase() === 'ofi' || (f.type || '').toLowerCase() === 'opportunity for improvement').length;
        const majors = allFindings.filter(f => (f.type || '').toLowerCase() === 'major').length;
        const minors = allFindings.filter(f => (f.type || '').toLowerCase() === 'minor').length;

        clientDashboardCharts.obsOfi = new Chart(ctxObs, {
            type: 'bar',
            data: {
                labels: ['Major NC', 'Minor NC', 'Observation', 'OFI'],
                datasets: [{
                    label: 'Count',
                    data: [majors, minors, observations, ofis],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(6, 182, 212, 0.8)'
                    ],
                    borderColor: [
                        'rgb(239, 68, 68)',
                        'rgb(245, 158, 11)',
                        'rgb(139, 92, 246)',
                        'rgb(6, 182, 212)'
                    ],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // ----------------------------
    // 4. CAPA Closure Trend Chart
    // ----------------------------
    const ctxCAPA = document.getElementById('capaClosureChart');
    if (ctxCAPA) {
        if (clientDashboardCharts.capaClosure) {
            clientDashboardCharts.capaClosure.destroy();
        }

        // Build monthly data from NCR register for this client
        const clientNCRs = (window.state.ncrs || []).filter(n =>
            (n.clientId && String(n.clientId) === String(client.id)) ||
            (n.clientName && n.clientName.trim().toLowerCase() === client.name.trim().toLowerCase())
        );

        // Group by month
        const monthMap = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toISOString().substring(0, 7); // YYYY-MM
            monthMap[key] = { raised: 0, closed: 0 };
        }

        clientNCRs.forEach(n => {
            const raisedKey = (n.raisedDate || '').substring(0, 7);
            if (monthMap[raisedKey]) monthMap[raisedKey].raised++;

            if (n.status === 'Closed' && n.verifiedDate) {
                const closedKey = n.verifiedDate.substring(0, 7);
                if (monthMap[closedKey]) monthMap[closedKey].closed++;
            }
        });

        // Also count from report findings
        reports.forEach(r => {
            const reportKey = (r.date || '').substring(0, 7);
            if (monthMap[reportKey]) {
                const findings = getAllFindings(r);
                monthMap[reportKey].raised += findings.length;
                monthMap[reportKey].closed += findings.filter(f => f.status === 'Closed').length;
            }
        });

        const labels = Object.keys(monthMap).map(k => {
            const [y, m] = k.split('-');
            return new Date(y, m - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
        });
        const raisedData = Object.values(monthMap).map(v => v.raised);
        const closedData = Object.values(monthMap).map(v => v.closed);

        clientDashboardCharts.capaClosure = new Chart(ctxCAPA, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Raised',
                        data: raisedData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#ef4444'
                    },
                    {
                        label: 'Closed',
                        data: closedData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#10b981'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, pointStyle: 'circle' }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
};
// window.renderClientWorkspace export is not needed as selectClient handles it directly via renderClientSidebarMenu loops

// ============================================
// CLIENTS MODULE (ESM-ready)
// ============================================

// state is defined globally in script.js as window.state

function renderClientsEnhanced() {
    const searchTerm = window.state.clientSearchTerm || '';
    // Default to 'Active' status filter for better UX
    const filterStatus = window.state.clientFilterStatus || 'Active';


    // Pagination State
    if (!window.state.clientPagination) {
        window.state.clientPagination = { currentPage: 1, itemsPerPage: 10 };
    }

    let filteredClients = window.getVisibleClients().filter(client => {
        const matchesSearch = (client.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || (client.status || '').toLowerCase() === filterStatus.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    const totalItems = filteredClients.length;
    const totalPages = Math.ceil(totalItems / window.state.clientPagination.itemsPerPage);

    // Ensure currentPage is valid
    if (window.state.clientPagination.currentPage > totalPages && totalPages > 0) {
        window.state.clientPagination.currentPage = totalPages;
    }
    if (window.state.clientPagination.currentPage < 1) window.state.clientPagination.currentPage = 1;

    const startIndex = (window.state.clientPagination.currentPage - 1) * window.state.clientPagination.itemsPerPage;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + window.state.clientPagination.itemsPerPage);

    const rows = paginatedClients.map(client => `
    <tr class="client-row" data-client-id="${client.id}" style="cursor: pointer;" data-action="renderClientDetail" data-id="${client.id}">
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 6px; overflow: hidden; background: #fff; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                        ${client.logoUrl
            ? `<img src="${window.UTILS.escapeHtml(client.logoUrl)}" style="width: 100%; height: 100%; object-fit: contain;">`
            : `<i class="fa-solid fa-building" style="font-size: 0.9rem; color: #cbd5e1;"></i>`
        }
                    </div>
                    <span style="font-weight: 500; color: #1e293b;">${window.UTILS.escapeHtml(client.name)}</span>
                </div>
            </td>
            <td>
                ${(client.standard || '').split(',').map(s =>
            `<span class="badge" style="background: #e0f2fe; color: #0284c7; margin-right: 4px; font-size: 0.75em;">${window.UTILS.escapeHtml(s.trim())}</span>`
        ).join('')}
            </td>
            <td><span class="status-badge status-${(client.status || '').toLowerCase()}">${window.UTILS.escapeHtml(client.status)}</span></td>

            <td>
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm edit-client" data-client-id="${client.id}" style="color: var(--primary-color); margin-right: 0.5rem;" aria-label="Edit"><i class="fa-solid fa-edit"></i></button>
                ` : ''}
                <button class="btn btn-sm view-client" data-client-id="${client.id}" style="color: var(--primary-color);" aria-label="View"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr >
    `).join('');

    const html = `
    <div class="fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="margin: 0;">Client Management</h2>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                        <input type="file" id="client-import-file" style="display: none;" accept=".xlsx, .xls">
                        <button class="btn btn-sm btn-outline-secondary" data-action="downloadImportTemplate" style="white-space: nowrap;" title="Restricted to Cert Managers" aria-label="Export">
                            <i class="fa-solid fa-file-export" style="margin-right: 0.5rem;"></i>Template
                        </button>
                         <button class="btn btn-sm btn-outline-secondary" data-action="clickElement" data-id="client-import-file" style="white-space: nowrap;" title="Restricted to Cert Managers">
                            <i class="fa-solid fa-file-import" style="margin-right: 0.5rem;"></i>Import
                        </button>
                    ` : ''}
                <button class="btn btn-sm btn-outline-secondary" data-action="toggleClientAnalytics" style="white-space: nowrap;">
                    <i class="fa-solid ${window.state.showClientAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${window.state.showClientAnalytics !== false ? 'Hide' : 'Show'} Analytics
                </button>
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                    <button id="btn-new-client" class="btn btn-primary" data-action="renderAddClient" style="white-space: nowrap;" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Client
                    </button>
                    ` : ''}
            </div>
        </div>

            ${window.state.showClientAnalytics !== false ? `
            <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Clients -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-building"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Clients</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisibleClients().length}</div>
                    </div>
                </div>

                <!-- Active -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-check-circle"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Active</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisibleClients().filter(c => c.status === 'Active').length}</div>
                    </div>
                </div>

                 <!-- Suspended/Withdrawn -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-ban"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Inactive</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisibleClients().filter(c => ['Suspended', 'Withdrawn'].includes(c.status)).length}</div>
                    </div>
                </div>
                
                 <!-- Total Sites -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Sites</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisibleClients().reduce((acc, c) => acc + (c.sites ? c.sites.length : 1), 0)}</div>
                    </div>
                </div>
            </div>
            ` : ''
        }

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="client-search" placeholder="Search clients..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="client-filter" style="max-width: 150px; margin-bottom: 0;">
                        <option value="All" ${filterStatus === 'All' ? 'selected' : ''}>All Status</option>
                        <option value="Active" ${filterStatus === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Suspended" ${filterStatus === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        <option value="Withdrawn" ${filterStatus === 'Withdrawn' ? 'selected' : ''}>Withdrawn</option>
                    </select>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client Name</th>
                            <th>Standard</th>
                            <th>Status</th>

                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No clients found</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            ${totalItems > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding: 0.5rem;">
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    Showing ${startIndex + 1} to ${Math.min(startIndex + window.state.clientPagination.itemsPerPage, totalItems)} of ${totalItems} entries
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" data-action="changeClientPage" data-id="${window.state.clientPagination.currentPage - 1}" ${window.state.clientPagination.currentPage === 1 ? 'disabled' : ''} aria-label="Previous">
                        <i class="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span style="font-size: 0.9rem; min-width: 80px; text-align: center;">Page ${window.state.clientPagination.currentPage} of ${totalPages}</span>
                    <button class="btn btn-sm btn-outline-secondary" data-action="changeClientPage" data-id="${window.state.clientPagination.currentPage + 1}" ${window.state.clientPagination.currentPage === totalPages ? 'disabled' : ''}>
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <select data-action-change="changeClientItemsPerPage" data-id="this.value" style="margin-left: 1rem; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color);">
                        <option value="10" ${window.state.clientPagination.itemsPerPage === 10 ? 'selected' : ''}>10 / page</option>
                        <option value="25" ${window.state.clientPagination.itemsPerPage === 25 ? 'selected' : ''}>25 / page</option>
                        <option value="50" ${window.state.clientPagination.itemsPerPage === 50 ? 'selected' : ''}>50 / page</option>
                    </select>
                </div>
            </div>
            ` : ''
        }
        </div >
    `;

    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = html;
    }

    // Event listeners removed - using inline onclick for reliability

    document.getElementById('client-import-file')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importClientsFromExcel(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    });

    document.getElementById('client-search')?.addEventListener('input', (e) => {
        window.state.clientSearchTerm = e.target.value;
        renderClientsEnhanced();
    });

    document.getElementById('client-filter')?.addEventListener('change', (e) => {
        window.state.clientFilterStatus = e.target.value;
        renderClientsEnhanced();
    });

    document.querySelectorAll('.view-client, .client-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-client')) {
                const clientId = el.getAttribute('data-client-id');
                // Navigate directly to Client Workspace (no intermediate page)
                window.location.hash = `client/${clientId}`;
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clientId = btn.getAttribute('data-client-id');
            window.renderEditClient(clientId);
        });
    });

    // Helper for toggle
    window.toggleClientAnalytics = function () {
        if (window.state.showClientAnalytics === undefined) window.state.showClientAnalytics = true;
        window.state.showClientAnalytics = !window.state.showClientAnalytics;
        renderClientsEnhanced();
    };
}

window.changeClientPage = function (page) {
    if (window.state.clientPagination) {
        window.state.clientPagination.currentPage = page;
        renderClientsEnhanced();
    }
};

window.changeClientItemsPerPage = function (val) {
    if (window.state.clientPagination) {
        window.state.clientPagination.itemsPerPage = parseInt(val, 10);
        window.state.clientPagination.currentPage = 1; // Reset to first page
        renderClientsEnhanced();
    }
};

function renderClientDetail(clientId, options = {}) {
    const client = window.DataService.findClient(clientId);
    if (!client) return;

    // Set active client ID so tabs like "Account Setup" are visible
    window.state.activeClientId = String(clientId);

    // Options: showAccountSetup (default: true), showAnalytics (default: true)
    const _showAccountSetup = options.showAccountSetup !== false;
    const showAnalytics = options.showAnalytics !== false;

    // Calculate performance metrics
    const totalAudits = window.state.auditPlans.filter(p => p.client === client.name).length;
    const completedAudits = window.state.auditPlans.filter(p => p.client === client.name && p.status === 'Completed').length;
    const pendingAudits = window.state.auditPlans.filter(p => p.client === client.name && (p.status === 'Draft' || p.status === 'Confirmed')).length;
    const certificationStatus = client.status === 'Active' ? 'Certified' : client.status;

    const html = `
    <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" data-action="renderClientsEnhanced" aria-label="Back">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Clients
                </button>
            </div>
            
            <!--Header Card with Client Info-->
    <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 1.25rem;">
                 <div style="width: 64px; height: 64px; border-radius: 12px; overflow: hidden; background: #fff; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    ${client.logoUrl
            ? `<img src="${client.logoUrl}" style="width: 100%; height: 100%; object-fit: contain;">`
            : `<i class="fa-solid fa-building" style="font-size: 1.75rem; color: #e2e8f0;"></i>`
        }
                </div>
                <div>
                    <h2 style="margin: 0; line-height: 1.2;">${window.UTILS.escapeHtml(client.name)}</h2>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0; font-size: 0.9rem;">
                        ${window.UTILS.escapeHtml(client.industry || 'N/A')} 
                        <span style="margin: 0 0.5rem; color: #cbd5e1;">|</span> 
                        ${window.UTILS.escapeHtml(client.standard || 'N/A')}
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                    <button class="btn btn-primary" data-action="renderEditClient" data-id="${client.id}" aria-label="Edit">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    ` : ''}

                <span class="status-badge status-${(client.status || '').toLowerCase()}">${window.UTILS.escapeHtml(client.status)}</span>
            </div>
        </div>
    </div>

            ${showAnalytics ? `
            <!-- Performance Analytics Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.25rem; text-align: center;">
                    <p style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.5rem;">Certification</p>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0;">${certificationStatus}</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 1.25rem; text-align: center;">
                    <p style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Audits</p>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0;">${totalAudits}</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.25rem; text-align: center;">
                    <p style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.5rem;">Completed</p>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0;">${completedAudits}</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1.25rem; text-align: center;">
                    <p style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.5rem;">Pending</p>
                    <p style="font-size: 1.75rem; font-weight: 700; margin: 0;">${pendingAudits}</p>
                </div>
            </div>
            ` : ''
        }

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="info">Summary</button>
                <button class="tab-btn" data-tab="audit_team">
                    <i class="fa-solid fa-user-shield" style="margin-right: 0.25rem;"></i>Audit Team
                </button>
                <button class="tab-btn" data-tab="scopes" aria-label="Certificate">
                    <i class="fa-solid fa-certificate" style="margin-right: 0.25rem;"></i>Scopes & Certs
                </button>
                <button class="tab-btn" data-tab="settings" aria-label="Settings">
                    <i class="fa-solid fa-cog" style="margin-right: 0.25rem;"></i>Settings
                </button>
            </div>

            <div id="tab-content"></div>
        </div >
    `;

    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = html;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            window.switchClientDetailTab(clientId, btn.getAttribute('data-tab'));
        });
    });

    renderClientTab(client, 'info');
}

window.switchClientDetailTab = function (clientId, tabName) {
    const client = window.DataService.findClient(clientId);
    if (!client) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderClientTab(client, tabName);
};

// Helper functions for tab content
function getClientInfoHTML(client) {
    // Find auditors that match this client's industry
    const matchingAuditors = window.state.auditors.filter(a =>
        a.industries && a.industries.includes(client.industry)
    );

    // Calculate total employees: sum of site employees if they exist, otherwise use company level
    let totalEmployees = client.employees || 0;
    if (client.sites && client.sites.length > 0) {
        const siteEmployeesSum = client.sites.reduce((sum, site) => sum + (site.employees || 0), 0);
        // If sites have employee data, use that sum; otherwise use company level
        if (siteEmployeesSum > 0) {
            totalEmployees = siteEmployeesSum;
        }
    }

    return `
    <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">Company Information</h3>
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm btn-outline-primary" data-action="openImportAccountSetupModal" data-id="${client.id}">
                    <i class="fa-solid fa-file-import" style="margin-right: 0.5rem;"></i>Bulk Import Setup
                </button>
                ` : ''}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                <!-- Basic Info -->
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Company Name</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(client.name)}</p>
                </div>
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Website</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;">
                        ${client.website ? `<a href="${window.UTILS.escapeHtml(client.website)}" target="_blank" style="color: var(--primary-color); text-decoration: none;"><i class="fa-solid fa-globe" style="margin-right: 5px;"></i>${window.UTILS.escapeHtml(client.website)}</a>` : '-'}
                    </p>
                </div>
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Standard</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(client.standard)}</p>
                </div>
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Industry</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;">
                        <span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                            <i class="fa-solid fa-industry" style="margin-right: 5px;"></i>${window.UTILS.escapeHtml(client.industry || 'Not Specified')}
                        </span>
                    </p>
                </div>

                <!-- Operational Data -->
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Total Employees</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-users" style="color: var(--text-secondary); margin-right: 5px;"></i> ${totalEmployees}</p>
                </div>
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Sites</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-building" style="color: var(--text-secondary); margin-right: 5px;"></i> ${(client.sites && client.sites.length) || 1}</p>
                </div>
                <div>
                     <label style="color: var(--text-secondary); font-size: 0.875rem;">Shift Work</label>
                     <p style="font-weight: 500; margin-top: 0.25rem;">${client.shifts === 'Yes' ? 'Yes (Multiple Shifts)' : 'No (General Shift Only)'}</p>
                </div>

            </div>
        </div >

    ${getClientSitesHTML(client)}

        <!--Matching Auditors-->
    <div class="card" style="margin-top: 1.5rem;">
        <h3 style="margin-bottom: 1rem;">
            <i class="fa-solid fa-user-check" style="margin-right: 0.5rem; color: var(--success-color);"></i>
            Auditors with ${client.industry || 'Matching'} Industry Experience
        </h3>
        ${matchingAuditors.length > 0 ? `
                    <div style="display: grid; gap: 0.75rem;">
                        ${matchingAuditors.map(a => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                                        ${a.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <p style="font-weight: 500; margin: 0;">${window.UTILS.escapeHtml(a.name)}</p>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${window.UTILS.escapeHtml(a.role)} • ${a.experience || 0} years exp</p>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    ${(a.standards || []).map(s => `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${s}</span>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                        No auditors found with ${client.industry || 'this'} industry experience. 
                        <a href="#" data-action="renderModule" data-id="auditors" style="color: var(--primary-color);">Add auditors</a> with relevant industry expertise.
                    </p>
                `}
    </div>
`;
}

function getClientSitesHTML(client) {
    return `
    <!--Sites / Locations-->
    <div class="card" style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-map-location-dot" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Sites & Locations</h3>
            ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadSites" data-id="${client.id}" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                    </button>
                    <button class="btn btn-sm btn-secondary" data-action="addSite" data-id="${client.id}" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Site
                    </button>
                </div>
                ` : ''}
        </div>
        ${(client.sites && client.sites.length > 0) ? `

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Site Name</th>
                                <th>Standards</th>
                                <th>Address</th>
                                <th>City</th>
                                <th>Employees</th>
                                <th>Shift</th>
                                <th>Geotag</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${client.sites.map((s, index) => `
                                <tr>
                                    <td style="font-weight: 500;">${window.UTILS.escapeHtml(s.name)}</td>
                                    <td><span style="font-size: 0.85rem; color: var(--primary-color); background: #eff6ff; padding: 2px 6px; border-radius: 4px;">${window.UTILS.escapeHtml(s.standards || 'Inherited')}</span></td>
                                    <td>${window.UTILS.escapeHtml(s.address || '-')}</td>
                                    <td>${window.UTILS.escapeHtml(s.city || '-')}, ${window.UTILS.escapeHtml(s.country || '')}</td>
                                    <td>
                                        ${s.employees ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;"><i class="fa-solid fa-users" style="margin-right: 4px;"></i>${s.employees}</span>` : '<span style="color: var(--text-secondary);">-</span>'}
                                    </td>
                                    <td>
                                        ${s.shift ? `<span style="background: ${s.shift === 'Yes' ? '#fef3c7' : '#f1f5f9'}; color: ${s.shift === 'Yes' ? '#d97706' : 'var(--text-secondary)'}; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${s.shift === 'Yes' ? 'Multi-Shift' : 'General'}</span>` : '<span style="color: var(--text-secondary);">-</span>'}
                                    </td>
                                    <td>
                                        ${s.geotag ? `<a href="https://maps.google.com/?q=${window.UTILS.escapeHtml(s.geotag)}" target="_blank" style="color: var(--primary-color); text-decoration: none;"><i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i>${window.UTILS.escapeHtml(s.geotag)}</a>` : '-'}
                                    </td>
                                    <td>
                                        ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                                        <div style="display: flex; gap: 0.25rem;">
                                            <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="editSite" data-arg1="${client.id}" data-arg2="${index}" aria-label="Edit">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteSite" data-arg1="${client.id}" data-arg2="${index}" aria-label="Delete">
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
                <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-building-circle-exclamation" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin: 0;">No sites or branch locations added yet.</p>
                    ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                    <button class="btn btn-sm btn-outline-primary" style="margin-top: 1rem;" data-action="addSite" data-id="${client.id}" aria-label="Add">
                        <i class="fa-solid fa-plus"></i> Add First Site
                    </button>
                    ` : ''}
                </div>
            `}
    </div>
`;
}


// eslint-disable-next-line no-unused-vars
function getClientProfileHTML(client) {
    const profile = client.profile || '';
    const lastUpdated = client.profileUpdated ? new Date(client.profileUpdated).toLocaleString() : 'Never';

    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-building" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Organization Group & Context</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">
                    <i class="fa-solid fa-clock"></i> Last updated: ${lastUpdated}
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                        <label class="btn btn-sm btn-outline-primary" style="cursor: pointer; margin: 0;">
                            <i class="fa-solid fa-file-pdf" style="margin-right: 0.25rem;"></i> Upload PDF
                            <input type="file" accept=".pdf,.doc,.docx,.txt" style="display: none;" data-action-change="uploadCompanyProfileDoc" data-id="${client.id}" data-file="true">
                        </label>
                        ${client.website ? `
                            <button class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" data-action="generateCompanyProfile" data-id="${client.id}">
                                <i class="fa-solid fa-sparkles" style="margin-right: 0.25rem;"></i> AI Generate
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" data-action="editCompanyProfile" data-id="${client.id}" aria-label="Edit">
                            <i class="fa-solid fa-pen" style="margin-right: 0.25rem;"></i> Edit Manually
                        </button>
                    ` : ''}
            </div>
        </div>
        
        <!--Uploaded Document Info-- >
    ${client.profileDocument ? `
            <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f0fdf4; border-radius: var(--radius-md); border: 1px solid #86efac; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <i class="fa-solid fa-file-pdf" style="color: #16a34a; margin-right: 0.5rem;"></i>
                    <span style="font-size: 0.9rem; color: #166534;"><strong>Source Document:</strong> ${window.UTILS.escapeHtml(client.profileDocument.name)}</span>
                    <span style="font-size: 0.8rem; color: #22c55e; margin-left: 0.5rem;">(Uploaded ${new Date(client.profileDocument.uploadedAt).toLocaleDateString()})</span>
                </div>
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm" style="color: #dc2626; background: none; border: none;" data-action="removeProfileDocument" data-id="${client.id}" title="Remove document" aria-label="Close">
                    <i class="fa-solid fa-times"></i>
                </button>
                ` : ''}
            </div>
        ` : ''
        }
            
            ${profile ? `
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); line-height: 1.8;">
                    <div style="white-space: pre-wrap; color: var(--text-primary);">${window.UTILS.escapeHtml(profile)}</div>
                </div>
            ` : `
                <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
                    <i class="fa-solid fa-file-lines" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No company profile generated yet.</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Upload a company profile PDF/manual, use AI generation from website, or write manually.
                    </p>
                    <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                        ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                            <label class="btn btn-primary btn-sm" style="cursor: pointer; margin: 0;">
                                <i class="fa-solid fa-upload"></i> Upload Document
                                <input type="file" accept=".pdf,.doc,.docx,.txt" style="display: none;" data-action-change="uploadCompanyProfileDoc" data-id="${client.id}" data-file="true">
                            </label>
                            ${client.website ? `
                                <button class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" data-action="generateCompanyProfile" data-id="${client.id}">
                                    <i class="fa-solid fa-sparkles"></i> AI Generate
                                </button>
                            ` : ''}
                            <button class="btn btn-outline-secondary btn-sm" data-action="editCompanyProfile" data-id="${client.id}" aria-label="Edit">
                                <i class="fa-solid fa-pen"></i> Write Manually
                            </button>
                        ` : ''}
                    </div>
                </div>
            `}

<div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: var(--radius-md); border: 1px solid #bae6fd;">
    <p style="font-size: 0.85rem; color: #0369a1; margin: 0;">
        <i class="fa-solid fa-info-circle"></i> <strong>Usage:</strong> This organization context and group summary will be used to define the audit scope and will be included in the "Organization Overview" section of audit reports.
    </p>
</div>
        </div >
    `;
}

// eslint-disable-next-line no-unused-vars
function getClientContactsHTML(client) {
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-address-book" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Contact Persons</h3>
            ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-secondary" data-action="addContactPerson" data-id="${client.id}" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadContacts" data-id="${client.id}" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                    </button>
                </div>
                ` : ''}
        </div>
            ${(client.contacts && client.contacts.length > 0) ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Designation</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${client.contacts.map((c, index) => `
                                <tr>
                                    <td style="font-weight: 500;">${window.UTILS.escapeHtml(c.name)}</td>
                                    <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(c.designation || '-')}</span></td>
                                    <td><i class="fa-solid fa-phone" style="color: var(--text-secondary); margin-right: 5px;"></i>${window.UTILS.escapeHtml(c.phone || '-')}</td>
                                    <td><a href="mailto:${window.UTILS.escapeHtml(c.email)}" style="color: var(--primary-color); text-decoration: none;">${window.UTILS.escapeHtml(c.email || '-')}</a></td>
                                    <td>
                                        ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="editContact" data-arg1="${client.id}" data-arg2="${index}" aria-label="Edit">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteContact" data-arg1="${client.id}" data-arg2="${index}" aria-label="Delete">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No contact persons added yet.</p>
            `}
        </div >
    `;
}

// eslint-disable-next-line no-unused-vars
function getClientDepartmentsHTML(client) {
    const departments = client.departments || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-sitemap" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Departments</h3>
            <div style="display: flex; gap: 0.5rem;">
                ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                    <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadDepartments" data-id="${client.id}" aria-label="Upload">
                        <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                    </button>
                    <button class="btn btn-sm btn-secondary" data-action="addDepartment" data-id="${client.id}" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Department
                    </button>
                    ` : ''}
            </div>
        </div>
            ${departments.length > 0 ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Department Name</th>
                                <th>Head of Department</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${departments.map((dept, index) => `
                                <tr>
                                    <td style="font-weight: 500;">${window.UTILS.escapeHtml(dept.name)}</td>
                                    <td>${window.UTILS.escapeHtml(dept.head || '-')}</td>
                                    <td>
                                        ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="editDepartment" data-arg1="${client.id}" data-arg2="${index}" aria-label="Edit">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteDepartment" data-arg1="${client.id}" data-arg2="${index}" aria-label="Delete">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
                    <i class="fa-solid fa-sitemap" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No departments added yet.</p>
                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                        ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                        <button class="btn btn-outline-primary btn-sm" data-action="addDepartment" data-id="${client.id}">Add Manually</button>
                        <button class="btn btn-outline-secondary btn-sm" data-action="bulkUploadDepartments" data-id="${client.id}">Bulk Upload</button>
                        ` : ''}
                    </div>
                </div>
            `}
        </div >
    `;
}

// getClientOrgSetupHTML (Wizard Version) moved to end of file to avoid duplication conflicts

// Goods/Services Step (AI-Populated)
// eslint-disable-next-line no-unused-vars
function getClientGoodsServicesHTML(client) {
    const items = client.goodsServices || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-boxes-stacked" style="margin-right: 0.5rem; color: #f59e0b;"></i>Goods & Services</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Products and services offered by the organization</p>
            </div>
            ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" data-action="addGoodsService" data-id="${client.id}" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadGoodsServices" data-id="${client.id}" aria-label="Upload">
                    <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                </button>
            </div>
            ` : ''}
        </div>
        ${items.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td style="font-weight: 500;">${window.UTILS.escapeHtml(item.name)}</td>
                                <td><span class="badge" style="background: #fef3c7; color: #d97706;">${window.UTILS.escapeHtml(item.category || 'General')}</span></td>
                                <td style="font-size: 0.9rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(item.description || '-')}</td>
                                <td>
                                    ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                                    <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="editGoodsService" data-arg1="${client.id}" data-arg2="${index}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteGoodsService" data-arg1="${client.id}" data-arg2="${index}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <div style="text-align: center; padding: 3rem; background: #fffbeb; border-radius: 8px; border: 2px dashed #fde68a;">
                <i class="fa-solid fa-boxes-stacked" style="font-size: 2.5rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                <p style="color: #92400e; margin-bottom: 1rem;">No goods or services defined yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Use <strong>AI Generate</strong> in Org Context step or add manually.</p>
            </div>
        `}
    </div >
    `;
}

// Key Processes Step (AI-Populated)
// eslint-disable-next-line no-unused-vars
function getClientKeyProcessesHTML(client) {
    const processes = client.keyProcesses || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-diagram-project" style="margin-right: 0.5rem; color: #06b6d4;"></i>Key Processes</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Core business processes for audit planning</p>
            </div>
            ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" data-action="addKeyProcess" data-id="${client.id}" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadKeyProcesses" data-id="${client.id}" aria-label="Upload">
                    <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                </button>
            </div>
            ` : ''}
        </div>
        ${processes.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Process Name</th>
                            <th>Category</th>
                            <th>Owner</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${processes.map((proc, index) => `
                            <tr>
                                <td style="font-weight: 500;">${window.UTILS.escapeHtml(proc.name)}</td>
                                <td><span class="badge" style="background: ${proc.category === 'Core' ? '#d1fae5' : '#e0f2fe'}; color: ${proc.category === 'Core' ? '#065f46' : '#0369a1'};">${window.UTILS.escapeHtml(proc.category || 'Support')}</span></td>
                                <td>${window.UTILS.escapeHtml(proc.owner || '-')}</td>
                                <td>
                                    ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                                    <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="editKeyProcess" data-arg1="${client.id}" data-arg2="${index}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteKeyProcess" data-arg1="${client.id}" data-arg2="${index}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <div style="text-align: center; padding: 3rem; background: #ecfeff; border-radius: 8px; border: 2px dashed #a5f3fc;">
                <i class="fa-solid fa-diagram-project" style="font-size: 2.5rem; color: #06b6d4; margin-bottom: 1rem;"></i>
                <p style="color: #155e75; margin-bottom: 1rem;">No key processes defined yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Use <strong>AI Generate</strong> in Org Context step or add manually.</p>
            </div>
        `}
    </div >
    `;
}

// Designations Step
// eslint-disable-next-line no-unused-vars
function getClientDesignationsHTML(client) {
    const designations = client.designations || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-id-badge" style="margin-right: 0.5rem; color: #84cc16;"></i>Designations</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Job titles and roles within the organization</p>
            </div>
            ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" data-action="addClientDesignation" data-id="${client.id}" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="bulkUploadDesignations" data-id="${client.id}" aria-label="Upload">
                    <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                </button>
            </div>
            ` : ''}
        </div>
        ${designations.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                ${designations.map((des, index) => `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 20px;">
                        <i class="fa-solid fa-user-tie" style="color: #16a34a;"></i>
                        <span style="font-weight: 500;">${window.UTILS.escapeHtml(des.title)}</span>
                        ${des.department ? `<span style="font-size: 0.8rem; color: var(--text-secondary);">(${window.UTILS.escapeHtml(des.department)})</span>` : ''}
                        ${(window.AuthManager && window.AuthManager.canPerform('edit', 'client')) ? `
                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color); padding: 0; margin-left: 0.25rem;" data-action="deleteClientDesignation" data-arg1="${client.id}" data-arg2="${index}" aria-label="Close"><i class="fa-solid fa-times"></i></button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : `
            <div style="text-align: center; padding: 3rem; background: #f0fdf4; border-radius: 8px; border: 2px dashed #bbf7d0;">
                <i class="fa-solid fa-id-badge" style="font-size: 2.5rem; color: #84cc16; margin-bottom: 1rem;"></i>
                <p style="color: #166534; margin-bottom: 1rem;">No designations defined yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Add common job titles like QA Manager, Production Head, etc.</p>
            </div>
        `}
    </div >
    `;
}

// Audit Team Step - Manage CB auditors assigned to this client
function getClientAuditTeamHTML(client) {
    const assignments = window.state.auditorAssignments || [];
    const auditors = window.state.auditors || [];
    const userRole = window.state.currentUser?.role;
    const canManage = userRole === 'Admin' || userRole === 'Certification Manager';

    // Get auditors assigned to this client
    const assignedAuditorIds = assignments
        .filter(a => String(a.clientId) === String(client.id))
        .map(a => String(a.auditorId));
    const assignedAuditors = auditors.filter(a => assignedAuditorIds.includes(String(a.id)));

    return `
    <div class="card" id="client-audit-team-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-user-shield" style="margin-right: 0.5rem; color: #0ea5e9;"></i>Audit Team</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">CB auditors assigned to audit this organization</p>
            </div>
            ${canManage ? `
            <button class="btn btn-primary" data-action="openClientAuditorAssignmentModal" data-arg1="${client.id}" data-arg2="${window.UTILS.escapeHtml(client.name)}" aria-label="Add user">
                <i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i> Assign Auditor
            </button>
            ` : ''}
        </div>
        
        <!-- Info Box -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 0.75rem; align-items: start;">
                <i class="fa-solid fa-info-circle" style="color: #2563eb; margin-top: 2px;"></i>
                <div style="font-size: 0.9rem; color: #1e40af;">
                    <strong>Auditor Access Control</strong><br>
                    Auditors assigned here can view this client's data, create audit plans, and submit reports.
                    ${!canManage ? '<br><em>Only Certification Managers and Admins can modify assignments.</em>' : ''}
                </div>
            </div>
        </div>

        ${assignedAuditors.length > 0 ? `
            <div style="display: grid; gap: 1rem;">
                ${assignedAuditors.map(auditor => {
        const assignment = assignments.find(a => String(a.clientId) === String(client.id) && String(a.auditorId) === String(auditor.id));
        return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: ${auditor.role === 'Lead Auditor' ? '#e0f2fe' : '#eef2ff'}; color: ${auditor.role === 'Lead Auditor' ? '#0284c7' : '#4f46e5'}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                                <i class="fa-solid fa-user-tie"></i>
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 1rem;">${window.UTILS.escapeHtml(auditor.name)}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                    <span class="badge" style="background: ${auditor.role === 'Lead Auditor' ? '#e0f2fe' : '#f1f5f9'}; color: ${auditor.role === 'Lead Auditor' ? '#0284c7' : '#64748b'}; padding: 2px 8px; border-radius: 4px;">${window.UTILS.escapeHtml(auditor.role || 'Auditor')}</span>
                                    ${auditor.email ? '<span style="margin-left: 0.5rem;">' + window.UTILS.escapeHtml(auditor.email) + '</span>' : ''}
                                </div>
                                ${assignment?.assignedAt ? '<div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">Assigned: ' + new Date(assignment.assignedAt).toLocaleDateString() + '</div>' : ''}
                            </div>
                        </div>
                        ${canManage ? `<button class="btn btn-sm btn-outline-danger" data-action="removeClientAuditorAssignment" data-arg1="${client.id}" data-arg2="${auditor.id}" title="Remove assignment" aria-label="Remove user"><i class="fa-solid fa-user-minus"></i> Remove</button>` : ''}
                    </div>
                    `;
    }).join('')}
            </div>
        ` : `
            <div style="text-align: center; padding: 3rem; background: #f0f9ff; border-radius: 8px; border: 2px dashed #bae6fd;">
                <i class="fa-solid fa-user-shield" style="font-size: 2.5rem; color: #0ea5e9; margin-bottom: 1rem;"></i>
                <p style="color: #0369a1; margin-bottom: 0.5rem;">No auditors assigned to this client yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${canManage ? 'Click "Assign Auditor" to add CB auditors who can access this client data.' : 'A Certification Manager must assign auditors to this client.'}
                </p >
            </div >
        `}
        
        ${assignedAuditors.length > 0 ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-check-circle" style="color: #16a34a;"></i>
                <span style="font-size: 0.9rem; color: #166534;"><strong>${assignedAuditors.length}</strong> auditor${assignedAuditors.length !== 1 ? 's' : ''} assigned</span>
            </div>
        </div>
        ` : ''}
    </div>
    `;
}

function getClientAuditsHTML(client) {
    // Get all audits for this client
    const clientPlans = (window.state.auditPlans || []).filter(p => p.client === client.name);
    const clientReports = (window.state.auditReports || []).filter(r => r.client === client.name);

    // Calculate totals
    let allNCRs = [];
    clientReports.forEach(r => {
        (r.ncrs || []).forEach(ncr => allNCRs.push({ ...ncr, auditDate: r.date, reportId: r.id }));
        (r.checklistProgress || []).filter(p => p.status === 'nc').forEach(ncr =>
            allNCRs.push({
                type: ncr.ncrType || 'observation',
                description: ncr.ncrDescription || ncr.comment,
                status: ncr.status || 'Open',
                designation: ncr.designation,
                department: ncr.department,
                evidenceImage: ncr.evidenceImage,
                auditDate: r.date,
                reportId: r.id
            })
        );
    });

    const openNCRs = allNCRs.filter(n => n.status === 'Open').length;
    const _closedNCRs = allNCRs.filter(n => n.status === 'Closed').length;
    const majorNCRs = allNCRs.filter(n => n.type === 'major').length;
    const minorNCRs = allNCRs.filter(n => n.type === 'minor').length;

    return `
    <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-bar" style="color: var(--primary-color); margin-right: 0.5rem;"></i>Audit Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem;">
                <div style="background: #eff6ff; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${clientPlans.length}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Total Audits</div>
                </div>
                <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${allNCRs.length}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Total Findings</div>
                </div>
                <div style="background: #fee2e2; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${majorNCRs}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Major NCs</div>
                </div>
                <div style="background: #fef9c3; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #ca8a04;">${minorNCRs}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Minor NCs</div>
                </div>
                <div style="background: ${openNCRs > 0 ? '#fee2e2' : '#dcfce7'}; padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${openNCRs > 0 ? '#dc2626' : '#16a34a'};">${openNCRs}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Open NCRs</div>
                </div>
            </div>
        </div >
        
        <!--Audit History Timeline-->
        <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-clock-rotate-left" style="color: var(--warning-color); margin-right: 0.5rem;"></i>Audit History</h3>
            ${clientPlans.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${clientPlans.map(plan => {
        const report = clientReports.find(r => r.planId === plan.id || r.date === plan.date);
        const ncrCount = report ? (report.ncrs || []).length : 0;
        return `
                            <div style="display: flex; align-items: center; padding: 1rem; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${plan.status === 'Completed' ? '#10b981' : '#3b82f6'};">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${plan.type || 'Audit'} - ${plan.standard || client.standard}</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">
                                        <i class="fa-solid fa-calendar"></i> ${plan.date} 
                                        <span style="margin-left: 1rem;"><i class="fa-solid fa-user"></i> ${plan.team ? plan.team[0] : 'TBD'}</span>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    ${ncrCount > 0 ? `<span style="background: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem;">${ncrCount} Findings</span>` : ''}
                                    <span class="badge" style="background: ${plan.status === 'Completed' ? '#10b981' : plan.status === 'Draft' ? '#94a3b8' : '#3b82f6'};">${plan.status}</span>
                                    ${report ? `<button class="btn btn-sm btn-outline-primary" data-action="openReportingDetail" data-id="${report.id}" aria-label="Document"><i class="fa-solid fa-file-lines"></i> View Report</button>` : ''}
                                </div>
                            </div>
                        `;
    }).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
                    <p style="margin: 0;">No audits conducted yet for this client.</p>
                </div>
            `}
        </div>
        
        <!--Findings History-- >
    <div class="card">
        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-triangle-exclamation" style="color: var(--danger-color); margin-right: 0.5rem;"></i>Findings History (All NCRs)</h3>
        ${allNCRs.length > 0 ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Dept/Person</th>
                                <th>Evidence</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allNCRs.map(ncr => `
                                <tr>
                                    <td style="white-space: nowrap;">${ncr.auditDate || '-'}</td>
                                    <td>
                                        <span class="badge" style="background: ${ncr.type === 'major' ? '#dc2626' : ncr.type === 'minor' ? '#d97706' : '#8b5cf6'}; font-size: 0.7rem;">
                                            ${(ncr.type || 'OBS').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style="max-width: 300px;">${ncr.description || ncr.ncrDescription || '-'}</td>
                                    <td style="font-size: 0.85rem;">
                                        ${ncr.designation ? `<div>${ncr.designation}</div>` : ''}
                                        ${ncr.department ? `<div style="color: #64748b;">${ncr.department}</div>` : ''}
                                        ${!ncr.designation && !ncr.department ? '-' : ''}
                                    </td>
                                    <td>
                                        ${ncr.evidenceImage ? `<a href="${ncr.evidenceImage}" target="_blank" style="color: var(--primary-color);"><i class="fa-solid fa-image"></i> View</a>` : '<span style="color: #cbd5e1;">None</span>'}
                                    </td>
                                    <td>
                                        <span class="badge" style="background: ${ncr.status === 'Closed' ? '#10b981' : '#ef4444'};">${ncr.status || 'Open'}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fa-solid fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; color: #10b981;"></i>
                    <p style="margin: 0;">No findings recorded for this client. Excellent compliance!</p>
                </div>
            `}
    </div>
`;
}

function getClientDocumentsHTML(client) {
    const docs = client.documents || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;">Client Documents</h3>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.82rem; color: var(--text-secondary);">System manuals, procedures, and documents provided by the client for audit preparation</p>
            </div>
            ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-primary btn-sm" data-action="openClientDocumentModal" data-id="${client.id}" aria-label="Upload to cloud">
                    <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.5rem;"></i> Add Document
                </button>
                ` : ''}
        </div>
            
            ${docs.length > 0 ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Document Name</th>
                                <th>Category</th>
                                <th>Revision</th>
                                <th>Linked Clause(s)</th>
                                <th>Date</th>
                                <th style="width: 80px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${docs.map(doc => `
                                <tr>
                                    <td>
                                        <i class="fa-solid fa-file-${doc.type === 'PDF' ? 'pdf' : doc.category === 'System Manual' ? 'book' : doc.category === 'Process Map' ? 'diagram-project' : 'lines'}" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>
                                        ${window.UTILS.escapeHtml(doc.name)}
                                    </td>
                                    <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${window.UTILS.escapeHtml(doc.category || 'General')}</span></td>
                                    <td style="font-family: monospace; font-size: 0.85rem;">${window.UTILS.escapeHtml(doc.revision || '-')}</td>
                                    <td style="font-size: 0.85rem;">${doc.linkedClauses ? '<span style="background:#eff6ff;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:0.78rem;">' + window.UTILS.escapeHtml(doc.linkedClauses) + '</span>' : '<span style="color:#94a3b8;">—</span>'}</td>
                                    <td>${window.UTILS.escapeHtml(doc.date)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" data-action="viewDocumentNotes" data-arg1="${client.id}" data-arg2="${window.UTILS.escapeHtml(doc.id)}" title="View Notes" aria-label="View"><i class="fa-solid fa-eye"></i></button>
                                        ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" data-action="deleteDocument" data-arg1="${client.id}" data-arg2="${window.UTILS.escapeHtml(doc.id)}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
                                        ` : ''}
                                    </td>
                                </tr>
                                ${doc.notes ? `<tr><td colspan="6" style="padding: 4px 12px 10px 36px; font-size: 0.82rem; color: #475569; background: #fafafa; border-bottom: 1px solid #f1f5f9;"><i class="fa-solid fa-sticky-note" style="color:#f59e0b;margin-right:6px;font-size:0.7rem;"></i>${window.UTILS.escapeHtml(doc.notes).substring(0, 200)}${doc.notes.length > 200 ? '...' : ''}</td></tr>` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">No documents uploaded for this client yet.</p>
                    <p style="color: #94a3b8; font-size: 0.82rem; margin-bottom: 1rem;">Upload system manuals, procedures, org charts and other documents to help prepare custom checklists.</p>
                    ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                    <button class="btn btn-outline-primary btn-sm" data-action="openClientDocumentModal" data-id="${client.id}">Add First Document</button>
                    ` : ''}
                </div>
            `}
        </div >
    `;
}

function getClientComplianceHTML(client) {
    // ISO 17021-1 Client Compliance Tab
    const compliance = client.compliance || {};
    const appStatus = compliance.applicationStatus || 'Active';
    const contract = compliance.contract || {};
    const nda = compliance.nda || {};
    const changesLog = compliance.changesLog || [];

    const statusColors = {
        'Inquiry': '#3b82f6',
        'Application Received': '#8b5cf6',
        'Under Review': '#f59e0b',
        'Contract Sent': '#06b6d4',
        'Contract Signed': '#10b981',
        'Active': '#16a34a'
    };

    return `
    <div class="card" style="margin-bottom: 1rem; border-left: 4px solid ${statusColors[appStatus] || '#6b7280'};">
            <h3 style="margin: 0 0 1rem 0;">
                <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                Application Status
            </h3>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                ${['Inquiry', 'Application Received', 'Under Review', 'Contract Sent', 'Contract Signed', 'Active'].map(s => `
                    <span style="padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; 
                        ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? 'cursor: pointer;' : ''}
                        background: ${appStatus === s ? statusColors[s] : '#f1f5f9'}; 
                        color: ${appStatus === s ? 'white' : '#64748b'};"
                        ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `data-action="updateClientApplicationStatus" data-arg1="${client.id}" data-arg2="${s}"` : ''}>
                        ${s}
                    </span>
                `).join('')}
            </div>
        </div >
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <!-- Contract Card -->
            <div class="card" style="margin: 0; border-left: 4px solid ${contract.signed ? '#10b981' : '#f59e0b'};">
                <h4 style="margin: 0 0 1rem 0;">
                    <i class="fa-solid fa-file-contract" style="margin-right: 0.5rem; color: ${contract.signed ? '#10b981' : '#f59e0b'};"></i>
                    Certification Contract
                </h4>
                ${contract.signed ? `
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                        <p style="margin: 0 0 0.5rem 0;"><strong>Contract #:</strong> ${contract.number || 'N/A'}</p>
                        <p style="margin: 0 0 0.5rem 0;"><strong>Signed Date:</strong> ${contract.signedDate || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Valid Until:</strong> ${contract.validUntil || 'N/A'}</p>
                    </div>
                ` : `
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                        <p style="margin: 0; color: #92400e;">
                            <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                            No contract on file
                        </p>
                    </div>
                `}
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm btn-secondary" data-action="editClientContract" data-id="${client.id}" aria-label="Edit">
                    <i class="fa-solid fa-edit" style="margin-right: 0.25rem;"></i>${contract.signed ? 'Update Contract' : 'Add Contract Details'}
                </button>
                ` : ''}
            </div>
            
            <!-- NDA Card -->
            <div class="card" style="margin: 0; border-left: 4px solid ${nda.signed ? '#10b981' : '#dc2626'};">
                <h4 style="margin: 0 0 1rem 0;">
                    <i class="fa-solid fa-user-lock" style="margin-right: 0.5rem; color: ${nda.signed ? '#10b981' : '#dc2626'};"></i>
                    Confidentiality Agreement (NDA)
                </h4>
                ${nda.signed ? `
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                        <p style="margin: 0 0 0.5rem 0;"><strong>Signed Date:</strong> ${nda.signedDate || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Signed By:</strong> ${nda.signedBy || 'N/A'}</p>
                    </div>
                ` : `
                    <div style="background: #fee2e2; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                        <p style="margin: 0; color: #991b1b;">
                            <i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem;"></i>
                            NDA not signed - Required per ISO 17021-1
                        </p>
                    </div>
                `}
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm btn-secondary" data-action="editClientNDA" data-id="${client.id}" aria-label="Edit">
                    <i class="fa-solid fa-edit" style="margin-right: 0.25rem;"></i>${nda.signed ? 'Update NDA' : 'Record NDA Signature'}
                </button>
                ` : ''}
            </div>
        </div>
        
        <!--Client Changes Log-- >
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">
                    <i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                    Client Changes Log (ISO 9.6)
                </h4>
                ${(window.AuthManager && window.AuthManager.canPerform('create', 'client')) ? `
                <button class="btn btn-sm btn-secondary" data-action="addClientChangeLog" data-id="${client.id}" aria-label="Add">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Log Change
                </button>
                ` : ''}
            </div>
            <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                Track significant changes to client's organization, processes, or scope (ISO 17021-1 Clause 9.6.2)
            </p>
            ${changesLog.length > 0 ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Change Type</th>
                                <th>Description</th>
                                <th>Reported By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${changesLog.map(log => `
                                <tr>
                                    <td>${log.date}</td>
                                    <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${log.type}</span></td>
                                    <td>${log.description}</td>
                                    <td>${log.reportedBy}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                    <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="color: #64748b; margin: 0;">No changes logged. Client stable.</p>
                </div>
            `}
        </div>
        
        <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
            <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                <strong>ISO 17021-1:</strong> Maintain records of contracts/agreements (Cl. 9.2), confidentiality arrangements (Cl. 5.6), and significant changes notified by clients (Cl. 9.6.2).
            </p>
        </div>
`;
}

function renderClientTab(client, tabName) {
    const tabContent = document.getElementById('tab-content');

    // Safety check - if tab-content doesn't exist, the client workspace hasn't been rendered yet
    if (!tabContent) {
        // Fallback for direct settings render from workspace
        const contentArea = document.getElementById('content-area');
        if (tabName === 'settings' && contentArea) {
            contentArea.innerHTML = window.getClientSettingsHTML(client);
            return;
        }
        console.warn('tab-content element not found. Client workspace may not be rendered.');
        return;
    }

    if (tabName === 'info') {
        tabContent.innerHTML = getClientInfoHTML(client);
    } else if (tabName === 'client_org') {
        tabContent.innerHTML = window.getClientOrgSetupHTML(client);
    } else if (tabName === 'audit_team') {
        tabContent.innerHTML = getClientAuditTeamHTML(client);
    } else if (tabName === 'scopes') {
        tabContent.innerHTML = window.getClientCertificatesHTML(client);
    } else if (tabName === 'audits') {
        tabContent.innerHTML = getClientAuditsHTML(client);
    } else if (tabName === 'documents') {
        tabContent.innerHTML = getClientDocumentsHTML(client);
    } else if (tabName === 'compliance') {
        tabContent.innerHTML = getClientComplianceHTML(client);
    } else if (tabName === 'settings') {
        tabContent.innerHTML = window.getClientSettingsHTML(client);
    }
}

window.handleLogoUpload = function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // IMMEDIATE FEEDBACK: Show notification that file was accepted
        if (window.showNotification) {
            window.showNotification(`File "${file.name}" selected for upload`, 'info');
        }

        window._tempLogoFile = file;

        const reader = new FileReader();
        reader.onload = function (e) {
            window._tempClientLogo = e.target.result;

            // Robust element finding: Try ID first, then relative search if ID fails or finds wrong element
            let previewImg = document.getElementById('client-logo-preview-img');
            let placeholder = document.getElementById('client-logo-placeholder');

            // If the triggered input is inside a naming card, find elements relative to it
            const parentCard = input.closest('.card');
            if (parentCard) {
                previewImg = parentCard.querySelector('#client-logo-preview-img') || previewImg;
                placeholder = parentCard.querySelector('#client-logo-placeholder') || placeholder;
            }


            if (previewImg && placeholder) {
                previewImg.style.backgroundImage = `url(${e.target.result})`;
                previewImg.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                console.error('[handleLogoUpload] UI Elements missing from DOM. Check your template.');
                alert('Thumbnail preview failed: UI elements not found.');
            }
        };
        reader.onerror = function (err) {
            console.error('[handleLogoUpload] FileReader error:', err);
            alert('Failed to read image file.');
        };
        reader.readAsDataURL(file);
    } else {
        console.warn('[handleLogoUpload] No files selected');
    }
};

window.renderAddClient = function () {
    if (window.Logger) Logger.debug('Clients', 'renderAddClient called');

    const standardsToShow = (window.state.cbSettings && window.state.cbSettings.standardsOffered && window.state.cbSettings.standardsOffered.length > 0)
        ? window.state.cbSettings.standardsOffered
        : ((window.state.cbSettings && window.state.cbSettings.availableStandards && window.state.cbSettings.availableStandards.length > 0)
            ? window.state.cbSettings.availableStandards
            : ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"]);

    const html = `
    <div class="fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 4rem;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
            <div>
                <button class="btn btn-link" data-action="renderClientsEnhanced" style="color: var(--text-secondary); padding: 0; margin-bottom: 0.5rem; text-decoration: none;" aria-label="Back">
                    <i class="fa-solid fa-arrow-left"></i> Back to Clients
                </button>
                <h1 style="font-size: 1.75rem; font-weight: 700; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">
                    New Client Onboarding
                </h1>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-secondary" data-action="renderClientsEnhanced">Cancel</button>
                <button class="btn btn-primary" data-action="saveNewClient" style="padding: 0.6rem 1.5rem; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);" aria-label="Confirm">
                    <i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Create Client
                </button>
            </div>
        </div>

        <form id="client-form" style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            
            <!-- Left Column -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Company Profile Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="background: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                        <div style="width: 32px; height: 32px; background: #eff6ff; color: #3b82f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem;">
                            <i class="fa-solid fa-building"></i>
                        </div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Company Profile</h3>
                    </div>
                    <div style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem;">Company Name <span class="text-danger">*</span></label>
                            <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-id-card input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-name" placeholder="e.g. Acme Corp Global" required style="padding-left: 2.5rem;">
                            </div>
                        </div>

                        <!-- Logo Upload Section Removed (Duplicated in Right Column) -->

                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Industry Sector</label>
                            <select class="form-control" id="client-industry" style="background-image: none;" data-action-change="handleIndustryChange" data-id="this">
                                <option value="">Select Industry...</option>
                                ${['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'].map(i => `<option>${i}</option>`).join('')}
                                <option value="Other">Other (Please Specify)</option>
                            </select>
                            <div id="industry-other-container" style="display: none; margin-top: 0.75rem;">
                                <input type="text" class="form-control" id="client-industry-custom" placeholder="Enter custom sector...">
                            </div>
                        </div>
                        
                        <div class="form-group">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Website</label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-globe input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="url" class="form-control" id="client-website" placeholder="https://..." style="padding-left: 2.5rem;">
                             </div>
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1; margin-top: 0.5rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.75rem;">Applicable Standards <span class="text-danger">*</span></label>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                ${standardsToShow.map((std, _i) => `
                                    <label class="standard-checkbox-btn" style="cursor: pointer;">
                                        <input type="checkbox" name="client_standards" value="${std}" style="display: none;" data-action-change="toggleCheckboxStyle">
                                        <span style="display: inline-block; padding: 0.4rem 0.8rem; background: #fff; border: 1px solid #cbd5e1; border-radius: 20px; font-size: 0.85rem; color: #64748b; transition: all 0.2s;">
                                            ${std}
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Location Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                     <div style="background: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                        <div style="width: 32px; height: 32px; background: #fae8ff; color: #a21caf; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem;">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Head Office Location</h3>
                    </div>
                    <div style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                         <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Street Address</label>
                            <input type="text" class="form-control" id="client-address" placeholder="123 Business Blvd, Suite 100">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input type="text" class="form-control" id="client-city" placeholder="Metropolis">
                        </div>
                         <div class="form-group">
                            <label>Country</label>
                            <input type="text" class="form-control" id="client-country" placeholder="Country">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="display: flex; justify-content: space-between;">
                                <span>Geotag (Lat, Long)</span>
                                <a href="#" data-action="getGeolocation" data-id="client-geotag" style="font-size: 0.8rem; color: var(--primary-color);">
                                    <i class="fa-solid fa-location-crosshairs"></i> Detect My Location
                                </a>
                             </label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-map-pin input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-geotag" placeholder="37.7749, -122.4194" style="padding-left: 2.5rem;">
                             </div>
                        </div>
                    </div>
                </div>

            </div>
            
            <!-- Right Column -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">

                 <!-- Branding Card -->
                 <div class="card" style="padding: 1.5rem; text-align: center; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 1rem auto; border-radius: 50%; border: 3px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
                         <div id="client-logo-preview-img" style="display: none; width: 100%; height: 100%; background-size: cover; background-position: center;"></div>
                         <i id="client-logo-placeholder" class="fa-solid fa-image" style="font-size: 2.5rem; color: #cbd5e1;"></i>
                    </div>
                    <div>
                         <label for="client-logo-upload" class="btn btn-outline-primary btn-sm" style="cursor: pointer;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Logo
                         </label>
                         <input type="file" id="client-logo-upload" accept="image/*" style="display: none;" data-action-change="handleLogoUpload" data-id="this">
                         <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem;">PNG, JPG up to 1MB</p>
                    </div>
                 </div>

                <!-- Contact Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="background: #f8fafc; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">Primary Contact</h4>
                    </div>
                    <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Full Name <span class="text-danger">*</span></label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-user input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-contact-name" style="padding-left: 2.5rem;" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Designation</label>
                            <input type="text" class="form-control" id="client-contact-designation" placeholder="e.g. Quality Manager">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Phone</label>
                            <input type="tel" class="form-control" id="client-contact-phone">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Email</label>
                            <input type="email" class="form-control" id="client-contact-email">
                        </div>
                    </div>
                </div>

                <!-- Operating Metrics Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                     <div style="background: #f8fafc; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">Operations & Planning</h4>
                    </div>
                    <div style="padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                             <label style="font-size: 0.8rem;">Employees <span class="text-danger">*</span></label>
                             <input type="number" class="form-control" id="client-employees" value="10" min="1">
                        </div>
                         <div class="form-group">
                             <label style="font-size: 0.8rem;">Sites <span class="text-danger">*</span></label>
                             <input type="number" class="form-control" id="client-sites" value="1" min="1">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="font-size: 0.8rem;">Shift System</label>
                             <select class="form-control" id="client-shifts">
                                <option value="No">No (Single Shift)</option>
                                <option value="Yes">Yes (Multiple Shifts)</option>
                             </select>
                        </div>

                    </div>
                </div>

            </div>
        </form>
    </div>
    `;

    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = html;
    }
};

window.saveNewClient = async function () {
    // 1. Define Fields
    const fieldIds = {
        name: 'client-name',
        industry: 'client-industry',
        website: 'client-website',
        contactName: 'client-contact-name',
        contactDesignation: 'client-contact-designation',
        contactPhone: 'client-contact-phone',
        contactEmail: 'client-contact-email',
        address: 'client-address',
        city: 'client-city',
        country: 'client-country',
        geotag: 'client-geotag',
        employees: 'client-employees',
        siteCount: 'client-sites'
    };

    // 2. Define Rules
    const rules = {
        name: [
            { rule: 'required', fieldName: 'Company Name' },
            { rule: 'length', min: 2, max: 200 },
            { rule: 'noHtmlTags' }
        ],
        contactName: [
            { rule: 'required', fieldName: 'Contact Name' },
            { rule: 'length', min: 2, max: 100 },
            { rule: 'noHtmlTags' }
        ],
        employees: [
            { rule: 'number', fieldName: 'Total Employees' },
            { rule: 'range', min: 1, max: 1000000, fieldName: 'Total Employees' }
        ],
        siteCount: [
            { rule: 'number', fieldName: 'Number of Sites' },
            { rule: 'range', min: 1, max: 1000, fieldName: 'Number of Sites' }
        ]
    };

    // 3. Validate
    // Check standards (checkboxes now)
    const checkedStandards = Array.from(document.querySelectorAll('input[name="client_standards"]:checked')).map(cb => cb.value);

    if (checkedStandards.length === 0) {
        window.showNotification('Please select at least one standard', 'error');
        return;
    }

    const websiteValue = document.getElementById('client-website')?.value?.trim();
    const emailValue = document.getElementById('client-contact-email')?.value?.trim();

    if (websiteValue) {
        rules.website = [{ rule: 'url', fieldName: 'Website' }];
    }
    if (emailValue) {
        rules.contactEmail = [{ rule: 'email', fieldName: 'Contact Email' }];
    }

    const result = Validator.validateFormElements(fieldIds, rules);
    if (!result.valid) {
        Validator.displayErrors(result.errors, fieldIds);
        window.showNotification('Please fix the form errors', 'error');
        return;
    }
    Validator.clearErrors(fieldIds);

    // 4. Sanitize
    const cleanData = Sanitizer.sanitizeFormData(result.formData,
        ['name', 'contactName', 'contactDesignation', 'contactPhone',
            'address', 'city', 'country', 'geotag']
    );

    // 5. Construct Object
    const standard = checkedStandards.join(', ');

    const contacts = [];
    if (cleanData.contactName) {
        contacts.push({
            name: cleanData.contactName,
            designation: cleanData.contactDesignation,
            phone: cleanData.contactPhone,
            email: cleanData.contactEmail
        });
    }

    const sites = [{
        name: 'Head Office',
        address: cleanData.address,
        city: cleanData.city,
        country: cleanData.country,
        geotag: cleanData.geotag,
        standards: standard
    }];

    const newClient = {
        id: crypto.randomUUID(),
        name: cleanData.name,
        standard: standard,
        nextAudit: '', // Removed as per request
        industry: document.getElementById('client-industry').value === 'Other' ?
            document.getElementById('client-industry-custom').value :
            document.getElementById('client-industry').value,
        status: 'Active',
        website: Sanitizer.sanitizeURL(cleanData.website),
        contacts: contacts,
        sites: sites,
        employees: parseInt(cleanData.employees, 10) || 0,
        shifts: document.getElementById('client-shifts') ? document.getElementById('client-shifts').value : 'No',
        logoUrl: window._tempClientLogo || ''
    };

    // Handle Logo Upload via Storage
    if (window._tempLogoFile && window.SupabaseClient && window.SupabaseClient.isInitialized) {
        try {
            window.showNotification('Uploading logo...', 'info');
            const uploadResult = await window.SupabaseClient.storage.uploadClientLogo(window._tempLogoFile, newClient.id);
            if (uploadResult && uploadResult.url) {
                newClient.logoUrl = uploadResult.url;
                Logger.info('Logo uploaded via Storage:', newClient.logoUrl);
                // Clear temp data after successful upload
                window._tempLogoFile = null;
                window._tempClientLogo = null;
            } else {
                console.warn('[saveNewClient] Logo upload returned no URL. falling back to state.');
            }
        } catch (e) {
            console.error('Logo upload failed during client creation:', e);
            window.showNotification('Logo upload failed, but client saved locally.', 'warning');
        }
    }

    // 6. Save
    window.state.clients.push(newClient);
    window.saveData();

    // Sync to Supabase
    if (window.SupabaseClient?.isInitialized) {
        window.SupabaseClient.upsertClient(newClient)
            .then(() => {
                window.showNotification('Client created and synced to cloud!', 'success');
            })
            .catch(err => {
                console.error('Supabase sync failed:', err);
                alert('Cloud Sync Failed: ' + (err.message || JSON.stringify(err)));
                window.showNotification('Saved locally, but Cloud Sync Failed: ' + err.message, 'error');
            });
    } else {
        window.showNotification('Client created locally (Cloud offline)', 'warning');
    }

    // Redirect to Client Workspace Settings
    renderClientDetail(newClient.id);
    setTimeout(() => {
        document.querySelector('.tab-btn[data-tab="client_org"]')?.click();
    }, 500);

    // Clear temp
    window._tempLogoFile = null;
    window._tempClientLogo = null;
};



// Note: handleClientLogoUpload defined later (~L5223) with direct save + Supabase sync

window.renderEditClient = function (clientId) {
    // Use loose equality to handle string/number ID mismatch
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) {
        window.showNotification('Client not found', 'error');
        renderClientsEnhanced();
        return;
    }

    // Alias for consistent routing if not already defined (or ensure it points here)
    window.renderClientForm = window.renderEditClient;

    const firstSite = client.sites && client.sites[0] ? client.sites[0] : {};
    const firstContact = client.contacts && client.contacts[0] ? client.contacts[0] : {};
    const standards = (client.standard || '').split(',').map(s => s.trim());

    // Temporarily store original logo URL for comparison/fallback
    window._originalClientLogo = client.logoUrl;
    window._tempClientLogo = null; // Reset temp

    const standardsToShow = (window.state.cbSettings && window.state.cbSettings.standardsOffered && window.state.cbSettings.standardsOffered.length > 0)
        ? window.state.cbSettings.standardsOffered
        : ((window.state.cbSettings && window.state.cbSettings.availableStandards && window.state.cbSettings.availableStandards.length > 0)
            ? window.state.cbSettings.availableStandards
            : ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"]);

    const html = `
    <div class="fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 4rem;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
            <div>
                <button class="btn btn-link" data-action="renderClientsEnhanced" style="color: var(--text-secondary); padding: 0; margin-bottom: 0.5rem; text-decoration: none;" aria-label="Back">
                    <i class="fa-solid fa-arrow-left"></i> Back to Clients
                </button>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <h1 style="font-size: 1.75rem; font-weight: 700; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">
                        Edit Client: ${client.name}
                    </h1>
                     <span class="status-badge status-${(client.status || 'Active').toLowerCase()}" style="font-size: 0.8em; vertical-align: middle;">${client.status}</span>
                </div>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-secondary" data-action="renderClientsEnhanced">Cancel</button>
                <button class="btn btn-primary" data-action="saveAuditClient" data-id="${client.id}" style="padding: 0.6rem 1.5rem; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);" aria-label="Save">
                    <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Changes
                </button>
            </div>
        </div>

        <form id="client-form" style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            
            <!-- Left Column -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Company Profile Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="background: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                        <div style="width: 32px; height: 32px; background: #eff6ff; color: #3b82f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem;">
                            <i class="fa-solid fa-building"></i>
                        </div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Company Profile</h3>
                    </div>
                    <div style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem;">Company Name <span class="text-danger">*</span></label>
                            <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-id-card input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-name" value="${client.name}" required style="padding-left: 2.5rem;">
                            </div>
                        </div>

                        <div class="form-group">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Industry Sector</label>
                            <select class="form-control" id="client-industry" style="background-image: none;" data-action-change="handleIndustryChange" data-id="this">
                                <option value="">Select Industry...</option>
                                ${['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'].map(i => `<option ${client.industry === i ? 'selected' : ''}>${i}</option>`).join('')}
                                <option value="Other" ${!['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education', ''].includes(client.industry) ? 'selected' : ''}>Other (Please Specify)</option>
                            </select>
                            <div id="industry-other-container" style="display: ${!['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education', ''].includes(client.industry) ? 'block' : 'none'}; margin-top: 0.75rem;">
                                <input type="text" class="form-control" id="client-industry-custom" value="${!['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education', ''].includes(client.industry) ? client.industry : ''}" placeholder="Enter custom sector...">
                            </div>
                        </div>
                        
                         <div class="form-group">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Website</label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-globe input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="url" class="form-control" id="client-website" value="${client.website || ''}" placeholder="https://..." style="padding-left: 2.5rem;">
                             </div>
                        </div>

                        <div class="form-group">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Status</label>
                             <select class="form-control" id="client-status">
                                <option value="Active" ${client.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="Suspended" ${client.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                                <option value="Withdrawn" ${client.status === 'Withdrawn' ? 'selected' : ''}>Withdrawn</option>
                             </select>
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1; margin-top: 0.5rem;">
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.75rem;">Applicable Standards <span class="text-danger">*</span></label>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                ${standardsToShow.map((std) => {
        const isChecked = standards.includes(std);
        return `
                                    <label class="standard-checkbox-btn ${isChecked ? 'active' : ''}" style="cursor: pointer;">
                                        <input type="checkbox" name="client_standards" value="${std}" ${isChecked ? 'checked' : ''} style="display: none;" data-action-change="toggleCheckboxStyle">
                                        <span style="display: inline-block; padding: 0.4rem 0.8rem; background: ${isChecked ? '#eff6ff' : '#fff'}; border: 1px solid ${isChecked ? '#3b82f6' : '#cbd5e1'}; color: ${isChecked ? '#2563eb' : '#64748b'}; border-radius: 20px; font-size: 0.85rem; transition: all 0.2s;">
                                            ${std}
                                        </span>
                                    </label>
                                `}).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Location Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                     <div style="background: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                        <div style="width: 32px; height: 32px; background: #fae8ff; color: #a21caf; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem;">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Head Office Location</h3>
                    </div>
                    <div style="padding: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                         <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Street Address</label>
                            <input type="text" class="form-control" id="client-address" value="${firstSite.address || ''}" placeholder="123 Business Blvd, Suite 100">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input type="text" class="form-control" id="client-city" value="${firstSite.city || ''}" placeholder="Metropolis">
                        </div>
                         <div class="form-group">
                            <label>Country</label>
                            <input type="text" class="form-control" id="client-country" value="${firstSite.country || ''}" placeholder="Country">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="display: flex; justify-content: space-between;">
                                <span>Geotag (Lat, Long)</span>
                                <a href="#" data-action="getGeolocation" data-id="client-geotag" style="font-size: 0.8rem; color: var(--primary-color);">
                                    <i class="fa-solid fa-location-crosshairs"></i> Detect My Location
                                </a>
                             </label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-map-pin input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-geotag" value="${firstSite.geotag || ''}" placeholder="37.7749, -122.4194" style="padding-left: 2.5rem;">
                             </div>
                        </div>
                    </div>
                </div>

            </div>
            
            <!-- Right Column -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">

                 <!-- Branding Card -->
                 <div class="card" style="padding: 1.5rem; text-align: center; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 1rem auto; border-radius: 50%; border: 3px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
                         <div id="client-logo-preview-img" style="display: ${client.logoUrl ? 'block' : 'none'}; width: 100%; height: 100%; background-size: cover; background-position: center; background-image: ${client.logoUrl ? `url(${client.logoUrl})` : 'none'}"></div>
                         <i id="client-logo-placeholder" class="fa-solid fa-image" style="display: ${client.logoUrl ? 'none' : 'block'}; font-size: 2.5rem; color: #cbd5e1;"></i>
                    </div>
                    <div>
                         <label for="client-logo-upload" class="btn btn-outline-primary btn-sm" style="cursor: pointer;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Change Logo
                         </label>
                         <input type="file" id="client-logo-upload" accept="image/*" style="display: none;" data-action-change="handleClientLogoUpload" data-arg1="this" data-arg2="${client.id}">
                         <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem;">PNG, JPG up to 1MB</p>
                    </div>
                 </div>

                <!-- Contact Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                    <div style="background: #f8fafc; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">Primary Contact</h4>
                    </div>
                    <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Full Name <span class="text-danger">*</span></label>
                             <div class="input-with-icon" style="position: relative;">
                                <i class="fa-solid fa-user input-icon" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                                <input type="text" class="form-control" id="client-contact-name" value="${firstContact.name || ''}" style="padding-left: 2.5rem;" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Designation</label>
                            <input type="text" class="form-control" id="client-contact-designation" value="${firstContact.designation || ''}" placeholder="e.g. Quality Manager">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Phone</label>
                            <input type="tel" class="form-control" id="client-contact-phone" value="${firstContact.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem;">Email</label>
                            <input type="email" class="form-control" id="client-contact-email" value="${firstContact.email || ''}">
                        </div>
                    </div>
                </div>

                <!-- Operating Metrics Card -->
                <div class="card" style="padding: 0; overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.8);">
                     <div style="background: #f8fafc; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">Operations & Planning</h4>
                    </div>
                    <div style="padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                             <label style="font-size: 0.8rem;">Employees <span class="text-danger">*</span></label>
                             <input type="number" class="form-control" id="client-employees" value="${client.employees || 0}" min="1">
                        </div>
                         <div class="form-group">
                             <label style="font-size: 0.8rem;">Sites <span class="text-danger">*</span></label>
                             <input type="number" class="form-control" id="client-sites" value="${client.sites ? client.sites.length : 1}" min="1" disabled style="background: #f1f5f9; cursor: not-allowed;" title="Manage sites from details page">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="font-size: 0.8rem;">Shift System</label>
                             <select class="form-control" id="client-shifts">
                                <option value="No" ${client.shifts === 'No' ? 'selected' : ''}>No (Single Shift)</option>
                                <option value="Yes" ${client.shifts === 'Yes' ? 'selected' : ''}>Yes (Multiple Shifts)</option>
                             </select>
                        </div>

                    </div>
                </div>

            </div>
        </form>
    </div>
    `;

    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = html;
    }
};

window.saveAuditClient = async function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // 1. Define Fields
    const fieldIds = {
        name: 'client-name',
        industry: 'client-industry',
        website: 'client-website',
        contactName: 'client-contact-name',
        contactDesignation: 'client-contact-designation',
        contactPhone: 'client-contact-phone',
        contactEmail: 'client-contact-email',
        address: 'client-address',
        city: 'client-city',
        country: 'client-country',
        geotag: 'client-geotag',
        employees: 'client-employees',
        nextAudit: 'client-next-audit',
        status: 'client-status'
    };

    // 2. Define Rules
    const rules = {
        name: [
            { rule: 'required', fieldName: 'Company Name' },
            { rule: 'length', min: 2, max: 200 },
            { rule: 'noHtmlTags' }
        ],
        contactName: [
            { rule: 'required', fieldName: 'Contact Name' },
            { rule: 'length', min: 2, max: 100 },
            { rule: 'noHtmlTags' }
        ],
        employees: [
            { rule: 'number', fieldName: 'Total Employees' },
            { rule: 'range', min: 1, max: 1000000, fieldName: 'Total Employees' }
        ]
    };

    // 3. Validate
    const checkedStandards = Array.from(document.querySelectorAll('input[name="client_standards"]:checked')).map(cb => cb.value);

    // We allow explicit empty standard for updates if user desires, but warn if empty? 
    // Usually standard is required. Let's enforce it.
    if (checkedStandards.length === 0) {
        window.showNotification('Please select at least one standard', 'error');
        return;
    }

    const websiteValue = document.getElementById('client-website')?.value?.trim();
    const emailValue = document.getElementById('client-contact-email')?.value?.trim();

    if (websiteValue) {
        rules.website = [{ rule: 'url', fieldName: 'Website' }];
    }
    if (emailValue) {
        rules.contactEmail = [{ rule: 'email', fieldName: 'Contact Email' }];
    }

    const result = Validator.validateFormElements(fieldIds, rules);
    if (!result.valid) {
        Validator.displayErrors(result.errors, fieldIds);
        window.showNotification('Please fix the form errors', 'error');
        return;
    }
    Validator.clearErrors(fieldIds);

    // 4. Sanitize
    const cleanData = Sanitizer.sanitizeFormData(result.formData,
        ['name', 'contactName', 'contactDesignation', 'contactPhone',
            'address', 'city', 'country', 'geotag', 'website']
    );

    // 5. Update Record
    // Update basic info
    client.name = cleanData.name;
    client.standard = checkedStandards.join(', ');
    client.industry = document.getElementById('client-industry').value === 'Other' ?
        document.getElementById('client-industry-custom').value :
        document.getElementById('client-industry').value;
    client.status = document.getElementById('client-status').value;
    // Direct read to avoid sanitizer issues for now
    client.website = document.getElementById('client-website').value.trim();
    client.employees = parseInt(cleanData.employees, 10) || 0;
    client.shifts = document.getElementById('client-shifts').value;
    client.nextAudit = cleanData.nextAudit;

    // Update Logo if changed
    if (window._tempLogoFile && window.SupabaseClient && window.SupabaseClient.isInitialized) {
        try {
            window.showNotification('Uploading logo...', 'info');
            const uploadResult = await window.SupabaseClient.storage.uploadClientLogo(window._tempLogoFile, client.id);
            if (uploadResult && uploadResult.url) {
                client.logoUrl = uploadResult.url;
                Logger.info('Logo uploaded via Storage:', client.logoUrl);
                // Clear temp data after successful upload
                window._tempLogoFile = null;
                window._tempClientLogo = null;
            } else {
                console.warn('[saveAuditClient] Logo upload returned no URL');
            }
        } catch (e) {
            console.error('Logo upload failed during client edit:', e);
            window.showNotification('Logo upload failed, but client data saved.', 'warning');
        }
    } else if (window._tempClientLogo) {
        client.logoUrl = window._tempClientLogo;
    }

    // Update Primary Contact (Index 0)
    if (!client.contacts) client.contacts = [];
    if (client.contacts.length === 0) {
        client.contacts.push({});
    }
    client.contacts[0].name = cleanData.contactName;
    client.contacts[0].designation = cleanData.contactDesignation;
    client.contacts[0].phone = cleanData.contactPhone;
    client.contacts[0].email = cleanData.contactEmail;

    // Update Head Office (Index 0)
    if (!client.sites) client.sites = [];
    if (client.sites.length === 0) {
        client.sites.push({ name: 'Head Office', standards: client.standard });
    }
    // Ensure site 0 is updated
    client.sites[0].address = cleanData.address;
    client.sites[0].city = cleanData.city;
    client.sites[0].country = cleanData.country;
    client.sites[0].geotag = cleanData.geotag;

    // 6. Save data
    window.saveData();

    // Sync to Supabase
    if (window.SupabaseClient?.isInitialized) {
        window.SupabaseClient.upsertClient(client)
            .then(() => {
            })
            .catch(err => {
                console.error('Supabase sync failed:', err);
                alert('Warning: Saved locally, but Cloud Sync Failed. \nReason: ' + (err.message || JSON.stringify(err)));
            });
    }
    window.showNotification('Client details updated successfully', 'success');

    // Clean up
    delete window._tempClientLogo;
    delete window._tempLogoFile;
    delete window._originalClientLogo;

    // Return to list
    renderClientsEnhanced();
};

window.handleIndustryChange = function (select) {
    const customContainer = document.getElementById('industry-other-container');
    if (customContainer) {
        customContainer.style.display = select.value === 'Other' ? 'block' : 'none';
        if (select.value === 'Other') {
            document.getElementById('client-industry-custom')?.focus();
        }
    }
};

{
    // Add Site Modal
    // eslint-disable-next-line no-unused-vars
    function addSite(clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        const standardsToShow = (window.state.cbSettings && window.state.cbSettings.standardsOffered && window.state.cbSettings.standardsOffered.length > 0)
            ? window.state.cbSettings.standardsOffered
            : ((window.state.cbSettings && window.state.cbSettings.availableStandards && window.state.cbSettings.availableStandards.length > 0)
                ? window.state.cbSettings.availableStandards
                : ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"]);

        window.DataService.openFormModal('Add Site Location', `
        <form id="site-form">
            <div class="form-group">
                <label>Site Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-name" placeholder="e.g. Main Plant" required>
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" class="form-control" id="site-address" placeholder="Street Address">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>City</label>
                    <input type="text" class="form-control" id="site-city" placeholder="City">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" class="form-control" id="site-country" placeholder="Country">
                </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); margin: 1rem 0; padding-top: 1rem;">
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;"><i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>Optional: Site-specific details for man-day calculation</p>
                <div class="form-group">
                    <label>Applicable Standards</label>
                    <select class="form-control" id="site-standards" multiple style="height: 100px;">
                        ${standardsToShow.map(std =>
            `<option value="${std}" ${(client.standard || '').includes(std) ? 'selected' : ''}>${std}</option>`
        ).join('')}
                    </select>
                    <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple (Defaults to client standards)</small>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Employees at this Site <span style="font-weight: normal; color: var(--text-secondary);">(optional)</span></label>
                        <input type="number" class="form-control" id="site-employees" min="0" placeholder="e.g. 50">
                    </div>
                    <div class="form-group">
                        <label>Shift Work? <span style="font-weight: normal; color: var(--text-secondary);">(optional)</span></label>
                        <select class="form-control" id="site-shift">
                            <option value="">-- Not specified --</option>
                            <option value="No">No (General Shift Only)</option>
                            <option value="Yes">Yes (Multiple Shifts)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Geotag (Lat, Long)</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" class="form-control" id="site-geotag" placeholder="e.g. 37.7749, -122.4194">
                    <button type="button" class="btn btn-secondary" data-action="getGeolocation" data-id="site-geotag">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </button>
                </div>
            </div>
        </form >
    `, () => {
            const name = document.getElementById('site-name').value;
            const address = document.getElementById('site-address').value;
            const city = document.getElementById('site-city').value;
            const country = document.getElementById('site-country').value;
            const geotag = document.getElementById('site-geotag').value;
            const employees = parseInt(document.getElementById('site-employees').value, 10) || null;
            const shift = document.getElementById('site-shift').value || null;

            if (name) {
                if (!client.sites) client.sites = [];
                const standards = Array.from(document.getElementById('site-standards').selectedOptions).map(o => o.value).join(', ');
                client.sites.push({ name, address, city, country, geotag, employees, shift, standards });
                // Auto-sync: update company-level employees from sum of site employees
                const siteTotal = client.sites.reduce((sum, s) => sum + (parseInt(s.employees, 10) || 0), 0);
                if (siteTotal > 0) client.employees = siteTotal;
                window.saveData();

                // Sync to Supabase
                if (window.SupabaseClient?.isInitialized) {
                    window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
                }
                window.closeModal();
                renderClientDetail(clientId);
                window.setSetupWizardStep(clientId, 2); // Ensure they are on sites step
                window.showNotification('Site added successfully');
            } else {
                window.showNotification('Site name is required', 'error');
            }
        });
    }

    // Upload Document Modal
    window.openClientDocumentModal = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.DataService.openFormModal('Add Client Document', `
        <form id="upload-form">
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="doc-name" required placeholder="e.g. Quality Management System Manual">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Category</label>
                    <select class="form-control" id="doc-category">
                        <option>System Manual</option>
                        <option>Quality Procedures</option>
                        <option>Work Instructions</option>
                        <option>Policy Document</option>
                        <option>Records / Forms Register</option>
                        <option>Org Chart</option>
                        <option>Process Map</option>
                        <option>Risk Register</option>
                        <option>Compliance Matrix</option>
                        <option>Contract / Agreement</option>
                        <option>Certificate</option>
                        <option>Corrective Action Plan</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Revision</label>
                    <input type="text" class="form-control" id="doc-revision" placeholder="e.g. Rev 3 or v2.1">
                </div>
            </div>
            <div class="form-group">
                <label>Linked ISO Clause(s)</label>
                <input type="text" class="form-control" id="doc-clauses" placeholder="e.g. 4.1, 7.5, 8.1 (comma-separated)">
                <small style="color: var(--text-secondary);">Map to ISO clauses this document covers</small>
            </div>
            <div class="form-group">
                <label>Notes / Key Excerpts</label>
                <textarea class="form-control" id="doc-notes" rows="3" placeholder="Paste key information from the document that auditors should reference during checklist preparation..." style="resize: vertical;"></textarea>
            </div>
            <div class="form-group">
                <label>File Attachment <span style="font-size: 0.8rem; color: #94a3b8;">(optional)</span></label>
                <div style="border: 2px dashed var(--border-color); padding: 1rem; text-align: center; border-radius: var(--radius-sm); cursor: pointer; background: #f8fafc;" data-action="clickElement" data-id="doc-file">
                    <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.25rem; color: var(--primary-color); margin-bottom: 0.25rem;"></i>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Click to browse files</p>
                </div>
                <input type="file" id="doc-file" style="display: none;" data-action-change="handleDocFileChange">
            </div>
        </form >
    `, () => {
            const name = document.getElementById('doc-name').value;
            const category = document.getElementById('doc-category').value;
            const revision = document.getElementById('doc-revision').value;
            const linkedClauses = document.getElementById('doc-clauses').value;
            const notes = document.getElementById('doc-notes').value;
            const fileInput = document.getElementById('doc-file');

            if (name) {
                if (fileInput.files[0] && fileInput.files[0].size > 5242880) {
                    alert('File is too large! Max limit is 5MB.');
                    return;
                }

                if (!client.documents) client.documents = [];

                const newDoc = {
                    id: Date.now().toString(),
                    name: name,
                    category: category,
                    revision: revision || '',
                    linkedClauses: linkedClauses || '',
                    notes: notes || '',
                    type: name.split('.').pop().toUpperCase() || 'FILE',
                    date: new Date().toISOString().split('T')[0],
                    size: fileInput.files[0] ? (fileInput.files[0].size / 1024 / 1024).toFixed(2) + ' MB' : 'Manual entry'
                };

                client.documents.push(newDoc);

                window.saveData();
                window.closeModal();
                renderClientDetail(clientId);
                setTimeout(() => {
                    document.querySelector('.tab-btn[data-tab="documents"]')?.click();
                }, 100);
                window.showNotification('Document added successfully');
            } else {
                alert('Please enter a document name');
            }
        });
    }

    // View Document Notes
    window.viewDocumentNotes = function (clientId, docId) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.documents) return;
        const doc = client.documents.find(d => d.id === docId);
        if (!doc) return;

        window.DataService.openFormModal(doc.name, `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div><strong style="color: var(--text-secondary); font-size: 0.82rem;">Category</strong><div>${window.UTILS.escapeHtml(doc.category || 'General')}</div></div>
                <div><strong style="color: var(--text-secondary); font-size: 0.82rem;">Revision</strong><div style="font-family: monospace;">${window.UTILS.escapeHtml(doc.revision || '-')}</div></div>
                <div><strong style="color: var(--text-secondary); font-size: 0.82rem;">Linked Clauses</strong><div>${doc.linkedClauses ? '<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:0.85rem;">' + window.UTILS.escapeHtml(doc.linkedClauses) + '</span>' : '—'}</div></div>
                <div><strong style="color: var(--text-secondary); font-size: 0.82rem;">Date Added</strong><div>${window.UTILS.escapeHtml(doc.date || '-')}</div></div>
            </div>
            ${doc.notes ? `<div style="margin-top: 0.5rem;"><strong style="color: var(--text-secondary); font-size: 0.82rem;">Notes / Key Excerpts</strong><div style="margin-top: 0.5rem; padding: 1rem; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; font-size: 0.9rem; line-height: 1.7; white-space: pre-wrap;">${window.UTILS.escapeHtml(doc.notes)}</div></div>` : '<p style="color: #94a3b8; font-size: 0.9rem;">No notes added for this document.</p>'}
        `);
    };

    // Delete Document Helper
    window.deleteDocument = function (clientId, docId) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.documents) return;

        if (confirm('Are you sure you want to delete this document?')) {
            client.documents = client.documents.filter(d => d.id !== docId);
            window.saveData();
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="documents"]')?.click();
            }, 100);
            window.showNotification('Document deleted');
        }
    };

    window.renderClientsEnhanced = renderClientsEnhanced;
    window.renderClientDetail = renderClientDetail;


    // addContactPerson and addSite are defined in clients-module-fix.js


// ============================================
// CRUD Operations (editSite, contacts, departments, etc.)
// => Extracted to clients-crud.js
// ============================================


    // ============================================
    // ISO 17021-1 CLIENT COMPLIANCE FUNCTIONS
    // ============================================

    window.updateClientApplicationStatus = function (clientId, newStatus) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        if (!client.compliance) client.compliance = {};
        client.compliance.applicationStatus = newStatus;

        window.saveData();
        window.showNotification(`Application status updated to: ${newStatus}`, 'success');
        renderClientDetail(clientId);

        // Switch to compliance tab
        setTimeout(() => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="compliance"]')?.classList.add('active');
            renderClientTab(client, 'compliance');
        }, 100);
    };

    window.editClientContract = function (clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const contract = client.compliance?.contract || {};

        document.getElementById('modal-title').textContent = 'Certification Contract Details';
        document.getElementById('modal-body').innerHTML = `
        <form id="contract-form">
            <div class="form-group">
                <label>Contract Number</label>
                <input type="text" id="contract-number" class="form-control" value="${contract.number || ''}" placeholder="e.g., CB-2024-001">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Signed Date</label>
                    <input type="date" id="contract-signed-date" class="form-control" value="${contract.signedDate || ''}">
                </div>
                <div class="form-group">
                    <label>Valid Until</label>
                    <input type="date" id="contract-valid-until" class="form-control" value="${contract.validUntil || ''}">
                </div>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="contract-signed" ${contract.signed ? 'checked' : ''}>
                    Contract has been signed by client
                </label>
            </div>
        </form>
    `;

        document.getElementById('modal-save').onclick = function () {
            if (!client.compliance) client.compliance = {};
            client.compliance.contract = {
                number: document.getElementById('contract-number').value,
                signedDate: document.getElementById('contract-signed-date').value,
                validUntil: document.getElementById('contract-valid-until').value,
                signed: document.getElementById('contract-signed').checked
            };

            window.saveData();
            window.closeModal();
            window.showNotification('Contract details updated', 'success');
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="compliance"]')?.click();
            }, 100);
        };

        window.openModal();
    };

    window.editClientNDA = function (clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const nda = client.compliance?.nda || {};

        document.getElementById('modal-title').textContent = 'Confidentiality Agreement (NDA)';
        document.getElementById('modal-body').innerHTML = `
        <form id="nda-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Signed Date</label>
                    <input type="date" id="nda-signed-date" class="form-control" value="${nda.signedDate || ''}">
                </div>
                <div class="form-group">
                    <label>Signed By (Client Representative)</label>
                    <input type="text" id="nda-signed-by" class="form-control" value="${nda.signedBy || ''}" placeholder="Name of signatory">
                </div>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="nda-signed" ${nda.signed ? 'checked' : ''}>
                    NDA/Confidentiality agreement has been signed
                </label>
            </div>
            <div style="padding: 1rem; background: #eff6ff; border-radius: 6px; margin-top: 1rem;">
                <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    ISO 17021-1 Clause 5.6 requires the CB to maintain confidentiality of client information.
                </p>
            </div>
        </form>
    `;

        document.getElementById('modal-save').onclick = function () {
            if (!client.compliance) client.compliance = {};
            client.compliance.nda = {
                signedDate: document.getElementById('nda-signed-date').value,
                signedBy: document.getElementById('nda-signed-by').value,
                signed: document.getElementById('nda-signed').checked
            };

            window.saveData();
            window.closeModal();
            window.showNotification('NDA details updated', 'success');
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="compliance"]')?.click();
            }, 100);
        };

        window.openModal();
    };

    window.addClientChangeLog = function (clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        document.getElementById('modal-title').textContent = 'Log Client Change';
        document.getElementById('modal-body').innerHTML = `
        <form id="change-log-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Date of Change</label>
                    <input type="date" id="change-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Change Type</label>
                    <select id="change-type" class="form-control">
                        <option value="Scope Change">Scope Change</option>
                        <option value="Organization Change">Organization Change</option>
                        <option value="Process Change">Process Change</option>
                        <option value="Site/Location Change">Site/Location Change</option>
                        <option value="Management Change">Management Change</option>
                        <option value="Legal Entity Change">Legal Entity Change</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Description of Change</label>
                <textarea id="change-description" class="form-control" rows="3" placeholder="Describe the significant change..."></textarea>
            </div>
            <div class="form-group">
                <label>Reported By</label>
                <input type="text" id="change-reported-by" class="form-control" value="${window.state.currentUser?.name || ''}" placeholder="Who reported this change?">
            </div>
            <div style="padding: 1rem; background: #fef3c7; border-radius: 6px; margin-top: 1rem;">
                <p style="margin: 0; font-size: 0.85rem; color: #92400e;">
                    <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                    Significant changes may require assessment of impact on certification scope or trigger a special audit.
                </p>
            </div>
        </form>
    `;

        document.getElementById('modal-save').onclick = function () {
            const description = document.getElementById('change-description').value;
            if (!description) {
                window.showNotification('Please enter a description of the change', 'error');
                return;
            }

            if (!client.compliance) client.compliance = {};
            if (!client.compliance.changesLog) client.compliance.changesLog = [];

            client.compliance.changesLog.unshift({
                date: document.getElementById('change-date').value,
                type: document.getElementById('change-type').value,
                description: description,
                reportedBy: document.getElementById('change-reported-by').value
            });

            window.saveData();
            window.closeModal();
            window.showNotification('Client change logged', 'success');
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="compliance"]')?.click();
            }, 100);
        };

        window.openModal();
    };

// ============================================
// Import/Export, Certificates & Setup
// => Extracted to clients-import.js
// ============================================
}

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { toggleClientAnalytics, changeClientPage, changeClientItemsPerPage, switchClientDetailTab, handleLogoUpload, renderAddClient, renderEditClient, handleIndustryChange, openClientDocumentModal, viewDocumentNotes, deleteDocument, renderClientsEnhanced, renderClientDetail, updateClientApplicationStatus, editClientContract, editClientNDA, addClientChangeLog };
}

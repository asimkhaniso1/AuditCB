// ============================================
// CLIENTS MODULE
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
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
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
    <tr class="client-row" data-client-id="${client.id}" style="cursor: pointer;" onclick="renderClientDetail(${client.id})">
            <td>${window.UTILS.escapeHtml(client.name)}</td>
            <td>
                ${(client.standard || '').split(',').map(s =>
        `<span class="badge" style="background: #e0f2fe; color: #0284c7; margin-right: 4px; font-size: 0.75em;">${window.UTILS.escapeHtml(s.trim())}</span>`
    ).join('')}
            </td>
            <td><span class="status-badge status-${(client.status || '').toLowerCase()}">${window.UTILS.escapeHtml(client.status)}</span></td>
            <td>${window.UTILS.escapeHtml(client.nextAudit)}</td>
            <td>
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm edit-client" data-client-id="${client.id}" style="color: var(--primary-color); margin-right: 0.5rem;"><i class="fa-solid fa-edit"></i></button>
                ` : ''}
                <button class="btn btn-sm view-client" data-client-id="${client.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr >
    `).join('');

    const html = `
    <div class="fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="margin: 0;">Client Management</h2>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                        <input type="file" id="client-import-file" style="display: none;" accept=".xlsx, .xls">
                        <button class="btn btn-sm btn-outline-secondary" onclick="downloadImportTemplate()" style="white-space: nowrap;" title="Restricted to Cert Managers">
                            <i class="fa-solid fa-file-export" style="margin-right: 0.5rem;"></i>Template
                        </button>
                         <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('client-import-file').click()" style="white-space: nowrap;" title="Restricted to Cert Managers">
                            <i class="fa-solid fa-file-import" style="margin-right: 0.5rem;"></i>Import
                        </button>
                    ` : ''}
                <button class="btn btn-sm btn-outline-secondary" onclick="toggleClientAnalytics()" style="white-space: nowrap;">
                    <i class="fa-solid ${window.state.showClientAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${window.state.showClientAnalytics !== false ? 'Hide' : 'Show'} Analytics
                </button>
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                    <button id="btn-new-client" class="btn btn-primary" style="white-space: nowrap;">
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
                            <th>Next Audit</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No clients found</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            ${totalItems > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding: 0.5rem;">
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    Showing ${startIndex + 1} to ${Math.min(startIndex + window.state.clientPagination.itemsPerPage, totalItems)} of ${totalItems} entries
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.changeClientPage(${window.state.clientPagination.currentPage - 1})" ${window.state.clientPagination.currentPage === 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span style="font-size: 0.9rem; min-width: 80px; text-align: center;">Page ${window.state.clientPagination.currentPage} of ${totalPages}</span>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.changeClientPage(${window.state.clientPagination.currentPage + 1})" ${window.state.clientPagination.currentPage === totalPages ? 'disabled' : ''}>
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <select onchange="window.changeClientItemsPerPage(this.value)" style="margin-left: 1rem; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color);">
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

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-new-client')?.addEventListener('click', window.renderAddClient);

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
                const clientId = parseInt(el.getAttribute('data-client-id'));
                // Navigate directly to Client Workspace (no intermediate page)
                window.location.hash = `client / ${clientId} `;
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clientId = parseInt(btn.getAttribute('data-client-id'));
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
    if (window.window.state.clientPagination) {
        window.window.state.clientPagination.currentPage = page;
        renderClientsEnhanced();
    }
};

window.changeClientItemsPerPage = function (val) {
    if (window.window.state.clientPagination) {
        window.window.state.clientPagination.itemsPerPage = parseInt(val, 10);
        window.window.state.clientPagination.currentPage = 1; // Reset to first page
        renderClientsEnhanced();
    }
};

function renderClientDetail(clientId, options = {}) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Options: showAccountSetup (default: true), showAnalytics (default: true)
    const showAccountSetup = options.showAccountSetup !== false;
    const showAnalytics = options.showAnalytics !== false;

    // Calculate performance metrics
    const totalAudits = window.state.auditPlans.filter(p => p.client === client.name).length;
    const completedAudits = window.state.auditPlans.filter(p => p.client === client.name && p.status === 'Completed').length;
    const pendingAudits = window.state.auditPlans.filter(p => p.client === client.name && (p.status === 'Draft' || p.status === 'Confirmed')).length;
    const certificationStatus = client.status === 'Active' ? 'Certified' : client.status;

    const html = `
    <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderClientsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Clients
                </button>
            </div>
            
            <!--Header Card with Client Info-->
    <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h2 style="margin: 0;">${window.UTILS.escapeHtml(client.name)}</h2>
                <p style="color: var(--text-secondary); margin: 0.25rem 0;">${window.UTILS.escapeHtml(client.industry || 'N/A')} • ${window.UTILS.escapeHtml(client.standard || 'N/A')}</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" onclick="window.initiateAuditPlanFromClient(${client.id})">
                    <i class="fa-solid fa-calendar-plus"></i> Create Audit Plan
                </button>
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                    <button class="btn btn-primary" onclick="window.renderEditClient(${client.id})">
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
                ${showAccountSetup && window.state.activeClientId ? `
                <button class="tab-btn" data-tab="client_org" style="background: #fdf4ff; color: #a21caf;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.25rem;"></i>Account Setup
                </button>
                ` : ''}
                <button class="tab-btn" data-tab="audit_team">
                    <i class="fa-solid fa-user-shield" style="margin-right: 0.25rem;"></i>Audit Team
                </button>
                <button class="tab-btn" data-tab="scopes">
                    <i class="fa-solid fa-certificate" style="margin-right: 0.25rem;"></i>Scopes & Certs
                </button>
            </div>

            <div id="tab-content"></div>
        </div >
    `;

    window.contentArea.innerHTML = html;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            window.switchClientDetailTab(clientId, btn.getAttribute('data-tab'));
        });
    });

    renderClientTab(client, 'info');
}

window.switchClientDetailTab = function (clientId, tabName) {
    const client = window.state.clients.find(c => c.id === clientId);
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
                ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm btn-outline-primary" onclick="window.openImportAccountSetupModal(${client.id})">
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
                <div>
                    <label style="color: var(--text-secondary); font-size: 0.875rem;">Next Audit Date</label>
                    <p style="font-weight: 500; margin-top: 0.25rem;">${client.nextAudit}</p>
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
                        <a href="#" onclick="window.renderModule('auditors'); return false;" style="color: var(--primary-color);">Add auditors</a> with relevant industry expertise.
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
            ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm btn-secondary" onclick="addSite(${client.id})">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Site
                </button>
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
                <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <i class="fa-solid fa-building-circle-exclamation" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin: 0;">No sites or branch locations added yet.</p>
                    ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                    <button class="btn btn-sm btn-outline-primary" style="margin-top: 1rem;" onclick="addSite(${client.id})">
                        <i class="fa-solid fa-plus"></i> Add First Site
                    </button>
                    ` : ''}
                </div>
            `}
    </div>
`;
}


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
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                        <label class="btn btn-sm btn-outline-primary" style="cursor: pointer; margin: 0;">
                            <i class="fa-solid fa-file-pdf" style="margin-right: 0.25rem;"></i> Upload PDF
                            <input type="file" accept=".pdf,.doc,.docx,.txt" style="display: none;" onchange="window.uploadCompanyProfileDoc(${client.id}, this.files[0])">
                        </label>
                        ${client.website ? `
                            <button class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" onclick="window.generateCompanyProfile(${client.id})">
                                <i class="fa-solid fa-sparkles" style="margin-right: 0.25rem;"></i> AI Generate
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="window.editCompanyProfile(${client.id})">
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
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm" style="color: #dc2626; background: none; border: none;" onclick="window.removeProfileDocument(${client.id})" title="Remove document">
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
                        ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                            <label class="btn btn-primary btn-sm" style="cursor: pointer; margin: 0;">
                                <i class="fa-solid fa-upload"></i> Upload Document
                                <input type="file" accept=".pdf,.doc,.docx,.txt" style="display: none;" onchange="window.uploadCompanyProfileDoc(${client.id}, this.files[0])">
                            </label>
                            ${client.website ? `
                                <button class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" onclick="window.generateCompanyProfile(${client.id})">
                                    <i class="fa-solid fa-sparkles"></i> AI Generate
                                </button>
                            ` : ''}
                            <button class="btn btn-outline-secondary btn-sm" onclick="window.editCompanyProfile(${client.id})">
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

function getClientContactsHTML(client) {
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-address-book" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Contact Persons</h3>
            ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="addContactPerson(${client.id})">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadContacts(${client.id})">
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
                                        ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editContact(${client.id}, ${index})">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteContact(${client.id}, ${index})">
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

function getClientDepartmentsHTML(client) {
    const departments = client.departments || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;"><i class="fa-solid fa-sitemap" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Departments</h3>
            <div style="display: flex; gap: 0.5rem;">
                ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDepartments(${client.id})">
                        <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.addDepartment(${client.id})">
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
                                        ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editDepartment(${client.id}, ${index})">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteDepartment(${client.id}, ${index})">
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
                        ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                        <button class="btn btn-outline-primary btn-sm" onclick="window.addDepartment(${client.id})">Add Manually</button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="window.bulkUploadDepartments(${client.id})">Bulk Upload</button>
                        ` : ''}
                    </div>
                </div>
            `}
        </div >
    `;
}

// Goods/Services Step (AI-Populated)
function getClientGoodsServicesHTML(client) {
    const items = client.goodsServices || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-boxes-stacked" style="margin-right: 0.5rem; color: #f59e0b;"></i>Goods & Services</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Products and services offered by the organization</p>
            </div>
            ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addGoodsService(${client.id})">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadGoodsServices(${client.id})">
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
                                    ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                                    <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editGoodsService(${client.id}, ${index})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteGoodsService(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button>
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
function getClientKeyProcessesHTML(client) {
    const processes = client.keyProcesses || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-diagram-project" style="margin-right: 0.5rem; color: #06b6d4;"></i>Key Processes</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Core business processes for audit planning</p>
            </div>
            ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addKeyProcess(${client.id})">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadKeyProcesses(${client.id})">
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
                                    ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                                    <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editKeyProcess(${client.id}, ${index})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteKeyProcess(${client.id}, ${index})"><i class="fa-solid fa-trash"></i></button>
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
function getClientDesignationsHTML(client) {
    const designations = client.designations || [];
    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-id-badge" style="margin-right: 0.5rem; color: #84cc16;"></i>Designations</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Job titles and roles within the organization</p>
            </div>
            ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="window.addDesignation(${client.id})">
                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDesignations(${client.id})">
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
                        ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin' || window.state.currentUser.role === 'Lead Auditor') ? `
                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color); padding: 0; margin-left: 0.25rem;" onclick="window.deleteDesignation(${client.id}, ${index})"><i class="fa-solid fa-times"></i></button>
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
        .filter(a => a.clientId == client.id)
        .map(a => a.auditorId);
    const assignedAuditors = auditors.filter(a => assignedAuditorIds.includes(a.id));

    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h3 style="margin: 0;"><i class="fa-solid fa-user-shield" style="margin-right: 0.5rem; color: #0ea5e9;"></i>Audit Team</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">CB auditors assigned to audit this organization</p>
            </div>
            ${canManage ? `
            <button class="btn btn-primary" onclick="window.openClientAuditorAssignmentModal(${client.id}, '${window.UTILS.escapeHtml(client.name)}')">
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
        const assignment = assignments.find(a => a.clientId == client.id && a.auditorId == auditor.id);
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
                        ${canManage ? `<button class="btn btn-sm btn-outline-danger" onclick="window.removeClientAuditorAssignment('${client.id}', '${auditor.id}')" title="Remove assignment"><i class="fa-solid fa-user-minus"></i> Remove</button>` : ''}
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
    const closedNCRs = allNCRs.filter(n => n.status === 'Closed').length;
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
        const report = clientReports.find(r => r.planId == plan.id || r.date === plan.date);
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
                                    ${report ? `<button class="btn btn-sm btn-outline-primary" onclick="window.openReportingDetail(${report.id})"><i class="fa-solid fa-file-lines"></i> View Report</button>` : ''}
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
            <h3 style="margin: 0;">Documents</h3>
            ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-primary btn-sm" onclick="openUploadDocumentModal(${client.id})">
                    <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.5rem;"></i> Upload Document
                </button>
                ` : ''}
        </div>
            
            ${docs.length > 0 ? `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Document Name</th>
                                <th>Type</th>
                                <th>Date Uploaded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${docs.map(doc => `
                                <tr>
                                    <td>
                                        <i class="fa-solid fa-file-${doc.type === 'PDF' ? 'pdf' : 'lines'}" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>
                                        ${window.UTILS.escapeHtml(doc.name)}
                                    </td>
                                    <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${window.UTILS.escapeHtml(doc.category || 'General')}</span></td>
                                    <td>${window.UTILS.escapeHtml(doc.date)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="alert('Downloading ${window.UTILS.escapeHtml(doc.name)} (Simulated)')"><i class="fa-solid fa-download"></i></button>
                                        ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                                        <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="deleteDocument(${client.id}, '${window.UTILS.escapeHtml(doc.id)}')"><i class="fa-solid fa-trash"></i></button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No documents uploaded for this client yet.</p>
                    ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                    <button class="btn btn-outline-primary btn-sm" onclick="openUploadDocumentModal(${client.id})">Upload First Document</button>
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
                        ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? 'cursor: pointer;' : ''}
                        background: ${appStatus === s ? statusColors[s] : '#f1f5f9'}; 
                        color: ${appStatus === s ? 'white' : '#64748b'};"
                        ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `onclick="window.updateClientApplicationStatus(${client.id}, '${s}')"` : ''}>
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
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm btn-secondary" onclick="window.editClientContract(${client.id})">
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
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm btn-secondary" onclick="window.editClientNDA(${client.id})">
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
                ${(window.window.state.currentUser.role === 'Certification Manager' || window.window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm btn-secondary" onclick="window.addClientChangeLog(${client.id})">
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
        console.warn('tab-content element not found. Client workspace may not be rendered.');
        return;
    }

    if (tabName === 'info') {
        tabContent.innerHTML = getClientInfoHTML(client);
    } else if (tabName === 'client_org') {
        tabContent.innerHTML = getClientOrgSetupHTML(client);
    } else if (tabName === 'audit_team') {
        tabContent.innerHTML = getClientAuditTeamHTML(client);
    } else if (tabName === 'scopes') {
        tabContent.innerHTML = getClientCertificatesHTML(client);
    } else if (tabName === 'audits') {
        tabContent.innerHTML = getClientAuditsHTML(client);
    } else if (tabName === 'documents') {
        tabContent.innerHTML = getClientDocumentsHTML(client);
    } else if (tabName === 'compliance') {
        tabContent.innerHTML = getClientComplianceHTML(client);
    }
}

window.handleLogoUpload = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            window._tempClientLogo = e.target.result;
            const previewImg = document.getElementById('client-logo-preview-img');
            const placeholder = document.getElementById('client-logo-placeholder');
            if (previewImg && placeholder) {
                previewImg.style.backgroundImage = `url(${e.target.result})`;
                previewImg.style.display = 'block';
                placeholder.style.display = 'none';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.renderAddClient = function () {
    const html = `
    <div class="fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 4rem;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
            <div>
                <button class="btn btn-link" onclick="renderClientsEnhanced()" style="color: var(--text-secondary); padding: 0; margin-bottom: 0.5rem; text-decoration: none;">
                    <i class="fa-solid fa-arrow-left"></i> Back to Clients
                </button>
                <h1 style="font-size: 1.75rem; font-weight: 700; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">
                    New Client Onboarding
                </h1>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-secondary" onclick="renderClientsEnhanced()">Cancel</button>
                <button class="btn btn-primary" onclick="window.saveNewClient()" style="padding: 0.6rem 1.5rem; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
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

                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Industry Sector <span class="text-danger">*</span></label>
                            <select class="form-control" id="client-industry" style="background-image: none;">
                                <option value="">Select Industry...</option>
                                ${['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'].map(i => `<option>${i}</option>`).join('')}
                            </select>
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
                                ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map((std, i) => `
                                    <label class="standard-checkbox-btn" style="cursor: pointer;">
                                        <input type="checkbox" name="client_standards" value="${std}" style="display: none;" onchange="this.parentElement.classList.toggle('active', this.checked); this.nextElementSibling.style.borderColor = this.checked ? '#3b82f6' : '#cbd5e1'; this.nextElementSibling.style.color = this.checked ? '#2563eb' : '#64748b'; this.nextElementSibling.style.background = this.checked ? '#eff6ff' : '#fff';">
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
                                <a href="#" onclick="event.preventDefault(); navigator.geolocation.getCurrentPosition(pos => { document.getElementById('client-geotag').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4); });" style="font-size: 0.8rem; color: var(--primary-color);">
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
                         <input type="file" id="client-logo-upload" accept="image/*" style="display: none;" onchange="window.handleLogoUpload(this)">
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
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="font-size: 0.8rem;">Target Audit Date</label>
                             <input type="date" class="form-control" id="client-next-audit">
                        </div>
                    </div>
                </div>

            </div>
        </form>
    </div>
    `;

    window.contentArea.innerHTML = html;
};

window.saveNewClient = function () {
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
        siteCount: 'client-sites',
        nextAudit: 'client-next-audit'
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
        id: Date.now(),
        name: cleanData.name,
        standard: standard,
        nextAudit: cleanData.nextAudit,
        industry: document.getElementById('client-industry').value,
        status: 'Active',
        website: Sanitizer.sanitizeURL(cleanData.website),
        contacts: contacts,
        sites: sites,
        employees: parseInt(cleanData.employees) || 0,
        shifts: document.getElementById('client-shifts').value,
        logoUrl: window._tempClientLogo || ''
    };

    // 6. Save
    window.state.clients.push(newClient);
    window.saveData();
    window.showNotification('Client created! Redirecting to Workspace...', 'success');

    // Redirect to Client Workspace Settings
    renderClientDetail(newClient.id);
    setTimeout(() => {
        document.querySelector('.tab-btn[data-tab="client_org"]')?.click();
    }, 500);
};

window.renderEditClient = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) {
        window.showNotification('Client not found', 'error');
        renderClientsEnhanced();
        return;
    }

    const firstSite = client.sites && client.sites[0] ? client.sites[0] : {};
    const firstContact = client.contacts && client.contacts[0] ? client.contacts[0] : {};
    const standards = (client.standard || '').split(',').map(s => s.trim());

    // Temporarily store original logo URL for comparison/fallback
    window._originalClientLogo = client.logoUrl;
    window._tempClientLogo = null; // Reset temp

    const html = `
    <div class="fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 4rem;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
            <div>
                <button class="btn btn-link" onclick="renderClientsEnhanced()" style="color: var(--text-secondary); padding: 0; margin-bottom: 0.5rem; text-decoration: none;">
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
                <button class="btn btn-secondary" onclick="renderClientsEnhanced()">Cancel</button>
                <button class="btn btn-primary" onclick="window.saveAuditClient(${client.id})" style="padding: 0.6rem 1.5rem; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
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
                             <label style="font-size: 0.85rem; font-weight: 600; color: #475569;">Industry Sector <span class="text-danger">*</span></label>
                            <select class="form-control" id="client-industry" style="background-image: none;">
                                <option value="">Select Industry...</option>
                                ${['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'].map(i => `<option ${client.industry === i ? 'selected' : ''}>${i}</option>`).join('')}
                            </select>
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
                                ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map((std) => {
        const isChecked = standards.includes(std);
        return `
                                    <label class="standard-checkbox-btn ${isChecked ? 'active' : ''}" style="cursor: pointer;">
                                        <input type="checkbox" name="client_standards" value="${std}" ${isChecked ? 'checked' : ''} style="display: none;" onchange="this.parentElement.classList.toggle('active', this.checked); this.nextElementSibling.style.borderColor = this.checked ? '#3b82f6' : '#cbd5e1'; this.nextElementSibling.style.color = this.checked ? '#2563eb' : '#64748b'; this.nextElementSibling.style.background = this.checked ? '#eff6ff' : '#fff';">
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
                                <a href="#" onclick="event.preventDefault(); navigator.geolocation.getCurrentPosition(pos => { document.getElementById('client-geotag').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4); });" style="font-size: 0.8rem; color: var(--primary-color);">
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
                         <input type="file" id="client-logo-upload" accept="image/*" style="display: none;" onchange="window.handleLogoUpload(this)">
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
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="font-size: 0.8rem;">Target Audit Date</label>
                             <input type="date" class="form-control" id="client-next-audit" value="${client.nextAudit || ''}">
                        </div>
                    </div>
                </div>

            </div>
        </form>
    </div>
    `;

    window.contentArea.innerHTML = html;
};

window.saveAuditClient = function (clientId) {
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
            'address', 'city', 'country', 'geotag']
    );

    // 5. Update Record
    // Update basic info
    client.name = cleanData.name;
    client.standard = checkedStandards.join(', ');
    client.industry = document.getElementById('client-industry').value;
    client.status = document.getElementById('client-status').value;
    client.website = Sanitizer.sanitizeURL(cleanData.website);
    client.employees = parseInt(cleanData.employees) || 0;
    client.shifts = document.getElementById('client-shifts').value;
    client.nextAudit = cleanData.nextAudit;

    // Update Logo if changed
    if (window._tempClientLogo) {
        client.logoUrl = window._tempClientLogo;
    }
    // If user cleared it or didn't change it, we keep current (or can implement clear logic if needed)

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
    window.showNotification('Client details updated successfully', 'success');

    // Clean up
    delete window._tempClientLogo;
    delete window._originalClientLogo;

    // Return to list
    renderClientsEnhanced();
};

// Add Contact Person Modal
function addContactPerson(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add Contact Person';
    modalBody.innerHTML = `
        <form id="contact-form">
            <div class="form-group">
                <label>Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="contact-name" required>
            </div>
            <div class="form-group">
                <label>Designation</label>
                <input type="text" class="form-control" id="contact-designation" placeholder="e.g. Quality Manager">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="contact-phone" placeholder="+1 234 567 8900">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="contact-email" placeholder="name@example.com">
            </div>
        </form >
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('contact-name').value;
        const designation = document.getElementById('contact-designation').value;
        const phone = document.getElementById('contact-phone').value;
        const email = document.getElementById('contact-email').value;

        if (name) {
            if (!client.contacts) client.contacts = [];
            client.contacts.push({ name, designation, phone, email });
            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Contact added successfully');
        } else {
            window.showNotification('Name is required', 'error');
        }
    };
}

// Add Site Modal
function addSite(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add Site Location';
    modalBody.innerHTML = `
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
                        ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map(std =>
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
                    <button type="button" class="btn btn-secondary" onclick="navigator.geolocation.getCurrentPosition(pos => { document.getElementById('site-geotag').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4); });">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </button>
                </div>
            </div>
        </form >
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('site-name').value;
        const address = document.getElementById('site-address').value;
        const city = document.getElementById('site-city').value;
        const country = document.getElementById('site-country').value;
        const geotag = document.getElementById('site-geotag').value;
        const employees = parseInt(document.getElementById('site-employees').value) || null;
        const shift = document.getElementById('site-shift').value || null;

        if (name) {
            if (!client.sites) client.sites = [];
            const standards = Array.from(document.getElementById('site-standards').selectedOptions).map(o => o.value).join(', ');
            client.sites.push({ name, address, city, country, geotag, employees, shift, standards });
            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Site added successfully');
        } else {
            window.showNotification('Site name is required', 'error');
        }
    };
}

// Upload Document Modal
window.openUploadDocumentModal = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Upload Document';
    modalBody.innerHTML = `
        <form id="upload-form">
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="doc-name" required placeholder="e.g. ISO 9001 Certificate">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select class="form-control" id="doc-category">
                    <option>Contract / Agreement</option>
                    <option>Audit Report</option>
                    <option>Certificate</option>
                    <option>Corrective Action Plan</option>
                    <option>Correspondence</option>
                    <option>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>File Select</label>
                <div style="border: 2px dashed var(--border-color); padding: 1.5rem; text-align: center; border-radius: var(--radius-sm); cursor: pointer; background: #f8fafc;" onclick="document.getElementById('doc-file').click()">
                    <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.5rem; color: var(--primary-color); margin-bottom: 0.5rem;"></i>
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">Click to browse files</p>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #94a3b8;">(Simulated upload)</p>
                </div>
                <!-- Hidden file input for visual completeness -->
                <input type="file" id="doc-file" style="display: none;" onchange="if(this.files[0]) { 
                    if(this.files[0].size > 5242880) { 
                        alert('File is too large! Max limit is 5MB.'); 
                        this.value = ''; 
                        document.getElementById('doc-name').value = '';
                    } else {
                        document.getElementById('doc-name').value = this.files[0].name; 
                    }
                }">
            </div>
        </form >
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('doc-name').value;
        const category = document.getElementById('doc-category').value;
        const fileInput = document.getElementById('doc-file');

        if (name) {
            // Final validation before save
            if (fileInput.files[0] && fileInput.files[0].size > 5242880) {
                alert('File is too large! Max limit is 5MB.');
                return;
            }

            if (!client.documents) client.documents = [];

            const newDoc = {
                id: Date.now().toString(),
                name: name,
                category: category,
                type: name.split('.').pop().toUpperCase() || 'FILE',
                date: new Date().toISOString().split('T')[0],
                size: fileInput.files[0] ? (fileInput.files[0].size / 1024 / 1024).toFixed(2) + ' MB' : 'Simulated'
            };

            client.documents.push(newDoc);

            window.saveData();
            window.closeModal();
            renderClientDetail(clientId); // Refresh to show new doc in tab
            // Force switch back to documents tab
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="documents"]')?.click();
            }, 100);
            window.showNotification('Document uploaded successfully');
        } else {
            alert('Please enter a document name');
        }
    };
}

// Delete Document Helper
window.deleteDocument = function (clientId, docId) {
    const client = window.state.clients.find(c => c.id === clientId);
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


window.addContactPerson = addContactPerson;
window.addSite = addSite;

// Edit Site Modal
window.editSite = function (clientId, siteIndex) {
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.sites || !client.sites[siteIndex]) return;

    const site = client.sites[siteIndex];

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Edit Site Location';
    modalBody.innerHTML = `
        <form id="site-form">
            <div class="form-group">
                <label>Site Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-name" value="${site.name}" required>
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" class="form-control" id="site-address" value="${site.address || ''}">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>City</label>
                    <input type="text" class="form-control" id="site-city" value="${site.city || ''}">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" class="form-control" id="site-country" value="${site.country || ''}">
                </div>
            </div>
            
            <div style="border-top: 1px solid var(--border-color); margin: 1rem 0; padding-top: 1rem;">
                <div class="form-group">
                    <label>Applicable Standards</label>
                    <select class="form-control" id="site-standards" multiple style="height: 100px;">
                        ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map(std =>
        `<option value="${std}" ${(site.standards || client.standard || '').includes(std) ? 'selected' : ''}>${std}</option>`
    ).join('')}
                    </select>
                    <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Employees</label>
                        <input type="number" class="form-control" id="site-employees" min="0" value="${site.employees || ''}">
                    </div>
                    <div class="form-group">
                        <label>Shift Work?</label>
                        <select class="form-control" id="site-shift">
                            <option value="" ${!site.shift ? 'selected' : ''}>-- Not specified --</option>
                            <option value="No" ${site.shift === 'No' ? 'selected' : ''}>No</option>
                            <option value="Yes" ${site.shift === 'Yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Geotag</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" class="form-control" id="site-geotag" value="${site.geotag || ''}">
                    <button type="button" class="btn btn-secondary" onclick="navigator.geolocation.getCurrentPosition(pos => { document.getElementById('site-geotag').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4); });">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </button>
                </div>
            </div>
        </form >
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('site-name').value;
        const address = document.getElementById('site-address').value;
        const city = document.getElementById('site-city').value;
        const country = document.getElementById('site-country').value;
        const geotag = document.getElementById('site-geotag').value;
        const employees = parseInt(document.getElementById('site-employees').value) || null;
        const shift = document.getElementById('site-shift').value || null;

        if (name) {
            const standards = Array.from(document.getElementById('site-standards').selectedOptions).map(o => o.value).join(', ');
            client.sites[siteIndex] = { ...site, name, address, city, country, geotag, employees, shift, standards };
            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Site updated successfully');
        } else {
            window.showNotification('Site name is required', 'error');
        }
    };
};

// Delete Site
window.deleteSite = function (clientId, siteIndex) {
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.sites) return;

    if (confirm('Are you sure you want to delete this site?')) {
        client.sites.splice(siteIndex, 1);
        window.saveData();
        renderClientDetail(clientId);
        window.showNotification('Site deleted');
    }
};

// Edit Contact Modal
window.editContact = function (clientId, contactIndex) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.contacts || !client.contacts[contactIndex]) return;

    const contact = client.contacts[contactIndex];

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Edit Contact Person';
    modalBody.innerHTML = `
        <form id="contact-form">
            <div class="form-group">
                <label>Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="contact-name" value="${contact.name}" required>
            </div>
            <div class="form-group">
                <label>Designation</label>
                <input type="text" class="form-control" id="contact-designation" value="${contact.designation || ''}">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="contact-phone" value="${contact.phone || ''}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="contact-email" value="${contact.email || ''}">
            </div>
        </form >
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('contact-name').value;
        const designation = document.getElementById('contact-designation').value;
        const phone = document.getElementById('contact-phone').value;
        const email = document.getElementById('contact-email').value;

        if (name) {
            client.contacts[contactIndex] = { ...contact, name, designation, phone, email };
            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Contact updated successfully');
        } else {
            window.showNotification('Name is required', 'error');
        }
    };
};

// Delete Contact
window.deleteContact = function (clientId, contactIndex) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.contacts) return;

    if (confirm('Are you sure you want to delete this contact?')) {
        client.contacts.splice(contactIndex, 1);
        window.saveData();
        renderClientDetail(clientId);
        window.showNotification('Contact deleted');
    }
};

// Bulk Upload Contacts/Personnel
window.bulkUploadContacts = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Personnel',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste contact list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Name, Designation, Email, Phone<br>
                John Doe, QA Manager, john@company.com, +1234567890<br>
                Jane Smith, HR Director, jane@company.com, +0987654321
            </p>
        </div>
        <form id="bulk-contacts-form">
            <div class="form-group">
                <label>Contact List (CSV Format)</label>
                <textarea id="contacts-bulk-data" rows="10" placeholder="John Doe, QA Manager, john@company.com, +1234567890
Jane Smith, HR Director, jane@company.com, +0987654321
Bob Johnson, Production Head, bob@company.com," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="contacts-replace" style="width: auto;">
                    Replace existing contacts (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
        () => {
            const bulkData = document.getElementById('contacts-bulk-data').value.trim();
            const replace = document.getElementById('contacts-replace').checked;

            if (!bulkData) {
                window.showNotification('Please enter contact data', 'error');
                return;
            }

            const lines = bulkData.split('\n').filter(line => line.trim());
            const newContacts = [];
            let errors = 0;

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1 && parts[0]) {
                    newContacts.push({
                        name: parts[0],
                        designation: parts[1] || '',
                        email: parts[2] || '',
                        phone: parts[3] || ''
                    });
                } else {
                    errors++;
                }
            });

            if (newContacts.length === 0) {
                window.showNotification('No valid contacts found in the data', 'error');
                return;
            }

            if (replace) {
                client.contacts = newContacts;
            } else {
                if (!client.contacts) client.contacts = [];
                client.contacts.push(...newContacts);
            }

            window.saveData();
            window.closeModal();
            window.setSetupWizardStep(clientId, 5);

            const message = `${newContacts.length} contact(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
            window.showNotification(message);
        }
    );
};

// Helper function to initiate audit planning from client detail page
// Helper function to initiate audit planning from client detail page
window.initiateAuditPlanFromClient = function (clientId) {
    // Navigate to Audit Planning module
    window.renderModule('planning');

    const client = window.window.state.clients.find(c => c.id === clientId);
    const clientName = client ? client.name : '';

    if (!clientName) return;

    // Wait for the module to load, then open the create plan modal with client pre-selected
    setTimeout(() => {
        if (typeof window.openCreatePlanModal === 'function') {
            window.openCreatePlanModal();

            // Pre-select the client after modal opens
            setTimeout(() => {
                const clientSelect = document.getElementById('plan-client');
                if (clientSelect) {
                    clientSelect.value = clientName;
                    // Trigger change event to populate client details
                    const event = new Event('change');
                    clientSelect.dispatchEvent(event);
                }
            }, 100);
        }
    }, 200);
};

// Department Management Functions
function addDepartment(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Add Department',
        `
        <form id="dept-form">
            <div class="form-group">
                <label>Department Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" id="dept-name" placeholder="e.g., Quality Assurance" required>
            </div>
            <div class="form-group">
                <label>Head of Department</label>
                <input type="text" id="dept-head" placeholder="e.g., John Doe">
            </div>
        </form >
    `,
        () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                window.showNotification('Department name is required', 'error');
                return;
            }

            const department = {
                name,
                head: document.getElementById('dept-head').value.trim()
            };

            if (!client.departments) client.departments = [];
            client.departments.push(department);

            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            renderClientTab(client, 'departments');
            window.showNotification('Department added successfully');
        }
    );
}

function editDepartment(clientId, deptIndex) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const dept = client.departments[deptIndex];

    window.openModal(
        'Edit Department',
        `
        <form id="dept-form">
            <div class="form-group">
                <label>Department Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" id="dept-name" value="${dept.name}" required>
            </div>
            <div class="form-group">
                <label>Head of Department</label>
                <input type="text" id="dept-head" value="${dept.head || ''}">
            </div>
        </form >
    `,
        () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                window.showNotification('Department name is required', 'error');
                return;
            }

            client.departments[deptIndex] = {
                name,
                head: document.getElementById('dept-head').value.trim()
            };

            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            renderClientTab(client, 'departments');
            window.showNotification('Department updated successfully');
        }
    );
}

function deleteDepartment(clientId, deptIndex) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const dept = client.departments[deptIndex];

    if (confirm(`Are you sure you want to delete the department "${dept.name}" ? `)) {
        client.departments.splice(deptIndex, 1);
        window.saveData();
        renderClientDetail(clientId);
        renderClientTab(client, 'departments');
        window.showNotification('Department deleted successfully');
    }
}

function bulkUploadDepartments(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Departments',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste department list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Department Name, Head of Department<br>
                Quality Assurance, John Doe<br>
                Production, Jane Smith<br>
                Human Resources, Bob Johnson
            </p>
        </div>
        <form id="bulk-dept-form">
            <div class="form-group">
                <label>Department List (CSV Format)</label>
                <textarea id="dept-bulk-data" rows="10" placeholder="Quality Assurance, John Doe, 15
Production, Jane Smith, 50
Human Resources, Bob Johnson, 8" style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="dept-replace" style="width: auto;">
                    Replace existing departments (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
        () => {
            const bulkData = document.getElementById('dept-bulk-data').value.trim();
            const replace = document.getElementById('dept-replace').checked;

            if (!bulkData) {
                window.showNotification('Please enter department data', 'error');
                return;
            }

            const lines = bulkData.split('\n').filter(line => line.trim());
            const newDepartments = [];
            let errors = 0;

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1 && parts[0]) {
                    newDepartments.push({
                        name: parts[0],
                        head: parts[1] || '',
                        employeeCount: parseInt(parts[2]) || 0
                    });
                } else {
                    errors++;
                }
            });

            if (newDepartments.length === 0) {
                window.showNotification('No valid departments found in the data', 'error');
                return;
            }

            if (replace) {
                client.departments = newDepartments;
            } else {
                if (!client.departments) client.departments = [];
                client.departments.push(...newDepartments);
            }

            window.saveData();
            window.closeModal();
            window.setSetupWizardStep(clientId, 3);


            const message = `${newDepartments.length} department(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
            window.showNotification(message);
        }
    );
}

// Export department functions
window.addDepartment = addDepartment;
window.editDepartment = editDepartment;
window.deleteDepartment = deleteDepartment;
window.bulkUploadDepartments = bulkUploadDepartments;

// ============================================
// GOODS/SERVICES CRUD FUNCTIONS
// ============================================
window.addGoodsService = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal('Add Goods/Service', `
        <form id="goods-form">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="goods-name" required placeholder="e.g., Industrial Components">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="goods-category">
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="goods-desc" rows="3" placeholder="Brief description..."></textarea>
            </div>
        </form>
    `, () => {
        const name = document.getElementById('goods-name').value.trim();
        if (!name) { window.showNotification('Name is required', 'error'); return; }
        if (!client.goodsServices) client.goodsServices = [];
        client.goodsServices.push({ name, category: document.getElementById('goods-category').value, description: document.getElementById('goods-desc').value.trim() });
        window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 2);
        window.showNotification('Goods/Service added');
    });
};

window.editGoodsService = function (clientId, index) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.goodsServices || !client.goodsServices[index]) return;
    const item = client.goodsServices[index];
    window.openModal('Edit Goods/Service', `
        <form id="goods-form">
            <div class="form-group"><label>Name *</label><input type="text" id="goods-name" value="${window.UTILS.escapeHtml(item.name)}" required></div>
            <div class="form-group"><label>Category</label><select id="goods-category"><option value="Product" ${item.category === 'Product' ? 'selected' : ''}>Product</option><option value="Service" ${item.category === 'Service' ? 'selected' : ''}>Service</option></select></div>
            <div class="form-group"><label>Description</label><textarea id="goods-desc" rows="3">${window.UTILS.escapeHtml(item.description || '')}</textarea></div>
        </form>
    `, () => {
        client.goodsServices[index] = { name: document.getElementById('goods-name').value.trim(), category: document.getElementById('goods-category').value, description: document.getElementById('goods-desc').value.trim() };
        window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 2);
        window.showNotification('Goods/Service updated');
    });
};

window.deleteGoodsService = function (clientId, index) {
    if (!confirm('Delete this item?')) return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.goodsServices) { client.goodsServices.splice(index, 1); window.saveData(); window.setSetupWizardStep(clientId, 6); window.showNotification('Goods/Service deleted'); }
};

// Bulk Upload Goods/Services
window.bulkUploadGoodsServices = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Goods & Services',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste goods/services list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Name, Category, Description<br>
                Steel Components, Goods, High-grade steel parts<br>
                Consulting Services, Services, ISO implementation support<br>
                Machined Parts, Goods, Precision CNC components
            </p>
        </div>
        <form id="bulk-goods-form">
            <div class="form-group">
                <label>Goods/Services List (CSV Format)</label>
                <textarea id="goods-bulk-data" rows="10" placeholder="Steel Components, Goods, High-grade steel parts
Consulting Services, Services, ISO implementation support
Machined Parts, Goods, Precision CNC components" style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="goods-replace" style="width: auto;">
                    Replace existing items (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
        () => {
            const bulkData = document.getElementById('goods-bulk-data').value.trim();
            const replace = document.getElementById('goods-replace').checked;

            if (!bulkData) {
                window.showNotification('Please enter goods/services data', 'error');
                return;
            }

            const lines = bulkData.split('\n').filter(line => line.trim());
            const newItems = [];
            let errors = 0;

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1 && parts[0]) {
                    newItems.push({
                        name: parts[0],
                        category: parts[1] || 'Goods',
                        description: parts[2] || ''
                    });
                } else {
                    errors++;
                }
            });

            if (newItems.length === 0) {
                window.showNotification('No valid items found in the data', 'error');
                return;
            }

            if (replace) {
                client.goodsServices = newItems;
            } else {
                if (!client.goodsServices) client.goodsServices = [];
                client.goodsServices.push(...newItems);
            }

            window.saveData();
            window.closeModal();
            window.setSetupWizardStep(clientId, 6);

            const message = `${newItems.length} item(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
            window.showNotification(message);
        }
    );
};

// ============================================
// KEY PROCESSES CRUD FUNCTIONS
// ============================================
window.addKeyProcess = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;
    window.openModal('Add Key Process', `
        <form id="process-form">
            <div class="form-group"><label>Process Name *</label><input type="text" id="process-name" required placeholder="e.g., Production Planning"></div>
            <div class="form-group"><label>Category</label><select id="process-category"><option value="Core">Core Process</option><option value="Support">Support Process</option></select></div>
            <div class="form-group"><label>Process Owner</label><input type="text" id="process-owner" placeholder="e.g., Operations Manager"></div>
        </form>
    `, () => {
        const name = document.getElementById('process-name').value.trim();
        if (!name) { window.showNotification('Process name is required', 'error'); return; }
        if (!client.keyProcesses) client.keyProcesses = [];
        client.keyProcesses.push({ name, category: document.getElementById('process-category').value, owner: document.getElementById('process-owner').value.trim() });
        window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 3);
        window.showNotification('Process added');
    });
};

window.editKeyProcess = function (clientId, index) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.keyProcesses || !client.keyProcesses[index]) return;
    const proc = client.keyProcesses[index];
    window.openModal('Edit Key Process', `
        <form id="process-form">
            <div class="form-group"><label>Process Name *</label><input type="text" id="process-name" value="${window.UTILS.escapeHtml(proc.name)}" required></div>
            <div class="form-group"><label>Category</label><select id="process-category"><option value="Core" ${proc.category === 'Core' ? 'selected' : ''}>Core Process</option><option value="Support" ${proc.category === 'Support' ? 'selected' : ''}>Support Process</option></select></div>
            <div class="form-group"><label>Process Owner</label><input type="text" id="process-owner" value="${window.UTILS.escapeHtml(proc.owner || '')}"></div>
        </form>
    `, () => {
        client.keyProcesses[index] = { name: document.getElementById('process-name').value.trim(), category: document.getElementById('process-category').value, owner: document.getElementById('process-owner').value.trim() };
        window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 3);
        window.showNotification('Process updated');
    });
};

window.deleteKeyProcess = function (clientId, index) {
    if (!confirm('Delete this process?')) return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.keyProcesses) { client.keyProcesses.splice(index, 1); window.saveData(); window.setSetupWizardStep(clientId, 7); window.showNotification('Process deleted'); }
};

// Bulk Upload Key Processes
window.bulkUploadKeyProcesses = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Key Processes',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste process list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Process Name, Category, Owner<br>
                Production Planning, Core, John Doe<br>
                Quality Control, Core, Jane Smith<br>
                Maintenance, Support, Bob Johnson
            </p>
        </div>
        <form id="bulk-process-form">
            <div class="form-group">
                <label>Process List (CSV Format)</label>
                <textarea id="process-bulk-data" rows="10" placeholder="Production Planning, Core, John Doe
Quality Control, Core, Jane Smith
Maintenance, Support, Bob Johnson
HR Management, Support," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="process-replace" style="width: auto;">
                    Replace existing processes (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
        () => {
            const bulkData = document.getElementById('process-bulk-data').value.trim();
            const replace = document.getElementById('process-replace').checked;

            if (!bulkData) {
                window.showNotification('Please enter process data', 'error');
                return;
            }

            const lines = bulkData.split('\n').filter(line => line.trim());
            const newProcesses = [];
            let errors = 0;

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1 && parts[0]) {
                    newProcesses.push({
                        name: parts[0],
                        category: parts[1] || 'Support',
                        owner: parts[2] || ''
                    });
                } else {
                    errors++;
                }
            });

            if (newProcesses.length === 0) {
                window.showNotification('No valid processes found in the data', 'error');
                return;
            }

            if (replace) {
                client.keyProcesses = newProcesses;
            } else {
                if (!client.keyProcesses) client.keyProcesses = [];
                client.keyProcesses.push(...newProcesses);
            }

            window.saveData();
            window.closeModal();
            window.setSetupWizardStep(clientId, 7);

            const message = `${newProcesses.length} process(es) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
            window.showNotification(message);
        }
    );
};

// ============================================
// DESIGNATIONS CRUD FUNCTIONS
// ============================================
window.addDesignation = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;
    const deptOptions = (client.departments || []).map(d => `<option value="${window.UTILS.escapeHtml(d.name)}">${window.UTILS.escapeHtml(d.name)}</option>`).join('');
    window.openModal('Add Designation', `
        <form id="des-form">
            <div class="form-group"><label>Job Title *</label><input type="text" id="des-title" required placeholder="e.g., Quality Manager"></div>
            <div class="form-group"><label>Department (Optional)</label><select id="des-dept"><option value="">-- Not Assigned --</option>${deptOptions}</select></div>
        </form>
    `, () => {
        const title = document.getElementById('des-title').value.trim();
        if (!title) { window.showNotification('Job title is required', 'error'); return; }
        if (!client.designations) client.designations = [];
        client.designations.push({ title, department: document.getElementById('des-dept').value });
        window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 6);
        window.showNotification('Designation added');
    });
};

window.deleteDesignation = function (clientId, index) {
    if (!confirm('Delete this designation?')) return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.designations) { client.designations.splice(index, 1); window.saveData(); window.setSetupWizardStep(clientId, 4); window.showNotification('Designation deleted'); }
};

// Bulk Upload Designations
window.bulkUploadDesignations = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Designations',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste designation list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Designation Title, Department<br>
                QA Manager, Quality Assurance<br>
                Production Head, Production<br>
                HR Officer, Human Resources
            </p>
        </div>
        <form id="bulk-designation-form">
            <div class="form-group">
                <label>Designation List (CSV Format)</label>
                <textarea id="designation-bulk-data" rows="10" placeholder="QA Manager, Quality Assurance
Production Head, Production
HR Officer, Human Resources
CEO,
CFO," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="designation-replace" style="width: auto;">
                    Replace existing designations (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
        () => {
            const bulkData = document.getElementById('designation-bulk-data').value.trim();
            const replace = document.getElementById('designation-replace').checked;

            if (!bulkData) {
                window.showNotification('Please enter designation data', 'error');
                return;
            }

            const lines = bulkData.split('\n').filter(line => line.trim());
            const newDesignations = [];
            let errors = 0;

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1 && parts[0]) {
                    newDesignations.push({
                        title: parts[0],
                        department: parts[1] || ''
                    });
                } else {
                    errors++;
                }
            });

            if (newDesignations.length === 0) {
                window.showNotification('No valid designations found in the data', 'error');
                return;
            }

            if (replace) {
                client.designations = newDesignations;
            } else {
                if (!client.designations) client.designations = [];
                client.designations.push(...newDesignations);
            }

            window.saveData();
            window.closeModal();
            window.setSetupWizardStep(clientId, 4);

            const message = `${newDesignations.length} designation(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
            window.showNotification(message);
        }
    );
};

// Company Profile Functions
function generateCompanyProfile(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client || !client.website) {
        window.showNotification('Website URL is required for AI generation', 'error');
        return;
    }

    // Show loading notification
    window.showNotification('Generating company profile from website...', 'info');

    // Simulated AI generation (in production, this would call an API)
    setTimeout(() => {
        // Save previous version to history
        if (client.profile) {
            if (!client.profileHistory) client.profileHistory = [];
            client.profileHistory.push({
                content: client.profile,
                updatedAt: client.profileUpdated || new Date().toISOString(),
                updatedBy: 'System',
                method: 'Manual'
            });
        }

        // Generate a professional company profile based on available data
        const parts = [];

        parts.push(`${client.name} - Company Overview`);
        parts.push(`\nIndustry: ${client.industry || 'Not specified'}`);
        parts.push(`Website: ${client.website}`);
        parts.push(`\nAbout the Organization:`);
        parts.push(`${client.name} is a ${client.industry || 'professional'} organization ${client.employees ? `with approximately ${client.employees} employees` : ''} ${client.sites && client.sites.length > 1 ? `operating across ${client.sites.length} locations` : 'operating from a single location'}.`);

        if (client.standard) {
            parts.push(`\nThe organization maintains certification to ${client.standard} standards, demonstrating its commitment to quality management and continuous improvement.`);
        }

        if (client.sites && client.sites.length > 0) {
            parts.push(`\nOperational Locations:`);
            client.sites.forEach(s => {
                parts.push(`• ${s.name}${s.city ? ` - ${s.city}` : ''}${s.employees ? ` (${s.employees} employees)` : ''}`);
            });
        }

        if (client.departments && client.departments.length > 0) {
            parts.push(`\nKey Departments:`);
            client.departments.forEach(d => {
                parts.push(`• ${d.name}${d.head ? ` - Led by ${d.head}` : ''}${d.employeeCount ? ` (${d.employeeCount} staff)` : ''}`);
            });
        }

        if (client.shifts === 'Yes') {
            parts.push(`\nThe organization operates multiple shifts to ensure continuous operations and meet customer demands.`);
        }

        parts.push(`\nThis profile provides context for audit activities and helps auditors understand the organizational structure and scope of operations.`);
        parts.push(`\n---`);
        parts.push(`Note: This profile was AI-generated from available client data. Please review and edit as needed to ensure accuracy.`);

        const profile = parts.join('\n');

        // Save the generated profile
        client.profile = profile;
        client.profileUpdated = new Date().toISOString();

        // ============================================
        // AI-GENERATE GOODS/SERVICES (Based on Industry)
        // ============================================
        const industryGoods = {
            'Manufacturing': [
                { name: 'Industrial Components', category: 'Product', description: 'Manufacturing of precision components' },
                { name: 'Assembly Services', category: 'Service', description: 'Product assembly and integration' },
                { name: 'Custom Fabrication', category: 'Product', description: 'Custom metal/plastic fabrication' }
            ],
            'IT Services': [
                { name: 'Software Development', category: 'Service', description: 'Custom software solutions' },
                { name: 'Cloud Services', category: 'Service', description: 'Cloud infrastructure and hosting' },
                { name: 'IT Support', category: 'Service', description: 'Technical support and maintenance' }
            ],
            'Healthcare': [
                { name: 'Medical Devices', category: 'Product', description: 'Healthcare equipment and devices' },
                { name: 'Patient Care', category: 'Service', description: 'Clinical and patient care services' },
                { name: 'Laboratory Services', category: 'Service', description: 'Diagnostic and testing services' }
            ],
            'Food Processing': [
                { name: 'Processed Foods', category: 'Product', description: 'Ready-to-eat food products' },
                { name: 'Raw Materials', category: 'Product', description: 'Agricultural inputs and ingredients' },
                { name: 'Packaging Services', category: 'Service', description: 'Food packaging and labeling' }
            ],
            'default': [
                { name: 'Primary Product/Service', category: 'Product', description: 'Main offering - please update' },
                { name: 'Secondary Service', category: 'Service', description: 'Support service - please update' }
            ]
        };
        client.goodsServices = industryGoods[client.industry] || industryGoods['default'];

        // ============================================
        // AI-GENERATE KEY PROCESSES
        // ============================================
        const industryProcesses = {
            'Manufacturing': [
                { name: 'Design & Development', category: 'Core', owner: '' },
                { name: 'Production Planning', category: 'Core', owner: '' },
                { name: 'Manufacturing Operations', category: 'Core', owner: '' },
                { name: 'Quality Control', category: 'Core', owner: '' },
                { name: 'Procurement', category: 'Support', owner: '' },
                { name: 'Warehouse & Logistics', category: 'Support', owner: '' }
            ],
            'IT Services': [
                { name: 'Requirements Analysis', category: 'Core', owner: '' },
                { name: 'Software Development', category: 'Core', owner: '' },
                { name: 'Testing & QA', category: 'Core', owner: '' },
                { name: 'Deployment & Release', category: 'Core', owner: '' },
                { name: 'Customer Support', category: 'Support', owner: '' },
                { name: 'Infrastructure Management', category: 'Support', owner: '' }
            ],
            'default': [
                { name: 'Order Management', category: 'Core', owner: '' },
                { name: 'Service Delivery', category: 'Core', owner: '' },
                { name: 'Quality Assurance', category: 'Core', owner: '' },
                { name: 'Human Resources', category: 'Support', owner: '' },
                { name: 'Finance & Administration', category: 'Support', owner: '' }
            ]
        };
        client.keyProcesses = industryProcesses[client.industry] || industryProcesses['default'];

        // ============================================
        // AI-GENERATE COMMON DESIGNATIONS
        // ============================================
        client.designations = client.designations || [];
        if (client.designations.length === 0) {
            client.designations = [
                { title: 'Managing Director', department: '' },
                { title: 'Quality Manager', department: 'Quality' },
                { title: 'Operations Manager', department: 'Operations' },
                { title: 'HR Manager', department: 'Human Resources' },
                { title: 'Management Representative (MR)', department: '' }
            ];
        }

        window.saveData();
        renderClientDetail(clientId);
        window.setSetupWizardStep(clientId, 1);
        window.showNotification('Organization data generated successfully! Review Goods/Services and Key Processes.', 'success');
    }, 1500); // Simulate API delay
}

function editCompanyProfile(clientId) {
    // RBAC Check
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') {
        window.showNotification('Access Denied', 'error');
        return;
    }

    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const currentProfile = client.profile || '';

    window.openModal(
        'Edit Company Profile',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-solid fa-info-circle"></i> Write a comprehensive overview of the organization. This will be included in audit reports.
            </p>
        </div>
        <form id="profile-form">
            <div class="form-group">
                <label>Company Profile / Organization Overview</label>
                <textarea id="profile-text" rows="15" placeholder="Enter company profile, including:
- Company background and history
- Industry and market position
- Products/services offered
- Organizational structure
- Key operational locations
- Management system certifications
- Quality objectives and commitments">${currentProfile}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                <div><i class="fa-solid fa-lightbulb"></i> Be concise but comprehensive</div>
                <div><i class="fa-solid fa-check"></i> Focus on audit-relevant information</div>
            </div>
        </form>
        `,
        () => {
            const profileText = document.getElementById('profile-text').value.trim();

            client.profile = profileText;
            client.profileUpdated = new Date().toISOString();

            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            renderClientTab(client, 'profile');
            window.showNotification('Company profile updated successfully');
        }
    );
}

// Export department functions
window.addDepartment = addDepartment;
window.editDepartment = editDepartment;
window.deleteDepartment = deleteDepartment;
window.bulkUploadDepartments = bulkUploadDepartments;

// Export profile functions
window.generateCompanyProfile = generateCompanyProfile;
window.editCompanyProfile = editCompanyProfile;

// Upload Company Profile Document
window.uploadCompanyProfileDoc = async function (clientId, file) {
    // RBAC Check
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') {
        window.showNotification('Access Denied', 'error');
        return;
    }

    if (!file) return;

    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
        window.showNotification('Please upload a PDF, Word document, or text file', 'error');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        window.showNotification('File size must be less than 10MB', 'error');
        return;
    }

    window.showNotification('Processing document...', 'info');

    try {
        // Read file content
        const reader = new FileReader();
        reader.onload = async function (e) {
            const fileContent = e.target.result;

            // Store document metadata
            client.profileDocument = {
                name: file.name,
                type: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString()
            };

            // For text files, extract content directly
            if (file.type === 'text/plain') {
                client.profileDocumentText = fileContent;
            } else {
                // For PDF/DOC, store base64 and note that text extraction may be limited
                client.profileDocumentBase64 = fileContent.split(',')[1]; // Remove data URL prefix
                client.profileDocumentText = `[Content from uploaded document: ${file.name}]\n\nNote: For best results, please use the "Edit Manually" option to paste the key information from your company profile document, or use "AI Generate" if you have a website configured.`;
            }

            window.saveData();

            // Refresh the view
            if (window.setSetupWizardStep) {
                window.setSetupWizardStep(clientId, 1);
            } else {
                renderClientDetail(clientId);
            }

            window.showNotification(`Document "${file.name}" uploaded successfully! You can now use AI Generate to create a profile summary.`, 'success');
        };

        if (file.type === 'text/plain') {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    } catch (error) {
        console.error('Error uploading document:', error);
        window.showNotification('Error uploading document. Please try again.', 'error');
    }
};

// Remove Profile Document
window.removeProfileDocument = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm('Are you sure you want to remove the uploaded document?')) {
        delete client.profileDocument;
        delete client.profileDocumentText;
        delete client.profileDocumentBase64;

        window.saveData();

        // Refresh the view
        if (window.setSetupWizardStep) {
            window.setSetupWizardStep(clientId, 1);
        } else {
            renderClientDetail(clientId);
        }

        window.showNotification('Document removed', 'success');
    }
};

// ============================================
// ISO 17021-1 CLIENT COMPLIANCE FUNCTIONS
// ============================================

window.updateClientApplicationStatus = function (clientId, newStatus) {
    const client = window.window.state.clients.find(c => c.id === clientId);
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
    const client = window.window.state.clients.find(c => c.id === clientId);
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
    const client = window.window.state.clients.find(c => c.id === clientId);
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
    const client = window.window.state.clients.find(c => c.id === clientId);
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
                <input type="text" id="change-reported-by" class="form-control" value="${window.window.state.currentUser?.name || ''}" placeholder="Who reported this change?">
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
// BULK IMPORT / EXPORT FUNCTIONS
// ============================================

function getClientOrgSetupHTML(client) {
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
                    <!-- Background Line -->
                    <div style="position: absolute; top: 24px; left: 0; right: 0; height: 3px; background: #e2e8f0; z-index: 1;"></div>
                    <!-- Active Progress Line -->
                    <div style="position: absolute; top: 24px; left: 0; width: ${progressWidth}%; height: 3px; background: var(--primary-color); z-index: 2; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    
                    ${steps.map(step => `
                        <div style="position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; cursor: pointer;" onclick="window.setSetupWizardStep(${client.id}, ${step.id})">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: ${currentStep >= step.id ? 'var(--primary-color)' : '#fff'}; border: 3px solid ${currentStep >= step.id ? 'var(--primary-color)' : '#e2e8f0'}; color: ${currentStep >= step.id ? '#fff' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: all 0.3s ease; box-shadow: ${currentStep === step.id ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none'};">
                                <i class="fa-solid ${step.icon}"></i>
                            </div>
                            <span style="margin-top: 0.75rem; font-size: 0.85rem; font-weight: ${currentStep === step.id ? '600' : '500'}; color: ${currentStep >= step.id ? 'var(--text-primary)' : '#94a3b8'};">${step.title}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="text-align: center;">
                    <h2 style="margin: 0; font-size: 1.5rem; color: var(--primary-color);">${steps[currentStep - 1].title}${currentStep === 1 ? '' : ' Setup'}</h2>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.9rem;">
                        ${currentStep === 1 ? 'Define the objects and context of the client group.' : `Step ${currentStep} of ${steps.length}: Finalize organization boundaries and entities.`}
                    </p>
                </div>
            </div>

            <!-- Wizard Content -->
            <div id="org-setup-content" style="padding: 2rem; min-height: 400px; background: #fff;">
                ${getClientOrgSetupHTML.renderWizardStep(client, currentStep)}
            </div>

            <!-- Wizard Footer / Navigation -->
            <div style="padding: 1.5rem 2rem; background: #f8fafc; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-secondary" onclick="window.setSetupWizardStep(${client.id}, ${currentStep - 1})" ${currentStep === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Previous
                </button>
                
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${currentStep === steps.length ? '<i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 0.5rem;"></i> Setup Complete' : `Next: ${steps[currentStep]?.title || ''}`}
                    </span>
                    ${currentStep < steps.length ? `
                        <button class="btn btn-primary" onclick="window.setSetupWizardStep(${client.id}, ${currentStep + 1})">
                            Next Stage <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="window.showNotification('Organization setup finalized successfully!', 'success'); window.switchClientDetailTab(${client.id}, 'scopes');">
                            Finalize & View Scopes <i class="fa-solid fa-flag-checkered" style="margin-left: 0.5rem;"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>

        <div style="margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a; display: flex; gap: 1rem; align-items: center;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="fa-solid fa-shield-check"></i>
            </div>
            <p style="margin: 0; font-size: 0.85rem; color: #92400e; line-height: 1.5;">
                <strong>Certification Standard Notice:</strong> As a Certification Manager, ensuring the accuracy of sites, departments, and personnel 
                is a mandatory requirement under <strong>ISO/IEC 17021-1</strong>. This data directly influences the audit duration and sampling plan.
            </p>
        </div>
    `;
}

// Helper to render the specific step content
getClientOrgSetupHTML.renderWizardStep = function (client, step) {
    switch (step) {
        case 1: return getClientProfileHTML(client);
        case 2: return getClientSitesHTML(client);
        case 3: return getClientDepartmentsHTML(client);
        case 4: return getClientDesignationsHTML(client);
        case 5: return getClientContactsHTML(client);
        case 6: return getClientGoodsServicesHTML(client);
        case 7: return getClientKeyProcessesHTML(client);
        default: return getClientProfileHTML(client);
    }
};

window.setSetupWizardStep = function (clientId, step) {
    if (step < 1 || step > 7) return;
    const client = window.state.clients.find(c => c.id === clientId);
    if (client) {
        client._wizardStep = step;
        const tabContent = document.getElementById('tab-content');
        if (tabContent) {
            tabContent.innerHTML = getClientOrgSetupHTML(client);
        }
    }
};

function getClientCertificatesHTML(client) {
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
                    <i class="fa-solid fa-sync" style="margin-right: 0.25rem;"></i> Refresh from Sites
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
                             <button class="btn btn-sm btn-outline" style="margin-bottom: 0.5rem;">
                                <i class="fa-solid fa-history"></i> Revision History
                             </button>
                             <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Current Rev: <strong>${cert.revision || '00'}</strong>
                             </div>
                        </div>
                    </div>

                    <!-- Main Scope -->
                    <div style="margin-bottom: 1.5rem;">
                        <label style="font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">Global / Main Scope Text (Fallback)</label>
                        <textarea class="form-control" rows="2" 
                            onchange="window.updateCertField(${client.id}, ${index}, 'scope', this.value)"
                            placeholder="Enter the main scope statement...">${cert.scope || ''}</textarea>
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
}

window.generateCertificatesFromStandards = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
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
                standard: std,
                certificateNo: '',
                status: 'Active',
                revision: '00',
                scope: client.scope || '', // Default global scope
                siteScopes: {}
            });
        }
    });

    window.saveData();
    renderClientDetail(clientId);
    // Switch to scopes tab
    setTimeout(() => {
        document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
    }, 100);
    window.showNotification('Certificate records generated');
};

window.updateCertField = function (clientId, certIndex, field, value) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.certificates && client.certificates[certIndex]) {
        client.certificates[certIndex][field] = value;
        // Autosave turned off to allow bulk edits, but for single inputs we might want to save?
        // Let's rely on the explicit "Save" button for major changes, but keep local state updated.
    }
};

window.updateSiteScope = function (clientId, certIndex, siteName, value) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (client && client.certificates && client.certificates[certIndex]) {
        if (!client.certificates[certIndex].siteScopes) {
            client.certificates[certIndex].siteScopes = {};
        }
        client.certificates[certIndex].siteScopes[siteName] = value;
    }
};

window.saveCertificateDetails = function (clientId) {
    window.saveData();
    window.showNotification('Certificate details and scopes saved successfully', 'success');
};

// Sub-Tab Switching for Org Setup
window.switchClientOrgSubTab = function (btn, subTabId, clientId) {
    const client = window.window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    // UI Feedback
    const container = btn.parentElement;
    container.querySelectorAll('.sub-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--text-secondary)';
        b.style.borderBottom = 'none';
        b.style.fontWeight = 'normal';
    });
    btn.classList.add('active');
    btn.style.color = 'var(--primary-color)';
    btn.style.borderBottom = '2px solid var(--primary-color)';
    btn.style.fontWeight = '500';

    // Content Switching
    const contentArea = document.getElementById('org-setup-content');
    if (!contentArea) return;

    if (subTabId === 'certificates') {
        contentArea.innerHTML = getClientCertificatesHTML(client);
    } else if (subTabId === 'sites') {
        contentArea.innerHTML = getClientSitesHTML(client);
    } else if (subTabId === 'departments') {
        contentArea.innerHTML = getClientDepartmentsHTML(client);
    } else if (subTabId === 'contacts') {
        contentArea.innerHTML = getClientContactsHTML(client);
    }
};


// Update Template Download for New Column
window.downloadImportTemplate = function () {
    // 1. Define Sheets Data (Headers + Sample)
    const clientsData = [
        ["Client Name", "Status", "Industry", "Employee Count", "Website", "Next Audit Date"],
        ["Sample Corp", "Active", "Manufacturing", "100", "https://sample.com", "2025-01-01"],
        ["Tech Solutions Inc", "Active", "IT Services", "50", "https://techsol.com", "2025-03-15"]
    ];

    const certsData = [
        ["Client Name", "Standard", "Scope", "Status", "Certificate No", "Applicable Sites", "Initial Date", "Current Issue", "Expiry Date", "Revision No"],
        ["Sample Corp", "ISO 9001:2015", "Design and Manuf. of Widgets", "Active", "CERT-001", "Head Office", "2020-01-01", "2023-01-01", "2026-01-01", "01"],
        ["Tech Solutions Inc", "ISO 27001:2022", "Information Security Management System", "Active", "CERT-002", "HQ", "2021-05-10", "2024-05-10", "2027-05-09", "00"]
    ];

    const sitesData = [
        ["Client Name", "Site Name", "Address", "City", "Country", "Employees", "Shift Work", "Standards"],
        ["Sample Corp", "Head Office", "123 Main St", "New York", "USA", "80", "No", "ISO 9001:2015"],
        ["Sample Corp", "Factory", "456 Ind Park", "Chicago", "USA", "20", "Yes", "ISO 9001:2015"],
        ["Tech Solutions Inc", "HQ", "789 Tech Blvd", "San Francisco", "USA", "50", "No", "ISO 27001:2022"]
    ];

    const contactsData = [
        ["Client Name", "Full Name", "Designation", "Department", "Email", "Phone", "Role"],
        ["Sample Corp", "John Doe", "Quality Manager", "Quality", "john@sample.com", "555-0100", "Mgmt Rep"],
        ["Sample Corp", "Jane Smith", "Director", "Management", "jane@sample.com", "555-0101", "Director"],
        ["Tech Solutions Inc", "Alice Tech", "CTO", "Engineering", "alice@techsol.com", "555-9999", "Security Lead"]
    ];

    const deptsData = [
        ["Client Name", "Department Name", "Risk Level"],
        ["Sample Corp", "HR", "Low"],
        ["Sample Corp", "Production", "High"],
        ["Tech Solutions Inc", "Development", "High"],
        ["Tech Solutions Inc", "Support", "Medium"]
    ];

    const desigData = [
        ["Client Name", "Designation"],
        ["Sample Corp", "Manager"],
        ["Sample Corp", "Supervisor"],
        ["Tech Solutions Inc", "Developer"],
        ["Tech Solutions Inc", "Analyst"]
    ];

    const goodsData = [
        ["Client Name", "Name", "Category", "Description"],
        ["Sample Corp", "Widget A", "Product", "Main product line"],
        ["Tech Solutions Inc", "Cloud Hosting", "Service", "Managed hosting services"]
    ];

    const processData = [
        ["Client Name", "Process Name", "Category", "Owner"],
        ["Sample Corp", "Procurement", "Support", "Purchasing Manager"],
        ["Sample Corp", "Sales", "Core", "Sales Director"],
        ["Tech Solutions Inc", "Software Dev", "Core", "VP Engineering"],
        ["Tech Solutions Inc", "Incident Mgmt", "Core", "Ops Manager"]
    ];

    // 2. Create Workbook
    const wb = XLSX.utils.book_new();
    const wsClients = XLSX.utils.aoa_to_sheet(clientsData);
    const wsCerts = XLSX.utils.aoa_to_sheet(certsData);
    const wsSites = XLSX.utils.aoa_to_sheet(sitesData);
    const wsContacts = XLSX.utils.aoa_to_sheet(contactsData);
    const wsDepts = XLSX.utils.aoa_to_sheet(deptsData);
    const wsDesig = XLSX.utils.aoa_to_sheet(desigData);
    const wsGoods = XLSX.utils.aoa_to_sheet(goodsData);
    const wsProcs = XLSX.utils.aoa_to_sheet(processData);

    XLSX.utils.book_append_sheet(wb, wsClients, "Clients");
    XLSX.utils.book_append_sheet(wb, wsCerts, "Certificates");
    XLSX.utils.book_append_sheet(wb, wsSites, "Sites");
    XLSX.utils.book_append_sheet(wb, wsContacts, "Contacts");
    XLSX.utils.book_append_sheet(wb, wsDepts, "Departments");
    XLSX.utils.book_append_sheet(wb, wsDesig, "Designations");
    XLSX.utils.book_append_sheet(wb, wsGoods, "GoodsServices");
    XLSX.utils.book_append_sheet(wb, wsProcs, "KeyProcesses");

    // 3. Download
    XLSX.writeFile(wb, 'AuditCB_Global_Import_Template.xlsx');
};

// Update Import Logic for 'Applicable Sites'
window.importClientsFromExcel = function (file) {
    window.showNotification('Reading file...', 'info');
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Validate Sheets
            if (!workbook.Sheets['Clients']) throw new Error("Missing 'Clients' sheet");

            const clientsRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Clients']);
            const certsRaw = workbook.Sheets['Certificates'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Certificates']) : [];
            const sitesRaw = workbook.Sheets['Sites'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Sites']) : [];
            const contactsRaw = workbook.Sheets['Contacts'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Contacts']) : [];
            const deptsRaw = workbook.Sheets['Departments'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Departments']) : [];
            const desigRaw = workbook.Sheets['Designations'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Designations']) : [];
            const goodsRaw = workbook.Sheets['GoodsServices'] ? XLSX.utils.sheet_to_json(workbook.Sheets['GoodsServices']) : [];
            const procsRaw = workbook.Sheets['KeyProcesses'] ? XLSX.utils.sheet_to_json(workbook.Sheets['KeyProcesses']) : [];

            let importedCount = 0;
            let updatedCount = 0;

            clientsRaw.forEach(row => {
                const name = row['Client Name'];
                if (!name) return;

                // Check existing
                let client = window.window.state.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (client) {
                    updatedCount++;
                } else {
                    client = {
                        id: Date.now() + Math.floor(Math.random() * 1000), // Random ID
                        name: window.Sanitizer.sanitizeText(name),
                        certificates: [],
                        sites: [],
                        contacts: [],
                        departments: [],
                        designations: [],
                        goodsServices: [],
                        keyProcesses: []
                    };
                    window.window.state.clients.push(client);
                    importedCount++;
                }

                // Update Basic Fields
                client.status = window.Sanitizer.sanitizeText(row['Status'] || 'Active');
                client.industry = window.Sanitizer.sanitizeText(row['Industry'] || '');
                client.employees = parseInt(row['Employee Count']) || 0;
                client.website = window.Sanitizer.sanitizeText(row['Website'] || '');
                client.nextAudit = row['Next Audit Date'] || '';

                // Helper
                const clean = (val) => val ? String(val).trim() : '';

                // Process Linked Certificates
                const clientCerts = certsRaw.filter(c => c['Client Name'] === name);
                client.certificates = clientCerts.map(c => ({
                    standard: window.Sanitizer.sanitizeText(c['Standard']),
                    scope: window.Sanitizer.sanitizeText(c['Scope']),
                    status: window.Sanitizer.sanitizeText(c['Status']),
                    certificateNo: window.Sanitizer.sanitizeText(c['Certificate No']),
                    applicableSites: window.Sanitizer.sanitizeText(c['Applicable Sites'] || ''),
                    initialDate: c['Initial Date'],
                    currentIssue: c['Current Issue'],
                    expiryDate: c['Expiry Date'],
                    revision: window.Sanitizer.sanitizeText(c['Revision No'] || '00')
                }));

                // Backward Compatibility: derived fields
                if (client.certificates.length > 0) {
                    client.standard = client.certificates.map(c => c.standard).join(', ');
                    client.scope = client.certificates[0].scope; // Primary scope
                }

                // Process Linked Sites
                const clientSites = sitesRaw.filter(s => s['Client Name'] === name);
                client.sites = clientSites.map(s => ({
                    name: window.Sanitizer.sanitizeText(s['Site Name']),
                    address: window.Sanitizer.sanitizeText(s['Address']),
                    city: window.Sanitizer.sanitizeText(s['City']),
                    country: window.Sanitizer.sanitizeText(s['Country']),
                    employees: parseInt(s['Employees']) || 0,
                    shift: window.Sanitizer.sanitizeText(s['Shift Work'] || 'No'),
                    standards: window.Sanitizer.sanitizeText(s['Standards'] || '')
                }));

                // Process Linked Contacts
                const clientContacts = contactsRaw.filter(c => c['Client Name'] === name);
                client.contacts = clientContacts.map(c => ({
                    name: window.Sanitizer.sanitizeText(c['Full Name']),
                    designation: window.Sanitizer.sanitizeText(c['Designation']),
                    department: window.Sanitizer.sanitizeText(c['Department'] || ''),
                    email: window.Sanitizer.sanitizeText(c['Email']),
                    phone: window.Sanitizer.sanitizeText(c['Phone'] || ''),
                    role: window.Sanitizer.sanitizeText(c['Role'] || '')
                }));

                // Process Departments
                const clientDepts = deptsRaw.filter(d => d['Client Name'] === name);
                client.departments = clientDepts.map(d => ({
                    name: clean(d['Department Name']),
                    risk: clean(d['Risk Level']) || 'Medium',
                    head: ''
                }));

                // Process Designations
                const clientDesig = desigRaw.filter(d => d['Client Name'] === name);
                client.designations = clientDesig.map(d => clean(d['Designation']));

                // Process Goods/Services
                const clientGoods = goodsRaw.filter(g => g['Client Name'] === name);
                client.goodsServices = clientGoods.map(g => ({
                    name: clean(g['Name']),
                    category: clean(g['Category']),
                    description: clean(g['Description'])
                }));

                // Process Key Processes
                const clientProcs = procsRaw.filter(p => p['Client Name'] === name);
                client.keyProcesses = clientProcs.map(p => ({
                    name: clean(p['Process Name']),
                    category: clean(p['Category']),
                    owner: clean(p['Owner'])
                }));
            });

            window.saveData();
            window.showNotification(`Import Successful: ${importedCount} created, ${updatedCount} updated`, 'success');
            renderClientsEnhanced();

        } catch (err) {
            console.error(err);
            window.showNotification('Import Failed: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
};

// ============================================
// ACCOUNT SETUP BULK IMPORT (MASTER UPLOAD)
// ============================================

window.openImportAccountSetupModal = function (clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Import Account Setup',
        `
        <div style="text-align: center; margin-bottom: 2rem;">
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Upload a single Excel file containing multiple sheets to populate Sites, Departments, Designations, Personnel, Goods/Services, and Key Processes.
            </p>
            
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem;">
                <!-- Step 1: Download Template -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-file-excel" style="font-size: 2rem; color: #10b981; margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 1: Get Template</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Download valid Excel structure</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.downloadAccountSetupTemplate('${window.UTILS.escapeHtml(client.name)}')">
                        <i class="fa-solid fa-download"></i> Download Template
                    </button>
                </div>

                <!-- Step 2: Upload Data -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-upload" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 2: Upload File</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Select filled Excel file</p>
                    <label class="btn btn-primary btn-sm">
                        <input type="file" accept=".xlsx, .xls" style="display: none;" onchange="window.processAccountSetupImport(${clientId}, this)">
                        <i class="fa-solid fa-folder-open"></i> Select File
                    </label>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; text-align: left; font-size: 0.9rem;">
                <strong>Included Sheets:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary);">
                    <li>Sites</li>
                    <li>Departments</li>
                    <li>Designations</li>
                    <li>Personnel</li>
                    <li>GoodsServices</li>
                    <li>KeyProcesses</li>
                </ul>
            </div>
        </div>
        `
    );
    // Hide default Save button
    document.getElementById('modal-save').style.display = 'none';
};

window.downloadAccountSetupTemplate = function (clientName) {
    const wb = XLSX.utils.book_new();

    // 1. Sites Sheet
    const sitesData = [
        ["Site Name", "Address", "City", "Country", "Employees", "Shift (Yes/No)", "Standards"],
        ["Head Office", "123 Main St", "New York", "USA", "50", "No", "ISO 9001:2015"],
        ["Factory 1", "456 Industrial Rd", "Chicago", "USA", "200", "Yes", "ISO 9001:2015, ISO 14001:2015"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sitesData), "Sites");

    // 2. Departments Sheet
    const deptsData = [
        ["Department Name", "Risk Level"],
        ["HR", "Low"],
        ["Production", "High"],
        ["Quality", "Medium"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptsData), "Departments");

    // 3. Designations Sheet
    const desigData = [
        ["Designation"],
        ["Manager"],
        ["Supervisor"],
        ["Operator"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desigData), "Designations");

    // 4. Personnel Sheet
    const personnelData = [
        ["Name", "Designation", "Email", "Phone", "Role"],
        ["John Doe", "Manager", "john@example.com", "555-0101", "Management Rep"],
        ["Jane Smith", "Supervisor", "jane@example.com", "555-0102", "Audit Contact"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(personnelData), "Personnel");

    // 5. Goods/Services Sheet
    const goodsData = [
        ["Name", "Category", "Description"],
        ["Widget A", "Product", "Main product line"],
        ["Consulting", "Service", "Technical consultancy"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goodsData), "GoodsServices");

    // 6. Key Processes Sheet
    const processData = [
        ["Process Name", "Category", "Owner"],
        ["Procurement", "Support", "Purchasing Manager"],
        ["Manufacturing", "Core", "Production Manager"],
        ["Sales", "Core", "Sales Director"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(processData), "KeyProcesses");

    const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_Setup_Template.xlsx`;
    XLSX.writeFile(wb, fileName);
};

window.processAccountSetupImport = function (clientId, input) {
    // RBAC Check
    if (window.state.currentUser.role !== 'Certification Manager' && window.state.currentUser.role !== 'Admin') {
        window.showNotification('Access Denied: Only Certification Managers or Admins can perform this action.', 'error');
        return;
    }

    const file = input.files[0];
    if (!file) return;

    window.closeModal(); // Close modal immediately to show notification
    window.showNotification(`Reading ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const client = window.state.clients.find(c => c.id === clientId);

            if (!client) throw new Error("Client not found");

            let log = { sites: 0, depts: 0, desig: 0, people: 0, goods: 0, procs: 0 };

            // Helper to clean string
            const clean = (val) => val ? String(val).trim() : '';

            // 1. Process Sites
            if (workbook.Sheets['Sites']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Sites']);
                if (!client.sites) client.sites = [];
                rows.forEach(r => {
                    client.sites.push({
                        name: clean(r['Site Name']),
                        address: clean(r['Address']),
                        city: clean(r['City']),
                        country: clean(r['Country']),
                        employees: parseInt(r['Employees']) || 0,
                        shift: clean(r['Shift (Yes/No)']),
                        standards: clean(r['Standards'])
                    });
                });
                log.sites = rows.length;
            }

            // 2. Process Departments
            if (workbook.Sheets['Departments']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Departments']);
                if (!client.departments) client.departments = [];
                rows.forEach(r => {
                    const name = clean(r['Department Name']);
                    if (name && !client.departments.some(d => d.name === name)) {
                        client.departments.push({
                            name: name,
                            risk: clean(r['Risk Level']) || 'Medium',
                            head: '' // Not in template
                        });
                    }
                });
                log.depts = rows.length;
            }

            // 3. Process Designations
            if (workbook.Sheets['Designations']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Designations']);
                if (!client.designations) client.designations = [];
                rows.forEach(r => {
                    const desig = clean(r['Designation']);
                    if (desig && !client.designations.includes(desig)) {
                        client.designations.push(desig);
                    }
                });
                log.desig = rows.length;
            }

            // 4. Process Personnel
            if (workbook.Sheets['Personnel']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Personnel']);
                if (!client.contacts) client.contacts = [];
                rows.forEach(r => {
                    client.contacts.push({
                        name: clean(r['Name']),
                        designation: clean(r['Designation']),
                        email: clean(r['Email']),
                        phone: clean(r['Phone']),
                        role: clean(r['Role'])
                    });
                });
                log.people = rows.length;
            }

            // 5. Process Goods/Services
            if (workbook.Sheets['GoodsServices']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['GoodsServices']);
                if (!client.goodsServices) client.goodsServices = [];
                rows.forEach(r => {
                    client.goodsServices.push({
                        name: clean(r['Name']),
                        category: clean(r['Category']) || 'Product',
                        description: clean(r['Description'])
                    });
                });
                log.goods = rows.length;
            }

            // 6. Process Key Processes
            if (workbook.Sheets['KeyProcesses']) {
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets['KeyProcesses']);
                if (!client.keyProcesses) client.keyProcesses = [];
                rows.forEach(r => {
                    client.keyProcesses.push({
                        name: clean(r['Process Name']),
                        category: clean(r['Category']) || 'Core',
                        owner: clean(r['Owner'])
                    });
                });
                log.procs = rows.length;
            }

            window.saveData();
            renderClientDetail(clientId);
            window.showNotification(
                `Import Complete: ${log.sites} Sites, ${log.depts} Depts, ${log.desig} Roles, ${log.people} Staff, ${log.goods} Goods, ${log.procs} Processes`,
                'success'
            );

        } catch (err) {
            console.error('Import Error:', err);
            window.showNotification('Import Failed: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
};

// Exports
window.renderClientsModule = renderClientsEnhanced;
// Ensure other helpers are exposed if defined locally but used in HTML
if (typeof openNewClientModal !== 'undefined') window.openNewClientModal = openNewClientModal;

if (typeof initiateAuditPlanFromClient !== 'undefined') window.initiateAuditPlanFromClient = initiateAuditPlanFromClient;
if (typeof renderClientDetail !== 'undefined') window.renderClientDetail = renderClientDetail;

// Client Logo Upload Functions
window._tempClientLogo = '';

window.previewClientLogo = function (input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
        window.showNotification('Logo too large. Max 1MB', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        window._tempClientLogo = e.target.result;
        const preview = document.getElementById('client-logo-preview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">`;
        }
    };
    reader.readAsDataURL(file);
};

window.handleClientLogoUpload = function (input, clientId) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
        window.showNotification('Logo too large. Max 1MB', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (client) {
            client.logoUrl = e.target.result;
            window.saveData();
            const preview = document.getElementById('edit-client-logo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">`;
            }
            window.showNotification('Logo uploaded', 'success');
            // Update header if in client workspace
            updateClientWorkspaceHeader(clientId);
        }
    };
    reader.readAsDataURL(file);
};

function updateClientWorkspaceHeader(clientId) {
    const client = window.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const logoContainer = document.getElementById('cb-logo-display');
    if (logoContainer) {
        if (client.logoUrl) {
            logoContainer.innerHTML = `<img src="${client.logoUrl}" style="max-height: 40px; max-width: 180px; object-fit: contain;" alt="${client.name}">`;
        } else {
            logoContainer.innerHTML = `<i class="fa-solid fa-building" style="color: var(--primary-color);"></i><h1 style="font-size: 1rem;">${client.name.length > 20 ? client.name.substring(0, 20) + '...' : client.name}</h1>`;
        }
    }
}
window.updateClientWorkspaceHeader = updateClientWorkspaceHeader;

// ============================================
// CLIENT-LEVEL AUDITOR ASSIGNMENT FUNCTIONS
// ============================================

// Open modal to assign an auditor to this client
window.openClientAuditorAssignmentModal = function (clientId, clientName) {
    const client = window.state.clients.find(c => c.id == clientId);
    const auditors = window.state.auditors || [];
    const assignments = window.state.auditorAssignments || [];

    // Get auditors not yet assigned to this client
    const assignedAuditorIds = assignments
        .filter(a => a.clientId == clientId)
        .map(a => a.auditorId);
    const availableAuditors = auditors.filter(a => !assignedAuditorIds.includes(a.id));

    if (availableAuditors.length === 0) {
        window.showNotification('All auditors are already assigned to this client.', 'info');
        return;
    }

    document.getElementById('modal-title').textContent = `Assign Auditor to ${clientName}`;
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label>Select Auditor to Assign</label>
            <select id="client-assign-auditor" class="form-control" required>
                <option value="">-- Select Auditor --</option>
                ${availableAuditors.map(a => `<option value="${a.id}">${window.UTILS.escapeHtml(a.name)} (${a.role || 'Auditor'})</option>`).join('')}
            </select>
        </div>
        <div class="alert alert-info" style="margin-top: 1rem; padding: 0.75rem; background: #eff6ff; color: #1e40af; border-radius: 6px; border: 1px solid #bfdbfe;">
            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
            The selected auditor will be able to access this client's data, view audit plans, and submit reports.
        </div>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = function () {
        const auditorId = parseInt(document.getElementById('client-assign-auditor').value);

        if (!auditorId) {
            window.showNotification('Please select an auditor.', 'error');
            return;
        }

        // Initialize if not exists
        if (!window.state.auditorAssignments) {
            window.state.auditorAssignments = [];
        }

        // Add new assignment
        window.state.auditorAssignments.push({
            auditorId: auditorId,
            clientId: clientId,
            assignedBy: window.state.currentUser?.name || 'System',
            assignedAt: new Date().toISOString()
        });

        window.saveData();
        window.closeModal();

        // Refresh the wizard step to show updated team
        // Refresh the view and switch to Audit Team tab
        renderClientDetail(clientId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="audit_team"]')?.click();
        }, 100);

        const auditor = auditors.find(a => a.id == auditorId);
        window.showNotification(`${auditor?.name || 'Auditor'} assigned to ${clientName}`, 'success');
    };

    window.openModal();
};

// Remove auditor assignment from a client
window.removeClientAuditorAssignment = function (clientId, auditorId) {
    console.log('[removeClientAuditorAssignment] Called with:', {
        clientId,
        auditorId,
        typeC: typeof clientId,
        typeA: typeof auditorId
    });

    const client = window.state.clients.find(c => c.id == clientId);
    const auditor = window.state.auditors.find(a => a.id == auditorId);

    if (!client || !auditor) {
        console.error('[removeClientAuditorAssignment] Client or Auditor not found');
        window.showNotification('Error: Client or Auditor not found', 'error');
        return;
    }

    const confirmMsg = `Remove ${auditor.name} from ${client.name}?

Note: All audit history and records will be RETAINED. The auditor will still have access to past audits they participated in.`;

    if (confirm(confirmMsg)) {
        // Normalize IDs to strings for comparison
        const cid = String(clientId);
        const aid = String(auditorId);

        const initialLength = (window.state.auditorAssignments || []).length;

        console.log('[removeClientAuditorAssignment] Before filter:', {
            totalAssignments: initialLength,
            lookingFor: { cid, aid },
            allAssignments: window.state.auditorAssignments.map(a => ({
                clientId: a.clientId,
                auditorId: a.auditorId,
                clientIdStr: String(a.clientId),
                auditorIdStr: String(a.auditorId)
            }))
        });

        window.state.auditorAssignments = (window.state.auditorAssignments || []).filter(a => {
            const match = (String(a.clientId) === cid && String(a.auditorId) === aid);
            if (match) {
                console.log('[removeClientAuditorAssignment] Found matching assignment to remove:', a);
            }
            return !match; // Keep if NOT matching
        });

        const newLength = window.state.auditorAssignments.length;
        const removedCount = initialLength - newLength;

        console.log('[removeClientAuditorAssignment] After filter:', {
            removed: removedCount,
            remaining: newLength
        });

        if (removedCount === 0) {
            console.warn('[removeClientAuditorAssignment] No assignment found to remove!');
            window.showNotification('Could not find assignment to remove. Please refresh and try again.', 'error');
            return;
        }

        window.saveData();

        // Refresh the view and switch to Audit Team tab
        renderClientDetail(clientId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="audit_team"]')?.click();
        }, 100);

        window.showNotification(`${auditor.name} removed from ${client.name}. Historical records retained.`, 'success');
    }
};

// ============================================
// CLIENTS MODULE
// ============================================

function renderClientsEnhanced() {
    const state = window.state; // Use global state
    const searchTerm = state.clientSearchTerm || '';
    const filterStatus = state.clientFilterStatus || 'All';

    let filteredClients = state.clients.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const rows = filteredClients.map(client => `
        <tr class="client-row" data-client-id="${client.id}" style="cursor: pointer;">
            <td>${client.name}</td>
            <td>
                ${(client.standard || '').split(',').map(s =>
        `<span class="badge" style="background: #e0f2fe; color: #0284c7; margin-right: 4px; font-size: 0.75em;">${s.trim()}</span>`
    ).join('')}
            </td>
            <td><span class="status-badge status-${client.status.toLowerCase()}">${client.status}</span></td>
            <td>${client.nextAudit}</td>
            <td>
                <button class="btn btn-sm edit-client" data-client-id="${client.id}" style="color: var(--primary-color); margin-right: 0.5rem;"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-client" data-client-id="${client.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Client Management</h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleClientAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showClientAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showClientAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    ${window.addExportButtons ? window.addExportButtons('clients') : ''}
                    <button id="btn-new-client" class="btn btn-primary" style="white-space: nowrap;">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Client
                    </button>
                </div>
            </div>

            ${state.showClientAnalytics !== false ? `
            <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Clients -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-building"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Clients</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.clients.length}</div>
                    </div>
                </div>

                <!-- Active -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-check-circle"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Active</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.clients.filter(c => c.status === 'Active').length}</div>
                    </div>
                </div>

                 <!-- Suspended/Withdrawn -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-ban"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Inactive</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.clients.filter(c => ['Suspended', 'Withdrawn'].includes(c.status)).length}</div>
                    </div>
                </div>
                
                 <!-- Total Sites -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Sites</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.clients.reduce((acc, c) => acc + (c.sites ? c.sites.length : 1), 0)}</div>
                    </div>
                </div>
            </div>
            ` : ''}

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
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-new-client')?.addEventListener('click', openAddClientModal);

    document.getElementById('client-search')?.addEventListener('input', (e) => {
        state.clientSearchTerm = e.target.value;
        renderClientsEnhanced();
    });

    document.getElementById('client-filter')?.addEventListener('change', (e) => {
        state.clientFilterStatus = e.target.value;
        renderClientsEnhanced();
    });

    document.querySelectorAll('.view-client, .client-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-client')) {
                const clientId = parseInt(el.getAttribute('data-client-id'));
                renderClientDetail(clientId);
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clientId = parseInt(btn.getAttribute('data-client-id'));
            openEditClientModal(clientId);
        });
    });

    // Helper for toggle
    window.toggleClientAnalytics = function () {
        if (state.showClientAnalytics === undefined) state.showClientAnalytics = true;
        state.showClientAnalytics = !state.showClientAnalytics;
        renderClientsEnhanced();
    };
}

function renderClientDetail(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    // Calculate performance metrics
    const totalAudits = state.auditPlans.filter(p => p.client === client.name).length;
    const completedAudits = state.auditPlans.filter(p => p.client === client.name && p.status === 'Completed').length;
    const pendingAudits = state.auditPlans.filter(p => p.client === client.name && (p.status === 'Draft' || p.status === 'Confirmed')).length;
    const certificationStatus = client.status === 'Active' ? 'Certified' : client.status;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderClientsEnhanced()">
                </button>
            </div>
            
            <!-- Header Card with Client Info -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h2 style="margin: 0;">${client.name}</h2>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0;">${client.industry || 'N/A'} • ${client.standard || 'N/A'}</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" onclick="window.initiateAuditPlanFromClient('${client.name}')">
                        <i class="fa-solid fa-calendar-plus"></i> Create Audit Plan
                    </button>
                    <button class="btn btn-primary" onclick="window.openEditClientModal(${client.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-secondary" onclick="window.renderClientsEnhanced()">
                        <i class="fa-solid fa-arrow-left"></i> Back
                    </button>
                    <span class="status-badge status-${client.status.toLowerCase()}">${client.status}</span>
                </div>
                </div>
            </div>

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

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="info">Information</button>
                <button class="tab-btn" data-tab="profile">Company Profile</button>
                <button class="tab-btn" data-tab="contacts">Contacts</button>
                <button class="tab-btn" data-tab="departments">Departments</button>
                <button class="tab-btn" data-tab="audits">Audits</button>
                <button class="tab-btn" data-tab="documents">Documents</button>
            </div>

            <div id="tab-content"></div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderClientTab(client, e.target.getAttribute('data-tab'));
        });
    });

    renderClientTab(client, 'info');
}

function renderClientTab(client, tabName) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'info':
            // Find auditors that match this client's industry
            const matchingAuditors = state.auditors.filter(a =>
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

            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Company Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Basic Info -->
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Company Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.name}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Website</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">
                                ${client.website ? `<a href="${client.website}" target="_blank" style="color: var(--primary-color); text-decoration: none;"><i class="fa-solid fa-globe" style="margin-right: 5px;"></i>${client.website}</a>` : '-'}
                            </p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Standard</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.standard}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Industry</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">
                                <span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                                    <i class="fa-solid fa-industry" style="margin-right: 5px;"></i>${client.industry || 'Not Specified'}
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
                </div>

                <!-- Sites / Locations -->
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-map-location-dot" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Sites & Locations</h3>
                        <button class="btn btn-sm btn-secondary" onclick="addSite(${client.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Site
                        </button>
                    </div>
                    ${(client.sites && client.sites.length > 0) ? `

                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Site Name</th>
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
                                            <td style="font-weight: 500;">${s.name}</td>
                                            <td>${s.address || '-'}</td>
                                            <td>${s.city || '-'}, ${s.country || ''}</td>
                                            <td>
                                                ${s.employees ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;"><i class="fa-solid fa-users" style="margin-right: 4px;"></i>${s.employees}</span>` : '<span style="color: var(--text-secondary);">-</span>'}
                                            </td>
                                            <td>
                                                ${s.shift ? `<span style="background: ${s.shift === 'Yes' ? '#fef3c7' : '#f1f5f9'}; color: ${s.shift === 'Yes' ? '#d97706' : 'var(--text-secondary)'}; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${s.shift === 'Yes' ? 'Multi-Shift' : 'General'}</span>` : '<span style="color: var(--text-secondary);">-</span>'}
                                            </td>
                                            <td>
                                                ${s.geotag ? `<a href="https://maps.google.com/?q=${s.geotag}" target="_blank" style="color: var(--primary-color); text-decoration: none;"><i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i>${s.geotag}</a>` : '-'}
                                            </td>
                                            <td>
                                                <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editSite(${client.id}, ${index})">
                                                    <i class="fa-solid fa-pen"></i>
                                                </button>
                                                <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteSite(${client.id}, ${index})">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No sites added yet.</p>
                    `}
                </div>

                <!-- Matching Auditors -->
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
                                            <p style="font-weight: 500; margin: 0;">${a.name}</p>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${a.role} • ${a.experience || 0} years exp</p>
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
            break;
        case 'profile':
            const profile = client.profile || '';
            const lastUpdated = client.profileUpdated ? new Date(client.profileUpdated).toLocaleString() : 'Never';

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div>
                            <h3 style="margin: 0;"><i class="fa-solid fa-building" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Company Profile</h3>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">
                                <i class="fa-solid fa-clock"></i> Last updated: ${lastUpdated}
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            ${client.website ? `
                                <button class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;" onclick="window.generateCompanyProfile(${client.id})">
                                    <i class="fa-solid fa-sparkles" style="margin-right: 0.25rem;"></i> AI Generate from Website
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-secondary" onclick="window.editCompanyProfile(${client.id})">
                                <i class="fa-solid fa-pen" style="margin-right: 0.25rem;"></i> Edit Manually
                            </button>
                        </div>
                    </div>
                    
                    ${profile ? `
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); line-height: 1.8;">
                            <div style="white-space: pre-wrap; color: var(--text-primary);">${profile}</div>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
                            <i class="fa-solid fa-file-lines" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                            <p style="color: var(--text-secondary); margin-bottom: 1rem;">No company profile generated yet.</p>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                                ${client.website ?
                    'Click "AI Generate from Website" to automatically create a company profile summary.' :
                    'Add a website URL in the client information to enable AI generation, or edit manually.'}
                            </p>
                            <div style="display: flex; gap: 0.5rem; justify-content: center;">
                                ${client.website ? `
                                    <button class="btn btn-primary btn-sm" onclick="window.generateCompanyProfile(${client.id})">
                                        <i class="fa-solid fa-sparkles"></i> AI Generate
                                    </button>
                                ` : ''}
                                <button class="btn btn-outline-secondary btn-sm" onclick="window.editCompanyProfile(${client.id})">
                                    <i class="fa-solid fa-pen"></i> Write Manually
                                </button>
                            </div>
                        </div>
                    `}
                    
                    <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: var(--radius-md); border: 1px solid #bae6fd;">
                        <p style="font-size: 0.85rem; color: #0369a1; margin: 0;">
                            <i class="fa-solid fa-info-circle"></i> <strong>Usage:</strong> This profile summary will be included in the "Organization Overview" section of audit reports.
                        </p>
                    </div>
                </div>
            `;
            break;
        case 'contacts':
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-address-book" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Contact Persons</h3>
                        <button class="btn btn-sm btn-secondary" onclick="addContactPerson(${client.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Contact
                        </button>
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
                                            <td style="font-weight: 500;">${c.name}</td>
                                            <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${c.designation || '-'}</span></td>
                                            <td><i class="fa-solid fa-phone" style="color: var(--text-secondary); margin-right: 5px;"></i>${c.phone || '-'}</td>
                                            <td><a href="mailto:${c.email}" style="color: var(--primary-color); text-decoration: none;">${c.email || '-'}</a></td>
                                            <td>
                                                <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editContact(${client.id}, ${index})">
                                                    <i class="fa-solid fa-pen"></i>
                                                </button>
                                                <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteContact(${client.id}, ${index})">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No contact persons added yet.</p>
                    `}
                </div>
            `;
            break;
        case 'departments':
            const departments = client.departments || [];
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-sitemap" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Departments</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDepartments(${client.id})">
                                <i class="fa-solid fa-upload" style="margin-right: 0.25rem;"></i> Bulk Upload
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="window.addDepartment(${client.id})">
                                <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Department
                            </button>
                        </div>
                    </div>
                    ${departments.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Department Name</th>
                                        <th>Head of Department</th>
                                        <th>Employee Count</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${departments.map((dept, index) => `
                                        <tr>
                                            <td style="font-weight: 500;">${dept.name}</td>
                                            <td>${dept.head || '-'}</td>
                                            <td><i class="fa-solid fa-users" style="color: var(--text-secondary); margin-right: 5px;"></i>${dept.employeeCount || 0}</td>
                                            <td>
                                                <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="window.editDepartment(${client.id}, ${index})">
                                                    <i class="fa-solid fa-pen"></i>
                                                </button>
                                                <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="window.deleteDepartment(${client.id}, ${index})">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
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
                                <button class="btn btn-outline-primary btn-sm" onclick="window.addDepartment(${client.id})">Add Manually</button>
                                <button class="btn btn-outline-secondary btn-sm" onclick="window.bulkUploadDepartments(${client.id})">Bulk Upload</button>
                            </div>
                        </div>
                    `}
                </div>
            `;
            break;
        case 'audits':
            // Get all audits for this client
            const clientPlans = (state.auditPlans || []).filter(p => p.client === client.name);
            const clientReports = (state.auditReports || []).filter(r => r.client === client.name);

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

            tabContent.innerHTML = `
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
                </div>
                
                <!-- Audit History Timeline -->
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
                
                <!-- Findings History -->
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
            break;
        case 'documents':
            const docs = client.documents || [];
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">Documents</h3>
                        <button class="btn btn-primary btn-sm" onclick="openUploadDocumentModal(${client.id})">
                            <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.5rem;"></i> Upload Document
                        </button>
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
                                                ${doc.name}
                                            </td>
                                            <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${doc.category || 'General'}</span></td>
                                            <td>${doc.date}</td>
                                            <td>
                                                <button class="btn btn-sm btn-icon" style="color: var(--primary-color);" onclick="alert('Downloading ${doc.name} (Simulated)')"><i class="fa-solid fa-download"></i></button>
                                                <button class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="deleteDocument(${client.id}, '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
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
                            <button class="btn btn-outline-primary btn-sm" onclick="openUploadDocumentModal(${client.id})">Upload First Document</button>
                        </div>
                    `}
                </div>
            `;
            break;
    }
}

function openAddClientModal() {
    // Implementation for adding client
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add New Client';
    modalBody.innerHTML = `
        <form id="client-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Basic Info -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Basic Information</div>
            
            <div class="form-group">
                <label>Company Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="client-name" required>
            </div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="client-standard">
                    <option>ISO 9001:2015</option>
                    <option>ISO 14001:2015</option>
                    <option>ISO 45001:2018</option>
                    <option>ISO 27001:2022</option>
                </select>
            </div>
            <div class="form-group">
                <label>Industry</label>
                <select class="form-control" id="client-industry">
                    <option value="">-- Select Industry --</option>
                    <option>Manufacturing</option>
                    <option>Automotive</option>
                    <option>Aerospace</option>
                    <option>IT</option>
                    <option>Financial Services</option>
                    <option>Healthcare</option>
                    <option>Pharmaceutical</option>
                    <option>Food & Beverage</option>
                    <option>Construction</option>
                    <option>Chemicals</option>
                    <option>Oil & Gas</option>
                    <option>Logistics</option>
                    <option>Retail</option>
                    <option>Education</option>
                </select>
            </div>
            <div class="form-group">
                <label>Standard(s)</label>
                <select class="form-control" id="client-standard" multiple style="height: 100px;">
                    ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map(std =>
        `<option value="${std}">${std}</option>`
    ).join('')}
                </select>
                <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Company Website</label>
                <input type="url" class="form-control" id="client-website" placeholder="https://example.com">
            </div>

            <!-- Primary Contact -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Primary Contact Person</div>

            <div class="form-group">
                <label>Contact Name</label>
                <input type="text" class="form-control" id="client-contact-name" placeholder="John Doe">
            </div>
            <div class="form-group">
                <label>Designation</label>
                <input type="text" class="form-control" id="client-contact-designation" placeholder="Quality Manager">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="client-contact-phone" placeholder="+1 234 567 8900">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="client-contact-email" placeholder="john@example.com">
            </div>

            <!-- Location -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Location</div>

            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Address</label>
                <input type="text" class="form-control" id="client-address" placeholder="Street Address">
            </div>
            <div class="form-group">
                <label>City</label>
                <input type="text" class="form-control" id="client-city" placeholder="City">
            </div>
            <div class="form-group">
                <label>Country</label>
                <input type="text" class="form-control" id="client-country" placeholder="Country">
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Geotag (Lat, Long)</label>
                <div style="display: flex; gap: 0.5rem;">
                     <input type="text" class="form-control" id="client-geotag" placeholder="e.g. 37.7749, -122.4194" style="margin-bottom: 0;">
                     <button type="button" class="btn btn-secondary" onclick="navigator.geolocation.getCurrentPosition(pos => { document.getElementById('client-geotag').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4); });">
                        <i class="fa-solid fa-location-crosshairs"></i>
                     </button>
                </div>
            </div>

            <!-- Operational & Planning -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Planning Data</div>

            <div class="form-group">
                <label>Total Employees</label>
                <input type="number" class="form-control" id="client-employees" min="1" value="10">
            </div>
            <div class="form-group">
                <label>Number of Sites</label>
                <input type="number" class="form-control" id="client-sites" min="1" value="1">
            </div>
            <div class="form-group">
                <label>Shift Work?</label>
                <select class="form-control" id="client-shifts">
                    <option value="No">No (General Shift Only)</option>
                    <option value="Yes">Yes (Multiple Shifts)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Next Audit Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="client-next-audit" required>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('client-name').value;
        const standard = Array.from(document.getElementById('client-standard').selectedOptions).map(o => o.value).join(', ');
        const nextAudit = document.getElementById('client-next-audit').value;

        // Contact
        const contactName = document.getElementById('client-contact-name').value;
        const contactDesignation = document.getElementById('client-contact-designation').value;
        const contactPhone = document.getElementById('client-contact-phone').value;
        const contactEmail = document.getElementById('client-contact-email').value;
        const website = document.getElementById('client-website').value;

        // Location
        const address = document.getElementById('client-address').value;
        const city = document.getElementById('client-city').value;
        const country = document.getElementById('client-country').value;
        const geotag = document.getElementById('client-geotag').value;

        // Operational
        const employees = parseInt(document.getElementById('client-employees').value) || 0;
        const siteCount = parseInt(document.getElementById('client-sites').value) || 1;
        const shifts = document.getElementById('client-shifts').value;
        const industry = document.getElementById('client-industry').value;

        // Build contacts array
        const contacts = [];
        if (contactName) {
            contacts.push({
                name: contactName,
                designation: contactDesignation,
                phone: contactPhone,
                email: contactEmail
            });
        }

        // Build sites array (primary site from form, more can be added later)
        const sites = [{
            name: 'Head Office',
            address: address,
            city: city,
            country: country,
            geotag: geotag
        }];

        if (name && nextAudit) {
            const newClient = {
                id: Date.now(),
                name, standard, nextAudit, industry,
                status: 'Active',
                website, contacts, sites,
                employees, shifts
            };

            state.clients.push(newClient);
            window.saveData();
            window.closeModal();
            renderClientsEnhanced();
            window.showNotification('Client added successfully');
        }
    };
}

function openEditClientModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    const industries = ['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'];
    const contacts = client.contacts || [];
    const sites = client.sites || [];

    modalTitle.textContent = 'Edit Client';
    modalBody.innerHTML = `
        <form id="client-form" style="max-height: 70vh; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <!-- Basic Info -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Company Information</div>
                
                <div class="form-group">
                    <label>Company Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="client-name" value="${client.name}" required>
                </div>
                <div class="form-group">
                    <label>Industry</label>
                    <select class="form-control" id="client-industry">
                        <option value="">-- Select Industry --</option>
                        ${industries.map(ind => `<option ${client.industry === ind ? 'selected' : ''}>${ind}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Standard(s)</label>
                    <select class="form-control" id="client-standard" multiple style="height: 100px;">
                        ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map(std =>
        `<option value="${std}" ${(client.standard || '').split(', ').includes(std) ? 'selected' : ''}>${std}</option>`
    ).join('')}
                    </select>
                    <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-control" id="client-status">
                        <option ${client.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option ${client.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        <option ${client.status === 'Withdrawn' ? 'selected' : ''}>Withdrawn</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Website</label>
                    <input type="url" class="form-control" id="client-website" value="${client.website || ''}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label>Next Audit Date</label>
                    <input type="date" class="form-control" id="client-next-audit" value="${client.nextAudit || ''}">
                </div>

                <!-- Operational -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; margin-top: 0.5rem; color: var(--primary-color); font-weight: 600;">Operational Details</div>
                
                <div class="form-group">
                    <label>Number of Employees</label>
                    <input type="number" class="form-control" id="client-employees" value="${client.employees || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Shift Work</label>
                    <select class="form-control" id="client-shifts">
                        <option ${client.shifts === 'No' ? 'selected' : ''}>No</option>
                        <option ${client.shifts === 'Yes' ? 'selected' : ''}>Yes</option>
                    </select>
                </div>

                <!-- Contacts & Sites Summary -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; margin-top: 0.5rem; color: var(--primary-color); font-weight: 600;">Contacts & Sites</div>
                
                <div style="grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <strong><i class="fa-solid fa-users" style="margin-right: 0.5rem;"></i>Contacts</strong>
                            <span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">${contacts.length}</span>
                        </div>
                        ${contacts.length > 0 ? `
                            <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
                                ${contacts.slice(0, 3).map(c => `<li>${c.name} (${c.designation || 'N/A'})</li>`).join('')}
                                ${contacts.length > 3 ? `<li>...and ${contacts.length - 3} more</li>` : ''}
                            </ul>
                        ` : '<p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">No contacts added</p>'}
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0;">
                            <i class="fa-solid fa-info-circle"></i> Manage contacts from client detail page
                        </p>
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <strong><i class="fa-solid fa-location-dot" style="margin-right: 0.5rem;"></i>Sites</strong>
                            <span style="background: #059669; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">${sites.length}</span>
                        </div>
                        ${sites.length > 0 ? `
                            <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
                                ${sites.slice(0, 3).map(s => `<li>${s.name} - ${s.city || 'N/A'}</li>`).join('')}
                                ${sites.length > 3 ? `<li>...and ${sites.length - 3} more</li>` : ''}
                            </ul>
                        ` : '<p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">No sites added</p>'}
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0;">
                            <i class="fa-solid fa-info-circle"></i> Manage sites from client detail page
                        </p>
                    </div>
                </div>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('client-name').value;
        const standard = Array.from(document.getElementById('client-standard').selectedOptions).map(o => o.value).join(', ');
        const status = document.getElementById('client-status').value;
        const nextAudit = document.getElementById('client-next-audit').value;

        if (name) {
            client.name = name;
            client.standard = standard;
            client.status = status;
            client.nextAudit = nextAudit;
            client.industry = document.getElementById('client-industry').value;
            client.website = document.getElementById('client-website').value;
            client.employees = parseInt(document.getElementById('client-employees').value) || 0;
            client.shifts = document.getElementById('client-shifts').value;

            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Client updated successfully');
        }
    };
}

// Add Contact Person Modal
function addContactPerson(clientId) {
    const client = state.clients.find(c => c.id === clientId);
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
        </form>
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
    const client = state.clients.find(c => c.id === clientId);
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
        </form>
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
            client.sites.push({ name, address, city, country, geotag, employees, shift });
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
    const client = state.clients.find(c => c.id === clientId);
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
        </form>
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
    const client = state.clients.find(c => c.id === clientId);
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
window.openAddClientModal = openAddClientModal;
window.openEditClientModal = openEditClientModal;
window.addContactPerson = addContactPerson;
window.addSite = addSite;

// Edit Site Modal
window.editSite = function (clientId, siteIndex) {
    const client = state.clients.find(c => c.id === clientId);
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
        </form>
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
            client.sites[siteIndex] = { ...site, name, address, city, country, geotag, employees, shift };
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
    const client = state.clients.find(c => c.id === clientId);
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
    const client = state.clients.find(c => c.id === clientId);
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
        </form>
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
    const client = state.clients.find(c => c.id === clientId);
    if (!client || !client.contacts) return;

    if (confirm('Are you sure you want to delete this contact?')) {
        client.contacts.splice(contactIndex, 1);
        window.saveData();
        renderClientDetail(clientId);
        window.showNotification('Contact deleted');
    }
};

// Helper function to initiate audit planning from client detail page
window.initiateAuditPlanFromClient = function (clientName) {
    // Navigate to Audit Planning module
    window.renderModule('planning');

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
    const client = state.clients.find(c => c.id === clientId);
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
            <div class="form-group">
                <label>Employee Count</label>
                <input type="number" id="dept-employees" placeholder="0" min="0">
            </div>
        </form>
        `,
        () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                window.showNotification('Department name is required', 'error');
                return;
            }

            const department = {
                name,
                head: document.getElementById('dept-head').value.trim(),
                employeeCount: parseInt(document.getElementById('dept-employees').value) || 0
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
    const client = state.clients.find(c => c.id === clientId);
    if (!client || !client.departments || !client.departments[deptIndex]) return;

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
            <div class="form-group">
                <label>Employee Count</label>
                <input type="number" id="dept-employees" value="${dept.employeeCount || 0}" min="0">
            </div>
        </form>
        `,
        () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                window.showNotification('Department name is required', 'error');
                return;
            }

            client.departments[deptIndex] = {
                name,
                head: document.getElementById('dept-head').value.trim(),
                employeeCount: parseInt(document.getElementById('dept-employees').value) || 0
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
    const client = state.clients.find(c => c.id === clientId);
    if (!client || !client.departments || !client.departments[deptIndex]) return;

    const dept = client.departments[deptIndex];

    if (confirm(`Are you sure you want to delete the department "${dept.name}"?`)) {
        client.departments.splice(deptIndex, 1);
        window.saveData();
        renderClientDetail(clientId);
        renderClientTab(client, 'departments');
        window.showNotification('Department deleted successfully');
    }
}

function bulkUploadDepartments(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    window.openModal(
        'Bulk Upload Departments',
        `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste department list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Department Name, Head of Department, Employee Count<br>
                Quality Assurance, John Doe, 15<br>
                Production, Jane Smith, 50<br>
                Human Resources, Bob Johnson, 8
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
            renderClientDetail(clientId);
            renderClientTab(client, 'departments');

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

// Company Profile Functions
function generateCompanyProfile(clientId) {
    const client = state.clients.find(c => c.id === clientId);
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

        window.saveData();
        renderClientDetail(clientId);
        renderClientTab(client, 'profile');
        window.showNotification('Company profile generated successfully!');
    }, 1500); // Simulate API delay
}

function editCompanyProfile(clientId) {
    const client = state.clients.find(c => c.id === clientId);
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


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
            <td>${client.standard}</td>
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
                <div style="display: flex; gap: 0.5rem;">
                    ${window.addExportButtons ? window.addExportButtons('clients') : ''}
                    <button id="btn-new-client" class="btn btn-primary">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Client
                    </button>
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

    contentArea.innerHTML = html;

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
}

function renderClientDetail(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderClientsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Clients
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${client.name}</h2>
                        <p style="color: var(--text-secondary);">${client.standard}</p>
                    </div>
                    <span class="status-badge status-${client.status.toLowerCase()}">${client.status}</span>
                </div>
            </div>

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="info">Information</button>
                <button class="tab-btn" data-tab="audits">Audits</button>
                <button class="tab-btn" data-tab="documents">Documents</button>
            </div>

            <div id="tab-content"></div>
        </div>
    `;

    contentArea.innerHTML = html;

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

            // Calculate performance metrics (mock data for now)
            const totalAudits = state.auditPlans.filter(p => p.client === client.name).length;
            const completedAudits = state.auditPlans.filter(p => p.client === client.name && p.status === 'Completed').length;
            const ncCount = Math.floor(Math.random() * 5); // Mock NC count
            const certificationStatus = client.status === 'Active' ? 'Certified' : client.status;

            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Client Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Basic Info -->
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Company Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.name}</p>
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
                        
                        <!-- Contact Info -->
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Contact Person</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.contactPerson || '-'}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Contact Details</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">
                                <i class="fa-solid fa-envelope" style="color: var(--text-secondary); margin-right: 5px;"></i> ${client.email || '-'}<br>
                                <i class="fa-solid fa-phone" style="color: var(--text-secondary); margin-right: 5px;"></i> ${client.phone || '-'}
                            </p>
                        </div>

                        <!-- Address -->
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Address</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.address || '-'}</p>
                            <p style="font-weight: 500;">${client.city || ''}, ${client.country || ''}</p>
                        </div>
                        <div>
                             <label style="color: var(--text-secondary); font-size: 0.875rem;">Geolocation</label>
                             <p style="font-weight: 500; margin-top: 0.25rem;">
                                <i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i> ${client.geotag || 'Not Validated'}
                             </p>
                        </div>

                        <!-- Operational Data -->
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Operational Details</label>
                            <div style="display: flex; gap: 1rem; margin-top: 0.25rem;">
                                <span><i class="fa-solid fa-users" style="color: var(--text-secondary);"></i> <strong>${client.employees || 0}</strong> Employees</span>
                                <span><i class="fa-solid fa-building" style="color: var(--text-secondary);"></i> <strong>${client.sites || 1}</strong> Site(s)</span>
                            </div>
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

                <!-- Performance Analytics -->
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Performance Analytics</h3>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                            <p style="font-size: 0.8rem; opacity: 0.9;">Certification Status</p>
                            <p style="font-size: 1.5rem; font-weight: 700;">${certificationStatus}</p>
                        </div>
                        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                            <p style="font-size: 0.8rem; opacity: 0.9;">Total Audits</p>
                            <p style="font-size: 1.5rem; font-weight: 700;">${totalAudits}</p>
                        </div>
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                            <p style="font-size: 0.8rem; opacity: 0.9;">Completed Audits</p>
                            <p style="font-size: 1.5rem; font-weight: 700;">${completedAudits}</p>
                        </div>
                        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                            <p style="font-size: 0.8rem; opacity: 0.9;">Open NCs</p>
                            <p style="font-size: 1.5rem; font-weight: 700;">${ncCount}</p>
                        </div>
                    </div>
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
        case 'audits':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Audit History</h3>
                    <p style="color: var(--text-secondary);">No audit history available.</p>
                </div>
            `;
            break;
        case 'documents':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Documents</h3>
                    <p style="color: var(--text-secondary);">No documents uploaded.</p>
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

            <!-- Contact Info -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Contact Details</div>

            <div class="form-group">
                <label>Contact Person</label>
                <input type="text" class="form-control" id="client-contact" placeholder="John Doe">
            </div>
             <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="client-email" placeholder="john@example.com">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="client-phone" placeholder="+1 234 567 8900">
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
        const standard = document.getElementById('client-standard').value;
        const nextAudit = document.getElementById('client-next-audit').value;

        // New Data
        const contactPerson = document.getElementById('client-contact').value;
        const email = document.getElementById('client-email').value;
        const phone = document.getElementById('client-phone').value;
        const address = document.getElementById('client-address').value;
        const city = document.getElementById('client-city').value;
        const country = document.getElementById('client-country').value;
        const geotag = document.getElementById('client-geotag').value;
        const employees = parseInt(document.getElementById('client-employees').value) || 0;
        const sites = parseInt(document.getElementById('client-sites').value) || 1;
        const shifts = document.getElementById('client-shifts').value;
        const industry = document.getElementById('client-industry').value;

        if (name && nextAudit) {
            const newClient = {
                id: Date.now(),
                name, standard, nextAudit,
                status: 'Active',
                contactPerson, email, phone,
                address, city, country, geotag,
                employees, sites, shifts, industry
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

    modalTitle.textContent = 'Edit Client';
    modalBody.innerHTML = `
        <form id="client-form">
            <div class="form-group">
                <label>Company Name</label>
                <input type="text" class="form-control" id="client-name" value="${client.name}" required>
            </div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="client-standard">
                    <option ${client.standard === 'ISO 9001:2015' ? 'selected' : ''}>ISO 9001:2015</option>
                    <option ${client.standard === 'ISO 14001:2015' ? 'selected' : ''}>ISO 14001:2015</option>
                    <option ${client.standard === 'ISO 45001:2018' ? 'selected' : ''}>ISO 45001:2018</option>
                    <option ${client.standard === 'ISO 27001:2022' ? 'selected' : ''}>ISO 27001:2022</option>
                </select>
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
                <label>Next Audit Date</label>
                <input type="date" class="form-control" id="client-next-audit" value="${client.nextAudit}" required>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('client-name').value;
        const standard = document.getElementById('client-standard').value;
        const status = document.getElementById('client-status').value;
        const nextAudit = document.getElementById('client-next-audit').value;

        if (name && nextAudit) {
            client.name = name;
            client.standard = standard;
            client.status = status;
            client.nextAudit = nextAudit;

            window.saveData();
            window.closeModal();
            renderClientsEnhanced();
            window.showNotification('Client updated successfully');
        }
    };
}

window.renderClientsEnhanced = renderClientsEnhanced;
window.renderClientDetail = renderClientDetail;
window.openAddClientModal = openAddClientModal;
window.openEditClientModal = openEditClientModal;

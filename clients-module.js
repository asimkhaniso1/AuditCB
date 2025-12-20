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
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Clients
                </button>
            </div>
            
            <!-- Header Card with Client Info -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${client.name}</h2>
                        <p style="color: var(--text-secondary);">
                            ${client.standard}
                            ${client.industry ? `<span style="margin-left: 1rem; background: #fef3c7; color: #d97706; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem;"><i class="fa-solid fa-industry" style="margin-right: 4px;"></i>${client.industry}</span>` : ''}
                        </p>
                    </div>
                    <span class="status-badge status-${client.status.toLowerCase()}">${client.status}</span>
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
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Employees</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-users" style="color: var(--text-secondary); margin-right: 5px;"></i> ${client.employees || 0}</p>
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
                                        <th>Geotag</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${client.sites.map(s => `
                                        <tr>
                                            <td style="font-weight: 500;">${s.name}</td>
                                            <td>${s.address || '-'}</td>
                                            <td>${s.city || '-'}, ${s.country || ''}</td>
                                            <td>
                                                ${s.geotag ? `<a href="https://maps.google.com/?q=${s.geotag}" target="_blank" style="color: var(--primary-color); text-decoration: none;"><i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i>${s.geotag}</a>` : '-'}
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

                <!-- Contact Persons -->
                <div class="card" style="margin-top: 1.5rem;">
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
                                    </tr>
                                </thead>
                                <tbody>
                                    ${client.contacts.map(c => `
                                        <tr>
                                            <td style="font-weight: 500;">${c.name}</td>
                                            <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${c.designation || '-'}</span></td>
                                            <td><i class="fa-solid fa-phone" style="color: var(--text-secondary); margin-right: 5px;"></i>${c.phone || '-'}</td>
                                            <td><a href="mailto:${c.email}" style="color: var(--primary-color); text-decoration: none;">${c.email || '-'}</a></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No contact persons added yet.</p>
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
        const standard = document.getElementById('client-standard').value;
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
        const standard = document.getElementById('client-standard').value;
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
            <div class="form-group">
                <label>City</label>
                <input type="text" class="form-control" id="site-city" placeholder="City">
            </div>
            <div class="form-group">
                <label>Country</label>
                <input type="text" class="form-control" id="site-country" placeholder="Country">
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

        if (name) {
            if (!client.sites) client.sites = [];
            client.sites.push({ name, address, city, country, geotag });
            window.saveData();
            window.closeModal();
            renderClientDetail(clientId);
            window.showNotification('Site added successfully');
        } else {
            window.showNotification('Site name is required', 'error');
        }
    };
}

window.renderClientsEnhanced = renderClientsEnhanced;
window.renderClientDetail = renderClientDetail;
window.openAddClientModal = openAddClientModal;
window.openEditClientModal = openEditClientModal;
window.addContactPerson = addContactPerson;
window.addSite = addSite;

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
                    <button class="btn btn-primary" onclick="window.openAddClientModal()">
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
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Client Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Company Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.name}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Standard</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.standard}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Next Audit Date</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${client.nextAudit}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Address</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">123 Business Rd, Tech City</p>
                        </div>
                    </div>
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
        <form id="client-form">
            <div class="form-group">
                <label>Company Name</label>
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
                <label>Next Audit Date</label>
                <input type="date" class="form-control" id="client-next-audit" required>
            </div>
        </form>
    `;

    openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('client-name').value;
        const standard = document.getElementById('client-standard').value;
        const nextAudit = document.getElementById('client-next-audit').value;

        if (name && nextAudit) {
            const newClient = {
                id: Date.now(),
                name: name,
                standard: standard,
                status: 'Active',
                nextAudit: nextAudit
            };

            state.clients.push(newClient);
            saveData();
            closeModal();
            renderClientsEnhanced();
            showNotification('Client added successfully');
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

    openModal();

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

            saveData();
            closeModal();
            renderClientsEnhanced();
            showNotification('Client updated successfully');
        }
    };
}

window.renderClientsEnhanced = renderClientsEnhanced;
window.renderClientDetail = renderClientDetail;
window.openAddClientModal = openAddClientModal;
window.openEditClientModal = openEditClientModal;

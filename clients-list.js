// ============================================
// CLIENTS LIST MODULE (Split from clients-module.js)
// ============================================
// Handles client list view, search, filter, and pagination
// Loaded AFTER clients-module.js - overrides the original function

function renderClientsEnhanced() {
    const searchTerm = window.state.clientSearchTerm || '';
    const filterStatus = window.state.clientFilterStatus || 'All';

    // Pagination State
    if (!window.state.clientPagination) {
        window.state.clientPagination = { currentPage: 1, itemsPerPage: 10 };
    }

    let filteredClients = window.state.clients.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || client.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const totalItems = filteredClients.length;
    const totalPages = Math.ceil(totalItems / window.state.clientPagination.itemsPerPage);

    if (window.state.clientPagination.currentPage > totalPages && totalPages > 0) {
        window.state.clientPagination.currentPage = totalPages;
    }
    if (window.state.clientPagination.currentPage < 1) window.state.clientPagination.currentPage = 1;

    const startIndex = (window.state.clientPagination.currentPage - 1) * window.state.clientPagination.itemsPerPage;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + window.state.clientPagination.itemsPerPage);

    const rows = paginatedClients.map(client => `
        <tr class="client-row" data-client-id="${client.id}" style="cursor: pointer;">
            <td>${window.UTILS.escapeHtml(client.name)}</td>
            <td>
                ${(client.standard || '').split(',').map(s =>
        `<span class="badge" style="background: #e0f2fe; color: #0284c7; margin-right: 4px; font-size: 0.75em;">${window.UTILS.escapeHtml(s.trim())}</span>`
    ).join('')}
            </td>
            <td><span class="status-badge status-${(client.status || '').toLowerCase()}">${window.UTILS.escapeHtml(client.status)}</span></td>
            <td>${window.UTILS.escapeHtml(client.nextAudit)}</td>
            <td>
                <div style="display: flex; gap: 4px; align-items: center;">
                ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm edit-client" data-client-id="${client.id}" style="color: var(--primary-color);" title="Edit"><i class="fa-solid fa-edit"></i></button>
                ` : ''}
                ${(window.state.currentUser.role === 'Admin') ? `
                <button class="btn btn-sm" onclick="event.stopPropagation(); window.archiveClient(${client.id})" style="color: #f59e0b;" title="Archive"><i class="fa-solid fa-box-archive"></i></button>
                <button class="btn btn-sm" onclick="event.stopPropagation(); window.deleteClient(${client.id})" style="color: #ef4444;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                ` : ''}
                <button class="btn btn-sm view-client" data-client-id="${client.id}" style="color: var(--primary-color);" title="View"><i class="fa-solid fa-eye"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Client Management</h2>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
                        <input type="file" id="client-import-file" style="display: none;" accept=".xlsx, .xls">
                        <button class="btn btn-sm btn-outline-secondary" onclick="downloadImportTemplate()" style="white-space: nowrap;">
                            <i class="fa-solid fa-file-export" style="margin-right: 0.5rem;"></i>Template
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('client-import-file').click()" style="white-space: nowrap;">
                            <i class="fa-solid fa-file-import" style="margin-right: 0.5rem;"></i>Import
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleClientAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${window.state.showClientAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${window.state.showClientAnalytics !== false ? 'Hide' : 'Show'} Analytics
                    </button>
                    ${(window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin') ? `
                    <button id="btn-new-client" class="btn btn-primary" style="white-space: nowrap;">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Client
                    </button>
                    ` : ''}
                </div>
            </div>

            ${window.state.showClientAnalytics !== false ? `
            <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-building"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Clients</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.state.clients.length}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-check-circle"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Active</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.state.clients.filter(c => c.status === 'Active').length}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-ban"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Inactive</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.state.clients.filter(c => ['Suspended', 'Withdrawn'].includes(c.status)).length}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Sites</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.state.clients.reduce((acc, c) => acc + (c.sites ? c.sites.length : 1), 0)}</div>
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
            ` : ''}
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-new-client')?.addEventListener('click', window.renderAddClient);

    document.getElementById('client-import-file')?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importClientsFromExcel(e.target.files[0]);
            e.target.value = '';
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
                window.location.hash = `client/${clientId}`;
            }
        });
    });

    document.querySelectorAll('.edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const clientId = parseInt(btn.getAttribute('data-client-id'));
            window.renderEditClient(clientId);
        });
    });

    window.toggleClientAnalytics = function () {
        if (window.state.showClientAnalytics === undefined) window.state.showClientAnalytics = true;
        window.state.showClientAnalytics = !window.state.showClientAnalytics;
        renderClientsEnhanced();
    };
}

// Pagination helpers (fixed window.window.state bug)
window.changeClientPage = function (page) {
    if (window.state.clientPagination) {
        window.state.clientPagination.currentPage = page;
        renderClientsEnhanced();
    }
};

window.changeClientItemsPerPage = function (val) {
    if (window.state.clientPagination) {
        window.state.clientPagination.itemsPerPage = parseInt(val, 10);
        window.state.clientPagination.currentPage = 1;
        renderClientsEnhanced();
    }
};

// Export to window (overrides clients-module.js version)
window.renderClientsEnhanced = renderClientsEnhanced;

Logger.info('Clients List module loaded (split version with bug fixes)');

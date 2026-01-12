// Advanced Module Functions for AuditCB360
// This file contains enhanced rendering functions for Auditors, Programmes, Planning, and Execution modules

// ============================================
// AUDITORS MODULE - Enhanced
// ============================================

// Emergency Fix: Define missing function to prevent crashes if called by old event listeners
window.openAddAuditorModal = function () {
    console.warn('openAddAuditorModal is deprecated. Redirecting to #auditor-form');
    window.location.hash = '#auditor-form';
};

function renderAuditorsEnhanced() {
    const state = window.state;
    const searchTerm = state.auditorSearchTerm || '';
    const filterRole = state.auditorFilterRole || 'All';



    // Permission Check
    const userRole = window.state.currentUser?.role || 'Auditor';
    const isAuthorized = userRole === 'Certification Manager' || userRole === 'Admin';

    // Pagination State
    if (!state.auditorPagination) {
        state.auditorPagination = { currentPage: 1, itemsPerPage: 10 };
    }

    let filteredAuditors = state.auditors.filter(auditor => {
        const matchesSearch = auditor.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'All' || auditor.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const totalItems = filteredAuditors.length;
    const totalPages = Math.ceil(totalItems / state.auditorPagination.itemsPerPage);

    // Ensure currentPage is valid
    if (state.auditorPagination.currentPage > totalPages && totalPages > 0) {
        state.auditorPagination.currentPage = totalPages;
    }
    if (state.auditorPagination.currentPage < 1) state.auditorPagination.currentPage = 1;

    const startIndex = (state.auditorPagination.currentPage - 1) * state.auditorPagination.itemsPerPage;
    const paginatedAuditors = filteredAuditors.slice(startIndex, startIndex + state.auditorPagination.itemsPerPage);

    const rows = paginatedAuditors.map(auditor => `
        <tr class="auditor-row" data-auditor-id="${auditor.id}" style="cursor: pointer;">
            <td>${window.UTILS.escapeHtml(auditor.name)}</td>
            <td><span style="background: var(--primary-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(auditor.role)}</span></td>
            <td>${(auditor.standards || []).map(s => window.UTILS.escapeHtml(s)).join(', ')}</td>
            <td>
                ${isAuthorized ? `<button class="btn btn-sm edit-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);" title="Edit"><i class="fa-solid fa-edit"></i></button>` : ''}
                <button class="btn btn-sm view-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);" title="View"><i class="fa-solid fa-eye"></i></button>
                ${isAuthorized ? `<button class="btn btn-sm delete-auditor" data-auditor-id="${auditor.id}" style="color: var(--danger-color);" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Auditor Management</h2>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                     <button class="btn btn-sm btn-outline-secondary" onclick="toggleAuditorAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showAuditorAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showAuditorAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    ${isAuthorized ? `<button id="btn-add-auditor" class="btn btn-primary" style="white-space: nowrap;"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Auditor</button>` : ''}
                </div>
            </div>

            ${state.showAuditorAnalytics !== false ? `
            <!-- Analytics Dashboard -->
            <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Auditors -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-users"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Auditors</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditors.length}</div>
                    </div>
                </div>

                <!-- Lead Auditors -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-user-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Lead Auditors</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditors.filter(a => a.role === 'Lead Auditor').length}</div>
                    </div>
                </div>

                <!-- Active Deployments (Mock Logic: Based on plans in progress) -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fff7ed; color: #ea580c; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-briefcase"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Active Deployments</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditPlans.filter(p => p.status === 'In Progress').length * 2 /* Approx 2 auditors per plan */}</div>
                    </div>
                </div>

                <!-- Avg Rating -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-star"></i>
                    </div>
                    <div>
                         <div style="font-size: 0.85rem; color: var(--text-secondary);">Avg Rating</div>
                         <div style="font-size: 1.5rem; font-weight: bold;">
                            ${(state.auditors.reduce((acc, curr) => acc + (curr.customerRating || 0), 0) / (state.auditors.length || 1)).toFixed(1)}
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="auditor-search" placeholder="Search auditors..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="auditor-filter" style="max-width: 180px; margin-bottom: 0;">
                        <option value="All" ${filterRole === 'All' ? 'selected' : ''}>All Roles</option>
                        <option value="Lead Auditor" ${filterRole === 'Lead Auditor' ? 'selected' : ''}> Lead Auditor</option>
                        <option value="Auditor" ${filterRole === 'Auditor' ? 'selected' : ''}>Auditor</option>
                        <option value="Technical Expert" ${filterRole === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                    </select>
                    <button class="btn" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none;" onclick="renderCompetenceMatrix()">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i> Competence Matrix
                    </button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Qualified Standards</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No auditors found</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            ${totalItems > 0 ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding: 0.5rem;">
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    Showing ${startIndex + 1} to ${Math.min(startIndex + state.auditorPagination.itemsPerPage, totalItems)} of ${totalItems} entries
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.changeAuditorPage(${state.auditorPagination.currentPage - 1})" ${state.auditorPagination.currentPage === 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span style="font-size: 0.9rem; min-width: 80px; text-align: center;">Page ${state.auditorPagination.currentPage} of ${totalPages}</span>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.changeAuditorPage(${state.auditorPagination.currentPage + 1})" ${state.auditorPagination.currentPage === totalPages ? 'disabled' : ''}>
                        Next <i class="fa-solid fa-chevron-right"></i>
                    </button>
                     <select onchange="window.changeAuditorItemsPerPage(this.value)" style="margin-left: 1rem; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color);">
                        <option value="10" ${state.auditorPagination.itemsPerPage === 10 ? 'selected' : ''}>10 / page</option>
                        <option value="25" ${state.auditorPagination.itemsPerPage === 25 ? 'selected' : ''}>25 / page</option>
                         <option value="50" ${state.auditorPagination.itemsPerPage === 50 ? 'selected' : ''}>50 / page</option>
                    </select>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-add-auditor')?.addEventListener('click', () => {
        window.location.hash = '#auditor-form';
    });

    document.getElementById('auditor-search')?.addEventListener('input', (e) => {
        state.auditorSearchTerm = e.target.value;
        renderAuditorsEnhanced();
    });

    document.getElementById('auditor-filter')?.addEventListener('change', (e) => {
        state.auditorFilterRole = e.target.value;
        renderAuditorsEnhanced();
    });

    document.querySelectorAll('.view-auditor, .auditor-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-auditor') && !e.target.closest('.delete-auditor')) {
                const auditorId = el.getAttribute('data-auditor-id');
                renderAuditorDetail(auditorId);
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-auditor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const auditorId = btn.getAttribute('data-auditor-id');
            window.location.hash = '#auditor-form?id=' + auditorId;
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-auditor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const auditorId = btn.getAttribute('data-auditor-id');
            deleteAuditor(auditorId);
        });
    });

    // Helper for toggle
    window.toggleAuditorAnalytics = function () {
        if (state.showAuditorAnalytics === undefined) state.showAuditorAnalytics = true;
        state.showAuditorAnalytics = !state.showAuditorAnalytics;
        renderAuditorsEnhanced();
    };
}

window.changeAuditorPage = function (page) {
    if (window.state.auditorPagination) {
        window.state.auditorPagination.currentPage = page;
        renderAuditorsEnhanced();
    }
};

window.changeAuditorItemsPerPage = function (val) {
    if (window.state.auditorPagination) {
        window.state.auditorPagination.itemsPerPage = parseInt(val, 10);
        window.state.auditorPagination.currentPage = 1; // Reset to first page
        renderAuditorsEnhanced();
    }
};

// Delete Auditor Function
function deleteAuditor(auditorId) {
    const auditor = window.state.auditors.find(a => String(a.id) === String(auditorId));
    if (!auditor) {
        window.showNotification('Auditor not found', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete auditor "${auditor.name}"? This action cannot be undone.`)) {
        return;
    }

    // Remove from state
    window.state.auditors = window.state.auditors.filter(a => String(a.id) !== String(auditorId));

    // Save and sync
    if (window.saveData) window.saveData();

    // Delete from Supabase
    if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
        window.SupabaseClient.client
            .from('auditors')
            .delete()
            .eq('id', String(auditorId))
            .then(({ error }) => {
                if (error) {
                    console.error('Failed to delete auditor from Supabase:', error);
                }
            });
    }

    window.showNotification(`Auditor "${auditor.name}" deleted successfully`, 'success');
    renderAuditorsEnhanced();
}

window.deleteAuditor = deleteAuditor;

function renderAuditorDetail(auditorId) {
    const auditor = state.auditors.find(a => String(a.id) === String(auditorId));
    if (!auditor) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditorsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Auditors
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1.5rem;">
                    <div style="display: flex; gap: 1.5rem; align-items: center;">
                        <!-- Profile Photo -->
                        <div style="flex-shrink: 0;">
                            ${auditor.pictureUrl ? `
                                <img src="${window.UTILS.escapeHtml(auditor.pictureUrl)}" alt="${window.UTILS.escapeHtml(auditor.name)}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color);">
                            ` : `
                                <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: white; font-weight: 600;">
                                    ${window.UTILS.escapeHtml(auditor.name).split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                            `}
                        </div>
                        <!-- Info -->
                        <div>
                            <h2 style="margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(auditor.name)}</h2>
                            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${window.UTILS.escapeHtml(auditor.role)}</p>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                ${auditor.standards ? auditor.standards.map(s => `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${window.UTILS.escapeHtml(s)}</span>`).join('') : ''}
                            </div>
                            <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                                ${auditor.email ? `<span><i class="fa-solid fa-envelope" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(auditor.email)}</span>` : ''}
                                ${auditor.phone ? `<span><i class="fa-solid fa-phone" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(auditor.phone)}</span>` : ''}
                                ${auditor.location ? `<span><i class="fa-solid fa-location-dot" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(auditor.location)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <button class="btn btn-primary edit-auditor" data-auditor-id="${auditor.id}" style="margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit Auditor
                        </button>
                        ${auditor.customerRating ? `
                            <div style="margin-top: 0.5rem;">
                                <span style="color: #fbbf24; font-size: 1.1rem;">
                                    ${'★'.repeat(auditor.customerRating)}${'☆'.repeat(5 - auditor.customerRating)}
                                </span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary); display: block;">${auditor.customerRating}/5 Rating</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="profile">
                    <i class="fa-solid fa-user" style="margin-right: 0.25rem;"></i>Profile
                </button>
                <button class="tab-btn" data-tab="qualifications">
                    <i class="fa-solid fa-graduation-cap" style="margin-right: 0.25rem;"></i>Qualifications
                </button>
                <button class="tab-btn" data-tab="activity">
                    <i class="fa-solid fa-calendar-check" style="margin-right: 0.25rem;"></i>Activity
                </button>
                <button class="tab-btn" data-tab="performance">
                    <i class="fa-solid fa-chart-line" style="margin-right: 0.25rem;"></i>Performance
                </button>
                <button class="tab-btn" data-tab="complaints">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.25rem;"></i>Complaints
                </button>
                <button class="tab-btn" data-tab="documents">
                    <i class="fa-solid fa-folder-open" style="margin-right: 0.25rem;"></i>Documents
                </button>
                <button class="tab-btn" data-tab="clients">
                    <i class="fa-solid fa-briefcase" style="margin-right: 0.25rem;"></i>Active Clients
                </button>
            </div>

            <div id="tab-content"></div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderAuditorTab(auditor, e.target.getAttribute('data-tab'));
        });
    });

    // Add event listener for Edit Auditor button
    document.querySelector('.edit-auditor')?.addEventListener('click', () => {
        window.location.hash = '#auditor-form?id=' + auditor.id;
    });

    renderAuditorTab(auditor, 'profile');
}

function renderAuditorTab(auditor, tabName) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'profile':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Personal Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Full Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(auditor.name)}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Role</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(auditor.role)}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Age</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.age || '-'} years</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Experience</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.experience || 0} years</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Man-Day Rate</label>
                            <p style="font-weight: 500; margin-top: 0.25rem; color: var(--success-color);">$${auditor.manDayRate || 0}/day</p>
                        </div>
                         <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Location</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i>${window.UTILS.escapeHtml(auditor.location || '-')}</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Contact Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Email</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-envelope" style="margin-right: 5px;"></i>${window.UTILS.escapeHtml(auditor.email || '-')}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Phone</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-phone" style="margin-right: 5px;"></i>${window.UTILS.escapeHtml(auditor.phone || '-')}</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Expertise & Industry</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Domain Expertise</label>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${(auditor.domainExpertise || []).map(d => `<span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(d)}</span>`).join('') || '<span style="color: var(--text-secondary);">-</span>'}
                            </div>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Industries</label>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${(auditor.industries || []).map(i => `<span style="background: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(i)}</span>`).join('') || '<span style="color: var(--text-secondary);">-</span>'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Academic Qualifications -->
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-graduation-cap" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Academic Qualifications</h3>
                    ${auditor.education && (auditor.education.degree || auditor.education.fieldOfStudy) ? `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                            <div>
                                <label style="color: var(--text-secondary); font-size: 0.875rem;">Highest Degree</label>
                                <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(auditor.education.degree || '-')}</p>
                            </div>
                            <div>
                                <label style="color: var(--text-secondary); font-size: 0.875rem;">Field of Study</label>
                                <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(auditor.education.fieldOfStudy || '-')}</p>
                            </div>
                            ${auditor.education.specialization ? `
                            <div style="grid-column: 1 / -1;">
                                <label style="color: var(--text-secondary); font-size: 0.875rem;">Specialization / Additional Qualifications</label>
                                <p style="font-weight: 500; margin-top: 0.25rem;">${window.UTILS.escapeHtml(auditor.education.specialization)}</p>
                            </div>
                            ` : ''}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">No academic qualifications recorded.</p>'}
                </div>
            `;
            break;
        case 'activity':
            // Get upcoming audits for this auditor
            const today = new Date().toISOString().split('T')[0];
            const upcomingPlans = state.auditPlans.filter(p => {
                // Check if this auditor is assigned (lead or team member)
                const isLead = p.lead === auditor.name || p.auditors?.includes(auditor.id);
                const isTeamMember = (p.teamMembers || []).some(tm => tm === auditor.name || tm === auditor.id);
                const isFuture = p.date >= today;
                return (isLead || isTeamMember) && isFuture;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-calendar-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Upcoming Audits</h3>
                        <span style="background: var(--primary-color); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">${upcomingPlans.length} planned</span>
                    </div>
                    
                    <!-- Filters -->
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-sm);">
                        <div style="flex: 1;">
                            <label style="font-size: 0.8rem; color: var(--text-secondary);">Filter by Date</label>
                            <input type="month" id="upcoming-date-filter" class="form-control form-control-sm" style="margin-top: 0.25rem;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 0.8rem; color: var(--text-secondary);">Filter by Location</label>
                            <input type="text" id="upcoming-location-filter" class="form-control form-control-sm" placeholder="City or country..." style="margin-top: 0.25rem;">
                        </div>
                        <div style="display: flex; align-items: flex-end;">
                            <button class="btn btn-sm btn-secondary" onclick="window.clearAuditorUpcomingFilters(${auditor.id})">Clear</button>
                        </div>
                    </div>
                    
                    ${upcomingPlans.length > 0 ? `
                        <div id="upcoming-audits-list">
                            ${upcomingPlans.map(plan => {
                const client = state.clients.find(c => c.name === plan.client);
                const location = client?.sites?.[0]?.city || client?.city || 'TBD';
                return `
                                    <div class="upcoming-audit-item" data-date="${plan.date}" data-location="${location.toLowerCase()}" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); border-left: 4px solid var(--primary-color);">
                                        <div>
                                            <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(plan.client)}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fa-solid fa-certificate" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(plan.standard || 'ISO Standard')}
                                                <span style="margin: 0 0.5rem;">•</span>
                                                <i class="fa-solid fa-location-dot" style="margin-right: 0.25rem;"></i>${window.UTILS.escapeHtml(location)}
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 0.9rem; font-weight: 500; color: var(--primary-color);">${new Date(plan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(plan.type || 'Audit')} • ${plan.manDays || 0} days</div>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No upcoming audits scheduled for this auditor.</p>'}
                </div>
            `;

            // Add filter event listeners
            setTimeout(() => {
                const dateFilter = document.getElementById('upcoming-date-filter');
                const locationFilter = document.getElementById('upcoming-location-filter');

                const applyFilters = () => {
                    const dateVal = dateFilter?.value || '';
                    const locVal = locationFilter?.value?.toLowerCase() || '';

                    document.querySelectorAll('.upcoming-audit-item').forEach(item => {
                        const itemDate = item.dataset.date || '';
                        const itemLoc = item.dataset.location || '';

                        const matchDate = !dateVal || itemDate.startsWith(dateVal);
                        const matchLoc = !locVal || itemLoc.includes(locVal);

                        item.style.display = (matchDate && matchLoc) ? 'flex' : 'none';
                    });
                };

                dateFilter?.addEventListener('change', applyFilters);
                locationFilter?.addEventListener('input', applyFilters);
            }, 100);

            // Add Evaluations Section (ISO 17021-1 Clause 7.2 - Auditor Performance Monitoring)
            const evaluations = auditor.evaluations || { witnessAudits: [], performanceReviews: [] };
            const witnessAudits = evaluations.witnessAudits || [];
            const performanceReviews = evaluations.performanceReviews || [];
            const reportReviews = evaluations.reportReviews || []; // New feature
            const linkedComplaints = evaluations.linkedComplaints || []; // New feature

            // Witness Audit Due Calculation Logic
            let nextWitness = evaluations.nextWitnessAuditDue || 'Not scheduled';
            let nextWitnessColor = '#3b82f6'; // Default Blue
            let nextWitnessText = nextWitness;
            const isFirstTime = evaluations.firstTimeAuditor;

            if (isFirstTime && witnessAudits.length === 0) {
                nextWitnessColor = '#dc2626'; // Red
                nextWitnessText = 'REQUIRED (First Time)';
            } else if (nextWitness !== 'Not scheduled') {
                const today = new Date();
                const dueDate = new Date(nextWitness);
                const monthsUntil = (dueDate - today) / (1000 * 60 * 60 * 24 * 30);

                if (dueDate < today) {
                    nextWitnessColor = '#dc2626'; // Red
                    nextWitnessText = `${nextWitness} (Overdue)`;
                } else if (monthsUntil <= 6) {
                    nextWitnessColor = '#f59e0b'; // Orange
                }
            } else if (witnessAudits.length === 0) {
                nextWitnessColor = '#dc2626'; // Red
            }

            // Performance Summary Cards
            const perfSummaryHTML = `
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1.5rem 0;">
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                        <i class="fa-solid fa-eye" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${witnessAudits.length}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Witness Audits</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                        <i class="fa-solid fa-chart-line" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${performanceReviews.length}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Perf. Reviews</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #8b5cf6;">
                        <i class="fa-solid fa-file-signature" style="font-size: 1.5rem; color: #8b5cf6; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${reportReviews.length}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Report Reviews</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${auditor.customerRating && auditor.customerRating >= 4 ? '#10b981' : '#f59e0b'};">
                        <i class="fa-solid fa-star" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${auditor.customerRating || '-'}/5</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Avg Rating</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${nextWitnessColor};">
                        <i class="fa-solid fa-calendar-check" style="font-size: 1.5rem; color: ${nextWitnessColor}; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 0.9rem; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${nextWitnessText}">${nextWitnessText}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Next Witness Due</p>
                    </div>
                </div>
            `;

            // Witness Audits Section
            const witnessAuditsHTML = `
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-eye" style="margin-right: 0.5rem; color: #3b82f6;"></i>
                            Witness Audits
                        </h3>
                        <button class="btn btn-sm btn-primary" onclick="window.addWitnessAudit(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Record Witness Audit
                        </button>
                    </div>
                    <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                        ISO 17021-1 Clause 7.2.12 requires periodic observation of auditors during audits.
                    </p>
                    ${witnessAudits.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Client</th>
                                        <th>Standard</th>
                                        <th>Witnessed By</th>
                                        <th>Rating</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${witnessAudits.map(w => `
                                        <tr>
                                            <td>${window.UTILS.escapeHtml(w.date)}</td>
                                            <td>${window.UTILS.escapeHtml(w.client)}</td>
                                            <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${window.UTILS.escapeHtml(w.standard)}</span></td>
                                            <td>${window.UTILS.escapeHtml(w.witnessedBy)}</td>
                                            <td>
                                                <span style="color: #fbbf24;">${'★'.repeat(w.rating || 0)}${'☆'.repeat(5 - (w.rating || 0))}</span>
                                            </td>
                                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UTILS.escapeHtml(w.notes || '')}">${window.UTILS.escapeHtml(w.notes || '-')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #fef3c7; border-radius: 8px;">
                            <i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                            <p style="color: #92400e; margin: 0;">No witness audits recorded. Schedule monitoring per ISO 17021-1.</p>
                        </div>
                    `}
                </div>
            `;

            // Performance Reviews Section
            const performanceReviewsHTML = `
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem; color: #10b981;"></i>
                            Performance Reviews
                        </h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.addPerformanceReview(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Review
                        </button>
                    </div>
                    ${performanceReviews.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Review Type</th>
                                        <th>Overall Rating</th>
                                        <th>Reviewed By</th>
                                        <th>Outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${performanceReviews.map(r => `
                                        <tr>
                                            <td>${window.UTILS.escapeHtml(r.date)}</td>
                                            <td>${window.UTILS.escapeHtml(r.type)}</td>
                                            <td>
                                                <span style="background: ${r.rating >= 4 ? '#d1fae5' : r.rating >= 3 ? '#fef3c7' : '#fee2e2'}; 
                                                    color: ${r.rating >= 4 ? '#065f46' : r.rating >= 3 ? '#92400e' : '#991b1b'};
                                                    padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                                                    ${r.rating}/5
                                                </span>
                                            </td>
                                            <td>${window.UTILS.escapeHtml(r.reviewedBy)}</td>
                                            <td><span class="status-badge status-${(r.outcome || 'pending').toLowerCase()}">${window.UTILS.escapeHtml(r.outcome || 'Pending')}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #f1f5f9; border-radius: 8px;">
                            <p style="color: #64748b; margin: 0;">No performance reviews recorded yet.</p>
                        </div>
                    `}
                </div>
            `;

            // Audit History Section
            const historyRows = (auditor.auditHistory || []).length > 0
                ? auditor.auditHistory.map(h => `
                    <tr>
                        <td>${window.UTILS.escapeHtml(h.client)}</td>
                        <td>${window.UTILS.escapeHtml(h.date)}</td>
                        <td><span class="status-badge status-completed">${window.UTILS.escapeHtml(h.type)}</span></td>
                    </tr>
                `).join('')
                : '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No audit history available yet.</td></tr>';

            // Report Reviews Section
            const reportReviewsHTML = `
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-file-signature" style="margin-right: 0.5rem; color: #8b5cf6;"></i>
                            Report Reviews
                        </h3>
                        <button class="btn btn-sm" style="background: #8b5cf6; color: white; border: none;" onclick="window.addReportReview(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Report Review
                        </button>
                    </div>
                    ${reportReviews.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Report Type</th>
                                        <th>Client</th>
                                        <th>Quality</th>
                                        <th>Completeness</th>
                                        <th>Technical</th>
                                        <th>Reviewer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${reportReviews.map(r => `
                                        <tr>
                                            <td>${window.UTILS.escapeHtml(r.reviewDate)}</td>
                                            <td>${window.UTILS.escapeHtml(r.reportType)}</td>
                                            <td>${window.UTILS.escapeHtml(r.client)}</td>
                                            <td>${r.qualityRating}/5</td>
                                            <td>${r.completenessRating}/5</td>
                                            <td>${r.technicalRating}/5</td>
                                            <td>${window.UTILS.escapeHtml(r.reviewer)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #fdf4ff; border-radius: 8px;">
                            <p style="color: #6b21a8; margin: 0;">No report reviews recorded yet.</p>
                        </div>
                    `}
                </div>
            `;

            // Linked Complaints Section
            const linkedComplaintsHTML = `
                <div class="card" style="margin-top: 1.5rem; border-left: 4px solid ${linkedComplaints.length > 0 ? '#dc2626' : '#9ca3af'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem; color: ${linkedComplaints.length > 0 ? '#dc2626' : '#6b7280'};"></i>
                            Linked Complaints
                        </h3>
                    </div>
                    ${linkedComplaints.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>ID</th>
                                        <th>Subject</th>
                                        <th>Severity</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${linkedComplaints.map(c => `
                                        <tr>
                                            <td>${c.date}</td>
                                            <td>CMP-${String(c.complaintId).padStart(3, '0')}</td>
                                            <td>${c.subject}</td>
                                            <td><span class="badge" style="background: ${c.severity === 'Critical' || c.severity === 'High' ? '#fee2e2' : '#fef3c7'}; color: ${c.severity === 'Critical' || c.severity === 'High' ? '#991b1b' : '#92400e'};">${c.severity || 'Medium'}</span></td>
                                            <td><span class="badge" style="background: #f3f4f6; color: #374151;">${c.status}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-outline-primary" onclick="window.viewComplaintDetail(${c.complaintId})">
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #f9fafb; border-radius: 8px;">
                            <p style="color: #6b7280; margin: 0;">No complaints linked to this auditor.</p>
                        </div>
                    `}
                </div>
            `;

            const auditHistoryHTML = `
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-history" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit History</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Date</th>
                                    <th>Audit Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historyRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Append only core activity sections
            tabContent.innerHTML += perfSummaryHTML + witnessAuditsHTML + auditHistoryHTML;
            break;
        case 'performance':
            // Performance tab - Performance Reviews + Report Reviews
            const perfEvaluations = auditor.evaluations || { performanceReviews: [], reportReviews: [] };
            const perfReviews = perfEvaluations.performanceReviews || [];
            const rptReviews = perfEvaluations.reportReviews || [];

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem; color: #10b981;"></i>
                            Performance Reviews
                        </h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.addPerformanceReview(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Review
                        </button>
                    </div>
                    ${perfReviews.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Review Type</th>
                                        <th>Overall Rating</th>
                                        <th>Reviewed By</th>
                                        <th>Outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${perfReviews.map(r => `
                                        <tr>
                                            <td>${r.date}</td>
                                            <td>${r.type}</td>
                                            <td>
                                                <span style="background: ${r.rating >= 4 ? '#d1fae5' : r.rating >= 3 ? '#fef3c7' : '#fee2e2'}; 
                                                    color: ${r.rating >= 4 ? '#065f46' : r.rating >= 3 ? '#92400e' : '#991b1b'};
                                                    padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                                                    ${r.rating}/5
                                                </span>
                                            </td>
                                            <td>${r.reviewedBy}</td>
                                            <td><span class="status-badge status-${r.outcome?.toLowerCase() || 'pending'}">${r.outcome || 'Pending'}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #f1f5f9; border-radius: 8px;">
                            <p style="color: #64748b; margin: 0;">No performance reviews recorded yet.</p>
                        </div>
                    `}
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-file-signature" style="margin-right: 0.5rem; color: #8b5cf6;"></i>
                            Report Reviews
                        </h3>
                        <button class="btn btn-sm" style="background: #8b5cf6; color: white; border: none;" onclick="window.addReportReview(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Report Review
                        </button>
                    </div>
                    ${rptReviews.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Report Type</th>
                                        <th>Client</th>
                                        <th>Quality</th>
                                        <th>Completeness</th>
                                        <th>Technical</th>
                                        <th>Reviewer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rptReviews.map(r => `
                                        <tr>
                                            <td>${r.reviewDate}</td>
                                            <td>${r.reportType}</td>
                                            <td>${r.client}</td>
                                            <td>${r.qualityRating}/5</td>
                                            <td>${r.completenessRating}/5</td>
                                            <td>${r.technicalRating}/5</td>
                                            <td>${r.reviewer}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 2rem; background: #fdf4ff; border-radius: 8px;">
                            <p style="color: #6b21a8; margin: 0;">No report reviews recorded yet.</p>
                        </div>
                    `}
                </div>
            `;
            break;
        case 'complaints':
            // Complaints tab - Linked Complaints
            const complaintEvaluations = auditor.evaluations || { linkedComplaints: [] };
            const auditLinkedComplaints = complaintEvaluations.linkedComplaints || [];

            tabContent.innerHTML = `
                <div class="card" style="border-left: 4px solid ${auditLinkedComplaints.length > 0 ? '#dc2626' : '#9ca3af'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">
                            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem; color: ${auditLinkedComplaints.length > 0 ? '#dc2626' : '#6b7280'};"></i>
                            Linked Complaints
                        </h3>
                        <span style="background: ${auditLinkedComplaints.length > 0 ? '#fee2e2' : '#f3f4f6'}; color: ${auditLinkedComplaints.length > 0 ? '#991b1b' : '#6b7280'}; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">
                            ${auditLinkedComplaints.length} complaint${auditLinkedComplaints.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                        Customer complaints linked to this auditor per ISO 17021-1 Clause 9.10.
                    </p>
                    ${auditLinkedComplaints.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Complaint ID</th>
                                        <th>Subject</th>
                                        <th>Type</th>
                                        <th>Severity</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${auditLinkedComplaints.map(c => `
                                        <tr>
                                            <td>${c.date}</td>
                                            <td><strong>CMP-${String(c.complaintId).padStart(3, '0')}</strong></td>
                                            <td>${c.subject}</td>
                                            <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${c.type}</span></td>
                                            <td><span class="badge" style="background: ${c.severity === 'Critical' || c.severity === 'High' ? '#fee2e2' : '#fef3c7'}; color: ${c.severity === 'Critical' || c.severity === 'High' ? '#991b1b' : '#92400e'};">${c.severity || 'Medium'}</span></td>
                                            <td><span class="badge" style="background: #f3f4f6; color: #374151;">${c.status}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-outline-primary" onclick="window.viewComplaintDetail(${c.complaintId})">
                                                    <i class="fa-solid fa-eye" style="margin-right: 0.25rem;"></i>View
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 3rem; background: #f9fafb; border-radius: 8px;">
                            <i class="fa-solid fa-check-circle" style="font-size: 2rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                            <p style="color: #6b7280; margin: 0;">No complaints linked to this auditor. Good standing!</p>
                        </div>
                    `}
                </div>
            `;
            break;
        case 'qualifications':
            // Get qualifications or generate from standards
            const qualifications = auditor.qualifications || auditor.standards.map(std => ({
                standard: std,
                level: auditor.role === 'Lead Auditor' ? 'Lead Auditor' : 'Auditor',
                issueDate: '2022-01-15',
                expiryDate: '2025-12-31',
                certNumber: `CERT-${std.replace(/\s+/g, '-').toUpperCase()}-${auditor.id}`,
                issuingBody: 'IRCA'
            }));

            // Calculate status for each qualification
            const todayDate = new Date();
            const getQualStatus = (expiryDate) => {
                const expiry = new Date(expiryDate);
                const daysUntil = Math.ceil((expiry - todayDate) / (1000 * 60 * 60 * 24));
                if (daysUntil < 0) return { status: 'Expired', color: '#dc2626', bg: '#fef2f2' };
                if (daysUntil <= 30) return { status: 'Expiring Soon', color: '#d97706', bg: '#fffbeb' };
                if (daysUntil <= 90) return { status: 'Renew Soon', color: '#2563eb', bg: '#eff6ff' };
                return { status: 'Active', color: '#16a34a', bg: '#f0fdf4' };
            };

            // CPD hours calculation
            const totalCPD = (auditor.trainings || []).reduce((sum, t) => sum + (t.cpdHours || 0), 0);
            const requiredCPD = 40;

            tabContent.innerHTML = `
                <!-- CPD Summary -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                        <i class="fa-solid fa-certificate" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${qualifications.length}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Qualifications</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${totalCPD >= requiredCPD ? '#16a34a' : '#f59e0b'};">
                        <i class="fa-solid fa-graduation-cap" style="font-size: 1.5rem; color: ${totalCPD >= requiredCPD ? '#16a34a' : '#f59e0b'}; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${totalCPD}/${requiredCPD}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">CPD Hours</p>
                    </div>
                    <div class="card" style="margin: 0; text-align: center; border-left: 4px solid ${qualifications.some(q => getQualStatus(q.expiryDate).status === 'Expired') ? '#dc2626' : '#16a34a'};">
                        <i class="fa-solid fa-shield-halved" style="font-size: 1.5rem; color: ${qualifications.some(q => getQualStatus(q.expiryDate).status === 'Expired') ? '#dc2626' : '#16a34a'}; margin-bottom: 0.5rem;"></i>
                        <p style="font-size: 1.5rem; font-weight: 700; margin: 0;">${qualifications.filter(q => getQualStatus(q.expiryDate).status === 'Active').length}</p>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Active Certs</p>
                    </div>
                </div>

                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-certificate" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Qualifications & Certifications</h3>
                        <button class="btn btn-sm btn-primary" onclick="window.openAddQualificationModal(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Qualification
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Standard</th>
                                    <th>Level</th>
                                    <th>Cert Number</th>
                                    <th>Issuing Body</th>
                                    <th>Issue Date</th>
                                    <th>Expiry Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${qualifications.map(q => {
                const status = getQualStatus(q.expiryDate);
                return `
                                    <tr>
                                        <td style="font-weight: 500;">${q.standard}</td>
                                        <td><span style="background: ${q.level === 'Lead Auditor' ? '#dbeafe' : '#f1f5f9'}; color: ${q.level === 'Lead Auditor' ? '#1e40af' : '#475569'}; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${q.level}</span></td>
                                        <td style="font-family: monospace; font-size: 0.85rem;">${q.certNumber}</td>
                                        <td>${q.issuingBody}</td>
                                        <td>${q.issueDate}</td>
                                        <td>${q.expiryDate}</td>
                                        <td><span style="background: ${status.bg}; color: ${status.color}; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${status.status}</span></td>
                                    </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Industry Competence -->
                <div class="card" style="margin-top: 1rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-industry" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Industry Competence</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${(auditor.industries || ['Manufacturing', 'IT']).map(ind => `
                            <span style="background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem;">
                                <i class="fa-solid fa-check-circle" style="margin-right: 0.25rem;"></i>${ind}
                            </span>
                        `).join('')}
                    </div>
                </div>

                <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                        <strong>ISO 17021-1 Clause 7.2:</strong> Auditor competence must be maintained and monitored. Qualifications require renewal before expiry.
                    </p>
                </div>

                <!-- Training Records -->
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;"><i class="fa-solid fa-book-open" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Training Records</h3>
                        <button class="btn btn-sm btn-primary" onclick="window.openAddTrainingModal(${auditor.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Training
                        </button>
                    </div>
                    ${(auditor.trainings && auditor.trainings.length > 0) ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr><th>Course</th><th>Provider</th><th>Date</th><th>CPD Hours</th><th>Certificate</th></tr>
                                </thead>
                                <tbody>
                                    ${auditor.trainings.map(t => `
                                        <tr>
                                            <td>${t.course}</td>
                                            <td>${t.provider}</td>
                                            <td>${t.date}</td>
                                            <td><span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${t.cpdHours || 0} hrs</span></td>
                                            <td>${t.certificate ? '<i class="fa-solid fa-file-pdf" style="color: var(--danger-color);"></i> View' : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p style="color: var(--text-secondary);">No training records available.</p>'}
                </div>
            `;
            break;

        case 'clients':
            tabContent.innerHTML = getAuditorClientsTabHTML(auditor);
            break;

        case 'documents':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Documents & Attachments</h3>
                    ${(auditor.documents && auditor.documents.length > 0) ? `
                        <div style="display: grid; gap: 0.5rem;">
                            ${auditor.documents.map(d => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-sm); border-left: 3px solid var(--primary-color);">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <i class="fa-solid fa-file-${d.type === 'pdf' ? 'pdf' : d.type === 'image' ? 'image' : 'alt'}" style="font-size: 1.5rem; color: ${d.type === 'pdf' ? 'var(--danger-color)' : 'var(--primary-color)'};"></i>
                                        <div>
                                            <p style="font-weight: 500; margin: 0;">${d.name}</p>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Uploaded: ${d.date}</p>
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-download"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">No documents uploaded.</p>'}
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openAuditorUploadModal(${auditor.id})">
                        <i class="fa-solid fa-cloud-arrow-up" style="margin-right: 0.5rem;"></i> Upload Document
                    </button>
                </div>
            `;
            break;
    }
}

function getAuditorClientsTabHTML(auditor) {
    const assignments = window.state.auditorAssignments || [];
    // Filter assignments for this auditor
    const assignedIds = assignments.filter(a => a.auditorId == auditor.id).map(a => a.clientId);
    const assignedClients = window.state.clients.filter(c => assignedIds.includes(c.id));

    return `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">
                <i class="fa-solid fa-briefcase" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                Active Clients
            </h3>
            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                ${assignedClients.length} clients assigned
            </div>
        </div>
        
        ${assignedClients.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client Name</th>
                            <th>Status</th>
                            <th>Location</th>
                            <th>Standard</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assignedClients.map(client => `
                            <tr>
                                <td style="font-weight: 500;">${window.UTILS.escapeHtml(client.name)}</td>
                                <td><span class="status-badge status-${(client.status || 'Active').toLowerCase()}">${window.UTILS.escapeHtml(client.status || 'Active')}</span></td>
                                <td>${window.UTILS.escapeHtml(client.city || '-')}</td>
                                <td>${window.UTILS.escapeHtml(client.standard || '-')}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary" onclick="window.renderClientDetail(${client.id})">
                                        View Dashboard
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                <i class="fa-solid fa-briefcase" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem;"></i>
                <p style="color: #64748b; margin: 0;">No clients currently assigned to this auditor.</p>
            </div>
        `}
    </div>
    `;
}

function renderCompetenceMatrix() {
    const standards = ['ISO 9001', 'ISO 14001', 'ISO 27001', 'ISO 45001'];
    const industries = [
        'Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services',
        'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction',
        'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'
    ];

    // Calculate statistics
    const totalAuditors = state.auditors.length;
    const leadAuditors = state.auditors.filter(a => a.role === 'Lead Auditor').length;
    const avgExperience = state.auditors.length > 0
        ? (state.auditors.reduce((sum, a) => sum + (a.experience || 0), 0) / state.auditors.length).toFixed(1)
        : 0;

    // Get experience level badge
    const getExperienceBadge = (years) => {
        if (!years) return '<span style="color: var(--text-secondary);">-</span>';
        if (years < 3) return `<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${years} yrs (Junior)</span>`;
        if (years < 8) return `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${years} yrs (Mid)</span>`;
        return `<span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${years} yrs (Senior)</span>`;
    };

    // Get industry badges
    const getIndustryBadges = (auditorIndustries) => {
        if (!auditorIndustries || auditorIndustries.length === 0) {
            return '<span style="color: var(--text-secondary);">Not specified</span>';
        }
        return auditorIndustries.map(ind =>
            `<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin: 1px;">${ind}</span>`
        ).join(' ');
    };

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-secondary" onclick="renderAuditorsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Auditors
                </button>
                <button class="btn btn-primary" onclick="window.exportCompetenceMatrix()">
                    <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Export Matrix
                </button>
            </div>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Total Auditors</p>
                    <p style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${totalAuditors}</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Lead Auditors</p>
                    <p style="font-size: 2rem; font-weight: 700; color: var(--success-color);">${leadAuditors}</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Avg Experience</p>
                    <p style="font-size: 2rem; font-weight: 700; color: var(--info-color);">${avgExperience} yrs</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Standards Covered</p>
                    <p style="font-size: 2rem; font-weight: 700; color: var(--warning-color);">${standards.length}</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-matrix-tab="standards">Standards Competence</button>
                <button class="tab-btn" data-matrix-tab="industries">Industry Experience</button>
                <button class="tab-btn" data-matrix-tab="detailed">Detailed View</button>
            </div>

            <div id="matrix-content"></div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Tab switching
    document.querySelectorAll('[data-matrix-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-matrix-tab]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMatrixTab(e.target.getAttribute('data-matrix-tab'), standards, industries, getExperienceBadge, getIndustryBadges);
        });
    });

    // Render initial tab
    renderMatrixTab('standards', standards, industries, getExperienceBadge, getIndustryBadges);
}

function renderMatrixTab(tabName, standards, industries, getExperienceBadge, getIndustryBadges) {
    const matrixContent = document.getElementById('matrix-content');
    const state = window.state;

    switch (tabName) {
        case 'standards':
            matrixContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-certificate" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                        Standards Qualification Matrix
                    </h3>
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th style="min-width: 180px;">Auditor</th>
                                    <th style="min-width: 100px;">Role</th>
                                    <th style="min-width: 100px;">Experience</th>
                                    ${standards.map(std => `<th style="text-align: center; min-width: 90px;">${std}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${state.auditors.map(auditor => `
                                    <tr>
                                        <td style="font-weight: 500;">${auditor.name}</td>
                                        <td><span style="background: ${auditor.role === 'Lead Auditor' ? 'var(--primary-color)' : 'var(--secondary-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${auditor.role}</span></td>
                                        <td>${getExperienceBadge(auditor.experience)}</td>
                                        ${standards.map(std => {
                const hasStd = auditor.standards && auditor.standards.some(s => s.includes(std.split(' ')[1]));
                return `<td style="text-align: center;">
                                                ${hasStd
                        ? '<i class="fa-solid fa-check-circle" style="color: var(--success-color); font-size: 1.2rem;"></i>'
                        : '<span style="color: #cbd5e1;">-</span>'}
                                            </td>`;
            }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;

        case 'industries':
            matrixContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-industry" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                        Industry Experience Matrix
                    </h3>
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th style="min-width: 180px;">Auditor</th>
                                    <th style="min-width: 100px;">Experience</th>
                                    ${industries.map(ind => `<th style="text-align: center; min-width: 80px; font-size: 0.75rem; writing-mode: vertical-rl; transform: rotate(180deg); height: 100px;">${ind}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${state.auditors.map(auditor => `
                                    <tr>
                                        <td style="font-weight: 500;">${auditor.name}</td>
                                        <td>${getExperienceBadge(auditor.experience)}</td>
                                        ${industries.map(ind => {
                const hasInd = auditor.industries && auditor.industries.includes(ind);
                return `<td style="text-align: center;">
                                                ${hasInd
                        ? '<i class="fa-solid fa-check" style="color: var(--success-color);"></i>'
                        : '<span style="color: #e2e8f0;">-</span>'}
                                            </td>`;
            }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Industry Coverage Summary -->
                    <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">Industry Coverage Summary</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            ${industries.map(ind => {
                const count = state.auditors.filter(a => a.industries && a.industries.includes(ind)).length;
                const percentage = state.auditors.length > 0 ? Math.round((count / state.auditors.length) * 100) : 0;
                const bgColor = percentage > 50 ? '#d1fae5' : percentage > 25 ? '#fef3c7' : '#fee2e2';
                const textColor = percentage > 50 ? '#065f46' : percentage > 25 ? '#92400e' : '#991b1b';
                return `<div style="background: ${bgColor}; color: ${textColor}; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem;">
                                    <strong>${ind}</strong>: ${count} auditor${count !== 1 ? 's' : ''} (${percentage}%)
                                </div>`;
            }).join('')}
                        </div>
                    </div>
                </div>
            `;
            break;

        case 'detailed':
            matrixContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                        Detailed Auditor Competence
                    </h3>
                    <div style="display: grid; gap: 1rem;">
                        ${state.auditors.map(auditor => `
                            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; background: #fafafa;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                    <div style="display: flex; gap: 1rem; align-items: center;">
                                        ${auditor.pictureUrl ? `
                                            <img src="${auditor.pictureUrl}" alt="${auditor.name}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);">
                                        ` : `
                                            <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600;">
                                                ${auditor.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                        `}
                                        <div>
                                            <h4 style="margin: 0 0 0.25rem 0;">${auditor.name}</h4>
                                            <span style="background: ${auditor.role === 'Lead Auditor' ? 'var(--primary-color)' : 'var(--secondary-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${auditor.role}</span>
                                        </div>
                                    </div>
                                    ${getExperienceBadge(auditor.experience)}
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-certificate" style="margin-right: 0.5rem;"></i>Standards</p>
                                        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                                            ${(auditor.standards || []).map(std =>
                `<span style="background: var(--primary-color); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${std}</span>`
            ).join('') || '<span style="color: var(--text-secondary);">None</span>'}
                                        </div>
                                    </div>
                                    <div>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-industry" style="margin-right: 0.5rem;"></i>Industries</p>
                                        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                                            ${getIndustryBadges(auditor.industries)}
                                        </div>
                                    </div>
                                </div>
                                
                                ${auditor.domainExpertise && auditor.domainExpertise.length > 0 ? `
                                <div style="margin-top: 1rem;">
                                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-brain" style="margin-right: 0.5rem;"></i>Domain Expertise</p>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                                        ${auditor.domainExpertise.map(exp =>
                `<span style="background: #ede9fe; color: #5b21b6; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${exp}</span>`
            ).join('')}
                                    </div>
                                </div>
                                ` : ''}
                                
                                ${auditor.education && (auditor.education.degree || auditor.education.fieldOfStudy) ? `
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-graduation-cap" style="margin-right: 0.5rem;"></i>Academic Qualifications</p>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                                        ${auditor.education.degree ? `<span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${auditor.education.degree}</span>` : ''}
                                        ${auditor.education.fieldOfStudy ? `<span style="background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">in ${auditor.education.fieldOfStudy}</span>` : ''}
                                        ${auditor.education.specialization ? `<span style="color: var(--text-secondary); font-size: 0.75rem; font-style: italic;">| ${auditor.education.specialization}</span>` : ''}
                                    </div>
                                </div>
                                ` : ''}
                                
                                <!-- Travel & Languages -->
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                                        <div>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-passport" style="margin-right: 0.5rem;"></i>Passport</p>
                                            ${auditor.hasPassport !== undefined ? `
                                                <span style="background: ${auditor.hasPassport ? '#d1fae5' : '#fee2e2'}; color: ${auditor.hasPassport ? '#065f46' : '#991b1b'}; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">
                                                    ${auditor.hasPassport ? '✓ Valid' : '✗ No'}
                                                </span>
                                            ` : '<span style="color: var(--text-secondary); font-size: 0.75rem;">Not specified</span>'}
                                        </div>
                                        <div>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-plane" style="margin-right: 0.5rem;"></i>Travel</p>
                                            ${auditor.willingToTravel ? `
                                                <span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">
                                                    ${auditor.willingToTravel === 'international' ? '🌍 International' : auditor.willingToTravel === 'regional' ? '🗺️ Regional' : auditor.willingToTravel === 'local' ? '📍 Local' : '❌ Not Available'}
                                                </span>
                                            ` : '<span style="color: var(--text-secondary); font-size: 0.75rem;">Not specified</span>'}
                                        </div>
                                        <div>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-star" style="margin-right: 0.5rem;"></i>Rating</p>
                                            ${auditor.customerRating ? `
                                                <span style="color: #f59e0b; font-size: 0.9rem;">
                                                    ${'⭐'.repeat(auditor.customerRating)}${'☆'.repeat(5 - auditor.customerRating)}
                                                </span>
                                            ` : '<span style="color: var(--text-secondary); font-size: 0.75rem;">No rating</span>'}
                                        </div>
                                    </div>
                                    ${auditor.languages && auditor.languages.length > 0 ? `
                                    <div style="margin-top: 1rem;">
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-language" style="margin-right: 0.5rem;"></i>Languages</p>
                                        <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                                            ${auditor.languages.map(lang => `<span style="background: #f0fdf4; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${lang}</span>`).join('')}
                                        </div>
                                    </div>
                                    ` : ''}
                                    
                                    ${auditor.dateJoined ? `
                                    <div style="margin-top: 1rem;">
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fa-solid fa-calendar-check" style="margin-right: 0.5rem;"></i>Date Joined</p>
                                        <span style="font-size: 0.85rem;">${new Date(auditor.dateJoined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Soft Skills -->
                                ${auditor.softSkills ? `
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;"><i class="fa-solid fa-user-check" style="margin-right: 0.5rem;"></i>Soft Skills Assessment</p>
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                                        ${Object.entries(auditor.softSkills).map(([skill, level]) => {
                const skillName = skill.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const levelColors = {
                    'excellent': { bg: '#d1fae5', color: '#065f46' },
                    'good': { bg: '#dbeafe', color: '#1e40af' },
                    'average': { bg: '#fef3c7', color: '#92400e' },
                    'needs-improvement': { bg: '#fee2e2', color: '#991b1b' }
                };
                const colors = levelColors[level] || { bg: '#f1f5f9', color: '#475569' };
                return `<div style="background: ${colors.bg}; padding: 0.5rem; border-radius: 6px; text-align: center;">
                                                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${skillName}</div>
                                                <div style="font-size: 0.75rem; color: ${colors.color}; font-weight: 500;">${level.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                                            </div>`;
            }).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            break;
    }
}

function exportCompetenceMatrix() {
    window.showNotification('Competence Matrix export will be available soon.', 'info');
}

window.renderMatrixTab = renderMatrixTab;
window.exportCompetenceMatrix = exportCompetenceMatrix;



// ============================================
// MAN-DAY CALCULATOR (ISO 17021-1)
// ============================================

function calculateManDays(employees, sites, effectiveness, shiftWork, riskLevel) {
    // ISO 17021-1 base man-days table (simplified)
    let baseDays = 0;

    if (employees <= 10) baseDays = 2;
    else if (employees <= 25) baseDays = 3;
    else if (employees <= 50) baseDays = 4;
    else if (employees <= 100) baseDays = 6;
    else if (employees <= 250) baseDays = 9;
    else if (employees <= 500) baseDays = 12;
    else if (employees <= 1000) baseDays = 16;
    else if (employees <= 2500) baseDays = 21;
    else baseDays = 30;

    // Adjust for effectiveness
    const effectivenessMultiplier = {
        1: 1.2,  // Low effectiveness
        2: 1.0,  // Normal
        3: 0.8   // High effectiveness
    };
    baseDays *= effectivenessMultiplier[effectiveness] || 1.0;

    // Adjust for sites (add 20% per additional site)
    if (sites > 1) {
        baseDays += baseDays * 0.2 * (sites - 1);
    }

    // Adjust for shift work (add 20%)
    if (shiftWork) {
        baseDays *= 1.2;
    }

    // Adjust for risk
    const riskMultiplier = {
        'Low': 0.9,
        'Medium': 1.0,
        'High': 1.3
    };
    baseDays *= riskMultiplier[riskLevel] || 1.0;

    return {
        stage1: Math.ceil(baseDays * 0.2),  // 20% for Stage 1
        stage2: Math.ceil(baseDays),
        surveillance: Math.ceil(baseDays * 0.33)  // 33% for Surveillance
    };
}

// ============================================
// MAN-DAY CALCULATOR UI
// ============================================

function renderManDayCalculator() {
    const html = `
        <div class="fade-in">
            <!-- Back Button -->
            <div style="margin-bottom: 1rem;">
                <button class="btn btn-secondary" onclick="window.location.hash = 'dashboard'">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to Dashboard
                </button>
            </div>
            
            <div class="card" style="max-width: 800px; margin: 0 auto;">
                <h2 style="margin-bottom: 1rem; color: var(--primary-color);">
                    <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                    Man-Day Calculator (ISO 17021-1)
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Calculate audit duration based on ISO/IEC 17021-1 requirements
                </p>

                <form id="manday-form" style="margin-bottom: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Employees -->
                        <div class="form-group">
                            <label for="employees">Number of Employees <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="employees" min="1" value="100" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">Total permanent employees</small>
                        </div>

                        <!-- Sites -->
                        <div class="form-group">
                            <label for="sites">Number of Sites <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="sites" min="1" value="1" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">Number of locations</small>
                        </div>

                        <!-- Effectiveness -->
                        <div class="form-group">
                            <label for="effectiveness">Management System Effectiveness <span style="color: var(--danger-color);">*</span></label>
                            <select id="effectiveness" required>
                                <option value="1">Low (First time, new system)</option>
                                <option value="2" selected>Normal (Established system)</option>
                                <option value="3">High (Mature, well-documented)</option>
                            </select>
                        </div>

                        <!-- Shift Work -->
                        <div class="form-group">
                            <label for="shiftwork">Shift Work Operations <span style="color: var(--danger-color);">*</span></label>
                            <select id="shiftwork" required>
                                <option value="false" selected>No</option>
                                <option value="true">Yes (Multiple shifts)</option>
                            </select>
                        </div>

                        <!-- Risk Level -->
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label for="risk">Operational Risk Level <span style="color: var(--danger-color);">*</span></label>
                            <select id="risk" required>
                                <option value="Low">Low (Office work, low hazard)</option>
                                <option value="Medium" selected>Medium (Standard operations)</option>
                                <option value="High">High (Hazardous, complex processes)</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                        Calculate Man-Days
                    </button>
                </form>

                <!-- Results Section -->
                <div id="calculation-results" style="display: none;">
                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 2rem 0;">
                    
                    <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                        <i class="fa-solid fa-chart-bar" style="margin-right: 0.5rem;"></i>
                        Calculated Audit Duration
                    </h3>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Stage 1</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-stage1">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Stage 2</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-stage2">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Surveillance</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-surveillance">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>
                    </div>

                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">
                            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                            Calculation Details
                        </h4>
                        <div id="calculation-details" style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.8;">
                            <!-- Dynamic calculation breakdown will appear here -->
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <button class="btn btn-primary" onclick="saveCalculationToPlan()">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                            Save to Audit Plan
                        </button>
                        <button class="btn btn-secondary" onclick="printCalculation()">
                            <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>
                            Print Results
                        </button>
                    </div>
                </div>

                <!-- Reference Table -->
                <div style="margin-top: 3rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i>
                        ISO 17021-1 Reference Table
                    </h4>
                    <div style="overflow-x: auto;">
                        <table style="font-size: 0.875rem;">
                            <thead>
                                <tr>
                                    <th>Number of Employees</th>
                                    <th>Base Man-Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>1 - 10</td><td>2 days</td></tr>
                                <tr><td>11 - 25</td><td>3 days</td></tr>
                                <tr><td>26 - 50</td><td>4 days</td></tr>
                                <tr><td>51 - 100</td><td>6 days</td></tr>
                                <tr><td>101 - 250</td><td>9 days</td></tr>
                                <tr><td>251 - 500</td><td>12 days</td></tr>
                                <tr><td>501 - 1000</td><td>16 days</td></tr>
                                <tr><td>1001 - 2500</td><td>21 days</td></tr>
                                <tr><td>2501+</td><td>30 days</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Form submission handler
    document.getElementById('manday-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const employees = parseInt(document.getElementById('employees').value);
        const sites = parseInt(document.getElementById('sites').value);
        const effectiveness = parseInt(document.getElementById('effectiveness').value);
        const shiftWork = document.getElementById('shiftwork').value === 'true';
        const risk = document.getElementById('risk').value;

        // Calculate
        const results = calculateManDays(employees, sites, effectiveness, shiftWork, risk);

        // Display results
        document.getElementById('result-stage1').textContent = results.stage1;
        document.getElementById('result-stage2').textContent = results.stage2;
        document.getElementById('result-surveillance').textContent = results.surveillance;

        // Show breakdown
        const details = `
            <div style="display: grid; gap: 0.5rem;">
                <div><strong>Base Parameters:</strong></div>
                <div>• Employees: ${employees}</div>
                <div>• Sites: ${sites} ${sites > 1 ? '(+20% per additional site)' : ''}</div>
                <div>• Effectiveness: ${effectiveness === 1 ? 'Low (+20%)' : effectiveness === 3 ? 'High (-20%)' : 'Normal'}</div>
                <div>• Shift Work: ${shiftWork ? 'Yes (+20%)' : 'No'}</div>
                <div>• Risk Level: ${risk} ${risk === 'High' ? '(+30%)' : risk === 'Low' ? '(-10%)' : ''}</div>
                <div style="margin-top: 0.5rem;"><strong>Stage Breakdown:</strong></div>
                <div>• Stage 1 = 20% of base calculation</div>
                <div>• Stage 2 = Full base calculation</div>
                <div>• Surveillance = 33% of base calculation</div>
            </div>
        `;
        document.getElementById('calculation-details').innerHTML = details;

        // Show results section
        document.getElementById('calculation-results').style.display = 'block';

        // Scroll to results
        document.getElementById('calculation-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// Helper functions for calculator
function saveCalculationToPlan() {
    showNotification('Man-day calculation saved to draft audit plan', 'success');
}

function printCalculation() {
    window.print();
}

// ============================================
// MULTI-SITE SAMPLING CALCULATOR (IAF MD 1)
// ============================================

function calculateMultiSiteSample(totalSites, riskLevel, hasNCRs, hasComplexProcesses) {
    // IAF MD 1 Base Formula: Sample Size = √n (rounded up)
    let baseSample = Math.ceil(Math.sqrt(totalSites));

    // Risk Adjustments
    const riskMultiplier = {
        'Low': 0.8,
        'Medium': 1.0,
        'High': 1.2
    };

    let adjustedSample = baseSample * (riskMultiplier[riskLevel] || 1.0);

    // Additional adjustments
    if (hasNCRs) adjustedSample *= 1.2;  // +20% if sites have NCRs
    if (hasComplexProcesses) adjustedSample *= 1.1;  // +10% for complex processes

    // Round up
    adjustedSample = Math.ceil(adjustedSample);

    // Minimum: 25% of total sites
    const minimum25Percent = Math.ceil(totalSites * 0.25);
    adjustedSample = Math.max(adjustedSample, minimum25Percent);

    // Maximum: cannot exceed total sites
    adjustedSample = Math.min(adjustedSample, totalSites);

    return {
        baseSample: baseSample,
        adjustedSample: adjustedSample,
        percentage: Math.round((adjustedSample / totalSites) * 100)
    };
}

function renderMultiSiteSamplingCalculator() {
    const html = `
        <div class="fade-in">
            <!-- Back Button -->
            <div style="margin-bottom: 1rem;">
                <button class="btn btn-secondary" onclick="window.location.hash = 'dashboard'">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to Dashboard
                </button>
            </div>
            
            <div class="card" style="max-width: 900px; margin: 0 auto;">
                <h2 style="margin-bottom: 1rem; color: var(--primary-color);">
                    <i class="fa-solid fa-sitemap" style="margin-right: 0.5rem;"></i>
                    Multi-Site Sampling Calculator (IAF MD 1)
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Calculate site sampling requirements based on IAF MD 1:2018 guidelines
                </p>

                <form id="multisite-form" style="margin-bottom: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Total Sites -->
                        <div class="form-group">
                            <label for="total-sites">Total Number of Sites <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="total-sites" min="2" value="10" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">All sites under the certification scope</small>
                        </div>

                        <!-- Risk Level -->
                        <div class="form-group">
                            <label for="site-risk">Overall Risk Level <span style="color: var(--danger-color);">*</span></label>
                            <select id="site-risk" required>
                                <option value="Low">Low (Uniform simple activities)</option>
                                <option value="Medium" selected>Medium (Some variation in activities)</option>
                                <option value="High">High (Complex, varied activities)</option>
                            </select>
                        </div>

                        <!-- NCRs at Sites -->
                        <div class="form-group">
                            <label for="sites-with-ncrs">Sites with Previous NCRs</label>
                            <select id="sites-with-ncrs">
                                <option value="false" selected>No sites with open NCRs</option>
                                <option value="true">Some sites have NCRs from previous audits</option>
                            </select>
                        </div>

                        <!-- Complex Processes -->
                        <div class="form-group">
                            <label for="complex-processes">Special/Complex Processes</label>
                            <select id="complex-processes">
                                <option value="false" selected>No special processes</option>
                                <option value="true">Some sites have special processes</option>
                            </select>
                        </div>

                        <!-- Mandatory Sites -->
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Mandatory Sites (always included)</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
                                    <input type="checkbox" id="include-hq" checked>
                                    <span>HQ / Central Function</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
                                    <input type="checkbox" id="include-special">
                                    <span>Sites with Special Processes</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
                                    <input type="checkbox" id="include-ncr">
                                    <span>Sites with Open NCRs</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
                                    <input type="checkbox" id="include-new">
                                    <span>New Sites (not previously audited)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                        Calculate Sample Size
                    </button>
                </form>

                <!-- Results Section -->
                <div id="multisite-results" style="display: none;">
                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 2rem 0;">
                    
                    <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                        <i class="fa-solid fa-chart-pie" style="margin-right: 0.5rem;"></i>
                        Sampling Results
                    </h3>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Sites</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-total-sites">--</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Sites to Audit</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-sample-size">--</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Coverage</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-percentage">--%</p>
                        </div>
                    </div>

                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">
                            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                            Calculation Details
                        </h4>
                        <div id="multisite-details" style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.8;">
                            <!-- Dynamic calculation breakdown -->
                        </div>
                    </div>

                    <!-- IAF MD 1 Requirements Reminder -->
                    <div style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #1d4ed8; font-size: 0.9rem;">
                            <i class="fa-solid fa-book" style="margin-right: 0.5rem;"></i>IAF MD 1 Key Requirements
                        </h4>
                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #1e40af; line-height: 1.6;">
                            <li>Central function (HQ) must always be audited</li>
                            <li>All sites with non-conformities must be included</li>
                            <li>Sites with special processes must be included</li>
                            <li>New sites must be audited before certificate extension</li>
                            <li>Sample should be rotated over certification cycle</li>
                            <li>Remote sites may require different sampling approach</li>
                        </ul>
                    </div>

                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <button class="btn btn-primary" onclick="saveSamplingToPlan()">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                            Save to Audit Plan
                        </button>
                        <button class="btn btn-secondary" onclick="window.print()">
                            <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>
                            Print Results
                        </button>
                    </div>
                </div>

                <!-- Reference Table -->
                <div style="margin-top: 3rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i>
                        IAF MD 1 Quick Reference
                    </h4>
                    <div style="overflow-x: auto;">
                        <table style="font-size: 0.875rem;">
                            <thead>
                                <tr>
                                    <th>Number of Sites</th>
                                    <th>Base Sample (√n)</th>
                                    <th>Minimum (25%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>2 - 4</td><td>2</td><td>1</td></tr>
                                <tr><td>5 - 9</td><td>3</td><td>2</td></tr>
                                <tr><td>10 - 16</td><td>4</td><td>3 - 4</td></tr>
                                <tr><td>17 - 25</td><td>5</td><td>5 - 7</td></tr>
                                <tr><td>26 - 36</td><td>6</td><td>7 - 9</td></tr>
                                <tr><td>37 - 49</td><td>7</td><td>10 - 13</td></tr>
                                <tr><td>50 - 64</td><td>8</td><td>13 - 16</td></tr>
                                <tr><td>65 - 81</td><td>9</td><td>17 - 21</td></tr>
                                <tr><td>82 - 100</td><td>10</td><td>21 - 25</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Form submission handler
    document.getElementById('multisite-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const totalSites = parseInt(document.getElementById('total-sites').value);
        const riskLevel = document.getElementById('site-risk').value;
        const hasNCRs = document.getElementById('sites-with-ncrs').value === 'true';
        const hasComplexProcesses = document.getElementById('complex-processes').value === 'true';

        // Count mandatory sites
        let mandatorySites = 0;
        if (document.getElementById('include-hq').checked) mandatorySites++;
        if (document.getElementById('include-special').checked) mandatorySites++;
        if (document.getElementById('include-ncr').checked) mandatorySites++;
        if (document.getElementById('include-new').checked) mandatorySites++;

        // Calculate
        const results = calculateMultiSiteSample(totalSites, riskLevel, hasNCRs, hasComplexProcesses);

        // Ensure mandatory sites are included
        const finalSample = Math.max(results.adjustedSample, mandatorySites);

        // Display results
        document.getElementById('result-total-sites').textContent = totalSites;
        document.getElementById('result-sample-size').textContent = finalSample;
        document.getElementById('result-percentage').textContent = Math.round((finalSample / totalSites) * 100) + '%';

        // Show breakdown
        const details = `
            <div style="display: grid; gap: 0.5rem;">
                <div><strong>IAF MD 1 Formula:</strong></div>
                <div>• Base sample (√n): √${totalSites} = ${results.baseSample} sites</div>
                <div>• Risk adjustment (${riskLevel}): ×${riskLevel === 'Low' ? '0.8' : riskLevel === 'High' ? '1.2' : '1.0'}</div>
                ${hasNCRs ? '<div>• Sites with NCRs: +20%</div>' : ''}
                ${hasComplexProcesses ? '<div>• Complex processes: +10%</div>' : ''}
                <div>• Minimum 25% rule: ${Math.ceil(totalSites * 0.25)} sites</div>
                ${mandatorySites > 0 ? `<div>• Mandatory sites: ${mandatorySites} (always included)</div>` : ''}
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);"><strong>Final Sample:</strong> ${finalSample} sites (${Math.round((finalSample / totalSites) * 100)}% coverage)</div>
            </div>
        `;
        document.getElementById('multisite-details').innerHTML = details;

        // Show results section
        document.getElementById('multisite-results').style.display = 'block';

        // Scroll to results
        document.getElementById('multisite-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

function saveSamplingToPlan() {
    showNotification('Multi-site sampling saved to draft audit plan', 'success');
}

window.renderMultiSiteSamplingCalculator = renderMultiSiteSamplingCalculator;

window.openMultiSiteSamplingCalculatorModal = function () {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    // Hide standard save button as the calculator has its own interactions
    if (modalSave) modalSave.style.display = 'none';

    modalTitle.innerHTML = '<i class="fa-solid fa-calculator" style="margin-right:0.5rem"></i>Multi-Site Sampling (IAF MD 1)';

    // Helper to count sites from the planning form if available
    let totalSitesDefault = 10;
    const sitesContainer = document.getElementById('site-checkboxes');
    if (sitesContainer) {
        // Count checkboxes if rendered
        const count = sitesContainer.querySelectorAll('input[type="checkbox"]').length;
        if (count > 0) totalSitesDefault = count;
    }

    modalBody.innerHTML = `
        <div style="padding: 0 0.5rem;">
            <p style="color: var(--text-secondary); margin-bottom: 1.25rem; font-size: 0.9rem;">
                Calculate minimum site sampling requirements for multi-site certification (IAF MD 1:2018).
            </p>

            <form id="modal-multisite-form" style="margin-bottom: 1.25rem; background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">Total Sites <span style="color: var(--danger-color);">*</span></label>
                        <input type="number" id="modal-total-sites" class="form-control" min="2" value="${totalSitesDefault}" required>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">Risk Level <span style="color: var(--danger-color);">*</span></label>
                        <select id="modal-site-risk" class="form-control">
                            <option value="Low">Low (0.8x)</option>
                            <option value="Medium" selected>Medium (1.0x)</option>
                            <option value="High">High (1.2x)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">Any NCRs?</label>
                        <select id="modal-sites-with-ncrs" class="form-control">
                            <option value="false" selected>No</option>
                            <option value="true">Yes (+20%)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">Complex Processes?</label>
                        <select id="modal-complex-processes" class="form-control">
                            <option value="false" selected>No</option>
                            <option value="true">Yes (+10%)</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-top: 1rem;">
                     <label style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem; display: block;">Mandatory Inclusions</label>
                     <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; cursor: pointer;">
                            <input type="checkbox" id="modal-include-hq" checked> HQ/Central
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; cursor: pointer;">
                            <input type="checkbox" id="modal-include-special"> Special Proc.
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; cursor: pointer;">
                            <input type="checkbox" id="modal-include-new"> New Sites
                        </label>
                     </div>
                </div>

                <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 1rem; width: 100%; height: 36px;">
                    Calculate Sample Size
                </button>
            </form>

            <div id="modal-calc-results" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1.25rem; text-align: center;">
                <div style="font-size: 0.85rem; color: #1e40af; margin-bottom: 0.25rem;">IAF MD 1 Result:</div>
                <div style="margin: 0.5rem 0; color: #1e40af; font-size: 1.25rem; font-weight: 800;">
                    Audit <span id="modal-result-count" style="font-size: 1.75rem;">0</span> Sites
                </div>
                <p id="modal-result-text" style="color: #1e3a8a; font-size: 0.85rem; margin-bottom: 1rem;"></p>
                
                <hr style="border-top: 1px solid #bfdbfe; opacity: 0.5; margin: 1rem 0;">
                
                <div style="text-align: left; font-size: 0.75rem; color: #3b82f6; margin-bottom: 1.25rem;">
                    <strong>Breakdown:</strong> <span id="modal-calc-details"></span>
                </div>

                <div style="display:flex; gap: 0.75rem; justify-content: center;">
                    <button class="btn btn-sm btn-primary" onclick="window.applySamplingToPlan()" style="padding: 6px 16px;">
                        <i class="fa-solid fa-check" style="margin-right: 0.25rem;"></i> Apply to Plan
                    </button>
                    ${sitesContainer ? `
                    <button class="btn btn-sm btn-outline-primary" onclick="window.randomlySelectSites()" style="padding: 6px 16px;">
                        <i class="fa-solid fa-shuffle" style="margin-right: 0.25rem;"></i> Random Select
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    window.openModal();

    // Event Listener for Calculation
    setTimeout(() => {
        const form = document.getElementById('modal-multisite-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const totalSites = parseInt(document.getElementById('modal-total-sites').value);
                const riskLevel = document.getElementById('modal-site-risk').value;
                const hasNCRs = document.getElementById('modal-sites-with-ncrs').value === 'true';
                const hasComplex = document.getElementById('modal-complex-processes').value === 'true';

                // Mandatory count
                let mandatory = 0;
                if (document.getElementById('modal-include-hq').checked) mandatory++;
                if (document.getElementById('modal-include-special').checked) mandatory++;
                if (document.getElementById('modal-include-new').checked) mandatory++;

                // Use the existing calculation function
                const results = calculateMultiSiteSample(totalSites, riskLevel, hasNCRs, hasComplex);

                // Final Check
                const finalCount = Math.max(results.adjustedSample, mandatory);

                // Update UI
                document.getElementById('modal-result-count').textContent = finalCount;
                document.getElementById('modal-result-text').textContent = `Targeting ${Math.round((finalCount / totalSites) * 100)}% coverage of ${totalSites} total sites.`;

                document.getElementById('modal-calc-details').textContent =
                    `√${totalSites}=${results.baseSample} (Base) × Risk/Factors → Adjusted to ${results.adjustedSample} (Ensure ≥${mandatory} mandatory)`;

                document.getElementById('modal-calc-results').style.display = 'block';

                // Store result globally for application
                window.lastCalculatedSample = finalCount;
            });
        }
    }, 100);
}

window.applySamplingToPlan = function () {
    if (!window.lastCalculatedSample) return;

    // Logic to update the plan form
    // 1. Update the "Sites" input if it exists directly (readonly usually)
    // 2. Or just show a notification that the user needs to select that many sites.

    // If we have access to the checkbox container:
    const checkboxes = document.querySelectorAll('.site-checkbox');
    const checked = document.querySelectorAll('.site-checkbox:checked');

    if (checkboxes.length > 0) {
        if (checked.length !== window.lastCalculatedSample) {
            window.showNotification(`Please manually select ${window.lastCalculatedSample} sites from the list (currently corresponding to calculation).`, 'info');
        } else {
            window.showNotification(`Target sample size confirms current selection (${window.lastCalculatedSample} sites).`, 'success');
        }
    } else {
        window.showNotification(`Calculation complete: You should audit ${window.lastCalculatedSample} sites.`, 'info');
    }

    window.closeModal();
};

window.randomlySelectSites = function () {
    if (!window.lastCalculatedSample) return;

    const checkboxes = Array.from(document.querySelectorAll('.site-checkbox'));
    if (checkboxes.length === 0) return;

    // Clear current
    checkboxes.forEach(cb => cb.checked = false);

    // Always select HQ if it exists (heuristic: Name contains HQ or Head)
    let selectedCount = 0;
    const hqIndex = checkboxes.findIndex(cb => cb.dataset.name.toLowerCase().includes('hq') || cb.dataset.name.toLowerCase().includes('head'));

    const indicesToSelect = new Set();

    if (hqIndex !== -1) {
        indicesToSelect.add(hqIndex);
        selectedCount++;
    }

    // Randomly select remaining
    while (indicesToSelect.size < Math.min(window.lastCalculatedSample, checkboxes.length)) {
        const r = Math.floor(Math.random() * checkboxes.length);
        indicesToSelect.add(r);
    }

    // Apply
    indicesToSelect.forEach(i => checkboxes[i].checked = true);

    // Update dependencies
    if (typeof window.autoCalculateDays === 'function') window.autoCalculateDays();
    if (document.getElementById('plan-sites')) document.getElementById('plan-sites').value = indicesToSelect.size;

    window.showNotification(`Randomly selected ${indicesToSelect.size} sites per sampling requirement.`, 'success');
    window.closeModal();
};

function openEditAuditorModal(auditorId) {
    const auditor = state.auditors.find(a => String(a.id) === String(auditorId));
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    const industries = ['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'];
    const auditorIndustries = auditor.industries || [];

    modalTitle.textContent = 'Edit Auditor';
    modalBody.innerHTML = `
        < form id = "auditor-form" style = "max-height: 70vh; overflow-y: auto;" >
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <!-- Basic Info -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Basic Information</div>

                <div class="form-group">
                    <label>Full Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="auditor-name" value="${window.UTILS.escapeHtml(auditor.name)}" required>
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select class="form-control" id="auditor-role">
                        <option ${auditor.role === 'Lead Auditor' ? 'selected' : ''}>Lead Auditor</option>
                        <option ${auditor.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                        <option ${auditor.role === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" class="form-control" id="auditor-email" value="${window.UTILS.escapeHtml(auditor.email || '')}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" class="form-control" id="auditor-phone" value="${window.UTILS.escapeHtml(auditor.phone || '')}">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" class="form-control" id="auditor-location" value="${window.UTILS.escapeHtml(auditor.location || '')}">
                </div>
                <div class="form-group">
                    <label>Profile Picture URL</label>
                    <input type="url" class="form-control" id="auditor-picture" value="${window.UTILS.escapeHtml(auditor.pictureUrl || '')}" placeholder="https://...">
                </div>

                <!-- Qualifications -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; margin-top: 0.5rem; color: var(--primary-color); font-weight: 600;">Qualifications & Experience</div>

                <div class="form-group">
                    <label>Qualified Standards <span style="color: var(--danger-color);">*</span></label>
                    <select class="form-control" id="auditor-standards" multiple style="height: 80px;">
                        <option ${(auditor.standards || []).includes('ISO 9001') ? 'selected' : ''}>ISO 9001</option>
                        <option ${(auditor.standards || []).includes('ISO 14001') ? 'selected' : ''}>ISO 14001</option>
                        <option ${(auditor.standards || []).includes('ISO 27001') ? 'selected' : ''}>ISO 27001</option>
                        <option ${(auditor.standards || []).includes('ISO 45001') ? 'selected' : ''}>ISO 45001</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Industries</label>
                    <select class="form-control" id="auditor-industries" multiple style="height: 80px;">
                        ${industries.map(ind => `<option ${auditorIndustries.includes(ind) ? 'selected' : ''}>${ind}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Experience (Years)</label>
                    <input type="number" class="form-control" id="auditor-experience" value="${auditor.experience || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Man-Day Rate ($)</label>
                    <input type="number" class="form-control" id="auditor-rate" value="${auditor.manDayRate || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Customer Rating (1-5)</label>
                    <input type="number" class="form-control" id="auditor-rating" value="${auditor.customerRating || 0}" min="1" max="5">
                </div>
                <div class="form-group">
                    <label>Date Joined</label>
                    <input type="date" class="form-control" id="auditor-date-joined" value="${auditor.dateJoined || ''}">
                </div>

                <!-- Travel -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; margin-top: 0.5rem; color: var(--primary-color); font-weight: 600;">Travel & Availability</div>

                <div class="form-group">
                    <label>Has Valid Passport</label>
                    <select class="form-control" id="auditor-passport">
                        <option value="true" ${auditor.hasPassport ? 'selected' : ''}>Yes</option>
                        <option value="false" ${!auditor.hasPassport ? 'selected' : ''}>No</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Willingness to Travel</label>
                    <select class="form-control" id="auditor-travel">
                        <option value="local" ${auditor.willingToTravel === 'local' ? 'selected' : ''}>Local Only</option>
                        <option value="regional" ${auditor.willingToTravel === 'regional' ? 'selected' : ''}>Regional</option>
                        <option value="international" ${auditor.willingToTravel === 'international' ? 'selected' : ''}>International</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Languages (comma-separated)</label>
                    <input type="text" class="form-control" id="auditor-languages" value="${(auditor.languages || []).map(l => window.UTILS.escapeHtml(l)).join(', ')}" placeholder="English, Spanish, French">
                </div>
            </div>
        </form >
        `;

    window.openModal();

    modalSave.onclick = () => {
        // 1. Define Fields
        const fieldIds = {
            name: 'auditor-name',
            email: 'auditor-email',
            phone: 'auditor-phone',
            experience: 'auditor-experience',
            manDayRate: 'auditor-rate',
            customerRating: 'auditor-rating',
            location: 'auditor-location',
            pictureUrl: 'auditor-picture',
            industries: 'auditor-industries', // Note: this is a select multiple in edit implementation
            languages: 'auditor-languages'
        };

        // 2. Define Validation Rules
        const rules = {
            name: [
                { rule: 'required', fieldName: 'Full Name' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Full Name' },
                { rule: 'noHtmlTags', fieldName: 'Full Name' }
            ],
            email: [
                { rule: 'email', fieldName: 'Email' }
            ],
            experience: [
                { rule: 'range', min: 0, max: 60, fieldName: 'Experience' }
            ],
            manDayRate: [
                { rule: 'number', fieldName: 'Man-Day Rate' }
            ],
            pictureUrl: [
                { rule: 'url', fieldName: 'Profile Picture URL' }
            ]
        };

        // 3. Validate
        // Special check for standards (required)
        const standardsSelect = document.getElementById('auditor-standards');
        if (standardsSelect.selectedOptions.length === 0) {
            window.showNotification('Please select at least one Qualified Standard', 'error');
            return;
        }

        const result = Validator.validateFormElements(fieldIds, rules);
        if (!result.valid) {
            Validator.displayErrors(result.errors, fieldIds);
            window.showNotification('Please fix the form errors', 'error');
            return;
        }
        Validator.clearErrors(fieldIds);

        // 4. Sanitize Data
        // Note: For select multiple (industries), we get values from DOM separately, so no need to sanitize as text input
        const cleanData = Sanitizer.sanitizeFormData(result.formData,
            ['name', 'email', 'phone', 'location', 'languages'] // Treat as text
        );

        // 5. Update Object
        auditor.name = cleanData.name;
        auditor.role = document.getElementById('auditor-role').value;
        auditor.standards = Array.from(standardsSelect.selectedOptions).map(option => option.value);

        const industriesSelect = document.getElementById('auditor-industries');
        auditor.industries = Array.from(industriesSelect.selectedOptions).map(option => option.value);

        auditor.email = cleanData.email;
        auditor.phone = cleanData.phone;
        auditor.location = cleanData.location;
        auditor.pictureUrl = Sanitizer.sanitizeURL(result.formData.pictureUrl); // Use sanitized URL

        auditor.experience = parseInt(document.getElementById('auditor-experience').value) || 0;
        auditor.manDayRate = parseInt(document.getElementById('auditor-rate').value) || 0;
        auditor.customerRating = parseInt(document.getElementById('auditor-rating').value) || 0;
        auditor.dateJoined = document.getElementById('auditor-date-joined').value;

        auditor.hasPassport = document.getElementById('auditor-passport').value === 'true';
        auditor.willingToTravel = document.getElementById('auditor-travel').value;
        auditor.languages = cleanData.languages.split(',').map(l => l.trim()).filter(l => l);

        // 6. Save
        window.saveData();
        window.closeModal();
        renderAuditorDetail(auditorId);
        window.showNotification('Auditor updated successfully', 'success');
    };
}
// Add Training Modal
function openAddTrainingModal(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add Training Record';
    modalBody.innerHTML = `
        < form id = "training-form" >
            <div class="form-group">
                <label>Course Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="training-course" placeholder="e.g. ISO 9001 Lead Auditor" required>
            </div>
            <div class="form-group">
                <label>Training Provider</label>
                <input type="text" class="form-control" id="training-provider" placeholder="e.g. IRCA, Exemplar Global">
            </div>
            <div class="form-group">
                <label>Completion Date</label>
                <input type="date" class="form-control" id="training-date">
            </div>
            <div class="form-group">
                <label>Certificate Number</label>
                <input type="text" class="form-control" id="training-certificate" placeholder="e.g. IRCA-12345">
            </div>
        </form >
        `;

    window.openModal();

    modalSave.onclick = () => {
        const course = document.getElementById('training-course').value;
        const provider = document.getElementById('training-provider').value;
        const date = document.getElementById('training-date').value;
        const certificate = document.getElementById('training-certificate').value;

        if (course) {
            if (!auditor.trainings) auditor.trainings = [];
            auditor.trainings.push({ course, provider, date, certificate });
            window.saveData();
            window.closeModal();
            renderAuditorDetail(auditorId);
            window.showNotification('Training record added successfully');
        } else {
            window.showNotification('Course name is required', 'error');
        }
    };
}

// Upload Document Modal
function openUploadDocumentModal(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Upload Document';
    modalBody.innerHTML = `
        < form id = "document-form" >
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="doc-name" placeholder="e.g. Lead Auditor Certificate" required>
            </div>
            <div class="form-group">
                <label>Document Type</label>
                <select class="form-control" id="doc-type">
                    <option value="pdf">PDF Document</option>
                    <option value="image">Image</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Document File <span style="font-weight: normal; color: var(--text-secondary);">(max 5MB)</span></label>
                <input type="file" class="form-control" id="doc-file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                <small style="color: var(--text-secondary);">Accepted: PDF, Images, Word documents</small>
            </div>
        </form >
        `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('doc-name').value;
        const type = document.getElementById('doc-type').value;
        const fileInput = document.getElementById('doc-file');
        const file = fileInput.files[0];

        if (name) {
            if (!auditor.documents) auditor.documents = [];
            // Store document metadata (file would need proper backend storage in production)
            auditor.documents.push({
                name: name,
                type: type,
                date: new Date().toISOString().split('T')[0],
                fileName: file ? file.name : null
            });
            window.saveData();
            window.closeModal();
            renderAuditorDetail(auditorId);
            window.showNotification('Document added successfully');
        } else {
            window.showNotification('Document name is required', 'error');
        }
    };
}

// Export functions to global scope
window.renderAuditorsEnhanced = renderAuditorsEnhanced;
window.renderAuditorDetail = renderAuditorDetail;
window.renderCompetenceMatrix = renderCompetenceMatrix;
window.calculateManDays = calculateManDays;
window.renderManDayCalculator = renderManDayCalculator;

window.openEditAuditorModal = openEditAuditorModal;
window.openAddTrainingModal = openAddTrainingModal;
window.openUploadDocumentModal = openUploadDocumentModal;

// Clear upcoming audit filters and show all items
window.clearAuditorUpcomingFilters = function (auditorId) {
    const dateFilter = document.getElementById('upcoming-date-filter');
    const locationFilter = document.getElementById('upcoming-location-filter');
    if (dateFilter) dateFilter.value = '';
    if (locationFilter) locationFilter.value = '';
    document.querySelectorAll('.upcoming-audit-item').forEach(item => {
        item.style.display = 'flex';
    });
};

// ============================================
// DOCUMENT UPLOAD HELPERS (Auditors)
// ============================================

window.openAuditorUploadModal = function (auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Upload Auditor Document';
    modalBody.innerHTML = `
        < form id = "upload-form" >
            <div class="form-group">
                <label>Document Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="doc-name" required placeholder="e.g. ISO 9001 Certificate">
            </div>
            <div class="form-group">
                <label>Type</label>
                <select class="form-control" id="doc-type">
                    <option value="pdf">PDF Document</option>
                    <option value="image">Image / Scan</option>
                    <option value="doc">Word / Text</option>
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
        const type = document.getElementById('doc-type').value;
        const fileInput = document.getElementById('doc-file');

        if (name) {
            // Final validation before save
            if (fileInput.files[0] && fileInput.files[0].size > 5242880) {
                alert('File is too large! Max limit is 5MB.');
                return;
            }

            if (!auditor.documents) auditor.documents = [];

            const newDoc = {
                id: Date.now().toString(),
                name: name,
                type: type,
                date: new Date().toISOString().split('T')[0],
                size: fileInput.files[0] ? (fileInput.files[0].size / 1024 / 1024).toFixed(2) + ' MB' : 'Simulated'
            };

            auditor.documents.push(newDoc);

            // Note: Since 'state' is global, we just need to re-render.
            // If there's a specific saveData function (mock), call it.
            if (window.saveData) window.saveData();

            window.closeModal();
            renderAuditorDetail(auditorId); // Refresh view
            // Force switch back to documents tab
            setTimeout(() => {
                const btn = document.querySelector('.tab-btn[data-tab="documents"]');
                if (btn) btn.click();
            }, 100);

            if (window.showNotification) window.showNotification('Document uploaded successfully');
        } else {
            alert('Please enter a document name');
        }
    };
};

window.deleteAuditorDocument = function (auditorId, docId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor || !auditor.documents) return;

    if (confirm('Are you sure you want to delete this document?')) {
        auditor.documents = auditor.documents.filter(d => d.id !== docId);
        if (window.saveData) window.saveData();
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            const btn = document.querySelector('.tab-btn[data-tab="documents"]');
            if (btn) btn.click();
        }, 100);
        if (window.showNotification) window.showNotification('Document deleted');
    }
}

// ============================================
// ISO 17021-1 AUDITOR EVALUATION FUNCTIONS
// ============================================

// Add Witness Audit Record
window.addWitnessAudit = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Record Witness Audit';
    document.getElementById('modal-body').innerHTML = `
        < form id = "witness-form" >
            <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem;">
                Record a witness assessment of this auditor during an actual audit.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Date of Witness Audit</label>
                    <input type="date" id="witness-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Client/Organization</label>
                    <input type="text" id="witness-client" class="form-control" placeholder="Client name" required>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Standard</label>
                    <select id="witness-standard" class="form-control">
                        <option value="ISO 9001:2015">ISO 9001:2015</option>
                        <option value="ISO 14001:2015">ISO 14001:2015</option>
                        <option value="ISO 45001:2018">ISO 45001:2018</option>
                        <option value="ISO 27001:2022">ISO 27001:2022</option>
                        <option value="ISO 22000:2018">ISO 22000:2018</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Witnessed By</label>
                    <input type="text" id="witness-by" class="form-control" value="${window.state.currentUser?.name || ''}" placeholder="Observer name" required>
                </div>
            </div>
            <div class="form-group">
                <label>Overall Rating</label>
                <select id="witness-rating" class="form-control">
                    <option value="5">5 - Excellent</option>
                    <option value="4" selected>4 - Good</option>
                    <option value="3">3 - Satisfactory</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Unsatisfactory</option>
                </select>
            </div>
            <div class="form-group">
                <label>Observations/Notes</label>
                <textarea id="witness-notes" class="form-control" rows="3" placeholder="Key observations, strengths, areas for improvement..."></textarea>
            </div>
        </form >
        `;

    document.getElementById('modal-save').onclick = function () {
        const client = document.getElementById('witness-client').value;
        if (!client) {
            window.showNotification('Please enter the client name', 'error');
            return;
        }

        if (!auditor.evaluations) auditor.evaluations = { witnessAudits: [], performanceReviews: [] };
        if (!auditor.evaluations.witnessAudits) auditor.evaluations.witnessAudits = [];

        auditor.evaluations.witnessAudits.unshift({
            date: document.getElementById('witness-date').value,
            client: client,
            standard: document.getElementById('witness-standard').value,
            witnessedBy: document.getElementById('witness-by').value,
            rating: parseInt(document.getElementById('witness-rating').value),
            notes: document.getElementById('witness-notes').value
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Witness audit recorded', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="evaluations"]')?.click();
        }, 100);
    };

    window.openModal();
};

// Add Performance Review
window.addPerformanceReview = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Add Performance Review';
    document.getElementById('modal-body').innerHTML = `
        < form id = "review-form" >
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Review Date</label>
                    <input type="date" id="review-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Review Type</label>
                    <select id="review-type" class="form-control">
                        <option value="Annual Review">Annual Review</option>
                        <option value="Qualification Review">Qualification Review</option>
                        <option value="Client Feedback Review">Client Feedback Review</option>
                        <option value="Report Quality Review">Report Quality Review</option>
                        <option value="Extension of Scope">Extension of Scope</option>
                    </select>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Overall Rating</label>
                    <select id="review-rating" class="form-control">
                        <option value="5">5 - Excellent</option>
                        <option value="4" selected>4 - Good</option>
                        <option value="3">3 - Satisfactory</option>
                        <option value="2">2 - Needs Improvement</option>
                        <option value="1">1 - Unsatisfactory</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Reviewed By</label>
                    <input type="text" id="review-by" class="form-control" value="${window.state.currentUser?.name || 'Competence Manager'}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Outcome</label>
                <select id="review-outcome" class="form-control">
                    <option value="Approved">Approved - No action required</option>
                    <option value="Approved with conditions">Approved with conditions</option>
                    <option value="Training Required">Training Required</option>
                    <option value="Suspended">Suspended - Pending remediation</option>
                </select>
            </div>
            <div class="form-group">
                <label>Comments</label>
                <textarea id="review-comments" class="form-control" rows="3" placeholder="Review findings and recommendations..."></textarea>
            </div>
        </form >
        `;

    document.getElementById('modal-save').onclick = function () {
        if (!auditor.evaluations) auditor.evaluations = { witnessAudits: [], performanceReviews: [] };
        if (!auditor.evaluations.performanceReviews) auditor.evaluations.performanceReviews = [];

        auditor.evaluations.performanceReviews.unshift({
            date: document.getElementById('review-date').value,
            type: document.getElementById('review-type').value,
            rating: parseInt(document.getElementById('review-rating').value),
            reviewedBy: document.getElementById('review-by').value,
            outcome: document.getElementById('review-outcome').value,
            comments: document.getElementById('review-comments').value
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Performance review added', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="evaluations"]')?.click();
        }, 100);
    };

    window.openModal();
};

// Add Training Record
window.openAddTrainingModal = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Add Training Record';
    document.getElementById('modal-body').innerHTML = `
        < form id = "training-form" >
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Course/Training Name <span style="color: red;">*</span></label>
                    <input type="text" id="training-course" class="form-control" placeholder="e.g. ISO 9001:2015 Lead Auditor Course" required>
                </div>
                <div class="form-group">
                    <label>Training Provider</label>
                    <input type="text" id="training-provider" class="form-control" placeholder="e.g. BSI, IRCA, DNV">
                </div>
                <div class="form-group">
                    <label>Completion Date</label>
                    <input type="date" id="training-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Duration (Hours)</label>
                    <input type="number" id="training-duration" class="form-control" placeholder="40" min="1">
                </div>
                <div class="form-group">
                    <label>CPD Hours</label>
                    <input type="number" id="training-cpd" class="form-control" placeholder="40" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>Training Type</label>
                <select id="training-type" class="form-control">
                    <option value="Lead Auditor Course">Lead Auditor Course</option>
                    <option value="Internal Auditor Course">Internal Auditor Course</option>
                    <option value="Transition Training">Transition Training</option>
                    <option value="Technical Training">Technical Training</option>
                    <option value="Industry-Specific Training">Industry-Specific Training</option>
                    <option value="Refresher Training">Refresher Training</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="training-certificate" style="width: auto;">
                    Certificate Obtained
                </label>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="training-notes" class="form-control" rows="2" placeholder="Additional notes..."></textarea>
            </div>
        </form >
        `;

    document.getElementById('modal-save').onclick = function () {
        const course = document.getElementById('training-course').value;
        if (!course) {
            window.showNotification('Please enter the course name', 'error');
            return;
        }

        if (!auditor.trainings) auditor.trainings = [];

        auditor.trainings.unshift({
            course: course,
            provider: document.getElementById('training-provider').value || 'Unknown',
            date: document.getElementById('training-date').value,
            duration: document.getElementById('training-duration').value + ' hours',
            cpdHours: parseInt(document.getElementById('training-cpd').value) || 0,
            type: document.getElementById('training-type').value,
            certificate: document.getElementById('training-certificate').checked,
            notes: document.getElementById('training-notes').value
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Training record added', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="training"]')?.click();
        }, 100);
    };

    window.openModal();
};

// Add Qualification
window.openAddQualificationModal = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Add Qualification / Academic Degree';
    document.getElementById('modal-body').innerHTML = `
        < form id = "qual-form" >
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Qualification Type <span style="color: red;">*</span></label>
                    <select id="qual-type" class="form-control">
                        <option value="iso">ISO/Industry Standard</option>
                        <option value="academic">Academic Degree</option>
                        <option value="professional">Professional Certification</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Standard / Degree <span style="color: red;">*</span></label>
                    <input list="qual-standards" id="qual-standard" class="form-control" placeholder="Type or select..." required>
                        <datalist id="qual-standards">
                            <option value="ISO 9001:2015">
                                <option value="ISO 14001:2015">
                                    <option value="ISO 45001:2018">
                                        <option value="ISO 27001:2022">
                                            <option value="ISO 22000:2018">
                                                <option value="ISO 50001:2018">
                                                    <option value="ISO 13485:2016">
                                                        <option value="IATF 16949:2016">
                                                            <option value="Bachelor of Engineering">
                                                                <option value="Bachelor of Science">
                                                                    <option value="Master of Engineering">
                                                                        <option value="Master of Business Administration (MBA)">
                                                                            <option value="PhD">
                                                                                <option value="CQE (Certified Quality Engineer)">
                                                                                    <option value="PMP (Project Management Professional)">
                                                                                    </datalist>
                                                                                </div>
                                                                                <div class="form-group">
                                                                                    <label>Qualification Level</label>
                                                                                    <select id="qual-level" class="form-control">
                                                                                        <option value="Lead Auditor">Lead Auditor</option>
                                                                                        <option value="Auditor">Auditor</option>
                                                                                        <option value="Provisional Auditor">Provisional Auditor</option>
                                                                                        <option value="Technical Expert">Technical Expert</option>
                                                                                        <option value="Bachelor">Bachelor's Degree</option>
                                                                                        <option value="Master">Master's Degree</option>
                                                                                        <option value="Doctorate">Doctorate</option>
                                                                                        <option value="Certified">Certified Professional</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div class="form-group">
                                                                                    <label>Certificate Number</label>
                                                                                    <input type="text" id="qual-cert-number" class="form-control" placeholder="e.g. IRCA/12345/2024">
                                                                                </div>
                                                                                <div class="form-group">
                                                                                    <label>Issuing Body / University</label>
                                                                                    <input list="issuing-bodies" id="qual-issuing-body" class="form-control" placeholder="Type or select...">
                                                                                        <datalist id="issuing-bodies">
                                                                                            <option value="IRCA">
                                                                                                <option value="Exemplar Global">
                                                                                                    <option value="PECB">
                                                                                                        <option value="CQI">
                                                                                                            <option value="Internal (CB Approved)">
                                                                                                                <option value="PMI">
                                                                                                                    <option value="ASQ">
                                                                                                                    </datalist>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Field of Study</label>
                                                                                                                    <input type="text" id="qual-field" class="form-control" placeholder="e.g. Mechanical Engineering, Quality Management">
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Issue Date</label>
                                                                                                                    <input type="date" id="qual-issue-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Expiry Date <small>(leave blank if no expiry)</small></label>
                                                                                                                    <input type="date" id="qual-expiry-date" class="form-control" value="${new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                                                                                                                </div>
                                                                                                            </div>
                                                                                                            <div style="padding: 0.75rem; background: #eff6ff; border-radius: 6px; margin-top: 1rem;">
                                                                                                                <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                                                                                                                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                                                                                                                    ISO qualifications require witness audit verification per ISO 17021-1 Clause 7.2.12
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        </form>
                                                                                                        `;

    document.getElementById('modal-save').onclick = function () {
        const standard = document.getElementById('qual-standard').value;

        if (!auditor.qualifications) auditor.qualifications = [];

        // Check if standard already exists
        const exists = auditor.qualifications.some(q => q.standard === standard);
        if (exists) {
            if (!confirm('This auditor already has a qualification for ' + standard + '. Add anyway?')) {
                return;
            }
        }

        auditor.qualifications.push({
            type: document.getElementById('qual-type').value,
            standard: standard,
            level: document.getElementById('qual-level').value,
            certNumber: document.getElementById('qual-cert-number').value || `CERT-${Date.now()}`,
            issuingBody: document.getElementById('qual-issuing-body').value,
            fieldOfStudy: document.getElementById('qual-field').value,
            issueDate: document.getElementById('qual-issue-date').value,
            expiryDate: document.getElementById('qual-expiry-date').value || null
        });

        // Also add to standards array if not present
        if (!auditor.standards.includes(standard.split(':')[0])) {
            auditor.standards.push(standard.split(':')[0]);
        }

        window.saveData();
        window.closeModal();
        window.showNotification('Qualification added successfully', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="qualifications"]')?.click();
        }, 100);
    };

    window.openModal();
};

// ============================================
// ISO 17021-1 AUDITOR EVALUATION FUNCTIONS
// ============================================

// Add Witness Audit Record
window.addWitnessAudit = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Record Witness Audit';
    document.getElementById('modal-body').innerHTML = `
                                                                                                        <form id="witness-form">
                                                                                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                                                                                                <div class="form-group">
                                                                                                                    <label>Date of Witness Audit</label>
                                                                                                                    <input type="date" id="witness-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Client Name</label>
                                                                                                                    <input type="text" id="witness-client" class="form-control" placeholder="Enter client name" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Standard Audited</label>
                                                                                                                    <select id="witness-standard" class="form-control">
                                                                                                                        <option value="ISO 9001:2015">ISO 9001:2015</option>
                                                                                                                        <option value="ISO 14001:2015">ISO 14001:2015</option>
                                                                                                                        <option value="ISO 45001:2018">ISO 45001:2018</option>
                                                                                                                        <option value="ISO 27001:2022">ISO 27001:2022</option>
                                                                                                                        <option value="ISO 22000:2018">ISO 22000:2018</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Witnessed By</label>
                                                                                                                    <input type="text" id="witness-by" class="form-control" value="${window.state.currentUser?.name || ''}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1;">
                                                                                                                    <label>Overall Rating</label>
                                                                                                                    <select id="witness-rating" class="form-control">
                                                                                                                        <option value="5">5 - Excellent</option>
                                                                                                                        <option value="4" selected>4 - Good</option>
                                                                                                                        <option value="3">3 - Satisfactory</option>
                                                                                                                        <option value="2">2 - Needs Improvement</option>
                                                                                                                        <option value="1">1 - Unsatisfactory</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1;">
                                                                                                                    <label>Observations/Notes</label>
                                                                                                                    <textarea id="witness-notes" class="form-control" rows="4" placeholder="Enter observations, strengths, areas for improvement..."></textarea>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                                                                                                    <input type="checkbox" id="first-time-audit">
                                                                                                                        <label for="first-time-audit" style="margin: 0; font-weight: 500;">This is a First-Time Auditor Witness Audit</label>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </form>
                                                                                                        `;

    document.getElementById('modal-save').onclick = function () {
        const client = document.getElementById('witness-client').value;
        if (!client) {
            window.showNotification('Please enter the client name', 'error');
            return;
        }

        if (!auditor.evaluations) auditor.evaluations = { witnessAudits: [], performanceReviews: [] };
        if (!auditor.evaluations.witnessAudits) auditor.evaluations.witnessAudits = [];

        auditor.evaluations.witnessAudits.unshift({
            date: document.getElementById('witness-date').value,
            client: client,
            standard: document.getElementById('witness-standard').value,
            witnessedBy: document.getElementById('witness-by').value,
            rating: parseInt(document.getElementById('witness-rating').value),
            notes: document.getElementById('witness-notes').value
        });

        // Update auditor evaluation status
        const isFirstTime = document.getElementById('first-time-audit').checked;
        if (isFirstTime) {
            auditor.evaluations.firstTimeAuditor = false; // Requirement met
        }

        // Calculate next witness due date (3 years rule per ISO 17021-1)
        const witnessDate = new Date(document.getElementById('witness-date').value);
        witnessDate.setFullYear(witnessDate.getFullYear() + 3);
        auditor.evaluations.nextWitnessAuditDue = witnessDate.toISOString().split('T')[0];
        auditor.evaluations.lastWitnessDate = document.getElementById('witness-date').value;

        window.saveData();
        window.closeModal();
        window.showNotification('Witness audit recorded', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="activity"]')?.click();
        }, 100);
    };

    window.openModal();
};

// Add Performance Review
window.addPerformanceReview = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Add Performance Review';
    document.getElementById('modal-body').innerHTML = `
                                                                                                        <form id="review-form">
                                                                                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                                                                                                <div class="form-group">
                                                                                                                    <label>Review Date</label>
                                                                                                                    <input type="date" id="review-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Review Type</label>
                                                                                                                    <select id="review-type" class="form-control">
                                                                                                                        <option value="Annual Review">Annual Review</option>
                                                                                                                        <option value="Quarterly Review">Quarterly Review</option>
                                                                                                                        <option value="Post-Audit Review">Post-Audit Review</option>
                                                                                                                        <option value="Competence Assessment">Competence Assessment</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Overall Rating (1-5)</label>
                                                                                                                    <select id="review-rating" class="form-control">
                                                                                                                        <option value="5">5 - Excellent</option>
                                                                                                                        <option value="4" selected>4 - Good</option>
                                                                                                                        <option value="3">3 - Satisfactory</option>
                                                                                                                        <option value="2">2 - Needs Improvement</option>
                                                                                                                        <option value="1">1 - Unsatisfactory</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Reviewed By</label>
                                                                                                                    <input type="text" id="review-by" class="form-control" value="${window.state.currentUser?.name || ''}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1;">
                                                                                                                    <label>Outcome/Decision</label>
                                                                                                                    <select id="review-outcome" class="form-control">
                                                                                                                        <option value="Approved">Approved - Continue</option>
                                                                                                                        <option value="Approved with Conditions">Approved with Conditions</option>
                                                                                                                        <option value="Retraining Required">Retraining Required</option>
                                                                                                                        <option value="Pending">Pending Further Review</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1;">
                                                                                                                    <label>Comments/Notes</label>
                                                                                                                    <textarea id="review-notes" class="form-control" rows="4" placeholder="Enter review comments, strengths, development areas..."></textarea>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </form>
                                                                                                        `;

    document.getElementById('modal-save').onclick = function () {
        if (!auditor.evaluations) auditor.evaluations = { witnessAudits: [], performanceReviews: [] };
        if (!auditor.evaluations.performanceReviews) auditor.evaluations.performanceReviews = [];

        auditor.evaluations.performanceReviews.unshift({
            date: document.getElementById('review-date').value,
            type: document.getElementById('review-type').value,
            rating: parseInt(document.getElementById('review-rating').value),
            reviewedBy: document.getElementById('review-by').value,
            outcome: document.getElementById('review-outcome').value,
            notes: document.getElementById('review-notes').value
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Performance review added', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="performance"]')?.click();
        }, 100);
    };

    window.openModal();
};

// Add Report Review (Office-based)
window.addReportReview = function (auditorId) {
    const auditor = window.state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    document.getElementById('modal-title').textContent = 'Add Report Review';
    document.getElementById('modal-body').innerHTML = `
                                                                                                        <form id="report-review-form">
                                                                                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                                                                                                <div class="form-group">
                                                                                                                    <label>Review Date</label>
                                                                                                                    <input type="date" id="review-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Report Type</label>
                                                                                                                    <select id="report-type" class="form-control">
                                                                                                                        <option value="Stage 1 Audit">Stage 1 Audit</option>
                                                                                                                        <option value="Stage 2 Audit">Stage 2 Audit</option>
                                                                                                                        <option value="Surveillance Audit">Surveillance Audit</option>
                                                                                                                        <option value="Recertification Audit">Recertification Audit</option>
                                                                                                                        <option value="Special Audit">Special Audit</option>
                                                                                                                    </select>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Client</label>
                                                                                                                    <input type="text" id="audit-client" class="form-control" placeholder="Client Name" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Reviewer</label>
                                                                                                                    <input type="text" id="reviewer-name" class="form-control" value="${window.state.currentUser?.name || ''}" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Quality Rating (1-5)</label>
                                                                                                                    <input type="number" id="quality-rating" class="form-control" min="1" max="5" value="4" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Completeness Rating (1-5)</label>
                                                                                                                    <input type="number" id="completeness-rating" class="form-control" min="1" max="5" value="5" required>
                                                                                                                </div>
                                                                                                                <div class="form-group">
                                                                                                                    <label>Technical Accuracy (1-5)</label>
                                                                                                                    <input type="number" id="technical-rating" class="form-control" min="1" max="5" value="4" required>
                                                                                                                </div>
                                                                                                                <div class="form-group" style="grid-column: 1 / -1;">
                                                                                                                    <label>Feedback/Notes</label>
                                                                                                                    <textarea id="review-notes" class="form-control" rows="4" placeholder="Enter feedback on the report..."></textarea>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </form>
                                                                                                        `;

    document.getElementById('modal-save').onclick = function () {
        if (!auditor.evaluations) auditor.evaluations = { witnessAudits: [], performanceReviews: [], reportReviews: [] };
        if (!auditor.evaluations.reportReviews) auditor.evaluations.reportReviews = [];

        auditor.evaluations.reportReviews.unshift({
            reviewDate: document.getElementById('review-date').value,
            reportType: document.getElementById('report-type').value,
            client: document.getElementById('audit-client').value,
            reviewer: document.getElementById('reviewer-name').value,
            qualityRating: parseInt(document.getElementById('quality-rating').value),
            completenessRating: parseInt(document.getElementById('completeness-rating').value),
            technicalRating: parseInt(document.getElementById('technical-rating').value),
            notes: document.getElementById('review-notes').value
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Report review added', 'success');
        renderAuditorDetail(auditorId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="performance"]')?.click();
        }, 100);
    };

    window.openModal();
};
// ============================================
// MULTI-SITE SAMPLING CALCULATOR (IAF MD 1)
// ============================================

function calculateSiteSampling(totalSites, riskLevel, maturityLevel, mandatorySites = []) {
    // IAF MD 1 Formula: Sample = √n
    let baseSample = Math.sqrt(totalSites);

    // Risk adjustments
    const riskMultiplier = {
        'Low': 0.8,
        'Medium': 1.0,
        'High': 1.2
    };

    // Maturity adjustments (inverse of risk for simplicity)
    const maturityMultiplier = {
        'Low': 1.2,      // Low maturity = higher sample
        'Normal': 1.0,
        'High': 0.8      // High maturity = lower sample
    };

    let adjustedSample = baseSample * (riskMultiplier[riskLevel] || 1.0) * (maturityMultiplier[maturityLevel] || 1.0);

    // Round up
    adjustedSample = Math.ceil(adjustedSample);

    // Minimum 25% of sites
    const minimumSample = Math.ceil(totalSites * 0.25);
    adjustedSample = Math.max(adjustedSample, minimumSample);

    // Never exceed total sites
    adjustedSample = Math.min(adjustedSample, totalSites);

    // Account for mandatory sites
    const mandatoryCount = mandatorySites.length;
    const randomSitesNeeded = Math.max(0, adjustedSample - mandatoryCount);

    return {
        totalSites,
        sampleSize: adjustedSample,
        mandatorySites: mandatoryCount,
        randomSites: randomSitesNeeded,
        baseSample: Math.ceil(baseSample),
        minimumRequired: minimumSample
    };
}

function renderMultiSiteSamplingCalculator() {
    const html = `
                                                                                                        <div class="fade-in">
                                                                                                            <div class="card" style="max-width: 900px; margin: 0 auto;">
                                                                                                                <h2 style="margin-bottom: 1rem; color: var(--primary-color);">
                                                                                                                    <i class="fa-solid fa-map-marked-alt" style="margin-right: 0.5rem;"></i>
                                                                                                                    Multi-Site Sampling Calculator (IAF MD 1)
                                                                                                                </h2>
                                                                                                                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                                                                                                                    Calculate the number of sites to audit based on IAF Mandatory Document 1 requirements
                                                                                                                </p>

                                                                                                                <form id="sampling-form" style="margin-bottom: 2rem;">
                                                                                                                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                                                                                                                        <!-- Total Sites -->
                                                                                                                        <div class="form-group">
                                                                                                                            <label for="total-sites">Total Number of Sites <span style="color: var(--danger-color);">*</span></label>
                                                                                                                            <input type="number" id="total-sites" min="1" value="10" required>
                                                                                                                                <small style="color: var(--text-secondary); font-size: 0.8rem;">All client locations</small>
                                                                                                                        </div>

                                                                                                                        <!-- Risk Level -->
                                                                                                                        <div class="form-group">
                                                                                                                            <label for="risk-level">Risk Level <span style="color: var(--danger-color);">*</span></label>
                                                                                                                            <select id="risk-level" required>
                                                                                                                                <option value="Low">Low (Simple operations)</option>
                                                                                                                                <option value="Medium" selected>Medium (Standard operations)</option>
                                                                                                                                <option value="High">High (Complex/hazardous)</option>
                                                                                                                            </select>
                                                                                                                        </div>

                                                                                                                        <!-- Maturity Level -->
                                                                                                                        <div class="form-group">
                                                                                                                            <label for="maturity-level">Management System Maturity <span style="color: var(--danger-color);">*</span></label>
                                                                                                                            <select id="maturity-level" required>
                                                                                                                                <option value="Low">Low (First certification)</option>
                                                                                                                                <option value="Normal" selected>Normal (Established)</option>
                                                                                                                                <option value="High">High (Mature, proven)</option>
                                                                                                                            </select>
                                                                                                                        </div>

                                                                                                                        <!-- Mandatory Sites -->
                                                                                                                        <div class="form-group">
                                                                                                                            <label for="mandatory-sites">Mandatory Sites Count</label>
                                                                                                                            <input type="number" id="mandatory-sites" min="0" value="1">
                                                                                                                                <small style="color: var(--text-secondary); font-size: 0.8rem;">HQ, special processes, NCR sites</small>
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">
                                                                                                                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                                                                                                                        Calculate Sample Size
                                                                                                                    </button>
                                                                                                                </form>

                                                                                                                <!-- Results Section -->
                                                                                                                <div id="sampling-results" style="display: none;">
                                                                                                                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 2rem 0;">

                                                                                                                        <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                                                                                                                            <i class="fa-solid fa-chart-pie" style="margin-right: 0.5rem;"></i>
                                                                                                                            Sampling Results
                                                                                                                        </h3>

                                                                                                                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                                                                                                                            <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 1.5rem;">
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Sample Size</p>
                                                                                                                                <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-sample-size">--</p>
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">sites to audit</p>
                                                                                                                            </div>

                                                                                                                            <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; padding: 1.5rem;">
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Mandatory Sites</p>
                                                                                                                                <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-mandatory">--</p>
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">must audit</p>
                                                                                                                            </div>

                                                                                                                            <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center; padding: 1.5rem;">
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Random Selection</p>
                                                                                                                                <p style="font-size: 2.5rem; font-weight: 700; margin: 0;" id="result-random">--</p>
                                                                                                                                <p style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">sites</p>
                                                                                                                            </div>
                                                                                                                        </div>

                                                                                                                        <!-- Calculation Details -->
                                                                                                                        <div class="card" style="background: #f8fafc; padding: 1.5rem;">
                                                                                                                            <h4 style="margin: 0 0 1rem 0; font-size: 1rem;">Calculation Breakdown</h4>
                                                                                                                            <div id="sampling-details" style="font-size: 0.9rem; color: var(--text-secondary);"></div>
                                                                                                                        </div>

                                                                                                                        <!-- IAF MD 1 Reference -->
                                                                                                                        <div style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                                                                                                                            <p style="margin: 0; font-size: 0.85rem; color: #0369a1;">
                                                                                                                                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                                                                                                                                <strong>IAF MD 1 Formula:</strong> Sample = √n (square root of total sites), adjusted for risk and maturity. Minimum 25% of sites must be audited.
                                                                                                                            </p>
                                                                                                                        </div>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        `;

    window.contentArea.innerHTML = html;

    // Form submission handler
    document.getElementById('sampling-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const totalSites = parseInt(document.getElementById('total-sites').value);
        const riskLevel = document.getElementById('risk-level').value;
        const maturityLevel = document.getElementById('maturity-level').value;
        const mandatoryCount = parseInt(document.getElementById('mandatory-sites').value) || 0;

        // Create array of mandatory sites (just count for now)
        const mandatorySites = Array(mandatoryCount).fill('Mandatory');

        // Calculate
        const results = calculateSiteSampling(totalSites, riskLevel, maturityLevel, mandatorySites);

        // Display results
        document.getElementById('result-sample-size').textContent = results.sampleSize;
        document.getElementById('result-mandatory').textContent = results.mandatorySites;
        document.getElementById('result-random').textContent = results.randomSites;

        // Show breakdown
        const details = `
                                                                                                        <div style="display: grid; gap: 0.5rem;">
                                                                                                            <div><strong>Formula Application:</strong></div>
                                                                                                            <div>• Base Sample (√${totalSites}): ${results.baseSample} sites</div>
                                                                                                            <div>• Risk Adjustment (${riskLevel}): ${riskLevel === 'Low' ? '×0.8' : riskLevel === 'High' ? '×1.2' : '×1.0'}</div>
                                                                                                            <div>• Maturity Adjustment (${maturityLevel}): ${maturityLevel === 'Low' ? '×1.2' : maturityLevel === 'High' ? '×0.8' : '×1.0'}</div>
                                                                                                            <div>• Minimum Required (25% of ${totalSites}): ${results.minimumRequired} sites</div>
                                                                                                            <div style="margin-top: 0.5rem;"><strong>Final Sample:</strong></div>
                                                                                                            <div>• ${results.mandatorySites} mandatory sites (HQ, special processes, NCR sites)</div>
                                                                                                            <div>• ${results.randomSites} sites selected randomly from remaining ${totalSites - results.mandatorySites} sites</div>
                                                                                                            <div>• <strong>Total: ${results.sampleSize} sites to audit</strong></div>
                                                                                                        </div>
                                                                                                        `;
        document.getElementById('sampling-details').innerHTML = details;

        // Show results section
        document.getElementById('sampling-results').style.display = 'block';

        // Scroll to results
        document.getElementById('sampling-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}
// Export function to global scope
window.renderMultiSiteSamplingCalculator = renderMultiSiteSamplingCalculator;


// Advanced Module Functions for AuditCB360
// This file contains enhanced rendering functions for Auditors, Programmes, Planning, and Execution modules

// ============================================
// AUDITORS MODULE - Enhanced
// ============================================

function renderAuditorsEnhanced() {
    const state = window.state;
    const searchTerm = state.auditorSearchTerm || '';
    const filterRole = state.auditorFilterRole || 'All';

    let filteredAuditors = state.auditors.filter(auditor => {
        const matchesSearch = auditor.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'All' || auditor.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const rows = filteredAuditors.map(auditor => `
        <tr class="auditor-row" data-auditor-id="${auditor.id}" style="cursor: pointer;">
            <td>${auditor.name}</td>
            <td><span style="background: var(--primary-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${auditor.role}</span></td>
            <td>${auditor.standards.join(', ')}</td>
            <td>
                <button class="btn btn-sm edit-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="auditor-search" placeholder="Search auditors..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="auditor-filter" style="max-width: 180px; margin-bottom: 0;">
                        <option value="All" ${filterRole === 'All' ? 'selected' : ''}>All Roles</option>
                        <option value="Lead Auditor" ${filterRole === 'Lead Auditor' ? 'selected' : ''}> Lead Auditor</option>
                        <option value="Auditor" ${filterRole === 'Auditor' ? 'selected' : ''}>Auditor</option>
                        <option value="Technical Expert" ${filterRole === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                    </select>
                    <button class="btn btn-secondary" onclick="renderCompetenceMatrix()">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i> Competence Matrix
                    </button>
                </div>
                <button id="btn-add-auditor" class="btn btn-primary"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Auditor</button>
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
        </div>
    `;
    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-add-auditor')?.addEventListener('click', openAddAuditorModal);

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
            if (!e.target.closest('.edit-auditor')) {
                const auditorId = parseInt(el.getAttribute('data-auditor-id'));
                renderAuditorDetail(auditorId);
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-auditor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const auditorId = parseInt(btn.getAttribute('data-auditor-id'));
            openEditAuditorModal(auditorId);
        });
    });
}

function renderAuditorDetail(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
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
                                <img src="${auditor.pictureUrl}" alt="${auditor.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color);">
                            ` : `
                                <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: white; font-weight: 600;">
                                    ${auditor.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                            `}
                        </div>
                        <!-- Info -->
                        <div>
                            <h2 style="margin-bottom: 0.25rem;">${auditor.name}</h2>
                            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${auditor.role}</p>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                ${auditor.standards ? auditor.standards.map(s => `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${s}</span>`).join('') : ''}
                            </div>
                            <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                                ${auditor.email ? `<span><i class="fa-solid fa-envelope" style="margin-right: 0.25rem;"></i>${auditor.email}</span>` : ''}
                                ${auditor.phone ? `<span><i class="fa-solid fa-phone" style="margin-right: 0.25rem;"></i>${auditor.phone}</span>` : ''}
                                ${auditor.location ? `<span><i class="fa-solid fa-location-dot" style="margin-right: 0.25rem;"></i>${auditor.location}</span>` : ''}
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
                <button class="tab-btn active" data-tab="info">Information</button>
                <button class="tab-btn" data-tab="upcoming">Upcoming Audits</button>
                <button class="tab-btn" data-tab="competence">Competence</button>
                <button class="tab-btn" data-tab="training">Training</button>
                <button class="tab-btn" data-tab="documents">Documents</button>
                <button class="tab-btn" data-tab="history">Audit History</button>
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
        openEditAuditorModal(auditor.id);
    });

    renderAuditorTab(auditor, 'info');
}

function renderAuditorTab(auditor, tabName) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'info':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Personal Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Full Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.name}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Role</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.role}</p>
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
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-map-marker-alt" style="color: var(--danger-color); margin-right: 5px;"></i>${auditor.location || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Contact Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Email</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-envelope" style="margin-right: 5px;"></i>${auditor.email || '-'}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Phone</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;"><i class="fa-solid fa-phone" style="margin-right: 5px;"></i>${auditor.phone || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Expertise & Industry</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Domain Expertise</label>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${(auditor.domainExpertise || []).map(d => `<span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">${d}</span>`).join('') || '<span style="color: var(--text-secondary);">-</span>'}
                            </div>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Industries</label>
                            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${(auditor.industries || []).map(i => `<span style="background: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">${i}</span>`).join('') || '<span style="color: var(--text-secondary);">-</span>'}
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
                                <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.education.degree || '-'}</p>
                            </div>
                            <div>
                                <label style="color: var(--text-secondary); font-size: 0.875rem;">Field of Study</label>
                                <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.education.fieldOfStudy || '-'}</p>
                            </div>
                            ${auditor.education.specialization ? `
                            <div style="grid-column: 1 / -1;">
                                <label style="color: var(--text-secondary); font-size: 0.875rem;">Specialization / Additional Qualifications</label>
                                <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.education.specialization}</p>
                            </div>
                            ` : ''}
                        </div>
                    ` : '<p style="color: var(--text-secondary);">No academic qualifications recorded.</p>'}
                </div>
            `;
            break;
        case 'upcoming':
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
                                            <div style="font-weight: 500; margin-bottom: 0.25rem;">${plan.client}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fa-solid fa-certificate" style="margin-right: 0.25rem;"></i>${plan.standard || 'ISO Standard'}
                                                <span style="margin: 0 0.5rem;">•</span>
                                                <i class="fa-solid fa-location-dot" style="margin-right: 0.25rem;"></i>${location}
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 0.9rem; font-weight: 500; color: var(--primary-color);">${new Date(plan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${plan.type || 'Audit'} • ${plan.manDays || 0} days</div>
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
            break;
        case 'competence':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Competence & Qualifications</h3>
                    <table class="table-container">
                        <thead>
                            <tr>
                                <th>Standard</th>
                                <th>Level</th>
                                <th>Valid Until</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${auditor.standards.map(std => `
                                <tr>
                                    <td>${std}</td>
                                    <td><span style="background: var(--success-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Lead Auditor</span></td>
                                    <td>2025-12-31</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            break;
        case 'training':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Training Records</h3>
                    ${(auditor.trainings && auditor.trainings.length > 0) ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr><th>Course</th><th>Provider</th><th>Date</th><th>Certificate</th></tr>
                                </thead>
                                <tbody>
                                    ${auditor.trainings.map(t => `
                                        <tr>
                                            <td>${t.course}</td>
                                            <td>${t.provider}</td>
                                            <td>${t.date}</td>
                                            <td>${t.certificate ? '<i class="fa-solid fa-file-pdf" style="color: var(--danger-color);"></i> View' : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p style="color: var(--text-secondary);">No training records available.</p>'}
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openAddTrainingModal(${auditor.id})">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Training
                    </button>
                </div>
            `;
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
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openUploadDocumentModal(${auditor.id})">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i> Upload Document
                    </button>
                </div>
            `;
            break;
        case 'history':
            const historyRows = (auditor.auditHistory || []).length > 0
                ? auditor.auditHistory.map(h => `
                    <tr>
                        <td>${h.client}</td>
                        <td>${h.date}</td>
                        <td><span class="status-badge status-completed">${h.type}</span></td>
                    </tr>
                `).join('')
                : '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No audit history available yet.</td></tr>';

            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Audit History</h3>
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
            break;
    }
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

function openAddAuditorModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add New Auditor';
    modalBody.innerHTML = `
        <form id="auditor-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Basic Info -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Personal Details</div>
            <div class="form-group">
                <label>Full Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="auditor-name" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="auditor-role">
                    <option>Lead Auditor</option>
                    <option>Auditor</option>
                    <option>Technical Expert</option>
                </select>
            </div>
            <div class="form-group">
                <label>Age</label>
                <input type="number" class="form-control" id="auditor-age" min="18" max="80" placeholder="e.g. 35">
            </div>
            <div class="form-group">
                <label>Experience (Years)</label>
                <input type="number" class="form-control" id="auditor-experience" min="0" placeholder="e.g. 10">
            </div>
            <div class="form-group">
                <label>Date Joined</label>
                <input type="date" class="form-control" id="auditor-joined">
            </div>

            <!-- Soft Skills -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Soft Skills & Competencies</div>
            <div class="form-group">
                <label>Communication</label>
                <select class="form-control" id="auditor-communication">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Report Writing</label>
                <select class="form-control" id="auditor-writing">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Analytical Skills</label>
                <select class="form-control" id="auditor-analytical">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Attention to Detail</label>
                <select class="form-control" id="auditor-attention">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Interviewing Skills</label>
                <select class="form-control" id="auditor-interviewing">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Time Management</label>
                <select class="form-control" id="auditor-time-management">
                    <option value="excellent">Excellent</option>
                    <option value="good" selected>Good</option>
                    <option value="average">Average</option>
                    <option value="needs-improvement">Needs Improvement</option>
                </select>
            </div>

            <!-- Contact Info -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Contact Information</div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="auditor-email" placeholder="auditor@example.com">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="auditor-phone" placeholder="+1 234 567 8900">
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Location</label>
                <input type="text" class="form-control" id="auditor-location" placeholder="City, Country">
            </div>

            <!-- Academic Qualifications -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Academic Qualifications</div>
            <div class="form-group">
                <label>Highest Degree</label>
                <select class="form-control" id="auditor-degree">
                    <option value="">-- Select Degree --</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Bachelor">Bachelor's Degree</option>
                    <option value="Master">Master's Degree</option>
                    <option value="PhD">PhD / Doctorate</option>
                </select>
            </div>
            <div class="form-group">
                <label>Field of Study</label>
                <select class="form-control" id="auditor-field">
                    <option value="">-- Select Field --</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Computer Science">Computer Science / IT</option>
                    <option value="Business Administration">Business Administration</option>
                    <option value="Quality Management">Quality Management</option>
                    <option value="Environmental Science">Environmental Science</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology / Biotechnology</option>
                    <option value="Food Science">Food Science</option>
                    <option value="Healthcare">Healthcare / Medical</option>
                    <option value="Finance">Finance / Accounting</option>
                    <option value="Industrial Engineering">Industrial Engineering</option>
                    <option value="Information Security">Information Security</option>
                    <option value="Safety Engineering">Safety / Occupational Health</option>
                    <option value="Other">Other</option>
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Specialization / Additional Qualifications</label>
                <input type="text" class="form-control" id="auditor-specialization" placeholder="e.g. ISO Lead Auditor certified, Six Sigma Black Belt">
            </div>

            <!-- Travel & Availability -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Travel & Availability</div>
            <div class="form-group">
                <label>Valid Passport</label>
                <select class="form-control" id="auditor-passport">
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            </div>
            <div class="form-group">
                <label>Willing to Travel</label>
                <select class="form-control" id="auditor-travel">
                    <option value="international">International</option>
                    <option value="regional">Regional Only</option>
                    <option value="local">Local Only</option>
                    <option value="no">Not Available</option>
                </select>
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Languages (comma-separated)</label>
                <input type="text" class="form-control" id="auditor-languages" placeholder="e.g. English, Arabic, French, Spanish">
            </div>
            <div class="form-group">
                <label>Profile Picture URL</label>
                <input type="url" class="form-control" id="auditor-picture" placeholder="https://example.com/photo.jpg">
                <small style="color: var(--text-secondary);">Enter URL of profile photo</small>
            </div>
            <div class="form-group">
                <label>Customer Rating (1-5)</label>
                <select class="form-control" id="auditor-rating">
                    <option value="">-- No Rating Yet --</option>
                    <option value="5">⭐⭐⭐⭐⭐ Excellent (5)</option>
                    <option value="4">⭐⭐⭐⭐ Very Good (4)</option>
                    <option value="3">⭐⭐⭐ Good (3)</option>
                    <option value="2">⭐⭐ Fair (2)</option>
                    <option value="1">⭐ Needs Improvement (1)</option>
                </select>
            </div>

            <!-- Expertise & Rates -->
            <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Expertise & Rate</div>
            <div class="form-group">
                <label>Qualified Standards <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="auditor-standards" multiple style="height: 100px;">
                    <option>ISO 9001</option>
                    <option>ISO 14001</option>
                    <option>ISO 27001</option>
                    <option>ISO 45001</option>
                </select>
                <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
            </div>
            <div class="form-group">
                <label>Man-Day Rate (USD)</label>
                <input type="number" class="form-control" id="auditor-rate" min="0" placeholder="e.g. 600">
            </div>
            <div class="form-group">
                <label>Domain Expertise (comma-separated)</label>
                <input type="text" class="form-control" id="auditor-domain" placeholder="e.g. Quality, Environmental">
            </div>
            <div class="form-group">
                <label>Industries (comma-separated)</label>
                <input type="text" class="form-control" id="auditor-industries" placeholder="e.g. Manufacturing, IT, Healthcare">
            </div>
        </form>

    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('auditor-name').value;
        const role = document.getElementById('auditor-role').value;
        const standardsSelect = document.getElementById('auditor-standards');
        const standards = Array.from(standardsSelect.selectedOptions).map(option => option.value);

        // New fields
        const age = parseInt(document.getElementById('auditor-age').value) || null;
        const experience = parseInt(document.getElementById('auditor-experience').value) || 0;
        const email = document.getElementById('auditor-email').value;
        const phone = document.getElementById('auditor-phone').value;
        const location = document.getElementById('auditor-location').value;
        const manDayRate = parseInt(document.getElementById('auditor-rate').value) || 0;
        const domainExpertise = document.getElementById('auditor-domain').value.split(',').map(s => s.trim()).filter(s => s);
        const industries = document.getElementById('auditor-industries').value.split(',').map(s => s.trim()).filter(s => s);

        // Academic qualifications
        const degree = document.getElementById('auditor-degree').value;
        const fieldOfStudy = document.getElementById('auditor-field').value;
        const specialization = document.getElementById('auditor-specialization').value;

        // Travel & Availability
        const hasPassport = document.getElementById('auditor-passport').value === 'yes';
        const willingToTravel = document.getElementById('auditor-travel').value;
        const languages = document.getElementById('auditor-languages').value.split(',').map(s => s.trim()).filter(s => s);
        const pictureUrl = document.getElementById('auditor-picture').value;
        const customerRating = parseInt(document.getElementById('auditor-rating').value) || null;

        // Joining date
        const dateJoined = document.getElementById('auditor-joined').value;

        // Soft Skills
        const softSkills = {
            communication: document.getElementById('auditor-communication').value,
            reportWriting: document.getElementById('auditor-writing').value,
            analyticalSkills: document.getElementById('auditor-analytical').value,
            attentionToDetail: document.getElementById('auditor-attention').value,
            interviewingSkills: document.getElementById('auditor-interviewing').value,
            timeManagement: document.getElementById('auditor-time-management').value
        };

        if (name && standards.length > 0) {
            const newAuditor = {
                id: Date.now(),
                name, role, standards,
                age, experience, email, phone, location,
                manDayRate, domainExpertise, industries,
                education: { degree, fieldOfStudy, specialization },
                hasPassport, willingToTravel, languages, pictureUrl, customerRating,
                dateJoined, softSkills,
                auditHistory: []
            };


            state.auditors.push(newAuditor);
            window.saveData();
            window.closeModal();
            renderAuditorsEnhanced();
            window.showNotification('Auditor added successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
    };
}

function openEditAuditorModal(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    const industries = ['Manufacturing', 'Automotive', 'Aerospace', 'IT', 'Financial Services', 'Healthcare', 'Pharmaceutical', 'Food & Beverage', 'Construction', 'Chemicals', 'Oil & Gas', 'Logistics', 'Retail', 'Education'];
    const auditorIndustries = auditor.industries || [];

    modalTitle.textContent = 'Edit Auditor';
    modalBody.innerHTML = `
        <form id="auditor-form" style="max-height: 70vh; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <!-- Basic Info -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--primary-color); font-weight: 600;">Basic Information</div>
                
                <div class="form-group">
                    <label>Full Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="auditor-name" value="${auditor.name}" required>
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
                    <input type="email" class="form-control" id="auditor-email" value="${auditor.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" class="form-control" id="auditor-phone" value="${auditor.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" class="form-control" id="auditor-location" value="${auditor.location || ''}">
                </div>
                <div class="form-group">
                    <label>Profile Picture URL</label>
                    <input type="url" class="form-control" id="auditor-picture" value="${auditor.pictureUrl || ''}" placeholder="https://...">
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
                    <input type="text" class="form-control" id="auditor-languages" value="${(auditor.languages || []).join(', ')}" placeholder="English, Spanish, French">
                </div>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('auditor-name').value;
        const role = document.getElementById('auditor-role').value;
        const standardsSelect = document.getElementById('auditor-standards');
        const standards = Array.from(standardsSelect.selectedOptions).map(option => option.value);
        const industriesSelect = document.getElementById('auditor-industries');
        const selectedIndustries = Array.from(industriesSelect.selectedOptions).map(option => option.value);

        if (name && standards.length > 0) {
            auditor.name = name;
            auditor.role = role;
            auditor.standards = standards;
            auditor.industries = selectedIndustries;
            auditor.email = document.getElementById('auditor-email').value;
            auditor.phone = document.getElementById('auditor-phone').value;
            auditor.location = document.getElementById('auditor-location').value;
            auditor.pictureUrl = document.getElementById('auditor-picture').value;
            auditor.experience = parseInt(document.getElementById('auditor-experience').value) || 0;
            auditor.manDayRate = parseInt(document.getElementById('auditor-rate').value) || 0;
            auditor.customerRating = parseInt(document.getElementById('auditor-rating').value) || 0;
            auditor.dateJoined = document.getElementById('auditor-date-joined').value;
            auditor.hasPassport = document.getElementById('auditor-passport').value === 'true';
            auditor.willingToTravel = document.getElementById('auditor-travel').value;
            auditor.languages = document.getElementById('auditor-languages').value.split(',').map(l => l.trim()).filter(l => l);

            window.saveData();
            window.closeModal();
            renderAuditorDetail(auditorId);
            window.showNotification('Auditor updated successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
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
        <form id="training-form">
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
        </form>
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
        <form id="document-form">
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
        </form>
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
window.openAddAuditorModal = openAddAuditorModal;
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

// ============================================
// AUDIT PLANNING MODULE
// ============================================

function renderAuditPlanningEnhanced() {
    if (!window.state) {
        alert('CRITICAL ERROR: window.state is undefined! Script loading failed.');
        return;
    }
    const state = window.state;
    const searchTerm = state.planningSearchTerm || '';

    let filteredPlans = state.auditPlans.filter(plan => {
        return plan.client.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const rows = filteredPlans.map(plan => `
        <tr class="plan-row" style="cursor: pointer;">
            <td>
                <a href="javascript:void(0)" onclick="window.viewAuditPlan(${plan.id})" style="font-weight: 500; color: var(--primary-color); text-decoration: none;">${plan.client}</a>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${plan.standard || 'ISO 9001:2015'}</div>
            </td>
            <td>${plan.type || 'Surveillance'}</td>
            <td>${plan.date}</td>
            <td>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${((plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown')).map(auditor => `
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                            <i class="fa-solid fa-user" style="font-size: 0.7rem; color: var(--text-secondary); margin-right: 4px;"></i>${auditor}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td><span class="status-badge status-${plan.status.toLowerCase()}">${plan.status}</span></td>
            <td>
                <button class="btn btn-sm edit-plan-btn" data-plan-id="${plan.id}" title="Edit Plan">
                    <i class="fa-solid fa-pen" style="color: var(--primary-color);"></i>
                </button>
                <button class="btn btn-sm" onclick="window.viewAuditPlan(${plan.id})" title="View Details">
                    <i class="fa-solid fa-eye" style="color: var(--text-secondary);"></i>
                </button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Audit Planning <span style="font-size: 0.8rem; color: var(--text-secondary);">(v5.2)</span></h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="togglePlanningAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showPlanningAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showPlanningAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    <button id="btn-create-plan" class="btn btn-primary">
                        <i class="fa-solid fa-plus"></i> Create Audit Plan
                    </button>
                </div>
            </div>

            ${state.showPlanningAnalytics !== false ? `
             <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Plans -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-calendar-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Plans</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditPlans.length}</div>
                    </div>
                </div>

                <!-- Drafts -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-pencil"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Drafts</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditPlans.filter(p => p.status === 'Draft').length}</div>
                    </div>
                </div>

                 <!-- Confirmed/Scheduled -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                         <i class="fa-solid fa-clock"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Scheduled</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditPlans.filter(p => p.status === 'Confirmed').length}</div>
                    </div>
                </div>

                 <!-- Completed -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                         <i class="fa-solid fa-check-double"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Completed</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditPlans.filter(p => p.status === 'Completed').length}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="plan-search" placeholder="Search audit plans..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="plan-filter" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client & Standard</th>
                            <th>Audit Type</th>
                            <th>Dates</th>
                            <th>Audit Team</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No audit plans found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-create-plan')?.addEventListener('click', openCreatePlanModal);

    document.getElementById('plan-search')?.addEventListener('input', (e) => {
        state.planningSearchTerm = e.target.value;
        renderAuditPlanningEnhanced();
    });

    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const planId = parseInt(btn.getAttribute('data-plan-id'));
            editAuditPlan(planId);
        });
    });

    document.querySelectorAll('.view-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const planId = parseInt(btn.getAttribute('data-plan-id'));
            viewAuditPlan(planId);
        });
    });

    document.querySelectorAll('.plan-title-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const planId = parseInt(link.getAttribute('data-plan-id'));
            viewAuditPlan(planId);
        });
    });
}

function openCreatePlanModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Create Audit Plan';
    modalBody.innerHTML = `
        <form id="plan-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <!-- Client Selection -->
                <div class="form-group">
                    <label>Client <span style="color: var(--danger-color);">*</span></label>
                    <select class="form-control" id="plan-client" required onchange="updateClientDetails(this.value)">
                        <option value="">-- Select Client --</option>
                        ${state.clients.map(c => `<option value="${c.name}">${c.name} (${c.industry || 'N/A'})</option>`).join('')}
                    </select>
                </div>

                <!-- Standard (Multi-select) -->
                <div class="form-group">
                    <label>Audit Standard(s)</label>
                    <select class="form-control" id="plan-standard" multiple style="height: 120px;">
                        ${["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"].map(std =>
        `<option value="${std}">${std}</option>`
    ).join('')}
                    </select>
                    <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple standards</small>
                </div>

                <!-- Client Info Panel -->
                <div id="client-info-panel" style="grid-column: 1 / -1; display: none; background: #f0f9ff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #bae6fd; margin-bottom: 0.5rem;">
                    <p style="color: var(--text-secondary); text-align: center; margin: 0;">Select a client to view details</p>
                </div>

                <!-- Site Selection (Multi-select with checkboxes) -->
                <div class="form-group" id="site-selection-group" style="grid-column: 1 / -1; display: none;">
                    <label><i class="fa-solid fa-location-dot" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Site(s) <span style="font-weight: normal; color: var(--text-secondary);">(select sites in scope)</span></label>
                    <div id="site-checkboxes" style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.75rem; border-radius: var(--radius-md); background: white;">
                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Select a client to view available sites</p>
                    </div>
                    <small style="color: var(--text-secondary);">Selected sites affect man-day calculation and auditor recommendations</small>
                </div>

                <!-- Audit Type -->
                <div class="form-group">
                    <label>Audit Type</label>
                    <select class="form-control" id="plan-type">
                        <option value="Stage 1">Stage 1</option>
                        <option value="Stage 2">Stage 2</option>
                        <option value="Surveillance">Surveillance</option>
                        <option value="Recertification">Recertification</option>
                    </select>
                </div>

                <!-- Dates -->
                <div class="form-group">
                    <label>Planned Date</label>
                    <input type="date" class="form-control" id="plan-date" required>
                </div>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">

            <!-- Man-Day Calculation Integration -->
            <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; font-size: 0.95rem; color: var(--primary-color);">
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i> Audit Duration (ISO 17021-1)
                    </h4>
                </div>
                
                <!-- Calculation Parameters -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.8rem;">Employees</label>
                        <input type="number" class="form-control" id="plan-employees" placeholder="Count" readonly style="background: #f1f5f9;">
                    </div>
                     <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.8rem;">Sites (selected)</label>
                        <input type="number" class="form-control" id="plan-sites" value="0" readonly style="background: #f1f5f9;">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.8rem;">Risk/Complexity</label>
                        <select class="form-control" id="plan-risk" style="padding: 0.4rem;">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                </div>

                <!-- Calculate Button -->
                <button type="button" id="btn-calculate-mandays" class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;" onclick="autoCalculateDays()" disabled>
                    <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i> Calculate Man-Days
                </button>
                <p id="manday-hint" style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin-bottom: 1rem;"><i class="fa-solid fa-info-circle"></i> Select site(s) above to enable calculation</p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">Total Man-Days</label>
                        <input type="number" class="form-control" id="plan-mandays" step="0.5" placeholder="--">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">On-Site Days</label>
                        <input type="number" class="form-control" id="plan-onsite-days" step="0.5" placeholder="--">
                    </div>
                </div>
            </div>

            <!-- Auditor Selection with Competence Check -->
            <div class="form-group">
                <label>Lead Auditor</label>
                <select class="form-control" id="plan-lead-auditor">
                    <option value="">-- Select Lead Auditor --</option>
                    ${state.auditors.filter(a => a.role === 'Lead Auditor').map(a => `
                        <option value="${a.name}">${a.name} (${a.standards ? a.standards.join(', ') : 'No standards'})</option>
                    `).join('')}
                </select>
                <small style="color: var(--text-secondary);">Only showing qualified Lead Auditors</small>
            </div>

            <div class="form-group">
                <label>Team Members</label>
                <select class="form-control" id="plan-team" multiple style="height: 100px;">
                    ${state.auditors.filter(a => a.role !== 'Lead Auditor').map(a => `
                        <option value="${a.name}">${a.name} (${a.role})</option>
                    `).join('')}
                </select>
                <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
            </div>
        </form>
`;

    window.openModal();

    modalSave.onclick = () => {
        saveAuditPlan();
    };
}

function editAuditPlan(id) {
    const plan = state.auditPlans.find(p => p.id === id);
    if (!plan) return;

    openCreatePlanModal();

    // Fill data
    setTimeout(() => {
        document.getElementById('modal-title').textContent = 'Edit Audit Plan';
        document.getElementById('plan-client').value = plan.client;
        document.getElementById('plan-client').value = plan.client;

        // Handle Multi-Standards selection
        const currentStandards = (plan.standard || '').split(', ');
        Array.from(document.getElementById('plan-standard').options).forEach(opt => {
            opt.selected = currentStandards.includes(opt.value);
        });

        document.getElementById('plan-type').value = plan.type || 'Surveillance';
        document.getElementById('plan-date').value = plan.date;

        // Fill calculation inputs if available in plan or client (optional enhancement, for now just basic fields)
        // If we saved calculation data, we would restore it here.
        updateClientDetails(plan.client); // Auto-fill from client data again to ensure calc inputs are ready

        // Handle Lead Auditor and Team Members
        const teamMembers = (plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown');
        const lead = teamMembers[0] || '';
        document.getElementById('plan-lead-auditor').value = lead;

        // Handle Team Members
        const teamSelect = document.getElementById('plan-team');
        const otherMembers = teamMembers.slice(1);
        Array.from(teamSelect.options).forEach(option => {
            option.selected = otherMembers.includes(option.value);
        });

        // Restore site selection after a short delay (after updateClientDetails populates checkboxes)
        setTimeout(() => {
            if (plan.selectedSites && plan.selectedSites.length > 0) {
                const selectedSiteNames = plan.selectedSites.map(s => s.name);
                document.querySelectorAll('.site-checkbox').forEach(cb => {
                    cb.checked = selectedSiteNames.includes(cb.dataset.name);
                });
                // Update site count
                const count = document.querySelectorAll('.site-checkbox:checked').length;
                if (document.getElementById('plan-sites')) {
                    document.getElementById('plan-sites').value = count;
                }
            }
        }, 100);

        // Update save handler to update instead of create
        document.getElementById('modal-save').onclick = () => {
            const updatedClient = document.getElementById('plan-client').value;
            const updatedDate = document.getElementById('plan-date').value;
            const updatedLead = document.getElementById('plan-lead-auditor').value;
            const updatedType = document.getElementById('plan-type').value;
            const updatedStandard = Array.from(document.getElementById('plan-standard').selectedOptions).map(o => o.value).join(', ');
            const updatedManDays = parseFloat(document.getElementById('plan-mandays').value) || 0;
            const updatedOnsiteDays = parseFloat(document.getElementById('plan-onsite-days').value) || 0;

            // Get selected sites
            const updatedSites = [];
            document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
                updatedSites.push({
                    name: cb.dataset.name,
                    geotag: cb.dataset.geotag || null
                });
            });

            const teamSelect = document.getElementById('plan-team');
            const updatedTeam = Array.from(teamSelect.selectedOptions).map(option => option.value);
            if (updatedLead) updatedTeam.unshift(updatedLead);

            if (updatedClient && updatedDate && updatedLead) {
                plan.client = updatedClient;
                plan.date = updatedDate;
                plan.type = updatedType;
                plan.standard = updatedStandard;
                plan.team = updatedTeam;
                plan.selectedSites = updatedSites;
                plan.manDays = updatedManDays;
                plan.onsiteDays = updatedOnsiteDays;

                window.saveData();
                window.closeModal();
                renderAuditPlanningEnhanced();
                window.showNotification('Audit Plan updated successfully');
            }
        };
    }, 50);
}

function updateClientDetails(clientName) {
    const client = state.clients.find(c => c.name === clientName);
    const siteGroup = document.getElementById('site-selection-group');
    const siteCheckboxes = document.getElementById('site-checkboxes');

    if (client) {
        // Auto-select standard
        if (client.standard) {
            const stdSelect = document.getElementById('plan-standard');
            if (stdSelect) {
                // Determine if client standard is single or comma-separated
                const clientStds = (client.standard || '').split(', ');
                Array.from(stdSelect.options).forEach(opt => {
                    opt.selected = clientStds.includes(opt.value);
                });
            }
        }

        // Auto-fill calculation params
        if (document.getElementById('plan-employees')) {
            document.getElementById('plan-employees').value = client.employees || 0;
        }

        // Update sites count from sites array
        const sitesCount = (client.sites && client.sites.length) || 1;
        if (document.getElementById('plan-sites')) {
            document.getElementById('plan-sites').value = sitesCount;
        }

        // Populate site selection checkboxes
        if (siteGroup && siteCheckboxes && client.sites && client.sites.length > 0) {
            siteGroup.style.display = 'block';
            siteCheckboxes.innerHTML = client.sites.map((s, i) => `
                <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: var(--radius-sm); border-left: 3px solid var(--primary-color);">
                    <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; font-weight: normal;">
                        <input type="checkbox" class="site-checkbox" data-name="${s.name}" data-geotag="${s.geotag || ''}" data-employees="${s.employees || 0}" data-shift="${s.shift || 'No'}" checked style="margin-top: 3px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${s.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">
                                <i class="fa-solid fa-location-dot"></i> ${s.address || ''}, ${s.city || ''}
                                ${s.geotag ? `<span style="margin-left: 0.5rem; color: #0369a1;"><i class="fa-solid fa-map-pin"></i> GPS</span>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${s.employees ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem;"><i class="fa-solid fa-users" style="margin-right: 3px;"></i>${s.employees} emp</span>` : ''}
                                ${s.shift ? `<span style="background: ${s.shift === 'Yes' ? '#fef3c7' : '#f1f5f9'}; color: ${s.shift === 'Yes' ? '#d97706' : '#64748b'}; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem;">${s.shift === 'Yes' ? 'Multi-Shift' : 'General Shift'}</span>` : ''}
                            </div>
                        </div>
                    </label>
                </div>
            `).join('');

            // Add event listener to update site count when checkboxes change
            siteCheckboxes.querySelectorAll('.site-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const count = document.querySelectorAll('.site-checkbox:checked').length;
                    if (document.getElementById('plan-sites')) {
                        document.getElementById('plan-sites').value = count;
                    }
                    // Enable/disable calculate button based on site selection
                    const calcBtn = document.getElementById('btn-calculate-mandays');
                    const hint = document.getElementById('manday-hint');
                    if (calcBtn) {
                        calcBtn.disabled = count === 0;
                        if (hint) {
                            hint.style.display = count > 0 ? 'none' : 'block';
                        }
                    }
                });
            });
        } else if (siteGroup) {
            siteGroup.style.display = 'none';
        }

        // Show client info panel
        const clientInfoPanel = document.getElementById('client-info-panel');
        if (clientInfoPanel) {
            const primaryContact = (client.contacts && client.contacts[0]) || {};
            clientInfoPanel.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
                    <div><strong>Industry:</strong> ${client.industry || '-'}</div>
                    <div><strong>Employees:</strong> ${client.employees || 0}</div>
                    <div><strong>Total Sites:</strong> ${sitesCount}</div>
                    <div><strong>Shifts:</strong> ${client.shifts || 'No'}</div>
                    <div><strong>Contact:</strong> ${primaryContact.name || '-'} (${primaryContact.designation || ''})</div>
                    <div><strong>Website:</strong> ${client.website ? `<a href="${client.website}" target="_blank">${client.website}</a>` : '-'}</div>
                </div>
            `;
            clientInfoPanel.style.display = 'block';
        }

        // Enable calculate button if sites are selected
        const selectedSites = document.querySelectorAll('.site-checkbox:checked').length;
        const calcBtn = document.getElementById('btn-calculate-mandays');
        const hint = document.getElementById('manday-hint');
        if (calcBtn && selectedSites > 0) {
            calcBtn.disabled = false;
            if (hint) hint.style.display = 'none';
        }
    } else {
        if (siteGroup) siteGroup.style.display = 'none';
    }
}

function autoCalculateDays() {
    // Step 1: Get currently selected sites and sum up employees
    const selectedCheckboxes = document.querySelectorAll('.site-checkbox:checked');
    const siteCount = selectedCheckboxes.length;

    if (siteCount === 0) {
        window.showNotification('Please select at least one site', 'warning');
        return;
    }

    // Sum employees from selected sites (from data-employees attribute)
    let totalEmployees = 0;
    let hasShiftWork = false;

    selectedCheckboxes.forEach(checkbox => {
        const empCount = parseInt(checkbox.dataset.employees) || 0;
        totalEmployees += empCount;
        // Check for shift work - if any site has shift, consider it
        const shift = checkbox.dataset.shift;
        if (shift === 'Yes') hasShiftWork = true;
    });

    // If no employees found in selected sites, try to get from client info
    if (totalEmployees === 0) {
        const clientSelect = document.getElementById('plan-client');
        const selectedClient = state.clients.find(c => c.name === clientSelect?.value);
        if (selectedClient && selectedClient.employees) {
            totalEmployees = selectedClient.employees;
        }
    }

    // Update the display fields
    document.getElementById('plan-employees').value = totalEmployees;
    document.getElementById('plan-sites').value = siteCount;

    const risk = document.getElementById('plan-risk').value || 'Medium';

    // Ensure the helper function exists (it's in advanced-modules.js)
    if (typeof calculateManDays !== 'function') {
        // Simple fallback if advanced-module isn't loaded
        console.warn('Advanced Man-Day Calculator not found, using simple fallback');
        let simpleDays;
        if (totalEmployees <= 10) simpleDays = 2;
        else if (totalEmployees <= 50) simpleDays = 3;
        else if (totalEmployees <= 100) simpleDays = 5;
        else if (totalEmployees <= 500) simpleDays = 8;
        else simpleDays = 12;

        // Adjust for multiple sites
        simpleDays += (siteCount - 1) * 0.5;

        document.getElementById('plan-mandays').value = simpleDays.toFixed(1);
        document.getElementById('plan-onsite-days').value = (simpleDays * 0.8).toFixed(1);
        window.showNotification(`Calculated ${simpleDays.toFixed(1)} days for ${totalEmployees} employees at ${siteCount} site(s)`, 'success');
        return;
    }

    if (totalEmployees > 0) {
        // Signature: calculateManDays(employees, sites, effectiveness, shiftWork, riskLevel)
        const results = calculateManDays(totalEmployees, siteCount, 2, hasShiftWork, risk);

        const type = document.getElementById('plan-type').value;
        let days = 0;

        if (type === 'Stage 1') days = results.stage1;
        else if (type === 'Stage 2') days = results.stage2;
        else days = results.surveillance;

        document.getElementById('plan-mandays').value = days.toFixed(1);
        document.getElementById('plan-onsite-days').value = (days * 0.8).toFixed(1);

        window.showNotification(`Calculated ${days.toFixed(1)} man-days for ${totalEmployees} employees at ${siteCount} site(s)${hasShiftWork ? ' (with shift work)' : ''}`, 'success');
    } else {
        window.showNotification('No employee data available for selected sites. Please verify client/site information.', 'warning');
    }
}

function saveAuditPlan() {
    const client = document.getElementById('plan-client').value;
    const date = document.getElementById('plan-date').value;
    const lead = document.getElementById('plan-lead-auditor').value;
    const type = document.getElementById('plan-type').value;
    const standard = Array.from(document.getElementById('plan-standard').selectedOptions).map(o => o.value).join(', ');
    const manDays = parseFloat(document.getElementById('plan-mandays').value) || 0;
    const onsiteDays = parseFloat(document.getElementById('plan-onsite-days').value) || 0;

    // Get selected sites
    const selectedSites = [];
    document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
        selectedSites.push({
            name: cb.dataset.name,
            geotag: cb.dataset.geotag || null
        });
    });

    // Get multiple selected team members
    const teamSelect = document.getElementById('plan-team');
    const team = Array.from(teamSelect.selectedOptions).map(option => option.value);
    if (lead) team.unshift(lead);

    if (client && date && lead) {
        const newPlan = {
            id: Date.now(),
            client: client,
            date: date,
            type: type,
            standard: standard,
            team: team,
            selectedSites: selectedSites, // Store selected sites with geotags
            manDays: manDays,
            onsiteDays: onsiteDays,
            status: 'Draft'
        };

        state.auditPlans.push(newPlan);
        window.saveData();
        window.closeModal();
        renderAuditPlanningEnhanced();
        window.showNotification('Audit Plan created successfully');
    } else {
        window.showNotification('Please fill in all required fields (Client, Date, Lead Auditor)', 'error');
    }
}

function viewAuditPlan(id) {
    if (!window.state) {
        alert('ERROR: window.state is undefined');
        return;
    }
    const state = window.state;

    if (!state.auditPlans) {
        alert('ERROR: state.auditPlans is undefined. State keys: ' + Object.keys(state).join(', '));
        return;
    }

    const plan = state.auditPlans.find(p => p.id == id);
    if (!plan) {
        alert('Plan not found with ID: ' + id);
        return;
    }

    const client = state.clients.find(c => c.name === plan.client);
    const checklists = state.checklists || [];
    const planChecklists = plan.selectedChecklists || [];
    const report = (state.auditReports || []).find(r => r.planId === plan.id);

    // Calculate Progress
    let progress = 0;
    let completedItems = 0;
    let totalItems = 0;

    // Sum total items from assigned checklists
    planChecklists.forEach(clId => {
        const cl = checklists.find(c => c.id === clId);
        if (cl && cl.items) totalItems += cl.items.length;
    });

    if (report && report.checklistProgress && totalItems > 0) {
        completedItems = report.checklistProgress.filter(p => p.status && p.status !== '').length;
        progress = Math.round((completedItems / totalItems) * 100);
    }

    // Helper to render checklist list
    const checklistListHTML = planChecklists.length > 0 ? planChecklists.map(clId => {
        const cl = checklists.find(c => c.id === clId);
        if (!cl) return '';
        return `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); border-left: 3px solid ${cl.type === 'global' ? '#0369a1' : '#059669'}; margin-bottom: 0.5rem;">
                <div>
                    <p style="font-weight: 500; margin: 0;">${cl.name}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${cl.items?.length || 0} items • ${cl.type === 'global' ? 'Global' : 'Custom'}</p>
                </div>
                <button class="btn btn-sm" onclick="viewChecklistDetail(${cl.id})">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </div>
    `;
    }).join('') : '<p style="color: var(--text-secondary); font-style: italic;">No checklists assigned.</p>';

    // --- UI REDESIGN ---
    // Stepper Calculation
    const phases = ['Draft', 'Confirmed', 'In Progress', 'Reporting', 'Completed']; // Mapping logic might need adjustment based on statuses

    // Determine active step (0-indexed)
    let activeStep = 0;
    if (plan.status === 'Draft') activeStep = 0;
    else if (plan.status === 'Confirmed') {
        activeStep = 1;
        if (totalItems > 0) activeStep = 1; // Checklists assigned
    }
    else if (plan.status === 'In Progress' || progress > 0) activeStep = 2;
    // For Reporting/Closing, we might need to check report status
    if (report) activeStep = 3;
    if (plan.status === 'Completed') activeStep = 4;

    const stepperHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; position: relative;">
            <div style="position: absolute; top: 15px; left: 0; right: 0; height: 2px; background: #e2e8f0; z-index: 0;"></div>
            ${['Plan Created', 'Checklists Ready', 'Execution', 'Reporting', 'Audit Closed'].map((step, index) => {
        const isActive = index <= activeStep;
        const isCurrent = index === activeStep;
        const color = isActive ? 'var(--primary-color)' : '#94a3b8';
        const bgColor = isActive ? 'var(--primary-color)' : '#e2e8f0';

        return `
                <div style="position: relative; z-index: 1; text-align: center; flex: 1;">
                    <div style="width: 30px; height: 30px; border-radius: 50%; background: ${bgColor}; color: ${isActive ? 'white' : '#64748b'}; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-weight: bold; font-size: 0.9rem; border: 4px solid white;">
                        ${isActive ? '<i class="fa-solid fa-check"></i>' : index + 1}
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; font-weight: ${isCurrent ? 'bold' : 'normal'}; color: ${isCurrent ? 'var(--primary-color)' : '#64748b'};">${step}</div>
                </div>
                `;
    }).join('')}
        </div>
    `;

    const html = `
    <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button class="btn btn-secondary" onclick="renderAuditPlanningEnhanced()">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 style="margin: 0; font-size: 1.5rem;">${plan.client}</h2>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">Audit Plan Details • ${plan.standard}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem;">
                     ${report ? `<button class="btn btn-secondary" onclick="printAuditPlan(${plan.id})"><i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Checklist</button>` : ''}
                     <button class="btn btn-secondary" onclick="printAuditPlanDetails(${plan.id})"><i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Print Plan</button>
                     <button class="btn btn-primary" onclick="editAuditPlan(${plan.id})"><i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit</button>
                </div>
            </div>

            <!-- Stepper -->
            ${stepperHTML}
            
            <!-- Details Grid (Row 1) -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                
                <!-- Client Info -->
                <div class="card" style="margin: 0;">
                    <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase;">Client Information</h4>
                    <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">${client?.name}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        <div><i class="fa-solid fa-industry" style="width: 20px;"></i> ${client?.industry || 'N/A'}</div>
                        <div style="margin-top: 0.25rem;"><i class="fa-solid fa-users" style="width: 20px;"></i> ${client?.employees || 0} employees</div>
                    </div>
                </div>

                <!-- Scope/Sites -->
                <div class="card" style="margin: 0;">
                   <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase;">Audit Scope</h4>
                   <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">${plan.selectedSites?.length || 1} Site(s)</div>
                   <div style="font-size: 0.9rem; color: var(--text-secondary); max-height: 80px; overflow-y: auto;">
                        ${(plan.selectedSites || []).map(s => `<div>• ${s.name}</div>`).join('') || 'All Sites'}
                   </div>
                </div>

                <!-- Team -->
                <div class="card" style="margin: 0;">
                    <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase;">Audit Team</h4>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${((plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown')).map(m => `
                             <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 12px; font-size: 0.85rem;">${m}</span>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Workflow Stages Grid (Row 2) -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
                
                <!-- 1. Configuration -->
                <div class="card" style="margin: 0; display: flex; flex-direction: column;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Checklist Config</h3>
                    <div style="flex: 1; margin-bottom: 1rem;">
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">Assign and customize checklists for this audit.</p>
                        <div style="font-weight: bold; font-size: 1.25rem; margin-top: 0.5rem;">${totalItems} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-secondary);">Items</span></div>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary" style="width: 100%; margin-bottom: 0.5rem;" onclick="window.printAuditPlan('${plan.id}')"><i class="fa-solid fa-print"></i> Print</button>
                        <button class="btn btn-sm btn-secondary" style="width: 100%;" onclick="openChecklistSelectionModal(${plan.id})">Configure</button>
                    </div>
                </div>

                <!-- 2. Execution -->
                <div class="card" style="margin: 0; display: flex; flex-direction: column; border-top: 3px solid var(--success-color);">
                     <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-play" style="margin-right: 0.5rem; color: var(--success-color);"></i> Execution</h3>
                     <div style="flex: 1; margin-bottom: 1rem;">
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">Verify items, raise NCRs.</p>
                        <!-- Mini Progress -->
                        <div style="margin-top: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 2px;">
                                <span>Progress</span>
                                <span>${progress}%</span>
                            </div>
                            <div style="height: 6px; background: #e2e8f0; border-radius: 3px;">
                                <div style="width: ${progress}%; background: var(--success-color); height: 100%; border-radius: 3px;"></div>
                            </div>
                        </div>
                     </div>
                     <button class="btn btn-primary" style="width: 100%;" onclick="window.renderModule('audit-execution')">Execute</button>
                </div>

                <!-- 3. Reporting -->
                <div class="card" style="margin: 0; display: flex; flex-direction: column;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-file-edit" style="margin-right: 0.5rem; color: orange;"></i> Reporting</h3>
                    <div style="flex: 1; margin-bottom: 1rem;">
                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: center;">
                            <div style="background: #fef2f2; padding: 0.5rem; border-radius: 4px;">
                                <div style="font-weight: bold; color: var(--danger-color);">${report?.ncrs?.length || 0}</div>
                                <div style="font-size: 0.75rem;">NCRs</div>
                            </div>
                            <div style="background: #fffbeb; padding: 0.5rem; border-radius: 4px;">
                                <div style="font-weight: bold; color: var(--warning-color);">${report?.capas?.length || 0}</div>
                                <div style="font-size: 0.75rem;">CAPAs</div>
                            </div>
                         </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; font-style: italic;">
                         ${report?.status === 'Finalized' ? 'Report Finalized' : 'Draft Report'}
                    </div>
                </div>

                <!-- 4. Closing -->
                <div class="card" style="margin: 0; display: flex; flex-direction: column;">
                     <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-flag-checkered" style="margin-right: 0.5rem; color: #64748b;"></i> Closing</h3>
                     <div style="flex: 1; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center;">
                        ${plan.status === 'Completed' ?
            '<div style="text-align: center; color: var(--success-color);"><i class="fa-solid fa-certificate" style="font-size: 2rem;"></i><div style="font-size: 0.8rem; margin-top: 0.25rem;">Certified</div></div>' :
            '<div style="text-align: center; color: #cbd5e1;"><i class="fa-solid fa-lock" style="font-size: 2rem;"></i></div>'
        }
                     </div>
                     <button class="btn btn-success" ${report?.status !== 'Finalized' || plan.status === 'Completed' ? 'disabled' : ''} onclick="closeAuditPlan(${plan.id})" style="width: 100%;">
                        ${plan.status === 'Completed' ? 'Closed' : 'Close Audit'}
                     </button>
                </div>

            </div>
    </div>
    `;
    window.contentArea.innerHTML = html;
}


window.printAuditPlanDetails = function (planId) {
    const plan = state.auditPlans.find(p => p.id == planId);
    if (!plan) return;

    const client = state.clients.find(c => c.name === plan.client);

    // Calculate breakdowns
    let totalEmployees = 0;
    const siteDetails = (plan.selectedSites || []).map(s => {
        // Find site object in client data to get employees
        const siteData = (client?.sites || []).find(cs => cs.name === s.name);
        const emps = siteData?.employees || 0;
        totalEmployees += emps;
        return { ...s, employees: emps, address: siteData?.address || '' };
    });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`PLAN-${plan.id}|${plan.client}|${plan.date}`)}`;

    let content = `
        <html>
        <head>
            <title>Audit Plan - ${plan.client}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; padding: 40px; }
                .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                .logo { font-size: 24px; font-weight: bold; color: #0f172a; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .meta-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; width: 50%; vertical-align: top; }
                .meta-label { font-weight: bold; color: #64748b; font-size: 0.9em; display: block; margin-bottom: 4px; }
                .section-title { background: #f1f5f9; padding: 10px 15px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em; }
                th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                .footer { margin-top: 50px; font-size: 0.8em; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo">AUDIT PLAN</div>
                    <div>Ref: P-${plan.id}</div>
                </div>
                <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
            </div>

            <table class="meta-table">
                <tr>
                    <td><span class="meta-label">Client</span>${plan.client}</td>
                    <td><span class="meta-label">Audit Standard</span>${plan.standard}</td>
                </tr>
                <tr>
                    <td><span class="meta-label">Planned Date</span>${plan.date}</td>
                    <td><span class="meta-label">Audit Type</span>${plan.type}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Lead Auditor</span>${(plan.team || [])[0] || '-'}</td>
                    <td><span class="meta-label">Audit Team</span>${(plan.team || []).slice(1).join(', ') || 'None'}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Total Man-Days</span>${plan.manDays} days (${plan.onsiteDays} onsite)</td>
                    <td><span class="meta-label">Risk Level</span>Medium (Standard)</td>
                </tr>
            </table>

            <div class="section-title">AUDIT SCOPE & MAN-DAYS DISTRIBUTION</div>
            <table>
                <thead>
                    <tr>
                        <th>Site Name</th>
                        <th>Address</th>
                        <th style="text-align: right;">Employees</th>
                        <th style="text-align: right;">Allocated Man-Days</th>
                    </tr>
                </thead>
                <tbody>
                    ${siteDetails.map(site => {
        // Calculate proportional man-days
        // If total employees is 0 (missing data), split evenly
        let allocatedDays = 0;
        if (totalEmployees > 0) {
            allocatedDays = (site.employees / totalEmployees) * plan.manDays;
        } else {
            allocatedDays = plan.manDays / siteDetails.length;
        }
        return `
                        <tr>
                            <td>${site.name} ${site.geotag ? '<span style="font-size:0.8em; color:#64748b;">(GPS)</span>' : ''}</td>
                            <td>${site.address || '-'}</td>
                            <td style="text-align: right;">${site.employees}</td>
                            <td style="text-align: right; font-weight: bold;">${allocatedDays.toFixed(2)}</td>
                        </tr>
                        `;
    }).join('')}
                    <tr style="background: #f8fafc; font-weight: bold;">
                        <td colspan="2">TOTAL</td>
                        <td style="text-align: right;">${totalEmployees}</td>
                        <td style="text-align: right;">${plan.manDays.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title">AUDIT OBJECTIVES</div>
            <ul style="margin-top: 0; padding-left: 20px; color: #333;">
                <li>Determine conformity of the management system with audit criteria.</li>
                <li>Evaluate the ability of the management system to ensure likely compliance with statutory, regulatory and contractual requirements.</li>
                <li>Evaluate the effectiveness of the management system in meeting its specified objectives.</li>
                <li>Identify areas for potential improvement.</li>
            </ul>

            <div class="footer">
                Generated by AuditCB • ${new Date().toLocaleString()} • Page 1 of 1
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    const printWin = window.open('', '', 'width=900,height=800');
    printWin.document.write(content);
    printWin.document.close();
};

window.printAuditPlan = function (planId) {
    const plan = state.auditPlans.find(p => p.id == planId);
    if (!plan) return;
    const report = (state.auditReports || []).find(r => r.planId === planId);
    const checklists = state.checklists || [];
    const planChecklists = plan.selectedChecklists || [];

    // Map progress
    const progressMap = {};
    if (report && report.checklistProgress) {
        report.checklistProgress.forEach(p => progressMap[`${p.checklistId} -${p.itemIdx} `] = p);
    }

    const statusText = { 'conform': 'Conform', 'minor': 'Minor NC', 'major': 'Major NC', 'na': 'N/A', '': 'Not Checked' };
    const statusColor = { 'conform': 'green', 'minor': 'orange', 'major': 'red', 'na': 'gray', '': 'black' };

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`PLAN-${plan.id}|${plan.client}|${plan.date}`)}`;

    let content = `
        <html>
        <head>
            <title>Audit Checklist Report - ${plan.client}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; -webkit-print-color-adjust: exact; padding: 20px; }
                .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #333; padding-bottom: 1rem; position: relative; }
                .section { margin-bottom: 2rem; page-break-inside: avoid; }
                h2 { background: #f2f2f2; padding: 0.5rem; border-left: 5px solid #333; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f8f8f8; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <div style="position: absolute; top: 0; right: 0;">
                    <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
                </div>
                <h1>Audit Checklist Execution Report</h1>
                <p><strong>Client:</strong> ${plan.client} | <strong>Standard:</strong> ${plan.standard} | <strong>Date:</strong> ${plan.date}</p>
                <p><strong>Auditor(s):</strong> ${plan.team.join(', ')} | <strong>Status:</strong> ${report ? 'Finalized' : 'In Progress'}</p>
            </div>
    `;

    planChecklists.forEach(clId => {
        const cl = checklists.find(c => c.id === clId);
        if (!cl) return;

        content += `
            <div class="section">
                <h2>${cl.name}</h2>
                <table>
                    <thead>
                        <tr>
                            <th width="10%">Clause</th>
                            <th width="40%">Requirement</th>
                            <th width="15%">Status</th>
                            <th width="35%">Auditor Comments / Evidence</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (cl.items) {
            cl.items.forEach((item, idx) => {
                const key = `${cl.id}-${idx}`;
                const prog = progressMap[key] || {};
                const s = prog.status || '';
                const c = prog.comment || '-';

                content += `
                    <tr>
                        <td>${item.clause || ''}</td>
                        <td>${item.requirement || ''}</td>
                        <td style="color: ${statusColor[s]}; font-weight: bold;">${statusText[s]}</td>
                        <td>${c}</td>
                    </tr>
                `;
            });
        }

        content += `</tbody></table></div>`;
    });

    if (report && report.ncrs && report.ncrs.length > 0) {
        content += `<div class="section"><h2>Audit Findings (NCRs)</h2><ul>`;
        report.ncrs.forEach(ncr => {
            content += `<li><strong>${ncr.type} (${ncr.clause}):</strong> ${ncr.description}</li>`;
        });
        content += `</ul></div>`;
    }

    content += `
        <div style="margin-top: 3rem; text-align: center; font-size: 0.8rem; color: #777; border-top: 1px solid #ddd; padding-top: 1rem;">
            Generated by AuditCB360 on ${new Date().toLocaleDateString()}
        </div>
        </body></html>
    `;

    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    // setTimeout(() => win.print(), 500); // Allow render
};

window.closeAuditPlan = function (planId) {
    const plan = state.auditPlans.find(p => p.id === planId);
    if (!plan) return;

    if (confirm('Are you sure you want to close this audit? This represents the completion of the audit cycle and issuance of the certificate.')) {
        plan.status = 'Completed';
        window.saveData();
        viewAuditPlan(planId);
        window.showNotification('Audit closed and certificate issued successfully.');
    }
};

// Checklist Selection Modal for Audit Plan
function openChecklistSelectionModal(planId) {
    const plan = state.auditPlans.find(p => p.id === planId);
    if (!plan) return;

    const checklists = state.checklists || [];
    const matchingChecklists = checklists.filter(c => c.standard === plan.standard);
    const globalChecklists = matchingChecklists.filter(c => c.type === 'global');
    const customChecklists = matchingChecklists.filter(c => c.type === 'custom');
    const selectedIds = plan.selectedChecklists || [];

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Configure Checklists for Audit';
    modalBody.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin: 0;">
                Select checklists to use during this audit. Only checklists matching <strong>${plan.standard}</strong> are shown.
            </p>
        </div>

        <!-- Global Checklists -->
        <div style="margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 0.75rem;">
                <i class="fa-solid fa-globe" style="color: #0369a1; margin-right: 0.5rem;"></i>
                Global Checklists (${globalChecklists.length})
            </h4>
            ${globalChecklists.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
                    ${globalChecklists.map(cl => `
                        <label style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; text-align: left; gap: 1rem; padding: 1rem; background: #fff; border-radius: var(--radius-md); cursor: pointer; border: 1px solid ${selectedIds.includes(cl.id) ? 'var(--primary-color)' : 'var(--border-color)'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <input type="checkbox" class="checklist-select-cb" data-id="${cl.id}" ${selectedIds.includes(cl.id) ? 'checked' : ''} style="margin: 0; min-width: 18px; min-height: 18px; cursor: pointer;">
                            <div style="flex: 1; text-align: left;">
                                <p style="font-weight: 600; margin: 0; color: var(--text-primary);">${cl.name}</p>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0 0;">${cl.items?.length || 0} items</p>
                            </div>
                        </label>
                    `).join('')}
                </div>
            ` : '<p style="color: var(--text-secondary); padding: 0.5rem;">No global checklists available for this standard.</p>'}
        </div>

        <!-- Custom Checklists -->
        <div>
            <h4 style="margin-bottom: 0.75rem;">
                <i class="fa-solid fa-user" style="color: #059669; margin-right: 0.5rem;"></i>
                Custom Checklists (${customChecklists.length})
            </h4>
            ${customChecklists.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
                    ${customChecklists.map(cl => `
                        <label style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; text-align: left; gap: 1rem; padding: 1rem; background: #fff; border-radius: var(--radius-md); cursor: pointer; border: 1px solid ${selectedIds.includes(cl.id) ? 'var(--primary-color)' : 'var(--border-color)'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <input type="checkbox" class="checklist-select-cb" data-id="${cl.id}" ${selectedIds.includes(cl.id) ? 'checked' : ''} style="margin: 0; min-width: 18px; min-height: 18px; cursor: pointer;">
                            <div style="flex: 1; text-align: left;">
                                <p style="font-weight: 600; margin: 0; color: var(--text-primary);">${cl.name}</p>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0 0;">${cl.items?.length || 0} items • by ${cl.createdBy || 'Unknown'}</p>
                            </div>
                        </label>
                    `).join('')}
                </div>
            ` : '<p style="color: var(--text-secondary); padding: 0.5rem;">No custom checklists available. <a href="#" onclick="window.renderModule(\'checklists\'); window.closeModal();">Create one</a></p>'}
        </div>

        <div id="checklist-selection-summary" style="margin-top: 1rem; padding: 0.75rem; background: #e0f2fe; border-radius: var(--radius-md); text-align: center;">
            <strong>${selectedIds.length}</strong> checklist(s) selected
        </div>
    `;

    window.openModal();

    // Update summary on checkbox change
    document.querySelectorAll('.checklist-select-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const count = document.querySelectorAll('.checklist-select-cb:checked').length;
            document.getElementById('checklist-selection-summary').innerHTML = `<strong>${count}</strong> checklist(s) selected`;
        });
    });

    modalSave.onclick = () => {
        const selected = [];
        document.querySelectorAll('.checklist-select-cb:checked').forEach(cb => {
            selected.push(parseInt(cb.getAttribute('data-id')));
        });

        plan.selectedChecklists = selected;
        window.saveData();
        window.closeModal();
        viewAuditPlan(planId);
        window.showNotification(`${selected.length} checklist(s) assigned to this audit plan`);
    };
}

// Export functions
window.renderAuditPlanningEnhanced = renderAuditPlanningEnhanced;
window.openCreatePlanModal = openCreatePlanModal;
window.autoCalculateDays = autoCalculateDays;
window.updateClientDetails = updateClientDetails;
window.saveAuditPlan = saveAuditPlan;
window.editAuditPlan = editAuditPlan;
window.viewAuditPlan = viewAuditPlan;
window.openChecklistSelectionModal = openChecklistSelectionModal;

window.printAuditPlanDetails = function (planId) {
    const plan = state.auditPlans.find(p => p.id == planId);
    if (!plan) return;

    const client = state.clients.find(c => c.name === plan.client);

    // Resolve team names
    const teamNames = ((plan.team && Array.isArray(plan.team))
        ? plan.team
        : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown'));

    const leadAuditor = teamNames[0] || 'Unknown';
    const otherMembers = teamNames.slice(1);

    // Calculate breakdowns
    let totalEmployees = 0;
    const siteDetails = (plan.selectedSites || []).map(s => {
        const siteData = (client?.sites || []).find(cs => cs.name === s.name);
        const emps = siteData?.employees || 0;
        totalEmployees += emps;
        return { ...s, employees: emps, address: siteData?.address || '' };
    });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`PLAN-${plan.id}|${plan.client}|${plan.date}`)}`;

    let content = `
        <html>
        <head>
            <title>Audit Plan - ${plan.client}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; padding: 40px; }
                .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                .logo { font-size: 24px; font-weight: bold; color: #0f172a; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .meta-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; width: 50%; vertical-align: top; }
                .meta-label { font-weight: bold; color: #64748b; font-size: 0.9em; display: block; margin-bottom: 4px; }
                .section-title { background: #f1f5f9; padding: 10px 15px; font-weight: bold; margin-bottom: 15px; border-left: 4px solid #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9em; }
                th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                .footer { margin-top: 50px; font-size: 0.8em; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo">AUDIT PLAN</div>
                    <div>Ref: P-${plan.id}</div>
                </div>
                <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
            </div>

            <table class="meta-table">
                <tr>
                    <td><span class="meta-label">Client</span>${plan.client}</td>
                    <td><span class="meta-label">Audit Standard</span>${plan.standard}</td>
                </tr>
                <tr>
                    <td><span class="meta-label">Planned Date</span>${plan.date}</td>
                    <td><span class="meta-label">Audit Type</span>${plan.type}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Lead Auditor</span>${leadAuditor}</td>
                    <td><span class="meta-label">Audit Team</span>${otherMembers.join(', ') || 'None'}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Total Man-Days</span>${plan.manDays} days (${plan.onsiteDays} onsite)</td>
                    <td><span class="meta-label">Risk Level</span>Medium (Standard)</td>
                </tr>
            </table>

            <div class="section-title">AUDIT SCOPE, MAN-DAYS & ALLOCATION</div>
            <table>
                <thead>
                    <tr>
                        <th>Site Name</th>
                        <th>Address</th>
                        <th style="text-align: right;">Employees</th>
                        <th style="text-align: right;">Auditor(s)</th>
                        <th style="text-align: right;">Days</th>
                    </tr>
                </thead>
                <tbody>
                    ${siteDetails.map((site, index) => {
        let allocatedDays = 0;
        if (totalEmployees > 0) {
            allocatedDays = (site.employees / totalEmployees) * plan.manDays;
        } else {
            allocatedDays = plan.manDays / siteDetails.length;
        }

        // Simple distribution logic: Lead Auditor on first/largest site, others distributed
        const auditorAssigned = index === 0 ? `<b>${leadAuditor}</b>` : (otherMembers[index - 1] || 'Assigned Team');

        return `
                        <tr>
                            <td>${site.name} ${site.geotag ? '<span style="font-size:0.8em; color:#64748b;">(GPS)</span>' : ''}</td>
                            <td>${site.address || '-'}</td>
                            <td style="text-align: right;">${site.employees}</td>
                            <td style="text-align: right;">${auditorAssigned}</td>
                            <td style="text-align: right; font-weight: bold;">${allocatedDays.toFixed(2)}</td>
                        </tr>
                        `;
    }).join('')}
                    <tr style="background: #f8fafc; font-weight: bold;">
                        <td colspan="2">TOTAL</td>
                        <td style="text-align: right;">${totalEmployees}</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right;">${plan.manDays.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title">AUDIT OBJECTIVES</div>
            <ul style="margin-top: 0; padding-left: 20px; color: #333;">
                <li>Determine conformity of the management system with audit criteria.</li>
                <li>Evaluate the ability of the management system to ensure likely compliance with statutory, regulatory and contractual requirements.</li>
                <li>Evaluate the effectiveness of the management system in meeting its specified objectives.</li>
                <li>Identify areas for potential improvement.</li>
            </ul>

            <div class="footer">
                Generated by AuditCB • ${new Date().toLocaleString()} • Page 1 of 1
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    const printWin = window.open('', '', 'width=900,height=800');
    printWin.document.write(content);
    printWin.document.close();
};


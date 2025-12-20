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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Audit Planning <span style="font-size: 0.8rem; color: var(--text-secondary);">(v5.1)</span></h2>
            </div>
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
                <button id="btn-create-plan" class="btn btn-primary">
                    <i class="fa-solid fa-plus"></i> Create Audit Plan
                </button>
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

                <!-- Standard -->
                <div class="form-group">
                    <label>Audit Standard</label>
                    <select class="form-control" id="plan-standard">
                        <option value="ISO 9001:2015">ISO 9001:2015</option>
                        <option value="ISO 14001:2015">ISO 14001:2015</option>
                        <option value="ISO 45001:2018">ISO 45001:2018</option>
                        <option value="ISO 27001:2022">ISO 27001:2022</option>
                    </select>
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
        document.getElementById('plan-standard').value = plan.standard || '';
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
            const updatedStandard = document.getElementById('plan-standard').value;
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
            if (stdSelect) stdSelect.value = client.standard;
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
                        <input type="checkbox" class="site-checkbox" data-name="${s.name}" data-geotag="${s.geotag || ''}" data-employees="${s.employees || 0}" checked style="margin-top: 3px;">
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
    const employees = parseInt(document.getElementById('plan-employees').value) || 0;
    const risk = document.getElementById('plan-risk').value || 'Medium';

    // Ensure the helper function exists (it's in advanced-modules.js, make sure it's loaded)
    if (typeof calculateManDays !== 'function') {
        // Simple fallback if advanced-module isn't loaded/exposed
        console.warn('Advanced Man-Day Calculator not found, using simple fallback');
        const simpleDays = employees < 50 ? 2 : employees < 500 ? 5 : 10;
        document.getElementById('plan-mandays').value = simpleDays;
        document.getElementById('plan-onsite-days').value = simpleDays * 0.8;
        return;
    }

    if (employees > 0) {
        // Signature: calculateManDays(employees, reductionFactor, sites, shiftWork, riskLevel)
        // Assume default reduction (1) and shiftWork (false) for now unless added to UI
        const results = calculateManDays(employees, 1, 1, false, risk);

        const type = document.getElementById('plan-type').value;
        let days = 0;

        if (type === 'Stage 1') days = results.stage1;
        else if (type === 'Stage 2') days = results.stage2;
        else days = results.surveillance; // Default

        document.getElementById('plan-mandays').value = days.toFixed(2);
        document.getElementById('plan-onsite-days').value = (days * 0.8).toFixed(2);

        window.showNotification(`Calculated ${days.toFixed(2)} days based on ${employees} employees.`, 'success');
    } else {
        window.showNotification('Please enter number of employees', 'warning');
    }
}

function saveAuditPlan() {
    const client = document.getElementById('plan-client').value;
    const date = document.getElementById('plan-date').value;
    const lead = document.getElementById('plan-lead-auditor').value;
    const type = document.getElementById('plan-type').value;
    const standard = document.getElementById('plan-standard').value;
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

    const html = `
    <div class="fade-in">
            <!--Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <button class="btn btn-secondary" onclick="renderAuditPlanningEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back
                </button>
                <div style="display: flex; gap: 1rem;">
                     ${report ? `<button class="btn btn-secondary" onclick="printAuditPlan(${plan.id})"><i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print Checklist</button>` : ''}
                     <button class="btn btn-primary" onclick="editAuditPlan(${plan.id})"><i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit Plan</button>
                </div>
            </div>

            <!--Title & Status-- >
            <div style="margin-bottom: 2rem;">
                 <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">${plan.client} <span style="font-weight: 300; color: var(--text-secondary);">Audit Plan</span></h2>
                 <div style="display: flex; gap: 1rem; align-items: center;">
                    <span class="status-badge status-${plan.status.toLowerCase()}">${plan.status}</span>
                    <span style="color: var(--text-secondary);"><i class="fa-solid fa-calendar" style="margin-right: 0.25rem;"></i> ${plan.date}</span>
                    <span style="color: var(--text-secondary);"><i class="fa-solid fa-book" style="margin-right: 0.25rem;"></i> ${plan.standard}</span>
                 </div>
            </div>

            <!--Progress Bar-- >
            <div class="card" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>Audit Progress</strong>
                    <strong>${progress}%</strong>
                </div>
                <div style="height: 1.5rem; background: #e2e8f0; border-radius: 1rem; overflow: hidden;">
                    <div style="width: ${progress}%; background: linear-gradient(90deg, var(--primary-color), var(--secondary-color)); height: 100%; transition: width 0.5s ease; text-align: center; color: white; font-size: 0.8rem; line-height: 1.5rem;">${progress > 5 ? progress + '%' : ''}</div>
                </div>
                <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.25rem;"></i> ${completedItems} / ${totalItems} checklist items verified
                </p>
            </div>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                
                <!-- Left Column Main Content -->
                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    
                    <!-- Configuration Checklist Block -->
                    <div class="card">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;"><i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Configuration Checklists</h3>
                            <div>
                                <button class="btn btn-sm btn-outline-primary" style="margin-right: 0.5rem;" onclick="window.printAuditPlan('${plan.id}')">
                                    <i class="fa-solid fa-print"></i> Print
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="openChecklistSelectionModal(${plan.id})">
                                    <i class="fa-solid fa-cog" style="margin-right: 0.25rem;"></i> Configure
                                </button>
                            </div>
                        </div>
                        ${checklistListHTML}
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                            <strong>${totalItems}</strong> total items assigned
                        </div>
                    </div>

                    <!-- Execution Block -->
                    <div class="card" style="border-left: 5px solid var(--success-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                             <h3 style="margin: 0;"><i class="fa-solid fa-play" style="margin-right: 0.5rem; color: var(--success-color);"></i> Audit Execution</h3>
                        </div>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Manage the execution phase, verify checklists, raise NCRs, and collect evidence.</p>
                        <button class="btn btn-primary" style="width: 100%;" onclick="window.renderModule('audit-execution')">
                            Go to Execution Panel <i class="fa-solid fa-arrow-right" style="margin-left: 0.5rem;"></i>
                        </button>
                    </div>
                    
                    <!-- Reporting Block -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-file-lines" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Reporting</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: var(--radius-md);">
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--danger-color);">${report?.ncrs?.length || 0}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">NCRs Raised</div>
                            </div>
                             <div style="text-align: center; padding: 1rem; background: #f8fafc; border-radius: var(--radius-md);">
                                <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning-color);">${report?.capas?.length || 0}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">CAPAs Required</div>
                            </div>
                        </div>
                         <div style="padding: 1rem; background: #f1f5f9; border-radius: var(--radius-md);">
                            <strong>Final Conclusion:</strong>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-style: italic;">
                                ${report?.conclusion || 'No conclusion finalized yet.'}
                            </p>
                        </div>
                    </div>

                    <!-- Closing Block -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-check-double" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Closing</h3>
                         ${plan.status === 'Completed' ? `
                            <div style="padding: 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); text-align: center;">
                                <i class="fa-solid fa-certificate" style="font-size: 2rem; color: var(--success-color); margin-bottom: 0.5rem;"></i>
                                <h4 style="margin: 0; color: var(--success-color);">Audit Closed Successfully</h4>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Certificate Issued on ${plan.date}</p>
                                <button class="btn btn-sm btn-outline-primary" onclick="window.showNotification('Certificate generated (mock)')">
                                    <i class="fa-solid fa-file-pdf"></i> View Certificate
                                </button>
                            </div>
                        ` : `
                            <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
                                    ${report?.status === 'Finalized'
            ? 'Audit report is finalized. Ready to close audit.'
            : 'Waiting for report finalization.'}
                                </p>
                                <button class="btn btn-success" ${report?.status !== 'Finalized' ? 'disabled' : ''} onclick="closeAuditPlan(${plan.id})">
                                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem;"></i> Close Audit Loop
                                </button>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Right Column Side Info -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                     <!-- Client Info -->
                     <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-building" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Client</h3>
                        <p style="margin-bottom: 0.5rem;"><strong>${client?.name}</strong></p>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.5rem;">
                            <div><i class="fa-solid fa-industry" style="width: 20px;"></i> ${client?.industry || '-'}</div>
                            <div><i class="fa-solid fa-users" style="width: 20px;"></i> ${client?.employees || 0} employees</div>
                            <div><i class="fa-solid fa-map-marker-alt" style="width: 20px;"></i> ${client?.sites?.length || 1} sites total</div>
                        </div>
                     </div>

                     <!-- Audit Sites (Scope) -->
                     <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-location-dot" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Sites <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary);">(in scope)</span></h3>
                        ${(plan.selectedSites && plan.selectedSites.length > 0) ? `
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${plan.selectedSites.map(site => `
                                    <div style="padding: 0.5rem; background: #f8fafc; border-radius: var(--radius-sm); border-left: 3px solid var(--primary-color);">
                                        <div style="font-weight: 500; font-size: 0.9rem;">${site.name}</div>
                                        ${site.geotag ? `<div style="font-size: 0.75rem; color: #0369a1;"><i class="fa-solid fa-map-pin"></i> GPS: ${site.geotag}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            <div style="margin-top: 0.75rem; padding: 0.5rem; background: #e0f2fe; border-radius: var(--radius-sm); text-align: center; font-size: 0.85rem;">
                                <strong>${plan.selectedSites.length}</strong> site(s) in audit scope
                            </div>
                        ` : `
                            <p style="color: var(--text-secondary); font-style: italic; margin: 0;">All sites (legacy plan)</p>
                        `}
                     </div>

                     <!-- Audit Team -->
                     <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-users-gear" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Team</h3>
                         <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${((plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown')).map((m, i) => `
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="width: 30px; height: 30px; background: ${i === 0 ? 'var(--primary-color)' : '#e2e8f0'}; color: ${i === 0 ? 'white' : 'var(--text-secondary)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                                        <i class="fa-solid fa-user"></i>
                                    </div>
                                    <span style="font-size: 0.9rem;">${m}</span>
                                    ${i === 0 ? '<span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: auto;">Lead Auditor</span>' : ''}
                                </div>
                            `).join('')}
                         </div>
                     </div>
                </div>

            </div>
        </div >
    `;
    window.contentArea.innerHTML = html;
}

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
                        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); cursor: pointer; border: 2px solid ${selectedIds.includes(cl.id) ? 'var(--primary-color)' : 'transparent'};">
                            <input type="checkbox" class="checklist-select-cb" data-id="${cl.id}" ${selectedIds.includes(cl.id) ? 'checked' : ''}>
                            <div style="flex: 1;">
                                <p style="font-weight: 500; margin: 0;">${cl.name}</p>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${cl.items?.length || 0} items</p>
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
                        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); cursor: pointer; border: 2px solid ${selectedIds.includes(cl.id) ? 'var(--primary-color)' : 'transparent'};">
                            <input type="checkbox" class="checklist-select-cb" data-id="${cl.id}" ${selectedIds.includes(cl.id) ? 'checked' : ''}>
                            <div style="flex: 1;">
                                <p style="font-weight: 500; margin: 0;">${cl.name}</p>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${cl.items?.length || 0} items • by ${cl.createdBy || 'Unknown'}</p>
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


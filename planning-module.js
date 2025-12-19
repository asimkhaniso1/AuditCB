// ============================================
// AUDIT PLANNING MODULE
// ============================================

function renderAuditPlanningEnhanced() {
    const state = window.state;
    const searchTerm = state.planningSearchTerm || '';

    let filteredPlans = state.auditPlans.filter(plan => {
        return plan.client.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const rows = filteredPlans.map(plan => `
        <tr class="plan-row" style="cursor: pointer;">
            <td>
                <div style="font-weight: 500;">${plan.client}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${plan.standard || 'ISO 9001:2015'}</div>
            </td>
            <td>${plan.type || 'Surveillance'}</td>
            <td>${plan.date}</td>
            <td>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${plan.team.map(auditor => `
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
                <button class="btn btn-sm view-plan-btn" data-plan-id="${plan.id}" title="View Details">
                    <i class="fa-solid fa-eye" style="color: var(--text-secondary);"></i>
                </button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="plan-search" placeholder="Search audit plans..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="plan-filter" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all">All Status</option>
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                    </select>
                </div>
                <button id="btn-create-plan" class="btn btn-primary">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create Audit Plan
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

    contentArea.innerHTML = html;

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

                <!-- Site Selection -->
                <div class="form-group">
                    <label>Audit Site</label>
                    <select class="form-control" id="plan-site-select" style="display: none;">
                        <option value="">-- Select Site --</option>
                    </select>
                    <small style="color: var(--text-secondary);">Site to audit (for multi-site clients)</small>
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
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i> Audit Duration
                    </h4>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="autoCalculateDays()">
                        Auto-Calculate
                    </button>
                </div>
                
                <!-- Calculation Parameters (Hidden or Visible) -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.8rem;">Employees</label>
                        <input type="number" class="form-control" id="plan-employees" placeholder="Count">
                    </div>
                     <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.8rem;">Sites</label>
                        <input type="number" class="form-control" id="plan-sites" value="1">
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

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">Total Man-Days</label>
                        <input type="number" class="form-control" id="plan-mandays" step="0.5" placeholder="0.0">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">On-Site Days</label>
                        <input type="number" class="form-control" id="plan-onsite-days" step="0.5" placeholder="0.0">
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

        // Handle Lead Auditor
        const lead = plan.team[0];
        document.getElementById('plan-lead-auditor').value = lead;

        // Handle Team Members
        const teamSelect = document.getElementById('plan-team');
        const teamMembers = plan.team.slice(1);
        Array.from(teamSelect.options).forEach(option => {
            option.selected = teamMembers.includes(option.value);
        });

        // Update save handler to update instead of create
        document.getElementById('modal-save').onclick = () => {
            const updatedClient = document.getElementById('plan-client').value;
            const updatedDate = document.getElementById('plan-date').value;
            const updatedLead = document.getElementById('plan-lead-auditor').value;
            const updatedType = document.getElementById('plan-type').value;
            const updatedStandard = document.getElementById('plan-standard').value;

            const teamSelect = document.getElementById('plan-team');
            const updatedTeam = Array.from(teamSelect.selectedOptions).map(option => option.value);
            if (updatedLead) updatedTeam.unshift(updatedLead);

            if (updatedClient && updatedDate && updatedLead) {
                plan.client = updatedClient;
                plan.date = updatedDate;
                plan.type = updatedType;
                plan.standard = updatedStandard;
                plan.team = updatedTeam;

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

        // Populate site selection dropdown if exists
        const siteSelect = document.getElementById('plan-site-select');
        if (siteSelect && client.sites && client.sites.length > 0) {
            siteSelect.innerHTML = client.sites.map((s, i) =>
                `<option value="${i}">${s.name} - ${s.city || 'N/A'}</option>`
            ).join('');
            siteSelect.style.display = 'block';
        }

        // Show client info panel
        const clientInfoPanel = document.getElementById('client-info-panel');
        if (clientInfoPanel) {
            const primaryContact = (client.contacts && client.contacts[0]) || {};
            clientInfoPanel.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
                    <div><strong>Industry:</strong> ${client.industry || '-'}</div>
                    <div><strong>Employees:</strong> ${client.employees || 0}</div>
                    <div><strong>Sites:</strong> ${sitesCount}</div>
                    <div><strong>Shifts:</strong> ${client.shifts || 'No'}</div>
                    <div><strong>Contact:</strong> ${primaryContact.name || '-'} (${primaryContact.designation || ''})</div>
                    <div><strong>Website:</strong> ${client.website ? `<a href="${client.website}" target="_blank">${client.website}</a>` : '-'}</div>
                </div>
            `;
            clientInfoPanel.style.display = 'block';
        }

        // Trigger calculation automatically if we have data
        if (client.employees && window.calculateManDays) {
            autoCalculateDays();
        }
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
    const plan = state.auditPlans.find(p => p.id === id);
    if (!plan) return;

    const client = state.clients.find(c => c.name === plan.client);
    const checklists = state.checklists || [];
    const planChecklists = plan.selectedChecklists || [];

    // Filter checklists by plan's standard
    const matchingChecklists = checklists.filter(c => c.standard === plan.standard);
    const globalChecklists = matchingChecklists.filter(c => c.type === 'global');
    const customChecklists = matchingChecklists.filter(c => c.type === 'custom');

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditPlanningEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Planning
                </button>
            </div>

            <!-- Plan Header -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${plan.client}</h2>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                            <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">${plan.standard}</span>
                            <span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">${plan.type}</span>
                            <span class="status-badge status-${plan.status.toLowerCase()}">${plan.status}</span>
                        </div>
                        <p style="color: var(--text-secondary); margin: 0;">
                            <i class="fa-solid fa-calendar" style="margin-right: 0.25rem;"></i> ${plan.date}
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="editAuditPlan(${plan.id})">
                            <i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit Plan
                        </button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <!-- Left Column -->
                <div>
                    <!-- Client Info -->
                    ${client ? `
                        <div class="card" style="margin-bottom: 1.5rem;">
                            <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-building" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Client Information</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.9rem;">
                                <div><strong>Industry:</strong> ${client.industry || '-'}</div>
                                <div><strong>Employees:</strong> ${client.employees || 0}</div>
                                <div><strong>Sites:</strong> ${(client.sites && client.sites.length) || 1}</div>
                                <div><strong>Shifts:</strong> ${client.shifts || 'No'}</div>
                                ${client.website ? `<div style="grid-column: 1 / -1;"><strong>Website:</strong> <a href="${client.website}" target="_blank">${client.website}</a></div>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Audit Team -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-users" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Audit Team</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${plan.team.map((member, idx) => `
                                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: #f8fafc; border-radius: var(--radius-md);">
                                    <div style="width: 40px; height: 40px; background: ${idx === 0 ? 'var(--primary-color)' : '#e2e8f0'}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa-solid fa-user" style="color: ${idx === 0 ? 'white' : 'var(--text-secondary)'};"></i>
                                    </div>
                                    <div>
                                        <p style="font-weight: 500; margin: 0;">${member}</p>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${idx === 0 ? 'Lead Auditor' : 'Team Member'}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Right Column - Checklists -->
                <div>
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">
                                <i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                                Assigned Checklists
                            </h3>
                            <button class="btn btn-sm btn-secondary" onclick="openChecklistSelectionModal(${plan.id})">
                                <i class="fa-solid fa-cog" style="margin-right: 0.25rem;"></i> Configure
                            </button>
                        </div>

                        ${planChecklists.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${planChecklists.map(clId => {
        const cl = checklists.find(c => c.id === clId);
        if (!cl) return '';
        return `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); border-left: 3px solid ${cl.type === 'global' ? '#0369a1' : '#059669'};">
                                            <div>
                                                <p style="font-weight: 500; margin: 0;">${cl.name}</p>
                                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${cl.items?.length || 0} items • ${cl.type === 'global' ? 'Global' : 'Custom'}</p>
                                            </div>
                                            <button class="btn btn-sm" onclick="viewChecklistDetail(${cl.id})">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                        </div>
                                    `;
    }).join('')}
                            </div>
                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center;">
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">
                                    <strong>${planChecklists.reduce((sum, clId) => {
        const cl = checklists.find(c => c.id === clId);
        return sum + (cl?.items?.length || 0);
    }, 0)}</strong> total checklist items
                                </p>
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: var(--radius-md);">
                                <i class="fa-solid fa-clipboard-list" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
                                <p style="color: var(--text-secondary); margin: 0;">No checklists assigned yet.</p>
                                <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="openChecklistSelectionModal(${plan.id})">
                                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Assign Checklists
                                </button>
                            </div>
                        `}

                        <!-- Available Checklists Info -->
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                                <i class="fa-solid fa-info-circle" style="margin-right: 0.25rem;"></i>
                                ${matchingChecklists.length} checklists available for ${plan.standard}
                                (${globalChecklists.length} global, ${customChecklists.length} custom)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;
}

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

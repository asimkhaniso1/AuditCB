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
                        ${state.clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
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
    // Mock functionality: In a real app, this would fetch client details like employee count to help with calculation
    const client = state.clients.find(c => c.name === clientName);
    if (client) {
        // Auto-select standard if available in client data (mock)
        // document.getElementById('plan-standard').value = client.standard || 'ISO 9001:2015';
    }
}

function autoCalculateDays() {
    // Mock integration: In a real app, this would use the client's employee count
    // For now, we'll simulate a calculation based on a prompt or default
    const employees = prompt("Enter number of employees for calculation:", "100");
    if (employees) {
        const results = calculateManDays(parseInt(employees), 1, 2, false, 'Medium');

        const type = document.getElementById('plan-type').value;
        let days = 0;

        if (type === 'Stage 1') days = results.stage1;
        else if (type === 'Stage 2') days = results.stage2;
        else days = results.surveillance;

        document.getElementById('plan-mandays').value = days;
        document.getElementById('plan-onsite-days').value = Math.max(1, days * 0.8).toFixed(1); // Assume 80% onsite

        window.showNotification(`Calculated ${days} man-days based on ${employees} employees.`, 'success');
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
    window.showNotification('View details functionality coming soon.', 'info');
}

// Export functions
window.renderAuditPlanningEnhanced = renderAuditPlanningEnhanced;
window.openCreatePlanModal = openCreatePlanModal;
window.autoCalculateDays = autoCalculateDays;
window.updateClientDetails = updateClientDetails;
window.saveAuditPlan = saveAuditPlan;
window.editAuditPlan = editAuditPlan;
window.viewAuditPlan = viewAuditPlan;

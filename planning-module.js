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

    let filteredPlans = window.getVisiblePlans().filter(plan => {
        return plan.client.toLowerCase().includes(searchTerm.toLowerCase());
    });


    // Permission Check
    const userRole = (window.state.currentUser?.role || 'Auditor').trim().toLowerCase();
    const isManager = ['admin', 'certification manager', 'manager', 'lead auditor'].includes(userRole) || window.state.settings?.isAdmin === true;

    const rows = filteredPlans.map(plan => `
        <tr class="plan-row" style="cursor: pointer;">
            <td>
                <a href="javascript:void(0)" onclick="window.viewAuditPlan('${plan.id}')" style="font-weight: 500; color: var(--primary-color); text-decoration: none;">${window.UTILS.escapeHtml(plan.client)}</a>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(plan.standard) || 'ISO 9001:2015'}</div>
            </td>
            <td>${window.UTILS.escapeHtml(plan.type) || 'Surveillance'}</td>
            <td>${window.UTILS.escapeHtml(plan.date)}</td>
            <td>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${((plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown')).map(auditor => `
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                            <i class="fa-solid fa-user" style="font-size: 0.7rem; color: var(--text-secondary); margin-right: 4px;"></i>${window.UTILS.escapeHtml(auditor)}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td><span class="status-badge status-${(plan.status || 'draft').toLowerCase()}">${window.UTILS.escapeHtml(plan.status)}</span></td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    ${isManager ? `<button class="btn btn-sm edit-plan-btn" data-plan-id="${plan.id}" title="Edit Plan">
                        <i class="fa-solid fa-pen" style="color: var(--primary-color);"></i>
                    </button>` : ''}
                    <button class="btn btn-sm" onclick="window.viewAuditPlan('${plan.id}')" title="View Details">
                        <i class="fa-solid fa-eye" style="color: var(--text-secondary);"></i>
                    </button>
                    ${isManager ? `<button class="btn btn-sm delete-plan-btn" data-plan-id="${plan.id}" title="Delete Plan">
                        <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Audit Planning <span style="font-size: 0.8rem; color: var(--text-secondary);">(v5.2)</span></h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="togglePlanningAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showPlanningAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showPlanningAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    ${isManager ? `<button id="btn-create-plan" class="btn btn-primary">
                        <i class="fa-solid fa-plus"></i> Create Audit Plan
                    </button>` : ''}
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
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisiblePlans().length}</div>
                    </div>
                </div>

                <!-- Drafts -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-pencil"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Drafts</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisiblePlans().filter(p => p.status === 'Draft').length}</div>
                    </div>
                </div>

                 <!-- Confirmed/Scheduled -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                         <i class="fa-solid fa-clock"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Scheduled</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisiblePlans().filter(p => p.status === 'Confirmed').length}</div>
                    </div>
                </div>

                 <!-- Completed -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                         <i class="fa-solid fa-check-double"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Completed</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${window.getVisiblePlans().filter(p => p.status === 'Completed').length}</div>
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
    document.getElementById('btn-create-plan')?.addEventListener('click', renderCreateAuditPlanForm);

    document.getElementById('plan-search')?.addEventListener('input', (e) => {
        state.planningSearchTerm = e.target.value;
        renderAuditPlanningEnhanced();
    });

    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const planId = btn.getAttribute('data-plan-id');
            editAuditPlan(planId);
        });
    });

    document.querySelectorAll('.view-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const planId = btn.getAttribute('data-plan-id');
            viewAuditPlan(planId);
        });
    });

    document.querySelectorAll('.plan-title-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const planId = link.getAttribute('data-plan-id');
            viewAuditPlan(planId);
        });
    });

    document.querySelectorAll('.delete-plan-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const planId = btn.getAttribute('data-plan-id');
            if (confirm('Are you sure you want to delete this audit plan? This action cannot be undone.')) {
                deletePlan(planId);
            }
        });
    });
}

// Delete Plan Function
// Delete Plan Function
function deletePlan(planId) {
    const index = window.state.auditPlans.findIndex(p => String(p.id) === String(planId));
    if (index !== -1) {
        // 1. Local Delete (Optimistic)
        window.state.auditPlans.splice(index, 1);
        window.saveData();
        window.showNotification('Audit plan deleted locally', 'success');
        renderAuditPlanningEnhanced();

        // 2. Cloud Delete
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.db.delete('audit_plans', String(planId))
                .then(() => {
                    console.log(`Plan ${planId} deleted from cloud.`);
                })
                .catch(err => {
                    console.error('Cloud deletion failed:', err);
                    window.showNotification('Failed to delete from server. It may reappear on sync.', 'warning');
                });
        }
    }
}

// Wizard State
let currentPlanStep = 1;
window.editingPlanId = null;

function renderCreateAuditPlanForm(preSelectedClientName = null) {
    window.editingPlanId = null; // Reset edit mode

    const html = `
        <div class="fade-in">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="renderAuditPlanningEnhanced()">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Plans
                    </button>
                    <h2 id="plan-form-title" style="margin: 0; font-size: 1.5rem;">Create Audit Plan</h2>
                </div>
            </div>

            <form id="plan-form">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; align-items: start;">
                    
                    <!-- Main Column -->
                    <div style="display: grid; gap: 1.5rem;">
                        
                        <!-- Card: Client & Basic Details -->
                        <div class="card" style="margin: 0; padding: 1.5rem;">
                            <h3 style="margin: 0 0 1.25rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                                <i class="fa-solid fa-building"></i> Client & Audit Details
                            </h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
                                <div class="form-group" style="margin: 0;">
                                    <label>Client <span style="color: var(--danger-color);">*</span></label>
                                    <select class="form-control" id="plan-client" required onchange="updateClientDetails(this.value)" ${window.state.activeClientId ? 'disabled' : ''}>
                                        <option value="">-- Select Client --</option>
                                        ${state.clients.map(c => `<option value="${c.name}" ${window.state.activeClientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label>Planned Date <span style="color: var(--danger-color);">*</span></label>
                                    <input type="date" class="form-control" id="plan-date" required>
                                </div>
                                <div class="form-group" style="grid-column: 1 / -1; margin: 0;">
                                    <label>Audit Standard(s) <span style="color: var(--danger-color);">*</span></label>
                                    <select class="form-control" id="plan-standard" multiple style="height: 100px; font-size: 0.9rem;" disabled title="Hold Ctrl/Cmd to select multiple">
                                        <option value="">-- Select Client First --</option>
                                    </select>
                                    <small id="standards-hint" style="color: var(--text-secondary); display: block; margin-top: 4px;">Select a client to see applicable standards</small>
                                </div>
                            </div>

                            <!-- Dynamic Client Info Panel -->
                            <div id="client-info-panel" style="margin-top: 1.25rem; display: none; background: #f0f9ff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #bae6fd;"></div>
                        </div>

                        <!-- Card: Audit Scope & Sites -->
                        <div class="card" style="margin: 0; padding: 1.5rem;" id="site-selection-group-container">
                             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                                    <i class="fa-solid fa-location-dot"></i> Audit Scope & Sites
                                </h3>
                                <button type="button" class="btn btn-sm btn-outline-primary" onclick="window.openMultiSiteSamplingCalculatorModal()" style="font-size: 0.75rem; padding: 2px 8px;">
                                    <i class="fa-solid fa-calculator" style="margin-right: 0.25rem;"></i>Sampling Tool
                                </button>
                            </div>
                            <div id="site-selection-group" style="display: none;">
                                <div id="site-checkboxes" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto; padding: 2px;">
                                    <!-- Sites populate here -->
                                </div>
                                <div style="margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-secondary);">
                                    <i class="fa-solid fa-circle-info" style="margin-right: 0.4rem;"></i>
                                    Selected sites will be included in the audit plan and man-day calculation.
                                </div>
                            </div>
                            <div id="no-sites-message" style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                                Select a client to view available sites
                            </div>
                        </div>

                        <!-- Card: Audit Team -->
                        <div class="card" style="margin: 0; padding: 1.5rem;">
                            <h3 style="margin: 0 0 1.25rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                                <i class="fa-solid fa-users"></i> Audit Team
                            </h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
                                <div class="form-group" style="margin: 0;">
                                    <label>Lead Auditor</label>
                                    <select class="form-control" id="plan-lead-auditor">
                                        <option value="">-- Select Lead Auditor --</option>
                                        ${state.auditors.filter(a => a.role === 'Lead Auditor').map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label>Team Members</label>
                                    <select class="form-control" id="plan-team" multiple style="height: 100px;">
                                        ${state.auditors.filter(a => a.role !== 'Lead Auditor').map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
                                    </select>
                                    <small style="color: var(--text-secondary); display: block; margin-top: 4px;">Hold Ctrl/Cmd to select multiple</small>
                                </div>
                            </div>
                        </div>

                        <!-- Card: Agenda -->
                        <div class="card" style="margin: 0; padding: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <h3 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                                    <i class="fa-solid fa-calendar-days"></i> Audit Agenda
                                </h3>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="generateAIAgenda()" id="btn-ai-generate">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i> AI Generate
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="addAgendaRow()">
                                        <i class="fa-solid fa-plus"></i> Add Row
                                    </button>
                                </div>
                            </div>
                            
                            <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 2px solid var(--border-color);">
                                        <tr>
                                            <th style="width: 10%; padding: 12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Day</th>
                                            <th style="width: 15%; padding: 12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Time</th>
                                            <th style="width: 40%; padding: 12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Activity / Clause</th>
                                            <th style="width: 15%; padding: 12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Auditee</th>
                                            <th style="width: 15%; padding: 12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary);">Auditor</th>
                                            <th style="width: 5%;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="agenda-tbody">
                                        <!-- Rows added dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar Column -->
                    <div style="display: grid; gap: 1.5rem; align-self: start;">
                        
                        <!-- Card: Duration Calculation -->
                        <div class="card" style="margin: 0; padding: 1.5rem; border-top: 4px solid var(--primary-color);">
                            <h3 style="margin: 0 0 1.25rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-color);">
                                <i class="fa-solid fa-calculator"></i> Audit Duration
                            </h3>
                            
                            <div style="display: grid; gap: 1rem; margin-bottom: 1.25rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group" style="margin: 0;">
                                        <label style="font-size: 0.8rem;">Employees</label>
                                        <input type="number" class="form-control form-control-sm" id="plan-employees" readonly placeholder="0" style="background: #f1f5f9;">
                                    </div>
                                    <div class="form-group" style="margin: 0;">
                                        <label style="font-size: 0.8rem;">Sites</label>
                                        <input type="number" class="form-control form-control-sm" id="plan-sites" readonly placeholder="0" style="background: #f1f5f9;">
                                    </div>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem;">Operational Risk</label>
                                    <select class="form-control form-control-sm" id="plan-risk">
                                        <option>Low</option>
                                        <option selected>Medium</option>
                                        <option>High</option>
                                    </select>
                                </div>
                            </div>

                            <button type="button" id="btn-calculate-mandays" class="btn btn-primary btn-sm" style="width: 100%; margin-bottom: 1.25rem; height: 36px;" onclick="autoCalculateDays()" disabled>
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.4rem;"></i>Calculate Days
                            </button>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding: 1rem; background: #f8fafc; border: 1px dashed var(--border-color); border-radius: 8px;">
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 600;">Total Days</label>
                                    <input type="number" class="form-control" id="plan-mandays" step="0.5" style="font-weight: bold; color: var(--primary-color);">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 600;">On-Site</label>
                                    <input type="number" class="form-control" id="plan-onsite-days" step="0.5" style="font-weight: bold; color: var(--success-color);">
                                </div>
                            </div>
                            <small id="manday-hint" style="color: #6b7280; display: block; margin-top: 8px; font-size: 0.75rem; text-align: center;">Based on ISO 17021-1 Annex Tables</small>
                        </div>

                        <!-- Card: Compliance & Method -->
                        <div class="card" style="margin: 0; padding: 1.5rem;">
                            <h3 style="margin: 0 0 1.25rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: #1d4ed8;">
                                <i class="fa-solid fa-shield-halved"></i> Governance
                            </h3>
                            
                            <div style="display: grid; gap: 1rem;">
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem;">Audit Type</label>
                                    <select class="form-control" id="plan-audit-type">
                                        <option value="Stage 1">Stage 1 Audit</option>
                                        <option value="Stage 2" selected>Stage 2 Audit</option>
                                        <option value="Surveillance">Surveillance</option>
                                        <option value="Recertification">Recertification</option>
                                        <option value="Special">Special Audit</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem;">Method</label>
                                    <select class="form-control" id="plan-audit-method">
                                        <option value="On-site" selected>On-site</option>
                                        <option value="Remote">Remote</option>
                                        <option value="Hybrid">Hybrid</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem;">Impartiality Risk</label>
                                    <select class="form-control" id="plan-impartiality-risk">
                                        <option value="None" selected>None Identified</option>
                                        <option value="Low">Low - Mitigated</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High Risk</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="font-size: 0.8rem;">Impartiality Notes</label>
                                    <textarea class="form-control" id="plan-impartiality-notes" rows="2" style="font-size: 0.8rem;" placeholder="Mitigation actions..."></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Main Actions -->
                        <div style="display: grid; gap: 0.75rem; padding: 1rem; background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);">
                            <button type="button" id="btn-plan-save" class="btn btn-primary" style="height: 48px; font-weight: 600;">
                                <i class="fa-solid fa-floppy-disk" style="margin-right: 0.5rem;"></i> Save Audit Plan
                            </button>
                            <button type="button" id="btn-plan-save-print" class="btn btn-outline-primary" style="height: 42px;">
                                <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Save & Print Draft
                            </button>
                            <button type="button" id="btn-plan-cancel" class="btn btn-link" style="color: #6b7280; text-decoration: none;">Cancel</button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Set Initial Buttons
    const btnSave = document.getElementById('btn-plan-save');
    const btnSavePrint = document.getElementById('btn-plan-save-print');
    const btnCancel = document.getElementById('btn-plan-cancel');

    if (btnSave) btnSave.onclick = () => saveAuditPlan(false);
    if (btnSavePrint) btnSavePrint.onclick = () => saveAuditPlan(true);
    if (btnCancel) btnCancel.onclick = () => renderAuditPlanningEnhanced();

    // Fill initial agenda row
    addAgendaRow({ day: 'Day 1', time: '09:00 - 09:30', item: 'Opening Meeting', dept: 'Top Management', auditor: 'All' });

    // Auto-trigger client details if activeClientId needed or pre-selected
    if (preSelectedClientName) {
        // Use provided name
        const clientSelect = document.getElementById('plan-client');
        if (clientSelect) {
            clientSelect.value = preSelectedClientName;
            updateClientDetails(preSelectedClientName);
            // Ensure dropdown is disabled if it's the active client context (optional enforcement)
            // But if specific name passed, we just use it.
        }
    } else if (window.state.activeClientId) {
        const client = state.clients.find(c => String(c.id) === String(window.state.activeClientId));
        if (client) {
            updateClientDetails(client.name);
        }
    }
}

function editAuditPlan(id) {
    const plan = state.auditPlans.find(p => String(p.id) === String(id));
    if (!plan) return;

    renderCreateAuditPlanForm();
    window.editingPlanId = id; // Set global edit ID

    // Fill data
    setTimeout(() => {
        document.getElementById('plan-form-title').textContent = 'Edit Audit Plan';
        document.getElementById('plan-client').value = plan.client;

        // Manual standard selection
        const stdSelect = document.getElementById('plan-standard');
        if (stdSelect) {
            // We need to wait for updateClientDetails to populate it if it's dynamic
        }

        document.getElementById('plan-audit-type').value = plan.type || 'Surveillance';
        document.getElementById('plan-date').value = plan.date;

        // Critical Fix: Load ManDays from various possible sources
        const savedManDays = plan.manDays || plan.man_days || '';
        const savedOnsiteDays = plan.onsiteDays || plan.onsite_days || '';

        if (document.getElementById('plan-mandays')) document.getElementById('plan-mandays').value = savedManDays;
        if (document.getElementById('plan-onsite-days')) document.getElementById('plan-onsite-days').value = savedOnsiteDays;

        // Trigger client details load
        updateClientDetails(plan.client);

        // Pre-fill rest after delay
        setTimeout(() => {
            // Restore standards
            const currentStandards = (plan.standard || '').split(', ').map(s => s.trim());
            const stdSelect = document.getElementById('plan-standard');
            if (stdSelect) {
                Array.from(stdSelect.options).forEach(opt => {
                    opt.selected = currentStandards.includes(opt.value);
                });
            }

            // Restore site selection
            if (plan.selectedSites && plan.selectedSites.length > 0) {
                const selectedSiteNames = plan.selectedSites.map(s => s.name);
                document.querySelectorAll('.site-checkbox').forEach(cb => {
                    cb.checked = selectedSiteNames.includes(cb.dataset.name);
                });
                if (document.getElementById('plan-sites')) document.getElementById('plan-sites').value = plan.selectedSites.length;
                if (document.getElementById('btn-calculate-mandays')) document.getElementById('btn-calculate-mandays').disabled = false;
            }

            // Restore Auditor/Team
            let leadName = '';
            let teamNames = [];

            if (plan.team && plan.team.length) {
                leadName = plan.team[0];
                teamNames = plan.team.slice(1);
            } else if (plan.auditors && plan.auditors.length) {
                const leadObj = state.auditors.find(a => a.id === plan.auditors[0]);
                if (leadObj) leadName = leadObj.name;
            }

            document.getElementById('plan-lead-auditor').value = leadName;

            const teamSelect = document.getElementById('plan-team');
            Array.from(teamSelect.options).forEach(opt => {
                opt.selected = teamNames.includes(opt.value);
            });

        }, 300);

        // Fill Agenda (Step 2)
        const tbody = document.getElementById('agenda-tbody');
        tbody.innerHTML = '';
        if (plan.agenda && plan.agenda.length > 0) {
            plan.agenda.forEach(item => addAgendaRow(item));
        } else {
            addAgendaRow({ day: 'Day 1', time: '09:00 - 09:30', item: 'Opening Meeting', dept: 'Top Management', auditor: 'All' });
        }

    }, 100);
}

function updateClientDetails(clientName) {
    const client = state.clients.find(c => c.name === clientName);
    const siteGroup = document.getElementById('site-selection-group');
    const siteCheckboxes = document.getElementById('site-checkboxes');
    const noSitesMessage = document.getElementById('no-sites-message');

    if (client) {
        // Define sitesCount early to avoid ReferenceError
        const sitesCount = (client.sites && client.sites.length) || 1;

        // Update Standards Filtered by Client
        const stdSelect = document.getElementById('plan-standard');
        const stdHint = document.getElementById('standards-hint');
        if (stdSelect) {
            // Get standards assigned to client
            const clientStdsStr = client.standard || '';
            const clientStds = clientStdsStr.split(',').map(s => s.trim()).filter(Boolean);

            if (clientStds.length > 0) {
                stdSelect.disabled = false;
                stdSelect.innerHTML = clientStds.map(std => `<option value="${std}">${std}</option>`).join('');
                if (stdHint) stdHint.textContent = 'Hold Ctrl/Cmd to select multiple';

                // If there's only one standard, auto-select it
                if (clientStds.length === 1) {
                    stdSelect.options[0].selected = true;
                }
            } else {
                stdSelect.disabled = true;
                stdSelect.innerHTML = '<option value="">-- No Standards Assigned to Client --</option>';
                if (stdHint) stdHint.textContent = 'Please update client profile with applicable standards';
            }
        }

        // Enable Man-Day button if employees/sites are present
        const calcBtn = document.getElementById('btn-calculate-mandays');
        if (calcBtn) {
            calcBtn.disabled = !(client.employees > 0 || sitesCount > 0);
        }

        // Auto-fill calculation params
        if (document.getElementById('plan-employees')) {
            document.getElementById('plan-employees').value = client.employees || 0;
        }

        if (document.getElementById('plan-sites')) {
            document.getElementById('plan-sites').value = sitesCount;
        }

        // Populate site selection checkboxes
        if (siteGroup && siteCheckboxes && client.sites && client.sites.length > 0) {
            siteGroup.style.display = 'block';
            if (noSitesMessage) noSitesMessage.style.display = 'none';
            // Debugging
            console.log('Rendering sites:', client.sites);

            siteCheckboxes.innerHTML = client.sites.map((s, i) => `
                <div style="padding: 10px; background: #fff; border-radius: 4px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start; width: 100%; box-sizing: border-box;">
                    <input type="checkbox" class="site-checkbox" data-name="${s.name}" data-geotag="${s.geotag || ''}" data-employees="${s.employees || 0}" data-shift="${s.shift || 'No'}" checked style="cursor: pointer; margin-top: 4px; width: 16px; height: 16px;">
                    <div style="overflow: hidden;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: #1e293b; line-height: 1.4; margin-bottom: 2px;">${s.name || 'Unnamed Site'}</div>
                        <div style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">${s.city || 'No Location'}</div>
                    </div>
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
                    }
                });
            });
        } else if (siteGroup) {
            siteGroup.style.display = 'none';
            if (noSitesMessage) noSitesMessage.style.display = 'block';
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
                    <div><strong>Contact:</strong> ${primaryContact.name || '-'}</div>
                    <div><strong>Status:</strong> <span style="color: ${client.status === 'Active' ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">${client.status || 'Draft'}</span></div>
                </div>
                `;
            clientInfoPanel.style.display = 'block';
        }
        // Populate auditee dropdown with client contacts
        const auditeeSelect = document.getElementById('plan-auditee');
        if (auditeeSelect && client.contacts && client.contacts.length > 0) {
            auditeeSelect.innerHTML = `
                <option value="">--Select Contact Person--</option>
                    ${client.contacts.map(contact => `
                    <option value="${contact.name}">${contact.name}${contact.designation ? ` - ${contact.designation}` : ''}</option>
                `).join('')
                }
            `;
            // Auto-select first contact if available
            if (client.contacts.length > 0) {
                auditeeSelect.value = client.contacts[0].name;
            }
        } else if (auditeeSelect) {
            auditeeSelect.innerHTML = '<option value="">-- No contacts available --</option>';
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

        const typeSelect = document.getElementById('plan-audit-type');
        const type = typeSelect ? typeSelect.value : 'Surveillance';
        let days = 0;

        if (type.includes('Stage 1')) days = results.stage1;
        else if (type.includes('Stage 2') || type.includes('Recertification') || type.includes('Initial')) days = results.stage2; // Recert is typically full duration like Stage 2
        else days = results.surveillance;

        document.getElementById('plan-mandays').value = days.toFixed(1);
        document.getElementById('plan-onsite-days').value = (days * 0.8).toFixed(1);

        window.showNotification(`Calculated ${days.toFixed(1)} man - days for ${totalEmployees} employees at ${siteCount} site(s)${hasShiftWork ? ' (with shift work)' : ''} `, 'success');
    } else {
        window.showNotification('No employee data available for selected sites. Please verify client/site information.', 'warning');
    }
}

// Note: The definitive saveAuditPlan function is defined below (around line 1660) with proper validation and sanitization

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

    const plan = state.auditPlans.find(p => String(p.id) === String(id));
    if (!plan) {
        alert('Plan not found with ID: ' + id);
        return;
    }

    const client = state.clients.find(c => c.name === plan.client);
    const checklists = state.checklists || [];
    const planChecklists = plan.selectedChecklists || [];
    const report = (state.auditReports || []).find(r => String(r.planId) === String(plan.id));

    // Calculate Progress
    let progress = 0;
    let completedItems = 0;
    let totalItems = 0;

    // Sum total items from assigned checklists (support both old and new formats)
    planChecklists.forEach(clId => {
        const cl = checklists.find(c => String(c.id) === String(clId));
        if (cl) {
            if (cl.clauses && Array.isArray(cl.clauses)) {
                // New format: clauses with subClauses
                cl.clauses.forEach(clause => {
                    if (clause.subClauses) {
                        totalItems += clause.subClauses.length;
                    }
                });
            } else if (cl.items) {
                // Old format: items array
                totalItems += cl.items.length;
            }
        }
    });

    if (report && report.checklistProgress && totalItems > 0) {
        completedItems = report.checklistProgress.filter(p => p.status && p.status !== '').length;
        progress = Math.round((completedItems / totalItems) * 100);
    }

    // Helper to count items in a checklist (supports both formats)
    const getChecklistItemCount = (cl) => {
        if (!cl) return 0;
        if (cl.clauses && Array.isArray(cl.clauses)) {
            return cl.clauses.reduce((sum, clause) => sum + (clause.subClauses?.length || 0), 0);
        }
        return cl.items?.length || 0;
    };

    // Helper to render checklist list
    const checklistListHTML = planChecklists.length > 0 ? planChecklists.map(clId => {
        const cl = checklists.find(c => c.id === clId);
        if (!cl) return '';
        const itemCount = getChecklistItemCount(cl);
        return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); border-left: 3px solid ${cl.type === 'global' ? '#0369a1' : '#059669'}; margin-bottom: 0.5rem;">
                <div>
                    <p style="font-weight: 500; margin: 0;">${cl.name}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">${itemCount} items • ${cl.type === 'global' ? 'Global' : 'Custom'}</p>
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
    }).join('')
        }
        </div>
                `;

    const html = `
                <div class="fade-in">
            <!--Header-->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button class="btn btn-secondary" onclick="renderAuditPlanningEnhanced()">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Plans
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

            <!--Stepper-->
                ${stepperHTML}
            
            <!--UNIFIED DETAILS GRID(New Layout)-->
            <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 1.5rem; margin-bottom: 2rem;">
                
                <!-- 1. Client Context Card -->
                <div class="card" style="margin: 0;">
                    <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i> Client Context
                    </h4>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                        <div>
                            <div style="font-weight: 700; font-size: 1.25rem; color: #1e293b; margin-bottom: 0.25rem;">${client?.name}</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                <i class="fa-solid fa-industry" style="margin-right: 0.5rem; width: 16px;"></i> ${client?.industry || 'N/A'} 
                                <span style="margin: 0 0.5rem;">•</span>
                                <i class="fa-solid fa-users" style="margin-right: 0.5rem; width: 16px;"></i> ${client?.employees || 0} Employees
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <!-- Goods & Services -->
                        <div>
                            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">Goods & Services</div>
                            ${(client?.goodsServices && client.goodsServices.length > 0) ? `
                                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                    ${client.goodsServices.map(g => `<span class="badge" style="background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;">${g.name}</span>`).join('')}
                                </div>
                            ` : `<p style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">Not defined</p>`}
                        </div>
                        
                        <!-- Key Processes -->
                        <div>
                            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">Key Processes</div>
                            ${(client?.keyProcesses && client.keyProcesses.length > 0) ? `
                                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                    ${client.keyProcesses.map(p => `<span class="badge" style="background: ${p.category === 'Core' ? '#f0fdf4' : '#f0f9ff'}; color: ${p.category === 'Core' ? '#166534' : '#075985'}; border: 1px solid ${p.category === 'Core' ? '#bbf7d0' : '#bae6fd'};">${p.name}</span>`).join('')}
                                </div>
                            ` : `<p style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">Not defined</p>`}
                        </div>
                    </div>
                </div>

                <!-- 2. Audit Configuration Card -->
                <div class="card" style="margin: 0; background: #f8fafc; border: 1px solid #e2e8f0;">
                    <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem;">
                        <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem;"></i> Audit Configuration
                    </h4>

                    <!-- Standard & Type -->
                    <div style="margin-bottom: 1.25rem;">
                         <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span class="badge" style="background: var(--primary-color); color: white; padding: 4px 8px;">${plan.standard}</span>
                            <span class="badge" style="background: #e2e8f0; color: #475569;">${plan.type || 'Stage 1'}</span>
                         </div>
                    </div>

                    <!-- Scope / Sites -->
                    <div style="margin-bottom: 1.25rem;">
                        <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">Scope & Sites</div>
                        <div style="background: white; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
                             ${(plan.selectedSites || []).map(s => `<div style="font-size: 0.9rem; color: #334155; margin-bottom: 0.25rem;"><i class="fa-solid fa-map-pin" style="color: var(--danger-color); margin-right: 0.5rem;"></i>${s.name}</div>`).join('') || '<div style="font-size: 0.9rem;">All Sites</div>'}
                        </div>
                    </div>

                    <!-- Audit Team -->
                    <div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">Audit Team</div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${((plan.team && Array.isArray(plan.team)) ? plan.team : (plan.auditors || []).map(id => (state.auditors.find(a => a.id === id) || {}).name || 'Unknown')).map((m, idx) => `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; background: white; padding: 4px 10px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 0.85rem;">
                                        <div style="width: 20px; height: 20px; background: ${idx === 0 ? '#3b82f6' : '#94a3b8'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem;">${m.charAt(0)}</div>
                                        ${m} ${idx === 0 ? '<i class="fa-solid fa-star" style="color: #fbbf24; font-size: 0.7rem; margin-left: 2px;" title="Lead Auditor"></i>' : ''}
                                    </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!--Workflow Stages Grid(Row 2)-->
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5rem;">

                    <!-- 1. Configuration -->
                    <div class="card" style="margin: 0; display: flex; flex-direction: column;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Checklist Config</h3>
                        <div style="flex: 1; margin-bottom: 1rem;">
                            <p style="font-size: 0.9rem; color: var(--text-secondary);">Assign and customize checklists for this audit.</p>
                            <div style="font-weight: bold; font-size: 1.25rem; margin-top: 0.5rem;">${totalItems} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-secondary);">Items</span></div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" style="width: 100%; margin-bottom: 0.5rem;" onclick="window.printAuditChecklist('${plan.id}')"><i class="fa-solid fa-print"></i> Print</button>
                            <button class="btn btn-sm btn-secondary" style="width: 100%;" onclick="window.renderConfigureChecklist('${plan.id}')">Configure</button>
                        </div>
                    </div>

                    <!-- 2. Pre-Audit Review (Stage 1) -->
                    <div class="card" style="margin: 0; display: flex; flex-direction: column; border-top: 3px solid #8b5cf6;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;"><i class="fa-solid fa-file-magnifying-glass" style="margin-right: 0.5rem; color: #8b5cf6;"></i> Pre-Audit</h3>
                        <div style="flex: 1; margin-bottom: 1rem;">
                            <p style="font-size: 0.9rem; color: var(--text-secondary);">Stage 1 document review & readiness.</p>
                            <div style="margin-top: 0.75rem;">
                                <span class="status-badge status-${(plan.preAudit?.status || 'not-started').toLowerCase().replace(' ', '-')}" style="font-size: 0.75rem;">
                                    ${plan.preAudit?.status || 'Not Started'}
                                </span>
                                ${plan.preAudit?.completedDate ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;"><i class="fa-solid fa-calendar-check"></i> ${plan.preAudit.completedDate}</div>` : ''}
                            </div>
                        </div>
                        <button class="btn ${plan.preAudit?.status === 'Complete' ? 'btn-secondary' : 'btn-primary'}" style="width: 100%;" onclick="window.renderPreAuditReview('${plan.id}')">
                            ${plan.preAudit?.status === 'Complete' ? '<i class="fa-solid fa-eye"></i> View Review' : '<i class="fa-solid fa-play"></i> Start Review'}
                        </button>
                    </div>

                    <!-- 3. Execution -->
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
                        <button class="btn btn-primary" style="width: 100%;" onclick="window.navigateToAuditExecution('${plan.id}')">
                            ${report ? 'Continue Audit' : 'Start Audit'}
                        </button>
                    </div>

                    <!-- 4. Reporting -->
                    <div class="card" style="margin: 0; display: flex; flex-direction: column; border-top: 3px solid orange;">
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
                        ${report ? `
                    <button class="${report.status === 'Finalized' ? 'btn btn-secondary' : 'btn btn-primary'}" style="width: 100%;" onclick="window.navigateToReporting(${plan.id})">
                        ${report.status === 'Finalized' ? 'View Final Report' :
                report.status === 'Approved' ? 'Publish Report' :
                    report.status === 'In Review' ? 'Review / Approve' : 'Draft Report'}
                    </button>
                    ` : '<div style="text-align:center; font-size:0.8rem; color:#aaa;">Pending Execution</div>'}
                    </div>

                    <!-- 5. Closing -->
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


// Note: The definitive printAuditPlanDetails function (with team name resolution) is defined below around line 1295

window.printAuditChecklist = function (planId) {
    try {
        window.Logger.debug('Planning', 'Printing Plan ID:', planId);
        const plan = state.auditPlans.find(p => String(p.id) === String(planId));
        if (!plan) {
            alert("Error: Audit Plan not found for ID: " + planId);
            return;
        }

        // Use robust equality
        const report = (state.auditReports || []).find(r => String(r.planId) === String(planId));
        const checklists = state.checklists || [];
        const planChecklists = plan.selectedChecklists || [];

        if (!planChecklists || planChecklists.length === 0) {
            alert("No checklists are assigned to this audit plan.");
            return;
        }

        // Calculate Auditor Names safely
        let auditorNames = 'Unassigned';
        if (plan.team && Array.isArray(plan.team)) {
            auditorNames = plan.team.join(', ');
        } else if (plan.auditors && Array.isArray(plan.auditors)) {
            auditorNames = plan.auditors.map(id => {
                const auditor = (state.auditors || []).find(a => a.id == id);
                return auditor ? auditor.name : 'Unknown';
            }).join(', ');
        }

        // Map progress correctly
        const progressMap = {};
        if (report && report.checklistProgress) {
            report.checklistProgress.forEach(p => {
                // Normalized key: ID-Idx (String)
                progressMap[`${p.checklistId}-${p.itemIdx}`] = p;
            });
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
                    h3 { margin-top: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; font-size: 1rem; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f8f8f8; font-weight: bold; }
                    .main-clause { background-color: #eef2ff; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="position: absolute; top: 0; right: 0;">
                        <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
                    </div>
                    <h1>Audit Checklist Execution Report</h1>
                    <p><strong>Client:</strong> ${plan.client} | <strong>Standard:</strong> ${plan.standard} | <strong>Date:</strong> ${plan.date}</p>
                    <p><strong>Auditor(s):</strong> ${auditorNames} | <strong>Status:</strong> ${report ? 'Finalized' : 'In Progress'}</p>
                </div>
        `;

        planChecklists.forEach(clId => {
            const cl = checklists.find(c => c.id == clId);
            if (!cl) return; // Skip if checklist not found

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

            if (cl.clauses) {
                // Hierarchical
                cl.clauses.forEach(clause => {
                    content += `<tr class="main-clause"><td colspan="4">${clause.mainClause} ${clause.title || ''}</td></tr>`;
                    clause.subClauses.forEach((item, subIdx) => {
                        const key = `${cl.id}-${clause.mainClause}-${subIdx}`;
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
                });
            } else if (cl.items) {
                // Flat
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

        // Use specific window name to avoid some blockers
        const win = window.open('', 'PrintChecklist', 'width=1000,height=800');
        if (win) {
            win.document.open();
            win.document.write(content);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        } else {
            alert("Pop-up blocker prevented printing. Please check your browser settings and try again.");
        }
    } catch (err) {
        console.error("Print function error:", err);
        alert("An error occurred while trying to print: " + err.message);
    }
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
// FULL-FORM CHECKLIST CONFIGURATION (Local Overrides for Audit Plans)
window.renderConfigureChecklist = async function (planId) {
    if (!window.state) return;

    // Refresh checklists from Supabase before rendering to ensure latest data
    if (window.SupabaseClient?.isInitialized) {
        try {
            await window.SupabaseClient.syncChecklistsFromSupabase();
        } catch (e) {
            console.warn('Could not refresh checklists from Supabase:', e);
        }
    }

    const state = window.state;
    const plan = state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan) return;

    const savedItemSelections = plan.selectedChecklistItems || {};
    const savedOverrides = plan.selectedChecklistOverrides || {};
    const selectedIds = plan.selectedChecklists || [];

    // Get all checklists - don't filter by standard match
    // Users should see all available checklists when configuring an audit plan
    const checklists = state.checklists || [];

    // For sorting/highlighting: extract plan standards for reference
    const client = state.clients.find(c => c.name === plan.client);
    const clientStandards = (client?.standard || '').split(', ').map(s => s.trim()).filter(s => s);
    const planStandardsList = (plan.standard || '').split(', ').map(s => s.trim()).filter(s => s);
    const allStandards = [...new Set([...planStandardsList, ...clientStandards])].map(s => s.toLowerCase());

    const extractISONumbers = (str) => (str.match(/\d{4,5}/g) || []);
    const planISONumbers = allStandards.flatMap(s => extractISONumbers(s));

    const matchingChecklists = checklists; // Show ALL checklists

    const globalChecklists = matchingChecklists.filter(c => c.type === 'global');
    const customChecklists = matchingChecklists.filter(c => c.type === 'custom' || !c.type);

    const getFlattenedItems = (cl) => {
        let items = [];
        if (cl.clauses && cl.clauses.length > 0) {
            cl.clauses.forEach(clause => {
                if (clause.subClauses) {
                    clause.subClauses.forEach((sub, idx) => {
                        // Helper to safely get nested property
                        const getNestedReq = (obj) => {
                            if (!obj.items || !obj.items[0]) return null;
                            return obj.items[0].requirement;
                        };
                        const text = sub.requirement || sub.title || sub.requirement_text || sub.text || getNestedReq(sub) || 'No requirement text provided';
                        items.push({ id: `${clause.mainClause}-${idx}`, text: text, clause: clause.mainClause });
                    });
                }
            });
        } else if (cl.items) {
            cl.items.forEach((item, idx) => {
                const text = item.requirement || item.text || item.title || 'No requirement text provided';
                items.push({ id: String(idx), text: text, clause: item.clause });
            });
        }
        return items;
    };

    const renderGroup = (title, list, icon, color) => {
        if (list.length === 0) return '';
        return `
            <div style="margin-bottom: 2rem;">
                <h3 style="padding-bottom: 0.5rem; border-bottom: 2px solid ${color}; color: ${color}; margin-bottom: 1rem;">
                    <i class="${icon}" style="margin-right: 0.5rem;"></i> ${title}
                </h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    ${list.map(cl => {
            const isMainSelected = selectedIds.includes(cl.id);
            const items = getFlattenedItems(cl);
            const savedItems = savedItemSelections[cl.id];

            return `
                            <div class="card checklist-card" style="margin: 0; border-left: 4px solid ${color};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        <input type="checkbox" class="checklist-select-cb" data-id="${cl.id}" ${isMainSelected ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                                        <div>
                                            <h4 style="margin: 0; cursor: pointer;" onclick="this.closest('.card').querySelector('.items-list').classList.toggle('hidden')">${cl.name}</h4>
                                            <small style="color: var(--text-secondary);">${items.length} items • ${cl.standard || 'General'}</small>
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="this.closest('.card').querySelector('.items-list').classList.toggle('hidden')">
                                        <i class="fa-solid fa-chevron-down"></i> Expand / Edit
                                    </button>
                                </div>
                                <div class="items-list hidden" style="margin-top: 1rem; padding: 1.5rem; background: #f8fafc; border-radius: 8px; border: 1px inset #e2e8f0;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn btn-xs btn-outline-primary" onclick="window.bulkSelectConfigItems('${cl.id}', true)">Select All</button>
                                            <button class="btn btn-xs btn-outline-secondary" onclick="window.bulkSelectConfigItems('${cl.id}', false)">Deselect All</button>
                                        </div>
                                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Toggle items to include in audit scope</span>
                                    </div>
                                    <table class="data-table" style="width: 100%; font-size: 0.9rem; border-collapse: collapse;">
                                        <thead>
                                            <tr style="background: #e2e8f0;">
                                                <th style="width: 40px; padding: 8px; text-align: center;"><input type="checkbox" class="select-all-items-cb" data-checklist-id="${cl.id}" ${items.every(i => (!savedItems || savedItems.map(String).includes(String(i.id)))) ? 'checked' : ''} title="Select/Deselect All"></th>
                                                <th style="width: 80px; padding: 8px; text-align: left;">Clause</th>
                                                <th style="padding: 8px; text-align: left;">Requirement</th>
                                                <th style="width: 50px; padding: 8px; text-align: center;">Edit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        ${items.map(item => {
                const itemSelected = isMainSelected ? (!savedItems || savedItems.map(String).includes(String(item.id))) : false;
                const overrideText = (savedOverrides[cl.id] && savedOverrides[cl.id][item.id]) || item.text;
                const isOverridden = !!(savedOverrides[cl.id] && savedOverrides[cl.id][item.id]);

                return `
                                            <tr class="item-row" data-item-id="${item.id}" data-checklist-id="${cl.id}" style="border-bottom: 1px solid #e2e8f0; ${isOverridden ? 'background: #eff6ff;' : ''}">
                                                <td style="padding: 10px; text-align: center; vertical-align: top;">
                                                    <input type="checkbox" class="item-select-cb" data-item-id="${item.id}" data-checklist-id="${cl.id}" ${itemSelected ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px;">
                                                </td>
                                                <td style="padding: 10px; font-weight: 600; color: #475569; font-family: monospace; vertical-align: top;">${item.clause || '-'}</td>
                                                <td style="padding: 10px; line-height: 1.5; vertical-align: top;">
                                                    <span class="item-text" style="${isOverridden ? 'color: #0369a1; font-style: italic;' : ''}">${window.UTILS.escapeHtml(overrideText)}</span>
                                                    ${isOverridden ? '<span style="margin-left: 8px; font-size: 0.7rem; background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 4px;">Overridden</span>' : ''}
                                                </td>
                                                <td style="padding: 10px; text-align: center; vertical-align: top;">
                                                    <button class="btn btn-xs btn-icon" onclick="window.editConfigItemRequirement('${cl.id}', '${item.id}')" title="Override requirement text" style="background: none; border: none; cursor: pointer;">
                                                        <i class="fa-solid fa-pen-to-square" style="color: var(--primary-color);"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    };

    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.viewAuditPlan('${planId}')" style="margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-arrow-left"></i> Back to Plan
                </button>
                <h2 style="margin: 0;">Configure Checklists</h2>
                <p style="color: var(--text-secondary); margin: 0;">Tailor the audit scope and requirements for <strong>${plan.client}</strong></p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-outline-secondary" onclick="window.viewAuditPlan('${planId}')">Cancel</button>
                <button class="btn btn-primary" onclick="window.saveChecklistConfiguration('${planId}')" style="padding: 0.5rem 1.5rem;">
                    <i class="fa-solid fa-save"></i> Save Configuration
                </button>
            </div>
        </div>

        <div class="alert alert-info" style="margin-bottom: 2rem; background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e3a8a;">
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <i class="fa-solid fa-circle-info" style="font-size: 1.25rem;"></i>
                <div>
                    <strong>Pro-Tip:</strong> Edits made here are <strong>local overrides</strong>. They will appear in the execution view and reports for this audit, but WON'T affect the master database.
                </div>
            </div>
        </div>
    `;

    const html = `
        <div class="fade-in">
            ${headerHtml}
            <div style="max-width: 1200px; margin: 0 auto;">
                ${renderGroup('Global Checklists', globalChecklists, 'fa-solid fa-globe', '#0369a1')}
                ${renderGroup('Custom Checklists', customChecklists, 'fa-solid fa-user-gear', '#059669')}
            </div>
            
            <div style="margin-top: 3rem; padding: 2rem; border-top: 1px solid #e2e8f0; text-align: center;">
                 <button class="btn btn-primary btn-lg" onclick="window.saveChecklistConfiguration('${planId}')" style="min-width: 250px;">
                    <i class="fa-solid fa-save"></i> Save & Return to Plan
                 </button>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Add event listeners for table header select-all checkboxes
    document.querySelectorAll('.select-all-items-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const clId = cb.getAttribute('data-checklist-id');
            const isChecked = cb.checked;
            document.querySelectorAll(`.item-select-cb[data-checklist-id="${clId}"]`).forEach(itemCb => {
                itemCb.checked = isChecked;
            });
            // Also toggle the main checklist checkbox
            const mainCb = document.querySelector(`.checklist-select-cb[data-id="${clId}"]`);
            if (mainCb && isChecked) mainCb.checked = true;
        });
    });
};

// HELPER ACTIONS FOR CONFIG
window.bulkSelectConfigItems = function (clId, status) {
    document.querySelectorAll(`.item-select-cb[data-checklist-id="${clId}"]`).forEach(cb => cb.checked = status);
    if (status) {
        const clCb = document.querySelector(`.checklist-select-cb[data-id="${clId}"]`);
        if (clCb) clCb.checked = true;
    }
};

window.editConfigItemRequirement = function (clId, itemId) {
    const row = document.querySelector(`.item-row[data-checklist-id="${clId}"][data-item-id="${itemId}"]`);
    const textSpan = row.querySelector('.item-text');
    const currentText = textSpan.textContent;

    // Use a modal-like prompt for better UX than browser prompt if possible, but keeping it simple for now
    const newText = prompt('Override Requirement Text (Local to this audit):', currentText);
    if (newText !== null && newText.trim() !== '' && newText.trim() !== currentText) {
        textSpan.textContent = newText.trim();
        textSpan.style.color = '#0369a1';
        textSpan.style.fontStyle = 'italic';
        textSpan.style.borderBottom = '1px dashed #0369a1';
        // Auto-select if edited
        row.querySelector('.item-select-cb').checked = true;
        const clCb = document.querySelector(`.checklist-select-cb[data-id="${clId}"]`);
        if (clCb) clCb.checked = true;
    }
};

window.saveChecklistConfiguration = async function (planId) {
    const plan = state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan) return;

    const selectedChecklists = [];
    const selectedItemsMap = {};
    const overridesMap = {};

    document.querySelectorAll('.checklist-card').forEach(card => {
        const clCb = card.querySelector('.checklist-select-cb');
        if (clCb.checked) {
            const clId = clCb.getAttribute('data-id');
            selectedChecklists.push(clId);

            const selectedItems = [];
            const clOverrides = {};

            card.querySelectorAll('.item-row').forEach(row => {
                const itemId = row.getAttribute('data-item-id');
                if (row.querySelector('.item-select-cb').checked) {
                    selectedItems.push(itemId);
                }

                const textSpan = row.querySelector('.item-text');
                if (textSpan.style.fontStyle === 'italic') {
                    clOverrides[itemId] = textSpan.textContent;
                }
            });

            selectedItemsMap[clId] = selectedItems;
            if (Object.keys(clOverrides).length > 0) {
                overridesMap[clId] = clOverrides;
            }
        }
    });

    plan.selectedChecklists = selectedChecklists;
    plan.selectedChecklistItems = selectedItemsMap;
    plan.selectedChecklistOverrides = overridesMap;

    window.showNotification('Saving configuration...', 'info');

    try {
        if (window.SupabaseClient) {
            await window.SupabaseClient.db.update('audit_plans', String(planId), { data: plan });
        }
        window.saveData(); // Local backup
        window.showNotification('Configuration saved successfully.', 'success');
        window.viewAuditPlan(planId);
    } catch (e) {
        console.error('Save configuration error:', e);
        window.showNotification('Error saving configuration.', 'danger');
    }
};

// Wizard logic removed - consolidated to 1 page

function addAgendaRow(data = {}) {
    const tbody = document.getElementById('agenda-tbody');
    const row = document.createElement('tr');

    // Get Auditors for dropdown
    const leadVal = document.getElementById('plan-lead-auditor').value;
    const teamSelect = document.getElementById('plan-team');
    const teamVals = Array.from(teamSelect.selectedOptions).map(o => o.value);
    const allAuditors = [leadVal, ...teamVals].filter(Boolean);
    const uniqueAuditors = [...new Set(allAuditors)];

    const auditorOptions = uniqueAuditors.map(a => `<option value="${a}" ${data.auditor === a ? 'selected' : ''}>${a}</option>`).join('');

    row.innerHTML = `
        <td><input type="text" class="form-control" style="padding: 4px;" value="${window.UTILS.escapeHtml(data.day || 'Day 1')}" placeholder="Day"></td>
        <td><input type="text" class="form-control" style="padding: 4px;" value="${window.UTILS.escapeHtml(data.time || '')}" placeholder="Time"></td>
        <td><input type="text" class="form-control" style="padding: 4px;" value="${window.UTILS.escapeHtml(data.item || '')}" placeholder="Activity/Clause"></td>
        <td><input type="text" class="form-control" style="padding: 4px;" value="${window.UTILS.escapeHtml(data.dept || '')}" placeholder="Dept"></td>
        <td>
            <select class="form-control" style="padding: 4px;">
                <option value="All" ${data.auditor === 'All' ? 'selected' : ''}>All Team</option>
                ${auditorOptions}
                <option value="Other" ${!uniqueAuditors.includes(data.auditor) && data.auditor !== 'All' ? 'selected' : ''}>Other</option>
            </select>
        </td>
        <td style="text-align: center;">
            <button type="button" class="btn btn-sm btn-icon" style="color: var(--danger-color);" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;

    tbody.appendChild(row);
}

// Delete a row from the agenda table
function deleteAgendaRow(btn) {
    btn.closest('tr').remove();
}

// Note: saveAuditPlan is defined later in the file (around line 1600) with proper validation and sanitization

// Export functions
window.renderAuditPlanningEnhanced = renderAuditPlanningEnhanced;

window.autoCalculateDays = autoCalculateDays;
window.updateClientDetails = updateClientDetails;
window.addAgendaRow = addAgendaRow;
window.saveAuditPlan = saveAuditPlan;
window.editAuditPlan = editAuditPlan;
window.viewAuditPlan = viewAuditPlan;
window.openChecklistSelectionModal = window.renderConfigureChecklist; // Legacy alias

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
                    <td><span class="meta-label">Client</span>${window.UTILS.escapeHtml(plan.client)}</td>
                    <td><span class="meta-label">Audit Standard</span>${window.UTILS.escapeHtml(plan.standard)}</td>
                </tr>
                <tr>
                    <td><span class="meta-label">Planned Date</span>${window.UTILS.escapeHtml(plan.date)}</td>
                    <td><span class="meta-label">Audit Type</span>${window.UTILS.escapeHtml(plan.type)}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Lead Auditor</span>${window.UTILS.escapeHtml(leadAuditor)}</td>
                    <td><span class="meta-label">Audit Team</span>${window.UTILS.escapeHtml(otherMembers.join(', ') || 'None')}</td>
                </tr>
                 <tr>
                    <td><span class="meta-label">Total Man-Days</span>${window.UTILS.escapeHtml(plan.manDays)} days (${window.UTILS.escapeHtml(plan.onsiteDays)} onsite)</td>
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
                            <td>${window.UTILS.escapeHtml(site.name)} ${site.geotag ? '<span style="font-size:0.8em; color:#64748b;">(GPS)</span>' : ''}</td>
                            <td>${site.address || '-'}</td>
                            <td style="text-align: right;">${site.employees}</td>
                            <td style="text-align: right;">${auditorAssigned}</td>
                            <td style="text-align: right; font-weight: bold;">${(allocatedDays || 0).toFixed(2)}</td>
                        </tr>
                        `;
    }).join('')}
                    <tr style="background: #f8fafc; font-weight: bold;">
                        <td colspan="2">TOTAL</td>
                        <td style="text-align: right;">${totalEmployees}</td>
                        <td style="text-align: right;">-</td>
                        <td style="text-align: right;">${(plan.manDays || 0).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            ${plan.agenda && plan.agenda.length > 0 ? `
            <div class="section-title">AUDIT AGENDA / ITINERARY</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%">Day</th>
                        <th style="width: 15%">Time</th>
                        <th style="width: 45%">Activity / Clause</th>
                        <th style="width: 15%">Dept/Auditee</th>
                        <th style="width: 15%">Auditor</th>
                    </tr>
                </thead>
                <tbody>
                    ${plan.agenda.map(item => `
                        <tr>
                            <td>${item.day}</td>
                            <td>${item.time}</td>
                            <td>${item.item}</td>
                            <td>${item.dept}</td>
                            <td>${item.auditor}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

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

// Toggle Planning Analytics Dashboard
function togglePlanningAnalytics() {
    const state = window.state;
    state.showPlanningAnalytics = state.showPlanningAnalytics === false ? true : false;
    window.saveData();
    renderAuditPlanningEnhanced();
}

// Note: goToStep2, goToStep1, addAgendaRow, deleteAgendaRow are defined earlier in the file (around lines 1369-1461)
// The saveAuditPlan function below is the definitive version with proper validation and sanitization

function saveAuditPlan(shouldPrint = false) {
    // 1. Define Fields
    const fieldIds = {
        client: 'plan-client',
        date: 'plan-date',
        type: 'plan-audit-type', // Consolidated to use plan-audit-type
        leadAuditor: 'plan-lead-auditor',
        manDays: 'plan-mandays',
        onsiteDays: 'plan-onsite-days'
        // Standard & Team are multi-selects handled separately or via generic rules if we mapped them
    };

    // 2. Define Rules
    const rules = {
        client: [{ rule: 'required', fieldName: 'Client' }],
        date: [{ rule: 'required', fieldName: 'Date' }],
        manDays: [
            { rule: 'required', fieldName: 'Man-Days' },
            { rule: 'number', fieldName: 'Man-Days' },
            { rule: 'range', min: 0, max: 1000, fieldName: 'Man-Days' }
        ],
        onsiteDays: [
            { rule: 'number', fieldName: 'Onsite Days' }
        ]
    };

    // 3. Validate Step 1
    const result = Validator.validateFormElements(fieldIds, rules);
    if (!result.valid) {
        Validator.displayErrors(result.errors, fieldIds);
        window.showNotification('Please fix the form errors', 'error');
        return;
    }
    Validator.clearErrors(fieldIds);

    // 4. Collect & Sanitize Data
    const clientName = document.getElementById('plan-client').value;
    const date = document.getElementById('plan-date').value;
    const auditType = document.getElementById('plan-audit-type')?.value || 'Stage 2';

    // Safely map multi-selects
    const standardSelect = document.getElementById('plan-standard');
    const standard = Array.from(standardSelect.selectedOptions).map(o => o.value).join(', ');

    // Validate Leads/Team
    const leadAuditor = document.getElementById('plan-lead-auditor').value;
    const teamSelect = document.getElementById('plan-team');
    const team = Array.from(teamSelect.selectedOptions).map(o => o.value);

    if (!leadAuditor) {
        window.showNotification('Lead Auditor is required', 'error');
        return;
    }

    const manDays = parseFloat(document.getElementById('plan-mandays').value) || 0;
    const onsiteDays = parseFloat(document.getElementById('plan-onsite-days').value) || 0;

    const selectedSites = [];
    document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
        selectedSites.push({
            name: cb.dataset.name, // Usually safe as it comes from dataset, but...
            geotag: cb.dataset.geotag || null
        });
    });

    // 5. Collect & Sanitize Agenda (Step 2)
    const agenda = [];
    const agendaRows = document.querySelectorAll('#agenda-tbody tr');

    for (const row of agendaRows) {
        const inputs = row.querySelectorAll('input, select');

        // Manual validation for agenda rows?
        // Let's just sanitize them for now

        agenda.push({
            day: Sanitizer.sanitizeText(inputs[0].value),
            time: Sanitizer.sanitizeText(inputs[1].value),
            item: Sanitizer.sanitizeText(inputs[2].value), // Critical: Activity description
            dept: Sanitizer.sanitizeText(inputs[3].value),
            auditor: inputs[4].value // Select value
        });
    }

    // 5.5. Collect ISO 17021-1 Fields
    const auditMethod = document.getElementById('plan-audit-method')?.value || 'On-site';
    const impartialityRisk = document.getElementById('plan-impartiality-risk')?.value || 'None';
    const impartialityNotes = document.getElementById('plan-impartiality-notes')?.value || '';

    // 6. Construct Plan Object
    const planData = {
        client: clientName,
        date: date,
        type: auditType, // Using consolidated auditType
        standard: standard,
        auditors: [],
        team: [leadAuditor, ...team].filter(Boolean),
        manDays: manDays,
        onsiteDays: onsiteDays,
        selectedSites: selectedSites,
        agenda: agenda,
        status: 'Scheduled',
        // ISO 17021-1 Compliance Fields
        auditType: auditType,
        auditMethod: auditMethod,
        impartialityAssessment: {
            risk: impartialityRisk,
            notes: impartialityNotes,
            assessedBy: window.state.currentUser?.name || 'System',
            assessedDate: new Date().toISOString().split('T')[0]
        }
    };

    // 7. Save to Supabase (CRITICAL FIX: Database Persistence)
    const btnSave = document.getElementById('btn-plan-save');
    const originalText = btnSave ? btnSave.textContent : 'Save Audit Plan';

    // Helper to Restore Button State
    const restoreButton = () => {
        if (btnSave) {
            btnSave.textContent = originalText;
            btnSave.disabled = false;
        }
    };

    if (btnSave) {
        btnSave.textContent = 'Saving...';
        btnSave.disabled = true;
    }

    // Wrap DB operations in async function to allow await
    (async () => {
        try {
            // A. Update Local State FIRST (Optimistic UI)
            if (window.editingPlanId) {
                const index = state.auditPlans.findIndex(p => String(p.id) === String(window.editingPlanId));
                if (index !== -1) {
                    state.auditPlans[index] = { ...state.auditPlans[index], ...planData };
                }
            } else {
                const newPlanId = crypto.randomUUID();
                const clientObj = state.clients.find(c => c.name === planData.client);
                const clientId = clientObj ? String(clientObj.id) : null;
                const newPlan = {
                    id: newPlanId,
                    clientId: clientId,
                    progress: 0,
                    ...planData
                };
                state.auditPlans.push(newPlan);
                // Temporarily set editingPlanId so we know what to update in DB
                window.editingPlanId = newPlanId;
            }

            // Persist to LocalStorage immediately
            window.saveData();

            // B. Sync to Database (if online)
            const planId = window.editingPlanId || String(Date.now()); // Declare here so it's accessible later

            if (window.navigator.onLine && window.SupabaseClient) {
                if (btnSave) btnSave.textContent = 'Syncing to DB...';

                const clientObj = state.clients.find(c => c.name === planData.client);
                const clientId = clientObj ? String(clientObj.id) : null;

                // Check if plan exists in DB (it might be new locally but not in DB if offline before)
                // Use UPSERT to handle both cases
                const planToSave = state.auditPlans.find(p => String(p.id) === planId);

                const { error } = await window.SupabaseClient.db.upsert('audit_plans', {
                    id: planId,
                    client_id: clientId,
                    client_name: planData.client,
                    date: planData.date,
                    standard: planData.standard,
                    type: planData.type,
                    lead_auditor: planData.team[0] || null,
                    status: planData.status,

                    // Added fields for persistence
                    man_days: planData.manDays || 0,
                    onsite_days: planData.onsiteDays || 0,
                    team: planData.team || [],
                    agenda: planData.agenda || [],
                    selected_sites: planData.selectedSites || [],

                    data: planToSave // Backup catch-all
                });

                if (error) throw error;
                window.showNotification('Audit Plan saved and synced to database', 'success');

                // Send Assignment Emails (Async, non-blocking) - Only if online
                if (window.EmailService && window.state.auditors) {
                    const teamMembers = [leadAuditor, ...team].filter(Boolean);
                    teamMembers.forEach(name => {
                        const auditor = window.state.auditors.find(a => a.name === name);
                        if (auditor && auditor.email) {
                            window.EmailService.sendAuditAssignment(
                                auditor.email,
                                auditor.name,
                                clientName,
                                {
                                    standard: standard,
                                    scheduledDate: date,
                                    role: name === leadAuditor ? 'Lead Auditor' : 'Team Member',
                                    auditId: planId
                                }
                            ).catch(e => console.warn('Email failed:', e));
                        }
                    });
                }

            } else {
                window.showNotification('Audit Plan saved locally (Offline)', 'warning');
            }

            // Update UI - Don't full reload, just view the plan
            if (window.renderDashboardEnhanced) renderDashboardEnhanced();
            const finalId = planId || window.editingPlanId; // Use the actual plan ID we just worked with
            window.editingPlanId = null;

            // Navigate to view mode for this plan
            if (finalId) {
                window.viewAuditPlan(finalId);
            } else {
                renderAuditPlanningEnhanced();
            }

            // Trigger Print if requested
            if (shouldPrint && finalId) {
                setTimeout(() => {
                    window.printAuditPlanDetails(finalId);
                }, 500);
            }

        } catch (dbError) {
            console.error('Database Sync Failed:', dbError);
            window.showNotification('Saved locally, but DB sync failed: ' + dbError.message, 'warning');

            // Still render UI since local save worked
            renderAuditPlanningEnhanced();
            if (window.renderDashboardEnhanced) renderDashboardEnhanced();
            window.editingPlanId = null;
        } finally {
            restoreButton();
        }
    })();
}

async function generateAIAgenda() {
    if (!window.AI_SERVICE) {
        window.showNotification('AI Service not loaded', 'error');
        return;
    }

    const btn = document.getElementById('btn-ai-generate');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;

    try {
        // Collect Context
        const clientName = document.getElementById('plan-client').value;
        const standard = Array.from(document.getElementById('plan-standard').selectedOptions).map(o => o.value).join(', ');
        const type = document.getElementById('plan-audit-type').value;
        const manDays = parseFloat(document.getElementById('plan-mandays').value) || 0;
        const onsiteDays = parseFloat(document.getElementById('plan-onsite-days').value) || 0;

        const selectedSites = [];
        document.querySelectorAll('.site-checkbox:checked').forEach(cb => {
            selectedSites.push({ name: cb.dataset.name });
        });

        const leadAuditor = document.getElementById('plan-lead-auditor').value;
        const team = Array.from(document.getElementById('plan-team').selectedOptions).map(o => o.value);
        const fullTeam = [leadAuditor, ...team].filter(Boolean);

        // Fetch Client Departments for Context
        const clientObj = window.state.clients.find(c => c.name === clientName);
        const departments = clientObj ? (clientObj.departments || []) : [];

        const context = {
            client: clientName,
            standard: standard,
            type: type,
            manDays: manDays,
            onsiteDays: onsiteDays,
            sites: selectedSites,
            team: fullTeam,
            departments: departments,
            designations: clientObj ? (clientObj.designations || []) : []
        };

        const agenda = await window.AI_SERVICE.generateAuditAgenda(context);

        // Clear existing rows
        const tbody = document.getElementById('agenda-tbody');
        tbody.innerHTML = '';

        agenda.forEach(item => {
            addAgendaRow(item);
        });

        window.showNotification('Agenda generated successfully!', 'success');

    } catch (error) {
        window.showNotification(error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Exports
window.generateAIAgenda = generateAIAgenda;
window.addAgendaRow = addAgendaRow;
window.deleteAgendaRow = deleteAgendaRow; // Added export
window.saveAuditPlan = saveAuditPlan;

window.togglePlanningAnalytics = togglePlanningAnalytics;
window.renderCreateAuditPlanForm = renderCreateAuditPlanForm;
window.renderAuditPlanningEnhanced = renderAuditPlanningEnhanced;
window.editAuditPlan = editAuditPlan;
window.viewAuditPlan = viewAuditPlan;

// Navigation Helpers (Integrated Lifecycle)
window.navigateToAuditExecution = function (planId) {
    let report = window.state.auditReports.find(r => r.planId == planId);
    const plan = window.state.auditPlans.find(p => p.id == planId);

    if (!plan) {
        window.showNotification('Plan not found', 'error');
        return;
    }

    // If no report exists, create one automatically
    if (!report) {
        report = {
            id: Date.now(),
            planId: plan.id,
            client: plan.client,
            date: new Date().toISOString().split('T')[0],
            findings: 0,
            status: window.CONSTANTS.STATUS.IN_PROGRESS
        };

        if (!window.state.auditReports) window.state.auditReports = [];
        window.state.auditReports.push(report);

        // Mark plan as executed
        plan.reportId = report.id;
        plan.status = 'In Progress';

        window.saveData();
        window.showNotification('Audit started! Loading checklist...', 'success');
    }

    // Switch to execution tab
    const tab = document.querySelector('[data-module="audit-execution"]');
    if (tab) tab.click();

    setTimeout(() => {
        // Open specific audit
        if (window.renderExecutionDetail) {
            window.renderExecutionDetail(report.id);
        } else if (window.renderAuditExecutionEnhanced) {
            window.renderAuditExecutionEnhanced(report.id);
        }
    }, 200);
};

window.navigateToReporting = function (planId) {
    const report = window.state.auditReports.find(r => r.planId == planId);
    if (!report) {
        window.showNotification('No report data found. Please complete execution first.', 'warning');
        return;
    }

    // Switch to reporting tab
    const tab = document.querySelector('[data-module="audit-reporting"]');
    if (tab) tab.click();

    setTimeout(() => {
        if (window.openReportingDetail) window.openReportingDetail(report.id);
    }, 200);
};
window.updateClientDetails = updateClientDetails;
window.autoCalculateDays = autoCalculateDays;

// ============================================
// MULTI-SITE SAMPLING CALCULATOR (IAF MD 1)
// ============================================

function renderMultiSiteSamplingCalculator() {
    const html = `
        <div class="fade-in">
            <h2 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-sitemap" style="margin-right: 0.5rem;"></i>
                Multi-Site Sampling Calculator
            </h2>
            <div class="card" style="max-width: 800px;">
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Calculate the required sample size for multi-site audits based on <strong>IAF MD 1:2018</strong>.
                    This tool determines how many sites must be visited during Initial, Surveillance, and Recertification audits.
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <!-- Input Section -->
                    <div>
                        <div class="form-group">
                            <label>Total Number of Sites (n)</label>
                            <input type="number" id="ms-total-sites" class="form-control" min="1" value="1" oninput="calculateSampling()">
                        </div>

                        <div class="form-group">
                            <label>Audit Stage</label>
                            <select id="ms-stage" class="form-control" onchange="calculateSampling()">
                                <option value="initial">Initial Audit (Stage 2)</option>
                                <option value="surveillance">Surveillance Audit</option>
                                <option value="recertification">Recertification Audit</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Risk Complexity</label>
                            <select id="ms-risk" class="form-control" onchange="calculateSampling()">
                                <option value="low">Low Risk (Standard Multiplier)</option>
                                <option value="medium">Medium Risk (+25% sample)</option>
                                <option value="high">High Risk (All Sites / Higher Sample)</option>
                            </select>
                            <small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">
                                Based on complexity, processes, and past performance.
                            </small>
                        </div>
                        
                         <div class="form-group">
                            <label>Central Function</label>
                            <div style="background: #f1f5f9; padding: 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fa-solid fa-check-circle" style="color: var(--success-color);"></i>
                                <span style="font-size: 0.9rem;">Central Function is ALWAYS audited (1 site).</span>
                            </div>
                        </div>
                    </div>

                    <!-- Result Section -->
                    <div style="background: #f8fafc; padding: 2rem; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                        <h4 style="margin: 0 0 1rem 0; color: var(--text-secondary);">Required Sample Size</h4>
                        
                        <div id="ms-result" style="font-size: 4rem; font-weight: 800; color: var(--primary-color); line-height: 1;">0</div>
                        <div style="font-size: 1.1rem; color: var(--text-primary); margin-top: 0.5rem; font-weight: 500;">Sites to Visit</div>
                        
                        <div id="ms-formula" style="margin-top: 1.5rem; font-family: monospace; background: rgba(0,0,0,0.05); padding: 0.5rem 1rem; border-radius: 4px; color: var(--text-secondary);">
                            y = √n
                        </div>
                        
                         <div style="margin-top: 2rem; text-align: left; width: 100%;">
                            <p style="margin: 0.5rem 0; font-size: 0.9rem;">
                                <i class="fa-solid fa-building"></i> <strong>Central Function:</strong> 1
                            </p>
                             <p style="margin: 0.5rem 0; font-size: 0.9rem;">
                                <i class="fa-solid fa-network-wired"></i> <strong>Sampled Sites:</strong> <span id="ms-sampled-count">0</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div class="alert alert-warning" style="margin-top: 2rem;">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <strong>Note:</strong> This calculation assumes all sites have similar processes and operate under a single management system. If sites conduct significantly different activities, sampling may not be permitted.
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Initial Calc
    calculateSampling();
}

window.calculateSampling = function () {
    const n = parseInt(document.getElementById('ms-total-sites').value) || 0;
    const stage = document.getElementById('ms-stage').value;
    const risk = document.getElementById('ms-risk').value;

    if (n < 1) {
        document.getElementById('ms-result').innerText = '0';
        return;
    }

    let y = 0;
    let formula = '';

    if (stage === 'initial') {
        y = Math.sqrt(n);
        formula = 'y = √n';
    } else if (stage === 'surveillance') {
        y = 0.6 * Math.sqrt(n);
        formula = 'y = 0.6 × √n';
    } else if (stage === 'recertification') {
        y = 0.8 * Math.sqrt(n);
        formula = 'y = 0.8 × √n';
    }

    if (risk === 'medium') {
        y = y * 1.25;
        formula += ' × 1.25 (Risk)';
    } else if (risk === 'high') {
        y = y * 1.5;
        formula += ' × 1.5 (Risk)';
    }

    let result = Math.ceil(y);
    if (result > n) result = n;
    if (result < 1) result = 1;

    document.getElementById('ms-result').innerText = result;
    document.getElementById('ms-formula').innerText = formula;
    document.getElementById('ms-sampled-count').innerText = Math.max(0, result - 1);
};

window.renderMultiSiteSamplingCalculator = renderMultiSiteSamplingCalculator;

// ============================================
// PRE-AUDIT REVIEW (STAGE 1 - ISO 17021-1)
// ============================================

/**
 * Render Pre-Audit Review Form
 * ISO 17021-1 Stage 1: Document Review & Readiness Assessment
 */
window.renderPreAuditReview = function (planId) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan) {
        window.showNotification('Audit plan not found', 'error');
        return;
    }

    const client = window.state.clients.find(c => c.name === plan.client);

    // Initialize preAudit object if not exists
    if (!plan.preAudit) {
        plan.preAudit = {
            status: 'Not Started',
            completedDate: null,
            completedBy: null,
            findings: [],
            documentReview: {},
            readinessDecision: null,
            notes: ''
        };
    }

    // ISO 17021-1 Stage 1 Checklist Items
    const checklistItems = [
        { id: 'scope', label: 'Management System Scope', category: 'Documentation' },
        { id: 'processes', label: 'Process Identification & Interaction', category: 'Documentation' },
        { id: 'legal', label: 'Legal & Statutory Requirements', category: 'Compliance' },
        { id: 'objectives', label: 'Quality Objectives & Planning', category: 'Documentation' },
        { id: 'resources', label: 'Resource Availability (Personnel, Infrastructure)', category: 'Readiness' },
        { id: 'competence', label: 'Competence & Training Records', category: 'Compliance' },
        { id: 'documented_info', label: 'Documented Information Control', category: 'Documentation' },
        { id: 'internal_audit', label: 'Internal Audit Program', category: 'Compliance' },
        { id: 'management_review', label: 'Management Review Evidence', category: 'Compliance' },
        { id: 'corrective_action', label: 'Corrective Action Process', category: 'Compliance' },
        { id: 'risks_opportunities', label: 'Risk & Opportunity Management', category: 'Documentation' },
        { id: 'monitoring', label: 'Monitoring & Measurement Methods', category: 'Compliance' },
        { id: 'context', label: 'Organizational Context & Interested Parties', category: 'Documentation' },
        { id: 'leadership', label: 'Leadership & Commitment Evidence', category: 'Documentation' },
        { id: 'communication', label: 'Internal & External Communication', category: 'Documentation' },
        { id: 'site_readiness', label: 'Site Readiness for Stage 2 Audit', category: 'Readiness' }
    ];

    // Group by category
    const categories = {
        'Documentation': checklistItems.filter(i => i.category === 'Documentation'),
        'Compliance': checklistItems.filter(i => i.category === 'Compliance'),
        'Readiness': checklistItems.filter(i => i.category === 'Readiness')
    };

    // Calculate completion stats
    const totalItems = checklistItems.length;
    const reviewedItems = checklistItems.filter(i => plan.preAudit.documentReview[i.id]?.status).length;
    const okItems = checklistItems.filter(i => plan.preAudit.documentReview[i.id]?.status === 'ok').length;
    const minorItems = checklistItems.filter(i => plan.preAudit.documentReview[i.id]?.status === 'minor').length;
    const majorItems = checklistItems.filter(i => plan.preAudit.documentReview[i.id]?.status === 'major').length;
    const completionPct = Math.round((reviewedItems / totalItems) * 100);

    const html = `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 2rem;">
                <div>
                    <button class="btn btn-secondary" onclick="viewAuditPlan('${plan.id}')">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Audit Plan
                    </button>
                    <h2 style="margin: 1rem 0 0.5rem 0;">Pre-Audit Review (Stage 1)</h2>
                    <p style="color: var(--text-secondary); margin: 0;">
                        <i class="fa-solid fa-building" style="margin-right: 0.5rem;"></i>${client?.name || plan.client}
                        <span style="margin: 0 0.75rem;">•</span>
                        <i class="fa-solid fa-calendar" style="margin-right: 0.5rem;"></i>${plan.date}
                        <span style="margin: 0 0.75rem;">•</span>
                        ${plan.standard}
                    </p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-outline-primary" onclick="window.exportPreAuditPDF('${plan.id}')">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Export PDF
                    </button>
                    <button class="btn btn-primary" onclick="window.savePreAuditReview('${plan.id}')">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                    </button>
                </div>
            </div>

            <!-- Progress Summary -->
            <div class="card" style="margin-bottom: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem;">
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; font-weight: bold;">${reviewedItems}/${totalItems}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Items Reviewed</div>
                    </div>
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; font-weight: bold;">${okItems}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">✓ Conforming</div>
                    </div>
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; font-weight: bold;">${minorItems}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">⚠ Minor Findings</div>
                    </div>
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; font-weight: bold;">${majorItems}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">❌ Major Findings</div>
                    </div>
                </div>
                <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: white; opacity: 0.9; margin-bottom: 4px;">
                        <span>Overall Progress</span>
                        <span>${completionPct}%</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px;">
                        <div style="width: ${completionPct}%; background: white; height: 100%; border-radius: 4px; transition: width 0.3s;"></div>
                    </div>
                </div>
            </div>

            <!-- Checklist by Category -->
            ${Object.keys(categories).map(categoryName => `
                <div class="card" style="margin-bottom: 2rem;">
                    <h3 style="margin-top: 0; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e2e8f0;">
                        <i class="fa-solid fa-${categoryName === 'Documentation' ? 'file-lines' : categoryName === 'Compliance' ? 'shield-halved' : 'clipboard-check'}" style="margin-right: 0.5rem; color: ${categoryName === 'Documentation' ? '#3b82f6' : categoryName === 'Compliance' ? '#059669' : '#f59e0b'};"></i>
                        ${categoryName}
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        ${categories[categoryName].map(item => {
        const review = plan.preAudit.documentReview[item.id] || {};
        return `
                                <div style="padding: 1rem; background: #f8fafc; border-radius: var(--radius-md); border-left: 4px solid ${review.status === 'ok' ? '#10b981' : review.status === 'minor' ? '#f59e0b' : review.status === 'major' ? '#ef4444' : '#cbd5e1'};">
                                    <div style="display: grid; grid-template-columns: 2fr 1fr 3fr; gap: 1rem; align-items: start;">
                                        <div>
                                            <label style="font-weight: 600; color: #1e293b; display: block; margin-bottom: 0.5rem;">
                                                ${item.label}
                                            </label>
                                        </div>
                                        <div>
                                            <select 
                                                id="review-${item.id}" 
                                                class="pre-audit-status"
                                                style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: var(--radius-sm);"
                                                onchange="window.updatePreAuditItem('${planId}', '${item.id}', this.value)">
                                                <option value="">Not Reviewed</option>
                                                <option value="ok" ${review.status === 'ok' ? 'selected' : ''}>✓ OK</option>
                                                <option value="minor" ${review.status === 'minor' ? 'selected' : ''}>⚠ Minor</option>
                                                <option value="major" ${review.status === 'major' ? 'selected' : ''}>❌ Major</option>
                                            </select>
                                        </div>
                                        <div>
                                            <textarea 
                                                id="notes-${item.id}"
                                                placeholder="Notes, findings, or recommendations..."
                                                style="width: 100%; min-height: 60px; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: var(--radius-sm); resize: vertical; font-size: 0.9rem;"
                                                onchange="window.updatePreAuditNotes('${planId}', '${item.id}', this.value)"
                                            >${review.notes || ''}</textarea>
                                        </div>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>
            `).join('')}

            <!-- Readiness Decision -->
            <div class="card" style="margin-bottom: 2rem; border: 2px solid #8b5cf6;">
                <h3 style="margin-top: 0; margin-bottom: 1.5rem; color: #8b5cf6;">
                    <i class="fa-solid fa-gavel" style="margin-right: 0.5rem;"></i>
                    Readiness Decision
                </h3>
                <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; align-items: start;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Decision</label>
                        <select 
                            id="readiness-decision"
                            style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e1; border-radius: var(--radius-md); font-weight: 600; font-size: 1rem;"
                            onchange="window.updateReadinessDecision('${planId}', this.value)">
                            <option value="">-- Select --</option>
                            <option value="Ready" ${plan.preAudit.readinessDecision === 'Ready' ? 'selected' : ''} style="color: #059669;">✓ Ready for Stage 2</option>
                            <option value="Conditional" ${plan.preAudit.readinessDecision === 'Conditional' ? 'selected' : ''} style="color: #f59e0b;">⚠ Conditionally Ready</option>
                            <option value="Not Ready" ${plan.preAudit.readinessDecision === 'Not Ready' ? 'selected' : ''} style="color: #dc2626;">❌ Not Ready</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Summary & Recommendations</label>
                        <textarea 
                            id="readiness-notes"
                            placeholder="Overall assessment, key findings, and recommendations for the client..."
                            style="width: 100%; min-height: 120px; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: var(--radius-md); resize: vertical;"
                            onchange="window.updateReadinessNotes('${planId}', this.value)"
                        >${plan.preAudit.notes || ''}</textarea>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <button class="btn btn-secondary" onclick="viewAuditPlan('${plan.id}')">
                    Cancel
                </button>
                <button class="btn btn-outline-primary" onclick="window.exportPreAuditPDF('${plan.id}')">
                    <i class="fa-solid fa-file-pdf"></i> Export PDF
                </button>
                <button class="btn btn-success" onclick="window.completePreAuditReview('${plan.id}')">
                    <i class="fa-solid fa-check-circle"></i> Complete Review
                </button>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
};

/**
 * Update Pre-Audit item status
 */
window.updatePreAuditItem = function (planId, itemId, status) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    if (!plan.preAudit.documentReview[itemId]) {
        plan.preAudit.documentReview[itemId] = {};
    }
    plan.preAudit.documentReview[itemId].status = status;

    // Auto-save
    window.saveState();
};

/**
 * Update Pre-Audit item notes
 */
window.updatePreAuditNotes = function (planId, itemId, notes) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    if (!plan.preAudit.documentReview[itemId]) {
        plan.preAudit.documentReview[itemId] = {};
    }
    plan.preAudit.documentReview[itemId].notes = notes;

    // Auto-save
    window.saveState();
};

/**
 * Update readiness decision
 */
window.updateReadinessDecision = function (planId, decision) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    plan.preAudit.readinessDecision = decision;
    window.saveState();
};

/**
 * Update readiness notes
 */
window.updateReadinessNotes = function (planId, notes) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    plan.preAudit.notes = notes;
    window.saveState();
};

/**
 * Save Pre-Audit review progress
 */
window.savePreAuditReview = function (planId) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    plan.preAudit.status = 'In Progress';
    window.saveState();
    window.showNotification('Pre-Audit review saved successfully', 'success');
};

/**
 * Complete Pre-Audit review
 */
window.completePreAuditReview = function (planId) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) return;

    // Validation
    if (!plan.preAudit.readinessDecision) {
        window.showNotification('Please select a readiness decision before completing', 'warning');
        return;
    }

    // Mark as complete
    plan.preAudit.status = 'Complete';
    plan.preAudit.completedDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    plan.preAudit.completedBy = window.state.currentUser?.name || 'Auditor';

    window.saveState();
    window.showNotification('Pre-Audit review completed successfully', 'success');

    // Return to audit plan view
    setTimeout(() => viewAuditPlan(planId), 1000);
};

/**
 * Export Pre-Audit PDF Report
 */
window.exportPreAuditPDF = function (planId) {
    const plan = window.state.auditPlans.find(p => String(p.id) === String(planId));
    if (!plan || !plan.preAudit) {
        window.showNotification('Pre-Audit data not found', 'error');
        return;
    }

    const client = window.state.clients.find(c => c.name === plan.client);
    const cbSettings = window.state.cbSettings || {};

    // Checklist items (same as in renderPreAuditReview)
    const checklistItems = [
        { id: 'scope', label: 'Management System Scope', category: 'Documentation' },
        { id: 'processes', label: 'Process Identification & Interaction', category: 'Documentation' },
        { id: 'legal', label: 'Legal & Statutory Requirements', category: 'Compliance' },
        { id: 'objectives', label: 'Quality Objectives & Planning', category: 'Documentation' },
        { id: 'resources', label: 'Resource Availability (Personnel, Infrastructure)', category: 'Readiness' },
        { id: 'competence', label: 'Competence & Training Records', category: 'Compliance' },
        { id: 'documented_info', label: 'Documented Information Control', category: 'Documentation' },
        { id: 'internal_audit', label: 'Internal Audit Program', category: 'Compliance' },
        { id: 'management_review', label: 'Management Review Evidence', category: 'Compliance' },
        { id: 'corrective_action', label: 'Corrective Action Process', category: 'Compliance' },
        { id: 'risks_opportunities', label: 'Risk & Opportunity Management', category: 'Documentation' },
        { id: 'monitoring', label: 'Monitoring & Measurement Methods', category: 'Compliance' },
        { id: 'context', label: 'Organizational Context & Interested Parties', category: 'Documentation' },
        { id: 'leadership', label: 'Leadership & Commitment Evidence', category: 'Documentation' },
        { id: 'communication', label: 'Internal & External Communication', category: 'Documentation' },
        { id: 'site_readiness', label: 'Site Readiness for Stage 2 Audit', category: 'Readiness' }
    ];

    // Group by category
    const categories = {
        'Documentation': checklistItems.filter(i => i.category === 'Documentation'),
        'Compliance': checklistItems.filter(i => i.category === 'Compliance'),
        'Readiness': checklistItems.filter(i => i.category === 'Readiness')
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        window.showNotification('Pop-up blocked. Please allow pop-ups.', 'warning');
        return;
    }

    const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pre-Audit Review Report — ${plan.client}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; }
                .page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
                
                /* Cover Page */
                .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; page-break-after: always; }
                .cover h1 { font-size: 3rem; margin-bottom: 1rem; }
                .cover .subtitle { font-size: 1.25rem; opacity: 0.9; margin-bottom: 3rem; }
                .cover .meta { font-size: 1.1rem; line-height: 2; }
                
                /* Content */
                h2 { color: #8b5cf6; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; }
                h3 { color: #475569; margin: 1.5rem 0 1rem; }
                
                table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                th, td { padding: 0.75rem; text-align: left; border: 1px solid #e2e8f0; }
                th { background: #f8fafc; font-weight: 600; color: #475569; }
                tr:nth-child(even) { background: #f8fafc; }
                
                .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; }
                .badge-ok { background: #dcfce7; color: #166534; }
                .badge-minor { background: #fef3c7; color: #92400e; }
                .badge-major { background: #fee2e2; color: #991b1b; }
                .badge-not-reviewed { background: #f1f5f9; color: #64748b; }
                
                .decision-box { padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid; }
                .decision-ready { background: #f0fdf4; border-color: #22c55e; }
                .decision-conditional { background: #fffbeb; border-color: #f59e0b; }
                .decision-not-ready { background: #fef2f2; border-color: #ef4444; }
                
                .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9rem; }
                
                @media print {
                    .page { page-break-inside: avoid; }
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            <!-- Cover Page -->
            <div class="cover">
                ${cbSettings.logoUrl ? `<img src="${cbSettings.logoUrl}" style="max-height: 80px; margin-bottom: 2rem;" alt="CB Logo">` : ''}
                <h1>Pre-Audit Review Report</h1>
                <div class="subtitle">ISO 17021-1 Stage 1 Assessment</div>
                <div class="meta">
                    <div><strong>Client:</strong> ${client?.name || plan.client}</div>
                    <div><strong>Standard:</strong> ${plan.standard}</div>
                    <div><strong>Audit Date:</strong> ${plan.date}</div>
                    <div><strong>Review Completed:</strong> ${plan.preAudit.completedDate || 'In Progress'}</div>
                    <div><strong>Reviewed By:</strong> ${plan.preAudit.completedBy || 'Auditor'}</div>
                </div>
            </div>

            <!-- Content Pages -->
            <div class="page">
                <h2><i class="fa-solid fa-clipboard-check"></i> Assessment Summary</h2>
                <p style="margin: 1rem 0;">
                    This report documents the Pre-Audit (Stage 1) assessment conducted per ISO 17021-1 requirements. 
                    The purpose of this assessment is to review the organization's management system documentation and 
                    determine readiness for the Stage 2 on-site audit.
                </p>

                <!-- Readiness Decision -->
                <div class="decision-box decision-${plan.preAudit.readinessDecision?.toLowerCase().replace(' ', '-')}">
                    <h3 style="margin-top: 0; color: ${plan.preAudit.readinessDecision === 'Ready' ? '#166534' : plan.preAudit.readinessDecision === 'Conditional' ? '#92400e' : '#991b1b'};">
                        <i class="fa-solid fa-${plan.preAudit.readinessDecision === 'Ready' ? 'check-circle' : plan.preAudit.readinessDecision === 'Conditional' ? 'exclamation-triangle' : 'times-circle'}"></i>
                        Decision: ${plan.preAudit.readinessDecision || 'Pending'}
                    </h3>
                    <p style="white-space: pre-wrap; margin-top: 0.5rem;">${plan.preAudit.notes || 'No summary provided.'}</p>
                </div>

                <!-- Checklist Assessment -->
                <h2><i class="fa-solid fa-list-check"></i> Checklist Assessment Results</h2>
                ${Object.keys(categories).map(categoryName => `
                    <h3>${categoryName}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40%;">Item</th>
                                <th style="width: 15%;">Status</th>
                                <th style="width: 45%;">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                    ${categories[categoryName].map(item => {
        const review = plan.preAudit.documentReview[item.id] || {};
        const statusBadge = review.status === 'ok' ? '<span class="badge badge-ok">✓ OK</span>' :
            review.status === 'minor' ? '<span class="badge badge-minor">⚠ Minor</span>' :
                review.status === 'major' ? '<span class="badge badge-major">❌ Major</span>' :
                    '<span class="badge badge-not-reviewed">Not Reviewed</span>';
        return `
                            <tr>
                                <td>${item.label}</td>
                                <td>${statusBadge}</td>
                                <td style="font-size: 0.9rem; color: #475569;">${review.notes || '—'}</td>
                            </tr>
                        `;
    }).join('')}
                        </tbody>
                    </table>
                `).join('')}

                <!-- Footer -->
                <div class="footer">
                    <p><strong>${cbSettings.cbName || 'Certification Body'}</strong></p>
                    <p>${cbSettings.cbEmail || ''}</p>
                    <p>Report Generated: ${new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <script>
                window.onload = () => {
                    setTimeout(() => window.print(), 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(reportHTML);
    printWindow.document.close();
};


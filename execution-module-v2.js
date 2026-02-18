// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs
// ============================================

// ---------- KB Helpers loaded from ai-service.js (window.KB_HELPERS) ----------
// normalizeStdName, extractClauseNum, lookupKBRequirement, resolveChecklistClause,
// resolveStandardName are all available via window.KB_HELPERS.*


// Navigation Helper: Back to Execution List
window.handleBackToExecutionList = function () {
    if (window.state.activeClientId) {
        // Force navigation to client execution view
        const currentHash = window.location.hash;
        const targetHash = '#client/' + window.state.activeClientId + '/execution';

        // If already on the target hash, force a reload by going through temp hash
        if (currentHash === targetHash || currentHash.startsWith(targetHash)) {
            window.location.hash = '#temp-redirect';
            setTimeout(() => {
                window.location.hash = targetHash.substring(1); // Remove leading #
            }, 10);
        } else {
            window.location.hash = targetHash.substring(1);
        }
    } else {
        // Global context - just render the list
        renderAuditExecutionEnhanced();
    }
};

function renderAuditExecutionEnhanced() {
    const state = window.state;
    // Safety Check: Ensure state exists
    if (!state) {
        console.error('Critical Error: window.state is undefined in execution module');
        return;
    }

    // Initialize auditReports if missing
    if (!state.auditReports) {
        state.auditReports = [];
    }

    // Initialize clients if missing (prevent crash in map)
    if (!state.clients) {
        state.clients = [];
    }

    const searchTerm = state.executionSearchTerm || '';

    try {

        let filteredReports = state.auditReports.filter(report => {
            return (report.client || '').toLowerCase().includes(searchTerm.toLowerCase());
        });

        const rows = filteredReports.map(report => {
            const planRef = report.planId ? window.UTILS.getPlanRef(report.planId) : '-';
            const clientId = state.clients.find(c => c.name === report.client)?.id;

            return `
        <tr class="execution-row" data-report-id="${report.id}" style="cursor: pointer;">
            <td>
                ${report.planId ?
                    `<span class="badge" style="background: #3b82f6; color: white; cursor: pointer; font-weight: 600;" 
                           onclick="event.stopPropagation(); window.location.hash = 'client/${clientId}/plans';" 
                           title="View linked audit plan">
                        <i class="fa-solid fa-link" style="margin-right: 0.25rem;"></i>${planRef}
                    </span>` :
                    `<span style="color: var(--text-secondary); font-size: 0.85rem;">No Plan</span>`
                }
            </td>
            <td>${report.client}</td>
            <td>${report.date}</td>
            <td><span style="background: ${report.findings > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.findings}</span></td>
            <td><span style="background: ${report.status === window.CONSTANTS.STATUS.FINALIZED ? 'var(--success-color)' :
                    report.status === 'Approved' ? '#7c3aed' :
                        report.status === 'In Review' ? 'var(--warning-color)' :
                            '#64748b'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.status}</span></td>
            <td>
                <button class="btn btn-sm view-execution" data-report-id="${report.id}" style="color: var(--primary-color); margin-right: 0.5rem;" title="View Report"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-sm edit-execution" data-report-id="${report.id}" style="color: #f59e0b; margin-right: 0.5rem;" title="Edit Report"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm delete-execution" data-report-id="${report.id}" style="color: var(--danger-color);" title="Delete Report"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `;
        }).join('');

        const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Audit Execution & Reports</h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleExecutionAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showExecutionAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showExecutionAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    <button class="btn btn-primary" onclick="window.openCreateReportModal()">
                        <i class="fa-solid fa-play" style="margin-right: 0.5rem;"></i> Start Audit Execution
                    </button>
                </div>
            </div>

            ${state.showExecutionAnalytics !== false ? `
             <div class="fade-in" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <!-- Total Reports -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-file-contract"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Reports</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditReports.length}</div>
                    </div>
                </div>

                <!-- Pending Closure -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fff7ed; color: #ea580c; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">In Progress</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditReports.filter(r => r.status !== window.CONSTANTS.STATUS.FINALIZED).length}</div>
                    </div>
                </div>

                 <!-- Total Findings -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Findings</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditReports.reduce((acc, r) => acc + (r.findings || 0), 0)}</div>
                    </div>
                </div>
                
                 <!-- Avg Findings -->
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fefce8; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-chart-pie"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Avg per Audit</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${(state.auditReports.reduce((acc, r) => acc + (r.findings || 0), 0) / (state.auditReports.length || 1)).toFixed(1)}</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="execution-search" placeholder="Search by client..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Plan Ref</th>
                            <th>Client</th>
                            <th>Audit Date</th>
                            <th>Findings (NCs)</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No reports found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

        window.contentArea.innerHTML = html;

        // Event listeners with EventManager (prevents memory leaks)
        const searchInput = document.getElementById('execution-search');
        if (searchInput) {
            // Debounced search handler (300ms delay)
            const debouncedSearch = debounce((value) => {
                state.executionSearchTerm = value;
                renderAuditExecutionEnhanced();
            }, 300);

            EventManager.add(searchInput, 'input', (e) => {
                debouncedSearch(e.target.value);
            }, 'execution-search-input');
        }

        document.querySelectorAll('.view-execution, .execution-row').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.closest('.edit-execution')) {
                    const reportId = el.getAttribute('data-report-id');
                    renderExecutionDetail(reportId);
                }
            });
        });

        document.querySelectorAll('.edit-execution').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const reportId = btn.getAttribute('data-report-id');
                openEditReportModal(reportId);
            });
        });

        document.querySelectorAll('.delete-execution').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const reportId = btn.getAttribute('data-report-id');
                deleteAuditReport(reportId);
            });
        });



        // Helper for toggle
        window.toggleExecutionAnalytics = function () {
            if (state.showExecutionAnalytics === undefined) state.showExecutionAnalytics = true;
            state.showExecutionAnalytics = !state.showExecutionAnalytics;
            renderAuditExecutionEnhanced();
        };
    } catch (error) {
        console.error('Error rendering execution module:', error);
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'Render Execution Module', true);
        }
        if (window.contentArea) {
            window.contentArea.innerHTML = '<div class="alert alert-danger" style="padding: 2rem; text-align: center; color: var(--danger-color);"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 1rem;"></i><br>Failed to load execution module. Please refresh the page.</div>';
        }
    }
}

function openCreateReportModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    // Filter out plans that already have a report OR are marked Completed
    const allOpenPlans = state.auditPlans.filter(p => !p.reportId && p.status !== 'Completed');
    allOpenPlans.sort((a, b) => new Date(a.date) - new Date(b.date));

    modalTitle.innerHTML = '<i class="fa-solid fa-play"></i> Start New Audit';

    // Helpers exposed for HTML interaction
    window.selectAuditPlan = (id) => {
        const plan = state.auditPlans.find(p => p.id == id);
        if (!plan) return;

        document.getElementById('report-plan').value = id;
        document.getElementById('report-date').value = plan.date;
        document.getElementById('plan-display').textContent = `${window.UTILS.getPlanRef(plan)}: ${plan.client}`;
        document.querySelectorAll('.select-plan-btn').forEach(b => {
            b.className = 'btn btn-sm btn-outline-primary select-plan-btn';
            b.textContent = 'Select';
        });
        const btn = event.target; // Captured from onclick
        if (btn) {
            btn.className = 'btn btn-sm btn-success select-plan-btn';
            btn.textContent = 'Selected';
        }
        document.getElementById('confirm-section').style.display = 'block';
    };

    window.filterAuditPlansStart = (clientName) => {
        const filtered = clientName ? allOpenPlans.filter(p => p.client === clientName) : allOpenPlans;
        document.getElementById('plan-list-tbody').innerHTML = renderTableLines(filtered);
    };

    const renderTableLines = (plans) => {
        if (plans.length === 0) return '<tr><td colspan="5" style="padding:1rem; text-align:center; color:#999;">No open plans found for selected criteria.</td></tr>';
        return plans.map(p => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; font-weight: 600;">${window.UTILS.getPlanRef(p)}</td>
                <td style="padding: 8px;">${window.UTILS.escapeHtml(p.client)}</td>
                <td style="padding: 8px;">${window.UTILS.escapeHtml(p.standard)}</td>
                <td style="padding: 8px;">${window.UTILS.escapeHtml(p.date)}</td>
                <td style="padding: 8px; text-align: center;">
                    <button class="btn btn-sm btn-outline-primary select-plan-btn" 
                        onclick="window.selectAuditPlan('${p.id}')">
                        Select
                    </button>
                </td>
            </tr>
        `).join('');
    };

    const activeClient = window.state.activeClientId ? state.clients.find(c => c.id === window.state.activeClientId) : null;
    const initialClientName = activeClient ? activeClient.name : '';

    modalBody.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px; display: block;">Filter by Company:</label>
            <select class="form-control" id="start-audit-client-filter" onchange="window.filterAuditPlansStart(this.value)" style="margin-bottom: 1rem; border-color: var(--primary-color);" ${activeClient ? 'disabled' : ''}>
                <option value="">-- All Companies with Open Plans --</option>
                ${uniqueClients.map(c => `<option value="${c}" ${c === initialClientName ? 'selected' : ''}>${c}</option>`).join('')}
            </select>

            <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 1;">
                        <tr>
                            <th style="padding: 8px; text-align: left;">Ref</th>
                            <th style="padding: 8px; text-align: left;">Client</th>
                            <th style="padding: 8px; text-align: left;">Standard</th>
                            <th style="padding: 8px; text-align: left;">Date</th>
                            <th style="padding: 8px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="plan-list-tbody">
                        ${renderTableLines(allOpenPlans)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="confirm-section" style="display: none; border-top: 1px solid #e2e8f0; padding-top: 1rem; animation: fadeIn 0.3s;">
            <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 6px; border: 1px solid #bbf7d0; margin-bottom: 1rem;">
                <i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 0.5rem;"></i> Ready to start audit for <strong id="plan-display"></strong>
            </div>
            
            <input type="hidden" id="report-plan">
            
            <div class="form-group">
                <label>Confirm Execution Date</label>
                <input type="date" class="form-control" id="report-date" required>
            </div>
            
            <div class="form-group">
                 <label>Initial Status</label>
                 <select class="form-control" id="report-status">
                    <option>${window.CONSTANTS.STATUS.IN_PROGRESS}</option>
                    <option>${window.CONSTANTS.STATUS.DRAFT}</option>
                </select>
            </div>
        </div>
    `;
    window.openModal();

    // Auto-filter if in client context
    if (initialClientName) {
        window.filterAuditPlansStart(initialClientName);
    }

    // Update button text to 'Start Audit'
    document.getElementById('modal-save').textContent = 'Start Audit';

    modalSave.onclick = () => {
        const planId = document.getElementById('report-plan').value;
        const date = document.getElementById('report-date').value;
        const status = document.getElementById('report-status')?.value || window.CONSTANTS.STATUS.IN_PROGRESS;

        if (planId && date) {
            const plan = state.auditPlans.find(p => String(p.id) === String(planId));
            const newReport = {
                id: String(Date.now()),
                planId: String(plan.id), // Link to plan
                client: plan.client,
                date: date,
                findings: 0,
                status: status
            };

            if (!state.auditReports) state.auditReports = [];

            // Check if report already exists for this plan
            const existingReport = state.auditReports.find(r => String(r.planId) === String(planId));
            if (existingReport) {
                window.showNotification('Report already exists for this plan. Opening existing report.', 'info');
                // Ensure plan is linked
                if (!plan.reportId) {
                    plan.reportId = existingReport.id;
                    plan.status = 'Completed';
                    window.saveData();
                }
                window.closeModal();
                renderAuditExecutionEnhanced();
                return;
            }

            state.auditReports.push(newReport);

            // Mark plan as executed
            plan.reportId = String(newReport.id);
            plan.status = 'Completed'; // Optional: Mark plan as completed/executed

            window.saveData();
            window.closeModal();
            renderAuditExecutionEnhanced();
            window.showNotification('Audit Initiated! Checklist loaded from Plan.', 'success');

            // Persist to Cloud
            if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
                // 1. Insert Report
                window.SupabaseClient.db.insert('audit_reports', {
                    id: String(newReport.id),  // DB uses TEXT for id
                    plan_id: String(plan.id),
                    client_name: newReport.client,  // DB column is client_name
                    client_id: plan.clientId || null,
                    date: newReport.date,
                    status: newReport.status,
                    findings: 0,
                    data: newReport
                }).catch(err => console.error('Failed to insert report to cloud:', err));

                // 2. Update Plan
                window.SupabaseClient.db.update('audit_plans', String(plan.id), {
                    report_id: String(newReport.id),
                    status: 'Completed'
                }).catch(err => console.error('Failed to update plan in cloud:', err));
            }
        } else {
            window.showNotification('Please select an Audit Plan from the list', 'error');
        }
    };
}


function openEditReportModal(reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Edit Report Basic Info';
    modalBody.innerHTML = `
        <form id="report-form">
            <div class="form-group">
                <label>Client</label>
                <input type="text" class="form-control" value="${window.UTILS.escapeHtml(report.client)}" disabled>
            </div>
            <div class="form-group">
                <label>Audit Date</label>
                <input type="date" class="form-control" id="report-date" value="${report.date}" required>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="report-status">
                    <option ${report.status === window.CONSTANTS.STATUS.IN_PROGRESS ? 'selected' : ''}>${window.CONSTANTS.STATUS.IN_PROGRESS}</option>
                    <option ${report.status === window.CONSTANTS.STATUS.DRAFT ? 'selected' : ''}>${window.CONSTANTS.STATUS.DRAFT}</option>
                    <option ${report.status === window.CONSTANTS.STATUS.FINALIZED ? 'selected' : ''}>${window.CONSTANTS.STATUS.FINALIZED}</option>
                </select>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const date = document.getElementById('report-date').value;
        const status = document.getElementById('report-status').value;

        if (date) {
            report.date = date;
            report.status = status;

            window.saveData();
            window.closeModal();
            renderAuditExecutionEnhanced();
            window.showNotification('Report info updated successfully');
        }
    };
}

function deleteAuditReport(reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    // Confirm deletion
    const clientName = report.client || 'Unknown Client';
    const reportDate = report.date || 'N/A';

    if (!confirm(`Are you sure you want to delete this audit report?\n\nClient: ${clientName}\nDate: ${reportDate}\n\nThis action cannot be undone.`)) {
        return;
    }

    // Find and update the related audit plan
    const relatedPlan = state.auditPlans.find(p => String(p.reportId) === String(reportId));
    if (relatedPlan) {
        relatedPlan.reportId = null;
        relatedPlan.status = 'Scheduled'; // Reset to scheduled
    }

    // Remove from state
    const index = state.auditReports.findIndex(r => String(r.id) === String(reportId));
    if (index > -1) {
        state.auditReports.splice(index, 1);
    }

    // Save to local storage
    window.saveData();

    // Delete from Supabase if online
    if (window.navigator.onLine && window.SupabaseClient && window.SupabaseClient.isInitialized) {
        (async () => {
            try {
                // Delete the report
                await window.SupabaseClient.db.delete('audit_reports', String(reportId));

                // Update the plan if exists
                if (relatedPlan) {
                    await window.SupabaseClient.db.update('audit_plans', String(relatedPlan.id), {
                        report_id: null,
                        status: 'Scheduled'
                    });
                }

                window.showNotification('Audit report deleted successfully', 'success');
            } catch (error) {
                console.error('Failed to delete from database:', error);
                window.showNotification('Report deleted locally, but cloud sync failed', 'warning');
            }
        })();
    } else {
        window.showNotification('Audit report deleted (local only - offline)', 'success');
    }

    // Refresh the view
    renderAuditExecutionEnhanced();
}

// Export functions for use in other modules (e.g., client-workspace.js)
window.deleteAuditReport = deleteAuditReport;
window.openEditReportModal = openEditReportModal;

function renderExecutionDetail(reportId) {
    const report = state.auditReports.find(r => String(r.id) === String(reportId));
    if (!report) return;

    // Calculate Progress
    // Calculate Progress
    // Fetch Data & Calculate Progress
    const plan = report.planId ? state.auditPlans.find(p => String(p.id) === String(report.planId)) : state.auditPlans.find(p => p.client === report.client);

    // Fetch Client Departments & Designations
    const clientData = state.clients.find(c => c.name === report.client);
    const departments = clientData && clientData.departments && clientData.departments.length > 0
        ? clientData.departments.map(d => d.name || d)
        : ['Management', 'Production', 'Quality', 'Store', 'Maintenance', 'HR', 'Sales'];
    // Collect designations from client designations + contact designations
    const designations = Array.from(new Set([
        ...((clientData && clientData.designations) || []).map(d => d.title || d),
        ...((clientData && clientData.contacts) || []).map(c => c.designation).filter(Boolean)
    ]));
    // Collect audit team members
    const auditTeam = [];
    if (plan) {
        if (plan.team && Array.isArray(plan.team)) {
            plan.team.forEach((name, i) => auditTeam.push({ name, role: i === 0 ? 'Lead Auditor' : 'Team Auditor' }));
        } else if (plan.auditors && Array.isArray(plan.auditors)) {
            plan.auditors.forEach((id, i) => {
                const a = (state.auditors || []).find(x => x.id == id);
                if (a) auditTeam.push({ name: a.name, role: i === 0 ? 'Lead Auditor' : (a.role || 'Team Auditor') });
            });
        }
        if (plan.lead && !auditTeam.some(a => a.name === plan.lead)) {
            auditTeam.unshift({ name: plan.lead, role: 'Lead Auditor' });
        }
    }
    // Client personnel for attendee picker
    const clientPersonnel = ((clientData && clientData.contacts) || []).map(c => ({
        name: c.name, role: c.designation || '', organization: clientData?.name || report.client
    }));

    const planChecklists = plan?.selectedChecklists || [];
    const checklists = state.checklists || [];
    const assignedChecklists = planChecklists.map(clId => checklists.find(c => String(c.id) === String(clId))).filter(c => c);
    const customItems = report.customItems || [];

    // Create lookup
    const progressMap = {};
    (report.checklistProgress || []).forEach(p => {
        const key = p.isCustom ? `custom-${p.itemIdx}` : `${p.checklistId}-${p.itemIdx}`;
        progressMap[key] = p;
    });

    // Calculate stats
    const allItems = [];
    const selectionMap = plan?.selectedChecklistItems || {};
    const overridesMap = plan?.selectedChecklistOverrides || {};

    assignedChecklists.forEach(cl => {
        const allowedIds = selectionMap[cl.id]; // Array of strings/ints or undefined
        const isSelective = Array.isArray(allowedIds) && allowedIds.length > 0;

        if (cl.clauses) {
            cl.clauses.forEach(clause => {
                clause.subClauses.forEach((item, subIdx) => {
                    const itemId = `${clause.mainClause}-${subIdx}`;
                    // IF selective mode AND this ID is NOT in the list, skip it.
                    if (isSelective && !allowedIds.includes(itemId)) {
                        return;
                    }

                    allItems.push({ checklistId: cl.id, itemIdx: itemId });
                });
            });
        } else {
            (cl.items || []).forEach((item, idx) => {
                const itemId = String(idx); // Standardize to string for comparison usually, but ID in UI was idx
                // UI saved it as attribute, which is string.

                if (isSelective && !allowedIds.map(String).includes(String(idx))) {
                    return;
                }
                allItems.push({ checklistId: cl.id, itemIdx: idx });
            });
        }
    });

    customItems.forEach((item, idx) => {
        allItems.push({ checklistId: 'custom', itemIdx: idx, isCustom: true });
    });

    const totalItems = allItems.length;
    const conformCount = allItems.filter(item => {
        const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
        return progressMap[key]?.status === 'conform';
    }).length;
    const ncCount = allItems.filter(item => {
        const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
        return progressMap[key]?.status === 'nc';
    }).length;
    const naCount = allItems.filter(item => {
        const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
        return progressMap[key]?.status === 'na';
    }).length;
    const answeredCount = conformCount + ncCount + naCount;
    const pendingCount = totalItems - answeredCount;
    const progressPct = totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0;


    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="window.handleBackToExecutionList()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reports
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">Audit Execution: ${report.client}</h2>
                        <p style="color: var(--text-secondary);">Audit Date: ${report.date} | Status: ${report.status}</p>
                    </div>
                    <button class="btn btn-primary" onclick="window.generateAuditReport('${report.id}')">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Generate Report
                    </button>
                </div>

                    <!-- Progress Dashboard -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1.5rem; border-radius: 12px; margin-top: 1rem; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 2rem; align-items: center;">
                            <!-- Progress Ring -->
                            <div style="position: relative; width: 120px; height: 120px;">
                                <svg class="progress-ring" width="120" height="120">
                                    <circle class="progress-ring-circle" stroke="#ffffff33" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"/>
                                    <circle class="progress-ring-circle" stroke="#ffffff" stroke-width="8" fill="transparent" r="52" cx="60" cy="60"
                                        style="stroke-dasharray: ${2 * Math.PI * 52}; stroke-dashoffset: ${2 * Math.PI * 52 * (1 - progressPct / 100)}; stroke-linecap: round;"/>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                    <div style="font-size: 1.75rem; font-weight: bold;">${progressPct}%</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9;">Complete</div>
                                </div>
                            </div>
                            
                            <!-- Stats Grid -->
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                                <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${totalItems}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 0.25rem;">Total Items</div>
                                </div>
                                <div style="text-align: center; background: rgba(16, 185, 129, 0.3); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${conformCount}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 0.25rem;">Conformities</div>
                                </div>
                                <div style="text-align: center; background: rgba(239, 68, 68, 0.3); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${ncCount}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 0.25rem;">Non-Conform.</div>
                                </div>
                                <div style="text-align: center; background: rgba(156, 163, 175, 0.3); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${pendingCount}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 0.25rem;">Pending</div>
                                </div>
                            </div>
                        </div>
                    </div>
                

            </div>

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn" data-tab="meetings" style="background: #eff6ff; color: #1d4ed8;">
                    <i class="fa-solid fa-handshake" style="margin-right: 0.25rem;"></i>Meetings
                </button>
                <button class="tab-btn active" data-tab="checklist">Checklist</button>
                <button class="tab-btn" data-tab="ncr">NCRs</button>
                <button class="tab-btn" data-tab="capa">CAPA</button>
                <button class="tab-btn" data-tab="review">
                    <i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i> Review & Submit
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
            renderExecutionTab(report, e.target.getAttribute('data-tab'), { assignedChecklists, progressMap, customItems, departments, designations, auditTeam, clientPersonnel, clientData, plan, selectionMap, overridesMap });
        });
    });

    renderExecutionTab(report, 'checklist', { assignedChecklists, progressMap, customItems, departments, designations, auditTeam, clientPersonnel, clientData, plan, selectionMap, overridesMap });
}

function renderExecutionTab(report, tabName, contextData = {}) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'checklist':
            const { assignedChecklists = [], progressMap = {}, customItems = [], departments = [], designations = [], auditTeam = [], clientPersonnel = [], clientData = null, plan = null, selectionMap = {}, overridesMap = {} } = contextData;


            // Helper to render row
            const renderRow = (item, checklistId, idx, isCustom = false) => {
                const uniqueId = isCustom ? `custom-${idx}` : `${checklistId}-${idx}`;
                const saved = progressMap[uniqueId] || {};
                const s = saved.status || ''; // 'conform', 'nc', 'na' or ''

                // APPLY LOCAL OVERRIDES
                const getNestedReq = (obj) => { if (!obj || !obj.items || !obj.items[0]) return null; return obj.items[0].requirement; };
                let requirementText = item.requirement || item.text || item.title || item.requirement_text || getNestedReq(item) || 'No requirement text provided';
                if (overridesMap && overridesMap[checklistId] && overridesMap[checklistId][idx]) {
                    requirementText = overridesMap[checklistId][idx];
                }

                return `
                    <div class="card checklist-item" id="row-${uniqueId}" style="margin-bottom: 0.5rem; padding: 1rem; border-left: 4px solid #e2e8f0;">
                         <div style="display: grid; grid-template-columns: 30px 80px 1fr 180px; gap: 1rem; align-items: start;">
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" class="item-checkbox" data-unique-id="${uniqueId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select this item for bulk action">
                            </div>
                            <div style="font-weight: bold; color: var(--primary-color);">${item.clause || 'N/A'}</div>
                            <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(requirementText)}</div>
                                <div style="position: relative;">
                                    <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.comment || '')}" style="margin-bottom: 0; padding-right: 35px;">
                                    <button type="button" id="mic-btn-${uniqueId}" onclick="window.startDictation('${uniqueId}')" style="position: absolute; right: 0; top: 0; height: 100%; width: 35px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;" title="Dictate to Remarks">
                                        <i class="fa-solid fa-microphone"></i>
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button type="button" class="btn-icon btn-na status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NA}" title="Not Applicable">N/A</button>
                                <button type="button" class="btn-icon btn-ok status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.CONFORM}" title="Conformity"><i class="fa fa-check"></i></button>
                                <button type="button" class="btn-icon btn-nc status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NC}" title="Non-Conformity"><i class="fa fa-times"></i></button>
                            </div>
                         </div>
                         
                         <!-- Evidence Photos (available for ALL statuses) -->
                         <div style="margin-top: 0.75rem; padding: 0.5rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                             <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                                 <label style="font-size: 0.78rem; font-weight: 600; color: #475569; margin: 0;"><i class="fa-solid fa-images" style="margin-right: 0.25rem; color: #6366f1;"></i>Evidence Photos</label>
                                 <div style="display: flex; gap: 4px;">
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #6366f1; color: white; border: none; border-radius: 4px;" onclick="document.getElementById('img-${uniqueId}').click()" title="Upload image">
                                         <i class="fa-solid fa-file-image"></i> Upload
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #0ea5e9; color: white; border: none; border-radius: 4px;" onclick="window.handleCameraButton('${uniqueId}')" title="Camera">
                                         <i class="fa-solid fa-camera"></i>
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #8b5cf6; color: white; border: none; border-radius: 4px;" onclick="window.captureScreenEvidence('${uniqueId}')" title="Screen capture">
                                         <i class="fa-solid fa-desktop"></i>
                                     </button>
                                 </div>
                             </div>
                             <!-- Multi-image preview strip -->
                             <div id="evidence-preview-${uniqueId}" style="display: ${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'flex' : 'none'}; flex-wrap: wrap; gap: 6px; align-items: center;">
                                 ${(function () {
                        const imgs = saved.evidenceImages || (saved.evidenceImage ? [saved.evidenceImage] : []);
                        return imgs.map((src, imgIdx) => {
                            const isIdb = src.startsWith('idb://');
                            const displaySrc = isIdb ? '' : src;
                            const safeSrc = displaySrc.replace(/'/g, "\\'");
                            return `
                                         <div class="ev-thumb" data-idx="${imgIdx}" data-save-url="${window.UTILS.escapeHtml(src)}" style="position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;">
                                             <img src="${displaySrc}" data-idb-key="${isIdb ? window.UTILS.escapeHtml(src) : ''}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;${isIdb ? ' background: #e2e8f0;' : ''}" onclick="window.viewEvidenceImageByUrl(this.src || '${safeSrc}')"/>
                                             <button type="button" onclick="window.removeEvidenceByIdx('${uniqueId}', ${imgIdx})" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">×</button>
                                         </div>
                                     `;
                        }).join('');
                    })()}
                             </div>
                             <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" onchange="window.handleEvidenceUpload('${uniqueId}', this)">
                             <input type="file" id="cam-${uniqueId}" accept="image/*" capture="environment" style="display: none;" onchange="window.handleEvidenceUpload('${uniqueId}', this)">
                             <input type="hidden" id="evidence-data-${uniqueId}" value="${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'attached' : ''}">
                         </div>
                         
                         <!-- Hidden status input -->
                         <input type="hidden" class="status-input" data-checklist="${checklistId}" data-item="${idx}" data-custom="${isCustom}" data-clause="${window.UTILS.escapeHtml(item.clause || '')}" data-requirement="${window.UTILS.escapeHtml(requirementText || '')}" id="status-${uniqueId}" value="${s}">
                         
                         <!-- NCR Panel (Conditional) -->
                         <div id="ncr-panel-${uniqueId}" class="ncr-panel" style="display: ${s === 'nc' ? 'block' : 'none'}; background: #fff1f2; border: 1px solid #fecaca; padding: 1rem; margin-top: 1rem; border-radius: 6px;">
                             <h5 style="color: var(--danger-color); margin-bottom: 0.5rem; display: flex; align-items: center;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i> Non-Conformity Details</h5>
                             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Severity</label>
                                     <div style="display: flex; gap: 5px;">
                                         <select id="ncr-type-${uniqueId}" class="form-control form-control-sm">
                                             <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${!saved.ncrType || saved.ncrType === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation (OBS)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor NC</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major NC</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.PENDING}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.PENDING ? 'selected' : ''}>Pending Classification</option>
                                         </select>
                                         <button type="button" class="btn btn-sm btn-info" onclick="const el = document.getElementById('criteria-${uniqueId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'" title="View Classification Matrix (ISO 17021-1)">
                                            <i class="fa-solid fa-scale-balanced"></i>
                                         </button>
                                     </div>
                                     <div id="criteria-${uniqueId}" style="display: none; position: absolute; background: white; border: 1px solid #ccc; padding: 10px; z-index: 100; width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 4px; font-size: 0.8rem; margin-top: 5px;">
                                        <strong>ISO 17021-1 Criteria</strong>
                                        <div style="margin-top:5px; border-left: 3px solid var(--danger-color); padding-left: 5px; background: #fff5f5;">
                                            <strong>Major:</strong> ${window.CONSTANTS.NCR_CRITERIA.MAJOR.description}
                                        </div>
                                        <div style="margin-top:5px; border-left: 3px solid var(--warning-color); padding-left: 5px; background: #fffaf0;">
                                            <strong>Minor:</strong> ${window.CONSTANTS.NCR_CRITERIA.MINOR.description}
                                        </div>
                                        <div style="text-align: right; margin-top: 5px;"><small style="color: blue; cursor: pointer;" onclick="this.parentElement.parentElement.style.display='none'">Close</small></div>
                                     </div>
                                 </div>
                                 </div>
                             </div>
                             
                             <!-- Cross-Reference: Designation & Department -->
                             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Interviewee Designation</label>
                                     <select id="ncr-designation-${uniqueId}" class="form-control form-control-sm">
                                        <option value="">-- Select --</option>
                                        ${designations.map(d => `<option value="${window.UTILS.escapeHtml(d)}" ${saved.designation === d ? 'selected' : ''}>${window.UTILS.escapeHtml(d)}</option>`).join('')}
                                        ${saved.designation && !designations.includes(saved.designation) ? `<option value="${window.UTILS.escapeHtml(saved.designation)}" selected>${window.UTILS.escapeHtml(saved.designation)}</option>` : ''}
                                     </select>
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Department</label>
                                     <select id="ncr-department-${uniqueId}" class="form-control form-control-sm">
                                        <option value="">-- Select --</option>
                                        ${departments.map(d => `<option value="${window.UTILS.escapeHtml(d)}" ${saved.department === d ? 'selected' : ''}>${window.UTILS.escapeHtml(d)}</option>`).join('')}
                                        ${saved.department && !departments.includes(saved.department) ? `<option value="${window.UTILS.escapeHtml(saved.department)}" selected>${window.UTILS.escapeHtml(saved.department)}</option>` : ''}
                                     </select>
                                 </div>
                             </div>
                             


                         </div>
                    </div>
                `;
            };

            let checklistHTML = '';

            if (assignedChecklists.length > 0) {
                checklistHTML = assignedChecklists.map(checklist => {
                    // Support both old (items) and new (clauses) format
                    const useClauses = checklist.clauses && checklist.clauses.length > 0;

                    if (useClauses) {
                        // New hierarchical format with accordion
                        let itemIdx = 0;
                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; margin-bottom: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    <i class="fa-solid fa-clipboard-list" style="color: var(--primary-color); -webkit-text-fill-color: #667eea;"></i> ${checklist.name}
                                </h4>
                                ${checklist.clauses.map((clause, clauseIdx) => {
                            const allowedIds = selectionMap[checklist.id];
                            const isSelective = Array.isArray(allowedIds) && allowedIds.length > 0;

                            // Filter valid items first
                            const itemsToRender = clause.subClauses
                                .map((item, subIdx) => ({ item, itemId: `${clause.mainClause}-${subIdx}` }))
                                .filter(obj => !isSelective || allowedIds.includes(obj.itemId));

                            if (itemsToRender.length === 0) return ''; // Skip empty clauses

                            const sectionId = `clause-${checklist.id}-${clause.mainClause}`;
                            const renderedItems = itemsToRender.map(obj => {
                                const globalIdx = itemIdx++;
                                return renderRow(obj.item, checklist.id, obj.itemId, false);
                            }).join('');

                            // Calculate progress for this section
                            const sectionProgress = itemsToRender.map(obj => {
                                const key = `${checklist.id}-${obj.itemId}`;
                                return progressMap[key]?.status || '';
                            });
                            const completed = sectionProgress.filter(s => s === 'conform' || s === 'nc' || s === 'na').length;
                            const total = itemsToRender.length;
                            const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return `
                                        <div class="accordion-section" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                            <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); user-select: none;">
                                                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                                                    <input type="checkbox" class="section-checkbox" data-section-id="${sectionId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select all items in this section">
                                                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; cursor: pointer;" onclick="window.toggleAccordion('${sectionId}')">Clause ${clause.mainClause}</span>
                                                    <span style="font-weight: 600; color: #1e293b; cursor: pointer; flex: 1;" onclick="window.toggleAccordion('${sectionId}')">${clause.title}</span>
                                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">(${total} items)</span>
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 1rem;">
                                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${completed}/${total}</span>
                                                    <i class="fa-solid fa-chevron-down accordion-icon" id="icon-${sectionId}" style="transition: transform 0.3s; cursor: pointer;" onclick="window.toggleAccordion('${sectionId}')"></i>
                                                </div>
                                            </div>
                                            <div class="accordion-content" id="${sectionId}" style="display: ${clauseIdx === 0 ? 'block' : 'none'}; padding: 1rem; background: white;">
                                                ${renderedItems}
                                            </div>
                                        </div>
                                    `;
                        }).join('')}
                            </div>
                        `;
                    } else {
                        // Fallback for old flat format
                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: var(--primary-color);">
                                    ${checklist.name}
                                </h4>
                                ${(checklist.items || []).map((item, idx) => renderRow(item, checklist.id, idx, false)).join('')}
                            </div>
                        `;
                    }
                }).join('');
            } else {
                checklistHTML = `<div class="alert alert-warning">No configured checklists found.</div>`;
            }

            // Custom Items Section
            if (customItems.length > 0) {
                checklistHTML += `
                    <div style="margin-bottom: 2rem; margin-top: 2rem;">
                         <h4 style="border-bottom: 2px solid var(--warning-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: #d97706;">
                            <i class="fa-solid fa-pen-to-square"></i> Custom Audit Questions
                        </h4>
                        ${customItems.map((item, idx) => renderRow(item, 'custom', idx, true)).join('')}
                    </div>
                `;
            }



            tabContent.innerHTML = `
                <style>
                    .btn-icon { border: 1px solid #d1d5db; background: white; width: 32px; height: 32px; border-radius: 4px; color: #6b7280; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; cursor: pointer; }
                    .btn-icon:hover { background: #f3f4f6; }
                    .btn-icon.active { transform: scale(1.1); font-weight: bold; border-color: transparent; }
                    .btn-icon.btn-ok.active { background: var(--success-color); color: white; }
                    .btn-icon.btn-nc.active { background: var(--danger-color); color: white; }
                    .btn-icon.btn-na.active { background: #9ca3af; color: white; }
                    .checklist-item:focus-within { border-color: var(--primary-color) !important; background: #f0f9ff !important; }
                    .checklist-item.filtered-out { display: none !important; }
                    .progress-ring { transform: rotate(-90deg); }
                    .progress-ring-circle { transition: stroke-dashoffset 0.5s; }
                    .filter-btn { padding: 0.5rem 1rem; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
                    .filter-btn:hover { background: #f8fafc; }
                    .filter-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                    .save-indicator { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 1000; animation: slideIn 0.3s; }
                    @keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    .keyboard-hint { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; z-index: 999; }
                </style>
                <div>


                    <!-- Filters & Actions Bar -->
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100;">

                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" onclick="window.addCustomQuestion('${report.id}')">
                                <i class="fa-solid fa-plus-circle" style="margin-right: 0.5rem;"></i> Add Question
                            </button>
                            <div style="position: relative;">
                                <button class="btn btn-outline-secondary" onclick="document.getElementById('bulk-menu-${report.id}').classList.toggle('hidden')">
                                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i> Bulk Actions
                                </button>
                                <div id="bulk-menu-${report.id}" class="hidden" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px; z-index: 1000;">
                                    <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Mark Items As:</div>
                                    </div>
                                    <button class="bulk-action-btn" data-action="conform" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                                        <i class="fa-solid fa-check" style="color: var(--success-color); width: 18px;"></i>
                                        <span>Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="nc" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                                        <i class="fa-solid fa-times" style="color: var(--danger-color); width: 18px;"></i>
                                        <span>Non-Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="na" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                                        <i class="fa-solid fa-ban" style="color: #9ca3af; width: 18px;"></i>
                                        <span>Not Applicable</span>
                                    </button>
                                    <div style="border-top: 1px solid #e2e8f0; padding: 0.75rem 1rem;">
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-info-circle"></i> Select items to limit scope
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-primary" onclick="window.saveChecklist('${report.id}')" id="save-progress-btn">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                            </button>
                        </div>
                    </div>

                    ${checklistHTML}
                    
                    <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                        <button class="btn btn-primary btn-lg" onclick="window.saveChecklist('${report.id}')">
                            <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Save All Progress
                        </button>
                    </div>
                </div>

                <!-- Save Indicator -->
                <div class="save-indicator" id="save-indicator">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Progress Saved
                </div>

            `;

            // Setup event delegation for section checkboxes & bulk actions
            setTimeout(() => {
                document.querySelectorAll('.section-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function (e) {
                        e.stopPropagation();
                        const sectionId = this.getAttribute('data-section-id');
                        window.Logger.debug('Execution', 'Checkbox clicked for section:', sectionId);
                        window.toggleSectionSelection(sectionId, this);

                        // Sync individual item checkboxes
                        const section = document.getElementById(sectionId);
                        if (section) {
                            section.querySelectorAll('.item-checkbox').forEach(cb => {
                                cb.checked = this.checked;
                            });
                        }
                    });
                });

                // Item checkbox listener
                document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function () {
                        const uniqueId = this.getAttribute('data-unique-id');
                        const item = document.getElementById('row-' + uniqueId);
                        if (this.checked) {
                            item.classList.add('selected-item');
                            item.style.background = '#eff6ff';
                            item.style.borderLeft = '4px solid var(--primary-color)';
                        } else {
                            item.classList.remove('selected-item');
                            item.style.background = '';
                            item.style.borderLeft = '4px solid #e2e8f0';
                        }
                    });
                });

                // Setup bulk action button listeners
                document.querySelectorAll('.bulk-action-btn').forEach(btn => {
                    btn.addEventListener('click', function () {
                        const action = this.getAttribute('data-action');
                        const reportId = parseInt(this.getAttribute('data-report-id'));
                        window.Logger.debug('Execution', 'Bulk action clicked:', { action, reportId });
                        window.bulkUpdateStatus(reportId, action);
                    });
                });

                // CRITICAL: Restore saved status to buttons after render
                document.querySelectorAll('.status-input').forEach(input => {
                    const uniqueId = input.id.replace('status-', '');
                    const savedStatus = input.value; // 'conform', 'nc', 'na', or ''

                    if (savedStatus) {
                        // Apply active state to the corresponding button
                        window.setChecklistStatus(uniqueId, savedStatus);
                    }
                });
            }, 100);

            break;

        case 'ncr':
            // Combine Manual NCRs and Checklist-marked NCs for real-time display
            const manualNCRs = report.ncrs || [];

            // Get checklist-marked NCs from checklistProgress
            const checklistNCRs = (report.checklistProgress || [])
                .filter(item => item.status === 'nc')
                .map((item, idx) => {
                    // Resolve clause from checklist definition
                    let clauseText = 'Checklist Item';
                    let reqText = '';
                    const { assignedChecklists = [] } = contextData;

                    if (item.checklistId && assignedChecklists.length > 0) {
                        const cl = assignedChecklists.find(c => String(c.id) === String(item.checklistId));
                        if (cl) {
                            if (cl.clauses && (String(item.itemIdx).includes('-'))) {
                                const [mainClauseVal, subIdxVal] = String(item.itemIdx).split('-');
                                const mainObj = cl.clauses.find(m => m.mainClause == mainClauseVal);
                                if (mainObj && mainObj.subClauses && mainObj.subClauses[subIdxVal]) {
                                    clauseText = mainObj.subClauses[subIdxVal].clause || `Clause ${mainClauseVal}`;
                                    reqText = mainObj.subClauses[subIdxVal].requirement || '';
                                }
                            } else if (cl.items && cl.items[item.itemIdx]) {
                                clauseText = cl.items[item.itemIdx].clause || 'Checklist Item';
                                reqText = cl.items[item.itemIdx].requirement || '';
                            }
                        }
                    } else if (item.isCustom) {
                        const customItem = (report.customItems || [])[item.itemIdx];
                        if (customItem) {
                            clauseText = customItem.clause || 'Custom Question';
                            reqText = customItem.requirement || '';
                        }
                    }

                    return {
                        type: item.ncrType || window.CONSTANTS.NCR_TYPES.OBSERVATION,
                        clause: clauseText,
                        description: item.ncrDescription || item.comment || reqText || 'Non-conformity identified in checklist',
                        status: 'Open',
                        source: 'checklist',
                        department: item.department || '',
                        designation: item.designation || '',
                        evidenceImage: item.evidenceImage
                    };
                });

            // Combine all NCRs
            const allNCRs = [
                ...manualNCRs.map(ncr => ({ ...ncr, source: 'manual' })),
                ...checklistNCRs
            ];

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <div>
                            <h3>Non-Conformity Reports (NCRs)</h3>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">
                                Showing ${allNCRs.length} finding(s) - ${manualNCRs.length} manual, ${checklistNCRs.length} from checklist
                            </p>
                        </div>
                        <button class="btn btn-primary" onclick="createNCR('${report.id}')">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create NCR
                        </button>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>NCR #</th>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th>Clause</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allNCRs.length > 0 ? allNCRs.map((ncr, idx) => `
                                    <tr>
                                        <td>NCR-${String(idx + 1).padStart(3, '0')}</td>
                                        <td><span style="background: ${ncr.source === 'manual' ? '#3b82f6' : '#8b5cf6'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${ncr.source === 'manual' ? 'Manual' : 'Checklist'}</span></td>
                                        <td><span style="background: ${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'var(--danger-color)' : ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'var(--warning-color)' : '#9ca3af'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'Major' : ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'Minor' : 'Obs'}</span></td>
                                        <td>${window.UTILS.escapeHtml(ncr.clause || '-')}</td>
                                        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UTILS.escapeHtml(ncr.description || '-')}">${window.UTILS.escapeHtml(ncr.description || '-')}</td>
                                        <td><span style="background: ${ncr.status === window.CONSTANTS.STATUS.CLOSED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.status || 'Open'}</span></td>
                                        <td><button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button></td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                                            No NCRs raised yet. Mark items as NC in the Checklist tab or click "Create NCR" to add manually.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;

        case 'capa':
            const capas = report.capas || [];
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Corrective & Preventive Actions (CAPA)</h3>
                        <button class="btn btn-primary" onclick="createCAPA('${report.id}')">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create CAPA
                        </button>
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>CAPA #</th>
                                    <th>Linked NCR</th>
                                    <th>Root Cause</th>
                                    <th>Action Plan</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${capas.length > 0 ? capas.map((capa, idx) => `
                                    <tr>
                                        <td>CAPA-${String(idx + 1).padStart(3, '0')}</td>
                                        <td>${capa.linkedNCR || '-'}</td>
                                        <td>${capa.rootCause || '-'}</td>
                                        <td>${capa.actionPlan || '-'}</td>
                                        <td>${capa.dueDate || '-'}</td>
                                        <td><span style="background: ${capa.status === window.CONSTANTS.STATUS.COMPLETED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${capa.status || window.CONSTANTS.STATUS.IN_PROGRESS}</span></td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No CAPAs created yet</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;

        case 'observations':
            // Redirect to Unified Review Tab
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab for unified reporting.</div>`;
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'review': {
            // UNIFIED DASHBOARD: MERGES REVIEW & SUMMARY
            // Auditor's Findings Review & Final Submission Screen
            const allFindings = [];
            // Cache evidence images for viewing from Review tab
            if (!window._evidenceCache) window._evidenceCache = {};

            // Destructure for lookup
            const { assignedChecklists = [] } = contextData;

            // Known bad values from old DOM scraping — filter these out
            const BAD_VALUES = ['severity', 'non-conformity details', 'interviewee designation', 'department', 'evidence image', 'upload', 'camera', 'screen'];
            const isBadValue = (v) => !v || BAD_VALUES.includes(v.toLowerCase().trim());

            // Collect checklist NCs — use original index into checklistProgress
            (report.checklistProgress || []).forEach((item, originalIdx) => {
                if (item.status !== 'nc') return;
                // Use shared helper for clause/requirement resolution
                let { clauseText, reqText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);
                console.log(`[Review Findings] Item ${originalIdx}: checklistId=${item.checklistId}, itemIdx=${item.itemIdx}, clause=${clauseText}, req=${reqText?.substring(0, 60)}`);

                // Fallback: use clause/requirement saved directly on the progress item
                // BUT only if the saved values are not corrupted (from old DOM scraping)
                if (!clauseText && item.clause && !isBadValue(item.clause)) clauseText = item.clause;
                if (!reqText && item.requirement && !isBadValue(item.requirement)) reqText = item.requirement;

                // KB Lookup: Get actual ISO Standard requirement text from Knowledge Base
                const kbMatch = window.KB_HELPERS.lookupKBRequirement(clauseText, report.standard);

                allFindings.push({
                    id: `checklist-${originalIdx}`,
                    source: 'Checklist',
                    type: item.ncrType || 'observation',
                    // Don't repeat reqText here — it's already shown in the requirement box above
                    description: item.ncrDescription || item.comment || item.transcript || '',
                    remarks: item.comment || item.transcript || '',
                    designation: item.designation || '',
                    department: item.department || '',
                    hasEvidence: !!(item.evidenceImage || (item.evidenceImages && item.evidenceImages.length)),
                    evidenceImage: item.evidenceImage,
                    evidenceImages: item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []),
                    clause: clauseText,
                    requirement: reqText && !isBadValue(reqText) ? reqText : '',
                    kbMatch: kbMatch
                });
                const evImgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                if (evImgs.length) window._evidenceCache[`checklist-${originalIdx}`] = evImgs;
            });

            // Collect manual NCRs
            (report.ncrs || []).forEach((ncr, idx) => {
                allFindings.push({
                    id: `ncr-${idx}`,
                    source: 'Manual',
                    type: ncr.type || 'observation',
                    description: ncr.description || '',
                    remarks: ncr.remarks || '',
                    designation: ncr.designation || '',
                    department: ncr.department || '',
                    hasEvidence: !!ncr.evidenceImage,
                    evidenceImage: ncr.evidenceImage
                });
                if (ncr.evidenceImage) window._evidenceCache[`ncr-${idx}`] = ncr.evidenceImage;
            });

            const isReadyToSubmit = allFindings.length === 0 || allFindings.every(f => f.type !== 'pending');
            const currentUserRole = window.state.currentUser?.role || 'Auditor';
            const canOneClickFinalize = ['Lead Auditor', 'Admin', 'Certification Manager', 'Manager'].includes(currentUserRole);

            let primaryActionBtn = '';

            if (report.status === window.CONSTANTS.STATUS.FINALIZED || report.status === window.CONSTANTS.STATUS.PUBLISHED) {
                primaryActionBtn = `
                    <button class="btn btn-secondary" onclick="window.generateAuditReport('${report.id}')">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Download PDF
                    </button>
                `;
            } else if (canOneClickFinalize) {
                primaryActionBtn = `
                    <button class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);" onclick="window.finalizeAndPublish('${report.id}')" ${!isReadyToSubmit ? 'disabled' : ''}>
                        <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Finalize & Publish
                    </button>
                `;
            } else {
                primaryActionBtn = `
                   <button class="btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none;" onclick="window.submitToLeadAuditor('${report.id}')" ${!isReadyToSubmit ? 'disabled' : ''}>
                        <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit for Review
                    </button>
                `;
            }


            tabContent.innerHTML = `
                <div class="card" style="border-top: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.5rem; background: linear-gradient(90deg, #1e293b, #475569); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                <i class="fa-solid fa-flag-checkered" style="color: var(--primary-color); -webkit-text-fill-color: initial; margin-right: 0.5rem;"></i> Audit Finalization
                            </h3>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.95rem;">Review findings, generate AI summaries, and finalize the report.</p>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                             <button class="btn btn-outline-secondary" onclick="window.saveChecklist('${report.id}')">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Draft
                            </button>
                            ${primaryActionBtn}
                        </div>
                    </div>

                    <!-- 1. High Level Stats -->
                     <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #3b82f6; line-height: 1;">${allFindings.length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Total Findings</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fee2e2; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #dc2626; line-height: 1;">${allFindings.filter(f => f.type === 'major').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Major NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fef3c7; box-shadow: 0 1px 3px rgba(217, 119, 6, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #d97706; line-height: 1;">${allFindings.filter(f => f.type === 'minor').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Minor NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #f3e8ff; box-shadow: 0 1px 3px rgba(139, 92, 246, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #8b5cf6; line-height: 1;">${allFindings.filter(f => f.type === 'observation').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Observations</div>
                        </div>
                    </div>
                    
                    <!-- 2. Findings Review -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Findings & Classification</h4>
                            <button id="btn-ai-classify" class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); border: none;" onclick="window.runFollowUpAIAnalysis('${report.id}')">
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify & Polish
                            </button>
                        </div>

                         ${allFindings.length > 0 ? `
                        <div style="max-height: 600px; overflow-y: auto; padding-right: 5px;">
                            ${allFindings.map((f, idx) => `
                                <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; border-left: 5px solid ${f.type === 'major' ? '#dc2626' : f.type === 'minor' ? '#d97706' : '#8b5cf6'}; transition: transform 0.2s;">
                                    <div style="display: grid; grid-template-columns: 1fr 180px 250px; gap: 1.5rem; align-items: start;">
                                        <!-- Finding Details Column -->
                                        <div>
                                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                                <span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${f.source}</span>
                                                <span style="font-weight: 700; color: #1e293b;">#${idx + 1}</span>
                                                ${f.hasEvidence ? `<span onclick="window.viewEvidenceImageDirect('${f.id}')" style="cursor: pointer; color: var(--primary-color); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-image"></i> View Evidence</span>` : ''}
                                            </div>
                                            ${f.clause || f.requirement ? `
                                                <div style="font-size: 0.85rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.75rem;">
                                                    <strong style="color: var(--primary-color);">${f.clause ? `${f.clause}` : 'Requirement'}:</strong> 
                                                    <span style="color: #334155;">${f.requirement || ''}</span>
                                                </div>
                                            ` : ''}
                                            ${f.kbMatch ? `
                                                <div style="font-size: 0.8rem; padding: 0.5rem 0.75rem; background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 6px; border-left: 3px solid #3b82f6; margin-bottom: 0.75rem; color: #1e40af;">
                                                    <strong><i class="fa-solid fa-book" style="margin-right: 4px;"></i>${f.kbMatch.standardName || 'ISO Standard'} — Clause ${f.kbMatch.clause}${f.kbMatch.title ? ': ' + f.kbMatch.title : ''}</strong>
                                                    <div style="margin-top: 4px; color: #334155; font-style: italic; line-height: 1.5;">${f.kbMatch.requirement}</div>
                                                </div>
                                            ` : ''}
                                            <div style="font-weight: 500; color: #334155; line-height: 1.5; margin-bottom: 0.5rem;">${f.description}</div>
                                            ${f.designation || f.department ? `
                                                <div style="font-size: 0.8rem; color: #64748b; display: flex; gap: 1rem;">
                                                    <span><i class="fa-solid fa-user" style="width: 14px;"></i> ${f.designation || '-'}</span> 
                                                    <span><i class="fa-solid fa-building" style="width: 14px;"></i> ${f.department || '-'}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <!--Severity Column-->
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Severity Classification</label>
                                            <select class="form-control form-control-sm review-severity" data-finding-id="${f.id}" style="font-size: 0.9rem; padding: 0.4rem;">
                                                <option value="observation" ${f.type === 'observation' ? 'selected' : ''}>Observation</option>
                                                <option value="minor" ${f.type === 'minor' ? 'selected' : ''}>Minor NC</option>
                                                <option value="major" ${f.type === 'major' ? 'selected' : ''}>Major NC</option>
                                            </select>
                                        </div>
                                        <!--Remarks Column-->
            <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Auditor Remarks / Notes</label>
                <textarea class="form-control form-control-sm review-remarks" data-finding-id="${f.id}" placeholder="Justification or internal notes..." rows="3" style="font-size: 0.85rem;">${f.remarks || ''}</textarea>
            </div>

                                    </div >
                                </div >
                `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0;">
                            <div style="width: 64px; height: 64px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; font-size: 2rem;">
                                <i class="fa-solid fa-check"></i>
                            </div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.2rem;">Detailed Audit Complete!</h4>
                            <p style="color: #64748b; margin: 0; max-width: 400px; margin: 0 auto;">No non-conformities were raised during this audit. You can proceed to generate the summary confirming full compliance.</p>
                        </div>
                    `}
                    </div>

                    <!-- 3. Executive Summary Generation -->
                    <div style="background: linear-gradient(to right, #f8fafc, #f1f5f9); padding: 2rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">
                                <i class="fa-solid fa-pen-nib" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Executive Summary & Reporting
                            </h4>
                             <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: none;" onclick="window.runAutoSummary('${report.id}')">
                                <i class="fa-solid fa-robot" style="margin-right: 0.5rem;"></i> AI Draft Summary
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                             <!-- Executive Summary -->
                             <div>
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Executive Summary</label>
                                <textarea id="exec-summary-${report.id}" class="form-control" rows="5" placeholder="Overall conclusion on the effectiveness of the management system...">${report.executiveSummary || ''}</textarea>
                             </div>
                        </div>

                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Positive Observations</h4>
                                <textarea id="positive-observations" class="form-control" rows="4" placeholder="Document good practices and positive findings...">${report.positiveObservations || ''}</textarea>
                            </div>
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Opportunities for Improvement</h4>
                                <textarea id="ofi" class="form-control" rows="4" placeholder="Suggestions for improvement (not non-conformities)...">${report.ofi || ''}</textarea>
                            </div>
                        </div>
                        

                        <!-- Meeting Records Summary (from Meetings Tab) -->
                        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.95rem; margin: 0; color: var(--text-secondary); text-transform: uppercase;">Meeting Records</h4>
                                <button class="btn btn-sm btn-outline-primary" onclick="document.querySelector('.tab-btn[data-tab=&quot;meetings&quot;]')?.click()">
                                    <i class="fa-solid fa-pen" style="margin-right: 0.25rem;"></i>Edit in Meetings Tab
                                </button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #2563eb;"><i class="fa-solid fa-door-open" style="margin-right: 0.25rem;"></i>Opening Meeting</label>
                                    ${report.openingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${report.openingMeeting.date} ${report.openingMeeting.time || ''}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.openingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a.name}${a.role ? ' - ' + a.role : ''}${a.organization ? ' (' + a.organization + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${att}</div>`; })()}
                                </div>
                                <div style="background: #fff7ed; padding: 1rem; border-radius: 8px; border: 1px dashed #fdba74;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #ea580c;"><i class="fa-solid fa-door-closed" style="margin-right: 0.25rem;"></i>Closing Meeting</label>
                                    ${report.closingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${report.closingMeeting.date} ${report.closingMeeting.time || ''}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.closingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a.name}${a.role ? ' - ' + a.role : ''}${a.organization ? ' (' + a.organization + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${att}</div>`; })()}
                                </div>
                            </div>
                        </div>

                        <!-- Audit Conclusion / Recommendation -->
                             <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Audit Conclusion & Recommendation</label>
                                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Recommended" ${report.recommendation === 'Recommended' ? 'checked' : ''} onchange="window.state.auditReports.find(r => String(r.id) === String('${report.id}')).recommendation = this.value; window.saveData();">
                                        <span style="margin-left: 0.5rem;">Recommended for Certification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Pending" ${report.recommendation === 'Pending' ? 'checked' : ''} onchange="window.state.auditReports.find(r => String(r.id) === String('${report.id}')).recommendation = this.value; window.saveData();">
                                        <span style="margin-left: 0.5rem;">Recommended Pending Plan Verification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Not Recommended" ${report.recommendation === 'Not Recommended' ? 'checked' : ''} onchange="window.state.auditReports.find(r => String(r.id) === String('${report.id}')).recommendation = this.value; window.saveData();">
                                        <span style="margin-left: 0.5rem;">Not Recommended (Major NCs)</span>
                                    </label>
                                </div>
                             </div>
                    </div>

                </div>
            `;
        }
            break;

        case 'summary':
            // LEGACY: Redirect to Finalization or Show Simplified View
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab.</div>`;
            // Auto switch
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'meetings': {
            // ISO 17021-1 Opening/Closing Meeting Records
            const openingMeeting = report.openingMeeting || {};
            const closingMeeting = report.closingMeeting || {};
            // Build attendee picker data
            const { auditTeam: mAuditTeam = [], clientPersonnel: mClientPersonnel = [], clientData: mClientData = null } = contextData;
            const cbName = window.state.settings?.orgName || window.state.settings?.cbName || 'CB';
            const clientOrgName = mClientData?.name || report.client || 'Client';
            // Parse existing attendees to check who's already selected
            const parseExisting = (att) => {
                if (!att) return [];
                if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? a.name : a);
                return att.split('\n').map(l => l.split('-')[0].trim()).filter(Boolean);
            };
            const existingOpeningNames = parseExisting(openingMeeting.attendees);
            const existingClosingNames = parseExisting(closingMeeting.attendees);

            const buildAttendeeSection = (prefix, existingNames) => {
                let html = '<div style="margin-bottom: 1rem;">';
                // Audit Team section
                if (mAuditTeam.length > 0) {
                    html += '<div style="margin-bottom: 0.75rem;"><div style="font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;"><i class="fa-solid fa-user-shield" style="margin-right: 0.25rem;"></i>Audit Team</div>';
                    mAuditTeam.forEach(a => {
                        const checked = existingNames.includes(a.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-name="${(a.name || '').replace(/"/g, '&quot;')}" data-role="${(a.role || '').replace(/"/g, '&quot;')}" data-org="${cbName.replace(/"/g, '&quot;')}" ${checked} style="width: 16px; height: 16px;">`;
                        html += `<span style="font-weight: 500;">${a.name}</span><span style="color: #64748b; font-size: 0.8rem;">– ${a.role}</span>`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Client Personnel section
                if (mClientPersonnel.length > 0) {
                    html += '<div style="margin-bottom: 0.75rem;"><div style="font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;"><i class="fa-solid fa-building" style="margin-right: 0.25rem;"></i>Client Personnel</div>';
                    mClientPersonnel.forEach(p => {
                        const checked = existingNames.includes(p.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-name="${(p.name || '').replace(/"/g, '&quot;')}" data-role="${(p.role || '').replace(/"/g, '&quot;')}" data-org="${clientOrgName.replace(/"/g, '&quot;')}" ${checked} style="width: 16px; height: 16px;">`;
                        html += `<span style="font-weight: 500;">${p.name}</span>${p.role ? `<span style="color: #64748b; font-size: 0.8rem;">– ${p.role}</span>` : ''}`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Custom add
                html += `<div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">`;
                html += `<input type="text" id="${prefix}-custom-name" class="form-control form-control-sm" placeholder="Name" style="flex: 2;">`;
                html += `<input type="text" id="${prefix}-custom-role" class="form-control form-control-sm" placeholder="Role" style="flex: 1.5;">`;
                html += `<input type="text" id="${prefix}-custom-org" class="form-control form-control-sm" placeholder="Organization" style="flex: 1.5;">`;
                html += `<button class="btn btn-sm btn-outline-primary" onclick="window.addCustomMeetingAttendee('${prefix}')"><i class="fa-solid fa-plus"></i></button>`;
                html += '</div>';
                // Custom attendees list
                html += `<div id="${prefix}-custom-list" style="margin-top: 0.5rem;"></div>`;
                html += '</div>';
                return html;
            };

            tabContent.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Opening Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #16a34a; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #16a34a;">
                            <i class="fa-solid fa-door-open" style="margin-right: 0.5rem;"></i>Opening Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="opening-date" class="form-control" value="${openingMeeting.date || report.date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="opening-time" class="form-control" value="${openingMeeting.time || '09:00'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('opening', existingOpeningNames)}
                        </div>
                        <div class="form-group">
                            <label>Meeting Notes</label>
                            <textarea id="opening-notes" class="form-control" rows="3" placeholder="Key points discussed, scope confirmed, agenda presented...">${openingMeeting.notes || ''}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #166534; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Opening Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #166534; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; max-width: 100%; overflow: hidden;">
                                ${[
                    { id: 'op-scope', label: 'Introduction of audit team & confirmation of audit scope' },
                    { id: 'op-methodology', label: 'Audit plan, methodology & sampling approach' },
                    { id: 'op-ncr-grading', label: 'Nonconformity grading criteria (Major / Minor / OFI)' },
                    { id: 'op-remote-evidence', label: 'Evidence collection method (photos, screen-shares for remote audits)' },
                    { id: 'op-process-flow', label: 'Process flow & department visit sequence' },
                    { id: 'op-confidentiality', label: 'Confidentiality & impartiality declaration' },
                    { id: 'op-communication', label: 'Communication arrangements & guide/escort' },
                    { id: 'op-schedule', label: 'Daily schedule, breaks & logistics' },
                    { id: 'op-prev-findings', label: 'Status of previous audit findings & CAPAs' }
                ].map(p => '<label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.6rem; background: white; border-radius: 6px; border: 1px solid #dcfce7; min-height: 2.2rem; width: 100%; box-sizing: border-box;"><input type="checkbox" class="opening-pointer" data-key="' + p.id + '" ' + ((openingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="margin-top: 2px; accent-color: #16a34a; flex-shrink: 0;"><span style="min-width: 0; overflow-wrap: break-word; word-break: break-word; flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Closing Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #dc2626; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #dc2626;">
                            <i class="fa-solid fa-door-closed" style="margin-right: 0.5rem;"></i>Closing Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="closing-date" class="form-control" value="${closingMeeting.date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="closing-time" class="form-control" value="${closingMeeting.time || '17:00'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('closing', existingClosingNames)}
                        </div>
                        <div class="form-group">
                            <label>Findings Summary Presented</label>
                            <textarea id="closing-summary" class="form-control" rows="2" placeholder="Summary of findings as presented to client...">${closingMeeting.summary || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Client Response/Agreement</label>
                            <textarea id="closing-response" class="form-control" rows="2" placeholder="Client's response to findings...">${closingMeeting.response || ''}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #991b1b; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Closing Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #991b1b; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; max-width: 100%; overflow: hidden;">
                                ${[
                    { id: 'cl-findings', label: 'Presentation of audit findings (Majors, Minors, OFIs)' },
                    { id: 'cl-ncr-severity', label: 'Nonconformity severity & implications for certification' },
                    { id: 'cl-capa-timelines', label: 'Corrective action timelines (Major: 90 days, Minor: 6 months)' },
                    { id: 'cl-positive', label: 'Positive observations & good practices noted' },
                    { id: 'cl-recommendation', label: 'Audit recommendation (grant / maintain / suspend / withdraw)' },
                    { id: 'cl-appeals', label: 'Appeals & complaints process' },
                    { id: 'cl-followup', label: 'Follow-up / surveillance audit schedule' },
                    { id: 'cl-remote-evidence', label: 'Remote evidence sufficiency confirmation (if applicable)' },
                    { id: 'cl-cert-scope', label: 'Certification scope, mark usage & public information' }
                ].map(p => '<label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.6rem; background: white; border-radius: 6px; border: 1px solid #fecaca; min-height: 2.2rem; width: 100%; box-sizing: border-box;"><input type="checkbox" class="closing-pointer" data-key="' + p.id + '" ' + ((closingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="margin-top: 2px; accent-color: #dc2626; flex-shrink: 0;"><span style="min-width: 0; overflow-wrap: break-word; word-break: break-word; flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button class="btn btn-primary" onclick="window.saveMeetingRecords('${report.id}')">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>Save Meeting Records
                    </button>
                </div>
                
                <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                        <strong>ISO 17021-1 Requirement:</strong> Maintain records of opening and closing meetings including attendees and key discussions (Clause 9.4.7).
                    </p>
                </div>
            `;
            break;
        }
    }

    // Helper functions for execution module

    // Accordion toggle for clause sections
    window.toggleAccordion = function (sectionId) {
        const content = document.getElementById(sectionId);
        const icon = document.getElementById('icon-' + sectionId);
        if (content) {
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            if (icon) {
                icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    };

    window.toggleSectionSelection = function (sectionId, checkbox) {
        window.Logger.debug('Execution', 'toggleSectionSelection called for:', sectionId);
        const section = document.getElementById(sectionId);
        if (!section) {
            window.Logger.error('Execution', 'Section not found: ' + sectionId);
            return;
        }

        // Use passed checkbox or find it
        const box = checkbox || document.querySelector(`.section-checkbox[data-section-id="${sectionId}"]`);
        const isChecked = box ? box.checked : false;

        window.Logger.debug('Execution', 'Checkbox is checked:', isChecked);

        // Toggle items in this section
        let count = 0;
        const items = section.querySelectorAll('.checklist-item');
        window.Logger.debug('Execution', 'Found items:', items.length);
        items.forEach(item => {
            if (isChecked) {
                item.classList.add('selected-item');
                item.style.background = '#eff6ff'; // Light blue highlight
                item.style.borderLeft = '4px solid var(--primary-color)';
                count++;
            } else {
                item.classList.remove('selected-item');
                item.style.background = ''; // Reset
                item.style.borderLeft = '4px solid #e2e8f0'; // Reset
            }
        });

        // Optional: Update UI or show brief feedback
        // window.showNotification(isChecked ? `Selected ${count} items` : 'Selection cleared', 'info');
    };

    window.setChecklistStatus = function (uniqueId, status) {
        window.Logger.debug('Execution', 'setChecklistStatus called:', { uniqueId, status });

        const row = document.getElementById('row-' + uniqueId);
        if (!row) {
            window.Logger.error('Execution', 'Row not found: row-' + uniqueId);
            return;
        }

        // Update buttons
        row.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));

        let activeBtnClass = '';
        if (status === window.CONSTANTS.STATUS.CONFORM) activeBtnClass = '.btn-ok';
        else if (status === window.CONSTANTS.STATUS.NC) activeBtnClass = '.btn-nc';
        else if (status === window.CONSTANTS.STATUS.NA) activeBtnClass = '.btn-na';

        if (activeBtnClass) row.querySelector(activeBtnClass)?.classList.add('active');

        // Show/Hide NCR Panel
        const panelId = 'ncr-panel-' + uniqueId;
        const panel = document.getElementById(panelId);
        window.Logger.debug('Execution', 'Looking for panel:', { panelId, found: !!panel });

        if (panel) {
            if (status === window.CONSTANTS.STATUS.NC) {
                panel.style.display = 'block';
                window.Logger.debug('Execution', 'NCR Panel shown for:', uniqueId);
            } else {
                panel.style.display = 'none';
            }
        } else {
            window.Logger.error('Execution', 'NCR Panel not found: ' + panelId);
        }

        // Update hidden input
        const statusInput = document.getElementById('status-' + uniqueId);
        if (statusInput) {
            statusInput.value = status;
        }

        // Update accordion counter dynamically
        window.updateAccordionCounter(uniqueId);
    };

    // Update accordion counter based on current statuses
    window.updateAccordionCounter = function (changedId) {
        // Find the section containing this item
        const row = document.getElementById('row-' + changedId);
        if (!row) return;

        const accordionContent = row.closest('.accordion-content');
        if (!accordionContent) return;

        const sectionId = accordionContent.id;
        const items = accordionContent.querySelectorAll('.checklist-item');
        let completed = 0;

        items.forEach(item => {
            const itemId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + itemId);
            const status = statusInput?.value || '';
            if (status === 'conform' || status === 'nc' || status === 'na') {
                completed++;
            }
        });

        // Update the counter text in the accordion header
        const accordionSection = accordionContent.closest('.accordion-section');
        if (accordionSection) {
            const counterSpan = accordionSection.querySelector('.accordion-header span[style*="text-secondary"]');
            if (counterSpan && counterSpan.textContent.includes('/')) {
                counterSpan.textContent = `${completed}/${items.length}`;
            }
        }
    };

    window.addCustomQuestion = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Add Custom Question';
        modalBody.innerHTML = `
        <form id="custom-question-form">
            <div class="form-group">
                <label>Clause Number/Title <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="custom-clause" placeholder="e.g. New 1.1 or Additional" required>
            </div>
            <div class="form-group">
                <label>Requirement / Question <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="custom-req" rows="3" placeholder="Enter the audit question or requirement..." required></textarea>
            </div>
        </form>
    `;

        window.openModal();

        modalSave.onclick = () => {
            const clause = document.getElementById('custom-clause').value;
            const req = document.getElementById('custom-req').value;

            if (clause && req) {
                if (!report.customItems) report.customItems = [];
                report.customItems.push({ clause, requirement: req });

                window.saveData();
                window.closeModal();
                window.renderExecutionDetail(reportId);
                window.showNotification('Custom question added successfully');
            } else {
                window.showNotification('Please fill in both fields', 'error');
            }
        };
    };

    window.saveChecklist = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Show indicator immediately
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = 'Saving Changes...';
            indicator.style.display = 'block';
            indicator.style.background = '#3b82f6'; // Blue for loading
        }

        const statusInputs = document.querySelectorAll('.status-input');
        const checklistData = [];

        // Only update checklistProgress if we are on a screen that has checklist inputs
        if (statusInputs.length > 0) {
            statusInputs.forEach(input => {
                const uniqueId = input.id.replace('status-', '');

                const status = input.value;
                const comment = Sanitizer.sanitizeText(document.getElementById('comment-' + uniqueId)?.value || '');
                const ncrDesc = Sanitizer.sanitizeText(document.getElementById('ncr-desc-' + uniqueId)?.value || '');
                const transcript = Sanitizer.sanitizeText(document.getElementById('ncr-transcript-' + uniqueId)?.value || '');
                const ncrType = document.getElementById('ncr-type-' + uniqueId)?.value || '';

                // Get all evidence images from thumbnail strip
                const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
                const evidenceImages = [];
                if (previewDiv) {
                    previewDiv.querySelectorAll('.ev-thumb').forEach(thumb => {
                        // Prefer data-save-url (cloud URL or idb:// key) over img.src (may be base64)
                        const saveUrl = thumb.dataset.saveUrl;
                        const imgEl = thumb.querySelector('img');
                        const url = saveUrl || (imgEl && imgEl.src) || '';
                        if (url && !url.includes('data:,') && url !== window.location.href) {
                            evidenceImages.push(url);
                        }
                    });
                }
                // Backward compat: also store first image as evidenceImage
                const evidenceImage = evidenceImages.length > 0 ? evidenceImages[0] : '';
                const evidenceSize = '';

                // Get designation and department
                const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-' + uniqueId)?.value || '');
                const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-' + uniqueId)?.value || '');

                // Get clause and requirement from data attributes (reliable) instead of DOM scraping
                const clauseText = input.dataset.clause || '';
                const requirementText = input.dataset.requirement || '';

                // Save ALL items (not just ones with status/comment)
                // This ensures Conform/NC/NA selections persist even without comments
                checklistData.push({
                    checklistId: input.dataset.checklist,
                    itemIdx: input.dataset.item,
                    isCustom: input.dataset.custom === 'true',
                    status: status,
                    comment: comment,
                    ncrDescription: ncrDesc,
                    transcript: transcript,
                    ncrType: ncrType,
                    evidenceImage: evidenceImage,
                    evidenceImages: evidenceImages,
                    evidenceSize: evidenceSize,
                    designation: designation,
                    department: department,
                    // Include clause and requirement for report display
                    clause: clauseText || input.dataset.clause || '',
                    requirement: requirementText || input.dataset.requirement || ''
                });
            });
            report.checklistProgress = checklistData;
        }

        // Handle Review & Submit Tab classifications if present
        const reviewSeverities = document.querySelectorAll('.review-severity');
        if (reviewSeverities.length > 0) {
            reviewSeverities.forEach(select => {
                const findingId = select.dataset.findingId;
                const newType = select.value;
                const remarks = document.querySelector(`.review-remarks[data-finding-id="${findingId}"]`)?.value || '';

                if (findingId.startsWith('checklist-')) {
                    const idx = parseInt(findingId.replace('checklist-', ''));
                    // idx is the ORIGINAL index into checklistProgress (not a filtered sequential index)
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        if (remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (findingId.startsWith('ncr-')) {
                    const idx = parseInt(findingId.replace('ncr-', ''));
                    if (report.ncrs && report.ncrs[idx]) {
                        report.ncrs[idx].type = newType;
                        report.ncrs[idx].description = remarks;
                    }
                }
            });
        }

        // Save Executive Summary & Observations (Unified View)
        const execSumInput = document.getElementById(`exec-summary-${reportId}`);
        if (execSumInput) report.executiveSummary = Sanitizer.sanitizeText(execSumInput.value);

        const posObsInput = document.getElementById('positive-observations');
        if (posObsInput) report.positiveObservations = Sanitizer.sanitizeText(posObsInput.value);

        const ofiInput = document.getElementById('ofi');
        if (ofiInput) report.ofi = Sanitizer.sanitizeText(ofiInput.value);

        // Persist to Database (Async)
        (async () => {
            try {
                // Use correct DB column names (client_name, not client)
                await window.SupabaseClient.db.upsert('audit_reports', {
                    id: String(reportId),  // DB uses TEXT for id
                    plan_id: report.planId ? String(report.planId) : null,
                    client_name: report.client,  // DB column is client_name, not client
                    client_id: report.clientId || null,
                    date: report.date,
                    status: report.status,
                    findings: report.findings || 0,
                    checklist_progress: report.checklistProgress || [],  // Standardized column name
                    data: report || {},
                    custom_items: report.customItems || [],
                    opening_meeting: report.openingMeeting || {},
                    closing_meeting: report.closingMeeting || {},
                    ncrs: report.ncrs || []
                });

                // Success UI
                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Changes Saved Successfully';
                    indicator.style.background = '#10b981'; // Green
                    setTimeout(() => {
                        indicator.style.display = 'none';
                    }, 2000);
                }
                window.showNotification('Audit progress saved to cloud', 'success');

            } catch (dbError) {
                console.error('Database Sync Error:', JSON.stringify(dbError, null, 2));

                // Attempt Fallback: Save BASIC info only
                try {
                    console.warn('Attempting fallback save (basic info only)...');
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        client_name: report.client,
                        date: report.date,
                        status: report.status,
                        findings: report.findings || 0
                    });
                    window.showNotification('Partial save: Basic info saved. Full data saved locally.', 'warning');
                } catch (fallbackError) {
                    console.error('Fallback save also failed:', fallbackError);
                    window.showNotification(`Sync Failed: ${dbError.message || dbError.error_description || 'Unknown error'}`, 'error');
                }

                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sync Error';
                    indicator.style.background = '#ef4444'; // Red
                }
            }
        })();

        window.saveData();
    };

    // Filter checklist items by status
    window.filterChecklistItems = function (filterType) {
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filterType) {
                btn.classList.add('active');
            }
        });

        // Filter items
        document.querySelectorAll('.checklist-item').forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + uniqueId);
            const status = statusInput?.value || '';

            let shouldShow = false;

            if (filterType === 'all') {
                shouldShow = true;
            } else if (filterType === 'pending') {
                shouldShow = !status || status === '';
            } else {
                shouldShow = status === filterType;
            }

            if (shouldShow) {
                item.classList.remove('filtered-out');
            } else {
                item.classList.add('filtered-out');
            }
        });
    };

    // Bulk update status - prioritizes selected items, falls back to filtered items
    window.bulkUpdateStatus = function (reportId, status) {
        window.Logger.debug('Execution', 'bulkUpdateStatus called:', { reportId, status });

        // Check if any items are selected via checkboxes
        let targetItems = document.querySelectorAll('.checklist-item.selected-item');
        let useSelection = targetItems.length > 0;

        window.Logger.debug('Execution', 'Selected items:', targetItems.length);

        // If no items selected, fall back to filtered items
        if (!useSelection) {
            targetItems = document.querySelectorAll('.checklist-item:not(.filtered-out)');
            window.Logger.debug('Execution', 'Using filtered items:', targetItems.length);
        }

        if (targetItems.length === 0) {
            window.showNotification('No items to update', 'warning');
            return;
        }

        window.Logger.debug('Execution', `Bulk updating ${targetItems.length} items to status: ${status}`);
        let updatedCount = 0;
        targetItems.forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            window.Logger.debug('Execution', 'Updating item:', { uniqueId, status });
            window.setChecklistStatus(uniqueId, status);
            updatedCount++;
        });
        window.Logger.debug('Execution', 'Updated items count:', updatedCount);

        // Clear selections if items were selected
        if (useSelection) {
            document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.checklist-item.selected-item').forEach(item => {
                item.classList.remove('selected-item');
                item.style.background = '';
                item.style.borderLeft = '';
            });
        }

        // Close dropdown
        const menu = document.getElementById(`bulk-menu-${reportId}`);
        if (menu) {
            menu.classList.add('hidden');
            window.Logger.debug('Execution', 'Menu closed');
        } else {
            window.Logger.error('Execution', 'Menu not found: bulk-menu-' + reportId);
        }

        window.showNotification(`Updated ${updatedCount} item(s) to ${status.toUpperCase()}`, 'success');
        window.saveChecklist(reportId);
    };


    // Submit findings to Lead Auditor for review
    window.submitToLeadAuditor = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Use saveChecklist to gather all UI changes first
        window.saveChecklist(reportId);

        // Update report status to In Review (as per CONSTANTS)
        report.status = window.CONSTANTS.STATUS.IN_REVIEW;
        report.submittedAt = new Date().toISOString();
        report.submittedBy = window.state.currentUser?.name || 'Auditor';

        // Persist to Database
        (async () => {
            try {
                await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                    status: report.status,
                    data: report
                });
                window.showNotification('Findings submitted to Lead Auditor for review!', 'success');
            } catch (err) {
                console.error('Submission failed:', err);
                window.showNotification('Submitted locally. Cloud sync pending.', 'warning');
            }
        })();

        window.saveData();

        // Navigate back to execution list
        setTimeout(() => {
            renderAuditExecutionEnhanced();
        }, 1500);
    };

    window.startDictation = function (uniqueId) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        const micBtn = document.getElementById('mic-btn-' + uniqueId);
        const textarea = document.getElementById('comment-' + uniqueId);

        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        // Visual feedback — show stop button so user can end early
        const originalIcon = '<i class="fa-solid fa-microphone"></i>';
        micBtn.innerHTML = '<i class="fa-solid fa-stop fa-fade" style="color: red;"></i>';
        micBtn.title = 'Click to stop recording';
        micBtn.removeAttribute('disabled');

        // Allow user to stop early by clicking the mic button again
        const stopHandler = () => {
            recognition.stop();
            micBtn.removeEventListener('click', stopHandler);
        };
        micBtn.addEventListener('click', stopHandler);

        recognition.start();

        let finalTranscript = '';

        // Auto-stop after 30 seconds
        const timeout = setTimeout(() => {
            recognition.stop();
            window.showNotification('Recording limit (30s) reached.', 'info');
        }, 30000);

        recognition.onresult = function (event) {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Show live preview in the textarea
            const currentVal = textarea.getAttribute('data-pre-dictation') || textarea.value;
            if (!textarea.getAttribute('data-pre-dictation')) {
                textarea.setAttribute('data-pre-dictation', textarea.value);
            }
            textarea.value = currentVal ? currentVal + ' ' + finalTranscript + interimTranscript : finalTranscript + interimTranscript;
        };

        recognition.onend = function () {
            clearTimeout(timeout);
            micBtn.removeEventListener('click', stopHandler);
            // Set final value
            const preVal = textarea.getAttribute('data-pre-dictation') || '';
            textarea.removeAttribute('data-pre-dictation');
            textarea.value = preVal ? preVal + ' ' + finalTranscript : finalTranscript;

            micBtn.innerHTML = originalIcon;
            micBtn.title = 'Voice dictation';
        };

        recognition.onerror = function (event) {
            window.Logger.error('Execution', 'Speech recognition error', event.error);
            if (event.error !== 'no-speech') {
                window.showNotification('Error recording audio: ' + event.error, 'error');
            }
            micBtn.innerHTML = originalIcon;
            micBtn.title = 'Voice dictation';
            micBtn.removeEventListener('click', stopHandler);
            clearTimeout(timeout);
        };
    };

    function createNCR(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Create Non-Conformity Report';
        modalBody.innerHTML = `
        <form id="ncr-form">
            <div class="form-group">
                <label>Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-type" required>
                    <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}">Observation (OBS)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MINOR}">Minor NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}">Major NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.PENDING}">Pending Classification</option>
                </select>
            </div>
            <div class="form-group">
                <label>Clause/Requirement</label>
                <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3">
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <div style="position: relative;">
                    <textarea class="form-control" id="ncr-description" rows="3" placeholder="Describe the non-conformity..." required></textarea>
                    <button type="button" id="mic-btn-modal" style="position: absolute; bottom: 10px; right: 10px; background: none; border: none; color: var(--primary-color); cursor: pointer;" title="Dictate Description">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Evidence / Objective Evidence</label>
                <textarea class="form-control" id="ncr-evidence" rows="2" placeholder="What evidence supports this finding?"></textarea>
            </div>
            
            <!-- Cross-Reference Fields -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Interviewee Designation</label>
                    <input type="text" class="form-control" id="ncr-designation" placeholder="e.g., Quality Manager">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Department</label>
                    <input type="text" class="form-control" id="ncr-department" placeholder="e.g., Production">
                </div>
            </div>
            
            <div class="form-group" style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Multimedia Evidence</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" id="btn-capture-img" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-camera"></i> Capture Image
                    </button>
                    <span id="img-status" style="font-size: 0.8rem; color: #666;"></span>
                </div>
                <input type="hidden" id="ncr-evidence-image-url">
                <div id="image-preview" style="margin-top: 10px;"></div>
            </div>
        </form>
    `;

        window.openModal();

        // Voice Dictation Logic for Modal
        const micBtn = document.getElementById('mic-btn-modal');
        if (micBtn) {
            micBtn.onclick = () => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;

                    micBtn.innerHTML = '<i class="fa-solid fa-circle-dot fa-fade" style="color: red;"></i>';
                    recognition.start();

                    recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        const desc = document.getElementById('ncr-description');
                        desc.value = desc.value ? desc.value + ' ' + transcript : transcript;
                    };

                    recognition.onend = () => {
                        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                    };
                } else {
                    alert('Speech recognition not supported in this browser.');
                }
            };
        }

        // Camera Capture Logic - triggers file input for real image upload
        const captureBtn = document.getElementById('btn-capture-img');
        if (captureBtn) {
            captureBtn.onclick = function () {
                // Create file input for image selection
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment'; // Use back camera on mobile

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    captureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

                    try {
                        // Upload to Supabase if available
                        if (window.SupabaseClient?.isInitialized) {
                            const result = await window.SupabaseClient.storage.uploadAuditImage(file, 'ncr-evidence', Date.now().toString());
                            if (result?.url) {
                                document.getElementById('ncr-evidence-image-url').value = result.url;
                                document.getElementById('image-preview').innerHTML = `<img src="${result.url}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image uploaded successfully";
                            }
                        } else {
                            // Fallback: Use base64 data URL for local storage
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                document.getElementById('ncr-evidence-image-url').value = ev.target.result;
                                document.getElementById('image-preview').innerHTML = `<img src="${ev.target.result}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image captured (stored locally)";
                            };
                            reader.readAsDataURL(file);
                        }

                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retake';
                        captureBtn.classList.remove('btn-secondary');
                        captureBtn.classList.add('btn-success');
                    } catch (error) {
                        console.error('Image upload failed:', error);
                        document.getElementById('img-status').textContent = "Upload failed: " + error.message;
                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retry';
                    }
                };

                fileInput.click();
            };
        }

        modalSave.onclick = () => {
            // 1. Define Fields
            const fieldIds = {
                description: 'ncr-description',
                type: 'ncr-type'
            };

            // 2. Define Rules
            const rules = {
                description: [
                    { rule: 'required', fieldName: 'Description' },
                    { rule: 'noHtmlTags' }
                ],
                type: [{ rule: 'required', fieldName: 'Type' }]
            };

            // 3. Validate
            const result = Validator.validateFormElements(fieldIds, rules);
            if (!result.valid) {
                Validator.displayErrors(result.errors, fieldIds);
                window.showNotification('Please fix the form errors', 'error');
                return;
            }
            Validator.clearErrors(fieldIds);

            // 4. Sanitize Input
            const type = document.getElementById('ncr-type').value;
            const clause = Sanitizer.sanitizeText(document.getElementById('ncr-clause').value);
            const description = Sanitizer.sanitizeText(document.getElementById('ncr-description').value);
            const evidence = Sanitizer.sanitizeText(document.getElementById('ncr-evidence').value);
            const evidenceImage = Sanitizer.sanitizeURL(document.getElementById('ncr-evidence-image-url').value);
            const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation').value);
            const department = Sanitizer.sanitizeText(document.getElementById('ncr-department').value);

            // 5. Save
            if (!report.ncrs) report.ncrs = [];
            report.ncrs.push({
                type,
                clause,
                description,
                evidence,
                evidenceImage,
                transcript: description,
                designation,
                department,
                status: 'Open',
                createdAt: new Date().toISOString()
            });
            report.findings = report.ncrs.length;

            window.saveData();

            // Queue NCR for offline sync
            if (window.OfflineManager) {
                window.OfflineManager.queueAction('CREATE_NCR', {
                    reportId: reportId,
                    client: report.client,
                    ncr: report.ncrs[report.ncrs.length - 1]
                });
            }
            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR created successfully with evidence', 'success');
        };
    }

    function createCAPA(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const ncrs = report.ncrs || [];

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Create CAPA';
        modalBody.innerHTML = `
        <form id="capa-form">
            <div class="form-group">
                <label>Linked NCR</label>
                <select class="form-control" id="capa-ncr">
                    <option value="">-- None --</option>
                    ${ncrs.map((ncr, idx) => `<option value="NCR-${String(idx + 1).padStart(3, '0')}">NCR-${String(idx + 1).padStart(3, '0')} - ${ncr.description?.substring(0, 30)}...</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Root Cause <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-root-cause" rows="2" placeholder="What caused this issue?" required></textarea>
            </div>
            <div class="form-group">
                <label>Action Plan <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-action" rows="2" placeholder="What corrective/preventive actions will be taken?" required></textarea>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" class="form-control" id="capa-due">
            </div>
        </form>
    `;

        window.openModal();

        modalSave.onclick = () => {
            const linkedNCR = document.getElementById('capa-ncr').value;
            const rootCause = document.getElementById('capa-root-cause').value;
            const actionPlan = document.getElementById('capa-action').value;
            const dueDate = document.getElementById('capa-due').value;

            if (rootCause && actionPlan) {
                if (!report.capas) report.capas = [];
                report.capas.push({
                    linkedNCR,
                    rootCause,
                    actionPlan,
                    dueDate,
                    status: 'In Progress',
                    createdAt: new Date().toISOString()
                });

                window.saveData();
                window.closeModal();
                renderExecutionDetail(reportId);
                window.showNotification('CAPA created successfully');
            } else {
                window.showNotification('Please fill in all required fields', 'error');
            }
        };
    }

    function saveObservations(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        report.positiveObservations = document.getElementById('positive-observations')?.value || '';
        report.ofi = document.getElementById('ofi')?.value || '';

        window.saveData();
        window.showNotification('Observations saved successfully');
    }

    // Save Opening/Closing Meeting Records (ISO 17021-1 Clause 9.4.7)
    // Collect attendees from checkboxes + custom list
    window._collectMeetingAttendees = function (prefix) {
        const attendees = [];
        document.querySelectorAll(`.${prefix}-attendee-cb:checked`).forEach(cb => {
            attendees.push({ name: cb.dataset.name, role: cb.dataset.role || '', organization: cb.dataset.org || '' });
        });
        // Custom attendees
        document.querySelectorAll(`#${prefix}-custom-list .custom-attendee-item`).forEach(el => {
            attendees.push({ name: el.dataset.name, role: el.dataset.role || '', organization: el.dataset.org || '' });
        });
        return attendees;
    };

    window.addCustomMeetingAttendee = function (prefix) {
        const nameEl = document.getElementById(`${prefix}-custom-name`);
        const roleEl = document.getElementById(`${prefix}-custom-role`);
        const orgEl = document.getElementById(`${prefix}-custom-org`);
        if (!nameEl || !nameEl.value.trim()) { window.showNotification('Please enter a name', 'error'); return; }
        const name = nameEl.value.trim();
        const role = roleEl?.value?.trim() || '';
        const org = orgEl?.value?.trim() || '';
        const list = document.getElementById(`${prefix}-custom-list`);
        if (list) {
            const div = document.createElement('div');
            div.className = 'custom-attendee-item';
            div.dataset.name = name;
            div.dataset.role = role;
            div.dataset.org = org;
            div.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: #eff6ff; border-radius: 6px; font-size: 0.85rem; margin-bottom: 0.25rem;';
            div.innerHTML = `<i class="fa-solid fa-user-plus" style="color: #3b82f6;"></i><strong>${name}</strong>${role ? ' – ' + role : ''}${org ? ' (' + org + ')' : ''}<button class="btn btn-sm" style="margin-left: auto; padding: 0 0.25rem; color: #dc2626;" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>`;
            list.appendChild(div);
        }
        nameEl.value = ''; if (roleEl) roleEl.value = ''; if (orgEl) orgEl.value = '';
    };

    window.saveMeetingRecords = function (reportId) {
        const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        report.openingMeeting = {
            date: document.getElementById('opening-date')?.value || '',
            time: document.getElementById('opening-time')?.value || '',
            attendees: window._collectMeetingAttendees('opening'),
            notes: document.getElementById('opening-notes')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.opening-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        report.closingMeeting = {
            date: document.getElementById('closing-date')?.value || '',
            time: document.getElementById('closing-time')?.value || '',
            attendees: window._collectMeetingAttendees('closing'),
            summary: document.getElementById('closing-summary')?.value || '',
            response: document.getElementById('closing-response')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.closing-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        window.saveData();

        // Queue meeting records for offline sync
        if (window.OfflineManager) {
            window.OfflineManager.queueAction('SAVE_MEETINGS', {
                reportId: reportId,
                client: report.client,
                openingMeeting: report.openingMeeting,
                closingMeeting: report.closingMeeting
            });
        }

        window.showNotification('Meeting records saved successfully', 'success');
    };

    // Export functions
    window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
    window.renderAuditExecution = renderAuditExecutionEnhanced;
    window.renderExecutionDetail = renderExecutionDetail;
    window.saveChecklist = saveChecklist;
    window.createNCR = createNCR;
    window.createCAPA = createCAPA;
    // Note: submitForReview, publishReport, revertToDraft, saveReportDraft,
    //       generateAIConclusion, generateAuditReport are now in reporting-module.js

    // ============================================
    // EVIDENCE IMAGE HANDLING (Compression & Upload)
    // ============================================
    // IndexedDB Image Store — avoids localStorage 5MB limit
    // ============================================
    const EvidenceDB = {
        DB_NAME: 'AuditCB_Evidence',
        STORE_NAME: 'images',
        DB_VERSION: 1,
        _db: null,
        async open() {
            if (this._db) return this._db;
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                req.onupgradeneeded = (e) => {
                    e.target.result.createObjectStore(this.STORE_NAME);
                };
                req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
                req.onerror = (e) => reject(e.target.error);
            });
        },
        async put(key, dataUrl) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).put(dataUrl, key);
                tx.oncomplete = () => resolve(key);
                tx.onerror = (e) => reject(e.target.error);
            });
        },
        async get(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const req = tx.objectStore(this.STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = (e) => reject(e.target.error);
            });
        },
        async remove(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        }
    };
    window._EvidenceDB = EvidenceDB;

    // Resolve idb:// references to displayable blob URLs
    window.resolveEvidenceUrl = async function (url) {
        if (!url || !url.startsWith('idb://')) return url;
        try {
            const dataUrl = await EvidenceDB.get(url);
            return dataUrl || url;
        } catch (e) {
            console.warn('Failed to resolve evidence URL:', url, e);
            return url;
        }
    };

    // Post-render: resolve all idb:// thumbnails in the DOM
    window.resolveAllIdbThumbs = async function () {
        const idbImgs = document.querySelectorAll('img[data-idb-key]');
        for (const img of idbImgs) {
            const key = img.dataset.idbKey;
            if (!key) continue;
            try {
                const dataUrl = await EvidenceDB.get(key);
                if (dataUrl) {
                    img.src = dataUrl;
                    img.style.background = '';
                    img.dataset.idbKey = ''; // mark as resolved
                }
            } catch (e) { /* silently skip */ }
        }
    };
    // Auto-resolve when DOM updates (debounced)
    let _idbResolveTimer;
    const _idbObserver = new MutationObserver(() => {
        clearTimeout(_idbResolveTimer);
        _idbResolveTimer = setTimeout(() => window.resolveAllIdbThumbs(), 300);
    });
    _idbObserver.observe(document.body, { childList: true, subtree: true });

    // Handle evidence image upload with compression and 5MB limit
    window.handleEvidenceUpload = function (uniqueId, input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            window.showNotification('Please select an image file', 'error');
            input.value = '';
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            window.showNotification('Image exceeds 5MB limit', 'error');
            input.value = '';
            return;
        }

        // Show loading indicator
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        if (previewDiv) {
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = `
            <div style="padding: 1rem; background: #f8fafc; border-radius: var(--radius-sm); text-align: center;">
                <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary-color);"></i>
                <span style="margin-left: 0.5rem; font-size: 0.85rem;">Compressing & Uploading...</span>
            </div>
        `;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = async function () {
                try {
                    // 1. Compress
                    const compressedDataUrl = compressImage(img, file.type);
                    const compressedSize = Math.round((compressedDataUrl.length * 3 / 4) / 1024);

                    let finalUrl = compressedDataUrl;
                    let isCloud = false;
                    let displayUrl = compressedDataUrl; // always use this for thumbnail display

                    // 2. Upload to Supabase (if online)
                    console.log('[Evidence Upload] Online:', window.navigator.onLine, 'SupabaseClient:', !!window.SupabaseClient, 'Initialized:', window.SupabaseClient?.isInitialized);
                    if (window.navigator.onLine && window.SupabaseClient) {
                        try {
                            if (!window.SupabaseClient.isInitialized) {
                                console.warn('[Evidence Upload] Supabase not initialized - trying to wait...');
                                await new Promise(r => setTimeout(r, 1000));
                            }
                            if (window.SupabaseClient.isInitialized) {
                                // Convert DataURL to Blob
                                const res = await fetch(compressedDataUrl);
                                const blob = await res.blob();
                                const uploadFile = new File([blob], file.name, { type: file.type });

                                console.log('[Evidence Upload] Uploading file:', file.name, 'Size:', blob.size, 'bytes');
                                const result = await window.SupabaseClient.storage.uploadAuditImage(uploadFile, 'ncr-evidence', uniqueId + '-' + Date.now());
                                console.log('[Evidence Upload] Result:', result);
                                if (result && result.url) {
                                    finalUrl = result.url;
                                    displayUrl = result.url;
                                    isCloud = true;
                                    console.log('[Evidence Upload] Success! Cloud URL:', result.url.substring(0, 80));
                                } else {
                                    console.warn('[Evidence Upload] No URL returned - result was:', JSON.stringify(result));
                                }
                            } else {
                                console.warn('[Evidence Upload] Supabase still not initialized after wait');
                            }
                        } catch (uploadErr) {
                            console.error('[Evidence Upload] Failed:', uploadErr.message || uploadErr);
                            console.warn('[Evidence Upload] Falling back to IndexedDB');
                        }
                    }

                    // 2b. If cloud failed, store in IndexedDB (avoids localStorage overflow)
                    if (!isCloud) {
                        try {
                            const idbKey = 'idb://evidence-' + uniqueId + '-' + Date.now();
                            await EvidenceDB.put(idbKey, compressedDataUrl);
                            finalUrl = idbKey; // small string for state/localStorage
                            console.log('[Evidence Upload] Stored in IndexedDB:', idbKey);
                        } catch (idbErr) {
                            console.error('[Evidence Upload] IndexedDB store failed:', idbErr);
                            // Last resort: keep base64 in state (may hit quota)
                            finalUrl = compressedDataUrl;
                        }
                    }

                    // 3. Append to multi-image preview strip
                    if (previewDiv) {
                        previewDiv.style.display = 'flex';
                        const existingThumbs = previewDiv.querySelectorAll('.ev-thumb');
                        const newIdx = existingThumbs.length;
                        const safeDisplay = displayUrl.replace(/'/g, "\\'");
                        const thumb = document.createElement('div');
                        thumb.className = 'ev-thumb';
                        thumb.dataset.idx = newIdx;
                        thumb.dataset.saveUrl = finalUrl; // store URL/idb-key for saving
                        thumb.style.cssText = 'position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;';
                        thumb.innerHTML = `
                            <img src="${displayUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.viewEvidenceImageByUrl('${safeDisplay}')"/>
                            <button type="button" onclick="window.removeEvidenceByIdx('${uniqueId}', ${newIdx})" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">\u00d7</button>
                        `;
                        previewDiv.appendChild(thumb);
                    }

                    // 4. Update Hidden Inputs
                    const evidenceData = document.getElementById('evidence-data-' + uniqueId);
                    if (evidenceData) evidenceData.value = 'attached';

                    window.showNotification(isCloud ? 'Image uploaded to cloud' : 'Image saved locally', 'success');

                } catch (err) {
                    console.error('Image processing error:', err);
                    window.showNotification('Error processing image', 'error');
                    if (previewDiv) previewDiv.style.display = 'none';
                    input.value = '';
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Compress image to reduce storage size
    function compressImage(img, fileType) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions (max 600px on longest side — keeps ~20-40KB per image)
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with 0.5 quality — good enough for evidence, saves storage
        return canvas.toDataURL('image/jpeg', 0.5);
    }

    // View evidence image in full size (modal/popup)
    // View evidence image in full size (modal/popup)
    // View evidence image in full size (modal/popup)
    window.viewEvidenceImage = function (uniqueId) {
        console.log('[viewEvidenceImage] Attempting to view image for:', uniqueId);

        // Strategy 1: Standard ID
        let imgEl = document.getElementById('evidence-img-' + uniqueId);

        // Strategy 2: If uniqueId looks like "0" (index-only), try to find it via the row container
        if (!imgEl) {
            console.warn(`[viewEvidenceImage] Element 'evidence-img-${uniqueId}' not found. Searching by context...`);

            // Try to find the file input which usually has the same ID suffix
            const fileInput = document.getElementById('img-' + uniqueId);
            if (fileInput) {
                // Look for sibling/cousin image in the same container
                const container = fileInput.closest('.ncr-panel') || fileInput.parentElement.parentElement;
                if (container) {
                    const nearbyImg = container.querySelector('img[id^="evidence-img-"]');
                    if (nearbyImg) {
                        console.log('[viewEvidenceImage] Found image via context:', nearbyImg.id);
                        imgEl = nearbyImg;
                    }
                }
            }
        }

        if (!imgEl) {
            // Strategy 3: Try to find ANY evidence image if we are desperate and uniqueId is just '0'
            if (uniqueId === 0 || uniqueId === '0') {
                const firstImg = document.querySelector('img[id^="evidence-img-"]');
                if (firstImg) {
                    console.log('[viewEvidenceImage] Fallback: Using first found evidence image:', firstImg.id);
                    imgEl = firstImg;
                }
            }
        }

        if (!imgEl) {
            console.error('[viewEvidenceImage] Image element DEFINITELY not found for:', uniqueId);
            window.showNotification('Error: Image element not found. Please refresh and try again.', 'error');
            return;
        }

        if (!imgEl.src || imgEl.src === '' || imgEl.src.includes('placeholder')) {
            console.warn('[viewEvidenceImage] Image source is empty or invalid');
            window.showNotification('No image source found', 'warning');
            return;
        }

        console.log('[viewEvidenceImage] Opening modal for src:', imgEl.src.substring(0, 50) + '...');

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'evidence-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(5px);';
        overlay.onclick = function () { overlay.remove(); };

        // Create image container
        overlay.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${imgEl.src}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); object-fit: contain;">
            <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove();" style="position: absolute; top: -15px; right: -15px; width: 36px; height: 36px; border-radius: 50%; background: white; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; color: #333;">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
    `;

        document.body.appendChild(overlay);
    };

    // View evidence image directly from cached data (used in Review tab)
    window.viewEvidenceImageDirect = function (findingId) {
        const cached = window._evidenceCache && window._evidenceCache[findingId];
        if (!cached) {
            window.showNotification('Evidence image not found. Please view from the Checklist tab.', 'warning');
            return;
        }
        // Handle both old (string) and new (array) formats
        const srcs = Array.isArray(cached) ? cached : [cached];
        const overlay = document.createElement('div');
        overlay.id = 'evidence-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(5px);';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 80vh;" onclick="event.stopPropagation();">
                <img id="ev-gallery-main" src="${srcs[0]}" style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); object-fit: contain;">
                <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove();" style="position: absolute; top: -15px; right: -15px; width: 36px; height: 36px; border-radius: 50%; background: white; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; color: #333;">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            ${srcs.length > 1 ? `<div style="display: flex; gap: 8px; margin-top: 12px;" onclick="event.stopPropagation();">
                ${srcs.map((s, i) => `<img src="${s}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid ${i === 0 ? 'white' : 'transparent'}; opacity: ${i === 0 ? '1' : '0.6'};" onclick="document.getElementById('ev-gallery-main').src='${s.replace(/'/g, "\\'")}'; this.parentElement.querySelectorAll('img').forEach(t=>{t.style.border='2px solid transparent';t.style.opacity='0.6';}); this.style.border='2px solid white'; this.style.opacity='1';">`).join('')}
            </div>` : ''}
            <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 8px;">${srcs.length} photo${srcs.length > 1 ? 's' : ''} \u2022 Click outside to close</p>
        `;
        document.body.appendChild(overlay);
    };

    // Remove evidence image
    window.removeEvidence = function (uniqueId) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        const evidenceData = document.getElementById('evidence-data-' + uniqueId);
        const fileInput = document.getElementById('img-' + uniqueId);

        if (previewDiv) { previewDiv.style.display = 'none'; previewDiv.innerHTML = ''; }
        if (evidenceData) evidenceData.value = '';
        if (fileInput) fileInput.value = '';

        window.showNotification('Evidence image removed', 'info');
    };

    // Remove a specific image by index from the multi-image strip
    window.removeEvidenceByIdx = function (uniqueId, idx) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        if (!previewDiv) return;
        const thumbs = previewDiv.querySelectorAll('.ev-thumb');
        if (thumbs[idx]) thumbs[idx].remove();
        // If no thumbs left, hide preview and clear data
        if (previewDiv.querySelectorAll('.ev-thumb').length === 0) {
            previewDiv.style.display = 'none';
            const evidenceData = document.getElementById('evidence-data-' + uniqueId);
            if (evidenceData) evidenceData.value = '';
        }
    };

    // View any evidence image by URL in a lightbox overlay
    window.viewEvidenceImageByUrl = function (url) {
        if (!url) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; cursor: pointer;';
        overlay.onclick = () => overlay.remove();
        overlay.innerHTML = `
            <img src="${url}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <button style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">\u00d7</button>
        `;
        document.body.appendChild(overlay);
    };
    // Generate Printable Report - Enhanced Version
    // Generate Printable Report - Enhanced Version
    window.generateAuditReport = function (reportId) {
        const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) {
            window.showNotification('Report not found', 'error');
            return;
        }

        // 1. Hydrate Checklist Data (Clause & Requirements) - using shared helper
        const hydratedProgress = (report.checklistProgress || []).map(item => {
            let clause = item.clause;
            let requirement = item.requirement;

            // Use shared helper for clause/requirement resolution if data is missing
            if ((!requirement || !clause) && item.checklistId) {
                const resolved = window.KB_HELPERS.resolveChecklistClause(item, window.state.checklists || []);
                if (resolved.clauseText) clause = resolved.clauseText;
                if (resolved.reqText) requirement = resolved.reqText;
            }

            // ALWAYS look up KB standard requirement (not just as fallback)
            const kbMatch = window.KB_HELPERS.lookupKBRequirement(clause, report.standard);

            return {
                ...item,
                clause: clause || item.clause || item.sectionName || 'General Requirement',
                requirement: requirement || item.text || item.requirement || item.description || 'Requirement details not available',
                kbMatch: kbMatch,
                comment: item.comment || ''
            };
        });

        // Attempt to get client details for address/logo if available
        const client = window.state.clients.find(c => c.name === report.client) || {};
        const clientLogo = client.logoUrl || 'https://via.placeholder.com/150?text=Client+Logo';

        // Get audit plan reference
        const auditPlan = report.planId ? window.state.auditPlans.find(p => String(p.id) === String(report.planId)) : null;

        // Enrich report with plan/client data if missing
        if (auditPlan) {
            if (!report.leadAuditor) {
                // Try plan.lead first, then first team member
                if (auditPlan.lead) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.lead));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : auditPlan.lead;
                } else if (auditPlan.teamIds?.length) {
                    const leadAuditor = window.state.auditors?.find(a => String(a.id) === String(auditPlan.teamIds[0]));
                    report.leadAuditor = leadAuditor ? leadAuditor.name : '';
                } else if (auditPlan.team?.length) {
                    report.leadAuditor = typeof auditPlan.team[0] === 'object' ? auditPlan.team[0].name : auditPlan.team[0];
                }
            }
            if (!report.auditType) report.auditType = auditPlan.type || auditPlan.auditType || '';
        }
        if (!client.certificationScope) {
            // Pull scope from client certificates siteScopes (Scopes & Certs tab)
            const matchingCert = (client.certificates || []).find(c => (c.standard || '').toLowerCase() === (report.standard || '').toLowerCase());
            if (matchingCert && matchingCert.siteScopes) {
                // Combine all site scopes into one string
                const scopeValues = Object.entries(matchingCert.siteScopes).filter(([k, v]) => v).map(([siteName, scopeText]) => siteName + ': ' + scopeText);
                client.certificationScope = scopeValues.length === 1 ? Object.values(matchingCert.siteScopes)[0] : scopeValues.join('; ') || '';
            }
            if (!client.certificationScope) {
                client.certificationScope = matchingCert?.scope || auditPlan?.scope || client.scope || '';
            }
            // Final fallback: build scope from goodsServices
            if (!client.certificationScope && client.goodsServices && client.goodsServices.length > 0) {
                client.certificationScope = client.goodsServices.map(g => g.name + (g.description ? ': ' + g.description : '')).join(', ');
            }
        }

        // QR Code for Report Verification
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('https://audit.companycertification.com/#/verify/' + report.id)}`;

        // CB Settings (real data, no fake info)
        const cbSettings = window.state.cbSettings || {};
        const cbSite = (cbSettings.cbSites || [])[0] || {};

        // Calculate stats
        const totalItems = hydratedProgress.length;
        const ncItems = hydratedProgress.filter(i => i.status === 'nc');
        const conformityItems = hydratedProgress.filter(i => i.status === 'conform');
        const naItems = hydratedProgress.filter(i => i.status === 'na');
        const majorNC = ncItems.filter(i => i.ncrType === 'Major').length;
        const minorNC = ncItems.filter(i => i.ncrType === 'Minor').length;
        const observationCount = ncItems.filter(i => i.ncrType === 'Observation').length;

        // NC breakdown by clause group (for bar chart)
        const ncByClause = {};
        ncItems.forEach(item => {
            const g = (item.clause || '').split('.')[0] || '?';
            ncByClause[g] = (ncByClause[g] || 0) + 1;
        });

        // Store data for preview & export
        window._reportPreviewData = {
            report, hydratedProgress, client, auditPlan, cbSettings, cbSite,
            clientLogo: client.logoUrl || '',
            cbLogo: cbSettings.logoUrl || '',
            qrCodeUrl,
            stats: { totalItems, ncCount: ncItems.length, conformCount: conformityItems.length, naCount: naItems.length, majorNC, minorNC, observationCount, ncByClause },
            today: new Date().toLocaleDateString()
        };

        // Show Report Preview & Edit modal
        window.showReportPreviewModal();

    };

    // ============================================
    // REPORT PREVIEW & EDIT MODAL
    // ============================================
    window.showReportPreviewModal = function () {
        const d = window._reportPreviewData;
        if (!d) return;

        // Remove existing overlay
        const existing = document.getElementById('report-preview-overlay');
        if (existing) existing.remove();

        const sections = [
            { id: 'audit-info', label: 'Audit Info', icon: 'fa-clipboard-list', color: '#2563eb' },
            { id: 'summary', label: 'Summary', icon: 'fa-file-lines', color: '#059669' },
            { id: 'charts', label: 'Charts', icon: 'fa-chart-pie', color: '#7c3aed' },
            { id: 'findings', label: 'Findings', icon: 'fa-triangle-exclamation', color: '#dc2626' },
            { id: 'conformance', label: 'Conformance', icon: 'fa-circle-check', color: '#059669' },
            { id: 'ncrs', label: 'NCRs', icon: 'fa-clipboard-check', color: '#ea580c', hide: !(d.report.ncrs || []).length },
            { id: 'meetings', label: 'Meetings', icon: 'fa-handshake', color: '#0891b2' },
            { id: 'conclusion', label: 'Conclusion', icon: 'fa-gavel', color: '#4338ca' }
        ];

        window._reportSectionState = {};
        sections.forEach(s => { window._reportSectionState[s.id] = !s.hide; });

        const pill = (s) => `<label class="rp-pill ${s.hide ? '' : 'active'}" id="pill-${s.id}" style="${s.hide ? 'background:white;color:#94a3b8;border-color:#cbd5e1;' : 'background:' + s.color + ';border-color:' + s.color + ';color:white;'}" onclick="window.toggleReportSection('${s.id}','${s.color}')"><i class="fa-solid ${s.icon}"></i> ${s.label}</label>`;

        // Helper: render all evidence images for a checklist item (preview mode)
        const renderEvThumbs = (item) => {
            const imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (!imgs.length) return '';
            return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${imgs.map(url => `<img src="${url}" style="height:50px;border-radius:4px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open('${url}','_blank')">`).join('')}</div>`;
        };

        const ncRows = d.hydratedProgress.filter(i => i.status === 'nc').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sev = item.ncrType || 'NC';
            const sevStyle = sev === 'Major' ? 'background:#fee2e2;color:#991b1b' : sev === 'Minor' ? 'background:#fef3c7;color:#92400e' : 'background:#dbeafe;color:#1e40af';
            return `<tr style="background:${idx % 2 ? '#f8fafc' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;${sevStyle};">${sev}</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        // Conformance rows (items with comments or evidence)
        const conformRows = d.hydratedProgress.filter(i => i.status === 'conform' && (i.comment || i.evidenceImage || (i.evidenceImages && i.evidenceImages.length))).map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return `<tr style="background:${idx % 2 ? '#f0fdf4' : 'white'};"><td style="padding:10px 14px;font-weight:700;">${clause}</td><td style="padding:10px 14px;">${title ? '<strong>' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.82rem;">' + (req || '').substring(0, 180) + (req && req.length > 180 ? '...' : '') + '</div>' : req}</td><td style="padding:10px 14px;"><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;"><i class="fa-solid fa-check" style="margin-right:4px;"></i>Conform</span></td><td style="padding:10px 14px;color:#334155;">${item.comment || '<span style="color:#94a3b8;">No remarks</span>'}${renderEvThumbs(item)}</td></tr>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'report-preview-overlay';
        overlay.innerHTML = `
        <style>
            #report-preview-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(15,23,42,0.7);display:flex;justify-content:center;padding:16px;backdrop-filter:blur(4px);}
            .rp-modal{background:#f8fafc;border-radius:16px;width:100%;max-width:1100px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.3);}
            .rp-header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:20px 28px;}
            .rp-pills{padding:12px 28px;background:white;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
            .rp-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;border:2px solid;transition:all 0.2s;user-select:none;}
            .rp-content{flex:1;overflow-y:auto;padding:16px 28px;}
            .rp-sec{background:white;border-radius:10px;margin-bottom:14px;border:1px solid #e2e8f0;overflow:hidden;}
            .rp-sec-hdr{display:flex;align-items:center;padding:11px 16px;cursor:pointer;gap:10px;font-weight:600;color:white;font-size:0.92rem;}
            .rp-sec-body{padding:14px 16px;border-top:1px solid #e2e8f0;}
            .rp-sec-body.collapsed{display:none;}
            .rp-footer{padding:14px 28px;background:white;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;}
            .rp-edit{min-height:60px;line-height:1.7;color:#334155;outline:none;padding:8px;border:1px dashed transparent;border-radius:6px;cursor:text;}
            .rp-edit:hover{border-color:#cbd5e1;background:#f8fafc;}
            .rp-edit:focus{border-color:#2563eb;background:#f8fafc;}
        </style>
        <div class="rp-modal">
            <div class="rp-header">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0 0 4px;font-size:1.25rem;"><i class="fa-solid fa-file-pdf" style="margin-right:8px;"></i>Report Preview & Edit</h2>
                        <div style="opacity:0.8;font-size:0.88rem;">${d.report.client} — ${d.report.standard || 'ISO Standard'}</div>
                    </div>
                    <button onclick="document.getElementById('report-preview-overlay').remove()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>
            <div class="rp-pills">
                <span style="font-size:0.78rem;color:#64748b;font-weight:600;margin-right:4px;">INCLUDE:</span>
                ${sections.map(s => pill(s)).join('')}
                <div style="flex:1;"></div>
                <button onclick="document.querySelectorAll('.rp-sec-body').forEach(b=>b.classList.remove('collapsed'))" style="padding:4px 10px;font-size:0.75rem;border:1px solid #cbd5e1;background:white;border-radius:6px;cursor:pointer;">Expand All</button>
                <button onclick="document.querySelectorAll('.rp-sec-body').forEach(b=>b.classList.add('collapsed'))" style="padding:4px 10px;font-size:0.75rem;border:1px solid #cbd5e1;background:white;border-radius:6px;cursor:pointer;">Collapse All</button>
            </div>
            <div class="rp-content">
                <!-- COVER PAGE -->
                <div style="background:white;border-radius:12px;padding:3rem 2.5rem;margin-bottom:2rem;position:relative;min-height:600px;border:2px solid #e2e8f0;">
                    <!-- CB Branding Header -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        <div style="width:80px;height:80px;margin:0 auto 1rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(37,99,235,0.3);">
                            <i class="fa-solid fa-certificate" style="color:white;font-size:2.5rem;"></i>
                        </div>
                        <h1 style="margin:0 0 0.5rem;font-size:1.8rem;color:#1e293b;font-weight:700;">Company Certification</h1>
                        <div style="font-size:0.95rem;color:#64748b;font-weight:500;">ISO Certification Body</div>
                        <div style="width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);margin:1.5rem auto;border-radius:2px;"></div>
                    </div>
                    
                    <!-- Report Title -->
                    <div style="text-align:center;margin-bottom:3rem;">
                        <div style="font-size:0.85rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:0.75rem;">Audit Report</div>
                        <h2 style="margin:0 0 1rem;font-size:2rem;color:#0f172a;font-weight:800;line-height:1.3;">${d.report.client}</h2>
                        <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #3b82f6;border-radius:25px;color:#1e40af;font-weight:700;font-size:1rem;">
                            ${d.report.standard || 'ISO Standard'}
                        </div>
                    </div>
                    
                    <!-- Client Logo Placeholder -->
                    <div style="text-align:center;margin:2rem 0;">
                        <div style="width:120px;height:120px;margin:0 auto;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;">
                            <i class="fa-solid fa-building" style="font-size:2rem;color:#94a3b8;"></i>
                            <div style="font-size:0.7rem;color:#94a3b8;font-weight:600;">Client Logo</div>
                        </div>
                    </div>
                    
                    <!-- Audit Details Grid -->
                    <div style="margin:3rem 0;background:#f8fafc;padding:2rem;border-radius:12px;border-left:4px solid #2563eb;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Type</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.auditPlan?.type || 'Certification Audit'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Audit Date</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.date || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Lead Auditor</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;">${d.report.leadAuditor || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Report ID</div>
                                <div style="font-size:1rem;color:#1e293b;font-weight:600;font-family:monospace;">#${d.report.id.substring(0, 10)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Document Control Footer -->
                    <div style="position:absolute;bottom:2rem;left:2.5rem;right:2.5rem;border-top:2px solid #e2e8f0;padding-top:1.5rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;font-size:0.8rem;color:#64748b;">
                            <div>
                                <strong style="color:#1e293b;">Version:</strong> 1.0
                            </div>
                            <div style="text-align:center;">
                                <strong style="color:#1e293b;">Status:</strong> ${d.report.recommendation || 'Draft'}
                            </div>
                            <div style="text-align:right;">
                                <strong style="color:#1e293b;">Page:</strong> 1 of ${sections.filter(s => !s.hide).length + 1}
                            </div>
                        </div>
                        <div style="margin-top:1rem;padding:0.75rem;background:#fef3c7;border-radius:6px;text-align:center;font-size:0.75rem;color:#92400e;">
                            <i class="fa-solid fa-lock" style="margin-right:0.25rem;"></i>
                            <strong>Confidential Document</strong> — For authorized use only
                        </div>
                    </div>
                </div>
                
                <!-- Report Sections -->
                <!-- 1: Audit Info -->
                <div class="rp-sec" id="sec-audit-info">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">1</span>AUDIT INFORMATION<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <table style="width:100%;font-size:0.86rem;border-collapse:collapse;">
                            <tr><td style="padding:7px 12px;width:35%;color:#64748b;font-weight:600;">Client</td><td style="padding:7px 12px;">${d.report.client}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Industry</td><td style="padding:7px 12px;">${d.client.industry || 'N/A'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Certification Scope</td><td style="padding:7px 12px;">${d.client.certificationScope || 'N/A'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Standard</td><td style="padding:7px 12px;">${d.report.standard || d.auditPlan?.standard || 'N/A'}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Audit Type</td><td style="padding:7px 12px;">${d.auditPlan?.auditType || 'Initial'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Dates</td><td style="padding:7px 12px;">${d.report.date || 'N/A'} ${d.report.endDate ? '→ ' + d.report.endDate : ''}</td></tr>
                            <tr><td style="padding:7px 12px;color:#64748b;font-weight:600;">Lead Auditor</td><td style="padding:7px 12px;">${d.report.leadAuditor || 'N/A'}</td></tr>
                            <tr style="background:#f8fafc;"><td style="padding:7px 12px;color:#64748b;font-weight:600;">Location</td><td style="padding:7px 12px;">${[d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ') || 'N/A'}</td></tr>
                            ${(() => {
                if (d.client.latitude && d.client.longitude) {
                    return `<tr><td colspan="2" style="padding:8px 12px;"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(d.client.longitude) - 0.015).toFixed(4)},${(parseFloat(d.client.latitude) - 0.008).toFixed(4)},${(parseFloat(d.client.longitude) + 0.015).toFixed(4)},${(parseFloat(d.client.latitude) + 0.008).toFixed(4)}&layer=mapnik&marker=${d.client.latitude},${d.client.longitude}" style="width:100%;height:140px;border:none;border-radius:8px;"></iframe></td></tr>`;
                }
                const locQuery = [d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ');
                if (locQuery) {
                    return `<tr><td colspan="2" style="padding:8px 12px;"><iframe src="https://maps.google.com/maps?q=${encodeURIComponent(locQuery)}&z=13&output=embed" style="width:100%;height:140px;border:none;border-radius:8px;" allowfullscreen></iframe></td></tr>`;
                }
                return '';
            })()}
                        </table>
                    </div>
                </div>
                <!-- 2: Exec Summary -->
                <div class="rp-sec" id="sec-summary">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#047857,#059669);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">2</span>EXECUTIVE SUMMARY<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;" title="Click to edit"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div id="rp-exec-summary" class="rp-edit" contenteditable="true">${d.report.executiveSummary || '<em style="color:#94a3b8;">Click to add executive summary...</em>'}</div>
                        
                        <!-- AI-Visual Insights Section -->
                        ${(d.report.positiveObservations || d.report.ofi) ? `
                        <div style="margin-top:2rem;padding:1.5rem;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;border:2px solid #0ea5e9;">
                            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
                                <div style="width:48px;height:48px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                                    <i class="fa-solid fa-brain" style="color:white;font-size:1.5rem;"></i>
                                </div>
                                <div>
                                    <h3 style="margin:0;color:#075985;font-size:1.1rem;">AI-Powered Audit Insights</h3>
                                    <div style="color:#0c4a6e;font-size:0.85rem;opacity:0.8;">Analysis for ${d.report.client} — ${d.report.standard || 'ISO Audit'}</div>
                                </div>
                            </div>
                            
                            <!-- Risk & Compliance Dashboard -->
                            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
                                <!-- Overall Risk Score -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid ${d.stats.ncCount === 0 ? '#10b981' : d.stats.ncCount <= 2 ? '#f59e0b' : '#ef4444'};">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Risk Level</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:${d.stats.ncCount === 0 ? '#10b981' : d.stats.ncCount <= 2 ? '#f59e0b' : '#ef4444'};">
                                        ${d.stats.ncCount === 0 ? 'LOW' : d.stats.ncCount <= 2 ? 'MEDIUM' : 'HIGH'}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">${d.stats.ncCount} NC Found</div>
                                </div>
                                
                                <!-- Compliance Score -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid #3b82f6;">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Compliance</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:#3b82f6;">
                                        ${Math.round((d.stats.conformCount / (d.stats.totalItems || 1)) * 100)}%
                                    </div>
                                    <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;margin-top:0.5rem;overflow:hidden;">
                                        <div style="width:${Math.round((d.stats.conformCount / (d.stats.totalItems || 1)) * 100)}%;height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;"></div>
                                    </div>
                                </div>
                                
                                <!-- Client Maturity -->
                                <div style="text-align:center;padding:1rem;background:white;border-radius:10px;border-left:4px solid #8b5cf6;">
                                    <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:0.5rem;">Maturity</div>
                                    <div style="font-size:1.8rem;font-weight:800;color:#8b5cf6;">
                                        ${d.stats.ncCount === 0 ? '⭐⭐⭐⭐⭐' : d.stats.ncCount <= 2 ? '⭐⭐⭐⭐' : d.stats.ncCount <= 5 ? '⭐⭐⭐' : '⭐⭐'}
                                    </div>
                                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:0.25rem;">${d.stats.ncCount === 0 ? 'Excellent' : d.stats.ncCount <= 2 ? 'Good' : d.stats.ncCount <= 5 ? 'Developing' : 'Early Stage'}</div>
                                </div>
                            </div>
                            
                            <!-- Positive Observations (Icon Cards) -->
                            ${d.report.positiveObservations ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;margin-bottom:1rem;border-left:4px solid #10b981;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-circle-check" style="color:#10b981;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#166534;font-size:1rem;">Strengths Identified</h4>
                                </div>
                                <div id="rp-positive-obs" class="rp-edit" contenteditable="true" style="color:#15803d;font-size:0.9rem;line-height:1.7;">
                                    ${d.report.positiveObservations.split(/\d+\./).filter(s => s.trim()).map((obs, idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">${idx + 1}</div>
                                            <div style="flex:1;padding-top:0.25rem;">${obs.trim()}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Opportunities for Improvement (Icon Cards) -->
                            ${d.report.ofi ? `
                            <div style="background:white;padding:1.25rem;border-radius:10px;border-left:4px solid #f59e0b;">
                                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                                    <i class="fa-solid fa-lightbulb" style="color:#f59e0b;font-size:1.25rem;"></i>
                                    <h4 style="margin:0;color:#854d0e;font-size:1rem;">Improvement Opportunities</h4>
                                </div>
                                <div id="rp-ofi" class="rp-edit" contenteditable="true" style="color:#92400e;font-size:0.9rem;line-height:1.7;">
                                    ${(Array.isArray(d.report.ofi) ? d.report.ofi : d.report.ofi.split(/\d+\./).filter(s => s.trim())).map((ofi, idx) => `
                                        <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;align-items:start;">
                                            <div style="min-width:32px;height:32px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;">
                                                <i class="fa-solid fa-arrow-up" style="font-size:0.75rem;"></i>
                                            </div>
                                            <div style="flex:1;padding-top:0.25rem;">${typeof ofi === 'string' ? ofi.trim() : ofi}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- AI Confidence Footer -->
                            <div style="margin-top:1rem;padding:0.75rem;background:rgba(255,255,255,0.6);border-radius:8px;text-align:center;">
                                <div style="font-size:0.75rem;color:#64748b;">
                                    <i class="fa-solid fa-robot" style="margin-right:0.25rem;"></i>
                                    AI-Powered Analysis • Client Context: ${d.report.client} • Standard: ${d.report.standard || 'ISO'}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <!-- 3: Analytics & Insights -->
                <div class="rp-sec" id="sec-charts">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#5b21b6,#7c3aed);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">3</span>ANALYTICS & INSIGHTS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <!-- KPI Metrics Dashboard -->
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:2rem;">
                            <div style="text-align:center;padding:18px 12px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;color:white;">
                                <div style="font-size:2.2rem;font-weight:800;">${Math.round((d.stats.conformCount / (d.stats.totalItems || 1)) * 100)}%</div>
                                <div style="font-size:0.8rem;font-weight:600;opacity:0.9;">COMPLIANCE RATE</div>
                            </div>
                            <div style="text-align:center;padding:18px 12px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px;color:white;">
                                <div style="font-size:2.2rem;font-weight:800;">${d.stats.ncCount}</div>
                                <div style="font-size:0.8rem;font-weight:600;opacity:0.9;">NON-CONFORMITIES</div>
                            </div>
                            <div style="text-align:center;padding:18px 12px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;color:white;">
                                <div style="font-size:2.2rem;font-weight:800;">${d.stats.observationCount}</div>
                                <div style="font-size:0.8rem;font-weight:600;opacity:0.9;">OBSERVATIONS</div>
                            </div>
                            <div style="text-align:center;padding:18px 12px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:10px;color:white;">
                                <div style="font-size:2.2rem;font-weight:800;">${d.stats.totalItems}</div>
                                <div style="font-size:0.8rem;font-weight:600;opacity:0.9;">TOTAL CHECKS</div>
                            </div>
                        </div>
                        
                        <!-- Charts Grid -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Compliance Distribution</h4>
                                <canvas id="compliance-pie-chart" style="max-height:250px;"></canvas>
                            </div>
                            <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                                <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Severity Breakdown</h4>
                                <canvas id="severity-bar-chart" style="max-height:250px;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Findings by Main Clause Chart -->
                        <div style="background:white;padding:16px;border-radius:10px;border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 1rem 0;color:#1e293b;font-size:0.95rem;">Findings by ISO Clause (Main Clauses 4-10)</h4>
                            <canvas id="clause-findings-chart" style="max-height:300px;"></canvas>
                        </div>
                        
                        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                        <script>
                        (function() {
                            // Wait for Chart.js to load
                            setTimeout(() => {
                                if (typeof Chart === 'undefined') {
                                    console.error('Chart.js failed to load');
                                    return;
                                }
                                
                                // 1. Compliance Pie Chart
                                const pieCtx = document.getElementById('compliance-pie-chart');
                                if (pieCtx) {
                                    new Chart(pieCtx.getContext('2d'), {
                                        type: 'doughnut',
                                        data: {
                                            labels: ['Conforming', 'Non-Conformity', 'Observation'],
                                            datasets: [{
                                                data: [${d.stats.conformCount}, ${d.stats.ncCount}, ${d.stats.observationCount}],
                                                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                                                borderWidth: 0
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10 }
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (context) => {
                                                            const total = ${d.stats.conformCount + d.stats.ncCount + d.stats.observationCount};
                                                            const pct = ((context.parsed / total) * 100).toFixed(1);
                                                            return context.label + ': ' + context.parsed + ' (' + pct + '%)';
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 2. Severity Bar Chart
                                const sevCtx = document.getElementById('severity-bar-chart');
                                if (sevCtx) {
                                    const majorCount = ${d.hydratedProgress.filter(i => i.ncrType === 'Major').length};
                                    const minorCount = ${d.hydratedProgress.filter(i => i.ncrType === 'Minor').length};
                                    const obsCount = ${d.stats.observationCount};
                                    
                                    new Chart(sevCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: ['Major NC', 'Minor NC', 'Observations'],
                                            datasets: [{
                                                label: 'Count',
                                                data: [majorCount, minorCount, obsCount],
                                                backgroundColor: ['#dc2626', '#f59e0b', '#fbbf24'],
                                                borderWidth: 0
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { display: false }
                                            },
                                            scales: {
                                                y: { 
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }
                                
                                // 3. Findings by Main Clause Chart
                                const clauseCtx = document.getElementById('clause-findings-chart');
                                if (clauseCtx) {
                                    // Group findings by main clause (e.g., 4.x -> 4, 5.x -> 5)
                                    const clauseData = {};
                                    const allItems = ${JSON.stringify(d.hydratedProgress.map(i => ({
                clause: i.kbMatch?.clause || i.clause || 'N/A',
                status: i.status,
                ncrType: i.ncrType
            })))};
                                    
                                    allItems.forEach(item => {
                                        const mainClause = item.clause.split('.')[0]; // Extract main clause (e.g., "4" from "4.1.2")
                                        if (!clauseData[mainClause]) {
                                            clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ok: 0 };
                                        }
                                        
                                        if (item.status === 'nc') {
                                            if (item.ncrType === 'Major') clauseData[mainClause].major++;
                                            else if (item.ncrType === 'Minor') clauseData[mainClause].minor++;
                                        } else if (item.status === 'observation') {
                                            clauseData[mainClause].obs++;
                                        } else if (item.status === 'ok') {
                                            clauseData[mainClause].ok++;
                                        }
                                    });
                                    
                                    // Sort clauses numerically
                                    const sortedClauses = Object.keys(clauseData).sort((a, b) => {
                                        const numA = parseInt(a) || 999;
                                        const numB = parseInt(b) || 999;
                                        return numA - numB;
                                    });
                                    
                                    new Chart(clauseCtx.getContext('2d'), {
                                        type: 'bar',
                                        data: {
                                            labels: sortedClauses.map(c => 'Clause ' + c),
                                            datasets: [
                                                {
                                                    label: 'Major NC',
                                                    data: sortedClauses.map(c => clauseData[c].major),
                                                    backgroundColor: '#dc2626',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Minor NC',
                                                    data: sortedClauses.map(c => clauseData[c].minor),
                                                    backgroundColor: '#f59e0b',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Observations',
                                                    data: sortedClauses.map(c => clauseData[c].obs),
                                                    backgroundColor: '#fbbf24',
                                                    stack: 'findings'
                                                },
                                                {
                                                    label: 'Conforming',
                                                    data: sortedClauses.map(c => clauseData[c].ok),
                                                    backgroundColor: '#10b981',
                                                    stack: 'findings'
                                                }
                                            ]
                                        },
                                        options: {
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { 
                                                    position: 'bottom',
                                                    labels: { font: { size: 11 }, padding: 10 }
                                                },
                                                tooltip: {
                                                    mode: 'index',
                                                    intersect: false
                                                }
                                            },
                                            scales: {
                                                x: { stacked: true },
                                                y: { 
                                                    stacked: true,
                                                    beginAtZero: true,
                                                    ticks: { stepSize: 1 }
                                                }
                                            }
                                        }
                                    });
                                }
                            }, 300);
                        })();
                        </script>
                    </div>
                </div>
                <!-- 4: Conformance Verification -->
                <div class="rp-sec" id="sec-conformance">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#047857,#10b981);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">4</span>CONFORMANCE VERIFICATION (${d.stats.conformCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f0fdf4;"><th style="padding:10px 14px;text-align:left;width:10%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:10%;">Status</th><th style="padding:10px 14px;text-align:left;width:40%;">Evidence & Remarks</th></tr></thead>
                            <tbody>${conformRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No conformance evidence recorded</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                <!-- 5: Findings -->
                <div class="rp-sec" id="sec-findings">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#991b1b,#dc2626);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">5</span>NON-CONFORMITY DETAILS (${d.stats.ncCount})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body" style="padding:0;">
                        <table style="width:100%;font-size:0.84rem;border-collapse:collapse;">
                            <thead><tr style="background:#f1f5f9;"><th style="padding:10px 14px;text-align:left;width:10%;">Clause</th><th style="padding:10px 14px;text-align:left;width:40%;">ISO Requirement</th><th style="padding:10px 14px;text-align:left;width:10%;">Severity</th><th style="padding:10px 14px;text-align:left;width:40%;">Evidence & Remarks</th></tr></thead>
                            <tbody>${ncRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No non-conformities found</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                ${(d.report.ncrs || []).length > 0 ? `
                <!-- 5: NCRs -->
                <div class="rp-sec" id="sec-ncrs">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#9a3412,#ea580c);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">5</span>NCR REGISTER (${d.report.ncrs.length})<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">${d.report.ncrs.map(ncr => '<div style="padding:10px;border-left:4px solid ' + (ncr.type === 'Major' ? '#dc2626' : '#f59e0b') + ';background:' + (ncr.type === 'Major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 6px 6px 0;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:0.85rem;"><strong>' + ncr.type + ' — Clause ' + ncr.clause + '</strong><span style="color:#64748b;font-size:0.8rem;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.85rem;margin-top:4px;">' + (ncr.description || '') + '</div></div>').join('')}</div>
                </div>` : ''}
                <!-- 6: Meetings -->
                <div class="rp-sec" id="sec-meetings">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#155e75,#0891b2);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">6</span>MEETING RECORDS<span style="margin-left:auto;"><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div style="padding:12px;background:#f0fdf4;border-radius:8px;"><strong style="color:#166534;"><i class="fa-solid fa-pen" style="font-size:0.6rem;margin-right:4px;opacity:0.5;"></i>Opening Meeting</strong><div style="font-size:0.85rem;color:#334155;margin-top:6px;">Date: ${d.report.openingMeeting?.date || 'N/A'}</div><div style="font-size:0.85rem;color:#334155;">Attendees: ${(() => { const att = d.report.openingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a).filter(Boolean).join(', ') || 'N/A'; return String(att); })()}</div><div id="rp-opening-notes" class="rp-edit" contenteditable="true" style="margin-top:6px;font-size:0.85rem;min-height:30px;">${d.report.openingMeeting?.notes || '<em style="color:#94a3b8;">Click to add opening meeting notes...</em>'}</div></div>
                            <div style="padding:12px;background:#eff6ff;border-radius:8px;"><strong style="color:#1e40af;"><i class="fa-solid fa-pen" style="font-size:0.6rem;margin-right:4px;opacity:0.5;"></i>Closing Meeting</strong><div style="font-size:0.85rem;color:#334155;margin-top:6px;">Date: ${d.report.closingMeeting?.date || 'N/A'}</div><div style="font-size:0.85rem;color:#334155;">Attendees: ${(() => { const att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a).filter(Boolean).join(', ') || 'N/A'; return String(att); })()}</div><div id="rp-closing-summary" class="rp-edit" contenteditable="true" style="margin-top:6px;font-size:0.85rem;min-height:30px;">${d.report.closingMeeting?.summary || '<em style="color:#94a3b8;">Click to add closing meeting summary...</em>'}</div></div>
                        </div>
                    </div>
                </div>
                <!-- 7: Conclusion -->
                <div class="rp-sec" id="sec-conclusion">
                    <div class="rp-sec-hdr" style="background:linear-gradient(135deg,#312e81,#4338ca);" onclick="this.nextElementSibling.classList.toggle('collapsed')"><span style="background:rgba(255,255,255,0.2);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;">7</span>AUDIT CONCLUSION<span style="margin-left:auto;"><i class="fa-solid fa-pen" style="font-size:0.7rem;margin-right:8px;opacity:0.7;"></i><i class="fa-solid fa-chevron-down"></i></span></div>
                    <div class="rp-sec-body">
                        <div style="margin-bottom:10px;"><strong style="color:#334155;">Recommendation:</strong> <span style="margin-left:6px;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.82rem;${d.report.recommendation === 'Recommended' ? 'background:#dcfce7;color:#166534;' : d.report.recommendation === 'Not Recommended' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;'}">${d.report.recommendation || 'Pending'}</span></div>
                        <div id="rp-conclusion" class="rp-edit" contenteditable="true">${d.report.conclusion || 'Based on the audit findings, the audit team concludes that the organization\'s management system has been assessed against the applicable standard requirements. Click to edit this conclusion.'}</div>
                    </div>
                </div>
            </div>
            <div class="rp-footer">
                <div style="font-size:0.82rem;color:#64748b;"><i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>${sections.filter(s => !s.hide).length} sections • Click any section to edit • Changes reflect in PDF</div>
                <div style="display:flex;gap:10px;">
                    <button onclick="document.getElementById('report-preview-overlay').remove()" style="padding:10px 20px;border-radius:8px;border:1px solid #cbd5e1;background:white;font-weight:600;cursor:pointer;color:#475569;">Cancel</button>
                    <button id="ai-polish-btn" onclick="window.polishNotesWithAI()" style="padding:10px 20px;border-radius:8px;border:2px solid #0ea5e9;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);font-weight:600;cursor:pointer;color:#0369a1;"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;"></i>Polish Notes with AI</button>
                    <button onclick="window.exportReportPDF()" style="padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.3);"><i class="fa-solid fa-file-pdf" style="margin-right:6px;"></i>Export PDF</button>
                </div>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Charts: <script> inside innerHTML doesn't execute — init programmatically
        window._initPreviewCharts = function () {
            const d = window._reportPreviewData;
            if (!d) return;

            function renderCharts() {
                // 1. Compliance Pie
                const pieCtx = document.getElementById('compliance-pie-chart');
                if (pieCtx) {
                    new Chart(pieCtx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Conforming', 'Non-Conformity', 'Observation'],
                            datasets: [{ data: [d.stats.conformCount, d.stats.ncCount, d.stats.observationCount], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } }
                    });
                }
                // 2. Severity Bar
                const sevCtx = document.getElementById('severity-bar-chart');
                if (sevCtx) {
                    new Chart(sevCtx.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: ['Major NC', 'Minor NC', 'Observations'],
                            datasets: [{ label: 'Count', data: [d.stats.majorNC, d.stats.minorNC, d.stats.observationCount], backgroundColor: ['#dc2626', '#f59e0b', '#fbbf24'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
                    });
                }
                // 3. Findings by Clause
                const clauseCtx = document.getElementById('clause-findings-chart');
                if (clauseCtx) {
                    const clauseData = {};
                    d.hydratedProgress.forEach(item => {
                        const clause = item.kbMatch?.clause || item.clause || 'N/A';
                        const mainClause = clause.split('.')[0];
                        if (!clauseData[mainClause]) clauseData[mainClause] = { major: 0, minor: 0, obs: 0, ok: 0 };
                        if (item.status === 'nc') {
                            if (item.ncrType === 'Major') clauseData[mainClause].major++;
                            else if (item.ncrType === 'Minor') clauseData[mainClause].minor++;
                            else clauseData[mainClause].obs++;
                        } else if (item.status === 'conform') {
                            clauseData[mainClause].ok++;
                        }
                    });
                    const sorted = Object.keys(clauseData).sort((a, b) => parseInt(a) - parseInt(b));
                    if (sorted.length) {
                        new Chart(clauseCtx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: sorted.map(c => 'Clause ' + c),
                                datasets: [
                                    { label: 'Major NC', data: sorted.map(c => clauseData[c].major), backgroundColor: '#dc2626', stack: 'f' },
                                    { label: 'Minor NC', data: sorted.map(c => clauseData[c].minor), backgroundColor: '#f59e0b', stack: 'f' },
                                    { label: 'Observations', data: sorted.map(c => clauseData[c].obs), backgroundColor: '#fbbf24', stack: 'f' },
                                    { label: 'Conforming', data: sorted.map(c => clauseData[c].ok), backgroundColor: '#10b981', stack: 'f' }
                                ]
                            },
                            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } }
                        });
                    }
                }
            }

            // Load Chart.js if not already loaded
            if (typeof Chart !== 'undefined') {
                renderCharts();
            } else {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                s.onload = renderCharts;
                document.head.appendChild(s);
            }
        };

        // Init charts after DOM settles
        setTimeout(() => window._initPreviewCharts(), 300);
    };

    window.toggleReportSection = function (id, color) {
        const pill = document.getElementById('pill-' + id);
        const sec = document.getElementById('sec-' + id);
        if (!pill) return;
        const wasActive = pill.classList.contains('active');
        window._reportSectionState[id] = !wasActive;
        if (wasActive) {
            pill.classList.remove('active');
            pill.style.background = 'white'; pill.style.color = '#94a3b8'; pill.style.borderColor = '#cbd5e1';
            if (sec) sec.style.display = 'none';
        } else {
            pill.classList.add('active');
            pill.style.background = color; pill.style.color = 'white'; pill.style.borderColor = color;
            if (sec) sec.style.display = '';
        }
    };

    // ============================================
    // AI AUTO-CLASSIFY & POLISH (Combined: classify severity + refine notes)
    // ============================================
    window.runFollowUpAIAnalysis = async function (reportId) {
        const btn = document.getElementById('btn-ai-classify');
        if (!btn) return;

        // Get the report and standard
        const reports = window.state?.auditReports || JSON.parse(localStorage.getItem('audit_reports') || '[]');
        const report = reports.find(r => String(r.id) === String(reportId));
        if (!report) { window.showNotification('Report not found.', 'error'); return; }

        const standardName = report.standard || '';
        const checklistProgress = report.checklistProgress || [];

        // Check AI service availability
        if (!window.AI_SERVICE) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Show loading state
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Classifying & Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            // STEP 1: Collect all findings from the DOM
            const findingCards = document.querySelectorAll('.review-severity');
            const findings = [];
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarkText = textarea?.value || '';
                const card = select.closest('.card');
                const clauseEl = card?.querySelector('[style*="font-weight: 700"]');
                const clause = clauseEl?.textContent?.match(/[\d.]+/)?.[0] || '';

                findings.push({
                    id: fid,
                    clause: clause,
                    status: 'nc',
                    comment: remarkText,
                    remarks: remarkText,
                    type: select.value
                });
            });

            if (findings.length === 0) {
                window.showNotification('No findings to process.', 'info');
                btn.innerHTML = originalBtnHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                return;
            }

            let classifyCount = 0;
            let polishCount = 0;
            let generateCount = 0;

            // STEP 2: AI Classify Findings (if analyzeFindings available)
            if (window.AI_SERVICE.analyzeFindings) {
                try {
                    const classified = await window.AI_SERVICE.analyzeFindings(findings, standardName);
                    if (classified && Array.isArray(classified)) {
                        classified.forEach((result, i) => {
                            if (result.type && findings[i]) {
                                const select = document.querySelector('.review-severity[data-finding-id="' + findings[i].id + '"]');
                                if (select) {
                                    const newType = result.type.toLowerCase();
                                    if (['major', 'minor', 'observation'].includes(newType)) {
                                        select.value = newType;
                                        findings[i].type = newType;
                                        classifyCount++;
                                        // Update border color
                                        const card = select.closest('.card');
                                        if (card) {
                                            const color = newType === 'major' ? '#dc2626' : newType === 'minor' ? '#d97706' : '#8b5cf6';
                                            card.style.borderLeftColor = color;
                                        }
                                    }
                                }
                            }
                        });
                    }
                } catch (classifyErr) {
                    console.warn('Classification error (continuing with generation):', classifyErr);
                }
            }

            // STEP 2.5: AI Generate Conformance Text (for findings with empty remarks)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Generating conformance text...';
            if (window.AI_SERVICE.generateConformanceText) {
                try {
                    const emptyFindings = findings.filter(f => !f.comment || f.comment.trim().length < 5);
                    if (emptyFindings.length > 0) {
                        const generated = await window.AI_SERVICE.generateConformanceText(emptyFindings, standardName);
                        if (generated && Array.isArray(generated)) {
                            generated.forEach((result, i) => {
                                if (result.comment && result._aiGenerated) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + emptyFindings[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        // Also update the finding object for later save
                                        const origIdx = findings.findIndex(f => f.id === emptyFindings[i].id);
                                        if (origIdx >= 0) findings[origIdx].comment = result.comment;
                                        generateCount++;
                                        // Flash blue for generated items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#eff6ff';
                                        setTimeout(() => { textarea.style.background = ''; }, 3000);
                                    }
                                }
                            });
                        }
                    }
                } catch (genErr) {
                    console.warn('Conformance text generation error (continuing with polish):', genErr);
                }
            }

            // STEP 3: AI Polish Notes (refine raw text to professional language)
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Polishing notes...';
            if (window.AI_SERVICE.refineAuditNotes) {
                try {
                    const toPolish = findings.filter(f => f.comment && f.comment.trim());
                    if (toPolish.length > 0) {
                        const refined = await window.AI_SERVICE.refineAuditNotes(toPolish, standardName);
                        if (refined && Array.isArray(refined)) {
                            refined.forEach((result, i) => {
                                if (result.comment && result.comment !== toPolish[i].comment) {
                                    const textarea = document.querySelector('.review-remarks[data-finding-id="' + toPolish[i].id + '"]');
                                    if (textarea) {
                                        textarea.value = result.comment;
                                        polishCount++;
                                        // Flash green for polished items
                                        textarea.style.transition = 'background 0.3s';
                                        textarea.style.background = '#f0fdf4';
                                        setTimeout(() => { textarea.style.background = ''; }, 2500);
                                    }
                                }
                            });
                        }
                    }
                } catch (polishErr) {
                    console.warn('Polish error:', polishErr);
                }
            }

            // STEP 4: Auto-save to DB by updating the report object and persisting
            findingCards.forEach(select => {
                const fid = select.dataset.findingId;
                const newType = select.value;
                const textarea = document.querySelector('.review-remarks[data-finding-id="' + fid + '"]');
                const remarks = textarea?.value || '';

                if (fid.startsWith('checklist-')) {
                    const idx = parseInt(fid.replace('checklist-', ''));
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        if (remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (fid.startsWith('ncr-')) {
                    const idx = parseInt(fid.replace('ncr-', ''));
                    if (report.ncrs && report.ncrs[idx]) {
                        report.ncrs[idx].type = newType;
                        if (remarks) report.ncrs[idx].description = remarks;
                    }
                }
            });

            // Persist to localStorage
            const existingReports = JSON.parse(localStorage.getItem('audit_reports') || '[]');
            const rIdx = existingReports.findIndex(r => r.id === reportId);
            if (rIdx !== -1) {
                existingReports[rIdx] = report;
                localStorage.setItem('audit_reports', JSON.stringify(existingReports));
            }

            // Persist to Supabase
            if (window.SupabaseClient?.db?.upsert) {
                try {
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        checklist_progress: report.checklistProgress || [],
                        ncrs: report.ncrs || [],
                        data: report || {}
                    });
                } catch (dbErr) {
                    console.warn('DB save after AI classify:', dbErr);
                }
            }

            // Success UI
            const parts = [];
            if (classifyCount) parts.push(classifyCount + ' classified');
            if (generateCount) parts.push(generateCount + ' generated');
            if (polishCount) parts.push(polishCount + ' polished');
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Done! ' + (parts.join(', ') || 'No changes');
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            window.showNotification('AI: ' + (parts.join(', ') || 'No changes needed') + '. All saved.', 'success');

        } catch (error) {
            console.error('AI Classify & Polish error:', error);
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI processing failed: ' + error.message, 'error');
        }

        // Reset button after 4s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify & Polish';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
        }, 4000);
    };

    // ============================================
    // POLISH NOTES WITH AI (Refine raw notes into professional audit language)
    // ============================================
    window.polishNotesWithAI = async function () {
        const d = window._reportPreviewData;
        if (!d) return;
        const btn = document.getElementById('ai-polish-btn');
        if (!btn) return;

        // Check if AI service is available
        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available. Please check your API configuration.', 'warning');
            return;
        }

        // Show loading state
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Polishing Notes...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            const standardName = d.report.standard || d.auditPlan?.standard || '';

            // Refine checklist progress notes
            if (d.hydratedProgress && d.hydratedProgress.length > 0) {
                const refined = await window.AI_SERVICE.refineAuditNotes(d.hydratedProgress, standardName);
                d.hydratedProgress = refined;
            }

            // Refine NCR descriptions
            if (d.report.ncrs && d.report.ncrs.length > 0) {
                const ncrFindings = d.report.ncrs.map(n => ({
                    clause: n.clause,
                    status: 'nc',
                    type: n.type,
                    comment: n.description || '',
                    remarks: n.description || ''
                }));
                const refinedNCRs = await window.AI_SERVICE.refineAuditNotes(ncrFindings, standardName);
                d.report.ncrs = d.report.ncrs.map((ncr, i) => ({
                    ...ncr,
                    description: refinedNCRs[i]?.comment || ncr.description,
                    _originalDescription: ncr.description
                }));
            }

            // Update the findings table in the preview if visible
            const findingsBody = document.getElementById('findings-table-body');
            if (findingsBody && d.hydratedProgress) {
                const items = d.hydratedProgress.filter(i => i.status !== 'pending');
                findingsBody.innerHTML = items.map((item, idx) => {
                    const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
                    const sev = item.status === 'nc' ? (item.ncrType || 'NC') : item.status === 'observation' ? 'OBS' : 'OK';
                    const sevColor = sev === 'Major' ? '#dc2626' : sev === 'Minor' ? '#f59e0b' : sev === 'OBS' ? '#3b82f6' : '#10b981';
                    return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:8px 12px;font-weight:600;">' + clause + '</td><td style="padding:8px 12px;text-align:center;"><span style="padding:2px 10px;border-radius:10px;font-size:0.75rem;font-weight:700;color:' + sevColor + ';">' + sev + '</span></td><td style="padding:8px 12px;color:#334155;font-size:0.88rem;line-height:1.6;">' + (item.comment || '-') + '</td></tr>';
                }).join('');
            }

            // Success state
            btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i>Notes Polished!';
            btn.style.background = 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#166534';
            btn.style.opacity = '1';

            const totalRefined = (d.hydratedProgress?.filter(i => i._originalComment)?.length || 0) + (d.report.ncrs?.filter(n => n._originalDescription)?.length || 0);
            window.showNotification(`AI polished ${totalRefined} auditor notes into professional language!`, 'success');

            // Allow re-polish after 3 seconds
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.background = 'linear-gradient(135deg,#f0f9ff,#e0f2fe)';
                btn.style.borderColor = '#0ea5e9';
                btn.style.color = '#0369a1';
            }, 3000);

        } catch (error) {
            console.error('AI Polish Error:', error);
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            btn.style.opacity = '1';
            window.showNotification('AI polish failed: ' + error.message, 'error');
        }
    };

    // ============================================
    // POLISH SINGLE FINDING NOTE (Per-finding AI refinement)
    // ============================================
    window.polishSingleNote = async function (btn) {
        if (!btn || btn.disabled) return;
        const findingId = btn.getAttribute('data-finding-id');
        if (!findingId) return;

        // Find the textarea in the same parent
        const textarea = btn.parentElement.querySelector('textarea.review-remarks');
        if (!textarea || !textarea.value.trim()) {
            window.showNotification('No remarks to polish. Write some notes first.', 'info');
            return;
        }

        if (!window.AI_SERVICE?.refineAuditNotes) {
            window.showNotification('AI Service not available.', 'warning');
            return;
        }

        // Save original and show loading
        const originalText = textarea.value;
        const originalBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.7rem;"></i> Polishing...';
        btn.disabled = true;
        btn.style.opacity = '0.6';

        try {
            // Get clause context from the finding card
            const card = btn.closest('.review-finding-card, [data-finding-id]') || btn.parentElement.parentElement;
            const clauseEl = card?.querySelector('[style*="font-weight: 700"], [style*="font-weight:700"]');
            const clause = clauseEl?.textContent?.trim() || '';

            // Get standard name
            const d = window._reportPreviewData || {};
            const standardName = d?.report?.standard || d?.auditPlan?.standard || '';

            // Build single finding for AI
            const finding = [{
                clause: clause,
                status: 'finding',
                comment: originalText,
                remarks: originalText
            }];

            const refined = await window.AI_SERVICE.refineAuditNotes(finding, standardName);

            if (refined[0]?.comment && refined[0].comment !== originalText) {
                textarea.value = refined[0].comment;
                textarea.style.transition = 'background 0.3s';
                textarea.style.background = '#f0fdf4';
                setTimeout(() => { textarea.style.background = ''; }, 2000);

                // Success state
                btn.innerHTML = '<i class="fa-solid fa-check" style="font-size:0.7rem;"></i> Polished!';
                btn.style.background = '#dcfce7';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#166534';
            } else {
                btn.innerHTML = originalBtnHtml;
                window.showNotification('Notes already look professional!', 'info');
            }
        } catch (error) {
            console.error('Single note polish error:', error);
            textarea.value = originalText;
            btn.innerHTML = originalBtnHtml;
            window.showNotification('AI polish failed. Try again.', 'error');
        }

        // Reset button after 3s
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.7rem;"></i>Polish with AI';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.background = '#f0f9ff';
            btn.style.borderColor = '#0ea5e9';
            btn.style.color = '#0369a1';
        }, 3000);
    };

    // ============================================
    // EXPORT REPORT PDF (Premium ISO-Compliant)
    // ============================================
    window.exportReportPDF = function () {
        const d = window._reportPreviewData;
        if (!d) return;
        const en = window._reportSectionState || {};
        const editedSummary = document.getElementById('rp-exec-summary')?.innerHTML || d.report.executiveSummary || '';
        const editedConclusion = document.getElementById('rp-conclusion')?.innerHTML || d.report.conclusion || '';
        const editedPositiveObs = document.getElementById('rp-positive-obs')?.innerHTML || d.report.positiveObservations || '';
        const editedOfi = document.getElementById('rp-ofi')?.innerHTML || d.report.ofi || '';
        const editedOpeningNotes = document.getElementById('rp-opening-notes')?.innerText || d.report.openingMeeting?.notes || '';
        const editedClosingSummary = document.getElementById('rp-closing-summary')?.innerText || d.report.closingMeeting?.summary || '';
        const formatText = (text) => { if (!text) return ''; return text.replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\(Clause ([^)]+)\)/g, '<em style="font-size:0.9em;color:#059669;">(Clause $1)</em>'); };
        const fmtRemark = (t) => { if (!t) return ''; let s = t.trim(); if (!s) return ''; s = s.charAt(0).toUpperCase() + s.slice(1); if (!/[.!?]$/.test(s)) s += '.'; return s; };
        const printWindow = window.open('', '_blank');
        if (!printWindow) { window.showNotification('Pop-up blocked. Please allow pop-ups.', 'warning'); return; }
        const clauseLabels = Object.keys(d.stats.ncByClause).sort((a, b) => parseInt(a) - parseInt(b));
        const clauseValues = clauseLabels.map(k => d.stats.ncByClause[k]);
        const standard = d.report.standard || d.auditPlan?.standard || 'ISO Standard';
        const cbName = d.cbSettings.cbName || '';
        const cbEmail = d.cbSettings.cbEmail || '';
        const cbSiteAddr = d.cbSite.address ? (d.cbSite.address + ', ' + (d.cbSite.city || '') + ' ' + (d.cbSite.country || '')).trim() : '';
        // Helper: render all evidence images for PDF (string concat)
        var renderEvThumbsPdf = function (item) {
            var imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
            if (!imgs.length) return '';
            return '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">' + imgs.map(function (url) { return '<a href="' + url + '" target="_blank"><img src="' + url + '" style="height:80px;border-radius:6px;border:1px solid #e2e8f0;"></a>'; }).join('') + '</div>';
        };
        const ncRowsHtml = d.hydratedProgress.filter(i => i.status === 'nc').map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            const sev = item.ncrType || 'NC';
            const sevBg = sev === 'Major' ? '#fee2e2' : sev === 'Minor' ? '#fef3c7' : '#dbeafe';
            const sevFg = sev === 'Major' ? '#991b1b' : sev === 'Minor' ? '#92400e' : '#1e40af';
            return '<tr style="background:' + (idx % 2 ? '#f8fafc' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:' + sevBg + ';color:' + sevFg + ';">' + sev + '</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        // Conformance rows for PDF (items with comments or evidence)
        const conformRowsHtml = d.hydratedProgress.filter(i => i.status === 'conform' && (i.comment || i.evidenceImage || (i.evidenceImages && i.evidenceImages.length))).map((item, idx) => {
            const clause = item.kbMatch ? item.kbMatch.clause : item.clause;
            const title = item.kbMatch ? item.kbMatch.title : '';
            const req = (item.kbMatch && item.kbMatch.requirement) ? item.kbMatch.requirement : (item.requirement || item.description || item.text || '');
            return '<tr style="background:' + (idx % 2 ? '#f0fdf4' : 'white') + ';"><td style="padding:12px 14px;font-weight:700;white-space:nowrap;">' + clause + '</td><td style="padding:12px 14px;">' + (title ? '<strong style="color:#1e293b;">' + title + '</strong><div style="margin-top:4px;color:#475569;font-size:0.85em;line-height:1.6;">' + req + '</div>' : req) + '</td><td style="padding:12px 14px;text-align:center;"><span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;background:#dcfce7;color:#166534;">Conform</span></td><td style="padding:12px 14px;color:#334155;line-height:1.6;">' + (fmtRemark(item.comment) || '<span style="color:#94a3b8;">No remarks recorded.</span>') + renderEvThumbsPdf(item) + '</td></tr>';
        }).join('');

        const reportHtml = '<!DOCTYPE html><html><head>'
            + '<title>Audit Report — ' + d.report.client + '</title>'
            + '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
            + '<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>'
            + '<style>'
            + "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');"
            + '*{margin:0;padding:0;box-sizing:border-box;}'
            + "body{font-family:'Outfit',sans-serif;color:#1e293b;background:white;max-width:1050px;margin:0 auto;}"
            + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-top:22mm;padding-bottom:18mm;}.page-break{page-break-before:always;}.no-print{display:none !important;}.section-card,tr{break-inside:avoid;}}'
            + '@media print{@page{margin:20mm 15mm 25mm 15mm;@bottom-center{content:counter(page);font-size:0.7rem;color:#64748b;}}.rpt-hdr{display:flex !important;}.rpt-ftr{display:flex !important;}.cover{padding-top:0 !important;margin-top:-22mm;}.cover .rpt-hdr,.cover .rpt-ftr{display:none !important;}}'
            + 'body{counter-reset:page;}'
            + '.page-break{counter-increment:page;}'
            + '.rpt-hdr{display:none;position:fixed;top:0;left:0;right:0;height:18mm;background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:4mm 15mm;align-items:center;justify-content:space-between;font-size:0.75rem;z-index:100;}'
            + '.rpt-hdr-left{display:flex;align-items:center;gap:10px;font-weight:700;font-size:0.85rem;}'
            + '.rpt-hdr-logo{height:24px;max-width:120px;object-fit:contain;border-radius:3px;}'
            + '.rpt-hdr-logo-fallback{width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;}'
            + '.rpt-hdr-center{text-align:center;flex:1;font-size:0.7rem;opacity:0.85;letter-spacing:0.3px;text-transform:uppercase;}'
            + '.rpt-hdr-right{text-align:right;font-size:0.72rem;opacity:0.85;}'
            + '.rpt-ftr{display:none;position:fixed;bottom:0;left:0;right:0;height:16mm;border-top:2px solid #2563eb;padding:2mm 15mm;align-items:center;justify-content:space-between;font-size:0.7rem;color:#64748b;background:white;z-index:100;}'
            + '.rpt-ftr-left{font-weight:600;color:#1e3a5f;font-size:0.68rem;max-width:35%;}'
            + '.rpt-ftr-center{flex:1;text-align:center;font-size:0.62rem;color:#94a3b8;font-style:italic;padding:0 8px;}'
            + '.rpt-ftr-right{text-align:right;font-weight:700;color:#1e3a5f;font-size:0.72rem;white-space:nowrap;}'
            + '.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(180deg,#f8fafc 0%,#e0e7ff 50%,#f8fafc 100%);padding:80px 50px;position:relative;}'
            + '.cover-line{width:80px;height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:2px;margin:0 auto 30px;}'
            + '.sh{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:14px 24px;font-weight:700;font-size:1rem;letter-spacing:0.5px;display:flex;align-items:center;gap:12px;border-radius:6px 6px 0 0;margin-top:35px;}'
            + '.sn{background:rgba(255,255,255,0.2);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;}'
            + '.sb{padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;}'
            + '.info-tbl{width:100%;border-collapse:collapse;}.info-tbl td{padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:0.92rem;}.info-tbl td:first-child{width:35%;color:#64748b;font-weight:600;}.info-tbl tr:nth-child(even){background:#f8fafc;}'
            + '.f-tbl{width:100%;border-collapse:collapse;font-size:0.88rem;}.f-tbl th{background:#f1f5f9;color:#475569;font-weight:700;text-align:left;padding:12px 14px;border-bottom:2px solid #e2e8f0;}.f-tbl td{padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;}.f-tbl tbody tr:nth-child(even){background:#f8fafc;}'
            + '.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px;}'
            + '.stat-box{text-align:center;padding:20px 12px;border-radius:10px;border-bottom:3px solid transparent;}'
            + '.stat-val{font-size:2.2rem;font-weight:800;line-height:1;margin-bottom:4px;}'
            + '.stat-lbl{font-size:0.8rem;color:#64748b;font-weight:600;text-transform:uppercase;}'
            + '.chart-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;}'
            + '.chart-box{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;text-align:center;}'
            + '.chart-box canvas{max-height:220px;}'
            + '.chart-title{font-size:0.85rem;font-weight:700;color:#334155;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.3px;}'
            + '.ev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}.ev-card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid;}.ev-card img{width:100%;height:180px;object-fit:cover;}.ev-cap{padding:10px 14px;font-size:0.82rem;}.ev-cap strong{display:block;color:#1e293b;margin-bottom:2px;}.ev-cap span{color:#64748b;}'
            + '.toc{padding:40px 50px;min-height:60vh;}.toc-title{font-size:1.8rem;font-weight:800;color:#0f172a;margin-bottom:6px;}.toc-sub{font-size:0.92rem;color:#64748b;margin-bottom:30px;}.toc-line{width:60px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:2px;margin-bottom:35px;}'
            + '.toc-item{display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit;transition:background 0.2s;}.toc-item:hover{background:#f8fafc;}.toc-num{min-width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;color:white;flex-shrink:0;}.toc-item-body{flex:1;}.toc-item-title{font-weight:700;font-size:1rem;color:#1e293b;}.toc-item-desc{font-size:0.82rem;color:#94a3b8;margin-top:3px;}'
            + 'footer{margin-top:50px;background:#0f172a;color:white;padding:30px 40px;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;border-radius:8px;}'
            + '.content{padding:0 40px;}'
            + '.callout{padding:14px 18px;border-radius:8px;margin-top:16px;font-size:0.92rem;line-height:1.7;}'
            + '</style></head><body>'
            + '<div class="rpt-hdr"><div class="rpt-hdr-left">' + (d.cbLogo ? '<img src="' + d.cbLogo + '" class="rpt-hdr-logo" alt="Logo">' : '<div class="rpt-hdr-logo-fallback"><i class="fa-solid fa-certificate"></i></div>') + '<span>' + (cbName || 'Certification Body') + '</span></div><div class="rpt-hdr-center">' + standard + ' Audit Report</div><div class="rpt-hdr-right">' + d.report.client + '<br>Ref: ' + d.report.id + '</div></div>'
            + '<div class="rpt-ftr"><div class="rpt-ftr-left">Doc Ref: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : d.report.id) + '<br>' + (cbName || 'Certification Body') + '</div><div class="rpt-ftr-center">This document is confidential and intended solely for the audited organization.<br>Unauthorized copying or distribution is prohibited.</div><div class="rpt-ftr-right">' + d.today + '</div></div>'
            + '<div class="no-print" style="position:fixed;top:20px;right:20px;z-index:1000;display:flex;gap:8px;">'
            + '<button onclick="window.print()" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.3);"><i class="fa fa-download" style="margin-right:6px;"></i>Download PDF</button>'
            + '<button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;">Close</button></div>'
            // COVER PAGE
            + '<div class="cover">'
            + (d.cbLogo ? '<img src="' + d.cbLogo + '" style="height:70px;object-fit:contain;margin-bottom:30px;" alt="CB Logo">' : '')
            + '<div class="cover-line"></div>'
            + '<h1 style="font-size:2.8rem;font-weight:800;color:#0f172a;letter-spacing:1px;">AUDIT REPORT</h1>'
            + '<p style="font-size:1.15rem;color:#64748b;margin-top:8px;">' + standard + '</p>'
            + '<div style="margin-top:50px;"><div style="font-size:2rem;font-weight:700;color:#2563eb;">' + d.report.client + '</div>'
            + (d.client.industry ? '<div style="font-size:1rem;color:#64748b;margin-top:6px;">' + d.client.industry + '</div>' : '') + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;max-width:480px;text-align:left;margin-top:50px;">'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Report Date</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.date || 'N/A') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Report ID</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">#' + d.report.id.substring(0, 8) + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Lead Auditor</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.report.leadAuditor || 'N/A') + '</div></div>'
            + '<div><div style="font-size:0.78rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Audit Type</div><div style="font-size:0.95rem;color:#1e293b;font-weight:500;margin-top:2px;">' + (d.auditPlan?.auditType || 'Initial') + '</div></div></div>'
            + '<div style="position:absolute;bottom:50px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:30px;">'
            + (d.clientLogo ? '<img src="' + d.clientLogo + '" style="height:60px;object-fit:contain;" alt="Client">' : '')
            + '<img src="' + d.qrCodeUrl + '" style="height:80px;" alt="QR"></div></div>'
            // TABLE OF CONTENTS
            + (function () {
                var tocSections = [];
                var colors = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#059669', '#ea580c', '#0891b2', '#4338ca', '#c2410c'];
                var descs = ['Organization details, scope, audit team and dates', 'Key findings overview, positive observations & OFIs', 'Compliance charts, KPIs and clause-based breakdown', 'Detailed non-conformity findings with evidence', 'Verified conforming items with supporting evidence', 'Formal NCR register with severity classifications', 'Opening and closing meeting records', 'Certification recommendation and auditor signatures', 'Photographic evidence from the audit'];
                var names = ['AUDIT INFORMATION', 'EXECUTIVE SUMMARY', 'ANALYTICS DASHBOARD', 'NON-CONFORMITY DETAILS', 'CONFORMANCE VERIFICATION', 'NCR REGISTER', 'MEETING RECORDS', 'AUDIT CONCLUSION & RECOMMENDATION', 'EVIDENCE GALLERY'];
                var keys = ['audit-info', 'summary', 'charts', 'findings', 'conformance', 'ncrs', 'meetings', 'conclusion', 'evidence'];
                var num = 1;
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (k === 'ncrs' && (!(d.report.ncrs || []).length)) continue;
                    if (k === 'evidence') {
                        var hasEvidence = (d.hydratedProgress || []).some(function (it) { return it.evidenceImage; }) || (d.report.ncrs || []).some(function (n) { return n.evidenceImage; });
                        if (!hasEvidence) continue;
                    }
                    if (en[k] !== false) {
                        tocSections.push('<a href="#sec-' + k + '" class="toc-item"><div class="toc-num" style="background:' + colors[i] + ';">' + num + '</div><div class="toc-item-body"><div class="toc-item-title">' + names[i] + '</div><div class="toc-item-desc">' + descs[i] + '</div></div></a>');
                        num++;
                    }
                }
                if (tocSections.length === 0) return '';
                return '<div class="toc page-break"><div class="toc-title">Table of Contents</div><div class="toc-sub">' + d.report.client + ' — ' + standard + '</div><div class="toc-line"></div>' + tocSections.join('') + '<div style="margin-top:30px;text-align:center;font-size:0.78rem;color:#94a3b8;"><i class="fa-solid fa-file-lines" style="margin-right:4px;"></i>' + tocSections.length + ' sections in this report</div></div>';
            })()
            + '<div class="content">'
            // SECTION 1
            + (en['audit-info'] !== false ? '<div id="sec-audit-info" class="sh page-break"><span class="sn">1</span>AUDIT INFORMATION</div><div class="sb"><table class="info-tbl">'
                + '<tr><td>Client Name</td><td><strong>' + d.report.client + '</strong></td></tr>'
                + '<tr><td>Industry</td><td>' + (d.client.industry || 'N/A') + '</td></tr>'
                + '<tr><td>Certification Scope</td><td>' + (d.client.certificationScope || 'N/A') + '</td></tr>'
                + '<tr><td>Number of Employees</td><td>' + (d.client.numberOfEmployees || 'N/A') + '</td></tr>'
                + '<tr><td>Audit Standard</td><td>' + standard + '</td></tr>'
                + '<tr><td>Audit Type</td><td>' + (d.auditPlan?.auditType || 'Initial') + '</td></tr>'
                + '<tr><td>Audit Dates</td><td>' + (d.report.date || 'N/A') + (d.report.endDate ? ' → ' + d.report.endDate : '') + '</td></tr>'
                + '<tr><td>Lead Auditor</td><td>' + (d.report.leadAuditor || 'N/A') + '</td></tr>'
                + '<tr><td>Audit Location</td><td>' + ([d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ') || 'N/A') + '</td></tr>'
                + (d.client.latitude ? '<tr><td>Geo-Coordinates</td><td><a href="https://www.openstreetmap.org/?mlat=' + d.client.latitude + '&mlon=' + d.client.longitude + '#map=15/' + d.client.latitude + '/' + d.client.longitude + '" target="_blank" style="color:#2563eb;text-decoration:none;">' + d.client.latitude + ', ' + d.client.longitude + ' ↗</a></td></tr>' : '')
                + '<tr><td>Plan Reference</td><td>' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : 'Not Linked') + '</td></tr>'
                + '</table>'
                + (function () {
                    if (d.client.latitude && d.client.longitude) {
                        return '<div style="margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;"><img src="https://staticmap.openstreetmap.de/staticmap.php?center=' + d.client.latitude + ',' + d.client.longitude + '&zoom=14&size=600x160&maptype=mapnik&markers=' + d.client.latitude + ',' + d.client.longitude + ',red-pushpin" style="width:100%;height:140px;object-fit:cover;display:block;" alt="Audit Location Map"></div>';
                    }
                    var locQ = [d.client.address, d.client.city, d.client.province, d.client.country].filter(Boolean).join(', ');
                    if (locQ) {
                        return '<div style="margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;"><iframe src="https://maps.google.com/maps?q=' + encodeURIComponent(locQ) + '&z=13&output=embed" style="width:100%;height:140px;border:none;display:block;" allowfullscreen></iframe></div>';
                    }
                    return '';
                })()
                + (d.client.goodsServices && d.client.goodsServices.length > 0 ? '<div style="margin-top:16px;"><strong style="font-size:0.88rem;color:#334155;">Goods & Services:</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' + d.client.goodsServices.map(g => '<span style="padding:3px 10px;border-radius:12px;font-size:0.8rem;background:#fef3c7;color:#92400e;border:1px solid #fde047;">' + g.name + (g.category ? ' (' + g.category + ')' : '') + '</span>').join('') + '</div></div>' : '')
                + (d.client.keyProcesses && d.client.keyProcesses.length > 0 ? '<div style="margin-top:12px;"><strong style="font-size:0.88rem;color:#334155;">Key Processes:</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' + d.client.keyProcesses.map(p => '<span style="padding:3px 10px;border-radius:12px;font-size:0.8rem;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;">' + (p.name || p) + '</span>').join('') + '</div></div>' : '')
                + '</div>' : '')
            // SECTION 2
            + (en['summary'] !== false ? '<div id="sec-summary" class="sh page-break" style="background:linear-gradient(135deg,#047857,#059669);"><span class="sn">2</span>EXECUTIVE SUMMARY</div><div class="sb"><div style="color:#334155;font-size:0.95rem;line-height:1.8;">' + (formatText(editedSummary) || '<em>No executive summary recorded.</em>') + '</div>'
                + (editedPositiveObs ? '<div class="callout" style="background:#f0fdf4;border-left:4px solid #22c55e;"><strong style="color:#166534;">Positive Observations</strong><div style="color:#15803d;margin-top:6px;">' + editedPositiveObs + '</div></div>' : '')
                + (editedOfi ? '<div class="callout" style="background:#fffbeb;border-left:4px solid #f59e0b;"><strong style="color:#854d0e;">Opportunities for Improvement</strong><div style="color:#a16207;margin-top:6px;">' + editedOfi + '</div></div>' : '')
                + '</div>' : '')
            // SECTION 3
            + (en['charts'] !== false ? '<div id="sec-charts" class="sh page-break" style="background:linear-gradient(135deg,#5b21b6,#7c3aed);"><span class="sn">3</span>COMPLIANCE OVERVIEW</div><div class="sb">'
                + '<div class="stat-grid">'
                + '<div class="stat-box" style="background:#f0fdf4;border-color:#22c55e;"><div class="stat-val" style="color:#16a34a;">' + Math.round((d.stats.conformCount / (d.stats.totalItems || 1)) * 100) + '%</div><div class="stat-lbl">Compliance Score</div></div>'
                + '<div class="stat-box" style="background:#fef2f2;border-color:#ef4444;"><div class="stat-val" style="color:#dc2626;">' + d.stats.ncCount + '</div><div class="stat-lbl">Non-Conformities</div></div>'
                + '<div class="stat-box" style="background:#fffbeb;border-color:#f59e0b;"><div class="stat-val" style="color:#d97706;">' + d.stats.observationCount + '</div><div class="stat-lbl">Observations</div></div>'
                + '<div class="stat-box" style="background:#eff6ff;border-color:#2563eb;"><div class="stat-val" style="color:#2563eb;">' + d.stats.totalItems + '</div><div class="stat-lbl">Total Checks</div></div></div>'
                + '<div class="chart-grid"><div class="chart-box"><div class="chart-title">Compliance Breakdown</div><canvas id="chart-doughnut"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">NC by Clause Section</div><canvas id="chart-clause"></canvas></div>'
                + '<div class="chart-box"><div class="chart-title">Findings Distribution</div><canvas id="chart-findings"></canvas></div></div></div>' : '')
            // SECTION 4 - CONFORMANCE VERIFICATION
            + (en['conformance'] !== false && conformRowsHtml ? '<div id="sec-conformance" class="sh page-break" style="background:linear-gradient(135deg,#047857,#10b981);"><span class="sn">4</span>CONFORMANCE VERIFICATION</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr style="background:#f0fdf4;"><th style="width:10%;">Clause</th><th style="width:40%;">ISO Requirement</th><th style="width:10%;text-align:center;">Status</th><th style="width:40%;">Evidence & Remarks</th></tr></thead><tbody>' + conformRowsHtml + '</tbody></table></div>' : '')
            // SECTION 5 - NON-CONFORMITY DETAILS
            + (en['findings'] !== false ? '<div id="sec-findings" class="sh page-break" style="background:linear-gradient(135deg,#991b1b,#dc2626);"><span class="sn">5</span>NON-CONFORMITY DETAILS</div><div class="sb" style="padding:0;"><table class="f-tbl"><thead><tr><th style="width:10%;">Clause</th><th style="width:40%;">ISO Requirement</th><th style="width:10%;text-align:center;">Severity</th><th style="width:40%;">Evidence & Remarks</th></tr></thead><tbody>' + (ncRowsHtml || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#94a3b8;">No non-conformities found.</td></tr>') + '</tbody></table></div>' : '')
            // SECTION 5
            + (en['ncrs'] !== false && (d.report.ncrs || []).length > 0 ? '<div id="sec-ncrs" class="sh page-break" style="background:linear-gradient(135deg,#9a3412,#ea580c);"><span class="sn">5</span>NCR REGISTER</div><div class="sb">' + d.report.ncrs.map(ncr => '<div style="padding:14px 18px;border-left:4px solid ' + (ncr.type === 'Major' ? '#dc2626' : '#f59e0b') + ';background:' + (ncr.type === 'Major' ? '#fef2f2' : '#fffbeb') + ';border-radius:0 8px 8px 0;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:0.95rem;">' + ncr.type + ' — Clause ' + ncr.clause + '</strong><span style="color:#64748b;font-size:0.82rem;">' + (ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : '') + '</span></div><div style="color:#334155;font-size:0.9rem;margin-top:8px;line-height:1.7;">' + fmtRemark(ncr.description) + '</div>' + (ncr.evidenceImage ? '<div style="margin-top:8px;"><img src="' + ncr.evidenceImage + '" style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;"></div>' : '') + '</div>').join('') + '</div>' : '')
            // SECTION 6
            + (en['meetings'] !== false ? '<div id="sec-meetings" class="sh page-break" style="background:linear-gradient(135deg,#155e75,#0891b2);"><span class="sn">6</span>MEETING RECORDS</div><div class="sb"><div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">'
                + '<div style="padding:18px;background:#f0fdf4;border-radius:10px;"><strong style="color:#166534;font-size:0.95rem;"><i class="fa-solid fa-door-open" style="margin-right:6px;"></i>Opening Meeting</strong><table class="info-tbl" style="margin-top:10px;"><tr><td style="width:35%;">Date</td><td>' + (d.report.openingMeeting?.date || 'N/A') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.openingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || 'N/A'; return String(att); })() + '</td></tr>' + (editedOpeningNotes ? '<tr><td>Notes</td><td>' + editedOpeningNotes + '</td></tr>' : '') + '</table></div>'
                + '<div style="padding:18px;background:#eff6ff;border-radius:10px;"><strong style="color:#1e40af;font-size:0.95rem;"><i class="fa-solid fa-door-closed" style="margin-right:6px;"></i>Closing Meeting</strong><table class="info-tbl" style="margin-top:10px;"><tr><td style="width:35%;">Date</td><td>' + (d.report.closingMeeting?.date || 'N/A') + '</td></tr><tr><td>Attendees</td><td>' + (function () { var att = d.report.closingMeeting?.attendees; if (!att) return 'N/A'; if (Array.isArray(att)) return att.map(function (a) { return typeof a === 'object' ? (a.name || '') + (a.role ? ' (' + a.role + ')' : '') : a; }).filter(Boolean).join(', ') || 'N/A'; return String(att); })() + '</td></tr><tr><td>Summary</td><td>' + (editedClosingSummary || 'N/A') + '</td></tr></table></div>'
                + '</div></div>' : '')
            // EVIDENCE GALLERY
            + (function () {
                var evidenceItems = [];
                (d.hydratedProgress || []).forEach(function (item) {
                    var imgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                    imgs.forEach(function (img) {
                        evidenceItems.push({ clause: item.kbMatch ? item.kbMatch.clause : item.clause, title: item.kbMatch ? item.kbMatch.title : (item.requirement || ''), img: img, status: item.status });
                    });
                });
                (d.report.ncrs || []).forEach(function (ncr) {
                    if (ncr.evidenceImage) {
                        evidenceItems.push({ clause: ncr.clause, title: ncr.type + ' Non-Conformity', img: ncr.evidenceImage, status: 'nc' });
                    }
                });
                if (evidenceItems.length === 0) return '';
                var cards = evidenceItems.map(function (ev) {
                    var borderColor = ev.status === 'nc' ? '#ef4444' : ev.status === 'observation' ? '#3b82f6' : '#22c55e';
                    return '<div class="ev-card" style="border-top:3px solid ' + borderColor + ';"><img src="' + ev.img + '" alt="Evidence"><div class="ev-cap"><strong>Clause ' + ev.clause + '</strong><span>' + (ev.title || 'Audit Evidence') + '</span></div></div>';
                }).join('');
                return '<div id="sec-evidence" class="sh page-break" style="background:linear-gradient(135deg,#7c2d12,#c2410c);"><span class="sn"><i class="fa-solid fa-camera"></i></span>EVIDENCE GALLERY</div><div class="sb"><div class="ev-grid">' + cards + '</div><div style="margin-top:16px;font-size:0.82rem;color:#64748b;text-align:center;"><i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>' + evidenceItems.length + ' evidence photo(s) collected during audit</div></div>';
            })()
            // SECTION 7
            + (en['conclusion'] !== false ? '<div id="sec-conclusion" class="sh" style="background:linear-gradient(135deg,#312e81,#4338ca);"><span class="sn">7</span>AUDIT CONCLUSION & RECOMMENDATION</div><div class="sb">'
                + '<div style="margin-bottom:16px;"><strong style="color:#334155;">Certification Recommendation:</strong> <span style="margin-left:8px;padding:5px 18px;border-radius:20px;font-weight:700;font-size:0.88rem;' + (d.report.recommendation === 'Recommended' ? 'background:#dcfce7;color:#166534;' : d.report.recommendation === 'Not Recommended' ? 'background:#fee2e2;color:#991b1b;' : 'background:#fef3c7;color:#92400e;') + '">' + (d.report.recommendation || 'Pending') + '</span></div>'
                + '<div style="color:#334155;font-size:0.95rem;line-height:1.8;">' + formatText(editedConclusion) + '</div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;">'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Lead Auditor Signature</div><div style="font-size:0.88rem;color:#1e293b;font-weight:600;margin-top:4px;">' + (d.report.leadAuditor || '') + '</div></div>'
                + '<div style="text-align:center;"><div style="border-bottom:1px solid #94a3b8;padding-bottom:8px;margin-bottom:6px;">&nbsp;</div><div style="font-size:0.85rem;color:#64748b;">Client Representative</div></div></div></div>' : '')
            + '</div>'
            // FOOTER
            + '<footer><div>' + (cbName ? '<strong>' + cbName + '</strong>' : '') + (cbEmail ? '<br>' + cbEmail : '') + '</div>'
            + '<div style="text-align:center;font-size:0.75rem;color:#94a3b8;font-style:italic;max-width:340px;">This report has been prepared in accordance with ' + standard + ' requirements. Distribution is limited to authorized personnel only.</div>'
            + '<div style="text-align:right;">Doc Ref: ' + (d.auditPlan ? window.UTILS.getPlanRef(d.auditPlan) : d.report.id) + '<br>Issue Date: ' + d.today + '</div></footer>'
            // CHARTS SCRIPT
            + '<script>'
            + 'function rc(){'
            + 'var c1=document.getElementById("chart-doughnut");'
            + 'if(c1)new Chart(c1,{type:"doughnut",data:{labels:["Conformity","Minor NC","Major NC","Observations"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.minorNC + ',' + d.stats.majorNC + ',' + d.stats.observationCount + '],backgroundColor:["#22c55e","#f59e0b","#ef4444","#3b82f6"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'var c2=document.getElementById("chart-clause");'
            + 'if(c2)new Chart(c2,{type:"bar",data:{labels:' + JSON.stringify(clauseLabels.map(l => 'Clause ' + l)) + ',datasets:[{label:"NCs",data:' + JSON.stringify(clauseValues) + ',backgroundColor:"#2563eb",borderRadius:4}]},options:{responsive:true,indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});'
            + 'var c3=document.getElementById("chart-findings");'
            + 'if(c3)new Chart(c3,{type:"pie",data:{labels:["Conform","Non-Conformity","N/A"],datasets:[{data:[' + d.stats.conformCount + ',' + d.stats.ncCount + ',' + d.stats.naCount + '],backgroundColor:["#22c55e","#ef4444","#94a3b8"],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:"bottom",labels:{font:{size:11}}}}}});'
            + 'setTimeout(function(){document.querySelectorAll("canvas").forEach(function(cv){try{var im=document.createElement("img");im.src=cv.toDataURL("image/png");im.style.maxWidth="100%";im.style.height="auto";cv.parentNode.replaceChild(im,cv);}catch(e){}});},1200);'
            + '}rc();'
            + '<\/script></body></html>';

        printWindow.document.write(reportHtml);
        printWindow.document.close();
        setTimeout(function () { printWindow.print(); }, 1800);
        var overlay = document.getElementById('report-preview-overlay');
        if (overlay) overlay.remove();
    };

    window.openCreateReportModal = openCreateReportModal;
    window.openEditReportModal = openEditReportModal;

    // Persistent stream for remote audits
    window.activeAuditScreenStream = null;

    window.captureScreenEvidence = async function (uniqueId) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            window.showNotification('Screen capture is not supported in this environment (needs HTTPS).', 'error');
            return;
        }

        try {
            let stream = window.activeAuditScreenStream;
            let isNew = false;

            // Check active stream
            if (!stream || !stream.active) {
                window.showNotification('Select the Remote Audit Window (Zoom/Teams) once. It will stay active for easy capture.', 'info');
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" },
                    audio: false
                });
                window.activeAuditScreenStream = stream;
                isNew = true;

                // Handle stop sharing
                stream.getVideoTracks()[0].onended = () => {
                    window.activeAuditScreenStream = null;
                    window.showNotification('Screen sharing session ended.', 'info');
                };
            }

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();

            // Wait for buffer
            await new Promise(r => setTimeout(r, isNew ? 500 : 200));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // DO NOT stop tracks here. We reuse them.

            // Update UI
            const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
            const imgElem = document.getElementById('evidence-img-' + uniqueId);
            const dataInput = document.getElementById('evidence-data-' + uniqueId);
            const sizeElem = document.getElementById('evidence-size-' + uniqueId);

            if (imgElem) imgElem.src = dataUrl;
            if (previewDiv) previewDiv.style.display = 'block';
            if (dataInput) dataInput.value = 'attached';
            if (sizeElem) sizeElem.textContent = 'Screen Capture';

            window.showNotification('Captured!', 'success');

            // Cleanup element
            video.pause();
            video.srcObject = null;
            video.remove();

        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                console.error(err);
                window.showNotification('Capture failed: ' + err.message, 'error');
            }
        }
    };
    window.renderExecutionDetail = renderExecutionDetail;

    // Toggle selection of all items in a section
    // toggleSectionSelection defined earlier at line ~1586 (removed duplicate with broken selectors)

    // ============================================
    // Webcam Handling for Desktop 'Camera' Button
    // ============================================
    window.activeWebcamStream = null;

    window.handleCameraButton = function (uniqueId) {
        // Check if mobile device (simple check)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // Use the native input for mobile (file picker / camera app)
            const inp = document.getElementById('cam-' + uniqueId);
            if (inp) inp.click();
        } else {
            // Use Webcam Modal for desktop
            window.openWebcamModal(uniqueId);
        }
    };

    window.openWebcamModal = async function (uniqueId) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        // Cleanup any existing stream first
        if (window.activeWebcamStream) {
            window.activeWebcamStream.getTracks().forEach(track => track.stop());
            window.activeWebcamStream = null;
        }

        modalTitle.textContent = 'Capture from Webcam';

        modalBody.innerHTML = `
            < div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;" >
                <div style="position: relative; width: 100%; max-width: 640px; aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <video id="webcam-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                    <div id="webcam-loading" style="position: absolute; color: white;">Accessing Camera...</div>
                </div>
                <div id="webcam-error" style="color: var(--danger-color); display: none; text-align: center;"></div>
                <p style="color: var(--text-secondary); font-size: 0.85rem;">Ensure your browser has camera permissions enabled.</p>
            </div >
            `;

        // Configure "Capture" button
        modalSave.innerHTML = '<i class="fa-solid fa-camera"></i> Capture';
        modalSave.onclick = () => window.captureWebcam(uniqueId);

        // Show modal BEFORE requesting media
        if (window.openModal) window.openModal();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            window.activeWebcamStream = stream;

            const video = document.getElementById('webcam-video');
            const loading = document.getElementById('webcam-loading');

            if (video) {
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    if (loading) loading.style.display = 'none';
                };
            }
        } catch (err) {
            const errDiv = document.getElementById('webcam-error');
            const loading = document.getElementById('webcam-loading');
            if (loading) loading.style.display = 'none';

            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.textContent = 'Could not access webcam: ' + (err.message || err.name);
            }
            console.error("Webcam error:", err);
        }
    };

    window.captureWebcam = function (uniqueId) {
        const video = document.getElementById('webcam-video');
        if (!video || !window.activeWebcamStream) return;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            // Mirror the capture if the video was mirrored
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // Stop stream
            window.activeWebcamStream.getTracks().forEach(track => track.stop());
            window.activeWebcamStream = null;

            // Update UI
            const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
            const imgElem = document.getElementById('evidence-img-' + uniqueId);
            const dataInput = document.getElementById('evidence-data-' + uniqueId);
            const sizeElem = document.getElementById('evidence-size-' + uniqueId);

            if (imgElem) imgElem.src = dataUrl;
            if (previewDiv) previewDiv.style.display = 'block';
            if (dataInput) dataInput.value = 'attached';
            if (sizeElem) sizeElem.textContent = 'Captured from Webcam';

            // Close modal
            if (window.closeModal) window.closeModal();
        } catch (e) {
            console.error("Capture failed:", e);
            window.showNotification("Failed to capture image", "error");
        }
    };

    // Global event delegation for section checkboxes (works with dynamically rendered content)
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('section-checkbox')) {
            e.stopPropagation();
            const sectionId = e.target.getAttribute('data-section-id');
            const isChecked = e.target.checked;
            console.log('Global handler: Section checkbox clicked:', sectionId, 'checked:', isChecked);

            // Find all items in this section and toggle selection
            const section = document.getElementById(sectionId);
            if (!section) {
                console.error('Section not found:', sectionId);
                return;
            }

            const items = section.querySelectorAll('.checklist-item');
            console.log('Found', items.length, 'items in section');

            items.forEach((item, idx) => {
                // Toggle the individual checkbox too
                const itemCheckbox = item.querySelector('.item-checkbox');
                if (itemCheckbox) {
                    itemCheckbox.checked = isChecked;
                }

                if (isChecked) {
                    item.classList.add('selected-item');
                    item.style.background = '#eff6ff';
                    item.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    item.classList.remove('selected-item');
                    item.style.background = '';
                    item.style.borderLeft = '4px solid #e2e8f0';
                }
            });

            console.log('Selection complete for', items.length, 'items');
        }
    });

    // Global event delegation for individual item checkboxes
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('item-checkbox')) {
            const checkbox = e.target;
            const uniqueId = checkbox.getAttribute('data-unique-id');
            const row = document.getElementById('row-' + uniqueId);

            if (row) {
                if (checkbox.checked) {
                    row.classList.add('selected-item');
                    row.style.background = '#eff6ff';
                    row.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    row.classList.remove('selected-item');
                    row.style.background = '';
                    row.style.borderLeft = '4px solid #e2e8f0';
                }
            }
        }
    });

    // Global event delegation for bulk action buttons
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.bulk-action-btn');
        if (btn) {
            const action = btn.getAttribute('data-action');
            const reportId = btn.getAttribute('data-report-id');
            console.log('Bulk action button clicked:', action, 'for report:', reportId);

            if (action && reportId) {
                window.bulkUpdateStatus(parseInt(reportId), action);

                // Close menu
                const menu = document.getElementById('bulk-menu-' + reportId);
                if (menu) menu.classList.add('hidden');
            }
        }
    });

    // Global event delegation for status buttons (OK, NC, N/A) - using capture phase
    document.addEventListener('click', function (e) {
        // Check if clicked element or any parent has status-btn class
        let btn = e.target;

        // Log all clicks for debugging
        if (btn.classList && (btn.classList.contains('btn-nc') || btn.classList.contains('btn-ok') || btn.classList.contains('btn-na'))) {
            console.log('Button class detected:', btn.className, 'Has status-btn?', btn.classList.contains('status-btn'));
        }

        while (btn && btn.classList && !btn.classList.contains('status-btn')) {
            btn = btn.parentElement;
            if (!btn || btn === document.body) {
                btn = null;
                break;
            }
        }

        if (btn && btn.classList && btn.classList.contains('status-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const uniqueId = btn.getAttribute('data-unique-id');
            const status = btn.getAttribute('data-status');
            console.log('Status button clicked:', status, 'for item:', uniqueId);

            if (uniqueId && status) {
                window.setChecklistStatus(uniqueId, status);
            }
        }
    }, true); // true = capture phase

    // Helper to update meeting records (Opening/Closing)
    window.updateMeetingData = function (reportId, meetingType, field, value) {
        const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        if (!report[meetingType + 'Meeting']) {
            report[meetingType + 'Meeting'] = {};
        }

        if (field === 'attendees') {
            // Split by comma and clean up
            report[meetingType + 'Meeting'][field] = value.split(',').map(s => s.trim()).filter(s => s);
        } else {
            report[meetingType + 'Meeting'][field] = value;
        }

        window.saveData();
        window.saveChecklist(reportId);
    };

}

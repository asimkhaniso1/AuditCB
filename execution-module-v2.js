// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs
// ============================================

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
            const planRef = report.planId ? `PLN-${report.planId}` : '-';
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
        document.getElementById('plan-display').textContent = `PLN-${id}: ${plan.client}`;
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
                <td style="padding: 8px; font-weight: 600;">PLN-${p.id}</td>
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
                         
                         <!-- Hidden status input -->
                         <input type="hidden" class="status-input" data-checklist="${checklistId}" data-item="${idx}" data-custom="${isCustom}" id="status-${uniqueId}" value="${s}">
                         
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
                                 <div style="display: flex; flex-direction: column;">
                                     <label style="font-size: 0.8rem;">Evidence Image <span style="font-weight: normal; color: var(--text-secondary);">(max 5MB)</span></label>
                                    <div style="display: flex; gap: 5px;">
                                         <button type="button" class="btn btn-sm btn-outline-secondary" style="border-style: dashed; flex: 1;" onclick="document.getElementById('img-${uniqueId}').click()">
                                             <i class="fa-solid fa-file-image"></i> Upload
                                         </button>
                                         <button type="button" class="btn btn-sm btn-outline-secondary" style="flex: 1;" onclick="window.handleCameraButton('${uniqueId}')" title="Capture photo from mobile camera or webcam">
                                             <i class="fa-solid fa-camera"></i> Camera
                                         </button>
                                         <button type="button" class="btn btn-sm btn-outline-primary" style="flex: 1;" onclick="window.captureScreenEvidence('${uniqueId}')" title="Capture from Zoom/Teams Screen Share">
                                             <i class="fa-solid fa-desktop"></i> Screen
                                         </button>
                                     </div>
                                     <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" onchange="window.handleEvidenceUpload('${uniqueId}', this)">
                                     <input type="file" id="cam-${uniqueId}" accept="image/*" capture="environment" style="display: none;" onchange="window.handleEvidenceUpload('${uniqueId}', this)">
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
                             
                             <!-- Evidence Image Preview -->
                             <div id="evidence-preview-${uniqueId}" style="display: ${saved.evidenceImage ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                                 <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm);">
                                     <img id="evidence-img-${uniqueId}" src="${saved.evidenceImage || ''}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="event.stopPropagation(); window.viewEvidenceImage('${uniqueId}')" title="Click to enlarge">
                                     <div style="flex: 1;">
                                         <p style="margin: 0; font-size: 0.8rem; color: var(--success-color); font-weight: 500;"><i class="fa-solid fa-check-circle"></i> Image attached</p>
                                         <p id="evidence-size-${uniqueId}" style="margin: 0; font-size: 0.7rem; color: var(--text-secondary);">${saved.evidenceSize || ''}</p>
                                     </div>
                                     <button type="button" class="btn btn-sm" onclick="window.removeEvidence('${uniqueId}')" style="color: var(--danger-color);" title="Remove"><i class="fa-solid fa-trash"></i></button>
                                 </div>
                             </div>
                             <input type="hidden" id="evidence-data-${uniqueId}" value="${saved.evidenceImage ? 'attached' : ''}">
                             


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

            // Destructure for lookup
            const { assignedChecklists = [] } = contextData;

            // Collect checklist NCs
            (report.checklistProgress || []).filter(p => p.status === 'nc').forEach((item, idx) => {
                // Lookup Requirement
                let clauseText = '';
                let reqText = '';
                const cl = assignedChecklists.find(c => c.id == item.checklistId);
                if (cl) {
                    if (cl.clauses) {
                        const parts = String(item.itemIdx).split('-');
                        if (parts.length === 2) {
                            const main = cl.clauses.find(c => c.mainClause == parts[0]);
                            if (main && main.subClauses[parts[1]]) {
                                clauseText = main.subClauses[parts[1]].clause;
                                reqText = main.subClauses[parts[1]].requirement;
                            }
                        }
                    } else if (cl.items && cl.items[item.itemIdx]) {
                        clauseText = cl.items[item.itemIdx].clause;
                        reqText = cl.items[item.itemIdx].requirement;
                    }
                }

                allFindings.push({
                    id: `checklist-${idx}`,
                    source: 'Checklist',
                    type: item.ncrType || 'observation',
                    description: item.ncrDescription || 'Non-conformity identified',
                    remarks: item.comment || item.transcript || '',
                    designation: item.designation || '',
                    department: item.department || '',
                    hasEvidence: !!item.evidenceImage,
                    evidenceImage: item.evidenceImage,
                    clause: clauseText,
                    requirement: reqText
                });
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
                    <button class="btn btn-outline-primary" onclick="window.generateAuditReport('${report.id}')">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print
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
                            <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); border: none;" onclick="window.runFollowUpAIAnalysis('${report.id}')">
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify
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
                                                ${f.hasEvidence ? `<span onclick="window.viewEvidenceImage('${f.id.replace('checklist-', '').replace('ncr-', '')}')" style="cursor: pointer; color: var(--primary-color); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-image"></i> View Evidence</span>` : ''}
                                            </div>
                                            ${f.clause || f.requirement ? `
                                                <div style="font-size: 0.85rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.75rem;">
                                                    <strong style="color: var(--primary-color);">${f.clause ? `${f.clause}` : 'Requirement'}:</strong> 
                                                    <span style="color: #334155;">${f.requirement || ''}</span>
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
                                        <!-- Severity Column -->
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Severity Classification</label>
                                            <select class="form-control form-control-sm review-severity" data-finding-id="${f.id}" style="font-size: 0.9rem; padding: 0.4rem;">
                                                <option value="observation" ${f.type === 'observation' ? 'selected' : ''}>Observation</option>
                                                <option value="minor" ${f.type === 'minor' ? 'selected' : ''}>Minor NC</option>
                                                <option value="major" ${f.type === 'major' ? 'selected' : ''}>Major NC</option>
                                            </select>
                                        </div>
                                        <!-- Remarks Column -->
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Auditor Remarks / Notes</label>
                                            <textarea class="form-control form-control-sm review-remarks" data-finding-id="${f.id}" placeholder="Justification or internal notes..." rows="3" style="font-size: 0.85rem;">${f.remarks || ''}</textarea>
                                        </div>
                                    </div>
                                </div>
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
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <!-- Opening Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #16a34a;">
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
                    </div>
                    
                    <!-- Closing Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #dc2626;">
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

                // Get evidence image data
                const evidenceImg = document.getElementById('evidence-img-' + uniqueId);
                const evidenceData = document.getElementById('evidence-data-' + uniqueId)?.value || '';
                const evidenceImage = (evidenceData === 'attached' && evidenceImg?.src && !evidenceImg.src.includes('data:,')) ? evidenceImg.src : '';
                const evidenceSize = document.getElementById('evidence-size-' + uniqueId)?.textContent || '';

                // Get designation and department
                const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-' + uniqueId)?.value || '');
                const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-' + uniqueId)?.value || '');

                // Extract clause and requirement text from the DOM for report display
                const itemContainer = input.closest('.checklist-item-card') || input.closest('.checklist-item');
                let clauseText = '';
                let requirementText = '';

                if (itemContainer) {
                    // Try to find the clause/section title (usually in a heading or strong tag above the input)
                    const sectionHeader = itemContainer.querySelector('.section-title, .clause-title, strong, h5, h6');
                    if (sectionHeader) {
                        clauseText = sectionHeader.textContent?.trim() || '';
                    }

                    // Try to find the requirement text (usually the question text)
                    const questionText = itemContainer.querySelector('.item-text, .question-text, p, label');
                    if (questionText) {
                        requirementText = questionText.textContent?.trim() || '';
                    }
                }

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
                    if (report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        report.checklistProgress[idx].comment = remarks;
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
        recognition.continuous = false;
        recognition.interimResults = true; // Use interim to show real-time transcription if possible, or false for simplicity

        // Visual feedback
        const originalIcon = '<i class="fa-solid fa-microphone"></i>';
        micBtn.innerHTML = '<i class="fa-solid fa-circle-dot fa-fade" style="color: red;"></i>';
        micBtn.setAttribute('disabled', 'true');

        recognition.start();

        let finalTranscript = '';

        // Auto-stop after 10 seconds
        const timeout = setTimeout(() => {
            recognition.stop();
            window.showNotification('Recording limit (10s) reached.', 'info');
        }, 10000);

        recognition.onresult = function (event) {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
        };

        recognition.onend = function () {
            clearTimeout(timeout);
            // Append result to textarea
            if (finalTranscript) {
                const currentVal = textarea.value;
                textarea.value = currentVal ? currentVal + ' ' + finalTranscript : finalTranscript;
            }

            micBtn.innerHTML = originalIcon;
            micBtn.removeAttribute('disabled');
        };

        recognition.onerror = function (event) {
            window.Logger.error('Execution', 'Speech recognition error', event.error);
            if (event.error !== 'no-speech') {
                window.showNotification('Error recording audio: ' + event.error, 'error');
            }
            micBtn.innerHTML = originalIcon;
            micBtn.removeAttribute('disabled');
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
            notes: document.getElementById('opening-notes')?.value || ''
        };

        report.closingMeeting = {
            date: document.getElementById('closing-date')?.value || '',
            time: document.getElementById('closing-time')?.value || '',
            attendees: window._collectMeetingAttendees('closing'),
            summary: document.getElementById('closing-summary')?.value || '',
            response: document.getElementById('closing-response')?.value || ''
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

                    // 2. Upload to Supabase (if online)
                    if (window.navigator.onLine && window.SupabaseClient) {
                        try {
                            // Check if Supabase is initialized
                            if (!window.SupabaseClient.isInitialized) {
                                console.warn('Supabase not initialized - image saved locally only');
                            } else {
                                // Convert DataURL to Blob
                                const res = await fetch(compressedDataUrl);
                                const blob = await res.blob();
                                const uploadFile = new File([blob], file.name, { type: file.type });

                                const result = await window.SupabaseClient.storage.uploadAuditImage(uploadFile, 'ncr-evidence', uniqueId);
                                if (result && result.url) {
                                    finalUrl = result.url;
                                    isCloud = true;
                                    console.log('Image uploaded to cloud:', result.path);
                                } else {
                                    console.warn('Upload returned no URL - check if audit-images bucket exists');
                                }
                            }
                        } catch (uploadErr) {
                            console.error('Image upload failed:', uploadErr);
                            console.warn('Falling back to local base64 storage');
                        }
                    }

                    // 3. Update Preview UI
                    if (previewDiv) {
                        previewDiv.style.display = 'block';
                        previewDiv.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm);">
                            <img id="evidence-img-${uniqueId}" src="${finalUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.viewEvidenceImage('${uniqueId}')" title="Click to enlarge">
                            <div style="flex: 1;">
                                <p style="margin: 0; font-size: 0.8rem; color: var(--success-color); font-weight: 500;">
                                    <i class="fa-solid fa-check-circle"></i> ${isCloud ? 'Saved to Cloud' : 'Attached Locally'}
                                </p>
                                <p id="evidence-size-${uniqueId}" style="margin: 0; font-size: 0.7rem; color: var(--text-secondary);">
                                    ${compressedSize} KB ${isCloud ? '(Synced)' : '(Pending Sync)'}
                                </p>
                            </div>
                            <button type="button" class="btn btn-sm" onclick="window.removeEvidence('${uniqueId}')" style="color: var(--danger-color);" title="Remove"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
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

        // Calculate new dimensions (max 800px on longest side)
        const maxDimension = 800;
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

        // Convert to JPEG with 0.7 quality for compression
        return canvas.toDataURL('image/jpeg', 0.7);
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

    // Remove evidence image
    window.removeEvidence = function (uniqueId) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        const evidenceData = document.getElementById('evidence-data-' + uniqueId);
        const fileInput = document.getElementById('img-' + uniqueId);

        if (previewDiv) previewDiv.style.display = 'none';
        if (evidenceData) evidenceData.value = '';
        if (fileInput) fileInput.value = '';

        window.showNotification('Evidence image removed', 'info');
    };
    // Generate Printable Report - Enhanced Version
    // Generate Printable Report - Enhanced Version
    window.generateAuditReport = function (reportId) {
        const report = window.state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) {
            window.showNotification('Report not found', 'error');
            return;
        }

        // 1. Hydrate Checklist Data (Clause & Requirements) - ENHANCED
        const hydratedProgress = (report.checklistProgress || []).map(item => {
            let clause = item.clause;
            let requirement = item.requirement;
            let text = item.text;

            // Try to lookup from source checklist if text is missing
            if ((!requirement || !clause) && item.checklistId) {
                const checklist = window.state.checklists.find(c => String(c.id) === String(item.checklistId));
                if (checklist) {
                    // Support both data structures: sections[] and clauses[]
                    const sections = checklist.sections || [];
                    const clauseGroups = checklist.clauses || [];

                    if (sections.length > 0) {
                        // Old structure: sections with items
                        let cumulativeIdx = 0;
                        let found = false;
                        for (const section of sections) {
                            if (found) break;
                            for (const q of (section.items || [])) {
                                if (String(cumulativeIdx) === String(item.itemIdx)) {
                                    clause = section.clauseNumber
                                        ? `${section.clauseNumber} ${section.title || ''}`.trim()
                                        : (section.title || section.clause || `Section ${section.id || ''}`);
                                    requirement = q.text || q.requirement || q.description || '';
                                    found = true;
                                    break;
                                }
                                cumulativeIdx++;
                            }
                        }
                    } else if (clauseGroups.length > 0) {
                        // New structure: clauses with subClauses
                        let cumulativeIdx = 0;
                        let found = false;
                        for (const group of clauseGroups) {
                            if (found) break;
                            for (const sub of (group.subClauses || [])) {
                                if (String(cumulativeIdx) === String(item.itemIdx)) {
                                    clause = sub.clause || `${group.mainClause} ${group.title || ''}`.trim();
                                    requirement = sub.requirement || sub.text || '';
                                    found = true;
                                    break;
                                }
                                cumulativeIdx++;
                            }
                        }
                    }
                }
            }

            // Fallback: Try KB clause lookup if still missing
            if ((!requirement || requirement === 'Requirement details not available') && clause && report.standard) {
                const kb = window.state.knowledgeBase;
                if (kb?.standards?.length > 0) {
                    const stdDoc = kb.standards.find(s =>
                        s.status === 'ready' && s.clauses?.length > 0 &&
                        s.name.toLowerCase().includes(report.standard.toLowerCase().replace('iso ', ''))
                    );
                    if (stdDoc) {
                        // Try to match clause number
                        const clauseNum = clause.split(' ')[0]; // e.g. "5.1" from "5.1 Leadership"
                        const kbClause = stdDoc.clauses.find(c => c.clause === clauseNum);
                        if (kbClause) {
                            requirement = kbClause.requirement || requirement;
                            if (!clause || clause === 'General Requirement') {
                                clause = `${kbClause.clause} ${kbClause.title}`;
                            }
                        }
                    }
                }
            }

            return {
                ...item,
                clause: clause || item.clause || item.sectionName || 'General Requirement',
                requirement: requirement || item.text || item.requirement || item.description || 'Requirement details not available',
                comment: item.comment || ''
            };
        });

        // Attempt to get client details for address/logo if available
        const client = window.state.clients.find(c => c.name === report.client) || {};
        const clientLogo = client.logoUrl || 'https://via.placeholder.com/150?text=Client+Logo';

        // Get audit plan reference
        const auditPlan = report.planId ? window.state.auditPlans.find(p => String(p.id) === String(report.planId)) : null;

        // QR Code for Report Verification (using report ID)
        // QR Code for Report Verification (using report ID)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://auditcb.com/verify/' + report.id)}`;

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            window.showNotification('Pop-up blocked. Please allow pop-ups to print.', 'warning');
            return;
        }

        const today = new Date().toLocaleDateString();

        // Helper function to format text (markdown + newlines)
        const formatText = (text) => {
            if (!text) return '';
            return text
                .replace(/\\n/g, '<br>')  // Handle escaped newlines
                .replace(/\n/g, '<br>')   // Handle actual newlines
                .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong>$1</strong>')  // ***bold***
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')      // **bold**
                .replace(/\(Clause ([^)]+)\)/g, '<em style="font-size: 0.9em; color: #059669;">(Clause $1)</em>');
        };

        // Calculate stats from Hydrated Data
        const totalItems = hydratedProgress.length;
        const ncItems = hydratedProgress.filter(i => i.status === 'nc');
        const conformityItems = hydratedProgress.filter(i => i.status === 'conform');
        const majorNC = ncItems.filter(i => i.ncrType === 'Major').length;
        const minorNC = ncItems.filter(i => i.ncrType === 'Minor').length;
        const observationCount = hydratedProgress.filter(i => i.status === 'nc' && i.ncrType === 'Observation').length;

        const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Audit Findings Report - ${report.client}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
                
                :root {
                    --primary: #2563eb;
                    --secondary: #475569;
                    --danger: #ef4444;
                    --success: #22c55e;
                    --warning: #f59e0b;
                    --bg-gray: #f8fafc;
                }

                body { 
                    font-family: 'Outfit', sans-serif; 
                    line-height: 1.5; 
                    color: #1e293b; 
                    max-width: 1100px; 
                    margin: 0 auto; 
                    padding: 0;
                    background: white;
                }

                /* Print optimizations */
                @media print {
                    body { -webkit-print-color-adjust: exact; padding: 0; }
                    .page-break { page-break-before: always; }
                    .no-print { display: none; }
                    .card, .content-box, tr { break-inside: avoid; }
                }

                /* Header */
                header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 40px 50px;
                    border-bottom: 4px solid var(--primary);
                    margin-bottom: 40px;
                }
                .logo-section img { height: 60px; object-fit: contain; }
                .report-title h1 { font-size: 2.5rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1; }
                .report-title p { color: var(--secondary); font-size: 1.1rem; margin: 5px 0 0 0; }

                /* Premium Grid Layout */
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 30px;
                    padding: 0 50px;
                    margin-bottom: 40px;
                }

                .card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 25px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .card-title { font-size: 1.1rem; font-weight: 700; color: #334155; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }

                /* Stats Row */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    padding: 0 50px;
                    margin-bottom: 40px;
                }
                .stat-card {
                    background: var(--bg-gray);
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    border-bottom: 3px solid transparent;
                }
                .stat-value { font-size: 2.5rem; font-weight: 800; line-height: 1; margin-bottom: 5px; }
                .stat-label { font-size: 0.85rem; color: #64748b; font-weight: 600; text-transform: uppercase; }

                /* Tables */
                .table-container { padding: 0 50px; margin-bottom: 40px; }
                table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; }
                td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                tbody tr:nth-child(even) { background: #f8fafc; }
                tbody tr:hover { background: #f1f5f9; }
                tr:last-child td { border-bottom: none; }

                .badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-conform { background: #dcfce7; color: #166534; }
                .status-nc { background: #fee2e2; color: #991b1b; }
                .status-na { background: #f1f5f9; color: #475569; }

                /* Footer */
                footer {
                    margin-top: 50px;
                    background: #1e293b;
                    color: white;
                    padding: 40px 50px;
                    font-size: 0.9rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <button onclick="window.print()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                    <i class="fa fa-print"></i> Download PDF
                </button>
                <button onclick="window.close()" style="background: var(--secondary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-left: 10px;">
                    Close
                </button>
            </div>

            <!-- Header -->
            <header>
                <div class="report-title">
                    <h1>AUDIT REPORT</h1>
                    <p>${report.client}</p>
                    <div style="font-size: 0.9rem; color: #64748b; margin-top: 10px;">
                        Report ID: #${report.id.substring(0, 8)} | Date: ${report.date}
                    </div>
                </div>
                <div class="logo-section">
                    <img src="${clientLogo}" alt="Client Logo" onerror="this.src='https://via.placeholder.com/150?text=Client+Logo'">
                    <img src="${qrCodeUrl}" alt="QR" style="height: 80px; margin-left: 20px;">
                </div>
            </header>

            <!-- Stats -->
            <div class="stats-row">
                <div class="stat-card" style="border-color: var(--primary);">
                    <div class="stat-value" style="color: var(--primary);">${Math.round((conformityItems.length / (totalItems || 1)) * 100)}%</div>
                    <div class="stat-label">Compliance Score</div>
                </div>
                <div class="stat-card" style="border-color: var(--danger);">
                    <div class="stat-value" style="color: var(--danger);">${ncItems.length}</div>
                    <div class="stat-label">Non-Conformities</div>
                </div>
                <div class="stat-card" style="border-color: var(--warning);">
                    <div class="stat-value" style="color: var(--warning);">${observationCount}</div>
                    <div class="stat-label">Observations</div>
                </div>
                <div class="stat-card" style="border-color: var(--success);">
                    <div class="stat-value" style="color: var(--success);">${totalItems}</div>
                    <div class="stat-label">Total Checks</div>
                </div>
            </div>

            <!-- Table of Contents -->
            <div class="table-container">
                <div class="card">
                    <div class="card-title">Table of Contents</div>
                    <ul style="list-style: none; padding: 0; margin: 0; columns: 2;">
                        <li style="margin-bottom: 10px;"><a href="#section-org-context" style="text-decoration: none; color: var(--primary); font-weight: 500;">1. Organization Context</a></li>
                        <li style="margin-bottom: 10px;"><a href="#section-overview" style="text-decoration: none; color: var(--primary); font-weight: 500;">2. Audit Details & Location</a></li>
                        <li style="margin-bottom: 10px;"><a href="#section-exec-summary" style="text-decoration: none; color: var(---primary); font-weight: 500;">3. Executive Summary</a></li>
                        <li style="margin-bottom: 10px;"><a href="#section-findings" style="text-decoration: none; color: var(--primary); font-weight: 500;">4. Non-Conformities Found</a></li>
                        <li style="margin-bottom: 10px;"><a href="#section-ncrs" style="text-decoration: none; color: var(--primary); font-weight: 500;">5. NCR Details</a></li>
                        <li style="margin-bottom: 10px;"><a href="#section-meetings" style="text-decoration: none; color: var(--primary); font-weight: 500;">6. Meeting Records</a></li>
                    </ul>
                </div>
            </div>

            <!-- Charts & Exec Summary -->
            <div id="section-exec-summary" class="dashboard-grid">
                <div class="card">
                    <div class="card-title">Executive Summary</div>
                    <div style="color: var(--secondary); font-size: 1rem; line-height: 1.7;">
                        ${formatText(report.executiveSummary) || '<em>No executive summary recorded.</em>'}
                    </div>
                    
                    ${report.positiveObservations ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid var(--success);">
                        <strong style="color: #166534; display: block; margin-bottom: 5px;">Positive Observations</strong>
                        <div style="color: #15803d; line-height: 1.8;">${formatText(report.positiveObservations)}</div>
                    </div>` : ''}

                    ${report.ofi ? `
                    <div style="margin-top: 20px; padding: 15px; background: #fefce8; border-radius: 8px; border-left: 4px solid var(--warning);">
                        <strong style="color: #854d0e; display: block; margin-bottom: 5px;">Opportunities for Improvement</strong>
                        <div style="color: #a16207; line-height: 1.8;">${formatText(report.ofi)}</div>
                    </div>` : ''}
                </div>
                <div class="card" style="text-align: center;">
                    <div class="card-title">Compliance Breakdown</div>
                    <canvas id="complianceChart"></canvas>
                </div>
            </div>



            <!-- 1. Organization Context -->
            <div id="section-org-context" class="page-break table-container">
                <div class="card-title" style="margin-top: 0; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">1. Organization Context</div>
                <div class="card" style="margin-top: 20px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 30%;"><strong>Client Name:</strong></td>
                            <td>${report.client}</td>
                        </tr>
                        <tr>
                            <td><strong>Industry:</strong></td>
                            <td>${client.industry || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Certification Scope:</strong></td>
                            <td>${client.certificationScope || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Number of Employees:</strong></td>
                            <td>${client.numberOfEmployees || 'N/A'}</td>
                        </tr>
                    </table>
                    
                    ${client.goodsServices && client.goodsServices.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <strong style="display: block; margin-bottom: 10px; color: #334155;">Goods & Services:</strong>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${client.goodsServices.map(g => `<span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde047;">${g.name} ${g.category ? `(${g.category})` : ''}</span>`).join('')}
                        </div>
                    </div>` : ''}
                    
                    ${client.keyProcesses && client.keyProcesses.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <strong style="display: block; margin-bottom: 10px; color: #334155;">Key Processes:</strong>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${client.keyProcesses.map(p => `<span class="badge" style="background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;">${p.name || p}</span>`).join('')}
                        </div>
                    </div>` : ''}
                    
                    ${client.sites && client.sites.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <strong style="display: block; margin-bottom: 10px; color: #334155;">Sites/Locations:</strong>
                        <ul style="margin: 0; padding-left: 20px;">
                            ${client.sites.map(site => `<li>${site.name || site.address} - ${site.city || ''}, ${site.country || ''}</li>`).join('')}
                        </ul>
                    </div>` : ''}
                </div>
            </div>

            <!-- 2. Audit Details & Geolocation -->
            <div id="section-overview" class="page-break table-container">
                <div class="card-title" style="margin-top: 0; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">2. Audit Details & Location</div>
                <div class="card" style="margin-top: 20px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 30%;"><strong>Client Address:</strong></td>
                            <td>${client.address || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td><strong>Audit Location:</strong></td>
                            <td>${client.city || 'N/A'}, ${client.province || ''} ${client.country || ''}</td>
                        </tr>
                        <tr>
                            <td><strong>Geo-Coordinates:</strong></td>
                            <td>${client.latitude ? `<a href="https://www.openstreetmap.org/?mlat=${client.latitude}&mlon=${client.longitude}#map=15/${client.latitude}/${client.longitude}" target="_blank" style="color: var(--primary); text-decoration: none;">${client.latitude}, ${client.longitude} <i class="fa-solid fa-external-link" style="font-size: 0.75rem;"></i></a>` : 'Not Recorded (On-site verified)'}</td>
                        </tr>
                        <tr>
                            <td><strong>Audit Plan Reference:</strong></td>
                            <td>${auditPlan ? `#${auditPlan.id.substring(0, 8)} - ${auditPlan.auditType || 'N/A'}` : 'Not Linked'}</td>
                        </tr>
                        <tr>
                            <td><strong>Audit Standard:</strong></td>
                            <td>${report.standard || auditPlan?.standard || 'ISO 9001:2015'}</td>
                        </tr>
                        <tr>
                            <td><strong>Audit Dates:</strong></td>
                            <td>${report.date || 'N/A'} ${report.endDate ? `to ${report.endDate}` : ''}</td>
                        </tr>
                        <tr>
                            <td><strong>Lead Auditor:</strong></td>
                            <td>${report.leadAuditor || 'Assigned Auditor'}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- 3. Detailed Findings -->
            <div id="section-findings" class="page-break table-container">
                <div class="card-title" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">3. Non-Conformities Found</div>
                <table style="margin-top: 20px;">
                    <thead>
                        <tr>
                            <th style="width: 15%">Clause</th>
                            <th style="width: 35%">Requirement</th>
                            <th style="width: 15%">Status</th>
                            <th style="width: 35%">Evidence & Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hydratedProgress.filter(item => item.status === 'nc').map((item, idx) => `
                        <tr>
                            <td><strong>${item.clause}</strong></td>
                            <td style="color: #475569;">${item.requirement}</td>
                            <td>
                                <span class="badge ${item.status === 'conform' ? 'status-conform' : (item.status === 'nc' ? 'status-nc' : 'status-na')}">
                                    ${item.status === 'nc' ? (item.ncrType || 'NC') : (item.status === 'conform' ? 'Conform' : 'N/A')}
                                </span>
                            </td>
                            <td>
                                ${item.comment ? `<div><strong>Auditor Remarks:</strong> ${item.comment}</div>` : '<div style="color: #94a3b8;">No remarks recorded</div>'}
                                ${item.evidenceImage ? `
                                <div style="margin-top: 10px;">
                                    <a href="${item.evidenceImage}" target="_blank">
                                        <img src="${item.evidenceImage}" style="height: 60px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                    </a>
                                </div>` : ''}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!--3. NCRs-- >
    ${report.ncrs && report.ncrs.length > 0 ? `
            <div id="section-ncrs" class="page-break table-container">
                <div class="card-title" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">4. NCR Details</div>
                ${report.ncrs.map(ncr => `
                <div class="card" style="margin-top: 20px; border-left: 5px solid ${ncr.type === 'Major' ? 'var(--danger)' : 'var(--warning)'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>${ncr.type} - Clause ${ncr.clause}</strong>
                        <span style="color: #64748b;">${new Date(ncr.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p>${ncr.description}</p>
                    ${ncr.evidenceImage ? `<img src="${ncr.evidenceImage}" style="max-height: 150px; border-radius: 6px; margin-top: 10px;">` : ''}
                </div>
                `).join('')}
            </div>` : ''
            }

    < !--4. Meetings-- >
            <div id="section-meetings" class="page-break table-container">
                 <div class="card-title" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">5. Meeting Records</div>
                 <div class="dashboard-grid" style="padding: 0; margin-top: 20px;">
                    <div class="card">
                        <strong>Opening Meeting</strong>
                        <p>Date: ${report.openingMeeting?.date || '-'}</p>
                        <p>Attendees: ${report.openingMeeting?.attendees || '-'}</p>
                    </div>
                    <div class="card">
                        <strong>Closing Meeting</strong>
                        <p>Date: ${report.closingMeeting?.date || '-'}</p>
                        <p>Summary: ${report.closingMeeting?.summary || '-'}</p>
                    </div>
                 </div>
            </div>

            <footer class="page-break">
                <div>
                    <strong>AuditCB Certification Body</strong><br>
                    123 Audit Street, Quality City
                </div>
                <div style="text-align: right;">
                    Generated on ${today}<br>
                    ID: ${report.id}
                </div>
            </footer>

            <script>
                // Render Chart and convert to static image for PDF
                const ctx = document.getElementById('complianceChart');
                if (ctx) {
                    const chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Conformity', 'Minor NC', 'Major NC', 'Observations'],
                            datasets: [{
                                data: [${conformityItems.length}, ${minorNC}, ${majorNC}, ${observationCount}],
                                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            animation: {
                                onComplete: function() {
                                    // Convert canvas to static image for PDF
                                    const canvas = document.getElementById('complianceChart');
                                    const imgData = canvas.toDataURL('image/png');
                                    const img = document.createElement('img');
                                    img.src = imgData;
                                    img.style.maxWidth = '100%';
                                    img.style.height = 'auto';
                                    
                                    // Replace canvas with image
                                    canvas.parentNode.replaceChild(img, canvas);
                                }
                            },
                            plugins: {
                                legend: { position: 'bottom' }
                            }
                        }
                    });
                }
            </script>
        </body >
        </html >
    `;

        printWindow.document.write(reportHtml);
        printWindow.document.close();

        // Auto-print after delay to allow styles to load
        setTimeout(() => {
            printWindow.print();
        }, 1000);
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
    < div style = "display: flex; flex-direction: column; align-items: center; gap: 1rem;" >
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

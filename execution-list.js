// ============================================
// EXECUTION MODULE - List View & Report CRUD (ESM-ready)
// Extracted from execution-module-v2.js for maintainability
// Contains: handleBackToExecutionList, renderAuditExecutionEnhanced,
//   openCreateReportModal, openEditReportModal, deleteAuditReport,
//   _reconstructChecklistFromProgress, _getClauseTitle, renderExecutionDetail
// ============================================

// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs
// ============================================

// ---------- KB Helpers loaded from ai-service.js (window.KB_HELPERS) ----------
// normalizeStdName, extractClauseNum, lookupKBRequirement, resolveChecklistClause,
// resolveStandardName are all available via window.KB_HELPERS.*

// EARLY EXPORTS: Set immediately using function hoisting (functions defined below are hoisted)
try {
    window.renderExecutionDetail = renderExecutionDetail;
    window.deleteAuditReport = deleteAuditReport;
    window.openEditReportModal = openEditReportModal;
} catch(e) { console.warn('[execution-list] Early export failed:', e.message); }


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
                           data-hash="client/${clientId}/plans" data-stop-prop="true" 
                           title="View linked audit plan">
                        <i class="fa-solid fa-link" style="margin-right: 0.25rem;"></i>${planRef}
                    </span>` :
                    `<span style="color: var(--text-secondary); font-size: 0.85rem;">No Plan</span>`
                }
            </td>
            <td>${report.client}</td>
            <td>${window.UTILS.formatDate(report.date)}</td>
            <td><span style="background: ${report.findings > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.findings}</span></td>
            <td><span style="background: ${report.status === window.CONSTANTS.STATUS.FINALIZED ? 'var(--success-color)' :
                    report.status === 'Approved' ? '#7c3aed' :
                        report.status === 'In Review' ? 'var(--warning-color)' :
                            '#64748b'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.status}</span></td>
            <td>
                <button class="btn btn-sm view-execution" data-report-id="${report.id}" style="color: var(--primary-color); margin-right: 0.5rem;" title="View Report" aria-label="View"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-sm edit-execution" data-report-id="${report.id}" style="color: #f59e0b; margin-right: 0.5rem;" title="Edit Report" aria-label="Edit"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm delete-execution" data-report-id="${report.id}" style="color: var(--danger-color);" title="Delete Report" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `;
        }).join('');

        const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0;">Audit Execution & Reports</h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" data-action="toggleExecutionAnalytics" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showExecutionAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showExecutionAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    <button class="btn btn-primary" data-action="openCreateReportModal">
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

// eslint-disable-next-line no-unused-vars
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
        const plan = state.auditPlans.find(p => p.id === id);
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
                        data-action="selectAuditPlan" data-id="${p.id}">
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
            <select class="form-control" id="start-audit-client-filter" data-action-change="filterAuditPlansStart" data-id="this.value" style="margin-bottom: 1rem; border-color: var(--primary-color);" ${activeClient ? 'disabled' : ''}>
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

// Export functions — also set at top of file via hoisting for resilience
window.renderExecutionDetail = renderExecutionDetail;
window.deleteAuditReport = deleteAuditReport;
window.openEditReportModal = openEditReportModal;

/**
 * Reconstruct a checklist template from saved checklistProgress data.
 * Used when the original checklist template is lost from both local and cloud storage.
 */
function _reconstructChecklistFromProgress(report, planChecklistIds, plan) {
    const progress = report.checklistProgress || [];
    if (progress.length === 0) {
        console.warn('[Execution] No checklistProgress data to reconstruct from.');
        return;
    }

    // Group progress items by checklistId
    const groupedById = {};
    progress.forEach(item => {
        if (item.isCustom) return; // Skip custom items
        const clId = String(item.checklistId);
        if (!groupedById[clId]) groupedById[clId] = [];
        groupedById[clId].push(item);
    });

    const reconstructed = [];
    Object.entries(groupedById).forEach(([clId, items]) => {
        // Build hierarchical clause structure from progress items
        const clauseGroups = {};
        items.forEach(item => {
            const clauseText = item.clause || '';
            const mainClauseNum = clauseText.split('.')[0] || 'General';

            if (!clauseGroups[mainClauseNum]) {
                clauseGroups[mainClauseNum] = {
                    mainClause: mainClauseNum,
                    title: _getClauseTitle(mainClauseNum),
                    subClauses: []
                };
            }
            clauseGroups[mainClauseNum].subClauses.push({
                clause: clauseText,
                requirement: item.requirement || ''
            });
        });

        const clauses = Object.values(clauseGroups).sort((a, b) => {
            const na = parseFloat(a.mainClause) || 0;
            const nb = parseFloat(b.mainClause) || 0;
            return na - nb;
        });

        const checklist = {
            id: clId,
            name: `${plan?.standard || 'Audit'} Checklist (Recovered)`,
            standard: plan?.standard || 'Unknown',
            type: 'global',
            clauses: clauses,
            createdBy: 'System Recovery',
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            _recovered: true
        };

        reconstructed.push(checklist);
    });

    if (reconstructed.length > 0) {
        if (!state.checklists) state.checklists = [];
        reconstructed.forEach(cl => {
            // Don't duplicate if somehow already there
            if (!state.checklists.some(c => String(c.id) === String(cl.id))) {
                state.checklists.push(cl);
            }
        });
        window.saveData();

        // Also push recovered checklists to Supabase for persistence
        if (window.SupabaseClient?.isInitialized) {
            window.SupabaseClient.syncChecklistsToSupabase(reconstructed)
                .then(() => console.info('[Execution] Recovered checklists synced to Supabase.'))
                .catch(err => console.warn('[Execution] Failed to sync recovered checklists:', err));
        }

        const totalItems = reconstructed.reduce((sum, cl) =>
            sum + cl.clauses.reduce((s, c) => s + c.subClauses.length, 0), 0);
        console.info(`[Execution] Reconstructed ${reconstructed.length} checklist(s) with ${totalItems} items from progress data.`);
        window.showNotification?.(`Recovered ${reconstructed.length} checklist(s) from audit data`, 'success');

        // Re-render with recovered checklists
        const reportId = report.id;
        setTimeout(() => renderExecutionDetail(reportId), 100);
    }
}

function _getClauseTitle(clauseNum) {
    const titles = {
        '4': 'Context of the Organization', '5': 'Leadership', '6': 'Planning',
        '7': 'Support', '8': 'Operation', '9': 'Performance Evaluation',
        '10': 'Improvement', 'A': 'Annex A Controls', 'General': 'General Requirements'
    };
    return titles[clauseNum] || `Clause ${clauseNum}`;
}

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
                const a = (state.auditors || []).find(x => x.id === id);
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

    // Recovery: if plan has checklists but local state is missing them
    if (assignedChecklists.length === 0 && planChecklists.length > 0) {
        console.warn('[Execution] Missing checklists — plan IDs:', planChecklists, '| state has:', checklists.length);

        // STRATEGY 1: Try Supabase recovery
        if (window.SupabaseClient?.isInitialized && !window._checklistRecoveryAttempted) {
            window._checklistRecoveryAttempted = true;
            console.info('[Execution] Attempting checklist recovery from Supabase...');
            window.SupabaseClient.syncChecklistsFromSupabase().then(_result => {
                window._checklistRecoveryAttempted = false;
                const recovered = (state.checklists || []).filter(c => planChecklists.includes(String(c.id)));
                if (recovered.length > 0) {
                    console.info('[Execution] Recovered', recovered.length, 'checklist(s) from Supabase.');
                    renderExecutionDetail(reportId);
                } else {
                    // STRATEGY 2: Reconstruct from checklistProgress
                    _reconstructChecklistFromProgress(report, planChecklists, plan);
                }
            }).catch(() => {
                window._checklistRecoveryAttempted = false;
                _reconstructChecklistFromProgress(report, planChecklists, plan);
            });
        } else if (!window._checklistRecoveryAttempted) {
            // No Supabase — try direct reconstruction
            _reconstructChecklistFromProgress(report, planChecklists, plan);
        }
    }
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
                const _itemId = String(idx); // Standardize to string for comparison usually, but ID in UI was idx
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

    // Sub-classify NC items: OBS/OFI vs actual NCs (Minor/Major)
    const obsOfiCount = allItems.filter(item => {
        const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
        const p = progressMap[key];
        if (p?.status !== 'nc') return false;
        const t = (p.ncrType || '').toLowerCase();
        return t === 'observation' || t === 'ofi';
    }).length;
    const actualNCCount = ncCount - obsOfiCount;


    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" data-action="handleBackToExecutionList" aria-label="Back">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reports
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">Audit Execution: ${report.client}</h2>
                        <p style="color: var(--text-secondary);">Audit Date: ${window.UTILS.formatDate(report.date)} | Status: ${report.status}</p>
                    </div>
                    <button class="btn btn-primary" data-action="generateAuditReport" data-id="${report.id}" aria-label="Export PDF">
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
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem;">
                                <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 0.85rem 0.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${totalItems}</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem;">Total Items</div>
                                </div>
                                <div style="text-align: center; background: rgba(16, 185, 129, 0.3); padding: 0.85rem 0.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${conformCount}</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem;">Conformities</div>
                                </div>
                                <div style="text-align: center; background: rgba(245, 158, 11, 0.35); padding: 0.85rem 0.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${obsOfiCount}</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem;">OBS / OFI</div>
                                </div>
                                <div style="text-align: center; background: rgba(239, 68, 68, 0.3); padding: 0.85rem 0.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${actualNCCount}</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem;">NC (Min/Maj)</div>
                                </div>
                                <div style="text-align: center; background: rgba(156, 163, 175, 0.3); padding: 0.85rem 0.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                                    <div style="font-size: 1.5rem; font-weight: bold;">${pendingCount}</div>
                                    <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem;">Pending</div>
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

if (window.Logger) Logger.debug('Modules', 'execution-list.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBackToExecutionList, toggleExecutionAnalytics, deleteAuditReport, openEditReportModal };
}

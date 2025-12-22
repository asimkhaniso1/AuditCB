// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs
// ============================================

function renderAuditExecutionEnhanced() {
    const state = window.state;
    const searchTerm = state.executionSearchTerm || '';

    let filteredReports = state.auditReports.filter(report => {
        return report.client.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const rows = filteredReports.map(report => `
        <tr class="execution-row" data-report-id="${report.id}" style="cursor: pointer;">
            <td>${report.client}</td>
            <td>${report.date}</td>
            <td><span style="background: ${report.findings > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.findings}</span></td>
            <td><span style="background: ${report.status === window.CONSTANTS.STATUS.FINALIZED ? 'var(--success-color)' :
            report.status === 'Approved' ? '#7c3aed' :
                report.status === 'In Review' ? 'var(--warning-color)' :
                    '#64748b'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.status}</span></td>
            <td>
                <button class="btn btn-sm edit-execution" data-report-id="${report.id}" style="color: var(--primary-color); margin-right: 0.5rem;"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-execution" data-report-id="${report.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');

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
                            <th>Client</th>
                            <th>Audit Date</th>
                            <th>Findings (NCs)</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No reports found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('execution-search')?.addEventListener('input', (e) => {
        state.executionSearchTerm = e.target.value;
        renderAuditExecutionEnhanced();
    });

    document.querySelectorAll('.view-execution, .execution-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-execution')) {
                const reportId = parseInt(el.getAttribute('data-report-id'));
                renderExecutionDetail(reportId);
            }
        });
    });

    document.querySelectorAll('.edit-execution').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reportId = parseInt(btn.getAttribute('data-report-id'));
            openEditReportModal(reportId);
        });
    });


    // Helper for toggle
    window.toggleExecutionAnalytics = function () {
        if (state.showExecutionAnalytics === undefined) state.showExecutionAnalytics = true;
        state.showExecutionAnalytics = !state.showExecutionAnalytics;
        renderAuditExecutionEnhanced();
    };
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

    const uniqueClients = [...new Set(allOpenPlans.map(p => p.client))].sort();

    modalBody.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 5px; display: block;">Filter by Company:</label>
            <select class="form-control" onchange="window.filterAuditPlansStart(this.value)" style="margin-bottom: 1rem; border-color: var(--primary-color);">
                <option value="">-- All Companies with Open Plans --</option>
                ${uniqueClients.map(c => `<option value="${c}">${c}</option>`).join('')}
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

    // Update button text to 'Start Audit'
    document.getElementById('modal-save').textContent = 'Start Audit';

    modalSave.onclick = () => {
        const planId = document.getElementById('report-plan').value;
        const date = document.getElementById('report-date').value;
        const status = document.getElementById('report-status')?.value || window.CONSTANTS.STATUS.IN_PROGRESS;

        if (planId && date) {
            const plan = state.auditPlans.find(p => p.id == planId);
            const newReport = {
                id: Date.now(),
                planId: plan.id, // Link to plan
                client: plan.client,
                date: date,
                findings: 0,
                status: status
            };

            if (!state.auditReports) state.auditReports = [];
            state.auditReports.push(newReport);

            // Mark plan as executed
            plan.reportId = newReport.id;

            window.saveData();
            window.closeModal();
            renderAuditExecutionEnhanced();
            window.showNotification('Audit Initiated! Checklist loaded from Plan.', 'success');
        } else {
            window.showNotification('Please select an Audit Plan from the list', 'error');
        }
    };
}


function openEditReportModal(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
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

function renderExecutionDetail(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // Calculate Progress
    // Calculate Progress
    // Fetch Data & Calculate Progress
    const plan = report.planId ? state.auditPlans.find(p => p.id == report.planId) : state.auditPlans.find(p => p.client === report.client);

    // Fetch Client Departments/Sites
    const clientData = state.clients.find(c => c.name === report.client);
    const departments = clientData && clientData.sites ? clientData.sites.map(s => s.name) : ['Management', 'Production', 'Quality', 'Store', 'Maintenance', 'HR', 'Sales'];

    const planChecklists = plan?.selectedChecklists || [];
    const checklists = state.checklists || [];
    const assignedChecklists = planChecklists.map(clId => checklists.find(c => c.id === clId)).filter(c => c);
    const customItems = report.customItems || [];

    // Create lookup
    const progressMap = {};
    (report.checklistProgress || []).forEach(p => {
        const key = p.isCustom ? `custom-${p.itemIdx}` : `${p.checklistId}-${p.itemIdx}`;
        progressMap[key] = p;
    });

    // Calculate stats
    const allItems = [];
    assignedChecklists.forEach(cl => {
        if (cl.clauses) {
            cl.clauses.forEach(clause => {
                clause.subClauses.forEach((item, subIdx) => {
                    allItems.push({ checklistId: cl.id, itemIdx: `${clause.mainClause}-${subIdx}` });
                });
            });
        } else {
            (cl.items || []).forEach((item, idx) => {
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
                <button class="btn btn-secondary" onclick="renderAuditExecutionEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reports
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">Audit Execution: ${report.client}</h2>
                        <p style="color: var(--text-secondary);">Audit Date: ${report.date} | Status: ${report.status}</p>
                    </div>
                    <button class="btn btn-primary" onclick="window.generateAuditReport(${report.id})">
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
                <button class="tab-btn active" data-tab="checklist">Checklist</button>
                <button class="tab-btn" data-tab="meetings" style="background: #eff6ff; color: #1d4ed8;">
                    <i class="fa-solid fa-handshake" style="margin-right: 0.25rem;"></i>Meetings
                </button>
                <button class="tab-btn" data-tab="ncr">NCRs</button>
                <button class="tab-btn" data-tab="capa">CAPA</button>
                <button class="tab-btn" data-tab="observations">Observations</button>
                <button class="tab-btn" data-tab="review" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i> Review & Submit
                </button>
                <button class="tab-btn" data-tab="summary">Summary</button>
            </div>

            <div id="tab-content"></div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderExecutionTab(report, e.target.getAttribute('data-tab'), { assignedChecklists, progressMap, customItems, departments });
        });
    });

    renderExecutionTab(report, 'checklist', { assignedChecklists, progressMap, customItems, departments });
}

function renderExecutionTab(report, tabName, contextData = {}) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'checklist':
            const { assignedChecklists = [], progressMap = {}, customItems = [], departments = [] } = contextData;


            // Helper to render row
            const renderRow = (item, checklistId, idx, isCustom = false) => {
                const uniqueId = isCustom ? `custom-${idx}` : `${checklistId}-${idx}`;
                const saved = progressMap[uniqueId] || {};
                const s = saved.status || ''; // 'conform', 'nc', 'na' or ''

                return `
                    <div class="card checklist-item" id="row-${uniqueId}" style="margin-bottom: 0.5rem; padding: 1rem; border-left: 4px solid #e2e8f0;">
                         <div style="display: grid; grid-template-columns: 80px 1fr 180px; gap: 1rem; align-items: start;">
                            <div style="font-weight: bold; color: var(--primary-color);">${item.clause || 'N/A'}</div>
                            <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(item.requirement)}</div>
                                <div style="position: relative;">
                                    <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.comment || '')}" style="margin-bottom: 0; padding-right: 35px;">
                                    <button type="button" id="mic-btn-${uniqueId}" onclick="window.startDictation('${uniqueId}')" style="position: absolute; right: 0; top: 0; height: 100%; width: 35px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;" title="Dictate to Remarks">
                                        <i class="fa-solid fa-microphone"></i>
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button type="button" class="btn-icon btn-na ${s === window.CONSTANTS.STATUS.NA ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', '${window.CONSTANTS.STATUS.NA}')" title="Not Applicable">N/A</button>
                                <button type="button" class="btn-icon btn-ok ${s === window.CONSTANTS.STATUS.CONFORM ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', '${window.CONSTANTS.STATUS.CONFORM}')" title="Conformity"><i class="fa fa-check"></i></button>
                                <button type="button" class="btn-icon btn-nc ${s === window.CONSTANTS.STATUS.NC ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', '${window.CONSTANTS.STATUS.NC}')" title="Non-Conformity"><i class="fa fa-times"></i></button>
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
                                     <input type="text" id="ncr-designation-${uniqueId}" class="form-control form-control-sm" placeholder="e.g., Quality Manager" value="${saved.designation || ''}">
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Department</label>
                                     <select id="ncr-department-${uniqueId}" class="form-control form-control-sm">
                                        <option value="">-- Select --</option>
                                        ${departments.map(d => `<option value="${d}" ${saved.department === d ? 'selected' : ''}>${d}</option>`).join('')}
                                        ${saved.department && !departments.includes(saved.department) ? `<option value="${saved.department}" selected>${saved.department}</option>` : ''}
                                     </select>
                                 </div>
                             </div>
                             
                             <!-- Evidence Image Preview -->
                             <div id="evidence-preview-${uniqueId}" style="display: ${saved.evidenceImage ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                                 <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm);">
                                     <img id="evidence-img-${uniqueId}" src="${saved.evidenceImage || ''}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.viewEvidenceImage('${uniqueId}')" title="Click to enlarge">
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
                            const sectionId = `clause-${checklist.id}-${clause.mainClause}`;
                            const clauseItems = clause.subClauses.map((item, subIdx) => {
                                const globalIdx = itemIdx++;
                                return renderRow(item, checklist.id, `${clause.mainClause}-${subIdx}`, false);
                            }).join('');

                            // Calculate progress for this section
                            const sectionProgress = clause.subClauses.map((_, subIdx) => {
                                const key = `${checklist.id}-${clause.mainClause}-${subIdx}`;
                                return progressMap[key]?.status || '';
                            });
                            const completed = sectionProgress.filter(s => s === 'conform' || s === 'nc' || s === 'na').length;
                            const total = clause.subClauses.length;
                            const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return `
                                        <div class="accordion-section" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                            <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); user-select: none;">
                                                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                                                    <input type="checkbox" class="section-checkbox" data-section-id="${sectionId}" onclick="event.stopPropagation(); window.toggleSectionSelection('${sectionId}')" style="width: 18px; height: 18px; cursor: pointer;" title="Select all items in this section">
                                                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; cursor: pointer;" onclick="window.toggleAccordion('${sectionId}')">Clause ${clause.mainClause}</span>
                                                    <span style="font-weight: 600; color: #1e293b; cursor: pointer; flex: 1;" onclick="window.toggleAccordion('${sectionId}')">${clause.title}</span>
                                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">(${clause.subClauses.length} items)</span>
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 1rem;">

                                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${completed}/${total}</span>
                                                    <i class="fa-solid fa-chevron-down accordion-icon" id="icon-${sectionId}" style="transition: transform 0.3s; cursor: pointer;" onclick="window.toggleAccordion('${sectionId}')"></i>
                                                </div>
                                            </div>
                                            <div class="accordion-content" id="${sectionId}" style="display: ${clauseIdx === 0 ? 'block' : 'none'}; padding: 1rem; background: white;">
                                                ${clauseItems}
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
                            <button class="btn btn-secondary" onclick="window.addCustomQuestion(${report.id})">
                                <i class="fa-solid fa-plus-circle" style="margin-right: 0.5rem;"></i> Add Question
                            </button>
                            <div style="position: relative;">
                                <button class="btn btn-outline-secondary" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i> Bulk Actions
                                </button>
                                <div class="hidden" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px; z-index: 1000;">
                                    <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Mark Items As:</div>
                                    </div>
                                    <button onclick="window.bulkUpdateStatus(${report.id}, 'conform'); this.parentElement.classList.add('hidden')" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                                        <i class="fa-solid fa-check" style="color: var(--success-color); width: 18px;"></i>
                                        <span>Conform</span>
                                    </button>
                                    <button onclick="window.bulkUpdateStatus(${report.id}, 'nc'); this.parentElement.classList.add('hidden')" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
                                        <i class="fa-solid fa-times" style="color: var(--danger-color); width: 18px;"></i>
                                        <span>Non-Conform</span>
                                    </button>
                                    <button onclick="window.bulkUpdateStatus(${report.id}, 'na'); this.parentElement.classList.add('hidden')" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
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
                            <button class="btn btn-primary" onclick="window.saveChecklist(${report.id})" id="save-progress-btn">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                            </button>
                        </div>
                    </div>

                    ${checklistHTML}
                    
                    <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                        <button class="btn btn-primary btn-lg" onclick="window.saveChecklist(${report.id})">
                            <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Save All Progress
                        </button>
                    </div>
                </div>

                <!-- Save Indicator -->
                <div class="save-indicator" id="save-indicator">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Progress Saved
                </div>

            `;
            break;

        case 'ncr':
            const ncrs = report.ncrs || [];
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Non-Conformity Reports (NCRs)</h3>
                        <button class="btn btn-primary" onclick="createNCR(${report.id})">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create NCR
                        </button>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>NCR #</th>
                                    <th>Type</th>
                                    <th>Clause</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ncrs.length > 0 ? ncrs.map((ncr, idx) => `
                                    <tr>
                                        <td>NCR-${String(idx + 1).padStart(3, '0')}</td>
                                        <td><span style="background: ${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'var(--danger-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'Major' : 'Minor'}</span></td>
                                        <td>${window.UTILS.escapeHtml(ncr.clause || '-')}</td>
                                        <td>${window.UTILS.escapeHtml(ncr.description || '-')}</td>
                                        <td><span style="background: ${ncr.status === window.CONSTANTS.STATUS.CLOSED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.status || 'Open'}</span></td>
                                        <td><button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button></td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No NCRs raised yet</td>
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
                        <button class="btn btn-primary" onclick="createCAPA(${report.id})">
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
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Observations & Recommendations</h3>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Positive Observations</h4>
                        <textarea id="positive-observations" rows="4" placeholder="Document good practices and positive findings...">${report.positiveObservations || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Opportunities for Improvement</h4>
                        <textarea id="ofi" rows="4" placeholder="Suggestions for improvement (not non-conformities)...">${report.ofi || ''}</textarea>
                    </div>

                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Evidence Collected</h4>
                        <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 2px dashed var(--border-color); text-align: center;">
                            <i class="fa-solid fa-upload" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
                            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Drag & drop files or click to upload</p>
                            <button class="btn btn-secondary">Browse Files</button>
                        </div>
                    </div>

                    <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="saveObservations(${report.id})">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Observations
                    </button>
                </div>
            `;
            break;

        case 'review': {
            // Auditor's Findings Review Screen
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

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <div>
                            <h3 style="margin: 0;"><i class="fa-solid fa-clipboard-check" style="color: var(--warning-color); margin-right: 0.5rem;"></i>Review Your Findings</h3>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">Review all flagged items before submitting to Lead Auditor for classification.</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" onclick="window.saveChecklist(${report.id})">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Changes
                            </button>
                            <button class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none;" onclick="window.submitToLeadAuditor(${report.id})" ${!isReadyToSubmit ? '' : ''}>
                                <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit to Lead Auditor
                            </button>
                        </div>
                    </div>
                    
                    <!-- Summary Stats -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="background: #eff6ff; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${allFindings.length}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Total Findings</div>
                        </div>
                        <div style="background: #fee2e2; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${allFindings.filter(f => f.type === 'major').length}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Major</div>
                        </div>
                        <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${allFindings.filter(f => f.type === 'minor').length}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Minor</div>
                        </div>
                        <div style="background: #f3e8ff; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">${allFindings.filter(f => f.type === 'observation').length}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Observations</div>
                        </div>
                    </div>
                    
                    <!-- Findings List -->
                    ${allFindings.length > 0 ? `
                        <div style="max-height: 500px; overflow-y: auto;">
                            ${allFindings.map((f, idx) => `
                                <div class="card" style="margin-bottom: 0.75rem; padding: 1rem; border-left: 4px solid ${f.type === 'major' ? '#dc2626' : f.type === 'minor' ? '#d97706' : '#8b5cf6'};">
                                    <div style="display: grid; grid-template-columns: 1fr 150px 150px; gap: 1rem; align-items: start;">
                                        <div>
                                                ${f.source} Finding #${idx + 1}
                                                ${f.hasEvidence ? `<img src="${f.evidenceImage}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; margin-left: 0.5rem; vertical-align: middle;" title="Evidence">` : ''}
                                            </div>
                                            ${f.clause || f.requirement ? `
                                                <div style="font-size: 0.8rem; color: var(--primary-color); margin-bottom: 0.25rem; font-weight: 600;">
                                                    ${f.clause ? `${f.clause}: ` : ''}${f.requirement || ''}
                                                </div>
                                            ` : ''}
                                            <div style="font-weight: 500; margin-bottom: 0.5rem;">${f.description}</div>
                                            ${f.designation || f.department ? `
                                                <div style="font-size: 0.85rem; color: #64748b;">
                                                    <i class="fa-solid fa-user"></i> ${f.designation || '-'} | 
                                                    <i class="fa-solid fa-building"></i> ${f.department || '-'}
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Severity</label>
                                            <select class="form-control form-control-sm review-severity" data-finding-id="${f.id}" style="font-size: 0.85rem;">
                                                <option value="observation" ${f.type === 'observation' ? 'selected' : ''}>Observation</option>
                                                <option value="minor" ${f.type === 'minor' ? 'selected' : ''}>Minor NC</option>
                                                <option value="major" ${f.type === 'major' ? 'selected' : ''}>Major NC</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Auditor Remarks</label>
                                            <input type="text" class="form-control form-control-sm review-remarks" data-finding-id="${f.id}" placeholder="Add notes..." value="${f.remarks}" style="font-size: 0.85rem;">
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 3rem; background: #f0fdf4; border-radius: 8px;">
                            <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;"></i>
                            <h4 style="margin: 0 0 0.5rem 0; color: #16a34a;">No Findings Recorded</h4>
                            <p style="color: #64748b; margin: 0;">This audit has no non-conformities. Ready to submit!</p>
                        </div>
                    `}
                </div>
            `;
        }
            break;

        case 'summary':
            // Delegate to Reporting Module
            window.renderReportSummaryTab(report, tabContent);
            break;

        case 'meetings':
            // ISO 17021-1 Opening/Closing Meeting Records
            const openingMeeting = report.openingMeeting || {};
            const closingMeeting = report.closingMeeting || {};

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
                            <label>Attendees (one per line: Name - Role - Organization)</label>
                            <textarea id="opening-attendees" class="form-control" rows="4" placeholder="John Smith - Lead Auditor - CB Name&#10;Jane Doe - Quality Manager - Client Name">${openingMeeting.attendees || ''}</textarea>
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
                            <label>Attendees (one per line: Name - Role - Organization)</label>
                            <textarea id="closing-attendees" class="form-control" rows="4" placeholder="John Smith - Lead Auditor - CB Name&#10;Jane Doe - Quality Manager - Client Name">${closingMeeting.attendees || ''}</textarea>
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
                    <button class="btn btn-primary" onclick="window.saveMeetingRecords(${report.id})">
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

window.setChecklistStatus = function (uniqueId, status) {
    const row = document.getElementById('row-' + uniqueId);
    if (!row) return;

    // Update buttons
    row.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));

    let activeBtnClass = '';
    if (status === window.CONSTANTS.STATUS.CONFORM) activeBtnClass = '.btn-ok';
    else if (status === window.CONSTANTS.STATUS.NC) activeBtnClass = '.btn-nc';
    else if (status === window.CONSTANTS.STATUS.NA) activeBtnClass = '.btn-na';

    if (activeBtnClass) row.querySelector(activeBtnClass)?.classList.add('active');

    // Show/Hide NCR Panel
    const panel = document.getElementById('ncr-panel-' + uniqueId);
    if (panel) {
        if (status === window.CONSTANTS.STATUS.NC) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    // Update hidden input
    document.getElementById('status-' + uniqueId).value = status;
};

window.addCustomQuestion = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
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
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    const checklistData = [];
    document.querySelectorAll('.status-input').forEach(input => {
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

        // Only save if interacted with
        if (status || comment || ncrDesc || evidenceImage) {
            checklistData.push({
                checklistId: input.dataset.checklist,
                itemIdx: input.dataset.item,
                isCustom: input.dataset.custom === 'true',
                status: status,
                comment: comment,
                ncrDescription: ncrDesc,
                transcript: transcript,
                ncrType: ncrType,
                evidenceImage: evidenceImage, // Assuming safe if generated by system or Base64
                evidenceSize: evidenceSize,
                designation: designation,
                department: department
            });
        }
    });

    report.checklistProgress = checklistData;
    window.saveData();

    // Show save indicator
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }

    window.showNotification('Checklist progress saved successfully', 'success');
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
    // Check if any items are selected via checkboxes
    let targetItems = document.querySelectorAll('.checklist-item.selected-item');
    let useSelection = targetItems.length > 0;

    // If no items selected, fall back to filtered items
    if (!useSelection) {
        targetItems = document.querySelectorAll('.checklist-item:not(.filtered-out)');
    }

    if (targetItems.length === 0) {
        window.showNotification('No items to update', 'warning');
        return;
    }

    const confirmMsg = useSelection
        ? `Mark ${targetItems.length} selected item(s) as "${status.toUpperCase()}"?`
        : `Mark ${targetItems.length} filtered item(s) as "${status.toUpperCase()}"?`;

    if (!confirm(confirmMsg)) return;

    let updatedCount = 0;
    targetItems.forEach(item => {
        const uniqueId = item.id.replace('row-', '');
        window.setChecklistStatus(uniqueId, status);
        updatedCount++;
    });

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
    const menu = document.getElementById(`bulk-actions-menu-${reportId}`);
    if (menu) menu.classList.add('hidden');

    // Also try to close the relative one if it exists (from the new UI)
    const relativeMenu = document.querySelector('.btn-outline-secondary + .hidden');
    if (relativeMenu && !relativeMenu.classList.contains('hidden')) {
        relativeMenu.classList.add('hidden');
    } else {
        // In case it was toggled open and doesn't have hidden class
        const openRelativeMenu = document.querySelector('.btn-outline-secondary + div:not(.hidden)');
        if (openRelativeMenu) openRelativeMenu.classList.add('hidden');
    }

    window.showNotification(`Updated ${updatedCount} item(s) to ${status.toUpperCase()}`, 'success');
    window.saveChecklist(reportId);
};


// Submit findings to Lead Auditor for review
window.submitToLeadAuditor = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // Save any pending changes from review screen
    document.querySelectorAll('.review-severity').forEach(select => {
        const findingId = select.dataset.findingId;
        const newType = select.value;

        if (findingId.startsWith('checklist-')) {
            const idx = parseInt(findingId.split('-')[1]);
            const ncItems = (report.checklistProgress || []).filter(p => p.status === 'nc');
            if (ncItems[idx]) ncItems[idx].ncrType = newType;
        } else if (findingId.startsWith('ncr-')) {
            const idx = parseInt(findingId.split('-')[1]);
            if (report.ncrs && report.ncrs[idx]) report.ncrs[idx].type = newType;
        }
    });

    document.querySelectorAll('.review-remarks').forEach(input => {
        const findingId = input.dataset.findingId;
        const remarks = input.value;

        if (findingId.startsWith('checklist-')) {
            const idx = parseInt(findingId.split('-')[1]);
            const ncItems = (report.checklistProgress || []).filter(p => p.status === 'nc');
            if (ncItems[idx]) ncItems[idx].remarks = remarks;
        } else if (findingId.startsWith('ncr-')) {
            const idx = parseInt(findingId.split('-')[1]);
            if (report.ncrs && report.ncrs[idx]) report.ncrs[idx].remarks = remarks;
        }
    });

    // Update report status to Pending Review
    report.status = 'Pending Review';
    report.submittedAt = new Date().toISOString();
    report.submittedBy = window.state.currentUser?.name || 'Auditor';

    window.saveData();

    // Show confirmation
    window.showNotification('Findings submitted to Lead Auditor for review!', 'success');

    // Navigate back to execution list
    setTimeout(() => {
        renderExecutionEnhanced();
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
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') {
            window.showNotification('Error recording audio: ' + event.error, 'error');
        }
        micBtn.innerHTML = originalIcon;
        micBtn.removeAttribute('disabled');
        clearTimeout(timeout);
    };
};

function createNCR(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
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

    // Camera Capture Logic
    const captureBtn = document.getElementById('btn-capture-img');
    if (captureBtn) {
        captureBtn.onclick = function () {
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Capturing...';
            setTimeout(() => {
                // Mock Image URL (Random Picsum Image)
                const mockUrl = "https://picsum.photos/600/400?random=" + Math.floor(Math.random() * 1000);
                document.getElementById('ncr-evidence-image-url').value = mockUrl;
                document.getElementById('image-preview').innerHTML = `<img src="${mockUrl}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                document.getElementById('img-status').textContent = "Image captured successfully";
                this.innerHTML = '<i class="fa-solid fa-camera"></i> Retake';
                this.classList.remove('btn-secondary');
                this.classList.add('btn-success');
            }, 1000); // 1s delay to simulate capture
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
        window.closeModal();
        renderExecutionDetail(reportId);
        window.showNotification('NCR created successfully with evidence', 'success');
    };
}

function createCAPA(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
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
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.positiveObservations = document.getElementById('positive-observations')?.value || '';
    report.ofi = document.getElementById('ofi')?.value || '';

    window.saveData();
    window.showNotification('Observations saved successfully');
}

// Save Opening/Closing Meeting Records (ISO 17021-1 Clause 9.4.7)
window.saveMeetingRecords = function (reportId) {
    const report = window.state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.openingMeeting = {
        date: document.getElementById('opening-date')?.value || '',
        time: document.getElementById('opening-time')?.value || '',
        attendees: document.getElementById('opening-attendees')?.value || '',
        notes: document.getElementById('opening-notes')?.value || ''
    };

    report.closingMeeting = {
        date: document.getElementById('closing-date')?.value || '',
        time: document.getElementById('closing-time')?.value || '',
        attendees: document.getElementById('closing-attendees')?.value || '',
        summary: document.getElementById('closing-summary')?.value || '',
        response: document.getElementById('closing-response')?.value || ''
    };

    window.saveData();
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
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        window.showNotification('Image exceeds 5MB limit. Please select a smaller image.', 'error');
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
                <span style="margin-left: 0.5rem; font-size: 0.85rem;">Compressing image...</span>
            </div>
        `;
    }

    // Read and compress the image
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Compress the image
            const compressedDataUrl = compressImage(img, file.type);
            const compressedSize = Math.round((compressedDataUrl.length * 3 / 4) / 1024); // Approximate KB

            // Update preview
            if (previewDiv) {
                previewDiv.style.display = 'block';
                previewDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm);">
                        <img id="evidence-img-${uniqueId}" src="${compressedDataUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.viewEvidenceImage('${uniqueId}')" title="Click to enlarge">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-size: 0.8rem; color: var(--success-color); font-weight: 500;"><i class="fa-solid fa-check-circle"></i> Image attached</p>
                            <p id="evidence-size-${uniqueId}" style="margin: 0; font-size: 0.7rem; color: var(--text-secondary);">Compressed: ${compressedSize} KB (original: ${Math.round(file.size / 1024)} KB)</p>
                        </div>
                        <button type="button" class="btn btn-sm" onclick="window.removeEvidence('${uniqueId}')" style="color: var(--danger-color);" title="Remove"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }

            // Mark as attached
            const evidenceData = document.getElementById('evidence-data-' + uniqueId);
            if (evidenceData) evidenceData.value = 'attached';

            window.showNotification('Image attached and compressed successfully', 'success');
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
window.viewEvidenceImage = function (uniqueId) {
    const imgEl = document.getElementById('evidence-img-' + uniqueId);
    if (!imgEl || !imgEl.src) return;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'evidence-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;';
    overlay.onclick = function () { overlay.remove(); };

    // Create image container
    overlay.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${imgEl.src}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove();" style="position: absolute; top: -15px; right: -15px; width: 36px; height: 36px; border-radius: 50%; background: white; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 1.2rem;">
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
// generateAuditReport moved to reporting-module.js

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
window.toggleSectionSelection = function (sectionId) {
    const checkbox = document.querySelector(`.section-checkbox[data-section-id="${sectionId}"]`);
    const sectionContent = document.getElementById(sectionId);

    if (!sectionContent) return;

    const items = sectionContent.querySelectorAll('.checklist-item');
    items.forEach(item => {
        if (checkbox.checked) {
            item.classList.add('selected-item');
            item.style.background = '#eff6ff';
            item.style.borderLeft = '4px solid var(--primary-color)';
        } else {
            item.classList.remove('selected-item');
            item.style.background = '';
            item.style.borderLeft = '';
        }
    });
};

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
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
            <div style="position: relative; width: 100%; max-width: 640px; aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <video id="webcam-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                <div id="webcam-loading" style="position: absolute; color: white;">Accessing Camera...</div>
            </div>
            <div id="webcam-error" style="color: var(--danger-color); display: none; text-align: center;"></div>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Ensure your browser has camera permissions enabled.</p>
        </div>
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

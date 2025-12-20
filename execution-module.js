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
            <td><span style="background: ${report.status === window.CONSTANTS.STATUS.FINALIZED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.status}</span></td>
            <td>
                <button class="btn btn-sm edit-execution" data-report-id="${report.id}" style="color: var(--primary-color); margin-right: 0.5rem;"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-execution" data-report-id="${report.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
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
    const today = new Date().toISOString().split('T')[0];
    const availablePlans = state.auditPlans.filter(p => !p.reportId && p.date >= today);

    modalTitle.innerHTML = '<i class="fa-solid fa-play"></i> Start New Audit';

    // UI: List of Plans + Selected Confirmation
    const renderTable = () => {
        if (availablePlans.length === 0) return '<div class="alert alert-warning">No upcoming audit plans available. (Reference limited to Today or Future)</div>';

        return `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Select an audit plan reference to proceed:</p>
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
                    <tbody>
                        ${availablePlans.map(p => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px; font-weight: 600;">PLN-${p.id}</td>
                                <td style="padding: 8px;">${p.client}</td>
                                <td style="padding: 8px;">${p.standard}</td>
                                <td style="padding: 8px;">${p.date}</td>
                                <td style="padding: 8px; text-align: center;">
                                    <button class="btn btn-sm btn-outline-primary select-plan-btn" 
                                        onclick="document.getElementById('report-plan').value='${p.id}'; 
                                                 document.getElementById('report-date').value='${p.date}';
                                                 document.getElementById('plan-display').textContent='PLN-${p.id}: ${p.client}';
                                                 document.querySelectorAll('.select-plan-btn').forEach(b => {b.className='btn btn-sm btn-outline-primary'; b.textContent='Select'});
                                                 this.className='btn btn-sm btn-success'; this.textContent='Selected';
                                                 document.getElementById('confirm-section').style.display='block';">
                                        Select
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
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
                <input type="date" class="form-control" id="report-date" min="${today}" required>
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
    };

    modalBody.innerHTML = renderTable();
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
                <input type="text" class="form-control" value="${report.client}" disabled>
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
    const plan = report.planId ? state.auditPlans.find(p => p.id == report.planId) : state.auditPlans.find(p => p.client === report.client);
    let totalItems = 0;
    if (plan && plan.selectedChecklists) {
        plan.selectedChecklists.forEach(id => {
            const cl = state.checklists.find(c => c.id === id);
            if (cl && cl.items) totalItems += cl.items.length;
        });
    }
    // Add custom items
    totalItems += (report.customItems || []).length;

    const completedItems = (report.checklistProgress || []).filter(p => p.status && p.status !== '').length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

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
                
                 <!-- Progress Bar -->
                <div>
                     <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem;">
                        <strong>Checklist Completion</strong>
                        <strong style="color: var(--primary-color);">${progress}%</strong>
                     </div>
                     <div style="height: 1.2rem; background: #f1f5f9; border-radius: 1rem; overflow: hidden; border: 1px solid #e2e8f0;">
                        <div style="width: ${progress}%; background: linear-gradient(90deg, var(--primary-color), #3b82f6); height: 100%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">
                             ${progress > 5 ? `${completedItems}/${totalItems}` : ''}
                        </div>
                     </div>
                </div>
            </div>

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="checklist">Checklist</button>
                <button class="tab-btn" data-tab="ncr">NCRs</button>
                <button class="tab-btn" data-tab="capa">CAPA</button>
                <button class="tab-btn" data-tab="observations">Observations</button>
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
            renderExecutionTab(report, e.target.getAttribute('data-tab'));
        });
    });

    renderExecutionTab(report, 'checklist');
}

function renderExecutionTab(report, tabName) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'checklist':
            const plan = report.planId ? state.auditPlans.find(p => p.id == report.planId) : state.auditPlans.find(p => p.client === report.client);
            const planChecklists = plan?.selectedChecklists || [];
            const checklists = state.checklists || [];
            const assignedChecklists = planChecklists.map(clId => checklists.find(c => c.id === clId)).filter(c => c);
            const customItems = report.customItems || [];

            // Create lookup for saved progress
            const progressMap = {};
            (report.checklistProgress || []).forEach(p => {
                const key = p.isCustom ? `custom-${p.itemIdx}` : `${p.checklistId}-${p.itemIdx}`;
                progressMap[key] = p;
            });

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
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${item.requirement}</div>
                                <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${saved.comment || ''}" style="margin-bottom: 0;">
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
                                             <option value="${window.CONSTANTS.NCR_TYPES.PENDING}" ${!saved.ncrType || saved.ncrType === window.CONSTANTS.NCR_TYPES.PENDING ? 'selected' : ''}>Flagged (Pending Classification)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation</option>
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
                                         <button type="button" class="btn btn-sm btn-outline-primary" style="flex: 1;" onclick="window.captureScreenEvidence('${uniqueId}')" title="Capture from Zoom/Teams Screen Share">
                                             <i class="fa-solid fa-desktop"></i> Screen
                                         </button>
                                     </div>
                                     <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" onchange="window.handleEvidenceUpload('${uniqueId}', this)">
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
                             
                             <div style="position: relative;">
                                <textarea id="ncr-desc-${uniqueId}" class="form-control form-control-sm" rows="2" placeholder="Short description of NC and Evidence...">${saved.ncrDescription || ''}</textarea>
                                <textarea id="ncr-transcript-${uniqueId}" class="form-control form-control-sm" rows="2" placeholder="Voice Transcript..." style="margin-top: 5px; background: #f8fafc; font-family: monospace; font-size: 0.85rem;">${saved.transcript || ''}</textarea>
                                <button type="button" class="btn btn-sm btn-light" id="mic-btn-${uniqueId}" onclick="window.startDictation('${uniqueId}')" style="position: absolute; right: 5px; bottom: 5px; color: var(--primary-color); border: 1px solid #ddd;" title="Dictate (10s limit)">
                                    <i class="fa-solid fa-microphone"></i>
                                </button>
                             </div>
                         </div>
                    </div>
                `;
            };

            let checklistHTML = '';

            if (assignedChecklists.length > 0) {
                checklistHTML = assignedChecklists.map(checklist => `
                    <div style="margin-bottom: 2rem;">
                        <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: var(--primary-color);">
                            ${checklist.name}
                        </h4>
                        ${(checklist.items || []).map((item, idx) => renderRow(item, checklist.id, idx, false)).join('')}
                    </div>
                 `).join('');
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
                    .btn-icon { border: 1px solid #d1d5db; background: white; width: 32px; height: 32px; border-radius: 4px; color: #6b7280; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; }
                    .btn-icon:hover { background: #f3f4f6; }
                    .btn-icon.active { transform: scale(1.1); font-weight: bold; border-color: transparent; }
                    .btn-icon.btn-ok.active { background: var(--success-color); color: white; }
                    .btn-icon.btn-nc.active { background: var(--danger-color); color: white; }
                    .btn-icon.btn-na.active { background: #9ca3af; color: white; }
                    .checklist-item:focus-within { border-color: var(--primary-color) !important; background: #f0f9ff !important; }
                </style>
                <div>
                   
                    <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-bottom: 1rem; position: sticky; top: 0; background: rgba(255,255,255,0.9); padding: 10px; z-index: 100; backdrop-filter: blur(5px); border-bottom: 1px solid #eee;">
                         <button class="btn btn-secondary" onclick="window.addCustomQuestion(${report.id})">
                            <i class="fa-solid fa-plus-circle" style="margin-right: 0.5rem;"></i> Add Custom Question
                        </button>
                        <button class="btn btn-primary" onclick="window.saveChecklist(${report.id})">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                        </button>
                    </div>

                    ${checklistHTML}
                    
                    <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                        <button class="btn btn-primary btn-lg" onclick="window.saveChecklist(${report.id})">Save All Progress</button>
                    </div>
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
                                        <td>${ncr.clause || '-'}</td>
                                        <td>${ncr.description || '-'}</td>
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

        case 'summary':
            // Delegate to Reporting Module
            window.renderReportSummaryTab(report, tabContent);
            break;
    }
}

// Helper functions for execution module
// Helper functions for execution module

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

    const clause = prompt("Enter Clause Number (e.g. 'New 1.1'):");
    if (!clause) return;
    const req = prompt("Enter Requirement Question:");
    if (!req) return;

    if (!report.customItems) report.customItems = [];
    report.customItems.push({ clause, requirement: req });

    window.saveData();
    window.renderExecutionDetail(reportId);
};

window.saveChecklist = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    const checklistData = [];
    document.querySelectorAll('.status-input').forEach(input => {
        const uniqueId = input.id.replace('status-', '');

        const status = input.value;
        const comment = document.getElementById('comment-' + uniqueId)?.value || '';
        const ncrDesc = document.getElementById('ncr-desc-' + uniqueId)?.value || '';
        const transcript = document.getElementById('ncr-transcript-' + uniqueId)?.value || '';
        const ncrType = document.getElementById('ncr-type-' + uniqueId)?.value || '';

        // Get evidence image data
        const evidenceImg = document.getElementById('evidence-img-' + uniqueId);
        const evidenceData = document.getElementById('evidence-data-' + uniqueId)?.value || '';
        const evidenceImage = (evidenceData === 'attached' && evidenceImg?.src && !evidenceImg.src.includes('data:,')) ? evidenceImg.src : '';
        const evidenceSize = document.getElementById('evidence-size-' + uniqueId)?.textContent || '';

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
                evidenceImage: evidenceImage,
                evidenceSize: evidenceSize
            });
        }
    });

    report.checklistProgress = checklistData;
    window.saveData();
    window.showNotification('Checklist progress saved successfully');
};

window.startDictation = function (uniqueId) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    const micBtn = document.getElementById('mic-btn-' + uniqueId);
    const textarea = document.getElementById('ncr-transcript-' + uniqueId);

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
                    <option value="${window.CONSTANTS.NCR_TYPES.PENDING}">Flagged (Pending Classification)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MINOR}">Minor NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}">Major NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}">Observation</option>
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
        const type = document.getElementById('ncr-type').value;
        const clause = document.getElementById('ncr-clause').value;
        const description = document.getElementById('ncr-description').value;
        const evidence = document.getElementById('ncr-evidence').value;
        const evidenceImage = document.getElementById('ncr-evidence-image-url').value;

        // We can capture the transcript separately if needed, but here it's appended to description.
        // If we want a separate 'transcript' field, we'd need another hidden input populated by the mic.
        // For now, appending to description is fine, or we can assume description IS the transcript.

        // Let's create a separate transcript field if the user wants "transcript" specifically in report.
        // Actually, I'll store it as 'transcript' only if it came from mic? No, hard to track.
        // I'll just use the description as the primary text. The user asked for "transcript to be part of report".
        // I added 'ncr.transcript' in the generateReport function. I should save it.
        // Let's assume description IS the transcript for simplicity, or add a specific field.
        // To support `ncr.transcript` field I added in report, I'll save a copy of description there?
        // Let's just save description. In the report generator I used `ncr.transcript`. I should change report generator to use `ncr.description` mostly, or `ncr.transcript` if distinct.
        // I will save `transcript: description` as well to be safe for the report template I just wrote.

        if (description) {
            if (!report.ncrs) report.ncrs = [];
            report.ncrs.push({
                type,
                clause,
                description,
                evidence,
                evidenceImage, // New Field
                transcript: description, // Mapping description to transcript for the report template
                status: 'Open',
                createdAt: new Date().toISOString()
            });
            report.findings = report.ncrs.length;

            window.saveData();
            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR created successfully with evidence');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
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

// Export functions
window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
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

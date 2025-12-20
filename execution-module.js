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
            <td><span style="background: ${report.status === 'Finalized' ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${report.status}</span></td>
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
                <h2 style="margin: 0;">Execution & Reports</h2>
                 <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleExecutionAnalytics()" style="white-space: nowrap;">
                        <i class="fa-solid ${state.showExecutionAnalytics !== false ? 'fa-chart-simple' : 'fa-chart-line'}" style="margin-right: 0.5rem;"></i>${state.showExecutionAnalytics !== false ? 'Hide Analytics' : 'Show Analytics'}
                    </button>
                    <button class="btn btn-primary" onclick="window.openCreateReportModal()"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create Report</button>
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
                        <div style="font-size: 1.5rem; font-weight: bold;">${state.auditReports.filter(r => r.status !== 'Finalized').length}</div>
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

    modalTitle.textContent = 'Create Audit Report';
    modalBody.innerHTML = `
        <form id="report-form">
            <div class="form-group">
                <label>Audit Plan</label>
                <select class="form-control" id="report-plan" required>
                    <option value="">-- Select Audit Plan --</option>
                    ${state.auditPlans.map(p => `<option value="${p.id}">${p.client} - ${p.date}</option>`).join('')}
                </select>
                ${state.auditPlans.length === 0 ? '<small style="color: var(--danger-color);">No audit plans available. Please create a plan first.</small>' : ''}
            </div>
            <div class="form-group">
                <label>Audit Date</label>
                <input type="date" class="form-control" id="report-date" required>
            </div>
            <div class="form-group">
                <label>Initial Status</label>
                <select class="form-control" id="report-status">
                    <option>In Progress</option>
                    <option>Draft</option>
                </select>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const planId = document.getElementById('report-plan').value;
        const date = document.getElementById('report-date').value;
        const status = document.getElementById('report-status').value;

        if (planId && date) {
            const plan = state.auditPlans.find(p => p.id == planId);
            const newReport = {
                id: Date.now(),
                client: plan.client,
                date: date,
                findings: 0,
                status: status
            };

            if (!state.auditReports) state.auditReports = [];
            state.auditReports.push(newReport);
            window.saveData();
            window.closeModal();
            renderAuditExecutionEnhanced();
            window.showNotification('Audit Report created. Now you can fill the checklist.', 'success');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
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
                    <option ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option ${report.status === 'Draft' ? 'selected' : ''}>Draft</option>
                    <option ${report.status === 'Finalized' ? 'selected' : ''}>Finalized</option>
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
    const plan = state.auditPlans.find(p => p.client === report.client);
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
            const plan = state.auditPlans.find(p => p.client === report.client);
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
                                <button type="button" class="btn-icon btn-na ${s === 'na' ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', 'na')" title="Not Applicable">N/A</button>
                                <button type="button" class="btn-icon btn-ok ${s === 'conform' ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', 'conform')" title="Conformity"><i class="fa fa-check"></i></button>
                                <button type="button" class="btn-icon btn-nc ${s === 'nc' ? 'active' : ''}" onclick="window.setChecklistStatus('${uniqueId}', 'nc')" title="Non-Conformity"><i class="fa fa-times"></i></button>
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
                                     <select id="ncr-type-${uniqueId}" class="form-control form-control-sm">
                                        <option value="minor" ${saved.ncrType === 'minor' ? 'selected' : ''}>Minor</option>
                                        <option value="major" ${saved.ncrType === 'major' ? 'selected' : ''}>Major</option>
                                        <option value="observation" ${saved.ncrType === 'observation' ? 'selected' : ''}>Observation</option>
                                     </select>
                                 </div>
                                 <div style="display: flex; flex-direction: column;">
                                     <label style="font-size: 0.8rem;">Evidence Image <span style="font-weight: normal; color: var(--text-secondary);">(max 5MB)</span></label>
                                     <button type="button" class="btn btn-sm btn-outline-secondary" style="border-style: dashed; flex: 1;" onclick="document.getElementById('img-${uniqueId}').click()">
                                         <i class="fa-solid fa-camera"></i> ${saved.evidenceImage ? 'Change Image' : 'Attach Photo'}
                                     </button>
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
                                        <td><span style="background: ${ncr.type === 'major' ? 'var(--danger-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.type === 'major' ? 'Major' : 'Minor'}</span></td>
                                        <td>${ncr.clause || '-'}</td>
                                        <td>${ncr.description || '-'}</td>
                                        <td><span style="background: ${ncr.status === 'Closed' ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.status || 'Open'}</span></td>
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
                                        <td><span style="background: ${capa.status === 'Completed' ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${capa.status || 'In Progress'}</span></td>
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
            const ncrCount = (report.ncrs || []).length;
            const majorCount = (report.ncrs || []).filter(n => n.type === 'major').length;
            const minorCount = (report.ncrs || []).filter(n => n.type === 'minor').length;

            let actionButtons = '';
            if (report.status === 'In Review') {
                actionButtons = `
                    <button class="btn btn-danger" onclick="revertToDraft(${report.id})">
                        <i class="fa-solid fa-undo" style="margin-right: 0.5rem;"></i> Revert
                    </button>
                    <button class="btn btn-success" style="flex: 1;" onclick="publishReport(${report.id})">
                        <i class="fa-solid fa-file-signature" style="margin-right: 0.5rem;"></i> Publish Final Report
                    </button>
                `;
            } else if (report.status === 'Published' || report.status === 'Finalized') {
                actionButtons = `
                    <button class="btn btn-secondary" style="flex: 1;" onclick="window.generateAuditReport(${report.id})">
                        <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i> Download Report
                    </button>
                `;
            } else {
                actionButtons = `
                    <button class="btn btn-secondary" onclick="window.saveReportDraft(${report.id})">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Draft
                    </button>
                    <button class="btn btn-primary" style="flex: 1;" onclick="submitForReview(${report.id})">
                        <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit for Review
                    </button>
                `;
            }

            const ncrReviewHTML = (report.ncrs || []).map((n, i) => `
                <div style="background: #f8fafc; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; border-left: 3px solid ${n.type === 'major' ? 'var(--danger-color)' : 'var(--warning-color)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                         <strong style="font-size: 0.9rem;">${n.type.toUpperCase()} - ${n.clause}</strong>
                         <span style="font-size: 0.8rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${n.status || 'Open'}</span>
                    </div>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-color);">${n.description}</p>
                </div>
            `).join('') || '<div style="padding: 1rem; text-align: center; color: var(--text-secondary); background: #f8fafc; border-radius: 8px;">No findings to review. Seamless audit!</div>';

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <div>
                            <h3 style="margin: 0;">Audit Report Drafting</h3>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">Review findings and finalize report content.</p>
                        </div>
                        <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);" onclick="window.generateAIConclusion('${report.id}')">
                            <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> Auto-Draft with AI
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                        
                        <!-- Left Column: Stats & Review -->
                        <div>
                            <h4 style="font-size: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">
                                <i class="fa-solid fa-clipboard-check" style="color: var(--primary-color); margin-right: 0.5rem;"></i> Findings Summary
                            </h4>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem;">
                                <div style="background: #eff6ff; padding: 10px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; color: var(--primary-color); font-size: 1.25rem;">${majorCount}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Major NCs</div>
                                </div>
                                <div style="background: #fff7ed; padding: 10px; border-radius: 6px; text-align: center;">
                                    <div style="font-weight: 700; color: var(--warning-color); font-size: 1.25rem;">${minorCount}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Minor NCs</div>
                                </div>
                            </div>

                            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                                ${ncrReviewHTML}
                            </div>
                        </div>

                        <!-- Right Column: Editorial -->
                        <div>
                             <h4 style="font-size: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">
                                <i class="fa-solid fa-pen-nib" style="color: var(--primary-color); margin-right: 0.5rem;"></i> Report Content
                            </h4>

                            <div style="margin-bottom: 1.5rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Executive Summary</label>
                                <textarea id="exec-summary" rows="5" class="form-control" placeholder="High-level overview of the audit scope and execution...">${report.execSummary || ''}</textarea>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                                <div>
                                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Key Strengths</label>
                                    <textarea id="strengths" rows="4" class="form-control" placeholder="Positive observations...">${report.strengths || ''}</textarea>
                                </div>
                                <div>
                                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Areas for Improvement</label>
                                    <textarea id="improvements" rows="4" class="form-control" placeholder="OFI and weaknesses...">${report.improvements || ''}</textarea>
                                </div>
                            </div>

                            <div style="margin-bottom: 1.5rem;">
                                <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Final Conclusion</label>
                                <textarea id="conclusion" rows="4" class="form-control" placeholder="Final verdict and compliance statement...">${report.conclusion || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 6px;">
                                <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Certification Recommendation</label>
                                <select id="recommendation" class="form-control" style="background: white;">
                                    <option ${report.recommendation === 'Recommend Certification' ? 'selected' : ''}>Recommend Certification</option>
                                    <option ${report.recommendation === 'Conditional Certification' ? 'selected' : ''}>Conditional Certification (pending closure of NCs)</option>
                                    <option ${report.recommendation === 'Do Not Recommend' ? 'selected' : ''}>Do Not Recommend</option>
                                </select>
                            </div>

                            <div style="display: flex; gap: 1rem;">
                                ${actionButtons}
                            </div>
                        </div>
                    </div>
                </div>
            `;
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
    if (status === 'conform') activeBtnClass = '.btn-ok';
    else if (status === 'nc') activeBtnClass = '.btn-nc';
    else if (status === 'na') activeBtnClass = '.btn-na';

    if (activeBtnClass) row.querySelector(activeBtnClass)?.classList.add('active');

    // Show/Hide NCR Panel
    const panel = document.getElementById('ncr-panel-' + uniqueId);
    if (panel) {
        if (status === 'nc') {
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
                    <option value="minor">Minor NC</option>
                    <option value="major">Major NC</option>
                    <option value="observation">Observation</option>
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

function submitForReview(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.conclusion = document.getElementById('conclusion')?.value || '';
    report.recommendation = document.getElementById('recommendation')?.value || '';
    if (document.getElementById('exec-summary')) report.execSummary = document.getElementById('exec-summary').value;
    if (document.getElementById('strengths')) report.strengths = document.getElementById('strengths').value;
    if (document.getElementById('improvements')) report.improvements = document.getElementById('improvements').value;

    report.status = 'In Review';
    window.saveData();
    renderExecutionDetail(reportId);
    window.showNotification('Report submitted for review');
}

function publishReport(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.status = 'Published';
    report.finalizedAt = new Date().toISOString();
    window.saveData();
    renderExecutionDetail(reportId);
    window.showNotification('Report Published Successfully!', 'success');
    setTimeout(() => window.generateAuditReport(reportId), 500);
}

function revertToDraft(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;
    report.status = 'Draft';
    window.saveData();
    renderExecutionDetail(reportId);
    window.showNotification('Report reverted to Draft');
}

window.saveReportDraft = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.execSummary = document.getElementById('exec-summary')?.value || '';
    report.conclusion = document.getElementById('conclusion')?.value || '';
    report.strengths = document.getElementById('strengths')?.value || '';
    report.improvements = document.getElementById('improvements')?.value || '';
    report.recommendation = document.getElementById('recommendation')?.value || '';

    window.saveData();
    window.showNotification('Report draft saved to local storage', 'success');
};

window.generateAIConclusion = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    window.showNotification('AI Agent analyzing audit findings...', 'info');

    // MOCK AI ANALYSIS
    const ncrCount = (report.ncrs || []).length;
    const majorCount = (report.ncrs || []).filter(n => n.type === 'major').length;
    const minorCount = (report.ncrs || []).filter(n => n.type === 'minor').length;
    const plan = state.auditPlans.find(p => p.client === report.client) || {};

    setTimeout(() => {
        // 1. Generate Executive Summary
        const execSummary = `The audit of ${report.client} was conducted on ${report.date} against the requirements of ${plan.standard || 'the standard'}. The primary objective was to verify compliance and effectiveness of the management system.

During the audit, a total of ${ncrCount} non-conformities were identified (${majorCount} Major, ${minorCount} Minor). The audit team reviewed objective evidence including documentation, records, and interviewed key personnel.

Overall, the management system demonstrates a ${majorCount > 0 ? 'partial' : 'high level of'} compliance. Key processes are generally well-defined, though specific lapses were noted in operational controls as detailed in the findings.`;

        // 2. Generate Strengths
        const strengths = `- Strong commitment from top management towards quality objectives.
- Documentation structure is comprehensive and easily accessible.
- Employee awareness regarding policy and objectives is commendable.
- Infrastructure and resources are well-maintained.`;

        // 3. Generate Improvements
        const improvements = `- Need to strengthen the internal audit mechanism to capture process deviations earlier.
- Document control for external origin documents needs review.
- Training records for temporary staff could be better organized.`;

        // 4. Generate Conclusion
        const conclusion = ncrCount === 0
            ? `Based on the audit results, the management system is found to be properly maintained and compliant with ${plan.standard}. No non-conformities were raised. It is recommended to continue certification.`
            : `The management system is generally effective, with the exception of the identified non-conformities. The organization is requested to provide a root cause analysis and a corrective action plan for the ${ncrCount} findings within 30 days. Subject to the acceptance of the corrective actions, certification is recommended.`;

        // Fill fields
        if (document.getElementById('exec-summary')) document.getElementById('exec-summary').value = execSummary;
        if (document.getElementById('strengths')) document.getElementById('strengths').value = strengths;
        if (document.getElementById('improvements')) document.getElementById('improvements').value = improvements;
        if (document.getElementById('conclusion')) document.getElementById('conclusion').value = conclusion;

        // Auto-select recommendation
        if (document.getElementById('recommendation')) {
            if (majorCount > 0) document.getElementById('recommendation').value = 'Conditional Certification (pending closure of NCs)';
            else document.getElementById('recommendation').value = 'Recommend Certification';
        }

        window.showNotification('AI Draft generated successfully!', 'success');
    }, 1500);
};

// Export functions
window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
window.renderExecutionDetail = renderExecutionDetail;
window.saveChecklist = saveChecklist;
window.createNCR = createNCR;
window.createCAPA = createCAPA;
window.submitForReview = submitForReview;
window.publishReport = publishReport;
window.revertToDraft = revertToDraft;

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
window.generateAuditReport = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) {
        window.showNotification('Report not found', 'error');
        return;
    }

    try {
        const plan = state.auditPlans.find(p => p.client === report.client) || {};
        const client = state.clients.find(c => c.name === report.client) || {};
        // Combine Manual NCRs and Checklist Progress NCs
        const manualNCRs = report.ncrs || [];
        const checklistNCRs = (report.checklistProgress || [])
            .filter(item => item.status === 'nc')
            .map(item => {
                let clause = 'Checklist Item';
                if (item.checklistId) {
                    const cl = state.checklists.find(c => c.id == item.checklistId);
                    const clItem = cl?.items?.[item.itemIdx];
                    if (clItem) clause = clItem.clause;
                } else if (item.isCustom) {
                    const customItem = (report.customItems || [])[item.itemIdx];
                    if (customItem) clause = customItem.clause;
                }

                return {
                    type: item.ncrType || 'minor',
                    clause: clause,
                    description: item.ncrDescription || item.comment || 'Non-conformity identified in checklist.',
                    evidence: 'Checklist Finding',
                    transcript: item.transcript,
                    evidenceImage: item.evidenceImage,
                    status: 'Open'
                };
            });

        const combinedNCRs = [...manualNCRs, ...checklistNCRs];

        const ncrCount = combinedNCRs.length;
        const majorCount = combinedNCRs.filter(n => n.type === 'major').length;
        const minorCount = combinedNCRs.filter(n => n.type === 'minor').length;
        const capaCount = (report.capas || []).length;

        // Calculate checklist progress
        const totalProgress = report.checklistProgress || [];
        const conformCount = totalProgress.filter(p => p.status === 'conform').length;
        const ncCount = totalProgress.filter(p => p.status === 'nc').length;
        const naCount = totalProgress.filter(p => p.status === 'na').length;
        const totalItems = totalProgress.length;
        const progressPercent = totalItems > 0 ? Math.round((conformCount / totalItems) * 100) : 0;

        // QR Code URL
        const qrData = `REP-${report.id} | ${report.client} | ${report.date} | Score: ${Math.max(0, 100 - (majorCount * 15) - (minorCount * 5))}%`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

        // Mock Compliance Score Logic
        const complianceScore = Math.max(0, 100 - (majorCount * 15) - (minorCount * 5));
        const conformHeight = complianceScore;
        const majorHeight = Math.min(100, majorCount * 15 + 10);
        const minorHeight = Math.min(100, minorCount * 10 + 10);

        // Get audit team
        const leadAuditor = state.auditors.find(a => plan.auditors?.includes(a.id));
        const auditTeam = (plan.auditors || []).map(id => state.auditors.find(a => a.id === id)).filter(a => a);

        const printWindow = window.open('', '_blank');

        if (!printWindow || printWindow.closed || typeof printWindow.closed == 'undefined') {
            window.showNotification('Popup blocked! Please allow popups for this site and try again.', 'error');
            return;
        }
        printWindow.document.write(`
        <html>
        <head>
            <title>Audit Report - ${report.client}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; color: #333; max-width: 900px; margin: 0 auto; background: #fff; }
                .report-container { padding: 40px; position: relative; }
                .cover-page { text-align: center; page-break-after: always; display: flex; flex-direction: column; justify-content: center; height: 90vh; }
                .logo { font-size: 3rem; font-weight: bold; color: #2c3e50; margin-bottom: 2rem; }
                .report-title { font-size: 2.5rem; margin-bottom: 1rem; color: #2c3e50; }
                
                h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-top: 40px; page-break-after: avoid; }
                h2 { color: #34495e; margin-top: 30px; font-size: 1.3rem; }
                p { line-height: 1.6; text-align: justify; margin-bottom: 1rem; }
                
                /* Enhanced Chart */
                .chart-section { margin: 40px 0; page-break-inside: avoid; }
                .chart-container { display: flex; justify-content: space-around; align-items: flex-end; height: 220px; margin: 20px auto; width: 75%; background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%); padding: 25px 20px 0 20px; border-bottom: 3px solid #cbd5e1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .bar-group { display: flex; flex-direction: column; align-items: center; width: 70px; }
                .bar { width: 100%; position: relative; border-top-left-radius: 6px; border-top-right-radius: 6px; box-shadow: 0 -2px 4px rgba(0,0,0,0.1); }
                .bar-val { font-weight: bold; margin-bottom: 8px; color: #1e293b; font-size: 1.1rem; }
                .bar-label { margin-top: 12px; font-size: 0.9rem; font-weight: 600; color: #475569; }

                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .meta-table td { padding: 14px; border: 1px solid #e2e8f0; }
                .meta-table td:first-child { background: #f1f5f9; font-weight: 600; width: 220px; color: #334155; }
                
                .finding-box { border: 1px solid #ddd; padding: 20px; margin-bottom: 15px; border-radius: 8px; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .finding-major { border-left: 5px solid #ef4444; background-color: #fef2f2; }
                .finding-minor { border-left: 5px solid #f59e0b; background-color: #fffbeb; }
                
                .capa-box { border: 1px solid #cbd5e1; padding: 18px; margin-bottom: 12px; border-radius: 8px; page-break-inside: avoid; background: #f8fafc; border-left: 4px solid #3b82f6; }
                
                .badge { padding: 5px 12px; border-radius: 12px; color: white; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
                .bg-red { background: #ef4444; }
                .bg-yellow { background: #f59e0b; color: #fff; }
                .bg-blue { background: #3b82f6; }
                .bg-green { background: #10b981; }
                
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                .progress-bar { width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden; margin: 10px 0; }
                .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.85rem; }

                .qr-header { position: absolute; top: 40px; right: 40px; text-align: center; }
                .qr-header img { width: 100px; height: 100px; border: 2px solid #e2e8f0; border-radius: 8px; }
                .qr-label { font-size: 10px; color: #666; margin-top: 5px; }
                
                .signature-section { margin-top: 60px; page-break-inside: avoid; }
                .signature-box { border: 2px solid #cbd5e1; padding: 20px; border-radius: 8px; background: #f8fafc; }
                .signature-line { border-top: 2px solid #334155; margin-top: 50px; padding-top: 8px; }

                @media print {
                    @page { margin: 2cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
                <button onclick="window.print()" style="padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 1rem;"><i class="fa-solid fa-print"></i> Print PDF</button>
            </div>

            <div class="report-container">
                <div class="qr-header">
                    <img src="${qrCodeUrl}" alt="Report QR">
                    <div class="qr-label">Scan to Verify</div>
                </div>

                <div class="cover-page">
                    <div class="logo"><i class="fa-solid fa-shield-halved" style="color: #2563eb;"></i> AuditCB360</div>
                    <div class="report-title">Audit Certification Report</div>
                    <div class="report-meta">
                        <p style="text-align: center; font-weight: 500; font-size: 1.3rem;">${report.client}</p>
                        <p style="text-align: center; font-size: 1.1rem;">${plan.standard || 'ISO Standard Audit'}</p>
                        <p style="text-align: center;">Audit Date: ${report.date}</p>
                        <p style="text-align: center; color: #64748b;">Report Generated: ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div style="margin-top: 2rem;">
                        <div style="font-size: 4.5rem; font-weight: 800; color: ${complianceScore > 80 ? '#10b981' : complianceScore > 60 ? '#f59e0b' : '#ef4444'}; line-height: 1;">
                            ${complianceScore}%
                        </div>
                        <div style="font-size: 1.2rem; color: #64748b; margin-top: 0.5rem;">Audit Compliance Score</div>
                    </div>
                </div>

                <h1>1. Audit Details</h1>
                <table class="meta-table">
                    <tr><td>Client Name</td><td>${report.client}</td></tr>
                    <tr><td>Audit Standard</td><td>${plan.standard || 'N/A'}</td></tr>
                    <tr><td>Audit Type</td><td>${plan.objectives || 'Certification Audit'}</td></tr>
                    <tr><td>Audit Scope</td><td>${plan.scope || 'Full organization'}</td></tr>
                    <tr><td>Audit Date</td><td>${report.date}</td></tr>
                    <tr><td>Report ID</td><td>REP-${report.id}</td></tr>
                    <tr><td>Lead Auditor</td><td>${leadAuditor?.name || 'Unknown'}</td></tr>
                    <tr><td>Audit Team</td><td>${auditTeam.map(a => a.name).join(', ') || 'N/A'}</td></tr>
                    <tr><td>Man-Days</td><td>${plan.manDays || 'N/A'}</td></tr>
                    <tr><td>Total Findings</td><td>${ncrCount} (Major: ${majorCount}, Minor: ${minorCount})</td></tr>
                    <tr><td>Report Status</td><td><strong>${report.status}</strong></td></tr>
                </table>

                <h1>2. Executive Summary</h1>
                <p><strong>Overview:</strong></p>
                <div style="margin-bottom: 2rem; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    ${(report.execSummary || 'Executive summary pending...').replace(/\n/g, '<br>')}
                </div>
                
                <h2>Checklist Completion Progress</h2>
                <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-weight: 600;">Overall Progress</span>
                        <span style="font-weight: 700; color: #3b82f6;">${progressPercent}% Complete</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%;">${totalItems > 0 ? `${conformCount}/${totalItems}` : '0/0'}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px;">
                        <div style="text-align: center; padding: 12px; background: #f0f9ff; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #0284c7;">${totalItems}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Total Items</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #ecfdf5; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #10b981;">${conformCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Conformities</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #fef2f2; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #ef4444;">${ncCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Non-Conformities</div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #f1f5f9; border-radius: 6px;">
                            <div style="font-size: 1.8rem; font-weight: 700; color: #64748b;">${naCount}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Not Applicable</div>
                        </div>
                    </div>
                </div>
                
                <h2>Audit Performance Analysis</h2>
                 <div class="chart-section">
                     <p>The following chart illustrates the distribution of findings and the overall compliance level observed during the audit.</p>
                     <div class="chart-container">
                        <div class="bar-group">
                            <span class="bar-val">${complianceScore}%</span>
                            <div class="bar" style="height: ${conformHeight}%; background: linear-gradient(to top, #059669, #10b981);"></div>
                            <span class="bar-label">Compliance</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${majorCount}</span>
                            <div class="bar" style="height: ${majorHeight}px; background: linear-gradient(to top, #dc2626, #ef4444);"></div>
                            <span class="bar-label">Major NCs</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${minorCount}</span>
                            <div class="bar" style="height: ${minorHeight}px; background: linear-gradient(to top, #d97706, #f59e0b);"></div>
                            <span class="bar-label">Minor NCs</span>
                        </div>
                        <div class="bar-group">
                            <span class="bar-val">${capaCount}</span>
                            <div class="bar" style="height: ${Math.min(100, capaCount * 20 + 10)}px; background: linear-gradient(to top, #2563eb, #3b82f6);"></div>
                            <span class="bar-label">CAPAs</span>
                        </div>
                    </div>
                </div>

                <h1>3. Strengths and Opportunities</h1>
                <div class="grid-2">
                    <div>
                        <h3><i class="fa-solid fa-thumbs-up" style="color: #10b981; margin-right: 8px;"></i> Key Strengths</h3>
                         <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border: 1px solid #a7f3d0;">
                            ${(report.strengths || report.positiveObservations || 'None recorded').replace(/\n/g, '<br>')}
                         </div>
                    </div>
                    <div>
                        <h3><i class="fa-solid fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i> Areas for Improvement</h3>
                         <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a;">
                            ${(report.improvements || report.ofi || 'None recorded').replace(/\n/g, '<br>')}
                         </div>
                    </div>
                </div>

                <h1>4. Detailed Findings and Evidence</h1>
                ${ncrCount === 0 ? '<p style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;"><i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i><strong>No non-conformities were raised during this audit.</strong> The management system was found to be in full compliance with the standard requirements.</p>' : ''}

                ${combinedNCRs.map((ncr, i) => `
                    <div class="finding-box ${ncr.type === 'major' ? 'finding-major' : 'finding-minor'}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <div style="font-weight: 700; font-size: 1.1rem;"><i class="fa-solid fa-exclamation-triangle" style="margin-right: 8px;"></i>Finding #${String(i + 1).padStart(3, '0')}</div>
                            <span class="badge ${ncr.type === 'major' ? 'bg-red' : 'bg-yellow'}">${ncr.type.toUpperCase()}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin-bottom: 8px;">
                            <div style="font-weight: 600; color: #555;">Clause Reference:</div>
                            <div><strong>${ncr.clause}</strong></div>
                            
                            <div style="font-weight: 600; color: #555;">Description:</div>
                            <div>${ncr.description}</div>
                            
                            <div style="font-weight: 600; color: #555;">Objective Evidence:</div>
                            <div style="font-style: italic; color: #4b5563;">${ncr.evidence || 'Evidence reviewed on-site during audit.'}</div>

                             ${ncr.transcript ? `
                                <div style="font-weight: 600; color: #555;">Audio Transcript:</div>
                                <div style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9rem; border-left: 3px solid #64748b;">
                                    <i class="fa-solid fa-microphone-lines" style="color: #64748b; margin-right: 5px;"></i> "${ncr.transcript}"
                                </div>
                            ` : ''}

                            ${ncr.evidenceImage ? `
                                <div style="font-weight: 600; color: #555;">Visual Evidence:</div>
                                <div>
                                    <img src="${ncr.evidenceImage}" alt="Captured Evidence" style="width: 150px; height: 150px; object-fit: cover; border: 2px solid #cbd5e1; border-radius: 6px; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;" onclick="window.open(this.src)">
                                </div>
                            ` : ''}
                            
                            <div style="font-weight: 600; color: #555;">Current Status:</div>
                            <div><span class="badge ${ncr.status === 'Closed' ? 'bg-green' : 'bg-yellow'}" style="font-size: 0.75rem;">${ncr.status}</span></div>
                        </div>
                    </div>
                `).join('')}

                ${capaCount > 0 ? `
                <h1>5. Corrective & Preventive Actions (CAPA)</h1>
                <p>The following corrective and preventive actions have been identified to address the non-conformities raised during the audit:</p>
                ${(report.capas || []).map((capa, i) => `
                    <div class="capa-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1;">
                            <div style="font-weight: 700; font-size: 1rem;"><i class="fa-solid fa-clipboard-check" style="color: #3b82f6; margin-right: 8px;"></i>CAPA #${String(i + 1).padStart(3, '0')}</div>
                            <span class="badge ${capa.status === 'Completed' ? 'bg-green' : 'bg-blue'}">${capa.status || 'In Progress'}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 10px;">
                            ${capa.linkedNCR ? `
                                <div style="font-weight: 600; color: #555;">Linked to:</div>
                                <div><strong>${capa.linkedNCR}</strong></div>
                            ` : ''}
                            
                            <div style="font-weight: 600; color: #555;">Root Cause:</div>
                            <div>${capa.rootCause || 'Not specified'}</div>
                            
                            <div style="font-weight: 600; color: #555;">Action Plan:</div>
                            <div>${capa.actionPlan || 'Not specified'}</div>
                            
                            ${capa.dueDate ? `
                                <div style="font-weight: 600; color: #555;">Due Date:</div>
                                <div>${capa.dueDate}</div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
                ` : ''}

                <h1>${capaCount > 0 ? '6' : '5'}. Observations</h1>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <h3 style="color: #10b981; margin-top: 0;"><i class="fa-solid fa-star" style="margin-right: 8px;"></i>Positive Observations</h3>
                    <div style="background: white; padding: 15px; border-radius: 6px;">
                        ${(report.positiveObservations || 'No specific positive observations recorded.').replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a;">
                    <h3 style="color: #f59e0b; margin-top: 0;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>Opportunities for Improvement (OFI)</h3>
                    <div style="background: white; padding: 15px; border-radius: 6px;">
                        ${(report.ofi || 'No opportunities for improvement identified.').replace(/\n/g, '<br>')}
                    </div>
                </div>

                <h1>${capaCount > 0 ? '7' : '6'}. Conclusion and Recommendation</h1>
                <p><strong>Auditor Conclusion:</strong></p>
                <div style="margin-bottom: 30px; background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;">
                    ${(report.conclusion || 'Conclusion pending finalization.').replace(/\n/g, '<br>')}
                </div>
                
                <div style="margin-top: 30px; padding: 25px; border: 3px solid ${report.recommendation === 'Recommend Certification' ? '#10b981' : report.recommendation === 'Do Not Recommend' ? '#ef4444' : '#f59e0b'}; background: ${report.recommendation === 'Recommend Certification' ? '#ecfdf5' : report.recommendation === 'Do Not Recommend' ? '#fef2f2' : '#fffbeb'}; text-align: center; border-radius: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">CERTIFICATION RECOMMENDATION</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: ${report.recommendation === 'Recommend Certification' ? '#10b981' : report.recommendation === 'Do Not Recommend' ? '#ef4444' : '#f59e0b'};">
                        ${report.recommendation || 'Recommendation Pending'}
                    </div>
                </div>

                <div class="signature-section">
                    <div class="signature-box">
                        <h2 style="margin-top: 0; color: #334155;"><i class="fa-solid fa-pen-fancy" style="margin-right: 8px;"></i>Audit Team Signatures</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Lead Auditor</div>
                                <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${leadAuditor?.name || 'Unknown'}</div>
                                <div class="signature-line">Signature & Date</div>
                            </div>
                            ${auditTeam.length > 1 ? `
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Team Member</div>
                                <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${auditTeam[1]?.name || 'N/A'}</div>
                                <div class="signature-line">Signature & Date</div>
                            </div>
                            ` : ''}
                        </div>
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">Client Representative</div>
                            <div style="font-size: 1.1rem; color: #3b82f6; margin-bottom: 5px;">${client.contacts?.[0]?.name || 'To be signed'}</div>
                            <div class="signature-line">Signature & Date</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 80px; text-align: center; color: #94a3b8; font-size: 0.8rem; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                    <p><strong>AuditCB360 Certification Platform</strong></p>
                    <p>Report ID: REP-${report.id} | Generated: ${new Date().toLocaleString()} | Version: ${report.finalizedAt ? '1.0 (Final)' : '0.1 (Draft)'}</p>
                    <p style="font-style: italic;">This is a computer-generated report. Signatures are required for official certification purposes.</p>
                </div>
            </div>
        </body>
        </html>
    `);
        printWindow.document.close();
        window.showNotification('Enhanced audit report generated successfully!', 'success');
    } catch (error) {
        console.error('Error generating audit report:', error);
        window.showNotification('Failed to generate report: ' + error.message, 'error');
    }
};

window.openCreateReportModal = openCreateReportModal;
window.openEditReportModal = openEditReportModal;

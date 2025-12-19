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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="execution-search" placeholder="Search by client..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                </div>
                <button class="btn btn-primary" onclick="window.openCreateReportModal()"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create Report</button>
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

    contentArea.innerHTML = html;

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

    contentArea.innerHTML = html;

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
                                 <div style="display: flex; align-items: flex-end;">
                                     <button class="btn btn-sm btn-outline-secondary" style="width: 100%; border-style: dashed;" onclick="document.getElementById('img-${uniqueId}').click()">
                                         <i class="fa-solid fa-camera"></i> Capture Evidence
                                     </button>
                                     <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" onchange="if(this.files.length) alert('Image selected (mock)')">
                                 </div>
                             </div>
                             <div style="position: relative;">
                                <textarea id="ncr-desc-${uniqueId}" class="form-control form-control-sm" rows="2" placeholder="Dictate/Type short description of NC and Evidence...">${saved.ncrDescription || ''}</textarea>
                                <button type="button" class="btn btn-sm btn-light" id="mic-btn-${uniqueId}" onclick="window.startDictation('${uniqueId}')" style="position: absolute; right: 5px; top: 5px; color: var(--primary-color); border: 1px solid #ddd;" title="Dictate (10s limit)">
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

            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Audit Summary & Conclusion</h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: var(--success-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Conformities</p>
                            <p style="font-size: 2rem; font-weight: 700;">${report.conformities || '-'}</p>
                        </div>
                        <div class="card" style="background: var(--warning-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Minor NCs</p>
                            <p style="font-size: 2rem; font-weight: 700;">${minorCount}</p>
                        </div>
                        <div class="card" style="background: var(--danger-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Major NCs</p>
                            <p style="font-size: 2rem; font-weight: 700;">${majorCount}</p>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Auditor Conclusion</h4>
                        <textarea id="conclusion" rows="6" placeholder="Enter overall audit conclusion and recommendation...">${report.conclusion || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Certification Recommendation</h4>
                        <select id="recommendation">
                            <option ${report.recommendation === 'Recommend Certification' ? 'selected' : ''}>Recommend Certification</option>
                            <option ${report.recommendation === 'Conditional Certification' ? 'selected' : ''}>Conditional Certification (pending closure of NCs)</option>
                            <option ${report.recommendation === 'Do Not Recommend' ? 'selected' : ''}>Do Not Recommend</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-primary" style="flex: 1;" onclick="finalizeReport(${report.id})">
                            <i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Finalize Report
                        </button>
                        <button class="btn btn-secondary">
                            <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Export PDF
                        </button>
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
        const ncrType = document.getElementById('ncr-type-' + uniqueId)?.value || '';

        // Only save if interacted with
        if (status || comment || ncrDesc) {
            checklistData.push({
                checklistId: input.dataset.checklist,
                itemIdx: input.dataset.item,
                isCustom: input.dataset.custom === 'true',
                status: status,
                comment: comment,
                ncrDescription: ncrDesc,
                ncrType: ncrType
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
    const textarea = document.getElementById('ncr-desc-' + uniqueId);

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
                </select>
            </div>
            <div class="form-group">
                <label>Clause/Requirement</label>
                <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3">
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="ncr-description" rows="3" placeholder="Describe the non-conformity..." required></textarea>
            </div>
            <div class="form-group">
                <label>Evidence / Objective Evidence</label>
                <textarea class="form-control" id="ncr-evidence" rows="2" placeholder="What evidence supports this finding?"></textarea>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const type = document.getElementById('ncr-type').value;
        const clause = document.getElementById('ncr-clause').value;
        const description = document.getElementById('ncr-description').value;
        const evidence = document.getElementById('ncr-evidence').value;

        if (description) {
            if (!report.ncrs) report.ncrs = [];
            report.ncrs.push({
                type,
                clause,
                description,
                evidence,
                status: 'Open',
                createdAt: new Date().toISOString()
            });
            report.findings = report.ncrs.length;

            window.saveData();
            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR created successfully');
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

function finalizeReport(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    report.conclusion = document.getElementById('conclusion')?.value || '';
    report.recommendation = document.getElementById('recommendation')?.value || '';
    report.status = 'Finalized';
    report.finalizedAt = new Date().toISOString();

    window.saveData();
    renderExecutionDetail(reportId);
    window.showNotification('Report finalized successfully');
}

// Export functions
window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
window.renderExecutionDetail = renderExecutionDetail;
window.updateChecklistStatus = updateChecklistStatus;
window.saveChecklist = saveChecklist;
window.createNCR = createNCR;
window.createCAPA = createCAPA;
// Generate Printable Report
window.generateAuditReport = function (reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    const plan = state.auditPlans.find(p => p.client === report.client) || {};
    const ncrCount = (report.ncrs || []).length;
    const majorCount = (report.ncrs || []).filter(n => n.type === 'major').length;

    // Build Checklist Rows (Only showing non-conformities or items with comments for brevity in main report, or full list)
    // Let's show full list but compact
    const checklistRows = (report.checklistProgress || []).map(item => {
        let statusLabel = item.status === 'conform' ? 'Conform' :
            item.status === 'minor' ? 'Minor NC' :
                item.status === 'major' ? 'Major NC' :
                    item.status === 'na' ? 'N/A' : '-';
        let statusColor = item.status === 'conform' ? 'green' :
            item.status === 'na' ? 'gray' : 'red';

        // Find clause/req if possible, we only stored ID/Index, so we might need lookups if we want full text.
        // For simplicity in this view, we'll assume we rely on the saved comment/status mostly or just skip details.
        // Better: Just listing significant items (NCs).
        return `
            <tr>
               <td>${item.isCustom ? 'Custom' : 'Clause Ref'}</td>
               <td style="color: ${statusColor}; font-weight: bold;">${statusLabel}</td>
               <td>${item.comment || ''}</td>
            </tr>
        `;
    }).join('');

    const ncrRows = (report.ncrs || []).map((ncr, i) => `
        <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <strong>NCR #${String(i + 1).padStart(3, '0')}</strong>
                <span style="color: red; font-weight: bold;">${ncr.type.toUpperCase()}</span>
            </div>
            <p><strong>Clause:</strong> ${ncr.clause}</p>
            <p><strong>Description:</strong> ${ncr.description}</p>
            <p><strong>Evidence:</strong> ${ncr.evidence || 'None provided'}</p>
            <p><strong>Status:</strong> ${ncr.status}</p>
        </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Audit Report - ${report.client}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 900px; margin: 0 auto; }
                h1, h2, h3 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                .header { text-align: center; margin-bottom: 40px; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .meta-table td { padding: 10px; border: 1px solid #ddd; }
                .meta-table td:first-child { background: #f9f9f9; font-weight: bold; width: 200px; }
                .summary-box { background: #f8f9fa; padding: 20px; border-left: 5px solid #0056b3; margin-bottom: 30px; }
                .badge { padding: 5px 10px; color: white; border-radius: 4px; font-size: 0.9em; }
                .bg-green { background-color: #28a745; }
                .bg-red { background-color: #dc3545; }
                .bg-yellow { background-color: #ffc107; color: black; }
                @media print {
                    button { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div style="text-align: right;">
                <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #0056b3; color: white; border: none; border-radius: 4px;">Print Report</button>
            </div>
            <div class="header">
                <h1>Audit Certification Report</h1>
                <p>Generated by AuditCB360 Platform</p>
            </div>

            <table class="meta-table">
                <tr><td>Client Name</td><td>${report.client}</td></tr>
                <tr><td>Audit Standard</td><td>${plan.standard || 'N/A'}</td></tr>
                <tr><td>Audit Date</td><td>${report.date}</td></tr>
                <tr><td>Report ID</td><td>REP-${report.id}</td></tr>
                <tr><td>Lead Auditor</td><td>${state.auditors.find(a => plan.auditors?.includes(a.id))?.name || 'Unknown'}</td></tr>
            </table>

            <h2>1. Executive Summary</h2>
            <div class="summary-box">
                <p><strong>Conclusion:</strong> ${report.conclusion || 'No conclusion recorded.'}</p>
                <p><strong>Recommendation:</strong> ${report.recommendation || 'Pending'}</p>
            </div>

            <h2>2. Findings Summary</h2>
            <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div style="flex: 1; padding: 20px; background: #e8f5e9; text-align: center; border-radius: 8px;">
                    <div style="font-size: 2em; color: #2e7d32; font-weight: bold;">${report.conformities || 0}</div>
                    <div>Conformities</div>
                </div>
                <div style="flex: 1; padding: 20px; background: #ffebee; text-align: center; border-radius: 8px;">
                    <div style="font-size: 2em; color: #c62828; font-weight: bold;">${ncrCount}</div>
                    <div>Non-Conformities</div>
                </div>
            </div>

            <h2>3. Non-Conformity Reports (NCRs)</h2>
            ${ncrRows || '<p>No non-conformities raised.</p>'}

            <h2>4. Audit Evidence Log</h2>
            <p><em>(Showing items with specific auditor comments or findings)</em></p>
            <table class="meta-table" style="font-size: 0.9em;">
                <thead>
                    <tr style="background: #eee;">
                        <th>Type</th>
                        <th>Status</th>
                        <th>Auditor Comments / Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${checklistRows}
                </tbody>
            </table>

            <div style="margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; display: flex; justify-content: space-between;">
                <div>
                    <p>_________________________</p>
                    <p>Lead Auditor Signature</p>
                </div>
                <div>
                    <p>_________________________</p>
                    <p>Client Representative</p>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.openCreateReportModal = openCreateReportModal;
window.openEditReportModal = openEditReportModal;

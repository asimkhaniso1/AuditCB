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

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditExecutionEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Reports
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">Audit Execution: ${report.client}</h2>
                        <p style="color: var(--text-secondary);">Audit Date: ${report.date} | Status: ${report.status}</p>
                    </div>
                    <button class="btn btn-primary">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Generate Report
                    </button>
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
            // Use dynamic checklists if assigned to the plan
            const plan = state.auditPlans.find(p => p.client === report.client);
            const planChecklists = plan?.selectedChecklists || [];
            const checklists = state.checklists || [];
            const assignedChecklists = planChecklists.map(clId => checklists.find(c => c.id === clId)).filter(c => c);

            // Create lookup for saved progress
            const progressMap = {};
            (report.checklistProgress || []).forEach(p => {
                progressMap[`${p.checklistId}-${p.itemIdx}`] = p;
            });

            const statusColors = {
                'conform': 'var(--success-color)',
                'minor': 'var(--warning-color)',
                'major': 'var(--danger-color)',
                'na': 'var(--secondary-color)'
            };

            let checklistHTML = '';

            if (assignedChecklists.length > 0) {
                // Render assigned checklists
                checklistHTML = assignedChecklists.map(checklist => `
                    <div class="card" style="margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <div>
                                <h4 style="margin: 0; color: var(--primary-color);">${checklist.name}</h4>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">${checklist.items?.length || 0} items • ${checklist.type === 'global' ? 'Global' : 'Custom'}</span>
                            </div>
                        </div>
                        ${(checklist.items || []).map((item, idx) => {
                    const key = `${checklist.id}-${idx}`;
                    const saved = progressMap[key] || {};
                    const s = saved.status || '';
                    const c = saved.comment || '';
                    const style = s ? `background: ${statusColors[s]}; color: white;` : '';

                    return `
                            <div style="padding: 0.75rem; border-left: 3px solid var(--border-color); margin-bottom: 0.5rem; background: #f8fafc;">
                                <div style="display: grid; grid-template-columns: 100px 2fr 150px 2fr; gap: 0.75rem; align-items: center;">
                                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary-color);">${item.clause || `${idx + 1}`}</div>
                                    <div style="font-size: 0.875rem;">${item.requirement || '-'}</div>
                                    <div>
                                        <select class="checklist-status" data-report="${report.id}" data-checklist="${checklist.id}" data-item="${idx}" style="margin-bottom: 0; font-size: 0.8rem; ${style}" onchange="updateChecklistStatus(this)">
                                            <option value="" ${s === '' ? 'selected' : ''}>Not Checked</option>
                                            <option value="conform" ${s === 'conform' ? 'selected' : ''}>✓ Conform</option>
                                            <option value="minor" ${s === 'minor' ? 'selected' : ''}>⚠ Minor NC</option>
                                            <option value="major" ${s === 'major' ? 'selected' : ''}>✗ Major NC</option>
                                            <option value="na" ${s === 'na' ? 'selected' : ''}>N/A</option>
                                        </select>
                                    </div>
                                    <div>
                                        <input type="text" class="checklist-comment" data-report="${report.id}" data-checklist="${checklist.id}" data-item="${idx}" value="${c}" placeholder="Evidence / Comments..." style="margin-bottom: 0; font-size: 0.8rem;">
                                    </div>
                                </div>
                            </div>
                            `;
                }).join('')}
                    </div>
                `).join('');
            } else {
                // Fallback to hardcoded ISO 9001 if no checklists assigned
                const iso9001Clauses = [
                    { number: '4', title: 'Context of the Organization', subclauses: ['4.1 Understanding the organization', '4.2 Understanding stakeholders', '4.3 Scope of QMS', '4.4 QMS and processes'] },
                    { number: '5', title: 'Leadership', subclauses: ['5.1 Leadership and commitment', '5.2 Policy', '5.3 Roles and responsibilities'] },
                    { number: '6', title: 'Planning', subclauses: ['6.1 Risk and opportunities', '6.2 Quality objectives', '6.3 Planning of changes'] },
                    { number: '7', title: 'Support', subclauses: ['7.1 Resources', '7.2 Competence', '7.3 Awareness', '7.4 Communication', '7.5 Documented information'] },
                    { number: '8', title: 'Operation', subclauses: ['8.1 Operational planning', '8.2 Customer requirements', '8.3 Design and development', '8.4 External providers', '8.5 Production', '8.6 Release of products', '8.7 Nonconformity control'] },
                    { number: '9', title: 'Performance Evaluation', subclauses: ['9.1 Monitoring and measurement', '9.2 Internal audit', '9.3 Management review'] },
                    { number: '10', title: 'Improvement', subclauses: ['10.1 General', '10.2 Nonconformity and corrective action', '10.3 Continual improvement'] }
                ];

                checklistHTML = `
                    <div style="background: #fef3c7; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <p style="margin: 0; color: #d97706;"><i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>No checklists assigned to this audit plan. Using default ISO 9001 template. <a href="#" onclick="window.renderModule('audit-planning')">Assign checklists</a></p>
                    </div>
                ` + iso9001Clauses.map(clause => `
                    <div class="card" style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="color: var(--primary-color);">Clause ${clause.number}: ${clause.title}</h4>
                        </div>
                        ${clause.subclauses.map((sub, idx) => `
                            <div style="padding: 0.75rem; border-left: 3px solid var(--border-color); margin-bottom: 0.5rem; background: #f8fafc;">
                                <div style="display: grid; grid-template-columns: 2fr 1fr 3fr; gap: 1rem; align-items: center;">
                                    <div style="font-size: 0.875rem; font-weight: 500;">${sub}</div>
                                    <div>
                                        <select style="margin-bottom: 0; font-size: 0.875rem;" onchange="updateChecklistStatus(this)">
                                            <option value="">Not Checked</option>
                                            <option value="conform">✓ Conform</option>
                                            <option value="minor">⚠ Minor NC</option>
                                            <option value="major">✗ Major NC</option>
                                            <option value="na">N/A</option>
                                        </select>
                                    </div>
                                    <div>
                                        <input type="text" placeholder="Comments / Evidence..." style="margin-bottom: 0; font-size: 0.875rem;">
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('');
            }

            tabContent.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>${assignedChecklists.length > 0 ? 'Audit Checklists' : 'ISO 9001:2015 Audit Checklist'}</h3>
                        <button class="btn btn-primary" onclick="saveChecklist(${report.id})">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                        </button>
                    </div>
                    ${checklistHTML}
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
function updateChecklistStatus(selectEl) {
    const status = selectEl.value;
    const statusColors = {
        'conform': 'var(--success-color)',
        'minor': 'var(--warning-color)',
        'major': 'var(--danger-color)',
        'na': 'var(--secondary-color)'
    };
    if (status) {
        selectEl.style.background = statusColors[status] || '';
        selectEl.style.color = '#fff';
    } else {
        selectEl.style.background = '';
        selectEl.style.color = '';
    }
}

function saveChecklist(reportId) {
    const report = state.auditReports.find(r => r.id === reportId);
    if (!report) return;

    // Collect all checklist statuses and comments
    const checklistData = [];
    document.querySelectorAll('.checklist-status').forEach(select => {
        const checklistId = select.getAttribute('data-checklist');
        const itemIdx = select.getAttribute('data-item');
        const status = select.value;
        const commentInput = document.querySelector(`.checklist-comment[data-checklist="${checklistId}"][data-item="${itemIdx}"]`);
        const comment = commentInput?.value || '';

        if (status || comment) {
            checklistData.push({ checklistId, itemIdx, status, comment });
        }
    });

    report.checklistProgress = checklistData;
    window.saveData();
    window.showNotification('Checklist progress saved successfully');
}

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
window.openCreateReportModal = openCreateReportModal;
window.openEditReportModal = openEditReportModal;

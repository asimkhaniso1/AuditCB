// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs
// ============================================

function renderAuditExecutionEnhanced() {
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
                <button class="btn btn-primary"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create Report</button>
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
            const reportId = parseInt(el.getAttribute('data-report-id'));
            renderExecutionDetail(reportId);
        });
    });
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
            const iso9001Clauses = [
                { number: '4', title: 'Context of the Organization', subclauses: ['4.1 Understanding the organization', '4.2 Understanding stakeholders', '4.3 Scope of QMS', '4.4 QMS and processes'] },
                { number: '5', title: 'Leadership', subclauses: ['5.1 Leadership and commitment', '5.2 Policy', '5.3 Roles and responsibilities'] },
                { number: '6', title: 'Planning', subclauses: ['6.1 Risk and opportunities', '6.2 Quality objectives', '6.3 Planning of changes'] },
                { number: '7', title: 'Support', subclauses: ['7.1 Resources', '7.2 Competence', '7.3 Awareness', '7.4 Communication', '7.5 Documented information'] },
                { number: '8', title: 'Operation', subclauses: ['8.1 Operational planning', '8.2 Customer requirements', '8.3 Design and development', '8.4 External providers', '8.5 Production', '8.6 Release of products', '8.7 Nonconformity control'] },
                { number: '9', title: 'Performance Evaluation', subclauses: ['9.1 Monitoring and measurement', '9.2 Internal audit', '9.3 Management review'] },
                { number: '10', title: 'Improvement', subclauses: ['10.1 General', '10.2 Nonconformity and corrective action', '10.3 Continual improvement'] }
            ];

            const checklistHTML = iso9001Clauses.map(clause => `
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

            tabContent.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>ISO 9001:2015 Audit Checklist</h3>
                        <button class="btn btn-primary" onclick="saveChecklist()">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                        </button>
                    </div>
                    ${checklistHTML}
                </div>
            `;
            break;

        case 'ncr':
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Non-Conformity Reports (NCRs)</h3>
                        <button class="btn btn-primary" onclick="createNCR()">
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
                                <tr>
                                    <td>NCR-001</td>
                                    <td><span style="background: var(--danger-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Major</span></td>
                                    <td>8.3</td>
                                    <td>Design validation not documented</td>
                                    <td><span style="background: var(--warning-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Open</span></td>
                                    <td><button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button></td>
                                </tr>
                                <tr>
                                    <td>NCR-002</td>
                                    <td><span style="background: var(--warning-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Minor</span></td>
                                    <td>7.2</td>
                                    <td>Incomplete training records</td>
                                    <td><span style="background: var(--warning-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Open</span></td>
                                    <td><button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;

        case 'capa':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Corrective & Preventive Actions (CAPA)</h3>
                    
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
                                <tr>
                                    <td>CAPA-001</td>
                                    <td>NCR-001</td>
                                    <td>Lack of procedure</td>
                                    <td>Create design validation SOP</td>
                                    <td>2024-01-15</td>
                                    <td><span style="background: var(--warning-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">In Progress</span></td>
                                </tr>
                                <tr>
                                    <td>CAPA-002</td>
                                    <td>NCR-002</td>
                                    <td>Training system gap</td>
                                    <td>Update training matrix</td>
                                    <td>2024-01-10</td>
                                    <td><span style="background: var(--success-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Completed</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="createCAPA()">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create CAPA
                    </button>
                </div>
            `;
            break;

        case 'observations':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Observations & Recommendations</h3>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Positive Observations</h4>
                        <textarea rows="4" placeholder="Document good practices and positive findings..."></textarea>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Opportunities for Improvement</h4>
                        <textarea rows="4" placeholder="Suggestions for improvement (not non-conformities)..."></textarea>
                    </div>

                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Evidence Collected</h4>
                        <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 2px dashed var(--border-color); text-align: center;">
                            <i class="fa-solid fa-upload" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
                            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Drag & drop files or click to upload</p>
                            <button class="btn btn-secondary">Browse Files</button>
                        </div>
                    </div>

                    <button class="btn btn-primary" style="margin-top: 1.5rem;">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Observations
                    </button>
                </div>
            `;
            break;

        case 'summary':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Audit Summary & Conclusion</h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: var(--success-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Conformities</p>
                            <p style="font-size: 2rem; font-weight: 700;">25</p>
                        </div>
                        <div class="card" style="background: var(--warning-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Minor NCs</p>
                            <p style="font-size: 2rem; font-weight: 700;">1</p>
                        </div>
                        <div class="card" style="background: var(--danger-color); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Major NCs</p>
                            <p style="font-size: 2rem; font-weight: 700;">1</p>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Auditor Conclusion</h4>
                        <textarea rows="6" placeholder="Enter overall audit conclusion and recommendation..."></textarea>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Certification Recommendation</h4>
                        <select>
                            <option>Recommend Certification</option>
                            <option>Conditional Certification (pending closure of NCs)</option>
                            <option>Do Not Recommend</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-primary" style="flex: 1;">
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

function saveChecklist() {
    alert('Checklist saved successfully!');
}

function createNCR() {
    alert('NCR creation form will open here.');
}

function createCAPA() {
    alert('CAPA creation form will open here.');
}

// Export functions
window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
window.renderExecutionDetail = renderExecutionDetail;
window.updateChecklistStatus = updateChecklistStatus;
window.saveChecklist = saveChecklist;
window.createNCR = createNCR;
window.createCAPA = createCAPA;

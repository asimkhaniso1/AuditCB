// ============================================
// INTERNAL AUDIT MODULE
// ISO 17021-1 Clause 8.6
// ============================================

// Initialize state
if (!window.state.internalAudits) {
    window.state.internalAudits = {
        schedule: [
            {
                id: 1,
                processArea: 'Certification Decision Process',
                clause: '7.6',
                auditor: 'Quality Manager',
                plannedDate: '2024-03-15',
                actualDate: '2024-03-18',
                status: 'Completed',
                findings: [1]
            },
            {
                id: 2,
                processArea: 'Auditor Competence Management',
                clause: '6.1',
                auditor: 'External Auditor',
                plannedDate: '2024-06-15',
                actualDate: null,
                status: 'Scheduled',
                findings: []
            },
            {
                id: 3,
                processArea: 'Impartiality Management',
                clause: '5.2',
                auditor: 'Quality Manager',
                plannedDate: '2024-09-15',
                actualDate: null,
                status: 'Planned',
                findings: []
            }
        ],
        findings: [
            {
                id: 1,
                auditId: 1,
                type: 'Minor NC',
                description: 'Certification decision checklist not always completed before issuing certificates',
                clause: '7.6.2',
                rootCause: 'Process documentation unclear on required steps',
                capaId: 1,
                status: 'Closed',
                raisedDate: '2024-03-18',
                closedDate: '2024-04-15'
            }
        ],
        capaLog: [
            {
                id: 1,
                findingId: 1,
                type: 'Corrective',
                action: 'Revise certification decision procedure to include mandatory checklist completion',
                responsible: 'Certification Manager',
                dueDate: '2024-04-15',
                completedDate: '2024-04-10',
                status: 'Completed',
                verification: 'Sampled 5 recent decisions - all checklists completed',
                verifiedBy: 'Quality Manager',
                verifiedDate: '2024-04-12'
            }
        ]
    };
}

function renderInternalAuditModule() {
    const contentArea = document.getElementById('content-area');
    const data = window.state.internalAudits;

    const scheduled = data.schedule.filter(a => a.status === 'Scheduled' || a.status === 'Planned').length;
    const completed = data.schedule.filter(a => a.status === 'Completed').length;
    const openFindings = data.findings.filter(f => f.status !== 'Closed').length;
    const openCapa = data.capaLog.filter(c => c.status !== 'Completed').length;

    contentArea.innerHTML = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem; color: #059669;"></i>
                        Internal Audit
                    </h2>
                    <p style="color: var(--text-secondary); margin: 0;">ISO 17021-1 Clause 8.6 - CB Internal Audit Programme</p>
                </div>
                <button class="btn btn-primary" onclick="window.openNewInternalAuditModal()">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>Schedule Audit
                </button>
            </div>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="text-align: center; padding: 1rem; border-left: 4px solid #0284c7;">
                    <p style="font-size: 2rem; font-weight: 700; color: #0284c7; margin: 0;">${scheduled}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Audits Scheduled</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem; border-left: 4px solid #059669;">
                    <p style="font-size: 2rem; font-weight: 700; color: #059669; margin: 0;">${completed}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Audits Completed</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem; border-left: 4px solid #f59e0b;">
                    <p style="font-size: 2rem; font-weight: 700; color: #f59e0b; margin: 0;">${openFindings}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Open Findings</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem; border-left: 4px solid #dc2626;">
                    <p style="font-size: 2rem; font-weight: 700; color: #dc2626; margin: 0;">${openCapa}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Open CAPA</p>
                </div>
            </div>

            <!-- Tabs -->
            <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" onclick="switchInternalAuditTab(this, 'audit-schedule')">Audit Schedule</button>
                <button class="tab-btn" onclick="switchInternalAuditTab(this, 'findings-tab')">Findings (${data.findings.length})</button>
                <button class="tab-btn" onclick="switchInternalAuditTab(this, 'capa-tab')">CAPA Log (${data.capaLog.length})</button>
            </div>

            <!-- Tab: Audit Schedule -->
            <div id="audit-schedule" class="internal-audit-tab-content">
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Process Area</th>
                                    <th>ISO Clause</th>
                                    <th>Auditor</th>
                                    <th>Planned Date</th>
                                    <th>Actual Date</th>
                                    <th>Status</th>
                                    <th>Findings</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.schedule.map(audit => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(audit.processArea)}</strong></td>
                                        <td>${window.UTILS.escapeHtml(audit.clause)}</td>
                                        <td>${window.UTILS.escapeHtml(audit.auditor)}</td>
                                        <td>${window.UTILS.escapeHtml(audit.plannedDate)}</td>
                                        <td>${audit.actualDate || '-'}</td>
                                        <td>
                                            <span class="badge ${audit.status === 'Completed' ? 'bg-green' : audit.status === 'Scheduled' ? 'bg-blue' : 'bg-gray'}">
                                                ${window.UTILS.escapeHtml(audit.status)}
                                            </span>
                                        </td>
                                        <td>${audit.findings.length}</td>
                                        <td>
                                            ${audit.status === 'Completed' ? `
                                                <button class="btn btn-sm btn-icon" onclick="viewInternalAudit(${audit.id})" title="View Report">
                                                    <i class="fa-solid fa-eye"></i>
                                                </button>
                                            ` : `
                                                <button class="btn btn-sm btn-success" onclick="conductInternalAudit(${audit.id})" title="Conduct Audit">
                                                    <i class="fa-solid fa-play"></i>
                                                </button>
                                            `}
                                            <button class="btn btn-sm btn-icon" onclick="addFindingToAudit(${audit.id})" title="Add Finding">
                                                <i class="fa-solid fa-plus"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab: Findings -->
            <div id="findings-tab" class="internal-audit-tab-content" style="display: none;">
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Clause</th>
                                    <th>Raised</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.findings.map(f => `
                                    <tr>
                                        <td>F-${f.id}</td>
                                        <td>
                                            <span class="badge ${f.type === 'Major NC' ? 'bg-red' : f.type === 'Minor NC' ? 'bg-orange' : 'bg-blue'}">
                                                ${window.UTILS.escapeHtml(f.type)}
                                            </span>
                                        </td>
                                        <td style="max-width: 300px;">${window.UTILS.escapeHtml(f.description)}</td>
                                        <td>${window.UTILS.escapeHtml(f.clause)}</td>
                                        <td>${window.UTILS.escapeHtml(f.raisedDate)}</td>
                                        <td>
                                            <span class="badge ${f.status === 'Closed' ? 'bg-green' : 'bg-red'}">
                                                ${window.UTILS.escapeHtml(f.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-icon" onclick="viewFinding(${f.id})" title="View">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                            ${!f.capaId ? `
                                                <button class="btn btn-sm btn-primary" onclick="createCapaForFinding(${f.id})" title="Create CAPA">
                                                    <i class="fa-solid fa-wrench"></i>
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab: CAPA Log -->
            <div id="capa-tab" class="internal-audit-tab-content" style="display: none;">
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Action</th>
                                    <th>Responsible</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Verification</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.capaLog.map(c => `
                                    <tr>
                                        <td>CAPA-${c.id}</td>
                                        <td>
                                            <span class="badge ${c.type === 'Corrective' ? 'bg-orange' : 'bg-blue'}">
                                                ${window.UTILS.escapeHtml(c.type)}
                                            </span>
                                        </td>
                                        <td style="max-width: 300px;">${window.UTILS.escapeHtml(c.action)}</td>
                                        <td>${window.UTILS.escapeHtml(c.responsible)}</td>
                                        <td>${window.UTILS.escapeHtml(c.dueDate)}</td>
                                        <td>
                                            <span class="badge ${c.status === 'Completed' ? 'bg-green' : c.status === 'In Progress' ? 'bg-blue' : 'bg-gray'}">
                                                ${window.UTILS.escapeHtml(c.status)}
                                            </span>
                                        </td>
                                        <td>
                                            ${c.verifiedDate ? `
                                                <i class="fa-solid fa-check-circle" style="color: green;" title="Verified by ${c.verifiedBy} on ${c.verifiedDate}"></i>
                                            ` : `
                                                <i class="fa-solid fa-clock" style="color: orange;" title="Pending verification"></i>
                                            `}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ISO Reference -->
            <div style="margin-top: 1.5rem; padding: 1rem; background: #ecfdf5; border-left: 4px solid #059669; border-radius: 4px;">
                <h4 style="margin: 0 0 0.5rem 0; color: #047857;">
                    <i class="fa-solid fa-book" style="margin-right: 0.5rem;"></i>ISO 17021-1 Clause 8.6 Requirements
                </h4>
                <p style="margin: 0; font-size: 0.85rem; color: #065f46;">
                    The CB shall conduct internal audits at planned intervals to evaluate conformity with ISO 17021-1, 
                    relevant accreditation requirements, and the CB's own management system. Auditors shall not audit 
                    their own work. Internal audit results shall be input to management review.
                </p>
            </div>
        </div>
    `;
}

window.switchInternalAuditTab = function (btn, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.internal-audit-tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById(tabId).style.display = 'block';
};

window.openNewInternalAuditModal = function () {
    const processAreas = [
        'Certification Decision Process (7.6)',
        'Auditor Competence Management (6.1)',
        'Impartiality Management (5.2)',
        'Appeals & Complaints (9.10, 9.11)',
        'Document Control (8.3)',
        'Record Retention (8.4)',
        'Management Review (8.5)',
        'Client Scope Review (7.2)'
    ];

    document.getElementById('modal-title').textContent = 'Schedule Internal Audit';
    document.getElementById('modal-body').innerHTML = `
        <form id="internal-audit-form">
            <div class="form-group">
                <label>Process Area <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="audit-process" required>
                    <option value="">-- Select --</option>
                    ${processAreas.map(p => `<option value="${window.UTILS.escapeHtml(p)}">${window.UTILS.escapeHtml(p)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Auditor <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="audit-auditor" required placeholder="e.g., Quality Manager">
            </div>
            <div class="form-group">
                <label>Planned Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="audit-date" required>
            </div>
            <div class="form-group">
                <label>Audit Scope/Objectives</label>
                <textarea class="form-control" id="audit-scope" rows="3" placeholder="Define scope and objectives..."></textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const processArea = document.getElementById('audit-process').value;
        const auditor = document.getElementById('audit-auditor').value.trim();
        const plannedDate = document.getElementById('audit-date').value;

        if (!processArea || !auditor || !plannedDate) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const clauseMatch = processArea.match(/\(([^)]+)\)/);
        const clause = clauseMatch ? clauseMatch[1] : '';

        const newAudit = {
            id: Date.now(),
            processArea: processArea.replace(/\s*\([^)]+\)/, ''),
            clause,
            auditor,
            plannedDate,
            actualDate: null,
            status: 'Scheduled',
            findings: []
        };

        window.state.internalAudits.schedule.push(newAudit);
        window.saveData();
        window.closeModal();
        renderInternalAuditModule();
        window.showNotification('Internal audit scheduled successfully', 'success');
    };

    window.openModal();
};

window.addFindingToAudit = function (auditId) {
    document.getElementById('modal-title').textContent = 'Add Finding';
    document.getElementById('modal-body').innerHTML = `
        <form id="finding-form">
            <div class="form-group">
                <label>Finding Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="finding-type" required>
                    <option value="Major NC">Major Nonconformity</option>
                    <option value="Minor NC">Minor Nonconformity</option>
                    <option value="Observation">Observation</option>
                    <option value="OFI">Opportunity for Improvement</option>
                </select>
            </div>
            <div class="form-group">
                <label>ISO Clause Reference</label>
                <input type="text" class="form-control" id="finding-clause" placeholder="e.g., 7.6.2">
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="finding-description" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Root Cause (if known)</label>
                <textarea class="form-control" id="finding-root-cause" rows="2"></textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const type = document.getElementById('finding-type').value;
        const description = document.getElementById('finding-description').value.trim();

        if (!description) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const newFinding = {
            id: Date.now(),
            auditId,
            type,
            description,
            clause: document.getElementById('finding-clause').value,
            rootCause: document.getElementById('finding-root-cause').value,
            capaId: null,
            status: 'Open',
            raisedDate: new Date().toISOString().split('T')[0],
            closedDate: null
        };

        window.state.internalAudits.findings.push(newFinding);

        // Link to audit
        const audit = window.state.internalAudits.schedule.find(a => a.id === auditId);
        if (audit) audit.findings.push(newFinding.id);

        window.saveData();
        window.closeModal();
        renderInternalAuditModule();
        window.showNotification('Finding added successfully', 'success');
    };

    window.openModal();
};

window.createCapaForFinding = function (findingId) {
    const finding = window.state.internalAudits.findings.find(f => f.id === findingId);
    if (!finding) return;

    document.getElementById('modal-title').textContent = 'Create CAPA';
    document.getElementById('modal-body').innerHTML = `
        <div style="background: #fef3c7; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.9rem;">
            <strong>Finding:</strong> ${window.UTILS.escapeHtml(finding.description)}
        </div>
        <form id="capa-form">
            <div class="form-group">
                <label>Action Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="capa-type" required>
                    <option value="Corrective">Corrective Action</option>
                    <option value="Preventive">Preventive Action</option>
                </select>
            </div>
            <div class="form-group">
                <label>Action Required <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-action" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Responsible Person <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="capa-responsible" required>
            </div>
            <div class="form-group">
                <label>Due Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="capa-due" required>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const action = document.getElementById('capa-action').value.trim();
        const responsible = document.getElementById('capa-responsible').value.trim();
        const dueDate = document.getElementById('capa-due').value;

        if (!action || !responsible || !dueDate) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const newCapa = {
            id: Date.now(),
            findingId,
            type: document.getElementById('capa-type').value,
            action,
            responsible,
            dueDate,
            completedDate: null,
            status: 'Open',
            verification: null,
            verifiedBy: null,
            verifiedDate: null
        };

        window.state.internalAudits.capaLog.push(newCapa);
        finding.capaId = newCapa.id;

        window.saveData();
        window.closeModal();
        renderInternalAuditModule();
        window.showNotification('CAPA created successfully', 'success');
    };

    window.openModal();
};

window.conductInternalAudit = function (auditId) {
    const audit = window.state.internalAudits.schedule.find(a => a.id === auditId);
    if (!audit) return;

    audit.actualDate = new Date().toISOString().split('T')[0];
    audit.status = 'Completed';
    window.saveData();
    renderInternalAuditModule();
    window.showNotification('Audit marked as completed', 'success');
};

window.viewFinding = function (findingId) {
    const finding = window.state.internalAudits.findings.find(f => f.id === findingId);
    if (!finding) return;

    const capa = finding.capaId ? window.state.internalAudits.capaLog.find(c => c.id === finding.capaId) : null;

    document.getElementById('modal-title').textContent = `Finding F-${finding.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="display: grid; gap: 1rem;">
            <div>
                <strong>Type:</strong> 
                <span class="badge ${finding.type === 'Major NC' ? 'bg-red' : finding.type === 'Minor NC' ? 'bg-orange' : 'bg-blue'}">
                    ${window.UTILS.escapeHtml(finding.type)}
                </span>
            </div>
            <div><strong>Clause:</strong> ${window.UTILS.escapeHtml(finding.clause || 'N/A')}</div>
            <div><strong>Description:</strong><br>${window.UTILS.escapeHtml(finding.description)}</div>
            <div><strong>Root Cause:</strong><br>${window.UTILS.escapeHtml(finding.rootCause || 'Not identified')}</div>
            <div><strong>Status:</strong> <span class="badge ${finding.status === 'Closed' ? 'bg-green' : 'bg-red'}">${finding.status}</span></div>
            ${capa ? `
                <hr>
                <div><strong>CAPA-${capa.id}:</strong> ${window.UTILS.escapeHtml(capa.action)}</div>
                <div><strong>Responsible:</strong> ${window.UTILS.escapeHtml(capa.responsible)} | <strong>Due:</strong> ${window.UTILS.escapeHtml(capa.dueDate)}</div>
                <div><strong>CAPA Status:</strong> <span class="badge ${capa.status === 'Completed' ? 'bg-green' : 'bg-orange'}">${capa.status}</span></div>
            ` : ''}
        </div>
    `;
    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

// ============================================
// NCR-CAPA MODULE - DUAL LEVEL (Client & CB)
// ISO 17021-1 Clause 9.9 & 8.7
// ============================================

// Initialize NCR-CAPA data if not present
if (!window.state.ncrs) {
    window.state.ncrs = [
        {
            id: 1,
            level: 'client',
            clientId: 1,
            clientName: 'Tech Solutions Ltd',
            auditId: 1,
            source: 'Stage 2 Audit',
            standard: 'ISO 9001:2015',
            clause: '8.5.2',
            severity: 'Minor',
            description: 'Production records for batch #2024-03 incomplete - missing operator signatures',
            raisedBy: 'John Smith',
            raisedDate: '2024-02-15',
            dueDate: '2024-03-17',
            status: 'Closed',
            correction: 'All missing signatures obtained and records updated',
            correctionDate: '2024-02-20',
            rootCause: 'Operators not aware of signature requirement after shift change',
            correctiveAction: 'Updated training procedure to include signature requirements; added checklist',
            capaResponsible: 'Production Manager',
            capaImplementedDate: '2024-03-10',
            verificationMethod: 'Review of 10 subsequent batch records',
            verifiedBy: 'John Smith',
            verifiedDate: '2024-03-15',
            effectiveness: 'Effective',
            evidence: ['Updated procedure v2.1', 'Training records', 'Sample batch records']
        },
        {
            id: 2,
            level: 'client',
            clientId: 2,
            clientName: 'Global Manufacturing',
            auditId: 2,
            source: 'Surveillance Audit',
            standard: 'ISO 14001:2015',
            clause: '6.1.2',
            severity: 'Major',
            description: 'Environmental aspects register not updated for new chemical storage area',
            raisedBy: 'Sarah Johnson',
            raisedDate: '2024-03-10',
            dueDate: '2024-06-08',
            status: 'In Progress',
            correction: 'Immediate risk assessment completed for chemical storage',
            correctionDate: '2024-03-12',
            rootCause: '',
            correctiveAction: 'Implementing quarterly review process for environmental aspects',
            capaResponsible: 'EHS Manager',
            capaImplementedDate: null,
            verificationMethod: 'Review updated register and quarterly review records',
            verifiedBy: null,
            verifiedDate: null,
            effectiveness: 'Pending',
            evidence: ['Risk assessment report']
        },
        {
            id: 3,
            level: 'cb-internal',
            clientId: 999,
            clientName: 'AuditCB360 - Internal Operations',
            auditId: null,
            source: 'Internal Audit',
            standard: 'ISO 17021-1:2015',
            clause: '6.1.2',
            severity: 'Minor',
            description: 'Auditor competence records missing for 2 technical experts hired in Q4 2023',
            raisedBy: 'Quality Manager',
            raisedDate: '2024-01-20',
            dueDate: '2024-02-19',
            status: 'Closed',
            correction: 'Competence records created and filed for both technical experts',
            correctionDate: '2024-01-25',
            rootCause: 'HR onboarding checklist did not include competence documentation requirement',
            correctiveAction: 'Updated HR onboarding checklist; Quality Manager to review all new hires',
            capaResponsible: 'HR Manager',
            capaImplementedDate: '2024-02-10',
            verificationMethod: 'Review updated checklist and 3 subsequent new hire records',
            verifiedBy: 'Quality Manager',
            verifiedDate: '2024-02-18',
            effectiveness: 'Effective',
            evidence: ['Updated HR checklist v3.0', 'Competence records']
        },
        {
            id: 4,
            level: 'client',
            clientId: 1,
            clientName: 'Tech Solutions Ltd',
            auditId: 1,
            source: 'Stage 2 Audit',
            standard: 'ISO 9001:2015',
            clause: '9.2',
            severity: 'Major',
            description: 'Internal audit program not effectively implemented. Audit schedule for 2024 not available.',
            raisedBy: 'John Smith',
            raisedDate: '2024-03-20',
            dueDate: '2024-04-20',
            status: 'Open',
            correction: '2024 Audit Schedule drafted immediately',
            correctionDate: '2024-03-22',
            rootCause: '',
            correctiveAction: '',
            capaResponsible: 'Quality Manager',
            capaImplementedDate: null,
            verificationMethod: '',
            verifiedBy: null,
            verifiedDate: null,
            effectiveness: 'Pending',
            evidence: []
        }
    ];
}

// Initialize CAPA analytics
if (!window.state.capaAnalytics) {
    window.state.capaAnalytics = {
        totalNCRs: 0,
        openNCRs: 0,
        overdueNCRs: 0,
        effectivenessRate: 0,
        avgClosureTime: 0
    };
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================

function renderNCRCAPAModule(clientId) {
    // Store context for tab switching and sub-functions
    window.state.ncrContextClientId = clientId || null;

    // Determine title based on context
    let title = "NCR & CAPA Management";
    if (clientId) {
        const client = window.state.clients?.find(c => c.id === clientId);
        if (client) title = `${client.name} - NCR & CAPA`;
    }

    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <div class="tab-container" style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                    <button class="tab-btn active" onclick="switchNCRTab('register', this)">NCR Register</button>
                    <button class="tab-btn" onclick="switchNCRTab('capa', this)">CAPA Tracker</button>
                    <button class="tab-btn" onclick="switchNCRTab('verification', this)">Verification</button>
                    <button class="tab-btn" onclick="switchNCRTab('analytics', this)">Analytics</button>
                </div>

                <div id="ncr-content">
                    ${getNCRRegisterHTML()}
                </div>
            </div>
        </div>
    `;
    window.contentArea.innerHTML = html;
    updateNCRAnalytics();
}

function switchNCRTab(tabName, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    const container = document.getElementById('ncr-content');
    switch (tabName) {
        case 'register': container.innerHTML = getNCRRegisterHTML(); break;
        case 'capa': container.innerHTML = getCAPATrackerHTML(); break;
        case 'verification': container.innerHTML = getVerificationHTML(); break;
        case 'analytics': container.innerHTML = getAnalyticsHTML(); break;
    }
}

// ============================================
// TAB 1: NCR REGISTER
// ============================================

function getNCRRegisterHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => n.clientId === window.state.ncrContextClientId);
    }

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem;"></i>
                    NCR Register
                </h3>
                <button class="btn btn-primary" onclick="openNewNCRModal()">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                    New NCR
                </button>
            </div>

            <!-- Filters -->
            <div class="card" style="background: #f8fafc; padding: 1rem; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Level</label>
                        <select class="form-control" id="filter-level" onchange="filterNCRs()" style="font-size: 0.9rem;">
                            <option value="all">All NCRs</option>
                            <option value="client">Client NCRs</option>
                            <option value="cb-internal">CB Internal</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Client</label>
                        <select class="form-control" id="filter-client" onchange="filterNCRs()" style="font-size: 0.9rem;">
                            <option value="all">All Clients</option>
                            ${[...new Set(ncrs.map(n => n.clientName))].map(name =>
        `<option value="${window.UTILS.escapeHtml(name)}">${window.UTILS.escapeHtml(name)}</option>`
    ).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Severity</label>
                        <select class="form-control" id="filter-severity" onchange="filterNCRs()" style="font-size: 0.9rem;">
                            <option value="all">All Severities</option>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Observation">Observation</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Status</label>
                        <select class="form-control" id="filter-status" onchange="filterNCRs()" style="font-size: 0.9rem;">
                            <option value="all">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Verification">Verification</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Search</label>
                        <input type="text" class="form-control" id="filter-search" placeholder="Search..." onkeyup="filterNCRs()" style="font-size: 0.9rem;">
                    </div>
                </div>
            </div>

            <!-- NCR Table -->
            <div class="table-container" id="ncr-table-container">
                ${renderNCRTable(ncrs)}
            </div>
        </div>
    `;
}

function renderNCRTable(ncrs) {
    if (ncrs.length === 0) {
        return `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No NCRs found</p>`;
    }

    const today = new Date();

    return `
        <table>
            <thead>
                <tr>
                    <th>NCR#</th>
                    <th>Level</th>
                    <th>Client</th>
                    <th>Clause</th>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${ncrs.map(ncr => {
        const dueDate = new Date(ncr.dueDate);
        const isOverdue = ncr.status !== 'Closed' && dueDate < today;
        const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

        return `
                        <tr style="${isOverdue ? 'background: #fef2f2;' : ''}">
                            <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                            <td>
                                <span class="badge" style="background: ${ncr.level === 'client' ? '#0284c7' : '#7c3aed'}; color: white; font-size: 0.75rem;">
                                    ${ncr.level === 'client' ? 'Client' : 'CB Internal'}
                                </span>
                            </td>
                            <td>${window.UTILS.escapeHtml(ncr.clientName)}</td>
                            <td><span class="badge bg-gray">${window.UTILS.escapeHtml(ncr.clause)}</span></td>
                            <td>
                                <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : ncr.severity === 'Minor' ? '#f59e0b' : '#3b82f6'}; color: white;">
                                    ${ncr.severity}
                                </span>
                            </td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${window.UTILS.escapeHtml(ncr.description)}
                            </td>
                            <td>
                                ${ncr.dueDate}
                                ${isOverdue ? '<br><span style="color: #dc2626; font-size: 0.75rem; font-weight: bold;">⚠️ OVERDUE</span>' :
                daysDiff <= 7 && ncr.status !== 'Closed' ? '<br><span style="color: #f59e0b; font-size: 0.75rem;">⏰ Due Soon</span>' : ''}
                            </td>
                            <td>
                                <span class="badge" style="background: ${ncr.status === 'Closed' ? '#059669' :
                ncr.status === 'Verification' ? '#0284c7' :
                    ncr.status === 'In Progress' ? '#f59e0b' : '#6b7280'
            }; color: white;">
                                    ${ncr.status}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-icon" onclick="viewNCRDetails(${ncr.id})" title="View Details">
                                    <i class="fa-solid fa-eye" style="color: var(--primary-color);"></i>
                                </button>
                                <button class="btn btn-sm btn-icon" onclick="editNCR(${ncr.id})" title="Edit">
                                    <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                </button>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

function filterNCRs() {
    const level = document.getElementById('filter-level').value;
    const client = document.getElementById('filter-client').value;
    const severity = document.getElementById('filter-severity').value;
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();

    let filtered = window.state.ncrs.filter(ncr => {
        // Context Filter
        if (window.state.ncrContextClientId && ncr.clientId !== window.state.ncrContextClientId) return false;

        if (level !== 'all' && ncr.level !== level) return false;
        if (client !== 'all' && ncr.clientName !== client) return false;
        if (severity !== 'all' && ncr.severity !== severity) return false;
        if (status !== 'all' && ncr.status !== status) return false;
        if (search && !ncr.description.toLowerCase().includes(search) &&
            !ncr.clause.toLowerCase().includes(search) &&
            !ncr.clientName.toLowerCase().includes(search)) return false;
        return true;
    });

    document.getElementById('ncr-table-container').innerHTML = renderNCRTable(filtered);
}

// ============================================
// TAB 2: CAPA TRACKER
// ============================================

function getCAPATrackerHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => n.clientId === window.state.ncrContextClientId);
    }
    const showClosed = window.state.showClosedCAPAs || false;
    if (!showClosed) {
        ncrs = ncrs.filter(n => n.status !== 'Closed');
    }

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-tasks" style="margin-right: 0.5rem;"></i>
                    CAPA Tracker
                </h3>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <label style="font-size: 0.9rem; user-select: none; cursor: pointer;">
                        <input type="checkbox" onchange="window.state.showClosedCAPAs = this.checked; renderNCRCAPAModule(window.state.ncrContextClientId);" ${showClosed ? 'checked' : ''}>
                        Show Closed Items
                    </label>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>NCR#</th>
                            <th>Client</th>
                            <th>Severity</th>
                            <th>Root Cause</th>
                            <th>Corrective Action</th>
                            <th>Responsible</th>
                            <th>Target Date</th>
                            <th>Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ncrs.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName)}</td>
                                <td>
                                    <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : '#f59e0b'}; color: white;">
                                        ${ncr.severity}
                                    </span>
                                </td>
                                <td style="max-width: 200px;">${window.UTILS.escapeHtml(ncr.rootCause || 'Pending analysis')}</td>
                                <td style="max-width: 250px;">${window.UTILS.escapeHtml(ncr.correctiveAction || 'Not yet defined')}</td>
                                <td>${window.UTILS.escapeHtml(ncr.capaResponsible || 'Not assigned')}</td>
                                <td>${ncr.dueDate}</td>
                                <td>
                                    <button class="btn btn-sm" onclick="updateCAPAProgress(${ncr.id})">
                                        <i class="fa-solid fa-edit"></i> Update
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ============================================
// TAB 3: VERIFICATION
// ============================================

function getVerificationHTML() {
    let allNcrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        allNcrs = allNcrs.filter(n => n.clientId === window.state.ncrContextClientId);
    }
    const ncrs = allNcrs.filter(n => n.status === 'Verification' || (n.capaImplementedDate && !n.verifiedDate));

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i>
                CAPA Verification Pending
            </h3>

            ${ncrs.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No CAPAs pending verification</p>' : `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>NCR#</th>
                            <th>Client</th>
                            <th>Corrective Action</th>
                            <th>Implemented Date</th>
                            <th>Verification Method</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ncrs.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName)}</td>
                                <td style="max-width: 300px;">${window.UTILS.escapeHtml(ncr.correctiveAction)}</td>
                                <td>${ncr.capaImplementedDate || 'Not yet implemented'}</td>
                                <td>${window.UTILS.escapeHtml(ncr.verificationMethod)}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="verifyCAPA(${ncr.id})">
                                        <i class="fa-solid fa-check"></i> Verify
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    `;
}

// ============================================
// TAB 4: ANALYTICS
// ============================================

function getAnalyticsHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => n.clientId === window.state.ncrContextClientId);
    }
    const total = ncrs.length;
    const open = ncrs.filter(n => n.status !== 'Closed').length;
    const today = new Date();
    const overdue = ncrs.filter(n => n.status !== 'Closed' && new Date(n.dueDate) < today).length;
    const effective = ncrs.filter(n => n.effectiveness === 'Effective').length;
    const effectivenessRate = total > 0 ? Math.round((effective / total) * 100) : 0;

    // NCRs by severity
    const major = ncrs.filter(n => n.severity === 'Major').length;
    const minor = ncrs.filter(n => n.severity === 'Minor').length;
    const obs = ncrs.filter(n => n.severity === 'Observation').length;

    // NCRs by level
    const clientNCRs = ncrs.filter(n => n.level === 'client').length;
    const cbNCRs = ncrs.filter(n => n.level === 'cb-internal').length;

    // Top clauses
    const clauseCounts = {};
    ncrs.forEach(n => {
        clauseCounts[n.clause] = (clauseCounts[n.clause] || 0) + 1;
    });
    const topClauses = Object.entries(clauseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                NCR-CAPA Analytics
            </h3>

            <!-- KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border: none;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">${total}</div>
                    <div style="opacity: 0.9;">Total NCRs</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border: none;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">${open}</div>
                    <div style="opacity: 0.9;">Open NCRs</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1.5rem; border: none;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">${overdue}</div>
                    <div style="opacity: 0.9;">Overdue</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 1.5rem; border: none;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">${effectivenessRate}%</div>
                    <div style="opacity: 0.9;">Effectiveness Rate</div>
                </div>
            </div>

            <!-- Charts -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- By Severity -->
                <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color);">
                    <h4 style="margin-bottom: 1rem; color: #374151;">NCRs by Severity</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <span>Major</span>
                                <span style="font-weight: bold;">${major}</span>
                            </div>
                            <div style="background: #fee2e2; height: 8px; border-radius: 4px;">
                                <div style="background: #dc2626; height: 100%; width: ${total > 0 ? (major / total * 100) : 0}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <span>Minor</span>
                                <span style="font-weight: bold;">${minor}</span>
                            </div>
                            <div style="background: #fef3c7; height: 8px; border-radius: 4px;">
                                <div style="background: #f59e0b; height: 100%; width: ${total > 0 ? (minor / total * 100) : 0}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <span>Observation</span>
                                <span style="font-weight: bold;">${obs}</span>
                            </div>
                            <div style="background: #dbeafe; height: 8px; border-radius: 4px;">
                                <div style="background: #3b82f6; height: 100%; width: ${total > 0 ? (obs / total * 100) : 0}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- By Level -->
                <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color);">
                    <h4 style="margin-bottom: 1rem; color: #374151;">NCRs by Level</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <span>Client NCRs</span>
                                <span style="font-weight: bold;">${clientNCRs}</span>
                            </div>
                            <div style="background: #dbeafe; height: 8px; border-radius: 4px;">
                                <div style="background: #0284c7; height: 100%; width: ${total > 0 ? (clientNCRs / total * 100) : 0}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                                <span>CB Internal</span>
                                <span style="font-weight: bold;">${cbNCRs}</span>
                            </div>
                            <div style="background: #f3e8ff; height: 8px; border-radius: 4px;">
                                <div style="background: #7c3aed; height: 100%; width: ${total > 0 ? (cbNCRs / total * 100) : 0}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Clauses -->
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 1rem; color: #374151;">Top 5 Non-Conforming Clauses</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Clause</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topClauses.map(([clause, count]) => `
                                <tr>
                                    <td><span class="badge bg-gray">${window.UTILS.escapeHtml(clause)}</span></td>
                                    <td><strong>${count}</strong></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <div style="flex: 1; background: #e5e7eb; height: 8px; border-radius: 4px;">
                                                <div style="background: var(--primary-color); height: 100%; width: ${(count / total * 100)}%; border-radius: 4px;"></div>
                                            </div>
                                            <span>${Math.round(count / total * 100)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function updateNCRAnalytics() {
    const ncrs = window.state.ncrs;
    const today = new Date();

    window.state.capaAnalytics = {
        totalNCRs: ncrs.length,
        openNCRs: ncrs.filter(n => n.status !== 'Closed').length,
        overdueNCRs: ncrs.filter(n => n.status !== 'Closed' && new Date(n.dueDate) < today).length,
        effectivenessRate: ncrs.length > 0 ? Math.round((ncrs.filter(n => n.effectiveness === 'Effective').length / ncrs.length) * 100) : 0,
        avgClosureTime: 0 // Calculate if needed
    };
}

window.openNewNCRModal = function () {
    const contextClientId = window.state.ncrContextClientId || window.state.activeClientId;

    document.getElementById('modal-title').textContent = 'Create New NCR';
    document.getElementById('modal-body').innerHTML = `
        <form id="ncr-form">
            <div class="form-group">
                <label>Level <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-level" onchange="toggleClientSelect()" required>
                    <option value="client">Client NCR</option>
                    <option value="cb-internal" ${contextClientId ? 'disabled' : ''}>CB Internal NCR</option>
                </select>
            </div>
            <div class="form-group" id="client-select-group">
                <label>Client <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-client" required ${contextClientId ? 'disabled' : ''}>
                    <option value="">Select Client...</option>
                    ${window.state.clients.map(c => `<option value="${c.id}" ${c.id === contextClientId ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Source <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-source" required>
                    <option value="Stage 1 Audit">Stage 1 Audit</option>
                    <option value="Stage 2 Audit">Stage 2 Audit</option>
                    <option value="Surveillance Audit">Surveillance Audit</option>
                    <option value="Recertification Audit">Recertification Audit</option>
                    <option value="Internal Audit">Internal Audit</option>
                    <option value="Management Review">Management Review</option>
                    <option value="AB Surveillance">AB Surveillance</option>
                </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Standard <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="ncr-standard" placeholder="e.g., ISO 9001:2015" required>
                </div>
                <div class="form-group">
                    <label>Clause <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="ncr-clause" placeholder="e.g., 8.5.2" required>
                </div>
            </div>
            <div class="form-group">
                <label>Severity <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-severity" required>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                    <option value="Observation">Observation/OFI</option>
                </select>
            </div>
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label>Description <span style="color: var(--danger-color);">*</span></label>
                    <button type="button" class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;" onclick="window.generateNewNCRFinding()">
                        <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.25rem;"></i>AI Generate
                    </button>
                </div>
                <textarea class="form-control" id="ncr-description" rows="3" required></textarea>
                <small style="color: var(--text-secondary);">AI will generate professional finding based on standard/clause</small>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Raised By</label>
                    <input type="text" class="form-control" id="ncr-raised-by" value="${window.state.currentUser.name}">
                </div>
                <div class="form-group">
                    <label>Due Date <span style="color: var(--danger-color);">*</span></label>
                    <input type="date" class="form-control" id="ncr-due-date" required>
                </div>
            </div>
        </form>
    `;

    // Set default due date based on severity
    document.getElementById('ncr-severity').addEventListener('change', function () {
        const severity = this.value;
        const today = new Date();
        const dueDate = new Date(today);

        if (severity === 'Major') {
            dueDate.setDate(today.getDate() + (window.state.cbPolicies?.capaTimelines?.majorCorrection || 90));
        } else if (severity === 'Minor') {
            dueDate.setDate(today.getDate() + (window.state.cbPolicies?.capaTimelines?.minorCorrection || 30));
        }

        document.getElementById('ncr-due-date').value = dueDate.toISOString().split('T')[0];
    });

    // Trigger initial due date calculation
    document.getElementById('ncr-severity').dispatchEvent(new Event('change'));

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = saveNewNCR;
    window.openModal();
};

function toggleClientSelect() {
    const level = document.getElementById('ncr-level').value;
    const clientGroup = document.getElementById('client-select-group');

    if (level === 'cb-internal') {
        clientGroup.style.display = 'none';
        document.getElementById('ncr-client').required = false;
    } else {
        clientGroup.style.display = 'block';
        document.getElementById('ncr-client').required = true;
    }
}

function saveNewNCR() {
    const level = document.getElementById('ncr-level').value;
    let clientId, clientName;

    if (level === 'client') {
        clientId = parseInt(document.getElementById('ncr-client').value);
        const client = window.state.clients.find(c => c.id === clientId);
        clientName = client ? client.name : '';
    } else {
        clientId = 999;
        clientName = 'AuditCB360 - Internal Operations';
    }

    const newNCR = {
        id: Math.max(...window.state.ncrs.map(n => n.id), 0) + 1,
        level: level,
        clientId: clientId,
        clientName: clientName,
        auditId: null,
        source: window.Sanitizer.sanitizeText(document.getElementById('ncr-source').value),
        standard: window.Sanitizer.sanitizeText(document.getElementById('ncr-standard').value),
        clause: window.Sanitizer.sanitizeText(document.getElementById('ncr-clause').value),
        severity: document.getElementById('ncr-severity').value,
        description: window.Sanitizer.sanitizeText(document.getElementById('ncr-description').value),
        raisedBy: window.Sanitizer.sanitizeText(document.getElementById('ncr-raised-by').value),
        raisedDate: new Date().toISOString().split('T')[0],
        dueDate: document.getElementById('ncr-due-date').value,
        status: 'Open',
        correction: '',
        correctionDate: null,
        rootCause: '',
        correctiveAction: '',
        capaResponsible: '',
        capaImplementedDate: null,
        verificationMethod: '',
        verifiedBy: null,
        verifiedDate: null,
        effectiveness: 'Pending',
        evidence: []
    };

    window.state.ncrs.push(newNCR);
    window.saveData();
    window.closeModal();
    renderNCRCAPAModule();
    window.showNotification('NCR created successfully', 'success');
}

window.viewNCRDetails = function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `NCR-${String(ncrId).padStart(3, '0')} Details`;
    document.getElementById('modal-body').innerHTML = `
        <div style="max-height: 70vh; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <strong>Level:</strong>
                    <span class="badge" style="background: ${ncr.level === 'client' ? '#0284c7' : '#7c3aed'}; color: white; margin-left: 0.5rem;">
                        ${ncr.level === 'client' ? 'Client' : 'CB Internal'}
                    </span>
                </div>
                <div><strong>Client:</strong> ${window.UTILS.escapeHtml(ncr.clientName)}</div>
                <div><strong>Source:</strong> ${window.UTILS.escapeHtml(ncr.source)}</div>
                <div><strong>Standard:</strong> ${window.UTILS.escapeHtml(ncr.standard)}</div>
                <div><strong>Clause:</strong> <span class="badge bg-gray">${window.UTILS.escapeHtml(ncr.clause)}</span></div>
                <div>
                    <strong>Severity:</strong>
                    <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : ncr.severity === 'Minor' ? '#f59e0b' : '#3b82f6'}; color: white; margin-left: 0.5rem;">
                        ${ncr.severity}
                    </span>
                </div>
                <div><strong>Raised By:</strong> ${window.UTILS.escapeHtml(ncr.raisedBy)}</div>
                <div><strong>Raised Date:</strong> ${ncr.raisedDate}</div>
                <div><strong>Due Date:</strong> ${ncr.dueDate}</div>
                <div>
                    <strong>Status:</strong>
                    <span class="badge" style="background: ${ncr.status === 'Closed' ? '#059669' : ncr.status === 'Verification' ? '#0284c7' : ncr.status === 'In Progress' ? '#f59e0b' : '#6b7280'}; color: white; margin-left: 0.5rem;">
                        ${ncr.status}
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Description:</strong>
                <p style="margin: 0.5rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 4px;">${window.UTILS.escapeHtml(ncr.description)}</p>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Correction (Immediate Fix):</strong>
                <p style="margin: 0.5rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 4px;">${window.UTILS.escapeHtml(ncr.correction || 'Not yet provided')}</p>
                ${ncr.correctionDate ? `<small>Corrected on: ${ncr.correctionDate}</small>` : ''}
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Root Cause Analysis:</strong>
                <p style="margin: 0.5rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 4px;">${window.UTILS.escapeHtml(ncr.rootCause || 'Not yet analyzed')}</p>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Corrective Action (Prevent Recurrence):</strong>
                <p style="margin: 0.5rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 4px;">${window.UTILS.escapeHtml(ncr.correctiveAction || 'Not yet defined')}</p>
                ${ncr.capaResponsible ? `<small>Responsible: ${window.UTILS.escapeHtml(ncr.capaResponsible)}</small>` : ''}
                ${ncr.capaImplementedDate ? `<br><small>Implemented: ${ncr.capaImplementedDate}</small>` : ''}
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Verification:</strong>
                <p style="margin: 0.5rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 4px;">${window.UTILS.escapeHtml(ncr.verificationMethod || 'Not yet defined')}</p>
                ${ncr.verifiedBy ? `<small>Verified by: ${window.UTILS.escapeHtml(ncr.verifiedBy)} on ${ncr.verifiedDate}</small>` : ''}
                ${ncr.effectiveness ? `<br><span class="badge" style="background: ${ncr.effectiveness === 'Effective' ? '#059669' : '#6b7280'}; color: white;">${ncr.effectiveness}</span>` : ''}
            </div>
            
            ${ncr.evidence && ncr.evidence.length > 0 ? `
                <div>
                    <strong>Evidence:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                        ${ncr.evidence.map(e => `<li>${window.UTILS.escapeHtml(e)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.editNCR = function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `Edit NCR-${String(ncrId).padStart(3, '0')}`;
    document.getElementById('modal-body').innerHTML = `
        <form id="edit-ncr-form">
            <div class="card" style="margin-bottom: 1rem; padding: 0.75rem; background: #f8fafc; border: 1px solid var(--border-color);">
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    <strong>Client:</strong> ${window.UTILS.escapeHtml(ncr.clientName)} <br>
                    <strong>Source:</strong> ${window.UTILS.escapeHtml(ncr.source)}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Standard <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="edit-ncr-standard" value="${window.UTILS.escapeHtml(ncr.standard)}" required>
                </div>
                <div class="form-group">
                    <label>Clause <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="edit-ncr-clause" value="${window.UTILS.escapeHtml(ncr.clause)}" required>
                </div>
            </div>
            
            <div class="form-group">
                <label>Severity <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="edit-ncr-severity" required>
                    <option value="Major" ${ncr.severity === 'Major' ? 'selected' : ''}>Major</option>
                    <option value="Minor" ${ncr.severity === 'Minor' ? 'selected' : ''}>Minor</option>
                    <option value="Observation" ${ncr.severity === 'Observation' ? 'selected' : ''}>Observation/OFI</option>
                </select>
            </div>
            
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label>Description <span style="color: var(--danger-color);">*</span></label>
                    <button type="button" class="btn btn-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;" onclick="window.generateNCRFinding(${ncrId})">
                        <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.25rem;"></i>AI Generate
                    </button>
                </div>
                <textarea class="form-control" id="edit-ncr-description" rows="3" required>${window.UTILS.escapeHtml(ncr.description)}</textarea>
                <small style="color: var(--text-secondary);">AI will reference uploaded standards from Knowledge Base</small>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Raised By</label>
                    <input type="text" class="form-control" id="edit-ncr-raised-by" value="${window.UTILS.escapeHtml(ncr.raisedBy)}">
                </div>
                <div class="form-group">
                    <label>Due Date <span style="color: var(--danger-color);">*</span></label>
                    <input type="date" class="form-control" id="edit-ncr-due-date" value="${ncr.dueDate}" required>
                </div>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const standard = document.getElementById('edit-ncr-standard').value;
        const clause = document.getElementById('edit-ncr-clause').value;
        const description = document.getElementById('edit-ncr-description').value;

        if (!standard || !clause || !description) {
            window.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Update NCR object
        ncr.standard = window.Sanitizer.sanitizeText(standard);
        ncr.clause = window.Sanitizer.sanitizeText(clause);
        ncr.severity = document.getElementById('edit-ncr-severity').value;
        ncr.description = window.Sanitizer.sanitizeText(description);
        ncr.raisedBy = window.Sanitizer.sanitizeText(document.getElementById('edit-ncr-raised-by').value);
        ncr.dueDate = document.getElementById('edit-ncr-due-date').value;

        window.saveData();
        window.closeModal();
        renderNCRCAPAModule(window.state.ncrContextClientId);
        window.showNotification('NCR updated successfully', 'success');
    };

    window.openModal();
};

window.updateCAPAProgress = function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `Update CAPA Progress - NCR-${String(ncrId).padStart(3, '0')}`;
    document.getElementById('modal-body').innerHTML = `
        <form id="capa-form">
            <div class="form-group">
                <label>Correction (Immediate Action)</label>
                <textarea class="form-control" id="capa-correction" rows="2" placeholder="Action taken to fix the immediate problem">${window.UTILS.escapeHtml(ncr.correction || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Root Cause Analysis</label>
                <textarea class="form-control" id="capa-root-cause" rows="3" placeholder="Why did this occur?">${window.UTILS.escapeHtml(ncr.rootCause || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Corrective Action (Long-term Solution)</label>
                <textarea class="form-control" id="capa-action" rows="3" placeholder="Action taken to prevent recurrence">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Responsible Person</label>
                <input type="text" class="form-control" id="capa-responsible" value="${window.UTILS.escapeHtml(ncr.capaResponsible || '')}">
            </div>
            <div class="form-group">
                <label>Implementation Date</label>
                <input type="date" class="form-control" id="capa-implemented" value="${ncr.capaImplementedDate || ''}">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="capa-status">
                    <option value="Open" ${ncr.status === 'Open' ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${ncr.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Verification" ${ncr.status === 'Verification' ? 'selected' : ''}>Ready for Verification</option>
                </select>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        ncr.correction = window.Sanitizer.sanitizeText(document.getElementById('capa-correction').value);
        ncr.rootCause = window.Sanitizer.sanitizeText(document.getElementById('capa-root-cause').value);
        ncr.correctiveAction = window.Sanitizer.sanitizeText(document.getElementById('capa-action').value);
        ncr.capaResponsible = window.Sanitizer.sanitizeText(document.getElementById('capa-responsible').value);
        ncr.capaImplementedDate = document.getElementById('capa-implemented').value;
        ncr.status = document.getElementById('capa-status').value;

        window.saveData();
        window.closeModal();
        renderNCRCAPAModule();
        window.showNotification('CAPA progress updated', 'success');
    };

    window.openModal();
};

window.verifyCAPA = function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `Verify CAPA - NCR-${String(ncrId).padStart(3, '0')}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #059669; border-radius: 4px;">
            <strong>Corrective Action:</strong>
            <p style="margin: 0.5rem 0 0 0;">${window.UTILS.escapeHtml(ncr.correctiveAction)}</p>
        </div>
        
        <form id="verify-form">
            <div class="form-group">
                <label>Verification Method Used</label>
                <textarea class="form-control" id="verify-method" rows="2">${window.UTILS.escapeHtml(ncr.verificationMethod || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Effectiveness <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="verify-effectiveness" required>
                    <option value="">Select...</option>
                    <option value="Effective">Effective - No recurrence, system improved</option>
                    <option value="Not Effective">Not Effective - Issue persists or recurred</option>
                    <option value="Partially Effective">Partially Effective - Some improvement but needs refinement</option>
                </select>
            </div>
            <div class="form-group">
                <label>Verification Notes</label>
                <textarea class="form-control" id="verify-notes" rows="3" placeholder="Evidence reviewed, observations..."></textarea>
            </div>
            <div class="form-group">
                <label>Verified By</label>
                <input type="text" class="form-control" id="verify-by" value="${window.state.currentUser.name}">
            </div>
            <div class="form-group">
                <label>Verification Date</label>
                <input type="date" class="form-control" id="verify-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const effectiveness = document.getElementById('verify-effectiveness').value;
        if (!effectiveness) {
            window.showNotification('Please select effectiveness rating', 'error');
            return;
        }

        ncr.verificationMethod = window.Sanitizer.sanitizeText(document.getElementById('verify-method').value);
        ncr.effectiveness = effectiveness;
        ncr.verifiedBy = window.Sanitizer.sanitizeText(document.getElementById('verify-by').value);
        ncr.verifiedDate = document.getElementById('verify-date').value;
        ncr.status = effectiveness === 'Effective' ? 'Closed' : 'In Progress';

        const notes = document.getElementById('verify-notes').value;
        if (notes) {
            if (!ncr.evidence) ncr.evidence = [];
            ncr.evidence.push(`Verification notes: ${window.Sanitizer.sanitizeText(notes)}`);
        }

        window.saveData();
        window.closeModal();
        renderNCRCAPAModule();
        window.showNotification(`CAPA verified as ${effectiveness}`, 'success');
    };

    window.openModal();
};

// ============================================
// AI GENERATE NCR FINDING
// ============================================
window.generateNCRFinding = async function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    const standard = document.getElementById('edit-ncr-standard')?.value || ncr.standard;
    const clause = document.getElementById('edit-ncr-clause')?.value || ncr.clause;
    const severity = document.getElementById('edit-ncr-severity')?.value || ncr.severity;
    const currentDesc = document.getElementById('edit-ncr-description')?.value || '';

    // Check if Knowledge Base has standards
    const kb = window.state.knowledgeBase || { standards: [] };
    const hasStandards = kb.standards.length > 0;

    // Show loading state
    const descField = document.getElementById('edit-ncr-description');
    const originalValue = descField.value;
    descField.value = 'Generating finding with AI...';
    descField.disabled = true;

    try {
        // Build prompt
        const prompt = `You are an ISO certification auditor. Generate a professional NCR (Non-Conformance Report) finding description.

Standard: ${standard}
Clause: ${clause}
Severity: ${severity}
${currentDesc ? `Auditor's Notes: ${currentDesc}` : ''}

Requirements:
1. Start with what was observed (objective evidence)
2. Reference the specific clause requirement that was not met
3. Be factual, not opinion-based
4. Use professional audit language
5. Keep it concise (2-3 sentences max)

Generate only the finding description, no headers or labels.`;

        // Call Gemini API via proxy
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                context: hasStandards ? `Knowledge Base contains: ${kb.standards.map(s => s.name).join(', ')}` : ''
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const generatedText = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (generatedText) {
            descField.value = generatedText.trim();
            window.showNotification('Finding generated - please review and edit as needed', 'success');
        } else {
            throw new Error('No response from AI');
        }
    } catch (error) {
        console.error('AI Generation Error:', error);
        descField.value = originalValue;

        // Fallback: Generate template locally
        const fallbackText = `During the audit of ${standard}, Clause ${clause}, it was observed that [DESCRIBE OBJECTIVE EVIDENCE]. This does not conform to the requirement of Clause ${clause} which requires [STATE THE REQUIREMENT]. This has been classified as a ${severity} non-conformance.`;

        descField.value = fallbackText;
        window.showNotification('AI unavailable - template provided. Please complete the finding.', 'warning');
    } finally {
        descField.disabled = false;
        descField.focus();
    }
};

// AI Generate for NEW NCR (uses form fields instead of existing NCR)
window.generateNewNCRFinding = async function () {
    const standard = document.getElementById('ncr-standard')?.value || '';
    const clause = document.getElementById('ncr-clause')?.value || '';
    const severity = document.getElementById('ncr-severity')?.value || 'Minor';
    const currentDesc = document.getElementById('ncr-description')?.value || '';

    if (!standard || !clause) {
        window.showNotification('Please enter Standard and Clause first', 'warning');
        return;
    }

    const kb = window.state.knowledgeBase || { standards: [] };
    const hasStandards = kb.standards.length > 0;

    const descField = document.getElementById('ncr-description');
    const originalValue = descField.value;
    descField.value = 'Generating finding with AI...';
    descField.disabled = true;

    try {
        const prompt = `You are an ISO certification auditor. Generate a professional NCR (Non-Conformance Report) finding description.

Standard: ${standard}
Clause: ${clause}
Severity: ${severity}
${currentDesc ? `Auditor's Notes: ${currentDesc}` : ''}

Requirements:
1. Start with what was observed (objective evidence)
2. Reference the specific clause requirement that was not met
3. Be factual, not opinion-based
4. Use professional audit language
5. Keep it concise (2-3 sentences max)

Generate only the finding description, no headers or labels.`;

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                context: hasStandards ? `Knowledge Base contains: ${kb.standards.map(s => s.name).join(', ')}` : ''
            })
        });

        if (!response.ok) throw new Error('API request failed');

        const data = await response.json();
        const generatedText = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (generatedText) {
            descField.value = generatedText.trim();
            window.showNotification('Finding generated - please review and edit', 'success');
        } else {
            throw new Error('No response');
        }
    } catch (error) {
        console.error('AI Error:', error);
        descField.value = `During the audit of ${standard}, Clause ${clause}, it was observed that [DESCRIBE OBJECTIVE EVIDENCE]. This does not conform to Clause ${clause} which requires [STATE THE REQUIREMENT]. Classified as ${severity}.`;
        window.showNotification('AI unavailable - template provided', 'warning');
    } finally {
        descField.disabled = false;
        descField.focus();
    }
};

// Export main render function
window.renderNCRCAPAModule = renderNCRCAPAModule;
window.switchNCRTab = switchNCRTab;

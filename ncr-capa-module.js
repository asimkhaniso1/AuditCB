// ============================================
// NCR-CAPA MODULE - DUAL LEVEL (Client & CB)
// ISO 17021-1 Clause 9.9 & 8.7
// ============================================

// Initialize NCR-CAPA state
if (!window.state.ncrs) {
    window.state.ncrs = [];
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

// --------------------------------------------
// DATA SYNCHRONIZATION (Supabase)
// --------------------------------------------

// Fetch NCRs from Supabase
window.fetchNCRs = async function () {
    if (!window.SupabaseClient) return;

    try {
        const { data, error } = await window.SupabaseClient
            .from('audit_ncrs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map DB snake_case to app camelCase
        window.state.ncrs = (data || []).map(row => ({
            id: row.id,
            clientId: row.client_id,
            auditId: row.audit_id,
            // audit_id is the FK to audit_plans – no separate audit_plan_id column
            level: row.level,
            clientName: row.client_name,
            source: row.source,
            standard: row.standard,
            clause: row.clause,
            severity: row.severity,
            description: row.description,
            raisedBy: row.raised_by,
            raisedDate: row.raised_date,
            dueDate: row.due_date,
            status: row.status,
            correction: row.correction,
            correctionDate: row.correction_date,
            rootCause: row.root_cause,
            correctiveAction: row.corrective_action,
            capaResponsible: row.capa_responsible,
            capaImplementedDate: row.capa_implemented_date,
            verificationMethod: row.verification_method,
            verifiedBy: row.verified_by,
            verifiedDate: row.verified_date,
            effectiveness: row.effectiveness,
            evidence: row.evidence || []
        }));

        updateNCRAnalytics();

        // Refresh view if active
        if (document.getElementById('ncr-content') || window.contentArea.innerHTML.includes('Loading NCRs')) {
            renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        }

    } catch (err) {
        console.error('Error fetching NCRs:', err);
        // Fallback to empty or local cache if we had one
    }
};

// Persist Insert or Update to Supabase
async function persistNCR(ncr) {
    if (!window.SupabaseClient) return;

    // Helper: coerce empty/falsy to null for DATE and FK columns
    const toNullable = (v) => (v === '' || v === undefined || v === null) ? null : v;

    const dbPayload = {
        client_id: toNullable(ncr.clientId),
        audit_id: toNullable(ncr.auditId),           // FK → audit_plans(id)
        level: ncr.level,
        client_name: ncr.clientName,
        source: ncr.source,
        standard: ncr.standard,
        clause: ncr.clause,
        severity: ncr.severity,
        description: ncr.description,
        raised_by: ncr.raisedBy,
        raised_date: toNullable(ncr.raisedDate),      // DATE column
        due_date: toNullable(ncr.dueDate),             // DATE column
        status: ncr.status,
        correction: ncr.correction,
        correction_date: toNullable(ncr.correctionDate), // DATE column
        root_cause: ncr.rootCause,
        corrective_action: ncr.correctiveAction,
        capa_responsible: ncr.capaResponsible,
        capa_implemented_date: toNullable(ncr.capaImplementedDate), // DATE column
        verification_method: ncr.verificationMethod,
        verified_by: ncr.verifiedBy,
        verified_date: toNullable(ncr.verifiedDate),   // DATE column
        effectiveness: ncr.effectiveness,
        evidence: ncr.evidence || []
    };

    try {
        if (ncr.id) {
            // Update
            const { error } = await window.SupabaseClient
                .from('audit_ncrs')
                .update(dbPayload)
                .eq('id', ncr.id);
            if (error) throw error;
        } else {
            // Insert
            const { data, error } = await window.SupabaseClient
                .from('audit_ncrs')
                .insert(dbPayload)
                .select();
            if (error) throw error;
            if (data && data[0]) ncr.id = data[0].id; // Assign the new DB ID
        }

        // Refresh local state and UI
        await window.fetchNCRs();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);

    } catch (error) {
        console.error('Failed to sync NCR:', error);
        window.showNotification('Failed to sync NCR changes to database: ' + error.message, 'error');
    }
}

// --------------------------------------------
// AUDIT PLAN HELPERS FOR NCR LINKING
// --------------------------------------------

// Get audit plan options for a specific client
window.getNCRAuditPlanOptions = function (clientId) {
    if (!clientId) return '';

    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    const clientName = client ? client.name : '';

    const plans = (window.state.auditPlans || []).filter(p =>
        String(p.clientId) === String(clientId) || p.client === clientName
    );

    if (plans.length === 0) {
        return '<option value="" disabled>No audit plans found for this client</option>';
    }

    return plans.map(p =>
        `<option value="${p.id}">${window.UTILS.escapeHtml(p.auditType || p.type || 'Audit')} - ${window.UTILS.escapeHtml(p.date || 'No date')} (${window.UTILS.escapeHtml(p.status || 'Draft')})</option>`
    ).join('');
};

// Update audit plan dropdown when client changes
window.updateNCRAuditPlanOptions = function () {
    const clientId = document.getElementById('ncr-client')?.value;
    const planSelect = document.getElementById('ncr-audit-plan');

    if (!planSelect) return;

    planSelect.innerHTML = '<option value="">Select Audit Plan...</option>' + window.getNCRAuditPlanOptions(clientId);
};

// --------------------------------------------
// MAIN RENDER FUNCTION
// --------------------------------------------

function renderNCRCAPAModule(clientId) {
    // Determine context
    window.state.ncrContextClientId = clientId || null;

    // Auto-fetch if empty and Supabase is available
    if (window.state.ncrs.length === 0 && window.SupabaseClient) {
        // Show loading state
        window.contentArea.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading NCRs...</div>';
        // Fetch and re-render
        window.fetchNCRs().then(() => {
            // After fetch completes, render the module
            renderNCRCAPAModuleContent(clientId);
        });
        return;
    }

    // Render normally if we have data or no Supabase
    renderNCRCAPAModuleContent(clientId);
}

function renderNCRCAPAModuleContent(clientId) {
    window.state.ncrContextClientId = clientId || null;

    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <!-- Internal Navigation Tabs -->
                <div class="tab-container" style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                    <button class="tab-btn active" data-action="switchNCRTab" data-arg1="register" data-arg2="this">NCR Register</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="capa" data-arg2="this">CAPA Tracker</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="verification" data-arg2="this">Verification</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="analytics" data-arg2="this">Analytics</button>
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
    document.querySelectorAll('#ncr-content ~ .tab-btn, .tab-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const container = document.getElementById('ncr-content');
    if (!container) return;

    switch (tabName) {
        case 'register': container.innerHTML = getNCRRegisterHTML(); break;
        case 'capa': container.innerHTML = getCAPATrackerHTML(); break;
        case 'verification': container.innerHTML = getVerificationHTML(); break;
        case 'analytics':
            container.innerHTML = getAnalyticsHTML();
            requestAnimationFrame(() => { if (typeof initNCRAnalyticsCharts === 'function') initNCRAnalyticsCharts(); });
            break;
    }
}

// --------------------------------------------
// TAB 1: NCR REGISTER
// --------------------------------------------

function getNCRRegisterHTML() {
    let ncrs = window.state.ncrs || [];

    // Filter by Context (if viewing a specific client)
    if (window.state.ncrContextClientId) {
        // ID comparison: Robust string comparison
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem;"></i>
                    NCR Register
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" data-action="printNCRRegister">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>
                        Print Register
                    </button>
                    <button class="btn btn-primary" data-action="openNewNCRModal">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                        New NCR
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="card" style="background: #f8fafc; padding: 1rem; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Level</label>
                        <select class="form-control" id="filter-level" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
                            <option value="client">Client</option>
                            <option value="cb-internal">Internal</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Severity</label>
                        <select class="form-control" id="filter-severity" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Observation">Observation</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Status</label>
                        <select class="form-control" id="filter-status" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
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
        return `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No NCRs found.</p>`;
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
                                    ${ncr.level === 'client' ? 'Client' : 'Internal'}
                                </span>
                            </td>
                            <td>${window.UTILS.escapeHtml(ncr.clientName || 'N/A')}</td>
                            <td><span class="badge bg-gray">${window.UTILS.escapeHtml(ncr.clause || '-')}</span></td>
                            <td>
                                <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : ncr.severity === 'Minor' ? '#f59e0b' : '#3b82f6'}; color: white;">
                                    ${ncr.severity}
                                </span>
                            </td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${window.UTILS.escapeHtml(ncr.description || '')}
                            </td>
                            <td>
                                ${ncr.dueDate || '-'}
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
                            <td style="white-space: nowrap;">
                                <button class="btn btn-sm btn-icon" data-action="viewNCRDetails" data-id="${ncr.id}" title="View Details">
                                    <i class="fa-solid fa-eye" style="color: var(--primary-color);"></i>
                                </button>
                                <button class="btn btn-sm btn-icon" data-action="editNCR" data-id="${ncr.id}" title="Edit">
                                    <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                </button>
                                <button class="btn btn-sm btn-icon" data-action="deleteNCR" data-id="${ncr.id}" title="Delete">
                                    <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                                </button>
                                ${ncr.status === 'Open' ? `
                                <button class="btn btn-sm" style="background: #10b981; color: white; margin-left: 0.25rem;" data-action="openAddCAPAModal" data-id="${ncr.id}" title="Add CAPA">
                                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>CAPA
                                </button>` : ''}
                                ${ncr.status === 'In Progress' && ncr.capaImplementedDate ? `
                                <button class="btn btn-sm" style="background: #3b82f6; color: white; margin-left: 0.25rem;" data-action="verifyCAPA" data-id="${ncr.id}" title="Verify CAPA">
                                    <i class="fa-solid fa-check"></i> Verify
                                </button>` : ''}
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
    const severity = document.getElementById('filter-severity').value;
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();

    let ncrs = window.state.ncrs || [];

    // Always apply context filter first
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    let filtered = ncrs.filter(ncr => {
        if (level !== 'all' && ncr.level !== level) return false;
        if (severity !== 'all' && ncr.severity !== severity) return false;
        if (status !== 'all' && ncr.status !== status) return false;
        if (search) {
            const match = (ncr.description || '').toLowerCase().includes(search) ||
                (ncr.clause || '').toLowerCase().includes(search) ||
                (ncr.clientName || '').toLowerCase().includes(search);
            if (!match) return false;
        }
        return true;
    });

    document.getElementById('ncr-table-container').innerHTML = renderNCRTable(filtered);
}

// --------------------------------------------
// TAB 2: CAPA TRACKER
// --------------------------------------------

function getCAPATrackerHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    const showClosed = window.state.showClosedCAPAs || false;
    if (!showClosed) {
        ncrs = ncrs.filter(n => n.status !== 'Closed');
    }

    if (ncrs.length === 0) return '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No active CAPAs found.</p>';

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-tasks" style="margin-right: 0.5rem;"></i>
                    CAPA Tracker
                </h3>
                <label style="font-size: 0.9rem; user-select: none; cursor: pointer;">
                    <input type="checkbox" data-action-change="toggleClosedCAPAs" ${showClosed ? 'checked' : ''}>
                    Show Closed Items
                </label>
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
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ncrs.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName || '')}</td>
                                <td>
                                    <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : '#f59e0b'}; color: white;">
                                        ${ncr.severity}
                                    </span>
                                </td>
                                <td style="max-width: 200px;">${window.UTILS.escapeHtml(ncr.rootCause || 'Pending analysis')}</td>
                                <td style="max-width: 250px;">${window.UTILS.escapeHtml(ncr.correctiveAction || 'Not yet defined')}</td>
                                <td>${window.UTILS.escapeHtml(ncr.capaResponsible || 'Not assigned')}</td>
                                <td>${ncr.dueDate || '-'}</td>
                                <td>
                                    <button class="btn btn-sm" data-action="updateCAPAProgress" data-id="${ncr.id}">
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

// --------------------------------------------
// TAB 3: VERIFICATION
// --------------------------------------------

function getVerificationHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    // Filter for items ready for verification
    const pendingReview = ncrs.filter(n => n.status === 'Verification' || (n.capaImplementedDate && !n.verifiedDate && n.status === 'In Progress'));

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i>
                CAPA Verification Pending
            </h3>

            ${pendingReview.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No CAPAs pending verification</p>' : `
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
                        ${pendingReview.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName || '')}</td>
                                <td style="max-width: 300px;">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</td>
                                <td>${ncr.capaImplementedDate || 'Not yet implemented'}</td>
                                <td>${window.UTILS.escapeHtml(ncr.verificationMethod || '')}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" data-action="verifyCAPA" data-id="${ncr.id}">
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

// --------------------------------------------
// TAB 4: ANALYTICS
// --------------------------------------------

function getAnalyticsHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    const total = ncrs.length;
    const open = ncrs.filter(n => n.status === 'Open').length;
    const inProgress = ncrs.filter(n => n.status === 'In Progress').length;
    const verification = ncrs.filter(n => n.status === 'Verification').length;
    const closed = ncrs.filter(n => n.status === 'Closed').length;
    const today = new Date();
    const overdue = ncrs.filter(n => n.status !== 'Closed' && n.dueDate && new Date(n.dueDate) < today).length;
    const effective = ncrs.filter(n => n.effectiveness === 'Effective').length;
    const effectivenessRate = closed > 0 ? Math.round((effective / closed) * 100) : 0;

    // Severity Breakdown
    const major = ncrs.filter(n => (n.severity || '').toLowerCase() === 'major').length;
    const minor = ncrs.filter(n => (n.severity || '').toLowerCase() === 'minor').length;
    const obs = ncrs.filter(n => {
        const s = (n.severity || '').toLowerCase();
        return s === 'observation' || s === 'ofi' || s === 'observation/ofi';
    }).length;

    // Top clauses
    const clauseMap = {};
    ncrs.forEach(n => {
        const c = n.clause || 'Unspecified';
        clauseMap[c] = (clauseMap[c] || 0) + 1;
    });
    const topClauses = Object.entries(clauseMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Avg resolution time
    const resolvedNCRs = ncrs.filter(n => n.status === 'Closed' && n.raisedDate && n.verifiedDate);
    let avgDays = 0;
    if (resolvedNCRs.length > 0) {
        const totalDays = resolvedNCRs.reduce((sum, n) => {
            return sum + Math.max(0, Math.ceil((new Date(n.verifiedDate) - new Date(n.raisedDate)) / (1000 * 60 * 60 * 24)));
        }, 0);
        avgDays = Math.round(totalDays / resolvedNCRs.length);
    }

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                NCR & CAPA Analytics
            </h3>

            <!-- KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${total}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Total NCRs</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${open}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Open</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${overdue}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Overdue</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${closed}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Closed</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${effectivenessRate}%</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">CAPA Effective</div>
                </div>
            </div>

            <!-- Charts Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Severity Distribution Doughnut -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-pie" style="color: #dc2626; margin-right: 0.5rem;"></i>Severity Distribution</h4>
                    <div style="position: relative; height: 250px;">
                        <canvas id="ncr-severity-chart"></canvas>
                    </div>
                </div>
                <!-- Status Pipeline Bar -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-filter" style="color: #2563eb; margin-right: 0.5rem;"></i>Status Pipeline</h4>
                    <div style="position: relative; height: 250px;">
                        <canvas id="ncr-status-chart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Bottom Row: Top Clauses + Resolution Stats -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <!-- Top Non-Conforming Clauses -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-ranking-star" style="color: #7c3aed; margin-right: 0.5rem;"></i>Top Non-Conforming Clauses</h4>
                    ${topClauses.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${topClauses.map(([clause, count], i) => `
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="min-width: 28px; height: 28px; background: linear-gradient(135deg, #7c3aed, #a78bfa); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.8rem;">${i + 1}</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 0.9rem;">${window.UTILS.escapeHtml(clause)}</div>
                                        <div style="background: #f1f5f9; border-radius: 4px; height: 8px; margin-top: 4px;">
                                            <div style="background: linear-gradient(90deg, #7c3aed, #a78bfa); height: 100%; border-radius: 4px; width: ${total > 0 ? Math.round((count / total) * 100) : 0}%;"></div>
                                        </div>
                                    </div>
                                    <div style="font-weight: 700; color: #7c3aed; font-size: 0.9rem;">${count}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="text-align: center; color: var(--text-secondary);">No data available</p>'}
                </div>
                <!-- Resolution Stats -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-clock" style="color: #059669; margin-right: 0.5rem;"></i>Resolution Statistics</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div style="text-align: center; padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${avgDays}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Avg Days to Close</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #eff6ff; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #2563eb;">${inProgress}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">In Progress</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #faf5ff; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #7c3aed;">${verification}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Pending Verification</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${effectivenessRate}%</div>
                            <div style="font-size: 0.8rem; color: #64748b;">CAPA Effective Rate</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Initialize NCR Analytics Charts after DOM render
function initNCRAnalyticsCharts() {
    // Severity Distribution Doughnut
    const sevCtx = document.getElementById('ncr-severity-chart');
    if (sevCtx) {
        const existing = Chart.getChart(sevCtx);
        if (existing) existing.destroy();

        let ncrs = window.state.ncrs || [];
        if (window.state.ncrContextClientId) {
            ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
        }
        const major = ncrs.filter(n => (n.severity || '').toLowerCase() === 'major').length;
        const minor = ncrs.filter(n => (n.severity || '').toLowerCase() === 'minor').length;
        const obs = ncrs.filter(n => {
            const s = (n.severity || '').toLowerCase();
            return s === 'observation' || s === 'ofi' || s === 'observation/ofi';
        }).length;

        new Chart(sevCtx, {
            type: 'doughnut',
            data: {
                labels: ['Major', 'Minor', 'Observation/OFI'],
                datasets: [{
                    data: [major || 0, minor || 0, obs || 0],
                    backgroundColor: ['#dc2626', '#f59e0b', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Status Pipeline Bar
    const statusCtx = document.getElementById('ncr-status-chart');
    if (statusCtx) {
        const existing = Chart.getChart(statusCtx);
        if (existing) existing.destroy();

        let ncrs = window.state.ncrs || [];
        if (window.state.ncrContextClientId) {
            ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
        }
        const open = ncrs.filter(n => n.status === 'Open').length;
        const inProg = ncrs.filter(n => n.status === 'In Progress').length;
        const verif = ncrs.filter(n => n.status === 'Verification').length;
        const closed = ncrs.filter(n => n.status === 'Closed').length;

        new Chart(statusCtx, {
            type: 'bar',
            data: {
                labels: ['Open', 'In Progress', 'Verification', 'Closed'],
                datasets: [{
                    label: 'NCRs',
                    data: [open, inProg, verif, closed],
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                }
            }
        });
    }
}
window.initNCRAnalyticsCharts = initNCRAnalyticsCharts;

// --------------------------------------------
// MODAL & FORM FUNCTIONS
// --------------------------------------------

function updateNCRAnalytics() {
    const ncrs = window.state.ncrs || [];
    const today = new Date();

    window.state.capaAnalytics = {
        totalNCRs: ncrs.length,
        openNCRs: ncrs.filter(n => n.status !== 'Closed').length,
        overdueNCRs: ncrs.filter(n => n.status !== 'Closed' && new Date(n.dueDate) < today).length,
        effectivenessRate: ncrs.length > 0 ? Math.round((ncrs.filter(n => n.effectiveness === 'Effective').length / ncrs.length) * 100) : 0,
    };
}

// CREATE NEW NEW MODAL
window.openNewNCRModal = function () {
    const contextClientId = window.state.ncrContextClientId || window.state.activeClientId;

    document.getElementById('modal-title').textContent = 'Create New NCR';
    document.getElementById('modal-body').innerHTML = `
        <form id="ncr-form">
            <div class="form-group">
                <label>Client <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-client" required ${contextClientId ? 'disabled' : ''} data-action-change="updateNCRAuditPlanOptions">
                    <option value="">Select Client...</option>
                    ${window.state.clients.map(c => `<option value="${c.id}" ${String(c.id) === String(contextClientId) ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
                <small style="color: var(--text-secondary);">For CB internal NCRs, select your internal audit client</small>
            </div>
            <div class="form-group" id="audit-plan-select-group">
                <label>Audit Plan <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-audit-plan" required>
                    <option value="">Select Audit Plan...</option>
                    ${window.getNCRAuditPlanOptions(contextClientId)}
                </select>
                <small style="color: var(--text-secondary);">Link this NCR to a specific audit</small>
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
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="ncr-description" rows="3" required></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Raised By</label>
                    <input type="text" class="form-control" id="ncr-raised-by" value="${window.state.currentUser?.name || 'Auditor'}">
                </div>
                <div class="form-group">
                    <label>Due Date <span style="color: var(--danger-color);">*</span></label>
                    <input type="date" class="form-control" id="ncr-due-date" required>
                </div>
            </div>
        </form>
    `;

    // Logic for Due Date
    document.getElementById('ncr-severity').addEventListener('change', function () {
        const severity = this.value;
        const today = new Date();
        const dueDate = new Date(today);
        if (severity === 'Major') dueDate.setDate(today.getDate() + 90); // 90 days default
        else if (severity === 'Minor') dueDate.setDate(today.getDate() + 30); // 30 days default
        // Observation might not have due date, but we'll set 30 for now

        document.getElementById('ncr-due-date').value = dueDate.toISOString().split('T')[0];
    });
    // Trigger
    document.getElementById('ncr-severity').dispatchEvent(new Event('change'));

    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = saveNewNCR;
    window.openModal();
};

async function saveNewNCR() {
    const clientId = document.getElementById('ncr-client').value;
    const client = window.state.clients.find(c => String(c.id) === String(clientId));
    const clientName = client ? client.name : 'Unknown';

    const ncrData = {
        level: 'client', // All NCRs are now client-based (including CB internal via internal client)
        clientId: clientId,
        clientName: clientName,
        auditId: document.getElementById('ncr-audit-plan')?.value || null, // FK → audit_plans(id)
        source: document.getElementById('ncr-source').value,
        standard: document.getElementById('ncr-standard').value,
        clause: document.getElementById('ncr-clause').value,
        severity: document.getElementById('ncr-severity').value,
        description: document.getElementById('ncr-description').value,
        raisedBy: document.getElementById('ncr-raised-by').value,
        raisedDate: new Date().toISOString().split('T')[0],
        dueDate: document.getElementById('ncr-due-date').value,
        status: 'Open',
        evidence: []
    };

    await persistNCR(ncrData);
    window.closeModal();
    window.showNotification('NCR Created Successfully', 'success');
}

// ... VIEW DETAILS, EDIT, CAPA (Assuming similar logic structure but mapped key names) ...
// Since the file is huge, I am keeping the other helper functions (viewNCRDetails, updateCAPAProgress, verifyCAPA)
// conceptually same but won't re-write entire file if they are just reading from window.state.ncrs.
// HOWEVER, updateCAPAProgress and verifyCAPA call persistNCR, which I fixed above.
// EDIT NCR needs to be checked.

window.viewNCRDetails = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `NCR Details`;
    document.getElementById('modal-body').innerHTML = `
        <div style="padding: 1rem;">
            <h4>${window.UTILS.escapeHtml(ncr.description)}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div><strong>Standard:</strong> ${window.UTILS.escapeHtml(ncr.standard)}</div>
                <div><strong>Clause:</strong> ${window.UTILS.escapeHtml(ncr.clause)}</div>
                <div><strong>Severity:</strong> ${window.UTILS.escapeHtml(ncr.severity)}</div>
                <div><strong>Status:</strong> ${window.UTILS.escapeHtml(ncr.status)}</div>
                <div><strong>Client:</strong> ${window.UTILS.escapeHtml(ncr.clientName)}</div>
            </div>
            <hr>
            <h5>CAPA Status</h5>
            <div><strong>Root Cause:</strong> ${window.UTILS.escapeHtml(ncr.rootCause || 'N/A')}</div>
            <div><strong>Corrective Action:</strong> ${window.UTILS.escapeHtml(ncr.correctiveAction || 'N/A')}</div>
            <div><strong>Verification:</strong> ${window.UTILS.escapeHtml(ncr.verificationMethod || 'N/A')}</div>
        </div>
    `;
    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
}

window.editNCR = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Edit NCR';
    document.getElementById('modal-body').innerHTML = `
        <form id="edit-ncr-form">
            <div class="form-group"><label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea id="edit-desc" class="form-control" rows="3">${window.UTILS.escapeHtml(ncr.description || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Standard</label>
                    <input type="text" class="form-control" id="edit-standard" value="${window.UTILS.escapeHtml(ncr.standard || '')}">
                </div>
                <div class="form-group"><label>Clause</label>
                    <input type="text" class="form-control" id="edit-clause" value="${window.UTILS.escapeHtml(ncr.clause || '')}">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Severity</label>
                    <select id="edit-severity" class="form-control">
                        <option value="Major" ${ncr.severity === 'Major' ? 'selected' : ''}>Major</option>
                        <option value="Minor" ${ncr.severity === 'Minor' ? 'selected' : ''}>Minor</option>
                        <option value="Observation" ${(ncr.severity || '').includes('Observation') ? 'selected' : ''}>Observation/OFI</option>
                    </select>
                </div>
                <div class="form-group"><label>Status</label>
                    <select id="edit-status" class="form-control">
                        <option value="Open" ${ncr.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${ncr.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Verification" ${ncr.status === 'Verification' ? 'selected' : ''}>Verification</option>
                        <option value="Closed" ${ncr.status === 'Closed' ? 'selected' : ''}>Closed</option>
                    </select>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Due Date</label>
                    <input type="date" class="form-control" id="edit-due-date" value="${ncr.dueDate || ''}">
                </div>
                <div class="form-group"><label>Source</label>
                    <input type="text" class="form-control" id="edit-source" value="${window.UTILS.escapeHtml(ncr.source || '')}">
                </div>
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.description = document.getElementById('edit-desc').value;
        ncr.standard = document.getElementById('edit-standard').value;
        ncr.clause = document.getElementById('edit-clause').value;
        ncr.severity = document.getElementById('edit-severity').value;
        ncr.status = document.getElementById('edit-status').value;
        ncr.dueDate = document.getElementById('edit-due-date').value;
        ncr.source = document.getElementById('edit-source').value;
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
};

window.openAddCAPAModal = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Add CAPA';
    document.getElementById('modal-body').innerHTML = `
        <form id="capa-form">
            <div style="padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; border-left: 3px solid var(--primary-color);">
                <strong>NCR:</strong> ${window.UTILS.escapeHtml(ncr.description || '')}
                <br><small style="color: var(--text-secondary);">Clause: ${window.UTILS.escapeHtml(ncr.clause || 'N/A')} | Severity: ${ncr.severity || 'N/A'}</small>
            </div>
            <div class="form-group"><label>Correction (Immediate Action)</label>
                <textarea id="capa-corr" class="form-control" rows="2" placeholder="What immediate correction was taken?">${window.UTILS.escapeHtml(ncr.correction || '')}</textarea>
            </div>
            <div class="form-group"><label>Root Cause Analysis <span style="color: var(--danger-color);">*</span></label>
                <textarea id="capa-rc" class="form-control" rows="3" placeholder="Describe the root cause...">${window.UTILS.escapeHtml(ncr.rootCause || '')}</textarea>
            </div>
            <div class="form-group"><label>Corrective Action <span style="color: var(--danger-color);">*</span></label>
                <textarea id="capa-ca" class="form-control" rows="3" placeholder="Describe corrective action planned...">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Responsible Person</label>
                    <input type="text" class="form-control" id="capa-responsible" value="${window.UTILS.escapeHtml(ncr.capaResponsible || '')}" placeholder="Name of responsible person">
                </div>
                <div class="form-group"><label>Target Completion Date</label>
                    <input type="date" class="form-control" id="capa-target-date" value="${ncr.dueDate || ''}">
                </div>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.correction = document.getElementById('capa-corr').value;
        ncr.rootCause = document.getElementById('capa-rc').value;
        ncr.correctiveAction = document.getElementById('capa-ca').value;
        ncr.capaResponsible = document.getElementById('capa-responsible').value;
        ncr.dueDate = document.getElementById('capa-target-date').value;
        ncr.status = 'In Progress';
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
};

// --- DELETE NCR ---
window.deleteNCR = async function (id) {
    if (!confirm('Are you sure you want to delete this NCR record?')) return;
    try {
        if (window.SupabaseClient && !String(id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_ncrs').delete().eq('id', id);
            if (error) throw error;
        }
        window.state.ncrs = window.state.ncrs.filter(n => String(n.id) !== String(id));
        window.saveData();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        window.showNotification('NCR deleted', 'success');
    } catch (e) {
        window.showNotification('Delete failed: ' + e.message, 'error');
    }
};

// --- PRINT NCR REGISTER ---
window.printNCRRegister = function () {
    const ncrs = window.state.ncrs || [];
    const printWindow = window.open('', '', 'width=1000,height=700');

    printWindow.document.write(`
        <html>
        <head>
            <title>NCR Register</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f2f2f2; }
                .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; }
            </style>
        </head>
        <body>
            <h1>NCR Register</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>NCR#</th>
                        <th>Client</th>
                        <th>Standard</th>
                        <th>Clause</th>
                        <th>Severity</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Due Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${ncrs.map(n => `
                        <tr>
                            <td>NCR-${String(n.id).padStart(3, '0')}</td>
                            <td>${n.clientName || '-'}</td>
                            <td>${n.standard || '-'}</td>
                            <td>${n.clause || '-'}</td>
                            <td>${n.severity}</td>
                            <td>${n.description}</td>
                            <td>${n.status}</td>
                            <td>${n.dueDate || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                ISO 17021-1 Governance Record - Confidential
            </div>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
};


window.verifyCAPA = function (ncrId) {
    const ncr = window.state.ncrs.find(n => n.id === ncrId);
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Verify CAPA';
    document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Verification Method</label><textarea id="ver-method" class="form-control">${window.UTILS.escapeHtml(ncr.verificationMethod || '')}</textarea></div>
        <div class="form-group"><label>Effectiveness</label>
            <select id="ver-eff" class="form-control">
                <option value="Effective">Effective</option>
                <option value="Not Effective">Not Effective</option>
            </select>
        </div>
`;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.verificationMethod = document.getElementById('ver-method').value;
        ncr.effectiveness = document.getElementById('ver-eff').value;
        if (ncr.effectiveness === 'Effective') ncr.status = 'Closed';
        ncr.verifiedDate = new Date().toISOString().split('T')[0];

        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
}
// --- UPDATE CAPA PROGRESS ---
window.updateCAPAProgress = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Update CAPA Progress';
    document.getElementById('modal-body').innerHTML = `
        <form id="capa-progress-form">
            <div style="padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; border-left: 3px solid var(--primary-color);">
                <strong>NCR-${String(ncr.id).padStart(3, '0')}:</strong> ${window.UTILS.escapeHtml(ncr.description || '')}
                <br><small style="color: var(--text-secondary);">Severity: ${ncr.severity || 'N/A'} | Status: ${ncr.status || 'Open'}</small>
            </div>
            <div class="form-group"><label>Root Cause</label>
                <textarea id="prog-rc" class="form-control" rows="2">${window.UTILS.escapeHtml(ncr.rootCause || '')}</textarea>
            </div>
            <div class="form-group"><label>Corrective Action</label>
                <textarea id="prog-ca" class="form-control" rows="2">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Responsible Person</label>
                    <input type="text" class="form-control" id="prog-resp" value="${window.UTILS.escapeHtml(ncr.capaResponsible || '')}">
                </div>
                <div class="form-group"><label>Implementation Date</label>
                    <input type="date" class="form-control" id="prog-impl-date" value="${ncr.capaImplementedDate || ''}">
                </div>
            </div>
            <div class="form-group"><label>Status</label>
                <select id="prog-status" class="form-control">
                    <option value="Open" ${ncr.status === 'Open' ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${ncr.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Verification" ${ncr.status === 'Verification' ? 'selected' : ''}>Ready for Verification</option>
                    <option value="Closed" ${ncr.status === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.rootCause = document.getElementById('prog-rc').value;
        ncr.correctiveAction = document.getElementById('prog-ca').value;
        ncr.capaResponsible = document.getElementById('prog-resp').value;
        ncr.capaImplementedDate = document.getElementById('prog-impl-date').value;
        ncr.status = document.getElementById('prog-status').value;
        // Auto-transition: if implementation date set and status is still "In Progress", move to Verification
        if (ncr.capaImplementedDate && ncr.status === 'In Progress') {
            ncr.status = 'Verification';
        }
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        window.showNotification('CAPA progress updated', 'success');
    };
    window.openModal();
};

// Export
window.renderNCRCAPAModule = renderNCRCAPAModule;
window.switchNCRTab = switchNCRTab;

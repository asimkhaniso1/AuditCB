// ============================================
// APPEALS & COMPLAINTS MODULE
// ISO 17021-1 Clause 9.10 & 9.11 Compliance
// Internal CB Register for Auditors
// ============================================

function renderAppealsComplaintsModule() {
    const state = window.state;
    const appeals = state.appeals || [];
    const complaints = state.complaints || [];

    // Calculate stats
    const openAppeals = appeals.filter(a => !['Resolved', 'Closed'].includes(a.status)).length;
    const openComplaints = complaints.filter(c => !['Resolved', 'Closed'].includes(c.status)).length;
    const totalAppeals = appeals.length;
    const totalComplaints = complaints.length;

    // Determine active tab from state or default
    const activeTab = state.appealsComplaintsTab || 'appeals';

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0;">Appeals & Complaints Register</h2>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary);">ISO 17021-1 Clause 9.10 & 9.11 - Internal tracking for accreditation compliance</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="window.openNewAppealModal()">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Appeal
                    </button>
                    <button class="btn btn-secondary" onclick="window.openNewComplaintModal()">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Complaint
                    </button>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-gavel"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Open Appeals</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: ${openAppeals > 0 ? '#d97706' : '#16a34a'};">${openAppeals}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-comment-dots"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Open Complaints</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: ${openComplaints > 0 ? '#dc2626' : '#16a34a'};">${openComplaints}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-balance-scale"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Appeals</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${totalAppeals}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-clipboard-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Complaints</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${totalComplaints}</div>
                    </div>
                </div>
            </div>
            
            <!-- Tab Buttons -->
            <div class="card">
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem;">
                    <button class="btn ${activeTab === 'appeals' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchACTab('appeals')">
                        <i class="fa-solid fa-gavel" style="margin-right: 0.5rem;"></i>Appeals Register
                    </button>
                    <button class="btn ${activeTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}" onclick="window.switchACTab('complaints')">
                        <i class="fa-solid fa-comment-dots" style="margin-right: 0.5rem;"></i>Complaints Register
                    </button>
                    <div style="flex: 1;"></div>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.printACRegister('${activeTab}')">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>Print Register
                    </button>
                </div>
                
                <div id="ac-tab-content">
                    ${activeTab === 'appeals' ? renderAppealsTab(appeals) : renderComplaintsTab(complaints)}
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
}

function renderAppealsTab(appeals) {
    if (appeals.length === 0) {
        return `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fa-solid fa-gavel" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>No appeals recorded. Click "New Appeal" to log one.</p>
            </div>
        `;
    }

    const getStatusColor = (status) => {
        const colors = {
            'Received': '#3b82f6',
            'Under Review': '#f59e0b',
            'Investigation': '#8b5cf6',
            'Panel Review': '#ec4899',
            'Resolved': '#10b981',
            'Closed': '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>Subject</th>
                        <th>Date Received</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${appeals.map(a => `
                        <tr>
                            <td><strong>APP-${String(a.id).padStart(3, '0')}</strong></td>
                            <td>${a.clientName || '-'}</td>
                            <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${a.type}</span></td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.subject}">${a.subject}</td>
                            <td>${a.dateReceived}</td>
                            <td>${a.dueDate || '-'}</td>
                            <td><span class="badge" style="background: ${getStatusColor(a.status)}; color: white;">${a.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="window.viewAppealDetail(${a.id})">
                                    <i class="fa-solid fa-eye"></i> View
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderComplaintsTab(complaints) {
    if (complaints.length === 0) {
        return `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fa-solid fa-comment-dots" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>No complaints recorded. Click "New Complaint" to log one.</p>
            </div>
        `;
    }

    const getStatusColor = (status) => {
        const colors = {
            'Received': '#3b82f6',
            'Acknowledged': '#0ea5e9',
            'Investigation': '#8b5cf6',
            'Corrective Action': '#f59e0b',
            'Resolved': '#10b981',
            'Closed': '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Subject</th>
                        <th>Date Received</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${complaints.map(c => `
                        <tr>
                            <td><strong>CMP-${String(c.id).padStart(3, '0')}</strong></td>
                            <td><span class="badge" style="background: #f3f4f6; color: #374151;">${c.source}</span></td>
                            <td><span class="badge" style="background: #fef3c7; color: #92400e;">${c.type}</span></td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.subject}">${c.subject}</td>
                            <td>${c.dateReceived}</td>
                            <td>${c.dueDate || '-'}</td>
                            <td><span class="badge" style="background: ${getStatusColor(c.status)}; color: white;">${c.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="window.viewComplaintDetail(${c.id})">
                                    <i class="fa-solid fa-eye"></i> View
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

window.switchACTab = function (tabName) {
    window.state.appealsComplaintsTab = tabName;
    renderAppealsComplaintsModule();
};

// ============================================
// NEW APPEAL MODAL
// ============================================
window.openNewAppealModal = function () {
    const clients = window.state.clients || [];

    document.getElementById('modal-title').textContent = 'Log New Appeal';
    document.getElementById('modal-body').innerHTML = `
        <form id="appeal-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <label>Client</label>
                    <select id="appeal-client" class="form-control" required>
                        <option value="">Select Client</option>
                        ${clients.map(c => `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>Appeal Type</label>
                    <select id="appeal-type" class="form-control" required>
                        <option value="Certification Decision">Certification Decision</option>
                        <option value="Audit Conduct">Audit Conduct</option>
                        <option value="Auditor Conduct">Auditor Conduct</option>
                        <option value="NC Classification">NC Classification</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <label>Subject</label>
                <input type="text" id="appeal-subject" class="form-control" placeholder="Brief subject of the appeal" required>
            </div>
            <div style="margin-top: 1rem;">
                <label>Description</label>
                <textarea id="appeal-description" class="form-control" rows="4" placeholder="Detailed description of the appeal..." required></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div>
                    <label>Date Received</label>
                    <input type="date" id="appeal-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div>
                    <label>Due Date (30 days recommended)</label>
                    <input type="date" id="appeal-due" class="form-control" value="${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <label>Assigned To</label>
                <input type="text" id="appeal-assigned" class="form-control" placeholder="e.g., Impartiality Committee, Quality Manager" value="Impartiality Committee">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        const clientSelect = document.getElementById('appeal-client');
        const clientId = parseInt(clientSelect.value);
        const clientName = clientSelect.options[clientSelect.selectedIndex]?.dataset?.name || '';

        const newAppeal = {
            id: (window.state.appeals.length > 0 ? Math.max(...window.state.appeals.map(a => a.id)) : 0) + 1,
            clientId: clientId,
            clientName: clientName,
            type: document.getElementById('appeal-type').value,
            subject: document.getElementById('appeal-subject').value,
            description: document.getElementById('appeal-description').value,
            dateReceived: document.getElementById('appeal-date').value,
            dueDate: document.getElementById('appeal-due').value,
            status: 'Received',
            assignedTo: document.getElementById('appeal-assigned').value,
            resolution: '',
            dateResolved: '',
            history: [
                { date: new Date().toISOString().split('T')[0], action: 'Received', user: window.state.currentUser.name, notes: 'Appeal logged in register' }
            ]
        };

        if (!newAppeal.subject || !newAppeal.description) {
            window.showNotification('Please fill in all required fields', 'error');
            return;
        }

        window.state.appeals.push(newAppeal);
        window.saveData();
        window.closeModal();
        window.showNotification('Appeal logged successfully', 'success');
        renderAppealsComplaintsModule();
    };

    window.openModal();
};

// ============================================
// NEW COMPLAINT MODAL
// ============================================
window.openNewComplaintModal = function () {
    const clients = window.state.clients || [];
    const auditors = window.state.auditors || [];

    document.getElementById('modal-title').textContent = 'Log New Complaint';
    document.getElementById('modal-body').innerHTML = `
        <form id="complaint-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <label>Complaint Source</label>
                    <select id="complaint-source" class="form-control" required>
                        <option value="Client">Client</option>
                        <option value="Public">Public</option>
                        <option value="Employee">Employee</option>
                        <option value="Accreditation Body">Accreditation Body</option>
                        <option value="Anonymous">Anonymous</option>
                    </select>
                </div>
                <div>
                    <label>Related Client (if applicable)</label>
                    <select id="complaint-client" class="form-control">
                        <option value="">Not Applicable</option>
                        ${clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div>
                    <label>Complaint Type</label>
                    <select id="complaint-type" class="form-control" required>
                        <option value="Service Quality">Service Quality</option>
                        <option value="Auditor Conduct">Auditor Conduct</option>
                        <option value="Impartiality">Impartiality Concern</option>
                        <option value="Confidentiality">Confidentiality Breach</option>
                        <option value="Certification Decision">Certification Decision</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label>Severity</label>
                    <select id="complaint-severity" class="form-control" required>
                        <option value="Low">Low</option>
                        <option value="Medium" selected>Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <label>Auditors Involved (Hold Ctrl/Cmd to select multiple)</label>
                <select id="complaint-auditors" class="form-control" multiple style="height: 80px;">
                    ${auditors.map(a => `<option value="${a.id}">${a.name} (${a.role})</option>`).join('')}
                </select>
            </div>
            <div style="margin-top: 1rem;">
                <label>Subject</label>
                <input type="text" id="complaint-subject" class="form-control" placeholder="Brief subject of the complaint" required>
            </div>
            <div style="margin-top: 1rem;">
                <label>Description</label>
                <textarea id="complaint-description" class="form-control" rows="4" placeholder="Detailed description of the complaint..." required></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div>
                    <label>Date Received</label>
                    <input type="date" id="complaint-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div>
                    <label>Due Date (14 days recommended)</label>
                    <input type="date" id="complaint-due" class="form-control" value="${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <label>Investigator</label>
                <input type="text" id="complaint-investigator" class="form-control" placeholder="e.g., Quality Manager" value="Quality Manager">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        // Define field mapping
        const fieldIds = {
            source: 'complaint-source',
            clientName: 'complaint-client',
            type: 'complaint-type',
            severity: 'complaint-severity',
            subject: 'complaint-subject',
            description: 'complaint-description',
            dateReceived: 'complaint-date',
            dueDate: 'complaint-due',
            investigator: 'complaint-investigator'
        };

        // Define validation rules
        const rules = {
            source: [
                { rule: 'required', fieldName: 'Source' },
                { rule: 'inList', allowed: ['Client', 'Public', 'Internal', 'Regulatory'], fieldName: 'Source' }
            ],
            subject: [
                { rule: 'required', fieldName: 'Subject' },
                { rule: 'length', min: 10, max: 200, fieldName: 'Subject' },
                { rule: 'noHtmlTags', fieldName: 'Subject' }
            ],
            description: [
                { rule: 'required', fieldName: 'Description' },
                { rule: 'length', min: 20, max: 2000, fieldName: 'Description' }
            ],
            type: [
                { rule: 'required', fieldName: 'Complaint Type' }
            ],
            severity: [
                { rule: 'required', fieldName: 'Severity' },
                { rule: 'inList', allowed: ['Low', 'Medium', 'High', 'Critical'], fieldName: 'Severity' }
            ],
            dateReceived: [
                { rule: 'required', fieldName: 'Date Received' },
                { rule: 'date', fieldName: 'Date Received' }
            ],
            investigator: [
                { rule: 'required', fieldName: 'Investigator' },
                { rule: 'length', min: 2, max: 100, fieldName: 'Investigator' }
            ]
        };

        // Validate form
        const validationResult = Validator.validateFormElements(fieldIds, rules);

        if (!validationResult.valid) {
            Validator.displayErrors(validationResult.errors, fieldIds);
            window.showNotification('Please fix the form errors', 'error');
            return;
        }

        // Clear any previous errors
        Validator.clearErrors(fieldIds);

        // Sanitize form data
        const cleanData = Sanitizer.sanitizeFormData(
            validationResult.formData,
            ['source', 'clientName', 'type', 'severity', 'subject', 'description', 'investigator'] // All as text
        );

        // Get selected auditors
        const auditorSelect = document.getElementById('complaint-auditors');
        const selectedAuditorIds = Array.from(auditorSelect.selectedOptions).map(opt => parseInt(opt.value));

        // Create complaint with sanitized data
        const newComplaint = {
            id: (window.state.complaints.length > 0 ? Math.max(...window.state.complaints.map(c => c.id)) : 0) + 1,
            source: cleanData.source,
            clientName: cleanData.clientName || '',
            relatedAuditId: null,
            type: cleanData.type,
            severity: cleanData.severity,
            auditorsInvolved: selectedAuditorIds,
            subject: cleanData.subject,
            description: cleanData.description,
            dateReceived: cleanData.dateReceived,
            dueDate: cleanData.dueDate || '',
            status: 'Received',
            investigator: cleanData.investigator,
            findings: '',
            correctiveAction: '',
            resolution: '',
            dateResolved: '',
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    action: 'Received',
                    user: window.state.currentUser.name,
                    notes: 'Complaint logged in register'
                }
            ]
        };

        // Link complaint to selected auditors
        selectedAuditorIds.forEach(audId => {
            const auditor = window.state.auditors.find(a => a.id === audId);
            if (auditor) {
                if (!auditor.evaluations) auditor.evaluations = {};
                if (!auditor.evaluations.linkedComplaints) auditor.evaluations.linkedComplaints = [];
                auditor.evaluations.linkedComplaints.push({
                    complaintId: newComplaint.id,
                    date: newComplaint.dateReceived,
                    type: newComplaint.type,
                    severity: newComplaint.severity,
                    subject: newComplaint.subject,
                    status: newComplaint.status
                });
            }
        });

        window.state.complaints.push(newComplaint);
        window.saveData();
        window.closeModal();
        window.showNotification('Complaint logged successfully', 'success');
        renderAppealsComplaintsModule();
    };

    window.openModal();
};

// ============================================
// VIEW APPEAL DETAIL
// ============================================
window.viewAppealDetail = function (id) {
    const appeal = window.state.appeals.find(a => a.id === id);
    if (!appeal) return;

    const getStatusColor = (status) => {
        const colors = {
            'Received': '#3b82f6',
            'Under Review': '#f59e0b',
            'Investigation': '#8b5cf6',
            'Panel Review': '#ec4899',
            'Resolved': '#10b981',
            'Closed': '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAppealsComplaintsModule()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to Register
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0;">APP-${String(appeal.id).padStart(3, '0')}: ${appeal.subject}</h2>
                        <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">
                            ${appeal.clientName} • ${appeal.type}
                        </p>
                    </div>
                    <span class="badge" style="background: ${getStatusColor(appeal.status)}; color: white; font-size: 1rem; padding: 0.5rem 1rem;">${appeal.status}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div><strong>Date Received:</strong><br>${appeal.dateReceived}</div>
                    <div><strong>Due Date:</strong><br>${appeal.dueDate || 'Not Set'}</div>
                    <div><strong>Assigned To:</strong><br>${appeal.assignedTo}</div>
                    <div><strong>Date Resolved:</strong><br>${appeal.dateResolved || 'Pending'}</div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <h4>Description</h4>
                    <p style="background: #f8fafc; padding: 1rem; border-radius: 6px;">${appeal.description}</p>
                </div>
                
                ${appeal.resolution ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Resolution</h4>
                    <p style="background: #f0fdf4; padding: 1rem; border-radius: 6px; border-left: 4px solid #10b981;">${appeal.resolution}</p>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                    ${appeal.status !== 'Closed' ? `
                    <button class="btn btn-primary" onclick="window.updateAppealStatus(${appeal.id})">
                        <i class="fa-solid fa-arrow-right" style="margin-right: 0.5rem;"></i>Update Status
                    </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.addAppealNote(${appeal.id})">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>Add Note
                    </button>
                </div>
            </div>
            
            <!-- History Timeline -->
            <div class="card">
                <h3><i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Activity History</h3>
                <div style="margin-top: 1rem;">
                    ${(appeal.history || []).map((h, idx) => `
                        <div style="display: flex; gap: 1rem; padding: 1rem 0; ${idx < appeal.history.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}">
                            <div style="width: 100px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-secondary);">${h.date}</div>
                            <div style="flex: 1;">
                                <strong style="color: ${getStatusColor(h.action)};">${h.action}</strong>
                                <span style="color: var(--text-secondary); font-size: 0.85rem;"> by ${h.user}</span>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">${h.notes}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
};

// ============================================
// VIEW COMPLAINT DETAIL
// ============================================
window.viewComplaintDetail = function (id) {
    const complaint = window.state.complaints.find(c => c.id === id);
    if (!complaint) return;

    const getStatusColor = (status) => {
        const colors = {
            'Received': '#3b82f6',
            'Acknowledged': '#0ea5e9',
            'Investigation': '#8b5cf6',
            'Corrective Action': '#f59e0b',
            'Resolved': '#10b981',
            'Closed': '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="window.state.appealsComplaintsTab = 'complaints'; renderAppealsComplaintsModule()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to Register
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0;">CMP-${String(complaint.id).padStart(3, '0')}: ${complaint.subject}</h2>
                        <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">
                            Source: ${complaint.source} • Type: ${complaint.type}
                            ${complaint.clientName ? ` • Client: ${complaint.clientName}` : ''}
                        </p>
                    </div>
                    <span class="badge" style="background: ${getStatusColor(complaint.status)}; color: white; font-size: 1rem; padding: 0.5rem 1rem;">${complaint.status}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                    <div><strong>Date Received:</strong><br>${complaint.dateReceived}</div>
                    <div><strong>Due Date:</strong><br>${complaint.dueDate || 'Not Set'}</div>
                    <div><strong>Investigator:</strong><br>${complaint.investigator}</div>
                    <div><strong>Date Resolved:</strong><br>${complaint.dateResolved || 'Pending'}</div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <h4>Description</h4>
                    <p style="background: #f8fafc; padding: 1rem; border-radius: 6px;">${complaint.description}</p>
                </div>
                
                ${complaint.findings ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Investigation Findings</h4>
                    <p style="background: #fef3c7; padding: 1rem; border-radius: 6px; border-left: 4px solid #f59e0b;">${complaint.findings}</p>
                </div>
                ` : ''}
                
                ${complaint.correctiveAction ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Corrective Action</h4>
                    <p style="background: #e0f2fe; padding: 1rem; border-radius: 6px; border-left: 4px solid #0284c7;">${complaint.correctiveAction}</p>
                </div>
                ` : ''}
                
                ${complaint.resolution ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4>Resolution</h4>
                    <p style="background: #f0fdf4; padding: 1rem; border-radius: 6px; border-left: 4px solid #10b981;">${complaint.resolution}</p>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                    ${complaint.status !== 'Closed' ? `
                    <button class="btn btn-primary" onclick="window.updateComplaintStatus(${complaint.id})">
                        <i class="fa-solid fa-arrow-right" style="margin-right: 0.5rem;"></i>Update Status
                    </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.addComplaintNote(${complaint.id})">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>Add Note
                    </button>
                </div>
            </div>
            
            <!-- History Timeline -->
            <div class="card">
                <h3><i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Activity History</h3>
                <div style="margin-top: 1rem;">
                    ${(complaint.history || []).map((h, idx) => `
                        <div style="display: flex; gap: 1rem; padding: 1rem 0; ${idx < complaint.history.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}">
                            <div style="width: 100px; flex-shrink: 0; font-size: 0.85rem; color: var(--text-secondary);">${h.date}</div>
                            <div style="flex: 1;">
                                <strong style="color: ${getStatusColor(h.action)};">${h.action}</strong>
                                <span style="color: var(--text-secondary); font-size: 0.85rem;"> by ${h.user}</span>
                                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">${h.notes}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
};

// ============================================
// UPDATE STATUS FUNCTIONS
// ============================================
window.updateAppealStatus = function (id) {
    const appeal = window.state.appeals.find(a => a.id === id);
    if (!appeal) return;

    const statusFlow = ['Received', 'Under Review', 'Investigation', 'Panel Review', 'Resolved', 'Closed'];
    const currentIdx = statusFlow.indexOf(appeal.status);

    document.getElementById('modal-title').textContent = 'Update Appeal Status';
    document.getElementById('modal-body').innerHTML = `
        <form>
            <div style="margin-bottom: 1rem;">
                <label>New Status</label>
                <select id="new-status" class="form-control">
                    ${statusFlow.map((s, idx) => `<option value="${s}" ${idx === currentIdx + 1 ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom: 1rem;">
                <label>Notes</label>
                <textarea id="status-notes" class="form-control" rows="3" placeholder="Add notes about this status change..."></textarea>
            </div>
            ${appeal.status === 'Panel Review' || appeal.status === 'Investigation' ? `
            <div style="margin-bottom: 1rem;">
                <label>Resolution (if resolving)</label>
                <textarea id="appeal-resolution" class="form-control" rows="3" placeholder="Describe the resolution...">${appeal.resolution || ''}</textarea>
            </div>
            ` : ''}
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        const newStatus = document.getElementById('new-status').value;
        const notes = document.getElementById('status-notes').value;
        const resolution = document.getElementById('appeal-resolution')?.value || '';

        appeal.status = newStatus;
        if (resolution) appeal.resolution = resolution;
        if (newStatus === 'Resolved' || newStatus === 'Closed') {
            appeal.dateResolved = new Date().toISOString().split('T')[0];
        }

        appeal.history.push({
            date: new Date().toISOString().split('T')[0],
            action: newStatus,
            user: window.state.currentUser.name,
            notes: notes || `Status updated to ${newStatus}`
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Appeal status updated', 'success');
        window.viewAppealDetail(id);
    };

    window.openModal();
};

window.updateComplaintStatus = function (id) {
    const complaint = window.state.complaints.find(c => c.id === id);
    if (!complaint) return;

    const statusFlow = ['Received', 'Acknowledged', 'Investigation', 'Corrective Action', 'Resolved', 'Closed'];
    const currentIdx = statusFlow.indexOf(complaint.status);

    document.getElementById('modal-title').textContent = 'Update Complaint Status';
    document.getElementById('modal-body').innerHTML = `
        <form>
            <div style="margin-bottom: 1rem;">
                <label>New Status</label>
                <select id="new-status" class="form-control">
                    ${statusFlow.map((s, idx) => `<option value="${s}" ${idx === currentIdx + 1 ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom: 1rem;">
                <label>Notes</label>
                <textarea id="status-notes" class="form-control" rows="3" placeholder="Add notes about this status change..."></textarea>
            </div>
            <div style="margin-bottom: 1rem;">
                <label>Investigation Findings</label>
                <textarea id="complaint-findings" class="form-control" rows="2" placeholder="What was found...">${complaint.findings || ''}</textarea>
            </div>
            <div style="margin-bottom: 1rem;">
                <label>Corrective Action</label>
                <textarea id="complaint-ca" class="form-control" rows="2" placeholder="What action was taken...">${complaint.correctiveAction || ''}</textarea>
            </div>
            <div style="margin-bottom: 1rem;">
                <label>Resolution</label>
                <textarea id="complaint-resolution" class="form-control" rows="2" placeholder="How was it resolved...">${complaint.resolution || ''}</textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        const newStatus = document.getElementById('new-status').value;
        const notes = document.getElementById('status-notes').value;

        complaint.status = newStatus;
        complaint.findings = document.getElementById('complaint-findings').value || complaint.findings;
        complaint.correctiveAction = document.getElementById('complaint-ca').value || complaint.correctiveAction;
        complaint.resolution = document.getElementById('complaint-resolution').value || complaint.resolution;

        if (newStatus === 'Resolved' || newStatus === 'Closed') {
            complaint.dateResolved = new Date().toISOString().split('T')[0];
        }

        complaint.history.push({
            date: new Date().toISOString().split('T')[0],
            action: newStatus,
            user: window.state.currentUser.name,
            notes: notes || `Status updated to ${newStatus}`
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Complaint status updated', 'success');
        window.viewComplaintDetail(id);
    };

    window.openModal();
};

// ============================================
// ADD NOTE FUNCTIONS
// ============================================
window.addAppealNote = function (id) {
    const appeal = window.state.appeals.find(a => a.id === id);
    if (!appeal) return;

    document.getElementById('modal-title').textContent = 'Add Note to Appeal';
    document.getElementById('modal-body').innerHTML = `
        <form>
            <div style="margin-bottom: 1rem;">
                <label>Note</label>
                <textarea id="note-text" class="form-control" rows="4" placeholder="Add investigation notes, communications, etc..."></textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        const notes = document.getElementById('note-text').value;
        if (!notes) {
            window.showNotification('Please enter a note', 'error');
            return;
        }

        appeal.history.push({
            date: new Date().toISOString().split('T')[0],
            action: 'Note Added',
            user: window.state.currentUser.name,
            notes: notes
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Note added', 'success');
        window.viewAppealDetail(id);
    };

    window.openModal();
};

window.addComplaintNote = function (id) {
    const complaint = window.state.complaints.find(c => c.id === id);
    if (!complaint) return;

    document.getElementById('modal-title').textContent = 'Add Note to Complaint';
    document.getElementById('modal-body').innerHTML = `
        <form>
            <div style="margin-bottom: 1rem;">
                <label>Note</label>
                <textarea id="note-text" class="form-control" rows="4" placeholder="Add investigation notes, communications, etc..."></textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = function () {
        const notes = document.getElementById('note-text').value;
        if (!notes) {
            window.showNotification('Please enter a note', 'error');
            return;
        }

        complaint.history.push({
            date: new Date().toISOString().split('T')[0],
            action: 'Note Added',
            user: window.state.currentUser.name,
            notes: notes
        });

        window.saveData();
        window.closeModal();
        window.showNotification('Note added', 'success');
        window.viewComplaintDetail(id);
    };

    window.openModal();
};

// ============================================
// PRINT REGISTER (For Accreditation Audits)
// ============================================
window.printACRegister = function (type) {
    const printWindow = window.open('', 'PrintRegister', 'width=1000,height=800');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }

    const isAppeals = type === 'appeals';
    const data = isAppeals ? window.state.appeals : window.state.complaints;
    const title = isAppeals ? 'Appeals Register' : 'Complaints Register';

    const rows = data.map(item => {
        const id = isAppeals ? `APP-${String(item.id).padStart(3, '0')}` : `CMP-${String(item.id).padStart(3, '0')}`;
        return `
            <tr>
                <td>${id}</td>
                <td>${isAppeals ? item.clientName : item.source}</td>
                <td>${item.type}</td>
                <td>${item.subject}</td>
                <td>${item.dateReceived}</td>
                <td>${item.dateResolved || 'Open'}</td>
                <td>${item.status}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - AuditCB360</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #1e3a5f; color: white; }
                tr:nth-child(even) { background: #f8f9fa; }
                .footer { margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Records:</strong> ${data.length}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>${isAppeals ? 'Client' : 'Source'}</th>
                        <th>Type</th>
                        <th>Subject</th>
                        <th>Received</th>
                        <th>Resolved</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" style="text-align: center;">No records</td></tr>'}
                </tbody>
            </table>
            
            <div class="footer">
                <p>ISO 17021-1 Clause ${isAppeals ? '9.10' : '9.11'} - ${title}</p>
                <p>AuditCB360 Certification Body Management System</p>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
};

// Export
window.renderAppealsComplaintsModule = renderAppealsComplaintsModule;

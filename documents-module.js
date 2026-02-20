// ============================================
// DOCUMENT MANAGEMENT MODULE
// ============================================

// Initial mock data for documents if not present
if (!state.documents) {
    state.documents = [
        {
            id: 1,
            title: 'Quality Manual',
            type: 'Manual',
            client: 'CB Internal',
            date: '2023-11-15',
            size: '2.4 MB',
            status: 'Approved',
            version: '4.0',
            // ISO 17021 Clause 8.3 - Document Control Fields
            documentNumber: 'QM-001',
            controlStatus: 'Controlled',
            owner: 'Quality Manager',
            nextReviewDate: '2024-11-15',
            reviewFrequency: 'Annual',
            distributionList: ['All Staff', 'Auditors', 'Management'],
            confidentiality: 'Internal',
            revisionHistory: [
                { version: '4.0', date: '2023-11-15', author: 'Quality Manager', changes: 'Updated for ISO 17021-1:2015', approvedBy: 'CEO', approvedDate: '2023-11-18' },
                { version: '3.0', date: '2022-06-10', author: 'Quality Manager', changes: 'Annual review - minor updates', approvedBy: 'CEO', approvedDate: '2022-06-15' },
                { version: '2.0', date: '2021-03-05', author: 'Quality Manager', changes: 'Added impartiality committee procedures', approvedBy: 'CEO', approvedDate: '2021-03-10' }
            ]
        },
        {
            id: 2,
            title: 'Certification Decision Procedure',
            type: 'Procedure',
            client: 'CB Internal',
            date: '2023-12-10',
            size: '1.1 MB',
            status: 'Approved',
            version: '2.1',
            documentNumber: 'PR-001',
            controlStatus: 'Controlled',
            owner: 'Certification Manager',
            nextReviewDate: '2024-12-10',
            reviewFrequency: 'Annual',
            distributionList: ['Certification Managers', 'Lead Auditors'],
            confidentiality: 'Internal',
            revisionHistory: [
                { version: '2.1', date: '2023-12-10', author: 'Certification Manager', changes: 'Added independence checklist', approvedBy: 'Quality Manager', approvedDate: '2023-12-12' },
                { version: '2.0', date: '2023-01-15', author: 'Certification Manager', changes: 'Revised decision workflow', approvedBy: 'Quality Manager', approvedDate: '2023-01-18' }
            ]
        },
        {
            id: 3,
            title: 'Auditor Competence Procedure',
            type: 'Procedure',
            client: 'CB Internal',
            date: '2023-10-05',
            size: '0.8 MB',
            status: 'Approved',
            version: '3.0',
            documentNumber: 'PR-002',
            controlStatus: 'Controlled',
            owner: 'HR Manager',
            nextReviewDate: '2024-10-05',
            reviewFrequency: 'Annual',
            distributionList: ['HR', 'Lead Auditors', 'Management'],
            confidentiality: 'Internal',
            revisionHistory: [
                { version: '3.0', date: '2023-10-05', author: 'HR Manager', changes: 'Updated competence criteria per IRCA requirements', approvedBy: 'Quality Manager', approvedDate: '2023-10-08' }
            ]
        },
        {
            id: 4,
            title: 'Internal Audit Procedure',
            type: 'Procedure',
            client: 'CB Internal',
            date: '2024-01-20',
            size: '1.2 MB',
            status: 'Draft',
            version: '1.1-DRAFT',
            documentNumber: 'PR-003',
            controlStatus: 'Draft',
            owner: 'Quality Manager',
            nextReviewDate: null,
            reviewFrequency: 'Annual',
            distributionList: ['Quality Team'],
            confidentiality: 'Internal',
            revisionHistory: [
                { version: '1.1-DRAFT', date: '2024-01-20', author: 'Quality Manager', changes: 'Adding annual schedule requirements', approvedBy: null, approvedDate: null },
                { version: '1.0', date: '2023-06-15', author: 'Quality Manager', changes: 'Initial release', approvedBy: 'CEO', approvedDate: '2023-06-18' }
            ]
        },
        {
            id: 5,
            title: 'Audit Report Template',
            type: 'Template',
            client: 'CB Internal',
            date: '2023-11-28',
            size: '0.3 MB',
            status: 'Approved',
            version: '5.0',
            documentNumber: 'TM-001',
            controlStatus: 'Controlled',
            owner: 'Operations Manager',
            nextReviewDate: '2024-11-28',
            reviewFrequency: 'Annual',
            distributionList: ['Auditors', 'Lead Auditors'],
            confidentiality: 'Internal',
            revisionHistory: [
                { version: '5.0', date: '2023-11-28', author: 'Operations', changes: 'Added NCR severity classification', approvedBy: 'Quality Manager', approvedDate: '2023-11-30' }
            ]
        }
    ];
}

function renderDocuments() {
    const searchTerm = state.documentSearchTerm || '';
    const filterType = state.documentFilterType || 'All';
    const activeTab = state.documentActiveTab || 'library';

    // Filter documents
    let filteredDocs = state.documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.documentNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' || doc.type === filterType;
        return matchesSearch && matchesType;
    });

    // Calculate stats for dashboard
    const totalDocs = state.documents.length;
    const controlledDocs = state.documents.filter(d => d.controlStatus === 'Controlled').length;
    const draftDocs = state.documents.filter(d => d.status === 'Draft').length;
    const today = new Date();
    const reviewDueDocs = state.documents.filter(d => {
        if (!d.nextReviewDate) return false;
        const reviewDate = new Date(d.nextReviewDate);
        const daysUntil = Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 && daysUntil > -365;
    }).length;

    // Check if review is due/overdue
    const getReviewStatus = (nextReviewDate) => {
        if (!nextReviewDate) return { status: 'none', label: 'Not Set', color: '#6b7280' };
        const reviewDate = new Date(nextReviewDate);
        const daysUntil = Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) return { status: 'overdue', label: `${Math.abs(daysUntil)} days overdue`, color: '#dc2626' };
        if (daysUntil <= 30) return { status: 'due', label: `Due in ${daysUntil} days`, color: '#f59e0b' };
        return { status: 'ok', label: nextReviewDate, color: '#10b981' };
    };

    const rows = filteredDocs.map(doc => {
        const reviewStatus = getReviewStatus(doc.nextReviewDate);
        return `
        <tr class="document-row" style="cursor: pointer;">
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary-color); font-size: 1.2rem;">
                        <i class="fa-solid ${getDocumentIcon(doc.type)}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500;">${window.UTILS.escapeHtml(doc.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${window.UTILS.escapeHtml(doc.documentNumber || 'No Doc #')} • ${window.UTILS.escapeHtml(doc.size)}
                        </div>
                    </div>
                </div>
            </td>
            <td>${window.UTILS.escapeHtml(doc.type)}</td>
            <td><span class="badge bg-blue">${window.UTILS.escapeHtml(doc.version || '1.0')}</span></td>
            <td>
                <span class="badge" style="background: ${doc.controlStatus === 'Controlled' ? '#dcfce7' : doc.controlStatus === 'Draft' ? '#fef3c7' : '#f3f4f6'}; color: ${doc.controlStatus === 'Controlled' ? '#166534' : doc.controlStatus === 'Draft' ? '#92400e' : '#374151'};">
                    ${window.UTILS.escapeHtml(doc.controlStatus || 'Uncontrolled')}
                </span>
            </td>
            <td><span class="status-badge status-${(doc.status || '').toLowerCase()}">${window.UTILS.escapeHtml(doc.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-icon" data-action="viewDocumentHistory" data-id="${doc.id}" title="Revision History">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #7c3aed;"></i>
                </button>
                <button class="btn btn-sm btn-icon" data-action="viewDocumentDetails" data-id="${doc.id}" title="Document Details">
                    <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                </button>
                ${doc.status === 'Draft' ? `
                    <button class="btn btn-sm btn-success" data-action="approveDocument" data-id="${doc.id}" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-icon" data-action="createNewRevision" data-id="${doc.id}" title="New Revision">
                    <i class="fa-solid fa-code-branch" style="color: #0284c7;"></i>
                </button>
                <button class="btn btn-sm btn-icon" data-action="downloadDocument" data-id="${doc.id}" title="Download">
                    <i class="fa-solid fa-download" style="color: var(--primary-color);"></i>
                </button>
                <button class="btn btn-sm btn-icon" data-action="deleteDocument" data-id="${doc.id}" title="Delete">
                    <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');

    // Master Document List rows
    const mdlRows = filteredDocs.map(doc => {
        const reviewStatus = getReviewStatus(doc.nextReviewDate);
        return `
        <tr>
            <td><strong>${window.UTILS.escapeHtml(doc.documentNumber || '-')}</strong></td>
            <td>${window.UTILS.escapeHtml(doc.title)}</td>
            <td>${window.UTILS.escapeHtml(doc.type)}</td>
            <td><span class="badge bg-blue">${window.UTILS.escapeHtml(doc.version || '1.0')}</span></td>
            <td>${window.UTILS.escapeHtml(doc.owner || '-')}</td>
            <td>
                <span style="color: ${reviewStatus.color}; font-weight: ${reviewStatus.status === 'overdue' ? 'bold' : 'normal'};">
                    ${reviewStatus.status === 'overdue' ? '<i class="fa-solid fa-exclamation-triangle" style="margin-right: 4px;"></i>' : ''}
                    ${reviewStatus.status === 'due' ? '<i class="fa-solid fa-clock" style="margin-right: 4px;"></i>' : ''}
                    ${window.UTILS.escapeHtml(reviewStatus.label)}
                </span>
            </td>
            <td>
                <span class="badge" style="background: ${doc.controlStatus === 'Controlled' ? '#dcfce7' : '#f3f4f6'}; color: ${doc.controlStatus === 'Controlled' ? '#166534' : '#374151'};">
                    ${window.UTILS.escapeHtml(doc.controlStatus || 'Uncontrolled')}
                </span>
            </td>
            <td>${(doc.distributionList || []).map(d => `<span class="badge" style="background: #e0f2fe; color: #0369a1; margin: 2px;">${window.UTILS.escapeHtml(d)}</span>`).join(' ') || '-'}</td>
        </tr>
    `;
    }).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin: 0;">Document Control</h2>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary);">ISO 17021-1 Clause 8.3 - Control of Documents</p>
                </div>
                <button class="btn btn-primary" data-action="openUploadModal">
                    <i class="fa-solid fa-cloud-upload-alt" style="margin-right: 0.5rem;"></i> Upload Document
                </button>
            </div>

            <!-- Stats Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-file-alt"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Documents</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">${totalDocs}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-lock"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Controlled</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${controlledDocs}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-edit"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Drafts</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${draftDocs}</div>
                    </div>
                </div>
                <div class="card" style="margin: 0; padding: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: ${reviewDueDocs > 0 ? '#fee2e2' : '#f3f4f6'}; color: ${reviewDueDocs > 0 ? '#dc2626' : '#6b7280'}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                        <i class="fa-solid fa-calendar-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Review Due</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: ${reviewDueDocs > 0 ? '#dc2626' : '#16a34a'};">${reviewDueDocs}</div>
                    </div>
                </div>
            </div>

            <!-- Tab Buttons -->
            <div class="card">
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem;">
                    <button class="btn ${activeTab === 'library' ? 'btn-primary' : 'btn-secondary'}" data-action="switchDocumentTab" data-id="library">
                        <i class="fa-solid fa-folder-open" style="margin-right: 0.5rem;"></i>Document Library
                    </button>
                    <button class="btn ${activeTab === 'masterlist' ? 'btn-primary' : 'btn-secondary'}" data-action="switchDocumentTab" data-id="masterlist">
                        <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i>Master Document List
                    </button>
                    <div style="flex: 1;"></div>
                    <button class="btn btn-sm btn-outline-secondary" data-action="printMasterDocumentList">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>Print MDL
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="exportMasterDocumentList">
                        <i class="fa-solid fa-file-csv" style="margin-right: 0.5rem;"></i>Export CSV
                    </button>
                </div>

                <!-- Filters -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <input type="text" id="doc-search" placeholder="Search documents..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="doc-filter" style="max-width: 150px; margin-bottom: 0;">
                        <option value="All" ${filterType === 'All' ? 'selected' : ''}>All Types</option>
                        <option value="Manual" ${filterType === 'Manual' ? 'selected' : ''}>Manuals</option>
                        <option value="Procedure" ${filterType === 'Procedure' ? 'selected' : ''}>Procedures</option>
                        <option value="Template" ${filterType === 'Template' ? 'selected' : ''}>Templates</option>
                        <option value="Record" ${filterType === 'Record' ? 'selected' : ''}>Records</option>
                        <option value="Certificate" ${filterType === 'Certificate' ? 'selected' : ''}>Certificates</option>
                    </select>
                </div>

                ${activeTab === 'library' ? `
                    <!-- Drag & Drop Zone -->
                    <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2rem; text-align: center; background: #f8fafc; margin-bottom: 1.5rem; transition: all 0.3s ease;">
                        <i class="fa-solid fa-cloud-upload-alt" style="font-size: 2.5rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></i>
                        <h3 style="font-size: 1rem; margin-bottom: 0.25rem;">Drag and drop files here</h3>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem;">Supported formats: PDF, DOCX, XLSX, JPG (Max 10MB)</p>
                        <button class="btn btn-sm btn-secondary" data-action="openUploadModal">Browse Files</button>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Document Name</th>
                                    <th>Type</th>
                                    <th>Version</th>
                                    <th>Control Status</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No documents found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <!-- Master Document List View -->
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                        <strong>Master Document List (MDL)</strong> - ISO 17021-1 Clause 8.3 requires maintaining a list of all controlled documents with current versions, owners, and review schedules.
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Doc #</th>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Version</th>
                                    <th>Owner</th>
                                    <th>Next Review</th>
                                    <th>Control Status</th>
                                    <th>Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${mdlRows || '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No documents found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('doc-search')?.addEventListener('input', (e) => {
        state.documentSearchTerm = e.target.value;
        renderDocuments();
    });

    document.getElementById('doc-filter')?.addEventListener('change', (e) => {
        state.documentFilterType = e.target.value;
        renderDocuments();
    });

    // Drag and drop functionality
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary-color)';
            dropZone.style.background = '#eef2ff';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = '#f8fafc';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = '#f8fafc';
            alert('File upload simulation: Files dropped successfully!');
        });
    }
}

function getDocumentIcon(type) {
    switch (type) {
        case 'Manual': return 'fa-book';
        case 'Procedure': return 'fa-file-alt';
        case 'Record': return 'fa-clipboard-check';
        case 'Certificate': return 'fa-certificate';
        default: return 'fa-file';
    }
}

function openUploadModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Upload Document';
    modalBody.innerHTML = `
        <form id="upload-form">
            <div class="form-group">
                <label>Document Title</label>
                <input type="text" class="form-control" id="doc-title" required placeholder="e.g., Quality Manual v1.0">
            </div>
            <div class="form-group">
                <label>Document Type</label>
                <select class="form-control" id="doc-type">
                    <option value="Manual">Manual</option>
                    <option value="Procedure">Procedure</option>
                    <option value="Record">Record</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Related Client</label>
                <select class="form-control" id="doc-client" ${window.state.activeClientId ? 'disabled' : ''}>
                    <option value="">-- Select Client --</option>
                    ${state.clients.map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${String(window.state.activeClientId) === String(c.id) ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>File Select</label>
                <input type="file" class="form-control" id="doc-file" required>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="doc-status">
                    <option value="Draft">Draft</option>
                    <option value="Review">In Review</option>
                    <option value="Approved">Approved</option>
                </select>
            </div>
        </form>
    `;

    openModal();

    modalSave.onclick = () => {
        const title = document.getElementById('doc-title').value;
        const type = document.getElementById('doc-type').value;
        const client = document.getElementById('doc-client').value;
        const status = document.getElementById('doc-status').value;

        if (title) {
            const newDoc = {
                id: Date.now(),
                title: title,
                type: type,
                client: client || 'Internal',
                date: new Date().toISOString().split('T')[0],
                size: (Math.random() * 5).toFixed(1) + ' MB', // Mock size
                status: status
            };

            state.documents.unshift(newDoc);
            saveData();
            closeModal();
            renderDocuments();
            showNotification('Document uploaded successfully');
        }
    };
}

function downloadDocument(id) {
    showNotification('Downloading document...');
    // Simulation
}

function deleteDocument(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        state.documents = state.documents.filter(d => String(d.id) !== String(id));
        saveData();
        renderDocuments();
        showNotification('Document deleted');
    }
}

// ============================================
// VERSION CONTROL FUNCTIONS (ISO 17021 Clause 8.3)
// ============================================

window.viewDocumentHistory = function (docId) {
    const doc = state.documents.find(d => String(d.id) === String(docId));
    if (!doc) return;

    const history = doc.revisionHistory || [];

    document.getElementById('modal-title').textContent = `Revision History - ${doc.title}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #eff6ff; border-radius: 8px;">
            <strong>Current Version:</strong> ${window.UTILS.escapeHtml(doc.version || '1.0')}<br>
            <strong>Status:</strong> <span class="badge ${doc.status === 'Approved' ? 'bg-green' : 'bg-orange'}">${window.UTILS.escapeHtml(doc.status)}</span>
        </div>
        
        <h4 style="margin-bottom: 1rem; color: #0369a1;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.5rem;"></i>
            Version History
        </h4>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Date</th>
                        <th>Author</th>
                        <th>Changes</th>
                        <th>Approved By</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.length > 0 ? history.map(rev => `
                        <tr>
                            <td><span class="badge bg-blue">${window.UTILS.escapeHtml(rev.version)}</span></td>
                            <td>${window.UTILS.escapeHtml(rev.date)}</td>
                            <td>${window.UTILS.escapeHtml(rev.author)}</td>
                            <td style="max-width: 200px;">${window.UTILS.escapeHtml(rev.changes)}</td>
                            <td>
                                ${rev.approvedBy ? `
                                    <span style="color: green;">
                                        <i class="fa-solid fa-check-circle"></i>
                                        ${window.UTILS.escapeHtml(rev.approvedBy)}<br>
                                        <small>${window.UTILS.escapeHtml(rev.approvedDate)}</small>
                                    </span>
                                ` : '<span style="color: orange;">Pending</span>'}
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No revision history</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 1rem; padding: 0.75rem; background: #f0fdf4; border-left: 4px solid #059669; border-radius: 4px;">
            <small style="color: #065f46;">
                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                ISO 17021-1 Clause 8.3 requires controlled documents with version tracking and approval records.
            </small>
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.approveDocument = function (docId) {
    const doc = state.documents.find(d => String(d.id) === String(docId));
    if (!doc) return;

    document.getElementById('modal-title').textContent = 'Approve Document';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 8px;">
            <strong>Document:</strong> ${window.UTILS.escapeHtml(doc.title)}<br>
            <strong>Version:</strong> ${window.UTILS.escapeHtml(doc.version || '1.0')}
        </div>
        <form id="approve-form">
            <div class="form-group">
                <label>Approved By <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="approved-by" placeholder="e.g., Quality Manager" required>
            </div>
            <div class="form-group">
                <label>Approval Date</label>
                <input type="date" class="form-control" id="approval-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label>Comments</label>
                <textarea class="form-control" id="approval-comments" rows="2" placeholder="Optional approval comments..."></textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const approvedBy = document.getElementById('approved-by').value.trim();
        const approvalDate = document.getElementById('approval-date').value;

        if (!approvedBy) {
            showNotification('Please enter approver name', 'error');
            return;
        }

        doc.status = 'Approved';

        // Update the latest revision with approval info
        if (doc.revisionHistory && doc.revisionHistory.length > 0) {
            doc.revisionHistory[0].approvedBy = approvedBy;
            doc.revisionHistory[0].approvedDate = approvalDate;
        }

        // Remove DRAFT from version if present
        if (doc.version && doc.version.includes('DRAFT')) {
            doc.version = doc.version.replace('-DRAFT', '');
        }

        saveData();
        closeModal();
        renderDocuments();
        showNotification('Document approved successfully', 'success');
    };

    window.openModal();
};

window.createNewRevision = function (docId) {
    const doc = state.documents.find(d => String(d.id) === String(docId));
    if (!doc) return;

    document.getElementById('modal-title').textContent = 'Create New Revision';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #eff6ff; border-radius: 8px;">
            <strong>Document:</strong> ${window.UTILS.escapeHtml(doc.title)}<br>
            <strong>Current Version:</strong> ${window.UTILS.escapeHtml(doc.version || '1.0')}
        </div>
        <form id="revision-form">
            <div class="form-group">
                <label>New Version Number <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="new-version" placeholder="e.g., 4.1" required>
            </div>
            <div class="form-group">
                <label>Author <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="revision-author" placeholder="e.g., Quality Manager" required>
            </div>
            <div class="form-group">
                <label>Changes Made <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="revision-changes" rows="3" placeholder="Describe the changes in this revision..." required></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="submit-as-draft" checked style="width: 18px; height: 18px;">
                    <span>Submit as Draft (requires approval)</span>
                </label>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = '';
    document.getElementById('modal-save').onclick = () => {
        const newVersion = document.getElementById('new-version').value.trim();
        const author = document.getElementById('revision-author').value.trim();
        const changes = document.getElementById('revision-changes').value.trim();
        const isDraft = document.getElementById('submit-as-draft').checked;

        if (!newVersion || !author || !changes) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Add to revision history
        if (!doc.revisionHistory) doc.revisionHistory = [];
        doc.revisionHistory.unshift({
            version: isDraft ? newVersion + '-DRAFT' : newVersion,
            date: new Date().toISOString().split('T')[0],
            author: author,
            changes: changes,
            approvedBy: isDraft ? null : author,
            approvedDate: isDraft ? null : new Date().toISOString().split('T')[0]
        });

        doc.version = isDraft ? newVersion + '-DRAFT' : newVersion;
        doc.status = isDraft ? 'Draft' : 'Approved';
        doc.date = new Date().toISOString().split('T')[0];

        saveData();
        closeModal();
        renderDocuments();
        showNotification('New revision created successfully', 'success');
    };

    window.openModal();
};

// ============================================
// DOCUMENT CONTROL HELPER FUNCTIONS (ISO 17021 Clause 8.3)
// ============================================

window.switchDocumentTab = function (tabName) {
    state.documentActiveTab = tabName;
    renderDocuments();
};

window.viewDocumentDetails = function (docId) {
    const doc = state.documents.find(d => String(d.id) === String(docId));
    if (!doc) return;

    document.getElementById('modal-title').textContent = `Document Details - ${doc.title}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
                <h4 style="margin: 0 0 1rem 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-file-alt" style="margin-right: 0.5rem; color: var(--primary-color);"></i>Document Information
                </h4>
                <table style="width: 100%; font-size: 0.9rem;">
                    <tr><td style="padding: 0.5rem 0; color: #6b7280; width: 40%;">Document #:</td><td style="font-weight: 500;">${window.UTILS.escapeHtml(doc.documentNumber || 'Not Assigned')}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Title:</td><td style="font-weight: 500;">${window.UTILS.escapeHtml(doc.title)}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Type:</td><td>${window.UTILS.escapeHtml(doc.type)}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Version:</td><td><span class="badge bg-blue">${window.UTILS.escapeHtml(doc.version || '1.0')}</span></td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Status:</td><td><span class="status-badge status-${(doc.status || '').toLowerCase()}">${window.UTILS.escapeHtml(doc.status)}</span></td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Last Modified:</td><td>${window.UTILS.escapeHtml(doc.date)}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">File Size:</td><td>${window.UTILS.escapeHtml(doc.size)}</td></tr>
                </table>
            </div>
            <div>
                <h4 style="margin: 0 0 1rem 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">
                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem; color: #16a34a;"></i>Control Information
                </h4>
                <table style="width: 100%; font-size: 0.9rem;">
                    <tr><td style="padding: 0.5rem 0; color: #6b7280; width: 40%;">Control Status:</td><td>
                        <span class="badge" style="background: ${doc.controlStatus === 'Controlled' ? '#dcfce7' : '#fef3c7'}; color: ${doc.controlStatus === 'Controlled' ? '#166534' : '#92400e'};">
                            ${window.UTILS.escapeHtml(doc.controlStatus || 'Uncontrolled')}
                        </span>
                    </td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Owner:</td><td style="font-weight: 500;">${window.UTILS.escapeHtml(doc.owner || 'Not Assigned')}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Review Frequency:</td><td>${window.UTILS.escapeHtml(doc.reviewFrequency || 'Not Set')}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Next Review:</td><td>${window.UTILS.escapeHtml(doc.nextReviewDate || 'Not Scheduled')}</td></tr>
                    <tr><td style="padding: 0.5rem 0; color: #6b7280;">Confidentiality:</td><td>${window.UTILS.escapeHtml(doc.confidentiality || 'Internal')}</td></tr>
                </table>
            </div>
        </div>
        <div style="margin-top: 1.5rem;">
            <h4 style="margin: 0 0 1rem 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">
                <i class="fa-solid fa-users" style="margin-right: 0.5rem; color: #0284c7;"></i>Distribution List
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${(doc.distributionList || []).length > 0
            ? doc.distributionList.map(d => `<span class="badge" style="background: #e0f2fe; color: #0369a1;">${window.UTILS.escapeHtml(d)}</span>`).join('')
            : '<span style="color: #6b7280;">No distribution list defined</span>'
        }
            </div>
        </div>
        <div style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px;">
            <small style="color: #166534;">
                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                ISO 17021-1 Clause 8.3 requires controlled documents with version tracking, approval records, and distribution control.
            </small>
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.printMasterDocumentList = function () {
    const printWindow = window.open('', 'PrintMDL', 'width=1200,height=800');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }

    const docs = state.documents || [];
    const rows = docs.map(doc => `
        <tr>
            <td>${window.UTILS.escapeHtml(doc.documentNumber || '-')}</td>
            <td>${window.UTILS.escapeHtml(doc.title)}</td>
            <td>${window.UTILS.escapeHtml(doc.type)}</td>
            <td>${window.UTILS.escapeHtml(doc.version || '1.0')}</td>
            <td>${window.UTILS.escapeHtml(doc.status)}</td>
            <td>${window.UTILS.escapeHtml(doc.owner || '-')}</td>
            <td>${window.UTILS.escapeHtml(doc.nextReviewDate || '-')}</td>
            <td>${window.UTILS.escapeHtml(doc.controlStatus || 'Uncontrolled')}</td>
            <td>${(doc.distributionList || []).join(', ') || '-'}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Master Document List - AuditCB360</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
                h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; font-size: 18px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background: #1e3a5f; color: white; font-size: 10px; }
                tr:nth-child(even) { background: #f8f9fa; }
                .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; }
                .footer { margin-top: 20px; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <h1>Master Document List (MDL)</h1>
            <div class="header-info">
                <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
                <div><strong>Total Documents:</strong> ${docs.length}</div>
                <div><strong>Controlled:</strong> ${docs.filter(d => d.controlStatus === 'Controlled').length}</div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Doc #</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Next Review</th>
                        <th>Control</th>
                        <th>Distribution</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="9" style="text-align: center;">No documents</td></tr>'}
                </tbody>
            </table>
            
            <div class="footer">
                <p><strong>ISO 17021-1 Clause 8.3</strong> - Control of Documents</p>
                <p>This Master Document List is maintained as evidence of document control per accreditation requirements.</p>
                <p>AuditCB360 Certification Body Management System</p>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
};

window.exportMasterDocumentList = function () {
    const docs = state.documents || [];

    // CSV header
    let csv = 'Document Number,Title,Type,Version,Status,Owner,Next Review Date,Control Status,Review Frequency,Confidentiality,Distribution List\n';

    // Add rows
    docs.forEach(doc => {
        const row = [
            doc.documentNumber || '',
            `"${(doc.title || '').replace(/"/g, '""')}"`,
            doc.type || '',
            doc.version || '1.0',
            doc.status || '',
            doc.owner || '',
            doc.nextReviewDate || '',
            doc.controlStatus || 'Uncontrolled',
            doc.reviewFrequency || '',
            doc.confidentiality || '',
            `"${(doc.distributionList || []).join(', ')}"`
        ];
        csv += row.join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Master_Document_List_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showNotification('Master Document List exported successfully', 'success');
};

// Export functions
window.renderDocuments = renderDocuments;
window.openUploadModal = openUploadModal;
window.downloadDocument = downloadDocument;
window.deleteDocument = deleteDocument;

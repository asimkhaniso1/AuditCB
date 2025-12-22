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
            revisionHistory: [
                { version: '5.0', date: '2023-11-28', author: 'Operations', changes: 'Added NCR severity classification', approvedBy: 'Quality Manager', approvedDate: '2023-11-30' }
            ]
        }
    ];
}

function renderDocuments() {
    const searchTerm = state.documentSearchTerm || '';
    const filterType = state.documentFilterType || 'All';

    // Filter documents
    let filteredDocs = state.documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.client.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' || doc.type === filterType;
        return matchesSearch && matchesType;
    });

    const rows = filteredDocs.map(doc => `
        <tr class="document-row" style="cursor: pointer;">
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary-color); font-size: 1.2rem;">
                        <i class="fa-solid ${getDocumentIcon(doc.type)}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500;">${window.UTILS.escapeHtml(doc.title)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${window.UTILS.escapeHtml(doc.size)}</div>
                    </div>
                </div>
            </td>
            <td>${window.UTILS.escapeHtml(doc.type)}</td>
            <td><span class="badge bg-blue">${window.UTILS.escapeHtml(doc.version || '1.0')}</span></td>
            <td>${window.UTILS.escapeHtml(doc.date)}</td>
            <td><span class="status-badge status-${(doc.status || '').toLowerCase()}">${window.UTILS.escapeHtml(doc.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-icon" onclick="viewDocumentHistory(${doc.id})" title="Revision History">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #7c3aed;"></i>
                </button>
                ${doc.status === 'Draft' ? `
                    <button class="btn btn-sm btn-success" onclick="approveDocument(${doc.id})" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-icon" onclick="createNewRevision(${doc.id})" title="New Revision">
                    <i class="fa-solid fa-code-branch" style="color: #0284c7;"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="downloadDocument(${doc.id})" title="Download">
                    <i class="fa-solid fa-download" style="color: var(--primary-color);"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="deleteDocument(${doc.id})" title="Delete">
                    <i class="fa-solid fa-trash" style="color: var(--danger-color);"></i>
                </button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
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
                <button class="btn btn-primary" onclick="openUploadModal()">
                    <i class="fa-solid fa-cloud-upload-alt" style="margin-right: 0.5rem;"></i> Upload Document
                </button>
            </div>

            <!-- Drag & Drop Zone -->
            <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2rem; text-align: center; background: #f8fafc; margin-bottom: 2rem; transition: all 0.3s ease;">
                <i class="fa-solid fa-cloud-upload-alt" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Drag and drop files here</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Supported formats: PDF, DOCX, XLSX, JPG (Max 10MB)</p>
                <button class="btn btn-secondary" onclick="openUploadModal()">Browse Files</button>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Document Name</th>
                            <th>Type</th>
                            <th>Version</th>
                            <th>Last Modified</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No documents found</td></tr>'}
                    </tbody>
                </table>
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
                    ${state.clients.map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${window.state.activeClientId === c.id ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
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
        state.documents = state.documents.filter(d => d.id !== id);
        saveData();
        renderDocuments();
        showNotification('Document deleted');
    }
}

// ============================================
// VERSION CONTROL FUNCTIONS (ISO 17021 Clause 8.3)
// ============================================

window.viewDocumentHistory = function (docId) {
    const doc = state.documents.find(d => d.id === docId);
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
    const doc = state.documents.find(d => d.id === docId);
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
    const doc = state.documents.find(d => d.id === docId);
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

// Export functions
window.renderDocuments = renderDocuments;
window.openUploadModal = openUploadModal;
window.downloadDocument = downloadDocument;
window.deleteDocument = deleteDocument;

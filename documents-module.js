// ============================================
// DOCUMENT MANAGEMENT MODULE
// ============================================

// Initial mock data for documents if not present
if (!state.documents) {
    state.documents = [
        { id: 1, title: 'Quality Manual v4.0', type: 'Manual', client: 'Acme Corp', date: '2023-11-15', size: '2.4 MB', status: 'Approved' },
        { id: 2, title: 'Audit Report - Stage 1', type: 'Record', client: 'Acme Corp', date: '2023-12-10', size: '1.1 MB', status: 'Final' },
        { id: 3, title: 'ISO 9001 Certificate', type: 'Certificate', client: 'TechStart Inc', date: '2023-10-05', size: '0.5 MB', status: 'Active' },
        { id: 4, title: 'Procedure - Internal Audit', type: 'Procedure', client: 'Global Logistics', date: '2023-09-20', size: '1.8 MB', status: 'Draft' },
        { id: 5, title: 'NC Report #452', type: 'Record', client: 'TechStart Inc', date: '2023-11-28', size: '0.3 MB', status: 'Closed' }
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
                        <div style="font-weight: 500;">${doc.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${doc.size}</div>
                    </div>
                </div>
            </td>
            <td>${doc.type}</td>
            <td>${doc.client}</td>
            <td>${doc.date}</td>
            <td><span class="status-badge status-${doc.status.toLowerCase()}">${doc.status}</span></td>
            <td>
                <button class="btn btn-sm" onclick="downloadDocument(${doc.id})" title="Download">
                    <i class="fa-solid fa-download" style="color: var(--primary-color);"></i>
                </button>
                <button class="btn btn-sm" onclick="deleteDocument(${doc.id})" title="Delete">
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
                            <th>Related Client</th>
                            <th>Date Added</th>
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
                <select class="form-control" id="doc-client">
                    <option value="">-- Select Client --</option>
                    ${state.clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
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

// Export functions
window.renderDocuments = renderDocuments;
window.openUploadModal = openUploadModal;
window.downloadDocument = downloadDocument;
window.deleteDocument = deleteDocument;

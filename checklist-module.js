// Checklist Library Module
// Manages audit checklists organized by ISO standard with Global/Custom types

// DOM Elements retrieved locally to avoid collision with script.js

// State for filtering
let checklistFilterStandard = 'all';
let checklistFilterType = 'all';
let checklistFilterAuditType = 'all';
let checklistFilterScope = 'all';
let checklistSearchTerm = '';

function renderChecklistLibrary() {
    const contentArea = document.getElementById('content-area');
    const userRole = (window.state.currentUser?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || window.state.settings?.isAdmin || false;
    const isCertManager = userRole === 'certification manager' || (window.CONSTANTS?.ROLES && userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER.toLowerCase());
    const canEditGlobal = isCertManager || isAdmin;
    const checklists = state.checklists || [];

    // Apply filters
    let filtered = checklists.filter(c => {
        const matchStandard = checklistFilterStandard === 'all' || c.standard === checklistFilterStandard;
        const matchType = checklistFilterType === 'all' || c.type === checklistFilterType;
        const matchScope = checklistFilterScope === 'all' || c.auditScope === checklistFilterScope;
        const matchAuditType = checklistFilterAuditType === 'all' || (c.auditType || 'initial') === checklistFilterAuditType;
        const matchSearch = checklistSearchTerm === '' ||
            c.name.toLowerCase().includes(checklistSearchTerm.toLowerCase()) ||
            c.standard.toLowerCase().includes(checklistSearchTerm.toLowerCase());
        // Hide archived unless explicitly filtered
        const matchArchived = checklistFilterType === 'archived' ? c.archived === true : !c.archived;
        return matchStandard && (checklistFilterType === 'archived' || matchType) && matchScope && matchAuditType && matchSearch && matchArchived;
    });

    // Separate global, custom, and archived
    const globalChecklists = filtered.filter(c => c.type === 'global' && !c.archived);
    const customChecklists = filtered.filter(c => c.type === 'custom' && !c.archived);
    const archivedChecklists = filtered.filter(c => c.archived);

    const standards = window.state.cbSettings?.availableStandards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
    const auditTypes = window.CONSTANTS?.AUDIT_TYPES || [];
    const auditScopes = window.CONSTANTS?.AUDIT_SCOPES || [];

    const html = `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; flex: 1;">
                    <input type="text" id="checklist-search" placeholder="Search..." value="${checklistSearchTerm}" style="max-width: 180px; margin-bottom: 0;">
                    <select id="checklist-filter-standard" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all">All Standards</option>
                        ${standards.map(s => `<option value="${window.UTILS.escapeHtml(s)}" ${checklistFilterStandard === s ? 'selected' : ''}>${window.UTILS.escapeHtml(s)}</option>`).join('')}
                    </select>
                    <select id="checklist-filter-type" style="max-width: 120px; margin-bottom: 0;">
                        <option value="all" ${checklistFilterType === 'all' ? 'selected' : ''}>All Types</option>
                        <option value="global" ${checklistFilterType === 'global' ? 'selected' : ''}>Global</option>
                        <option value="custom" ${checklistFilterType === 'custom' ? 'selected' : ''}>Custom</option>
                        <option value="archived" ${checklistFilterType === 'archived' ? 'selected' : ''}>Archived</option>
                    </select>
                    <select id="checklist-filter-audit-type" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all" ${checklistFilterAuditType === 'all' ? 'selected' : ''}>All Audit Types</option>
                        <option value="initial" ${checklistFilterAuditType === 'initial' ? 'selected' : ''}>Initial / Recert</option>
                        <option value="surveillance" ${checklistFilterAuditType === 'surveillance' ? 'selected' : ''}>Surveillance</option>
                    </select>
                    <select id="checklist-filter-scope" style="max-width: 140px; margin-bottom: 0;">
                        <option value="all" ${checklistFilterScope === 'all' ? 'selected' : ''}>All Scopes</option>
                        ${auditScopes.map(s => `<option value="${window.UTILS.escapeHtml(s)}" ${checklistFilterScope === s ? 'selected' : ''}>${window.UTILS.escapeHtml(s)}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button id="btn-import-checklist" class="btn btn-secondary">
                        <i class="fa-solid fa-file-import" style="margin-right: 0.5rem;"></i>Import Checklist
                    </button>
                    <button id="btn-new-checklist" class="btn btn-primary">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>New Checklist
                    </button>
                </div>
            </div>

            <!-- Cert Manager/Admin Badge -->
            ${canEditGlobal ? `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span>${isCertManager ? 'Certification Manager' : 'Admin'} Mode - You can create/edit/delete Global checklists</span>
                </div>
            ` : ''}

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin: 0;">${checklists.length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Checklists</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #0369a1; margin: 0;">${globalChecklists.length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Global</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #059669; margin: 0;">${customChecklists.length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Custom</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #d97706; margin: 0;">${checklists.filter(c => !c.archived).reduce((sum, c) => sum + (c.clauses ? c.clauses.reduce((s, cl) => s + (cl.subClauses || []).reduce((s2, sub) => s2 + (sub.items ? sub.items.length : 1), 0), 0) : (c.items?.length || 0)), 0)}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Items</p>
                </div>
            </div>

            <!-- Global Checklists Section -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">
                        <i class="fa-solid fa-globe" style="margin-right: 0.5rem; color: #0369a1;"></i>
                        Global Checklists
                        <span style="background: #e0f2fe; color: #0369a1; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; margin-left: 0.5rem;">${globalChecklists.length}</span>
                    </h3>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);"><i class="fa-solid fa-lock" style="margin-right: 0.25rem;"></i>Admin Only</span>
                </div>
                ${globalChecklists.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Checklist Name</th>
                                    <th>Standard</th>
                                    <th>Total Questions</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${globalChecklists.map(c => `
                                    <tr>
                                        <td style="font-weight: 500;">${window.UTILS.escapeHtml(c.name)}</td>
                                        <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(c.standard)}</span></td>
                                        <td>${c.clauses ? c.clauses.reduce((acc, cl) => acc + (cl.subClauses || []).reduce((s2, sub) => s2 + (sub.items ? sub.items.length : 1), 0), 0) : (c.items?.length || 0)}</td>
                                        <td>${window.UTILS.escapeHtml(c.updatedAt || c.createdAt)}</td>
                                        <td>
                                            <button class="btn btn-sm view-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                            <button class="btn btn-sm" onclick="window.printChecklist('${c.id}')" style="margin-right: 0.25rem;" title="Print">
                                                <i class="fa-solid fa-print"></i>
                                            </button>
                                            ${canEditGlobal ? `
                                                <button class="btn btn-sm edit-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                    <i class="fa-solid fa-edit"></i>
                                                </button>
                                                <button class="btn btn-sm btn-danger delete-checklist" data-id="${c.id}">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No global checklists found.</p>
                `}
            </div>

            <!-- Custom Checklists Section -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">
                        <i class="fa-solid fa-user" style="margin-right: 0.5rem; color: #059669;"></i>
                        Custom Checklists
                        <span style="background: #d1fae5; color: #059669; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; margin-left: 0.5rem;">${customChecklists.length}</span>
                    </h3>
                </div>
                ${customChecklists.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Checklist Name</th>
                                    <th>Standard</th>
                                    <th>Total Questions</th>
                                    <th>Created By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customChecklists.map(c => `
                                    <tr>
                                        <td style="font-weight: 500;">${window.UTILS.escapeHtml(c.name)}</td>
                                        <td><span style="background: #d1fae5; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${window.UTILS.escapeHtml(c.standard)}</span></td>
                                        <td>${c.clauses ? c.clauses.reduce((acc, cl) => acc + (cl.subClauses || []).reduce((s2, sub) => s2 + (sub.items ? sub.items.length : 1), 0), 0) : (c.items?.length || 0)}</td>
                                        <td>${window.UTILS.escapeHtml(c.createdBy || 'Unknown')}</td>
                                        <td>
                                            <button class="btn btn-sm view-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                            <button class="btn btn-sm" onclick="window.printChecklist('${c.id}')" style="margin-right: 0.25rem;" title="Print">
                                                <i class="fa-solid fa-print"></i>
                                            </button>
                                            <button class="btn btn-sm edit-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button class="btn btn-sm btn-danger delete-checklist" data-id="${c.id}">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No custom checklists found. Create one to get started!</p>
                `}
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Event Listeners
    document.getElementById('btn-new-checklist')?.addEventListener('click', openAddChecklistModal);
    document.getElementById('btn-import-checklist')?.addEventListener('click', openImportChecklistModal);

    document.getElementById('checklist-search')?.addEventListener('input', (e) => {
        checklistSearchTerm = e.target.value;
        renderChecklistLibrary();
    });

    document.getElementById('checklist-filter-standard')?.addEventListener('change', (e) => {
        checklistFilterStandard = e.target.value;
        renderChecklistLibrary();
    });

    document.getElementById('checklist-filter-type')?.addEventListener('change', (e) => {
        checklistFilterType = e.target.value;
        renderChecklistLibrary();
    });

    document.getElementById('checklist-filter-audit-type')?.addEventListener('change', (e) => {
        checklistFilterAuditType = e.target.value;
        renderChecklistLibrary();
    });

    document.getElementById('checklist-filter-scope')?.addEventListener('change', (e) => {
        checklistFilterScope = e.target.value;
        renderChecklistLibrary();
    });

    document.querySelectorAll('.view-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            viewChecklistDetail(id);
        });
    });

    document.querySelectorAll('.edit-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            openEditChecklistModal(id);
        });
    });

    document.querySelectorAll('.delete-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            deleteChecklist(id);
        });
    });
}


// Helper function to auto-generate ISO clause section titles
function getClauseTitleFromNumber(clauseNum) {
    const isoClauseTitles = {
        '4': 'Context of the Organization',
        '5': 'Leadership',
        '6': 'Planning',
        '7': 'Support',
        '8': 'Operation',
        '9': 'Performance Evaluation',
        '10': 'Improvement',
        'A': 'Annex A Controls',
        'General': 'General Requirements'
    };
    return isoClauseTitles[clauseNum] || `Clause ${clauseNum}`;
}

// Download CSV template for bulk checklist upload
function downloadChecklistTemplate() {
    const template = `Clause,Requirement
4.1,Has the organization determined external and internal issues relevant to its purpose?
4.2,Have the needs and expectations of interested parties been determined?
4.3,Is the scope of the management system determined and documented?
5.1,Does top management demonstrate leadership and commitment?
5.2,Is the policy established, communicated, and understood?
6.1,Have risks and opportunities been addressed?
6.2,Are objectives established at relevant functions and levels?
7.1,Are resources determined and provided?
7.2,Are persons competent based on education, training, or experience?
8.1,Are operational processes planned and controlled?
9.1,Is performance monitored and measured?
9.2,Are internal audits conducted at planned intervals?
10.1,Are opportunities for improvement identified?
10.2,Are nonconformities and corrective actions managed?`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'checklist_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    window.showNotification('Template downloaded! Edit and import it back.', 'success');
}

window.downloadChecklistTemplate = downloadChecklistTemplate;

// Import Checklist Modal - allows bulk import from CSV
function openImportChecklistModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    const modalCancel = document.getElementById('modal-cancel');

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
    const canEditGlobal = isCertManager || isAdmin;

    modalTitle.textContent = 'Import Checklist from CSV';
    modalBody.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <div style="background: #e0f2fe; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <i class="fa-solid fa-lightbulb" style="color: #0284c7; margin-right: 0.5rem;"></i>
                <span style="color: #0284c7;">
                    Upload a CSV file with audit checklist items. The file should have columns: <strong>Clause, Requirement</strong>
                </span>
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="window.downloadChecklistTemplate()">
                <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i>Download Template
            </button>
        </div>

        <form id="import-checklist-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group">
                    <label>Checklist Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="import-checklist-name" placeholder="e.g. ISO 9001 Full Audit Checklist" required>
                </div>
                <div class="form-group">
                    <label>Standard</label>
                    <select class="form-control" id="import-checklist-standard">
                        ${standards.map(s => `<option value="${window.UTILS.escapeHtml(s)}">${window.UTILS.escapeHtml(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select class="form-control" id="import-checklist-type">
                        <option value="custom">Custom (Personal)</option>
                        ${canEditGlobal ? '<option value="global">Global (Organization-wide)</option>' : ''}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Select CSV File <span style="color: var(--danger-color);">*</span></label>
                <input type="file" class="form-control" id="import-checklist-file" accept=".csv" required>
                <small style="color: var(--text-secondary); margin-top: 0.25rem; display: block;">
                    Supported formats: CSV (comma-separated values)
                </small>
            </div>

            <div id="import-preview" style="display: none; margin-top: 1rem;">
                <h5 style="margin-bottom: 0.5rem;"><i class="fa-solid fa-eye" style="margin-right: 0.5rem;"></i>Preview</h5>
                <div id="import-preview-content" style="max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem;"></div>
            </div>
        </form>
    `;

    window.openModal();

    // File input change handler - show preview
    document.getElementById('import-checklist-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const text = event.target.result;
            const lines = text.split(/\r\n|\n/).filter(l => l.trim());

            const previewDiv = document.getElementById('import-preview');
            const previewContent = document.getElementById('import-preview-content');

            if (lines.length > 0) {
                previewDiv.style.display = 'block';
                const previewLines = lines.slice(0, 6);
                previewContent.innerHTML = `
                    <div style="margin-bottom: 0.5rem; color: var(--text-secondary);">
                        Found <strong>${lines.length - 1}</strong> items (excluding header)
                    </div>
                    <table style="width: 100%; font-size: 0.8rem;">
                        <thead>
                            <tr style="background: #e2e8f0;">
                                <th style="padding: 4px 8px;">Clause</th>
                                <th style="padding: 4px 8px;">Requirement</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${previewLines.map((line, idx) => {
                    if (idx === 0 && (line.toLowerCase().includes('clause') || line.toLowerCase().includes('requirement'))) {
                        return ''; // Skip header
                    }
                    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
                    if (parts.length >= 2) {
                        return `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #e2e8f0;">${window.UTILS.escapeHtml(parts[0])}</td><td style="padding: 4px 8px; border-bottom: 1px solid #e2e8f0;">${window.UTILS.escapeHtml(parts[1].substring(0, 60))}${parts[1].length > 60 ? '...' : ''}</td></tr>`;
                    }
                    return '';
                }).join('')}
                            ${lines.length > 6 ? '<tr><td colspan="2" style="padding: 4px 8px; text-align: center; color: var(--text-secondary);">... and more</td></tr>' : ''}
                        </tbody>
                    </table>
                `;
            }
        };
        reader.readAsText(file);
    });

    modalSave.textContent = 'Import Checklist';
    modalSave.style.display = 'inline-block';
    modalSave.onclick = async () => {
        const name = document.getElementById('import-checklist-name').value.trim();
        const standard = document.getElementById('import-checklist-standard').value;
        const type = document.getElementById('import-checklist-type').value;
        const fileInput = document.getElementById('import-checklist-file');

        if (!name) {
            window.showNotification('Please enter a checklist name', 'error');
            return;
        }

        if (!fileInput.files[0]) {
            window.showNotification('Please select a CSV file', 'error');
            return;
        }

        const file = fileInput.files[0];

        // Show processing state
        modalSave.textContent = 'Processing...';
        modalSave.disabled = true;

        // Upload file to Supabase Storage
        let cloudUrl = null;
        let cloudPath = null;
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                const timestamp = Date.now();
                const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                const filename = `${sanitizedName}_${timestamp}.csv`;
                const path = `checklists/${filename}`;

                const { data, error } = await window.SupabaseClient.client.storage
                    .from('checklists')
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) throw error;

                // Get public URL
                cloudUrl = window.SupabaseClient.storage.getPublicUrl('checklists', path);
                cloudPath = path;
                console.log('Checklist uploaded to cloud:', path);
            } catch (uploadErr) {
                console.error('Failed to upload checklist to cloud:', uploadErr);
                window.showNotification('File uploaded locally (cloud upload failed)', 'warning');
            }
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const text = event.target.result;
            const lines = text.split(/\r\n|\n/).filter(l => l.trim());

            const rawRows = [];
            lines.forEach((line, idx) => {
                // Skip header row
                if (idx === 0 && (line.toLowerCase().includes('clause') || line.toLowerCase().includes('requirement'))) {
                    return;
                }

                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
                if (parts.length >= 2) {
                    const clause = parts[0];
                    const requirement = parts[1];
                    const clauseParts = clause.split('.');
                    const mClause = clauseParts[0] || '';
                    const mTitle = getClauseTitleFromNumber(mClause);
                    rawRows.push({ mClause, mTitle, clause, requirement });
                }
            });

            if (rawRows.length === 0) {
                window.showNotification('No valid items found in the CSV file', 'error');
                modalSave.textContent = 'Import Checklist';
                modalSave.disabled = false;
                return;
            }

            // Build hierarchical structure
            const clauses = [];
            let currentMain = null;

            rawRows.forEach(row => {
                if (row.mClause) {
                    if (!currentMain || currentMain.mainClause !== row.mClause) {
                        currentMain = { mainClause: row.mClause, title: row.mTitle || 'Untitled', subClauses: [] };
                        clauses.push(currentMain);
                    }
                }
                if (currentMain && (row.clause || row.requirement)) {
                    currentMain.subClauses.push({ clause: row.clause, requirement: row.requirement });
                }
            });

            const newChecklist = {
                id: Date.now(),
                name,
                standard,
                type,
                clauses,
                cloudUrl,  // Store cloud URL
                cloudPath, // Store cloud path for deletion
                fileName: file.name,
                createdBy: state.currentUser?.name || 'Current User',
                createdAt: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString().split('T')[0]
            };

            if (!state.checklists) state.checklists = [];
            state.checklists.push(newChecklist);
            window.saveData();
            window.closeModal();
            renderChecklistLibrary();

            const statusMsg = cloudUrl ? 'uploaded to cloud' : 'saved locally';
            window.showNotification(`Imported checklist "${name}" with ${rawRows.length} items (${statusMsg})`, 'success');
        };
        reader.readAsText(file);
    };
}

window.openImportChecklistModal = openImportChecklistModal;

function setupCSVUpload() {
    const csvInput = document.getElementById('csv-upload-input');
    const btnImport = document.getElementById('btn-import-csv');

    if (!csvInput || !btnImport) return;

    btnImport.addEventListener('click', () => {
        csvInput.click();
    });

    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const text = event.target.result;
            const lines = text.split(/\r\n|\n/);
            const tbody = document.getElementById('checklist-items-body');

            let addedCount = 0;
            lines.forEach(line => {
                if (!line.trim()) return;

                // Split by comma, handling potential quotes (simplified)
                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));

                if (parts.length >= 2) {
                    let mainClause = '', mainTitle = '', clause = '', requirement = '';

                    if (parts.length >= 4) {
                        // Full Hierarchical Format: MainClause, Title, SubClause, Requirement
                        mainClause = parts[0];
                        mainTitle = parts[1];
                        clause = parts[2];
                        requirement = parts[3];
                    } else {
                        // Simple 2-Column Format: Clause, Requirement
                        // Auto-extract main clause from sub-clause number
                        clause = parts[0];
                        requirement = parts[1];

                        // Extract main clause from clause number (e.g., "4.1" → "4", "A.5" → "A", "6.1.2" → "6")
                        const clauseParts = clause.split('.');
                        if (clauseParts.length > 0) {
                            mainClause = clauseParts[0].trim();
                            // Auto-generate title based on ISO standard structure
                            mainTitle = getClauseTitleFromNumber(mainClause);
                        }
                    }

                    // Basic header detection validation
                    if ((clause || requirement) && clause.toLowerCase() !== 'clause' && mainClause.toLowerCase() !== 'main clause') {
                        const newRow = document.createElement('tr');
                        newRow.className = 'checklist-item-row';
                        newRow.innerHTML = `
                            <td><input type="text" class="form-control item-main-clause" value="${window.UTILS.escapeHtml(mainClause)}" style="margin: 0;"></td>
                            <td><input type="text" class="form-control item-main-title" value="${window.UTILS.escapeHtml(mainTitle)}" style="margin: 0;"></td>
                            <td><input type="text" class="form-control item-clause" value="${window.UTILS.escapeHtml(clause)}" style="margin: 0;"></td>
                            <td><input type="text" class="form-control item-requirement" value="${window.UTILS.escapeHtml(requirement)}" style="margin: 0;"></td>
                            <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                        `;
                        tbody.appendChild(newRow);
                        addedCount++;
                    }
                }
            });

            attachRemoveRowListeners();
            if (addedCount > 0) {
                window.showNotification(`Imported ${addedCount} items from CSV`);
            } else {
                window.showNotification('No valid items found in CSV', 'warning');
            }
            csvInput.value = ''; // Reset
        };
        reader.readAsText(file);
    });
}

function openAddChecklistModal() {
    // Full-page editor instead of modal
    renderChecklistEditor(null);
}

function renderChecklistEditor(checklistId) {
    const contentArea = document.getElementById('content-area');
    const isEdit = !!checklistId;
    const checklist = isEdit ? state.checklists?.find(c => String(c.id) === String(checklistId)) : null;

    const standards = window.state.cbSettings?.availableStandards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
    const userRole = (state.currentUser?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || state.settings?.isAdmin || false;
    const isCertManager = userRole === 'certification manager' || (window.CONSTANTS?.ROLES && userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER?.toLowerCase());
    const canEditGlobal = isCertManager || isAdmin;
    const auditTypes = window.CONSTANTS?.AUDIT_TYPES || [];
    const auditScopes = window.CONSTANTS?.AUDIT_SCOPES || [];

    // Get existing items if editing
    let existingItems = [];
    if (checklist) {
        if (checklist.clauses) {
            checklist.clauses.forEach(main => {
                (main.subClauses || []).forEach(sub => {
                    if (sub.items && sub.items.length > 0) {
                        // Nested items structure (KB-generated)
                        sub.items.forEach(item => {
                            existingItems.push({ clause: item.clause || sub.clause, requirement: item.requirement || '' });
                        });
                    } else {
                        // Flat structure
                        existingItems.push({ clause: sub.clause, requirement: sub.requirement || '' });
                    }
                });
            });
        } else if (checklist.items) {
            existingItems = checklist.items;
        }
    }

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <button class="btn btn-secondary" onclick="renderChecklistLibrary()">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to Library
                    </button>
                </div>
                <h2 style="margin: 0;">${isEdit ? 'Edit' : 'Create'} Checklist</h2>
                <div style="width: 150px;"></div>
            </div>

            <form id="checklist-editor-form">
                <div class="card" style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>Checklist Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Checklist Name <span style="color: var(--danger-color);">*</span></label>
                            <input type="text" class="form-control" id="checklist-name" placeholder="e.g. ISO 9001 Core Requirements" value="${checklist?.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Standard</label>
                            <select class="form-control" id="checklist-standard">
                                ${standards.map(s => `<option value="${window.UTILS.escapeHtml(s)}" ${checklist?.standard === s ? 'selected' : ''}>${window.UTILS.escapeHtml(s)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select class="form-control" id="checklist-type" onchange="document.getElementById('checklist-client-group').style.display = this.value === 'custom' ? 'block' : 'none'">
                                <option value="custom" ${checklist?.type === 'custom' || !checklist ? 'selected' : ''}>Custom (Personal)</option>
                                ${canEditGlobal ? `<option value="global" ${checklist?.type === 'global' ? 'selected' : ''}>Global (Organization-wide)</option>` : ''}
                            </select>
                            ${isAdmin ? '<small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;"><i class="fa-solid fa-shield-halved" style="margin-right: 0.25rem;"></i>Admin: can change type</small>' : ''}
                        </div>
                        <div class="form-group" id="checklist-client-group" style="display: ${checklist?.type === 'custom' || !checklist?.type ? 'block' : 'none'}">
                            <label>Client <small style="color: var(--text-secondary);">(optional - for client-specific checklists)</small></label>
                            <select class="form-control" id="checklist-client">
                                <option value="">-- Not client-specific --</option>
                                ${(window.state.clients || []).map(c => `<option value="${c.id}" ${checklist?.clientId === c.id ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                            </select>
                            <small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">
                                <i class="fa-solid fa-info-circle" style="margin-right: 0.25rem;"></i>
                                If selected, this checklist will appear in that client's audit plan configuration
                            </small>
                        </div>
                        <!-- Audit Type field removed -->
                        <div class="form-group">
                            <label>Audit Scope</label>
                            <select class="form-control" id="checklist-audit-scope">
                                <option value="">-- Select --</option>
                                ${auditScopes.map(s => `<option value="${window.UTILS.escapeHtml(s)}" ${checklist?.auditScope === s ? 'selected' : ''}>${window.UTILS.escapeHtml(s)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;"><i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i>Checklist Items</h4>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="file" id="csv-upload-input" accept=".csv" style="display: none;">
                            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="downloadChecklistTemplate()">
                                <i class="fa-solid fa-download" style="margin-right: 0.25rem;"></i>Template
                            </button>
                            <button type="button" class="btn btn-sm btn-info" id="btn-import-csv" style="color: white;">
                                <i class="fa-solid fa-file-csv" style="margin-right: 0.25rem;"></i>Import CSV
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" id="add-item-row">
                                <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>Add Row
                            </button>
                        </div>
                    </div>

                    <div id="checklist-items-container" style="max-height: 500px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                        <table style="width: 100%; margin: 0;">
                            <thead style="position: sticky; top: 0; background: #f1f5f9; color: #1e293b;">
                                <tr>
                                    <th style="width: 120px; padding: 0.75rem;">Clause #</th>
                                    <th style="padding: 0.75rem;">Requirement</th>
                                    <th style="width: 50px; padding: 0.75rem;"></th>
                                </tr>
                            </thead>
                            <tbody id="checklist-items-body">
                                ${existingItems.length > 0 ? existingItems.map(item => `
                                    <tr class="checklist-item-row">
                                        <td style="padding: 0.5rem;"><input type="text" class="form-control item-clause" value="${window.UTILS.escapeHtml(item.clause || '')}" style="margin: 0;"></td>
                                        <td style="padding: 0.5rem;"><input type="text" class="form-control item-requirement" value="${window.UTILS.escapeHtml(item.requirement || '')}" style="margin: 0;"></td>
                                        <td style="padding: 0.5rem;"><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                                    </tr>
                                `).join('') : `
                                    <tr class="checklist-item-row">
                                        <td style="padding: 0.5rem;"><input type="text" class="form-control item-clause" placeholder="4.1" style="margin: 0;"></td>
                                        <td style="padding: 0.5rem;"><input type="text" class="form-control item-requirement" placeholder="Requirement..." style="margin: 0;"></td>
                                        <td style="padding: 0.5rem;"><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
                        <small style="color: var(--text-secondary);">
                            <i class="fa-solid fa-info-circle" style="margin-right: 0.25rem;"></i>
                            Enter Clause # (e.g., 4.1) and Requirement - sections are auto-generated based on main clause numbers.
                        </small>
                    </div>
                </div>

                <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                    <button type="button" class="btn btn-secondary" onclick="renderChecklistLibrary()">Cancel</button>
                    <button type="button" class="btn btn-primary" id="save-checklist-btn">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>${isEdit ? 'Update' : 'Create'} Checklist
                    </button>
                </div>
            </form>
        </div>
    `;

    contentArea.innerHTML = html;
    setupCSVUpload();
    attachChecklistEditorListeners(checklistId);
}

function attachChecklistEditorListeners(checklistId) {
    const isEdit = !!checklistId;

    // Add row functionality
    document.getElementById('add-item-row')?.addEventListener('click', () => {
        const tbody = document.getElementById('checklist-items-body');
        const newRow = document.createElement('tr');
        newRow.className = 'checklist-item-row';
        newRow.innerHTML = `
            <td style="padding: 0.5rem;"><input type="text" class="form-control item-clause" placeholder="4.1" style="margin: 0;"></td>
            <td style="padding: 0.5rem;"><input type="text" class="form-control item-requirement" placeholder="Requirement" style="margin: 0;"></td>
            <td style="padding: 0.5rem;"><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
        `;
        tbody.appendChild(newRow);
        attachRemoveRowListeners();
        newRow.querySelector('.item-clause')?.focus();
    });

    attachRemoveRowListeners();

    // Save handler
    document.getElementById('save-checklist-btn')?.addEventListener('click', () => {
        saveChecklistFromEditor(checklistId);
    });
}

function saveChecklistFromEditor(checklistId) {
    const isEdit = !!checklistId;
    const name = document.getElementById('checklist-name').value.trim();
    const standard = document.getElementById('checklist-standard').value;
    const type = document.getElementById('checklist-type').value;
    const clientId = document.getElementById('checklist-client')?.value || null;
    const auditScope = document.getElementById('checklist-audit-scope').value;

    if (!name) {
        window.showNotification('Please enter a checklist name', 'error');
        return;
    }

    // Permission check for global
    const userRole = (state.currentUser?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || state.settings?.isAdmin || false;
    const isCertManager = userRole === 'certification manager' || (window.CONSTANTS?.ROLES && userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER?.toLowerCase());
    const canEditGlobal = isCertManager || isAdmin;

    if (type === 'global' && !canEditGlobal) {
        window.showNotification('Only Certification Managers or Admins can create global checklists', 'error');
        return;
    }

    // Collect items
    const rawRows = [];
    document.querySelectorAll('.checklist-item-row').forEach(row => {
        const clauseInput = row.querySelector('.item-clause');
        const reqInput = row.querySelector('.item-requirement');
        if (!clauseInput || !reqInput) return;

        const clause = clauseInput.value.trim();
        const requirement = reqInput.value.trim();

        if (clause || requirement) {
            const clauseParts = clause.split('.');
            const mClause = clauseParts[0] || '';
            const mTitle = getClauseTitleFromNumber(mClause);
            rawRows.push({ mClause, mTitle, clause, requirement });
        }
    });

    if (rawRows.length === 0) {
        window.showNotification('Please add at least one checklist item', 'error');
        return;
    }

    // Build hierarchical structure
    const clauseGroups = {};
    rawRows.forEach(row => {
        if (!clauseGroups[row.mClause]) {
            clauseGroups[row.mClause] = {
                mainClause: row.mClause,
                title: row.mTitle,
                subClauses: []
            };
        }
        if (row.clause || row.requirement) {
            clauseGroups[row.mClause].subClauses.push({
                clause: row.clause,
                requirement: row.requirement
            });
        }
    });

    // Helper for Async Saving
    const persistChecklist = async (checklistData, isUpdate) => {
        try {
            if (isUpdate) {
                await window.SupabaseClient.db.update('checklists', checklistData.id, {
                    name: checklistData.name,
                    standard: checklistData.standard,
                    type: checklistData.type,
                    audit_scope: checklistData.auditScope,
                    clauses: checklistData.clauses,
                    updated_at: new Date().toISOString()
                });
            } else {
                await window.SupabaseClient.db.insert('checklists', {
                    id: checklistData.id,
                    name: checklistData.name,
                    standard: checklistData.standard,
                    type: checklistData.type,
                    audit_scope: checklistData.auditScope,
                    clauses: checklistData.clauses,
                    created_by: checklistData.createdBy,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
            window.showNotification('Checklist saved to Database.', 'success');
        } catch (dbError) {
            console.error('Checklist DB Save Error:', dbError);
            window.showNotification('Saved locally, but DB sync failed: ' + dbError.message, 'warning');
        }
    };

    if (isEdit) {
        const checklist = state.checklists.find(c => String(c.id) === String(checklistId));
        if (checklist) {
            checklist.name = name;
            checklist.standard = standard;
            checklist.type = type;
            checklist.clientId = clientId;
            checklist.auditScope = auditScope;
            checklist.clauses = Object.values(clauseGroups);
            delete checklist.items;
            checklist.updatedAt = new Date().toISOString().split('T')[0];

            // Persist Update
            persistChecklist(checklist, true);
        }
        window.showNotification('Checklist updated locally', 'success');
    } else {
        const newChecklist = {
            id: Date.now(),
            name,
            standard,
            type,
            // auditType removed
            auditScope,
            clauses: Object.values(clauseGroups),
            createdBy: state.currentUser?.name || 'Current User',
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
        };
        if (!state.checklists) state.checklists = [];
        state.checklists.push(newChecklist);

        // Persist Insert
        persistChecklist(newChecklist, false);

        window.showNotification('Checklist created locally', 'success');
    }

    window.saveData();

    // Queue checklist template for offline sync (Keep existing logic)
    if (window.OfflineManager) {
        const checklistIdToQueue = isEdit ? checklistId : state.checklists[state.checklists.length - 1].id;
        window.OfflineManager.queueAction('SAVE_CHECKLIST_TEMPLATE', {
            checklistId: checklistIdToQueue,
            name: name,
            standard: standard,
            clauses: Object.values(clauseGroups)
        });
    }

    renderChecklistLibrary();
}

window.renderChecklistEditor = renderChecklistEditor;
window.saveChecklistFromEditor = saveChecklistFromEditor;

function attachRemoveRowListeners() {
    document.querySelectorAll('.remove-item-row').forEach(btn => {
        btn.onclick = (e) => {
            const row = e.target.closest('tr');
            if (document.querySelectorAll('.checklist-item-row').length > 1) {
                row.remove();
            } else {
                window.showNotification('At least one row is required', 'error');
            }
        };
    });
}

function openEditChecklistModal(id) {
    const checklist = state.checklists?.find(c => String(c.id) === String(id));
    if (!checklist) return;

    const userRole = (state.currentUser?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || state.settings?.isAdmin || false;
    const isCertManager = userRole === 'certification manager' || (window.CONSTANTS?.ROLES && userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER.toLowerCase());
    const canEditGlobal = isCertManager || isAdmin;

    // Check permission for global checklists
    if (checklist.type === 'global' && !canEditGlobal) {
        window.showNotification('Only Certification Managers or Admins can edit global checklists', 'error');
        return;
    }

    // Use full-page editor instead of modal
    renderChecklistEditor(id);
}

function viewChecklistDetail(id) {
    const contentArea = document.getElementById('content-area');
    const checklist = state.checklists?.find(c => String(c.id) === String(id));
    if (!checklist) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-secondary" onclick="renderChecklistLibrary()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Library
                </button>
                <div style="display: flex; gap: 0.5rem;">
                    ${typeof window.exportChecklistPDF === 'function' ? `
                        <button class="btn btn-secondary" onclick="window.exportChecklistPDF('${id}')" title="Export as PDF">
                            <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem; color: #ef4444;"></i> Export PDF
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="window.printChecklist('${id}')" title="Print Checklist">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> Print
                    </button>
                </div>
            </div>

            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${checklist.name}</h2>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">${checklist.standard}</span>
                            <span style="background: ${checklist.type === 'global' ? '#fef3c7' : '#d1fae5'}; color: ${checklist.type === 'global' ? '#d97706' : '#059669'}; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                                <i class="fa-solid fa-${checklist.type === 'global' ? 'globe' : 'user'}" style="margin-right: 0.25rem;"></i>${checklist.type === 'global' ? 'Global' : 'Custom'}
                            </span>
                            ${checklist.auditType ? `
                                <span style="background: #f3e8ff; color: #7e22ce; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                                    <i class="fa-solid fa-clipboard-list" style="margin-right: 0.25rem;"></i>${checklist.auditType}
                                </span>
                            ` : ''}
                            ${checklist.auditScope ? `
                                <span style="background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                                    <i class="fa-solid fa-sitemap" style="margin-right: 0.25rem;"></i>${checklist.auditScope}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                        <p style="margin: 0;">Created by: ${checklist.createdBy || 'Unknown'}</p>
                        <p style="margin: 0;">Last updated: ${checklist.updatedAt || checklist.createdAt}</p>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 1rem;">
                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                    Checklist Items (${checklist.clauses ? checklist.clauses.reduce((total, c) => {
        return total + (c.subClauses || []).reduce((subTotal, sub) => {
            if (sub.items && sub.items.length > 0) return subTotal + sub.items.length;
            if (sub.requirement) return subTotal + 1;
            return subTotal;
        }, 0);
    }, 0) : (checklist.items?.length || 0)})
                </h3>
                
                ${checklist.clauses ? checklist.clauses.map((mainClause, idx) => `
                    <div class="accordion-section" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                        <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); color: #1e293b; cursor: pointer; user-select: none;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.accordion-icon').style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">Clause ${mainClause.mainClause}</span>
                                <span style="font-weight: 600; color: #1e293b;">${mainClause.title}</span>
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">(${(mainClause.subClauses || []).reduce((t, sub) => t + (sub.items && sub.items.length > 0 ? sub.items.length : (sub.requirement ? 1 : 0)), 0)} items)</span>
                            </div>
                            <i class="fa-solid fa-chevron-down accordion-icon" style="transition: transform 0.3s; transform: ${idx === 0 ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
                        </div>
                        <div class="accordion-content" style="display: ${idx === 0 ? 'block' : 'none'}; padding: 0; background: white; color: #334155;">
                            ${(mainClause.subClauses || []).map(sub => {
        // Check if sub-clause has nested items (new structure)
        const hasItems = sub.items && sub.items.length > 0;
        const isSingleFlat = !hasItems && sub.requirement;

        if (hasItems) {
            return `
                                    <div style="border-bottom: 1px solid #f1f5f9;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: #f0f9ff; color: #1e293b; cursor: pointer; user-select: none;" onclick="const c=this.nextElementSibling; c.style.display=c.style.display==='none'?'block':'none'; this.querySelector('.sub-icon').style.transform=c.style.display==='none'?'rotate(0deg)':'rotate(90deg)';">
                                            <i class="fa-solid fa-caret-right sub-icon" style="transition: transform 0.2s; transform: rotate(90deg); color: #0369a1; font-size: 0.8rem;"></i>
                                            <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">${sub.clause}</span>
                                            <span style="font-weight: 500; color: #334155;">${sub.title || ''}</span>
                                            <span style="color: var(--text-secondary); font-size: 0.8rem;">(${sub.items.length} items)</span>
                                        </div>
                                        <div style="display: block;">
                                            <table style="width: 100%; margin: 0;">
                                                <tbody>
                                                    ${sub.items.map((item, itemIdx) => `
                                                        <tr style="border-bottom: 1px solid #f8fafc;">
                                                            <td style="width: 40px; padding: 0.5rem 0.5rem 0.5rem 2.5rem; font-weight: 400; color: var(--text-secondary); font-size: 0.85rem;">${itemIdx + 1}</td>
                                                            <td style="width: 90px; padding: 0.5rem;"><span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 0.8rem;">${item.clause}</span></td>
                                                            <td style="padding: 0.5rem; font-size: 0.9rem; color: #334155;">${item.requirement}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>`;
        } else {
            // Legacy flat structure or single-item sub-clause
            return `
                                    <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9;">
                                        <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; white-space: nowrap;">${sub.clause}</span>
                                        <span style="font-size: 0.9rem; color: #334155;">${sub.requirement || ''}</span>
                                    </div>`;
        }
    }).join('')}
                        </div>
                    </div>
                `).join('') : `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 80px;">#</th>
                                    <th style="width: 120px;">Clause</th>
                                    <th>Requirement</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(checklist.items || []).map((item, idx) => `
                                    <tr>
                                        <td style="font-weight: 500; color: var(--text-secondary);">${idx + 1}</td>
                                        <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${item.clause || '-'}</span></td>
                                        <td>${item.requirement || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div >
        </div >
    `;

    window.contentArea.innerHTML = html;
}

// Check if a checklist is used in any audit report
function isChecklistUsedInAudits(checklistId) {
    const reports = window.state.auditReports || [];
    const executions = window.state.auditExecutions || [];
    const plans = window.state.auditPlans || [];
    const strId = String(checklistId);
    const linkedTo = [];

    // Check audit plans (selected checklists)
    for (const p of plans) {
        const selectedIds = (p.selectedChecklists || []).map(String);
        if (selectedIds.includes(strId)) {
            linkedTo.push(`Plan: ${p.client || p.name || p.id}`);
        }
    }
    // Check audit reports
    for (const r of reports) {
        if (String(r.checklistId) === strId) { linkedTo.push(`Report: ${r.clientName || r.id}`); continue; }
        if (r.checklistProgress?.some(p => String(p.checklistId) === strId)) linkedTo.push(`Report: ${r.clientName || r.id}`);
    }
    // Check audit executions
    for (const e of executions) {
        if (String(e.checklistId) === strId) linkedTo.push(`Execution: ${e.clientName || e.id}`);
    }
    return linkedTo.length > 0 ? { used: true, linkedTo } : { used: false, linkedTo: [] };
}

// Archive a checklist (soft delete)
function archiveChecklist(id) {
    const checklist = state.checklists?.find(c => String(c.id) === String(id));
    if (!checklist) return;

    checklist.archived = true;
    checklist.archivedAt = new Date().toISOString();
    checklist.archivedBy = state.currentUser?.name || 'Unknown';
    window.saveData();

    // Sync to DB
    if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
        window.SupabaseClient.syncSettingsToSupabase(window.state.settings).catch(e => {
            console.warn('Archive sync failed:', e);
        });
    }

    window.showNotification(`"${checklist.name}" has been archived.You can find it under the Archived filter.`, 'success');
    renderChecklistLibrary();
}

// Restore an archived checklist
function restoreChecklist(id) {
    const checklist = state.checklists?.find(c => String(c.id) === String(id));
    if (!checklist) return;

    delete checklist.archived;
    delete checklist.archivedAt;
    delete checklist.archivedBy;
    window.saveData();

    if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
        window.SupabaseClient.syncSettingsToSupabase(window.state.settings).catch(e => {
            console.warn('Restore sync failed:', e);
        });
    }

    window.showNotification(`"${checklist.name}" has been restored.`, 'success');
    renderChecklistLibrary();
}

function deleteChecklist(id) {
    const checklist = state.checklists?.find(c => String(c.id) === String(id));
    if (!checklist) {
        console.error('Checklist not found:', id);
        return;
    }

    const userRole = (window.state.currentUser?.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || window.state.settings?.isAdmin || false;
    const isCertManager = userRole === 'certification manager' || (window.CONSTANTS?.ROLES && userRole === window.CONSTANTS.ROLES.CERTIFICATION_MANAGER.toLowerCase());
    const canEditGlobal = isCertManager || isAdmin;

    if (checklist.type === 'global' && !canEditGlobal) {
        window.showNotification('Only Certification Managers or Admins can delete global checklists', 'error');
        return;
    }

    if (!state.currentUser) {
        window.showNotification('You must be logged in to delete checklists', 'error');
        return;
    }

    // Check if checklist is used in audits
    const usage = isChecklistUsedInAudits(id);
    if (usage.used) {
        const linkList = usage.linkedTo.join(', ');
        window.showNotification(`Cannot delete — this checklist is linked to: ${linkList}. It has been archived instead to preserve audit records.`, 'warning');
        archiveChecklist(id);
        return;
    }

    if (confirm(`Are you sure you want to permanently delete "${checklist.name}" ? `)) {
        state.checklists = state.checklists.filter(c => String(c.id) !== String(id));
        window.saveData();

        // Persist deletion to DB
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.client
                .from('checklists')
                .delete()
                .eq('id', id)
                .then(({ error }) => {
                    if (error) {
                        console.error('Checklist DB delete error:', error);
                        window.showNotification('Deleted locally, DB sync failed', 'warning');
                    } else {
                        window.showNotification('Checklist deleted and removed from database', 'success');
                    }
                });
        } else {
            window.showNotification('Checklist deleted', 'success');
        }

        renderChecklistLibrary();
    }
}

function printChecklist(id) {
    const checklist = state.checklists.find(c => String(c.id) === String(id));
    if (!checklist) return;

    // Build items from both old (items) and new (clauses) structures
    let printItems = [];
    if (checklist.clauses && checklist.clauses.length > 0) {
        checklist.clauses.forEach(main => {
            // Add main clause as a header row (Level 1)
            printItems.push({ clause: main.mainClause || main.clause, requirement: main.title || main.requirement, isHeader: true, level: 1 });
            (main.subClauses || []).forEach(sub => {
                if (sub.items && sub.items.length > 0) {
                    // Sub-clause header (Level 2)
                    printItems.push({ clause: sub.clause, requirement: sub.title || '', isHeader: true, level: 2 });
                    // Individual items (Level 3+)
                    sub.items.forEach(item => {
                        printItems.push({ clause: item.clause, requirement: item.requirement });
                    });
                } else {
                    // Legacy flat sub-clause
                    printItems.push({ clause: sub.clause, requirement: sub.requirement });
                }
            });
        });
    } else if (checklist.items && checklist.items.length > 0) {
        printItems = checklist.items;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`CHECKLIST-${checklist.id}|${checklist.name}|${checklist.standard}`)}`;

    let content = `
        <html>
        <head>
            <title>Checklist: ${checklist.name}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; max-width: 900px; margin: 0 auto; }
                .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px; position: relative; }
                h1 { color: #0f172a; margin: 0 0 10px 0; font-size: 1.4rem; }
                p { margin: 5px 0; color: #64748b; font-size: 0.9rem; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; font-size: 0.85rem; }
                th { background: #f8fafc; font-weight: 600; color: #475569; }
                td.clause { font-weight: 600; background: #f1f5f9; width: 80px; }
                tr.section-header td { background: #e0f2fe; font-weight: 700; color: #0369a1; border-bottom: 2px solid #0369a1; }
                tr.sub-header td { background: #f0f9ff; font-weight: 600; color: #0c4a6e; border-bottom: 1px solid #7dd3fc; font-size: 0.83rem; }
                .status-box { width: 22px; height: 22px; border: 2px solid #cbd5e1; border-radius: 4px; display: inline-block; }
                @media print {
                    button { display: none !important; }
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: right; margin-bottom: 1rem;">
                <button onclick="window.print()" style="padding: 10px 24px; cursor: pointer; background: #0056b3; color: white; border: none; border-radius: 6px; font-weight: 600;">🖨️ Print Checklist</button>
            </div>
            <div class="header">
                <div style="position: absolute; top: 0; right: 0;">
                    <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    ${(() => {
            const cbSettings = window.state?.cbSettings || {};
            const logoUrl = cbSettings.logoUrl || '';
            const cbName = cbSettings.cbName || 'AuditCB360';
            if (logoUrl && (logoUrl.startsWith('data:') || logoUrl.startsWith('http'))) {
                return `<img src="${logoUrl}" style="max-height: 50px; max-width: 200px; object-fit: contain;" alt="${window.UTILS.escapeHtml(cbName)}">`;
            } else {
                return `<div style="font-size: 1.1rem; font-weight: 700; color: #0f172a;">${window.UTILS.escapeHtml(cbName)}</div>`;
            }
        })()}
                </div>
                <h1>${window.UTILS.escapeHtml(checklist.name)}</h1>
                <p><strong>Standard:</strong> ${window.UTILS.escapeHtml(checklist.standard)}</p>
                <p><strong>Type:</strong> ${checklist.type === 'global' ? 'Global (Organization-wide)' : 'Custom'}</p>
                <p><strong>Items:</strong> ${printItems.length}${checklist.auditScope ? ` &bull; <strong>Scope:</strong> ${window.UTILS.escapeHtml(checklist.auditScope)}` : ''}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Clause</th>
                        <th>Requirement / Check Item</th>
                        <th style="width: 60px; text-align:center;">C</th>
                        <th style="width: 60px; text-align:center;">NC</th>
                        <th style="width: 60px; text-align:center;">N/A</th>
                        <th style="width: 180px;">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${printItems.map(item => item.isHeader ? `
                        <tr class="${item.level === 2 ? 'sub-header' : 'section-header'}">
                            <td>${window.UTILS.escapeHtml(item.clause)}</td>
                            <td colspan="5">${window.UTILS.escapeHtml(item.requirement)}</td>
                        </tr>
                    ` : `
                        <tr>
                            <td class="clause">${window.UTILS.escapeHtml(item.clause || '')}</td>
                            <td>${window.UTILS.escapeHtml(item.requirement || '')}</td>
                            <td style="text-align:center;"><span class="status-box"></span></td>
                            <td style="text-align:center;"><span class="status-box"></span></td>
                            <td style="text-align:center;"><span class="status-box"></span></td>
                            <td></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8;">
                <span>Generated by ${window.UTILS.escapeHtml((window.state?.cbSettings?.cbName) || 'AuditCB360')} Platform</span>
                <span>Auditor Signature: ____________________</span>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
}

// Export functions
window.renderChecklistLibrary = renderChecklistLibrary;
window.openAddChecklistModal = openAddChecklistModal;
window.openEditChecklistModal = openEditChecklistModal;
window.viewChecklistDetail = viewChecklistDetail;
window.deleteChecklist = deleteChecklist;
window.archiveChecklist = archiveChecklist;
window.restoreChecklist = restoreChecklist;
window.printChecklist = printChecklist;

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
    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
    const canEditGlobal = isCertManager || isAdmin;
    const checklists = state.checklists || [];

    // Apply filters
    let filtered = checklists.filter(c => {
        const matchStandard = checklistFilterStandard === 'all' || c.standard === checklistFilterStandard;
        const matchType = checklistFilterType === 'all' || c.type === checklistFilterType;
        const matchAuditType = checklistFilterAuditType === 'all' || c.auditType === checklistFilterAuditType;
        const matchScope = checklistFilterScope === 'all' || c.auditScope === checklistFilterScope;
        const matchSearch = checklistSearchTerm === '' ||
            c.name.toLowerCase().includes(checklistSearchTerm.toLowerCase()) ||
            c.standard.toLowerCase().includes(checklistSearchTerm.toLowerCase());
        return matchStandard && matchType && matchAuditType && matchScope && matchSearch;
    });

    // Separate global and custom
    const globalChecklists = filtered.filter(c => c.type === 'global');
    const customChecklists = filtered.filter(c => c.type === 'custom');

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
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
                    </select>
                    <select id="checklist-filter-audittype" style="max-width: 160px; margin-bottom: 0;">
                        <option value="all" ${checklistFilterAuditType === 'all' ? 'selected' : ''}>All Audit Types</option>
                        ${auditTypes.map(t => `<option value="${window.UTILS.escapeHtml(t)}" ${checklistFilterAuditType === t ? 'selected' : ''}>${window.UTILS.escapeHtml(t)}</option>`).join('')}
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
                    <p style="font-size: 2rem; font-weight: 700; color: #d97706; margin: 0;">${checklists.reduce((sum, c) => sum + (c.clauses ? c.clauses.reduce((s, cl) => s + (cl.subClauses?.length || 0), 0) : (c.items?.length || 0)), 0)}</p>
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
                                        <td>${c.clauses ? c.clauses.reduce((acc, cl) => acc + (cl.subClauses?.length || 0), 0) : (c.items?.length || 0)}</td>
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
                                        <td>${c.clauses ? c.clauses.reduce((acc, cl) => acc + (cl.subClauses?.length || 0), 0) : (c.items?.length || 0)}</td>
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

    document.getElementById('checklist-filter-audittype')?.addEventListener('change', (e) => {
        checklistFilterAuditType = e.target.value;
        renderChecklistLibrary();
    });

    document.getElementById('checklist-filter-scope')?.addEventListener('change', (e) => {
        checklistFilterScope = e.target.value;
        renderChecklistLibrary();
    });

    document.querySelectorAll('.view-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            viewChecklistDetail(id);
        });
    });

    document.querySelectorAll('.edit-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            openEditChecklistModal(id);
        });
    });

    document.querySelectorAll('.delete-checklist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
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
    modalSave.onclick = () => {
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
                createdBy: state.currentUser?.name || 'Current User',
                createdAt: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString().split('T')[0]
            };

            if (!state.checklists) state.checklists = [];
            state.checklists.push(newChecklist);
            window.saveData();
            window.closeModal();
            renderChecklistLibrary();
            window.showNotification(`Imported checklist "${name}" with ${rawRows.length} items`, 'success');
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
    const checklist = isEdit ? state.checklists?.find(c => c.id === checklistId) : null;

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
    const canEditGlobal = isCertManager || isAdmin;
    const auditTypes = window.CONSTANTS?.AUDIT_TYPES || [];
    const auditScopes = window.CONSTANTS?.AUDIT_SCOPES || [];

    // Get existing items if editing
    let existingItems = [];
    if (checklist) {
        if (checklist.clauses) {
            checklist.clauses.forEach(main => {
                (main.subClauses || []).forEach(sub => {
                    existingItems.push({ clause: sub.clause, requirement: sub.requirement });
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
                            <select class="form-control" id="checklist-type">
                                <option value="custom" ${checklist?.type === 'custom' || !checklist ? 'selected' : ''}>Custom (Personal)</option>
                                ${canEditGlobal ? `<option value="global" ${checklist?.type === 'global' ? 'selected' : ''}>Global (Organization-wide)</option>` : ''}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Audit Type</label>
                            <select class="form-control" id="checklist-audit-type">
                                <option value="">-- Select --</option>
                                ${auditTypes.map(t => `<option value="${window.UTILS.escapeHtml(t)}" ${checklist?.auditType === t ? 'selected' : ''}>${window.UTILS.escapeHtml(t)}</option>`).join('')}
                            </select>
                        </div>
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
                            <thead style="position: sticky; top: 0; background: #f1f5f9;">
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
    const auditType = document.getElementById('checklist-audit-type').value;
    const auditScope = document.getElementById('checklist-audit-scope').value;

    if (!name) {
        window.showNotification('Please enter a checklist name', 'error');
        return;
    }

    // Permission check for global
    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
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

    if (isEdit) {
        const checklist = state.checklists.find(c => c.id === checklistId);
        if (checklist) {
            checklist.name = name;
            checklist.standard = standard;
            checklist.type = type;
            checklist.auditType = auditType;
            checklist.auditScope = auditScope;
            checklist.clauses = Object.values(clauseGroups);
            delete checklist.items;
            checklist.updatedAt = new Date().toISOString().split('T')[0];
        }
        window.showNotification('Checklist updated successfully', 'success');
    } else {
        const newChecklist = {
            id: Date.now(),
            name,
            standard,
            type,
            auditType,
            auditScope,
            clauses: Object.values(clauseGroups),
            createdBy: state.currentUser?.name || 'Current User',
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
        };
        if (!state.checklists) state.checklists = [];
        state.checklists.push(newChecklist);
        window.showNotification('Checklist created successfully', 'success');
    }

    window.saveData();
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
    const checklist = state.checklists?.find(c => c.id === id);
    if (!checklist) return;

    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
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
    const checklist = state.checklists?.find(c => c.id === id);
    if (!checklist) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderChecklistLibrary()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Library
                </button>
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
                    Checklist Items (${checklist.clauses ? checklist.clauses.reduce((s, c) => s + (c.subClauses?.length || 0), 0) : (checklist.items?.length || 0)})
                </h3>
                
                ${checklist.clauses ? checklist.clauses.map((mainClause, idx) => `
                    <div class="accordion-section" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                        <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); cursor: pointer; user-select: none;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.accordion-icon').style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">Clause ${mainClause.mainClause}</span>
                                <span style="font-weight: 600; color: #1e293b;">${mainClause.title}</span>
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">(${mainClause.subClauses?.length || 0} items)</span>
                            </div>
                            <i class="fa-solid fa-chevron-down accordion-icon" style="transition: transform 0.3s; transform: ${idx === 0 ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
                        </div>
                        <div class="accordion-content" style="display: ${idx === 0 ? 'block' : 'none'}; padding: 0; background: white;">
                            <table style="width: 100%; margin: 0;">
                                <tbody>
                                    ${mainClause.subClauses.map((sub, subIdx) => `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="width: 60px; padding: 0.75rem 1rem; font-weight: 500; color: var(--text-secondary);">${subIdx + 1}</td>
                                            <td style="width: 100px; padding: 0.75rem;"><span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">${sub.clause}</span></td>
                                            <td style="padding: 0.75rem;">${sub.requirement}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
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
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
}

function deleteChecklist(id) {
    const checklist = state.checklists?.find(c => c.id === id);
    if (!checklist) {
        console.error('Checklist not found:', id);
        return;
    }

    const userRole = state.currentUser?.role;
    const isAdmin = state.settings?.isAdmin || false;
    const isCertManager = userRole === window.CONSTANTS?.ROLES?.CERTIFICATION_MANAGER;
    const canEditGlobal = isCertManager || isAdmin;

    // Log attempt for debugging
    console.log('Delete attempt:', {
        checklistName: checklist.name,
        checklistType: checklist.type,
        userRole: userRole,
        isAdmin: isAdmin,
        isCertManager: isCertManager,
        canEditGlobal: canEditGlobal
    });

    // CRITICAL: Block deletion of global checklists by unauthorized users
    if (checklist.type === 'global' && !canEditGlobal) {
        console.error('Unauthorized delete attempt blocked');
        window.showNotification('Only Certification Managers or Admins can delete global checklists', 'error');
        return;
    }

    // Additional safety check - prevent deletion if no user is logged in
    if (!state.currentUser) {
        window.showNotification('You must be logged in to delete checklists', 'error');
        return;
    }

    if (confirm(`Are you sure you want to delete "${checklist.name}"?`)) {
        state.checklists = state.checklists.filter(c => c.id !== id);
        window.saveData();
        renderChecklistLibrary();
        window.showNotification('Checklist deleted successfully');
    }
}

function printChecklist(id) {
    const checklist = state.checklists.find(c => c.id == id);
    if (!checklist) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`CHECKLIST-${checklist.id}|${checklist.name}|${checklist.standard}`)}`;

    let content = `
        <html>
        <head>
            <title>Checklist: ${checklist.name}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; max-width: 900px; margin: 0 auto; }
                .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px; position: relative; }
                h1 { color: #0f172a; margin: 0 0 10px 0; }
                p { margin: 5px 0; color: #64748b; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 12px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
                th { background: #f8fafc; font-weight: 600; color: #475569; }
                td.clause { font-weight: 600; background: #f1f5f9; width: 80px; }
                @media print {
                    button { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: right;">
                <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #0056b3; color: white; border: none; border-radius: 4px;">Print Checklist</button>
            </div>
            <div class="header">
                 <div style="position: absolute; top: 0; right: 0;">
                    <img src="${qrUrl}" alt="QR" style="width: 80px; height: 80px;">
                </div>
                <h1>${checklist.name}</h1>
                <p><strong>Standard:</strong> ${checklist.standard}</p>
                <p><strong>Type:</strong> ${checklist.type === 'global' ? 'Global (Standard)' : 'Custom'}</p>
                <p><strong>Items:</strong> ${checklist.items?.length || 0}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Clause</th>
                        <th>Requirement / Check Item</th>
                        <th style="width: 150px;">Status</th> <!-- Space for writing -->
                        <th style="width: 200px;">Remarks</th> <!-- Space for writing -->
                    </tr>
                </thead>
                <tbody>
                    ${(checklist.items || []).map(item => `
                        <tr>
                            <td class="clause">${item.clause || ''}</td>
                            <td>${item.requirement}</td>
                            <td></td>
                            <td></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 40px; font-size: 0.8rem; color: #94a3b8; text-align: center;">
                Generated by AuditCB360 Platform
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
window.printChecklist = printChecklist;

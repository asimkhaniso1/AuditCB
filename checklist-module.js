// Checklist Library Module
// Manages audit checklists organized by ISO standard with Global/Custom types

const contentArea = document.getElementById('content-area');

// State for filtering
let checklistFilterStandard = 'all';
let checklistFilterType = 'all';
let checklistSearchTerm = '';

function renderChecklistLibrary() {
    const isAdmin = state.settings?.isAdmin || false;
    const checklists = state.checklists || [];

    // Apply filters
    let filtered = checklists.filter(c => {
        const matchStandard = checklistFilterStandard === 'all' || c.standard === checklistFilterStandard;
        const matchType = checklistFilterType === 'all' || c.type === checklistFilterType;
        const matchSearch = checklistSearchTerm === '' ||
            c.name.toLowerCase().includes(checklistSearchTerm.toLowerCase()) ||
            c.standard.toLowerCase().includes(checklistSearchTerm.toLowerCase());
        return matchStandard && matchType && matchSearch;
    });

    // Separate global and custom
    const globalChecklists = filtered.filter(c => c.type === 'global');
    const customChecklists = filtered.filter(c => c.type === 'custom');

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];

    const html = `
        <div class="fade-in">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; flex: 1;">
                    <input type="text" id="checklist-search" placeholder="Search checklists..." value="${checklistSearchTerm}" style="max-width: 250px; margin-bottom: 0;">
                    <select id="checklist-filter-standard" style="max-width: 180px; margin-bottom: 0;">
                        <option value="all">All Standards</option>
                        ${standards.map(s => `<option value="${s}" ${checklistFilterStandard === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <select id="checklist-filter-type" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all" ${checklistFilterType === 'all' ? 'selected' : ''}>All Types</option>
                        <option value="global" ${checklistFilterType === 'global' ? 'selected' : ''}>Global Only</option>
                        <option value="custom" ${checklistFilterType === 'custom' ? 'selected' : ''}>Custom Only</option>
                    </select>
                </div>
                <button id="btn-new-checklist" class="btn btn-primary">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Checklist
                </button>
            </div>

            <!-- Admin Badge -->
            ${isAdmin ? `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span>Admin Mode - You can edit/delete Global checklists</span>
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
                    <p style="font-size: 2rem; font-weight: 700; color: #d97706; margin: 0;">${checklists.reduce((sum, c) => sum + (c.items?.length || 0), 0)}</p>
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
                                    <th>Items</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${globalChecklists.map(c => `
                                    <tr>
                                        <td style="font-weight: 500;">${c.name}</td>
                                        <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${c.standard}</span></td>
                                        <td>${c.items?.length || 0} items</td>
                                        <td>${c.updatedAt || c.createdAt}</td>
                                        <td>
                                            <button class="btn btn-sm view-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                            ${isAdmin ? `
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
                                    <th>Items</th>
                                    <th>Created By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customChecklists.map(c => `
                                    <tr>
                                        <td style="font-weight: 500;">${c.name}</td>
                                        <td><span style="background: #d1fae5; color: #059669; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${c.standard}</span></td>
                                        <td>${c.items?.length || 0} items</td>
                                        <td>${c.createdBy || 'Unknown'}</td>
                                        <td>
                                            <button class="btn btn-sm view-checklist" data-id="${c.id}" style="margin-right: 0.25rem;">
                                                <i class="fa-solid fa-eye"></i>
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

    contentArea.innerHTML = html;

    // Event Listeners
    document.getElementById('btn-new-checklist')?.addEventListener('click', openAddChecklistModal);

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

function openAddChecklistModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];
    const isAdmin = state.settings?.isAdmin || false;

    modalTitle.textContent = 'Create New Checklist';
    modalBody.innerHTML = `
        <form id="checklist-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Checklist Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="checklist-name" placeholder="e.g. ISO 9001 Core Requirements" required>
                </div>
                <div class="form-group">
                    <label>Standard</label>
                    <select class="form-control" id="checklist-standard">
                        ${standards.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select class="form-control" id="checklist-type">
                        <option value="custom">Custom (Personal)</option>
                        ${isAdmin ? '<option value="global">Global (Organization-wide)</option>' : ''}
                    </select>
                </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0;"><i class="fa-solid fa-list" style="margin-right: 0.5rem;"></i>Checklist Items</h4>
                    <button type="button" class="btn btn-sm btn-secondary" id="add-item-row">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Row
                    </button>
                </div>

                <div id="checklist-items-container" style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px;">Clause</th>
                                <th>Requirement</th>
                                <th style="width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="checklist-items-body">
                            <tr class="checklist-item-row">
                                <td><input type="text" class="form-control item-clause" placeholder="e.g. 4.1" style="margin: 0;"></td>
                                <td><input type="text" class="form-control item-requirement" placeholder="Requirement description" style="margin: 0;"></td>
                                <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                            </tr>
                            <tr class="checklist-item-row">
                                <td><input type="text" class="form-control item-clause" placeholder="e.g. 4.2" style="margin: 0;"></td>
                                <td><input type="text" class="form-control item-requirement" placeholder="Requirement description" style="margin: 0;"></td>
                                <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                            </tr>
                            <tr class="checklist-item-row">
                                <td><input type="text" class="form-control item-clause" placeholder="e.g. 5.1" style="margin: 0;"></td>
                                <td><input type="text" class="form-control item-requirement" placeholder="Requirement description" style="margin: 0;"></td>
                                <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
                    <small style="color: var(--text-secondary);">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.25rem;"></i>
                        Tip: You can paste data from Excel (Clause | Requirement columns)
                    </small>
                </div>
            </div>
        </form>
    `;

    window.openModal();

    // Add row functionality
    document.getElementById('add-item-row')?.addEventListener('click', () => {
        const tbody = document.getElementById('checklist-items-body');
        const newRow = document.createElement('tr');
        newRow.className = 'checklist-item-row';
        newRow.innerHTML = `
            <td><input type="text" class="form-control item-clause" placeholder="Clause" style="margin: 0;"></td>
            <td><input type="text" class="form-control item-requirement" placeholder="Requirement" style="margin: 0;"></td>
            <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
        `;
        tbody.appendChild(newRow);
        attachRemoveRowListeners();
    });

    attachRemoveRowListeners();

    modalSave.onclick = () => {
        const name = document.getElementById('checklist-name').value.trim();
        const standard = document.getElementById('checklist-standard').value;
        const type = document.getElementById('checklist-type').value;

        if (!name) {
            window.showNotification('Please enter a checklist name', 'error');
            return;
        }

        // Collect items
        const items = [];
        document.querySelectorAll('.checklist-item-row').forEach(row => {
            const clause = row.querySelector('.item-clause').value.trim();
            const requirement = row.querySelector('.item-requirement').value.trim();
            if (clause || requirement) {
                items.push({ clause, requirement });
            }
        });

        if (items.length === 0) {
            window.showNotification('Please add at least one checklist item', 'error');
            return;
        }

        const newChecklist = {
            id: Date.now(),
            name,
            standard,
            type,
            createdBy: 'Current User', // Would come from auth in production
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            items
        };

        if (!state.checklists) state.checklists = [];
        state.checklists.push(newChecklist);
        window.saveData();
        window.closeModal();
        renderChecklistLibrary();
        window.showNotification('Checklist created successfully');
    };
}

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

    const isAdmin = state.settings?.isAdmin || false;

    // Check permission for global checklists
    if (checklist.type === 'global' && !isAdmin) {
        window.showNotification('Only admins can edit global checklists', 'error');
        return;
    }

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    const standards = state.settings?.standards || ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'];

    modalTitle.textContent = 'Edit Checklist';
    modalBody.innerHTML = `
        <form id="checklist-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Checklist Name <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="checklist-name" value="${checklist.name}" required>
                </div>
                <div class="form-group">
                    <label>Standard</label>
                    <select class="form-control" id="checklist-standard">
                        ${standards.map(s => `<option value="${s}" ${checklist.standard === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select class="form-control" id="checklist-type" ${checklist.type === 'global' && !isAdmin ? 'disabled' : ''}>
                        <option value="custom" ${checklist.type === 'custom' ? 'selected' : ''}>Custom (Personal)</option>
                        ${isAdmin ? `<option value="global" ${checklist.type === 'global' ? 'selected' : ''}>Global (Organization-wide)</option>` : ''}
                    </select>
                </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0;"><i class="fa-solid fa-list" style="margin-right: 0.5rem;"></i>Checklist Items (${checklist.items?.length || 0})</h4>
                    <button type="button" class="btn btn-sm btn-secondary" id="add-item-row">
                        <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i> Add Row
                    </button>
                </div>

                <div id="checklist-items-container" style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px;">Clause</th>
                                <th>Requirement</th>
                                <th style="width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="checklist-items-body">
                            ${(checklist.items || []).map(item => `
                                <tr class="checklist-item-row">
                                    <td><input type="text" class="form-control item-clause" value="${item.clause || ''}" style="margin: 0;"></td>
                                    <td><input type="text" class="form-control item-requirement" value="${item.requirement || ''}" style="margin: 0;"></td>
                                    <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </form>
    `;

    window.openModal();

    document.getElementById('add-item-row')?.addEventListener('click', () => {
        const tbody = document.getElementById('checklist-items-body');
        const newRow = document.createElement('tr');
        newRow.className = 'checklist-item-row';
        newRow.innerHTML = `
            <td><input type="text" class="form-control item-clause" placeholder="Clause" style="margin: 0;"></td>
            <td><input type="text" class="form-control item-requirement" placeholder="Requirement" style="margin: 0;"></td>
            <td><button type="button" class="btn btn-sm btn-danger remove-item-row"><i class="fa-solid fa-times"></i></button></td>
        `;
        tbody.appendChild(newRow);
        attachRemoveRowListeners();
    });

    attachRemoveRowListeners();

    modalSave.onclick = () => {
        const name = document.getElementById('checklist-name').value.trim();
        const standard = document.getElementById('checklist-standard').value;
        const type = document.getElementById('checklist-type').value;

        if (!name) {
            window.showNotification('Please enter a checklist name', 'error');
            return;
        }

        const items = [];
        document.querySelectorAll('.checklist-item-row').forEach(row => {
            const clause = row.querySelector('.item-clause').value.trim();
            const requirement = row.querySelector('.item-requirement').value.trim();
            if (clause || requirement) {
                items.push({ clause, requirement });
            }
        });

        checklist.name = name;
        checklist.standard = standard;
        checklist.type = type;
        checklist.items = items;
        checklist.updatedAt = new Date().toISOString().split('T')[0];

        window.saveData();
        window.closeModal();
        renderChecklistLibrary();
        window.showNotification('Checklist updated successfully');
    };
}

function viewChecklistDetail(id) {
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
                    Checklist Items (${checklist.items?.length || 0})
                </h3>
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
            </div>
        </div>
    `;

    contentArea.innerHTML = html;
}

function deleteChecklist(id) {
    const checklist = state.checklists?.find(c => c.id === id);
    if (!checklist) return;

    const isAdmin = state.settings?.isAdmin || false;

    if (checklist.type === 'global' && !isAdmin) {
        window.showNotification('Only admins can delete global checklists', 'error');
        return;
    }

    if (confirm(`Are you sure you want to delete "${checklist.name}"?`)) {
        state.checklists = state.checklists.filter(c => c.id !== id);
        window.saveData();
        renderChecklistLibrary();
        window.showNotification('Checklist deleted successfully');
    }
}

// Export functions
window.renderChecklistLibrary = renderChecklistLibrary;
window.openAddChecklistModal = openAddChecklistModal;
window.openEditChecklistModal = openEditChecklistModal;
window.viewChecklistDetail = viewChecklistDetail;
window.deleteChecklist = deleteChecklist;

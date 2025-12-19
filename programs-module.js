// ============================================
// AUDIT PROGRAMS MODULE - 3-Year Cycle & Timeline
// ============================================

function renderAuditProgramsEnhanced() {
    const state = window.state;
    const searchTerm = state.programSearchTerm || '';

    // Filter programs
    let filteredPrograms = state.auditPrograms.filter(program => {
        return program.client.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const rows = filteredPrograms.map(program => {
        // Calculate progress based on current date vs cycle start/end
        const start = new Date(program.cycleStart);
        const end = new Date(program.cycleEnd);
        const now = new Date();
        const total = end - start;
        const current = now - start;
        let progress = Math.round((current / total) * 100);
        progress = Math.max(0, Math.min(100, progress));

        return `
        <tr class="program-row" data-program-id="${program.id}" style="cursor: pointer;">
            <td>
                <div style="font-weight: 500;">${program.client}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${program.standard}</div>
            </td>
            <td>
                <div>${program.cycleStart}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">to ${program.cycleEnd}</div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${progress}%; height: 100%; background: var(--primary-color);"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${progress}%</span>
                </div>
            </td>
            <td><span class="status-badge status-${program.status.toLowerCase()}">${program.status}</span></td>
            <td>
                <button class="btn btn-sm edit-program" data-program-id="${program.id}" style="color: var(--primary-color); margin-right: 0.5rem;"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-program" data-program-id="${program.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `}).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="program-search" placeholder="Search programs..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="program-filter" style="max-width: 150px; margin-bottom: 0;">
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <button id="btn-new-program" class="btn btn-primary">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> New Program
                </button>
            </div>

            <div class="card" style="margin-bottom: 2rem; padding: 0; overflow: hidden;">
                <div style="padding: 1rem; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-size: 1rem; color: var(--text-primary); margin: 0;">
                        <i class="fa-solid fa-timeline" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                        3-Year Audit Cycle Timeline
                    </h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 12px;">2023</span>
                        <span style="font-size: 0.75rem; padding: 2px 8px; background: #f0f9ff; color: #0c4a6e; border-radius: 12px;">2024</span>
                        <span style="font-size: 0.75rem; padding: 2px 8px; background: #f0f9ff; color: #0c4a6e; border-radius: 12px;">2025</span>
                    </div>
                </div>
                <div id="timeline-visualization" style="padding: 1.5rem; overflow-x: auto;">
                    ${renderTimelineVisualization(filteredPrograms)}
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client & Standard</th>
                            <th>Cycle Period</th>
                            <th>Cycle Progress</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No programs found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('btn-new-program')?.addEventListener('click', openAddProgramModal);

    document.getElementById('program-search')?.addEventListener('input', (e) => {
        state.programSearchTerm = e.target.value;
        renderAuditProgramsEnhanced();
    });

    document.querySelectorAll('.view-program, .program-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-program')) {
                const programId = parseInt(el.getAttribute('data-program-id'));
                renderProgramDetail(programId);
            }
        });
    });

    document.querySelectorAll('.edit-program').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const programId = parseInt(btn.getAttribute('data-program-id'));
            openEditProgramModal(programId);
        });
    });
}

function renderTimelineVisualization(programs) {
    if (!programs || programs.length === 0) return '<p style="text-align: center; color: var(--text-secondary);">No active programs to display.</p>';

    // Take top 5 programs for visualization to avoid clutter
    const displayPrograms = programs.slice(0, 5);

    return `
        <div style="position: relative; min-width: 600px;">
            <!-- Timeline Header -->
            <div style="display: grid; grid-template-columns: 200px 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);">
                <div>Client</div>
                <div>Year 1 (Initial/Recert)</div>
                <div>Year 2 (Surveillance 1)</div>
                <div>Year 3 (Surveillance 2)</div>
            </div>

            <!-- Timeline Rows -->
            ${displayPrograms.map(prog => {
        // Mocking audit dates for visualization based on cycle start
        const startYear = new Date(prog.cycleStart).getFullYear();

        return `
                <div style="display: grid; grid-template-columns: 200px 1fr 1fr 1fr; gap: 1rem; align-items: center; margin-bottom: 1.5rem; position: relative;">
                    <!-- Client Name -->
                    <div style="font-weight: 500; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${prog.client}
                    </div>

                    <!-- Year 1 -->
                    <div style="position: relative; height: 40px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; padding: 0 0.5rem;">
                        <div class="timeline-event" style="background: var(--primary-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Stage 2 Audit">
                            <i class="fa-solid fa-check-circle"></i> Stage 2
                        </div>
                        <div style="position: absolute; bottom: -18px; left: 0; font-size: 0.7rem; color: var(--text-secondary);">${startYear}</div>
                    </div>

                    <!-- Year 2 -->
                    <div style="position: relative; height: 40px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; padding: 0 0.5rem;">
                        <div class="timeline-event" style="background: var(--info-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Surveillance 1">
                            <i class="fa-solid fa-eye"></i> Surv 1
                        </div>
                        <div style="position: absolute; bottom: -18px; left: 0; font-size: 0.7rem; color: var(--text-secondary);">${startYear + 1}</div>
                    </div>

                    <!-- Year 3 -->
                    <div style="position: relative; height: 40px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; padding: 0 0.5rem;">
                        <div class="timeline-event" style="background: var(--warning-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Surveillance 2">
                            <i class="fa-solid fa-eye"></i> Surv 2
                        </div>
                        <div style="position: absolute; bottom: -18px; left: 0; font-size: 0.7rem; color: var(--text-secondary);">${startYear + 2}</div>
                    </div>
                    
                    <!-- Connector Line -->
                    <div style="position: absolute; top: 50%; left: 200px; right: 0; height: 2px; background: #cbd5e1; z-index: -1; transform: translateY(-50%);"></div>
                </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderProgramDetail(programId) {
    const program = state.auditPrograms.find(p => p.id === programId);
    if (!program) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditProgramsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Programs
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${program.client} - ${program.standard}</h2>
                        <p style="color: var(--text-secondary);">Cycle: ${program.cycleStart} to ${program.cycleEnd}</p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="window.openEditProgramModal(${program.id})" style="margin-right: 0.5rem;">
                            <i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit Program
                        </button>
                        <span class="status-badge status-${program.status.toLowerCase()}">${program.status}</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 1.5rem;">Scheduled Audits</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Audit Type</th>
                                <th>Planned Date</th>
                                <th>Auditor</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Stage 1</td>
                                <td>2023-01-15</td>
                                <td>John Doe</td>
                                <td><span class="status-badge status-completed">Completed</span></td>
                                <td><button class="btn btn-sm"><i class="fa-solid fa-file-alt"></i></button></td>
                            </tr>
                            <tr>
                                <td>Stage 2</td>
                                <td>2023-02-20</td>
                                <td>John Doe</td>
                                <td><span class="status-badge status-completed">Completed</span></td>
                                <td><button class="btn btn-sm"><i class="fa-solid fa-file-alt"></i></button></td>
                            </tr>
                            <tr>
                                <td>Surveillance 1</td>
                                <td>2024-02-20</td>
                                <td>Jane Smith</td>
                                <td><span class="status-badge status-scheduled">Scheduled</span></td>
                                <td><button class="btn btn-sm"><i class="fa-solid fa-edit"></i></button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;
}

function openAddProgramModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Create New Audit Program';
    modalBody.innerHTML = `
        <form id="program-form">
            <div class="form-group">
                <label>Client</label>
                <select class="form-control" id="program-client" required onchange="updateProgramClientDetails(this.value)">
                    <option value="">-- Select Client --</option>
                    ${state.clients.map(c => `<option value="${c.name}">${c.name} (${c.industry || 'N/A'})</option>`).join('')}
                </select>
                ${state.clients.length === 0 ? '<small style="color: var(--danger-color);">No clients available. Please add a client first.</small>' : ''}
            </div>
            <div id="program-client-info" style="display: none; background: #f0f9ff; padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.85rem;"></div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="program-standard">
                    <option>ISO 9001:2015</option>
                    <option>ISO 14001:2015</option>
                    <option>ISO 45001:2018</option>
                    <option>ISO 27001:2022</option>
                </select>
            </div>
            <div class="form-group">
                <label>Cycle Start Date</label>
                <input type="date" class="form-control" id="program-start" required>
            </div>
            <div class="form-group">
                <label>Cycle End Date</label>
                <input type="date" class="form-control" id="program-end" required>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const client = document.getElementById('program-client').value;
        const standard = document.getElementById('program-standard').value;
        const start = document.getElementById('program-start').value;
        const end = document.getElementById('program-end').value;

        if (!client) {
            window.showNotification('Please select a client', 'error');
            return;
        }

        if (client && start && end) {
            const newProgram = {
                id: Date.now(),
                client: client,
                standard: standard,
                cycleStart: start,
                cycleEnd: end,
                status: 'Active'
            };

            state.auditPrograms.push(newProgram);
            window.saveData();
            window.closeModal();
            renderAuditProgramsEnhanced();
            window.showNotification('Audit Program created successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
    };
}

function openEditProgramModal(programId) {
    const program = state.auditPrograms.find(p => p.id === programId);
    if (!program) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Edit Audit Program';
    modalBody.innerHTML = `
        <form id="program-form">
            <div class="form-group">
                <label>Client</label>
                <select class="form-control" id="program-client" required disabled>
                    <option value="${program.client}">${program.client}</option>
                </select>
                <small>Client cannot be changed for an existing program.</small>
            </div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="program-standard">
                    <option ${program.standard === 'ISO 9001:2015' ? 'selected' : ''}>ISO 9001:2015</option>
                    <option ${program.standard === 'ISO 14001:2015' ? 'selected' : ''}>ISO 14001:2015</option>
                    <option ${program.standard === 'ISO 45001:2018' ? 'selected' : ''}>ISO 45001:2018</option>
                    <option ${program.standard === 'ISO 27001:2022' ? 'selected' : ''}>ISO 27001:2022</option>
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="program-status">
                    <option ${program.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option ${program.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option ${program.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                </select>
            </div>
            <div class="form-group">
                <label>Cycle Start Date</label>
                <input type="date" class="form-control" id="program-start" value="${program.cycleStart}" required>
            </div>
            <div class="form-group">
                <label>Cycle End Date</label>
                <input type="date" class="form-control" id="program-end" value="${program.cycleEnd}" required>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const standard = document.getElementById('program-standard').value;
        const status = document.getElementById('program-status').value;
        const start = document.getElementById('program-start').value;
        const end = document.getElementById('program-end').value;

        if (start && end) {
            program.standard = standard;
            program.status = status;
            program.cycleStart = start;
            program.cycleEnd = end;

            window.saveData();
            window.closeModal();
            renderAuditProgramsEnhanced();
            window.showNotification('Audit Program updated successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
    };
}

// Helper function to auto-fill program details from client
function updateProgramClientDetails(clientName) {
    const client = state.clients.find(c => c.name === clientName);
    if (client) {
        // Auto-select standard from client
        if (client.standard) {
            const stdSelect = document.getElementById('program-standard');
            if (stdSelect) stdSelect.value = client.standard;
        }

        // Show client info
        const infoPanel = document.getElementById('program-client-info');
        if (infoPanel) {
            const sitesCount = (client.sites && client.sites.length) || 1;
            const primaryContact = (client.contacts && client.contacts[0]) || {};
            infoPanel.innerHTML = `
                <strong>${client.name}</strong><br>
                Industry: ${client.industry || '-'} | 
                Employees: ${client.employees || 0} | 
                Sites: ${sitesCount} | 
                Contact: ${primaryContact.name || '-'}
            `;
            infoPanel.style.display = 'block';
        }
    }
}

// Export functions
window.renderAuditProgramsEnhanced = renderAuditProgramsEnhanced;
window.renderTimelineVisualization = renderTimelineVisualization;
window.renderProgramDetail = renderProgramDetail;
window.openAddProgramModal = openAddProgramModal;
window.openEditProgramModal = openEditProgramModal;
window.updateProgramClientDetails = updateProgramClientDetails;


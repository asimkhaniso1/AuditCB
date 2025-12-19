// Advanced Module Functions for AuditCB360
// This file contains enhanced rendering functions for Auditors, Programmes, Planning, and Execution modules

// ============================================
// AUDITORS MODULE - Enhanced
// ============================================

function renderAuditorsEnhanced() {
    const state = window.state;
    const searchTerm = state.auditorSearchTerm || '';
    const filterRole = state.auditorFilterRole || 'All';

    let filteredAuditors = state.auditors.filter(auditor => {
        const matchesSearch = auditor.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'All' || auditor.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const rows = filteredAuditors.map(auditor => `
        <tr class="auditor-row" data-auditor-id="${auditor.id}" style="cursor: pointer;">
            <td>${auditor.name}</td>
            <td><span style="background: var(--primary-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${auditor.role}</span></td>
            <td>${auditor.standards.join(', ')}</td>
            <td>
                <button class="btn btn-sm edit-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm view-auditor" data-auditor-id="${auditor.id}" style="color: var(--primary-color);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                <div style="display: flex; gap: 1rem; flex: 1;">
                    <input type="text" id="auditor-search" placeholder="Search auditors..." value="${searchTerm}" style="max-width: 300px; margin-bottom: 0;">
                    <select id="auditor-filter" style="max-width: 180px; margin-bottom: 0;">
                        <option value="All" ${filterRole === 'All' ? 'selected' : ''}>All Roles</option>
                        <option value="Lead Auditor" ${filterRole === 'Lead Auditor' ? 'selected' : ''}> Lead Auditor</option>
                        <option value="Auditor" ${filterRole === 'Auditor' ? 'selected' : ''}>Auditor</option>
                        <option value="Technical Expert" ${filterRole === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                    </select>
                    <button class="btn btn-secondary" onclick="renderCompetenceMatrix()">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i> Competence Matrix
                    </button>
                </div>
                <button class="btn btn-primary" onclick="window.openAddAuditorModal()"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Auditor</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Qualified Standards</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No auditors found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    contentArea.innerHTML = html;

    // Event listeners
    document.getElementById('auditor-search')?.addEventListener('input', (e) => {
        state.auditorSearchTerm = e.target.value;
        renderAuditorsEnhanced();
    });

    document.getElementById('auditor-filter')?.addEventListener('change', (e) => {
        state.auditorFilterRole = e.target.value;
        renderAuditorsEnhanced();
    });

    document.querySelectorAll('.view-auditor, .auditor-row').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.edit-auditor')) {
                const auditorId = parseInt(el.getAttribute('data-auditor-id'));
                renderAuditorDetail(auditorId);
            }
        });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-auditor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const auditorId = parseInt(btn.getAttribute('data-auditor-id'));
            openEditAuditorModal(auditorId);
        });
    });
}

function renderAuditorDetail(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditorsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Auditors
                </button>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin-bottom: 0.5rem;">${auditor.name}</h2>
                        <p style="color: var(--text-secondary);">${auditor.role}</p>
                    </div>
                    <button class="btn btn-primary edit-auditor" data-auditor-id="${auditor.id}">
                        <i class="fa-solid fa-edit" style="margin-right: 0.5rem;"></i> Edit Auditor
                    </button>
                </div>
            </div>

            <div class="tab-container" style="border-bottom: 2px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-tab="info">Information</button>
                <button class="tab-btn" data-tab="competence">Competence</button>
                <button class="tab-btn" data-tab="training">Training</button>
                <button class="tab-btn" data-tab="documents">Documents</button>
                <button class="tab-btn" data-tab="history">Audit History</button>
            </div>

            <div id="tab-content"></div>
        </div>
    `;

    contentArea.innerHTML = html;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderAuditorTab(auditor, e.target.getAttribute('data-tab'));
        });
    });

    renderAuditorTab(auditor, 'info');
}

function renderAuditorTab(auditor, tabName) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'info':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Personal Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Full Name</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.name}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Role</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">${auditor.role}</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Email</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">auditor@example.com</p>
                        </div>
                        <div>
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Phone</label>
                            <p style="font-weight: 500; margin-top: 0.25rem;">+1 234 567 8900</p>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'competence':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Competence & Qualifications</h3>
                    <table class="table-container">
                        <thead>
                            <tr>
                                <th>Standard</th>
                                <th>Level</th>
                                <th>Valid Until</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${auditor.standards.map(std => `
                                <tr>
                                    <td>${std}</td>
                                    <td><span style="background: var(--success-color); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Lead Auditor</span></td>
                                    <td>2025-12-31</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            break;
        case 'training':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Training Records</h3>
                    <p style="color: var(--text-secondary);">No training records available.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add Training
                    </button>
                </div>
            `;
            break;
        case 'documents':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Documents & Attachments</h3>
                    <p style="color: var(--text-secondary);">No documents uploaded.</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i> Upload Document
                    </button>
                </div>
            `;
            break;
        case 'history':
            tabContent.innerHTML = `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Audit History</h3>
                    <p style="color: var(--text-secondary);">No audit history available.</p>
                </div>
            `;
            break;
    }
}

function renderCompetenceMatrix() {
    const standards = ['ISO 9001', 'ISO 14001', 'ISO 27001', 'ISO 45001'];

    const html = `
        <div class="fade-in">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-secondary" onclick="renderAuditorsEnhanced()">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i> Back to Auditors
                </button>
            </div>
            
            <div class="card">
                <h2 style="margin-bottom: 1.5rem;">Auditor Competence Matrix</h2>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Auditor Name</th>
                                ${standards.map(std => `<th>${std}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${state.auditors.map(auditor => `
                                <tr>
                                    <td style="font-weight: 500;">${auditor.name}</td>
                                    ${standards.map(std => {
        const hasStd = auditor.standards.some(s => s.includes(std.split(' ')[1]));
        return `<td style="text-align: center;">
                                            ${hasStd ? '<i class="fa-solid fa-check-circle" style="color: var(--success-color); font-size: 1.2rem;"></i>' : '-'}
                                        </td>`;
    }).join('')}
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

// ============================================
// MAN-DAY CALCULATOR (ISO 17021-1)
// ============================================

function calculateManDays(employees, sites, effectiveness, shiftWork, riskLevel) {
    // ISO 17021-1 base man-days table (simplified)
    let baseDays = 0;

    if (employees <= 10) baseDays = 2;
    else if (employees <= 25) baseDays = 3;
    else if (employees <= 50) baseDays = 4;
    else if (employees <= 100) baseDays = 6;
    else if (employees <= 250) baseDays = 9;
    else if (employees <= 500) baseDays = 12;
    else if (employees <= 1000) baseDays = 16;
    else if (employees <= 2500) baseDays = 21;
    else baseDays = 30;

    // Adjust for effectiveness
    const effectivenessMultiplier = {
        1: 1.2,  // Low effectiveness
        2: 1.0,  // Normal
        3: 0.8   // High effectiveness
    };
    baseDays *= effectivenessMultiplier[effectiveness] || 1.0;

    // Adjust for sites (add 20% per additional site)
    if (sites > 1) {
        baseDays += baseDays * 0.2 * (sites - 1);
    }

    // Adjust for shift work (add 20%)
    if (shiftWork) {
        baseDays *= 1.2;
    }

    // Adjust for risk
    const riskMultiplier = {
        'Low': 0.9,
        'Medium': 1.0,
        'High': 1.3
    };
    baseDays *= riskMultiplier[riskLevel] || 1.0;

    return {
        stage1: Math.ceil(baseDays * 0.2),  // 20% for Stage 1
        stage2: Math.ceil(baseDays),
        surveillance: Math.ceil(baseDays * 0.33)  // 33% for Surveillance
    };
}

// ============================================
// MAN-DAY CALCULATOR UI
// ============================================

function renderManDayCalculator() {
    const html = `
        <div class="fade-in">
            <div class="card" style="max-width: 800px; margin: 0 auto;">
                <h2 style="margin-bottom: 1rem; color: var(--primary-color);">
                    <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                    Man-Day Calculator (ISO 17021-1)
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Calculate audit duration based on ISO/IEC 17021-1 requirements
                </p>

                <form id="manday-form" style="margin-bottom: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                        <!-- Employees -->
                        <div class="form-group">
                            <label for="employees">Number of Employees <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="employees" min="1" value="100" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">Total permanent employees</small>
                        </div>

                        <!-- Sites -->
                        <div class="form-group">
                            <label for="sites">Number of Sites <span style="color: var(--danger-color);">*</span></label>
                            <input type="number" id="sites" min="1" value="1" required>
                            <small style="color: var(--text-secondary); font-size: 0.8rem;">Number of locations</small>
                        </div>

                        <!-- Effectiveness -->
                        <div class="form-group">
                            <label for="effectiveness">Management System Effectiveness <span style="color: var(--danger-color);">*</span></label>
                            <select id="effectiveness" required>
                                <option value="1">Low (First time, new system)</option>
                                <option value="2" selected>Normal (Established system)</option>
                                <option value="3">High (Mature, well-documented)</option>
                            </select>
                        </div>

                        <!-- Shift Work -->
                        <div class="form-group">
                            <label for="shiftwork">Shift Work Operations <span style="color: var(--danger-color);">*</span></label>
                            <select id="shiftwork" required>
                                <option value="false" selected>No</option>
                                <option value="true">Yes (Multiple shifts)</option>
                            </select>
                        </div>

                        <!-- Risk Level -->
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label for="risk">Operational Risk Level <span style="color: var(--danger-color);">*</span></label>
                            <select id="risk" required>
                                <option value="Low">Low (Office work, low hazard)</option>
                                <option value="Medium" selected>Medium (Standard operations)</option>
                                <option value="High">High (Hazardous, complex processes)</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">
                        <i class="fa-solid fa-calculator" style="margin-right: 0.5rem;"></i>
                        Calculate Man-Days
                    </button>
                </form>

                <!-- Results Section -->
                <div id="calculation-results" style="display: none;">
                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 2rem 0;">
                    
                    <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                        <i class="fa-solid fa-chart-bar" style="margin-right: 0.5rem;"></i>
                        Calculated Audit Duration
                    </h3>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Stage 1</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-stage1">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Stage 2</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-stage2">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>

                        <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center;">
                            <p style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Surveillance</p>
                            <p style="font-size: 2.5rem; font-weight: 700;" id="result-surveillance">--</p>
                            <p style="font-size: 0.875rem; opacity: 0.9;">man-days</p>
                        </div>
                    </div>

                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">
                            <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                            Calculation Details
                        </h4>
                        <div id="calculation-details" style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.8;">
                            <!-- Dynamic calculation breakdown will appear here -->
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <button class="btn btn-primary" onclick="saveCalculationToPlan()">
                            <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>
                            Save to Audit Plan
                        </button>
                        <button class="btn btn-secondary" onclick="printCalculation()">
                            <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>
                            Print Results
                        </button>
                    </div>
                </div>

                <!-- Reference Table -->
                <div style="margin-top: 3rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-table" style="margin-right: 0.5rem;"></i>
                        ISO 17021-1 Reference Table
                    </h4>
                    <div style="overflow-x: auto;">
                        <table style="font-size: 0.875rem;">
                            <thead>
                                <tr>
                                    <th>Number of Employees</th>
                                    <th>Base Man-Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>1 - 10</td><td>2 days</td></tr>
                                <tr><td>11 - 25</td><td>3 days</td></tr>
                                <tr><td>26 - 50</td><td>4 days</td></tr>
                                <tr><td>51 - 100</td><td>6 days</td></tr>
                                <tr><td>101 - 250</td><td>9 days</td></tr>
                                <tr><td>251 - 500</td><td>12 days</td></tr>
                                <tr><td>501 - 1000</td><td>16 days</td></tr>
                                <tr><td>1001 - 2500</td><td>21 days</td></tr>
                                <tr><td>2501+</td><td>30 days</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    contentArea.innerHTML = html;

    // Form submission handler
    document.getElementById('manday-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const employees = parseInt(document.getElementById('employees').value);
        const sites = parseInt(document.getElementById('sites').value);
        const effectiveness = parseInt(document.getElementById('effectiveness').value);
        const shiftWork = document.getElementById('shiftwork').value === 'true';
        const risk = document.getElementById('risk').value;

        // Calculate
        const results = calculateManDays(employees, sites, effectiveness, shiftWork, risk);

        // Display results
        document.getElementById('result-stage1').textContent = results.stage1;
        document.getElementById('result-stage2').textContent = results.stage2;
        document.getElementById('result-surveillance').textContent = results.surveillance;

        // Show breakdown
        const details = `
            <div style="display: grid; gap: 0.5rem;">
                <div><strong>Base Parameters:</strong></div>
                <div>• Employees: ${employees}</div>
                <div>• Sites: ${sites} ${sites > 1 ? '(+20% per additional site)' : ''}</div>
                <div>• Effectiveness: ${effectiveness === 1 ? 'Low (+20%)' : effectiveness === 3 ? 'High (-20%)' : 'Normal'}</div>
                <div>• Shift Work: ${shiftWork ? 'Yes (+20%)' : 'No'}</div>
                <div>• Risk Level: ${risk} ${risk === 'High' ? '(+30%)' : risk === 'Low' ? '(-10%)' : ''}</div>
                <div style="margin-top: 0.5rem;"><strong>Stage Breakdown:</strong></div>
                <div>• Stage 1 = 20% of base calculation</div>
                <div>• Stage 2 = Full base calculation</div>
                <div>• Surveillance = 33% of base calculation</div>
            </div>
        `;
        document.getElementById('calculation-details').innerHTML = details;

        // Show results section
        document.getElementById('calculation-results').style.display = 'block';

        // Scroll to results
        document.getElementById('calculation-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// Helper functions for calculator
function saveCalculationToPlan() {
    showNotification('Man-day calculation saved to draft audit plan', 'success');
}

function printCalculation() {
    window.print();
}

function openAddAuditorModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add New Auditor';
    modalBody.innerHTML = `
        <form id="auditor-form">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" class="form-control" id="auditor-name" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="auditor-role">
                    <option>Lead Auditor</option>
                    <option>Auditor</option>
                    <option>Technical Expert</option>
                </select>
            </div>
            <div class="form-group">
                <label>Qualified Standards (Hold Ctrl/Cmd to select multiple)</label>
                <select class="form-control" id="auditor-standards" multiple style="height: 100px;">
                    <option>ISO 9001</option>
                    <option>ISO 14001</option>
                    <option>ISO 27001</option>
                    <option>ISO 45001</option>
                </select>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('auditor-name').value;
        const role = document.getElementById('auditor-role').value;
        const standardsSelect = document.getElementById('auditor-standards');
        const standards = Array.from(standardsSelect.selectedOptions).map(option => option.value);

        if (name && standards.length > 0) {
            const newAuditor = {
                id: Date.now(),
                name: name,
                role: role,
                standards: standards
            };

            state.auditors.push(newAuditor);
            window.saveData();
            window.closeModal();
            renderAuditorsEnhanced();
            window.showNotification('Auditor added successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
    };
}

function openEditAuditorModal(auditorId) {
    const auditor = state.auditors.find(a => a.id === auditorId);
    if (!auditor) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Edit Auditor';
    modalBody.innerHTML = `
        <form id="auditor-form">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" class="form-control" id="auditor-name" value="${auditor.name}" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="auditor-role">
                    <option ${auditor.role === 'Lead Auditor' ? 'selected' : ''}>Lead Auditor</option>
                    <option ${auditor.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    <option ${auditor.role === 'Technical Expert' ? 'selected' : ''}>Technical Expert</option>
                </select>
            </div>
            <div class="form-group">
                <label>Qualified Standards (Hold Ctrl/Cmd to select multiple)</label>
                <select class="form-control" id="auditor-standards" multiple style="height: 100px;">
                    <option ${auditor.standards.includes('ISO 9001') ? 'selected' : ''}>ISO 9001</option>
                    <option ${auditor.standards.includes('ISO 14001') ? 'selected' : ''}>ISO 14001</option>
                    <option ${auditor.standards.includes('ISO 27001') ? 'selected' : ''}>ISO 27001</option>
                    <option ${auditor.standards.includes('ISO 45001') ? 'selected' : ''}>ISO 45001</option>
                </select>
            </div>
        </form>
    `;

    window.openModal();

    modalSave.onclick = () => {
        const name = document.getElementById('auditor-name').value;
        const role = document.getElementById('auditor-role').value;
        const standardsSelect = document.getElementById('auditor-standards');
        const standards = Array.from(standardsSelect.selectedOptions).map(option => option.value);

        if (name && standards.length > 0) {
            auditor.name = name;
            auditor.role = role;
            auditor.standards = standards;

            window.saveData();
            window.closeModal();
            renderAuditorsEnhanced();
            window.showNotification('Auditor updated successfully');
        } else {
            window.showNotification('Please fill in all required fields', 'error');
        }
    };
}

// Export functions to global scope
window.renderAuditorsEnhanced = renderAuditorsEnhanced;
window.renderAuditorDetail = renderAuditorDetail;
window.renderCompetenceMatrix = renderCompetenceMatrix;
window.calculateManDays = calculateManDays;
window.renderManDayCalculator = renderManDayCalculator;
window.openAddAuditorModal = openAddAuditorModal;
window.openEditAuditorModal = openEditAuditorModal;

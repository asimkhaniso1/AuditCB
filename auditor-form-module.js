// ============================================
// AUDITOR FORM MODULE
// ============================================
// Handles adding/editing auditors in a full-page view

function renderAuditorForm(auditorId = null) {
    const isEdit = !!auditorId;
    let auditor = null;

    if (isEdit) {
        auditor = window.state.auditors.find(a => String(a.id) === String(auditorId));
        if (!auditor) {
            window.showNotification('Auditor not found', 'error');
            window.location.hash = '#auditors-list';
            return;
        }
    }

    // Helpers for safe access
    const val = (prop, defaultVal = '') => auditor && auditor[prop] ? auditor[prop] : defaultVal;
    const edu = (prop) => auditor && auditor.education && auditor.education[prop] ? auditor.education[prop] : '';
    const soft = (prop) => auditor && auditor.softSkills && auditor.softSkills[prop] ? auditor.softSkills[prop] : 'good';

    // Helper for Selects
    const sel = (prop, value) => val(prop) === value ? 'selected' : '';
    const eduSel = (prop, value) => edu(prop) === value ? 'selected' : '';
    const softSel = (prop, value) => soft(prop) === value ? 'selected' : '';
    const hasStd = (std) => auditor && auditor.standards && auditor.standards.includes(std) ? 'selected' : '';

    const title = isEdit ? `Edit Auditor: ${auditor.name}` : 'Add New Auditor';
    const btnText = isEdit ? 'Update Auditor' : 'Create Auditor';

    const html = `
        <div class="dashboard-header">
            <h2><i class="fa-solid fa-user-tie"></i> ${title}</h2>
            <button class="btn btn-secondary" onclick="window.location.hash='#auditors-list'">
                <i class="fa-solid fa-arrow-left"></i> Back to List
            </button>
        </div>

        <div class="form-container" style="max-width: 900px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <form id="full-auditor-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                
                <!-- Personal Details -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: #1e40af; font-weight: 600;">Personal Details</div>
                
                <div class="form-group">
                    <label>Full Name <span style="color: #ef4444;">*</span></label>
                    <input type="text" class="form-control" id="auditor-name" required value="${val('name')}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select class="form-control" id="auditor-role">
                        <option ${sel('role', 'Lead Auditor')}>Lead Auditor</option>
                        <option ${sel('role', 'Auditor')}>Auditor</option>
                        <option ${sel('role', 'Technical Expert')}>Technical Expert</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Age</label>
                    <input type="number" class="form-control" id="auditor-age" min="18" max="80" value="${val('age')}">
                </div>
                <div class="form-group">
                    <label>Experience (Years)</label>
                    <input type="number" class="form-control" id="auditor-experience" min="0" value="${val('experience')}">
                </div>
                <div class="form-group">
                    <label>Date Joined</label>
                    <input type="date" class="form-control" id="auditor-joined" value="${val('dateJoined', new Date().toISOString().split('T')[0])}">
                </div>

                <!-- Contact Info -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: #1e40af; font-weight: 600;">Contact Information</div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" class="form-control" id="auditor-email" value="${val('email')}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" class="form-control" id="auditor-phone" value="${val('phone')}">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Location</label>
                    <input type="text" class="form-control" id="auditor-location" value="${val('location')}">
                </div>

                <!-- Expertise & Stats -->
                <div style="grid-column: 1 / -1; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: #1e40af; font-weight: 600;">Expertise & Rate</div>
                
                <div class="form-group">
                    <label>Qualified Standards <span style="color: #ef4444;">*</span></label>
                    <select class="form-control" id="auditor-standards" multiple style="height: 100px;">
                        <option ${hasStd('ISO 9001')}>ISO 9001</option>
                        <option ${hasStd('ISO 14001')}>ISO 14001</option>
                        <option ${hasStd('ISO 27001')}>ISO 27001</option>
                        <option ${hasStd('ISO 45001')}>ISO 45001</option>
                    </select>
                    <small style="color: #64748b;">Hold Ctrl/Cmd to select multiple</small>
                </div>
                
                <div class="form-group">
                    <label>Man-Day Rate (USD)</label>
                    <input type="number" class="form-control" id="auditor-rate" min="0" value="${val('manDayRate')}">
                </div>

                <!-- Buttons -->
                 <div style="grid-column: 1 / -1; margin-top: 1.5rem; display: flex; gap: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                    <button type="button" class="btn btn-primary" onclick="window.saveAuditorForm('${auditorId || ''}')">
                        <i class="fa-solid fa-save"></i> ${btnText}
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.location.hash='#auditors-list'">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;

    window.contentArea.innerHTML = html;
}

// Save Handler
window.saveAuditorForm = function (auditorId) {
    const isEdit = !!auditorId;

    // 1. Get Values
    const name = document.getElementById('auditor-name').value;
    const email = document.getElementById('auditor-email').value;

    // 2. Validate
    if (!name) {
        window.showNotification('Name is required', 'error');
        return;
    }

    const standardsSelect = document.getElementById('auditor-standards');
    const standards = Array.from(standardsSelect.selectedOptions).map(opt => opt.value);

    if (standards.length === 0) {
        window.showNotification('Please select at least one standard', 'error');
        return;
    }

    // 3. Construct Object
    // Update existing or Create New
    let auditor = {};
    if (isEdit) {
        const existing = window.state.auditors.find(a => String(a.id) === String(auditorId));
        if (existing) auditor = { ...existing }; // Clone
    } else {
        auditor = {
            id: Date.now(),
            auditHistory: [],
            evaluations: { witnessAudits: [], performanceReviews: [] }
        };
    }

    // Update fields
    auditor.name = name;
    auditor.email = email;
    auditor.role = document.getElementById('auditor-role').value;
    auditor.standards = standards;
    auditor.age = parseInt(document.getElementById('auditor-age').value) || null;
    auditor.experience = parseInt(document.getElementById('auditor-experience').value) || 0;
    auditor.dateJoined = document.getElementById('auditor-joined').value;
    auditor.phone = document.getElementById('auditor-phone').value;
    auditor.location = document.getElementById('auditor-location').value;
    auditor.manDayRate = parseInt(document.getElementById('auditor-rate').value) || 0;
    auditor.updatedAt = new Date().toISOString();

    // 4. Save to State
    if (isEdit) {
        const index = window.state.auditors.findIndex(a => String(a.id) === String(auditorId));
        if (index !== -1) {
            window.state.auditors[index] = auditor;
        }
    } else {
        window.state.auditors.push(auditor);
    }

    // 5. Persist
    window.saveData(); // Save to LocalStorage

    // Explicit Database Persistence (ensure real-time sync)
    (async () => {
        try {
            // Prepare payload for DB (map to columns)
            const dbPayload = {
                id: String(auditor.id),
                name: auditor.name,
                email: auditor.email,
                role: auditor.role,
                standards: Array.isArray(auditor.standards) ? JSON.stringify(auditor.standards) : auditor.standards,
                data: auditor // Store full object in data column
            };

            if (isEdit) {
                await window.SupabaseClient.db.update('auditors', String(auditorId), dbPayload);
            } else {
                await window.SupabaseClient.db.insert('auditors', dbPayload);
            }
            window.showNotification(isEdit ? 'Auditor updated in Cloud' : 'Auditor created in Cloud', 'success');
        } catch (dbError) {
            console.error('Auditor Cloud Sync Error:', dbError);
            window.showNotification('Saved locally, but Cloud sync failed: ' + dbError.message, 'warning');
        }
    })();

    window.showNotification(isEdit ? 'Auditor updated' : 'Auditor created', 'success');
    window.location.hash = '#auditors-list';
};

// Export
window.renderAuditorForm = renderAuditorForm;

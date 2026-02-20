// ============================================
// AUDITOR FORM MODULE
// ============================================
// Handles adding/editing auditors in a full-page view
// Includes tabbed interface for better organization and ISO compliance details

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
    const soft = (prop, defaultVal = 'good') => auditor && auditor.softSkills && auditor.softSkills[prop] ? auditor.softSkills[prop] : defaultVal;

    // Helper for Selects
    const sel = (prop, value) => val(prop) === value ? 'selected' : '';
    const hasStd = (std) => auditor && auditor.standards && auditor.standards.includes(std) ? 'selected' : '';

    const title = isEdit ? `Edit Auditor: ${auditor.name}` : 'Add New Auditor';
    const btnText = isEdit ? 'Update Auditor' : 'Create Auditor';

    const html = `
        <div class="dashboard-header">
            <h2><i class="fa-solid fa-user-tie"></i> ${title}</h2>
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-secondary" data-hash="#auditors-list" aria-label="Back">
                    <i class="fa-solid fa-arrow-left"></i> Back to List
                </button>
            </div>
        </div>

        <div class="form-container" style="max-width: 1000px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: var(--shadow-md); overflow: hidden;">
            <!-- Form Tabs -->
            <div style="display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <button class="form-tab-btn active" data-tab="general" style="padding: 1rem 1.5rem; border: none; background: none; font-weight: 600; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                    <i class="fa-solid fa-user" style="margin-right: 0.5rem;"></i>General Info
                </button>
                <button class="form-tab-btn" data-tab="expertise" style="padding: 1rem 1.5rem; border: none; background: none; font-weight: 500; color: var(--text-secondary); cursor: pointer;">
                    <i class="fa-solid fa-graduation-cap" style="margin-right: 0.5rem;"></i>Expertise & Education
                </button>
                <button class="form-tab-btn" data-tab="capabilities" style="padding: 1rem 1.5rem; border: none; background: none; font-weight: 500; color: var(--text-secondary); cursor: pointer;">
                    <i class="fa-solid fa-briefcase" style="margin-right: 0.5rem;"></i>Industry Scopes
                </button>
                <button class="form-tab-btn" data-tab="skills" style="padding: 1rem 1.5rem; border: none; background: none; font-weight: 500; color: var(--text-secondary); cursor: pointer;" aria-label="Favorite">
                    <i class="fa-solid fa-star" style="margin-right: 0.5rem;"></i>Soft Skills
                </button>
            </div>

            <form id="full-auditor-form" style="padding: 2rem;">
                <!-- Tab: General Info -->
                <div id="form-tab-general" class="form-tab-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Personal Details</label>
                        </div>
                        <div class="form-group">
                            <label>Full Name <span style="color: #ef4444;">*</span></label>
                            <input type="text" class="form-control" id="auditor-name" required value="${val('name')}">
                        </div>
                        <div class="form-group">
                            <label>Role / Appointment <span style="color: #ef4444;">*</span></label>
                            <select class="form-control" id="auditor-role">
                                <option value="Lead Auditor" ${sel('role', 'Lead Auditor')}>Lead Auditor</option>
                                <option value="Auditor" ${sel('role', 'Auditor')}>Auditor</option>
                                <option value="Technical Expert" ${sel('role', 'Technical Expert')}>Technical Expert</option>
                                <option value="Provisional Auditor" ${sel('role', 'Provisional Auditor')}>Provisional Auditor</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Profile Picture URL</label>
                            <input type="text" class="form-control" id="auditor-picture" placeholder="https://example.com/photo.jpg" value="${val('pictureUrl')}">
                        </div>
                        <div class="form-group">
                            <label>Date Joined</label>
                            <input type="date" class="form-control" id="auditor-joined" value="${val('dateJoined', new Date().toISOString().split('T')[0])}">
                        </div>
                        <div class="form-group">
                            <label>Age</label>
                            <input type="number" class="form-control" id="auditor-age" min="18" max="80" value="${val('age')}">
                        </div>
                        <div class="form-group">
                            <label>Years of Audit Experience</label>
                            <input type="number" class="form-control" id="auditor-experience" min="0" value="${val('experience')}">
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1; margin-top: 1rem;">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Contact Information</label>
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" class="form-control" id="auditor-email" value="${val('email')}">
                        </div>
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="text" class="form-control" id="auditor-phone" value="${val('phone')}">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Base Location (City, Country)</label>
                            <input type="text" class="form-control" id="auditor-location" value="${val('location')}" placeholder="e.g. London, UK">
                        </div>
                    </div>
                </div>

                <!-- Tab: Expertise & Education -->
                <div id="form-tab-expertise" class="form-tab-content" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Standards & Financials</label>
                        </div>
                        <div class="form-group">
                            <label>Qualified Standards <span style="color: #ef4444;">*</span></label>
                            <select class="form-control" id="auditor-standards" multiple style="height: 120px;">
                                <option value="ISO 9001" ${hasStd('ISO 9001')}>ISO 9001 (QMS)</option>
                                <option value="ISO 14001" ${hasStd('ISO 14001')}>ISO 14001 (EMS)</option>
                                <option value="ISO 45001" ${hasStd('ISO 45001')}>ISO 45001 (OHS)</option>
                                <option value="ISO 27001" ${hasStd('ISO 27001')}>ISO 27001 (ISMS)</option>
                                <option value="ISO 22000" ${hasStd('ISO 22000')}>ISO 22000 (FSMS)</option>
                                <option value="ISO 13485" ${hasStd('ISO 13485')}>ISO 13485 (Medical Devices)</option>
                                <option value="ISO 50001" ${hasStd('ISO 50001')}>ISO 50001 (Energy)</option>
                            </select>
                            <small style="color: #64748b;">Hold Ctrl/Cmd to select multiple</small>
                        </div>
                        <div class="form-group">
                            <label>Man-Day Rate ($ USD)</label>
                            <input type="number" class="form-control" id="auditor-rate" min="0" value="${val('manDayRate')}">
                            <small style="color: #64748b;">Standard rate for financial calculations</small>
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1; margin-top: 1rem;">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Academic Education</label>
                        </div>
                        <div class="form-group">
                            <label>Highest Degree</label>
                            <input type="text" class="form-control" id="auditor-degree" value="${edu('degree')}" placeholder="e.g. M.Sc. Engineering">
                        </div>
                        <div class="form-group">
                            <label>Field of Study</label>
                            <input type="text" class="form-control" id="auditor-field" value="${edu('fieldOfStudy')}" placeholder="e.g. Environmental Science">
                        </div>
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>Specialization / Additional Projects</label>
                            <textarea class="form-control" id="auditor-specialization" rows="3">${edu('specialization')}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Tab: Industry Scopes -->
                <div id="form-tab-capabilities" class="form-tab-content" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                        <div class="form-group">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Authorized Codes & Industries</label>
                             <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Assign NACE / EA codes or descriptive industry expertise for matching with clients.</p>
                        </div>
                        
                        <div class="form-group">
                            <label>Domain Expertise (NACE Groups / Topics)</label>
                            <textarea class="form-control" id="auditor-expertise" rows="4" placeholder="Enter comma-separated expert domains, e.g. Mechanical Engineering, Chemical Safety, Software Development">${val('domainExpertise') ? (Array.isArray(auditor.domainExpertise) ? auditor.domainExpertise.join(', ') : auditor.domainExpertise) : ''}</textarea>
                        </div>

                        <div class="form-group">
                            <label>Authorized Industry Sectors</label>
                            <textarea class="form-control" id="auditor-industries" rows="4" placeholder="Enter comma-separated industry names, e.g. Construction, Healthcare, Textile, IT Services">${val('industries') ? (Array.isArray(auditor.industries) ? auditor.industries.join(', ') : auditor.industries) : ''}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Tab: Soft Skills -->
                <div id="form-tab-skills" class="form-tab-content" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                             <label style="color: #1e40af; font-weight: 600; margin-bottom: 1.5rem; display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Auditor Behavior & Skills (ISO 19011)</label>
                        </div>

                        ${['Ethical', 'Communication', 'Observant', 'Analytical', 'Professionalism', 'Critical Thinking'].map(skill => `
                            <div class="form-group">
                                <label style="display: flex; justify-content: space-between;">
                                    <span>${skill}</span>
                                    <span id="skill-val-${skill.toLowerCase()}" style="color: var(--primary-color); font-weight: 600;">${soft(skill.toLowerCase()) === 'excellent' ? '5/5' : soft(skill.toLowerCase()) === 'good' ? '4/5' : '3/5'}</span>
                                </label>
                                <select class="form-control" id="skill-${skill.toLowerCase()}" data-action-change="updateSkillValue">
                                    <option value="excellent" ${soft(skill.toLowerCase()) === 'excellent' ? 'selected' : ''}>Excellent / Lead Level</option>
                                    <option value="good" ${soft(skill.toLowerCase()) === 'good' ? 'selected' : ''}>Good / Proficient</option>
                                    <option value="fair" ${soft(skill.toLowerCase()) === 'fair' ? 'selected' : ''}>Fair / Developing</option>
                                </select>
                            </div>
                        `).join('')}

                        <div class="form-group" style="grid-column: 1 / -1; margin-top: 1rem;">
                            <label>Additional Notes on Competence</label>
                            <textarea class="form-control" id="auditor-notes" rows="3" placeholder="Enter internal notes regarding auditor behavior or specific strengths...">${val('notes')}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Form Footer -->
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #f1f5f9; display: flex; gap: 1rem; justify-content: flex-end;">
                     <button type="button" class="btn btn-secondary btn-lg" data-hash="#auditors-list" style="min-width: 150px;">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary btn-lg" data-action="saveAuditorForm" data-id="${auditorId || ''}" style="min-width: 200px;" aria-label="Save">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> ${btnText}
                    </button>
                </div>
            </form>
        </div>
    `;

    window.contentArea.innerHTML = html;

    // Tab switching logic (must be after innerHTML to attach listeners)
    const formTabButtons = document.querySelectorAll('.form-tab-btn');
    formTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            formTabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.color = 'var(--text-secondary)';
                b.style.fontWeight = '500';
                b.style.borderBottom = 'none';
            });
            btn.classList.add('active');
            btn.style.color = 'var(--primary-color)';
            btn.style.fontWeight = '600';
            btn.style.borderBottom = '2px solid var(--primary-color)';

            // Update contents
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.form-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            const targetTab = document.getElementById('form-tab-' + tabId);
            if (targetTab) targetTab.style.display = 'block';
        });
    });
}

// Save Handler
window.saveAuditorForm = function (auditorId) {
    const isEdit = !!auditorId;

    // 1. Basic Validation
    const name = document.getElementById('auditor-name').value;
    const email = document.getElementById('auditor-email').value;

    if (!name) {
        window.showNotification('Full Name is required', 'error');
        // Switch to general tab
        document.querySelector('[data-tab="general"]').click();
        return;
    }

    const standardsSelect = document.getElementById('auditor-standards');
    const standards = Array.from(standardsSelect.selectedOptions).map(opt => opt.value);

    if (standards.length === 0) {
        window.showNotification('Please select at least one qualified standard', 'error');
        document.querySelector('[data-tab="expertise"]').click();
        return;
    }

    // 2. Build Object
    let auditor = {};
    if (isEdit) {
        const existing = window.state.auditors.find(a => String(a.id) === String(auditorId));
        if (existing) auditor = { ...existing };
    } else {
        auditor = {
            id: Date.now(),
            auditHistory: [],
            evaluations: { witnessAudits: [], performanceReviews: [], reportReviews: [] },
            documents: []
        };
    }

    // Update General Info
    auditor.name = name;
    auditor.role = document.getElementById('auditor-role').value;
    auditor.pictureUrl = document.getElementById('auditor-picture').value;
    auditor.dateJoined = document.getElementById('auditor-joined').value;
    auditor.age = parseInt(document.getElementById('auditor-age', 10).value) || null;
    auditor.experience = parseInt(document.getElementById('auditor-experience', 10).value) || 0;
    auditor.email = email;
    auditor.phone = document.getElementById('auditor-phone').value;
    auditor.location = document.getElementById('auditor-location').value;

    // Update Expertise & Education
    auditor.standards = standards;
    auditor.manDayRate = parseInt(document.getElementById('auditor-rate', 10).value) || 0;

    auditor.education = {
        degree: document.getElementById('auditor-degree').value,
        fieldOfStudy: document.getElementById('auditor-field').value,
        specialization: document.getElementById('auditor-specialization').value
    };

    // Update Industry Scopes
    auditor.domainExpertise = document.getElementById('auditor-expertise').value.split(',').map(s => s.trim()).filter(s => s);
    auditor.industries = document.getElementById('auditor-industries').value.split(',').map(s => s.trim()).filter(s => s);

    // Update Soft Skills
    auditor.softSkills = {
        ethical: document.getElementById('skill-ethical').value,
        communication: document.getElementById('skill-communication').value,
        observant: document.getElementById('skill-observant').value,
        analytical: document.getElementById('skill-analytical').value,
        professionalism: document.getElementById('skill-professionalism').value,
        criticalthinking: document.getElementById('skill-critical thinking').value
    };

    auditor.notes = document.getElementById('auditor-notes').value;
    auditor.updatedAt = new Date().toISOString();

    // 3. Save to Global State
    if (isEdit) {
        const index = window.state.auditors.findIndex(a => String(a.id) === String(auditorId));
        if (index !== -1) window.state.auditors[index] = auditor;
    } else {
        window.state.auditors.push(auditor);
    }

    // 4. Persistence
    window.saveData();

    // Cloud Persistence
    (async () => {
        try {
            const dbPayload = {
                id: String(auditor.id),
                name: auditor.name,
                email: auditor.email,
                role: auditor.role,
                standards: auditor.standards,
                data: auditor
            };

            if (isEdit) {
                await window.SupabaseClient.db.update('auditors', String(auditorId), dbPayload);
            } else {
                await window.SupabaseClient.db.insert('auditors', dbPayload);
            }
            window.showNotification(isEdit ? 'Cloud sync successful' : 'Created in Cloud', 'success');
        } catch (err) {
            console.error('Cloud Sync Error:', err);
            window.showNotification('Saved locally, but Cloud sync failed', 'warning');
        }
    })();

    window.showNotification(isEdit ? 'Auditor profile updated' : 'New auditor profile created', 'success');

    // Redirect back to detail if editing, or list if new
    if (isEdit) {
        window.state.currentModule = 'auditors';
        window.renderModule('auditors');
        setTimeout(() => window.renderAuditorDetail(auditor.id), 100);
    } else {
        window.location.hash = '#auditors-list';
    }
};

// Globalize
window.renderAuditorForm = renderAuditorForm;
window.saveAuditorForm = window.saveAuditorForm;

// ============================================
// IMPARTIALITY COMMITTEE MODULE
// ISO 17021-1 Clause 5.2
// ============================================

// --------------------------------------------
// DATA FETCHING (Supabase)
// --------------------------------------------

window.fetchImpartialityData = async function () {
    if (!window.SupabaseClient) return;

    try {
        // Members
        const { data: members, error: mErr } = await window.SupabaseClient
            .from('audit_impartiality_members')
            .select('*')
            .order('name');
        if (mErr) throw mErr;
        window.state.impartialityCommittee.members = (members || []).map(m => ({
            id: m.id,
            name: m.name,
            organization: m.organization,
            role: m.role,
            expertise: m.expertise,
            appointedDate: m.appointed_date,
            termEnd: m.term_end,
            status: m.status
        }));

        // Threats
        const { data: threats, error: tErr } = await window.SupabaseClient
            .from('audit_impartiality_threats')
            .select('*')
            .order('date', { ascending: false });
        if (tErr) throw tErr;
        window.state.impartialityCommittee.threats = (threats || []).map(t => ({
            id: t.id,
            date: t.date,
            type: t.type,
            description: t.description,
            client: t.client,
            safeguard: t.safeguard,
            identifiedBy: t.identified_by,
            status: t.status,
            reviewedByCommittee: t.reviewed_by_committee,
            committeeDecision: t.committee_decision
        }));

        // Meetings
        const { data: meetings, error: mtgErr } = await window.SupabaseClient
            .from('audit_impartiality_meetings')
            .select('*')
            .order('date', { ascending: false });
        if (mtgErr) throw mtgErr;
        window.state.impartialityCommittee.meetings = (meetings || []).map(m => ({
            id: m.id,
            date: m.date,
            attendees: m.attendees || [],
            threatsReviewed: m.threats_reviewed || [],
            decisions: m.decisions || [],
            nextMeetingDate: m.next_meeting_date
        }));

        if (document.getElementById('impartiality-root')) { // Use a reliable ID that actually exists
            renderImpartialityModule();
        }

    } catch (err) {
        console.error('Error fetching Impartiality data:', err);
    }
};

// --------------------------------------------
// PERSISTENCE
// --------------------------------------------

async function persistImpartialityMember(member) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            name: member.name,
            organization: member.organization,
            role: member.role,
            expertise: member.expertise,
            appointed_date: member.appointedDate || null,
            term_end: member.termEnd || null,
            status: member.status
        };

        if (member.id && !String(member.id).startsWith('demo-')) {
            // Update
            const { error } = await window.SupabaseClient.from('audit_impartiality_members').update(payload).eq('id', member.id);
            if (error) throw error;
        } else {
            // Insert
            const { data, error } = await window.SupabaseClient.from('audit_impartiality_members').insert(payload).select();
            if (error) throw error;
            if (data && data[0]) member.id = data[0].id;
        }
        await window.fetchImpartialityData();
        window.showNotification('Committee member saved successfully', 'success');
    } catch (e) {
        console.error('Failed to sync member:', e);
        window.showNotification('Failed to sync member to DB: ' + e.message, 'error');
    }
}

async function persistImpartialityThreat(threat) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            date: threat.date || null, // Convert empty string to null for date fields
            type: threat.type,
            description: threat.description,
            client: threat.client,
            safeguard: threat.safeguard,
            identified_by: threat.identifiedBy,
            status: threat.status,
            reviewed_by_committee: threat.reviewedByCommittee,
            committee_decision: threat.committeeDecision || null
        };

        if (threat.id && !String(threat.id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_threats').update(payload).eq('id', threat.id);
            if (error) throw error;
        } else {
            const { data, error } = await window.SupabaseClient.from('audit_impartiality_threats').insert(payload).select();
            if (error) throw error;
            if (data && data[0]) threat.id = data[0].id;
        }
        await window.fetchImpartialityData();
        window.showNotification('Threat logged/updated successfully', 'success');
    } catch (e) {
        console.error('Failed to sync threat:', e);
        window.showNotification('Failed to sync threat: ' + e.message, 'error');
    }
}

async function persistImpartialityMeeting(meeting) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            date: meeting.date || null, // Convert empty string to null for date fields
            attendees: meeting.attendees,
            threats_reviewed: meeting.threatsReviewed,
            decisions: meeting.decisions,
            next_meeting_date: meeting.nextMeetingDate || null
        };

        if (meeting.id && !String(meeting.id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_meetings').update(payload).eq('id', meeting.id);
            if (error) throw error;
        } else {
            const { data, error } = await window.SupabaseClient.from('audit_impartiality_meetings').insert(payload).select();
            if (error) throw error;
            if (data && data[0]) meeting.id = data[0].id;
        }
        await window.fetchImpartialityData();
        window.showNotification('Meeting record saved successfully', 'success');
    } catch (e) {
        console.error('Failed to sync meeting:', e);
        window.showNotification('Failed to sync meeting: ' + e.message, 'error');
    }
}

// Initialize state
if (!window.state.impartialityCommittee) {
    window.state.impartialityCommittee = {
        members: [],
        meetings: [],
        threats: []
    };
}

function renderImpartialityModule() {
    if (!window._fetchedImpartiality && !window._fetchingImpartiality && window.SupabaseClient) {
        window._fetchingImpartiality = true;
        window.fetchImpartialityData().finally(() => {
            window._fetchingImpartiality = false;
            window._fetchedImpartiality = true;
        });
    }

    const contentArea = document.getElementById('content-area');
    const data = window.state.impartialityCommittee;

    contentArea.innerHTML = `
        <div class="fade-in" id="impartiality-root">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-balance-scale" style="margin-right: 0.5rem; color: #7c3aed;"></i>
                        Impartiality Committee
                    </h2>
                    <p style="color: var(--text-secondary); margin: 0;">ISO 17021-1 Clause 5.2 - Safeguarding Impartiality</p>
                </div>
                <button class="btn btn-primary" data-action="openAddCommitteeMemberModal" aria-label="Add user">
                    <i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i>Add Member
                </button>
            </div>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #7c3aed; margin: 0;">${data.members.filter(m => m.status === 'Active').length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Active Members</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #0284c7; margin: 0;">${data.meetings.length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Meetings Held</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #059669; margin: 0;">${data.threats.filter(t => t.status === 'Resolved').length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Threats Resolved</p>
                </div>
                <div class="card" style="text-align: center; padding: 1rem;">
                    <p style="font-size: 2rem; font-weight: 700; color: #dc2626; margin: 0;">${data.threats.filter(t => t.status === 'Open').length}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Open Threats</p>
                </div>
            </div>

            <!-- Tabs -->
            <div id="impartiality-tabs" style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" data-action="switchImpartialityTab" data-arg1="this" data-arg2="members">Committee Members</button>
                <button class="tab-btn" data-action="switchImpartialityTab" data-arg1="this" data-arg2="meetings">Meetings</button>
                <button class="tab-btn" data-action="switchImpartialityTab" data-arg1="this" data-arg2="threats">Threat Register</button>
            </div>

            <!-- Tab: Members -->
            <div id="members" class="impartiality-tab-content">
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Organization</th>
                                    <th>Role</th>
                                    <th>Expertise</th>
                                    <th>Term</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.members.map(m => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(m.name)}</strong></td>
                                        <td>${window.UTILS.escapeHtml(m.organization)}</td>
                                        <td>${window.UTILS.escapeHtml(m.role)}</td>
                                        <td>${window.UTILS.escapeHtml(m.expertise)}</td>
                                        <td>${window.UTILS.escapeHtml(m.appointedDate)} - ${window.UTILS.escapeHtml(m.termEnd)}</td>
                                        <td><span class="badge ${m.status === 'Active' ? 'bg-green' : 'bg-gray'}">${window.UTILS.escapeHtml(m.status)}</span></td>
                                        <td>
                                            <button class="btn btn-sm btn-icon" data-action="editCommitteeMember" data-id="${m.id}" title="Edit" aria-label="Edit">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="deleteCommitteeMember" data-id="${m.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab: Meetings -->
            <div id="meetings" class="impartiality-tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Committee Meetings</h3>
                    <button class="btn btn-primary btn-sm" data-action="openAddMeetingModal" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>Record Meeting
                    </button>
                </div>
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Attendees</th>
                                    <th>Threats Reviewed</th>
                                    <th>Decisions</th>
                                    <th>Next Meeting</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.meetings.map(mtg => `
                                    <tr>
                                        <td><strong>${window.UTILS.escapeHtml(mtg.date)}</strong></td>
                                        <td>${mtg.attendees.length} members</td>
                                        <td>${mtg.threatsReviewed.length} threats</td>
                                        <td>${mtg.decisions.length} decisions</td>
                                        <td>${window.UTILS.escapeHtml(mtg.nextMeetingDate || 'TBD')}</td>
                                        <td>
                                            <button class="btn btn-sm btn-icon" data-action="viewMeeting" data-id="${mtg.id}" title="View Details" aria-label="View">
                                                <i class="fa-solid fa-eye"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="editMeeting" data-id="${mtg.id}" title="Edit" aria-label="Edit">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="deleteMeeting" data-id="${mtg.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab: Threats -->
            <div id="threats" class="impartiality-tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Impartiality Threat Register</h3>
                    <button class="btn btn-primary btn-sm" data-action="openAddThreatModal" aria-label="Warning">
                        <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>Log Threat
                    </button>
                </div>
                <div class="card">
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Client</th>
                                    <th>Safeguard</th>
                                    <th>Status</th>
                                    <th>Committee Review</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.threats.map(t => `
                                    <tr>
                                        <td>${window.UTILS.escapeHtml(t.date)}</td>
                                        <td><span class="badge bg-orange">${window.UTILS.escapeHtml(t.type)}</span></td>
                                        <td>${window.UTILS.escapeHtml(t.description)}</td>
                                        <td>${window.UTILS.escapeHtml(t.client)}</td>
                                        <td>${window.UTILS.escapeHtml(t.safeguard)}</td>
                                        <td><span class="badge ${t.status === 'Resolved' ? 'bg-green' : 'bg-red'}">${window.UTILS.escapeHtml(t.status)}</span></td>
                                        <td>${t.reviewedByCommittee ? '<i class="fa-solid fa-check" style="color: green;"></i> Yes' : '<i class="fa-solid fa-times" style="color: red;"></i> No'}</td>
                                        <td>
                                            <button class="btn btn-sm btn-icon" data-action="editThreat" data-id="${t.id}" title="Edit" aria-label="Edit">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button class="btn btn-sm btn-icon" data-action="deleteThreat" data-id="${t.id}" title="Delete" aria-label="Delete">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.switchImpartialityTab = function (btn, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.impartiality-tab-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    document.getElementById(tabId).style.display = 'block';
};

window.openAddCommitteeMemberModal = function () {
    document.getElementById('modal-title').textContent = 'Add Committee Member';
    document.getElementById('modal-body').innerHTML = `
        <form id="member-form">
            <div class="form-group">
                <label>Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="member-name" required>
            </div>
            <div class="form-group">
                <label>Organization <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="member-org" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="member-role">
                    <option value="Chairperson">Chairperson</option>
                    <option value="Member">Member</option>
                    <option value="Observer">Observer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Expertise</label>
                <input type="text" class="form-control" id="member-expertise" placeholder="e.g., Quality Management">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Appointed Date</label>
                    <input type="date" class="form-control" id="member-appointed" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Term End Date</label>
                    <input type="date" class="form-control" id="member-term-end">
                </div>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const name = document.getElementById('member-name').value.trim();
        const org = document.getElementById('member-org').value.trim();

        if (!name || !org) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const newMember = {
            name,
            organization: org,
            role: document.getElementById('member-role').value,
            expertise: document.getElementById('member-expertise').value,
            appointedDate: document.getElementById('member-appointed').value,
            termEnd: document.getElementById('member-term-end').value,
            status: 'Active'
        };

        await persistImpartialityMember(newMember);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

window.openAddThreatModal = function () {
    const clients = window.state.clients || [];

    document.getElementById('modal-title').textContent = 'Log Impartiality Threat';
    document.getElementById('modal-body').innerHTML = `
        <form id="threat-form">
            <div class="form-group">
                <label>Threat Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="threat-type" required>
                    <option value="">-- Select --</option>
                    <option value="Self-Interest">Self-Interest</option>
                    <option value="Self-Review">Self-Review</option>
                    <option value="Familiarity">Familiarity</option>
                    <option value="Intimidation">Intimidation</option>
                    <option value="Advocacy">Advocacy</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="threat-description" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Related Client</label>
                <select class="form-control" id="threat-client">
                    <option value="">-- Select --</option>
                    ${clients.map(c => `<option value="${window.UTILS.escapeHtml(c.name)}">${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Safeguard Implemented <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="threat-safeguard" rows="2" required></textarea>
            </div>
            <div class="form-group">
                <label>Identified By</label>
                <input type="text" class="form-control" id="threat-identified-by">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const type = document.getElementById('threat-type').value;
        const description = document.getElementById('threat-description').value.trim();
        const safeguard = document.getElementById('threat-safeguard').value.trim();

        if (!type || !description || !safeguard) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const newThreat = {
            date: new Date().toISOString().split('T')[0],
            type,
            description,
            client: document.getElementById('threat-client').value,
            safeguard,
            identifiedBy: document.getElementById('threat-identified-by').value,
            status: 'Open',
            reviewedByCommittee: false
        };

        await persistImpartialityThreat(newThreat);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

window.openAddMeetingModal = function () {
    const activeMembers = window.state.impartialityCommittee.members.filter(m => m.status === 'Active');
    const openThreats = window.state.impartialityCommittee.threats;

    document.getElementById('modal-title').textContent = 'Record Impartiality Committee Meeting';
    document.getElementById('modal-body').innerHTML = `
        <form id="meeting-form">
            <div class="form-group">
                <label>Meeting Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="meeting-date" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            
            <div class="form-group">
                <label>Attendees</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
                    ${activeMembers.map(m => `
                        <div style="margin-bottom: 0.25rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" class="meeting-attendee" value="${m.id}">
                                <span>${window.UTILS.escapeHtml(m.name)} <small style="color: grey;">(${m.role})</small></span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="form-group">
                <label>Threats Reviewed</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
                    ${openThreats.length > 0 ? openThreats.map(t => `
                        <div style="margin-bottom: 0.25rem;">
                            <label style="display: flex; align-items: start; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" class="meeting-threat" value="${t.id}">
                                <span style="font-size: 0.9rem;">
                                    <strong>${window.UTILS.escapeHtml(t.type)}</strong>: ${window.UTILS.escapeHtml(t.description.substring(0, 50))}...
                                    <br><small style="color: grey;">Status: ${t.status}</small>
                                </span>
                            </label>
                        </div>
                    `).join('') : '<span style="color: var(--text-secondary);">No threats logged.</span>'}
                </div>
            </div>

            <div class="form-group">
                <label>Decisions & Outcomes <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="meeting-decisions" rows="3" placeholder="Enter key decisions made..." required></textarea>
            </div>

            <div class="form-group">
                <label>Next Meeting Date</label>
                <input type="date" class="form-control" id="meeting-next">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const date = document.getElementById('meeting-date').value;
        const decisionsRaw = document.getElementById('meeting-decisions').value.trim();

        if (!date || !decisionsRaw) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const attendees = Array.from(document.querySelectorAll('.meeting-attendee:checked')).map(cb => cb.value);
        const threatsReviewedIds = Array.from(document.querySelectorAll('.meeting-threat:checked')).map(cb => cb.value);

        const threatsReviewed = window.state.impartialityCommittee.threats
            .filter(t => threatsReviewedIds.includes(String(t.id)))
            .map(t => ({
                threat: t.type + ' - ' + t.description,
                client: t.client,
                safeguard: t.safeguard,
                decision: 'Reviewed'
            }));

        // Mark threats as reviewed
        window.state.impartialityCommittee.threats.forEach(t => {
            if (threatsReviewedIds.includes(String(t.id))) {
                t.reviewedByCommittee = true;
            }
        });

        const newMeeting = {
            date: date,
            attendees: attendees,
            threatsReviewed: threatsReviewed,
            decisions: decisionsRaw.split('\n').filter(d => d.trim() !== ''),
            nextMeetingDate: document.getElementById('meeting-next').value
        };

        await persistImpartialityMeeting(newMeeting);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

window.editCommitteeMember = function (id) {
    const member = window.state.impartialityCommittee.members.find(m => String(m.id) === String(id));
    if (!member) return;

    document.getElementById('modal-title').textContent = 'Edit Committee Member';
    document.getElementById('modal-body').innerHTML = `
        <form id="member-form">
            <div class="form-group">
                <label>Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="member-name" value="${window.UTILS.escapeHtml(member.name)}" required>
            </div>
            <div class="form-group">
                <label>Organization <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="member-org" value="${window.UTILS.escapeHtml(member.organization)}" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control" id="member-role">
                    <option value="Chairperson" ${member.role === 'Chairperson' ? 'selected' : ''}>Chairperson</option>
                    <option value="Member" ${member.role === 'Member' ? 'selected' : ''}>Member</option>
                    <option value="Observer" ${member.role === 'Observer' ? 'selected' : ''}>Observer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Expertise</label>
                <input type="text" class="form-control" id="member-expertise" value="${window.UTILS.escapeHtml(member.expertise || '')}" placeholder="e.g., Quality Management">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Appointed Date</label>
                    <input type="date" class="form-control" id="member-appointed" value="${member.appointedDate}">
                </div>
                <div class="form-group">
                    <label>Term End Date</label>
                    <input type="date" class="form-control" id="member-term-end" value="${member.termEnd || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="member-status">
                    <option value="Active" ${member.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Inactive" ${member.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const name = document.getElementById('member-name').value.trim();
        const org = document.getElementById('member-org').value.trim();

        if (!name || !org) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        member.name = name;
        member.organization = org;
        member.role = document.getElementById('member-role').value;
        member.expertise = document.getElementById('member-expertise').value;
        member.appointedDate = document.getElementById('member-appointed').value;
        member.termEnd = document.getElementById('member-term-end').value;
        member.status = document.getElementById('member-status').value;

        window.saveData();
        await persistImpartialityMember(member);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

window.viewMeeting = function (id) {
    const meeting = window.state.impartialityCommittee.meetings.find(m => String(m.id) === String(id));
    if (!meeting) return;

    const members = window.state.impartialityCommittee.members;
    const attendeeNames = meeting.attendees.map(aid => {
        const m = members.find(member => String(member.id) === String(aid));
        return m ? m.name : 'Unknown';
    });

    document.getElementById('modal-title').textContent = 'Meeting Details - ' + meeting.date;
    document.getElementById('modal-body').innerHTML = `
        <div style="display: grid; gap: 1rem;">
            <div>
                <label style="font-weight: bold; color: var(--text-secondary);">Date</label>
                <p>${window.UTILS.escapeHtml(meeting.date)}</p>
            </div>
            <div>
                <label style="font-weight: bold; color: var(--text-secondary);">Attendees</label>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem;">
                    ${attendeeNames.map(name => `<span class="badge bg-blue">${window.UTILS.escapeHtml(name)}</span>`).join('')}
                </div>
            </div>
            <div>
                <label style="font-weight: bold; color: var(--text-secondary);">Decisions</label>
                <ul style="margin-top: 0.25rem; padding-left: 1.25rem;">
                    ${meeting.decisions.map(d => `<li>${window.UTILS.escapeHtml(d)}</li>`).join('')}
                </ul>
            </div>
            <div>
                <label style="font-weight: bold; color: var(--text-secondary);">Threats Reviewed</label>
                <div class="table-container" style="margin-top: 0.5rem;">
                    <table style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th>Threat</th>
                                <th>Client</th>
                                <th>Decision</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${meeting.threatsReviewed.map(tr => `
                                <tr>
                                    <td>${window.UTILS.escapeHtml(tr.threat)}</td>
                                    <td>${window.UTILS.escapeHtml(tr.client || '-')}</td>
                                    <td><span class="badge bg-green">${window.UTILS.escapeHtml(tr.decision)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ${meeting.nextMeetingDate ? `
                <div>
                    <label style="font-weight: bold; color: var(--text-secondary);">Next Meeting</label>
                    <p>${window.UTILS.escapeHtml(meeting.nextMeetingDate)}</p>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
};

window.viewThreat = function (id) {
    const threat = window.state.impartialityCommittee.threats.find(t => String(t.id) === String(id));
    if (!threat) return;

    // Simple alert for now, can expand to modal if needed
    alert(`Threat: ${threat.type}\nStatus: ${threat.status}\nDecision: ${threat.committeeDecision || 'Pending'}`);
};

// ============================================
// EDIT FUNCTIONS
// ============================================

window.editThreat = function (id) {
    const threat = window.state.impartialityCommittee.threats.find(t => String(t.id) === String(id));
    if (!threat) return;

    const clients = window.state.clients || [];

    document.getElementById('modal-title').textContent = 'Edit Impartiality Threat';
    document.getElementById('modal-body').innerHTML = `
        <form id="threat-form">
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="threat-date" value="${threat.date || ''}">
            </div>
            <div class="form-group">
                <label>Threat Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="threat-type" required>
                    <option value="">-- Select --</option>
                    <option value="Self-Interest" ${threat.type === 'Self-Interest' ? 'selected' : ''}>Self-Interest</option>
                    <option value="Self-Review" ${threat.type === 'Self-Review' ? 'selected' : ''}>Self-Review</option>
                    <option value="Familiarity" ${threat.type === 'Familiarity' ? 'selected' : ''}>Familiarity</option>
                    <option value="Intimidation" ${threat.type === 'Intimidation' ? 'selected' : ''}>Intimidation</option>
                    <option value="Advocacy" ${threat.type === 'Advocacy' ? 'selected' : ''}>Advocacy</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="threat-description" rows="3" required>${window.UTILS.escapeHtml(threat.description)}</textarea>
            </div>
            <div class="form-group">
                <label>Related Client</label>
                <select class="form-control" id="threat-client">
                    <option value="">-- Select --</option>
                    ${clients.map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${threat.client === c.name ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Safeguard Implemented <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="threat-safeguard" rows="2" required>${window.UTILS.escapeHtml(threat.safeguard)}</textarea>
            </div>
            <div class="form-group">
                <label>Identified By</label>
                <input type="text" class="form-control" id="threat-identified-by" value="${window.UTILS.escapeHtml(threat.identifiedBy || '')}">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="threat-status">
                    <option value="Open" ${threat.status === 'Open' ? 'selected' : ''}>Open</option>
                    <option value="Resolved" ${threat.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>
            </div>
            <div class="form-group">
                <label>Committee Decision</label>
                <textarea class="form-control" id="threat-committee-decision" rows="2">${window.UTILS.escapeHtml(threat.committeeDecision || '')}</textarea>
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const type = document.getElementById('threat-type').value;
        const description = document.getElementById('threat-description').value.trim();
        const safeguard = document.getElementById('threat-safeguard').value.trim();

        if (!type || !description || !safeguard) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        threat.date = document.getElementById('threat-date').value;
        threat.type = type;
        threat.description = description;
        threat.client = document.getElementById('threat-client').value;
        threat.safeguard = safeguard;
        threat.identifiedBy = document.getElementById('threat-identified-by').value;
        threat.status = document.getElementById('threat-status').value;
        threat.committeeDecision = document.getElementById('threat-committee-decision').value;

        window.saveData();
        await persistImpartialityThreat(threat);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

window.editMeeting = function (id) {
    const meeting = window.state.impartialityCommittee.meetings.find(m => String(m.id) === String(id));
    if (!meeting) return;

    const activeMembers = window.state.impartialityCommittee.members.filter(m => m.status === 'Active');
    const allThreats = window.state.impartialityCommittee.threats;

    document.getElementById('modal-title').textContent = 'Edit Committee Meeting';
    document.getElementById('modal-body').innerHTML = `
        <form id="meeting-form">
            <div class="form-group">
                <label>Meeting Date <span style="color: var(--danger-color);">*</span></label>
                <input type="date" class="form-control" id="meeting-date" value="${meeting.date || ''}" required>
            </div>
            
            <div class="form-group">
                <label>Attendees</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
                    ${activeMembers.map(m => `
                        <div style="margin-bottom: 0.25rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" class="meeting-attendee" value="${m.id}" ${meeting.attendees.includes(String(m.id)) ? 'checked' : ''}>
                                <span>${window.UTILS.escapeHtml(m.name)} <small style="color: grey;">(${m.role})</small></span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="form-group">
                <label>Threats Reviewed</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
                    ${allThreats.length > 0 ? allThreats.map(t => {
        const isReviewed = meeting.threatsReviewed.some(tr => tr.threat && tr.threat.includes(t.description.substring(0, 20)));
        return `
                        <div style="margin-bottom: 0.25rem;">
                            <label style="display: flex; align-items: start; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" class="meeting-threat" value="${t.id}" ${isReviewed ? 'checked' : ''}>
                                <span style="font-size: 0.9rem;">
                                    <strong>${window.UTILS.escapeHtml(t.type)}</strong>: ${window.UTILS.escapeHtml(t.description.substring(0, 50))}...
                                    <br><small style="color: grey;">Status: ${t.status}</small>
                                </span>
                            </label>
                        </div>
                    `}).join('') : '<span style="color: var(--text-secondary);">No threats logged.</span>'}
                </div>
            </div>

            <div class="form-group">
                <label>Decisions & Outcomes <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="meeting-decisions" rows="3" placeholder="Enter key decisions made..." required>${meeting.decisions.join('\n')}</textarea>
            </div>

            <div class="form-group">
                <label>Next Meeting Date</label>
                <input type="date" class="form-control" id="meeting-next" value="${meeting.nextMeetingDate || ''}">
            </div>
        </form>
    `;

    document.getElementById('modal-save').onclick = async () => {
        const date = document.getElementById('meeting-date').value;
        const decisionsRaw = document.getElementById('meeting-decisions').value.trim();

        if (!date || !decisionsRaw) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const attendees = Array.from(document.querySelectorAll('.meeting-attendee:checked')).map(cb => cb.value);
        const threatsReviewedIds = Array.from(document.querySelectorAll('.meeting-threat:checked')).map(cb => cb.value);

        const threatsReviewed = window.state.impartialityCommittee.threats
            .filter(t => threatsReviewedIds.includes(String(t.id)))
            .map(t => ({
                threat: t.type + ' - ' + t.description,
                client: t.client,
                safeguard: t.safeguard,
                decision: 'Reviewed'
            }));

        meeting.date = date;
        meeting.attendees = attendees;
        meeting.threatsReviewed = threatsReviewed;
        meeting.decisions = decisionsRaw.split('\n').filter(d => d.trim() !== '');
        meeting.nextMeetingDate = document.getElementById('meeting-next').value;

        window.saveData();
        await persistImpartialityMeeting(meeting);
        window.closeModal();
        renderImpartialityModule();
    };

    window.openModal();
};

// ============================================
// DELETE FUNCTIONS
// ============================================

window.deleteThreat = async function (id) {
    const threat = window.state.impartialityCommittee.threats.find(t => String(t.id) === String(id));
    if (!threat) return;

    if (!confirm(`Are you sure you want to delete this threat?\n\nType: ${threat.type}\nDescription: ${threat.description}`)) {
        return;
    }

    try {
        // Remove from state
        const index = window.state.impartialityCommittee.threats.findIndex(t => String(t.id) === String(id));
        if (index > -1) {
            window.state.impartialityCommittee.threats.splice(index, 1);
        }

        window.saveData();

        // Delete from Supabase
        if (window.SupabaseClient && !String(id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_threats').delete().eq('id', id);
            if (error) throw error;
        }

        window.showNotification('Threat deleted successfully', 'success');
        renderImpartialityModule();
    } catch (e) {
        console.error('Failed to delete threat:', e);
        window.showNotification('Failed to delete threat: ' + e.message, 'error');
    }
};

window.deleteMeeting = async function (id) {
    const meeting = window.state.impartialityCommittee.meetings.find(m => String(m.id) === String(id));
    if (!meeting) return;

    if (!confirm(`Are you sure you want to delete this meeting record?\n\nDate: ${meeting.date}\nAttendees: ${meeting.attendees.length} members`)) {
        return;
    }

    try {
        // Remove from state
        const index = window.state.impartialityCommittee.meetings.findIndex(m => String(m.id) === String(id));
        if (index > -1) {
            window.state.impartialityCommittee.meetings.splice(index, 1);
        }

        window.saveData();

        // Delete from Supabase
        if (window.SupabaseClient && !String(id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_meetings').delete().eq('id', id);
            if (error) throw error;
        }

        window.showNotification('Meeting deleted successfully', 'success');
        renderImpartialityModule();
    } catch (e) {
        console.error('Failed to delete meeting:', e);
        window.showNotification('Failed to delete meeting: ' + e.message, 'error');
    }
};

window.deleteCommitteeMember = async function (id) {
    const member = window.state.impartialityCommittee.members.find(m => String(m.id) === String(id));
    if (!member) return;

    if (!confirm(`Are you sure you want to delete this committee member?\n\nName: ${member.name}\nOrganization: ${member.organization}`)) {
        return;
    }

    try {
        // Remove from state
        const index = window.state.impartialityCommittee.members.findIndex(m => String(m.id) === String(id));
        if (index > -1) {
            window.state.impartialityCommittee.members.splice(index, 1);
        }

        window.saveData();

        // Delete from Supabase
        if (window.SupabaseClient && !String(id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_members').delete().eq('id', id);
            if (error) throw error;
        }

        window.showNotification('Committee member deleted successfully', 'success');
        renderImpartialityModule();
    } catch (e) {
        console.error('Failed to delete member:', e);
        window.showNotification('Failed to delete member: ' + e.message, 'error');
    }
};


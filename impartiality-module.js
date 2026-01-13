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

        if (document.getElementById('impartiality-tabs')) { // Use a unique ID or just update current tab
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
            appointed_date: member.appointedDate,
            term_end: member.termEnd,
            status: member.status
        };

        if (member.id && String(member.id).length > 10) { // Check if it's a temp Date.now() ID or DB ID
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
    } catch (e) {
        console.error('Failed to sync member:', e);
        window.showNotification('Failed to sync member to DB', 'error');
    }
}

async function persistImpartialityThreat(threat) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            date: threat.date,
            type: threat.type,
            description: threat.description,
            client: threat.client,
            safeguard: threat.safeguard,
            identified_by: threat.identifiedBy,
            status: threat.status,
            reviewed_by_committee: threat.reviewedByCommittee,
            committee_decision: threat.committeeDecision || null
        };

        if (threat.id && String(threat.id).length > 10) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_threats').update(payload).eq('id', threat.id);
            if (error) throw error;
        } else {
            const { data, error } = await window.SupabaseClient.from('audit_impartiality_threats').insert(payload).select();
            if (error) throw error;
            if (data && data[0]) threat.id = data[0].id;
        }
        await window.fetchImpartialityData();
    } catch (e) {
        console.error('Failed to sync threat:', e);
    }
}

async function persistImpartialityMeeting(meeting) {
    if (!window.SupabaseClient) return;
    try {
        const payload = {
            date: meeting.date,
            attendees: meeting.attendees,
            threats_reviewed: meeting.threatsReviewed,
            decisions: meeting.decisions,
            next_meeting_date: meeting.nextMeetingDate
        };

        if (meeting.id && String(meeting.id).length > 10) {
            const { error } = await window.SupabaseClient.from('audit_impartiality_meetings').update(payload).eq('id', meeting.id);
            if (error) throw error;
        } else {
            const { data, error } = await window.SupabaseClient.from('audit_impartiality_meetings').insert(payload).select();
            if (error) throw error;
            if (data && data[0]) meeting.id = data[0].id;
        }
        await window.fetchImpartialityData();
    } catch (e) {
        console.error('Failed to sync meeting:', e);
    }
}

// Initialize state
if (!window.state.impartialityCommittee) {
    window.state.impartialityCommittee = {
        members: [
            {
                id: 1,
                name: 'Dr. Sarah Mitchell',
                organization: 'Independent Quality Consultant',
                role: 'Chairperson',
                expertise: 'Quality Management Systems',
                appointedDate: '2023-01-15',
                termEnd: '2026-01-14',
                status: 'Active'
            },
            {
                id: 2,
                name: 'John Anderson',
                organization: 'Industry Association Representative',
                role: 'Member',
                expertise: 'Manufacturing Standards',
                appointedDate: '2023-01-15',
                termEnd: '2026-01-14',
                status: 'Active'
            }
        ],
        meetings: [
            {
                id: 1,
                date: '2024-03-15',
                attendees: [1, 2],
                threatsReviewed: [
                    {
                        threat: 'Auditor previously worked for client',
                        client: 'Tech Solutions Ltd',
                        safeguard: 'Assigned different auditor',
                        decision: 'Approved'
                    }
                ],
                decisions: ['Approved new auditor competence criteria'],
                nextMeetingDate: '2024-06-15'
            }
        ],
        threats: [
            {
                id: 1,
                date: '2024-02-10',
                type: 'Self-Interest',
                description: 'Auditor has financial interest in client company',
                client: 'Global Manufacturing',
                identifiedBy: 'Quality Manager',
                safeguard: 'Auditor recused from assignment',
                status: 'Resolved',
                reviewedByCommittee: true,
                committeeDecision: 'Safeguard adequate'
            }
        ]
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
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-balance-scale" style="margin-right: 0.5rem; color: #7c3aed;"></i>
                        Impartiality Committee
                    </h2>
                    <p style="color: var(--text-secondary); margin: 0;">ISO 17021-1 Clause 5.2 - Safeguarding Impartiality</p>
                </div>
                <button class="btn btn-primary" onclick="window.openAddCommitteeMemberModal()">
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
            <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                <button class="tab-btn active" onclick="switchImpartialityTab(this, 'members')">Committee Members</button>
                <button class="tab-btn" onclick="switchImpartialityTab(this, 'meetings')">Meetings</button>
                <button class="tab-btn" onclick="switchImpartialityTab(this, 'threats')">Threat Register</button>
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
                                            <button class="btn btn-sm btn-icon" onclick="editCommitteeMember(${m.id})" title="Edit">
                                                <i class="fa-solid fa-edit"></i>
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
                    <button class="btn btn-primary btn-sm" onclick="window.openAddMeetingModal()">
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
                                            <button class="btn btn-sm btn-icon" onclick="viewMeeting(${mtg.id})" title="View Details">
                                                <i class="fa-solid fa-eye"></i>
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
                    <button class="btn btn-primary btn-sm" onclick="window.openAddThreatModal()">
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

    document.getElementById('modal-save').onclick = () => {
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

        persistImpartialityMember(newMember);
        window.closeModal();
        renderImpartialityModule();
        window.showNotification('Committee member added successfully', 'success');
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

    document.getElementById('modal-save').onclick = () => {
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

        persistImpartialityThreat(newThreat);
        window.closeModal();
        renderImpartialityModule();
        window.showNotification('Threat logged successfully', 'success');
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

    document.getElementById('modal-save').onclick = () => {
        const date = document.getElementById('meeting-date').value;
        const decisionsRaw = document.getElementById('meeting-decisions').value.trim();

        if (!date || !decisionsRaw) {
            window.showNotification('Please fill in required fields', 'error');
            return;
        }

        const attendees = Array.from(document.querySelectorAll('.meeting-attendee:checked')).map(cb => parseInt(cb.value));
        const threatsReviewedIds = Array.from(document.querySelectorAll('.meeting-threat:checked')).map(cb => parseInt(cb.value));

        const threatsReviewed = window.state.impartialityCommittee.threats
            .filter(t => threatsReviewedIds.includes(t.id))
            .map(t => ({
                threat: t.type + ' - ' + t.description,
                client: t.client,
                safeguard: t.safeguard,
                decision: 'Reviewed'
            }));

        // Mark threats as reviewed
        window.state.impartialityCommittee.threats.forEach(t => {
            if (threatsReviewedIds.includes(t.id)) {
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

        persistImpartialityMeeting(newMeeting);
        window.closeModal();
        renderImpartialityModule();
        window.showNotification('Meeting recorded successfully', 'success');
    };

    window.openModal();
};

window.editCommitteeMember = function (id) {
    const member = window.state.impartialityCommittee.members.find(m => m.id === id);
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

    document.getElementById('modal-save').onclick = () => {
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
        persistImpartialityMember(member);
        window.closeModal();
        renderImpartialityModule();
        window.showNotification('Committee member updated successfully', 'success');
    };

    window.openModal();
};

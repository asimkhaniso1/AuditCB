// ============================================
// SETTINGS & USER MANAGEMENT MODULE
// ============================================

function renderSettings() {
    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <div class="tab-container" style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                    <button class="tab-btn active" onclick="switchSettingsTab('general', this)">General Settings</button>
                    <button class="tab-btn" onclick="switchSettingsTab('users', this)">User Management</button>
                    <button class="tab-btn" onclick="switchSettingsTab('notifications', this)">Notifications</button>
                    <button class="tab-btn" onclick="switchSettingsTab('data', this)">Data Management</button>
                </div>

                <div id="settings-content">
                    ${getGeneralSettingsHTML()}
                </div>
            </div>
        </div>
    `;
    window.contentArea.innerHTML = html;
}

function switchSettingsTab(tabName, btnElement) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    // Update content
    const container = document.getElementById('settings-content');
    switch (tabName) {
        case 'general':
            container.innerHTML = getGeneralSettingsHTML();
            break;
        case 'users':
            container.innerHTML = getUserManagementHTML();
            break;
        case 'notifications':
            container.innerHTML = getNotificationSettingsHTML();
            break;
        case 'data':
            container.innerHTML = getDataManagementHTML();
            break;
    }
}

function getGeneralSettingsHTML() {
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem;">Company Information</h3>
            <form onsubmit="event.preventDefault(); showNotification('Settings saved successfully');">
                <div class="form-group">
                    <label>Company Name</label>
                    <input type="text" class="form-control" value="AuditCB360 Certification Body" style="max-width: 400px;">
                </div>
                <div class="form-group">
                    <label>Contact Email</label>
                    <input type="email" class="form-control" value="admin@auditcb360.com" style="max-width: 400px;">
                </div>
                <div class="form-group">
                    <label>Logo URL</label>
                    <input type="text" class="form-control" value="/assets/logo.png" style="max-width: 400px;">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea class="form-control" rows="3" style="max-width: 400px;">123 Quality Street, ISO City, 9001</textarea>
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        </div>
    `;
}

function getUserManagementHTML() {
    // Mock Users Data
    const users = [
        { id: 1, name: 'Admin User', email: 'admin@auditcb360.com', role: 'Administrator', status: 'Active' },
        { id: 2, name: 'John Doe', email: 'john.doe@auditcb360.com', role: 'Lead Auditor', status: 'Active' },
        { id: 3, name: 'Jane Smith', email: 'jane.smith@auditcb360.com', role: 'Auditor', status: 'Active' },
        { id: 4, name: 'Client Viewer', email: 'view@acmecorp.com', role: 'Client', status: 'Inactive' }
    ];

    const rows = users.map(user => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <div style="width: 32px; height: 32px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-user" style="color: #64748b; font-size: 0.8rem;"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500;">${user.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${user.email}</div>
                    </div>
                </div>
            </td>
            <td>${getRoleBadge(user.role)}</td>
            <td><span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span></td>
            <td>
                <button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-sm" style="color: var(--danger-color);"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Users</h3>
                <button class="btn btn-primary" onclick="openAddUserModal()">
                    <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Add User
                </button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getNotificationSettingsHTML() {
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem;">Email Notifications</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
                <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" checked>
                    <span>Notify when an Audit Plan is created</span>
                </label>
                <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" checked>
                    <span>Notify when NCRs are closed</span>
                </label>
                <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox">
                    <span>Weekly Digest Report</span>
                </label>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="showNotification('Preferences updated')">Save Preferences</button>
                </div>
            </div>
        </div>
    `;
}

function getRoleBadge(role) {
    let color = '#64748b';
    let bg = '#f1f5f9';

    switch (role) {
        case 'Administrator':
            color = '#7c3aed';
            bg = '#ede9fe';
            break;
        case 'Lead Auditor':
            color = '#059669';
            bg = '#d1fae5';
            break;
        case 'Auditor':
            color = '#0284c7';
            bg = '#e0f2fe';
            break;
    }

    return `<span style="background: ${bg}; color: ${color}; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${role}</span>`;
}

function openAddUserModal() {
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const modalSave = document.getElementById('modal-save');

    modalTitle.textContent = 'Add New User';
    modalBody.innerHTML = `
        <form id="add-user-form">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" class="form-control" placeholder="e.g. Sarah Connor">
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" class="form-control" placeholder="e.g. sarah@example.com">
            </div>
            <div class="form-group">
                <label>Role</label>
                <select class="form-control">
                    <option value="Auditor">Auditor</option>
                    <option value="Lead Auditor">Lead Auditor</option>
                    <option value="Administrator">Administrator</option>
                    <option value="Client">Client User</option>
                </select>
            </div>
        </form>
    `;

    modalSave.onclick = () => {
        showNotification('User invitation sent successfully');
        closeModal();
    };

    openModal();
}

function getDataManagementHTML() {
    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem;">Data Backup & Restore</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Backup Section -->
                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                        <i class="fa-solid fa-download" style="margin-right: 0.5rem;"></i> Backup Data
                    </h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                        Download a complete backup of your application data (Clients, Auditors, Plans, etc.) as a JSON file.
                    </p>
                    <button class="btn btn-primary" onclick="backupData()">
                        Download Backup
                    </button>
                </div>

                <!-- Restore Section -->
                <div class="card" style="border: 1px solid var(--border-color); padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--danger-color);">
                        <i class="fa-solid fa-upload" style="margin-right: 0.5rem;"></i> Restore Data
                    </h4>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                        Upload a previously saved backup file to restore your data. 
                        <strong style="color: var(--danger-color);">Warning: This will replace all current data.</strong>
                    </p>
                    <input type="file" id="restore-file" accept=".json" style="display: none;" onchange="restoreData(this)">
                    <button class="btn btn-secondary" onclick="document.getElementById('restore-file').click()">
                        Select Backup File
                    </button>
                </div>
            </div>

            <div style="margin-top: 2rem; padding: 1rem; background: #f8fafc; border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i> Data Privacy
                </h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">
                    All data is currently stored locally in your browser (LocalStorage). 
                    Clearing your browser cache will delete this data unless you have a backup.
                </p>
            </div>
        </div>
    `;
}

function backupData() {
    try {
        const dataStr = JSON.stringify(state, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `auditcb360_backup_${new Date().toISOString().slice(0, 10)}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        showNotification('Backup downloaded successfully', 'success');
    } catch (error) {
        showNotification('Failed to create backup', 'error');
    }
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Basic validation
            if (!data.clients || !data.auditors) {
                throw new Error('Invalid backup file format');
            }

            // Confirm before restoring
            if (confirm('Are you sure you want to restore this data? Current data will be lost.')) {
                // Update state
                Object.assign(state, data);
                saveData(); // Save to localStorage

                showNotification('Data restored successfully. Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            }
        } catch (error) {
            showNotification('Failed to restore data: Invalid file', 'error');
        }
    };
    reader.readAsText(file);
    // Reset input
    input.value = '';
}

// Export functions
window.renderSettings = renderSettings;
window.switchSettingsTab = switchSettingsTab;
window.openAddUserModal = openAddUserModal;
window.backupData = backupData;
window.restoreData = restoreData;

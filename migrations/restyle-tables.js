// Replace the old HTML generator functions with modern styled versions
const fs = require('fs');
const file = 'clients-module-fix.js';
let content = fs.readFileSync(file, 'utf8');

// Find the start of getClientSitesHTML and end of getClientDesignationsHTML
const startMarker = 'window.getClientSitesHTML = function (client) {';
const endMarker = 'window.getClientAuditTeamHTML = function (client) {';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.log('ERROR: Could not find markers');
    console.log('startMarker found:', startIdx !== -1);
    console.log('endMarker found:', endIdx !== -1);
    process.exit(1);
}

console.log(`Found range: lines ${content.substring(0, startIdx).split('\n').length} to ${content.substring(0, endIdx).split('\n').length}`);

const newCode = `// ============================================
// MODERN TABLE STYLE HELPER
// Inspired by SafeDine Inspector — clean tables with
// search, filter, badges, and 4 action icons
// ============================================

const _orgTableStyle = \`
    .org-table-wrapper { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .org-table-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; }
    .org-table-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #1e293b; }
    .org-table-header .count-badge { background: #eff6ff; color: #3b82f6; font-size: 0.75rem; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
    .org-table-toolbar { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #fafbfc; align-items: center; flex-wrap: wrap; }
    .org-table-search { flex: 1; min-width: 180px; padding: 0.4rem 0.75rem 0.4rem 2rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E") no-repeat 0.6rem center; outline: none; transition: border-color 0.2s; }
    .org-table-search:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .org-table table { width: 100%; border-collapse: collapse; }
    .org-table th { text-align: left; padding: 0.6rem 1rem; font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .org-table td { padding: 0.75rem 1rem; font-size: 0.875rem; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .org-table tr:hover td { background: #f8fafc; }
    .org-table tr:last-child td { border-bottom: none; }
    .org-table .name-cell { font-weight: 600; color: #1e293b; }
    .org-table .badge-tag { display: inline-block; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 500; margin-right: 4px; margin-bottom: 2px; }
    .org-table .badge-primary { background: #eff6ff; color: #2563eb; }
    .org-table .badge-green { background: #f0fdf4; color: #16a34a; }
    .org-table .badge-amber { background: #fffbeb; color: #d97706; }
    .org-table .badge-gray { background: #f1f5f9; color: #64748b; }
    .org-table .actions-cell { display: flex; gap: 2px; align-items: center; }
    .org-table .action-btn { width: 32px; height: 32px; border: none; background: transparent; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.15s ease; }
    .org-table .action-btn:hover { background: #f1f5f9; }
    .org-table .action-btn.view { color: #3b82f6; }
    .org-table .action-btn.edit { color: #f59e0b; }
    .org-table .action-btn.print { color: #8b5cf6; }
    .org-table .action-btn.delete { color: #ef4444; }
    .org-table .action-btn.view:hover { background: #eff6ff; }
    .org-table .action-btn.edit:hover { background: #fffbeb; }
    .org-table .action-btn.print:hover { background: #f5f3ff; }
    .org-table .action-btn.delete:hover { background: #fef2f2; }
    .org-table-empty { text-align: center; padding: 3rem 2rem; color: #94a3b8; }
    .org-table-empty i { font-size: 2.5rem; margin-bottom: 0.75rem; display: block; opacity: 0.5; }
\`;

// Inject styles once
if (!document.getElementById('org-table-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'org-table-styles';
    styleEl.textContent = _orgTableStyle;
    document.head.appendChild(styleEl);
}

// Search filter helper
window._orgTableSearch = function(inputEl, tableId) {
    const filter = inputEl.value.toLowerCase();
    const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
    });
};

// View details helper
window._orgViewItem = function(type, data) {
    const details = Object.entries(data).map(function(e) {
        return '<div style="padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9;"><span style="font-weight: 600; color: #64748b; font-size: 0.8rem; text-transform: uppercase;">' + e[0] + '</span><div style="color: #1e293b; margin-top: 2px;">' + (e[1] || '-') + '</div></div>';
    }).join('');
    window.showModal('View ' + type, '<div style="padding: 0.5rem;">' + details + '</div>');
};

// Print single item helper
window._orgPrintItem = function(type, data) {
    const w = window.open('', '_blank', 'width=600,height=400');
    const rows = Object.entries(data).map(function(e) {
        return '<tr><td style="font-weight:600;padding:8px;border:1px solid #e2e8f0;background:#f8fafc;width:30%">' + e[0] + '</td><td style="padding:8px;border:1px solid #e2e8f0">' + (e[1] || '-') + '</td></tr>';
    }).join('');
    w.document.write('<!DOCTYPE html><html><head><title>' + type + '</title><style>body{font-family:Inter,sans-serif;padding:2rem}h2{color:#1e293b}table{width:100%;border-collapse:collapse;margin-top:1rem}</style></head><body><h2>' + type + ' Details</h2><table>' + rows + '</table></body></html>');
    w.document.close();
    setTimeout(function() { w.print(); }, 300);
};

// Helper to safely escape for inline onclick attributes
function _esc(v) { return (v || '-').replace(/'/g, "\\\\'").replace(/"/g, '&quot;'); }

window.getClientSitesHTML = function (client) {
    const isAdmin = window.state.currentUser.role === 'Certification Manager' || window.state.currentUser.role === 'Admin';
    const sites = client.sites || [];
    return \`
    <div class="org-table-wrapper" style="margin-top: 1.5rem;">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-map-location-dot" style="color: #3b82f6;"></i> Sites & Locations <span class="count-badge">\${sites.length}</span></h3>
            \${isAdmin ? \`<div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadSites('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background: #3b82f6; color: white; border: none; border-radius: 8px;" onclick="window.addSite('\${client.id}')"><i class="fa-solid fa-plus"></i> Add Site</button>
            </div>\` : ''}
        </div>
        \${sites.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search sites..." oninput="window._orgTableSearch(this, 'sites-table')">
        </div>
        <div class="org-table">
            <table id="sites-table"><thead><tr>
                <th>Site Name</th><th>Standards</th><th>Address</th><th>City</th><th>Employees</th><th style="width:140px">Actions</th>
            </tr></thead><tbody>\${sites.map((s, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(s.name)}</td>
                <td>\${(s.standards || 'Inherited').split(',').map(st => '<span class="badge-tag badge-primary">' + st.trim() + '</span>').join('')}</td>
                <td>\${window.UTILS.escapeHtml(s.address || '-')}</td>
                <td>\${window.UTILS.escapeHtml(s.city || '-')}\${s.country ? ', ' + window.UTILS.escapeHtml(s.country) : ''}</td>
                <td>\${s.employees ? '<span class="badge-tag badge-green"><i class="fa-solid fa-users" style="margin-right:3px"></i>' + s.employees + '</span>' : '-'}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Site',{Name:'\${_esc(s.name)}',Standards:'\${_esc(s.standards)}',Address:'\${_esc(s.address)}',City:'\${_esc(s.city)}',Employees:'\${s.employees||'-'}'})"><i class="fa-solid fa-eye"></i></button>
                    \${isAdmin ? '<button class="action-btn edit" title="Edit" onclick="window.editSite(\\\\'' + client.id + '\\\\', ' + i + ')"><i class="fa-solid fa-pen"></i></button>' : ''}
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Site',{Name:'\${_esc(s.name)}',Address:'\${_esc(s.address)}',City:'\${_esc(s.city)}'})"><i class="fa-solid fa-print"></i></button>
                    \${isAdmin ? '<button class="action-btn delete" title="Delete" onclick="window.deleteSite(\\\\'' + client.id + '\\\\', ' + i + ')"><i class="fa-solid fa-trash"></i></button>' : ''}
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : \`
        <div class="org-table-empty">
            <i class="fa-solid fa-map-location-dot"></i>
            <p>No sites or locations added yet.</p>
            \${isAdmin ? '<button class="btn btn-sm" style="background:#3b82f6;color:white;border:none;border-radius:8px;margin-top:0.75rem" onclick="window.addSite(\\\\'' + client.id + '\\\\')"><i class="fa-solid fa-plus"></i> Add First Site</button>' : ''}
        </div>\`}
    </div>\`;
};

window.getClientContactsHTML = function (client) {
    const contacts = client.contacts || [];
    return \`
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-address-book" style="color: #8b5cf6;"></i> Personnel / Contacts <span class="count-badge">\${contacts.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadContacts('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#8b5cf6;color:white;border:none;border-radius:8px" onclick="window.addContactPerson('\${client.id}')"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        \${contacts.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search contacts..." oninput="window._orgTableSearch(this, 'contacts-table')">
        </div>
        <div class="org-table">
            <table id="contacts-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>\${contacts.map((c, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(c.name)}</td>
                <td>\${window.UTILS.escapeHtml(c.email || '-')}</td>
                <td>\${window.UTILS.escapeHtml(c.phone || '-')}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Contact',{Name:'\${_esc(c.name)}',Email:'\${_esc(c.email)}',Phone:'\${_esc(c.phone)}'})"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" onclick="window.showNotification('Edit contact coming soon','info')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Contact',{Name:'\${_esc(c.name)}',Email:'\${_esc(c.email)}'})"><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" onclick="window.deleteContact('\${client.id}', \${i})"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : '<div class="org-table-empty"><i class="fa-solid fa-address-book"></i><p>No contacts added yet.</p></div>'}
    </div>\`;
};

window.getClientDepartmentsHTML = function (client) {
    const departments = client.departments || [];
    return \`
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-sitemap" style="color: #f59e0b;"></i> Departments <span class="count-badge">\${departments.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDepartments('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#f59e0b;color:white;border:none;border-radius:8px" onclick="window.addDepartment('\${client.id}')"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        \${departments.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search departments..." oninput="window._orgTableSearch(this, 'depts-table')">
        </div>
        <div class="org-table">
            <table id="depts-table"><thead><tr><th>Department Name</th><th>Head</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>\${departments.map((dept, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(dept.name)}</td>
                <td>\${window.UTILS.escapeHtml(dept.head || '-')}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Department',{Name:'\${_esc(dept.name)}',Head:'\${_esc(dept.head)}'})"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" onclick="window.showNotification('Edit department coming soon','info')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Department',{Name:'\${_esc(dept.name)}',Head:'\${_esc(dept.head)}'})"><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" onclick="window.deleteDepartment('\${client.id}', \${i})"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : '<div class="org-table-empty"><i class="fa-solid fa-sitemap"></i><p>No departments added yet.</p></div>'}
    </div>\`;
};

window.getClientGoodsServicesHTML = function (client) {
    const items = client.goodsServices || [];
    return \`
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-boxes-stacked" style="color: #10b981;"></i> Goods & Services <span class="count-badge">\${items.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadGoodsServices('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#10b981;color:white;border:none;border-radius:8px" onclick="window.addGoodsService('\${client.id}')"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        \${items.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search goods & services..." oninput="window._orgTableSearch(this, 'goods-table')">
        </div>
        <div class="org-table">
            <table id="goods-table"><thead><tr><th>Name</th><th>Category</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>\${items.map((item, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(item.name)}</td>
                <td><span class="badge-tag badge-green">\${window.UTILS.escapeHtml(item.category || '-')}</span></td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Item',{Name:'\${_esc(item.name)}',Category:'\${_esc(item.category)}'})"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" onclick="window.showNotification('Edit coming soon','info')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Item',{Name:'\${_esc(item.name)}',Category:'\${_esc(item.category)}'})"><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" onclick="window.deleteGoodsService('\${client.id}', \${i})"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : '<div class="org-table-empty"><i class="fa-solid fa-boxes-stacked"></i><p>No goods or services added yet.</p></div>'}
    </div>\`;
};

window.getClientKeyProcessesHTML = function (client) {
    const processes = client.keyProcesses || [];
    return \`
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-gears" style="color: #6366f1;"></i> Key Processes <span class="count-badge">\${processes.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadKeyProcesses('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#6366f1;color:white;border:none;border-radius:8px" onclick="window.addKeyProcess('\${client.id}')"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        \${processes.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search processes..." oninput="window._orgTableSearch(this, 'proc-table')">
        </div>
        <div class="org-table">
            <table id="proc-table"><thead><tr><th>Process Name</th><th>Category</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>\${processes.map((proc, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(proc.name)}</td>
                <td><span class="badge-tag badge-amber">\${window.UTILS.escapeHtml(proc.category || '-')}</span></td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Process',{Name:'\${_esc(proc.name)}',Category:'\${_esc(proc.category)}'})"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" onclick="window.showNotification('Edit coming soon','info')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Process',{Name:'\${_esc(proc.name)}',Category:'\${_esc(proc.category)}'})"><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" onclick="window.deleteKeyProcess('\${client.id}', \${i})"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : '<div class="org-table-empty"><i class="fa-solid fa-gears"></i><p>No key processes added yet.</p></div>'}
    </div>\`;
};

window.getClientDesignationsHTML = function (client) {
    const designations = client.designations || [];
    return \`
    <div class="org-table-wrapper">
        <div class="org-table-header">
            <h3><i class="fa-solid fa-id-badge" style="color: #ec4899;"></i> Designations <span class="count-badge">\${designations.length}</span></h3>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-outline-secondary" onclick="window.bulkUploadDesignations('\${client.id}')"><i class="fa-solid fa-upload"></i> Bulk Upload</button>
                <button class="btn btn-sm" style="background:#ec4899;color:white;border:none;border-radius:8px" onclick="window.addClientDesignation('\${client.id}')"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
        </div>
        \${designations.length > 0 ? \`
        <div class="org-table-toolbar">
            <input class="org-table-search" placeholder="Search designations..." oninput="window._orgTableSearch(this, 'desig-table')">
        </div>
        <div class="org-table">
            <table id="desig-table"><thead><tr><th>Title</th><th>Department</th><th style="width:140px">Actions</th></tr></thead>
            <tbody>\${designations.map((des, i) => \`<tr>
                <td class="name-cell">\${window.UTILS.escapeHtml(des.title || des.name || '')}</td>
                <td>\${des.department ? '<span class="badge-tag badge-gray">' + window.UTILS.escapeHtml(des.department) + '</span>' : '-'}</td>
                <td><div class="actions-cell">
                    <button class="action-btn view" title="View" onclick="window._orgViewItem('Designation',{Title:'\${_esc(des.title||des.name)}',Department:'\${_esc(des.department)}'})"><i class="fa-solid fa-eye"></i></button>
                    <button class="action-btn edit" title="Edit" onclick="window.showNotification('Edit coming soon','info')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn print" title="Print" onclick="window._orgPrintItem('Designation',{Title:'\${_esc(des.title||des.name)}',Department:'\${_esc(des.department)}'})"><i class="fa-solid fa-print"></i></button>
                    <button class="action-btn delete" title="Delete" onclick="window.deleteClientDesignation('\${client.id}', \${i})"><i class="fa-solid fa-trash"></i></button>
                </div></td>
            </tr>\`).join('')}</tbody></table>
        </div>\` : '<div class="org-table-empty"><i class="fa-solid fa-id-badge"></i><p>No designations added yet.</p></div>'}
    </div>\`;
};

`;

// Replace the section
content = content.substring(0, startIdx) + newCode + content.substring(endIdx);
fs.writeFileSync(file, content);
console.log('SUCCESS: Replaced HTML generators with modern table style');

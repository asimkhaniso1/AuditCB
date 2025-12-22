// ============================================
// RECORD RETENTION MODULE
// ISO 17021-1 Clause 8.4 - Control of Records
// ============================================

// Retention Policy Configuration (in years)
const RETENTION_POLICY = {
    auditReports: { period: 6, label: 'Audit Reports', description: 'Full certification cycle + 1 year' },
    certifications: { period: 6, label: 'Certificates', description: 'Full certification cycle + 1 year' },
    auditPlans: { period: 6, label: 'Audit Plans', description: 'Full certification cycle + 1 year' },
    ncRecords: { period: 6, label: 'NC Records', description: 'Full certification cycle + 1 year' },
    appeals: { period: 7, label: 'Appeals', description: 'Resolution + 5 years' },
    complaints: { period: 7, label: 'Complaints', description: 'Resolution + 5 years' },
    auditorRecords: { period: 10, label: 'Auditor Competence', description: 'Employment + 5 years' },
    clientContracts: { period: 10, label: 'Client Contracts', description: 'Contract end + 5 years' },
    impartialityRecords: { period: 6, label: 'Impartiality Records', description: 'Full certification cycle + 1 year' }
};

function renderRecordRetentionModule() {
    const state = window.state;

    // Calculate record statistics
    const stats = calculateRetentionStats();

    const html = `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin: 0;">Record Retention Management</h2>
                    <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">ISO 17021-1 Clause 8.4 - Control of Records</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="window.exportRetentionReport()">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i>Export Report
                    </button>
                    <button class="btn btn-primary" onclick="window.openRetentionPolicyModal()">
                        <i class="fa-solid fa-cog" style="margin-right: 0.5rem;"></i>Configure Policy
                    </button>
                </div>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #3b82f6;">
                    <i class="fa-solid fa-database" style="font-size: 1.5rem; color: #3b82f6; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0; color: #3b82f6;">${stats.totalRecords}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Total Records</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #10b981;">
                    <i class="fa-solid fa-check-circle" style="font-size: 1.5rem; color: #10b981; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0; color: #10b981;">${stats.withinPolicy}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Within Policy</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #f59e0b;">
                    <i class="fa-solid fa-clock" style="font-size: 1.5rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0; color: #f59e0b;">${stats.approachingExpiry}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Approaching Expiry</p>
                </div>
                <div class="card" style="margin: 0; text-align: center; border-left: 4px solid #dc2626;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 1.5rem; color: #dc2626; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 2rem; font-weight: 700; margin: 0; color: #dc2626;">${stats.pastRetention}</p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Past Retention</p>
                </div>
            </div>
            
            <!-- Retention Policy Overview -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0;">
                    <i class="fa-solid fa-shield-halved" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                    Retention Policy Overview
                </h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Record Type</th>
                                <th>Retention Period</th>
                                <th>Description</th>
                                <th>Total Records</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(RETENTION_POLICY).map(([key, policy]) => {
        const count = stats.byType[key] || 0;
        const expiring = stats.expiringByType[key] || 0;
        const expired = stats.expiredByType[key] || 0;
        return `
                                    <tr>
                                        <td style="font-weight: 500;">${policy.label}</td>
                                        <td><span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">${policy.period} years</span></td>
                                        <td style="color: var(--text-secondary); font-size: 0.9rem;">${policy.description}</td>
                                        <td>${count}</td>
                                        <td>
                                            ${expired > 0 ? `<span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${expired} expired</span>` : ''}
                                            ${expiring > 0 ? `<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 0.25rem;">${expiring} expiring</span>` : ''}
                                            ${expired === 0 && expiring === 0 ? '<span style="color: #10b981;"><i class="fa-solid fa-check"></i> OK</span>' : ''}
                                        </td>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Records Requiring Attention -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">
                        <i class="fa-solid fa-exclamation-circle" style="margin-right: 0.5rem; color: #f59e0b;"></i>
                        Records Requiring Attention
                    </h3>
                    <select id="retention-filter" class="form-control" style="width: auto;" onchange="window.filterRetentionRecords(this.value)">
                        <option value="all">All Records</option>
                        <option value="expiring" selected>Approaching Expiry</option>
                        <option value="expired">Past Retention</option>
                    </select>
                </div>
                
                <div id="retention-records-list">
                    ${renderRetentionRecordsList(stats.expiringRecords)}
                </div>
            </div>
            
            <!-- ISO Info -->
            <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                    <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                    <strong>ISO 17021-1 Clause 8.4:</strong> The CB shall establish procedures detailing identification, storage, protection, retrieval, retention time, and disposition of records. Records shall be retained for at least one full certification cycle.
                </p>
            </div>
        </div>
    `;

    window.contentArea.innerHTML = html;
}

function calculateRetentionStats() {
    const state = window.state;
    const today = new Date();

    let totalRecords = 0;
    let withinPolicy = 0;
    let approachingExpiry = 0;
    let pastRetention = 0;
    let byType = {};
    let expiringByType = {};
    let expiredByType = {};
    let expiringRecords = [];
    let expiredRecords = [];

    // Helper to calculate record age
    const getRecordAge = (dateStr) => {
        if (!dateStr) return 0;
        const recordDate = new Date(dateStr);
        return (today - recordDate) / (365.25 * 24 * 60 * 60 * 1000); // years
    };

    const checkRetention = (record, type, dateField, nameField) => {
        if (!record[dateField]) return;
        const age = getRecordAge(record[dateField]);
        const policy = RETENTION_POLICY[type];
        if (!policy) return;

        byType[type] = (byType[type] || 0) + 1;
        totalRecords++;

        const yearsRemaining = policy.period - age;

        if (yearsRemaining < 0) {
            pastRetention++;
            expiredByType[type] = (expiredByType[type] || 0) + 1;
            expiredRecords.push({
                type: policy.label,
                name: record[nameField] || record.id || 'Unknown',
                date: record[dateField],
                age: age.toFixed(1),
                yearsOver: Math.abs(yearsRemaining).toFixed(1)
            });
        } else if (yearsRemaining < 1) {
            approachingExpiry++;
            expiringByType[type] = (expiringByType[type] || 0) + 1;
            expiringRecords.push({
                type: policy.label,
                name: record[nameField] || record.id || 'Unknown',
                date: record[dateField],
                age: age.toFixed(1),
                monthsRemaining: Math.round(yearsRemaining * 12)
            });
        } else {
            withinPolicy++;
        }
    };

    // Check Audit Reports
    (state.auditReports || []).forEach(r => checkRetention(r, 'auditReports', 'date', 'client'));

    // Check Certifications
    (state.certifications || []).forEach(c => checkRetention(c, 'certifications', 'issueDate', 'client'));

    // Check Audit Plans
    (state.auditPlans || []).forEach(p => checkRetention(p, 'auditPlans', 'date', 'client'));

    // Check Appeals
    (state.appeals || []).forEach(a => checkRetention(a, 'appeals', 'dateReceived', 'subject'));

    // Check Complaints
    (state.complaints || []).forEach(c => checkRetention(c, 'complaints', 'dateReceived', 'subject'));

    // Check Client Contracts
    (state.clients || []).forEach(c => {
        if (c.compliance?.contract?.signedDate) {
            checkRetention({ ...c, signedDate: c.compliance.contract.signedDate }, 'clientContracts', 'signedDate', 'name');
        }
    });

    return {
        totalRecords,
        withinPolicy,
        approachingExpiry,
        pastRetention,
        byType,
        expiringByType,
        expiredByType,
        expiringRecords: expiringRecords.sort((a, b) => (a.monthsRemaining || 0) - (b.monthsRemaining || 0)),
        expiredRecords: expiredRecords.sort((a, b) => parseFloat(b.yearsOver) - parseFloat(a.yearsOver))
    };
}

function renderRetentionRecordsList(records) {
    if (!records || records.length === 0) {
        return `
            <div style="text-align: center; padding: 3rem; background: #f0fdf4; border-radius: 8px;">
                <i class="fa-solid fa-check-circle" style="font-size: 2.5rem; color: #10b981; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.1rem; font-weight: 500; color: #065f46; margin: 0;">All Records Within Policy</p>
                <p style="color: #059669; margin: 0.5rem 0 0 0;">No records require immediate attention.</p>
            </div>
        `;
    }

    return `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Record Type</th>
                        <th>Name/Reference</th>
                        <th>Date</th>
                        <th>Age (Years)</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(r => `
                        <tr>
                            <td><span class="badge" style="background: #e0f2fe; color: #0284c7;">${window.UTILS.escapeHtml(r.type)}</span></td>
                            <td style="font-weight: 500;">${window.UTILS.escapeHtml(r.name)}</td>
                            <td>${r.date}</td>
                            <td>${r.age}</td>
                            <td>
                                ${r.yearsOver ?
            `<span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                                        <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.25rem;"></i>${r.yearsOver}y overdue
                                    </span>` :
            `<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem;">
                                        <i class="fa-solid fa-clock" style="margin-right: 0.25rem;"></i>${r.monthsRemaining}mo remaining
                                    </span>`
        }
                            </td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="window.showArchiveOptions('${r.type}', decodeURIComponent('${encodeURIComponent(r.name)}'))">
                                    <i class="fa-solid fa-archive"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Filter records by status
window.filterRetentionRecords = function (filter) {
    const stats = calculateRetentionStats();
    let records = [];

    if (filter === 'expiring') {
        records = stats.expiringRecords;
    } else if (filter === 'expired') {
        records = stats.expiredRecords;
    } else {
        records = [...stats.expiringRecords, ...stats.expiredRecords];
    }

    document.getElementById('retention-records-list').innerHTML = renderRetentionRecordsList(records);
};

// Show archive options modal
window.showArchiveOptions = function (type, name) {
    document.getElementById('modal-title').textContent = 'Archive/Dispose Record';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 1rem;">
            <p><strong>Record Type:</strong> ${type}</p>
            <p><strong>Reference:</strong> ${window.UTILS.escapeHtml(name)}</p>
        </div>
        <div class="form-group">
            <label>Disposition Action</label>
            <select id="archive-action" class="form-control">
                <option value="archive">Archive (Move to long-term storage)</option>
                <option value="extend">Extend Retention (Add 2 years)</option>
                <option value="destroy">Destroy (Mark for secure deletion)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Justification/Notes</label>
            <textarea id="archive-notes" class="form-control" rows="3" placeholder="Document reason for this action..."></textarea>
        </div>
        <div style="padding: 1rem; background: #fef3c7; border-radius: 6px; margin-top: 1rem;">
            <p style="margin: 0; font-size: 0.85rem; color: #92400e;">
                <i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
                Record disposition actions are logged for audit purposes per ISO 17021-1.
            </p>
        </div>
    `;

    document.getElementById('modal-save').onclick = function () {
        const action = document.getElementById('archive-action').value;
        const notes = document.getElementById('archive-notes').value;

        // Log the disposition action
        if (!window.state.dispositionLog) window.state.dispositionLog = [];
        window.state.dispositionLog.push({
            date: new Date().toISOString().split('T')[0],
            recordType: type,
            recordName: name,
            action: action,
            notes: notes,
            performedBy: window.state.currentUser?.name || 'Admin'
        });

        window.saveData();
        window.closeModal();
        window.showNotification(`Record ${action === 'archive' ? 'archived' : action === 'extend' ? 'retention extended' : 'marked for destruction'}`, 'success');
        renderRecordRetentionModule();
    };

    window.openModal();
};

// Open retention policy configuration modal
window.openRetentionPolicyModal = function () {
    document.getElementById('modal-title').textContent = 'Retention Policy Configuration';
    document.getElementById('modal-body').innerHTML = `
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">
            Configure retention periods for different record types. Changes apply immediately.
        </p>
        <div class="table-container" style="max-height: 400px; overflow-y: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Record Type</th>
                        <th>Retention (Years)</th>
                        <th>ISO Minimum</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(RETENTION_POLICY).map(([key, policy]) => `
                        <tr>
                            <td style="font-weight: 500;">${policy.label}</td>
                            <td>
                                <input type="number" id="policy-${key}" class="form-control form-control-sm" 
                                    value="${policy.period}" min="1" max="20" style="width: 80px;">
                            </td>
                            <td><span style="color: var(--text-secondary);">≥ 3 years</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 6px;">
            <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                ISO 17021-1 requires minimum retention of one full certification cycle (typically 3 years).
            </p>
        </div>
    `;

    document.getElementById('modal-save').textContent = 'Save Policy';
    document.getElementById('modal-save').onclick = function () {
        // In a real app, this would persist to backend
        window.showNotification('Retention policy updated', 'success');
        window.closeModal();
        renderRecordRetentionModule();
    };

    window.openModal();
};

// Export retention report
window.exportRetentionReport = function () {
    const stats = calculateRetentionStats();
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <html>
        <head>
            <title>Record Retention Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f1f5f9; }
                .stat-box { display: inline-block; padding: 15px 25px; margin: 5px; background: #f8fafc; border-radius: 8px; text-align: center; }
                .stat-value { font-size: 2rem; font-weight: bold; color: #1e40af; }
                .expired { background: #fee2e2; color: #dc2626; }
                .expiring { background: #fef3c7; color: #d97706; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <h1>📁 Record Retention Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Organization:</strong> AuditCB360 Certification Body</p>
            
            <h2>Summary Statistics</h2>
            <div>
                <div class="stat-box"><div class="stat-value">${stats.totalRecords}</div>Total Records</div>
                <div class="stat-box"><div class="stat-value">${stats.withinPolicy}</div>Within Policy</div>
                <div class="stat-box"><div class="stat-value">${stats.approachingExpiry}</div>Approaching Expiry</div>
                <div class="stat-box"><div class="stat-value">${stats.pastRetention}</div>Past Retention</div>
            </div>
            
            <h2>Records by Type</h2>
            <table>
                <tr><th>Record Type</th><th>Count</th><th>Retention Period</th><th>Expiring</th><th>Expired</th></tr>
                ${Object.entries(RETENTION_POLICY).map(([key, policy]) => `
                    <tr>
                        <td>${policy.label}</td>
                        <td>${stats.byType[key] || 0}</td>
                        <td>${policy.period} years</td>
                        <td class="${(stats.expiringByType[key] || 0) > 0 ? 'expiring' : ''}">${stats.expiringByType[key] || 0}</td>
                        <td class="${(stats.expiredByType[key] || 0) > 0 ? 'expired' : ''}">${stats.expiredByType[key] || 0}</td>
                    </tr>
                `).join('')}
            </table>
            
            ${stats.expiredRecords.length > 0 ? `
                <h2>Records Past Retention Period</h2>
                <table>
                    <tr><th>Type</th><th>Reference</th><th>Date</th><th>Age</th><th>Overdue</th></tr>
                    ${stats.expiredRecords.map(r => `
                        <tr class="expired">
                            <td>${window.UTILS.escapeHtml(r.type)}</td>
                            <td>${window.UTILS.escapeHtml(r.name)}</td>
                            <td>${r.date}</td>
                            <td>${r.age} years</td>
                            <td>${r.yearsOver} years</td>
                        </tr>
                    `).join('')}
                </table>
            ` : ''}
            
            <hr style="margin-top: 40px;">
            <p style="font-size: 0.9rem; color: #666;">
                This report is generated for ISO 17021-1 Clause 8.4 compliance purposes.<br>
                Retention policy: Records retained for minimum one full certification cycle (3 years).
            </p>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};

// Export the main function
window.renderRecordRetentionModule = renderRecordRetentionModule;

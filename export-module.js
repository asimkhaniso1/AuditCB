// ============================================
// EXPORT MODULE - PDF & Excel Export
// ============================================

// Export to CSV (Excel-compatible)
function exportToCSV(data, filename, columns) {
    // Create CSV header
    const headers = columns.map(col => col.label).join(',');

    // Create CSV rows
    const rows = data.map(item => {
        return columns.map(col => {
            let value = col.field.split('.').reduce((obj, key) => obj?.[key], item) || '';
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    }).join('\n');

    const csv = `${headers}\n${rows}`;

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`Exported ${data.length} records to ${filename}.csv`);
}

// Export to PDF (using browser print with custom styles)
function exportToPDF(title, content) {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                @page {
                    margin: 2cm;
                    size: A4;
                }
                
                body {
                    font-family: 'Inter', Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.5;
                    color: #000;
                }
                
                h1 {
                    font-size: 18pt;
                    margin-bottom: 1rem;
                    color: #1e293b;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 0.5rem;
                }
                
                h2 {
                    font-size: 14pt;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    color: #334155;
                }
                
                h3 {
                    font-size: 12pt;
                    margin-top: 1rem;
                    margin-bottom: 0.5rem;
                    color: #475569;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1rem 0;
                    page-break-inside: auto;
                }
                
                tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
                
                thead {
                    display: table-header-group;
                }
                
                th, td {
                    padding: 0.5rem;
                    text-align: left;
                    border: 1px solid #cbd5e1;
                }
                
                th {
                    background-color: #f1f5f9;
                    font-weight: 600;
                    color: #475569;
                }
                
                .header {
                    margin-bottom: 2rem;
                }
                
                .meta-info {
                    color: #64748b;
                    font-size: 10pt;
                    margin-bottom: 1rem;
                }
                
                .status-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 9pt;
                    font-weight: 500;
                    border: 1px solid #cbd5e1;
                }
                
                .footer {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #e2e8f0;
                    font-size: 9pt;
                    color: #64748b;
                }
                
                @media print {
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
                <div class="meta-info">
                    Generated on: ${new Date().toLocaleString()}<br>
                    AuditCB360 - ISO CB Auditor & Audit Management
                </div>
            </div>
            ${content}
            <div class="footer">
                <p>This is a computer-generated report from AuditCB360.</p>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = function () {
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

// Export Clients to CSV
function exportClientsToCSV() {
    const columns = [
        { label: 'ID', field: 'id' },
        { label: 'Client Name', field: 'name' },
        { label: 'Standard', field: 'standard' },
        { label: 'Status', field: 'status' },
        { label: 'Next Audit', field: 'nextAudit' }
    ];

    exportToCSV(state.clients, 'clients_export', columns);
}

// Export Auditors to CSV
function exportAuditorsToCSV() {
    const columns = [
        { label: 'ID', field: 'id' },
        { label: 'Name', field: 'name' },
        { label: 'Role', field: 'role' },
        { label: 'Standards', field: 'standards' }
    ];

    // Transform standards array to string
    const data = state.auditors.map(auditor => ({
        ...auditor,
        standards: auditor.standards.join('; ')
    }));

    exportToCSV(data, 'auditors_export', columns);
}

// Export Audit Programs to CSV
function exportAuditProgramsToCSV() {
    const columns = [
        { label: 'ID', field: 'id' },
        { label: 'Client', field: 'client' },
        { label: 'Standard', field: 'standard' },
        { label: 'Cycle Start', field: 'cycleStart' },
        { label: 'Cycle End', field: 'cycleEnd' },
        { label: 'Status', field: 'status' }
    ];

    exportToCSV(state.auditPrograms, 'audit_programs_export', columns);
}

// Export Clients Report to PDF
function exportClientsToPDF() {
    const tableRows = state.clients.map(client => `
        <tr>
            <td>${client.id}</td>
            <td>${client.name}</td>
            <td>${client.standard}</td>
            <td><span class="status-badge">${client.status}</span></td>
            <td>${client.nextAudit}</td>
        </tr>
    `).join('');

    const content = `
        <h2>Client List</h2>
        <p>Total Clients: ${state.clients.length}</p>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Client Name</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Next Audit</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;

    exportToPDF('Clients Report', content);
}

// Export Audit Program Report to PDF
function exportAuditProgramToPDF(programId) {
    const program = state.auditPrograms.find(p => p.id === programId);
    if (!program) {
        showNotification('Program not found', 'error');
        return;
    }

    const content = `
        <h2>Audit Program Details</h2>
        <table>
            <tr>
                <th>Client</th>
                <td>${program.client}</td>
            </tr>
            <tr>
                <th>Standard</th>
                <td>${program.standard}</td>
            </tr>
            <tr>
                <th>Cycle Period</th>
                <td>${program.cycleStart} to ${program.cycleEnd}</td>
            </tr>
            <tr>
                <th>Status</th>
                <td><span class="status-badge">${program.status}</span></td>
            </tr>
        </table>
        
        <h3>Scheduled Audits</h3>
        <table>
            <thead>
                <tr>
                    <th>Audit Type</th>
                    <th>Planned Date</th>
                    <th>Auditor</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Stage 1</td>
                    <td>2023-01-15</td>
                    <td>John Doe</td>
                    <td>Completed</td>
                </tr>
                <tr>
                    <td>Stage 2</td>
                    <td>2023-02-20</td>
                    <td>John Doe</td>
                    <td>Completed</td>
                </tr>
                <tr>
                    <td>Surveillance 1</td>
                    <td>2024-02-20</td>
                    <td>Jane Smith</td>
                    <td>Scheduled</td>
                </tr>
            </tbody>
        </table>
    `;

    exportToPDF(`Audit Program - ${program.client}`, content);
}

// Export Dashboard Summary to PDF
function exportDashboardToPDF() {
    const content = `
        <h2>Dashboard Summary</h2>
        
        <h3>Key Performance Indicators</h3>
        <table>
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Total Clients</td>
                <td>${state.clients.length}</td>
            </tr>
            <tr>
                <td>Active Auditors</td>
                <td>${state.auditors.length}</td>
            </tr>
            <tr>
                <td>Audit Programs</td>
                <td>${state.auditPrograms.length}</td>
            </tr>
            <tr>
                <td>Certification Decisions</td>
                <td>${state.certificationDecisions.length}</td>
            </tr>
        </table>
        
        <h3>Recent Clients</h3>
        <table>
            <thead>
                <tr>
                    <th>Client Name</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Next Audit</th>
                </tr>
            </thead>
            <tbody>
                ${state.clients.slice(0, 10).map(client => `
                    <tr>
                        <td>${client.name}</td>
                        <td>${client.standard}</td>
                        <td>${client.status}</td>
                        <td>${client.nextAudit}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    exportToPDF('Dashboard Summary Report', content);
}

// Add export buttons to modules
function addExportButtons(moduleName) {
    const exportButtons = {
        'clients': `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" onclick="exportClientsToCSV()">
                    <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i>Export to Excel
                </button>
                <button class="btn btn-secondary" onclick="exportClientsToPDF()">
                    <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i>Export to PDF
                </button>
            </div>
        `,
        'auditors': `
            <button class="btn btn-secondary" onclick="exportAuditorsToCSV()">
                <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i>Export to Excel
            </button>
        `,
        'audit-programs': `
            <button class="btn btn-secondary" onclick="exportAuditProgramsToCSV()">
                <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i>Export to Excel
            </button>
        `,
        'dashboard': `
            <button class="btn btn-secondary" onclick="exportDashboardToPDF()">
                <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i>Export Summary
            </button>
        `
    };

    return exportButtons[moduleName] || '';
}

// Export functions to global scope
window.exportToCSV = exportToCSV;
window.exportToPDF = exportToPDF;
window.exportClientsToCSV = exportClientsToCSV;
window.exportAuditorsToCSV = exportAuditorsToCSV;
window.exportAuditProgramsToCSV = exportAuditProgramsToCSV;
window.exportClientsToPDF = exportClientsToPDF;
window.exportAuditProgramToPDF = exportAuditProgramToPDF;
window.exportDashboardToPDF = exportDashboardToPDF;
window.addExportButtons = addExportButtons;

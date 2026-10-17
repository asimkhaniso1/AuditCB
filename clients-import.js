// ============================================
// CLIENTS MODULE - Import/Export, Certificates & Setup
// Extracted from clients-module.js for maintainability
// Contains: certificate CRUD, import/export templates, CCI import,
//   account-setup import, client logo preview
// The setup wizard, certificate/settings tab HTML, cert field updaters, logo
// upload and client auditor assignment live in clients-org-setup.js (it loads
// after this file, so its copies were the ones running).
// ============================================


    // ============================================
    // BULK IMPORT / EXPORT FUNCTIONS
    // ============================================

    window.saveCertificateDetails = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        // Save locally first
        window.saveData();

        // Sync to Supabase
        if (window.SupabaseClient?.isInitialized) {
            const syncPromises = [];

            // 1. Sync the CLIENT object (so data.certificates JSONB persists dates)
            syncPromises.push(
                window.DataService.syncClient(client, { saveLocal: false, silent: true })
            );

            // 2. Sync individual certs to certification_decisions table
            if (client.certificates && client.certificates.length > 0) {
                let successCount = 0;
                const certPromises = client.certificates.map((cert, i) => {
                    if (!cert.client) cert.client = client.name;

                    // SELF-HEAL: If cert has no ID (legacy bug), generate one now
                    if (!cert.id) {
                        cert.id = 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '-' + i;
                    }

                    return window.SupabaseClient.upsertCertificate(cert)
                        .then(() => successCount++)
                        .catch(err => console.error(`Failed to save cert ${cert.id}:`, err));
                });

                syncPromises.push(
                    Promise.all(certPromises).then(() => {
                        if (successCount > 0) {
                            window.showNotification(`Saved ${successCount} certificates successfully`, 'success');
                        } else {
                            window.showNotification('Failed to save certificates to cloud', 'error');
                        }
                    })
                );
            }

            Promise.all(syncPromises).catch(error => {
                console.error('Save Certificate Error:', error);
                window.showNotification('Cloud save failed: ' + (error.message || 'Unknown error'), 'error');
            });
        } else {
            // Fallback for local-only
            window.showNotification('Certificate details saved locally', 'success');
        }
    };

    window.viewCertRevisionHistory = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];
        const history = cert.revisionHistory || [];

        document.getElementById('modal-title').textContent = `Revision History - ${cert.standard}`;
        document.getElementById('modal-body').innerHTML = `
        \u003cdiv style="margin-bottom: 1rem;"\u003e
            \u003cp\u003e\u003cstrong\u003eCertificate:\u003c/strong\u003e ${cert.certificateNo || 'Not assigned'}\u003c/p\u003e
            \u003cp\u003e\u003cstrong\u003eCurrent Revision:\u003c/strong\u003e ${cert.revision || '00'}\u003c/p\u003e
        \u003c/div\u003e
        
        ${history.length > 0 ? `
            \u003cdiv class="table-container"\u003e
                \u003ctable\u003e
                    \u003cthead\u003e
                        \u003ctr\u003e
                            \u003cth\u003eRevision\u003c/th\u003e
                            \u003cth\u003eDate\u003c/th\u003e
                            \u003cth\u003eChange Description\u003c/th\u003e
                            \u003cth\u003eChanged By\u003c/th\u003e
                        \u003c/tr\u003e
                    \u003c/thead\u003e
                    \u003ctbody\u003e
                        ${history.map(h => `
                            \u003ctr\u003e
                                \u003ctd\u003e\u003cstrong\u003e${h.revision}\u003c/strong\u003e\u003c/td\u003e
                                \u003ctd\u003e${h.date}\u003c/td\u003e
                                \u003ctd\u003e${h.description}\u003c/td\u003e
                                \u003ctd\u003e${h.changedBy || 'N/A'}\u003c/td\u003e
                            \u003c/tr\u003e
                        `).join('')}
                    \u003c/tbody\u003e
                \u003c/table\u003e
            \u003c/div\u003e
        ` : `
            \u003cdiv style="text-align: center; padding: 2rem; color: var(--text-secondary);"\u003e
                \u003ci class="fa-solid fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"\u003e\u003c/i\u003e
                \u003cp\u003eNo revision history recorded yet.\u003c/p\u003e
                \u003cp style="font-size: 0.85rem;"\u003eRevisions are automatically tracked when scope changes are saved.\u003c/p\u003e
            \u003c/div\u003e
        `}
        
        \u003cdiv style="margin-top: 1.5rem; padding: 1rem; background: #eff6ff; border-radius: 6px;"\u003e
            \u003ch4 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #1d4ed8;"\u003eAdd New Revision\u003c/h4\u003e
            \u003cdiv class="form-group"\u003e
                \u003clabel\u003eRevision Number\u003c/label\u003e
                \u003cinput type="text" id="new-revision-number" class="form-control" placeholder="e.g., 01, 02" value="${String(parseInt(cert.revision || '00', 10) + 1).padStart(2, '0')}"\u003e
            \u003c/div\u003e
            \u003cdiv class="form-group"\u003e
                \u003clabel\u003eChange Description\u003c/label\u003e
                \u003ctextarea id="new-revision-description" class="form-control" rows="2" placeholder="Describe what changed in this revision..."\u003e\u003c/textarea\u003e
            \u003c/div\u003e
            \u003cbutton class="btn btn-primary btn-sm" data-action="addCertRevision" data-arg1="${clientId}" data-arg2="${certIndex}"\u003e
                \u003ci class="fa-solid fa-plus" style="margin-right: 0.5rem;"\u003e\u003c/i\u003eAdd Revision
            \u003c/button\u003e
        \u003c/div\u003e
    `;

        document.getElementById('modal-save').style.display = 'none';
        window.openModal();
    };

    window.addCertRevision = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];
        const revisionNumber = document.getElementById('new-revision-number').value.trim();
        const description = document.getElementById('new-revision-description').value.trim();

        if (!revisionNumber || !description) {
            window.showNotification('Please enter revision number and description', 'error');
            return;
        }

        if (!cert.revisionHistory) cert.revisionHistory = [];

        cert.revisionHistory.push({
            revision: revisionNumber,
            date: new Date().toISOString().split('T')[0],
            description: description,
            changedBy: window.state.currentUser?.name || 'Admin'
        });

        cert.revision = revisionNumber;

        window.saveData();
        window.closeModal();
        window.showNotification('Revision added successfully', 'success');
        renderClientDetail(clientId);
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
        }, 100);
    };

    window.deleteCertificationScope = function (clientId, certIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.certificates || !client.certificates[certIndex]) return;

        const cert = client.certificates[certIndex];

        if (confirm(`Are you sure you want to remove the certification scope for ${cert.standard}?\n\nThis will delete all associated scope data and revision history, and remove ${cert.standard} from the client's and sites' standards.`)) {
            client.certificates.splice(certIndex, 1);
            // Remember the deletion on the client itself. On load the certificate
            // register is merged in, and a register row that survived (its delete
            // can be refused by RLS without an error) must not revive this record.
            client.deletedCertificateIds = client.deletedCertificateIds || [];
            if (cert.id) client.deletedCertificateIds.push(String(cert.id));
            if (cert.certificateNo) {
                const c = window.UTILS && window.UTILS.canonicalStandard ? window.UTILS.canonicalStandard(cert.standard) : String(cert.standard || '').trim();
                client.deletedCertificateIds.push(c + '|' + String(cert.certificateNo).trim());
            }
            // A standard still listed on the client or a site is recreated as a
            // blank certificate by Sync Standards — take it off those lists too,
            // unless another certificate for the same standard remains.
            const canon = (s) => (window.UTILS && window.UTILS.canonicalStandard ? window.UTILS.canonicalStandard(s) : String(s || '').trim());
            const gone = canon(cert.standard);
            if (gone && !client.certificates.some(c => canon(c.standard) === gone)) {
                const without = (list) => String(list || '').split(',').map(s => s.trim()).filter(s => s && canon(s) !== gone).join(', ');
                if (client.standard) client.standard = without(client.standard);
                (client.sites || []).forEach(site => { if (site.standards) site.standards = without(site.standards); });
            }
            window.saveData();
            // The certificate lives in the CLOUD copy of the client (data.certificates)
            // and in certification_decisions. Saving only locally left both intact,
            // so the next load from the cloud brought the deleted record back.
            if (window.SupabaseClient?.isInitialized && window.DataService) {
                // syncToCloud resolves false (never throws) on failure.
                Promise.all([
                    window.DataService.syncClient(client, { saveLocal: false, silent: true }),
                    cert.id ? window.DataService.deleteCertificate(cert.id, { silent: true }) : true
                ]).then(([clientSaved]) => {
                    if (!clientSaved) {
                        window.showNotification('Removed here, but the cloud copy could not be updated — it may reappear after refresh. Try again when online.', 'warning');
                    }
                });
            }
            window.showNotification('Certification scope removed', 'success');
            renderClientDetail(clientId);
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="scopes"]')?.click();
            }, 100);
        }
    };


    // Sub-Tab Switching for Org Setup
    window.switchClientOrgSubTab = function (btn, subTabId, clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        // UI Feedback
        const container = btn.parentElement;
        container.querySelectorAll('.sub-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-secondary)';
            b.style.borderBottom = 'none';
            b.style.fontWeight = 'normal';
        });
        btn.classList.add('active');
        btn.style.color = 'var(--primary-color)';
        btn.style.borderBottom = '2px solid var(--primary-color)';
        btn.style.fontWeight = '500';

        // Content Switching
        const contentArea = document.getElementById('org-setup-content');
        if (!contentArea) return;

        if (subTabId === 'certificates') {
            contentArea.innerHTML = getClientCertificatesHTML(client);
        } else if (subTabId === 'sites') {
            contentArea.innerHTML = getClientSitesHTML(client);
        } else if (subTabId === 'departments') {
            contentArea.innerHTML = getClientDepartmentsHTML(client);
        } else if (subTabId === 'contacts') {
            contentArea.innerHTML = getClientContactsHTML(client);
        }
    };


    // Update Template Download for Simplified Bulk Clients
    window.downloadImportTemplate = function () {
        // Simplified template with only 6 essential fields
        const headers = ["Name", "Industry", "Standard", "Contact Person", "Email", "Phone"];
        const row1 = ["Tech Solutions Ltd", "Information Technology", "ISO 9001", "John Doe", "john@techsolutions.com", "+1234567890"];
        const row2 = ["Global Manufacturing Inc", "Manufacturing", "ISO 9001:2015", "Jane Smith", "jane@globalmanuf.com", "+1987654321"];

        const csvContent = [headers, row1, row2]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const filename = 'AuditCB_Client_Import_Template.csv';

        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Try multiple download methods for maximum compatibility

        // Method 1: IE/Edge msSaveBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob, filename);
            window.showNotification('Template downloaded as CSV', 'success');
            return;
        }

        // Method 2: Modern browsers with download attribute
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Set multiple attributes for maximum compatibility
        link.href = url;
        link.download = filename;
        link.setAttribute('download', filename);
        link.type = 'text/csv';
        link.rel = 'noopener';

        // Make link invisible but keep in DOM
        link.style.position = 'fixed';
        link.style.top = '-9999px';
        link.style.left = '-9999px';

        document.body.appendChild(link);

        // Force click with multiple methods
        if (link.click) {
            link.click();
        } else if (document.createEvent) {
            const event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            link.dispatchEvent(event);
        }

        // Cleanup after a delay
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 250);

        window.showNotification('Template downloaded as CSV (opens in Excel)', 'success');
    };

    // Fallback: Download template as CSV
    // eslint-disable-next-line no-unused-vars
    function downloadTemplateAsCSV() {
        const headers = ["Client Name", "Status", "Industry", "Employee Count", "Website", "Next Audit Date", "Applicable Standards", "Contact Name", "Contact Email", "Address", "City", "Country"];
        const row1 = ["Sample Corp", "Active", "Manufacturing", "100", "https://sample.com", "2025-01-01", "ISO 9001:2015", "John Doe", "john@sample.com", "123 Main St", "New York", "USA"];
        const row2 = ["Tech Solutions Inc", "Active", "IT Services", "50", "https://techsol.com", "2025-03-15", "ISO 27001:2022", "Alice Tech", "alice@techsol.com", "789 Tech Blvd", "San Francisco", "USA"];

        const csvContent = [headers, row1, row2]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'AuditCB_Client_Import_Template.csv');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);

        // Trigger download with a small delay to ensure DOM is ready
        setTimeout(() => {
            link.click();
            document.body.removeChild(link);

            // Clean up blob URL after a delay
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
        }, 10);

        window.showNotification('Template downloaded as CSV (open in Excel)', 'success');
    }

    // Update Import Logic for Simplified Bulk Clients (supports CSV and Excel)
    window.importClientsFromExcel = function (file) {
        window.showNotification('Reading file...', 'info');

        // JSON = CCI registry export (companies + nested certificates)
        if (file.name.toLowerCase().endsWith('.json')) {
            const jsonReader = new FileReader();
            jsonReader.onload = function (ev) {
                try {
                    window.importFromCCIJson(JSON.parse(ev.target.result));
                } catch (err) {
                    console.error('CCI import error:', err);
                    window.showNotification('CCI Import Failed: ' + err.message, 'error');
                }
            };
            jsonReader.readAsText(file);
            return;
        }

        const reader = new FileReader();

        // Check if it's a CSV file
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        reader.onload = function (e) {
            try {
                let clientsRaw = [];

                if (isCSV) {
                    // Parse CSV file properly from ArrayBuffer
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(new Uint8Array(e.target.result));

                    // Simple CSV Parser handling quotes
                    const parseCSVLine = (line) => {
                        const result = [];
                        let start = 0;
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            if (line[i] === '"') {
                                inQuotes = !inQuotes;
                            } else if (line[i] === ',' && !inQuotes) {
                                let field = line.substring(start, i).trim();
                                // Remove surrounding quotes and handle escaped quotes
                                if (field.startsWith('"') && field.endsWith('"')) {
                                    field = field.slice(1, -1).replace(/""/g, '"');
                                }
                                result.push(field);
                                start = i + 1;
                            }
                        }
                        // Last field
                        let field = line.substring(start).trim();
                        if (field.startsWith('"') && field.endsWith('"')) {
                            field = field.slice(1, -1).replace(/""/g, '"');
                        }
                        result.push(field);
                        return result;
                    };

                    const lines = text.split(/\r?\n/).filter(line => line.trim());

                    if (lines.length < 2) {
                        throw new Error('CSV file is empty or has no data rows');
                    }

                    // Parse header
                    const headers = parseCSVLine(lines[0]);

                    // Parse data rows
                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCSVLine(lines[i]);
                        const row = {};
                        headers.forEach((header, index) => {
                            // Clean header name (remove BOM if present)
                            const cleanHeader = header.replace(/^\ufeff/, '').trim();
                            row[cleanHeader] = values[index] || '';
                        });
                        clientsRaw.push(row);
                    }
                } else {
                    // Parse Excel file
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Validate Sheets
                    if (!workbook.Sheets['Clients']) throw new Error("Missing 'Clients' sheet");

                    clientsRaw = XLSX.utils.sheet_to_json(workbook.Sheets['Clients']);
                }

                let importedCount = 0;
                let updatedCount = 0;

                clientsRaw.forEach(row => {
                    // Support both old and new template formats
                    const name = row['Name'] || row['Client Name'];
                    if (!name) return;

                    // Check existing
                    let client = window.state.clients.find(c => c.name.toLowerCase() === name.toLowerCase());

                    if (client) {
                        updatedCount++;
                    } else {
                        client = {
                            id: crypto.randomUUID(),
                            name: window.Sanitizer.sanitizeText(name),
                            status: 'Active', // Default status
                            contacts: [],
                            sites: [],
                            certificates: []
                        };
                        window.state.clients.push(client);
                        importedCount++;
                    }

                    // Update fields from simplified template (6 fields)
                    client.industry = window.Sanitizer.sanitizeText(row['Industry'] || client.industry || '');
                    client.standard = window.Sanitizer.sanitizeText(row['Standard'] || row['Applicable Standards'] || client.standard || '');

                    // Handle contact information
                    const contactPerson = row['Contact Person'] || row['Contact Name'];
                    const contactEmail = row['Email'] || row['Contact Email'];
                    const contactPhone = row['Phone'];

                    if (contactPerson || contactEmail || contactPhone) {
                        // Update or create primary contact
                        if (!client.contacts || client.contacts.length === 0) {
                            client.contacts = [{
                                name: window.Sanitizer.sanitizeText(contactPerson || ''),
                                email: window.Sanitizer.sanitizeEmail(contactEmail || ''),
                                phone: window.Sanitizer.sanitizeText(contactPhone || ''),
                                role: 'Primary Contact'
                            }];
                        } else {
                            // Update existing primary contact
                            client.contacts[0].name = window.Sanitizer.sanitizeText(contactPerson || client.contacts[0].name);
                            client.contacts[0].email = window.Sanitizer.sanitizeEmail(contactEmail || client.contacts[0].email);
                            client.contacts[0].phone = window.Sanitizer.sanitizeText(contactPhone || client.contacts[0].phone);
                        }
                    }

                    // Backward compatibility with old template fields
                    if (row['Status']) client.status = window.Sanitizer.sanitizeText(row['Status']);
                    if (row['Employee Count']) client.employees = parseInt(row['Employee Count'], 10) || 0;
                    if (row['Website']) client.website = window.Sanitizer.sanitizeURL(row['Website']);
                    if (row['Next Audit Date']) client.nextAudit = row['Next Audit Date'];

                    // Update Contact
                    if (row['Contact Name']) {
                        const contact = {
                            name: window.Sanitizer.sanitizeText(row['Contact Name']),
                            email: window.Sanitizer.sanitizeText(row['Contact Email'] || ''),
                            designation: 'Primary Contact'
                        };
                        // Simplified: Replace first contact if it exists, otherwise add
                        if (client.contacts && client.contacts.length > 0) {
                            client.contacts[0] = { ...client.contacts[0], ...contact };
                        } else {
                            client.contacts = [contact];
                        }
                    }

                    // Update Site (Head Office)
                    if (row['Address'] || row['City'] || row['Country']) {
                        const site = {
                            name: 'Head Office',
                            address: window.Sanitizer.sanitizeText(row['Address'] || ''),
                            city: window.Sanitizer.sanitizeText(row['City'] || ''),
                            country: window.Sanitizer.sanitizeText(row['Country'] || ''),
                            standards: client.standard
                        };
                        // Simplified: Replace first site if it exists, otherwise add
                        if (client.sites && client.sites.length > 0) {
                            client.sites[0] = { ...client.sites[0], ...site };
                        } else {
                            client.sites = [site];
                        }
                    }
                });

                window.saveData();
                window.showNotification(`Import Successful: ${importedCount} created, ${updatedCount} updated`, 'success');
                if (typeof window.renderClientsEnhanced === 'function') window.renderClientsEnhanced();

            } catch (err) {
                console.error(err);
                window.showNotification('Import Failed: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // ============================================
    // ACCOUNT SETUP BULK IMPORT (MASTER UPLOAD)
    // ============================================

    // ─── CCI Registry Import ─────────────────────────────────────────
    // Accepts the JSON export from the CCI (companycertification.com) Supabase,
    // produced by `export_auditcb_clients.js` in the CCI Website repo: nested
    // rows {companies:[{...company, certificates:[...]}]} / [{...}] or flat
    // company+cert join rows (SQL editor). Only ACTIVE companies are imported
    // (active === false is skipped).
    //
    //  • Matching: the cciCompanyId stamped by an earlier import wins; otherwise
    //    a normalised name match (case / punctuation / legal-suffix insensitive,
    //    so "Visiontech Export Intl (Pvt.) Ltd." is "VISIONTECH EXPORT
    //    INTERNATIONAL (PVT.) LTD."), then a unique prefix match ("Pakistan Post
    //    Foundation" is "PAKISTAN POST FOUNDATION (Press Division)").
    //  • Company details (industry, website, employees, contact, head office)
    //    only FILL GAPS: a value already held in AuditCB is never overwritten.
    //  • Certificates belong to the registry: number, standard, dates, status
    //    and scope are refreshed from CCI on every import, deduped by cert number.
    //  • CCI standard labels map to the canonical app names
    //    ("ISO 9001-Quality Management" → "ISO 9001:2015").
    //  • CCI validity codes: V valid (Expired once the end date has passed),
    //    S suspended, W withdrawn, R revoked (→ Withdrawn), I / E → Expired.

    // Legal-form words that differ between the two registers but mean the same company.
    const CCI_NAME_WORDS = { international: 'intl', private: 'pvt', limited: 'ltd', incorporated: 'inc', corporation: 'corp', company: 'co' };
    const CCI_LEGAL_SUFFIXES = new Set(['pvt', 'ltd', 'inc', 'llc', 'co', 'corp', 'ag', 'gmbh', 'plc', 'sa', 'llp', 'pte']);

    // Drupal-era text carries HTML entities ("&amp;"), stray tags and CRLFs — and
    // an AuditCB record escaped once per save can carry several layers of them.
    function cleanCciText(value) {
        return window.UTILS.decodeEntities(String(value == null ? '' : value).replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Registry labels ("ISO 9001-Quality Management", "CE Marking / EU Directive")
    // become the house name the standards pickers offer. One table, in UTILS, so
    // the importer and the pickers can never drift apart.
    function mapCciStandard(label) {
        return window.UTILS.canonicalStandard(cleanCciText(label));
    }

    function mapCciStatus(code, endDate, now) {
        const c = String(code || '').trim().toUpperCase();
        const end = endDate ? new Date(endDate) : null;
        const ref = now instanceof Date ? now : new Date();
        const expiredByDate = !!(end && !isNaN(end.getTime()) && end.getTime() < ref.getTime());
        if (c === 'S') return 'Suspended';
        if (c === 'W' || c === 'R') return 'Withdrawn';
        if (c === 'V') return expiredByDate ? 'Expired' : 'Active';
        return 'Expired';
    }

    function normalizeCompanyName(name) {
        let s = cleanCciText(name).replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
        s = s.split(' ').map(w => CCI_NAME_WORDS[w] || w).join(' ');
        if (s.startsWith('the ')) s = s.slice(4);
        const words = s.split(' ').filter(Boolean);
        while (words.length > 1 && CCI_LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
        return words.join(' ');
    }

    function companyNamesMatch(a, b) {
        const na = normalizeCompanyName(a), nb = normalizeCompanyName(b);
        if (!na || !nb) return false;
        if (na === nb) return true;
        const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
        return short.length >= 10 && long.startsWith(short + ' ');
    }

    function findClientForCompany(clients, src) {
        const list = Array.isArray(clients) ? clients : [];
        const id = src && src.id ? String(src.id) : '';
        if (id) {
            const byId = list.find(c => c.cciCompanyId && String(c.cciCompanyId) === id);
            if (byId) return byId;
        }
        // A client already bound to a different CCI company is never a name candidate.
        const free = list.filter(c => !c.cciCompanyId || String(c.cciCompanyId) === id);
        const name = (src && (src.name || src.company_name)) || '';
        const norm = normalizeCompanyName(name);
        if (!norm) return null;
        const exact = free.find(c => normalizeCompanyName(c.name) === norm);
        if (exact) return exact;
        const prefix = free.filter(c => companyNamesMatch(c.name, name));
        return prefix.length === 1 ? prefix[0] : null;
    }

    // A mailbox on a free provider never stands for the company website.
    const FREE_MAIL_DOMAINS = new Set([
        'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
        'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com', 'icloud.com', 'me.com',
        'proton.me', 'protonmail.com', 'mail.com', 'gmx.com', 'gmx.de', 'zoho.com', 'rediffmail.com'
    ]);
    function websiteFromEmail(email) {
        const m = String(email || '').trim().toLowerCase().match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/);
        if (!m || FREE_MAIL_DOMAINS.has(m[1])) return '';
        return 'https://' + m[1];
    }

    window.CCIImport = { cleanCciText, mapCciStandard, mapCciStatus, normalizeCompanyName, companyNamesMatch, findClientForCompany, websiteFromEmail };

    window.importFromCCIJson = function (data, opts) {
        const rows = Array.isArray(data) ? data : ((data && (data.rows || data.companies)) || []);
        if (!rows.length) throw new Error('No records found in JSON');

        const S = window.Sanitizer;
        const now = opts && opts.now instanceof Date ? opts.now : new Date();
        // Stored as clean RAW text (tags stripped, entities decoded) — HTML escaping
        // belongs to the render layer. Escaping here made "FD&C" print as "FD&amp;C".
        const txt = v => cleanCciText(v);
        const positiveInt = v => { const n = parseInt(v, 10); return n > 0 ? n : 0; };

        // Normalize: group flat join rows by company; nested rows pass through.
        const companies = new Map();
        rows.forEach(r => {
            const name = r.name || r.company_name;
            if (!name) return;
            const key = normalizeCompanyName(name) || String(name).trim().toLowerCase();
            if (!companies.has(key)) companies.set(key, { src: r, certs: [] });
            const bucket = companies.get(key);
            if (Array.isArray(r.certificates)) bucket.certs.push(...r.certificates);
            else if (r.certificate_no || r.applicable_standard) bucket.certs.push(r);
        });

        const touched = [];
        let imported = 0, updated = 0, skippedInactive = 0, certCount = 0;
        companies.forEach(({ src, certs }) => {
            if (src.active === false) { skippedInactive++; return; }
            const name = cleanCciText(src.name || src.company_name);
            // Flat join rows carry the certificate id in `id`; only trust it as the company id on nested rows.
            const cciId = src.company_id || (Array.isArray(src.certificates) ? src.id : null) || null;

            let client = findClientForCompany(window.state.clients, { id: cciId, name });
            if (client) { updated++; }
            else {
                client = { id: crypto.randomUUID(), name: name, status: 'Active', contacts: [], sites: [], certificates: [] };
                window.state.clients.push(client);
                imported++;
            }
            if (cciId) client.cciCompanyId = cciId;
            client.source = 'CCI';
            client.cciSyncedAt = now.toISOString();

            // Heal entity-escaped text the pre-fix importer stored ("FD&amp;C",
            // "IT &amp; Technology"): decode in place. Identity for clean values.
            if (client.name) client.name = txt(client.name) || client.name;
            if (client.industry) client.industry = txt(client.industry);
            if (client.groupName) client.groupName = txt(client.groupName);
            (client.contacts || []).forEach(ct => { if (ct && ct.name) ct.name = txt(ct.name); });
            (client.sites || []).forEach(st => {
                if (!st) return;
                ['name', 'address', 'city', 'country'].forEach(f => { if (st[f]) st[f] = txt(st[f]); });
            });

            // Company details: fill gaps only, never overwrite what AuditCB already holds.
            if (!client.industry && src.industry) client.industry = txt(src.industry);
            if (!client.website && src.website) client.website = S.sanitizeURL(String(src.website).trim());
            if (!positiveInt(client.employees) && positiveInt(src.total_employees)) client.employees = positiveInt(src.total_employees);
            if (!client.groupName && src.group_name && !/^\d+$/.test(String(src.group_name).trim())) client.groupName = txt(src.group_name);

            if (src.contact_name || src.email) {
                if (!Array.isArray(client.contacts)) client.contacts = [];
                const primary = client.contacts[0] || { name: '', email: '', phone: '', role: 'Primary Contact' };
                if (!primary.name && src.contact_name) primary.name = txt(src.contact_name);
                if (!primary.email && src.email) primary.email = S.sanitizeEmail(String(src.email).trim());
                if (!primary.role && !primary.designation) primary.role = 'Primary Contact';
                client.contacts[0] = primary;
            }
            // No website on either side: derive it from the company email domain
            // (skipped for free mailbox providers such as hotmail/gmail).
            if (!client.website) {
                const derived = websiteFromEmail(src.email || (client.contacts && client.contacts[0] && client.contacts[0].email));
                if (derived) client.website = derived;
            }

            const certAddress = (certs.find(c => c && c.address) || {}).address;
            const address = src.address || certAddress;
            if (address || src.country) {
                if (!Array.isArray(client.sites)) client.sites = [];
                const office = client.sites[0] || { name: 'Head Office', address: '', city: '', country: '', employees: 0 };
                if (!office.name) office.name = 'Head Office';
                if (!office.address && address) office.address = txt(address);
                if (!office.country && src.country) office.country = txt(src.country);
                if (!positiveInt(office.employees) && positiveInt(src.total_employees)) office.employees = positiveInt(src.total_employees);
                client.sites[0] = office;
            }
            const siteName = (client.sites && client.sites[0] && client.sites[0].name) || 'Head Office';

            // Certificates: the registry is the record of truth, refreshed every import.
            if (!Array.isArray(client.certificates)) client.certificates = [];
            // Existing entries go through the mapper too, so a client that was imported
            // before the label mapping existed ("ISO 9001-Quality Management") heals to
            // the canonical name instead of keeping both spellings.
            const stds = new Set((client.standard || '').split(',').map(s => mapCciStandard(s)).filter(Boolean));
            certs.forEach((cert, i) => {
                if (!cert) return;
                const std = mapCciStandard(cert.applicable_standard);
                const certNo = cleanCciText(cert.certificate_no);
                if (!std && !certNo) return;
                if (std) stds.add(std);
                let existing = client.certificates.find(c =>
                    (certNo && c.certificateNo === certNo) || (!certNo && std && c.standard === std));
                if (!existing) {
                    existing = { id: 'CERT-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '-' + i, revision: '00', siteScopes: {} };
                    client.certificates.push(existing);
                }
                existing.standard = std || existing.standard;
                existing.certificateNo = certNo || existing.certificateNo;
                existing.status = mapCciStatus(cert.validity_status, cert.issue_end_date, now);
                existing.initialDate = cert.registration_date || existing.initialDate || '';
                existing.currentIssue = cert.current_issue_date || existing.currentIssue || '';
                existing.expiryDate = cert.issue_end_date || existing.expiryDate || '';
                // Scope is stored raw like the Settings editor does (updateSiteScope), not HTML-escaped.
                const scope = cleanCciText(cert.scope || cert.body);
                if (scope) {
                    existing.scope = scope;
                    if (!existing.siteScopes) existing.siteScopes = {};
                    existing.siteScopes[siteName] = scope;
                }
                if (cert.applicable_standard) existing.cciLabel = cleanCciText(cert.applicable_standard);
                if (cert !== src && cert.id) existing.cciCertificateId = cert.id;
                if (cert.url_path && /^\/[a-z0-9\-_/.]+$/i.test(String(cert.url_path))) existing.registryUrl = 'https://companycertification.com' + cert.url_path;
                existing.client = client.name;
                certCount++;
            });
            if (stds.size) client.standard = Array.from(stds).join(', ');
            // Site standards heal the same way (identity for canonical or custom names).
            (client.sites || []).forEach(site => {
                if (site && site.standards) site.standards = String(site.standards).split(',').map(s => mapCciStandard(s)).filter(Boolean).join(', ');
            });
            // The head office carries the standards so the per-site scope annex renders.
            if (client.sites && client.sites[0] && !client.sites[0].standards && client.standard) client.sites[0].standards = client.standard;
            touched.push(client);
        });

        window.saveData();
        window.showNotification(`CCI Import: ${imported} clients created, ${updated} updated, ${certCount} certificates, ${skippedInactive} inactive skipped`, 'success');

        // Push to cloud (client jsonb + individual certificates)
        if (window.SupabaseClient?.isInitialized) {
            touched.forEach(client => {
                window.DataService.syncClient(client, { saveLocal: false, silent: true });
                (client.certificates || []).forEach(cert => {
                    window.SupabaseClient.upsertCertificate(cert).catch(err => console.error('Cert sync failed:', cert.certificateNo, err));
                });
            });
        }
        if (typeof window.renderClientsEnhanced === 'function') window.renderClientsEnhanced();
        return { imported, updated, certCount, skippedInactive };
    };

    window.openImportAccountSetupModal = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Import Account Setup',
            `
        <div style="text-align: center; margin-bottom: 2rem;">
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Upload a single Excel file containing multiple sheets to populate Sites, Departments, Designations, Personnel, Goods/Services, and Key Processes.
            </p>
            
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem;">
                <!-- Step 1: Download Template -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-file-excel" style="font-size: 2rem; color: #10b981; margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 1: Get Template</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Download valid Excel structure</p>
                    <button class="btn btn-outline-primary btn-sm" data-action="downloadAccountSetupTemplate" data-id="${window.UTILS.escapeHtml(client.name)}" aria-label="Download">
                        <i class="fa-solid fa-download"></i> Download Template
                    </button>
                </div>

                <!-- Step 2: Upload Data -->
                <div class="card" style="flex: 1; padding: 1.5rem; text-align: center; border: 1px dashed var(--primary-color);">
                    <i class="fa-solid fa-upload" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                    <h4 style="margin-bottom: 0.5rem;">Step 2: Upload File</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Select filled Excel file</p>
                    <label class="btn btn-primary btn-sm">
                        <input type="file" accept=".xlsx, .xls" style="display: none;" data-action-change="processAccountSetupImport" data-arg1="${clientId}" data-arg2="this">
                        <i class="fa-solid fa-folder-open"></i> Select File
                    </label>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; text-align: left; font-size: 0.9rem;">
                <strong>Included Sheets:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text-secondary);">
                    <li>Sites</li>
                    <li>Departments</li>
                    <li>Designations</li>
                    <li>Personnel</li>
                    <li>GoodsServices</li>
                    <li>KeyProcesses</li>
                </ul>
            </div>
        </div>
        `
        );
        // Hide default Save button
        document.getElementById('modal-save').style.display = 'none';
    };

    window.downloadAccountSetupTemplate = function (clientName) {
        const wb = XLSX.utils.book_new();

        // 1. Sites Sheet
        const sitesData = [
            ["Site Name", "Address", "City", "Country", "Employees", "Shift (Yes/No)", "Standards"],
            ["Head Office", "123 Main St", "New York", "USA", "50", "No", "ISO 9001:2015"],
            ["Factory 1", "456 Industrial Rd", "Chicago", "USA", "200", "Yes", "ISO 9001:2015, ISO 14001:2015"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sitesData), "Sites");

        // 2. Departments Sheet
        const deptsData = [
            ["Department Name", "Risk Level"],
            ["HR", "Low"],
            ["Production", "High"],
            ["Quality", "Medium"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptsData), "Departments");

        // 3. Designations Sheet
        const desigData = [
            ["Designation"],
            ["Manager"],
            ["Supervisor"],
            ["Operator"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desigData), "Designations");

        // 4. Personnel Sheet
        const personnelData = [
            ["Name", "Designation", "Email", "Phone", "Role"],
            ["John Doe", "Manager", "john@example.com", "555-0101", "Management Rep"],
            ["Jane Smith", "Supervisor", "jane@example.com", "555-0102", "Audit Contact"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(personnelData), "Personnel");

        // 5. Goods/Services Sheet
        const goodsData = [
            ["Name", "Category", "Description"],
            ["Widget A", "Product", "Main product line"],
            ["Consulting", "Service", "Technical consultancy"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goodsData), "GoodsServices");

        // 6. Key Processes Sheet
        const processData = [
            ["Process Name", "Category", "Owner"],
            ["Procurement", "Support", "Purchasing Manager"],
            ["Manufacturing", "Core", "Production Manager"],
            ["Sales", "Core", "Sales Director"]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(processData), "KeyProcesses");

        const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_Setup_Template.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    window.processAccountSetupImport = function (clientId, input) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied: Only Certification Managers or Admins can perform this action.', 'error');
            return;
        }

        const file = input.files[0];
        if (!file) return;

        window.closeModal(); // Close modal immediately to show notification
        window.showNotification(`Reading ${file.name}...`, 'info');

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const client = window.DataService.findClient(clientId);

                if (!client) throw new Error("Client not found");

                let log = { sites: 0, depts: 0, desig: 0, people: 0, goods: 0, procs: 0 };

                // Helper to clean string
                const clean = (val) => val ? String(val).trim() : '';

                // 1. Process Sites
                if (workbook.Sheets['Sites']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Sites']);
                    if (!client.sites) client.sites = [];
                    rows.forEach(r => {
                        client.sites.push({
                            name: clean(r['Site Name']),
                            address: clean(r['Address']),
                            city: clean(r['City']),
                            country: clean(r['Country']),
                            employees: parseInt(r['Employees'], 10) || 0,
                            shift: clean(r['Shift (Yes/No)']),
                            standards: clean(r['Standards'])
                        });
                    });
                    log.sites = rows.length;
                }

                // 2. Process Departments
                if (workbook.Sheets['Departments']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Departments']);
                    if (!client.departments) client.departments = [];
                    rows.forEach(r => {
                        const name = clean(r['Department Name']);
                        if (name && !client.departments.some(d => d.name === name)) {
                            client.departments.push({
                                name: name,
                                risk: clean(r['Risk Level']) || 'Medium',
                                head: '' // Not in template
                            });
                        }
                    });
                    log.depts = rows.length;
                }

                // 3. Process Designations
                if (workbook.Sheets['Designations']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Designations']);
                    if (!client.designations) client.designations = [];
                    rows.forEach(r => {
                        const desig = clean(r['Designation']);
                        if (desig && !client.designations.includes(desig)) {
                            client.designations.push(desig);
                        }
                    });
                    log.desig = rows.length;
                }

                // 4. Process Personnel
                if (workbook.Sheets['Personnel']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Personnel']);
                    if (!client.contacts) client.contacts = [];
                    rows.forEach(r => {
                        client.contacts.push({
                            name: clean(r['Name']),
                            designation: clean(r['Designation']),
                            email: clean(r['Email']),
                            phone: clean(r['Phone']),
                            role: clean(r['Role'])
                        });
                    });
                    log.people = rows.length;
                }

                // 5. Process Goods/Services
                if (workbook.Sheets['GoodsServices']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['GoodsServices']);
                    if (!client.goodsServices) client.goodsServices = [];
                    rows.forEach(r => {
                        client.goodsServices.push({
                            name: clean(r['Name']),
                            category: clean(r['Category']) || 'Product',
                            description: clean(r['Description'])
                        });
                    });
                    log.goods = rows.length;
                }

                // 6. Process Key Processes
                if (workbook.Sheets['KeyProcesses']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['KeyProcesses']);
                    if (!client.keyProcesses) client.keyProcesses = [];
                    rows.forEach(r => {
                        client.keyProcesses.push({
                            name: clean(r['Process Name']),
                            category: clean(r['Category']) || 'Core',
                            owner: clean(r['Owner'])
                        });
                    });
                    log.procs = rows.length;
                }

                window.saveData();
                renderClientDetail(clientId);
                window.showNotification(
                    `Import Complete: ${log.sites} Sites, ${log.depts} Depts, ${log.desig} Roles, ${log.people} Staff, ${log.goods} Goods, ${log.procs} Processes`,
                    'success'
                );

            } catch (err) {
                console.error('Import Error:', err);
                window.showNotification('Import Failed: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Exports
    window.renderClientsModule = window.renderClientsEnhanced;
    // Ensure other helpers are exposed if defined locally but used in HTML
    if (typeof openNewClientModal !== 'undefined') window.openNewClientModal = openNewClientModal;

    if (typeof initiateAuditPlanFromClient !== 'undefined') window.initiateAuditPlanFromClient = initiateAuditPlanFromClient;
    if (typeof renderClientDetail !== 'undefined') window.renderClientDetail = renderClientDetail;

    // Client Logo Upload Functions
    window._tempClientLogo = '';

    window.previewClientLogo = function (input) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            window.showNotification('Logo too large. Max 1MB', 'error');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            window._tempClientLogo = e.target.result;
            const preview = document.getElementById('client-logo-preview');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;">`;
            }
        };
        reader.readAsDataURL(file);
    };

    // ============================================
    // CLIENT DELETION & ARCHIVING
    // ============================================
    // Note: deleteClient and archiveClient functions are defined in clients-list-v16.js
    // which provides the enhanced implementation including Supabase cloud sync.

if (window.Logger) Logger.debug('Modules', 'clients-import.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { saveCertificateDetails, viewCertRevisionHistory, addCertRevision, deleteCertificationScope, switchClientOrgSubTab, downloadImportTemplate, importClientsFromExcel, openImportAccountSetupModal, downloadAccountSetupTemplate, processAccountSetupImport, openNewClientModal, initiateAuditPlanFromClient, renderClientDetail, previewClientLogo };
}

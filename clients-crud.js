// ============================================
// CLIENTS MODULE - CRUD Operations (ESM-ready)
// Extracted from clients-module.js for maintainability
// Contains: editSite, deleteSite, bulkUploadSites, editContact, deleteContact,
//   bulkUploadContacts, addDepartment, editDepartment, deleteDepartment,
//   bulkUploadDepartments, addGoodsService, editGoodsService, deleteGoodsService,
//   bulkUploadGoodsServices, addKeyProcess, editKeyProcess, deleteKeyProcess,
//   bulkUploadKeyProcesses, addClientDesignation, deleteClientDesignation,
//   bulkUploadDesignations, generateCompanyProfile, editCompanyProfile,
//   uploadCompanyProfileDoc, removeProfileDocument, initiateAuditPlanFromClient
// ============================================

    // Edit Site Modal
    window.editSite = function (clientId, siteIndex) {
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) return;
        const client = window.DataService.findClient(clientId);
        if (!client || !client.sites || !client.sites[siteIndex]) return;

        const site = client.sites[siteIndex];

        window.DataService.openFormModal('Edit Site Location', `
        <form id="site-form">
            <div class="form-group">
                <label>Site Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="site-name" value="${site.name}" required>
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" class="form-control" id="site-address" value="${site.address || ''}">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>City</label>
                    <input type="text" class="form-control" id="site-city" value="${site.city || ''}">
                </div>
                <div class="form-group">
                    <label>Country</label>
                    <input type="text" class="form-control" id="site-country" value="${site.country || ''}">
                </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); margin: 1rem 0; padding-top: 1rem;">
                <div class="form-group">
                    <label>Applicable Standards</label>
                    <select class="form-control" id="site-standards" multiple style="height: 100px;">
                        ${((window.state.cbSettings && window.state.cbSettings.standardsOffered) || ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022", "ISO 22000:2018", "ISO 50001:2018", "ISO 13485:2016"]).map(std =>
            `<option value="${std}" ${(site.standards || client.standard || '').includes(std) ? 'selected' : ''}>${std}</option>`
        ).join('')}
                    </select>
                    <small style="color: var(--text-secondary);">Hold Ctrl/Cmd to select multiple</small>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Employees</label>
                        <input type="number" class="form-control" id="site-employees" min="0" value="${site.employees || ''}">
                    </div>
                    <div class="form-group">
                        <label>Shift Work?</label>
                        <select class="form-control" id="site-shift">
                            <option value="" ${!site.shift ? 'selected' : ''}>-- Not specified --</option>
                            <option value="No" ${site.shift === 'No' ? 'selected' : ''}>No</option>
                            <option value="Yes" ${site.shift === 'Yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Geotag</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" class="form-control" id="site-geotag" value="${site.geotag || ''}">
                    <button type="button" class="btn btn-secondary" data-action="getGeolocation" data-id="site-geotag">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </button>
                </div>
            </div>
        </form >
    `, () => {
            const name = document.getElementById('site-name').value;
            const address = document.getElementById('site-address').value;
            const city = document.getElementById('site-city').value;
            const country = document.getElementById('site-country').value;
            const geotag = document.getElementById('site-geotag').value;
            const employees = parseInt(document.getElementById('site-employees').value, 10) || null;
            const shift = document.getElementById('site-shift').value || null;

            if (name) {
                const standards = Array.from(document.getElementById('site-standards').selectedOptions).map(o => o.value).join(', ');
                client.sites[siteIndex] = { ...site, name, address, city, country, geotag, employees, shift, standards };
                // Auto-sync: update company-level employees from sum of site employees
                const siteTotal = client.sites.reduce((sum, s) => sum + (parseInt(s.employees, 10) || 0), 0);
                if (siteTotal > 0) client.employees = siteTotal;
                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                renderClientDetail(clientId);
                window.showNotification('Site updated successfully');
            } else {
                window.showNotification('Site name is required', 'error');
            }
        });
    };

    // Delete Site
    window.deleteSite = function (clientId, siteIndex) {
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) return;
        const client = window.DataService.findClient(clientId);
        if (!client || !client.sites) return;

        window.DataService.confirmAction('Are you sure you want to delete this site?', () => {
            client.sites.splice(siteIndex, 1);
            window.saveData();

            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            renderClientDetail(clientId);
            window.showNotification('Site deleted');
        });
    };

    // Bulk Upload Sites
    window.bulkUploadSites = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Sites',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste site list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Site Name, Address, City, Country, Employees, Shift(Yes/No)<br>
                Main Factory, 123 Industrial Way, Mumbai, India, 150, Yes<br>
                Regional Office, 45 Business Park, Delhi, India, 30, No
            </p>
        </div>
        <form id="bulk-sites-form">
            <div class="form-group">
                <label>Site List (CSV Format)</label>
                <textarea id="sites-bulk-data" rows="10" placeholder="Factory A, Address 1, City, Country, 100, Yes" style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="sites-replace" style="width: auto;">
                    Replace existing sites (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('sites-bulk-data').value.trim();
                const replace = document.getElementById('sites-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter site data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newSites = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newSites.push({
                            name: parts[0],
                            address: parts[1] || '',
                            city: parts[2] || '',
                            country: parts[3] || '',
                            employees: parseInt(parts[4], 10) || 0,
                            shift: parts[5]?.toLowerCase() === 'yes' ? 'Yes' : 'No',
                            standards: client.standard || ''
                        });
                    } else {
                        errors++;
                    }
                });

                if (newSites.length === 0) {
                    window.showNotification('No valid sites found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.sites = newSites;
                } else {
                    if (!client.sites) client.sites = [];
                    client.sites.push(...newSites);
                }

                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                renderClientDetail(clientId);
                window.setSetupWizardStep(clientId, 2);

                const message = `${newSites.length} site(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    };


    // Edit Contact Modal
    window.editContact = function (clientId, contactIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.contacts || !client.contacts[contactIndex]) return;

        const contact = client.contacts[contactIndex];

        window.DataService.openFormModal('Edit Contact Person', `
        <form id="contact-form">
            <div class="form-group">
                <label>Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="contact-name" value="${contact.name}" required>
            </div>
            <div class="form-group">
                <label>Designation</label>
                <input type="text" class="form-control" id="contact-designation" value="${contact.designation || ''}">
            </div>
            <div class="form-group">
                <label>Phone</label>
                <input type="text" class="form-control" id="contact-phone" value="${contact.phone || ''}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="contact-email" value="${contact.email || ''}">
            </div>
        </form >
    `, () => {
            const name = document.getElementById('contact-name').value;
            const designation = document.getElementById('contact-designation').value;
            const phone = document.getElementById('contact-phone').value;
            const email = document.getElementById('contact-email').value;

            if (name) {
                client.contacts[contactIndex] = { ...contact, name, designation, phone, email };
                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                renderClientDetail(clientId);
                window.showNotification('Contact updated successfully');
            } else {
                window.showNotification('Name is required', 'error');
            }
        });
    };

    // Delete Contact
    window.deleteContact = function (clientId, contactIndex) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.contacts) return;

        window.DataService.confirmAction('Are you sure you want to delete this contact?', () => {
            client.contacts.splice(contactIndex, 1);
            window.saveData();

            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            renderClientDetail(clientId);
            window.showNotification('Contact deleted');
        });
    };

    // Bulk Upload Contacts/Personnel
    window.bulkUploadContacts = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Personnel',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste contact list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Name, Designation, Email, Phone<br>
                John Doe, QA Manager, john@company.com, +1234567890<br>
                Jane Smith, HR Director, jane@company.com, +0987654321
            </p>
        </div>
        <form id="bulk-contacts-form">
            <div class="form-group">
                <label>Contact List (CSV Format)</label>
                <textarea id="contacts-bulk-data" rows="10" placeholder="John Doe, QA Manager, john@company.com, +1234567890
Jane Smith, HR Director, jane@company.com, +0987654321
Bob Johnson, Production Head, bob@company.com," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="contacts-replace" style="width: auto;">
                    Replace existing contacts (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('contacts-bulk-data').value.trim();
                const replace = document.getElementById('contacts-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter contact data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newContacts = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newContacts.push({
                            name: parts[0],
                            designation: parts[1] || '',
                            email: parts[2] || '',
                            phone: parts[3] || ''
                        });
                    } else {
                        errors++;
                    }
                });

                if (newContacts.length === 0) {
                    window.showNotification('No valid contacts found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.contacts = newContacts;
                } else {
                    if (!client.contacts) client.contacts = [];
                    client.contacts.push(...newContacts);
                }

                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                window.setSetupWizardStep(clientId, 5);

                const message = `${newContacts.length} contact(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    };

    // Helper function to initiate audit planning from client detail page
    // Helper function to initiate audit planning from client detail page
    window.initiateAuditPlanFromClient = function (clientId) {
        // Navigate to Audit Planning module
        window.renderModule('planning');

        const client = window.state.clients.find(c => c.id === clientId);
        const clientName = client ? client.name : '';

        if (!clientName) return;

        // Use a short timeout to ensure the planning module scripts/DOM are ready if needed,
        // though typically renderModule is synchronous for the shell.
        // We then render the create form directly.
        setTimeout(() => {
            if (typeof window.renderCreateAuditPlanForm === 'function') {
                window.renderCreateAuditPlanForm(clientName);
            } else {
                console.error('renderCreateAuditPlanForm function not found');
            }
        }, 100);
    };

    // Department Management Functions
    function addDepartment(clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        window.openModal(
            'Add Department',
            `
        <form id="dept-form">
            <div class="form-group">
                <label>Department Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" id="dept-name" placeholder="e.g., Quality Assurance" required>
            </div>
            <div class="form-group">
                <label>Head of Department</label>
                <input type="text" id="dept-head" placeholder="e.g., John Doe">
            </div>
        </form >
    `,
            () => {
                const name = document.getElementById('dept-name').value.trim();
                if (!name) {
                    window.showNotification('Department name is required', 'error');
                    return;
                }

                const department = {
                    name,
                    head: document.getElementById('dept-head').value.trim()
                };

                if (!client.departments) client.departments = [];
                client.departments.push(department);

                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                if (document.getElementById('tab-organization')) {
                    const ul = document.querySelector('#tab-organization .card:first-child ul') || document.querySelector('#tab-organization ul');
                    if (ul) {
                        ul.innerHTML = (client.departments || []).map(dept => `
                        <li style="padding: 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <span>${typeof dept === 'object' ? (dept.name || 'Unnamed') : dept}</span>
                            <span style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></span>
                        </li>
                     `).join('');
                    }
                } else {
                    renderClientTab(client, 'client_org');
                }
                window.showNotification('Department added successfully');
            }
        );
    }

    function editDepartment(clientId, deptIndex) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const dept = client.departments[deptIndex];

        window.openModal(
            'Edit Department',
            `
        <form id="dept-form">
            <div class="form-group">
                <label>Department Name <span style="color: var(--danger-color);">*</span></label>
                <input type="text" id="dept-name" value="${dept.name}" required>
            </div>
            <div class="form-group">
                <label>Head of Department</label>
                <input type="text" id="dept-head" value="${dept.head || ''}">
            </div>
        </form >
    `,
            () => {
                const name = document.getElementById('dept-name').value.trim();
                if (!name) {
                    window.showNotification('Department name is required', 'error');
                    return;
                }

                client.departments[deptIndex] = {
                    name,
                    head: document.getElementById('dept-head').value.trim()
                };

                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                renderClientDetail(clientId);
                renderClientTab(client, 'departments');
                window.showNotification('Department updated successfully');
            }
        );
    }

    function deleteDepartment(clientId, deptIndex) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const dept = client.departments[deptIndex];

        window.DataService.confirmAction(`Are you sure you want to delete the department "${dept.name}" ? `, () => {
            client.departments.splice(deptIndex, 1);
            window.saveData();

            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            renderClientDetail(clientId);
            renderClientTab(client, 'departments');
            window.showNotification('Department deleted successfully');
        });
    }

    function bulkUploadDepartments(clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Departments',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste department list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Department Name, Head of Department<br>
                Quality Assurance, John Doe<br>
                Production, Jane Smith<br>
                Human Resources, Bob Johnson
            </p>
        </div>
        <form id="bulk-dept-form">
            <div class="form-group">
                <label>Department List (CSV Format)</label>
                <textarea id="dept-bulk-data" rows="10" placeholder="Quality Assurance, John Doe, 15
Production, Jane Smith, 50
Human Resources, Bob Johnson, 8" style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="dept-replace" style="width: auto;">
                    Replace existing departments (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('dept-bulk-data').value.trim();
                const replace = document.getElementById('dept-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter department data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newDepartments = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newDepartments.push({
                            name: parts[0],
                            head: parts[1] || '',
                            employeeCount: parseInt(parts[2], 10) || 0
                        });
                    } else {
                        errors++;
                    }
                });

                if (newDepartments.length === 0) {
                    window.showNotification('No valid departments found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.departments = newDepartments;
                } else {
                    if (!client.departments) client.departments = [];
                    client.departments.push(...newDepartments);
                }

                window.saveData();

                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                window.setSetupWizardStep(clientId, 3);


                const message = `${newDepartments.length} department(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    }

    // Export department functions
    window.addDepartment = addDepartment;
    window.editDepartment = editDepartment;
    window.deleteDepartment = deleteDepartment;
    window.bulkUploadDepartments = bulkUploadDepartments;

    // ============================================
    // GOODS/SERVICES CRUD FUNCTIONS
    // ============================================
    window.addGoodsService = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal('Add Goods/Service', `
        <form id="goods-form">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" id="goods-name" required placeholder="e.g., Industrial Components">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="goods-category">
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="goods-desc" rows="3" placeholder="Brief description..."></textarea>
            </div>
        </form>
    `, () => {
            const name = document.getElementById('goods-name').value.trim();
            if (!name) { window.showNotification('Name is required', 'error'); return; }
            if (!client.goodsServices) client.goodsServices = [];
            client.goodsServices.push({ name, category: document.getElementById('goods-category').value, description: document.getElementById('goods-desc').value.trim() });
            window.saveData();
            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            window.closeModal();
            window.setSetupWizardStep(clientId, 6);
            window.showNotification('Goods/Service added');
        });
    };

    window.editGoodsService = function (clientId, index) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.goodsServices || !client.goodsServices[index]) return;
        const item = client.goodsServices[index];
        window.openModal('Edit Goods/Service', `
        <form id="goods-form">
            <div class="form-group"><label>Name *</label><input type="text" id="goods-name" value="${window.UTILS.escapeHtml(item.name)}" required></div>
            <div class="form-group"><label>Category</label><select id="goods-category"><option value="Product" ${item.category === 'Product' ? 'selected' : ''}>Product</option><option value="Service" ${item.category === 'Service' ? 'selected' : ''}>Service</option></select></div>
            <div class="form-group"><label>Description</label><textarea id="goods-desc" rows="3">${window.UTILS.escapeHtml(item.description || '')}</textarea></div>
        </form>
    `, () => {
            client.goodsServices[index] = { name: document.getElementById('goods-name').value.trim(), category: document.getElementById('goods-category').value, description: document.getElementById('goods-desc').value.trim() };
            window.saveData(); window.closeModal(); window.setSetupWizardStep(clientId, 6);
            window.showNotification('Goods/Service updated');
        });
    };

    window.deleteGoodsService = function (clientId, index) {
        window.DataService.confirmAction('Delete this item?', () => {
            const client = window.DataService.findClient(clientId);
            if (client && client.goodsServices) {
                client.goodsServices.splice(index, 1);
                window.saveData();
                // Sync to Supabase
                if (window.SupabaseClient?.isInitialized) {
                    window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
                }
                window.setSetupWizardStep(clientId, 6);
                window.showNotification('Goods/Service deleted');
            }
        });
    };

    // Bulk Upload Goods/Services
    window.bulkUploadGoodsServices = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Goods & Services',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste goods/services list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Name, Category, Description<br>
                Steel Components, Goods, High-grade steel parts<br>
                Consulting Services, Services, ISO implementation support<br>
                Machined Parts, Goods, Precision CNC components
            </p>
        </div>
        <form id="bulk-goods-form">
            <div class="form-group">
                <label>Goods/Services List (CSV Format)</label>
                <textarea id="goods-bulk-data" rows="10" placeholder="Steel Components, Goods, High-grade steel parts
Consulting Services, Services, ISO implementation support
Machined Parts, Goods, Precision CNC components" style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="goods-replace" style="width: auto;">
                    Replace existing items (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('goods-bulk-data').value.trim();
                const replace = document.getElementById('goods-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter goods/services data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newItems = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newItems.push({
                            name: parts[0],
                            category: parts[1] || 'Goods',
                            description: parts[2] || ''
                        });
                    } else {
                        errors++;
                    }
                });

                if (newItems.length === 0) {
                    window.showNotification('No valid items found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.goodsServices = newItems;
                } else {
                    if (!client.goodsServices) client.goodsServices = [];
                    client.goodsServices.push(...newItems);
                }

                window.saveData();
                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                window.setSetupWizardStep(clientId, 6);

                const message = `${newItems.length} item(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    };

    // ============================================
    // KEY PROCESSES CRUD FUNCTIONS
    // ============================================
    window.addKeyProcess = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;
        window.openModal('Add Key Process', `
        <form id="process-form">
            <div class="form-group"><label>Process Name *</label><input type="text" id="process-name" required placeholder="e.g., Production Planning"></div>
            <div class="form-group"><label>Category</label><select id="process-category"><option value="Core">Core Process</option><option value="Support">Support Process</option></select></div>
            <div class="form-group"><label>Process Owner</label><input type="text" id="process-owner" placeholder="e.g., Operations Manager"></div>
        </form>
    `, () => {
            const name = document.getElementById('process-name').value.trim();
            if (!name) { window.showNotification('Process name is required', 'error'); return; }
            if (!client.keyProcesses) client.keyProcesses = [];
            client.keyProcesses.push({ name, category: document.getElementById('process-category').value, owner: document.getElementById('process-owner').value.trim() });
            window.saveData();
            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            window.closeModal();
            window.setSetupWizardStep(clientId, 7);
            window.showNotification('Process added');
        });
    };

    window.editKeyProcess = function (clientId, index) {
        const client = window.DataService.findClient(clientId);
        if (!client || !client.keyProcesses || !client.keyProcesses[index]) return;
        const proc = client.keyProcesses[index];
        window.openModal('Edit Key Process', `
        <form id="process-form">
            <div class="form-group"><label>Process Name *</label><input type="text" id="process-name" value="${window.UTILS.escapeHtml(proc.name)}" required></div>
            <div class="form-group"><label>Category</label><select id="process-category"><option value="Core" ${proc.category === 'Core' ? 'selected' : ''}>Core Process</option><option value="Support" ${proc.category === 'Support' ? 'selected' : ''}>Support Process</option></select></div>
            <div class="form-group"><label>Process Owner</label><input type="text" id="process-owner" value="${window.UTILS.escapeHtml(proc.owner || '')}"></div>
        </form>
    `, () => {
            client.keyProcesses[index] = { name: document.getElementById('process-name').value.trim(), category: document.getElementById('process-category').value, owner: document.getElementById('process-owner').value.trim() };
            window.saveData();
            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            window.closeModal();
            window.setSetupWizardStep(clientId, 7);
            window.showNotification('Process updated');
        });
    };

    window.deleteKeyProcess = function (clientId, index) {
        window.DataService.confirmAction('Delete this process?', () => {
            const client = window.DataService.findClient(clientId);
            if (client && client.keyProcesses) {
                client.keyProcesses.splice(index, 1);
                window.saveData();
                // Sync to Supabase
                if (window.SupabaseClient?.isInitialized) {
                    window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
                }
                window.setSetupWizardStep(clientId, 7);
                window.showNotification('Process deleted');
            }
        });
    };

    // Bulk Upload Key Processes
    window.bulkUploadKeyProcesses = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Key Processes',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste process list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Process Name, Category, Owner<br>
                Production Planning, Core, John Doe<br>
                Quality Control, Core, Jane Smith<br>
                Maintenance, Support, Bob Johnson
            </p>
        </div>
        <form id="bulk-process-form">
            <div class="form-group">
                <label>Process List (CSV Format)</label>
                <textarea id="process-bulk-data" rows="10" placeholder="Production Planning, Core, John Doe
Quality Control, Core, Jane Smith
Maintenance, Support, Bob Johnson
HR Management, Support," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="process-replace" style="width: auto;">
                    Replace existing processes (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('process-bulk-data').value.trim();
                const replace = document.getElementById('process-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter process data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newProcesses = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newProcesses.push({
                            name: parts[0],
                            category: parts[1] || 'Support',
                            owner: parts[2] || ''
                        });
                    } else {
                        errors++;
                    }
                });

                if (newProcesses.length === 0) {
                    window.showNotification('No valid processes found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.keyProcesses = newProcesses;
                } else {
                    if (!client.keyProcesses) client.keyProcesses = [];
                    client.keyProcesses.push(...newProcesses);
                }

                window.saveData();
                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                window.setSetupWizardStep(clientId, 7);

                const message = `${newProcesses.length} process(es) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    };

    // ============================================
    // DESIGNATIONS CRUD FUNCTIONS
    // ============================================
    window.addClientDesignation = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;
        const deptOptions = (client.departments || []).map(d => `<option value="${window.UTILS.escapeHtml(d.name)}">${window.UTILS.escapeHtml(d.name)}</option>`).join('');
        window.openModal('Add Designation', `
        <form id="des-form">
            <div class="form-group"><label>Job Title *</label><input type="text" id="des-title" required placeholder="e.g., Quality Manager"></div>
            <div class="form-group"><label>Department (Optional)</label><select id="des-dept"><option value="">-- Not Assigned --</option>${deptOptions}</select></div>
        </form>
    `, () => {
            const title = document.getElementById('des-title').value.trim();
            if (!title) { window.showNotification('Job title is required', 'error'); return; }
            if (!client.designations) client.designations = [];
            client.designations.push({ title, department: document.getElementById('des-dept').value });
            window.saveData();
            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            window.closeModal();
            window.setSetupWizardStep(clientId, 4);
            if (document.getElementById('tab-organization')) {
                const ul = document.querySelector('#tab-organization .card:nth-child(2) ul');
                if (ul) {
                    const designations = Array.from(new Set([
                        ...(client.designations || []).map(d => d.title || d),
                        ...(client.contacts || []).map(c => c.designation)
                    ].filter(Boolean)));
                    ul.innerHTML = designations.map(desig => `
                    <li style="padding: 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <span>${desig}</span>
                        <span style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer;"><i class="fa-solid fa-pen"></i></span>
                    </li>
                 `).join('');
                }
            } else {
                renderClientTab(client, 'client_org');
            }
            window.showNotification('Designation added');
        });
    };

    window.deleteClientDesignation = function (clientId, index) {
        if (!confirm('Delete this designation?')) return;
        const client = window.DataService.findClient(clientId);
        if (client && client.designations) {
            client.designations.splice(index, 1);
            window.saveData();
            // Sync to Supabase
            if (window.SupabaseClient?.isInitialized) {
                window.SupabaseClient.upsertClient(client).catch(err => console.error('Supabase sync failed:', err));
            }
            window.setSetupWizardStep(clientId, 4);
            window.showNotification('Designation deleted');
        }
    };

    // Bulk Upload Designations
    window.bulkUploadDesignations = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        window.openModal(
            'Bulk Upload Designations',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                <i class="fa-solid fa-info-circle"></i> Paste designation list in CSV format (one per line):
            </p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; background: #f8fafc; padding: 0.5rem; border-radius: 4px;">
                Designation Title, Department<br>
                QA Manager, Quality Assurance<br>
                Production Head, Production<br>
                HR Officer, Human Resources
            </p>
        </div>
        <form id="bulk-designation-form">
            <div class="form-group">
                <label>Designation List (CSV Format)</label>
                <textarea id="designation-bulk-data" rows="10" placeholder="QA Manager, Quality Assurance
Production Head, Production
HR Officer, Human Resources
CEO,
CFO," style="font-family: monospace;"></textarea>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal;">
                    <input type="checkbox" id="designation-replace" style="width: auto;">
                    Replace existing designations (otherwise, append to existing list)
                </label>
            </div>
        </form>
        `,
            () => {
                const bulkData = document.getElementById('designation-bulk-data').value.trim();
                const replace = document.getElementById('designation-replace').checked;

                if (!bulkData) {
                    window.showNotification('Please enter designation data', 'error');
                    return;
                }

                const lines = bulkData.split('\n').filter(line => line.trim());
                const newDesignations = [];
                let errors = 0;

                lines.forEach((line, _index) => {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 1 && parts[0]) {
                        newDesignations.push({
                            title: parts[0],
                            department: parts[1] || ''
                        });
                    } else {
                        errors++;
                    }
                });

                if (newDesignations.length === 0) {
                    window.showNotification('No valid designations found in the data', 'error');
                    return;
                }

                if (replace) {
                    client.designations = newDesignations;
                } else {
                    if (!client.designations) client.designations = [];
                    client.designations.push(...newDesignations);
                }

                window.saveData();
                // Sync to Supabase
                window.DataService.syncClient(client, { saveLocal: false });
                window.closeModal();
                window.setSetupWizardStep(clientId, 4);

                const message = `${newDesignations.length} designation(s) ${replace ? 'uploaded' : 'added'}${errors > 0 ? ` (${errors} line(s) skipped)` : ''}`;
                window.showNotification(message);
            }
        );
    };

    // Company Profile Functions
    function generateCompanyProfile(clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client || !client.website) {
            window.showNotification('Website URL is required for AI generation', 'error');
            return;
        }

        // Show loading notification
        window.showNotification('Generating company profile from website...', 'info');

        // Simulated AI generation (in production, this would call an API)
        setTimeout(() => {
            // Save previous version to history
            if (client.profile) {
                if (!client.profileHistory) client.profileHistory = [];
                client.profileHistory.push({
                    content: client.profile,
                    updatedAt: client.profileUpdated || new Date().toISOString(),
                    updatedBy: 'System',
                    method: 'Manual'
                });
            }

            // Generate a professional company profile based on available data
            const parts = [];

            parts.push(`${client.name} - Company Overview`);
            parts.push(`\nIndustry: ${client.industry || 'Not specified'}`);
            parts.push(`Website: ${client.website}`);
            parts.push(`\nAbout the Organization:`);
            parts.push(`${client.name} is a ${client.industry || 'professional'} organization ${client.employees ? `with approximately ${client.employees} employees` : ''} ${client.sites && client.sites.length > 1 ? `operating across ${client.sites.length} locations` : 'operating from a single location'}.`);

            if (client.standard) {
                parts.push(`\nThe organization maintains certification to ${client.standard} standards, demonstrating its commitment to quality management and continuous improvement.`);
            }

            if (client.sites && client.sites.length > 0) {
                parts.push(`\nOperational Locations:`);
                client.sites.forEach(s => {
                    parts.push(`• ${s.name}${s.city ? ` - ${s.city}` : ''}${s.employees ? ` (${s.employees} employees)` : ''}`);
                });
            }

            if (client.departments && client.departments.length > 0) {
                parts.push(`\nKey Departments:`);
                client.departments.forEach(d => {
                    parts.push(`• ${d.name}${d.head ? ` - Led by ${d.head}` : ''}${d.employeeCount ? ` (${d.employeeCount} staff)` : ''}`);
                });
            }

            if (client.shifts === 'Yes') {
                parts.push(`\nThe organization operates multiple shifts to ensure continuous operations and meet customer demands.`);
            }

            parts.push(`\nThis profile provides context for audit activities and helps auditors understand the organizational structure and scope of operations.`);
            parts.push(`\n---`);
            parts.push(`Note: This profile was AI-generated from available client data. Please review and edit as needed to ensure accuracy.`);

            const profile = parts.join('\n');

            // Save the generated profile
            client.profile = profile;
            client.profileUpdated = new Date().toISOString();

            // ============================================
            // AI-GENERATE GOODS/SERVICES (Based on Industry)
            // ============================================
            const industryGoods = {
                'Manufacturing': [
                    { name: 'Industrial Components', category: 'Product', description: 'Manufacturing of precision components' },
                    { name: 'Assembly Services', category: 'Service', description: 'Product assembly and integration' },
                    { name: 'Custom Fabrication', category: 'Product', description: 'Custom metal/plastic fabrication' }
                ],
                'IT Services': [
                    { name: 'Software Development', category: 'Service', description: 'Custom software solutions' },
                    { name: 'Cloud Services', category: 'Service', description: 'Cloud infrastructure and hosting' },
                    { name: 'IT Support', category: 'Service', description: 'Technical support and maintenance' }
                ],
                'Healthcare': [
                    { name: 'Medical Devices', category: 'Product', description: 'Healthcare equipment and devices' },
                    { name: 'Patient Care', category: 'Service', description: 'Clinical and patient care services' },
                    { name: 'Laboratory Services', category: 'Service', description: 'Diagnostic and testing services' }
                ],
                'Food Processing': [
                    { name: 'Processed Foods', category: 'Product', description: 'Ready-to-eat food products' },
                    { name: 'Raw Materials', category: 'Product', description: 'Agricultural inputs and ingredients' },
                    { name: 'Packaging Services', category: 'Service', description: 'Food packaging and labeling' }
                ],
                'default': [
                    { name: 'Primary Product/Service', category: 'Product', description: 'Main offering - please update' },
                    { name: 'Secondary Service', category: 'Service', description: 'Support service - please update' }
                ]
            };
            client.goodsServices = industryGoods[client.industry] || industryGoods['default'];

            // ============================================
            // AI-GENERATE KEY PROCESSES
            // ============================================
            const industryProcesses = {
                'Manufacturing': [
                    { name: 'Design & Development', category: 'Core', owner: '' },
                    { name: 'Production Planning', category: 'Core', owner: '' },
                    { name: 'Manufacturing Operations', category: 'Core', owner: '' },
                    { name: 'Quality Control', category: 'Core', owner: '' },
                    { name: 'Procurement', category: 'Support', owner: '' },
                    { name: 'Warehouse & Logistics', category: 'Support', owner: '' }
                ],
                'IT Services': [
                    { name: 'Requirements Analysis', category: 'Core', owner: '' },
                    { name: 'Software Development', category: 'Core', owner: '' },
                    { name: 'Testing & QA', category: 'Core', owner: '' },
                    { name: 'Deployment & Release', category: 'Core', owner: '' },
                    { name: 'Customer Support', category: 'Support', owner: '' },
                    { name: 'Infrastructure Management', category: 'Support', owner: '' }
                ],
                'default': [
                    { name: 'Order Management', category: 'Core', owner: '' },
                    { name: 'Service Delivery', category: 'Core', owner: '' },
                    { name: 'Quality Assurance', category: 'Core', owner: '' },
                    { name: 'Human Resources', category: 'Support', owner: '' },
                    { name: 'Finance & Administration', category: 'Support', owner: '' }
                ]
            };
            client.keyProcesses = industryProcesses[client.industry] || industryProcesses['default'];

            // ============================================
            // AI-GENERATE COMMON DESIGNATIONS
            // ============================================
            client.designations = client.designations || [];
            if (client.designations.length === 0) {
                client.designations = [
                    { title: 'Managing Director', department: '' },
                    { title: 'Quality Manager', department: 'Quality' },
                    { title: 'Operations Manager', department: 'Operations' },
                    { title: 'HR Manager', department: 'Human Resources' },
                    { title: 'Management Representative (MR)', department: '' }
                ];
            }

            window.saveData();
            renderClientDetail(clientId);
            window.setSetupWizardStep(clientId, 1);
            window.showNotification('Organization data generated successfully! Review Goods/Services and Key Processes.', 'success');
        }, 1500); // Simulate API delay
    }

    function editCompanyProfile(clientId) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied', 'error');
            return;
        }

        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        const currentProfile = client.profile || '';

        window.openModal(
            'Edit Company Profile',
            `
        <div style="margin-bottom: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-solid fa-info-circle"></i> Write a comprehensive overview of the organization. This will be included in audit reports.
            </p>
        </div>
        <form id="profile-form">
            <div class="form-group">
                <label>Company Profile / Organization Overview</label>
                <textarea id="profile-text" rows="15" placeholder="Enter company profile, including:
- Company background and history
- Industry and market position
- Products/services offered
- Organizational structure
- Key operational locations
- Management system certifications
- Quality objectives and commitments">${currentProfile}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                <div><i class="fa-solid fa-lightbulb"></i> Be concise but comprehensive</div>
                <div><i class="fa-solid fa-check"></i> Focus on audit-relevant information</div>
            </div>
        </form>
        `,
            () => {
                const profileText = document.getElementById('profile-text').value.trim();

                client.profile = profileText;
                client.profileUpdated = new Date().toISOString();

                window.saveData();
                window.closeModal();
                renderClientDetail(clientId);
                renderClientTab(client, 'profile');
                window.showNotification('Company profile updated successfully');
            }
        );
    }

    // Export department functions
    window.addDepartment = addDepartment;
    window.editDepartment = editDepartment;
    window.deleteDepartment = deleteDepartment;
    window.bulkUploadDepartments = bulkUploadDepartments;

    // Export profile functions
    window.generateCompanyProfile = generateCompanyProfile;
    window.editCompanyProfile = editCompanyProfile;

    // Upload Company Profile Document
    window.uploadCompanyProfileDoc = async function (clientId, file) {
        // RBAC Check
        if (!window.AuthManager || !window.AuthManager.canPerform('create', 'client')) {
            window.showNotification('Access Denied', 'error');
            return;
        }

        if (!file) return;

        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
            window.showNotification('Please upload a PDF, Word document, or text file', 'error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            window.showNotification('File size must be less than 10MB', 'error');
            return;
        }

        window.showNotification('Processing document...', 'info');

        try {
            // Read file content
            const reader = new FileReader();
            reader.onload = async function (e) {
                const fileContent = e.target.result;

                // Store document metadata
                client.profileDocument = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                };

                // For text files, extract content directly
                if (file.type === 'text/plain') {
                    client.profileDocumentText = fileContent;
                } else {
                    // For PDF/DOC, store base64 and note that text extraction may be limited
                    client.profileDocumentBase64 = fileContent.split(',')[1]; // Remove data URL prefix
                    client.profileDocumentText = `[Content from uploaded document: ${file.name}]\n\nNote: For best results, please use the "Edit Manually" option to paste the key information from your company profile document, or use "AI Generate" if you have a website configured.`;
                }

                window.saveData();

                // Refresh the view
                if (window.setSetupWizardStep) {
                    window.setSetupWizardStep(clientId, 1);
                } else {
                    renderClientDetail(clientId);
                }

                window.showNotification(`Document "${file.name}" uploaded successfully! You can now use AI Generate to create a profile summary.`, 'success');
            };

            if (file.type === 'text/plain') {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            window.showNotification('Error uploading document. Please try again.', 'error');
        }
    };

    // Remove Profile Document
    window.removeProfileDocument = function (clientId) {
        const client = window.state.clients.find(c => c.id === clientId);
        if (!client) return;

        if (confirm('Are you sure you want to remove the uploaded document?')) {
            delete client.profileDocument;
            delete client.profileDocumentText;
            delete client.profileDocumentBase64;

            window.saveData();

            // Refresh the view
            if (window.setSetupWizardStep) {
                window.setSetupWizardStep(clientId, 1);
            } else {
                renderClientDetail(clientId);
            }

            window.showNotification('Document removed', 'success');
        }
    };

if (window.Logger) Logger.debug('Modules', 'clients-crud.js loaded successfully.');

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { editSite, deleteSite, bulkUploadSites, editContact, deleteContact, bulkUploadContacts, initiateAuditPlanFromClient, addDepartment, editDepartment, deleteDepartment, bulkUploadDepartments, addGoodsService, editGoodsService, deleteGoodsService, bulkUploadGoodsServices, addKeyProcess, editKeyProcess, deleteKeyProcess, bulkUploadKeyProcesses, addClientDesignation, deleteClientDesignation, bulkUploadDesignations, generateCompanyProfile, editCompanyProfile, removeProfileDocument };
}

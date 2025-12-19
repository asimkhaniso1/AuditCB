// ============================================
// AUDITCB360 - MAIN APPLICATION SCRIPT
// ============================================

// Application State
const state = {
    currentModule: 'dashboard',
    clients: [
        {
            id: 1,
            name: 'Tech Solutions Ltd',
            standard: 'ISO 9001:2015',
            status: 'Active',
            nextAudit: '2024-03-15',
            contactPerson: 'Alice Whitman',
            email: 'alice@techsolutions.com',
            phone: '+1-555-0101',
            address: '123 Tech Park',
            city: 'Silicon Valley',
            country: 'USA',
            employees: 150,
            sites: 2,
            shifts: 'No',
            geotag: '37.3382, -121.8863'
        },
        {
            id: 2,
            name: 'Global Manufacturing',
            standard: 'ISO 14001:2015',
            status: 'Active',
            nextAudit: '2024-04-20',
            contactPerson: 'Bob Builder',
            email: 'bob@globalmfg.com',
            phone: '+1-555-0102',
            address: '456 Industrial Way',
            city: 'Detroit',
            country: 'USA',
            employees: 500,
            sites: 1,
            shifts: 'Yes',
            geotag: '42.3314, -83.0458'
        },
        {
            id: 3,
            name: 'SecureData Corp',
            standard: 'ISO 27001:2022',
            status: 'Suspended',
            nextAudit: '2024-05-10',
            contactPerson: 'Charlie Root',
            email: 'croot@securedata.com',
            phone: '+1-555-0103',
            address: '789 Cyber Lane',
            city: 'Austin',
            country: 'USA',
            employees: 50,
            sites: 1,
            shifts: 'No',
            geotag: '30.2672, -97.7431'
        }
    ],
    auditors: [
        {
            id: 1,
            name: 'John Smith',
            role: 'Lead Auditor',
            standards: ['ISO 9001', 'ISO 14001'],
            experience: 12,
            domainExpertise: ['Quality Management', 'Environmental Management'],
            industries: ['Manufacturing', 'Automotive'],
            age: 45,
            manDayRate: 800,
            email: 'john.smith@auditors.com',
            phone: '+1-555-1001',
            location: 'New York, USA',
            auditHistory: [
                { client: 'Tech Solutions Ltd', date: '2024-01-15', type: 'Surveillance' },
                { client: 'Global Manufacturing', date: '2023-11-10', type: 'Stage 2' }
            ],
            education: { degree: 'Master', fieldOfStudy: 'Industrial Engineering', specialization: 'Six Sigma Black Belt, ISO Lead Auditor' },
            hasPassport: true,
            willingToTravel: 'international',
            languages: ['English', 'Spanish'],
            pictureUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
            customerRating: 5
        },
        {
            id: 2,
            name: 'Sarah Johnson',
            role: 'Auditor',
            standards: ['ISO 27001'],
            experience: 6,
            domainExpertise: ['Information Security', 'IT Governance'],
            industries: ['IT', 'Financial Services'],
            age: 35,
            manDayRate: 600,
            email: 'sarah.j@auditors.com',
            phone: '+1-555-1002',
            location: 'Chicago, USA',
            auditHistory: [
                { client: 'SecureData Corp', date: '2024-02-20', type: 'Stage 1' }
            ],
            education: { degree: 'Master', fieldOfStudy: 'Information Security', specialization: 'CISSP, CISA certified' },
            hasPassport: true,
            willingToTravel: 'regional',
            languages: ['English', 'French'],
            pictureUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
            customerRating: 4
        },
        {
            id: 3,
            name: 'Mike Chen',
            role: 'Technical Expert',
            standards: ['ISO 45001'],
            experience: 8,
            domainExpertise: ['Occupational Health', 'Safety Systems'],
            industries: ['Construction', 'Oil & Gas'],
            age: 40,
            manDayRate: 700,
            email: 'mike.chen@auditors.com',
            phone: '+1-555-1003',
            location: 'Houston, USA',
            auditHistory: [],
            education: { degree: 'Bachelor', fieldOfStudy: 'Safety Engineering', specialization: 'NEBOSH certified' },
            hasPassport: true,
            willingToTravel: 'international',
            languages: ['English', 'Mandarin', 'Cantonese'],
            pictureUrl: 'https://randomuser.me/api/portraits/men/3.jpg',
            customerRating: 4
        }
    ],
    auditPrograms: [],
    auditPlans: [],
    auditReports: [],
    certificationDecisions: [
        { client: 'Tech Solutions Ltd', standard: 'ISO 9001:2015', date: '2024-01-15', decision: 'Granted' },
        { client: 'Global Manufacturing', standard: 'ISO 14001:2015', date: '2024-02-10', decision: 'Granted' }
    ],
    documents: [],
    settings: {
        standards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'],
        roles: ['Lead Auditor', 'Auditor', 'Technical Expert']
    }
};

// Global Exports for Modules
window.state = state;
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;

// State Management
function saveState() {
    try {
        localStorage.setItem('auditCB360State', JSON.stringify(state));
    } catch (e) {
        console.warn('LocalStorage not available:', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('auditCB360State');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(state, data);
        }
    } catch (e) {
        console.warn('LocalStorage not available:', e);
    }
}

loadState();

// Helper functions (Safe ID Generation)
function getNextId(collection) {
    if (!state[collection]) return 1;
    const items = state[collection];
    return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
}

function addRecord(collection, data) {
    const newRecord = { id: getNextId(collection), ...data };
    state[collection].push(newRecord);
    saveState();
    return newRecord;
}

function updateRecord(collection, id, data) {
    const index = state[collection].findIndex(item => item.id === id);
    if (index !== -1) {
        state[collection][index] = { ...state[collection][index], ...data };
        saveState();
        return state[collection][index];
    }
    return null;
}

function deleteRecord(collection, id) {
    const index = state[collection].findIndex(item => item.id === id);
    if (index !== -1) {
        state[collection].splice(index, 1);
        saveState();
        return true;
    }
    return false;
}

// DOM Elements
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.main-nav li');

// Export important items to window for modules to access
window.state = state;
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;

// Navigation Handler
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Update Active State
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update Module
        const moduleName = item.getAttribute('data-module');
        state.currentModule = moduleName;

        // Render Content
        renderModule(moduleName);
    });
});

// Module Loader
const loadedModules = new Set();

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (loadedModules.has(src)) {
            resolve();
            return;
        }
        const script = document.createElement('script');

        // Handle file protocol (avoid query params for local files if strict)
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            script.src = src;
        } else {
            // Add timestamp to prevent caching issues on web servers
            script.src = `${src}?v=${window.appTimestamp || (window.appTimestamp = Date.now())}`;
        }

        script.onload = () => {
            loadedModules.add(src);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            reject(new Error(`Failed to load ${src}`));
        };
        document.body.appendChild(script);
    });
}

// Render Functions
async function renderModule(moduleName) {
    // Update Title
    const titleMap = {
        'dashboard': 'Dashboard',
        'clients': 'Client Management',
        'auditors': 'Auditor Management',
        'audit-programs': 'Audit Programs',
        'audit-planning': 'Audit Planning',
        'manday-calculator': 'Man-Day Calculator',
        'audit-execution': 'Execution & Reports',
        'certification': 'Certification Decisions',
        'documents': 'Document Management',
        'settings': 'Settings'
    };
    pageTitle.textContent = titleMap[moduleName] || 'Dashboard';

    // Show Loading State
    contentArea.innerHTML = '<div class="fade-in" style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary-color);"></i></div>';

    try {
        // Load required scripts dynamically
        const scriptMap = {
            'dashboard': ['dashboard-module.js', 'export-module.js'],
            'auditors': ['advanced-modules.js', 'export-module.js'],
            'audit-programs': ['programs-module.js', 'export-module.js'],
            'audit-planning': ['advanced-modules.js', 'planning-module.js'],
            'audit-execution': ['execution-module.js'],
            'manday-calculator': ['advanced-modules.js'],
            'documents': ['documents-module.js'],
            'settings': ['settings-module.js'],
            'clients': ['clients-module.js', 'export-module.js']
        };

        if (scriptMap[moduleName]) {
            for (const script of scriptMap[moduleName]) {
                await loadScript(script);
            }
        }

        // Render Specific Content
        switch (moduleName) {
            case 'dashboard':
                if (typeof renderDashboardEnhanced === 'function') {
                    renderDashboardEnhanced();
                } else {
                    renderDashboard();
                }
                break;
            case 'clients':
                if (typeof renderClientsEnhanced === 'function') {
                    renderClientsEnhanced();
                } else {
                    renderClients();
                }
                break;
            case 'auditors':
                if (typeof renderAuditorsEnhanced === 'function') {
                    renderAuditorsEnhanced();
                } else {
                    renderAuditors();
                }
                break;
            case 'audit-programs':
                if (typeof renderAuditProgramsEnhanced === 'function') {
                    renderAuditProgramsEnhanced();
                } else {
                    renderAuditPrograms();
                }
                break;
            case 'audit-planning':
                if (typeof renderAuditPlanningEnhanced === 'function') {
                    renderAuditPlanningEnhanced();
                } else {
                    renderAuditPlanning();
                }
                break;
            case 'audit-execution':
                if (typeof renderAuditExecutionEnhanced === 'function') {
                    renderAuditExecutionEnhanced();
                } else {
                    renderAuditExecution();
                }
                break;
            case 'certification':
                renderCertification();
                break;
            case 'manday-calculator':
                if (typeof renderManDayCalculator === 'function') {
                    renderManDayCalculator();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'documents':
                if (typeof renderDocumentsEnhanced === 'function') {
                    renderDocumentsEnhanced();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'settings':
                if (typeof renderSettingsEnhanced === 'function') {
                    renderSettingsEnhanced();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            default:
                renderPlaceholder(moduleName);
        }
    } catch (error) {
        console.error('Error loading module:', error);
        contentArea.innerHTML = `
            <div class="fade-in" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h3>Error Loading Module</h3>
                <p style="color: var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="renderModule('${moduleName}')">
                    <i class="fa-solid fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderDashboard() {
    const dashboardHTML = `
        <div class="dashboard-grid fade-in">
            <div class="card stat-card">
                <h3>Total Clients</h3>
                <p class="stat-value">${state.clients.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Active Auditors</h3>
                <p class="stat-value">${state.auditors.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Pending Audits</h3>
                <p class="stat-value">3</p>
            </div>
            <div class="card stat-card">
                <h3>Certificates Issued</h3>
                <p class="stat-value">12</p>
            </div>
        </div>
        
        <div class="card fade-in" style="margin-top: 2rem;">
            <h3>Recent Activity</h3>
            <p style="color: var(--text-secondary); margin-top: 1rem;">No recent activity to show.</p>
        </div>
    `;
    contentArea.innerHTML = dashboardHTML;
}

function renderClients() {
    contentArea.innerHTML = '<p>Loading Clients...</p>';
}

function renderAuditors() {
    contentArea.innerHTML = '<p>Loading Auditors...</p>';
}

function renderAuditPrograms() {
    contentArea.innerHTML = '<p>Loading Audit Programs...</p>';
}

function renderAuditPlanning() {
    contentArea.innerHTML = '<p>Loading Audit Planning...</p>';
}

function renderAuditExecution() {
    contentArea.innerHTML = '<p>Loading Audit Execution...</p>';
}

function renderCertification() {
    const rows = state.certificationDecisions.map(decision => `
        <tr>
            <td>${decision.client}</td>
            <td>${decision.standard}</td>
            <td>${decision.date}</td>
            <td><span class="status-badge status-${decision.decision.toLowerCase().replace(' ', '-')}">${decision.decision}</span></td>
            <td>
                <button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-file-certificate"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Standard</th>
                            <th>Decision Date</th>
                            <th>Decision</th>
                            <th>Certificate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    contentArea.innerHTML = html;
}

function renderPlaceholder(moduleName) {
    contentArea.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: 3rem;">
            <i class="fa-solid fa-person-digging" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
            <h3>${moduleName.replace('-', ' ').toUpperCase()} Module</h3>
            <p style="color: var(--text-secondary);">This module is currently under development.</p>
        </div>
    `;
}

// Notification Helper
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'fade-in';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.background = type === 'success' ? '#10b981' : '#ef4444';
    notification.style.color = 'white';
    notification.style.padding = '1rem 2rem';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    notification.style.zIndex = '10001';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Modal Helpers
function openModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
        closeModal();
    }
});

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

function toggleMobileMenu() {
    sidebar.classList.toggle('mobile-open');
    mobileOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
}

// Close mobile menu when navigation item is clicked
navItems.forEach(item => {
    item.addEventListener('click', closeMobileMenu);
});

// Keyboard Navigation Support
navItems.forEach(item => {
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
        }
    });
});

// ESC key to close mobile menu and modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeMobileMenu();
        if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
            closeModal();
        }
    }
});

// Export helper function for use in modules
window.saveData = saveState;

// Lazy-loading modal wrapper functions
// These load modules on demand when create/add buttons are clicked
const modalFunctionCache = {};

async function lazyLoadModal(modulePath, functionName) {
    // Load the module if not already loaded
    try {
        await loadScript(modulePath);

        // Retry finding the function for up to 1 second
        let retries = 10;
        while (retries > 0) {
            if (typeof window[functionName] === 'function') {
                window[functionName]();
                return;
            }
            await new Promise(r => setTimeout(r, 100)); // Wait 100ms
            retries--;
        }

        console.error(`Function ${functionName} not found after loading ${modulePath}`);
        showNotification(`Error loading ${functionName}. Please refresh the page.`, 'error');
    } catch (error) {
        console.error(`Error loading module ${modulePath}:`, error);
        showNotification(`Failed to load module: ${error.message}`, 'error');
    }
}

// Initial Render
renderModule('dashboard');

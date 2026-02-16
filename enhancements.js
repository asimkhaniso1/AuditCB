// ============================================
// ENHANCEMENTS MODULE v1.0
// 1. Lazy Loading for Large Checklists
// 2. Keyboard Shortcuts
// 3. Clause Analytics (NCR by Clause)
// 4. PDF Export for Hierarchical Checklists
// 5. Mobile/Tablet Responsive Helpers
// ============================================

(function () {
    'use strict';

    // ============================================
    // 1. LAZY LOADING FOR LARGE CHECKLISTS
    // Progressive rendering — render 20 items at a time
    // ============================================

    const LAZY_BATCH_SIZE = 30;

    window.LazyChecklist = {
        observer: null,
        rendered: 0,
        items: [],
        container: null,

        /**
         * Initialize lazy rendering for a checklist detail view.
         * Instead of rendering 200+ items at once, renders in batches.
         * @param {HTMLElement} container - The DOM container for items
         * @param {Array} allItems - Array of {html, clauseRef} to render
         */
        init(container, allItems) {
            this.container = container;
            this.items = allItems;
            this.rendered = 0;

            // Render first batch immediately
            this.renderBatch();

            // Set up intersection observer for sentinel
            this.setupObserver();
        },

        renderBatch() {
            if (this.rendered >= this.items.length) return;

            const fragment = document.createDocumentFragment();
            const end = Math.min(this.rendered + LAZY_BATCH_SIZE, this.items.length);

            for (let i = this.rendered; i < end; i++) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = this.items[i].html;
                while (wrapper.firstChild) {
                    fragment.appendChild(wrapper.firstChild);
                }
            }

            // Remove old sentinel if it exists
            const oldSentinel = this.container.querySelector('.lazy-sentinel');
            if (oldSentinel) oldSentinel.remove();

            this.container.appendChild(fragment);
            this.rendered = end;

            // Add sentinel element if more items remain
            if (this.rendered < this.items.length) {
                const sentinel = document.createElement('div');
                sentinel.className = 'lazy-sentinel';
                sentinel.style.cssText = 'height: 60px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 0.85rem;';
                sentinel.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Loading more items... (${this.rendered}/${this.items.length})`;
                this.container.appendChild(sentinel);

                // Observe new sentinel
                if (this.observer) this.observer.observe(sentinel);
            } else {
                // Show completion indicator
                const done = document.createElement('div');
                done.style.cssText = 'padding: 0.75rem; text-align: center; color: var(--text-secondary); font-size: 0.8rem; border-top: 1px dashed var(--border-color); margin-top: 0.5rem;';
                done.innerHTML = `<i class="fa-solid fa-check-circle" style="color: var(--success-color); margin-right: 0.4rem;"></i> All ${this.items.length} items loaded`;
                this.container.appendChild(done);
            }
        },

        setupObserver() {
            if (this.observer) this.observer.disconnect();

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.observer.unobserve(entry.target);
                        this.renderBatch();
                    }
                });
            }, {
                root: document.getElementById('content-area'),
                rootMargin: '200px'
            });
        },

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.items = [];
            this.rendered = 0;
            this.container = null;
        }
    };


    // ============================================
    // 2. KEYBOARD SHORTCUTS
    // Global shortcut handler for power users
    // ============================================

    const SHORTCUTS = {
        'd': { module: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt' },
        'c': { module: 'clients', label: 'Clients', icon: 'fa-building' },
        'a': { module: 'auditors', label: 'Auditors', icon: 'fa-users' },
        'l': { module: 'checklists', label: 'Checklists', icon: 'fa-list-check' },
        'p': { module: 'audit-planning', label: 'Audit Planning', icon: 'fa-calendar' },
        'e': { module: 'audit-execution', label: 'Execute & Report', icon: 'fa-play-circle' },
        's': { module: 'settings', label: 'Settings', icon: 'fa-cog' },
    };

    let shortcutsEnabled = true;
    let shortcutOverlayTimeout = null;

    function handleKeyboardShortcut(e) {
        // Don't trigger when typing in inputs/textareas/selects
        if (!shortcutsEnabled) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

        // Alt+key shortcuts for navigation
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            const key = e.key.toLowerCase();
            const shortcut = SHORTCUTS[key];
            if (shortcut && typeof window.renderModule === 'function') {
                e.preventDefault();
                window.renderModule(shortcut.module);
                showShortcutToast(shortcut.label, shortcut.icon);
                return;
            }
        }

        // Alt+? to show shortcut help
        if (e.altKey && (e.key === '?' || e.key === '/')) {
            e.preventDefault();
            toggleShortcutHelp();
            return;
        }

        // Escape to close modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-overlay');
            if (modal && modal.style.display !== 'none') {
                if (typeof window.closeModal === 'function') window.closeModal();
            }
        }
    }

    function showShortcutToast(label, icon) {
        // Remove existing toast
        const existing = document.getElementById('shortcut-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'shortcut-toast';
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
            background: rgba(15, 23, 42, 0.9); color: white; padding: 10px 20px;
            border-radius: 12px; font-size: 0.85rem; font-weight: 500;
            z-index: 9999; display: flex; align-items: center; gap: 8px;
            backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> Navigated to <strong>${label}</strong>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        clearTimeout(shortcutOverlayTimeout);
        shortcutOverlayTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }

    function toggleShortcutHelp() {
        const existing = document.getElementById('shortcut-help-overlay');
        if (existing) {
            existing.remove();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'shortcut-help-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;
        `;
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const card = document.createElement('div');
        card.style.cssText = `
            background: white; border-radius: 16px; padding: 2rem; max-width: 480px; width: 90%;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        `;

        const shortcutRows = Object.entries(SHORTCUTS).map(([key, info]) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid ${info.icon}" style="width: 20px; color: var(--primary-color);"></i>
                    <span>${info.label}</span>
                </div>
                <kbd style="background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; border: 1px solid #e2e8f0;">Alt + ${key.toUpperCase()}</kbd>
            </div>
        `).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-keyboard" style="color: var(--primary-color);"></i> Keyboard Shortcuts
                </h3>
                <button onclick="this.closest('#shortcut-help-overlay').remove()" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary);">✕</button>
            </div>
            ${shortcutRows}
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; margin-top: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-circle-question" style="width: 20px; color: #8b5cf6;"></i>
                    <span>Show this help</span>
                </div>
                <kbd style="background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; border: 1px solid #e2e8f0;">Alt + ?</kbd>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-xmark" style="width: 20px; color: var(--danger-color);"></i>
                    <span>Close modal / dialog</span>
                </div>
                <kbd style="background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.8rem; border: 1px solid #e2e8f0;">Escape</kbd>
            </div>
            <p style="margin: 1rem 0 0; font-size: 0.75rem; color: var(--text-secondary); text-align: center;">
                Press <kbd style="background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 0.75rem; border: 1px solid #e2e8f0;">Escape</kbd> or click outside to close
            </p>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    // Register keyboard handler
    document.addEventListener('keydown', handleKeyboardShortcut);

    // Expose for toggling
    window.toggleShortcutHelp = toggleShortcutHelp;
    window.shortcutsEnabled = (enabled) => { shortcutsEnabled = enabled; };


    // ============================================
    // 3. CLAUSE-LEVEL NCR ANALYTICS
    // Tracks which clauses are most frequently non-compliant
    // ============================================

    window.getClauseAnalytics = function () {
        const reports = window.state?.auditReports || [];
        const clauseMap = {}; // clause -> { major: n, minor: n, observations: n, total: n }

        reports.forEach(report => {
            const ncrs = report.ncrs || [];
            ncrs.forEach(ncr => {
                const clause = ncr.clause || ncr.requirement || 'Unknown';
                // Normalize clause reference (e.g., "4.1" from "Clause 4.1 - Context")
                const normalizedClause = clause.match(/\d+(\.\d+)*/)?.[0] || clause;

                if (!clauseMap[normalizedClause]) {
                    clauseMap[normalizedClause] = {
                        clause: normalizedClause,
                        fullRef: clause,
                        major: 0, minor: 0, observations: 0, total: 0,
                        clients: new Set()
                    };
                }

                const entry = clauseMap[normalizedClause];
                entry.total++;
                if (ncr.type === 'major') entry.major++;
                else if (ncr.type === 'minor') entry.minor++;
                else entry.observations++;

                if (report.client) entry.clients.add(report.client);
            });
        });

        // Convert to sorted array
        return Object.values(clauseMap)
            .map(entry => ({ ...entry, clients: entry.clients.size }))
            .sort((a, b) => b.total - a.total);
    };

    /**
     * Render a "Top Non-Compliant Clauses" card for the dashboard.
     * Returns HTML string.
     */
    window.renderClauseAnalyticsCard = function () {
        const analytics = window.getClauseAnalytics();
        const top10 = analytics.slice(0, 10);

        if (top10.length === 0) {
            return `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">
                        <i class="fa-solid fa-magnifying-glass-chart" style="color: #8b5cf6; margin-right: 0.5rem;"></i>
                        Clause Compliance Analytics
                    </h3>
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-chart-bar" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p style="margin: 0;">No NCR data available yet. Analytics will appear once audit findings are recorded.</p>
                    </div>
                </div>
            `;
        }

        const maxTotal = top10[0]?.total || 1;

        const rows = top10.map((item, i) => {
            const barWidth = Math.max(10, (item.total / maxTotal) * 100);
            const bgColor = item.major > 0 ? '#fef2f2' : '#fffbeb';
            const barColor = item.major > 0 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)';

            return `
                <div style="display: grid; grid-template-columns: 60px 1fr auto; align-items: center; gap: 12px; padding: 8px 0; ${i < top10.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : ''}">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--primary-color); text-align: center;">
                        ${window.UTILS?.escapeHtml(item.clause) || item.clause}
                    </div>
                    <div style="position: relative;">
                        <div style="height: 24px; background: ${bgColor}; border-radius: 6px; overflow: hidden;">
                            <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; border-radius: 6px; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; min-width: 120px; justify-content: flex-end;">
                        ${item.major > 0 ? `<span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">${item.major} Major</span>` : ''}
                        ${item.minor > 0 ? `<span style="background: #fffbeb; color: #d97706; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">${item.minor} Minor</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">
                        <i class="fa-solid fa-magnifying-glass-chart" style="color: #8b5cf6; margin-right: 0.5rem;"></i>
                        Top Non-Compliant Clauses
                    </h3>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">
                        ${analytics.length} clause(s) with findings
                    </span>
                </div>
                ${rows}
            </div>
        `;
    };


    // ============================================
    // 4. PDF EXPORT FOR HIERARCHICAL CHECKLISTS
    // Generates a print-ready PDF using browser print API
    // ============================================

    window.exportChecklistPDF = function (checklistId) {
        const checklist = (window.state?.checklists || []).find(c => String(c.id) === String(checklistId));
        if (!checklist) {
            window.showNotification?.('Checklist not found', 'error');
            return;
        }

        // Build hierarchical HTML
        let itemsHtml = '';
        let questionNumber = 0;

        if (checklist.clauses && checklist.clauses.length > 0) {
            checklist.clauses.forEach(clause => {
                itemsHtml += `
                    <div class="pdf-clause-header">
                        <span class="pdf-clause-badge">${clause.mainClause || ''}</span>
                        ${window.UTILS?.escapeHtml(clause.title || 'Untitled Clause') || clause.title}
                    </div>
                `;

                const subClauses = clause.subClauses || [];
                subClauses.forEach(sub => {
                    const items = sub.items || [sub]; // Support both nested and flat
                    items.forEach(item => {
                        questionNumber++;
                        const ref = item.clauseRef || sub.clauseRef || '';
                        itemsHtml += `
                            <div class="pdf-item-row">
                                <div class="pdf-item-num">${questionNumber}</div>
                                <div class="pdf-item-ref">${ref}</div>
                                <div class="pdf-item-question">${window.UTILS?.escapeHtml(item.requirement || item.question || '') || ''}</div>
                                <div class="pdf-item-status">☐ C &nbsp; ☐ NC &nbsp; ☐ OFI</div>
                                <div class="pdf-item-notes"></div>
                            </div>
                        `;
                    });
                });
            });
        } else if (checklist.items) {
            checklist.items.forEach((item, i) => {
                itemsHtml += `
                    <div class="pdf-item-row">
                        <div class="pdf-item-num">${i + 1}</div>
                        <div class="pdf-item-ref">${item.category || ''}</div>
                        <div class="pdf-item-question">${window.UTILS?.escapeHtml(item.requirement || item.question || '') || ''}</div>
                        <div class="pdf-item-status">☐ C &nbsp; ☐ NC &nbsp; ☐ OFI</div>
                        <div class="pdf-item-notes"></div>
                    </div>
                `;
            });
        }

        const printWindow = window.open('', '_blank', 'width=1000,height=700');
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${checklist.name || 'Audit Checklist'} - Export</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #1e293b; font-size: 9pt; line-height: 1.4; }
        
        @page { 
            size: A4 landscape; 
            margin: 15mm;
        }
        
        .pdf-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;
        }
        .pdf-header-left h1 { font-size: 16pt; color: #1e293b; margin-bottom: 4px; }
        .pdf-header-left p { font-size: 8pt; color: #64748b; }
        .pdf-header-right { text-align: right; font-size: 8pt; color: #64748b; }
        .pdf-header-right .standard-tag {
            display: inline-block; background: #eff6ff; color: #2563eb; padding: 3px 10px;
            border-radius: 12px; font-weight: 600; font-size: 8pt; margin-bottom: 4px;
        }
        
        .pdf-meta {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
            padding: 10px; margin-bottom: 16px; font-size: 8pt;
        }
        .pdf-meta-item label { color: #64748b; font-weight: 500; display: block; margin-bottom: 2px; }
        .pdf-meta-item .value { border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; min-height: 18px; }
        
        .pdf-clause-header {
            background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;
            padding: 8px 12px; border-radius: 6px; margin: 12px 0 4px;
            font-weight: 600; font-size: 10pt; display: flex; align-items: center; gap: 8px;
            page-break-after: avoid;
        }
        .pdf-clause-badge {
            background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 4px;
            font-size: 9pt; font-weight: 700;
        }
        
        .pdf-item-row {
            display: grid; grid-template-columns: 36px 50px 1fr 100px 150px;
            gap: 4px; border-bottom: 1px solid #e2e8f0; padding: 5px 4px;
            page-break-inside: avoid; align-items: center; font-size: 8pt;
        }
        .pdf-item-row:nth-child(even) { background: #fafbfc; }
        .pdf-item-num { text-align: center; font-weight: 600; color: #64748b; }
        .pdf-item-ref { font-weight: 600; color: #3b82f6; font-size: 8pt; }
        .pdf-item-question { padding-right: 6px; }
        .pdf-item-status { font-size: 7.5pt; color: #475569; text-align: center; }
        .pdf-item-notes { border-left: 1px solid #e2e8f0; padding-left: 6px; min-height: 20px; }
        
        .pdf-table-header {
            display: grid; grid-template-columns: 36px 50px 1fr 100px 150px;
            gap: 4px; background: #f1f5f9; padding: 6px 4px; font-weight: 600;
            font-size: 7.5pt; text-transform: uppercase; color: #64748b;
            letter-spacing: 0.05em; border-bottom: 2px solid #cbd5e1; border-radius: 4px 4px 0 0;
        }
        
        .pdf-footer {
            margin-top: 20px; padding-top: 12px; border-top: 2px solid #e2e8f0;
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; font-size: 8pt;
        }
        .pdf-footer-block label { color: #64748b; font-weight: 500; display: block; margin-bottom: 6px; }
        .pdf-footer-block .sign-line { border-bottom: 1px solid #94a3b8; height: 30px; }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="pdf-header">
        <div class="pdf-header-left">
            <h1>${window.UTILS?.escapeHtml(checklist.name) || checklist.name}</h1>
            <p>Audit Checklist • ${questionNumber} Items • Type: ${checklist.type || 'Custom'}</p>
        </div>
        <div class="pdf-header-right">
            <div class="standard-tag">${window.UTILS?.escapeHtml(checklist.standard || 'General') || 'General'}</div>
            <p>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>AuditCB360 Platform</p>
        </div>
    </div>
    
    <div class="pdf-meta">
        <div class="pdf-meta-item"><label>Client</label><div class="value"></div></div>
        <div class="pdf-meta-item"><label>Audit Date</label><div class="value"></div></div>
        <div class="pdf-meta-item"><label>Lead Auditor</label><div class="value"></div></div>
        <div class="pdf-meta-item"><label>Audit Type</label><div class="value"></div></div>
    </div>
    
    <div class="pdf-table-header">
        <div style="text-align: center;">#</div>
        <div>Ref</div>
        <div>Requirement / Question</div>
        <div style="text-align: center;">Status</div>
        <div>Notes / Evidence</div>
    </div>
    
    ${itemsHtml}
    
    <div class="pdf-footer">
        <div class="pdf-footer-block">
            <label>Lead Auditor Signature</label>
            <div class="sign-line"></div>
        </div>
        <div class="pdf-footer-block">
            <label>Auditee Representative</label>
            <div class="sign-line"></div>
        </div>
        <div class="pdf-footer-block">
            <label>Date</label>
            <div class="sign-line"></div>
        </div>
    </div>
</body>
</html>`;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for fonts to load then trigger print
        printWindow.onload = function () {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };
    };


    // ============================================
    // 5. MOBILE / TABLET RESPONSIVE HELPERS
    // Runtime utilities for responsive behavior
    // ============================================

    window.ResponsiveHelper = {
        breakpoints: {
            mobile: 480,
            tablet: 768,
            desktop: 1024,
            wide: 1440
        },

        /**
         * Get current device category
         */
        getDevice() {
            const w = window.innerWidth;
            if (w <= this.breakpoints.mobile) return 'mobile';
            if (w <= this.breakpoints.tablet) return 'tablet-portrait';
            if (w <= this.breakpoints.desktop) return 'tablet-landscape';
            return 'desktop';
        },

        /**
         * Check if currently on touch device
         */
        isTouch() {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        },

        /**
         * Adapt grid columns based on screen width
         * @param {string} selector - CSS selector for grid containers
         */
        adaptGrids() {
            const device = this.getDevice();
            document.querySelectorAll('.dashboard-stats-grid').forEach(grid => {
                if (device === 'mobile') {
                    grid.style.gridTemplateColumns = '1fr';
                } else if (device === 'tablet-portrait') {
                    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                } else {
                    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
                }
            });

            document.querySelectorAll('.quick-actions-grid').forEach(grid => {
                if (device === 'mobile') {
                    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                } else {
                    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
                }
            });
        },

        /**
         * Initialize responsive handlers
         */
        init() {
            // Adapt on load
            this.adaptGrids();

            // Adapt on resize (debounced)
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => this.adaptGrids(), 150);
            });

            // Add touch class to body for CSS hooks
            if (this.isTouch()) {
                document.body.classList.add('touch-device');
            }

            // Add device class
            document.body.setAttribute('data-device', this.getDevice());
            window.addEventListener('resize', () => {
                document.body.setAttribute('data-device', this.getDevice());
            });
        }
    };

    // Auto-init responsive helpers on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.ResponsiveHelper.init());
    } else {
        window.ResponsiveHelper.init();
    }


    // ============================================
    // KEYBOARD SHORTCUT INDICATOR (subtle bottom bar)
    // ============================================
    function addShortcutHint() {
        const hint = document.createElement('div');
        hint.id = 'shortcut-hint';
        hint.style.cssText = `
            position: fixed; bottom: 8px; right: 16px; z-index: 50;
            font-size: 0.7rem; color: #94a3b8; display: flex; align-items: center; gap: 6px;
            opacity: 0.6; transition: opacity 0.2s;
        `;
        hint.innerHTML = `
            <i class="fa-solid fa-keyboard"></i>
            <span>Press <kbd style="background: #f1f5f9; padding: 0 4px; border-radius: 3px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.65rem;">Alt+?</kbd> for shortcuts</span>
        `;
        hint.onmouseenter = () => { hint.style.opacity = '1'; };
        hint.onmouseleave = () => { hint.style.opacity = '0.6'; };
        hint.onclick = toggleShortcutHelp;
        hint.style.cursor = 'pointer';
        document.body.appendChild(hint);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addShortcutHint);
    } else {
        addShortcutHint();
    }

    // ============================================
    // 6. DATE PASTE HANDLER
    // Allows pasting dates into input[type=date] fields
    // Browsers often BLOCK paste events on date inputs, so we use
    // both paste event AND Ctrl+V keydown with clipboard API fallback.
    // ============================================

    const MONTH_MAP = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'june': '06', 'july': '07', 'august': '08', 'september': '09',
        'october': '10', 'november': '11', 'december': '12'
    };

    function parsePastedDate(text) {
        if (!text) return null;
        text = text.trim();

        // Already ISO format: yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

        // Browser display format: "16-Feb-2026" or "16 Feb 2026"
        let m = text.match(/^(\d{1,2})[\-\s]([A-Za-z]+)[\-\s](\d{4})$/);
        if (m) {
            const mon = MONTH_MAP[m[2].toLowerCase()];
            if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
        }

        // "Feb 16, 2026" or "February 16 2026"
        m = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
        if (m) {
            const mon = MONTH_MAP[m[1].toLowerCase()];
            if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
        }

        // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
        m = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (m) {
            const day = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            const year = m[3];
            if (parseInt(m[1]) > 12) {
                return `${year}-${month}-${day}`;
            } else if (parseInt(m[2]) > 12) {
                return `${year}-${day}-${month}`;
            }
            return `${year}-${month}-${day}`;
        }

        // yyyy/mm/dd
        m = text.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (m) {
            return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        }

        // Try native Date parsing as last resort
        const d = new Date(text);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
            return d.toISOString().split('T')[0];
        }

        return null;
    }

    function applyDateToInput(input, dateText) {
        const isoDate = parsePastedDate(dateText);
        if (isoDate) {
            // Use the native value setter to bypass browser restrictions
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(input, isoDate);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[Date Paste] "${dateText}" → ${isoDate}`);
            return true;
        }
        return false;
    }

    // Method 1: Standard paste event
    document.addEventListener('paste', function (e) {
        const input = e.target;
        if (!input || input.tagName !== 'INPUT' || input.type !== 'date') return;

        const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
        if (pastedText && applyDateToInput(input, pastedText)) {
            e.preventDefault();
        }
    }, true); // Use capture phase to fire before browser blocks it

    // Method 2: Ctrl+V keydown fallback — reads clipboard via async API
    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey && e.key === 'v') && !(e.metaKey && e.key === 'v')) return;

        const input = e.target || document.activeElement;
        if (!input || input.tagName !== 'INPUT' || input.type !== 'date') return;

        // Use Clipboard API (async) to read text
        if (navigator.clipboard && navigator.clipboard.readText) {
            e.preventDefault();
            navigator.clipboard.readText().then(function (clipText) {
                if (clipText) {
                    applyDateToInput(input, clipText);
                }
            }).catch(function (err) {
                console.log('[Date Paste] Clipboard read failed:', err.message);
            });
        }
    }, true);

    console.log('✅ Enhancements module loaded: Lazy Load | Shortcuts | Analytics | PDF Export | Responsive | Date Paste');
})();
